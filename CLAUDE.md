# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个**无后端**的个人博客。内容全部以静态文件形式存放在仓库里，前端通过 GitHub API 直接在浏览器里把改动写回 GitHub 仓库。技术栈：Next.js 16（App Router）+ React 19 + Tailwind CSS v4 + Zustand + SWR，通过 `@opennextjs/cloudflare` 部署到 Cloudflare Workers（也兼容 Vercel）。

核心设计思想：**网站、内容、仓库都是用户自己的**。没有数据库、没有服务端鉴权 —— 编辑/发布操作由前端用 GitHub App 的私钥签发 JWT 换取 installation token，再走 GitHub Git Data API 提交到 `main` 分支。

## 常用命令

```bash
pnpm i              # 安装依赖（本项目用 pnpm，见 .npmrc）
pnpm dev            # 本地开发，端口 2025（next dev --turbopack -p 2025）
pnpm build          # 标准 Next.js 生产构建
pnpm start          # 运行标准构建产物
pnpm build:cf       # 构建 Cloudflare Workers 产物（opennextjs-cloudflare build）
pnpm preview        # 本地预览 Cloudflare 产物
pnpm deploy         # 部署到 Cloudflare
pnpm svg            # 重新生成 src/svgs/index.ts（扫描 src/svgs 下所有 .svg）
pnpm cf-typegen     # 生成 Cloudflare 环境类型 cloudflare-env.d.ts
```

- 没有测试套件、没有 lint 脚本（仅 Prettier，配置见 `.prettierrc`）。
- `next.config.ts` 中 `typescript.ignoreBuildErrors: true`，**构建不会因类型错误失败**，不要依赖 `pnpm build` 来发现类型问题。
- 本地开发访问 `http://localhost:2025`。

## 架构

### 目录与路由（App Router）

- `src/app/(home)/` —— 首页，一堆可拖拽的 Card（`hi-card`、`art-card`、`clock-card`、`share-card` 等），由 `home-draggable-layer.tsx` 编排。
- `src/app/blog/` —— 文章列表；`src/app/blog/[id]/` —— 文章详情页。
- `src/app/write/` —— 写文章（新建）；`src/app/write/[slug]/` —— 编辑文章。编辑器分 cover / images / meta 三个 section。
- 其他内容分区各占一个目录，每个分区都有 `list.json`（数据）和一个 `services/push-*.ts`（回写）：`about`、`bloggers`、`pictures`、`projects`、`share`、`snippets`、`music`（用 `list.ts`）、`clock`、`live2d`、`image-toolbox`、`svgs`、`wuthering-waves`。
- `src/app/rss.xml/route.ts` 和 `src/app/sitemap.ts` —— RSS 和 sitemap。

### 内容数据模型（关键：内容即文件）

- 每篇文章 = `public/blogs/<slug>/` 下的 `index.md`（正文）+ `config.json`（title/tags/date/summary/cover/hidden/category）。封面和配图放在同目录，文件名是图片内容的 SHA256 哈希。
- `public/blogs/index.json` —— 文章索引数组，按日期倒序；`public/blogs/categories.json` —— 分类列表。
- 各分区的数据：`src/app/<section>/list.json`（例如 `src/app/bloggers/list.json`）。
- 站点配置：`src/config/site-content.json`（站点元信息、主题色、背景色、art 图片、社交按钮、备案等）和 `src/config/card-styles.json`（首页各 Card 的样式）。这两个 JSON 被 `src/app/(home)/stores/config-store.ts` 直接 `import` 进 Zustand store。
- 阅读这些数据用的是**客户端 fetch**（`use-blog-index.ts`、`use-categories.ts` 用 SWR fetch `/blogs/index.json` 等），而 sitemap 在服务端直接 `import public/blogs/index.json`。

### 写回流程（GitHub Git Data API）

没有后端 API。所有「保存/发布」都在浏览器里完成，流程固定：

1. `src/lib/auth.ts` → `getAuthToken()`：用私钥签 JWT（`signAppJwt`）→ 取 installation id → 换 installation token，并缓存在 sessionStorage。
2. 各 `src/app/**/services/push-*.ts`（如 `push-blog.ts`、`push-site-content.ts`）→ `src/lib/github-client.ts`：`getRef`（拿当前分支最新 commit）→ `createBlob`（每个文件）→ `createTree` → `createCommit` → `updateRef`（更新分支引用）。这是一次原子提交，所以新增文章 = 一次 commit 写入 index.md + config.json + 图片 + 更新 index.json。
3. 删除文件通过 tree 项里 `sha: null` 实现。

关键 lib 文件：

- `src/lib/github-client.ts` —— 所有 GitHub API 封装（含 batch commit 的 Git Data API）。
- `src/lib/auth.ts` —— 认证 token 获取与缓存；`src/lib/aes256-util.ts` —— 私钥用 AES-GCM 加密后存 sessionStorage。
- `src/lib/blog-index.ts` —— 读写 `public/blogs/index.json`。
- `src/lib/load-blog.ts` —— 客户端按 slug fetch 文章（config.json + index.md）。
- `src/lib/markdown-renderer.ts` —— 用 `marked` + `shiki`（代码高亮）+ `katex`（数学公式）渲染 Markdown，并生成 TOC。
- `src/consts.ts` —— 全局常量，含 `GITHUB_CONFIG`（owner/repo/branch/appId/encryptKey，来自环境变量，有默认值指向原作者仓库）。

### 状态管理

- **Zustand**：`use-auth.ts`（是否已导入私钥）、`config-store.ts`（站点配置 + 首页 Card 样式）、`write-store.ts` / `preview-store.ts`（写文章时的表单与预览状态）。
- **SWR**：`use-blog-index`、`use-categories` 拉取内容数据（`revalidateOnFocus: false`）。

### 样式与主题

- Tailwind v4（`postcss.config.mjs` 用 `@tailwindcss/postcss`）。
- 主题色通过 CSS 变量注入：`src/app/layout.tsx` 从 `site-content.json` 的 `theme` 读取，写成 `--color-brand` / `--color-primary` / `--color-bg` 等内联到 `<html>`。全局样式在 `src/styles/`（`globals.css`、`theme.css`、`article.css`）。

## 改成你自己的博客（要点）

完整的启动与配置步骤见仓库内 `docs/启动与配置指南.md`。快速备忘：

1. Fork 或 clone 后 `pnpm i && pnpm dev`。
2. 配置 GitHub App（要有 `Contents: Write` 权限），拿到 **App ID** 和 **Private Key**，把 App 安装到你的仓库。
3. 设置环境变量（或直接改 `src/consts.ts` 的 `GITHUB_CONFIG`）：`NEXT_PUBLIC_GITHUB_OWNER`、`NEXT_PUBLIC_GITHUB_REPO`、`NEXT_PUBLIC_GITHUB_BRANCH`、`NEXT_PUBLIC_GITHUB_APP_ID`。
4. 部署后，在网站里点编辑按钮导入 Private Key，即可在前端增删改文章、改站点配置。
5. 第一件事通常是删掉原作者的示例内容（`public/blogs/*`、各 `list.json`、`src/config/site-content.json` 里的个人信息）。

## 注意事项

- 私钥/App ID 是公开仓库的「编辑凭证」，因为 `NEXT_PUBLIC_*` 变量会被打进客户端 bundle；原项目用默认值 `'-'` 兜底。不要把真正的私钥提交进仓库（`.gitignore` 已忽略 `*.pem` 和 `.env*`）。
- 编辑保存后，是写入 GitHub 分支，**部署平台需要重新构建**（push 会触发）才会在线上生效。
- `global.d.ts` 声明了 `*.svg` 模块（`@svgr/webpack` 转成 React 组件）。
