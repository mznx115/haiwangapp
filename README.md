# 海王 · AI 社交聊天助手

把 [zhuangzzy/haiwang.skill](https://github.com/zhuangzzy/haiwang.skill) 做成一个可安装的 Android App：
调用自定义 OpenAI 兼容 API 时，按六层结构自动注入该技能包，并提供多对象档案隔离、会话管理与话术卡片。

> 技能的立场：**提升社交能力、学会真诚沟通、把握社交分寸**，而非教用户玩弄感情。反对欺骗、PUA、伤害他人。

---

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Vue 3.5 + TypeScript + Vite 8 + Pinia 4 + vue-router 5 |
| 样式 | Tailwind CSS 4（`@theme` 定义微信风配色） |
| 壳 | Capacitor 8 → Android |
| 构建 | GitHub Actions 云端产出 APK（本机无需 JDK / Android SDK） |
| 存储 | M0–M3：localStorage；M4：Capacitor SQLite + Android Keystore |

## 目录结构

```
src/
├─ skills/haiwang/        # 技能包原文（离线内联）
│   ├─ SKILL.md           # L1 角色层
│   ├─ knowledge.md       # L2 知识层
│   ├─ prompt.txt         # L6 任务指令
│   └─ skill.json         # 元数据
├─ skills/index.ts        # 技能加载器（?raw 内联）
├─ core/                  # 关系阶段常量等核心逻辑
├─ stores/                # Pinia：profiles / settings（chat 待建）
├─ types/                 # 全局类型
├─ components/            # NavBar / TabBar …
└─ views/                 # 对象 / 会话 / 话术库 / 我 / 设置 / 技能包

build/
└─ vite-plugin-legacy-css.ts   # 展平 @layer + 内联 CSS（老 WebView 兼容）

scripts/
├─ check-css-compat.mjs        # 产物 CSS 兼容性自检
├─ verify-apk-signature.py     # 不依赖 JDK 的 APK 签名校验
└─ gen-icons.py                # 图标 / 启动图生成
```

## 开发

```bash
pnpm install
pnpm dev          # 浏览器打开 http://localhost:5173
pnpm build        # 产物在 dist/
pnpm typecheck    # 类型检查
pnpm verify:css   # 检查构建产物里有没有老 WebView 不支持的 CSS
```

## 下载安装（Android）

**免登录永久直链**，手机浏览器打开即下：

```
https://github.com/mznx115/haiwangapp/releases/download/build-latest/haiwang.apk
```

或打开 [Releases 页面](https://github.com/mznx115/haiwangapp/releases/latest)，
在 Assets 里点 `haiwang.apk`。

安装时系统会拦一下，需要在「设置 → 应用 → 特殊权限 → 安装未知应用」里
允许你的浏览器。当前是 **release 正式签名包**，可以直接覆盖安装升级（详见「Release 签名」）。

> 如果你之前装过 debug 签名的那一版，因为签名不一致，需要**先卸载再装**。

## 打包 Android（云端）

推到 `main` 后由 GitHub Actions 自动构建，并把 APK 发布到 Releases：

- **push 到 `main`** → 更新滚动 release `build-latest`，资源名固定为 `haiwang.apk`
  （用 `--clobber` 覆盖），所以上面的直链永久有效
- **打 `v*` 标签** → 额外创建版本化 release，资源名为 `haiwang-<tag>.apk`
- 同时保留 Actions Artifact（30 天），但它需要登录 GitHub 且只能下 zip

发布 Release 需要仓库开启写权限：Settings → Actions → General → Workflow permissions
选 **Read and write permissions**。

本地若要打包，需要 JDK 17 + Android SDK：

```bash
pnpm build
pnpm cap:add      # 首次：生成 android/ 目录（需提交到仓库）
pnpm cap:sync
pnpm cap:open     # 用 Android Studio 打开
```

## 部署成网页（PWA）

**本项目没有任何后端。** 纯前端单页应用：数据存在浏览器 `localStorage`，
AI 请求由浏览器直连你自己填的 OpenAI 兼容网关。所以只要有静态文件托管就能跑。

```bash
pnpm build      # 产物在 dist/，丢到任意静态托管即可
pnpm preview    # 本地预览 http://localhost:4173
```

`dist/` 是**相对路径**产物（`base: './'`）+ hash 路由，所以既能放域名根目录，
也能放 `/haiwangapp/` 这类子路径，刷新都不会 404。

### ⚠️ 部署前必须确认两件事

**1. 网关要有 CORS 头** —— 已实测你当前这台网关是 OK 的：

```
GET  /v1/models              → Access-Control-Allow-Origin: *
OPTIONS /v1/chat/completions → 204, Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
```

**2. 网关必须支持 HTTPS，否则不能部署到任何 HTTPS 站点** —— 实测
`https://175.178.98.241:30888` **不支持 HTTPS**。浏览器会硬拦「HTTPS 页面请求 HTTP 接口」
（mixed content，不是警告而是直接阻断）。

| 部署位置 | 能否用 | 说明 |
|---|---|---|
| GitHub Pages / Vercel / Netlify（HTTPS） | ❌ | 需要网关先支持 HTTPS |
| 自己的服务器走 http | ✅ | 同为 http，不触发拦截 |
| `localhost` | ✅ | 被视为安全上下文 |
| Android APK | ✅ | 原生 OkHttp 兜底 + 明文放行 |

推荐做法是给网关加一层 HTTPS 反代（顺带也解决 API Key 明文传输的问题）：

```caddyfile
# Caddy：自动申请并续期证书，不用管 certbot
你的域名.com {
    reverse_proxy 127.0.0.1:30888
}
```

```nginx
# nginx：proxy_buffering off 不能少，否则 SSE 流式会被缓冲，
# 话术要等全部生成完才一次性出现
server {
    listen 443 ssl;
    server_name 你的域名.com;
    ssl_certificate     /etc/letsencrypt/live/你的域名.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/你的域名.com/privkey.pem;
    location / {
        proxy_pass http://127.0.0.1:30888;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

### PWA 说明

已配置 manifest + Service Worker：在 HTTPS（或 localhost）下用手机浏览器打开，
可「添加到主屏幕」，之后独立窗口启动、有无浏览器地址栏的 App 观感。

Service Worker **需要安全上下文**，所以在 http 站点上不会注册（页面本身照常能用，
只是不能离线/不能安装）。预缓存只包含应用外壳，**AI 接口请求一律直连不缓存**。
注册逻辑写在 `src/main.ts`，只有浏览器会走；App 内主动跳过，原因见
[「Android WebView 样式兼容」](#android-webview-样式兼容重要)。

### 关于 CORS 兜底的一个差异

APK 里 fetch 被跨域拦下时会自动改走原生 OkHttp 重试；**浏览器里没有这个兜底**
（`Capacitor.isNativePlatform()` 为 false）。所以网页版完全依赖服务端返回 CORS 头。
你当前网关已经配好了，这一条不是问题。

## Release 签名

没配签名密钥时 CI 会用 debug 签名出包（能用，但每次换机器/换 runner 的签名一致，
仍然可以覆盖安装；只是 debug 签名不适合正式分发）。

要启用正式签名，在仓库 Settings → Secrets and variables → Actions 添加 4 个 secret：

| Secret 名 | 值 |
|---|---|
| `KEYSTORE_BASE64` | 密钥库文件的 base64（`base64 -w0 haiwang-release.p12`） |
| `KEYSTORE_PASSWORD` | 密钥库口令 |
| `KEY_ALIAS` | 密钥别名 |
| `KEY_PASSWORD` | 密钥口令（PKCS12 下与密钥库口令相同） |

配好之后重新跑一次工作流：有 `keystore.properties` 就自动走 `assembleRelease`，
并且会用 `apksigner verify --print-certs` 校验签名、把证书打印到日志里。

**自己生成密钥库**（需要 JDK）：

```bash
keytool -genkeypair -v -keystore haiwang-release.jks \
  -alias haiwang -keyalg RSA -keysize 4096 -validity 10950 \
  -storetype PKCS12
base64 -w0 haiwang-release.jks > keystore-base64.txt
```

**验证签名**（不需要 JDK）：

```bash
python scripts/verify-apk-signature.py haiwang.apk --expect cert.pem
```

该脚本直接解析 APK Signing Block 的 v2 结构，把里面 DER 编码的证书抠出来，
与 `cert.pem` 的 SHA-256 逐字节比对 —— 所以本机没有 `apksigner` 也能确认
「这个 APK 确实是用我的密钥签的」。

**注意事项**

- 密钥库是整个 App 的身份凭证。**丢了就无法给已安装的用户做覆盖升级**，只能卸载重装。
  务必离线备份（U 盘 / 密码管理器），且**绝不要提交进仓库**（`.gitignore` 已挡掉 `*.p12` / `*.jks` / `*.keystore` / `keystore.properties`）
- 从 debug 签名包切换到正式签名包时，签名不一致，需要先卸载旧版再装
- CI 用构建序号作为 `versionCode`，所以每次构建都能正常覆盖安装

## Android WebView 样式兼容（重要）

**症状**：APK 装到手机上，内容能显示、接口也通，但**完全没有样式** —— 看起来像是 CSS 没加载。

**根因**：Tailwind CSS 4 输出的是原生 CSS `@layer`：

```css
@layer theme     { :root, :host { --color-wx-brand: #07c160 } }
@layer base      { /* preflight */ }
@layer utilities { .flex { display: flex } /* … */ }
```

按 CSS 规范，解析器遇到**不认识的 at-rule 必须连同它的块一起丢弃**。
`@layer` 是 Chromium 99（2022-03）才支持的，更早的 WebView 会把
`theme` / `base` / `utilities` 逐块丢掉 —— 于是 HTML 在、JS 跑得动、Vue 也正常渲染，
唯独一个样式都不生效。

国内很多 ROM 的 Android System WebView 不随 Google Play 更新（或根本没有 GMS），
长期停在 Chrome 80~95，正好落在这个区间里。**这不是打包丢了文件** ——
APK 里 `assets/public/` 下的 CSS 一直都在，是 WebView 解析不了。

**处理**（[`build/vite-plugin-legacy-css.ts`](./build/vite-plugin-legacy-css.ts)）：

1. 构建后把 `@layer` 展开成普通规则。Tailwind 的层顺序是
   `properties → theme → base → utilities`，展开后保持同样的先后顺序，层叠结果一致
   （层内规则的相对顺序本来就由源码顺序决定）。
2. 顺带把 CSS **内联进 `index.html`**：App 里样式只在首屏需要，内联后少一次子资源请求，
   也绕开了 WebView 本地资源加载器可能带来的 MIME / CORS 类问题。

为了让基线降到 **Chrome 84**（flex `gap` 的下限），源码里避开了一类写法：

| 不要用 | 改用 | 原因 |
|---|---|---|
| `space-y-*`、`space-x-*`、`divide-*` | `[&>*+*]:mt-N` | 这些工具类会生成 `:where()` 包装，Chromium < 88 会丢弃整条规则 |

改完样式记得验证：

```bash
pnpm build && pnpm verify:css
```

CI 里也有同一步（`Verify CSS compatibility`），产物中一旦再出现 `@layer` 直接失败。

**App 内不注册 Service Worker**：打包后资源本来就在本地包里，SW 没有任何收益，
反而会在覆盖安装新版本时用缓存中的旧 `index.html` / 旧资源应答（旧 CSS 若已被
`cleanupOutdatedCaches` 清掉，就是一片白板）。所以 `src/main.ts` 里判断
`Capacitor.isNativePlatform()`，只有浏览器才注册。

## 六层提示词结构


| 层 | 内容 | 来源 |
|---|---|---|
| L1 角色 | 身份、能力、风格、绝对禁止、价值观 | `SKILL.md` |
| L2 知识 | 开场白模板、分寸话术库、冷场公式、态度应对 | `knowledge.md` |
| L3 人设 | 我的昵称、性格、说话风格、底线 | 用户填写 |
| L4 对象 | 当前对象的档案与关系阶段 | 本地数据库 |
| L5 记忆 | 该对象会话摘要 + 最近若干轮 | 本地数据库 |
| L6 任务 | 输出 3 条话术 + 场景 + 风险提示 | `prompt.txt` + 本次输入 |

## 进度

- [x] **M0** 工程脚手架、技能包内联、微信风布局与路由
- [x] **M1** API 层（OpenAI 兼容、SSE 流式 + 非流式回退、模型列表、连接测试、错误中文翻译）
- [x] **M2** Skill 引擎（六层组装、token 预算与历史压缩、结构化输出四级降级 + 截断抢救）
- [x] **M3** 核心 UX（会话页、话术卡片、一键复制、上下文用量面板、关系阶段色标）
- [x] **M4** 持久化（本机存储、对象档案增删改、人设卡编辑、导出/恢复）
- [x] **M5** Android 工程 + GitHub Actions 云端构建 APK
- [x] **M6a** 应用图标与启动图（安卓 + PWA 共用一套设计，脚本可复现）
- [x] **M7** 网页版 / PWA（相对路径产物、manifest、Service Worker、离线外壳）
- [ ] **M6b** 应用锁、话术收藏夹、深色模式

### 与初版方案的偏差（重要）

| 方案原定 | 实际实现 | 原因 |
|---|---|---|
| M4 用 `@capacitor-community/sqlite` | 本机 localStorage，收敛在 `src/db/storage.ts` 一层 | 原生插件在本机（无 JDK/SDK/真机）无法验证，贸然引入会埋下"跑不起来但看不出来"的坑。换 SQLite 只需替换该文件的实现，上层 store 不用改 |
| M4 把 API Key 存进 Android Keystore | 暂存应用私有目录 | 同上，Keystore 加密必须在真机上验证。设置页已明确标注 |
| 只做 Android APK | 额外产出网页版 / PWA | 项目本来就没有后端，纯静态产物即可再覆盖一个端；成本很低 |

### 已验证 / 未验证

- ✅ `pnpm typecheck`、`pnpm test`（解析器 16 个用例）、`pnpm build`、`pnpm verify:css` 全部通过
- ✅ GitHub Actions 云端产出 APK，release 正式签名已用 `apksigner` + 独立脚本双重校验
- ✅ 静态托管下 manifest / sw.js / 图标 / 相对路径资源全部返回 200
- ✅ 网关 CORS 已实测可用（`Access-Control-Allow-Origin: *`，预检 204）
- ✅ 构建产物已无 `@layer`，CSS 内联进 `index.html`（修掉真机上「CSS 没加载」的问题）
- ⚠️ **网关不支持 HTTPS** —— 因此不能部署到任何 HTTPS 站点，详见「部署成网页」
- ⚠️ **未经真机验证**：与真实网关的端到端生成、剪贴板、原生 HTTP 兜底、PWA 安装

详见 [方案.md](./方案.md)。

## 安全提示

- **绝不硬编码 API Key**，全部由用户在设置页填写
- 聊天记录仅存本机，默认不上传任何第三方
- 默认接口是明文 HTTP，建议尽快在服务端启用 HTTPS

## License

技能包内容来自 [zhuangzzy/haiwang.skill](https://github.com/zhuangzzy/haiwang.skill)（MIT）。
