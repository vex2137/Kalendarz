import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {mkdtempSync,rmSync,existsSync,writeFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
const require=createRequire(import.meta.url),{desktopProfile,ensurePortableWritable,APP_ID}=require('../electron/desktop-profile.cjs');
test('installed desktop preserves its historical profile; portable is isolated beside the outer EXE',()=>{
 assert.equal(desktopProfile({platform:'win32',appData:'C:\\Users\\A\\AppData\\Roaming'}).path,'C:\\Users\\A\\AppData\\Roaming\\Kalendarz Offline');
 const portable=desktopProfile({platform:'win32',appData:'C:\\Users\\A\\AppData\\Roaming',portableDirectory:'E:\\Calendar'});assert.equal(portable.path,'E:\\Calendar\\Calendar Data');assert.equal(portable.portable,true);
 assert.equal(desktopProfile({platform:'linux',appData:'/home/a/.config',portableDirectory:'/tmp/ignored'}).path,'/home/a/.config/Kalendarz Offline');
 assert.equal(desktopProfile({platform:'win32',appData:'C:\\ignore',portableDirectory:'E:\\Calendar',override:'D:\\explicit'}).path,'D:\\explicit');
 assert.throws(()=>desktopProfile({platform:'win32',appData:'C:\\ignore',portableDirectory:'relative'}));
});
test('portable write failure propagates without creating or selecting an installed profile',()=>{
 const p={portable:true,path:'/portable/Calendar Data'},calls:string[]=[];assert.throws(()=>ensurePortableWritable(p,{mkdirSync:(s:string)=>calls.push(s),openSync:()=>{throw Object.assign(Error('readonly'),{code:'EACCES'});}}),/readonly/);assert.deepEqual(calls,[p.path]);
 const root=mkdtempSync(path.join(tmpdir(),'calendar-profile-'));try{const profile={portable:true,path:path.join(root,'Calendar Data')};ensurePortableWritable(profile);assert.deepEqual(readdirSync(profile.path),[]);writeFileSync(path.join(profile.path,'marker'),'retained');ensurePortableWritable(profile);assert.equal(readFileSync(path.join(profile.path,'marker'),'utf8'),'retained');}finally{rmSync(root,{recursive:true,force:true});}
});
test('desktop identities, unsigned Windows resource editing and per-user uninstall policy stay aligned',()=>{
 const pkg=require('../package.json'),build=pkg.build;assert.equal(build.appId,APP_ID);assert.equal(pkg.desktopName,APP_ID+'.desktop');assert.equal(build.linux.desktop.entry.StartupWMClass,APP_ID);assert.equal(build.win.signExecutable,false);assert.equal(build.win.signAndEditExecutable,true);assert.equal(build.nsis.perMachine,false);assert.equal(build.nsis.allowElevation,false);assert.equal(build.nsis.deleteAppDataOnUninstall,false);assert.equal(build.portable.requestExecutionLevel,'user');
});
test('checked-in icon derivatives match the unchanged Android launcher and include DPI sizes',()=>{
 const {createHash}=require('node:crypto'),manifest=require('../packaging/icons/manifest.json');assert.equal(manifest.source,'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png');assert.equal(manifest.sourceSha256,'87cb2f2ffe992652bb4fa768c73719a37b5852ab17fbf8e170e888f7a42b0761');const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');assert.equal(hash(manifest.source),manifest.sourceSha256);for(const [file,sha]of Object.entries(manifest.files))assert.equal(hash(file),sha,file);
 const ico=readFileSync('packaging/icons/calendar.ico');assert.equal(ico.readUInt16LE(2),1);const count=ico.readUInt16LE(4),sizes=Array.from({length:count},(_,i)=>ico[6+16*i]||256);for(const n of [16,24,32,48,64,128,256])assert.ok(sizes.includes(n));
 const png=readFileSync('public/desktop-icon.png');assert.equal(png.readUInt32BE(16),512);assert.equal(png.readUInt32BE(20),512);
});
test('Flatpak uses Zypak, portals, matching desktop identity and no home/host filesystem grant',()=>{
 const m=JSON.parse(readFileSync('com.vex2137.kalendarz.yml','utf8'));assert.equal(m['app-id'],APP_ID);assert.equal(m['build-options'].strip,false);assert.equal(m['build-options']['no-debuginfo'],true);assert.equal(m.base,'org.electronjs.Electron2.BaseApp');assert.equal(m['base-version'],m['runtime-version']);assert.ok(!m['finish-args'].some((a:string)=>a.startsWith('--filesystem=')||a==='--device=all'));assert.ok(m['finish-args'].includes('--env=ELECTRON_USE_PORTAL=1'));assert.ok(readFileSync('packaging/flatpak/calendar','utf8').includes('exec zypak-wrapper'));assert.match(readFileSync('com.vex2137.kalendarz.desktop','utf8'),/StartupWMClass=com.vex2137.kalendarz/);
});
test('Part 4 Beta 2 routing preserves historical Beta 1/2 policies and rejects unknown beta profiles',()=>{
 const {candidatePolicy}=require('../scripts/verify-packaged-model.cjs');assert.equal(candidatePolicy({CALENDAR_PART4_BETA:'true',CALENDAR_PART4_BETA_NUMBER:'2'}),'scripts/part4_beta2_guard.py');assert.equal(candidatePolicy({CALENDAR_PART4_BETA:'true'}),'scripts/part4_beta_guard.py');assert.equal(candidatePolicy({CALENDAR_PART4_BETA:'true',CALENDAR_PART4_BETA_NUMBER:'3'}),'scripts/part4_beta3_guard.py');assert.throws(()=>candidatePolicy({CALENDAR_PART4_BETA:'true',CALENDAR_PART4_BETA_NUMBER:'4'}));
});
test('the canonical Flatpak manifest has every non-payload source and the declared MIT license',()=>{
 const m=JSON.parse(readFileSync('com.vex2137.kalendarz.yml','utf8'));for(const source of m.modules[0].sources){if(source.type==='file')assert.ok(existsSync(source.path),source.path);}assert.match(readFileSync('LICENSE','utf8'),/MIT License/);assert.match(readFileSync('build-flatpak.sh','utf8'),/build\/flatpak-root com.vex2137.kalendarz.yml/);
});
