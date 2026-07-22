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

// v102 hotfix: prevent wall-recovery teleports and let CPU units crawl through narrow passages.
(() => {
  'use strict';

  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

  function walls(game) {
    return (game?.walls || []).filter((wall) => wall
      && wall.hp !== 0
      && !wall.nonBlocking
      && [wall.x, wall.y, wall.w, wall.h].every((value) => Number.isFinite(Number(value))));
  }

  function normalizeBounds(source) {
    if (!source || typeof source !== 'object') return null;
    const minX = finite(source.minX ?? source.left ?? source.x) ?? 0;
    const minY = finite(source.minY ?? source.top ?? source.y) ?? 0;
    const width = finite(source.width ?? source.w);
    const height = finite(source.height ?? source.h);
    const maxX = finite(source.maxX ?? source.right) ?? (width == null ? null : minX + width);
    const maxY = finite(source.maxY ?? source.bottom) ?? (height == null ? null : minY + height);
    if (maxX == null || maxY == null || maxX - minX < 600 || maxY - minY < 420) return null;
    return { minX, minY, maxX, maxY };
  }

  function arenaBounds(game) {
    for (const source of [game?.playBounds, game?.arenaBounds, game?.worldBounds, game?.mapBounds, game?.fieldBounds, game?.map?.bounds, game?.bounds]) {
      const result = normalizeBounds(source);
      if (result) return result;
    }
    for (const [widthKey, heightKey, xKey, yKey] of [
      ['worldWidth', 'worldHeight', 'worldX', 'worldY'],
      ['mapWidth', 'mapHeight', 'mapX', 'mapY'],
      ['arenaWidth', 'arenaHeight', 'arenaX', 'arenaY'],
      ['fieldWidth', 'fieldHeight', 'fieldX', 'fieldY'],
    ]) {
      const width = finite(game?.[widthKey]);
      const height = finite(game?.[heightKey]);
      if (width != null && height != null && width >= 600 && height >= 420) {
        const x = finite(game?.[xKey]) ?? 0;
        const y = finite(game?.[yKey]) ?? 0;
        return { minX: x, minY: y, maxX: x + width, maxY: y + height };
      }
    }
    const list = walls(game);
    if (list.length < 4) return null;
    const minX = Math.min(...list.map((wall) => Number(wall.x)));
    const minY = Math.min(...list.map((wall) => Number(wall.y)));
    const maxX = Math.max(...list.map((wall) => Number(wall.x) + Number(wall.w)));
    const maxY = Math.max(...list.map((wall) => Number(wall.y) + Number(wall.h)));
    if (maxX - minX < 800 || maxY - minY < 520) return null;
    return { minX: minX + 24, minY: minY + 24, maxX: maxX - 24, maxY: maxY - 24 };
  }

  function inside(bounds, x, y, margin = 0) {
    return !bounds || (x >= bounds.minX + margin && x <= bounds.maxX - margin
      && y >= bounds.minY + margin && y <= bounds.maxY - margin);
  }

  function circleHitsWall(game, x, y, radius) {
    return walls(game).some((wall) => x + radius > Number(wall.x)
      && x - radius < Number(wall.x) + Number(wall.w)
      && y + radius > Number(wall.y)
      && y - radius < Number(wall.y) + Number(wall.h));
  }

  function wallContact(game, player, extra = 0) {
    const radius = Math.max(4, (Number(player?.radius) || 18) + extra);
    let best = null;
    for (const wall of walls(game)) {
      const left = Number(wall.x), top = Number(wall.y);
      const right = left + Number(wall.w), bottom = top + Number(wall.h);
      const x = Number(player.x), y = Number(player.y);
      const closestX = clamp(x, left, right), closestY = clamp(y, top, bottom);
      let dx = x - closestX, dy = y - closestY, distance = Math.hypot(dx, dy), penetration;
      if (distance > 0.001) {
        penetration = radius - distance;
        if (penetration <= 0) continue;
        dx /= distance; dy /= distance;
      } else {
        const exits = [
          { depth: Math.abs(x - left), nx: -1, ny: 0 },
          { depth: Math.abs(right - x), nx: 1, ny: 0 },
          { depth: Math.abs(y - top), nx: 0, ny: -1 },
          { depth: Math.abs(bottom - y), nx: 0, ny: 1 },
        ].sort((a, b) => a.depth - b.depth);
        dx = exits[0].nx; dy = exits[0].ny; penetration = exits[0].depth + radius;
      }
      if (!best || penetration > best.penetration) best = { nx: dx, ny: dy, penetration };
    }
    return best;
  }

  function nearWall(game, x, y, radius, gap = 4) {
    return walls(game).some((wall) => {
      const cx = clamp(x, Number(wall.x), Number(wall.x) + Number(wall.w));
      const cy = clamp(y, Number(wall.y), Number(wall.y) + Number(wall.h));
      return Math.hypot(x - cx, y - cy) <= radius + gap;
    });
  }

  function pathOpen(game, player, angle, distance) {
    const radius = Math.max(6, (Number(player.radius) || 18) - 3.25);
    const startX = Number(player.x), startY = Number(player.y);
    const endX = startX + Math.cos(angle) * distance;
    const endY = startY + Math.sin(angle) * distance;
    const bounds = arenaBounds(game);
    if (!inside(bounds, endX, endY, radius + 0.1)) return false;
    const steps = Math.max(2, Math.min(16, Math.ceil(distance / 16)));
    for (let index = 1; index <= steps; index += 1) {
      const ratio = index / steps;
      const x = startX + (endX - startX) * ratio;
      const y = startY + (endY - startY) * ratio;
      if (!inside(bounds, x, y, radius + 0.1) || circleHitsWall(game, x, y, radius)) return false;
    }
    return true;
  }

  function intentionalTeleport(game, effectStart, from, to) {
    return (game?.effects || []).slice(effectStart).some((effect) => {
      if (!effect || !/teleport/i.test(String(effect.type || ''))) return false;
      const a = { x: Number(effect.x), y: Number(effect.y) };
      const b = { x: Number(effect.x2), y: Number(effect.y2) };
      return (Math.hypot(a.x - from.x, a.y - from.y) < 48 && Math.hypot(b.x - to.x, b.y - to.y) < 48)
        || (Math.hypot(b.x - from.x, b.y - from.y) < 48 && Math.hypot(a.x - to.x, a.y - to.y) < 48);
    });
  }

  function separateGradually(game, player) {
    const contact = wallContact(game, player, -0.35);
    if (!contact) return false;
    const correction = Math.min(2.0, Math.max(0.2, contact.penetration + 0.1));
    player.x = Number(player.x) + contact.nx * correction;
    player.y = Number(player.y) + contact.ny * correction;
    const vx = Number(player.vx) || 0, vy = Number(player.vy) || 0;
    const intoWall = vx * contact.nx + vy * contact.ny;
    if (intoWall < 0) {
      player.vx = vx - intoWall * contact.nx;
      player.vy = vy - intoWall * contact.ny;
    }
    return true;
  }

  function limitRecoveryJump(game, player, snapshot, dt, effectStart, time) {
    if (!snapshot || time < Number(player.v101PinballActiveUntil || 0)) return false;
    const dx = Number(player.x) - snapshot.x, dy = Number(player.y) - snapshot.y;
    const displacement = Math.hypot(dx, dy);
    const radius = Number(player.radius) || 18;
    const wallRelated = nearWall(game, snapshot.x, snapshot.y, radius, 5)
      || nearWall(game, Number(player.x), Number(player.y), radius, 5);
    if (!wallRelated || displacement <= 22
      || intentionalTeleport(game, effectStart, snapshot, { x: Number(player.x), y: Number(player.y) })) return false;
    const seconds = clamp(Number(dt) || 1 / 60, 1 / 240, 0.1);
    const speed = Math.max(Math.hypot(snapshot.vx, snapshot.vy), Math.hypot(Number(player.vx) || 0, Number(player.vy) || 0), Number(player.speed) || 150);
    const allowed = clamp(speed * seconds * 1.2 + 2, 4, 12);
    const scale = allowed / Math.max(displacement, 0.001);
    player.x = snapshot.x + dx * scale;
    player.y = snapshot.y + dy * scale;
    separateGradually(game, player);
    player.v102WallJumpLimitedAt = time;
    return true;
  }

  function nearestTarget(game, player) {
    if (typeof game.resolveAITarget === 'function') {
      const target = game.resolveAITarget(player);
      if (target && !target.dead) return target;
    }
    return (game.players || []).filter((target) => target !== player && !target.dead && game.canDamage?.(player, target))
      .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0] || null;
  }

  function chooseCrawlAngle(game, player, targetAngle) {
    if (pathOpen(game, player, targetAngle, 70)) return targetAngle;
    const contact = wallContact(game, player, 2.5);
    const normalAngle = contact ? Math.atan2(contact.ny, contact.nx) : targetAngle;
    const tangentA = normalAngle + Math.PI / 2;
    const tangentB = tangentA + Math.PI;
    const candidates = [tangentA, tangentB, targetAngle + 0.7, targetAngle - 0.7, targetAngle + 1.15, targetAngle - 1.15];
    let bestAngle = candidates[0], bestScore = Infinity;
    for (const angle of candidates) {
      const blockedNear = !pathOpen(game, player, angle, 42);
      const blockedFar = !pathOpen(game, player, angle, 96);
      const score = (blockedNear ? 10000 : 0) + (blockedFar ? 2500 : 0) + Math.abs(angleDelta(angle, targetAngle)) * 28;
      if (score < bestScore) { bestScore = score; bestAngle = angle; }
    }
    return bestAngle;
  }

  function patchGame(game) {
    if (!game || !Array.isArray(game.players)) return false;
    const prototype = Object.getPrototypeOf(game);
    if (!prototype) return false;

    if (!prototype.v102NarrowWallCollisionPatched) {
      const originalCollision = prototype.resolveWallCollision;
      prototype.resolveWallCollision = function narrowWallCollision(player) {
        const result = typeof originalCollision === 'function' ? originalCollision.call(this, player) : undefined;
        separateGradually(this, player);
        return result;
      };
      prototype.v102NarrowWallCollisionPatched = true;
    }

    const originalUpdate = prototype.update;
    if (prototype.v102NarrowWallHotfix || typeof originalUpdate !== 'function') return Boolean(prototype.v102NarrowWallHotfix);
    if (!String(originalUpdate).includes('updateStallRecovery')) return false;

    prototype.update = function narrowWallSafeUpdate(dt) {
      const effectStart = (this.effects || []).length;
      const snapshots = new Map((this.players || []).map((player) => [player, {
        x: Number(player.x), y: Number(player.y), vx: Number(player.vx) || 0, vy: Number(player.vy) || 0,
      }]));
      const result = originalUpdate.call(this, dt);
      const time = now();

      for (const player of this.players || []) {
        if (!player || player.dead || !Number.isFinite(Number(player.x)) || !Number.isFinite(Number(player.y))) continue;
        const pinball = time < Number(player.v101PinballActiveUntil || 0);
        if (!pinball) {
          limitRecoveryJump(this, player, snapshots.get(player), dt, effectStart, time);
          this.resolveWallCollision?.(player);
        }
        if (player.human || pinball || Number(player.v96Knockdown) > 0 || Number(player.v100Restrained) > 0) continue;
        const target = nearestTarget(this, player);
        if (!target) continue;
        const targetAngle = Math.atan2(Number(target.y) - Number(player.y), Number(target.x) - Number(player.x));
        const contact = wallContact(this, player, 2.5);
        const blockedAhead = !pathOpen(this, player, targetAngle, 70);
        const speed = Math.hypot(Number(player.vx) || 0, Number(player.vy) || 0);
        const state = player.v102NarrowWallState ||= { x: Number(player.x), y: Number(player.y), movedAt: time, crawlUntil: 0 };
        if (Math.hypot(Number(player.x) - state.x, Number(player.y) - state.y) > 4 || speed > 34) {
          state.x = Number(player.x); state.y = Number(player.y); state.movedAt = time;
        }
        const stalled = time - state.movedAt > 900 && Math.hypot(target.x - player.x, target.y - player.y) > 110;
        if (contact || blockedAhead || stalled || time < state.crawlUntil) {
          const angle = chooseCrawlAngle(this, player, targetAngle);
          const crawlSpeed = Math.max(92, (Number(player.speed) || 150) * 0.66);
          player.vx = Math.cos(angle) * crawlSpeed;
          player.vy = Math.sin(angle) * crawlSpeed;
          player.ai = player.ai && typeof player.ai === 'object' ? player.ai : {};
          player.ai.navPath = []; player.ai.navPathIndex = 0;
          delete player.v97MobilityRoute;
          state.crawlUntil = time + 420;
        }
      }
      return result;
    };
    prototype.v102NarrowWallHotfix = true;
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
    const gameReady = patchGame(window.__TRION_GAME__);
    const sniperReady = applySniperBuff();
    if ((!gameReady || !sniperReady) && attempt < 120) setTimeout(() => install(attempt + 1), 100);
  }

  window.TRION_WALL_RECOVERY_AUDIT = { arenaBounds, pathOpen, wallContact };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => install(), { once: true });
  else install();
  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('button');
    if (!button) return;
    const id = String(button.id || ''), text = String(button.textContent || '');
    if (/start|battle|deploy/i.test(id) || text.includes('出撃') || text.includes('対戦開始')) setTimeout(() => install(), 0);
  }, true);
})();
