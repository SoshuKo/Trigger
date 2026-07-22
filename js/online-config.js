/*
 * Supabase project configuration.
 *
 * The publishable key is safe for browser code when Row Level Security is enabled.
 * The service-role/secret key is used only inside the Supabase Edge Function and
 * must never be placed in this file or committed to GitHub.
 */
window.TRION_ONLINE_CONFIG = {
  enabled: true,
  supabaseUrl: 'https://fcjxzhmjyzbanmhmpdgq.supabase.co',
  supabaseKey: 'sb_publishable_VAmWTiWmnC_0xlOc340i4w_g-K_mXaz',
  registrationFunction: 'register-account-v2',
  snapshotHz: 6,
};

// v102 hotfix: stop wall-recovery warps, keep CPU moving around walls,
// and raise the baseline damage of all three sniper rifles.
(() => {
  'use strict';

  const clock = () => (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const angleDelta = (to, from) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

  function activeWalls(game) {
    return (game?.walls || []).filter((wall) => wall
      && wall.hp !== 0
      && !wall.nonBlocking
      && Number.isFinite(wall.x)
      && Number.isFinite(wall.y)
      && Number.isFinite(wall.w)
      && Number.isFinite(wall.h));
  }

  function circleHitsWall(game, x, y, radius) {
    return activeWalls(game).some((wall) => x + radius > wall.x
      && x - radius < wall.x + wall.w
      && y + radius > wall.y
      && y - radius < wall.y + wall.h);
  }

  function pathTouchesWall(game, x1, y1, x2, y2, radius) {
    const distance = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(2, Math.min(12, Math.ceil(distance / 24)));
    for (let index = 0; index <= steps; index += 1) {
      const ratio = index / steps;
      if (circleHitsWall(game, x1 + (x2 - x1) * ratio, y1 + (y2 - y1) * ratio, radius)) return true;
    }
    return false;
  }

  function nearestWallNormal(game, x, y, radius) {
    let best = null;
    for (const wall of activeWalls(game)) {
      const closestX = clamp(x, wall.x, wall.x + wall.w);
      const closestY = clamp(y, wall.y, wall.y + wall.h);
      let dx = x - closestX;
      let dy = y - closestY;
      let distance = Math.hypot(dx, dy);
      if (distance < 0.001) {
        const exits = [
          { depth: Math.abs(x - wall.x), nx: -1, ny: 0 },
          { depth: Math.abs(x - (wall.x + wall.w)), nx: 1, ny: 0 },
          { depth: Math.abs(y - wall.y), nx: 0, ny: -1 },
          { depth: Math.abs(y - (wall.y + wall.h)), nx: 0, ny: 1 },
        ].sort((a, b) => a.depth - b.depth);
        const exit = exits[0];
        dx = exit.nx;
        dy = exit.ny;
        distance = 1;
      }
      const gap = distance - radius;
      if (gap > 58) continue;
      const candidate = { nx: dx / distance, ny: dy / distance, gap };
      if (!best || candidate.gap < best.gap) best = candidate;
    }
    return best;
  }

  function directionIsOpen(game, player, angle, distance) {
    const radius = (Number(player.radius) || 18) + 6;
    return !circleHitsWall(
      game,
      Number(player.x) + Math.cos(angle) * distance,
      Number(player.y) + Math.sin(angle) * distance,
      radius,
    );
  }

  function chooseSlideAngle(game, player, targetAngle, previousAngle = null) {
    if (Number.isFinite(previousAngle)
      && directionIsOpen(game, player, previousAngle, 46)
      && directionIsOpen(game, player, previousAngle, 104)) return previousAngle;

    const normal = nearestWallNormal(game, Number(player.x), Number(player.y), (Number(player.radius) || 18) + 8);
    const tangentA = normal ? Math.atan2(normal.ny, normal.nx) + Math.PI / 2 : targetAngle + Math.PI / 2;
    const tangentB = tangentA + Math.PI;
    const candidates = [
      tangentA,
      tangentB,
      targetAngle + Math.PI / 2,
      targetAngle - Math.PI / 2,
      targetAngle + 0.92,
      targetAngle - 0.92,
      targetAngle + Math.PI,
    ];
    let selected = candidates[0];
    let selectedScore = Infinity;
    for (const angle of candidates) {
      const nearBlocked = !directionIsOpen(game, player, angle, 46);
      const farBlocked = !directionIsOpen(game, player, angle, 104);
      const score = (nearBlocked ? 2000 : 0)
        + (farBlocked ? 700 : 0)
        + Math.abs(angleDelta(angle, targetAngle)) * 38
        + (Number.isFinite(previousAngle) ? Math.abs(angleDelta(angle, previousAngle)) * 20 : 0);
      if (score < selectedScore) {
        selected = angle;
        selectedScore = score;
      }
    }
    return selected;
  }

  function clearNavigation(player) {
    player.ai = player.ai && typeof player.ai === 'object' ? player.ai : {};
    player.ai.navPath = [];
    player.ai.navPathIndex = 0;
    player.ai.dangerEscapeTimer = 0;
    player.ai.v98HazardUntil = 0;
    delete player.ai.v98HazardAngle;
    delete player.v97MobilityRoute;
  }

  function hasTeleportEffect(game, effectStart, fromX, fromY, toX, toY) {
    return (game?.effects || []).slice(effectStart).some((effect) => {
      if (!effect || !/teleport/i.test(String(effect.type || ''))) return false;
      const x1 = Number(effect.x);
      const y1 = Number(effect.y);
      const x2 = Number(effect.x2);
      const y2 = Number(effect.y2);
      const forward = Math.hypot(x1 - fromX, y1 - fromY) < 48 && Math.hypot(x2 - toX, y2 - toY) < 48;
      const reverse = Math.hypot(x2 - fromX, y2 - fromY) < 48 && Math.hypot(x1 - toX, y1 - toY) < 48;
      return forward || reverse;
    });
  }

  function applyWallSlide(game, player, targetAngle, time, force = false) {
    const previous = time < Number(player.v102WallSlideUntil || 0)
      ? Number(player.v102WallSlideAngle)
      : null;
    const angle = chooseSlideAngle(game, player, targetAngle, previous);
    const speed = Math.max(122, (Number(player.speed) || 150) * 0.82);
    if (!force && !directionIsOpen(game, player, angle, 42)) return false;
    player.vx = Math.cos(angle) * speed;
    player.vy = Math.sin(angle) * speed;
    player.v102WallSlideAngle = angle;
    player.v102WallSlideUntil = time + 760;
    clearNavigation(player);
    return true;
  }

  function patchGame(game) {
    if (!game || !Array.isArray(game.players)) return false;
    const prototype = Object.getPrototypeOf(game);
    const originalUpdate = prototype?.update;
    if (!prototype || prototype.v102WallSlideHotfix || typeof originalUpdate !== 'function') {
      return Boolean(prototype?.v102WallSlideHotfix);
    }
    if (!prototype.v102WallWarpHotfix && !String(originalUpdate).includes('updateStallRecovery')) return false;

    prototype.update = function wallSlideSafeUpdate(dt) {
      const effectStart = (this.effects || []).length;
      const snapshots = (this.players || []).map((player) => ({
        player,
        x: Number(player.x),
        y: Number(player.y),
        vx: Number(player.vx) || 0,
        vy: Number(player.vy) || 0,
        radius: Number(player.radius) || 18,
      }));
      const result = originalUpdate.call(this, dt);
      const time = clock();

      for (const snapshot of snapshots) {
        const player = snapshot.player;
        if (!player || player.dead || !Number.isFinite(player.x) || !Number.isFinite(player.y)) continue;
        const dx = Number(player.x) - snapshot.x;
        const dy = Number(player.y) - snapshot.y;
        const displacement = Math.hypot(dx, dy);
        const speedAfter = Math.hypot(Number(player.vx) || 0, Number(player.vy) || 0);
        const seconds = clamp(Number(dt) || 1 / 60, 1 / 240, 0.1);
        const allowed = Math.max(34, (Math.max(Math.hypot(snapshot.vx, snapshot.vy), speedAfter) * seconds * 3.2) + 24);
        const pinball = time < Number(player.v101PinballActiveUntil || 0);
        const intentionalTeleport = hasTeleportEffect(this, effectStart, snapshot.x, snapshot.y, Number(player.x), Number(player.y));
        const wallRelated = circleHitsWall(this, snapshot.x, snapshot.y, snapshot.radius + 5)
          || circleHitsWall(this, Number(player.x), Number(player.y), snapshot.radius + 5)
          || pathTouchesWall(this, snapshot.x, snapshot.y, Number(player.x), Number(player.y), snapshot.radius + 3)
          || time - Number(player.v102WallWarpPreventedAt || 0) < 180;

        if (!pinball && !intentionalTeleport && wallRelated && displacement > allowed) {
          player.x = snapshot.x;
          player.y = snapshot.y;
          this.resolveWallCollision?.(player);
          const target = !player.human ? (this.resolveAITarget?.(player) || null) : null;
          const targetAngle = target
            ? Math.atan2(Number(target.y) - Number(player.y), Number(target.x) - Number(player.x))
            : (Number(player.aim) || Math.atan2(snapshot.vy, snapshot.vx) || 0);
          applyWallSlide(this, player, targetAngle, time, true);
          player.v102WallWarpPreventedAt = time;
        }

        if (player.human || Number(player.v96Knockdown) > 0 || Number(player.v100Restrained) > 0 || pinball) continue;
        player.v102WallMotion = player.v102WallMotion && typeof player.v102WallMotion === 'object'
          ? player.v102WallMotion
          : { x: Number(player.x), y: Number(player.y), movedAt: time };
        const motion = player.v102WallMotion;
        const moved = Math.hypot(Number(player.x) - motion.x, Number(player.y) - motion.y);
        if (moved > 5 || speedAfter > 38) {
          motion.x = Number(player.x);
          motion.y = Number(player.y);
          motion.movedAt = time;
        }
        const target = this.resolveAITarget?.(player) || (this.players || [])
          .filter((candidate) => candidate !== player && !candidate.dead && this.canDamage?.(player, candidate))
          .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
        if (!target) continue;
        const targetAngle = Math.atan2(Number(target.y) - Number(player.y), Number(target.x) - Number(player.x));
        const radius = (Number(player.radius) || 18) + 7;
        const wallAhead = circleHitsWall(this, Number(player.x) + Math.cos(targetAngle) * 48, Number(player.y) + Math.sin(targetAngle) * 48, radius)
          || circleHitsWall(this, Number(player.x) + Math.cos(targetAngle) * 92, Number(player.y) + Math.sin(targetAngle) * 92, radius);
        const stalled = Math.hypot(Number(target.x) - Number(player.x), Number(target.y) - Number(player.y)) > 110
          && time - Number(motion.movedAt || time) > 820;
        const continuingSlide = time < Number(player.v102WallSlideUntil || 0);
        if (wallAhead || stalled || continuingSlide) applyWallSlide(this, player, targetAngle, time, wallAhead || stalled);
      }
      return result;
    };
    prototype.v102WallSlideHotfix = true;
    return true;
  }

  function applySniperBuff() {
    const triggers = window.WT_DATA?.triggers;
    if (!triggers?.egret || !triggers?.lightning || !triggers?.ibis) return false;
    triggers.egret.damage = 58;
    triggers.lightning.damage = 33;
    triggers.ibis.damage = 84;
    triggers.egret.description = String(triggers.egret.description || '').replace('万能型狙撃銃', '威力を強化した万能型狙撃銃');
    triggers.lightning.description = String(triggers.lightning.description || '').replace('軽量で弾速が高く当てやすい', '軽量・高速で、威力も強化された');
    triggers.ibis.description = String(triggers.ibis.description || '').replace('威力特化の重量級', 'さらに威力を高めた重量級');
    window.TRION_SNIPER_DAMAGE_BUFF = { egret: 58, lightning: 33, ibis: 84 };
    return true;
  }

  function install(attempt = 0) {
    const gameReady = patchGame(window.__TRION_GAME__);
    const sniperReady = applySniperBuff();
    if ((!gameReady || !sniperReady) && attempt < 120) setTimeout(() => install(attempt + 1), 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => install(), { once: true });
  else install();
  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('button');
    if (!button) return;
    const id = String(button.id || '');
    const text = String(button.textContent || '');
    if (/start|battle|deploy/i.test(id) || text.includes('出撃') || text.includes('対戦開始')) setTimeout(() => install(), 0);
  }, true);
})();
