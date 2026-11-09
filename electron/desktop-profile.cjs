const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const APP_ID='com.vex2137.kalendarz';
function desktopProfile({platform,appData,override,portableDirectory}) {
 const paths=platform==='win32'?path.win32:path;
 if(override)return {path:paths.resolve(override),portable:false,explicit:true};
 if(platform==='win32'&&portableDirectory){if(!paths.isAbsolute(portableDirectory))throw Error('portable-directory-invalid');return {path:paths.join(portableDirectory,'Calendar Data'),portable:true,explicit:false};}
 return {path:paths.join(appData,'Kalendarz Offline'),portable:false,explicit:false};
}
function ensurePortableWritable(profile,io=fs){if(!profile.portable)return;io.mkdirSync(profile.path,{recursive:true});const probe=path.join(profile.path,'.write-test-'+crypto.randomUUID());let fd;try{fd=io.openSync(probe,'wx',0o600);}finally{if(fd!==undefined){io.closeSync(fd);io.unlinkSync(probe);}}}
module.exports={APP_ID,desktopProfile,ensurePortableWritable};
