'use strict';

/**
 * Windows file associations are registered by the packaged installer
 * (electron-builder NSIS + fileAssociations in package.json).
 * Implement this module when building the Windows installer.
 */
function installFileAssociations() {
  return {
    ok: false,
    reason: 'windows-installer',
    detail: 'On Windows, .md associations come from the NSIS installer (npm run dist:win).'
  };
}

module.exports = { installFileAssociations };
