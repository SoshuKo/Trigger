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

// v102 hotfix: remove wall-edge teleport recovery, preserve wall crawling,
// keep CPU movement inside the arena, and retain the sniper rifle damage buff.
(() => {
  'use strict';

  const clock = () => (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const angleDelta = (to, from) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
  const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

  function activeWalls(game) {
    return (game?.walls || []).filter((wall) => wall
      && wall.hp !== 0
      && !wall.nonBlocking
      && Number.isFinite(Number(wall.x))
      && Number.isFinite(Number(wall.y))
      && Number.isFinite(Number(wall.w))
      && Number.isFinite(Number(wall.h)));
  }

  function normalizeRect(rect, source = 'runtime') {
    if (!rect || typeof rect !== 'object') return null;
    const minX = finite(rect.minX ?? rect.left ?? rect.x);
    const minY = finite(rect.minY ?? rect.top ?? rect.y);
    const explicitMaxX = finite(rect.maxX ?? rect.right);
    const explicitMaxY = finite(rect.maxY ?? rect.bottom);
    const width = finite(rect.width ?? rect.w);
    const height = finite(rect.height ?? rect.h);
    const x0 = minX ?? 0;
    const y0 = minY ?? 0;
    const maxX = explicitMaxX ?? (width != null ? x0 + width : null);
    const maxY = explicitMaxY ?? (height != null ? y0 + height : null);
    if (maxX == null || maxY == null || maxX - x0 < 600 || maxY - y0 < 420) return null;
    return { minX: x0, minY: y0, maxX, maxY, source };
  }

  function inferArenaRect(game) {
    const objects = [
      game?.playBounds,
      game?.arenaBounds,
      game?.worldBounds,
      game?.mapBounds,
      game?.fieldBounds,
      game?.map?.bounds,
      game?.bounds,
    ];
    for (const object of objects) {
      const rect = normalizeRect(object);
      if (rect) return rect;
    }

    const dimensionPairs = [
      ['worldWidth', 'worldHeight', 'worldX', 'worldY'],
      ['mapWidth', 'mapHeight', 'mapX', 'mapY'],
      ['arenaWidth', 'arenaHeight', 'arenaX', 'arenaY'],
      ['fieldWidth', 'fieldHeight', 'fieldX', 'fieldY'],
    ];
    for (const [widthKey, heightKey, xKey, yKey] of dimensionPairs) {
      const width = finite(game?.[widthKey]);
      const height = finite(game?.[heightKey]);
      if (width != null && height != null && width >= 600 && height >= 420) {
        return {
          minX: finite(game?.[xKey]) ?? 0,
          minY: finite(game?.[yKey]) ?? 0,
          maxX: (finite(game?.[xKey]) ?? 0) + width,
          maxY: (finite(game?.[yKey]) ?? 0) + height,
          source: `${widthKey}/${heightKey}`,
        };
      }
    }

    const walls = activeWalls(game);
    if (walls.length < 4) return null;
    const minX = Math.min(...walls.map((wall) => Number(wall.x)));
    const minY = Math.min(...walls.map((wall) => Number(wall.y)));
    const maxX = Math.max(...walls.map((wall) => Number(wall.x) + Number(wall.w)));
    const maxY = Math.max(...walls.map((wall) => Number(wall.y) + Number(wall.h)));
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    if (spanX < 800 || spanY < 520) return null;

    const vertical = walls.filter((wall) => Number(wall.h) >= spanY * 0.48 && Number(wall.h) >= Number(wall.w) * 2.4);
    const horizontal = walls.filter((wall) => Number(wall.w) >= spanX * 0.48 && Number(wall.w) >= Number(wall.h) * 2.4);
    const leftWalls = vertical.filter((wall) => Number(wall.x) + Number(wall.w) * 0.5 <= minX + spanX * 0.18);
    const rightWalls = vertical.filter((wall) => Number(wall.x) + Number(wall.w) * 0.5 >= maxX - spanX * 0.18);
    const topWalls = horizontal.filter((wall) => Number(wall.y) + Number(wall.h) * 0.5 <= minY + spanY * 0.18);
    const bottomWalls = horizontal.filter((wall) => Number(wall.y) + Number(wall.h) * 0.5 >= maxY - spanY * 0.18);

    if (leftWalls.length && rightWalls.length && topWalls.length && bottomWalls.length) {
      const innerLeft = Math.max(...leftWalls.map((wall) => Number(wall.x) + Number(wall.w)));
      const innerRight = Math.min(...rightWalls.map((wall) => Number(wall.x)));
      const innerTop = Math.max(...topWalls.map((wall) => Number(wall.y) + Number(wall.h)));
      const innerBottom = Math.min(...bottomWalls.map((wall) => Number(wall.y)));
      if (innerRight - innerLeft >= 600 && innerBottom - innerTop >= 420) {
        return { minX: innerLeft, minY: innerTop, maxX: innerRight, maxY: innerBottom, source: 'boundary-walls' };
      }
    }

    const inset = 36;
    return { minX: minX + inset, minY: minY + inset, maxX: maxX - inset, maxY: maxY - inset, source: 'wall-extents' };
  }

  function pointInsideArena(rect, x, y, margin = 0) {
    if (!rect) return true;
    return x >= rect.minX + margin
      && x <= rect.maxX - margin
      && y >= rect.minY + margin
      && y <= rect.maxY - margin;
  }

  function edgeDistance(rect, x, y) {
    if (!rect) return Infinity;
    return Math.min(x - rect.minX, rect.maxX - x, y - rect.minY, rect.maxY - y);
  }

  function arenaEdgeState(game, player, x = Number(player?.x), y = Number(player?.y)) {
    const rect = inferArenaRect(game);
    if (!rect || !Number.isFinite(x) || !Number.isFinite(y)) {
      return { rect, near: false, outside: false, distance: Infinity, inwardAngle: Number(player?.aim) || 0, ix: 0, iy: 0 };
    }
    const radius = Number(player?.radius) || 18;
    const soft = Math.max(150, radius + 112);
    const hardMargin = radius + 0.5;
    const left = x - rect.minX;
    const right = rect.maxX - x;
    const top = y - rect.minY;
    const bottom = rect.maxY - y;
    let ix = 0;
    let iy = 0;
    if (left < soft) ix += (soft - left) / soft;
    if (right < soft) ix -= (soft - right) / soft;
    if (top < soft) iy += (soft - top) / soft;
    if (bottom < soft) iy -= (soft - bottom) / soft;
    const outside = !pointInsideArena(rect, x, y, hardMargin);
    if (outside) {
      ix += clamp((rect.minX + hardMargin - x) / soft, -2.5, 2.5);
      ix -= clamp((x - (rect.maxX - hardMargin)) / soft, -2.5, 2.5);
      iy += clamp((rect.minY + hardMargin - y) / soft, -2.5, 2.5);
      iy -= clamp((y - (rect.maxY - hardMargin)) / soft, -2.5, 2.5);
    }
    if (Math.hypot(ix, iy) < 0.001) {
      ix = (rect.minX + rect.maxX) * 0.5 - x;
      iy = (rect.minY + rect.maxY) * 0.5 - y;
    }
    const length = Math.hypot(ix, iy) || 1;
    ix /= length;
    iy /= length;
    const distance = edgeDistance(rect, x, y);
    return {
      rect,
      near: distance < soft,
      outside,
      distance,
      inwardAngle: Math.atan2(iy, ix),
      ix,
      iy,
    };
  }

  function circleHitsWall(game, x, y, radius) {
    return activeWalls(game).some((wall) => x + radius > Number(wall.x)
      && x - radius < Number(wall.x) + Number(wall.w)
      && y + radius > Number(wall.y)
      && y - radius < Number(wall.y) + Number(wall.h));
  }

  function pathTouchesWall(game, x1, y1, x2, y2, radius) {
    const distance = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(2, Math.min(14, Math.ceil(distance / 22)));
    for (let index = 0; index <= steps; index += 1) {
      const ratio = index / steps;
      const x = x1 + (x2 - x1) * ratio;
      const y = y1 + (y2 - y1) * ratio;
      if (!pointInsideArena(inferArenaRect(game), x, y, radius + 0.5) || circleHitsWall(game, x, y, radius)) return true;
    }
    return false;
  }

  function nearestWallNormal(game, x, y, radius) {
    let best = null;
    for (const wall of activeWalls(game)) {
      const closestX = clamp(x, Number(wall.x), Number(wall.x) + Number(wall.w));
      const closestY = clamp(y, Number(wall.y), Number(wall.y) + Number(wall.h));
      let dx = x - closestX;
      let dy = y - closestY;
      let distance = Math.hypot(dx, dy);
      if (distance < 0.001) {
        const exits = [
          { depth: Math.abs(x - Number(wall.x)), nx: -1, ny: 0 },
          { depth: Math.abs(x - (Number(wall.x) + Number(wall.w))), nx: 1, ny: 0 },
          { depth: Math.abs(y - Number(wall.y)), nx: 0, ny: -1 },
          { depth: Math.abs(y - (Number(wall.y) + Number(wall.h))), nx: 0, ny: 1 },
        ].sort((a, b) => a.depth - b.depth);
        dx = exits[0].nx;
        dy = exits[0].ny;
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
    const radius = (Number(player.radius) || 18) + 0.75;
    const startX = Number(player.x);
    const startY = Number(player.y);
    const endX = startX + Math.cos(angle) * distance;
    const endY = startY + Math.sin(angle) * distance;
    const rect = inferArenaRect(game);
    if (!pointInsideArena(rect, endX, endY, radius + 0.5)) return false;
    return !pathTouchesWall(game, startX, startY, endX, endY, radius);
  }

  function chooseSlideAngle(game, player, targetAngle, previousAngle = null) {
    const edge = arenaEdgeState(game, player);
    const currentEdgeDistance = edge.distance;
    const projectedEdgeDistance = (angle, distance = 104) => edgeDistance(
      edge.rect,
      Number(player.x) + Math.cos(angle) * distance,
      Number(player.y) + Math.sin(angle) * distance,
    );

    if (Number.isFinite(previousAngle)
      && directionIsOpen(game, player, previousAngle, 46)
      && directionIsOpen(game, player, previousAngle, 104)
      && (!edge.near || projectedEdgeDistance(previousAngle) >= currentEdgeDistance - 2)) return previousAngle;

    const normal = nearestWallNormal(game, Number(player.x), Number(player.y), (Number(player.radius) || 18) + 8);
    const tangentA = normal ? Math.atan2(normal.ny, normal.nx) + Math.PI / 2 : targetAngle + Math.PI / 2;
    const tangentB = tangentA + Math.PI;
    const candidates = [
      ...(edge.outside ? [edge.inwardAngle, edge.inwardAngle + 0.42, edge.inwardAngle - 0.42] : []),
      tangentA,
      tangentB,
      targetAngle + Math.PI / 2,
      targetAngle - Math.PI / 2,
      targetAngle + 0.92,
      targetAngle - 0.92,
      targetAngle + Math.PI,
    ];
    let selected = edge.outside ? edge.inwardAngle : candidates[0];
    let selectedScore = Infinity;
    for (const angle of candidates) {
      const nearBlocked = !directionIsOpen(game, player, angle, 46);
      const farBlocked = !directionIsOpen(game, player, angle, 104);
      const nextEdge = projectedEdgeDistance(angle);
      const edgeLoss = edge.near ? Math.max(0, currentEdgeDistance - 2 - nextEdge) : 0;
      const inwardAlignment = edge.outside ? Math.cos(angleDelta(angle, edge.inwardAngle)) : 0;
      const score = (nearBlocked ? 12000 : 0)
        + (farBlocked ? 4600 : 0)
        + Math.abs(angleDelta(angle, targetAngle)) * 34
        + (Number.isFinite(previousAngle) ? Math.abs(angleDelta(angle, previousAngle)) * 12 : 0)
        + edgeLoss * 120
        - inwardAlignment * (edge.outside ? 900 : 0);
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

  function overlappingWallContact(game, player) {
    const radius = Number(player?.radius) || 18;
    let best = null;
    for (const wall of activeWalls(game)) {
      const left = Number(wall.x);
      const top = Number(wall.y);
      const right = left + Number(wall.w);
      const bottom = top + Number(wall.h);
      const x = Number(player.x);
      const y = Number(player.y);
      const closestX = clamp(x, left, right);
      const closestY = clamp(y, top, bottom);
      let dx = x - closestX;
      let dy = y - closestY;
      let distance = Math.hypot(dx, dy);
      let penetration;
      if (distance > 0.001) {
        penetration = radius - distance;
        if (penetration <= 0) continue;
        dx /= distance;
        dy /= distance;
      } else {
        const exits = [
          { depth: Math.abs(x - left), nx: -1, ny: 0 },
          { depth: Math.abs(right - x), nx: 1, ny: 0 },
          { depth: Math.abs(y - top), nx: 0, ny: -1 },
          { depth: Math.abs(bottom - y), nx: 0, ny: 1 },
        ].sort((a, b) => a.depth - b.depth);
        dx = exits[0].nx;
        dy = exits[0].ny;
        penetration = exits[0].depth + radius;
        distance = 0;
      }
      const contact = { nx: dx, ny: dy, penetration, wall, distance };
      if (!best || contact.penetration > best.penetration) best = contact;
    }
    return best;
  }

  function separateFromWalls(game, player) {
    if (!player || player.dead) return false;
    let moved = false;
    let lastNormal = null;
    for (let pass = 0; pass < 8; pass += 1) {
      const contact = overlappingWallContact(game, player);
      if (!contact) break;
      const correction = Math.max(0.75, contact.penetration + 0.75);
      player.x = Number(player.x) + contact.nx * correction;
      player.y = Number(player.y) + contact.ny * correction;
      lastNormal = contact;
      moved = true;
    }
    if (!moved || !lastNormal) return false;

    const vx = Number(player.vx) || 0;
    const vy = Number(player.vy) || 0;
    const inward = vx * lastNormal.nx + vy * lastNormal.ny;
    if (inward < 0) {
      player.vx = vx - inward * lastNormal.nx;
      player.vy = vy - inward * lastNormal.ny;
    }
    const tangentSpeed = Math.hypot(Number(player.vx) || 0, Number(player.vy) || 0);
    if (tangentSpeed < 18) {
      const tangentA = Math.atan2(lastNormal.ny, lastNormal.nx) + Math.PI / 2;
      const tangentB = tangentA + Math.PI;
      const desired = Number(player.aim) || tangentA;
      const tangent = Math.abs(angleDelta(tangentA, desired)) <= Math.abs(angleDelta(tangentB, desired)) ? tangentA : tangentB;
      player.vx = Math.cos(tangent) * 22 + lastNormal.nx * 4;
      player.vy = Math.sin(tangent) * 22 + lastNormal.ny * 4;
    } else {
      player.vx = (Number(player.vx) || 0) + lastNormal.nx * 4;
      player.vy = (Number(player.vy) || 0) + lastNormal.ny * 4;
    }
    player.v102WallContactNormal = { x: lastNormal.nx, y: lastNormal.ny };
    player.v102WallContactAt = clock();
    return true;
  }

  function applyWallSlide(game, player, targetAngle, time, force = false) {
    const edge = arenaEdgeState(game, player);
    const previous = time < Number(player.v102WallSlideUntil || 0)
      ? Number(player.v102WallSlideAngle)
      : null;
    const requestedAngle = edge.outside ? edge.inwardAngle : targetAngle;
    const angle = chooseSlideAngle(game, player, requestedAngle, previous);
    const speed = Math.max(edge.outside ? 138 : 118, (Number(player.speed) || 150) * (edge.outside ? 0.9 : 0.78));
    if (!force && !directionIsOpen(game, player, angle, 42)) return false;
    player.vx = Math.cos(angle) * speed;
    player.vy = Math.sin(angle) * speed;
    player.v102WallSlideAngle = angle;
    player.v102WallSlideUntil = time + (edge.outside ? 760 : 620);
    clearNavigation(player);
    return true;
  }

  function patchGame(game) {
    if (!game || !Array.isArray(game.players)) return false;
    const prototype = Object.getPrototypeOf(game);
    if (!prototype) return false;

    if (!prototype.v102WallCrawlCollisionPatched) {
      const originalResolveWallCollision = prototype.resolveWallCollision;
      prototype.resolveWallCollision = function wallCrawlCollision(player) {
        const result = typeof originalResolveWallCollision === 'function'
          ? originalResolveWallCollision.call(this, player)
          : undefined;
        separateFromWalls(this, player);
        return result;
      };
      prototype.v102WallCrawlCollisionPatched = true;
    }

    const originalUpdate = prototype.update;
    if (prototype.v102WallCrawlHotfix || typeof originalUpdate !== 'function') {
      return Boolean(prototype.v102WallCrawlHotfix);
    }
    if (!String(originalUpdate).includes('updateStallRecovery')) return false;

    prototype.update = function wallCrawlSafeUpdate(dt) {
      const result = originalUpdate.call(this, dt);
      const time = clock();

      for (const player of this.players || []) {
        if (!player || player.dead || !Number.isFinite(Number(player.x)) || !Number.isFinite(Number(player.y))) continue;
        const pinball = time < Number(player.v101PinballActiveUntil || 0);
        if (!pinball) this.resolveWallCollision?.(player);

        if (player.human || Number(player.v96Knockdown) > 0 || Number(player.v100Restrained) > 0 || pinball) continue;
        const speedAfter = Math.hypot(Number(player.vx) || 0, Number(player.vy) || 0);
        const edge = arenaEdgeState(this, player);
        const velocityLength = speedAfter || 1;
        const outwardDot = ((Number(player.vx) || 0) / velocityLength * edge.ix)
          + ((Number(player.vy) || 0) / velocityLength * edge.iy);

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
        const contact = nearestWallNormal(this, Number(player.x), Number(player.y), (Number(player.radius) || 18) + 8);
        const touchingWall = Boolean(contact && contact.gap <= 12);
        const wallAhead = !directionIsOpen(this, player, targetAngle, 92);
        const stalled = Math.hypot(Number(target.x) - Number(player.x), Number(target.y) - Number(player.y)) > 110
          && time - Number(motion.movedAt || time) > 820;
        const continuingSlide = time < Number(player.v102WallSlideUntil || 0);
        const genuinelyOutward = edge.near && outwardDot < -0.12;

        if (edge.outside || (edge.distance < 54 && genuinelyOutward)) {
          applyWallSlide(this, player, edge.inwardAngle, time, true);
        } else if (touchingWall || wallAhead || stalled || continuingSlide) {
          applyWallSlide(this, player, targetAngle, time, wallAhead || stalled);
        } else if (!edge.near) {
          player.v102WallSlideUntil = 0;
        }
      }
      return result;
    };
    prototype.v102WallCrawlHotfix = true;
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

  window.TRION_WALL_RECOVERY_AUDIT = {
    inferArenaRect,
    arenaEdgeState,
    directionIsOpen,
    chooseSlideAngle,
  };

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
