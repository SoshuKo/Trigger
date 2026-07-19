(() => {
  'use strict';

  const canvas = document.getElementById('titleDemoCanvas');
  const title = document.getElementById('titleScreen');
  if (!canvas || !title) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  const LOGICAL_W = 1280;
  const LOGICAL_H = 720;
  const agents = [];
  const shots = [];
  const bursts = [];
  let previous = performance.now();
  let visibleSince = previous;
  let wasVisible = false;
  let sceneClock = 0;

  function makeAgent(team, role, index) {
    const left = team === 0;
    return {
      team, role,
      x: left ? 150 + index * 46 : 1130 - index * 46,
      y: 165 + index * 118,
      vx: 0, vy: 0,
      aim: left ? 0 : Math.PI,
      cooldown: .25 + Math.random() * 1.2,
      color: left ? '#64e8ff' : '#ff9579',
      phase: Math.random() * Math.PI * 2,
    };
  }

  function resetScene() {
    agents.length = 0; shots.length = 0; bursts.length = 0; sceneClock = 0;
    const roles = ['attacker', 'shooter', 'gunner', 'sniper'];
    roles.forEach((role, index) => { agents.push(makeAgent(0, role, index)); agents.push(makeAgent(1, role, index)); });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.setTransform(width / LOGICAL_W, 0, 0, height / LOGICAL_H, 0, 0);
  }

  function nearestEnemy(agent) {
    return agents.filter((other) => other.team !== agent.team)
      .sort((a, b) => Math.hypot(a.x - agent.x, a.y - agent.y) - Math.hypot(b.x - agent.x, b.y - agent.y))[0] || null;
  }

  function fire(agent, target) {
    const base = Math.atan2(target.y - agent.y, target.x - agent.x);
    if (agent.role === 'attacker') {
      bursts.push({ type: 'slash', x: agent.x, y: agent.y, angle: base, ttl: .38, max: .38, color: agent.color });
      return;
    }
    const count = agent.role === 'gunner' ? 3 : agent.role === 'shooter' ? 5 : 1;
    const speed = agent.role === 'sniper' ? 900 : agent.role === 'gunner' ? 620 : 470;
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * (agent.role === 'shooter' ? .08 : .035);
      shots.push({ x: agent.x, y: agent.y, vx: Math.cos(base + spread) * speed, vy: Math.sin(base + spread) * speed, ttl: 2.2, color: agent.color, size: agent.role === 'sniper' ? 4 : 2 });
    }
    if (agent.role === 'shooter') bursts.push({ type: 'cube', x: agent.x + Math.cos(base) * 34, y: agent.y + Math.sin(base) * 34, ttl: .52, max: .52, color: agent.color });
  }

  function update(dt) {
    sceneClock += dt;
    if (sceneClock > 15) resetScene();
    for (const agent of agents) {
      const target = nearestEnemy(agent); if (!target) continue;
      const angle = Math.atan2(target.y - agent.y, target.x - agent.x);
      agent.aim = angle;
      const distance = Math.hypot(target.x - agent.x, target.y - agent.y);
      const desired = agent.role === 'attacker' ? 105 : agent.role === 'sniper' ? 720 : 390;
      const advance = distance > desired + 80 ? 1 : distance < desired - 70 ? -1 : 0;
      const strafe = Math.sin(sceneClock * .72 + agent.phase) * .55;
      const acceleration = agent.role === 'attacker' ? 82 : 54;
      agent.vx += (Math.cos(angle) * advance + Math.cos(angle + Math.PI / 2) * strafe) * acceleration * dt;
      agent.vy += (Math.sin(angle) * advance + Math.sin(angle + Math.PI / 2) * strafe) * acceleration * dt;
      agent.vx *= Math.pow(.12, dt); agent.vy *= Math.pow(.12, dt);
      agent.x = Math.max(80, Math.min(1200, agent.x + agent.vx * dt));
      agent.y = Math.max(90, Math.min(640, agent.y + agent.vy * dt));
      agent.cooldown -= dt;
      if (agent.cooldown <= 0 && (agent.role !== 'attacker' || distance < 150)) {
        fire(agent, target);
        agent.cooldown = agent.role === 'gunner' ? .62 : agent.role === 'sniper' ? 1.9 : agent.role === 'attacker' ? .8 : 1.05;
      }
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const shot = shots[i]; shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.ttl -= dt;
      if (shot.ttl <= 0 || shot.x < -40 || shot.x > 1320 || shot.y < -40 || shot.y > 760) shots.splice(i, 1);
    }
    for (let i = bursts.length - 1; i >= 0; i--) if ((bursts[i].ttl -= dt) <= 0) bursts.splice(i, 1);
  }

  function draw() {
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(1,10,17,.22)'; ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.strokeStyle = 'rgba(101,232,255,.07)'; ctx.lineWidth = 1;
    for (let x = 0; x <= LOGICAL_W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, LOGICAL_H); ctx.stroke(); }
    for (let y = 0; y <= LOGICAL_H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LOGICAL_W, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(105,173,194,.14)';
    [[455,95,120,245],[685,385,145,210],[575,430,78,118],[850,135,72,170]].forEach(([x,y,w,h]) => ctx.fillRect(x,y,w,h));
    ctx.globalCompositeOperation = 'lighter';
    for (const shot of shots) {
      ctx.globalAlpha = .58; ctx.strokeStyle = shot.color; ctx.lineWidth = shot.size;
      ctx.beginPath(); ctx.moveTo(shot.x, shot.y); ctx.lineTo(shot.x - shot.vx * .045, shot.y - shot.vy * .045); ctx.stroke();
    }
    for (const burst of bursts) {
      const alpha = burst.ttl / burst.max; ctx.globalAlpha = alpha * .7; ctx.strokeStyle = burst.color; ctx.lineWidth = 3;
      if (burst.type === 'slash') { ctx.beginPath(); ctx.arc(burst.x, burst.y, 78 + (1 - alpha) * 45, burst.angle - .7, burst.angle + .7); ctx.stroke(); }
      else { ctx.save(); ctx.translate(burst.x, burst.y); ctx.rotate(sceneClock * 2); ctx.strokeRect(-15, -15, 30, 30); ctx.restore(); }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (const agent of agents) {
      ctx.save(); ctx.translate(agent.x, agent.y); ctx.rotate(agent.aim);
      ctx.globalAlpha = .62; ctx.fillStyle = agent.color; ctx.strokeStyle = 'rgba(235,253,255,.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, -10, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-7, -4, 14, 19); ctx.strokeRect(-8, -5, 16, 21);
      ctx.fillRect(6, 0, agent.role === 'sniper' ? 28 : 18, 4);
      if (agent.role === 'attacker') { ctx.strokeStyle = agent.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(48, 0); ctx.stroke(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const visible = !title.classList.contains('hidden') && title.getClientRects().length > 0;
    if (visible && !wasVisible) { visibleSince = now; previous = now; resetScene(); }
    wasVisible = visible;
    resize();
    const dt = Math.min(.04, Math.max(0, (now - previous) / 1000)); previous = now;
    const running = visible && now - visibleSince >= 1600;
    canvas.classList.toggle('is-running', running);
    canvas.dataset.demoRunning = running ? 'true' : 'false';
    if (running) { update(dt); draw(); }
    else if (!visible) ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    requestAnimationFrame(frame);
  }

  resetScene();
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => { previous = performance.now(); });
  requestAnimationFrame(frame);
})();
