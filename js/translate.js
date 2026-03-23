const LANG_NAMES = {
  zh: '中文',
  en: '英文',
  ja: '日文',
  ko: '韩文',
  fr: '法文',
  es: '西班牙文',
};

const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

function getApiKey() {
  const fromLs = localStorage.getItem('zhipu_api_key');
  if (fromLs) return fromLs.trim();
  const cfg = window.__VT_CONFIG__?.ZHIPU_API_KEY;
  return (cfg && String(cfg).trim()) || '';
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
