# 点赞后端（Cloudflare Worker + KV）

这是博客点赞按钮自己的后端，替代原作者那个 `blog-liker.yysuni1001.workers.dev`。功能：

- `GET /api/like?slug=xxx` → 返回 `{ count }`（某篇文章/页面的点赞数）
- `POST /api/like?slug=xxx` → 点赞 +1 并返回 `{ count }`；当天已赞过则返回 `{ reason: 'rate_limited' }`
- 计数存在 KV，限流按「每个 IP 每个 slug 每天一次」，标记当天过期自动清除

## 部署到你的 Cloudflare 账号

1. 安装 Wrangler（若还没有）：
   ```bash
   pnpm add -g wrangler
   ```

2. 登录你的 Cloudflare 账号：
   ```bash
   wrangler login
   ```

3. 创建 KV Namespace，记下返回的 id：
   ```bash
   wrangler kv namespace create LIKES
   ```
   输出里有一行 `id = "xxxxxxxx..."`，把它复制下来。

4. 把 id 填进本目录 `wrangler.toml` 的 `[[kv_namespaces]] id = "..."`。

5. 部署：
   ```bash
   cd like-api
   wrangler deploy
   ```
   部署成功后终端会打印一个地址，形如 `https://blog-like-api.<你的子域>.workers.dev`。

## 接回博客前端

在你部署博客的平台（Vercel / Cloudflare）设置环境变量：

```
NEXT_PUBLIC_LIKE_API = https://blog-like-api.<你的子域>.workers.dev/api/like
```

重新构建部署后，博客里的点赞按钮就会请求你自己的后端。不设置这个变量时，点赞按钮不会渲染（避免请求到空地址）。
