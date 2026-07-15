import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function normalizeUsername(value: unknown) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase()
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { error: 'POSTで呼び出してください。' })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch (_) {
    return json(400, { error: '送信内容を読み取れませんでした。' })
  }

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

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const clientIp = request.headers.get('cf-connecting-ip') || forwarded || request.headers.get('x-real-ip') || 'unknown'
  const ipHash = await sha256Hex(`trion-register-ip:${clientIp}`)
  const userHash = await sha256Hex(`trion-register-user:${username}`)

  const [ipLimit, userLimit] = await Promise.all([
    admin.rpc('consume_registration_attempt', { rate_key: `ip:${ipHash}`, max_attempts: 8, window_seconds: 3600 }),
    admin.rpc('consume_registration_attempt', { rate_key: `user:${userHash}`, max_attempts: 3, window_seconds: 3600 }),
  ])
  if (ipLimit.error || userLimit.error) {
    console.error('Registration limiter failed', ipLimit.error || userLimit.error)
    return json(500, { error: '登録回数の確認に失敗しました。SQLを更新してください。' })
  }
  if (!ipLimit.data || !userLimit.data) {
    return json(429, { error: '登録試行が多すぎます。1時間ほど空けてから再度お試しください。' })
  }

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
