'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { MARKDOWN_EXTENSIONS } = require('../shared/constants');

function isMarkdownFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MARKDOWN_EXTENSIONS.includes(ext);
}

function collectOpenFiles(argv = process.argv) {
  const files = [];
  const start = app.isPackaged ? 1 : 2;

  for (let i = start; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg || arg.startsWith('-')) continue;

    try {
      const resolved = path.resolve(arg);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        files.push(resolved);
      }
    } catch {
      // ignore unreadable argv entries
    }
  }

  return files;
}

module.exports = { collectOpenFiles, isMarkdownFile };
