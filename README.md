# Voice Translator

纯前端语音翻译页：Web Speech API 识别 → 智谱 GLM-4-Flash 翻译 → 浏览器朗读。可部署到 GitHub Pages。

## 本地运行

需通过 **HTTPS** 或 **http://localhost** 打开（麦克风权限要求）。

```bash
# 任选其一
npx --yes serve .
python -m http.server 8080
```

浏览器访问提示的本地地址，在 `js/config.js` 中填入 `ZHIPU_API_KEY`，或使用：

```js
localStorage.setItem('zhipu_api_key', '你的智谱APIKey');
location.reload();
```

## GitHub Pages

仓库 **Settings → Pages**：Source 选分支与 `/ (root)`，保存后使用站点地址访问。

若仓库为 Project Pages（地址形如 `https://用户名.github.io/仓库名/`），本仓库内相对路径无需修改。

## 关于跨域（CORS）

若浏览器控制台出现跨域拦截，说明智谱接口未对该站点放行，需自行增加**后端或边缘代理**转发请求，勿将密钥提交到公开仓库。

## 浏览器

语音识别推荐 **Chrome / Edge**；Firefox 不支持 Web Speech 识别，页面会显示文字输入框作为降级。
