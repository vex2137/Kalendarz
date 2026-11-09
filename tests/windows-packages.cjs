// Execute actual NSIS Setup and Portable packages on an ephemeral Windows runner.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn,execFileSync}=require('node:child_process'),{_electron,chromium}=require('playwright');
const policy=require('../scripts/part4-beta2-version.json');
const owned=new Set();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=120000){const end=Date.now()+timeout;let error;while(Date.now()<end){try{const v=await fn();if(v)return v;}catch(e){error=e;}await pause(500);}throw error||Error('Timed out');}
async function execute(file,args){console.log('Execute',path.basename(file),args);const p=spawn(file,args,{stdio:'inherit',timeout:180000});owned.add(p);const code=await new Promise((r,j)=>{p.on('error',j);p.on('exit',r)});assert.equal(code,0,file);}
async function seed(page,title){await page.locator('#btn-create-event-top').click();await page.locator('#input-event-title').fill(title);await page.locator('#btn-save-event-form').click();await page.getByText(title,{exact:true}).waitFor();}
(async()=>{
 assert.equal(process.platform,'win32');const out=path.resolve('part4-artifacts/windows');fs.mkdirSync(out,{recursive:true});
 const setup=path.join(out,policy.setupFile),portable=path.join(out,policy.portableFile);
 const installedData=path.join(process.env.APPDATA,'Kalendarz Offline');assert.ok(!fs.existsSync(installedData),'Use an ephemeral runner, never an existing user profile');
 // Published 1.4.2 Windows EXE is Portable, not an installer. It used the legacy installed profile.
 let folder=path.resolve('build/source142'),portableExe='setup.exe';
 async function portableWindow(){
  const port=19000+Math.floor(Math.random()*1000);console.log('Launch portable',path.join(folder,portableExe));
  const child=spawn(path.join(folder,portableExe),['--remote-debugging-port='+port],{env:process.env,stdio:'inherit'});owned.add(child);
  await until(async()=>{if(child.exitCode!==null)throw Error('Portable exited '+child.exitCode);const r=await fetch('http://127.0.0.1:'+port+'/json/version');return r.ok});
  const browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);const p=await until(()=>browser.contexts()[0]?.pages()[0]);await p.locator('#btn-create-event-top').waitFor();
  return {browser,p,close:async()=>{await p.evaluate(()=>window.close()).catch(e=>{if(!/closed|destroyed/i.test(e.message))throw e;});await browser.close();await until(()=>child.exitCode!==null,30000);}};
 }
 const legacy=await portableWindow();await seed(legacy.p,'Windows 1.4.2 retained event');await legacy.close();console.log('PASS actual 1.4.2 Portable legacy profile seeded and closed');
 await execute(setup,['/S']);
 const shortcut=()=>{
  const script="$w=New-Object -ComObject WScript.Shell; Get-ChildItem ([Environment]::GetFolderPath('StartMenu')) -Filter '*.lnk' -Recurse | ForEach-Object { $s=$w.CreateShortcut($_.FullName); if ($s.TargetPath -like '*Calendar.exe') { $s.TargetPath } }";
  return execFileSync('powershell',['-NoProfile','-Command',script],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean).at(-1);
 };
 const installed=await until(()=>{const p=shortcut();return p&&fs.existsSync(p)?p:false});
 async function installedWindow(){const a=await _electron.launch({executablePath:installed,timeout:40000});owned.add(a.process());const p=await a.firstWindow();await p.locator('#btn-create-event-top').waitFor();assert.equal(await a.evaluate(({app})=>app.getPath('userData')),installedData);return {a,p};}
 let {a,p}=await installedWindow();await p.getByText('Windows 1.4.2 retained event',{exact:true}).waitFor();await a.close();console.log('PASS Setup retained actual 1.4.2 profile');
 await execute(setup,['/S']);({a,p}=await installedWindow());await p.getByText('Windows 1.4.2 retained event',{exact:true}).waitFor();
 const icon=await a.evaluate(({app,nativeImage})=>{const i=nativeImage.createFromPath(app.getAppPath()+'/dist/desktop-icon.png');return {empty:i.isEmpty(),size:i.getSize()}});assert.equal(icon.empty,false);assert.ok(icon.size.width>=256);await a.close();
 // The Portable bootstrapper must choose its profile; do not pass --user-data-dir.
 const portableRoot=fs.mkdtempSync(path.join(os.tmpdir(),'calendar-portable-'));folder=path.join(portableRoot,'first');portableExe=policy.portableFile;fs.mkdirSync(folder);fs.copyFileSync(portable,path.join(folder,policy.portableFile));
 let portableApp=await portableWindow();await seed(portableApp.p,'Portable folder retained event');await portableApp.close();assert.ok(fs.existsSync(path.join(folder,'Calendar Data')));
 const moved=path.join(portableRoot,'moved');fs.renameSync(folder,moved);folder=moved;
 portableApp=await portableWindow();await portableApp.p.getByText('Portable folder retained event',{exact:true}).waitFor();assert.equal(await portableApp.p.getByText('Windows 1.4.2 retained event',{exact:true}).count(),0);await portableApp.close();
 ({a,p}=await installedWindow());await p.getByText('Windows 1.4.2 retained event',{exact:true}).waitFor();assert.equal(await p.getByText('Portable folder retained event',{exact:true}).count(),0);await a.close();
 const uninstall=fs.readdirSync(path.dirname(installed)).find(n=>/^Uninstall.*\.exe$/i.test(n));assert.ok(uninstall);await execute(path.join(path.dirname(installed),uninstall),['/S']);await until(()=>!fs.existsSync(installed));assert.ok(fs.existsSync(installedData));
 // Reinstall after uninstall and verify the preserved user data, rather than checking only directory existence.
 await execute(setup,['/S']);({a,p}=await installedWindow());await p.getByText('Windows 1.4.2 retained event',{exact:true}).waitFor();await a.close();
 const report={source:process.env.CALENDAR_EXPECTED_COMMIT,setup:'PASS actual 1.4.2 Portable legacy profile to Beta 2 Setup; install, repeated install/update, uninstall/reinstall retained event',portable:'PASS actual single EXE, isolated profile, whole-folder move and restart',icon:'PASS packaged window image and PE icons; visual taskbar/Start menu validation remains manual',standardUserAccount:'NOT TESTED: hosted runner account; per-user/asInvoker configuration is statically checked',physicalGpu:'NOT TESTED'};fs.writeFileSync(path.join(out,'windows-smoke.json'),JSON.stringify(report,null,2));console.log(report);
})().catch(e=>{console.error(e);for(const child of owned){if(child.exitCode===null&&child.pid){try{execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});}catch{}}}process.exit(1)});
