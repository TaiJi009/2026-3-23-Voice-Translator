const LANG_NAMES = {
  zh: '中文',
  en: '英文',
  ja: '日文',
  ko: '韩文',
  fr: '法文',
  es: '西班牙文',
};

const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

/** 内置默认 Key；可被 localStorage「zhipu_api_key」或 .env 的 VITE_ZHIPU_API_KEY 覆盖 */
const BUILTIN_ZHIPU_API_KEY = 'fafadd6a79f04fa6929d0866016d5a29.8MBngArmXxck7CAH';

function getApiKey() {
  const fromLs = localStorage.getItem('zhipu_api_key');
  if (fromLs) return fromLs.trim();
  const env = import.meta.env.VITE_ZHIPU_API_KEY;
  if (env && String(env).trim()) return String(env).trim();
  if (typeof window !== 'undefined' && window.__VT_CONFIG__?.ZHIPU_API_KEY) {
    return String(window.__VT_CONFIG__.ZHIPU_API_KEY).trim();
  }
  return BUILTIN_ZHIPU_API_KEY;
}

export function hasApiKey() {
  return Boolean(getApiKey());
}

export async function translateText(text, sourceCode, targetCode) {
  const key = getApiKey();
  if (!key) {
    throw new Error('NO_API_KEY');
  }
  const from = LANG_NAMES[sourceCode] || sourceCode;
  const to = LANG_NAMES[targetCode] || targetCode;
  const prompt = `请将以下${from}文本翻译为${to}，只返回译文，不要解释、不要引号、不要前缀：\n${text}`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API_${res.status}:${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('EMPTY_RESPONSE');
  }
  return content.trim();
}
