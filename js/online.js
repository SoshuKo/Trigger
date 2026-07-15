(() => {
  'use strict';

  const CONFIG = window.TRION_ONLINE_CONFIG || {};
  const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function randomCode(length = 6) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return [...bytes].map((value) => ROOM_CODE_CHARS[value % ROOM_CODE_CHARS.length]).join('');
  }

  function safeJson(value, fallback = null) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return fallback; }
  }

  class TrionOnlineService extends EventTarget {
    constructor() {
      super();
      this.enabled = Boolean(CONFIG.enabled && CONFIG.supabaseUrl && CONFIG.supabaseKey && window.supabase?.createClient);
      this.client = null;
      this.user = null;
      this.profile = null;
      this.room = null;
      this.members = [];
      this.roomChannel = null;
      this.dbChannel = null;
      this.ready = false;
      this.connecting = false;
      this.lastError = '';
      this.gameListeners = new Set();
      this.pendingLargeMessages = new Map();
      this.launchedMatchKey = '';
    }

    get configured() { return this.enabled; }
    get connected() { return Boolean(this.user && this.client); }
    get isHost() { return Boolean(this.room && this.user && this.room.host_id === this.user.id); }
    get localMember() { return this.members.find((member) => member.user_id === this.user?.id) || null; }

    emit(name, detail = {}) {
      this.dispatchEvent(new CustomEvent(name, { detail }));
      document.dispatchEvent(new CustomEvent(`trion-online-${name}`, { detail }));
    }

    async init() {
      if (this.ready || this.connecting) return this.ready;
      this.connecting = true;
      this.emit('status', { status: this.enabled ? 'connecting' : 'disabled' });
      if (!this.enabled) {
        this.ready = true;
        this.connecting = false;
        this.emit('ready', { enabled: false });
        return false;
      }
      try {
        this.client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
          realtime: { params: { eventsPerSecond: 20 } },
        });
        const { data: sessionData, error: sessionError } = await this.client.auth.getSession();
        if (sessionError) throw sessionError;
        const session = sessionData.session;
        this.user = session?.user || null;
        if (this.user) await this.ensureProfile();
        this.ready = true;
        this.emit('status', { status: 'online', detail: this.user && !this.user.is_anonymous ? 'ログイン済み' : 'ユーザー登録またはログインしてください。' });
        this.emit('ready', { enabled: true, user: this.user, profile: this.profile });
        return true;
      } catch (error) {
        this.lastError = error?.message || String(error);
        this.emit('status', { status: 'error', error: this.lastError });
        this.emit('error', { error: this.lastError });
        return false;
      } finally {
        this.connecting = false;
      }
    }

    async ensureProfile() {
      const storedName = this.user?.user_metadata?.display_name || this.user?.user_metadata?.username || localStorage.getItem('trionOnlineDisplayName') || '隊員';
      const { data: existing, error: readError } = await this.client.from('profiles').select('*').eq('id', this.user.id).maybeSingle();
      if (readError) throw readError;
      if (existing) {
        this.profile = existing;
        return existing;
      }
      for (let attempt = 0; attempt < 5; attempt++) {
        const friendCode = randomCode(8);
        const { data, error } = await this.client.from('profiles').insert({
          id: this.user.id,
          display_name: storedName,
          username: this.user?.user_metadata?.username || null,
          friend_code: friendCode,
        }).select('*').single();
        if (!error) {
          this.profile = data;
          return data;
        }
        if (!String(error.message || '').toLowerCase().includes('duplicate')) throw error;
      }
      throw new Error('フレンドコードを発行できませんでした。');
    }

    async updateDisplayName(displayName) {
      if (!this.connected) return;
      const name = String(displayName || '隊員').trim().slice(0, 18) || '隊員';
      localStorage.setItem('trionOnlineDisplayName', name);
      const { data, error } = await this.client.from('profiles').update({ display_name: name }).eq('id', this.user.id).select('*').single();
      if (error) throw error;
      this.profile = data;
      if (this.room) await this.updateMember({ display_name: name });
      this.emit('profile', { profile: data });
    }

    async fetchRankings() {
      if (!this.client) return { solo: [], team: [], defense: [] };
      const [soloResult, teamResult, defenseResult] = await Promise.all([
        this.client.from('rankings').select('display_name,score,kills,deaths,created_at').eq('mode', 'solo').order('score', { ascending: false }).limit(5),
        this.client.from('rankings').select('team_name,score,kills,deaths,created_at').eq('mode', 'team').order('score', { ascending: false }).limit(5),
        this.client.from('rankings').select('team_name,display_name,score,kills,deaths,defense_round,created_at').eq('mode', 'defense').order('score', { ascending: false }).limit(5),
      ]);
      if (soloResult.error) throw soloResult.error;
      if (teamResult.error) throw teamResult.error;
      if (defenseResult.error) throw defenseResult.error;
      return { solo: soloResult.data || [], team: teamResult.data || [], defense: defenseResult.data || [] };
    }

    async submitRanking(entry) {
      if (!this.connected || !entry || !['solo', 'team', 'defense'].includes(entry.mode)) return false;
      const payload = {
        user_id: this.user.id,
        display_name: String(entry.displayName || this.profile?.display_name || '隊員').slice(0, 18),
        team_name: String(entry.teamName || '').slice(0, 18),
        mode: entry.mode,
        score: Math.max(0, Math.round(Number(entry.score || 0))),
        kills: Math.max(0, Math.round(Number(entry.kills || 0))),
        deaths: Math.max(0, Math.round(Number(entry.deaths || 0))),
        match_id: String(entry.matchId || '').slice(0, 80),
        room_id: this.room?.id || null,
        defense_round: Math.max(0, Math.round(Number(entry.defenseRound || 0))),
        verified: false,
      };
      const { error } = await this.client.from('rankings').insert(payload);
      if (error) {
        console.warn('Ranking submit failed', error);
        return false;
      }
      return true;
    }

    async listFriends() {
      if (!this.connected) return [];
      const { data, error } = await this.client.rpc('list_friends');
      if (error) throw error;
      return data || [];
    }

    async addFriend(friendCode) {
      if (!this.connected) throw new Error('オンライン接続が必要です。');
      const code = String(friendCode || '').trim().toUpperCase();
      if (!code) throw new Error('フレンドコードを入力してください。');
      const { data, error } = await this.client.rpc('add_friend_by_code', { target_code: code });
      if (error) throw error;
      this.emit('friends', { friendId: data });
      return data;
    }

    async createRoom(options = {}) {
      if (!this.connected) throw new Error('オンライン接続が必要です。');
      await this.leaveRoom();
      let room = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const code = randomCode(6);
        const { data, error } = await this.client.from('rooms').insert({
          code,
          host_id: this.user.id,
          status: 'lobby',
          settings: safeJson(options.settings || {}, {}),
          max_players: Math.min(16, Math.max(2, Number(options.maxPlayers || 8))),
        }).select('*').single();
        if (!error) { room = data; break; }
        if (!String(error.message || '').toLowerCase().includes('duplicate')) throw error;
      }
      if (!room) throw new Error('ルームを作成できませんでした。');
      await this.client.from('room_members').insert({
        room_id: room.id,
        user_id: this.user.id,
        display_name: this.profile?.display_name || '隊員',
        team: Number(options.team || 0),
        role: options.role || 'combatant',
        ready: true,
        player_config: safeJson(options.playerConfig || {}, {}),
      });
      await this.attachRoom(room);
      return room;
    }

    async joinRoom(code, options = {}) {
      if (!this.connected) throw new Error('オンライン接続が必要です。');
      await this.leaveRoom();
      const normalized = String(code || '').trim().toUpperCase();
      const { data: room, error } = await this.client.rpc('join_room_by_code', {
        room_code: normalized,
        member_team: Number(options.team || 0),
        member_role: options.role || 'combatant',
        member_name: this.profile?.display_name || '隊員',
        member_config: safeJson(options.playerConfig || {}, {}),
      });
      if (error) throw error;
      if (!room?.id) throw new Error('ルームが見つかりません。');
      await this.attachRoom(room);
      return room;
    }

    async attachRoom(room) {
      this.room = room;
      await this.refreshMembers();
      await this.client.from('profiles').update({ current_room_id: room.id }).eq('id', this.user.id);
      await this.unsubscribeRoomChannels();
      this.roomChannel = this.client.channel(`trion-room:${room.id}`, {
        config: {
          broadcast: { self: false, ack: false },
          presence: { key: this.user.id },
        },
      });
      const broadcastEvents = ['match_start','late_join_start','input','player_action','operator_command','operator_support','operator_point','sync_request','world_init','snapshot','match_end','room_finished','__chunk__'];
      for (const eventName of broadcastEvents) this.roomChannel.on('broadcast', { event: eventName }, ({ payload }) => this.handleBroadcast(eventName, payload));
      this.roomChannel
        .on('presence', { event: 'sync' }, () => this.emit('presence', { state: this.roomChannel.presenceState() }))
        .on('presence', { event: 'join' }, ({ key, newPresences }) => this.emit('presence', { key, joined: newPresences }))
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => this.emit('presence', { key, left: leftPresences }));
      await new Promise((resolve, reject) => {
        this.roomChannel.subscribe(async (status, error) => {
          if (status === 'SUBSCRIBED') {
            await this.roomChannel.track({
              user_id: this.user.id,
              display_name: this.profile?.display_name || '隊員',
              role: this.localMember?.role || 'combatant',
              team: this.localMember?.team || 0,
              joined_at: new Date().toISOString(),
            });
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(error || new Error(status));
        });
      });
      this.dbChannel = this.client.channel(`trion-room-db:${room.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${room.id}` }, () => this.refreshMembers())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, async ({ new: updated }) => {
          this.room = updated;
          this.emit('room', { room: updated, members: this.members });
          if (updated.status === 'playing') {
            try { await this.recoverPlayingRoom(); } catch (error) { console.warn('Playing room recovery failed', error); }
          }
        });
      this.dbChannel.subscribe();
      this.emit('room', { room: this.room, members: this.members });
      if (room.status === 'playing') {
        setTimeout(async () => {
          try { await this.recoverPlayingRoom(); } catch (error) { console.warn('Playing room recovery failed', error); }
          this.broadcast('sync_request', { roomId: room.id });
        }, 250);
      }
    }

    async refreshMembers() {
      if (!this.room) return [];
      const { data, error } = await this.client.from('room_members').select('*').eq('room_id', this.room.id).order('joined_at');
      if (error) throw error;
      this.members = data || [];
      this.emit('members', { room: this.room, members: this.members });
      return this.members;
    }

    async updateMember(patch) {
      if (!this.room || !this.user) return;
      const allowed = {};
      for (const key of ['display_name', 'team', 'role', 'ready', 'player_config']) if (key in patch) allowed[key] = patch[key];
      const { error } = await this.client.from('room_members').update(allowed).eq('room_id', this.room.id).eq('user_id', this.user.id);
      if (error) throw error;
      await this.refreshMembers();
      if (this.roomChannel) await this.roomChannel.track({
        user_id: this.user.id,
        display_name: allowed.display_name || this.localMember?.display_name || this.profile?.display_name || '隊員',
        role: allowed.role || this.localMember?.role || 'combatant',
        team: Number(allowed.team ?? this.localMember?.team ?? 0),
        joined_at: new Date().toISOString(),
      });
    }

    buildSessionFromRoom() {
      if (!this.room || !this.user) return null;
      return {
        roomId: this.room.id,
        roomCode: this.room.code,
        hostId: this.room.host_id,
        roster: this.members.map((member) => ({
          userId: member.user_id,
          displayName: member.display_name,
          team: Number(member.team || 0),
          role: member.role || 'combatant',
          playerConfig: member.player_config || {},
        })),
        settings: safeJson(this.room.settings || {}, {}),
        startedAt: this.room.started_at ? Date.parse(this.room.started_at) || Date.now() : Date.now(),
      };
    }

    emitMatchStartOnce(session) {
      if (!session?.roomId) return false;
      const key = `${session.roomId}:${session.startedAt || 0}`;
      if (this.launchedMatchKey === key) return false;
      this.launchedMatchKey = key;
      this.emit('match-start', { session });
      return true;
    }

    async recoverPlayingRoom() {
      if (!this.room || this.room.status !== 'playing') return false;
      await this.refreshMembers();
      return this.emitMatchStartOnce(this.buildSessionFromRoom());
    }

    async startMatch(settings) {
      if (!this.isHost) throw new Error('ホストだけが試合を開始できます。');
      await this.refreshMembers();
      const session = {
        roomId: this.room.id,
        roomCode: this.room.code,
        hostId: this.user.id,
        roster: this.members.map((member) => ({
          userId: member.user_id,
          displayName: member.display_name,
          team: Number(member.team || 0),
          role: member.role || 'combatant',
          playerConfig: member.player_config || {},
        })),
        settings: safeJson(settings, {}),
        startedAt: Date.now(),
      };
      const { data: updated, error } = await this.client.from('rooms').update({ status: 'playing', settings: session.settings, started_at: new Date().toISOString() }).eq('id', this.room.id).select('*').single();
      if (error) throw error;
      this.room = updated;
      session.startedAt = updated.started_at ? Date.parse(updated.started_at) || session.startedAt : session.startedAt;
      await this.broadcast('match_start', session);
      this.emitMatchStartOnce(session);
      return session;
    }

    async endRoom(result = {}) {
      if (!this.room || !this.isHost) return;
      await this.client.from('rooms').update({ status: 'finished', ended_at: new Date().toISOString(), result: safeJson(result, {}) }).eq('id', this.room.id);
      await this.broadcast('room_finished', result);
    }

    async leaveRoom() {
      if (!this.room || !this.client || !this.user) return;
      const roomId = this.room.id;
      try {
        await this.client.from('room_members').delete().eq('room_id', roomId).eq('user_id', this.user.id);
        await this.client.from('profiles').update({ current_room_id: null }).eq('id', this.user.id);
        if (this.isHost) {
          const { data: nextMembers } = await this.client.from('room_members').select('user_id').eq('room_id', roomId).order('joined_at').limit(1);
          if (nextMembers?.length) await this.client.from('rooms').update({ host_id: nextMembers[0].user_id }).eq('id', roomId);
          else await this.client.from('rooms').delete().eq('id', roomId);
        }
      } catch (error) {
        console.warn('Room leave failed', error);
      }
      await this.unsubscribeRoomChannels();
      this.room = null;
      this.members = [];
      this.launchedMatchKey = '';
      this.emit('room-left', {});
    }

    async unsubscribeRoomChannels() {
      if (!this.client) return;
      if (this.roomChannel) await this.client.removeChannel(this.roomChannel);
      if (this.dbChannel) await this.client.removeChannel(this.dbChannel);
      this.roomChannel = null;
      this.dbChannel = null;
    }

    async broadcast(event, payload = {}) {
      if (!this.roomChannel) return false;
      const serialized = JSON.stringify(payload);
      if (new TextEncoder().encode(serialized).length < 180000) {
        await this.roomChannel.send({ type: 'broadcast', event, payload: { senderId: this.user.id, data: payload } });
        return true;
      }
      const messageId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const chunkSize = 80000;
      const chunks = [];
      for (let i = 0; i < serialized.length; i += chunkSize) chunks.push(serialized.slice(i, i + chunkSize));
      for (let index = 0; index < chunks.length; index++) {
        await this.roomChannel.send({
          type: 'broadcast',
          event: '__chunk__',
          payload: { senderId: this.user.id, messageId, event, index, total: chunks.length, chunk: chunks[index] },
        });
        if (index % 2 === 1) await delay(8);
      }
      return true;
    }

    handleBroadcast(event, payload) {
      if (!payload) return;
      if (event === '__chunk__') {
        const { messageId, index, total, chunk, senderId, event: originalEvent } = payload;
        let pending = this.pendingLargeMessages.get(messageId);
        if (!pending) {
          pending = { chunks: new Array(total), received: 0, event: originalEvent, senderId, createdAt: Date.now() };
          this.pendingLargeMessages.set(messageId, pending);
        }
        if (!pending.chunks[index]) { pending.chunks[index] = chunk; pending.received++; }
        if (pending.received === total) {
          this.pendingLargeMessages.delete(messageId);
          try { this.dispatchGameEvent(originalEvent, JSON.parse(pending.chunks.join('')), senderId); } catch (error) { console.warn('Large broadcast parse failed', error); }
        }
        for (const [id, value] of this.pendingLargeMessages) if (Date.now() - value.createdAt > 15000) this.pendingLargeMessages.delete(id);
        return;
      }
      this.dispatchGameEvent(event, payload.data, payload.senderId);
    }

    dispatchGameEvent(event, data, senderId) {
      const message = { event, data, senderId };
      for (const listener of this.gameListeners) {
        try { listener(message); } catch (error) { console.error(error); }
      }
      this.emit('game-event', message);
      if (event === 'match_start' && senderId !== this.user?.id) this.emitMatchStartOnce(data);
      if (event === 'late_join_start' && data?.targetId === this.user?.id) this.emitMatchStartOnce(data.session);
    }

    onGameEvent(listener) {
      this.gameListeners.add(listener);
      return () => this.gameListeners.delete(listener);
    }

    getSessionDescriptor() {
      if (!this.room || !this.user) return null;
      return {
        roomId: this.room.id,
        roomCode: this.room.code,
        hostId: this.room.host_id,
        localUserId: this.user.id,
        isHost: this.isHost,
        roster: this.members.map((member) => ({
          userId: member.user_id,
          displayName: member.display_name,
          team: Number(member.team || 0),
          role: member.role || 'combatant',
          playerConfig: member.player_config || {},
        })),
      };
    }
  }

  const service = new TrionOnlineService();
  window.trionOnline = service;

  function statusText(status) {
    return ({ disabled: '未設定', connecting: '接続中', online: 'オンライン', error: '接続エラー' })[status] || status;
  }

  function setOnlineStatus(status, detail = '') {
    const badge = $('#onlineStatusBadge');
    if (badge) {
      badge.dataset.status = status;
      badge.textContent = statusText(status);
      badge.title = detail;
    }
    const note = $('#onlineStatusNote');
    if (note) note.textContent = detail || (status === 'disabled' ? 'Supabase設定後に利用できます。' : status === 'online' ? (service.connected ? 'クラウドへ接続しています。' : 'ユーザー登録またはログインしてください。') : '');
  }

  async function renderOnlineRankings() {
    if (!service.connected) return;
    try {
      const rankings = await service.fetchRankings();
      const render = (root, rows, team = false) => {
        if (!root) return;
        root.innerHTML = rows.length ? rows.map((entry, index) => `<div class="title-rank-row"><span class="position">${index + 1}</span><div><strong>${escapeHtml(team ? entry.team_name || '無所属隊' : entry.display_name || '隊員')}</strong><small>${Number(entry.kills || 0)}K / ${Number(entry.deaths || 0)}D · ONLINE</small></div><span class="points">${Math.round(Number(entry.score || 0))}pt</span></div>`).join('') : '<div class="title-ranking-empty">オンライン記録はまだありません</div>';
      };
      render($('#soloTitleRanking'), rankings.solo, false);
      render($('#teamTitleRanking'), rankings.team, true);
      render($('#defenseTitleRanking'), rankings.defense, true);
    } catch (error) {
      console.warn('Online ranking load failed', error);
    }
  }

  service.refreshRankings = renderOnlineRankings;

  function collectPlayerConfig() {
    try {
      const raw = localStorage.getItem('trionArenaSetup');
      const saved = raw ? JSON.parse(raw) : {};
      return {
        stats: saved.stats || { trion: 6, technique: 6, combat: 6 },
        loadout: { main: saved.main || [], sub: saved.sub || [] },
        teamConfig: saved.teamConfig || {},
      };
    } catch (_) {
      return {};
    }
  }

  function renderLobby() {
    const panel = $('#onlineLobbyPanel');
    if (!panel) return;
    panel.classList.toggle('hidden', !service.room);
    if (!service.room) return;
    $('#onlineRoomCode').textContent = service.room.code;
    $('#onlineHostLabel').textContent = service.isHost ? 'あなたがホスト' : 'ホスト参加中';
    const list = $('#onlineMemberList');
    if (list) list.innerHTML = service.members.map((member) => {
      const own = member.user_id === service.user?.id;
      const host = member.user_id === service.room.host_id;
      return `<div class="online-member-row${own ? ' own' : ''}"><div><strong>${escapeHtml(member.display_name)}</strong><small>${host ? 'HOST · ' : ''}${member.ready ? 'READY' : 'WAIT'}</small></div><span>TEAM ${Number(member.team || 0) + 1}</span><span>${member.role === 'spectator' ? '観戦' : member.role === 'operator' ? 'OP' : '戦闘員'}</span></div>`;
    }).join('');
    const local = service.localMember;
    if (local) {
      $('#onlineTeamSelect').value = String(local.team || 0);
      $('#onlineRoleSelect').value = local.role || 'combatant';
      $('#onlineReadyButton').textContent = local.ready ? '準備解除' : '準備完了';
    }
    $('#onlineStartButton').classList.toggle('hidden', !service.isHost);
    $('#onlineStartButton').disabled = service.members.some((member) => !member.ready && member.user_id !== service.room.host_id);
  }

  async function renderFriends() {
    const root = $('#onlineFriendList');
    if (!root || !service.connected) return;
    try {
      const friends = await service.listFriends();
      root.innerHTML = friends.length ? friends.map((friend) => `<div class="online-friend-row"><div><strong>${escapeHtml(friend.display_name)}</strong><small>${escapeHtml(friend.friend_code)}</small></div>${friend.room_code ? `<button type="button" data-friend-room="${escapeHtml(friend.room_code)}">参加</button><button type="button" data-watch-room="${escapeHtml(friend.room_code)}">観戦</button>` : '<span>OFFLINE</span>'}</div>`).join('') : '<div class="online-empty">フレンドはまだいません</div>';
      root.querySelectorAll('[data-friend-room]').forEach((button) => button.addEventListener('click', () => joinRoomFromUi(button.dataset.friendRoom, false)));
      root.querySelectorAll('[data-watch-room]').forEach((button) => button.addEventListener('click', () => joinRoomFromUi(button.dataset.watchRoom, true)));
    } catch (error) {
      root.innerHTML = `<div class="online-empty">${escapeHtml(error.message)}</div>`;
    }
  }

  async function joinRoomFromUi(code, spectator = false) {
    try {
      const team = Number($('#onlineJoinTeam')?.value || 0);
      const role = spectator ? 'spectator' : ($('#onlineJoinRole')?.value || 'combatant');
      await service.joinRoom(code, { team, role, playerConfig: collectPlayerConfig() });
      renderLobby();
    } catch (error) {
      alert(error.message || error);
    }
  }

  function bindUi() {
    const openPanel = async () => { $('#onlinePanel')?.classList.remove('hidden'); if (service.connected) { await renderFriends(); await renderOnlineRankings(); } };
    $('#onlineCloseButton')?.addEventListener('click', () => $('#onlinePanel')?.classList.add('hidden'));
    $('#onlineNameSave')?.addEventListener('click', async () => {
      try { await service.updateDisplayName($('#onlineDisplayName').value); } catch (error) { alert(error.message || error); }
    });
    $('#onlineCopyFriendCode')?.addEventListener('click', async () => {
      const code = service.profile?.friend_code || '';
      try { await navigator.clipboard.writeText(code); } catch (_) { /* ignore */ }
      $('#onlineStatusNote').textContent = `フレンドコード ${code} をコピーしました。`;
    });
    $('#onlineAddFriend')?.addEventListener('click', async () => {
      try { await service.addFriend($('#onlineFriendCode').value); $('#onlineFriendCode').value = ''; await renderFriends(); } catch (error) { alert(error.message || error); }
    });
    $('#onlineCreateRoom')?.addEventListener('click', async () => {
      try {
        const role = $('#onlineCreateRole').value;
        const team = Number($('#onlineCreateTeam').value || 0);
        const maxPlayers = Number($('#onlineMaxPlayers').value || 8);
        const settings = window.TRION_GET_SETUP_CONFIG ? window.TRION_GET_SETUP_CONFIG() : {};
        await service.createRoom({ role, team, maxPlayers, settings, playerConfig: collectPlayerConfig() });
        renderLobby();
      } catch (error) { alert(error.message || error); }
    });
    $('#onlineJoinRoom')?.addEventListener('click', () => joinRoomFromUi($('#onlineJoinCode').value, false));
    $('#onlineLeaveRoom')?.addEventListener('click', async () => { await service.leaveRoom(); renderLobby(); });
    $('#onlineTeamSelect')?.addEventListener('change', async (event) => { await service.updateMember({ team: Number(event.target.value), ready: false }); });
    $('#onlineRoleSelect')?.addEventListener('change', async (event) => { await service.updateMember({ role: event.target.value, ready: false, player_config: collectPlayerConfig() }); });
    $('#onlineReadyButton')?.addEventListener('click', async () => { const local = service.localMember; if (local) await service.updateMember({ ready: !local.ready, player_config: collectPlayerConfig() }); });
    $('#onlineStartButton')?.addEventListener('click', async () => {
      try {
        await service.updateMember({ player_config: collectPlayerConfig(), ready: true });
        const settings = window.TRION_GET_SETUP_CONFIG ? window.TRION_GET_SETUP_CONFIG() : {};
        await service.startMatch(settings);
      } catch (error) { alert(error.message || error); }
    });
  }

  service.addEventListener('status', (event) => setOnlineStatus(event.detail.status, event.detail.error || ''));
  service.addEventListener('ready', async () => {
    if (service.profile) {
      $('#onlineDisplayName').value = service.profile.display_name || '隊員';
      $('#onlineFriendCodeLabel').textContent = service.profile.friend_code || '--------';
    }
    await renderOnlineRankings();
    await renderFriends();
  });
  service.addEventListener('members', renderLobby);
  service.addEventListener('room', renderLobby);
  service.addEventListener('room-left', renderLobby);
  service.addEventListener('match-start', (event) => {
    $('#onlinePanel')?.classList.add('hidden');
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    if (window.TRION_START_ONLINE_MATCH) window.TRION_START_ONLINE_MATCH(event.detail.session);
  });

  document.addEventListener('DOMContentLoaded', () => {
    bindUi();
    setOnlineStatus(service.enabled ? 'connecting' : 'disabled');
    service.init();
  });
})();
