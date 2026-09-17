const openBtn = document.getElementById('open-btn');
const emptyOpenBtn = document.getElementById('empty-open');
const tocBtn = document.getElementById('toc-btn');
const widthBtn = document.getElementById('width-btn');
const widthLabel = document.getElementById('width-label');
const searchBtn = document.getElementById('search-btn');
const searchBar = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');
const searchCount = document.getElementById('search-count');
const searchPrev = document.getElementById('search-prev');
const searchNext = document.getElementById('search-next');
const searchCase = document.getElementById('search-case');
const searchClose = document.getElementById('search-close');
const themeBtn = document.getElementById('theme-btn');
const themeLabel = document.getElementById('theme-label');
const fileNameEl = document.getElementById('file-name');
const filePathEl = document.getElementById('file-path');
const tocEl = document.getElementById('toc');
const tocNav = document.getElementById('toc-nav');
const workspace = document.querySelector('.workspace');
const stage = document.getElementById('stage');
const empty = document.getElementById('empty');
const article = document.getElementById('article');
const content = document.getElementById('content');

const THEME_ICONS = {
  system: '<circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.6"/><path d="M12 3.5v1.8M12 18.7v1.8M4.6 12H2.8M21.2 12h-1.8M6.1 6.1l1.3 1.3M16.6 16.6l1.3 1.3M17.9 6.1l-1.3 1.3M7.4 16.6l-1.3 1.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  light: '<circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.6"/><path d="M12 3.5v1.8M12 18.7v1.8M4.6 12H2.8M21.2 12h-1.8M6.1 6.1l1.3 1.3M16.6 16.6l1.3 1.3M17.9 6.1l-1.3 1.3M7.4 16.6l-1.3 1.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  dark: '<path d="M15.2 4.8A7.4 7.4 0 1 0 19.2 16 6.2 6.2 0 0 1 15.2 4.8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
};

const WIDTH_MODES = [
  { id: 'compact', label: 'Compact' },
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'wide', label: 'Wide' },
  { id: 'fill', label: 'Fill' }
];

let currentFile = null;
let prefs = { theme: 'system', tocVisible: true, readingWidth: 'wide' };
let matchCase = false;
let findTimer = null;
let findMarks = [];
let findIndex = -1;
let lastFindKey = '';

function systemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolvedTheme() {
  return prefs.theme === 'system' ? systemTheme() : prefs.theme;
}

function applyTheme() {
  const theme = resolvedTheme();
  document.documentElement.setAttribute('data-theme', theme);
  const label = prefs.theme === 'system' ? 'System' : prefs.theme === 'dark' ? 'Dark' : 'Light';
  themeLabel.textContent = label;
  const icon = document.getElementById('theme-icon');
  icon.innerHTML = THEME_ICONS[prefs.theme] || THEME_ICONS.system;
  if (currentFile) {
    window.viewer.renderMermaid();
  }
}

function applyWidth() {
  const width = WIDTH_MODES.some((mode) => mode.id === prefs.readingWidth)
    ? prefs.readingWidth
    : 'wide';
  document.documentElement.setAttribute('data-width', width);
  const mode = WIDTH_MODES.find((item) => item.id === width);
  widthLabel.textContent = mode ? mode.label : 'Wide';
}

function applyToc() {
  const show = Boolean(prefs.tocVisible && currentFile);
  tocEl.classList.toggle('hidden', !show);
  workspace.classList.toggle('no-toc', !show);
  tocBtn.classList.toggle('active', prefs.tocVisible);
  tocBtn.disabled = !currentFile;
  searchBtn.disabled = !currentFile;
}

async function cycleTheme() {
  const order = ['system', 'light', 'dark'];
  prefs.theme = order[(order.indexOf(prefs.theme) + 1) % order.length];
  applyTheme();
  await window.viewer.setPrefs({ theme: prefs.theme });
}

async function cycleWidth() {
  const order = WIDTH_MODES.map((mode) => mode.id);
  const current = prefs.readingWidth || 'wide';
  prefs.readingWidth = order[(Math.max(0, order.indexOf(current)) + 1) % order.length];
  applyWidth();
  await window.viewer.setPrefs({ readingWidth: prefs.readingWidth });
}

async function toggleToc() {
  prefs.tocVisible = !prefs.tocVisible;
  applyToc();
  await window.viewer.setPrefs({ tocVisible: prefs.tocVisible });
}

function isSearchVisible() {
  return !searchBar.classList.contains('hidden');
}

function setSearchCount(active, matches) {
  if (!searchInput.value.trim()) {
    searchCount.textContent = '';
    searchCount.classList.remove('empty');
    return;
  }
  if (!matches) {
    searchCount.textContent = 'No matches';
    searchCount.classList.add('empty');
    return;
  }
  searchCount.textContent = `${active} / ${matches}`;
  searchCount.classList.remove('empty');
}

function clearFindMarks() {
  content.querySelectorAll('mark.mdv-find').forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();
  });
  findMarks = [];
  findIndex = -1;
  lastFindKey = '';
}

function highlightQuery(rawQuery) {
  clearFindMarks();
  const query = rawQuery.trim();
  if (!query) {
    setSearchCount(0, 0);
    return;
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flags = matchCase ? 'g' : 'gi';
  const nodes = [];
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement && node.parentElement.closest('.mermaid-block')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue) nodes.push(walker.currentNode);
  }

  nodes.forEach((node) => {
    const text = node.nodeValue;
    const re = new RegExp(escaped, flags);
    if (!re.test(text)) return;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let match = re.exec(text);
    while (match) {
      if (!match[0]) break;
      if (match.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, match.index)));
      }
      const mark = document.createElement('mark');
      mark.className = 'mdv-find';
      mark.textContent = match[0];
      frag.appendChild(mark);
      last = match.index + match[0].length;
      match = re.exec(text);
    }
    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)));
    }
    if (node.parentNode) {
      node.parentNode.replaceChild(frag, node);
    }
  });

  findMarks = [...content.querySelectorAll('mark.mdv-find')];
  lastFindKey = `${matchCase}\0${query}`;
  if (findMarks.length) {
    activateFind(0);
  } else {
    setSearchCount(0, 0);
  }
}

function activateFind(index) {
  if (!findMarks.length) {
    setSearchCount(0, 0);
    return;
  }
  findMarks.forEach((mark) => mark.classList.remove('is-active'));
  findIndex = ((index % findMarks.length) + findMarks.length) % findMarks.length;
  const mark = findMarks[findIndex];
  mark.classList.add('is-active');
  mark.scrollIntoView({ block: 'center', inline: 'nearest' });
  setSearchCount(findIndex + 1, findMarks.length);
}

function runFind({ findNext = false, forward = true } = {}) {
  const query = searchInput.value.trim();
  const key = `${matchCase}\0${query}`;
  if (!findNext || key !== lastFindKey || !findMarks.length) {
    highlightQuery(searchInput.value);
    return;
  }
  activateFind(findIndex + (forward ? 1 : -1));
}

function openSearch() {
  if (!currentFile) return;
  searchBar.classList.remove('hidden');
  searchBtn.classList.add('active');
  searchInput.focus();
  searchInput.select();
  if (searchInput.value.trim()) {
    runFind({ findNext: false });
  }
}

function closeSearch() {
  searchBar.classList.add('hidden');
  searchBtn.classList.remove('active');
  searchCount.textContent = '';
  clearFindMarks();
}

function findNext() {
  if (!isSearchVisible()) {
    openSearch();
    return;
  }
  runFind({ findNext: true, forward: true });
}

function findPrev() {
  if (!isSearchVisible()) {
    openSearch();
    return;
  }
  runFind({ findNext: true, forward: false });
}

function showEmpty() {
  empty.classList.remove('hidden');
  article.classList.add('hidden');
  fileNameEl.textContent = 'No file open';
  filePathEl.textContent = 'Drop a Markdown file to begin';
  tocNav.innerHTML = '';
  currentFile = null;
  closeSearch();
  applyToc();
}

function renderToc(headings) {
  tocNav.innerHTML = '';
  headings.forEach((heading) => {
    if (!heading.id) return;
    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    link.className = `level-${heading.level}`;
    link.textContent = heading.text;
    tocNav.appendChild(link);
  });
  updateActiveToc();
}

function updateActiveToc() {
  const headings = [...content.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')];
  if (!headings.length) return;
  const marker = 88;
  let current = headings[0];
  headings.forEach((heading) => {
    if (heading.getBoundingClientRect().top - stage.getBoundingClientRect().top <= marker) {
      current = heading;
    }
  });
  tocNav.querySelectorAll('a').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current.id}`);
  });
}

async function displayMarkdown(filePath) {
  const file = await window.viewer.readFile(filePath);
  const rendered = window.viewer.renderMarkdown(file.content, file.dir);
  currentFile = file;
  content.innerHTML = rendered.html;
  fileNameEl.textContent = file.name;
  fileNameEl.title = file.path;
  filePathEl.textContent = file.path;
  renderToc(rendered.headings);
  empty.classList.add('hidden');
  article.classList.remove('hidden');
  stage.scrollTop = 0;
  applyToc();
  updateActiveToc();
  await window.viewer.renderMermaid();
  if (isSearchVisible() && searchInput.value.trim()) {
    runFind({ findNext: false });
  }
}

function isMarkdownPath(filePath) {
  return /\.(md|markdown|mdown|mkd|mdwn)$/i.test(filePath);
}

window.viewer.onFileOpened(async ({ path: filePath }) => {
  try {
    await displayMarkdown(filePath);
  } catch (error) {
    showEmpty();
    fileNameEl.textContent = 'Could not open file';
    filePathEl.textContent = error.message || String(error);
  }
});

openBtn.addEventListener('click', () => window.viewer.openDialog());
emptyOpenBtn.addEventListener('click', () => window.viewer.openDialog());
tocBtn.addEventListener('click', toggleToc);
widthBtn.addEventListener('click', cycleWidth);
themeBtn.addEventListener('click', cycleTheme);
searchBtn.addEventListener('click', () => {
  if (isSearchVisible()) closeSearch();
  else openSearch();
});
searchClose.addEventListener('click', closeSearch);
searchNext.addEventListener('click', findNext);
searchPrev.addEventListener('click', findPrev);
searchCase.addEventListener('click', () => {
  matchCase = !matchCase;
  searchCase.classList.toggle('active', matchCase);
  runFind({ findNext: false });
});
searchInput.addEventListener('input', () => {
  clearTimeout(findTimer);
  findTimer = setTimeout(() => runFind({ findNext: false }), 120);
});
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    runFind({ findNext: true, forward: !event.shiftKey });
  } else if (event.key === 'Escape') {
    event.preventDefault();
    closeSearch();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isSearchVisible()) {
    event.preventDefault();
    closeSearch();
  }
});
stage.addEventListener('scroll', updateActiveToc, { passive: true });

tocNav.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link) return;
  event.preventDefault();
  const id = decodeURIComponent((link.getAttribute('href') || '').slice(1));
  const target = document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

window.viewer.onPrefsChanged((next) => {
  prefs = { ...prefs, ...next };
  applyTheme();
  applyToc();
  applyWidth();
});

window.viewer.onToggleToc(toggleToc);
window.viewer.onCycleTheme(cycleTheme);
window.viewer.onCycleWidth(cycleWidth);
window.viewer.onSearchOpen(openSearch);
window.viewer.onSearchNext(findNext);
window.viewer.onSearchPrev(findPrev);

content.addEventListener('click', async (event) => {
  const link = event.target.closest('a');
  if (!link) return;
  const href = link.getAttribute('href') || '';
  if (href.startsWith('#')) return;

  event.preventDefault();
  if (/^https?:/i.test(href)) {
    await window.viewer.openExternal(href);
    return;
  }

  const localPath = link.getAttribute('data-local-path');
  if (localPath && isMarkdownPath(localPath)) {
    await window.viewer.openPath(localPath);
  }
});

['dragenter', 'dragover'].forEach((type) => {
  stage.addEventListener(type, (event) => {
    event.preventDefault();
    stage.classList.add('dragover');
  });
});

stage.addEventListener('dragleave', (event) => {
  if (event.target === stage) stage.classList.remove('dragover');
});

stage.addEventListener('drop', async (event) => {
  event.preventDefault();
  stage.classList.remove('dragover');
  const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
  if (!file) return;
  const filePath = window.viewer.getPathForFile(file);
  if (filePath && isMarkdownPath(filePath)) {
    await window.viewer.openPath(filePath);
  }
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

window.viewer.getPrefs().then((next) => {
  prefs = { ...prefs, ...next };
  applyTheme();
  applyToc();
  applyWidth();
});
