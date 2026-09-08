// 点赞后端 Worker（Cloudflare Worker + KV）
//
// 接口（与原作者的点赞按钮前端协议保持一致）：
//   GET  /api/like?slug=xxx  → { count: number }
//   POST /api/like?slug=xxx  → { count: number } 或 { reason: 'rate_limited' }
//
// 限流：每个 IP 对每个 slug 每天只能赞一次（标记当天过期）。
// 计数与限流标记都存进 KV（绑定名 LIKES）。

export default {
	async fetch(request, env) {
		const url = new URL(request.url)

		// CORS 预检
		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders() })
		}

		if (url.pathname !== '/api/like') {
			return json({ count: null }, 404)
		}

		const slug = url.searchParams.get('slug')
		if (!slug) {
			return json({ count: null }, 400)
		}

		if (request.method === 'GET') {
			return json({ count: await getCount(env, slug) })
		}

		if (request.method === 'POST') {
			const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
			const rateKey = `rate:${slug}:${ip}:${dateKey()}`

			if (await env.LIKES.get(rateKey)) {
				return json({ reason: 'rate_limited' })
			}

			const count = await increment(env, slug)
			await env.LIKES.put(rateKey, '1', { expirationTtl: secondsUntilTomorrow() })
			return json({ count })
		}

		return json({ count: null }, 405)
	}
}

function corsHeaders() {
	return {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Max-Age': '86400'
	}
}

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json', ...corsHeaders() }
	})
}

async function getCount(env, slug) {
	const value = await env.LIKES.get(`likes:${slug}`)
	return value ? parseInt(value, 10) : 0
}

async function increment(env, slug) {
	const key = `likes:${slug}`
	const current = await env.LIKES.get(key)
	const next = (current ? parseInt(current, 10) : 0) + 1
	await env.LIKES.put(key, String(next))
	return next
}

function dateKey() {
	// 用 UTC 日期，避免服务器时区导致的「跨天不一致」
	return new Date().toISOString().slice(0, 10)
}

function secondsUntilTomorrow() {
	const now = new Date()
	const tomorrow = new Date(now)
	tomorrow.setUTCHours(24, 0, 0, 0)
	return Math.max(1, Math.floor((tomorrow.getTime() - now.getTime()) / 1000))
}
