import { createClient } from 'npm:@supabase/supabase-js@2'

const FUNCTION_VERSION = 2
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify({ functionVersion: FUNCTION_VERSION, ...body }), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function normalizeUsername(value: unknown) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase()
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

type LimitEntry = { startedAt: number; attempts: number }
const memoryLimits = new Map<string, LimitEntry>()

function consumeMemoryAttempt(key: string, maxAttempts: number, windowSeconds: number) {
  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const current = memoryLimits.get(key)

  if (!current || now - current.startedAt >= windowMs) {
    memoryLimits.set(key, { startedAt: now, attempts: 1 })
    return true
  }

  current.attempts += 1
  memoryLimits.set(key, current)

  if (memoryLimits.size > 512) {
    for (const [entryKey, entry] of memoryLimits) {
      if (now - entry.startedAt >= windowMs * 2) memoryLimits.delete(entryKey)
    }
  }

  return current.attempts <= maxAttempts
}

function secretKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy

  const packed = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!packed) return ''

  try {
    const keys = JSON.parse(packed)
    return String(keys.default || Object.values(keys)[0] || '')
  } catch (_) {
    return ''
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { error: 'POSTで呼び出してください。' })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch (_) {
    return json(400, { error: '送信内容を読み取れませんでした。' })
  }

  // Honeypot: bots often fill hidden website fields.
  if (String(body.website || '')) return json(201, { ok: true })

  const username = normalizeUsername(body.username)
  const password = String(body.password ?? '')

  if (!/^[\p{L}\p{N}_\-.]{3,18}$/u.test(username)) {
    return json(400, { error: 'ユーザー名は3～18文字の文字・数字・_・-・.で入力してください。' })
  }
  if (password.length < 6 || password.length > 72) {
    return json(400, { error: 'パスワードは6～72文字で入力してください。' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = secretKey()
  if (!supabaseUrl || !serviceKey) {
    console.error('Supabase admin secrets are unavailable')
    return json(500, { error: '登録サーバーの設定が不足しています。' })
  }

  // This limiter intentionally does not call SQL/RPC. A cold start may reset it,
  // but account registration will never fail because a database function is stale.
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const clientIp = request.headers.get('cf-connecting-ip') || forwarded || request.headers.get('x-real-ip') || 'unknown'
  const ipHash = await sha256Hex(`trion-register-v2-ip:${clientIp}`)
  const userHash = await sha256Hex(`trion-register-v2-user:${username}`)

  const ipAllowed = consumeMemoryAttempt(`ip:${ipHash}`, 10, 3600)
  const userAllowed = consumeMemoryAttempt(`user:${userHash}`, 5, 3600)
  if (!ipAllowed || !userAllowed) {
    return json(429, { error: '登録試行が多すぎます。時間を空けてから再度お試しください。' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const digest = await sha256Hex(`trion-arena:${username}`)
  const email = `u_${digest.slice(0, 48)}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: username },
  })

  if (error) {
    const lower = String(error.message || '').toLowerCase()
    if (lower.includes('already') || lower.includes('registered') || lower.includes('exists')) {
      return json(409, { error: 'このユーザー名はすでに使われています。登録済みの場合はログインしてください。' })
    }
    console.error('Admin createUser failed', error)
    return json(400, { error: 'ユーザーを登録できませんでした。入力内容を確認してください。' })
  }

  return json(201, { ok: true, userId: data.user?.id || null })
})
