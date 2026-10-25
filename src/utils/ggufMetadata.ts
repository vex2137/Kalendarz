// GGUF metadata is walked with a bounded window. Large tokenizer tables are
// skipped rather than decoded or buffered; tensor support is an engine check.
export async function ggufMetadata(blob: Blob) {
  const decoder=new TextDecoder('utf-8',{fatal:true});
  let offset=0,base=-1,buffer=new ArrayBuffer(0),view=new DataView(buffer);
  const bound=(n:number)=>{
    if(!Number.isSafeInteger(n)||n<0||offset+n>blob.size)throw Error('model-gguf-invalid');
    if(offset+n>128*1024*1024)throw Error('model-gguf-metadata-limit');
  };
  const ensure=async(n:number)=>{
    bound(n);
    if(base<0||offset<base||offset+n>base+buffer.byteLength){
      base=offset;buffer=await blob.slice(base,Math.min(blob.size,base+Math.max(64*1024,n))).arrayBuffer();view=new DataView(buffer);
      if(buffer.byteLength<n)throw Error('model-gguf-invalid');
    }
    const start=offset-base;offset+=n;return start;
  };
  const skip=(n:number)=>{bound(n);offset+=n;};
  // Read after ensure completes: it can replace the current DataView.
  const read32=async()=>{const p=await ensure(4);return view.getUint32(p,true);};
  const u64=async()=>{const p=await ensure(8),n=view.getBigUint64(p,true);if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('model-gguf-invalid');return Number(n);};
  const string=async()=>{const n=await u64();if(n>64*1024)throw Error('model-gguf-metadata-limit');const p=await ensure(n);return decoder.decode(new Uint8Array(buffer,p,n));};
  const magic=await ensure(4);
  if(decoder.decode(new Uint8Array(buffer,magic,4))!=='GGUF'||![2,3].includes(await read32()))throw Error('model-gguf-invalid');
  const tensors=await u64(),count=await u64();
  if(!tensors||tensors>1_000_000||!count||count>100_000)throw Error('model-gguf-invalid');
  const sizes:Record<number,number>={0:1,1:1,2:2,3:2,4:4,5:4,6:4,7:1,10:8,11:8,12:8};
  const metadata:Record<string,string|number>={};
  for(let i=0;i<count;i++){
    const key=await string(),type=await read32();
    const keep=/^general\.(architecture|name|file_type)$|\.context_length$|^split\.count$/.test(key);
    if(type===8){if(keep)metadata[key]=await string();else skip(await u64());}
    else if(type===9){
      const subtype=await read32(),length=await u64();
      if(length>1_000_000||subtype===9)throw Error('model-gguf-invalid');
      if(sizes[subtype])skip(length*sizes[subtype]);
      else if(subtype===8){for(let j=0;j<length;j++){skip(await u64());if(j&&j%8192===0)await new Promise(resolve=>setTimeout(resolve,0));}}
      else throw Error('model-gguf-invalid');
    }else{
      if(!sizes[type])throw Error('model-gguf-invalid');
      const p=await ensure(sizes[type]);
      if(keep){
        if(type===4)metadata[key]=view.getUint32(p,true);
        else if(type===5)metadata[key]=view.getInt32(p,true);
        else if(type===10||type===11){const n=type===10?view.getBigUint64(p,true):view.getBigInt64(p,true);if(n>BigInt(Number.MAX_SAFE_INTEGER)||n<0n)throw Error('model-gguf-invalid');metadata[key]=Number(n);}
      }
    }
  }
  if(Number(metadata['split.count'])>1)throw Error('model-gguf-split');
  const architecture=metadata['general.architecture'];
  if(typeof architecture!=='string'||!/^[a-z0-9_]{1,64}$/.test(architecture))throw Error('model-gguf-invalid');
  const context=Number(metadata[architecture+'.context_length']);
  if(!Number.isSafeInteger(context)||context<1)throw Error('model-gguf-unsupported');
  const quants:Record<number,string>={0:'F32',1:'F16',2:'Q4_0',3:'Q4_1',7:'Q8_0',8:'Q5_0',9:'Q5_1',10:'Q2_K',11:'Q3_K_S',12:'Q3_K_M',13:'Q3_K_L',14:'Q4_K_S',15:'Q4_K_M',16:'Q5_K_S',17:'Q5_K_M',18:'Q6_K',25:'IQ4_NL',30:'IQ4_XS',32:'BF16'};
  const type=Number(metadata['general.file_type']);
  return {architecture,name:String(metadata['general.name']||architecture).slice(0,200),quantization:quants[type]||(Number.isFinite(type)?`GGUF type ${type}`:'GGUF'),maxContext:Math.min(2048,context)};
}
