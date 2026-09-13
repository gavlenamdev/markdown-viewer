#!/usr/bin/env node
'use strict';

const path = require('path');
const { installFileAssociations } = require('../src/platform/linux');

if (process.platform !== 'linux') {
  console.error('This installer only applies to Linux. Windows/macOS associations come from the packaged app.');
  process.exit(1);
}

const appRoot = path.resolve(__dirname, '..');
const electronPath = path.join(appRoot, 'node_modules', 'electron', 'dist', 'electron');
const iconPath = path.join(appRoot, 'resources', 'icons', 'icon.svg');

const result = installFileAssociations({ electronPath, appRoot, iconPath });
console.log(`Installed ${result.desktopPath}`);
console.log(`Launcher: ${result.launcherPath}`);
console.log('Markdown files (.md) should now open in Markdown Viewer.');
