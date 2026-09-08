# 2025 Blog

一个无后端的 Next.js 个人博客：内容以静态文件形式存放在仓库里，网站前端通过 GitHub App 直接把改动写回 GitHub 仓库。无需数据库、无需自建服务端。

## 快速开始

```bash
pnpm i        # 安装依赖
pnpm dev      # 本地启动（端口 2025）
```

浏览器打开 http://localhost:2025 即可。

## 部署与配置

详细的中文说明见 [docs/启动与配置指南.md](docs/启动与配置指南.md)，涵盖：

- 本地启动与构建命令
- Vercel / Cloudflare Workers 部署
- 创建 GitHub App 并授权仓库
- 配置站点信息、写文章、删除示例内容

## 技术栈

Next.js（App Router）+ React + Tailwind CSS + Zustand + SWR
