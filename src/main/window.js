'use strict';

const path = require('path');
const { BrowserWindow, shell, nativeTheme } = require('electron');
const { APP_NAME } = require('../shared/constants');
const { readPrefs } = require('./prefs');

function windowBackground() {
  const prefs = readPrefs();
  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && nativeTheme.shouldUseDarkColors);
  return dark ? '#101218' : '#e8e0d0';
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 840,
    minWidth: 760,
    minHeight: 520,
    title: APP_NAME,
    backgroundColor: windowBackground(),
    icon: path.join(__dirname, '../../resources/icons/icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  return win;
}

module.exports = { createMainWindow };
