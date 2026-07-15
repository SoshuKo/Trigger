(() => {
  'use strict';

  const CONFIG = window.TRION_ONLINE_CONFIG || {};
  const normalizeUsername = (value) => String(value || '').normalize('NFKC').trim().toLowerCase();

  async function usernameEmail(username) {
    const normalized = normalizeUsername(username);
    if (!/^[\p{L}\p{N}_\-.]{3,18}$/u.test(normalized)) {
      throw new Error('ユーザー名は3～18文字の文字・数字・_・-・.で入力してください。');
    }
    const bytes = new TextEncoder().encode(`trion-arena:${normalized}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hex = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    return { normalized, email: `u_${hex.slice(0, 48)}@example.com` };
  }

  async function refreshSupabaseIdentity(service, session, username = '') {
    service.user = session?.user || null;
    service.profile = null;
    if (!service.user) return;
    if (username) {
      await service.client.auth.updateUser({ data: { username, display_name: username } });
      service.user.user_metadata = { ...(service.user.user_metadata || {}), username, display_name: username };
    }
    await service.ensureProfile();
    if (username && service.profile?.username !== username) {
      const { data, error } = await service.client.from('profiles').update({ username, display_name: username }).eq('id', service.user.id).select('*').single();
      if (error) throw error;
      service.profile = data;
    }
    service.emit('status', { status:'online', detail:`${service.profile?.display_name || username}でログイン中` });
    service.emit('ready', { enabled:true, user:service.user, profile:service.profile });
  }

  function install() {
    const service = window.trionOnline;
    if (!service) return false;

    service.registerAccount = async (username, password) => {
      if (CONFIG.transport === 'direct-websocket') {
        const result = await service.request('register_account', { username, password });
        localStorage.setItem('trionDirectAuthToken', result.token);
        await service.reconnectWithAuth?.();
        return result;
      }
      if (!service.client) throw new Error('Supabaseへ接続できていません。');
      if (service.user?.is_anonymous) {
        await service.client.auth.signOut();
        service.user = null;
        service.profile = null;
      }
      const account = await usernameEmail(username);
      if (String(password || '').length < 6) throw new Error('パスワードは6文字以上にしてください。');

      const endpoint = `${String(CONFIG.supabaseUrl || '').replace(/\/+$/, '')}/functions/v1/${CONFIG.registrationFunction || 'register-account'}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: CONFIG.supabaseKey,
        },
        body: JSON.stringify({ username: account.normalized, password: String(password), website: '' }),
      });

      let result = null;
      try { result = await response.json(); } catch (_) { result = null; }
      if (!response.ok) {
        const message = result?.error || result?.message || (response.status === 429
          ? '登録試行が多すぎます。しばらくしてから再度お試しください。'
          : 'ユーザー登録に失敗しました。');
        throw new Error(message);
      }

      let session = null;
      let loginError = null;
      for (let attempt = 0; attempt < 4 && !session; attempt++) {
        if (attempt) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
        const login = await service.client.auth.signInWithPassword({ email: account.email, password: String(password) });
        session = login.data?.session || null;
        loginError = login.error || null;
      }
      if (!session) throw new Error(loginError?.message || '登録後のログインに失敗しました。もう一度ログインしてください。');
      await refreshSupabaseIdentity(service, session, account.normalized);
      return service.profile;
    };

    const input = document.getElementById('registerUsername');
    if (input) {
      input.maxLength = 18;
      input.placeholder = '3～18文字';
    }
    return true;
  }

  if (!install()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (install() || attempts > 100) clearInterval(timer);
    }, 50);
  }
})();
