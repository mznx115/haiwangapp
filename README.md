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
```

## 开发

```bash
pnpm install
pnpm dev          # 浏览器打开 http://localhost:5173
pnpm build        # 产物在 dist/
pnpm typecheck    # 类型检查
```

## 打包 Android（云端）

推到 `main` 后由 GitHub Actions 自动构建，产物在 Actions 的 Artifacts 中下载。

本地若要打包，需要 JDK 17 + Android SDK：

```bash
pnpm build
pnpm cap:add      # 首次：生成 android/ 目录（需提交到仓库）
pnpm cap:sync
pnpm cap:open     # 用 Android Studio 打开
```

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
- [x] **M2** Skill 引擎（六层组装、token 预算与历史压缩、结构化输出三级降级解析）
- [x] **M3** 核心 UX（会话页、话术卡片、一键复制、上下文用量面板、关系阶段色标）
- [x] **M4** 持久化（本机存储、对象档案增删改、人设卡编辑、导出/恢复）
- [x] **M5** Android 工程 + GitHub Actions 云端构建 APK
- [ ] **M6** 打磨（应用锁、话术收藏夹、深色模式、图标与启动图）

### 与初版方案的偏差（重要）

| 方案原定 | 实际实现 | 原因 |
|---|---|---|
| M4 用 `@capacitor-community/sqlite` | 本机 localStorage，收敛在 `src/db/storage.ts` 一层 | 原生插件在本机（无 JDK/SDK/真机）无法验证，贸然引入会埋下"跑不起来但看不出来"的坑。换 SQLite 只需替换该文件的实现，上层 store 不用改 |
| M4 把 API Key 存进 Android Keystore | 暂存应用私有目录 | 同上，Keystore 加密必须在真机上验证。设置页已明确标注 |

### 已验证 / 未验证

- ✅ `pnpm typecheck`、`pnpm test`（解析器 10 个用例）、`pnpm build` 全部通过
- ✅ GitHub Actions 云端产出 debug APK
- ⚠️ **未经真机验证**：与真实网关的联通性（CORS / 明文 HTTP）、剪贴板、文件持久化
- ⚠️ **尚未用真实 API Key 跑通过一次完整生成** —— 需要你在设置页填入 Key 后点「测试连接」

详见 [方案.md](./方案.md)。

## 安全提示

- **绝不硬编码 API Key**，全部由用户在设置页填写
- 聊天记录仅存本机，默认不上传任何第三方
- 默认接口是明文 HTTP，建议尽快在服务端启用 HTTPS

## License

技能包内容来自 [zhuangzzy/haiwang.skill](https://github.com/zhuangzzy/haiwang.skill)（MIT）。
