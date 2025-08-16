const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Initialize settings store
const store = new Store({
  defaults: {
    openaiApiKey: '',
    openrouterApiKey: '',
    windowBounds: { x: 100, y: 100, width: 300, height: 400 },
    roamingEnabled: false,
    roamingSpeed: 2,
    chatPosition: 'right',
    alwaysOnTop: true,
    transparency: 0.9
  }
});

let mainWindow;
let tray;
let isQuitting = false;

// Enable live reload for development
if (process.argv.includes('--dev')) {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '..', '..', 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit'
  });
}

function createWindow() {
  const bounds = store.get('windowBounds');
  
  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: store.get('alwaysOnTop'),
    skipTaskbar: true,
    resizable: false,
    movable: true, // Allow manual dragging
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  // Load the VRM renderer
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window close
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Save window bounds when moved or resized
  mainWindow.on('moved', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });

  // Development tools disabled for production
  // mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function createTray() {
  // Create tray icon - use a fallback if the icon doesn't exist
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'tray-icon.png');
  
  try {
    tray = new Tray(iconPath);
  } catch (error) {
    // Fallback to creating a tray without icon on macOS
    console.warn('Could not load tray icon, using default');
    try {
      // Create a simple tray with text
      tray = new Tray(require('electron').nativeImage.createEmpty());
    } catch (fallbackError) {
      console.error('Could not create tray:', fallbackError);
      return;
    }
  }
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Assistant',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Settings',
      click: () => {
        createSettingsWindow();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('VRM Desktop Assistant');
  tray.setContextMenu(contextMenu);
  
  // Double click to show/hide
  tray.on('double-click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createSettingsWindow() {
  const settingsWindow = new BrowserWindow({
    width: 500,
    height: 600,
    resizable: true,
    minimizable: true,
    maximizable: false,
    parent: mainWindow,
    modal: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true
  });

  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'));
  settingsWindow.setMenu(null);
  
  // Handle escape key to close
  settingsWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      settingsWindow.close();
    }
  });
}

// Roaming functionality
let roamingInterval;
let currentDirection = { x: 1, y: 1 };

function startRoaming() {
  if (roamingInterval) return;
  
  const speed = store.get('roamingSpeed');
  
  roamingInterval = setInterval(() => {
    if (!mainWindow || !mainWindow.isVisible()) return;
    
    const bounds = mainWindow.getBounds();
    const workArea = require('electron').screen.getPrimaryDisplay().workArea;
    
    // Calculate new position
    let newX = bounds.x + (currentDirection.x * speed);
    let newY = bounds.y + (currentDirection.y * speed);
    
    // Bounce off screen edges
    if (newX <= workArea.x || newX + bounds.width >= workArea.x + workArea.width) {
      currentDirection.x *= -1;
      newX = Math.max(workArea.x, Math.min(newX, workArea.x + workArea.width - bounds.width));
    }
    
    if (newY <= workArea.y || newY + bounds.height >= workArea.y + workArea.height) {
      currentDirection.y *= -1;
      newY = Math.max(workArea.y, Math.min(newY, workArea.y + workArea.height - bounds.height));
    }
    
    // Move window
    mainWindow.setPosition(Math.round(newX), Math.round(newY));
    
    // Notify renderer of movement for animation
    mainWindow.webContents.send('movement-update', currentDirection);
    
  }, 50); // 20 FPS movement
}

function stopRoaming() {
  if (roamingInterval) {
    clearInterval(roamingInterval);
    roamingInterval = null;
  }
}

// IPC handlers
ipcMain.handle('get-setting', (event, key) => {
  return store.get(key);
});

ipcMain.handle('set-setting', (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('get-all-settings', () => {
  return store.store;
});

ipcMain.handle('show-save-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'chat-export.txt',
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'JSON Files', extensions: ['json'] }
    ]
  });
  return result;
});

ipcMain.handle('open-settings', () => {
  createSettingsWindow();
  return true;
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
  return true;
});

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createTray();
  
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

app.on('before-quit', () => {
  isQuitting = true;
  stopRoaming();
});

// Handle protocol for external links
app.setAsDefaultProtocolClient('vrm-assistant');
