const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),{_electron}=require('playwright');
(async()=>{const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'calendar-icon-'));let app;try{
 const executable=path.resolve('build/checked-appimage/squashfs-root/calendar');app=await _electron.launch({executablePath:executable,args:['--no-sandbox','--user-data-dir='+path.join(tmp,'profile')]});const p=await app.firstWindow();await p.locator('#btn-create-event-top').waitFor();
 const id=await app.evaluate(({BrowserWindow})=>{const b=BrowserWindow.getAllWindows()[0].getNativeWindowHandle();return '0x'+(b.length===8?b.readBigUInt64LE():BigInt(b.readUInt32LE())).toString(16)});
 const wm=execFileSync('xprop',['-id',id,'WM_CLASS'],{encoding:'utf8'});assert.ok(wm.includes('com.vex2137.kalendarz'),wm);
 const image=execFileSync('xprop',['-id',id,'-f','_NET_WM_ICON','32c','_NET_WM_ICON'],{encoding:'utf8',maxBuffer:8*1024*1024});assert.match(image,/512, 512/,'Actual X11 window must expose the application icon');if(process.env.CALENDAR_VERIFY_CANONICAL_ICONS==='true')execFileSync('python3',['scripts/check-canonical-icons.py','--x11-window',id],{stdio:'inherit'});
 if(process.env.CALENDAR_CAPTURE_ICON_EVIDENCE==='true')execFileSync('python3',['scripts/capture-adaptive-icon-evidence.py','x11',id],{stdio:'inherit'});
 const integration=path.join(tmp,'integration');fs.mkdirSync(integration);fs.copyFileSync('packaging/linux/install-desktop-entry.sh',path.join(integration,'install.sh'));fs.copyFileSync('public/desktop-icon.png',path.join(integration,'desktop-icon.png'));
 const fake=path.join(tmp,'App with spaces.AppImage');fs.writeFileSync(fake,'test');execFileSync('sh',[path.join(integration,'install.sh'),fake],{env:{...process.env,XDG_DATA_HOME:path.join(tmp,'xdg')}});
 const desktop=path.join(tmp,'xdg/applications/com.vex2137.kalendarz.desktop');execFileSync('desktop-file-validate',[desktop]);assert.ok(fs.readFileSync(desktop,'utf8').includes('Exec="'+fake+'" %U'));
 const report={source:process.env.CALENDAR_EXPECTED_COMMIT,wmClass:wm.trim(),windowIcon:'PASS actual _NET_WM_ICON 512x512',desktopEntry:'PASS per-user integration and validated quoted Exec path',waylandAndPhysicalDock:'NOT TESTED'};
 fs.writeFileSync('part4-artifacts/linux/desktop-icon-smoke.json',JSON.stringify(report,null,2));console.log(report);
 }finally{await app?.close();fs.rmSync(tmp,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
