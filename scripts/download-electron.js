'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { downloadArtifact } = require('@electron/get');
const extract = require('extract-zip');
const electronDir = path.join(__dirname, '../node_modules/electron');
const { version } = require('../node_modules/electron/package.json');

async function main() {
  const binary = path.join(electronDir, 'dist', 'electron');
  const pathTxt = path.join(electronDir, 'path.txt');
  if (fs.existsSync(binary) && fs.existsSync(pathTxt)) {
    return;
  }

  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: process.platform,
    arch: process.arch
  });

  const dist = path.join(electronDir, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  await extract(zipPath, { dir: dist });

  if (!fs.existsSync(binary)) {
    const fallback = spawnSync('python3', ['-c', `
import zipfile, pathlib
zf = zipfile.ZipFile(${JSON.stringify(zipPath)})
dest = pathlib.Path(${JSON.stringify(dist)})
zf.extractall(dest)
`], { encoding: 'utf8' });
    if (fallback.status !== 0) {
      throw new Error(fallback.stderr || 'Failed to extract Electron');
    }
  }

  fs.writeFileSync(pathTxt, 'electron');
  if (fs.existsSync(binary)) {
    fs.chmodSync(binary, 0o755);
  }
  console.log('Electron binary ready');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
