(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const memoryStorage = new Map();
  const storageGet = (key) => { try { return localStorage.getItem(key); } catch (_) { return memoryStorage.get(key) ?? null; } };
  const storageSet = (key, value) => { try { localStorage.setItem(key, value); } catch (_) { memoryStorage.set(key, String(value)); } };
  const screen = $('#tutorialScreen');
  const canvas = $('#tutorialCanvas');
  const ctx = canvas?.getContext('2d');
  if (!screen || !canvas || !ctx) return;

  const COURSE_ORDER = ['basic', 'attacker', 'shooter', 'gunner', 'sniper'];
  const COURSES = {
    basic: {
      kicker: 'BASIC TRAINING', title: '基本操作',
      description: '移動・照準・装備選択・左右のトリガー発動を順番に確認します。',
      objectives: [
        ['moved', 'WASDで一定距離を移動する', 'WASDで青い隊員を動かしてください。'],
        ['aimed', 'マウスで照準を動かす', '戦場内でマウスを動かし、照準を合わせてください。'],
        ['selected', '1キーでMAIN 1を選択する', '1キーを押して右手の装備を選びます。'],
        ['mainUsed', '左クリックでMAINを発動する', '照準方向へ左クリックしてください。'],
        ['subUsed', '右クリックでSUBを発動する', '右クリックでシールドを展開してください。'],
      ],
    },
    attacker: {
      kicker: 'ATTACKER COURSE', title: '攻撃手訓練',
      description: '弧月の間合いへ入り、通常斬撃と旋空を使い分けます。',
      objectives: [
        ['meleeHits', '近距離の標的へ通常斬撃を2回当てる', '標的へ接近し、左クリックで斬ってください。'],
        ['senkuHit', 'Shift＋左クリックで旋空を当てる', '少し離れた標的へShiftを押しながら左クリックします。'],
        ['attackerClear', '標的をすべて破壊する', '残った標的を通常斬撃か旋空で破壊してください。'],
      ],
    },
    shooter: {
      kicker: 'SHOOTER COURSE', title: '射手訓練',
      description: 'トリオンキューブを生成し、通常弾と合成弾を撃ち分けます。',
      objectives: [
        ['cubePrepared', '1キーでトリオンキューブを生成する', '1キーでアステロイドのキューブを生成します。'],
        ['shooterHits', '左クリックで通常弾を3回当てる', 'キューブ生成後、標的へ左クリックで射出します。'],
        ['compositeHit', 'Cで合成して強化弾を当てる', 'Cで合成準備し、装甲標的へ左クリックしてください。'],
      ],
    },
    gunner: {
      kicker: 'GUNNER COURSE', title: '銃手訓練',
      description: '突撃銃の連射と弾種切替を使って移動標的を追います。',
      objectives: [
        ['burstShots', '左クリック長押しで8発以上連射する', '標的を狙い、左クリックを長押ししてください。'],
        ['ammoSwitched', '2キーでハウンドへ切り替える', '2キーで弾種をアステロイドからハウンドへ変更します。'],
        ['houndHit', 'ハウンドで移動標的へ命中させる', '移動標的の近くを狙って連射してください。'],
      ],
    },
    sniper: {
      kicker: 'SNIPER COURSE', title: '狙撃手訓練',
      description: 'スコープを展開し、遠距離標的へ精密射撃を行います。',
      objectives: [
        ['scopeOn', 'Rキーでスコープを展開する', 'Rキーを押してください。'],
        ['sniperHit', 'スコープ中に遠距離標的へ命中させる', '標的の中心へ照準を合わせて左クリックします。'],
        ['sniperClear', '遠距離標的を2体破壊する', '射撃後の短い再装填を待ち、もう一体も狙撃してください。'],
      ],
    },
  };

  const state = {
    open: false,
    course: 'basic',
    keys: new Set(),
    player: { x: 245, y: 410, angle: 0, radius: 17, distance: 0, shield: 0 },
    pointer: { x: 610, y: 360, moved: false },
    targets: [], projectiles: [], effects: [],
    flags: {}, counters: {},
    firing: false, fireTimer: 0, cooldown: 0,
    ammo: 'asteroid', cubeReady: false, compositeReady: false, scope: false,
    previous: performance.now(), messageTimer: 0,
  };

  const obstacles = [
    { x: 490, y: 165, w: 92, h: 210 },
    { x: 690, y: 430, w: 170, h: 92 },
    { x: 960, y: 175, w: 80, h: 170 },
  ];

  function isVisible() { return state.open && !screen.classList.contains('hidden'); }
  function objectiveDone(id) {
    if (id === 'moved') return state.player.distance >= 110;
    if (id === 'aimed') return Boolean(state.pointer.moved);
    if (id === 'selected') return Boolean(state.flags.selected);
    if (id === 'mainUsed') return Boolean(state.flags.mainUsed);
    if (id === 'subUsed') return Boolean(state.flags.subUsed);
    if (id === 'meleeHits') return (state.counters.meleeHits || 0) >= 2;
    if (id === 'senkuHit') return Boolean(state.flags.senkuHit);
    if (id === 'attackerClear') return state.targets.length > 0 && state.targets.every((target) => target.hp <= 0);
    if (id === 'cubePrepared') return Boolean(state.flags.cubePrepared);
    if (id === 'shooterHits') return (state.counters.shooterHits || 0) >= 3;
    if (id === 'compositeHit') return Boolean(state.flags.compositeHit);
    if (id === 'burstShots') return (state.counters.burstShots || 0) >= 8;
    if (id === 'ammoSwitched') return Boolean(state.flags.ammoSwitched);
    if (id === 'houndHit') return Boolean(state.flags.houndHit);
    if (id === 'scopeOn') return Boolean(state.flags.scopeOn);
    if (id === 'sniperHit') return Boolean(state.flags.sniperHit);
    if (id === 'sniperClear') return (state.counters.sniperKills || 0) >= 2;
    return false;
  }

  function courseComplete() { return COURSES[state.course].objectives.every(([id]) => objectiveDone(id)); }

  function currentHint() {
    const objective = COURSES[state.course].objectives.find(([id]) => !objectiveDone(id));
    return objective?.[2] || '訓練完了です。次のコースへ進めます。';
  }

  function updateUi() {
    const course = COURSES[state.course];
    $('#tutorialCourseKicker').textContent = course.kicker;
    $('#tutorialCourseTitle').textContent = course.title;
    $('#tutorialCourseDescription').textContent = course.description;
    $('#tutorialHint').textContent = currentHint();
    $$('#tutorialCourseTabs button').forEach((button) => button.classList.toggle('active', button.dataset.course === state.course));
    const completed = course.objectives.filter(([id]) => objectiveDone(id)).length;
    $('#tutorialObjectives').innerHTML = course.objectives.map(([id, label], index) => `<li class="${objectiveDone(id) ? 'done' : index === completed ? 'current' : ''}"><i>${objectiveDone(id) ? '✓' : index + 1}</i><span>${label}</span></li>`).join('');
    $('#tutorialProgressBar').style.width = `${completed / course.objectives.length * 100}%`;
    const next = $('#tutorialNextButton');
    next.disabled = !courseComplete();
    next.textContent = state.course === 'sniper' ? '訓練を完了' : '次の訓練へ';
    if (courseComplete()) {
      storageSet(`trionArenaTutorial_${state.course}_v67`, '1');
      if (COURSE_ORDER.every((id) => storageGet(`trionArenaTutorial_${id}_v67`) === '1')) storageSet('trionArenaTutorialCompletedV67', '1');
    }
  }

  function makeTarget(x, y, hp = 2, options = {}) {
    return { x, y, hp, maxHp: hp, radius: options.radius || 24, armored: Boolean(options.armored), moving: Boolean(options.moving), phase: options.phase || 0, baseY: y, id: `${state.course}-${x}-${y}` };
  }

  function resetCourse(course = state.course) {
    state.course = COURSE_ORDER.includes(course) ? course : 'basic';
    state.keys.clear(); state.projectiles.length = 0; state.effects.length = 0;
    state.flags = {}; state.counters = {}; state.firing = false; state.fireTimer = 0; state.cooldown = 0;
    state.ammo = 'asteroid'; state.cubeReady = false; state.compositeReady = false; state.scope = false;
    state.player = { x: 245, y: 410, angle: 0, radius: 17, distance: 0, shield: 0 };
    state.pointer = { x: 610, y: 360, moved: false };
    if (state.course === 'basic') state.targets = [makeTarget(650, 360, 99, { radius: 20 })];
    if (state.course === 'attacker') state.targets = [makeTarget(430, 335, 2), makeTarget(650, 300, 2), makeTarget(700, 570, 2)];
    if (state.course === 'shooter') state.targets = [makeTarget(720, 250, 3), makeTarget(880, 550, 5, { armored: true, radius: 30 })];
    if (state.course === 'gunner') state.targets = [makeTarget(820, 330, 10, { moving: true, radius: 27 })];
    if (state.course === 'sniper') state.targets = [makeTarget(1035, 245, 1, { radius: 18 }), makeTarget(1090, 540, 1, { radius: 18 })];
    updateUi();
  }

  function showMessage(text) {
    const element = $('#tutorialMessage');
    element.textContent = text; element.classList.remove('hidden'); state.messageTimer = 1.25;
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * 1280 / rect.width, y: (event.clientY - rect.top) * 720 / rect.height };
  }

  function circleRectCollision(x, y, r, rect) {
    const cx = clamp(x, rect.x, rect.x + rect.w);
    const cy = clamp(y, rect.y, rect.y + rect.h);
    return (x - cx) ** 2 + (y - cy) ** 2 < r ** 2;
  }

  function hasClearLine(ax, ay, bx, by) {
    for (const rect of obstacles) {
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 16);
      for (let i = 1; i < steps; i++) {
        const t = i / steps, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return false;
      }
    }
    return true;
  }

  function nearestAimTarget(maxAngle = .16, maxDistance = Infinity) {
    const angle = state.player.angle;
    let best = null, bestScore = Infinity;
    for (const target of state.targets) {
      if (target.hp <= 0) continue;
      const dx = target.x - state.player.x, dy = target.y - state.player.y;
      const d = Math.hypot(dx, dy); if (d > maxDistance || !hasClearLine(state.player.x, state.player.y, target.x, target.y)) continue;
      const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle)));
      const score = diff * 600 + d * .02;
      if (diff <= maxAngle && score < bestScore) { best = target; bestScore = score; }
    }
    return best;
  }

  function damageTarget(target, damage, kind) {
    if (!target || target.hp <= 0) return false;
    if (target.armored && kind !== 'composite') damage *= .25;
    target.hp = Math.max(0, target.hp - damage);
    state.effects.push({ type: 'hit', x: target.x, y: target.y, ttl: .35, max: .35, color: kind === 'senku' ? '#9ff7ff' : kind === 'composite' ? '#ffe77e' : '#ffffff' });
    if (kind === 'melee') state.counters.meleeHits = (state.counters.meleeHits || 0) + 1;
    if (kind === 'senku') state.flags.senkuHit = true;
    if (kind === 'shooter') state.counters.shooterHits = (state.counters.shooterHits || 0) + 1;
    if (kind === 'composite') state.flags.compositeHit = true;
    if (kind === 'hound') state.flags.houndHit = true;
    if (kind === 'sniper') { state.flags.sniperHit = true; if (target.hp <= 0) state.counters.sniperKills = (state.counters.sniperKills || 0) + 1; }
    if (target.hp <= 0) showMessage('標的破壊');
    updateUi();
    return true;
  }

  function spawnProjectile(kind, speed, damage, target = null) {
    const angle = state.player.angle;
    state.projectiles.push({ x: state.player.x + Math.cos(angle) * 24, y: state.player.y + Math.sin(angle) * 24, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, speed, damage, kind, target, ttl: 2.4, radius: kind === 'composite' ? 7 : 4 });
  }

  function useMain() {
    state.flags.mainUsed = true;
    if (state.course === 'basic') { state.effects.push({ type: 'slash', x: state.player.x, y: state.player.y, angle: state.player.angle, ttl: .25, max: .25, color: '#7eeeff' }); updateUi(); return; }
    if (state.course === 'attacker') {
      const senku = state.keys.has('ShiftLeft') || state.keys.has('ShiftRight');
      const range = senku ? 285 : 100;
      const target = nearestAimTarget(senku ? .34 : .65, range);
      state.effects.push({ type: 'slash', x: state.player.x, y: state.player.y, angle: state.player.angle, ttl: .3, max: .3, range, color: senku ? '#a8fbff' : '#ffffff' });
      if (target) damageTarget(target, 1, senku ? 'senku' : 'melee'); else showMessage(senku ? '旋空：射線上に標的なし' : '間合いが遠すぎます');
      return;
    }
    if (state.course === 'shooter') {
      if (!state.cubeReady) { showMessage('先に1キーでキューブを生成'); return; }
      const composite = state.compositeReady;
      spawnProjectile(composite ? 'composite' : 'shooter', composite ? 540 : 390, composite ? 4 : 1);
      state.cubeReady = false; state.compositeReady = false;
      return;
    }
    if (state.course === 'sniper') {
      if (!state.scope) { showMessage('Rでスコープを展開'); return; }
      if (state.cooldown > 0) { showMessage('再装填中'); return; }
      const target = nearestAimTarget(.045, 1200);
      state.effects.push({ type: 'trace', x: state.player.x, y: state.player.y, angle: state.player.angle, ttl: .18, max: .18, color: '#dfffff' });
      if (target) damageTarget(target, 1, 'sniper'); else showMessage('照準を標的の中心へ');
      state.cooldown = .85;
    }
  }

  function useSub() {
    state.flags.subUsed = true;
    state.player.shield = 1.3;
    state.effects.push({ type: 'shield', x: state.player.x, y: state.player.y, ttl: 1.3, max: 1.3, color: '#69dfff' });
    updateUi();
  }

  function fireGunner() {
    if (state.cooldown > 0) return;
    state.cooldown = .105;
    state.counters.burstShots = (state.counters.burstShots || 0) + 1;
    const moving = state.targets.find((target) => target.hp > 0);
    spawnProjectile(state.ammo === 'hound' ? 'hound' : 'gun', 600, 1, state.ammo === 'hound' ? moving : null);
    updateUi();
  }

  function handleKeyDown(event) {
    if (!isVisible()) return;
    const relevant = ['KeyW','KeyA','KeyS','KeyD','Digit1','Digit2','KeyC','KeyR','ShiftLeft','ShiftRight','Escape'];
    if (relevant.includes(event.code)) event.preventDefault();
    if (event.code === 'Escape') { closeTutorial(); return; }
    state.keys.add(event.code);
    if (event.code === 'Digit1') {
      state.flags.selected = true;
      if (state.course === 'shooter') { state.cubeReady = true; state.flags.cubePrepared = true; showMessage('トリオンキューブ生成'); }
      if (state.course === 'gunner') { state.ammo = 'asteroid'; showMessage('アステロイド'); }
      updateUi();
    }
    if (event.code === 'Digit2' && state.course === 'gunner') { state.ammo = 'hound'; state.flags.ammoSwitched = true; showMessage('ハウンドへ切替'); updateUi(); }
    if (event.code === 'KeyC' && state.course === 'shooter') {
      if (!state.cubeReady) { state.cubeReady = true; state.flags.cubePrepared = true; }
      state.compositeReady = true; showMessage('合成弾準備'); updateUi();
    }
    if (event.code === 'KeyR' && state.course === 'sniper') { state.scope = !state.scope; if (state.scope) state.flags.scopeOn = true; showMessage(state.scope ? 'SCOPE ON' : 'SCOPE OFF'); updateUi(); }
  }

  function handleKeyUp(event) { state.keys.delete(event.code); }

  function handlePointerMove(event) {
    if (!isVisible()) return;
    const point = canvasPoint(event); state.pointer.x = point.x; state.pointer.y = point.y; state.pointer.moved = true;
    state.player.angle = Math.atan2(point.y - state.player.y, point.x - state.player.x);
    updateUi();
  }

  function handlePointerDown(event) {
    if (!isVisible()) return;
    event.preventDefault();
    const point = canvasPoint(event); state.pointer.x = point.x; state.pointer.y = point.y;
    state.player.angle = Math.atan2(point.y - state.player.y, point.x - state.player.x);
    if (event.button === 2) useSub();
    else if (event.button === 0) {
      state.firing = true;
      if (state.course === 'gunner') fireGunner(); else useMain();
    }
  }

  function handlePointerUp(event) { if (event.button === 0) state.firing = false; }

  function update(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.player.shield = Math.max(0, state.player.shield - dt);
    let mx = 0, my = 0;
    if (state.keys.has('KeyW')) my -= 1; if (state.keys.has('KeyS')) my += 1;
    if (state.keys.has('KeyA')) mx -= 1; if (state.keys.has('KeyD')) mx += 1;
    if (mx || my) {
      const length = Math.hypot(mx, my) || 1; mx /= length; my /= length;
      const oldX = state.player.x, oldY = state.player.y;
      const nx = clamp(oldX + mx * 190 * dt, 40, 1240), ny = clamp(oldY + my * 190 * dt, 70, 680);
      if (!obstacles.some((rect) => circleRectCollision(nx, oldY, state.player.radius, rect))) state.player.x = nx;
      if (!obstacles.some((rect) => circleRectCollision(state.player.x, ny, state.player.radius, rect))) state.player.y = ny;
      state.player.distance += Math.hypot(state.player.x - oldX, state.player.y - oldY);
      state.player.angle = Math.atan2(state.pointer.y - state.player.y, state.pointer.x - state.player.x);
      updateUi();
    }
    if (state.course === 'gunner' && state.firing) fireGunner();
    for (const target of state.targets) {
      if (target.moving && target.hp > 0) target.y = target.baseY + Math.sin(performance.now() * .0017 + target.phase) * 125;
    }
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const projectile = state.projectiles[i];
      if (projectile.kind === 'hound' && projectile.target?.hp > 0) {
        const desired = Math.atan2(projectile.target.y - projectile.y, projectile.target.x - projectile.x);
        const current = Math.atan2(projectile.vy, projectile.vx);
        const diff = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
        const next = current + clamp(diff, -2.8 * dt, 2.8 * dt);
        projectile.vx = Math.cos(next) * projectile.speed; projectile.vy = Math.sin(next) * projectile.speed;
      }
      projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt; projectile.ttl -= dt;
      let hit = null;
      for (const target of state.targets) if (target.hp > 0 && Math.hypot(target.x - projectile.x, target.y - projectile.y) <= target.radius + projectile.radius) { hit = target; break; }
      const blocked = obstacles.some((rect) => projectile.x >= rect.x && projectile.x <= rect.x + rect.w && projectile.y >= rect.y && projectile.y <= rect.y + rect.h);
      if (hit) { damageTarget(hit, projectile.damage, projectile.kind); state.projectiles.splice(i, 1); }
      else if (blocked || projectile.ttl <= 0 || projectile.x < 0 || projectile.x > 1280 || projectile.y < 0 || projectile.y > 720) state.projectiles.splice(i, 1);
    }
    for (let i = state.effects.length - 1; i >= 0; i--) { state.effects[i].ttl -= dt; if (state.effects[i].ttl <= 0) state.effects.splice(i, 1); }
    if (state.messageTimer > 0) { state.messageTimer -= dt; if (state.messageTimer <= 0) $('#tutorialMessage').classList.add('hidden'); }
  }

  function drawAgent(x, y, angle) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = '#55dfff'; ctx.fillRect(-10, -14, 20, 28); ctx.fillStyle = '#baf8ff'; ctx.fillRect(9, -4, 15, 8);
    ctx.strokeStyle = '#eaffff'; ctx.strokeRect(-11, -15, 22, 30);
    if (state.course === 'attacker') { ctx.strokeStyle = '#dfffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(45, 0); ctx.stroke(); }
    if (state.course === 'gunner' || state.course === 'sniper') { ctx.fillStyle = '#a9f7ff'; ctx.fillRect(12, -3, state.course === 'sniper' ? 34 : 25, 6); }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, 1280, 720);
    const gradient = ctx.createLinearGradient(0, 0, 1280, 720); gradient.addColorStop(0, '#071923'); gradient.addColorStop(1, '#0b2632'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1280, 720);
    ctx.strokeStyle = 'rgba(104,223,255,.08)'; ctx.lineWidth = 1;
    for (let x = 0; x <= 1280; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 720); ctx.stroke(); }
    for (let y = 0; y <= 720; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(109,151,164,.32)'; ctx.strokeStyle = 'rgba(170,233,245,.28)';
    for (const rect of obstacles) { ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.strokeRect(rect.x, rect.y, rect.w, rect.h); }
    for (const target of state.targets) {
      if (target.hp <= 0) { ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2); ctx.stroke(); continue; }
      ctx.save(); ctx.translate(target.x, target.y); ctx.fillStyle = target.armored ? '#b99052' : '#ff795f'; ctx.strokeStyle = '#ffe3d9'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, target.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(-target.radius, 0); ctx.lineTo(target.radius, 0); ctx.moveTo(0, -target.radius); ctx.lineTo(0, target.radius); ctx.stroke();
      ctx.fillStyle = 'rgba(4,15,20,.8)'; ctx.fillRect(-28, target.radius + 9, 56, 5); ctx.fillStyle = '#75f0ff'; ctx.fillRect(-28, target.radius + 9, 56 * target.hp / target.maxHp, 5); ctx.restore();
    }
    for (const projectile of state.projectiles) {
      ctx.fillStyle = projectile.kind === 'composite' ? '#ffe86e' : projectile.kind === 'hound' ? '#ffac66' : '#9cefff';
      ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2); ctx.fill();
    }
    for (const effect of state.effects) {
      const alpha = effect.ttl / effect.max; ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = effect.color; ctx.lineWidth = 4;
      if (effect.type === 'slash') { ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.range || 80, effect.angle - .55, effect.angle + .55); ctx.stroke(); }
      if (effect.type === 'hit') { ctx.beginPath(); ctx.arc(effect.x, effect.y, 35 * (1 - alpha) + 5, 0, Math.PI * 2); ctx.stroke(); }
      if (effect.type === 'shield') { ctx.beginPath(); ctx.arc(effect.x, effect.y, 32, 0, Math.PI * 2); ctx.stroke(); }
      if (effect.type === 'trace') { ctx.beginPath(); ctx.moveTo(effect.x, effect.y); ctx.lineTo(effect.x + Math.cos(effect.angle) * 1150, effect.y + Math.sin(effect.angle) * 1150); ctx.stroke(); }
      ctx.restore();
    }
    drawAgent(state.player.x, state.player.y, state.player.angle);
    ctx.save(); ctx.translate(state.pointer.x, state.pointer.y); ctx.strokeStyle = state.scope ? '#e9ffff' : 'rgba(190,249,255,.8)'; ctx.lineWidth = state.scope ? 2 : 1; ctx.beginPath(); ctx.arc(0, 0, state.scope ? 22 : 10, 0, Math.PI * 2); ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.moveTo(0, -30); ctx.lineTo(0, 30); ctx.stroke(); ctx.restore();
    if (state.scope) { ctx.strokeStyle = 'rgba(220,255,255,.22)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(state.pointer.x, state.pointer.y, 145, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(4,16,23,.78)'; ctx.fillRect(18, 650, 420, 48); ctx.fillStyle = '#83eaff'; ctx.font = '700 13px sans-serif';
    const loadout = state.course === 'attacker' ? 'MAIN 1：弧月　Shift：旋空' : state.course === 'shooter' ? `MAIN 1：${state.compositeReady ? '合成弾' : state.cubeReady ? 'アステロイド READY' : 'キューブ未生成'}` : state.course === 'gunner' ? `突撃銃：${state.ammo === 'hound' ? 'ハウンド' : 'アステロイド'}` : state.course === 'sniper' ? `イーグレット：${state.scope ? 'SCOPE ON' : 'SCOPE OFF'}` : 'MAIN：攻撃　SUB：シールド';
    ctx.fillText(loadout, 34, 680);
  }

  function frame(now) {
    const dt = Math.min(.035, Math.max(0, (now - state.previous) / 1000)); state.previous = now;
    if (isVisible()) { update(dt); draw(); }
    requestAnimationFrame(frame);
  }

  function openTutorial(course = 'basic') {
    state.open = true;
    $('#titleScreen')?.classList.add('hidden'); $('#setupScreen')?.classList.add('hidden'); $('#gameScreen')?.classList.add('hidden'); $('#simulationResultsScreen')?.classList.add('hidden'); $('#titleGuidePanel')?.classList.add('hidden');
    screen.classList.remove('hidden'); document.body.classList.add('game-active'); document.documentElement.classList.add('game-active');
    resetCourse(course); setTimeout(() => canvas.focus(), 50);
  }

  function closeTutorial() {
    state.open = false; state.firing = false; screen.classList.add('hidden'); document.body.classList.remove('game-active'); document.documentElement.classList.remove('game-active');
    if (window.TRION_SHOW_TITLE) window.TRION_SHOW_TITLE(); else $('#titleScreen')?.classList.remove('hidden');
  }

  // Dedicated title guide and first-visit setup tour.
  let loggedIn = false;
  let authResolved = false;
  let activeGuideTarget = null;
  let setupGuideStep = 0;
  const setupGuideSteps = [
    { target: '.match-panel', title: '1. 試合ルール', text: '最初は「個人戦・市街・普通」のままで問題ありません。チュートリアルはモード列の右端からいつでも開始できます。' },
    { target: '.stats-panel', title: '2. 能力配分', text: '合計ポイント内でトリオン・技術・戦闘力を配分します。迷った場合は6・6・6の標準値を使ってください。' },
    { target: '.loadout-panel', title: '3. トリガーセット', text: 'MAIN 1–4は左クリック、SUB 5–8は右クリックで使います。選択したトリガーの説明も下に表示されます。' },
    { target: '.launch-panel', title: '4. 出撃', text: '隊カスタマイズや細かなキー設定は後回しでも遊べます。準備ができたらこのボタンから出撃してください。' },
  ];

  function ensureSetupGuide() {
    let panel = $('#setupGuideOverlay');
    if (panel) return panel;
    panel = document.createElement('div'); panel.id = 'setupGuideOverlay'; panel.className = 'setup-guide-overlay hidden';
    panel.innerHTML = '<div class="setup-guide-card"><span id="setupGuideCount"></span><h2 id="setupGuideTitle"></h2><p id="setupGuideText"></p><div><button id="setupGuideSkip" type="button">閉じる</button><button id="setupGuideNext" type="button">次へ</button></div></div>';
    document.body.appendChild(panel);
    $('#setupGuideSkip').addEventListener('click', () => closeSetupGuide(true));
    $('#setupGuideNext').addEventListener('click', () => { if (setupGuideStep >= setupGuideSteps.length - 1) closeSetupGuide(true); else { setupGuideStep += 1; renderSetupGuide(); } });
    return panel;
  }

  function renderSetupGuide() {
    const step = setupGuideSteps[setupGuideStep];
    activeGuideTarget?.classList.remove('setup-guide-focus');
    activeGuideTarget = $(step.target);
    if (activeGuideTarget?.tagName === 'DETAILS') activeGuideTarget.open = true;
    activeGuideTarget?.classList.add('setup-guide-focus');
    activeGuideTarget?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#setupGuideCount').textContent = `${setupGuideStep + 1} / ${setupGuideSteps.length}`;
    $('#setupGuideTitle').textContent = step.title; $('#setupGuideText').textContent = step.text;
    $('#setupGuideNext').textContent = setupGuideStep === setupGuideSteps.length - 1 ? 'ガイド完了' : '次へ';
  }

  function openSetupGuide(manual = false) {
    if (!manual && (loggedIn || storageGet('trionArenaSetupGuideSeenV67') === '1')) return;
    setupGuideStep = 0; ensureSetupGuide().classList.remove('hidden'); renderSetupGuide();
  }

  function closeSetupGuide(markSeen = false) {
    $('#setupGuideOverlay')?.classList.add('hidden'); activeGuideTarget?.classList.remove('setup-guide-focus'); activeGuideTarget = null;
    if (markSeen) storageSet('trionArenaSetupGuideSeenV67', '1');
  }

  function openGuide() { $('#titleGuidePanel')?.classList.remove('hidden'); }
  function closeGuide() { $('#titleGuidePanel')?.classList.add('hidden'); }

  window.addEventListener('trion:auth-state', (event) => { loggedIn = Boolean(event.detail?.loggedIn); authResolved = true; if (loggedIn) closeSetupGuide(false); });
  window.addEventListener('trion:setup-shown', (event) => {
    if (event.detail?.manualGuide) { setTimeout(() => openSetupGuide(true), 60); return; }
    setTimeout(() => { if (!authResolved) loggedIn = Boolean(window.trionOnline?.user && !window.trionOnline.user.is_anonymous); openSetupGuide(false); }, 850);
  });

  $('#titleGuideCloseButton')?.addEventListener('click', closeGuide);
  $('#titleGuidePanel')?.addEventListener('click', (event) => { if (event.target.id === 'titleGuidePanel') closeGuide(); });
  $('#guideStartTutorialButton')?.addEventListener('click', () => openTutorial('basic'));
  $('#guideOpenKeySettings')?.addEventListener('click', () => { closeGuide(); window.TRION_SHOW_SETUP?.({ controls: true }); });
  $('#guideEnterSetupButton')?.addEventListener('click', () => { closeGuide(); window.TRION_SHOW_SETUP?.(); });
  $('#setupGuideButton')?.addEventListener('click', () => openSetupGuide(true));
  $('#tutorialBackButton')?.addEventListener('click', closeTutorial);
  $('#tutorialResetButton')?.addEventListener('click', () => resetCourse(state.course));
  $('#tutorialSetupButton')?.addEventListener('click', () => { state.open = false; screen.classList.add('hidden'); document.body.classList.remove('game-active'); document.documentElement.classList.remove('game-active'); window.TRION_SHOW_SETUP?.({ guide: true }); });
  $('#tutorialNextButton')?.addEventListener('click', () => {
    if (!courseComplete()) return;
    const index = COURSE_ORDER.indexOf(state.course);
    if (index >= COURSE_ORDER.length - 1) { showMessage('全訓練完了！'); storageSet('trionArenaTutorialCompletedV67', '1'); return; }
    resetCourse(COURSE_ORDER[index + 1]);
  });
  $('#tutorialCourseTabs')?.addEventListener('click', (event) => { const button = event.target.closest('button[data-course]'); if (button) resetCourse(button.dataset.course); });

  window.addEventListener('keydown', handleKeyDown, true); window.addEventListener('keyup', handleKeyUp, true);
  canvas.addEventListener('pointermove', handlePointerMove); canvas.addEventListener('pointerdown', handlePointerDown); window.addEventListener('pointerup', handlePointerUp); canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  window.TRION_TUTORIAL = { open: openTutorial, close: closeTutorial, reset: resetCourse };
  window.TRION_ONBOARDING = { openGuide, closeGuide, openSetupGuide };
  updateUi(); requestAnimationFrame(frame);
})();
