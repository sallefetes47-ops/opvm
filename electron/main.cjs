const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const ICON_PATH = path.join(__dirname, '..', 'build', 'icon.ico');

let splashWin = null;
let mainWin = null;

// Read data path chosen by the user during installation (opvm-config.ini next
// to the executable). Falls back to %APPDATA%/OPVM/opvm-db.
function resolveDataPath() {
  try {
    const exeDir = path.dirname(app.getPath('exe'));
    const iniPath = path.join(exeDir, 'opvm-config.ini');
    if (fs.existsSync(iniPath)) {
      const txt = fs.readFileSync(iniPath, 'utf8');
      const m = txt.match(/DataPath\s*=\s*(.+)/i);
      if (m && m[1]) {
        const p = m[1].trim();
        if (p) {
          try { fs.mkdirSync(p, { recursive: true }); } catch {}
          return p;
        }
      }
    }
  } catch {}
  const fallback = path.join(app.getPath('userData'), 'opvm-db');
  try { fs.mkdirSync(fallback, { recursive: true }); } catch {}
  return fallback;
}

const DATA_PATH = (() => { try { return resolveDataPath(); } catch { return null; } })();

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
