'use strict';

const fs = require('fs');
const path = require('path');
const { ipcMain, dialog, shell } = require('electron');
const { MARKDOWN_EXTENSIONS } = require('../shared/constants');
const { readPrefs, updatePrefs, addRecentFile } = require('./prefs');

function registerIpc({ getWindow, openFile, reloadCurrent, toggleToc, cycleTheme, cycleWidth, rebuildMenu }) {
  ipcMain.handle('prefs:get', () => readPrefs());

  ipcMain.handle('prefs:set', (_event, patch) => {
    const next = updatePrefs(patch);
    if (rebuildMenu) rebuildMenu();
    return next;
  });

  ipcMain.handle('dialog:open', async () => {
    const win = getWindow();
    const result = await dialog.showOpenDialog(win, {
      title: 'Open Markdown',
      properties: ['openFile'],
      filters: [
        { name: 'Markdown', extensions: MARKDOWN_EXTENSIONS.map((ext) => ext.slice(1)) },
        { name: 'All files', extensions: ['*'] }
      ]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    await openFile(result.filePaths[0]);
    return result.filePaths[0];
  });

  ipcMain.handle('file:openPath', async (_event, filePath) => {
    await openFile(filePath);
    return filePath;
  });

  ipcMain.handle('file:read', (_event, filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    addRecentFile(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      dir: path.dirname(filePath),
      content,
      mtime: fs.statSync(filePath).mtimeMs
    };
  });

  ipcMain.handle('fs:resolve', (_event, baseDir, relPath) => {
    const decoded = decodeURIComponent(String(relPath).split('#')[0].split('?')[0]);
    return path.normalize(path.resolve(baseDir, decoded));
  });

  ipcMain.handle('shell:openExternal', (_event, url) => {
    if (/^https?:\/\//i.test(url)) {
      return shell.openExternal(url);
    }
    return false;
  });

  ipcMain.on('view:toggleToc', () => toggleToc());
  ipcMain.on('view:cycleTheme', () => cycleTheme());
  ipcMain.on('view:cycleWidth', () => cycleWidth());
  ipcMain.on('file:reload', () => reloadCurrent());
}

module.exports = { registerIpc };
