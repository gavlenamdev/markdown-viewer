'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');
const path = require('path');
const MarkdownIt = require('markdown-it');
const anchor = require('markdown-it-anchor');
const taskLists = require('markdown-it-task-lists');
const hljs = require('highlight.js');
const createDOMPurify = require('dompurify');

const DOMPurify = createDOMPurify(window);

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
      } catch {
        return '';
      }
    }
    return '';
  }
});

md.use(anchor, {
  permalink: false,
  slugify(value) {
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
  }
});
md.use(taskLists, { enabled: true, label: true, labelAfter: true });

function extractHeadings(tokens) {
  const headings = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type !== 'heading_open') continue;
    const level = Number(token.tag.slice(1));
    const inline = tokens[i + 1];
    const text = inline && inline.children
      ? inline.children
        .filter((child) => child.type === 'text' || child.type === 'code_inline')
        .map((child) => child.content)
        .join('')
      : '';
    const id = (token.attrs || []).find((attr) => attr[0] === 'id');
    headings.push({ level, text, id: id ? id[1] : '' });
  }
  return headings;
}

function toResourceUrl(absolutePath) {
  return `mdv://local/file?p=${encodeURIComponent(absolutePath)}`;
}

function rewriteLocalUrls(html, baseDir) {
  const template = document.createElement('template');
  template.innerHTML = html;

  template.content.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (!src || /^(https?:|data:|mdv:)/i.test(src)) return;
    const abs = path.normalize(path.resolve(baseDir, decodeURIComponent(src.split('#')[0])));
    img.setAttribute('src', toResourceUrl(abs));
  });

  template.content.querySelectorAll('a[href]').forEach((anchorEl) => {
    const href = anchorEl.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    if (/^https?:/i.test(href)) {
      anchorEl.setAttribute('target', '_blank');
      anchorEl.setAttribute('rel', 'noreferrer noopener');
      return;
    }
    const abs = path.normalize(path.resolve(baseDir, decodeURIComponent(href.split('#')[0])));
    anchorEl.setAttribute('data-local-path', abs);
  });

  return template.innerHTML;
}

function renderMarkdown(markdown, baseDir) {
  const tokens = md.parse(markdown, {});
  const headings = extractHeadings(tokens);
  const raw = md.renderer.render(tokens, md.options, {});
  const clean = DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel', 'class', 'id', 'checked', 'disabled', 'data-local-path'],
    ADD_TAGS: ['input']
  });
  const html = rewriteLocalUrls(clean, baseDir);
  const firstHeading = headings.find((item) => item.level === 1);
  return {
    html,
    headings,
    title: firstHeading ? firstHeading.text : ''
  };
}

contextBridge.exposeInMainWorld('viewer', {
  renderMarkdown,
  toResourceUrl,
  getPathForFile(file) {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return file && file.path ? file.path : '';
    }
  },
  openDialog: () => ipcRenderer.invoke('dialog:open'),
  openPath: (filePath) => ipcRenderer.invoke('file:openPath', filePath),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  resolvePath: (baseDir, relPath) => ipcRenderer.invoke('fs:resolve', baseDir, relPath),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  getPrefs: () => ipcRenderer.invoke('prefs:get'),
  setPrefs: (patch) => ipcRenderer.invoke('prefs:set', patch),
  onFileOpened: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('file:opened', listener);
    return () => ipcRenderer.removeListener('file:opened', listener);
  },
  onPrefsChanged: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('prefs:changed', listener);
    return () => ipcRenderer.removeListener('prefs:changed', listener);
  },
  onToggleToc: (handler) => {
    ipcRenderer.on('view:toggleToc', handler);
  },
  onCycleTheme: (handler) => {
    ipcRenderer.on('view:cycleTheme', handler);
  },
  onCycleWidth: (handler) => {
    ipcRenderer.on('view:cycleWidth', handler);
  },
  onSearchOpen: (handler) => ipcRenderer.on('search:open', handler),
  onSearchNext: (handler) => ipcRenderer.on('search:next', handler),
  onSearchPrev: (handler) => ipcRenderer.on('search:prev', handler)
});
