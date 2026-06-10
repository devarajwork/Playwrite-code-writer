import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import net from 'net';
import { session } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Disable site isolation to allow cross-origin iframe DOM access
app.commandLine.appendSwitch('disable-site-isolation-trials');

let mainWindow;
let serverProcess;

function checkServerReady(port, cb) {
  const socket = new net.Socket();
  socket.setTimeout(500);
  socket.on('connect', () => {
    socket.destroy();
    cb(true);
  });
  socket.on('timeout', () => {
    socket.destroy();
    cb(false);
  });
  socket.on('error', () => {
    socket.destroy();
    cb(false);
  });
  socket.connect(port, '127.0.0.1');
}

function waitForServer(port, timeout, cb) {
  const startTime = Date.now();
  const interval = setInterval(() => {
    checkServerReady(port, (isReady) => {
      if (isReady) {
        clearInterval(interval);
        cb(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        cb(false);
      }
    });
  }, 250);
}

// No IPC handlers needed anymore for God-Mode Iframe

const isDev = process.argv.includes('--dev');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Playwrite Script Builder",
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      webviewTag: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 1600,
        height: 900,
        title: "Visual Inspector",
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false,
          webviewTag: true
        }
      }
    };
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', () => {
  // Strip iframe-blocking headers natively without modifying other headers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    
    for (const header in responseHeaders) {
      const lower = header.toLowerCase();
      if (lower === 'x-frame-options' || lower === 'content-security-policy') {
        delete responseHeaders[header];
      }
    }
    
    callback({
      cancel: false,
      responseHeaders
    });
  });

  // Create window synchronously so Electron doesn't exit due to 0 windows open
  createWindow();

  // Handle zoom shortcuts and DevTools for all windows
  app.on('web-contents-created', (event, contents) => {
    // Automatically opening DevTools has been disabled per user request.
    contents.on('before-input-event', (event, input) => {
      if ((input.control || input.meta) && input.type === 'keyDown') {
        if (input.key === '=' || input.key === '+' || input.code === 'Equal' || input.code === 'NumpadAdd') {
          try {
            const currentZoom = contents.getZoomFactor();
            contents.setZoomFactor(Math.min(currentZoom + 0.1, 3.0));
          } catch (err) {
            console.error('Failed to zoom in:', err);
          }
          event.preventDefault();
        } else if (input.key === '-' || input.code === 'Minus' || input.code === 'NumpadSubtract') {
          try {
            const currentZoom = contents.getZoomFactor();
            contents.setZoomFactor(Math.max(currentZoom - 0.1, 0.5));
          } catch (err) {
            console.error('Failed to zoom out:', err);
          }
          event.preventDefault();
        } else if (input.key === '0' || input.code === 'Digit0' || input.code === 'Numpad0') {
          try {
            contents.setZoomFactor(1.0);
          } catch (err) {
            console.error('Failed to reset zoom:', err);
          }
          event.preventDefault();
        }
      }
    });
  });

  if (!isDev) {
    // 1. Check for updates on startup
    autoUpdater.checkForUpdatesAndNotify();

    // 2. Start the Express server
    const serverPath = path.join(__dirname, 'dist', 'server', 'index.js');
    serverProcess = fork(serverPath, [], { 
      env: { ...process.env, PORT: '3001' },
      stdio: 'inherit'
    });
  }
  
  // 3. Wait for the server to spin up, then open window
  const targetPort = isDev ? 5173 : 3001;
  waitForServer(targetPort, 15000, (ready) => {
    if (ready) {
      const targetUrl = isDev ? 'http://127.0.0.1:5173' : 'http://127.0.0.1:3001';
      if (mainWindow) {
        mainWindow.loadURL(targetUrl);
      }
    } else {
      dialog.showErrorBox('Server Error', `The local API server failed to start on port ${targetPort}.`);
      app.quit();
    }
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

// Auto-Updater Events
autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: 'A new version is available. It is downloading in the background.'
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'A new version has been downloaded. Restart the application to apply the updates.',
    buttons: ['Restart', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});
