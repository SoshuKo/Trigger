(() => {
  'use strict';

  const service = window.trionOnline;
  const CONFIG = window.TRION_ONLINE_CONFIG || {};
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const direct = CONFIG.transport === 'direct-websocket';
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const normalizeUsername = (value) => String(value || '').normalize('NFKC').trim().toLowerCase();
  let selectedSquad = null;
  let userFriends = [];
  let userSquads = [];
  let emblemPixels = new Array(32 * 32).fill(0);
  let drawing = false;
  let drawValue = 1;
  let onlinePreparation = false;
  let accessRegistered = false;
  const storageGet = (key) => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const storageSet = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };

  function accountLoggedIn() {
    if (!service) return false;
    if (direct) return Boolean(service.profile?.username && service.profile?.account_id);
    return Boolean(service.user && !service.user.is_anonymous);
  }

  function setMessage(text, error = false) {
    const roots = [$('#userAuthMessage'), $('#userPanelMessage')].filter(Boolean);
    roots.forEach((root) => { root.textContent = text || ''; root.dataset.error = error ? 'true' : 'false'; });
  }

  async function usernameEmail(username) {
    const normalized = normalizeUsername(username);
    if (!/^[\p{L}\p{N}_\-.]{3,18}$/u.test(normalized)) throw new Error('ユーザー名は3～18文字の文字・数字・_・-・.で入力してください。');
    const bytes = new TextEncoder().encode(`trion-arena:${normalized}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hex = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    return { normalized, email: `u_${hex.slice(0, 48)}@example.com` };
  }

  async function refreshSupabaseIdentity(session, username = '') {
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

  service.registerAccount = async (username, password) => {
    if (direct) {
      const result = await service.request('register_account', { username, password });
      localStorage.setItem('trionDirectAuthToken', result.token);
      await service.reconnectWithAuth?.();
      return result;
    }
    if (!service.client) throw new Error('Supabaseへ接続できていません。');
    if (service.user?.is_anonymous) { await service.client.auth.signOut(); service.user=null; service.profile=null; }
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
    await refreshSupabaseIdentity(session, account.normalized);
    return service.profile;
  };

  service.loginAccount = async (username, password) => {
    if (direct) {
      const result = await service.request('login_account', { username, password });
      localStorage.setItem('trionDirectAuthToken', result.token);
      await service.reconnectWithAuth?.();
      return result;
    }
    if (!service.client) throw new Error('Supabaseへ接続できていません。');
    if (service.user?.is_anonymous) { await service.client.auth.signOut(); service.user=null; service.profile=null; }
    const account = await usernameEmail(username);
    const { data, error } = await service.client.auth.signInWithPassword({ email:account.email, password:String(password || '') });
    if (error) throw new Error('ユーザー名またはパスワードが違います。');
    await refreshSupabaseIdentity(data.session);
    return service.profile;
  };

  service.logoutAccount = async () => {
    if (service.room) await service.leaveRoom();
    if (direct) {
      localStorage.removeItem('trionDirectAuthToken');
      await service.reconnectWithAuth?.();
      return;
    }
    await service.client?.auth.signOut();
    service.user = null;
    service.profile = null;
    service.emit('status', { status:'online', detail:'ユーザー登録またはログインしてください。' });
    service.emit('ready', { enabled:true, user:null, profile:null });
  };

  service.removeFriend = async (friendId) => {
    if (direct) return service.request('remove_friend', { friendId });
    const { error } = await service.client.rpc('remove_friend', { target_id:friendId });
    if (error) throw error;
    return true;
  };

  service.listSquads = async () => {
    if (!accountLoggedIn()) return [];
    if (direct) return service.request('list_squads');
    const { data, error } = await service.client.rpc('list_my_squads');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  };

  service.createSquad = async (payload) => {
    if (direct) return service.request('create_squad', payload);
    const { data, error } = await service.client.rpc('create_squad_with_members', {
      squad_name:payload.name,
      squad_color:payload.color,
      squad_emblem:payload.emblemPixels,
      member_ids:payload.memberIds || [],
    });
    if (error) throw error;
    return data;
  };

  service.updateSquad = async (payload) => {
    if (direct) return service.request('update_squad', payload);
    const { data, error } = await service.client.rpc('update_squad_identity', {
      target_squad:payload.squadId,
      squad_name:payload.name,
      squad_color:payload.color,
      squad_emblem:payload.emblemPixels,
    });
    if (error) throw error;
    return data;
  };

  service.setSquadLeader = async (squadId, leaderId) => {
    if (direct) return service.request('set_squad_leader', { squadId, leaderId });
    const { data, error } = await service.client.rpc('set_squad_leader', { target_squad:squadId, new_leader:leaderId });
    if (error) throw error;
    return data;
  };

  service.leaveSquad = async (squadId) => {
    if (direct) return service.request('leave_squad', { squadId });
    const { data, error } = await service.client.rpc('leave_squad', { target_squad:squadId });
    if (error) throw error;
    return data;
  };

  service.fetchAccessCount = async () => {
    if (direct) return service.request('register_access');
    if (!service.client) return 0;
    const { data, error } = await service.client.rpc('register_page_visit');
    if (error) throw error;
    return Number(data || 0);
  };

  const originalFetchRankings = service.fetchRankings?.bind(service);
  service.fetchRankings = async () => {
    if (direct) {
      const data = await originalFetchRankings();
      return { solo:data?.solo || [], team:data?.team || [], defense:data?.defense || [] };
    }
    if (!service.client) return { solo:[], team:[], defense:[] };
    const fields = 'display_name,team_name,score,kills,deaths,defense_round,created_at';
    const results = await Promise.all(['solo','team','defense'].map((mode) => service.client.from('rankings').select(fields).eq('mode',mode).order('score',{ascending:false}).limit(5)));
    results.forEach((result) => { if (result.error) throw result.error; });
    return { solo:results[0].data || [], team:results[1].data || [], defense:results[2].data || [] };
  };

  const originalSubmitRanking = service.submitRanking?.bind(service);
  service.submitRanking = async (entry) => {
    if (!entry || !['solo','team','defense'].includes(entry.mode)) return false;
    if (direct) return originalSubmitRanking(entry);
    if (!accountLoggedIn()) return false;
    const payload = {
      user_id:service.user.id,
      display_name:String(entry.displayName || service.profile?.display_name || '隊員').slice(0,18),
      team_name:String(entry.teamName || '').slice(0,18),
      mode:entry.mode,
      score:Math.max(0,Math.round(Number(entry.score || 0))),
      kills:Math.max(0,Math.round(Number(entry.kills || 0))),
      deaths:Math.max(0,Math.round(Number(entry.deaths || 0))),
      defense_round:Math.max(0,Math.round(Number(entry.defenseRound || 0))),
      match_id:String(entry.matchId || '').slice(0,80),
      room_id:service.room?.id || null,
      verified:false,
    };
    const { error } = await service.client.from('rankings').insert(payload);
    if (error) { console.warn('Ranking submit failed', error); return false; }
    return true;
  };

  function presetPixels(name) {
    const px = new Array(1024).fill(0);
    const set=(x,y)=>{ if(x>=0&&x<32&&y>=0&&y<32) px[y*32+x]=1; };
    const line=(x1,y1,x2,y2,w=1)=>{ const steps=Math.max(Math.abs(x2-x1),Math.abs(y2-y1),1); for(let i=0;i<=steps;i++){ const x=Math.round(x1+(x2-x1)*i/steps),y=Math.round(y1+(y2-y1)*i/steps); for(let ox=-w;ox<=w;ox++)for(let oy=-w;oy<=w;oy++)set(x+ox,y+oy); } };
    if(name==='cross'){ line(5,16,26,16,2);line(16,5,16,26,2); }
    else if(name==='fang'){ line(7,6,16,26,2);line(25,6,16,26,2);line(10,15,22,15,1); }
    else if(name==='shield'){ for(let y=5;y<25;y++){ const inset=Math.floor(Math.abs(y-12)*.35); for(let x=7+inset;x<=24-inset;x++) if(y<9||x===7+inset||x===24-inset||y>21)set(x,y); } }
    else if(name==='wing'){ line(3,18,14,9,2);line(29,18,18,9,2);line(9,21,16,13,1);line(23,21,16,13,1); }
    else if(name==='road'){ line(11,29,14,3,2);line(21,29,18,3,2); }
    else if(name==='tower'){ for(let x=9;x<23;x++){set(x,8);set(x,25);} for(let y=8;y<26;y++){set(9,y);set(22,y);} line(12,16,19,16,1); }
    else { for(let y=7;y<25;y++)for(let x=7;x<25;x++) if(x<10||x>21||y<10||y>21)set(x,y); line(7,7,24,24,0);line(24,7,7,24,0); }
    return px;
  }

  function serializeEmblem() { return emblemPixels.join(''); }
  function loadEmblem(value) {
    const text=String(value || '');
    emblemPixels = text.length === 1024 ? [...text].map((v)=>v==='1'?1:0) : presetPixels('cube');
    drawEmblem();
  }
  function drawEmblem() {
    const canvas=$('#userEmblemEditor'); if(!canvas)return;
    const ctx=canvas.getContext('2d'); ctx.imageSmoothingEnabled=false; ctx.fillStyle='#fff';ctx.fillRect(0,0,256,256);ctx.fillStyle='#071521';
    emblemPixels.forEach((v,i)=>{if(v)ctx.fillRect((i%32)*8,Math.floor(i/32)*8,8,8);});
    ctx.strokeStyle='rgba(0,80,100,.12)';ctx.lineWidth=1;
    for(let i=0;i<=32;i++){ctx.beginPath();ctx.moveTo(i*8,0);ctx.lineTo(i*8,256);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*8);ctx.lineTo(256,i*8);ctx.stroke();}
  }
  function paintEmblem(event) {
    const canvas=$('#userEmblemEditor'); if(!canvas)return;
    const rect=canvas.getBoundingClientRect(); const point=event.touches?.[0] || event;
    const x=Math.max(0,Math.min(31,Math.floor((point.clientX-rect.left)/rect.width*32)));
    const y=Math.max(0,Math.min(31,Math.floor((point.clientY-rect.top)/rect.height*32)));
    emblemPixels[y*32+x]=drawValue; $('#userEmblemPreset').value='custom'; drawEmblem();
  }
  async function loadUserEmblemFile(file) {
    const message=$('#userEmblemUploadMessage');
    if(!file)return;
    try{
      const bitmap=await createImageBitmap(file);
      if(bitmap.width!==32||bitmap.height!==32)throw new Error('32×32ピクセルの画像だけ使用できます。');
      const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);
      const data=ctx.getImageData(0,0,32,32).data;const next=[];
      for(let i=0;i<1024;i++){
        const r=data[i*4],g=data[i*4+1],b=data[i*4+2],a=data[i*4+3];
        if(a<24){next.push(0);continue;}
        const max=Math.max(r,g,b),min=Math.min(r,g,b),lum=(r+g+b)/3;
        if(max-min>18||!(lum<38||lum>217))throw new Error('白・黒・透明だけで描かれた画像を使用してください。');
        next.push(lum<128?1:0);
      }
      emblemPixels=next;$('#userEmblemPreset').value='custom';drawEmblem();
      if(message){message.textContent='隊章を読み込みました。';message.classList.remove('error');}
    }catch(error){if(message){message.textContent=error.message;message.classList.add('error');}}
  }

  function emblemDataUrl(serialized, scale=8) {
    const canvas=document.createElement('canvas');canvas.width=32*scale;canvas.height=32*scale;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#071521';
    [...String(serialized||'')].forEach((v,i)=>{if(v==='1')ctx.fillRect((i%32)*scale,Math.floor(i/32)*scale,scale,scale);});return canvas.toDataURL('image/png');
  }

  async function renderRankings() {
    try {
      const rankings=await service.fetchRankings();
      const render=(root,rows,team=false,defense=false)=>{if(!root)return;root.innerHTML=rows.length?rows.map((entry,index)=>`<div class="title-rank-row"><span class="position">${index+1}</span><div><strong>${escapeHtml(team?(entry.team_name||entry.display_name||'無所属隊'):(entry.display_name||'隊員'))}</strong><small>${defense?`ROUND ${Number(entry.defense_round||0)} · `:''}${Number(entry.kills||0)}K / ${Number(entry.deaths||0)}D · ONLINE</small></div><span class="points">${Math.round(Number(entry.score||0))}pt</span></div>`).join(''):'<div class="title-ranking-empty">オンライン記録はまだありません</div>';};
      render($('#soloTitleRanking'),rankings.solo,false,false);render($('#teamTitleRanking'),rankings.team,true,false);render($('#defenseTitleRanking'),rankings.defense,true,true);
    } catch(error){ console.warn('Ranking load failed',error); }
  }
  service.refreshRankings=renderRankings;

  function prepSummary() {
    const config=window.TRION_GET_SETUP_CONFIG?.() || {};
    const mode=({solo:'個人戦',team:'チーム戦',defense:'防衛戦'})[config.mode] || '個人戦';
    const role=({combatant:'戦闘員',operator:'オペレーター',spectator:'観戦'})[config.playerRole] || '戦闘員';
    const map=({city:'市街',desert:'砂漠'})[config.mapId] || '市街';
    const root=$('#onlinePrepSummary'); if(root)root.textContent=`${mode} ／ ${role} ／ ${map} ／ ${config.teamConfig?.squadName || '無所属隊'}`;
    ['onlineCreateRole','onlineJoinRole'].forEach((id)=>{const el=$(`#${id}`);if(el)el.value=config.playerRole||'combatant';});
  }

  function showPreparation() {
    if (!accountLoggedIn()) { openUserPanel('オンライン出撃にはユーザー登録またはログインが必要です。'); return; }
    onlinePreparation=true;
    window.TRION_SHOW_SETUP?.({ online:true });
    $('#onlinePreparationBanner')?.classList.remove('hidden');
    $('#onlineProceedButton')?.classList.remove('hidden');
    window.scrollTo({top:0,behavior:'auto'});
  }
  function cancelPreparation(){onlinePreparation=false;$('#onlinePreparationBanner')?.classList.add('hidden');$('#onlineProceedButton')?.classList.add('hidden');}
  function openLobby(){if(!accountLoggedIn()){openUserPanel('先にログインしてください。');return;}prepSummary();$('#onlinePanel')?.classList.remove('hidden');}

  async function refreshFriendsAndSquads() {
    if (!accountLoggedIn()) return;
    try { userFriends=await service.listFriends(); } catch(error){userFriends=[];setMessage(error.message,true);}
    try { userSquads=await service.listSquads(); } catch(error){userSquads=[];setMessage(error.message,true);}
    renderUserFriends();renderSquadChoices();renderSquads();
  }

  function renderUserFriends(){
    const root=$('#userFriendList');if(!root)return;
    root.innerHTML=userFriends.length?userFriends.map((friend)=>`<div class="online-friend-row"><div><strong>${escapeHtml(friend.display_name)}</strong><small>${escapeHtml(friend.friend_code)}</small></div>${friend.room_code?`<button type="button" data-user-friend-room="${escapeHtml(friend.room_code)}">参加</button>`:`<span>${friend.online?'ONLINE':'OFFLINE'}</span>`}<button type="button" data-remove-friend="${escapeHtml(friend.user_id||friend.id)}">解除</button></div>`).join(''):'<div class="online-empty">フレンドはまだいません</div>';
    root.querySelectorAll('[data-remove-friend]').forEach((button)=>button.addEventListener('click',async()=>{if(!confirm('フレンドを解除しますか？'))return;await service.removeFriend(button.dataset.removeFriend);await refreshFriendsAndSquads();}));
    root.querySelectorAll('[data-user-friend-room]').forEach((button)=>button.addEventListener('click',()=>{showPreparation();$('#onlineJoinCode').value=button.dataset.userFriendRoom;}));
  }
  function renderSquadChoices(){
    const root=$('#userSquadFriendChoices');if(!root)return;
    root.innerHTML=userFriends.length?userFriends.map((friend)=>`<label class="squad-friend-choice"><input type="checkbox" value="${escapeHtml(friend.user_id||friend.id)}"><span>${escapeHtml(friend.display_name)}</span></label>`).join(''):'<div class="online-empty">先にフレンドを追加してください</div>';
  }
  function renderSquads(){
    const root=$('#userSquadList');if(!root)return;
    root.innerHTML=userSquads.length?userSquads.map((squad)=>`<button type="button" class="user-squad-row" data-squad-id="${escapeHtml(squad.id)}"><img class="user-squad-emblem" src="${emblemDataUrl(squad.emblem_pixels)}" alt=""><div><strong>${escapeHtml(squad.name)}</strong><small>${(squad.members||[]).length}人 · リーダー ${escapeHtml((squad.members||[]).find((m)=>m.user_id===squad.leader_id)?.display_name||'---')}</small></div><span style="color:${escapeHtml(squad.color||'#4aa8ff')}">●</span></button>`).join(''):'<div class="online-empty">所属隊はありません</div>';
    root.querySelectorAll('[data-squad-id]').forEach((button)=>button.addEventListener('click',()=>selectSquad(button.dataset.squadId)));
    if(selectedSquad){const fresh=userSquads.find((s)=>s.id===selectedSquad.id);if(fresh)selectSquad(fresh.id,false);}
  }
  function selectSquad(id,scroll=true){
    selectedSquad=userSquads.find((s)=>String(s.id)===String(id))||null;const editor=$('#userSquadEditor');editor?.classList.toggle('hidden',!selectedSquad);if(!selectedSquad)return;
    $('#editSquadName').value=selectedSquad.name||'';$('#editSquadColor').value=selectedSquad.color||'#4aa8ff';loadEmblem(selectedSquad.emblem_pixels);
    const leaders=$('#editSquadLeader');leaders.innerHTML=(selectedSquad.members||[]).map((m)=>`<option value="${escapeHtml(m.user_id)}">${escapeHtml(m.display_name)}</option>`).join('');leaders.value=selectedSquad.leader_id;
    $('#editSquadMembers').innerHTML=(selectedSquad.members||[]).map((m)=>`<div class="squad-member-row"><strong>${escapeHtml(m.display_name)}</strong><span>${m.user_id===selectedSquad.leader_id?'LEADER':'MEMBER'}</span></div>`).join('');
    if(scroll)editor?.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  async function openUserPanel(message='') {
    $('#userPanel')?.classList.remove('hidden');setMessage(message);
    renderUserState();
    if(accountLoggedIn())await refreshFriendsAndSquads();
  }
  function renderUserState(){
    const logged=accountLoggedIn();$('#userLoggedOut')?.classList.toggle('hidden',logged);$('#userLoggedIn')?.classList.toggle('hidden',!logged);
    window.dispatchEvent(new CustomEvent('trion:auth-state',{detail:{loggedIn:logged}}));
    if(!logged)return;
    $('#userAccountName').textContent=service.profile?.username||service.profile?.display_name||'USER';$('#userAccountCode').textContent=`FRIEND ${service.profile?.friend_code||'--------'}`;$('#userDisplayName').value=service.profile?.display_name||'隊員';
    $('#onlineDisplayName').value=service.profile?.display_name||'隊員';$('#onlineFriendCodeLabel').textContent=service.profile?.friend_code||'--------';
  }

  function applySquadToSetup(){
    if(!selectedSquad)return;let saved={};try{saved=JSON.parse(localStorage.getItem('trionArenaSetup')||'{}');}catch(_){saved={};}
    const teamConfig={...(saved.teamConfig||{}),squadName:selectedSquad.name,bodyColor:selectedSquad.color,emblemPreset:'custom',emblemPixels:selectedSquad.emblem_pixels};
    saved.teamConfig=teamConfig;localStorage.setItem('trionArenaSetup',JSON.stringify(saved));window.TRION_APPLY_TEAM_CONFIG?.(teamConfig);
    setMessage(`${selectedSquad.name}を出撃設定へ反映しました。`);showPreparation();
  }

  function bindUi(){
    $('#onlineOpenButton')?.addEventListener('click',showPreparation);
    $('#userOpenButton')?.addEventListener('click',()=>openUserPanel());
    $('#onlineProceedButton')?.addEventListener('click',openLobby);
    $('#onlineSetupOpenButton')?.addEventListener('click',openLobby);
    $('#cancelOnlinePreparation')?.addEventListener('click',cancelPreparation);
    $('#onlineEditPreparation')?.addEventListener('click',()=>{ $('#onlinePanel')?.classList.add('hidden'); showPreparation(); });
    $('#onlineUserShortcut')?.addEventListener('click',()=>openUserPanel());
    $('#userCloseButton')?.addEventListener('click',()=>$('#userPanel')?.classList.add('hidden'));
    $('#registerUserButton')?.addEventListener('click',async()=>{try{setMessage('登録しています…');await service.registerAccount($('#registerUsername').value,$('#registerPassword').value);setMessage('登録しました。');renderUserState();await refreshFriendsAndSquads();await renderRankings();}catch(error){setMessage(error.message,true);}});
    $('#loginUserButton')?.addEventListener('click',async()=>{try{setMessage('ログインしています…');await service.loginAccount($('#loginUsername').value,$('#loginPassword').value);setMessage('ログインしました。');renderUserState();await refreshFriendsAndSquads();await renderRankings();}catch(error){setMessage(error.message,true);}});
    $('#logoutUserButton')?.addEventListener('click',async()=>{await service.logoutAccount();selectedSquad=null;renderUserState();setMessage('ログアウトしました。');});
    $('#copyUserFriendCode')?.addEventListener('click',async()=>{const code=service.profile?.friend_code||'';try{await navigator.clipboard.writeText(code);}catch(_){}setMessage(`フレンドコード ${code} をコピーしました。`);});
    $('#saveUserProfile')?.addEventListener('click',async()=>{try{await service.updateDisplayName($('#userDisplayName').value);renderUserState();setMessage('表示名を保存しました。');}catch(error){setMessage(error.message,true);}});
    $('#userAddFriend')?.addEventListener('click',async()=>{try{await service.addFriend($('#userFriendCodeInput').value);$('#userFriendCodeInput').value='';await refreshFriendsAndSquads();setMessage('フレンドを追加しました。');}catch(error){setMessage(error.message,true);}});
    const canvas=$('#userEmblemEditor');
    canvas?.addEventListener('pointerdown',(event)=>{drawing=true;drawValue=event.button===2?0:1;paintEmblem(event);canvas.setPointerCapture?.(event.pointerId);});
    canvas?.addEventListener('pointermove',(event)=>{if(drawing)paintEmblem(event);});
    window.addEventListener('pointerup',()=>drawing=false);canvas?.addEventListener('contextmenu',(event)=>event.preventDefault());
    $('#userEmblemPreset')?.addEventListener('change',(event)=>{if(event.target.value!=='custom'){emblemPixels=presetPixels(event.target.value);drawEmblem();}});
    $('#userEmblemClear')?.addEventListener('click',()=>{emblemPixels=new Array(1024).fill(0);$('#userEmblemPreset').value='custom';drawEmblem();});
    $('#userEmblemInvert')?.addEventListener('click',()=>{emblemPixels=emblemPixels.map((v)=>v?0:1);$('#userEmblemPreset').value='custom';drawEmblem();});
    $('#userEmblemUpload')?.addEventListener('change',(event)=>{loadUserEmblemFile(event.target.files?.[0]);event.target.value='';});
    $('#downloadUserEmblem')?.addEventListener('click',()=>{const anchor=document.createElement('a');anchor.href=emblemDataUrl(serializeEmblem(),16);anchor.download=`${($('#userSquadName').value||selectedSquad?.name||'squad')}-emblem.png`;anchor.click();});
    $('#createUserSquad')?.addEventListener('click',async()=>{try{const memberIds=$$('#userSquadFriendChoices input:checked').map((input)=>input.value);await service.createSquad({name:$('#userSquadName').value,color:$('#userSquadColor').value,emblemPixels:serializeEmblem(),memberIds});await refreshFriendsAndSquads();setMessage('隊を結成しました。');}catch(error){setMessage(error.message,true);}});
    $('#saveSquadIdentity')?.addEventListener('click',async()=>{if(!selectedSquad)return;try{await service.updateSquad({squadId:selectedSquad.id,name:$('#editSquadName').value,color:$('#editSquadColor').value,emblemPixels:serializeEmblem()});const leader=$('#editSquadLeader').value;if(leader&&leader!==selectedSquad.leader_id)await service.setSquadLeader(selectedSquad.id,leader);await refreshFriendsAndSquads();setMessage('隊設定を保存しました。');}catch(error){setMessage(error.message,true);}});
    $('#applySquadToSetup')?.addEventListener('click',applySquadToSetup);
    $('#leaveUserSquad')?.addEventListener('click',async()=>{if(!selectedSquad||!confirm('この隊を離れますか？'))return;try{await service.leaveSquad(selectedSquad.id);selectedSquad=null;await refreshFriendsAndSquads();setMessage('隊を離れました。');}catch(error){setMessage(error.message,true);}});
    $('#participationRole')?.addEventListener('change',prepSummary);
  }

  async function refreshAccessCounter(){
    if(accessRegistered)return;
    const stampKey='trionArenaAccessRegisteredAtV67';
    const countKey='trionArenaAccessCountV67';
    const last=Number(storageGet(stampKey)||0);
    const cached=Number(storageGet(countKey)||0);
    if(Date.now()-last<12*60*60*1000){
      accessRegistered=true;
      if($('#accessCounter'))$('#accessCounter').textContent=cached>0?cached.toLocaleString('ja-JP'):'---';
      return;
    }
    try{
      const count=await service.fetchAccessCount();
      accessRegistered=true;
      storageSet(stampKey,String(Date.now()));
      storageSet(countKey,String(Number(count||0)));
      if($('#accessCounter'))$('#accessCounter').textContent=Number(count||0).toLocaleString('ja-JP');
    }catch(error){
      if($('#accessCounter')&&cached>0)$('#accessCounter').textContent=cached.toLocaleString('ja-JP');
      console.warn('Access counter failed',error);
    }
  }
  function dispatchAuthState(){window.dispatchEvent(new CustomEvent('trion:auth-state',{detail:{loggedIn:accountLoggedIn()}}));}
  async function initCommunity(){
    bindUi();emblemPixels=presetPixels('cube');drawEmblem();prepSummary();
    await refreshAccessCounter();await renderRankings();renderUserState();dispatchAuthState();
  }

  service?.addEventListener('ready',async()=>{renderUserState();dispatchAuthState();await refreshAccessCounter();await renderRankings();if(accountLoggedIn())await refreshFriendsAndSquads();});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(initCommunity,0));
})();
