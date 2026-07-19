(() => {
  'use strict';

  const canvas = document.getElementById('titleDemoCanvas');
  const title = document.getElementById('titleScreen');
  if (!canvas || !title) return;
  const ctx = canvas.getContext('2d');
  const agents = [];
  const shots = [];
  const cubes = [];
  let startedAt = performance.now();
  let previous = startedAt;
  let sceneClock = 0;

  function resetScene() {
    agents.length = 0;
    shots.length = 0;
    cubes.length = 0;
    const teams = ['#63e8ff', '#ff8f73'];
    for (let team = 0; team < 2; team++) {
      for (let i = 0; i < 4; i++) {
        agents.push({
          team,
          x: team ? 860 + Math.random() * 210 : 190 + Math.random() * 210,
          y: 170 + i * 105 + Math.random() * 45,
          vx: 0,
          vy: 0,
          aim: team ? Math.PI : 0,
          cooldown: Math.random() * 1.6,
          hp: 1,
          color: teams[team],
          role: ['attacker', 'shooter', 'gunner', 'sniper'][i],
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
    for (let i = 0; i < 14; i++) cubes.push({ x: 420 + Math.random() * 430, y: 80 + Math.random() * 560, s: 5 + Math.random() * 8, phase: Math.random() * 8 });
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function nearestEnemy(agent) {
    let best = null;
    let bestD = Infinity;
    for (const other of agents) {
      if (other.team === agent.team || other.hp <= 0) continue;
      const d = Math.hypot(other.x - agent.x, other.y - agent.y);
      if (d < bestD) { best = other; bestD = d; }
    }
    return best;
  }

  function fire(agent, target) {
    const angle = Math.atan2(target.y - agent.y, target.x - agent.x);
    const speed = agent.role === 'sniper' ? 760 : agent.role === 'gunner' ? 520 : 430;
    const spread = agent.role === 'gunner' ? (Math.random() - .5) * .12 : 0;
    shots.push({ x: agent.x, y: agent.y, vx: Math.cos(angle + spread) * speed, vy: Math.sin(angle + spread) * speed, team: agent.team, ttl: agent.role === 'sniper' ? 1.5 : 2.1, size: agent.role === 'sniper' ? 3 : 2, color: agent.color });
    if (agent.role === 'shooter') cubes.push({ x: agent.x + Math.cos(angle) * 28, y: agent.y + Math.sin(angle) * 28, s: 11, phase: 0, ttl: .34 });
  }

  function update(dt) {
    sceneClock += dt;
    if (sceneClock > 13) { sceneClock = 0; resetScene(); }
    for (const a of agents) {
      const target = nearestEnemy(a);
      if (!target) continue;
      const angle = Math.atan2(target.y - a.y, target.x - a.x);
      a.aim = angle;
      const d = Math.hypot(target.x - a.x, target.y - a.y);
      const desired = a.role === 'attacker' ? 80 : a.role === 'sniper' ? 610 : 300;
      const direction = d > desired + 70 ? 1 : d < desired - 55 ? -1 : 0;
      const strafe = Math.sin(sceneClock * .8 + a.phase) * .5;
      const speed = a.role === 'attacker' ? 66 : 46;
      a.vx += (Math.cos(angle) * direction + Math.cos(angle + Math.PI / 2) * strafe) * speed * dt;
      a.vy += (Math.sin(angle) * direction + Math.sin(angle + Math.PI / 2) * strafe) * speed * dt;
      a.vx *= Math.pow(.08, dt); a.vy *= Math.pow(.08, dt);
      a.x = Math.max(70, Math.min(1210, a.x + a.vx * dt));
      a.y = Math.max(80, Math.min(650, a.y + a.vy * dt));
      a.cooldown -= dt;
      if (a.cooldown <= 0 && (a.role !== 'attacker' || d < 120)) {
        fire(a, target);
        a.cooldown = a.role === 'gunner' ? .18 : a.role === 'sniper' ? 1.75 : a.role === 'attacker' ? .65 : .7;
      }
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.ttl -= dt;
      if (s.ttl <= 0 || s.x < -20 || s.x > 1300 || s.y < -20 || s.y > 740) shots.splice(i, 1);
    }
    for (let i = cubes.length - 1; i >= 0; i--) {
      if (cubes[i].ttl != null && (cubes[i].ttl -= dt) <= 0) cubes.splice(i, 1);
    }
  }

  function draw(time) {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / 1280;
    const sy = rect.height / 720;
    ctx.save();
    ctx.scale(sx, sy);
    ctx.clearRect(0, 0, 1280, 720);
    ctx.fillStyle = 'rgba(2,12,20,.36)'; ctx.fillRect(0, 0, 1280, 720);
    ctx.strokeStyle = 'rgba(103,220,255,.08)'; ctx.lineWidth = 1;
    for (let x = 0; x < 1280; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 720); ctx.stroke(); }
    for (let y = 0; y < 720; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(89,142,164,.13)';
    ctx.fillRect(490, 105, 90, 230); ctx.fillRect(710, 385, 125, 195); ctx.fillRect(585, 420, 72, 110);
    for (const c of cubes) {
      const pulse = 1 + Math.sin(time * .0018 + c.phase) * .18;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(time * .00025 + c.phase); ctx.strokeStyle = 'rgba(90,232,255,.22)'; ctx.strokeRect(-c.s * pulse, -c.s * pulse, c.s * 2 * pulse, c.s * 2 * pulse); ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const s of shots) {
      ctx.strokeStyle = s.color; ctx.globalAlpha = .42;
      ctx.lineWidth = s.size;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * .035, s.y - s.vy * .035); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (const a of agents) {
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.aim);
      ctx.fillStyle = a.color; ctx.globalAlpha = .45;
      ctx.fillRect(-8, -11, 16, 22); ctx.fillRect(7, -3, 15, 6);
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.strokeRect(-9, -12, 18, 24);
      if (a.role === 'attacker') { ctx.strokeStyle = a.color; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(45, 0); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }

  function frame(now) {
    resize();
    const dt = Math.min(.035, Math.max(0, (now - previous) / 1000)); previous = now;
    const visible = !title.classList.contains('hidden');
    if (visible && now - startedAt > 3500) {
      canvas.classList.add('is-running');
      update(dt); draw(now);
    } else if (!visible) {
      canvas.classList.remove('is-running');
    }
    requestAnimationFrame(frame);
  }

  resetScene();
  window.addEventListener('resize', resize, { passive: true });
  requestAnimationFrame(frame);
})();
