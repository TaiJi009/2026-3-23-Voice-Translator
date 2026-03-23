const STORAGE_KEYS = {
  THEME: 'vt_theme',
  MESSAGES: 'vt_messages',
  LANG_MINE: 'vt_lang_mine',
  LANG_THEIRS: 'vt_lang_theirs',
};

export function getStoredTheme() {
  const v = localStorage.getItem(STORAGE_KEYS.THEME);
  if (v === 'light' || v === 'dark') return v;
  return null;
}

export function setStoredTheme(theme) {
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

export function getMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveMessages(messages) {
  localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
}

export function getLangMine() {
  return localStorage.getItem(STORAGE_KEYS.LANG_MINE) || 'zh';
}

export function getLangTheirs() {
  return localStorage.getItem(STORAGE_KEYS.LANG_THEIRS) || 'en';
}

export function setLangMine(code) {
  localStorage.setItem(STORAGE_KEYS.LANG_MINE, code);
}

export function setLangTheirs(code) {
  localStorage.setItem(STORAGE_KEYS.LANG_THEIRS, code);
}
