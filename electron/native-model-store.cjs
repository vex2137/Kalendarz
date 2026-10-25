const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class NativeModelStore {
  constructor({root,bundledPath,catalogue,bundledId,external}) {
    this.root=root;this.bundledPath=bundledPath;this.bundledId=bundledId;
    this.models=new Map(catalogue.map(m=>[m.id,m]));this.uploads=new Map();this.external=external;
  }
  async registerImported(d) {
    if(!d||d.imported!==true||d.id!=='imported-'+d.sha256||!/^imported-[a-f0-9]{64}$/.test(d.id)||!Number.isSafeInteger(d.bytes)||d.bytes<24||d.bytes>16*1024**3||typeof d.name!=='string'||d.name.length>200||!Number.isInteger(d.maxContext)||d.maxContext<1||d.maxContext>2048||typeof d.architecture!=='string'||!/^[a-z0-9_]{1,64}$/.test(d.architecture)||d.external||d.bundled||d.url!=='')throw Error('model-input');
    // Paths are always derived by the main process, never from renderer metadata.
    this.models.set(d.id,{...d,file:'local.gguf'});
  }
  descriptor(id) { const d=this.models.get(id)||this.external?.models.get(id);if(!d)throw Error('model-unknown');return d; }
  file(id) { const d=this.descriptor(id);return id===this.bundledId?this.bundledPath:path.join(this.root,`${id}-${d.sha256}.gguf`); }
  async info(id) { if(id?.startsWith('external-')){await this.external?.ready;try{const file=await this.external.verifiedPath(id);const stat=await fs.stat(file);return {installed:true,bytes:stat.size};}catch{return {installed:false};}}const d=this.descriptor(id);try{const stat=await fs.stat(this.file(id));return {installed:stat.isFile()&&stat.size===d.bytes,bytes:stat.size};}catch(e){if(e.code==='ENOENT')return {installed:false};throw e;} }
  async verifiedPath(id,signal) {
    if(id?.startsWith('external-'))return this.external.verifiedPath(id,signal);
    const d=this.descriptor(id),file=this.file(id);if(!(await this.info(id)).installed)throw Error('model-missing');
    const hash=crypto.createHash('sha256');for await(const chunk of createReadStream(file)){signal?.throwIfAborted();hash.update(chunk);}
    if(hash.digest('hex')!==d.sha256)throw Error('model-checksum');return file;
  }
  async begin(id) {
    if(id?.startsWith('external-'))throw Error('model-external-readonly');
    const d=this.descriptor(id);if(id===this.bundledId)throw Error('model-bundled');
    if(this.uploads.size||this.beginning)throw Error('model-busy');
    this.beginning=true;
    try {
    if((await this.info(id)).installed){try{await this.verifiedPath(id);return {exists:true};}catch(error){if(error.message!=='model-checksum')throw error;}}
    await fs.mkdir(this.root,{recursive:true,mode:0o700});
    const space=await fs.statfs(this.root);if(Number(space.bavail)*Number(space.bsize)<d.bytes+64*1024*1024)throw Error('model-storage-space');
    const token=crypto.randomBytes(24).toString('hex'),file=path.join(this.root,token+'.partial');
    const handle=await fs.open(file,'wx',0o600);
    this.uploads.set(token,{id,file,handle,bytes:0,hash:crypto.createHash('sha256'),writing:false});return {token};
    } finally {this.beginning=false;}
  }
  async write(token,chunk) {
    const upload=this.uploads.get(token);if(!upload||upload.writing)throw Error('model-busy');
    if(!(chunk instanceof Uint8Array)||!chunk.byteLength||chunk.byteLength>4*1024*1024)throw Error('model-input');
    if(upload.bytes+chunk.byteLength>this.descriptor(upload.id).bytes)throw Error('model-size');
    upload.writing=true;
    try {let offset=0;while(offset<chunk.byteLength){const result=await upload.handle.write(chunk,offset,chunk.byteLength-offset);if(!result.bytesWritten)throw Error('model-storage');offset+=result.bytesWritten;}upload.hash.update(chunk);upload.bytes+=chunk.byteLength;return upload.bytes;}
    catch(error){await this.abort(token);throw error;}
    finally{upload.writing=false;}
  }
  async finish(token) {
    const upload=this.uploads.get(token);if(!upload||upload.writing)throw Error('model-busy');
    upload.writing=true;
    try {
      const d=this.descriptor(upload.id);if(upload.bytes!==d.bytes)throw Error('model-size');if(upload.hash.digest('hex')!==d.sha256)throw Error('model-checksum');
      await upload.handle.sync();await upload.handle.close();await fs.rename(upload.file,this.file(upload.id));this.uploads.delete(token);return {installed:true};
    }catch(error){await this.abort(token);throw error;}
  }
  async abort(token){const u=this.uploads.get(token);if(u){this.uploads.delete(token);await u.handle.close().catch(()=>{});await fs.rm(u.file,{force:true});}}
  async remove(id){if(id?.startsWith('external-'))throw Error('model-external-readonly');if(id===this.bundledId)throw Error('model-bundled');await fs.rm(this.file(id),{force:true});}
  async close(){for(const token of [...this.uploads.keys()])await this.abort(token);}
}
module.exports={NativeModelStore};
