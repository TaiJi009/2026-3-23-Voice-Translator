import {
  getStoredTheme,
  setStoredTheme,
  getMessages,
  saveMessages,
  getLangMine,
  getLangTheirs,
  setLangMine,
  setLangTheirs,
} from './storage.js';
import { translateText, hasApiKey } from './translate.js';
import {
  isSpeechRecognitionSupported,
  createRecognition,
  speak,
  stopSpeaking,
} from './speech.js';

const LANGS = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
];

let messages = [];
let speaker = 'me';
let recognition = null;
let uiState = 'idle';
let accumulatedFinal = '';
let skipRecognitionOnEnd = false;

const els = {};

function $(id) {
  return document.getElementById(id);
}

function initEls() {
  els.themeToggle = $('themeToggle');
  els.clearBtn = $('clearBtn');
  els.langMine = $('langMine');
  els.langTheirs = $('langTheirs');
  els.swapLang = $('swapLang');
  els.speakerMe = $('speakerMe');
  els.speakerThem = $('speakerThem');
  els.chatList = $('chatList');
  els.micBtn = $('micBtn');
  els.micWrap = $('micWrap');
  els.dockHint = $('dockHint');
  els.toast = $('toast');
  els.fsOverlay = $('fsOverlay');
  els.fsText = $('fsText');
  els.apiBanner = $('apiBanner');
  els.firefoxBox = $('firefoxBox');
  els.firefoxText = $('firefoxText');
  els.firefoxForm = $('firefoxForm');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  els.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  els.themeToggle.setAttribute('aria-label', theme === 'dark' ? '切换到日间模式' : '切换到夜间模式');
}

function resolveInitialTheme() {
  const stored = getStoredTheme();
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  const next = cur === 'dark' ? 'light' : 'dark';
  setStoredTheme(next);
  applyTheme(next);
}

function fillLangSelects() {
  [els.langMine, els.langTheirs].forEach((sel) => {
    sel.innerHTML = '';
    LANGS.forEach((l) => {
      const o = document.createElement('option');
      o.value = l.code;
      o.textContent = l.label;
      sel.appendChild(o);
    });
  });
  els.langMine.value = getLangMine();
  els.langTheirs.value = getLangTheirs();
}

function persistLangs() {
  setLangMine(els.langMine.value);
  setLangTheirs(els.langTheirs.value);
}

function swapLanguages() {
  const a = els.langMine.value;
  els.langMine.value = els.langTheirs.value;
  els.langTheirs.value = a;
  persistLangs();
}

function getSourceTarget() {
  const mine = els.langMine.value;
  const theirs = els.langTheirs.value;
  if (speaker === 'me') return { source: mine, target: theirs };
  return { source: theirs, target: mine };
}

function setSpeaker(who) {
  speaker = who;
  els.speakerMe.setAttribute('aria-pressed', who === 'me' ? 'true' : 'false');
  els.speakerThem.setAttribute('aria-pressed', who === 'them' ? 'true' : 'false');
}

function showToast(text, ms = 2000) {
  els.toast.textContent = text;
  els.toast.classList.add('is-visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.remove('is-visible'), ms);
}

function setUiState(state) {
  uiState = state;
  const mic = els.micBtn;
  mic.classList.remove('mic-btn--recording', 'mic-btn--busy');
  mic.disabled = false;
  mic.innerHTML = '';

  if (state === 'idle') {
    mic.innerHTML =
      '<span class="sr-only">开始说话</span><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
    mic.setAttribute('aria-label', '点击开始说话');
    els.dockHint.textContent = '点击麦克风说话，再次点击结束';
  } else if (state === 'listening') {
    mic.classList.add('mic-btn--recording');
    mic.innerHTML =
      '<span class="mic-pulse" aria-hidden="true"></span><span class="sr-only">停止录音</span><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
    mic.setAttribute('aria-label', '点击结束说话');
    els.dockHint.textContent = '正在聆听…';
  } else if (state === 'busy') {
    mic.classList.add('mic-btn--busy');
    mic.disabled = true;
    mic.innerHTML = '<span class="mic-spinner" aria-hidden="true"></span><span class="sr-only">处理中</span>';
    mic.setAttribute('aria-label', '处理中');
    els.dockHint.textContent = '识别或翻译中…';
  }
}

function renderMessages() {
  if (!messages.length) {
    els.chatList.innerHTML = '<p class="chat-empty">暂无对话，选好语言后点击麦克风开始</p>';
    return;
  }
  els.chatList.innerHTML = '';
  messages.forEach((m) => {
    const row = document.createElement('div');
    row.className = `msg-row ${m.role === 'me' ? 'msg-row--me' : 'msg-row--them'}`;
    row.dataset.id = m.id;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.dataset.id = m.id;

    const orig = document.createElement('div');
    orig.className = 'bubble__original';
    orig.textContent = m.original;

    const ta = document.createElement('textarea');
    ta.className = 'bubble__edit';
    ta.value = m.original;
    ta.setAttribute('aria-label', '编辑原文');

    const div = document.createElement('div');
    div.className = 'bubble__divider';

    const trans = document.createElement('div');
    trans.className = 'bubble__translated';
    trans.textContent = m.translated;
    trans.title = '点击全屏显示译文';

    const actions = document.createElement('div');
    actions.className = 'bubble__actions';

    const btnSpeak = document.createElement('button');
    btnSpeak.type = 'button';
    btnSpeak.textContent = '🔊';
    btnSpeak.setAttribute('aria-label', '朗读译文');
    btnSpeak.addEventListener('click', (e) => {
      e.stopPropagation();
      speak(m.translated, m.targetLang);
    });

    const btnCopy = document.createElement('button');
    btnCopy.type = 'button';
    btnCopy.textContent = '📋';
    btnCopy.setAttribute('aria-label', '复制译文');
    btnCopy.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(m.translated);
        showToast('已复制', 1500);
      } catch {
        showToast('复制失败', 2000);
      }
    });

    const btnFs = document.createElement('button');
    btnFs.type = 'button';
    btnFs.textContent = '⛶';
    btnFs.setAttribute('aria-label', '全屏显示译文');
    btnFs.addEventListener('click', (e) => {
      e.stopPropagation();
      openFullscreen(m.translated);
    });

    const btnEdit = document.createElement('button');
    btnEdit.type = 'button';
    btnEdit.textContent = '✏️';
    btnEdit.setAttribute('aria-label', '编辑原文并重译');
    btnEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      bubble.classList.add('bubble--editing');
      ta.focus();
    });

    const btnRetrans = document.createElement('button');
    btnRetrans.type = 'button';
    btnRetrans.className = 'bubble__retranslate';
    btnRetrans.textContent = '重新翻译';
    btnRetrans.addEventListener('click', async (e) => {
      e.stopPropagation();
      const text = ta.value.trim();
      if (!text) {
        showToast('请输入原文');
        return;
      }
      btnRetrans.disabled = true;
      try {
        const t = await translateText(text, m.sourceLang, m.targetLang);
        m.original = text;
        m.translated = t;
        orig.textContent = text;
        trans.textContent = t;
        bubble.classList.remove('bubble--editing');
        saveMessages(messages);
        await speak(t, m.targetLang);
      } catch (err) {
        showToast(translateErrorMessage(err), 3000);
      } finally {
        btnRetrans.disabled = false;
      }
    });

    trans.addEventListener('click', () => openFullscreen(m.translated));

    actions.append(btnSpeak, btnCopy, btnFs, btnEdit);
    bubble.append(orig, ta, div, trans, actions, btnRetrans);
    row.appendChild(bubble);
    els.chatList.appendChild(row);
  });
  els.chatList.scrollTop = els.chatList.scrollHeight;
}

function translateErrorMessage(err) {
  if (err?.message === 'NO_API_KEY') return '请配置智谱 API Key（js/config.js 或 localStorage）';
  if (String(err?.message || err).includes('Failed to fetch')) {
    return '网络异常：若跨域被拦截，请用支持 CORS 的代理或本地调试';
  }
  return '翻译失败，请稍后重试';
}

async function runPipeline(originalText) {
  const text = originalText.trim();
  if (!text) {
    showToast('没有检测到有效内容');
    setUiState('idle');
    return;
  }
  if (!hasApiKey()) {
    showToast('请先填写智谱 API Key');
    setUiState('idle');
    return;
  }
  const { source, target } = getSourceTarget();
  setUiState('busy');
  try {
    const translated = await translateText(text, source, target);
    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      role: speaker === 'me' ? 'me' : 'them',
      sourceLang: source,
      targetLang: target,
      original: text,
      translated,
    };
    messages.push(msg);
    saveMessages(messages);
    renderMessages();
    await speak(translated, target);
  } catch (e) {
    showToast(translateErrorMessage(e), 3500);
  } finally {
    setUiState('idle');
  }
}

function stopRecognition() {
  if (recognition) {
    try {
      recognition.stop();
    } catch {
      /* ignore */
    }
  }
}

function startRecognition() {
  if (!hasApiKey()) {
    showToast('请先填写智谱 API Key');
    return;
  }
  const { source } = getSourceTarget();
  recognition = createRecognition(source);
  if (!recognition) return;

  accumulatedFinal = '';
  setUiState('listening');

  recognition.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
      const r = ev.results[i];
      if (r.isFinal) accumulatedFinal += r[0].transcript;
      else interim += r[0].transcript;
    }
    const preview = `${accumulatedFinal}${interim}`.trim();
    els.dockHint.textContent = preview ? `正在聆听：${preview}` : '正在聆听…';
  };

  recognition.onerror = (ev) => {
    accumulatedFinal = '';
    if (ev.error === 'aborted') {
      return;
    }
    skipRecognitionOnEnd = true;
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
      showToast('请允许麦克风权限后重试', 3000);
    } else if (ev.error === 'no-speech') {
      showToast('没有检测到声音，请重试', 2500);
    } else {
      showToast(`语音识别错误：${ev.error}`, 3000);
    }
    setUiState('idle');
  };

  recognition.onend = () => {
    if (skipRecognitionOnEnd) {
      skipRecognitionOnEnd = false;
      return;
    }
    if (uiState !== 'listening') return;
    const text = accumulatedFinal.trim();
    accumulatedFinal = '';
    if (text) {
      runPipeline(text);
    } else {
      showToast('没有检测到有效内容', 2200);
      setUiState('idle');
    }
  };

  try {
    recognition.start();
  } catch {
    showToast('无法启动语音识别');
    setUiState('idle');
  }
}

function onMicClick() {
  if (uiState === 'busy') return;
  if (uiState === 'listening') {
    stopRecognition();
    return;
  }
  stopSpeaking();
  startRecognition();
}

function openFullscreen(text) {
  els.fsText.textContent = text;
  els.fsOverlay.classList.add('is-open');
  els.fsOverlay.setAttribute('aria-hidden', 'false');
}

function closeFullscreen() {
  els.fsOverlay.classList.remove('is-open');
  els.fsOverlay.setAttribute('aria-hidden', 'true');
}

function clearHistory() {
  if (!messages.length) return;
  if (!window.confirm('确定清空全部对话记录？')) return;
  messages = [];
  saveMessages(messages);
  renderMessages();
}

function updateApiBanner() {
  els.apiBanner.classList.toggle('is-hidden', hasApiKey());
}

function onFirefoxSubmit(e) {
  e.preventDefault();
  const t = els.firefoxText.value.trim();
  if (!t) return;
  els.firefoxText.value = '';
  runPipeline(t);
}

function main() {
  initEls();
  fillLangSelects();
  messages = getMessages();
  applyTheme(resolveInitialTheme());

  if (!isSpeechRecognitionSupported()) {
    els.micWrap.classList.add('is-hidden');
    els.firefoxBox.classList.add('is-visible');
    els.dockHint.textContent = '当前浏览器不支持语音识别，请输入文字后翻译';
  }

  updateApiBanner();
  renderMessages();

  els.themeToggle.addEventListener('click', toggleTheme);
  els.clearBtn.addEventListener('click', clearHistory);
  els.langMine.addEventListener('change', persistLangs);
  els.langTheirs.addEventListener('change', persistLangs);
  els.swapLang.addEventListener('click', swapLanguages);
  els.speakerMe.addEventListener('click', () => setSpeaker('me'));
  els.speakerThem.addEventListener('click', () => setSpeaker('them'));
  els.micBtn.addEventListener('click', onMicClick);
  els.fsOverlay.addEventListener('click', closeFullscreen);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFullscreen();
  });
  els.firefoxForm.addEventListener('submit', onFirefoxSubmit);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!getStoredTheme()) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  setUiState('idle');
}

main();
