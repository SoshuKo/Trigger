from pathlib import Path
import re

GAME = Path('js/game.js')
FEATURES = Path('js/v77-features.js')
I18N = Path('js/i18n.js')
INDEX = Path('index.html')

source = GAME.read_text(encoding='utf-8')
source = source.replace('const GAME_VERSION = 76;', 'const GAME_VERSION = 103;', 1)

helper = r'''    playerWallOverlapAt(p, x, y, radius = Math.max(4, (Number(p?.radius) || 18) - .2)) {
      const probe = { x, y, radius };
      for (const wall of this.walls) {
        if (!wall || wall.hp <= 0 || wall.nonBlocking) continue;
        if (circleRectOverlap(probe, wall)) return wall;
      }
      return null;
    }

    movePlayerWithWallSlide(p, dt) {
      const radius = Math.max(4, (Number(p.radius) || 18) - .2);
      const walls = this.walls;
      const startX = Number(p.x);
      const startY = Number(p.y);
      let nextX = clamp(startX + (Number(p.vx) || 0) * dt, radius, this.world.w - radius);
      let blockedX = false;
      if (nextX > startX + .0001) {
        for (const wall of walls) {
          if (!wall || wall.hp <= 0 || wall.nonBlocking) continue;
          if (startY + radius <= wall.y + .01 || startY - radius >= wall.y + wall.h - .01) continue;
          if (startX + radius <= wall.x + .05 && nextX + radius > wall.x) {
            nextX = Math.min(nextX, wall.x - radius - .01);
            blockedX = true;
          }
        }
      } else if (nextX < startX - .0001) {
        for (const wall of walls) {
          if (!wall || wall.hp <= 0 || wall.nonBlocking) continue;
          if (startY + radius <= wall.y + .01 || startY - radius >= wall.y + wall.h - .01) continue;
          const edge = wall.x + wall.w;
          if (startX - radius >= edge - .05 && nextX - radius < edge) {
            nextX = Math.max(nextX, edge + radius + .01);
            blockedX = true;
          }
        }
      }
      p.x = nextX;
      if (blockedX) p.vx = 0;

      let nextY = clamp(startY + (Number(p.vy) || 0) * dt, radius, this.world.h - radius);
      let blockedY = false;
      if (nextY > startY + .0001) {
        for (const wall of walls) {
          if (!wall || wall.hp <= 0 || wall.nonBlocking) continue;
          if (p.x + radius <= wall.x + .01 || p.x - radius >= wall.x + wall.w - .01) continue;
          if (startY + radius <= wall.y + .05 && nextY + radius > wall.y) {
            nextY = Math.min(nextY, wall.y - radius - .01);
            blockedY = true;
          }
        }
      } else if (nextY < startY - .0001) {
        for (const wall of walls) {
          if (!wall || wall.hp <= 0 || wall.nonBlocking) continue;
          if (p.x + radius <= wall.x + .01 || p.x - radius >= wall.x + wall.w - .01) continue;
          const edge = wall.y + wall.h;
          if (startY - radius >= edge - .05 && nextY - radius < edge) {
            nextY = Math.max(nextY, edge + radius + .01);
            blockedY = true;
          }
        }
      }
      p.y = nextY;
      if (blockedY) p.vy = 0;
      return blockedX || blockedY;
    }

'''
if '    movePlayerWithWallSlide(p, dt) {' not in source:
    marker = '    updatePlayer(p, dt) {'
    if source.count(marker) != 1:
        raise SystemExit(f'updatePlayer marker count: {source.count(marker)}')
    source = source.replace(marker, helper + marker, 1)

old_move = '''      if (!p.flying) this.applyTerrainPhysics(p, dt);
      this.applyUndergroundRailSafety(p, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const movementSpeed = Math.hypot(p.vx, p.vy);'''
new_move = '''      if (!p.flying) this.applyTerrainPhysics(p, dt);
      this.applyUndergroundRailSafety(p, dt);
      if (p.flying) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else {
        this.movePlayerWithWallSlide(p, dt);
      }
      const movementSpeed = Math.hypot(p.vx, p.vy);'''
if old_move not in source:
    raise SystemExit('movement integration block not found')
source = source.replace(old_move, new_move, 1)

old_tail = '''      p.x = clamp(p.x, p.radius, this.world.w - p.radius);
      p.y = clamp(p.y, p.radius, this.world.h - p.radius);
      if (!p.flying) this.resolveWallCollision(p);
      this.resolvePlayerCollision(p);'''
new_tail = '''      p.x = clamp(p.x, p.radius, this.world.w - p.radius);
      p.y = clamp(p.y, p.radius, this.world.h - p.radius);
      this.resolvePlayerCollision(p);
      if (!p.flying) this.resolveWallCollision(p);'''
if old_tail not in source:
    raise SystemExit('movement tail block not found')
source = source.replace(old_tail, new_tail, 1)

resolver_pattern = re.compile(r'''    resolveWallCollision\(p\) \{\n.*?\n    \}\n\n(?=    resolvePlayerCollision\(p\))''', re.S)
new_resolver = r'''    resolveWallCollision(p, options = {}) {
      const maxCorrection = options.fullCorrection ? Infinity : 2.25;
      for (const wall of this.walls) {
        if (!wall || wall.hp <= 0 || wall.nonBlocking || !circleRectOverlap(p, wall)) continue;
        const closestX = clamp(p.x, wall.x, wall.x + wall.w);
        const closestY = clamp(p.y, wall.y, wall.y + wall.h);
        let dx = p.x - closestX;
        let dy = p.y - closestY;
        let len = Math.hypot(dx, dy);
        let penetration = 0;
        if (len < .001) {
          const exits = [
            { depth: Math.abs(p.x - wall.x), nx: -1, ny: 0 },
            { depth: Math.abs(p.x - (wall.x + wall.w)), nx: 1, ny: 0 },
            { depth: Math.abs(p.y - wall.y), nx: 0, ny: -1 },
            { depth: Math.abs(p.y - (wall.y + wall.h)), nx: 0, ny: 1 },
          ].sort((a, b) => a.depth - b.depth);
          dx = exits[0].nx;
          dy = exits[0].ny;
          len = 1;
          penetration = exits[0].depth + p.radius;
        } else {
          penetration = p.radius - len;
        }
        if (penetration <= 0) continue;
        const nx = dx / len;
        const ny = dy / len;
        const correction = Math.min(maxCorrection, penetration + .05);
        p.x += nx * correction;
        p.y += ny * correction;
        const inward = (Number(p.vx) || 0) * nx + (Number(p.vy) || 0) * ny;
        if (inward < 0) {
          p.vx -= inward * nx;
          p.vy -= inward * ny;
        }
      }
    }

'''
source, count = resolver_pattern.subn(new_resolver, source, count=1)
if count != 1:
    raise SystemExit(f'resolveWallCollision replacement count: {count}')

source = source.replace("if (x < radius + 8 || y < radius + 8 || x > this.world.w - radius - 8 || y > this.world.h - radius - 8) return false;\n      const probe = { x, y, radius: radius + 5 };",
                        "if (x < radius + 1 || y < radius + 1 || x > this.world.w - radius - 1 || y > this.world.h - radius - 1) return false;\n      const probe = { x, y, radius: Math.max(6, radius - .25) };", 1)
source = source.replace("const margin = p.radius + 34;", "const margin = p.radius + 18;", 1)
source = source.replace("if (directDistance < 80 || !this.findBlockingWall(p.x, p.y, goalX, goalY, p.radius + 6)) return [];",
                        "if (directDistance < 80 || !this.findBlockingWall(p.x, p.y, goalX, goalY, Math.max(4, p.radius - .25))) return [];", 1)
source = source.replace("const radius = p.radius + 8;", "const radius = Math.max(6, p.radius - .25);", 1)
GAME.write_text(source, encoding='utf-8')

features = FEATURES.read_text(encoding='utf-8')
features, count = re.subn(r'''  function embeddedWallContact\(g,p,r\)\{.*?\n  function updateStallRecovery\(g,p,dt\)\{\n    if\(!p\|\|p\.dead\)return;normalizeFiniteTimers\(p\);const now=mobilityNow\(\);recoverEmbeddedPlayer\(g,p,now\);''',
                          "  function updateStallRecovery(g,p,dt){\n    if(!p||p.dead)return;normalizeFiniteTimers(p);const now=mobilityNow();",
                          features, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'feature recovery replacement count: {count}')
features = features.replace('[v102 game capture]', '[v103 game capture]')
features = features.replace('function installSimulationApiV102()', 'function installSimulationApiV103()')
features = features.replace('api.v102Wrapped', 'api.v103Wrapped')
features = features.replace('result.gameVersion=Math.max(102', 'result.gameVersion=Math.max(103')
features = features.replace('result.featureVersion=102', 'result.featureVersion=103')
features = features.replace('api.version=102', 'api.version=103')
features = features.replace('api.v102Wrapped=true', 'api.v103Wrapped=true')
features = features.replace('installSimulationApiV102();', 'installSimulationApiV103();')
features = features.replace('version:102', 'version:103')
features = features.replace("window.TRION_SIMULATION_API.version=102", "window.TRION_SIMULATION_API.version=103")
features = features.replace("el.textContent='VERSION 102'", "el.textContent='VERSION 103'")
features = features.replace("'VERSION 102'", "'VERSION 103'")
features = features.replace("dataset.gameVersion='102'", "dataset.gameVersion='103'")
features = features.replace('},250);', '},1000);', 1)
FEATURES.write_text(features, encoding='utf-8')

i18n = I18N.read_text(encoding='utf-8')
i18n = i18n.replace('?v=102', '?v=103').replace("VERSION 102", "VERSION 103")
I18N.write_text(i18n, encoding='utf-8')

index = INDEX.read_text(encoding='utf-8')
index = re.sub(r'VERSION\s+\d+', 'VERSION 103', index)
index = re.sub(r'\?v=\d+', '?v=103', index)
INDEX.write_text(index, encoding='utf-8')
