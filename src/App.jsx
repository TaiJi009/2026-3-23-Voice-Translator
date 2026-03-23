import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatBubble } from './components/ChatBubble.jsx';
import {
  getStoredTheme,
  setStoredTheme,
  getMessages,
  saveMessages,
  getLangMine,
  getLangTheirs,
  setLangMine,
  setLangTheirs,
} from './lib/storage.js';
import { translateText, hasApiKey } from './lib/translate.js';
import {
  isSpeechRecognitionSupported,
  createRecognition,
  speak,
  stopSpeaking,
} from './lib/speech.js';

const LANGS = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
];

function resolveInitialTheme() {
  const stored = getStoredTheme();
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function translateErrorMessage(err) {
  if (err?.message === 'NO_API_KEY') {
    return '请配置智谱 API Key（.env 的 VITE_ZHIPU_API_KEY 或 localStorage）';
  }
  if (String(err?.message || err).includes('Failed to fetch')) {
    return '网络异常：若跨域被拦截，请用支持 CORS 的代理或本地调试';
  }
  return '翻译失败，请稍后重试';
}

function MicIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export default function App() {
  const [theme, setTheme] = useState(resolveInitialTheme);
  const [langMine, setLangMineState] = useState(getLangMine);
  const [langTheirs, setLangTheirsState] = useState(getLangTheirs);
  const [speaker, setSpeaker] = useState('me');
  const [messages, setMessages] = useState(getMessages);
  const [micUi, setMicUi] = useState('idle');
  const [dockHint, setDockHint] = useState('点击麦克风说话，再次点击结束');
  const [toast, setToast] = useState({ text: '', visible: false });
  const [fsOpen, setFsOpen] = useState(false);
  const [fsText, setFsText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [retranslatingId, setRetranslatingId] = useState(null);
  const [firefoxText, setFirefoxText] = useState('');

  const chatRef = useRef(null);
  const recognitionRef = useRef(null);
  const accumulatedFinalRef = useRef('');
  const skipRecognitionOnEndRef = useRef(false);
  const convRef = useRef({ langMine, langTheirs, speaker });
  const micUiRef = useRef(micUi);
  const toastTimerRef = useRef(null);

  convRef.current = { langMine, langTheirs, speaker };
  micUiRef.current = micUi;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => {
      if (!getStoredTheme()) setTheme(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setFsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const showToast = useCallback((text, ms = 2000) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ text, visible: true });
    toastTimerRef.current = window.setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, ms);
  }, []);

  const runPipeline = useCallback(
    async (originalText) => {
      const text = originalText.trim();
      if (!text) {
        showToast('没有检测到有效内容');
        setMicUi('idle');
        return;
      }
      if (!hasApiKey()) {
        showToast('请先填写智谱 API Key');
        setMicUi('idle');
        return;
      }
      const { langMine: mine, langTheirs: theirs, speaker: sp } = convRef.current;
      const source = sp === 'me' ? mine : theirs;
      const target = sp === 'me' ? theirs : mine;
      setMicUi('busy');
      try {
        const translated = await translateText(text, source, target);
        const msg = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          role: sp === 'me' ? 'me' : 'them',
          sourceLang: source,
          targetLang: target,
          original: text,
          translated,
        };
        setMessages((prev) => {
          const next = [...prev, msg];
          saveMessages(next);
          return next;
        });
        await speak(translated, target);
      } catch (e) {
        showToast(translateErrorMessage(e), 3500);
      } finally {
        setMicUi('idle');
      }
    },
    [showToast],
  );

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setStoredTheme(next);
    setTheme(next);
  };

  const persistMine = (v) => {
    setLangMineState(v);
    setLangMine(v);
  };

  const persistTheirs = (v) => {
    setLangTheirsState(v);
    setLangTheirs(v);
  };

  const swapLanguages = () => {
    const a = langMine;
    persistMine(langTheirs);
    persistTheirs(a);
  };

  const clearHistory = () => {
    if (!messages.length) return;
    if (!window.confirm('确定清空全部对话记录？')) return;
    setMessages([]);
    saveMessages([]);
  };

  const stopRecognition = () => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
  };

  const startRecognition = useCallback(() => {
    if (!hasApiKey()) {
      showToast('请先填写智谱 API Key');
      return;
    }
    const { langMine: mine, langTheirs: theirs, speaker: sp } = convRef.current;
    const source = sp === 'me' ? mine : theirs;
    const rec = createRecognition(source);
    if (!rec) return;
    recognitionRef.current = rec;
    accumulatedFinalRef.current = '';
    setMicUi('listening');
    setDockHint('正在聆听…');

    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const r = ev.results[i];
        if (r.isFinal) accumulatedFinalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      const preview = `${accumulatedFinalRef.current}${interim}`.trim();
      setDockHint(preview ? `正在聆听：${preview}` : '正在聆听…');
    };

    rec.onerror = (ev) => {
      accumulatedFinalRef.current = '';
      if (ev.error === 'aborted') return;
      skipRecognitionOnEndRef.current = true;
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        showToast('请允许麦克风权限后重试', 3000);
      } else if (ev.error === 'no-speech') {
        showToast('没有检测到声音，请重试', 2500);
      } else {
        showToast(`语音识别错误：${ev.error}`, 3000);
      }
      setMicUi('idle');
    };

    rec.onend = () => {
      if (skipRecognitionOnEndRef.current) {
        skipRecognitionOnEndRef.current = false;
        return;
      }
      if (micUiRef.current !== 'listening') return;
      const t = accumulatedFinalRef.current.trim();
      accumulatedFinalRef.current = '';
      if (t) {
        runPipeline(t);
      } else {
        showToast('没有检测到有效内容', 2200);
        setMicUi('idle');
      }
    };

    try {
      rec.start();
    } catch {
      showToast('无法启动语音识别');
      setMicUi('idle');
    }
  }, [showToast, runPipeline]);

  const onMicClick = () => {
    if (micUi === 'busy') return;
    if (micUi === 'listening') {
      stopRecognition();
      return;
    }
    stopSpeaking();
    startRecognition();
  };

  const onFirefoxSubmit = (e) => {
    e.preventDefault();
    const t = firefoxText.trim();
    if (!t) return;
    setFirefoxText('');
    runPipeline(t);
  };

  const handleRetranslate = async (id, newOriginal) => {
    const text = newOriginal.trim();
    if (!text) {
      showToast('请输入原文');
      return;
    }
    const m = messages.find((x) => x.id === id);
    if (!m) return;
    setRetranslatingId(id);
    try {
      const t = await translateText(text, m.sourceLang, m.targetLang);
      setMessages((prev) => {
        const next = prev.map((x) => (x.id === id ? { ...x, original: text, translated: t } : x));
        saveMessages(next);
        return next;
      });
      setEditingId(null);
      await speak(t, m.targetLang);
    } catch (err) {
      showToast(translateErrorMessage(err), 3000);
    } finally {
      setRetranslatingId(null);
    }
  };

  const speechOk = isSpeechRecognitionSupported();

  useEffect(() => {
    if (!speechOk) {
      setDockHint('当前浏览器不支持语音识别，请输入文字后翻译');
    }
  }, [speechOk]);

  useEffect(() => {
    if (micUi === 'idle' && speechOk) {
      setDockHint('点击麦克风说话，再次点击结束');
    }
  }, [micUi, speechOk]);

  const copyText = async (t) => {
    try {
      await navigator.clipboard.writeText(t);
      showToast('已复制', 1500);
    } catch {
      showToast('复制失败', 2000);
    }
  };

  const themeIcon = theme === 'dark' ? '☀️' : '🌙';
  const themeLabel = theme === 'dark' ? '切换到日间模式' : '切换到夜间模式';

  let micContent;
  let micAria;
  if (micUi === 'listening') {
    micContent = (
      <>
        <span className="mic-pulse" aria-hidden />
        <span className="sr-only">停止录音</span>
        <StopIcon />
      </>
    );
    micAria = '点击结束说话';
  } else if (micUi === 'busy') {
    micContent = (
      <>
        <span className="mic-spinner" aria-hidden />
        <span className="sr-only">处理中</span>
      </>
    );
    micAria = '处理中';
  } else {
    micContent = (
      <>
        <span className="sr-only">开始说话</span>
        <MicIcon />
      </>
    );
    micAria = '点击开始说话';
  }

  return (
    <>
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header__brand">
            <span aria-hidden>🌐</span>
            <span>Voice Translator</span>
          </div>
          <div className="app-header__actions">
            <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={themeLabel}>
              {themeIcon}
            </button>
            <button type="button" className="icon-btn" onClick={clearHistory} aria-label="清空对话记录">
              🗑️
            </button>
          </div>
        </header>

        <div className="lang-bar">
          <div className="lang-pill">
            <label className="sr-only" htmlFor="langMine">
              我的语言
            </label>
            <select
              id="langMine"
              className="lang-select"
              value={langMine}
              onChange={(e) => persistMine(e.target.value)}
              aria-label="我的语言"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="swap-btn" onClick={swapLanguages} aria-label="交换两种语言" title="交换语言">
            ⇄
          </button>
          <div className="lang-pill">
            <label className="sr-only" htmlFor="langTheirs">
              对方的语言
            </label>
            <select
              id="langTheirs"
              className="lang-select"
              value={langTheirs}
              onChange={(e) => persistTheirs(e.target.value)}
              aria-label="对方的语言"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="speaker-seg" role="group" aria-label="当前说话人">
          <button type="button" aria-pressed={speaker === 'me'} onClick={() => setSpeaker('me')}>
            我说
          </button>
          <button type="button" aria-pressed={speaker === 'them'} onClick={() => setSpeaker('them')}>
            对方说
          </button>
        </div>

        <div className={`api-banner ${hasApiKey() ? 'is-hidden' : ''}`} role="status">
          请在项目根目录复制 <code>.env.example</code> 为 <code>.env</code> 并填写 <code>VITE_ZHIPU_API_KEY</code>
          ，或在控制台执行：
          <code> localStorage.setItem(&apos;zhipu_api_key&apos;,&apos;你的key&apos;)</code> 后刷新。
        </div>

        <main ref={chatRef} className="chat-scroll" aria-live="polite">
          {messages.length === 0 ? (
            <p className="chat-empty">暂无对话，选好语言后点击麦克风开始</p>
          ) : (
            messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                msg={msg}
                editing={editingId === msg.id}
                retranslating={retranslatingId === msg.id}
                onStartEdit={() => setEditingId(msg.id)}
                onRetranslate={(draft) => handleRetranslate(msg.id, draft)}
                onSpeak={() => speak(msg.translated, msg.targetLang)}
                onCopy={() => copyText(msg.translated)}
                onFullscreen={() => {
                  setFsText(msg.translated);
                  setFsOpen(true);
                }}
                onTranslatedClick={() => {
                  setFsText(msg.translated);
                  setFsOpen(true);
                }}
              />
            ))
          )}
        </main>

        <p className="footer-note">
          语音识别可能由浏览器/系统服务商处理；对话记录仅保存在本机浏览器。使用需 HTTPS 或 localhost。
        </p>

        <div className="dock">
          <div className={`dock__firefox ${speechOk ? '' : 'is-visible'}`}>
            <form onSubmit={onFirefoxSubmit}>
              <label className="sr-only" htmlFor="firefoxText">
                输入要说的内容
              </label>
              <textarea
                id="firefoxText"
                value={firefoxText}
                onChange={(e) => setFirefoxText(e.target.value)}
                placeholder="当前浏览器不支持语音，请在此输入原文后提交翻译"
                enterKeyHint="send"
              />
              <button type="submit">翻译</button>
            </form>
          </div>
          <p className="dock__hint">{dockHint}</p>
          <div className={`mic-wrap ${speechOk ? '' : 'is-hidden'}`}>
            <button
              type="button"
              className={`mic-btn ${micUi === 'listening' ? 'mic-btn--recording' : ''} ${micUi === 'busy' ? 'mic-btn--busy' : ''}`}
              onClick={onMicClick}
              disabled={micUi === 'busy'}
              aria-label={micAria}
            >
              {micContent}
            </button>
          </div>
        </div>
      </div>

      <div className={`toast ${toast.visible ? 'is-visible' : ''}`} role="status">
        {toast.text}
      </div>

      <div
        className={`fs-overlay ${fsOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!fsOpen}
        aria-label="全屏译文，点击关闭"
        onClick={() => setFsOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setFsOpen(false)}
      >
        <p className="fs-overlay__text">{fsText}</p>
        <span className="fs-overlay__hint">点击任意处或按 Esc 关闭</span>
      </div>
    </>
  );
}
