'use strict';

const platform = process.platform;

if (platform === 'linux') {
  module.exports = require('./linux');
} else if (platform === 'win32') {
  module.exports = require('./win32');
} else if (platform === 'darwin') {
  module.exports = require('./darwin');
} else {
  module.exports = {
    installFileAssociations() {
      return {
        ok: false,
        reason: `file associations are not implemented for ${platform}`
      };
    }
  };
}
