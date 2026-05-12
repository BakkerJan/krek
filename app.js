let WORDS = [];
let activeLetter = null;
let activeMode = 'begint';

const INITIAL_LIMIT = 100;
const LOAD_INCREMENT = 200;
const CHUNK_SIZE = 50;
const STORAGE_KEY = 'urker-woordenboek-filters-v1';

let displayLimit = INITIAL_LIMIT;

const searchInput = document.getElementById('search');
const countEl = document.getElementById('count');
const emptyEl = document.getElementById('empty');
const emptyQuery = document.getElementById('empty-query');
const resetBtn = document.getElementById('reset-btn');
const lettersEl = document.getElementById('letters');
const grid = document.getElementById('word-grid');
const loadMoreBtn = document.getElementById('load-more');
const sortSelect = document.getElementById('sort-select');
const onlyPlural = document.getElementById('only-plural');
const totalCount = document.getElementById('total-count');
const wordsUpdated = document.getElementById('words-updated');
const wvdEl = document.getElementById('wvd');
const wvdWord = document.getElementById('wvd-word');
const wvdMv = document.getElementById('wvd-mv');

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function debounce(fn, wait = 180) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      q: searchInput.value,
      mode: activeMode,
      letter: activeLetter,
      sort: sortSelect.value,
      pluralOnly: onlyPlural.checked
    }));
  } catch (_) {
    // no-op
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (typeof state.q === 'string') searchInput.value = state.q;
    if (state.mode && ['bevat', 'begint', 'eindigt'].includes(state.mode)) activeMode = state.mode;
    if (typeof state.letter === 'string') activeLetter = state.letter;
    if (state.sort && ['az', 'za'].includes(state.sort)) sortSelect.value = state.sort;
    if (typeof state.pluralOnly === 'boolean') onlyPlural.checked = state.pluralOnly;
  } catch (_) {
    // no-op
  }
}

function updateModeButtons() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    const isActive = btn.dataset.mode === activeMode;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

function updateLetterButtons() {
  document.querySelectorAll('.letter-btn').forEach(btn => {
    const isActive = btn.dataset.letter === activeLetter;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

function buildLetterButtons() {
  lettersEl.innerHTML = '';
  const letters = [...new Set(WORDS.map(e => e.w[0].toUpperCase()))].sort((a, b) => a.localeCompare(b, 'nl'));

  letters.forEach(l => {
    const btn = document.createElement('button');
    btn.className = 'letter-btn';
    btn.type = 'button';
    btn.textContent = l;
    btn.dataset.letter = l;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      activeLetter = activeLetter === l ? null : l;
      searchInput.value = '';
      displayLimit = INITIAL_LIMIT;
      updateLetterButtons();
      saveState();
      render();
    });
    lettersEl.appendChild(btn);
  });

  if (!letters.includes(activeLetter)) activeLetter = null;
  updateLetterButtons();
}

function showWordVanDeDag() {
  if (!WORDS.length) return;
  const nouns = WORDS.filter(e => typeof e.mv === 'string' && e.mv.trim());
  const source = nouns.length ? nouns : WORDS;
  const day = Math.floor(Date.now() / 86400000);
  const entry = source[day % source.length];

  wvdWord.textContent = entry.w;
  wvdMv.textContent = entry.mv ? `→ ${entry.mv}` : '';
  wvdEl.dataset.word = entry.w;
}

function highlight(word, q, mode) {
  if (!q) return escHtml(word);
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let re;
  if (mode === 'begint') re = new RegExp(`^(${safe})`, 'i');
  else if (mode === 'eindigt') re = new RegExp(`(${safe})$`, 'i');
  else re = new RegExp(`(${safe})`, 'gi');
  return escHtml(word).replace(re, '<mark>$1</mark>');
}

function matches(word, q, mode) {
  if (!q) return true;
  const w = word.toLowerCase();
  const s = q.toLowerCase();
  if (mode === 'begint') return w.startsWith(s);
  if (mode === 'eindigt') return w.endsWith(s);
  return w.includes(s);
}

function getFilteredWords() {
  const q = searchInput.value.trim();
  const onlyWithPlural = onlyPlural.checked;

  const filtered = WORDS.filter(e => {
    const byLetter = !activeLetter || e.w[0].toUpperCase() === activeLetter;
    const byQuery = matches(e.w, q, activeMode);
    const byPlural = !onlyWithPlural || !!e.mv;
    return byLetter && byQuery && byPlural;
  });

  filtered.sort((a, b) => {
    const dir = sortSelect.value === 'za' ? -1 : 1;
    return dir * a.w.localeCompare(b.w, 'nl');
  });

  return filtered;
}

function renderGridChunked(wordsToShow, q) {
  grid.innerHTML = '';

  if (!wordsToShow.length) return;

  let i = 0;
  const paint = () => {
    const frag = document.createDocumentFragment();
    const end = Math.min(i + CHUNK_SIZE, wordsToShow.length);

    for (; i < end; i++) {
      const e = wordsToShow[i];
      const item = document.createElement('span');
      item.className = 'word-item';

      const left = document.createElement('span');
      left.innerHTML = highlight(e.w, q, activeMode);

      item.appendChild(left);

      if (e.mv) {
        const right = document.createElement('span');
        right.className = 'mv';
        right.textContent = e.mv;
        item.appendChild(right);
      }

      frag.appendChild(item);
    }

    grid.appendChild(frag);

    if (i < wordsToShow.length) {
      requestAnimationFrame(paint);
    }
  };

  requestAnimationFrame(paint);
}

function render() {
  const q = searchInput.value.trim();
  const filtered = getFilteredWords();
  const shown = filtered.slice(0, displayLimit);

  countEl.textContent = filtered.length.toLocaleString('nl-NL');

  const hasNonDefaultMode = activeMode !== 'begint';
  const hasFilters = q || activeLetter || onlyPlural.checked || sortSelect.value !== 'az' || hasNonDefaultMode;
  resetBtn.style.display = hasFilters ? 'inline' : 'none';

  emptyEl.style.display = filtered.length === 0 ? 'block' : 'none';
  grid.style.display = filtered.length === 0 ? 'none' : 'block';
  emptyQuery.textContent = q || activeLetter || 'huidige filters';

  renderGridChunked(shown, q);

  const remaining = filtered.length - shown.length;
  if (remaining > 0) {
    loadMoreBtn.style.display = 'block';
    loadMoreBtn.textContent = `Laad meer (${remaining.toLocaleString('nl-NL')} over)`;
  } else {
    loadMoreBtn.style.display = 'none';
  }

  saveState();
}

function resetAllFilters() {
  searchInput.value = '';
  activeLetter = null;
  activeMode = 'begint';
  sortSelect.value = 'az';
  onlyPlural.checked = false;
  displayLimit = INITIAL_LIMIT;
  updateModeButtons();
  updateLetterButtons();
  localStorage.removeItem(STORAGE_KEY);
  render();
}

function attachEvents() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeMode = btn.dataset.mode;
      displayLimit = INITIAL_LIMIT;
      updateModeButtons();
      render();
    });
  });

  searchInput.addEventListener('input', debounce(() => {
    if (searchInput.value) {
      activeLetter = null;
      updateLetterButtons();
    }
    displayLimit = INITIAL_LIMIT;
    render();
  }));

  sortSelect.addEventListener('change', () => {
    displayLimit = INITIAL_LIMIT;
    render();
  });

  onlyPlural.addEventListener('change', () => {
    displayLimit = INITIAL_LIMIT;
    render();
  });

  resetBtn.addEventListener('click', resetAllFilters);

  loadMoreBtn.addEventListener('click', () => {
    displayLimit += LOAD_INCREMENT;
    render();
  });

  const applyWvd = () => {
    const word = wvdEl.dataset.word;
    if (!word) return;
    searchInput.value = word;
    activeLetter = null;
    displayLimit = INITIAL_LIMIT;
    updateLetterButtons();
    render();
  };

  wvdEl.addEventListener('click', applyWvd);
  wvdEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      applyWvd();
    }
  });
}

function formatUpdatedDate(lastModified) {
  if (!lastModified) return 'onbekend';
  const d = new Date(lastModified);
  if (Number.isNaN(d.getTime())) return 'onbekend';
  return d.toLocaleDateString('nl-NL');
}

async function init() {
  loadState();
  updateModeButtons();
  attachEvents();

  try {
    const response = await fetch('words.json');
    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('words.json bevat geen array.');
    }

    WORDS = data
      .filter(e => e && typeof e.w === 'string' && e.w.trim() && (e.mv === undefined || typeof e.mv === 'string'))
      .map(e => ({
        w: e.w.trim(),
        ...(e.mv && e.mv.trim() ? { mv: e.mv.trim() } : {})
      }));

    if (!WORDS.length) {
      throw new Error('Geen geldige woorden gevonden in words.json.');
    }

    totalCount.textContent = WORDS.length.toLocaleString('nl-NL');
    wordsUpdated.textContent = formatUpdatedDate(response.headers.get('last-modified'));

    buildLetterButtons();
    showWordVanDeDag();
    render();
  } catch (err) {
    grid.innerHTML = `<p style="color:#c62828;padding:1rem">${escHtml(err?.message || 'Kon words.json niet laden.')}</p>`;
    grid.style.display = 'block';
    emptyEl.style.display = 'none';
    loadMoreBtn.style.display = 'none';
  }
}

init();
