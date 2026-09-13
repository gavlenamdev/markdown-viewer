'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { APP_NAME, DESKTOP_ID, MIME_TYPES } = require('../shared/constants');

function run(cmd, args, extra = {}) {
  try {
    execFileSync(cmd, args, {
      stdio: 'pipe',
      encoding: 'utf8',
      ...extra
    });
    return true;
  } catch {
    return false;
  }
}

function writeIfChanged(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === contents) {
    return false;
  }
  fs.writeFileSync(filePath, contents, { encoding: 'utf8', mode: 0o644 });
  return true;
}

function launcherScript({ electronPath, appRoot }) {
  return `#!/usr/bin/env bash
set -euo pipefail
ELECTRON=${JSON.stringify(electronPath)}
APP_ROOT=${JSON.stringify(appRoot)}
# User-local installs cannot chown chrome-sandbox to root; disable the SUID sandbox.
exec "$ELECTRON" --no-sandbox "$APP_ROOT" "$@"
`;
}

function desktopEntry({ execPath, iconPath }) {
  return `[Desktop Entry]
Type=Application
Version=1.0
Name=${APP_NAME}
Comment=Read Markdown files
Exec=${execPath} %F
Icon=${iconPath}
Terminal=false
Categories=Office;Viewer;
MimeType=text/markdown;text/x-markdown;application/x-extension-md;
StartupNotify=true
StartupWMClass=markdown-viewer
Keywords=markdown;md;viewer;readme;
`;
}

function mimeXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="text/markdown">
    <comment>Markdown document</comment>
    <sub-class-of type="text/plain"/>
    <glob pattern="*.md"/>
    <glob pattern="*.markdown"/>
    <glob pattern="*.mdown"/>
    <glob pattern="*.mkd"/>
    <glob pattern="*.mdwn"/>
  </mime-type>
</mime-info>
`;
}

function patchMimeappsList(mimeappsPath) {
  const blockHeader = '[Default Applications]';
  const linesToSet = MIME_TYPES.map((mime) => `${mime}=${DESKTOP_ID}`);
  let text = '';
  if (fs.existsSync(mimeappsPath)) {
    text = fs.readFileSync(mimeappsPath, 'utf8');
  }

  const sections = text.split(/\n(?=\[)/);
  let found = false;
  const next = sections.map((section) => {
    if (!section.startsWith(blockHeader)) return section;
    found = true;
    const lines = section.split('\n');
    const kept = lines.filter((line) => {
      const key = line.split('=')[0];
      return !MIME_TYPES.includes(key);
    });
    const header = kept[0] === blockHeader ? kept : [blockHeader, ...kept.filter(Boolean)];
    const body = header[0] === blockHeader ? header.slice(1) : header;
    return [blockHeader, ...linesToSet, ...body.filter((l) => l && l !== blockHeader)].join('\n');
  });

  if (!found) {
    next.push([blockHeader, ...linesToSet].join('\n'));
  }

  const out = next.filter(Boolean).join('\n').replace(/\n*$/, '\n');
  writeIfChanged(mimeappsPath, out);
}

function installFileAssociations({ electronPath, appRoot, iconPath }) {
  const home = os.homedir();
  const binDir = path.join(home, '.local', 'bin');
  const applicationsDir = path.join(home, '.local', 'share', 'applications');
  const mimePackagesDir = path.join(home, '.local', 'share', 'mime', 'packages');
  const iconsDir = path.join(home, '.local', 'share', 'icons', 'hicolor', 'scalable', 'apps');
  const pngIconDir = path.join(home, '.local', 'share', 'icons', 'hicolor', '256x256', 'apps');
  const mimeappsPath = path.join(home, '.config', 'mimeapps.list');
  const launcherPath = path.join(binDir, 'markdown-viewer');
  const desktopPath = path.join(applicationsDir, DESKTOP_ID);
  const mimePath = path.join(mimePackagesDir, 'markdown-viewer.xml');
  const userIconPath = path.join(iconsDir, 'markdown-viewer.svg');
  const userPngIcon = path.join(pngIconDir, 'markdown-viewer.png');
  const pngSource = path.join(appRoot, 'resources', 'icons', '256x256.png');

  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(applicationsDir, { recursive: true });
  fs.mkdirSync(mimePackagesDir, { recursive: true });
  fs.mkdirSync(iconsDir, { recursive: true });
  fs.mkdirSync(pngIconDir, { recursive: true });
  fs.mkdirSync(path.dirname(mimeappsPath), { recursive: true });

  if (iconPath && fs.existsSync(iconPath)) {
    fs.copyFileSync(iconPath, userIconPath);
  }
  if (fs.existsSync(pngSource)) {
    fs.copyFileSync(pngSource, userPngIcon);
  }

  fs.writeFileSync(launcherPath, launcherScript({ electronPath, appRoot }), {
    encoding: 'utf8',
    mode: 0o755
  });

  writeIfChanged(desktopPath, desktopEntry({
    execPath: launcherPath,
    iconPath: 'markdown-viewer'
  }));
  writeIfChanged(mimePath, mimeXml());
  patchMimeappsList(mimeappsPath);

  run('update-mime-database', [path.join(home, '.local', 'share', 'mime')]);
  run('update-desktop-database', [applicationsDir]);
  run('xdg-desktop-menu', ['forceupdate']);
  run('gtk-update-icon-cache', [path.join(home, '.local', 'share', 'icons', 'hicolor')]);

  for (const mime of MIME_TYPES) {
    run('xdg-mime', ['default', DESKTOP_ID, mime]);
  }

  return {
    ok: true,
    launcherPath,
    desktopPath
  };
}

module.exports = { installFileAssociations };
