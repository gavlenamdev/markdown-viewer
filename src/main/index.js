'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const {
  app,
  protocol,
  net,
  Menu,
  dialog
} = require('electron');

const { createMainWindow } = require('./window');
const { createAppMenu, WIDTH_MODES } = require('./menu');
const { registerIpc } = require('./ipc');
const { collectOpenFiles } = require('./file-open');
const { readPrefs, updatePrefs, addRecentFile } = require('./prefs');
const { installFileAssociations } = require('../platform');
const { APP_NAME } = require('../shared/constants');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mdv',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

app.setName(APP_NAME);

if (process.platform === 'linux' && !app.isPackaged) {
  app.commandLine.appendSwitch('no-sandbox');
}

const pendingFiles = [];
let mainWindow = null;
let currentFile = null;
let watcher = null;
let watcherTimer = null;

function queueFile(filePath) {
  if (!filePath) return;
  pendingFiles.push(filePath);
}

function takeQueuedFile() {
  if (!pendingFiles.length) return null;
  const filePath = pendingFiles[pendingFiles.length - 1];
  pendingFiles.length = 0;
  return filePath;
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function stopWatching() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  if (watcherTimer) {
    clearTimeout(watcherTimer);
    watcherTimer = null;
  }
}

function watchFile(filePath) {
  stopWatching();
  try {
    watcher = fs.watch(filePath, () => {
      clearTimeout(watcherTimer);
      watcherTimer = setTimeout(() => {
        if (currentFile === filePath) {
          openFile(filePath, { silent: true });
        }
      }, 120);
    });
  } catch {
    // some network filesystems do not support watch
  }
}

async function openFile(filePath, { silent = false } = {}) {
  if (!filePath) return;
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    if (!silent) {
      dialog.showErrorBox(APP_NAME, `File not found:\n${resolved}`);
    }
    return;
  }

  currentFile = resolved;
  addRecentFile(resolved);
  watchFile(resolved);
  rebuildMenu();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setTitle(`${path.basename(resolved)} — ${APP_NAME}`);
  }

  sendToRenderer('file:opened', { path: resolved, silent });
}

function rebuildMenu() {
  const menu = createAppMenu({
    onOpen: () => openDialog(),
    onOpenRecent: (filePath) => openFile(filePath),
    onClearRecent: () => {
      updatePrefs({ recentFiles: [] });
      rebuildMenu();
    },
    onToggleToc: () => sendToRenderer('view:toggleToc'),
    onToggleTheme: () => sendToRenderer('view:cycleTheme'),
    onReloadFile: () => currentFile && openFile(currentFile),
    onSetReadingWidth: (width) => {
      updatePrefs({ readingWidth: width });
      sendToRenderer('prefs:changed', readPrefs());
      rebuildMenu();
    },
    onCycleReadingWidth: () => cycleWidth(),
    onFind: () => sendToRenderer('search:open'),
    onFindNext: () => sendToRenderer('search:next'),
    onFindPrevious: () => sendToRenderer('search:prev')
  });
  Menu.setApplicationMenu(menu);
}

async function openDialog() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Markdown',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mdwn'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });
  if (!result.canceled && result.filePaths[0]) {
    await openFile(result.filePaths[0]);
  }
}

function cycleTheme() {
  const prefs = readPrefs();
  const order = ['system', 'light', 'dark'];
  const next = order[(order.indexOf(prefs.theme) + 1) % order.length];
  updatePrefs({ theme: next });
  sendToRenderer('prefs:changed', readPrefs());
}

function toggleToc() {
  const prefs = readPrefs();
  updatePrefs({ tocVisible: !prefs.tocVisible });
  sendToRenderer('prefs:changed', readPrefs());
}

function cycleWidth() {
  const prefs = readPrefs();
  const order = WIDTH_MODES.map((mode) => mode.id);
  const current = prefs.readingWidth || 'wide';
  const next = order[(Math.max(0, order.indexOf(current)) + 1) % order.length];
  updatePrefs({ readingWidth: next });
  sendToRenderer('prefs:changed', readPrefs());
  rebuildMenu();
}

function registerMediaProtocol() {
  protocol.handle('mdv', async (request) => {
    try {
      const filePath = new URL(request.url).searchParams.get('p');
      if (!filePath || filePath.includes('\0')) {
        return new Response('Bad Request', { status: 400 });
      }
      if (!fs.existsSync(filePath)) {
        return new Response('Not Found', { status: 404 });
      }
      return net.fetch(pathToFileURL(filePath).href);
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });
}

function maybeInstallLinuxAssociations() {
  if (process.platform !== 'linux') return;

  const electronPath = process.execPath;
  const appRoot = app.isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '../..');
  const iconPath = path.join(__dirname, '../../resources/icons/icon.svg');

  try {
    const result = installFileAssociations({ electronPath, appRoot, iconPath });
    if (result.ok) {
      updatePrefs({ linuxAssociationInstalled: true });
    }
  } catch (error) {
    console.error('Failed to install Linux file associations', error);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const files = collectOpenFiles(argv);
    files.forEach(queueFile);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      const latest = takeQueuedFile();
      if (latest) openFile(latest);
    }
  });

  // macOS: Finder double-click before/after ready
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (app.isReady() && mainWindow) {
      openFile(filePath);
    } else {
      queueFile(filePath);
    }
  });

  app.whenReady().then(async () => {
    registerMediaProtocol();
    maybeInstallLinuxAssociations();

    collectOpenFiles(process.argv).forEach(queueFile);

    registerIpc({
      getWindow: () => mainWindow,
      openFile,
      reloadCurrent: () => currentFile && openFile(currentFile),
      toggleToc,
      cycleTheme,
      cycleWidth,
      rebuildMenu
    });

    rebuildMenu();
    mainWindow = createMainWindow();

    mainWindow.webContents.once('did-finish-load', () => {
      sendToRenderer('prefs:changed', readPrefs());
      const queued = takeQueuedFile();
      if (queued) {
        openFile(queued);
      }

      if (process.env.MDV_VERIFY) {
        setTimeout(async () => {
          try {
            const text = await mainWindow.webContents.executeJavaScript(
              `document.getElementById('content')?.innerText.slice(0, 600) || document.body.innerText.slice(0, 600)`
            );
            fs.writeFileSync(`${process.env.MDV_VERIFY}.txt`, String(text || ''), 'utf8');
            const darkPng = await mainWindow.webContents.capturePage();
            fs.writeFileSync(`${process.env.MDV_VERIFY}-dark.png`, darkPng.toPNG());
            await mainWindow.webContents.executeJavaScript(
              `document.documentElement.setAttribute('data-theme', 'light')`
            );
            await new Promise((resolve) => setTimeout(resolve, 200));
            const lightPng = await mainWindow.webContents.capturePage();
            fs.writeFileSync(`${process.env.MDV_VERIFY}-light.png`, lightPng.toPNG());
            mainWindow.setSize(1600, 900);
            await new Promise((resolve) => setTimeout(resolve, 250));
            const largePng = await mainWindow.webContents.capturePage();
            fs.writeFileSync(`${process.env.MDV_VERIFY}-large.png`, largePng.toPNG());
          } catch (error) {
            fs.writeFileSync(`${process.env.MDV_VERIFY}.txt`, String(error), 'utf8');
          }
        }, 1400);
      }
    });

    app.on('activate', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
      } else {
        mainWindow = createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    stopWatching();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
