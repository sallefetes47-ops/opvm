const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const ICON_PATH = path.join(__dirname, '..', 'build', 'icon.ico');

let splashWin = null;
let mainWin = null;

function createSplash() {
  splashWin = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    show: true,
    center: true,
    icon: ICON_PATH,
    backgroundColor: '#0F172A',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splashWin.loadFile(path.join(__dirname, 'splash.html'));
  splashWin.setMenu(null);
}

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'OPVM - تسيير العمران',
    icon: ICON_PATH,
    autoHideMenuBar: true,
    backgroundColor: '#0F172A',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWin.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  mainWin.once('ready-to-show', () => {
    // Keep splash visible for a minimum 1.2s so it doesn't flash
    setTimeout(() => {
      if (splashWin && !splashWin.isDestroyed()) splashWin.close();
      mainWin.maximize();
      mainWin.show();
    }, 1200);
  });
}

ipcMain.handle('app:getUserDataPath', () => app.getPath('userData'));

app.whenReady().then(() => {
  createSplash();
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createSplash();
    createMainWindow();
  }
});
