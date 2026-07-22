/*
 * Supabase project configuration.
 * The publishable key is safe for browser code when Row Level Security is enabled.
 */
window.TRION_ONLINE_CONFIG = {
  enabled: true,
  supabaseUrl: 'https://fcjxzhmjyzbanmhmpdgq.supabase.co',
  supabaseKey: 'sb_publishable_VAmWTiWmnC_0xlOc340i4w_g-K_mXaz',
  registrationFunction: 'register-account-v2',
  snapshotHz: 6,
};

// VERSION 102 hotfix: stop recovery teleports without pushing units away from walls.
// Narrow-passage assistance only changes CPU velocity after a real positional stall.
(() => {
  'use strict';

  const clock = () => (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function blockingWalls(game) {
    return (game?.walls || []).filter((wall) => wall
      && wall.hp !== 0
      && !wall.nonBlocking
      && [wall.x, wall.y, wall.w, wall.h].every((value) => Number.isFinite(Number(value))));
  }

  function circleTouchesWall(game, x, y, radius) {
    return blockingWalls(game).some((wall) => x + radius > Number(wall.x)
      && x - radius < Number(wall.x) + Number(wall.w)
      && y + radius > Number(wall.y)
      && y - radius < Number(wall.y) + Number(wall.h));
  }

  function pathOpen(game, player, angle, distance) {
    const radius = Math.max(6, (Number(player.radius) || 18) - 2.25);
    const worldWidth = Number(game.world?.w) || Number(game.worldWidth) || 1920;
    const worldHeight = Number(game.world?.h) || Number(game.worldHeight) || 1080;
    const steps = Math.max(3, Math.min(18, Math.ceil(distance / 16)));
    for (let index = 1; index <= steps; index += 1) {
      const step = distance * index / steps;
      const x = Number(player.x) + Math.cos(angle) * step;
      const y = Number(player.y) + Math.sin(angle) * step;
      if (x < radius || x > worldWidth - radius || y < radius || y > worldHeight - radius) return false;
      if (circleTouchesWall(game, x, y, radius)) return false;
    }
    return true;
  }

  function hasIntentionalTeleport(game, effectStart, from, to) {
    return (game?.effects || []).slice(effectStart).some((effect) => {
      if (!effect || !/teleport/i.test(String(effect.type || ''))) return false;
      const a = { x: Number(effect.x), y: Number(effect.y) };
      const b = { x: Number(effect.x2), y: Number(effect.y2) };
      const forward = Math.hypot(a.x - from.x, a.y - from.y) < 48 && Math.hypot(b.x - to.x, b.y - to.y) < 48;
      const reverse = Math.hypot(b.x - from.x, b.y - from.y) < 48 && Math.hypot(a.x - to.x, a.y - to.y) < 48;
      return forward || reverse;
    });
  }

  function nearestTarget(game, player) {
    const resolved = game.resolveAITarget?.(player);
    if (resolved && !resolved.dead) return resolved;
    return (game.players || [])
      .filter((target) => target !== player && !target.dead && game.canDamage?.(player, target))
      .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0] || null;
  }

  function choosePassageAngle(game, player, targetAngle) {
    if (pathOpen(game, player, targetAngle, 92)) return targetAngle;
    const offsets = [0.24, -0.24, 0.48, -0.48, 0.76, -0.76, 1.08, -1.08, Math.PI / 2, -Math.PI / 2];
    let best = null;
    for (const offset of offsets) {
      const angle = targetAngle + offset;
      const nearOpen = pathOpen(game, player, angle, 44);
      const farOpen = pathOpen(game, player, angle, 96);
      if (!nearOpen) continue;
      const score = (farOpen ? 0 : 600) + Math.abs(offset) * 42;
      if (!best || score < best.score) best = { angle, score };
    }
    return best?.angle ?? targetAngle;
  }

  function installGamePatch(game) {
    if (!game || !Array.isArray(game.players)) return false;
    const prototype = Object.getPrototypeOf(game);
    const originalUpdate = prototype?.update;
    if (!prototype || typeof originalUpdate !== 'function') return false;
    if (prototype.v102StableWallContactHotfix) return true;
    if (!String(originalUpdate).includes('updateStallRecovery')) return false;

    prototype.update = function stableWallContactUpdate(dt) {
      const effectStart = (this.effects || []).length;
      const snapshots = new Map((this.players || []).map((player) => [player, {
        x: Number(player.x),
        y: Number(player.y),
        vx: Number(player.vx) || 0,
        vy: Number(player.vy) || 0,
        radius: Number(player.radius) || 18,
        nearWall: circleTouchesWall(this, Number(player.x), Number(player.y), (Number(player.radius) || 18) + 2.25),
      }]));

      const result = originalUpdate.call(this, dt);
      const time = clock();
      const seconds = clamp(Number(dt) || 1 / 60, 1 / 240, 0.1);

      for (const player of this.players || []) {
        const snapshot = snapshots.get(player);
        if (!snapshot || !player || player.dead || !Number.isFinite(Number(player.x)) || !Number.isFinite(Number(player.y))) continue;
        const pinball = time < Number(player.v101PinballActiveUntil || 0);
        const dx = Number(player.x) - snapshot.x;
        const dy = Number(player.y) - snapshot.y;
        const displacement = Math.hypot(dx, dy);
        const intentionalTeleport = hasIntentionalTeleport(this, effectStart, snapshot, { x: Number(player.x), y: Number(player.y) });

        // Only intervene when the old recovery code made a large jump while the unit was already at a wall.
        if (!pinball && !intentionalTeleport && snapshot.nearWall && displacement > 22) {
          const speed = Math.max(
            Number(player.speed) || 150,
            Math.hypot(snapshot.vx, snapshot.vy),
            Math.hypot(Number(player.vx) || 0, Number(player.vy) || 0),
          );
          const allowed = clamp(speed * seconds * 1.35 + 2, 4, 13);
          const ratio = allowed / Math.max(displacement, 0.001);
          player.x = snapshot.x + dx * ratio;
          player.y = snapshot.y + dy * ratio;
          this.resolveWallCollision?.(player);
          player.v102RecoveryJumpBlockedAt = time;
        }

        if (player.human || pinball || Number(player.v96Knockdown) > 0 || Number(player.v100Restrained) > 0) continue;
        player.v102StableMotion = player.v102StableMotion && typeof player.v102StableMotion === 'object'
          ? player.v102StableMotion
          : { x: Number(player.x), y: Number(player.y), movedAt: time, assistedAt: 0 };
        const motion = player.v102StableMotion;
        const moved = Math.hypot(Number(player.x) - motion.x, Number(player.y) - motion.y);
        if (moved > 3.5) {
          motion.x = Number(player.x);
          motion.y = Number(player.y);
          motion.movedAt = time;
        }

        const target = nearestTarget(this, player);
        if (!target) continue;
        const targetDistance = Math.hypot(Number(target.x) - Number(player.x), Number(target.y) - Number(player.y));
        const stalled = targetDistance > 105 && time - Number(motion.movedAt || time) > 900;
        if (!stalled || time - Number(motion.assistedAt || 0) < 460) continue;

        const targetAngle = Math.atan2(Number(target.y) - Number(player.y), Number(target.x) - Number(player.x));
        const angle = choosePassageAngle(this, player, targetAngle);
        const speed = Math.max(58, (Number(player.speed) || 150) * 0.44);
        const blend = 0.58;
        player.vx = (Number(player.vx) || 0) * (1 - blend) + Math.cos(angle) * speed * blend;
        player.vy = (Number(player.vy) || 0) * (1 - blend) + Math.sin(angle) * speed * blend;
        player.ai = player.ai && typeof player.ai === 'object' ? player.ai : {};
        player.ai.navPath = [];
        player.ai.navPathIndex = 0;
        delete player.v97MobilityRoute;
        motion.assistedAt = time;
      }
      return result;
    };

    prototype.v102StableWallContactHotfix = true;
    return true;
  }

  function applySniperBuff() {
    const triggers = window.WT_DATA?.triggers;
    if (!triggers?.egret || !triggers?.lightning || !triggers?.ibis) return false;
    triggers.egret.damage = 58;
    triggers.lightning.damage = 33;
    triggers.ibis.damage = 84;
    window.TRION_SNIPER_DAMAGE_BUFF = { egret: 58, lightning: 33, ibis: 84 };
    return true;
  }

  function install(attempt = 0) {
    const gameReady = installGamePatch(window.__TRION_GAME__);
    const sniperReady = applySniperBuff();
    if ((!gameReady || !sniperReady) && attempt < 120) setTimeout(() => install(attempt + 1), 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => install(), { once: true });
  else install();
})();
