// Desktop-only, read-only access to explicitly selected model directories.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {setImmediate:yieldLoop}=require('node:timers/promises');
const idFor=(prefix,value)=>prefix+crypto.createHash('sha256').update(value).digest('hex').slice(0,32);

// Parse only bounded GGUF metadata. Tensor data is never buffered or copied.
async function readGGUF(file){
  const handle=await fs.open(file,'r');
  try{
    const stat=await handle.stat();if(!stat.isFile()||stat.size<24)throw Error('model-gguf-invalid');
    const buffer=Buffer.alloc(Math.min(stat.size,16*1024*1024));const {bytesRead}=await handle.read(buffer,0,buffer.length,0);let offset=0;
    const take=n=>{if(!Number.isSafeInteger(n)||n<0||offset+n>bytesRead)throw Error('model-gguf-metadata-limit');const start=offset;offset+=n;return buffer.subarray(start,offset);};
    const u32=()=>take(4).readUInt32LE();
    const u64=()=>{const n=take(8).readBigUInt64LE();if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('model-gguf-invalid');return Number(n);};
    const string=()=>take(u64()).toString('utf8');
    if(take(4).toString()!=='GGUF'||![2,3].includes(u32()))throw Error('model-gguf-invalid');
    const tensors=u64(),count=u64();if(!tensors||tensors>1000000||!count||count>100000)throw Error('model-gguf-invalid');
    const sizes={0:1,1:1,2:2,3:2,4:4,5:4,6:4,7:1,10:8,11:8,12:8};
    const value=(type,keep=false)=>{
      if(type===8){if(keep)return string();take(u64());return;}
      if(type===9){const subtype=u32(),length=u64();if(length>1000000||subtype===9)throw Error('model-gguf-invalid');if(sizes[subtype])take(length*sizes[subtype]);else if(subtype===8){for(let i=0;i<length;i++)take(u64());}else throw Error('model-gguf-invalid');return;}
      if(!sizes[type])throw Error('model-gguf-invalid');const b=take(sizes[type]);
      if(keep&&type===4)return b.readUInt32LE();if(keep&&type===10)return Number(b.readBigUInt64LE());return;
    };
    const metadata={};
    for(let i=0;i<count;i++){const key=string(),type=u32();const keep=/^general\.(?:architecture|name|file_type)$|\.context_length$|^split\.(?:count|no)$/.test(key);const v=value(type,keep);if(keep)metadata[key]=v;}
    const architecture=metadata['general.architecture'];if(typeof architecture!=='string'||!architecture||architecture.length>100)throw Error('model-gguf-invalid');
    if(metadata['split.count']>1)throw Error('model-gguf-split');
    if(!Number.isFinite(metadata[architecture+'.context_length'])||metadata[architecture+'.context_length']<1)throw Error('model-gguf-unsupported');
    return {stat,architecture,name:typeof metadata['general.name']==='string'?metadata['general.name'].slice(0,200):path.basename(file),maxContext:Math.min(2048,Math.max(512,metadata[architecture+'.context_length'])),quantization:'GGUF'};
  }finally{await handle.close();}
}

class ModelFolders{
  constructor({configFile,maxEntries=50000,maxModels=2000,maxDepth=16}){
    this.configFile=configFile;this.maxEntries=maxEntries;this.maxModels=maxModels;this.maxDepth=maxDepth;
    this.folders=[];this.models=new Map();this.warnings=[];this.ready=this.initialize();
  }
  async initialize(){
    try{
      const content=await fs.readFile(this.configFile,'utf8');if(content.length>128*1024)throw Error('model-folder-config');const config=JSON.parse(content);
      if(config.version!==1||!Array.isArray(config.folders)||config.folders.length>32||config.folders.some(f=>typeof f.path!=='string'||!path.isAbsolute(f.path)||f.id!==idFor('folder-',f.path)))throw Error('model-folder-config');
      this.folders=config.folders;
    }catch(error){if(error.code!=='ENOENT')throw Error('model-folder-config');}
    await this.scan();
  }
  snapshot(){return {folders:this.folders.map(f=>({...f})),models:[...this.models.values()].map(({file,identity,mtimeMs,...m})=>({...m,file:path.basename(file)})),warnings:this.warnings.map(w=>({...w}))};}
  async list(){await this.ready;return this.snapshot();}
  async save(folders){
    await fs.mkdir(path.dirname(this.configFile),{recursive:true,mode:0o700});
    const temporary=this.configFile+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';
    try{await fs.writeFile(temporary,JSON.stringify({version:1,folders})+'\n',{mode:0o600,flag:'wx'});await fs.rename(temporary,this.configFile);}finally{await fs.rm(temporary,{force:true});}
    this.folders=folders;
  }
  async add(directory){
    return this.edit(async()=>{
    if(typeof directory!=='string'||!path.isAbsolute(directory))throw Error('model-input');
    const canonical=await fs.realpath(directory);if(!(await fs.stat(canonical)).isDirectory())throw Error('model-folder-missing');
    if(this.folders.some(f=>f.path===canonical))return this.snapshot();if(this.folders.length>=32)throw Error('model-folder-limit');
    await this.save([...this.folders,{id:idFor('folder-',canonical),path:canonical}]);return this.scan();
    });
  }
  async remove(id){
    return this.edit(async()=>{if(!this.folders.some(f=>f.id===id))throw Error('model-folder-unknown');
    // Only configuration is replaced. Never rm/unlink anything in a model folder.
    await this.save(this.folders.filter(f=>f.id!==id));return this.scan();});
  }
  async edit(action){await this.ready;if(this.mutating||this.scanning)throw Error('model-busy');this.mutating=true;try{return await action();}finally{this.mutating=false;}}
  async refresh(){return this.edit(()=>this.scan());}
  async scan(){
    this.scanning=true;const models=new Map(),identities=new Map(),warnings=[];let entries=0;
    try{
      for(const folder of this.folders){
        const pending=[{directory:folder.path,depth:0}];let limited=false;
        while(pending.length){
          const {directory,depth}=pending.pop();let dir;
          try{
            dir=await fs.opendir(directory);
            for await(const entry of dir){
              entries++;if(entries%100===0)await yieldLoop();
              if(entries>this.maxEntries||models.size>=this.maxModels){limited=true;break;}
              const file=path.join(directory,entry.name);
              if(entry.isDirectory()){if(depth<this.maxDepth)pending.push({directory:file,depth:depth+1});else limited=true;continue;}
              if(!entry.isFile()||!entry.name.toLowerCase().endsWith('.gguf'))continue;
              try{
                const {stat,...meta}=await readGGUF(file);const identity=stat.ino?`${stat.dev}:${stat.ino}`:file;
                if(identities.has(identity)){const previous=models.get(identities.get(identity));if(!previous.folderIds.includes(folder.id))previous.folderIds.push(folder.id);continue;}
                const id=idFor('external-',file);identities.set(identity,id);
                models.set(id,{...meta,id,file,identity,mtimeMs:stat.mtimeMs,bytes:stat.size,folderIds:[folder.id],external:true,experimental:true,bundled:false,sha256:'',revision:'local',url:'',license:'',licenseName:'Local file',estimatedRamMB:Math.ceil(stat.size/1048576*1.5)+512});
              }catch(error){if(warnings.length<100)warnings.push({folderId:folder.id,file:entry.name,code:error.code==='EACCES'?'model-folder-permission':error.message.startsWith('model-')?error.message:'model-folder-read'});}
            }
          }catch(error){if(warnings.length<100)warnings.push({folderId:folder.id,code:error.code==='ENOENT'?'model-folder-missing':error.code==='EACCES'?'model-folder-permission':'model-folder-read'});}
          if(entries>this.maxEntries||models.size>=this.maxModels)break;
        }
        if(limited)warnings.push({folderId:folder.id,code:'model-folder-limit'});
      }
      this.models=models;this.warnings=warnings;return this.snapshot();
    }finally{this.scanning=false;}
  }
  descriptor(id){const descriptor=this.models.get(id);if(!descriptor)throw Error('model-unknown');return descriptor;}
  async verifiedPath(id,signal){
    await this.ready;signal?.throwIfAborted();const d=this.descriptor(id),canonical=await fs.realpath(d.file);
    // Refuse replacement by a symlink or a changed file; an explicit refresh is required.
    const stat=await fs.lstat(d.file);if(canonical!==d.file||!stat.isFile()||stat.size!==d.bytes||stat.mtimeMs!==d.mtimeMs||(stat.ino&&`${stat.dev}:${stat.ino}`!==d.identity))throw Error('model-folder-changed');
    await readGGUF(d.file);signal?.throwIfAborted();return d.file;
  }
}
module.exports={ModelFolders,readGGUF};
