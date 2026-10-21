const { app, BrowserWindow, Menu, shell, protocol, net } = require('electron');
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
  const assetDirectory = path.join(__dirname, '../dist/assets');
  const wasmFiles = new Set(fs.readdirSync(assetDirectory).filter(name => /^wllama-[a-zA-Z0-9_-]+\.wasm$/.test(name)));
  protocol.handle('calendar-asset', async request => {
    const target = new URL(request.url);
    const name = target.pathname.slice(1);
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
