'use strict';

/**
 * macOS file associations are registered via Info.plist
 * (electron-builder mac.extendInfo + fileAssociations).
 * Handle app.on('open-file') is already wired in the main process.
 */
function installFileAssociations() {
  return {
    ok: false,
    reason: 'macos-installer',
    detail: 'On macOS, .md associations come from the app bundle (npm run dist:mac).'
  };
}

module.exports = { installFileAssociations };
