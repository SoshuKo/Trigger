(() => {
  'use strict';

  const VERSION = 109;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const distance = (a, b) => Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
  const SUPPORT_TYPES = new Set(['sogetsu', 'fullarms', 'geist']);
  const patchedPrototypes = new WeakSet();
  const stateByGame = new WeakMap();
  const pressedKeys = new Set();
  let currentGame = null;
  let drag = null;
  let simulationBase = null;

  function gameState(game) {
    if (!stateByGame.has(game)) {
      stateByGame.set(game, {
        mode: 'auto',
        zoom: 1,
        lockedId: null,
        lastLockedPosition: null,
        freeCenterX: null,
        freeCenterY: null,
        allowTargetChange: false,
        physicalViewW: null,
        physicalViewH: null,
        renderingScaled: false,
        mapCoverApplied: null,
      });
    }
    return stateByGame.get(game);
  }

  function isSpectating(game) {
    return Boolean(game && game.spectating && !game.ended);
  }

  function liveTargets(game) {
    return (game?.players || []).filter((unit) => unit && !unit.dead);
  }

  function currentTarget(game) {
    return game?.getSpectatorTarget?.() || liveTargets(game)[0] || null;
  }

  function virtualView(game, state = gameState(game)) {
    const dpr = Math.max(.5, Number(game?.dpr) || Number(window.devicePixelRatio) || 1);
    const physicalW = Number(state.physicalViewW || game.viewW || (game.canvas?.width ? game.canvas.width / dpr : 0) || 1280);
    const physicalH = Number(state.physicalViewH || game.viewH || (game.canvas?.height ? game.canvas.height / dpr : 0) || 720);
    const worldW = Math.max(1, Number(game.world?.w) || physicalW);
    const worldH = Math.max(1, Number(game.world?.h) || physicalH);
    const minZoom = clamp(Math.max(physicalW / worldW, physicalH / worldH), .45, 1);
    const zoom = clamp(Number(state.zoom) || 1, minZoom, 2.25);
    if (Math.abs(Number(state.zoom) - zoom) > .0001) state.zoom = zoom;
    return { physicalW, physicalH, width: physicalW / zoom, height: physicalH / zoom, zoom, minZoom, dpr };
  }

  function initializeFreeCenter(game, state = gameState(game)) {
    const view = virtualView(game, state);
    if (!Number.isFinite(state.freeCenterX)) state.freeCenterX = (Number(game.camera?.x) || 0) + view.width / 2;
    if (!Number.isFinite(state.freeCenterY)) state.freeCenterY = (Number(game.camera?.y) || 0) + view.height / 2;
  }

  function clampFreeCenter(game, state = gameState(game)) {
    initializeFreeCenter(game, state);
    const view = virtualView(game, state);
    const halfW = Math.min(view.width / 2, game.world.w / 2);
    const halfH = Math.min(view.height / 2, game.world.h / 2);
    state.freeCenterX = clamp(state.freeCenterX, halfW, Math.max(halfW, game.world.w - halfW));
    state.freeCenterY = clamp(state.freeCenterY, halfH, Math.max(halfH, game.world.h - halfH));
  }

  function setSpectatorMode(game, mode) {
    if (!game || !['auto', 'lock', 'free'].includes(mode)) return;
    const state = gameState(game);
    state.mode = mode;
    if (mode === 'lock') {
      const target = currentTarget(game);
      state.lockedId = target?.id || state.lockedId;
      if (target) state.lastLockedPosition = { x: target.x, y: target.y, name: target.name, archetype: target.archetype };
    } else if (mode === 'free') {
      initializeFreeCenter(game, state);
    } else {
      state.lockedId = null;
      state.lastLockedPosition = null;
      if (!game.getSpectatorTarget?.()) game.ensureSpectatorTarget?.(1);
    }
    refreshPanel(game);
  }

  function adjustZoom(game, nextZoom, screenX = null, screenY = null) {
    if (!isSpectating(game)) return;
    const state = gameState(game);
    const previous = virtualView(game, state);
    const next = clamp(nextZoom, previous.minZoom, 2.25);
    if (Math.abs(next - state.zoom) < .001) return;

    if (state.mode === 'free') {
      initializeFreeCenter(game, state);
      const physicalX = Number.isFinite(screenX) ? screenX : previous.physicalW / 2;
      const physicalY = Number.isFinite(screenY) ? screenY : previous.physicalH / 2;
      const worldX = (Number(game.camera?.x) || 0) + physicalX / previous.zoom;
      const worldY = (Number(game.camera?.y) || 0) + physicalY / previous.zoom;
      state.zoom = next;
      const after = virtualView(game, state);
      const nextCameraX = worldX - physicalX / after.zoom;
      const nextCameraY = worldY - physicalY / after.zoom;
      state.freeCenterX = nextCameraX + after.width / 2;
      state.freeCenterY = nextCameraY + after.height / 2;
      clampFreeCenter(game, state);
    } else {
      state.zoom = next;
    }
    refreshPanel(game);
  }

  function cycleLockedTarget(game, direction) {
    if (!isSpectating(game)) return;
    const state = gameState(game);
    state.allowTargetChange = true;
    try {
      game.ensureSpectatorTarget?.(direction);
    } finally {
      state.allowTargetChange = false;
    }
    const target = currentTarget(game);
    state.mode = 'lock';
    state.lockedId = target?.id || null;
    if (target) state.lastLockedPosition = { x: target.x, y: target.y, name: target.name, archetype: target.archetype };
    refreshPanel(game);
  }

  function freePanVector() {
    let x = 0;
    let y = 0;
    if (pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft')) x -= 1;
    if (pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight')) x += 1;
    if (pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp')) y -= 1;
    if (pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown')) y += 1;
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length, moving: x !== 0 || y !== 0 };
  }

  function updateFreeCamera(game, dt, state) {
    initializeFreeCenter(game, state);
    const view = virtualView(game, state);
    const pan = freePanVector();
    if (pan.moving) {
      const speed = 920 / Math.max(.55, view.zoom);
      state.freeCenterX += pan.x * speed * dt;
      state.freeCenterY += pan.y * speed * dt;
    }
    clampFreeCenter(game, state);
    const targetX = state.freeCenterX - view.width / 2;
    const targetY = state.freeCenterY - view.height / 2;
    const follow = 1 - Math.pow(.00003, Math.max(0, dt));
    game.camera.x = lerp(Number(game.camera.x) || 0, targetX, follow);
    game.camera.y = lerp(Number(game.camera.y) || 0, targetY, follow);
    game.camera.x = clamp(game.camera.x, 0, Math.max(0, game.world.w - view.width));
    game.camera.y = clamp(game.camera.y, 0, Math.max(0, game.world.h - view.height));
  }

  function updateLockedCamera(game, dt, state) {
    const target = (game.players || []).find((unit) => unit?.id === state.lockedId) || null;
    if (target) state.lastLockedPosition = { x: target.x, y: target.y, name: target.name, archetype: target.archetype, dead: Boolean(target.dead) };
    const point = target || state.lastLockedPosition;
    if (!point) {
      setSpectatorMode(game, 'auto');
      return false;
    }
    const view = virtualView(game, state);
    const targetX = point.x - view.width / 2;
    const targetY = point.y - view.height / 2;
    const follow = 1 - Math.pow(.0008, Math.max(0, dt));
    game.camera.x = lerp(Number(game.camera.x) || 0, targetX, follow);
    game.camera.y = lerp(Number(game.camera.y) || 0, targetY, follow);
    game.camera.x = clamp(game.camera.x, 0, Math.max(0, game.world.w - view.width));
    game.camera.y = clamp(game.camera.y, 0, Math.max(0, game.world.h - view.height));
    return true;
  }

  function withVirtualView(game, callback) {
    const state = gameState(game);
    const view = virtualView(game, state);
    const oldW = game.viewW;
    const oldH = game.viewH;
    state.physicalViewW = Number(oldW) || state.physicalViewW || game.canvas?.width || 1280;
    state.physicalViewH = Number(oldH) || state.physicalViewH || game.canvas?.height || 720;
    game.viewW = view.width;
    game.viewH = view.height;
    try {
      return callback(view);
    } finally {
      game.viewW = oldW;
      game.viewH = oldH;
    }
  }

  function refreshPanel(game) {
    if (!isSpectating(game)) return;
    const state = gameState(game);
    const locked = state.lockedId ? (game.players || []).find((unit) => unit?.id === state.lockedId) : null;
    const target = state.mode === 'lock' ? (locked || state.lastLockedPosition) : currentTarget(game);
    const spectatorName = document.querySelector('#spectatorName');
    if (spectatorName) {
      const zoom = `${Math.round(state.zoom * 100)}%`;
      if (state.mode === 'free') spectatorName.textContent = `FIELD OVERVIEW / ${zoom}`;
      else if (state.mode === 'lock' && target) spectatorName.textContent = `LOCK ${target.name || 'UNIT'}${target.dead ? ' / BAILED OUT' : ''} / ${zoom}`;
      else spectatorName.textContent = `AUTO ${target?.name || 'UNIT'} / ${zoom}`;
    }
    const hint = document.querySelector('#spectatorHud small');
    if (hint) hint.textContent = 'SPACE：AUTO／LOCK／FREE　Q／E：対象変更　WASD・矢印：FREE移動　＋／－：ズーム　0：リセット';
  }

  function supportState(unit) {
    unit.v109SupportAI ||= {
      decisionTimer: 0,
      targetId: null,
      targetLockTimer: 0,
      side: Math.random() < .5 ? -1 : 1,
      comboSide: 0,
      lastUltimateAt: -999,
      lastWireAt: -999,
      guardTimer: 0,
      targetRefreshTimer: 0,
    };
    return unit.v109SupportAI;
  }

  function supportEnemies(game, unit) {
    return (game.players || []).filter((other) => other && other !== unit && !other.dead && game.canDamage?.(unit, other));
  }

  function chooseSupportTarget(game, unit, type, state) {
    state.targetLockTimer = Math.max(0, state.targetLockTimer || 0);
    const enemies = supportEnemies(game, unit);
    if (!enemies.length) return null;
    const flag = game.defenseFlag;
    const current = enemies.find((enemy) => enemy.id === state.targetId);
    if (current && state.targetLockTimer > 0) return current;

    const scored = enemies.map((enemy) => {
      const d = distance(unit, enemy);
      const hpRatio = enemy.hp / Math.max(1, enemy.maxHp || enemy.hp || 1);
      const flagDistance = flag ? distance(flag, enemy) : Infinity;
      const boss = Boolean(enemy.isDefenseBoss);
      const attackingFlag = enemy.defenseAI?.objectiveMode === 'flag' || enemy.defenseAI?.objectiveId === 'defense-flag';
      let score = d;
      if (boss) score *= .48;
      if (attackingFlag) score *= .45;
      if (flagDistance < 420) score *= .42;
      else if (flagDistance < 760) score *= .7;
      score *= .76 + hpRatio * .42;
      if (type === 'sogetsu' && d < 420) score *= .72;
      if (type === 'fullarms' && d > 280 && d < 900) score *= .8;
      if (type === 'geist' && (enemy.archetype?.includes('狙撃') || enemy.archetype?.includes('射手'))) score *= .78;
      return { enemy, score };
    }).sort((a, b) => a.score - b.score);

    const target = scored[0]?.enemy || current || enemies[0];
    state.targetId = target?.id || null;
    state.targetLockTimer = target?.isDefenseBoss ? 2.1 : 1.25;
    return target;
  }

  function countCluster(game, unit, target, radius = 260) {
    return supportEnemies(game, unit).filter((enemy) => distance(enemy, target) <= radius).length;
  }

  function lineBlocked(game, unit, target, padding = 3) {
    return Boolean(game.findBlockingWall?.(unit.x, unit.y, target.x, target.y, padding));
  }

  function useSupportAction(game, unit, hand, index, target, options = {}) {
    try {
      return Boolean(game.usePlayableDefenseAction?.(unit, hand, index, target, { ai: true, ...options }));
    } catch (error) {
      console.warn('[v109 support action]', error);
      return false;
    }
  }

  function supportGuard(game, unit, type, target) {
    const state = supportState(unit);
    if (state.guardTimer > 0) return false;
    const map = {
      sogetsu: { hand: 'main', index: 2 },
      fullarms: { hand: 'main', index: 2 },
      geist: { hand: 'main', index: 3 },
    };
    const selected = map[type];
    if (!selected) return false;
    const used = useSupportAction(game, unit, selected.hand, selected.index, target);
    if (used) state.guardTimer = .42;
    return used;
  }

  function moveSupport(game, unit, target, type, dt, state) {
    const d = distance(unit, target);
    const flag = game.defenseFlag || game.getTeamHome?.(unit.team) || null;
    const hpRatio = unit.hp / Math.max(1, unit.maxHp);
    const trionRatio = unit.trion / Math.max(1, unit.maxTrion);
    const flagRatio = flag?.maxHp ? flag.hp / Math.max(1, flag.maxHp) : 1;
    const retreat = hpRatio < .27 || trionRatio < .12;

    if (retreat && flag && distance(unit, flag) > 150) {
      game.moveDefenseEnemy?.(unit, flag, dt, 1.08);
      return;
    }

    let scale = .1;
    if (type === 'sogetsu') {
      const preferred = unit.sogetsuConnected ? 175 : 130;
      scale = d > preferred * 1.25 ? 1.22 : d < preferred * .55 ? -.32 : .24;
    } else if (type === 'fullarms') {
      const preferred = 455;
      scale = d > 650 ? .86 : d < 270 ? -.82 : d < preferred * .78 ? -.28 : .08;
    } else {
      const preferred = unit.geistActive ? 175 : 330;
      scale = d > preferred * 1.28 ? 1.05 : d < preferred * .58 ? -.5 : .14;
    }
    if (flag && flagRatio < .48 && distance(target, flag) < 720) scale = Math.max(scale, type === 'fullarms' ? .35 : 1.1);
    game.moveDefenseEnemy?.(unit, target, dt, scale);

    if (d > 120 && d < 760) {
      const angle = Math.atan2(target.y - unit.y, target.x - unit.x) + state.side * Math.PI / 2;
      const strafe = (type === 'fullarms' ? .44 : type === 'geist' ? .62 : .34) * unit.speed * dt;
      unit.vx = (unit.vx || 0) + Math.cos(angle) * strafe;
      unit.vy = (unit.vy || 0) + Math.sin(angle) * strafe;
    }
  }

  function decideSogetsu(game, unit, target, state, d, cluster) {
    const trionRatio = unit.trion / Math.max(1, unit.maxTrion);
    const flagThreat = game.defenseFlag && distance(target, game.defenseFlag) < 560;
    if (!unit.sogetsuConnected && trionRatio > .28 && d < 250 && (cluster >= 2 || target.isDefenseBoss || flagThreat)) {
      if (useSupportAction(game, unit, 'main', 3, target)) return .72;
    }
    if (d < 205) {
      const hand = state.comboSide++ % 2 === 0 ? 'main' : 'sub';
      if (useSupportAction(game, unit, hand, 0, target)) return unit.sogetsuConnected ? .58 : .34;
    }
    if (d < 570) {
      if (cluster >= 2 && useSupportAction(game, unit, 'sub', 1, target)) return .72;
      if (useSupportAction(game, unit, 'main', 1, target)) return .56;
    }
    if (useSupportAction(game, unit, 'main', 1, target)) return .64;
    return .22;
  }

  function decideFullarms(game, unit, target, state, d, cluster) {
    const trionRatio = unit.trion / Math.max(1, unit.maxTrion);
    const blocked = lineBlocked(game, unit, target, 3);
    if ((target.isDefenseBoss || cluster >= 3) && trionRatio > .42 && game.elapsed - state.lastUltimateAt > 10 && d < 880) {
      if (useSupportAction(game, unit, 'sub', 3, target)) {
        state.lastUltimateAt = game.elapsed;
        return 1.2;
      }
    }
    if (d < 155 && useSupportAction(game, unit, 'main', 0, target)) return .52;
    if (blocked) {
      if (cluster >= 2 && useSupportAction(game, unit, 'main', 1, target, { modifier: true })) return .72;
      if (useSupportAction(game, unit, 'sub', 1, target)) return .48;
    }
    if (d > 690 && useSupportAction(game, unit, 'main', 3, target)) return .68;
    if (cluster >= 2 && useSupportAction(game, unit, 'main', 1, target, { modifier: true })) return .68;
    const ownWires = (game.wires || []).filter((wire) => wire?.ownerId === unit.id && wire.ttl > 0).length;
    if (d > 250 && d < 560 && ownWires < 2 && game.elapsed - state.lastWireAt > 5.5) {
      if (useSupportAction(game, unit, 'sub', 2, target)) {
        state.lastWireAt = game.elapsed;
        return .62;
      }
    }
    if (d < 540 && Math.random() < .48 && useSupportAction(game, unit, 'main', 1, target)) return .56;
    if (d < 620 && useSupportAction(game, unit, 'sub', 0, target)) return .42;
    if (useSupportAction(game, unit, 'sub', 1, target)) return .5;
    return .22;
  }

  function decideGeist(game, unit, target, state, d, cluster) {
    const hpRatio = unit.hp / Math.max(1, unit.maxHp);
    const trionRatio = unit.trion / Math.max(1, unit.maxTrion);
    const flagRatio = game.defenseFlag?.maxHp ? game.defenseFlag.hp / Math.max(1, game.defenseFlag.maxHp) : 1;
    const blocked = lineBlocked(game, unit, target, 3);
    if (!unit.geistActive && trionRatio > .48 && (target.isDefenseBoss || cluster >= 2 || hpRatio < .76 || flagRatio < .64)) {
      if (useSupportAction(game, unit, 'sub', 1, target)) return .8;
    }
    if (d < (unit.geistActive ? 190 : 145) && useSupportAction(game, unit, 'main', 0, target)) return unit.geistActive ? .34 : .48;
    if (cluster >= 2 && d < 620 && useSupportAction(game, unit, 'sub', 2, target)) return .62;
    if (blocked) {
      if (unit.geistActive && useSupportAction(game, unit, 'main', 2, target)) return .42;
      if (useSupportAction(game, unit, 'sub', 0, target)) return .56;
    }
    if (unit.geistActive) {
      if (d < 540 && Math.random() < .52 && useSupportAction(game, unit, 'main', 1, target)) return .36;
      if (useSupportAction(game, unit, 'main', 2, target)) return .38;
    }
    if (d < 520 && useSupportAction(game, unit, 'main', 1, target)) return .48;
    if (useSupportAction(game, unit, 'main', 2, target)) return .52;
    return .22;
  }

  function updateSupportAI(game, unit, dt, type) {
    const state = supportState(unit);
    state.decisionTimer = Math.max(0, state.decisionTimer - dt);
    state.targetLockTimer = Math.max(0, state.targetLockTimer - dt);
    state.guardTimer = Math.max(0, state.guardTimer - dt);

    const target = chooseSupportTarget(game, unit, type, state);
    if (!target) {
      const flag = game.defenseFlag || game.getTeamHome?.(unit.team);
      if (flag && distance(unit, flag) > 280) game.moveDefenseEnemy?.(unit, flag, dt, .75);
      return true;
    }

    moveSupport(game, unit, target, type, dt, state);
    unit.aim = Math.atan2(target.y - unit.y, target.x - unit.x);

    const threat = game.getProjectileThreatInfo?.(unit, 1.05) || null;
    if (threat && threat.time < .28) {
      const profile = { calmness:.9, aggression:.72, guardSkill:.94, parrySkill:.62, dodgeSkill:.86 };
      const tier = { reaction:.48, defense:1.2 };
      if (game.aiTryDefensiveRead?.(unit, threat, profile, tier, dt)) {
        state.decisionTimer = Math.max(state.decisionTimer, .18);
        return true;
      }
      if (supportGuard(game, unit, type, target)) {
        state.decisionTimer = Math.max(state.decisionTimer, .2);
        return true;
      }
    }

    if (unit.hp < unit.maxHp * .34 && state.guardTimer <= 0 && supportGuard(game, unit, type, target)) {
      state.decisionTimer = Math.max(state.decisionTimer, .24);
      return true;
    }
    if (state.decisionTimer > 0) return true;

    const d = distance(unit, target);
    const cluster = countCluster(game, unit, target);
    let delay = .24;
    if (type === 'sogetsu') delay = decideSogetsu(game, unit, target, state, d, cluster);
    else if (type === 'fullarms') delay = decideFullarms(game, unit, target, state, d, cluster);
    else delay = decideGeist(game, unit, target, state, d, cluster);
    state.decisionTimer = Math.max(.14, delay);
    return true;
  }


  const CITY_COVER_SPECS = [
    ['car-01', 620, 2020, 112, 48], ['car-02', 1120, 2245, 104, 46], ['car-03', 1810, 2012, 118, 50],
    ['car-04', 2440, 2240, 108, 48], ['car-05', 3670, 2020, 116, 50], ['car-06', 4490, 2240, 108, 48],
    ['car-07', 5450, 2010, 120, 50], ['barrier-01', 3025, 1020, 54, 126], ['barrier-02', 3355, 1370, 56, 120],
    ['barrier-03', 3020, 2860, 58, 126], ['barrier-04', 3348, 3210, 56, 122], ['planter-01', 2570, 1740, 82, 82],
    ['planter-02', 3730, 1740, 82, 82], ['planter-03', 2570, 2510, 82, 82], ['planter-04', 3730, 2510, 82, 82],
    ['kiosk-01', 760, 730, 92, 62], ['kiosk-02', 1180, 730, 92, 62], ['kiosk-03', 5130, 3470, 96, 62],
    ['crate-01', 2130, 3560, 72, 72], ['crate-02', 2250, 3560, 72, 72], ['crate-03', 4230, 3560, 72, 72],
    ['crate-04', 4350, 3560, 72, 72], ['utility-01', 3070, 690, 72, 54], ['utility-02', 3290, 690, 72, 54],
  ];

  const DESERT_COVER_SPECS = [
    ['rock-01', 520, 1880, 94, 82], ['rock-02', 920, 2240, 84, 96], ['rock-03', 1480, 1870, 118, 78],
    ['rock-04', 2180, 2250, 96, 88], ['rock-05', 3660, 1860, 110, 82], ['rock-06', 4380, 2250, 90, 96],
    ['rock-07', 5200, 1870, 122, 80], ['rock-08', 5780, 2240, 96, 92], ['ruin-01', 760, 790, 150, 54],
    ['ruin-02', 1160, 790, 54, 146], ['ruin-03', 2050, 790, 138, 54], ['ruin-04', 3930, 3420, 148, 54],
    ['ruin-05', 4680, 3420, 54, 144], ['ruin-06', 5480, 3420, 146, 54], ['crate-01', 2740, 1880, 74, 74],
    ['crate-02', 2840, 1880, 74, 74], ['crate-03', 3460, 2260, 74, 74], ['crate-04', 3560, 2260, 74, 74],
    ['wreck-01', 3110, 1120, 128, 58], ['wreck-02', 3110, 3020, 128, 58], ['sandbag-01', 2550, 2140, 152, 38],
    ['sandbag-02', 3740, 2140, 152, 38], ['sandbag-03', 3090, 1640, 38, 152], ['sandbag-04', 3090, 2620, 38, 152],
  ];

  function rectanglesOverlap(a, b, margin = 8) {
    return !(a.x + a.w + margin <= b.x || b.x + b.w + margin <= a.x || a.y + a.h + margin <= b.y || b.y + b.h + margin <= a.y);
  }

  function refreshWallSpatialIndex(game) {
    game.wallSpatialIndexDirty = true;
    game.wallIndexDirty = true;
    game._wallSpatialIndexDirty = true;
    game._wallIndexDirty = true;
    game.wallSpatialIndexVersion = -1;
    game._wallSpatialIndexVersion = -1;
    for (const name of ['invalidateWallSpatialIndex', 'markWallSpatialIndexDirty', 'rebuildWallSpatialIndex', 'buildWallSpatialIndex']) {
      if (typeof game[name] !== 'function') continue;
      try { game[name](); } catch (_) { }
      break;
    }
  }

  function ensureMapCover(game) {
    if (!game || !Array.isArray(game.walls) || !game.world || !['city', 'desert'].includes(game.mapId)) return 0;
    const state = gameState(game);
    if (state.mapCoverApplied === game.mapId) return 0;
    const specs = game.mapId === 'city' ? CITY_COVER_SPECS : DESERT_COVER_SPECS;
    const sx = Math.max(.5, Number(game.world.w || 6400) / 6400);
    const sy = Math.max(.5, Number(game.world.h || 4400) / 4400);
    const type = game.mapId === 'city' ? 'barricade' : 'fortressWall';
    let added = 0;
    for (const [suffix, rawX, rawY, rawW, rawH] of specs) {
      const id = `v109-${game.mapId}-${suffix}`;
      if (game.walls.some((wall) => wall?.id === id)) continue;
      const rect = {
        id,
        x: Math.round(rawX * sx), y: Math.round(rawY * sy),
        w: Math.max(28, Math.round(rawW * sx)), h: Math.max(28, Math.round(rawH * sy)),
        type, hp: game.mapId === 'city' ? 230 : 310, maxHp: game.mapId === 'city' ? 230 : 310,
        ttl: Infinity, respawnable: true, respawnDelay: game.mapId === 'city' ? [42, 66] : [58, 82],
        v109Cover: true,
      };
      const centerX = rect.x + rect.w / 2;
      const centerY = rect.y + rect.h / 2;
      if (game.mapId === 'city' && game.isInRiver?.(centerX, centerY)) continue;
      if (game.walls.some((wall) => wall && wall.hp !== 0 && rectanglesOverlap(rect, wall, 5))) continue;
      game.walls.push(rect);
      added += 1;
    }
    state.mapCoverApplied = game.mapId;
    if (added) refreshWallSpatialIndex(game);
    return added;
  }

  function isSoloSelected() {
    return Boolean(document.querySelector('#modeSelector button[data-mode="solo"].active'));
  }

  function dispatchInput(element) {
    if (!element) return;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function installSetupFixes() {
    const colorInput = document.querySelector('#bodyColor');
    const modeSelector = document.querySelector('#modeSelector');
    const resetButton = document.querySelector('#resetCpuConfigsButton');
    const colorKey = 'trion-v109-solo-body-color';
    let savedSoloColor = null;
    try { savedSoloColor = localStorage.getItem(colorKey); } catch (_) { }
    if (!savedSoloColor && colorInput?.value) savedSoloColor = colorInput.value;

    const rememberColor = () => {
      if (!colorInput?.value) return;
      savedSoloColor = colorInput.value;
      try { localStorage.setItem(colorKey, savedSoloColor); } catch (_) { }
    };
    const restoreSoloColor = () => {
      if (!colorInput || !isSoloSelected()) return;
      const color = savedSoloColor || colorInput.value || '#4aa8ff';
      if (colorInput.value !== color) colorInput.value = color;
      dispatchInput(colorInput);
      document.documentElement.style.setProperty('--v109-player-color', color);
      document.querySelectorAll('[data-player-color-preview],.player-color-preview,.character-color-preview').forEach((node) => {
        node.style.setProperty('--body-color', color);
        if (node.matches('[data-player-color-preview],.character-color-preview')) node.style.backgroundColor = color;
      });
    };

    colorInput?.addEventListener('input', rememberColor, true);
    modeSelector?.addEventListener('click', (event) => {
      const button = event.target.closest?.('button[data-mode]');
      if (!button) return;
      if (button.dataset.mode !== 'solo') {
        rememberColor();
        return;
      }
      requestAnimationFrame(() => {
        restoreSoloColor();
        requestAnimationFrame(restoreSoloColor);
      });
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest?.('#startButton') || !isSoloSelected()) return;
      restoreSoloColor();
    }, true);

    if (resetButton && !resetButton.dataset.v109OneClickReset) {
      resetButton.dataset.v109OneClickReset = 'true';
      let forwarding = false;
      document.addEventListener('click', (event) => {
        const button = event.target.closest?.('#resetCpuConfigsButton');
        if (!button || forwarding) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        forwarding = true;
        const fire = () => button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        fire();
        requestAnimationFrame(() => {
          fire();
          forwarding = false;
        });
      }, true);
    }
  }

  function installMobileUi() {
    const root = document.querySelector('#mobileControls');
    if (!root || root.dataset.v109MobileUi) return;
    root.dataset.v109MobileUi = 'true';
    root.classList.add('v109-mobile-controls');
    const labels = {
      main: 'MAIN ATTACK', sub: 'SUB ATTACK', KeyC: 'COMBINE', shift: 'MODIFIER', KeyZ: 'UTILITY', KeyR: 'SCOPE', KeyF: 'FLAG',
    };
    root.querySelectorAll('button').forEach((button) => {
      const key = button.dataset.mobileHold || button.dataset.mobileKey || '';
      const label = labels[key] || (key.startsWith('Digit') ? `SLOT ${key.slice(5)}` : button.textContent.trim());
      button.setAttribute('aria-label', label);
      button.dataset.v109Label = label;
    });
    const guide = document.querySelector('.guide-mobile');
    if (guide) guide.innerHTML = '<b>左パッド</b><span>移動</span><b>右パッド</b><span>照準</span><b>MAIN / SUB</b><span>攻撃</span><b>1–8</b><span>装備選択</span><b>C / SHIFT / Z</b><span>連携・補助</span><b>SCOPE / FLAG</b><span>狙撃・防衛</span>';
  }

  function patchGame(game) {
    if (!game || !game.constructor) return;
    currentGame = game;
    ensureMapCover(game);
    const state = gameState(game);
    state.physicalViewW = Number(game.viewW) || state.physicalViewW;
    state.physicalViewH = Number(game.viewH) || state.physicalViewH;
    const proto = Object.getPrototypeOf(game);
    if (!proto || patchedPrototypes.has(proto)) {
      refreshPanel(game);
      return;
    }
    patchedPrototypes.add(proto);

    const oldEnsureSpectatorTarget = proto.ensureSpectatorTarget;
    if (typeof oldEnsureSpectatorTarget === 'function') {
      proto.ensureSpectatorTarget = function(direction = 1) {
        const local = gameState(this);
        if (this.spectating && local.mode === 'lock' && local.lockedId && !local.allowTargetChange) {
          return (this.players || []).find((unit) => unit?.id === local.lockedId) || local.lastLockedPosition || null;
        }
        const result = oldEnsureSpectatorTarget.call(this, direction);
        if (this.spectating && local.mode === 'lock') {
          const target = this.getSpectatorTarget?.();
          if (target) {
            local.lockedId = target.id;
            local.lastLockedPosition = { x:target.x, y:target.y, name:target.name, archetype:target.archetype };
          }
        }
        return result;
      };
    }

    const oldUpdateCamera = proto.updateCamera;
    if (typeof oldUpdateCamera === 'function') {
      proto.updateCamera = function(dt) {
        const local = gameState(this);
        local.physicalViewW = Number(this.viewW) || local.physicalViewW;
        local.physicalViewH = Number(this.viewH) || local.physicalViewH;
        if (!this.spectating) return oldUpdateCamera.call(this, dt);
        if (local.mode === 'free') {
          updateFreeCamera(this, dt, local);
          refreshPanel(this);
          return;
        }
        if (local.mode === 'lock' && updateLockedCamera(this, dt, local)) {
          refreshPanel(this);
          return;
        }
        const result = withVirtualView(this, () => oldUpdateCamera.call(this, dt));
        refreshPanel(this);
        return result;
      };
    }

    const oldRender = proto.render;
    if (typeof oldRender === 'function') {
      proto.render = function(...args) {
        const local = gameState(this);
        local.physicalViewW = Number(this.viewW) || local.physicalViewW;
        local.physicalViewH = Number(this.viewH) || local.physicalViewH;
        if (!this.spectating || Math.abs(local.zoom - 1) < .001) return oldRender.apply(this, args);
        const ctx = this.ctx;
        return withVirtualView(this, (view) => {
          ctx.save();
          // Clear in device pixels first so zoom changes never leave stale strips.
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, this.canvas?.width || Math.ceil(view.physicalW * view.dpr), this.canvas?.height || Math.ceil(view.physicalH * view.dpr));
          // Keep the game's DPR transform and apply spectator zoom on top of it.
          ctx.setTransform(view.dpr * view.zoom, 0, 0, view.dpr * view.zoom, 0, 0);
          local.renderingScaled = true;
          try {
            return oldRender.apply(this, args);
          } finally {
            local.renderingScaled = false;
            ctx.restore();
          }
        });
      };
    }

    const oldDrawRadar = proto.drawRadar;
    if (typeof oldDrawRadar === 'function') {
      proto.drawRadar = function(...args) {
        if (!this.spectating || Math.abs(gameState(this).zoom - 1) < .001) return oldDrawRadar.apply(this, args);
        return withVirtualView(this, () => oldDrawRadar.apply(this, args));
      };
    }

    const oldScreenToWorld = proto.screenToWorld;
    if (typeof oldScreenToWorld === 'function') {
      proto.screenToWorld = function(x, y) {
        const local = gameState(this);
        if (!this.spectating || local.renderingScaled || Math.abs(local.zoom - 1) < .001) return oldScreenToWorld.call(this, x, y);
        return { x: x / local.zoom + this.camera.x, y: y / local.zoom + this.camera.y };
      };
    }

    const oldWorldToScreen = proto.worldToScreen;
    if (typeof oldWorldToScreen === 'function') {
      proto.worldToScreen = function(x, y) {
        const local = gameState(this);
        if (!this.spectating || local.renderingScaled || Math.abs(local.zoom - 1) < .001) return oldWorldToScreen.call(this, x, y);
        return { x: (x - this.camera.x) * local.zoom, y: (y - this.camera.y) * local.zoom };
      };
    }


    const oldApplyTerrainPhysics = proto.applyTerrainPhysics;
    if (typeof oldApplyTerrainPhysics === 'function') {
      proto.applyTerrainPhysics = function(player, dt) {
        const terrain = this.terrain || {};
        if (this.mapId === 'city' && Array.isArray(terrain.forests) && terrain.forests.length) {
          const forests = terrain.forests;
          terrain.forests = [];
          try { return oldApplyTerrainPhysics.call(this, player, dt); }
          finally { terrain.forests = forests; }
        }
        if (this.mapId === 'underground' && Array.isArray(terrain.subwayWaterways) && terrain.subwayWaterways.length) {
          const waterways = terrain.subwayWaterways;
          terrain.subwayWaterways = [];
          let result;
          try { result = oldApplyTerrainPhysics.call(this, player, dt); }
          finally { terrain.subwayWaterways = waterways; }
          const level = clamp(Number(this.subwayWaterLevel?.() ?? (this.environment?.subway?.waterDrained ? 0 : 1)), 0, 1);
          const water = level > .02 ? waterways.find((zone) => this.isPointInRect?.(player.x, player.y, zone)) : null;
          if (water) {
            const factor = lerp(1, .58, level);
            player.vx = Number(player.vx || 0) * factor + Number(water.flowX || 0) * dt * level;
            player.vy = Number(player.vy || 0) * factor + Number(water.flowY || 0) * dt * level;
            player.v109SubwayWaterSlow = level;
          } else {
            player.v109SubwayWaterSlow = 0;
          }
          return result;
        }
        return oldApplyTerrainPhysics.call(this, player, dt);
      };
    }

    const oldUpdatePlayableDefenseAI = proto.updatePlayableDefenseAI;
    if (typeof oldUpdatePlayableDefenseAI === 'function') {
      proto.updatePlayableDefenseAI = function(unit, dt) {
        const type = unit?.playableDefenseType || unit?.defenseSupportType;
        if (unit && !unit.dead && SUPPORT_TYPES.has(type)) return updateSupportAI(this, unit, dt, type);
        return oldUpdatePlayableDefenseAI.call(this, unit, dt);
      };
    }

    refreshPanel(game);
  }

  function installSimulationApi() {
    const api = window.TRION_SIMULATION_API;
    if (!api || typeof api.runMatch !== 'function') return;
    if (api.runMatch !== simulationBase && !api.runMatch.v109Wrapped) {
      const base = api.runMatch.bind(api);
      const wrapped = async (request) => {
        const result = await base(request);
        if (result && typeof result === 'object') {
          result.gameVersion = Math.max(VERSION, Number(result.gameVersion || 0));
          result.featureVersion = VERSION;
          result.spectatorCameraVersion = VERSION;
          result.supportAiVersion = VERSION;
        }
        return result;
      };
      wrapped.v109Wrapped = true;
      simulationBase = wrapped;
      api.runMatch = wrapped;
    }
    api.version = VERSION;
    api.v109Wrapped = true;
  }

  function syncVersion() {
    document.querySelectorAll('.version-badge,[data-version],#version,.version').forEach((element) => {
      const text = element.textContent || '';
      if (/VERSION\s*\d+/i.test(text) || element.matches('.version-badge,[data-version],#version')) element.textContent = `VERSION ${VERSION}`;
    });
    document.documentElement.dataset.gameVersion = String(VERSION);
    if (/VERSION\s*\d+/i.test(document.title)) document.title = document.title.replace(/VERSION\s*\d+/ig, `VERSION ${VERSION}`);
  }

  function bindGlobalControls() {
    window.addEventListener('keydown', (event) => {
      pressedKeys.add(event.code);
      if (!currentGame || !isSpectating(currentGame)) return;
      const state = gameState(currentGame);
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        const next = state.mode === 'auto' ? 'lock' : state.mode === 'lock' ? 'free' : 'auto';
        setSpectatorMode(currentGame, next);
      } else if ((event.code === 'Equal' || event.code === 'NumpadAdd') && !event.repeat) {
        event.preventDefault();
        adjustZoom(currentGame, state.zoom * 1.12);
      } else if ((event.code === 'Minus' || event.code === 'NumpadSubtract') && !event.repeat) {
        event.preventDefault();
        adjustZoom(currentGame, state.zoom / 1.12);
      } else if ((event.code === 'Digit0' || event.code === 'Numpad0') && !event.repeat) {
        event.preventDefault();
        adjustZoom(currentGame, 1);
      } else if (state.mode === 'lock' && event.code === 'KeyQ' && !event.repeat) {
        event.preventDefault();
        cycleLockedTarget(currentGame, -1);
      } else if (state.mode === 'lock' && event.code === 'KeyE' && !event.repeat) {
        event.preventDefault();
        cycleLockedTarget(currentGame, 1);
      } else if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) {
        if (state.mode !== 'free') setSpectatorMode(currentGame, 'free');
        if (event.code.startsWith('Arrow')) event.preventDefault();
      }
    }, true);
    window.addEventListener('keyup', (event) => pressedKeys.delete(event.code), true);
    window.addEventListener('blur', () => { pressedKeys.clear(); drag = null; });

    document.addEventListener('wheel', (event) => {
      if (!currentGame || !isSpectating(currentGame) || !event.target.closest?.('#gameCanvas')) return;
      event.preventDefault();
      const canvas = currentGame.canvas;
      const rect = canvas.getBoundingClientRect();
      const physicalX = (event.clientX - rect.left) * ((currentGame.viewW || canvas.width) / Math.max(1, rect.width));
      const physicalY = (event.clientY - rect.top) * ((currentGame.viewH || canvas.height) / Math.max(1, rect.height));
      const state = gameState(currentGame);
      adjustZoom(currentGame, state.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), physicalX, physicalY);
    }, { passive:false, capture:true });

    document.addEventListener('pointerdown', (event) => {
      const canvas = event.target.closest?.('#gameCanvas');
      if (!canvas || !currentGame || !isSpectating(currentGame) || event.button !== 0) return;
      const state = gameState(currentGame);
      setSpectatorMode(currentGame, 'free');
      initializeFreeCenter(currentGame, state);
      drag = { pointerId:event.pointerId, x:event.clientX, y:event.clientY };
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    }, true);
    document.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId || !currentGame || !isSpectating(currentGame)) return;
      const state = gameState(currentGame);
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;
      state.freeCenterX -= dx / Math.max(.45, state.zoom);
      state.freeCenterY -= dy / Math.max(.45, state.zoom);
      clampFreeCenter(currentGame, state);
      event.preventDefault();
    }, true);
    document.addEventListener('pointerup', (event) => {
      if (drag?.pointerId === event.pointerId) drag = null;
    }, true);
    document.addEventListener('pointercancel', () => { drag = null; }, true);
  }

  function captureGame() {
    const game = window.__TRION_GAME__;
    if (game) patchGame(game);
  }

  function initialize() {
    installSetupFixes();
    installMobileUi();
    bindGlobalControls();
    syncVersion();
    captureGame();
    installSimulationApi();
    window.TRION_V109_AUDIT = {
      version: VERSION,
      spectatorModes: ['auto','lock','free'],
      zoomRange: [.45, 2.25],
      dprSafeZoom: true,
      worldFitClamp: true,
      supportTypes: [...SUPPORT_TYPES],
      fixes: {
        soloColorSync: true,
        mobileUi: true,
        cityForestSlowRemoved: true,
        cityCoverProps: CITY_COVER_SPECS.length,
        desertCoverProps: DESERT_COVER_SPECS.length,
        undergroundWaterSlow: .58,
        oneClickRosterReset: true,
      },
      testHooks: { ensureMapCover, patchGame },
    };
    const timer = window.setInterval(() => {
      captureGame();
      installSimulationApi();
      syncVersion();
      if (currentGame) refreshPanel(currentGame);
    }, 750);
    window.addEventListener('beforeunload', () => window.clearInterval(timer), { once:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once:true });
  else initialize();
})();
