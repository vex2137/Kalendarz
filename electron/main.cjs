const { app, BrowserWindow, Menu, shell, protocol, net, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const url = require('url');
const {APP_ID,desktopProfile,ensurePortableWritable}=require('./desktop-profile.cjs');
if(process.platform==='win32')app.setAppUserModelId(APP_ID);
if(process.platform==='linux'){app.setDesktopName(APP_ID+'.desktop');app.commandLine.appendSwitch('class',APP_ID);app.commandLine.appendSwitch('wayland-app-id',APP_ID);}

// Preserve the existing file:// profile/origin, including its calendar IndexedDB.
// Fetch cannot read WASM over file://; expose only packaged WASM files, never user paths.
protocol.registerSchemesAsPrivileged([{ scheme: 'calendar-asset', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true,
} }]);

// Keep the profile used by older releases when the desktop product name changes.
// Explicit profiles (including isolated smoke tests) still take precedence.
const profileOverride = app.commandLine.getSwitchValue('user-data-dir');
const profile=desktopProfile({platform:process.platform,appData:app.getPath('appData'),override:profileOverride,portableDirectory:process.env.PORTABLE_EXECUTABLE_DIR});
try{ensurePortableWritable(profile);}catch{
  dialog.showErrorBox('Calendar','The portable data folder is not writable. Move the EXE together with Calendar Data to a writable folder and retry. The installed profile was not used.');
  app.exit(1);
  throw Error('portable-data-not-writable');
}
app.setPath('userData',profile.path);
app.setPath('sessionData',profile.path);
if(profile.portable){const dumps=path.join(profile.path,'Crashpad');fs.mkdirSync(dumps,{recursive:true});app.setPath('crashDumps',dumps);}

let mainWindow;
let nativeAI, nativeModels, modelFolders;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 420,
    minHeight: 600,
    backgroundColor: '#09090b',
    title: 'Calendar',
    icon: path.join(__dirname, '../dist/desktop-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // W środowisku produkcyjnym ładuj skompilowany dist/index.html
  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadURL(
    url.format({
      pathname: indexPath,
      protocol: 'file:',
      slashes: true,
    }),
  );

  const openExternal = (target) => {
    try {
      const parsed = new URL(target);
      if (parsed.protocol === 'https:' && parsed.hostname === 'github.com')
        void shell.openExternal(target);
    } catch {
      /* Ignore malformed navigation. */
    }
  };
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (target !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      openExternal(target);
    }
  });

  // Ukryj domyślne surowe menu systemowe dla nowoczesnego wyglądu
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const {NativeModelStore,packagedModelId}=require('./native-model-store.cjs');
  const {NativeAI}=require('./native-ai.cjs');
  const {ModelFolders}=require('./model-folders.cjs');
  const catalogue=require('../dist/models/catalogue.json');
  const bundled=require('../dist/models/manifest.json');
  const bundledId=packagedModelId(require('../dist/build-info.json'),bundled);
  const physicalApp=app.getAppPath().endsWith('.asar')?app.getAppPath()+'.unpacked':app.getAppPath();
  modelFolders=new ModelFolders({configFile:path.join(app.getPath('userData'),'model-folders-v1.json')});
  void modelFolders.ready.catch(()=>{}); // Report damaged configuration through the folder panel; preserve the file.
  nativeModels=new NativeModelStore({root:path.join(app.getPath('userData'),'native-models-v1'),bundledPath:path.join(physicalApp,'dist/models',bundled.file),catalogue,bundledId,external:modelFolders});
  const nativeRoot=app.isPackaged?path.join(process.resourcesPath,'native'):path.join(__dirname,'..','native',`${process.platform==='win32'?'win':process.platform==='darwin'?'mac':process.platform}-${process.arch}`);
  nativeAI=new NativeAI({runtimeRoot:nativeRoot,store:nativeModels});
  const allowed=event=>{
    if(!mainWindow||event.sender!==mainWindow.webContents||event.senderFrame!==mainWindow.webContents.mainFrame||event.senderFrame.url!==mainWindow.webContents.getURL()||!event.senderFrame.url.startsWith('file:'))throw Error('native-sender-denied');
  };
  const handle=(name,fn)=>ipcMain.handle('calendar-ai:'+name,async(event,...args)=>{allowed(event);return fn(...args);});
  handle('register-imported',d=>nativeModels.registerImported(d));
  handle('model-info',id=>nativeModels.info(id));
  handle('upload-begin',id=>nativeModels.begin(id));
  handle('upload-write',(token,chunk)=>nativeModels.write(token,chunk));
  handle('upload-finish',token=>nativeModels.finish(token));
  handle('upload-abort',token=>nativeModels.abort(token));
  handle('model-remove',id=>{if(nativeAI.operation||nativeAI.loading)throw Error('model-busy');return nativeModels.remove(id);});
  handle('prepare',async(id,contextSize)=>{if(id?.startsWith('external-'))await modelFolders.ready;return nativeAI.prepare(id,contextSize);});
  handle('complete',async(id,request,requestId)=>{if(requestId!==undefined&&!/^[a-f0-9-]{36}$/i.test(requestId))throw Error('model-input');if(id?.startsWith('external-'))await modelFolders.ready;return nativeAI.complete(id,request,chunk=>{if(requestId&&!mainWindow.webContents.isDestroyed())mainWindow.webContents.send('calendar-ai:chunk',{...chunk,requestId});});});
  handle('cancel-generation',()=>nativeAI.cancelGeneration());
  handle('stop',()=>nativeAI.cancel());
  handle('mode',(mode,layers,automatic)=>nativeAI.setMode(mode,layers,automatic));
  handle('status',()=>nativeAI.snapshot());
  handle('folders-forget',async id=>{foldersIdle();return modelFolders.forget(id);});
  handle('folders-list',()=>modelFolders.list());
  const foldersIdle=()=>{if(nativeAI.operation||nativeAI.loading)throw Error('model-busy');};
  handle('folders-add',async()=>{
    foldersIdle();const choice=await dialog.showOpenDialog(mainWindow,{properties:['openDirectory'],title:'GGUF models'});
    if(choice.canceled||!choice.filePaths[0])return modelFolders.list();foldersIdle();return modelFolders.add(choice.filePaths[0]);
  });
  handle('folders-refresh',async()=>{foldersIdle();await nativeAI.cancel();return modelFolders.refresh();});
  handle('folders-remove',async id=>{foldersIdle();await nativeAI.cancel();return modelFolders.remove(id);});

  const assetDirectory = path.join(__dirname, '../dist/assets');
  const wasmFiles = new Set(fs.readdirSync(assetDirectory).filter(name => /^wllama-[a-zA-Z0-9_-]+\.wasm$/.test(name)));
  protocol.handle('calendar-asset', async request => {
    const target = new URL(request.url);
    const name = target.pathname.slice(1);
    if(target.hostname==='installed-models') {
      if(request.method!=='GET'||target.search||!nativeModels.models.has(name))return new Response('',{status:404});
      try{const file=await nativeModels.verifiedPath(name);const response=await net.fetch(url.pathToFileURL(file).href);return new Response(response.body,{headers:{'Content-Type':'application/octet-stream','Access-Control-Allow-Origin':'*'}});}catch{return new Response('',{status:404});}
    }
    if (target.hostname === 'models') {
      const model = require('../dist/models/manifest.json');
      const allowed = new Set(['manifest.json', model.file, 'LICENSE.txt', 'NOTICE.txt']);
      if (request.method !== 'GET' || target.search || !allowed.has(name)) return new Response('', { status: 404 });
      const response = await net.fetch(url.pathToFileURL(path.join(__dirname, '../dist/models', name)).href);
      return new Response(response.body, { headers: {
        'Content-Type': name.endsWith('.json') ? 'application/json' : 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      } });
    }
    if (request.method !== 'GET' || target.hostname !== 'runtime' || target.search || !wasmFiles.has(name)) {
      return new Response('', { status: 404 });
    }
    const response = await net.fetch(url.pathToFileURL(path.join(assetDirectory, name)).href);
    return new Response(response.body, { headers: {
      'Content-Type': 'application/wasm', 'Access-Control-Allow-Origin': '*',
    } });
  });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

let quitting=false;
app.on('before-quit',event=>{if(nativeAI&&!quitting){event.preventDefault();quitting=true;void Promise.all([nativeAI.cancel(),nativeModels.close()]).finally(()=>app.quit());}});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
