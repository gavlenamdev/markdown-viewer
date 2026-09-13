'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = {
  theme: 'system',
  tocVisible: true,
  readingWidth: 'wide',
  recentFiles: [],
  linuxAssociationInstalled: false
};

function prefsPath() {
  return path.join(app.getPath('userData'), 'prefs.json');
}

function readPrefs() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(prefsPath(), 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

function writePrefs(next) {
  fs.mkdirSync(path.dirname(prefsPath()), { recursive: true });
  fs.writeFileSync(prefsPath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function updatePrefs(patch) {
  return writePrefs({ ...readPrefs(), ...patch });
}

function addRecentFile(filePath) {
  const prefs = readPrefs();
  const recentFiles = [filePath, ...prefs.recentFiles.filter((item) => item !== filePath)].slice(0, 12);
  return updatePrefs({ recentFiles });
}

module.exports = { readPrefs, writePrefs, updatePrefs, addRecentFile };
