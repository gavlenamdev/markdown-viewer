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

const defaultFence = md.renderer.rules.fence;
md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
  const token = tokens[idx];
  const info = token.info ? md.utils.unescapeAll(token.info).trim() : '';
  const lang = info.split(/\s+/, 1)[0].toLowerCase();
  if (lang === 'mermaid') {
    return `<div class="mermaid-block"><pre class="mermaid-src">${md.utils.escapeHtml(token.content)}</pre><div class="mermaid-svg"></div></div>\n`;
  }
  return defaultFence(tokens, idx, options, env, slf);
};

let mermaidReady = null;
let mermaidId = 0;
let mermaidRenderToken = 0;

function cssThemeVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function mermaidConfig() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    logLevel: 'error',
    theme: 'base',
    fontFamily: 'Ubuntu, Cantarell, Noto Sans, Segoe UI, system-ui, sans-serif',
    themeVariables: {
      darkMode: dark,
      background: 'transparent',
      fontFamily: 'Ubuntu, Cantarell, Noto Sans, Segoe UI, system-ui, sans-serif',
      primaryColor: cssThemeVar('--accent-soft', dark ? '#2b241c' : '#f6e5dc'),
      primaryTextColor: cssThemeVar('--ink', dark ? '#efe6d8' : '#1c1814'),
      primaryBorderColor: cssThemeVar('--accent', dark ? '#e2a66a' : '#9a3b24'),
      secondaryColor: cssThemeVar('--chrome', dark ? '#141821' : '#f1ebe0'),
      tertiaryColor: cssThemeVar('--code-bg', dark ? '#12161e' : '#f0e9db'),
      lineColor: cssThemeVar('--muted', dark ? '#9b9286' : '#73695c'),
      textColor: cssThemeVar('--ink', dark ? '#efe6d8' : '#1c1814'),
      mainBkg: cssThemeVar('--accent-soft', dark ? '#2b241c' : '#f6e5dc'),
      nodeBorder: cssThemeVar('--accent', dark ? '#e2a66a' : '#9a3b24'),
      clusterBkg: cssThemeVar('--chrome', dark ? '#141821' : '#f1ebe0'),
      clusterBorder: cssThemeVar('--line-strong', dark ? '#3d4658' : '#c9bca8'),
      titleColor: cssThemeVar('--ink', dark ? '#efe6d8' : '#1c1814'),
      edgeLabelBackground: cssThemeVar('--paper', dark ? '#1c212c' : '#fbf7ef'),
      actorBkg: cssThemeVar('--accent-soft', dark ? '#2b241c' : '#f6e5dc'),
      actorBorder: cssThemeVar('--accent', dark ? '#e2a66a' : '#9a3b24'),
      actorTextColor: cssThemeVar('--ink', dark ? '#efe6d8' : '#1c1814'),
      signalColor: cssThemeVar('--ink-soft', dark ? '#d5cbbd' : '#3d362e'),
      labelBoxBkgColor: cssThemeVar('--paper', dark ? '#1c212c' : '#fbf7ef'),
      labelBoxBorderColor: cssThemeVar('--line-strong', dark ? '#3d4658' : '#c9bca8'),
      labelTextColor: cssThemeVar('--ink', dark ? '#efe6d8' : '#1c1814'),
      noteBkgColor: cssThemeVar('--code-bg', dark ? '#12161e' : '#f0e9db'),
      noteTextColor: cssThemeVar('--ink', dark ? '#efe6d8' : '#1c1814'),
      noteBorderColor: cssThemeVar('--line-strong', dark ? '#3d4658' : '#c9bca8')
    }
  };
}

function getMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then((mod) => {
      const mermaid = mod.default;
      mermaid.startOnLoad = false;
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', logLevel: 'error' });
      return mermaid;
    });
  }
  return mermaidReady;
}

async function renderMermaid() {
  const blocks = document.querySelectorAll('.mermaid-block');
  if (!blocks.length) return;

  const token = ++mermaidRenderToken;
  const mermaid = await getMermaid();
  if (token !== mermaidRenderToken) return;
  mermaid.initialize(mermaidConfig());

  for (const block of blocks) {
    if (token !== mermaidRenderToken) return;
    const sourceEl = block.querySelector('.mermaid-src');
    const mount = block.querySelector('.mermaid-svg');
    if (!sourceEl || !mount) continue;

    const source = sourceEl.textContent.trim();
    if (!source) {
      mount.replaceChildren();
      block.classList.remove('is-error');
      continue;
    }

    const id = `mdv-mermaid-${++mermaidId}`;
    try {
      const { svg } = await mermaid.render(id, source);
      mount.innerHTML = svg;
      block.classList.remove('is-error');
    } catch (error) {
      block.classList.add('is-error');
      const pre = document.createElement('pre');
      pre.className = 'mermaid-error';
      pre.textContent = error && error.message ? error.message : String(error);
      mount.replaceChildren(pre);
    }
  }
}

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
    ADD_ATTR: ['target', 'rel', 'class', 'id', 'checked', 'disabled', 'data-local-path', 'role', 'aria-label'],
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
  renderMermaid,
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
