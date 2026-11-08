// b12189 LFM3: recurrent blocks + dense attention + sliding-window attention.
// Dimensions must come from the file. Never infer layouts from model names/sizes.
function hybridKvLayout(architecture,metadata,blocks){
 if(architecture!=='lfm3'||!Number.isInteger(blocks)||blocks<1||blocks>4096)return;
 const get=k=>metadata[architecture+'.'+k],heads=get('attention.head_count'),kv=get('attention.head_count_kv'),pattern=get('attention.sliding_window_pattern'),window=get('attention.sliding_window'),embedding=get('embedding_length'),conv=get('shortconv.l_cache');
 const positive=n=>Number.isSafeInteger(n)&&n>0;
 if(!Array.isArray(kv)||kv.length!==blocks||!Array.isArray(pattern)||pattern.length!==blocks||!positive(window)||!positive(embedding)||!positive(conv))return;
 const layers=[];
 for(let i=0;i<blocks;i++){
  const h=Array.isArray(heads)?heads[i]:heads,k=kv[i],key=get('attention.key_length')||(embedding/h),value=get('attention.value_length')||(embedding/h);
  if(!Number.isSafeInteger(k)||k<0||![0,1,false,true].includes(pattern[i]))return;
  if(k===0){layers.push({bytesPerToken:0,stateAllowance:4*embedding*(conv-1)*64});continue;}
  if(!positive(h)||!positive(key)||!positive(value))return;
  layers.push({bytesPerToken:2*k*(key+value),window:pattern[i]?window:undefined});
 }
 return layers;
}
function hybridKvBytes(layout,layers,context){
 const count=Math.min(layers,layout.length),selected=layout.slice(layout.length-count);
 const pad=n=>Math.ceil(n/256)*256;
 return selected.reduce((bytes,layer)=>bytes+(layer.bytesPerToken?layer.bytesPerToken*pad(layer.window?Math.min(context,layer.window+64):context):layer.stateAllowance),0);
}
module.exports={hybridKvLayout,hybridKvBytes};
