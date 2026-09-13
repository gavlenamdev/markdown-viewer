'use strict';

const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mdwn'];

const MIME_TYPES = [
  'text/markdown',
  'text/x-markdown',
  'application/x-extension-md'
];

const APP_ID = 'com.sigmobird.markdownviewer';
const APP_NAME = 'Markdown Viewer';
const DESKTOP_ID = 'markdown-viewer.desktop';

module.exports = {
  MARKDOWN_EXTENSIONS,
  MIME_TYPES,
  APP_ID,
  APP_NAME,
  DESKTOP_ID
};
