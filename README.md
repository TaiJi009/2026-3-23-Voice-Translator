# Voice Translator 

React + Vite 单页应用：Web Speech API 识别 → 智谱 GLM-4-Flash 翻译 → 浏览器朗读。构建产物可部署到 GitHub Pages。

## 开发

```bash
npm install
npm run dev
```

使用 **HTTPS** 或 **http://localhost** 打开（麦克风权限要求）。

## 环境变量

复制 `.env.example` 为 `.env`，填写：·

```env
VITE_ZHIPU_API_KEY=你的智谱Key
```

或在浏览器控制台：

```js
localStorage.setItem('zhipu_api_key', '你的key');
location.reload();
```

## 构建与预览

```bash
npm run build
npm run preview
```

静态资源输出在 `dist/`。GitHub Pages 请将站点根目录指向 **`dist`**（见下）。

## GitHub Pages

本仓库为 **Vite 项目**，不能直接把源码根目录当 Pages 根目录，需要发布 **构建结果**：

1. 仓库已含工作流 `.github/workflows/pages.yml`：在 **Settings → Pages** 中将 Source 设为 **GitHub Actions**，推送 `main`/`master` 即会构建并部署 `dist/`。
2. 也可本地执行 `npm run build` 后，自行将 `dist` 内容发布到 `gh-pages` 分支或其它静态托管。

可选：在仓库 **Settings → Secrets** 添加 `VITE_ZHIPU_API_KEY`，供 CI 构建注入（公开仓库仍建议用 BFF，勿长期依赖 Secret 里的 Key 暴露在构建日志风险）。

子路径部署（`https://用户名.github.io/仓库名/`）时，在 `vite.config.js` 里把 `base` 改为 `'/仓库名/'` 后再构建。

## 跨域（CORS）

若浏览器直连智谱被拦截，需通过 **Worker / Serverless** 做 BFF，勿把密钥提交到公开仓库。

## 浏览器

语音识别推荐 **Chrome / Edge**；Firefox 无 Web Speech 识别，页面提供文字输入降级。
