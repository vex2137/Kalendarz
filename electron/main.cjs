const { app, BrowserWindow, Menu, shell, protocol, net, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Preserve the existing file:// profile/origin, including its calendar IndexedDB.
// Fetch cannot read WASM over file://; expose only packaged WASM files, never user paths.
protocol.registerSchemesAsPrivileged([{ scheme: 'calendar-asset', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true,
} }]);

// Keep the profile used by older releases when the desktop product name changes.
// Explicit profiles (including isolated smoke tests) still take precedence.
const profileOverride = app.commandLine.getSwitchValue('user-data-dir');
app.setPath('userData', profileOverride || path.join(app.getPath('appData'), 'Kalendarz Offline'));

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
    icon: path.join(__dirname, '../dist/pwa-512x512.png'),
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
  const {NativeModelStore}=require('./native-model-store.cjs');
  const {NativeAI}=require('./native-ai.cjs');
  const {ModelFolders}=require('./model-folders.cjs');
  const catalogue=require('../dist/models/catalogue.json');
  const bundled=require('../dist/models/manifest.json');
  const bundledId=catalogue[0].id;
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
  handle('model-info',id=>nativeModels.info(id));
  handle('upload-begin',id=>nativeModels.begin(id));
  handle('upload-write',(token,chunk)=>nativeModels.write(token,chunk));
  handle('upload-finish',token=>nativeModels.finish(token));
  handle('upload-abort',token=>nativeModels.abort(token));
  handle('model-remove',id=>{if(nativeAI.operation||nativeAI.loading)throw Error('model-busy');return nativeModels.remove(id);});
  handle('prepare',async id=>{if(id?.startsWith('external-'))await modelFolders.ready;return nativeAI.prepare(id);});
  handle('complete',async(id,request)=>{if(id?.startsWith('external-'))await modelFolders.ready;return nativeAI.complete(id,request);});
  handle('stop',()=>nativeAI.cancel());
  handle('mode',mode=>nativeAI.setMode(mode));
  handle('status',()=>nativeAI.snapshot());
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
