'use strict';

const { Menu, shell, app } = require('electron');
const { APP_NAME } = require('../shared/constants');
const { readPrefs } = require('./prefs');

const WIDTH_MODES = [
  { id: 'compact', label: 'Compact' },
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'wide', label: 'Wide' },
  { id: 'fill', label: 'Fill' }
];

function createAppMenu({
  onOpen,
  onOpenRecent,
  onClearRecent,
  onToggleToc,
  onToggleTheme,
  onReloadFile,
  onSetReadingWidth,
  onCycleReadingWidth,
  onFind,
  onFindNext,
  onFindPrevious
}) {
  const prefs = readPrefs();
  const recentItems = prefs.recentFiles.length
    ? prefs.recentFiles.map((filePath) => ({
      label: filePath,
      click: () => onOpenRecent(filePath)
    }))
    : [{ label: 'No recent files', enabled: false }];

  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: onOpen },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: onReloadFile },
        {
          label: 'Open Recent',
          submenu: [
            ...recentItems,
            { type: 'separator' },
            { label: 'Clear Recent', click: onClearRecent }
          ]
        },
        { type: 'separator' },
        { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: (_, win) => win && win.webContents.print() },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: onFind },
        { label: 'Find Next', accelerator: 'F3', click: onFindNext },
        { label: 'Find Previous', accelerator: 'Shift+F3', click: onFindPrevious }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Table of Contents', accelerator: 'CmdOrCtrl+B', click: onToggleToc },
        { label: 'Toggle Theme', accelerator: 'CmdOrCtrl+Shift+T', click: onToggleTheme },
        { type: 'separator' },
        {
          label: 'Page width',
          submenu: [
            ...WIDTH_MODES.map((mode) => ({
              label: mode.label,
              type: 'radio',
              checked: (prefs.readingWidth || 'wide') === mode.id,
              click: () => onSetReadingWidth(mode.id)
            })),
            { type: 'separator' },
            { label: 'Cycle page width', accelerator: 'CmdOrCtrl+Shift+W', click: onCycleReadingWidth }
          ]
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: `About ${APP_NAME}`,
          click: () => {
            shell.openExternal('https://github.com/sigmobird/markdown-viewer').catch(() => {});
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  return Menu.buildFromTemplate(template);
}

module.exports = { createAppMenu, WIDTH_MODES };
