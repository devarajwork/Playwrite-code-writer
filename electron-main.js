import { app, BrowserWindow, dialog } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Playwright Builder",
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 1200,
        height: 800,
        title: "Visual Inspector",
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      }
    };
  });

  // Load the Express server
  mainWindow.loadURL('http://localhost:3001');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', () => {
  // Handle zoom shortcuts for all windows
  app.on('web-contents-created', (event, contents) => {
    contents.on('before-input-event', (event, input) => {
      if ((input.control || input.meta) && input.type === 'keyDown') {
        if (input.key === '=' || input.key === '+') {
          contents.setZoomLevel(contents.getZoomLevel() + 0.5);
          event.preventDefault();
        } else if (input.key === '-') {
          contents.setZoomLevel(contents.getZoomLevel() - 0.5);
          event.preventDefault();
        } else if (input.key === '0') {
          contents.setZoomLevel(0);
          event.preventDefault();
        }
      }
    });
  });

  // 1. Check for updates on startup
  autoUpdater.checkForUpdatesAndNotify();

  // 2. Start the Express server
  const serverPath = path.join(__dirname, 'dist', 'server', 'index.js');
  // Pass arbitrary environment variables or disable basic auth for the local desktop app if desired
  serverProcess = fork(serverPath, [], { 
    env: { ...process.env, PORT: '3001' },
    stdio: 'inherit'
  });
  
  // 3. Wait for the server to spin up, then open window
  waitForServer(3001, 10000, (ready) => {
    if (ready) {
      createWindow();
    } else {
      dialog.showErrorBox('Server Error', 'The local API server failed to start on port 3001.');
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
