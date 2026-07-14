(() => {
  'use strict';

  const DATA = window.WT_DATA;
  if (!DATA) throw new Error('trigger-data.js must be loaded first.');

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const irand = (min, max) => Math.floor(rand(min, max + 1));
  const choose = (array) => array[Math.floor(Math.random() * array.length)];
  const weightedChoice = (items, weightOf = (item) => item.weight || 1) => {
    if (!items.length) return null;
    const weights = items.map((item) => Math.max(0.001, weightOf(item)));
    let roll = Math.random() * weights.reduce((sum, value) => sum + value, 0);
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  };
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const distance = (a, b) => Math.sqrt(dist2(a, b));
  const TAU = Math.PI * 2;
  const BATTLE_LOG_KEY = 'trionArenaBattleLogsV2';
  const MAX_SAVED_LOGS = 30;
  const BASE_PICKUP_COUNT = 320;
  const TIME_PHASES = ['morning', 'day', 'night'];
  const WEATHER_TYPES = ['clear', 'cloudy', 'rain'];
  const MAP_IDS = ['city', 'desert'];
  const MAP_LABELS = { city: '市街', desert: '砂漠' };
  const MODE_LABELS = { solo: '個人戦', team: 'チーム戦', defense: '防衛戦' };
  const isSquadModeValue = (mode) => mode === 'team' || mode === 'defense';
  const TIME_LABELS = { morning: '朝', day: '昼', night: '夜' };
  const WEATHER_LABELS = { clear: '晴', cloudy: '曇り', rain: '雨' };
  const MAX_TEMP_PICKUPS = 80;
  const MAX_BATTLE_EVENTS = 5000;
  const TARGET_LOCK_SECONDS = { '攻撃手': 1.4, '狙撃手': 2.2, '射手': .8, '銃手': .8, '万能手': .9, '重装手': 1.05, '工作手': 1.2, 'プレイヤー': 1 };
  const ATTACK_LABELS = {
    scorpionLong: 'スコーピオン（長刃）',
    mantis: 'マンティス',
    switchboxAttack: 'スイッチボックス（攻撃）',
    meteorMine: '設置メテオラ',
  };
  const AI_DIFFICULTIES = {
    sandbag: { label: 'サンドバッグ', rethink: [1.4, 2.2], aimError: 4.2, move: 0, shieldChance: 0, utilityChance: 0, attackInterval: [99, 99], comboChance: 0, prediction: 0 },
    weak: { label: '弱', rethink: [.7, 1.2], aimError: 2.25, move: .72, shieldChance: .28, utilityChance: .35, attackInterval: [.42, .82], comboChance: .02, prediction: 0 },
    normal: { label: '普通', rethink: [.22, .5], aimError: 1, move: 1, shieldChance: .78, utilityChance: .78, attackInterval: [.11, .25], comboChance: .08, prediction: .06 },
    strong: { label: '強', rethink: [.08, .2], aimError: .38, move: 1.12, shieldChance: .98, utilityChance: .95, attackInterval: [.055, .13], comboChance: .24, prediction: .22 },
  };
  const DEFENSE_BUILD_DEFS = {
    barrier: { label: '防壁', cost: 22, cooldown: 7, ttl: 78, maxActive: 8 },
    trap: { label: '固定トラップ', cost: 26, cooldown: 10, ttl: 86, maxActive: 5 },
    turret: { label: '固定砲台', cost: 40, cooldown: 16, ttl: 92, maxActive: 4 },
    decoy: { label: '囮ビーコン', cost: 16, cooldown: 8, ttl: 48, maxActive: 5 },
  };

  function downloadText(filename, text, mime = 'application/json') {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function readSavedLogs() {
    try {
      const logs = JSON.parse(localStorage.getItem(BATTLE_LOG_KEY) || '[]');
      return Array.isArray(logs) ? logs : [];
    } catch (_) {
      return [];
    }
  }

  function writeSavedLogs(logs) {
    try { localStorage.setItem(BATTLE_LOG_KEY, JSON.stringify(logs.slice(0, MAX_SAVED_LOGS))); } catch (_) { /* optional */ }
  }

  function renderSavedLogSummary() {
    const root = $('#savedLogSummary');
    if (!root) return;
    const logs = readSavedLogs();
    if (!logs.length) {
      root.textContent = '保存ログはありません。試合終了またはタイトルへ戻ると自動保存されます。';
      return;
    }
    root.innerHTML = logs.slice(0, 8).map((log) => {
      const human = log.players?.find((player) => player.human) || {};
      const date = new Date(log.endedAt || log.startedAt || Date.now()).toLocaleString('ja-JP');
      return `<div class="saved-log-row"><strong>${date}<br>${log.modeLabel || log.mode}・${log.difficultyLabel || log.difficulty}</strong><span>${Math.floor(human.score || 0)}pt</span><span>${human.kills || 0}K/${human.deaths || 0}D</span></div>`;
    }).join('');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function initCubeStreams() {
    $$('.cube-stream').forEach((root, rootIndex) => {
      if (root.childElementCount) return;
      for (let i = 0; i < 18; i++) {
        const cube = document.createElement('i');
        cube.className = 'flow-cube';
        const size = 18 + ((i * 17 + rootIndex * 9) % 52);
        cube.style.setProperty('--size', `${size}px`);
        cube.style.setProperty('--left', `${(i * 37 + rootIndex * 19) % 112 - 6}%`);
        cube.style.setProperty('--duration', `${15 + (i * 7) % 19}s`);
        cube.style.setProperty('--delay', `${-((i * 11) % 27)}s`);
        root.appendChild(cube);
      }
    });
  }

  function renderTitleRankings() {
    const logs = readSavedLogs();
    const makeRows = (items, rootSelector, teamMode = false) => {
      const root = $(rootSelector);
      if (!root) return;
      if (!items.length) {
        root.innerHTML = '<div class="title-ranking-empty">まだ記録はありません</div>';
        return;
      }
      root.innerHTML = items.slice(0, 5).map((entry, index) => `
        <div class="title-rank-row">
          <span class="position">${index + 1}</span>
          <div><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.detail)}</small></div>
          <span class="points">${Math.floor(entry.score)}pt</span>
        </div>`).join('');
    };
    const solo = logs.filter((log) => log.mode === 'solo').map((log) => {
      const human = log.players?.find((player) => player.human) || {};
      return {
        name: human.name || 'YOU',
        score: Number(human.score || 0),
        detail: `${human.kills || 0}K / ${human.deaths || 0}D`,
      };
    }).sort((a, b) => b.score - a.score);
    const team = logs.filter((log) => log.mode === 'team').map((log) => {
      const human = log.players?.find((player) => player.human) || {};
      const score = Number(log.teamScores?.[0] ?? human.score ?? 0);
      const enemyScore = Number(log.teamScores?.[1] ?? 0);
      return {
        name: human.squadName || log.humanConfig?.teamConfig?.squadName || '自隊',
        score,
        detail: `${Math.floor(score)} - ${Math.floor(enemyScore)}`,
      };
    }).sort((a, b) => b.score - a.score);
    makeRows(solo, '#soloTitleRanking');
    makeRows(team, '#teamTitleRanking', true);
  }

  function showTitle() {
    if (game) game.destroy();
    game = null;
    window.__TRION_GAME__ = null;
    document.body.classList.remove('game-active');
    document.documentElement.classList.remove('game-active');
    $('#gameScreen')?.classList.add('hidden');
    $('#setupScreen')?.classList.add('hidden');
    $('#titleScreen')?.classList.remove('hidden');
    renderSavedLogSummary();
    renderTitleRankings();
    window.trionOnline?.refreshRankings?.();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function showSetup(options = {}) {
    document.body.classList.remove('game-active');
    document.documentElement.classList.remove('game-active');
    $('#titleScreen')?.classList.add('hidden');
    $('#gameScreen')?.classList.add('hidden');
    $('#setupScreen')?.classList.remove('hidden');
    syncSetupUI();
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (options.controls) setTimeout(() => $('.controls-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  }

  function angleDiff(a, b) {
    let d = (a - b + Math.PI) % TAU - Math.PI;
    if (d < -Math.PI) d += TAU;
    return d;
  }

  function segmentPointDistance(ax, ay, bx, by, px, py) {
    const abx = bx - ax;
    const aby = by - ay;
    const len2 = abx * abx + aby * aby || 1;
    const t = clamp(((px - ax) * abx + (py - ay) * aby) / len2, 0, 1);
    const x = ax + abx * t;
    const y = ay + aby * t;
    return { distance: Math.hypot(px - x, py - y), t, x, y };
  }

  function circleRectOverlap(circle, rect) {
    const x = clamp(circle.x, rect.x, rect.x + rect.w);
    const y = clamp(circle.y, rect.y, rect.y + rect.h);
    const dx = circle.x - x;
    const dy = circle.y - y;
    return dx * dx + dy * dy < circle.radius * circle.radius;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '∞';
    const s = Math.max(0, Math.ceil(seconds));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function canonicalCompositeKey(a, b) {
    const order = { asteroid: 0, meteor: 1, viper: 2, hound: 3 };
    return order[a] <= order[b] ? `${a}+${b}` : `${b}+${a}`;
  }

  const GENERIC_SQUAD_NAMES = ['蒼迅隊','黒狼隊','白鷹隊','紅閃隊','青嵐隊','銀盾隊','疾風隊','雷牙隊','霧島隊','光刃隊','鉄城隊','深森隊'];
  const EMBLEM_PRESETS = ['cube','cross','fang','shield','wing','road','tower'];
  const TEAM_COLORS = ['#4ad9ff', '#ff9f5b', '#9c7dff', '#63df8b'];
  const TEAM_SHORT_NAMES = ['BLUE', 'ORANGE', 'VIOLET', 'GREEN'];
  const PLAYER_ROLES = ['combatant', 'operator', 'spectator'];

  function createBlankEmblem(fill = 0) {
    return new Array(32 * 32).fill(fill);
  }

  function makeEmblemPreset(id = 'cube') {
    const pixels = createBlankEmblem(0);
    const set = (x, y, value = 1) => { if (x >= 0 && x < 32 && y >= 0 && y < 32) pixels[y * 32 + x] = value; };
    const fillRect = (x, y, w, h) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, 1); };
    const line = (x0, y0, x1, y1) => {
      let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
      let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      while (true) {
        set(x0, y0, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = err * 2;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    };
    switch (id) {
      case 'cross':
        fillRect(13, 4, 6, 24); fillRect(5, 13, 22, 6); break;
      case 'fang':
        line(5, 7, 12, 24); line(12, 24, 18, 14); line(18, 14, 27, 25); line(26, 6, 17, 17); fillRect(15, 14, 3, 10); break;
      case 'shield':
        fillRect(9, 5, 14, 3); fillRect(8, 8, 16, 4); fillRect(9, 12, 14, 7); line(9, 19, 16, 27); line(23, 19, 16, 27); break;
      case 'wing':
        line(4, 20, 15, 6); line(15, 6, 16, 26); line(16, 26, 4, 20); line(17, 10, 27, 6); line(17, 16, 28, 16); line(17, 22, 27, 26); break;
      case 'road':
        fillRect(4, 14, 24, 4); line(7, 7, 13, 13); line(25, 7, 19, 13); line(7, 25, 13, 19); line(25, 25, 19, 19); break;
      case 'tower':
        fillRect(12, 5, 8, 4); fillRect(11, 9, 10, 5); fillRect(13, 14, 6, 11); fillRect(10, 25, 12, 3); break;
      case 'cube':
      default:
        line(16, 3, 27, 9); line(27, 9, 27, 22); line(27, 22, 16, 29); line(16, 29, 5, 22); line(5, 22, 5, 9); line(5, 9, 16, 3);
        line(16, 3, 16, 16); line(5, 9, 16, 16); line(27, 9, 16, 16); line(16, 16, 16, 29);
        break;
    }
    return pixels;
  }

  function emblemToString(pixels) {
    return (Array.isArray(pixels) ? pixels : createBlankEmblem()).map((value) => value ? '1' : '0').join('');
  }

  function emblemFromString(serialized) {
    if (typeof serialized !== 'string' || serialized.length !== 1024) return createBlankEmblem();
    return [...serialized].map((char) => char === '1' ? 1 : 0);
  }

  function createDefaultTeamConfig() {
    return {
      playerName: 'YOU',
      squadName: '蒼迅隊',
      bodyColor: '#4aa8ff',
      emblemPreset: 'cube',
      emblemPixels: emblemToString(makeEmblemPreset('cube')),
    };
  }

  function randomCpuAppearance(index, team = 0) {
    const uniform = team === 0 ? ['#4aa8ff', '#2ed0c7', '#7ba8ff'] : team === 1 ? ['#ff9c63', '#e97f4a', '#dba33f'] : ['#cfd6dd', '#8db0c2', '#c491ff'];
    const preset = EMBLEM_PRESETS[index % EMBLEM_PRESETS.length];
    return {
      bodyColor: uniform[index % uniform.length],
      emblemPreset: preset,
      emblemPixels: emblemToString(makeEmblemPreset(preset)),
    };
  }

  function tintColor(hex, amount = 0.15) {
    const v = String(hex || '#789abc').replace('#', '');
    const n = v.length === 3 ? v.split('').map((c) => c + c).join('') : v.padEnd(6, '0');
    const rgb = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
    return '#' + rgb.map((value) => clamp(Math.round(value + (255 - value) * amount), 0, 255).toString(16).padStart(2, '0')).join('');
  }

  const setup = {
    mode: 'solo',
    stats: { trion: 6, technique: 6, combat: 6 },
    budget: 18,
    difficulty: 'normal',
    mapId: 'city',
    playerRole: 'combatant',
    teamCount: 2,
    teamSize: 3,
    timeOfDay: 'day',
    timeProgression: false,
    weather: 'clear',
    weatherChange: false,
    guideEnabled: true,
    soundEnabled: true,
    teamConfig: createDefaultTeamConfig(),
    cpuConfigs: [],
    main: [...DATA.defaultLoadout.main],
    sub: [...DATA.defaultLoadout.sub],
  };

  const CPU_NAMES = ['AZ-01', 'MI-02', 'KA-03', 'SU-04', 'NA-05', 'OU-06', 'IK-07', 'YU-08', 'AR-09', 'NI-10', 'KU-11', 'TS-12', 'KO-13', 'IK-14', 'SA-15', 'KI-16', 'UR-17', 'TO-18', 'EB-19'];

  function makeCpuConfig(index) {
    const template = DATA.aiLoadouts[index % DATA.aiLoadouts.length];
    const squadName = GENERIC_SQUAD_NAMES[index % GENERIC_SQUAD_NAMES.length];
    return {
      id: `cpu-${index}`,
      name: CPU_NAMES[index] || `CPU-${String(index + 1).padStart(2, '0')}`,
      archetype: template.name,
      stats: { trion: 6, technique: 6, combat: 6 },
      main: [...template.main],
      sub: [...template.sub],
      squadName,
      appearance: randomCpuAppearance(index, index % 2),
    };
  }

  function playerOccupiesCombatantSlot() {
    return setup.playerRole === 'combatant';
  }

  function requiredCpuCount() {
    if (setup.mode === 'solo') return Number($('#cpuCount')?.value || 11);
    if (setup.mode === 'defense') return Math.max(0, setup.teamSize - (playerOccupiesCombatantSlot() ? 1 : 0));
    const totalCombatants = setup.teamSize * setup.teamCount;
    return Math.max(1, totalCombatants - (playerOccupiesCombatantSlot() ? 1 : 0));
  }

  function cpuTeamForIndex(index, source = setup) {
    if (source.mode === 'defense') return 0;
    if (source.mode !== 'team') return index + 1;
    let remaining = index;
    for (let team = 0; team < source.teamCount; team++) {
      const slots = source.teamSize - (team === 0 && source.playerRole === 'combatant' ? 1 : 0);
      if (remaining < slots) return team;
      remaining -= slots;
    }
    return Math.max(0, source.teamCount - 1);
  }

  function ensureCpuConfigs() {
    const count = requiredCpuCount();
    while (setup.cpuConfigs.length < count) setup.cpuConfigs.push(makeCpuConfig(setup.cpuConfigs.length));
    setup.cpuConfigs = setup.cpuConfigs.slice(0, count).map((cfg, i) => ({ ...makeCpuConfig(i), ...cfg, stats: { ...makeCpuConfig(i).stats, ...(cfg.stats || {}) }, main: Array.isArray(cfg.main) && cfg.main.length === 4 ? cfg.main : makeCpuConfig(i).main, sub: Array.isArray(cfg.sub) && cfg.sub.length === 4 ? cfg.sub : makeCpuConfig(i).sub }));
  }

  function rebalanceCpuStat(config, changed, desired) {
    const old = config.stats[changed];
    config.stats[changed] = desired;
    let delta = desired - old;
    const others = Object.keys(config.stats).filter((key) => key !== changed);
    let guard = 0;
    while (delta !== 0 && guard++ < 100) {
      let touched = false;
      for (const key of others) {
        if (delta > 0 && config.stats[key] > 2) { config.stats[key]--; delta--; touched = true; }
        else if (delta < 0 && config.stats[key] < 10) { config.stats[key]++; delta++; touched = true; }
        if (!delta) break;
      }
      if (!touched) break;
    }
    if (delta) config.stats[changed] = old;
  }

  function normalizeCpuBagwormTag(config, hand, changedIndex) {
    if (config[hand][changedIndex] === 'bagwormTag') config[hand] = config[hand].map((id, i) => i === changedIndex ? id : 'empty');
    const tag = config[hand].indexOf('bagwormTag');
    if (tag >= 0) config[hand] = config[hand].map((id, i) => i === tag ? id : 'empty');
  }

  function renderEmblemEditor() {
    const canvas = $('#emblemEditor');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pixels = emblemFromString(setup.teamConfig.emblemPixels);
    const scale = canvas.width / 32;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f5fbff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111820';
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (pixels[y * 32 + x]) ctx.fillRect(x * scale, y * scale, scale, scale);
    ctx.strokeStyle = 'rgba(0,0,0,.14)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 32; i++) {
      const p = i * scale;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(canvas.width, p); ctx.stroke();
    }
  }

  function syncTeamCustomizationUI() {
    if (!$('#teamName')) return;
    $('#playerName').value = setup.teamConfig.playerName;
    $('#teamName').value = setup.teamConfig.squadName;
    $('#bodyColor').value = setup.teamConfig.bodyColor || setup.teamConfig.uniformColor || '#4aa8ff';
    $('#emblemPreset').value = setup.teamConfig.emblemPreset;
    $('#teamNamePreview').textContent = setup.teamConfig.squadName;
    renderEmblemEditor();
  }

  function setEmblemPixelFromEvent(event, force) {
    const canvas = $('#emblemEditor');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clamp(Math.floor((event.clientX - rect.left) / (rect.width / 32)), 0, 31);
    const y = clamp(Math.floor((event.clientY - rect.top) / (rect.height / 32)), 0, 31);
    const pixels = emblemFromString(setup.teamConfig.emblemPixels);
    pixels[y * 32 + x] = force ?? (event.buttons === 2 ? 0 : 1);
    setup.teamConfig.emblemPixels = emblemToString(pixels);
    setup.teamConfig.emblemPreset = 'custom';
    if ($('#emblemPreset')) $('#emblemPreset').value = 'custom';
    renderEmblemEditor();
    saveSetup();
  }

  function bindTeamCustomizationControls() {
    $('#playerName')?.addEventListener('input', (event) => { setup.teamConfig.playerName = event.target.value.slice(0, 18) || 'YOU'; saveSetup(); });
    $('#teamName')?.addEventListener('input', (event) => { setup.teamConfig.squadName = (event.target.value || '蒼迅隊').slice(0, 8); $('#teamNamePreview').textContent = setup.teamConfig.squadName; saveSetup(); });
    $('#bodyColor')?.addEventListener('input', (event) => { setup.teamConfig.bodyColor = event.target.value; saveSetup(); });
    $('#emblemPreset')?.addEventListener('change', (event) => {
      setup.teamConfig.emblemPreset = event.target.value;
      if (event.target.value !== 'custom') setup.teamConfig.emblemPixels = emblemToString(makeEmblemPreset(event.target.value));
      renderEmblemEditor();
      saveSetup();
    });
    $('#randomTeamNameButton')?.addEventListener('click', () => {
      setup.teamConfig.squadName = choose(GENERIC_SQUAD_NAMES);
      syncTeamCustomizationUI();
      saveSetup();
    });
    $('#clearEmblemButton')?.addEventListener('click', () => { setup.teamConfig.emblemPreset = 'custom'; setup.teamConfig.emblemPixels = emblemToString(createBlankEmblem()); syncTeamCustomizationUI(); saveSetup(); });
    $('#invertEmblemButton')?.addEventListener('click', () => {
      const pixels = emblemFromString(setup.teamConfig.emblemPixels).map((v) => v ? 0 : 1);
      setup.teamConfig.emblemPreset = 'custom';
      setup.teamConfig.emblemPixels = emblemToString(pixels);
      syncTeamCustomizationUI();
      saveSetup();
    });
    const canvas = $('#emblemEditor');
    if (canvas) {
      let drawing = false;
      canvas.addEventListener('contextmenu', (event) => event.preventDefault());
      canvas.addEventListener('mousedown', (event) => { drawing = true; setEmblemPixelFromEvent(event, event.button === 2 ? 0 : 1); });
      window.addEventListener('mouseup', () => { drawing = false; });
      canvas.addEventListener('mousemove', (event) => { if (drawing) setEmblemPixelFromEvent(event, event.buttons === 2 ? 0 : 1); });
    }
  }

  function buildCpuConfigList() {
    ensureCpuConfigs();
    const root = $('#cpuConfigList');
    if (!root) return;
    const count = requiredCpuCount();
    $('#cpuRosterSummary').textContent = setup.mode === 'team'
      ? `${setup.teamCount}チーム × 戦闘員${setup.teamSize}人・オペレーター各1人`
      : setup.mode === 'defense'
        ? `防衛隊 戦闘員${setup.teamSize}人・オペレーター1人`
        : `CPU ${count}人`;
    root.innerHTML = '';
    setup.cpuConfigs.forEach((config, index) => {
      const team = isSquadModeValue(setup.mode) ? cpuTeamForIndex(index) : index + 1;
      const teamText = setup.mode === 'team' ? TEAM_SHORT_NAMES[team] : setup.mode === 'defense' ? 'DEFENSE' : 'SOLO';
      const card = document.createElement('details');
      card.className = 'cpu-card';
      card.innerHTML = `<summary><span class="cpu-cube-icon">${String(index + 1).padStart(2, '0')}</span><span class="cpu-card-title"><strong>${config.name}</strong><span>${config.archetype} / T${config.stats.trion} 技${config.stats.technique} 戦${config.stats.combat}</span></span><span class="cpu-team-tag" style="color:${isSquadModeValue(setup.mode) ? TEAM_COLORS[team] : '#9db3bc'}">${teamText}</span></summary><div class="cpu-card-body"><div class="cpu-basic-grid"><label>名称<input class="cpu-name" value="${config.name.replace(/"/g, '&quot;')}"></label><label>基本型<select class="cpu-archetype">${DATA.aiLoadouts.map((t) => `<option value="${t.name}"${t.name === config.archetype ? ' selected' : ''}>${t.name}</option>`).join('')}</select></label></div><div class="cpu-stat-row">${['trion','technique','combat'].map((key) => `<label>${key === 'trion' ? 'トリオン' : key === 'technique' ? '技術' : '戦闘'} <output>${config.stats[key]}</output><input type="range" min="2" max="10" value="${config.stats[key]}" data-stat="${key}"></label>`).join('')}</div><div class="cpu-loadout">${['main','sub'].map((hand) => `<div class="cpu-loadout-column"><b>${hand === 'main' ? 'RIGHT / MAIN' : 'LEFT / SUB'}</b>${config[hand].map((id, slot) => `<label>${slot + 1}<select data-hand="${hand}" data-slot="${slot}">${triggerOptionsHtml(id)}</select></label>`).join('')}</div>`).join('')}</div></div>`;
      card.querySelector('.cpu-name').addEventListener('input', (event) => { config.name = event.target.value.slice(0, 18) || `CPU-${index + 1}`; saveSetup(); });
      card.querySelector('.cpu-archetype').addEventListener('change', (event) => { const template = DATA.aiLoadouts.find((t) => t.name === event.target.value); config.archetype = template.name; config.main = [...template.main]; config.sub = [...template.sub]; buildCpuConfigList(); saveSetup(); });
      card.querySelectorAll('input[data-stat]').forEach((input) => input.addEventListener('input', (event) => {
        rebalanceCpuStat(config, event.target.dataset.stat, Number(event.target.value));
        card.querySelectorAll('input[data-stat]').forEach((range) => { range.value = config.stats[range.dataset.stat]; range.closest('label').querySelector('output').value = config.stats[range.dataset.stat]; });
        card.querySelector('.cpu-card-title span').textContent = `${config.archetype} / T${config.stats.trion} 技${config.stats.technique} 戦${config.stats.combat}`;
        saveSetup();
      }));
      card.querySelectorAll('select[data-hand]').forEach((select) => select.addEventListener('change', (event) => { const { hand, slot } = event.target.dataset; config[hand][Number(slot)] = event.target.value; normalizeCpuBagwormTag(config, hand, Number(slot)); buildCpuConfigList(); saveSetup(); }));
      root.appendChild(card);
    });
  }

  function syncModeFields() {
    const isTeam = setup.mode === 'team';
    const isDefense = setup.mode === 'defense';
    const isSquad = isTeam || isDefense;
    if (!isSquad && setup.playerRole === 'operator') setup.playerRole = 'spectator';
    $('#soloCountFields')?.classList.toggle('hidden', isSquad);
    $('#teamCountFields')?.classList.toggle('hidden', !isSquad);
    $('#teamCountOnly')?.classList.toggle('hidden', !isTeam);
    $('#matchLengthFields')?.classList.toggle('hidden', isDefense);
    const roleSelect = $('#participationRole');
    if (roleSelect) {
      const operatorOption = roleSelect.querySelector('option[value="operator"]');
      if (operatorOption) operatorOption.disabled = !isSquad;
      roleSelect.value = setup.playerRole;
    }
    const roleHelp = {
      combatant: isDefense ? '防衛隊の戦闘員としてフラッグを守ります。' : '自分で隊員を操作して戦います。',
      operator: isDefense ? '盤面外から防衛隊へ指示と支援を送り、フラッグ防衛を補助します。' : '盤面には出撃せず、戦闘員数にも含まれません。作戦画面からNPCへ指示と支援を送ります。',
      spectator: isDefense ? '戦闘員数には入らず、防衛戦を観戦します。' : isTeam ? '戦闘員数には入らず、各チームの戦闘を観戦します。' : 'プレイヤーを出撃させず、CPU戦を観戦します。',
    };
    if ($('#participationHelp')) $('#participationHelp').textContent = roleHelp[setup.playerRole];
    $$('.combatant-only').forEach((element) => element.classList.toggle('role-disabled', setup.playerRole !== 'combatant'));
    if ($('#teamRosterHelp')) $('#teamRosterHelp').textContent = isDefense
      ? (setup.playerRole === 'combatant' ? '設定人数にプレイヤーを1人として含みます。共通のフラッグを守ります。' : 'プレイヤーは戦闘員数に含まれず、設定人数ぶんのCPU戦闘員が出撃します。')
      : setup.playerRole === 'combatant'
        ? '自チームの戦闘員数にプレイヤーを1人として含みます。各チームにオペレーターが1人付きます。'
        : 'プレイヤーは戦闘員数に含まれません。全チームが設定人数ぶんのCPU戦闘員を持ちます。';
    const rule = $('#mapRuleText');
    if (rule && isDefense) rule.textContent = 'フラッグを守りながら、ラウンドごとに現れるトリオン兵を撃退します。Fキーで自分のトリオンを注ぎ、フラッグを修復できます。';
    else syncMapWeatherUi();
    buildCpuConfigList();
  }

  function triggerOptionsHtml(selectedId) {
    let html = `<option value="empty"${selectedId === 'empty' ? ' selected' : ''}>― 空き枠 ―</option>`;
    for (const category of DATA.categories) {
      const items = Object.values(DATA.triggers).filter((t) => t.category === category.id);
      if (!items.length) continue;
      html += `<optgroup label="${category.name}">`;
      for (const trigger of items) {
        html += `<option value="${trigger.id}"${trigger.id === selectedId ? ' selected' : ''}>${trigger.name}</option>`;
      }
      html += '</optgroup>';
    }
    return html;
  }

  function buildLoadoutSlots() {
    for (const hand of ['main', 'sub']) {
      const root = $(`#${hand}Slots`);
      root.innerHTML = '';
      setup[hand].forEach((id, index) => {
        const row = document.createElement('label');
        row.className = 'loadout-slot';
        row.dataset.hand = hand;
        row.dataset.index = index;
        const key = hand === 'main' ? index + 1 : index + 5;
        row.innerHTML = `<span class="slot-key">${key}</span><select aria-label="${hand} slot ${index + 1}">${triggerOptionsHtml(id)}</select>`;
        const select = row.querySelector('select');
        select.addEventListener('change', () => {
          setup[hand][index] = select.value;
          normalizeBagwormTag(hand, index);
          saveSetup();
          validateLoadout();
          showTriggerInfo(select.value);
          buildLoadoutSlots();
        });
        select.addEventListener('focus', () => showTriggerInfo(select.value));
        root.appendChild(row);
      });
    }
    applyBagwormTagLocks();
    validateLoadout();
  }

  function normalizeBagwormTag(hand, changedIndex) {
    if (setup[hand][changedIndex] === 'bagwormTag') {
      setup[hand] = setup[hand].map((id, i) => (i === changedIndex ? id : 'empty'));
      return;
    }
    const tagIndex = setup[hand].indexOf('bagwormTag');
    if (tagIndex >= 0) setup[hand] = setup[hand].map((id, i) => (i === tagIndex ? id : 'empty'));
  }

  function applyBagwormTagLocks() {
    for (const hand of ['main', 'sub']) {
      const tagIndex = setup[hand].indexOf('bagwormTag');
      $$(`#${hand}Slots .loadout-slot`).forEach((row, index) => {
        const select = row.querySelector('select');
        const locked = tagIndex >= 0 && index !== tagIndex;
        row.classList.toggle('locked', locked);
        select.disabled = locked;
      });
    }
  }

  function showTriggerInfo(id) {
    const trigger = DATA.triggers[id];
    if (!trigger) return;
    $('#triggerInfo').innerHTML = `<strong>${trigger.name}</strong><span>${trigger.description}${trigger.controls ? `<br>操作：${trigger.controls}` : ''}</span>`;
  }

  function validateLoadout() {
    const warnings = [];
    for (const hand of ['main', 'sub']) {
      const ids = setup[hand];
      if (ids.includes('senku') && !ids.includes('kogetsu')) warnings.push(`${hand === 'main' ? '右手' : '左手'}の旋空には、同じ側の弧月が必要です。`);
      if (ids.includes('thruster') && !ids.includes('raygust')) warnings.push(`${hand === 'main' ? '右手' : '左手'}のスラスターには、同じ側のレイガストが必要です。`);
      if (ids.includes('bagwormTag') && ids.filter((id) => id !== 'empty').length > 1) warnings.push('バッグワームタグは装備側の4枠を占有します。');
    }
    const hasMainScorpion = setup.main.includes('scorpion');
    const hasSubScorpion = setup.sub.includes('scorpion');
    if (hasMainScorpion !== hasSubScorpion) warnings.push('マンティスを使うには左右それぞれにスコーピオンが必要です。');

    const offensiveCount = [...setup.main, ...setup.sub].filter((id) => {
      const kind = DATA.triggers[id]?.kind;
      return ['melee', 'shooter', 'gun', 'sniper', 'pairedOption'].includes(kind);
    }).length;
    if ([...setup.main, ...setup.sub].includes('switchbox') && offensiveCount >= 4) {
      warnings.push('スイッチボックスと多数の攻撃トリガーを併用すると、試合中のトリオン管理がかなり厳しくなります。');
    }

    const root = $('#loadoutWarnings');
    root.innerHTML = warnings.length
      ? warnings.map((w) => `<div class="warning">${w}</div>`).join('')
      : '<div class="warning info">装備条件に問題はありません。Cキーは左右の選択中トリガーを組み合わせます。</div>';
    return warnings;
  }

  function bindSetupControls() {
    $('#enterSetupButton')?.addEventListener('click', () => showSetup());
    $('#titleGuideButton')?.addEventListener('click', () => showSetup({ controls: true }));
    $('#setupBackTitle')?.addEventListener('click', showTitle);

    $('#modeSelector').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-mode]');
      if (!button) return;
      setup.mode = button.dataset.mode;
      $$('#modeSelector button').forEach((b) => b.classList.toggle('active', b === button));
      syncModeFields();
      saveSetup();
    });

    $('#cpuCount').addEventListener('input', (event) => {
      $('#cpuCountValue').textContent = event.target.value;
      buildCpuConfigList();
      saveSetup();
    });
    $('#participationRole').addEventListener('change', (event) => { setup.playerRole = PLAYER_ROLES.includes(event.target.value) ? event.target.value : 'combatant'; syncModeFields(); saveSetup(); });
    $('#teamCount').addEventListener('input', (event) => { setup.teamCount = clamp(Number(event.target.value), 2, 4); $('#teamCountValue').textContent = setup.teamCount; buildCpuConfigList(); saveSetup(); });
    $('#teamSize').addEventListener('input', (event) => { setup.teamSize = Number(event.target.value); $('#teamSizeValue').textContent = event.target.value; buildCpuConfigList(); saveSetup(); });
    $('#timeOfDay').addEventListener('change', (event) => { setup.timeOfDay = event.target.value; saveSetup(); });
    $('#timeProgression').addEventListener('change', (event) => { setup.timeProgression = event.target.value === 'on'; saveSetup(); });
    $('#weather').addEventListener('change', (event) => { setup.weather = event.target.value; saveSetup(); });
    $('#weatherChange').addEventListener('change', (event) => { setup.weatherChange = event.target.value === 'on'; saveSetup(); });
    $('#resetCpuConfigsButton').addEventListener('click', () => { setup.cpuConfigs = []; ensureCpuConfigs(); buildCpuConfigList(); saveSetup(); });
    $('#guideEnabled')?.addEventListener('change', (event) => { setup.guideEnabled = event.target.checked; saveSetup(); });
    $('#soundEnabled')?.addEventListener('change', (event) => { setup.soundEnabled = event.target.checked; saveSetup(); });
    $('#mapId')?.addEventListener('change', (event) => { setup.mapId = MAP_IDS.includes(event.target.value) ? event.target.value : 'city'; syncMapWeatherUi(); saveSetup(); });
    $('#matchLength').addEventListener('change', saveSetup);
    $('#difficulty').addEventListener('change', (event) => {
      setup.difficulty = event.target.value;
      saveSetup();
    });

    $('#exportAllLogsButton').addEventListener('click', () => {
      const logs = readSavedLogs();
      if (!logs.length) return;
      downloadText(`trion-arena-all-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, JSON.stringify(logs, null, 2));
    });
    $('#clearLogsButton').addEventListener('click', () => {
      writeSavedLogs([]);
      renderSavedLogSummary();
    });

    const statIds = { trion: '#trionStat', technique: '#techniqueStat', combat: '#combatStat' };
    for (const [stat, id] of Object.entries(statIds)) {
      $(id).addEventListener('input', (event) => rebalanceStats(stat, Number(event.target.value)));
    }

    $('#startButton').addEventListener('click', startFromSetup);
    $('#rematchButton').addEventListener('click', () => {
      $('#resultOverlay').classList.add('hidden');
      launchGame(currentConfig);
    });
    $('#backButton').addEventListener('click', () => {
      if (game) game.returnToSetup('result_back');
      else showSetup();
    });
  }

  function rebalanceStats(changed, desired) {
    const stats = { ...setup.stats };
    const old = stats[changed];
    stats[changed] = desired;
    let delta = desired - old;
    const others = Object.keys(stats).filter((key) => key !== changed);
    let guard = 0;
    while (delta !== 0 && guard++ < 100) {
      let changedAny = false;
      for (const key of others) {
        if (delta > 0 && stats[key] > 2) {
          stats[key] -= 1;
          delta -= 1;
          changedAny = true;
        } else if (delta < 0 && stats[key] < 10) {
          stats[key] += 1;
          delta += 1;
          changedAny = true;
        }
        if (delta === 0) break;
      }
      if (!changedAny) break;
    }
    if (delta !== 0) stats[changed] = old;
    setup.stats = stats;
    syncStatsUI();
    saveSetup();
  }

  function syncStatsUI() {
    for (const stat of ['trion', 'technique', 'combat']) {
      $(`#${stat}Stat`).value = setup.stats[stat];
      $(`#${stat}Value`).textContent = setup.stats[stat];
    }
    const total = Object.values(setup.stats).reduce((a, b) => a + b, 0);
    $('#budgetValue').textContent = `${total} / ${setup.budget}`;
    $('#budgetValue').style.color = total === setup.budget ? 'var(--green)' : 'var(--red)';
  }

  function saveSetup() {
    try {
      localStorage.setItem('trionArenaSetup', JSON.stringify({
        mode: setup.mode,
        stats: setup.stats,
        main: setup.main,
        sub: setup.sub,
        cpuCount: Number($('#cpuCount')?.value || 11),
        matchLength: Number($('#matchLength')?.value ?? 180),
        difficulty: setup.difficulty,
        mapId: setup.mapId,
        playerRole: setup.playerRole,
        teamCount: setup.teamCount,
        teamSize: setup.teamSize,
        timeOfDay: setup.timeOfDay,
        timeProgression: setup.timeProgression,
        weather: setup.weather,
        weatherChange: setup.weatherChange,
        guideEnabled: setup.guideEnabled,
        soundEnabled: setup.soundEnabled,
        teamConfig: setup.teamConfig,
        cpuConfigs: setup.cpuConfigs,
      }));
    } catch (_) {
      // Local storage is optional.
    }
  }

  function loadSetup() {
    try {
      const saved = JSON.parse(localStorage.getItem('trionArenaSetup'));
      if (!saved) return;
      if (['solo', 'team', 'defense'].includes(saved.mode)) setup.mode = saved.mode;
      if (saved.stats && Object.values(saved.stats).reduce((a, b) => a + b, 0) === setup.budget) setup.stats = saved.stats;
      if (Array.isArray(saved.main) && saved.main.length === 4) setup.main = saved.main.map((id) => DATA.triggers[id] ? id : 'empty');
      if (Array.isArray(saved.sub) && saved.sub.length === 4) setup.sub = saved.sub.map((id) => DATA.triggers[id] ? id : 'empty');
      if (saved.cpuCount) $('#cpuCount').value = clamp(saved.cpuCount, 3, 19);
      if (saved.matchLength !== undefined && saved.matchLength !== null) $('#matchLength').value = String(saved.matchLength);
      if (AI_DIFFICULTIES[saved.difficulty]) setup.difficulty = saved.difficulty;
      if (MAP_IDS.includes(saved.mapId)) setup.mapId = saved.mapId;
      if (PLAYER_ROLES.includes(saved.playerRole)) setup.playerRole = saved.playerRole;
      if (saved.teamCount) setup.teamCount = clamp(Number(saved.teamCount), 2, 4);
      if (saved.teamSize) setup.teamSize = clamp(Number(saved.teamSize), 1, 4);
      if (TIME_PHASES.includes(saved.timeOfDay)) setup.timeOfDay = saved.timeOfDay;
      setup.timeProgression = Boolean(saved.timeProgression);
      if (WEATHER_TYPES.includes(saved.weather)) setup.weather = saved.weather;
      setup.weatherChange = Boolean(saved.weatherChange);
      if (saved.guideEnabled !== undefined) setup.guideEnabled = Boolean(saved.guideEnabled);
      if (saved.soundEnabled !== undefined) setup.soundEnabled = Boolean(saved.soundEnabled);
      if (saved.teamConfig) {
        setup.teamConfig = { ...createDefaultTeamConfig(), ...saved.teamConfig };
        if (!setup.teamConfig.bodyColor && setup.teamConfig.uniformColor) setup.teamConfig.bodyColor = setup.teamConfig.uniformColor;
      }
      if (Array.isArray(saved.cpuConfigs)) setup.cpuConfigs = saved.cpuConfigs;
    } catch (_) {
      // Ignore malformed storage.
    }
  }

  function syncMapWeatherUi() {
    const mapId = MAP_IDS.includes(setup.mapId) ? setup.mapId : 'city';
    const weatherSelect = $('#weather');
    const rainOption = weatherSelect?.querySelector('option[value="rain"]');
    if (rainOption) {
      rainOption.disabled = mapId === 'desert';
      rainOption.hidden = mapId === 'desert';
    }
    if (mapId === 'desert' && setup.weather === 'rain') setup.weather = 'clear';
    if (weatherSelect) weatherSelect.value = setup.weather;
    const help = $('#mapHelp');
    const rule = $('#mapRuleText');
    if (help) help.textContent = mapId === 'desert'
      ? '古代要塞、崖、流砂、砂丘、オアシス、松明、ガス田がある乾燥地帯です。雨は降りません。'
      : '道路・河川・林・ビルが混在する市街戦マップです。';
    if (rule && setup.mode !== 'defense') rule.textContent = mapId === 'desert'
      ? '砂漠では昼は日陰・オアシス、夜は火のそばで環境によるトリオン消費増加を解除できます。ガス田付近で爆発攻撃を使うと大爆発します。'
      : '撃破・トリオン粒子回収でポイント獲得。時間終了時の個人／チームスコアで順位を決定します。';
  }

  function syncSetupUI() {
    $$('#modeSelector button').forEach((b) => b.classList.toggle('active', b.dataset.mode === setup.mode));
    $('#cpuCountValue').textContent = $('#cpuCount').value;
    $('#difficulty').value = setup.difficulty;
    $('#mapId').value = setup.mapId;
    $('#participationRole').value = setup.playerRole;
    $('#teamCount').value = setup.teamCount;
    $('#teamCountValue').textContent = setup.teamCount;
    $('#teamSize').value = setup.teamSize;
    $('#teamSizeValue').textContent = setup.teamSize;
    $('#timeOfDay').value = setup.timeOfDay;
    $('#timeProgression').value = setup.timeProgression ? 'on' : 'off';
    $('#weather').value = setup.weather;
    $('#weatherChange').value = setup.weatherChange ? 'on' : 'off';
    if ($('#guideEnabled')) $('#guideEnabled').checked = setup.guideEnabled;
    if ($('#soundEnabled')) $('#soundEnabled').checked = setup.soundEnabled;
    syncStatsUI();
    buildLoadoutSlots();
    syncModeFields();
    syncMapWeatherUi();
    syncTeamCustomizationUI();
  }

  function getSetupConfig() {
    return {
      mode: setup.mode,
      playerRole: setup.playerRole,
      cpuCount: requiredCpuCount(),
      teamCount: setup.mode === 'team' ? setup.teamCount : setup.mode === 'defense' ? 1 : 0,
      teamSize: setup.teamSize,
      matchLength: setup.mode === 'defense' ? 0 : Number($('#matchLength').value),
      difficulty: setup.difficulty,
      mapId: setup.mapId,
      timeOfDay: setup.timeOfDay,
      timeProgression: setup.timeProgression,
      weather: setup.weather,
      weatherChange: setup.weatherChange,
      guideEnabled: setup.guideEnabled,
      soundEnabled: setup.soundEnabled,
      teamConfig: JSON.parse(JSON.stringify(setup.teamConfig)),
      cpuConfigs: setup.cpuConfigs.slice(0, requiredCpuCount()).map((cfg) => JSON.parse(JSON.stringify(cfg))),
      stats: { ...setup.stats },
      loadout: { main: [...setup.main], sub: [...setup.sub] },
    };
  }

  function startFromSetup() {
    const config = getSetupConfig();
    currentConfig = config;
    launchGame(config);
  }

  window.TRION_GET_SETUP_CONFIG = getSetupConfig;
  window.TRION_START_ONLINE_MATCH = (session) => {
    if (!session) return;
    const descriptor = window.trionOnline?.getSessionDescriptor?.() || {};
    const roster = Array.isArray(session.roster) ? session.roster : descriptor.roster || [];
    const local = roster.find((member) => member.userId === descriptor.localUserId) || {};
    const base = { ...getSetupConfig(), ...(session.settings || {}) };
    base.playerRole = local.role || 'spectator';
    const combatants = roster.filter((member) => member.role === 'combatant');
    const maxRosterTeam = roster.reduce((max, member) => Math.max(max, Number(member.team || 0)), 0);
    const largestHumanTeam = combatants.reduce((counts, member) => {
      const team = Number(member.team || 0);
      counts[team] = (counts[team] || 0) + 1;
      return counts;
    }, []);
    base.teamCount = Math.min(4, Math.max(2, Number(base.teamCount || 2), maxRosterTeam + 1));
    if (base.mode === 'team') base.teamSize = Math.min(4, Math.max(1, Number(base.teamSize || 3), ...largestHumanTeam.filter(Number.isFinite)));
    if (base.mode === 'defense') base.teamSize = Math.min(4, Math.max(1, Number(base.teamSize || 3), combatants.length));
    if (base.mode === 'solo') base.cpuCount = Math.max(0, Number(base.cpuCount ?? 11));
    base.onlineSession = {
      roomId: session.roomId || descriptor.roomId,
      roomCode: session.roomCode || descriptor.roomCode,
      hostId: session.hostId || descriptor.hostId,
      localUserId: descriptor.localUserId,
      isHost: (session.hostId || descriptor.hostId) === descriptor.localUserId,
      roster,
      startedAt: session.startedAt || Date.now(),
    };
    currentConfig = base;
    launchGame(base);
  };

  let game = null;
  let currentConfig = null;

  function launchGame(config) {
    if (game) game.destroy();
    config.difficulty = AI_DIFFICULTIES[config.difficulty] ? config.difficulty : 'normal';
    document.activeElement?.blur?.();
    document.body.classList.add('game-active');
    document.documentElement.classList.add('game-active');
    $('#onlinePanel')?.classList.add('hidden');
    $('#titleScreen')?.classList.add('hidden');
    $('#setupScreen').classList.add('hidden');
    $('#gameScreen').classList.remove('hidden');
    $('#resultOverlay').classList.add('hidden');
    $('#pauseOverlay').classList.add('hidden');
    $('#debugPanel').classList.add('hidden');
    $('#operatorPanel').classList.add('hidden');
    $('#spectatorHud').classList.add('hidden');
    $('#centerMessage').classList.add('hidden');
    $('#killFeed').innerHTML = '';
    $('#spectateButton').textContent = 'SPECTATE';
    $('#pauseSpectateButton').textContent = '観戦モード';
    game = new ArenaGame(config);
    window.__TRION_GAME__ = game;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      $('#gameCanvas')?.focus?.({ preventScroll: true });
    });
    game.start();
  }

  class InputController {
    constructor(canvas) {
      this.canvas = canvas;
      this.keys = new Set();
      this.justKeys = new Set();
      this.virtualKeys = new Set();
      this.virtualJustKeys = new Set();
      this.virtualMove = { x: 0, y: 0 };
      this.virtualAim = { x: 1, y: 0, active: false };
      this.virtualMain = false;
      this.virtualSub = false;
      this.virtualMainJust = false;
      this.virtualSubJust = false;
      this.mouse = { x: innerWidth / 2, y: innerHeight / 2, left: false, right: false, justLeft: false, justRight: false };
      this.listeners = [];
      this.bind(window, 'keydown', (e) => {
        if (!this.keys.has(e.code)) this.justKeys.add(e.code);
        this.keys.add(e.code);
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      });
      this.bind(window, 'keyup', (e) => this.keys.delete(e.code));
      this.bind(canvas, 'mousemove', (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
      });
      this.bind(canvas, 'mousedown', (e) => {
        if (e.button === 0) {
          if (!this.mouse.left) this.mouse.justLeft = true;
          this.mouse.left = true;
        }
        if (e.button === 2) {
          if (!this.mouse.right) this.mouse.justRight = true;
          this.mouse.right = true;
        }
      });
      this.bind(window, 'mouseup', (e) => {
        if (e.button === 0) this.mouse.left = false;
        if (e.button === 2) this.mouse.right = false;
      });
      this.bind(canvas, 'contextmenu', (e) => e.preventDefault());
      this.bind(window, 'blur', () => {
        this.keys.clear();
        this.virtualKeys.clear();
        this.mouse.left = false;
        this.mouse.right = false;
        this.virtualMain = false;
        this.virtualSub = false;
        this.virtualMove.x = 0;
        this.virtualMove.y = 0;
      });
      this.bindMobileControls();
    }

    bindMobileControls() {
      const bindPad = (selector, target, keepActive = false) => {
        const pad = $(selector);
        if (!pad) return;
        const thumb = pad.querySelector('i');
        let pointerId = null;
        const update = (event) => {
          const rect = pad.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          let x = event.clientX - cx;
          let y = event.clientY - cy;
          const max = rect.width * .32;
          const len = Math.hypot(x, y) || 1;
          if (len > max) { x = x / len * max; y = y / len * max; }
          target.x = x / max;
          target.y = y / max;
          if ('active' in target) target.active = true;
          if (thumb) thumb.style.transform = `translate(${x}px,${y}px)`;
        };
        const down = (event) => { pointerId = event.pointerId; pad.setPointerCapture?.(pointerId); update(event); event.preventDefault(); };
        const move = (event) => { if (event.pointerId === pointerId) { update(event); event.preventDefault(); } };
        const up = (event) => {
          if (event.pointerId !== pointerId) return;
          pointerId = null;
          if (!keepActive) { target.x = 0; target.y = 0; }
          if (thumb) thumb.style.transform = 'translate(0,0)';
          event.preventDefault();
        };
        this.bind(pad, 'pointerdown', down);
        this.bind(pad, 'pointermove', move);
        this.bind(pad, 'pointerup', up);
        this.bind(pad, 'pointercancel', up);
      };
      bindPad('#movePad', this.virtualMove, false);
      bindPad('#aimPad', this.virtualAim, true);
      $$('[data-mobile-key]').forEach((button) => {
        const handler = (event) => {
          this.virtualJustKeys.add(button.dataset.mobileKey);
          button.classList.add('pressed');
          setTimeout(() => button.classList.remove('pressed'), 120);
          event.preventDefault();
        };
        this.bind(button, 'pointerdown', handler);
      });
      $$('[data-mobile-hold]').forEach((button) => {
        const action = button.dataset.mobileHold;
        const down = (event) => {
          button.classList.add('pressed');
          if (action === 'main') { if (!this.virtualMain) this.virtualMainJust = true; this.virtualMain = true; }
          if (action === 'sub') { if (!this.virtualSub) this.virtualSubJust = true; this.virtualSub = true; }
          if (action === 'shift') this.virtualKeys.add('ShiftLeft');
          button.setPointerCapture?.(event.pointerId);
          event.preventDefault();
        };
        const up = (event) => {
          button.classList.remove('pressed');
          if (action === 'main') this.virtualMain = false;
          if (action === 'sub') this.virtualSub = false;
          if (action === 'shift') this.virtualKeys.delete('ShiftLeft');
          event.preventDefault();
        };
        this.bind(button, 'pointerdown', down);
        this.bind(button, 'pointerup', up);
        this.bind(button, 'pointercancel', up);
      });
    }

    bind(target, event, handler) {
      target.addEventListener(event, handler, { passive: false });
      this.listeners.push(() => target.removeEventListener(event, handler));
    }

    isDown(code) { return this.keys.has(code) || this.virtualKeys.has(code); }
    consume(code) {
      const value = this.justKeys.has(code) || this.virtualJustKeys.has(code);
      this.justKeys.delete(code);
      this.virtualJustKeys.delete(code);
      return value;
    }
    endFrame() {
      this.justKeys.clear();
      this.virtualJustKeys.clear();
      this.mouse.justLeft = false;
      this.mouse.justRight = false;
      this.virtualMainJust = false;
      this.virtualSubJust = false;
    }
    destroy() { this.listeners.forEach((off) => off()); }
  }

  class SoundManager {
    constructor(enabled = true, listenerProvider = () => null) {
      this.enabled = enabled;
      this.listenerProvider = listenerProvider;
      this.maxVoices = 12;
      this.active = [];
      this.lastPlayed = new Map();
      this.assets = {
        explosion: 'assets/audio/explosion.mp3',
        attacker: 'assets/audio/attacker.mp3',
        sniper: 'assets/audio/sniper.mp3',
        gunner: 'assets/audio/gunner.mp3',
      };
      this.baseVolume = { explosion: .54, attacker: .42, sniper: .48, gunner: .30 };
      this.defaultCooldown = { explosion: .11, attacker: .09, sniper: .16, gunner: .075 };
      this.bases = {};
      for (const [key, src] of Object.entries(this.assets)) {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.playsInline = true;
        this.bases[key] = audio;
      }
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      if (!this.enabled) {
        for (const audio of this.active) { try { audio.pause(); } catch (_) { /* no-op */ } }
        this.active.length = 0;
      }
    }

    spatialGain(x, y, maxDistance = 1500) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return 1;
      const listener = this.listenerProvider?.();
      if (!listener || !Number.isFinite(listener.x) || !Number.isFinite(listener.y)) return .72;
      const d = Math.hypot(listener.x - x, listener.y - y);
      if (d >= maxDistance) return 0;
      const normalized = 1 - d / maxDistance;
      return .08 + normalized * normalized * .92;
    }

    play(key, options = {}) {
      if (!this.enabled || !this.bases[key]) return;
      const now = performance.now() / 1000;
      const bucket = options.bucket || key;
      const cooldown = Number.isFinite(options.cooldown) ? options.cooldown : this.defaultCooldown[key] || .08;
      if (now - (this.lastPlayed.get(bucket) || -999) < cooldown) return;
      const gain = this.spatialGain(options.x, options.y, options.maxDistance || 1500);
      const volume = clamp((options.volume ?? this.baseVolume[key] ?? .35) * gain, 0, .72);
      if (volume < .015) return;
      this.lastPlayed.set(bucket, now);
      this.active = this.active.filter((audio) => !audio.ended && !audio.paused);
      if (this.active.length >= this.maxVoices) {
        const oldest = this.active.shift();
        try { oldest.pause(); } catch (_) { /* no-op */ }
      }
      const audio = this.bases[key].cloneNode(true);
      audio.volume = volume;
      audio.playbackRate = clamp(options.rate ?? rand(.95, 1.05), .72, 1.35);
      if (Number.isFinite(options.offset)) audio.currentTime = Math.max(0, options.offset);
      this.active.push(audio);
      const cleanup = () => { const index = this.active.indexOf(audio); if (index >= 0) this.active.splice(index, 1); };
      audio.addEventListener('ended', cleanup, { once: true });
      audio.addEventListener('error', cleanup, { once: true });
      const promise = audio.play();
      if (promise?.catch) promise.catch(cleanup);
    }

    destroy() {
      for (const audio of this.active) { try { audio.pause(); } catch (_) { /* no-op */ } }
      this.active.length = 0;
      this.lastPlayed.clear();
    }
  }

  class ArenaGame {
    constructor(config) {
      this.config = config;
      this.onlineSession = config.onlineSession || null;
      this.isOnlineMatch = Boolean(this.onlineSession?.roomId && window.trionOnline);
      this.isOnlineHost = Boolean(this.isOnlineMatch && this.onlineSession.isHost);
      this.onlineMirror = Boolean(this.isOnlineMatch && !this.isOnlineHost);
      this.localOnlineUserId = this.onlineSession?.localUserId || null;
      this.onlineLocalMember = this.onlineSession?.roster?.find((member) => member.userId === this.localOnlineUserId) || null;
      this.onlineRemoteInputs = new Map();
      this.onlineInputSequence = 0;
      this.onlineInputTimer = 0;
      this.onlineSnapshotTimer = 0;
      this.onlineSnapshotSequence = 0;
      this.onlineLastAppliedSequence = -1;
      this.onlineSyncRetryTimer = .8;
      this.onlineMemberCount = Math.max(1, Number(this.onlineSession?.roster?.length || 1));
      const requestedSnapshotHz = Math.max(2, Math.min(8, Number(window.TRION_ONLINE_CONFIG?.snapshotHz || 6)));
      const adaptiveSnapshotCap = this.onlineMemberCount <= 4 ? 6 : this.onlineMemberCount <= 8 ? 4 : this.onlineMemberCount <= 12 ? 3 : 2;
      this.onlineSnapshotHz = Math.min(requestedSnapshotHz, adaptiveSnapshotCap);
      this.onlineInputHz = this.onlineMemberCount <= 4 ? 14 : this.onlineMemberCount <= 8 ? 8 : this.onlineMemberCount <= 12 ? 5 : 3;
      const lowCoreDevice = Number(navigator.hardwareConcurrency || 8) <= 4;
      const lowMemoryDevice = Number(navigator.deviceMemory || 8) <= 4;
      const mobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
      this.onlineLowPowerGuest = Boolean(this.onlineMirror && (lowCoreDevice || lowMemoryDevice || mobileDevice));
      this.onlineReducedEffects = Boolean(this.onlineMirror);
      this.onlineRenderInterval = this.onlineMirror ? (this.onlineLowPowerGuest ? 1 / 30 : 1 / 45) : 0;
      this.onlineRenderAccumulator = 0;
      this.hudRefreshTimer = 0;
      this.radarRefreshTimer = 0;
      this.onlinePendingSnapshot = null;
      this.onlineUnsubscribe = null;
      this.onlineLastSnapshotAt = 0;
      this.onlineWorldReceived = !this.onlineMirror;
      this.onlineSnapshotReceived = !this.onlineMirror;
      this.onlineWorldReady = !this.onlineMirror;
      this.onlineApplyingRemote = false;
      this.mapId = MAP_IDS.includes(config.mapId) ? config.mapId : 'city';
      this.playerRole = PLAYER_ROLES.includes(config.playerRole) ? config.playerRole : 'combatant';
      this.playerTeam = Number(this.onlineLocalMember?.team || 0);
      this.isDefenseMode = config.mode === 'defense';
      this.teamCount = config.mode === 'team' ? clamp(Number(config.teamCount || 2), 2, 4) : this.isDefenseMode ? 1 : 0;
      this.isPlayerCombatant = this.playerRole === 'combatant';
      this.isPlayerOperator = (config.mode === 'team' || this.isDefenseMode) && this.playerRole === 'operator';
      this.isSetupSpectator = this.playerRole === 'spectator';
      this.canvas = $('#gameCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.radarCanvas = $('#radarCanvas');
      this.radarCtx = this.radarCanvas.getContext('2d');
      this.input = new InputController(this.canvas);
      this.soundEnabled = setup.soundEnabled !== false;
      this.sfx = new SoundManager(this.soundEnabled, () => {
        if (this.isPlayerOperator) return { x: this.operatorCamera.x, y: this.operatorCamera.y };
        if (this.spectating) return this.getSpectatorTarget?.() || this.human || null;
        return this.human || null;
      });
      this.world = { w: 6400, h: 4400 };
      this.camera = { x: 0, y: 0 };
      this.terrain = { roads: [], plazas: [], rivers: [], forests: [], buildings: [], bridges: [], dunes: [], oases: [], quicksand: [], cliffs: [], fortresses: [], shades: [], gasFields: [] };
      this.terrainChunkSize = 640;
      this.terrainChunks = new Map();
      this.maxTerrainChunks = this.onlineMirror ? 12 : 24;
      this.installations = [];
      this.lightSources = [];
      this.worldRespawns = [];
      this.environmentCanvas = document.createElement('canvas');
      this.environmentCtx = this.environmentCanvas.getContext('2d');
      this.operators = [];
      this.operatorVisible = false;
      this.operatorPendingCommand = null;
      this.operatorSelectedUnit = 'all';
      this.operatorEnemyId = null;
      this.operatorAllyId = null;
      this.operatorAiTimer = 3;
      this.operatorCamera = { x: this.world.w * .25, y: this.world.h * .5, followId: null };
      this.operatorSupportCooldowns = { scan: 0, supply: 0, flare: 0, barrier: 0, rally: 0, decoy: 0, flagRepair: 0 };
      this.operatorSupportDurations = { scan: 24, supply: 32, flare: 26, barrier: 36, rally: 30, decoy: 28, flagRepair: 42 };
      this.operatorSupportPending = null;
      this.operatorStats = { ordersIssued: 0, supportsUsed: 0, scan: 0, supply: 0, flare: 0, barrier: 0, rally: 0, decoy: 0, flagRepair: 0 };
      const initialWeather = this.mapId === 'desert' && config.weather === 'rain' ? 'clear' : (WEATHER_TYPES.includes(config.weather) ? config.weather : 'clear');
      this.environment = { timeOfDay: TIME_PHASES.includes(config.timeOfDay) ? config.timeOfDay : 'day', timeProgression: Boolean(config.timeProgression), timeTimer: 0, weather: initialWeather, weatherChange: Boolean(config.weatherChange), weatherTimer: rand(75, 115) };
      this.players = [];
      this.defenseFlag = null;
      this.defenseRound = 0;
      this.defenseTier = 0;
      this.defenseWaveActive = false;
      this.defenseRoundTimer = 3.5;
      this.defenseEnemiesDefeated = 0;
      this.defenseBossesDefeated = 0;
      this.defenseHazards = [];
      this.defenseEnemySerial = 0;
      this.flagChannelTimer = 0;
      this.defenseBuildPoints = 0;
      this.defenseBuildMaxPoints = 0;
      this.defenseBuildCooldowns = { barrier: 0, trap: 0, turret: 0, decoy: 0 };
      this.defenseBuildSerial = 0;
      this.defenseNpcBuildTimer = 2.5;
      this.defenseBuildStats = { barrier: 0, trap: 0, turret: 0, decoy: 0 };
      this.projectiles = [];
      this.effects = [];
      this.particles = [];
      this.walls = [];
      this.wires = [];
      this.mines = [];
      this.traps = [];
      this.beacons = [];
      this.pickups = [];
      this.isUnlimited = this.isDefenseMode || !Number.isFinite(config.matchLength) || config.matchLength <= 0;
      this.matchTime = this.isUnlimited ? Infinity : config.matchLength;
      this.activationCounter = 0;
      this.pickupStats = { baseSpawned: 0, temporarySpawned: 0, temporaryExpired: 0, peakTotal: 0 };
      this.elapsed = 0;
      this.paused = false;
      this.ended = false;
      this.running = false;
      this.spectating = this.isSetupSpectator;
      this.spectatorTargetId = null;
      this.lastTime = performance.now();
      this.frameHandle = 0;
      this.teamScores = this.config.mode === 'team' ? new Array(this.teamCount).fill(0) : [0];
      this.toastTimer = 0;
      this.messageTimer = 0;
      this.killFeedItems = [];
      this.teamColors = [...TEAM_COLORS];
      this.uiListeners = [];
      this.debugVisible = false;
      this.guideVisible = config.guideEnabled !== false;
      this.debugRefreshTimer = 0;
      this.logFinalized = false;
      this.finalLog = null;
      this.battleEvents = [];
      this.lifecycleStats = { placedDespawned: 0, terrainDestroyed: 0, terrainRespawned: 0, installationsDestroyed: 0, installationsRespawned: 0, lightsDestroyed: 0, lightsRespawned: 0, gasExplosions: 0 };
      this.matchId = `match-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      this.startedAt = new Date().toISOString();
      this.resizeQueued = false;
      this.resizeHandler = () => {
        if (this.resizeQueued) return;
        this.resizeQueued = true;
        requestAnimationFrame(() => { this.resizeQueued = false; this.resize(); });
      };
      window.addEventListener('resize', this.resizeHandler);
      window.visualViewport?.addEventListener('resize', this.resizeHandler);
      this.resize();
      this.generateArena();
      this.spawnCombatants();
      if (this.isOnlineMatch) this.setupOnlineNetworking();
      this.buildSlotHud();
      this.updateStaticHud();
      this.bindGameUi();
      this.setGuideVisible(this.guideVisible);
      this.refreshOperatorUi();
      this.updateEnvironmentLabel();
      this.logEvent('match_start', `${MAP_LABELS[this.mapId]} / ${MODE_LABELS[this.config.mode] || '個人戦'} / ${AI_DIFFICULTIES[this.config.difficulty]?.label || '普通'}`);
    }

    setupOnlineNetworking() {
      if (!window.trionOnline || !this.isOnlineMatch) return;
      this.onlineUnsubscribe = window.trionOnline.onGameEvent(({ event, data, senderId }) => {
        if (!data && !['sync_request'].includes(event)) return;
        if (event === 'input' && this.isOnlineHost) {
          this.onlineRemoteInputs.set(senderId, { ...(data || {}), receivedAt: this.elapsed });
        } else if (event === 'player_action' && this.isOnlineHost) {
          const member = this.getOnlineMemberByUserId(senderId);
          const player = this.players.find((unit) => unit.onlineUserId === senderId) || null;
          if (data.action === 'bailout') {
            if (!player) return;
            const contactAge = this.elapsed - (player.lastDamageAt || -999);
            if (!player.dead && contactAge >= 4.2 && !this.projectileThreat(player)) this.bailout(player, null, '自主ベイルアウト', { kind: 'manual' });
          } else if (data.action === 'defense_build' && this.isDefenseMode) {
            const role = member?.role || (player ? 'combatant' : 'spectator');
            if (role !== 'spectator') this.deployDefenseBuild(data.buildType, role === 'combatant' ? player : null, Number(member?.team || 0), { remote: true, role });
          }
        } else if (event === 'operator_command' && this.isOnlineHost) {
          this.applyOnlineOperatorCommand(senderId, data);
        } else if (event === 'operator_support' && this.isOnlineHost) {
          this.applyOnlineOperatorSupport(senderId, data);
        } else if (event === 'operator_point' && this.isOnlineHost) {
          this.applyOnlineOperatorPoint(senderId, data);
        } else if (event === 'sync_request' && this.isOnlineHost) {
          const members = window.trionOnline?.members || [];
          const roster = members.map((member) => ({ userId:member.user_id, displayName:member.display_name, team:Number(member.team||0), role:member.role||'spectator', playerConfig:member.player_config||{} }));
          const { onlineSession, ...settings } = this.config;
          window.trionOnline?.broadcast('late_join_start', { targetId:senderId, session:{ roomId:this.onlineSession.roomId, roomCode:this.onlineSession.roomCode, hostId:this.localOnlineUserId, roster, settings, startedAt:this.onlineSession.startedAt||Date.now() } });
          setTimeout(() => this.sendOnlineBootstrap(senderId), 500);
        } else if (event === 'world_init' && this.onlineMirror) {
          if (data.targetId && data.targetId !== this.localOnlineUserId) return;
          this.applyOnlineWorld(data.world || data);
        } else if (event === 'snapshot' && this.onlineMirror) {
          if (data.targetId && data.targetId !== this.localOnlineUserId) return;
          this.queueOnlineSnapshot(data.snapshot || data);
        } else if (event === 'match_end' && this.onlineMirror && !this.ended) {
          this.applyOnlineSnapshot(data.snapshot || {});
          this.endMatch();
        }
      });
      if (this.onlineMirror) setTimeout(() => window.trionOnline.broadcast('sync_request', { roomId: this.onlineSession.roomId }), 250);
    }

    serializeOnlineWorld() {
      return {
        mapId: this.mapId,
        world: { ...this.world },
        terrain: JSON.parse(JSON.stringify(this.terrain)),
        walls: JSON.parse(JSON.stringify(this.walls)),
        installations: JSON.parse(JSON.stringify(this.installations)),
        lightSources: JSON.parse(JSON.stringify(this.lightSources)),
        worldRespawns: JSON.parse(JSON.stringify(this.worldRespawns)),
        environment: { ...this.environment },
        defenseFlag: this.defenseFlag ? { ...this.defenseFlag } : null,
      };
    }

    async sendOnlineBootstrap(targetId = null) {
      if (!this.isOnlineHost || !window.trionOnline) return;
      await window.trionOnline.broadcast('world_init', { targetId, world: this.serializeOnlineWorld() });
      await window.trionOnline.broadcast('snapshot', { targetId, snapshot: this.buildOnlineSnapshot({ full: true }) });
    }

    applyOnlineWorld(world) {
      if (!world) return;
      if (world.world) this.world = { ...world.world };
      if (world.terrain) this.terrain = world.terrain;
      if (world.walls) this.walls = world.walls;
      if (world.installations) this.installations = world.installations;
      if (world.lightSources) this.lightSources = world.lightSources;
      if (world.worldRespawns) this.worldRespawns = world.worldRespawns;
      if (world.environment) this.environment = { ...this.environment, ...world.environment };
      if (world.defenseFlag) this.defenseFlag = { ...world.defenseFlag };
      this.terrainChunks.clear();
      this.onlineWorldReceived = true;
      this.onlineWorldReady = this.onlineSnapshotReceived;
    }

    buildOnlineSnapshot(options = {}) {
      const full = Boolean(options.full);
      const seq = ++this.onlineSnapshotSequence;
      const slowEvery = Math.max(1, Math.round(this.onlineSnapshotHz));
      const includeSlowState = full || seq % slowEvery === 0;
      const playerFields = (player) => {
        const dynamic = {
          id: player.id, onlineUserId: player.onlineUserId || null, name: player.name, team: player.team,
          x: player.x, y: player.y, vx: player.vx, vy: player.vy, radius: player.radius,
          aim: player.aim, facing: player.facing, walkFrame: player.walkFrame, isMoving: player.isMoving,
          maxHp: player.maxHp, hp: player.hp, maxTrion: player.maxTrion, trion: player.trion,
          dead: player.dead, respawnTimer: player.respawnTimer, invulnTimer: player.invulnTimer,
          score: player.score, kills: player.kills, deaths: player.deaths, selected: player.selected,
          shields: player.shields, toggles: player.toggles, revealTimer: player.revealTimer,
          markedTimer: player.markedTimer, slowTimer: player.slowTimer, slowFactor: player.slowFactor,
          leadWeights: player.leadWeights, pendingComposite: player.pendingComposite,
          isDefenseEnemy: Boolean(player.isDefenseEnemy), defenseType: player.defenseType || null,
          isDefenseBoss: Boolean(player.isDefenseBoss), flying: Boolean(player.flying),
          cubedTimer: player.cubedTimer || 0, borborosPhase: player.defenseAI?.phase || null,
          metrics: { assists: player.metrics?.assists || 0 },
        };
        if (full) Object.assign(dynamic, {
          archetype: player.archetype, squadName: player.squadName,
          appearance: player.appearance, emblemPixels: player.emblemPixels,
          stats: player.stats, loadout: player.loadout,
        });
        else if (player.appearance?.bodyColor) dynamic.appearance = { bodyColor: player.appearance.bodyColor };
        return dynamic;
      };
      const projectileFields = (p) => ({
        id:p.id,x:p.x,y:p.y,vx:p.vx||0,vy:p.vy||0,radius:p.radius,color:p.color,
        lead:p.lead,team:p.team,angle:p.angle,life:p.life,sourceName:p.sourceName,sourceKey:p.sourceKey,
      });
      const effectFields = (e) => {
        const result = {};
        for (const key of ['type','x','y','x2','y2','ttl','maxTtl','style','range','angle','arc','radius','color','text','team','width']) if (e[key] !== undefined) result[key] = e[key];
        return result;
      };
      const snapshot = {
        seq, full,
        matchId: this.matchId, at: performance.now(), elapsed: this.elapsed, matchTime: this.matchTime,
        teamScores: [...this.teamScores], environment: { ...this.environment },
        defenseRound: this.defenseRound, defenseTier: this.defenseTier,
        defenseWaveActive: this.defenseWaveActive, defenseFlag: this.defenseFlag ? { ...this.defenseFlag } : null,
        defenseBuildPoints: this.defenseBuildPoints, defenseBuildMaxPoints: this.defenseBuildMaxPoints,
        defenseBuildCooldowns: { ...this.defenseBuildCooldowns },
        players: this.players.map(playerFields),
        projectiles: this.projectiles.slice(-180).map(projectileFields),
        effects: this.effects.slice(-90).map(effectFields),
      };
      if (includeSlowState) Object.assign(snapshot, {
        pickups: this.pickups.filter((p) => p.active).slice(0, 260).map((p) => ({id:p.id,x:p.x,y:p.y,radius:p.radius,value:p.value,active:true,temporary:p.temporary,kind:p.kind,team:p.team,support:p.support})),
        wires: this.wires.slice(-120).map((w) => ({...w})),
        mines: this.mines.slice(-70).map((m) => ({...m})),
        traps: this.traps.slice(-70).map((t) => ({...t})),
        beacons: this.beacons.slice(-70).map((b) => ({...b})),
        dynamicWalls: this.walls.filter((wall) => wall.defenseBuildType).map((wall) => ({...wall})),
        temporaryInstallations: this.installations.filter((facility) => facility.temporary || facility.defenseBuildType).map((facility) => ({...facility})),
        wallState: this.walls.map((wall) => [wall.id, wall.hp, wall.ttl]),
        installationState: this.installations.map((f) => [f.id, f.hp, f.active, f.team, f.cooldown, f.ttl]),
        lightState: this.lightSources.map((l) => [l.id, l.hp, l.respawnTimer, l.ttl]),
      });
      return snapshot;
    }

    queueOnlineSnapshot(snapshot) {
      if (!snapshot) return;
      if (snapshot.full && !this.onlineSnapshotReceived) {
        this.applyOnlineSnapshot(snapshot);
        return;
      }
      const incomingSeq = Number(snapshot.seq);
      const pendingSeq = Number(this.onlinePendingSnapshot?.seq ?? -1);
      if (Number.isFinite(incomingSeq) && incomingSeq <= Math.max(this.onlineLastAppliedSequence, pendingSeq)) return;
      this.onlinePendingSnapshot = snapshot;
    }

    ensureOnlinePlayerFromState(state) {
      let player = this.players.find((unit) => unit.id === state.id);
      if (player) return player;
      player = this.createPlayer({
        id: state.id,
        name: state.name || '隊員',
        human: state.onlineUserId === this.localOnlineUserId && this.playerRole === 'combatant',
        team: Number(state.team || 0),
        stats: state.stats || { trion: 6, technique: 6, combat: 6 },
        loadout: state.loadout || { main: ['empty','empty','empty','empty'], sub: ['empty','empty','empty','empty'] },
        archetype: state.archetype || '隊員', appearance: state.appearance || {},
        squadName: state.squadName || '無所属隊', emblemPixels: state.emblemPixels || null,
      });
      player.onlineUserId = state.onlineUserId || null;
      player.remoteControlled = false;
      this.players.push(player);
      if (player.human) this.human = player;
      return player;
    }

    applyOnlineSnapshot(snapshot) {
      if (!snapshot) return;
      if (Number.isFinite(snapshot.seq)) {
        if (snapshot.seq <= this.onlineLastAppliedSequence) return;
        this.onlineLastAppliedSequence = snapshot.seq;
      }
      this.onlineLastSnapshotAt = performance.now();
      if (snapshot.matchId) this.matchId = snapshot.matchId;
      if (Number.isFinite(snapshot.elapsed)) {
        const drift = snapshot.elapsed - this.elapsed;
        this.elapsed = Math.abs(drift) > 1.25 ? snapshot.elapsed : this.elapsed + drift * .35;
      }
      if (snapshot.matchTime !== undefined) this.matchTime = snapshot.matchTime;
      if (Array.isArray(snapshot.teamScores)) this.teamScores = [...snapshot.teamScores];
      if (snapshot.environment) this.environment = { ...this.environment, ...snapshot.environment };
      if (snapshot.defenseFlag) this.defenseFlag = { ...snapshot.defenseFlag };
      if (Number.isFinite(snapshot.defenseRound)) this.defenseRound = snapshot.defenseRound;
      if (Number.isFinite(snapshot.defenseTier)) this.defenseTier = snapshot.defenseTier;
      if (snapshot.defenseWaveActive !== undefined) this.defenseWaveActive = snapshot.defenseWaveActive;
      if (Number.isFinite(snapshot.defenseBuildPoints)) this.defenseBuildPoints = snapshot.defenseBuildPoints;
      if (Number.isFinite(snapshot.defenseBuildMaxPoints)) this.defenseBuildMaxPoints = snapshot.defenseBuildMaxPoints;
      if (snapshot.defenseBuildCooldowns) this.defenseBuildCooldowns = { ...this.defenseBuildCooldowns, ...snapshot.defenseBuildCooldowns };
      const ids = new Set();
      for (const state of snapshot.players || []) {
        ids.add(state.id);
        const player = this.ensureOnlinePlayerFromState(state);
        const wasDead = Boolean(player.dead);
        const firstState = !player.onlineSnapshotReady;
        const distance = Math.hypot(Number(state.x || 0) - Number(player.x || 0), Number(state.y || 0) - Number(player.y || 0));
        const mustSnap = firstState || wasDead !== Boolean(state.dead) || distance > 760;
        for (const key of ['name','team','archetype','squadName','appearance','emblemPixels','stats','loadout','radius','facing','walkFrame','isMoving','maxHp','hp','maxTrion','trion','dead','respawnTimer','invulnTimer','score','kills','deaths','selected','shields','toggles','revealTimer','markedTimer','slowTimer','slowFactor','leadWeights','pendingComposite','isDefenseEnemy','defenseType','isDefenseBoss','flying','cubedTimer']) {
          if (state[key] !== undefined) player[key] = state[key];
        }
        player.onlineTargetX = Number.isFinite(state.x) ? state.x : player.x;
        player.onlineTargetY = Number.isFinite(state.y) ? state.y : player.y;
        player.onlineTargetVx = Number.isFinite(state.vx) ? state.vx : 0;
        player.onlineTargetVy = Number.isFinite(state.vy) ? state.vy : 0;
        player.onlineTargetAim = Number.isFinite(state.aim) ? state.aim : player.aim;
        player.onlineSnapshotReady = true;
        if (mustSnap) {
          player.x = player.onlineTargetX;
          player.y = player.onlineTargetY;
          player.vx = player.onlineTargetVx;
          player.vy = player.onlineTargetVy;
          player.aim = player.onlineTargetAim;
        }
        if (state.onlineUserId) player.onlineUserId = state.onlineUserId;
        if (state.metrics) player.metrics = { ...player.metrics, ...state.metrics };
        if (state.borborosPhase) player.defenseAI = { ...(player.defenseAI || {}), phase: state.borborosPhase };
        player.human = state.onlineUserId === this.localOnlineUserId && this.playerRole === 'combatant';
        if (player.human) this.human = player;
      }
      this.players = this.players.filter((player) => ids.has(player.id));
      if (Array.isArray(snapshot.projectiles)) {
        const previousProjectiles = new Map(this.projectiles.map((projectile) => [projectile.id, projectile]));
        for (const projectile of snapshot.projectiles) {
          if (previousProjectiles.has(projectile.id)) continue;
          const isSniper = ['egret','lightning','ibis'].includes(projectile.sourceKey) || /イーグレット|ライトニング|アイビス|狙撃/.test(projectile.sourceName || '');
          this.sfx?.play(isSniper ? 'sniper' : 'gunner', { x: projectile.x, y: projectile.y, bucket: `online-shot:${projectile.id}`, cooldown: 0, volume: isSniper ? .44 : .27 });
        }
        this.projectiles = snapshot.projectiles.map((state) => {
          const previous = previousProjectiles.get(state.id);
          if (!previous) return { ...state, onlineTargetX: state.x, onlineTargetY: state.y };
          const distance = Math.hypot(Number(state.x || 0) - Number(previous.x || 0), Number(state.y || 0) - Number(previous.y || 0));
          const snap = distance > 260;
          return {
            ...state,
            x: snap ? state.x : lerp(Number(previous.x || 0), Number(state.x || 0), .58),
            y: snap ? state.y : lerp(Number(previous.y || 0), Number(state.y || 0), .58),
            onlineTargetX: state.x,
            onlineTargetY: state.y,
          };
        });
      }
      if (Array.isArray(snapshot.effects)) {
        const oldEffectKeys = new Set(this.effects.map((effect) => `${effect.type}:${Math.round(effect.x || 0)}:${Math.round(effect.y || 0)}:${Math.round(effect.x2 || 0)}:${Math.round(effect.y2 || 0)}`));
        for (const effect of snapshot.effects) {
          const key = `${effect.type}:${Math.round(effect.x || 0)}:${Math.round(effect.y || 0)}:${Math.round(effect.x2 || 0)}:${Math.round(effect.y2 || 0)}`;
          if (oldEffectKeys.has(key)) continue;
          if (['explosion','defenseImpact','gasExplosion'].includes(effect.type)) this.sfx?.play('explosion', { x: effect.x, y: effect.y, bucket: `online-effect:${key}`, cooldown: 0, volume: .48 });
          else if (['slash','senku'].includes(effect.type)) this.sfx?.play('attacker', { x: effect.x, y: effect.y, bucket: `online-effect:${key}`, cooldown: 0, volume: .36 });
        }
        this.effects = snapshot.effects.map((effect) => ({ ...effect }));
      }
      if (Array.isArray(snapshot.particles)) this.particles = snapshot.particles;
      if (Array.isArray(snapshot.pickups)) {
        const oldPickups = new Map(this.pickups.map((pickup) => [pickup.id, pickup]));
        this.pickups = snapshot.pickups.map((pickup) => ({ ...pickup, pulse: oldPickups.get(pickup.id)?.pulse || 0 }));
      }
      if (Array.isArray(snapshot.wires)) this.wires = snapshot.wires;
      if (Array.isArray(snapshot.mines)) this.mines = snapshot.mines;
      if (Array.isArray(snapshot.traps)) this.traps = snapshot.traps;
      if (Array.isArray(snapshot.beacons)) this.beacons = snapshot.beacons;
      if (Array.isArray(snapshot.dynamicWalls)) {
        const staticWalls = this.walls.filter((wall) => !wall.defenseBuildType);
        this.walls = [...staticWalls, ...snapshot.dynamicWalls.map((wall) => ({...wall}))];
      }
      if (Array.isArray(snapshot.temporaryInstallations)) {
        const permanent = this.installations.filter((facility) => !facility.temporary && !facility.defenseBuildType);
        this.installations = [...permanent, ...snapshot.temporaryInstallations.map((facility) => ({...facility}))];
      }
      if (Array.isArray(snapshot.wallState)) {
        const walls = new Map(this.walls.map((wall) => [wall.id, wall]));
        for (const [id, hp, ttl] of snapshot.wallState) { const wall = walls.get(id); if (wall) { wall.hp = hp; wall.ttl = ttl; } }
      }
      if (Array.isArray(snapshot.installationState)) {
        const facilities = new Map(this.installations.map((facility) => [facility.id, facility]));
        for (const [id, hp, active, team, cooldown, ttl] of snapshot.installationState) { const f = facilities.get(id); if (f) Object.assign(f,{hp,active,team,cooldown,ttl}); }
      }
      if (Array.isArray(snapshot.lightState)) {
        const lights = new Map(this.lightSources.map((light) => [light.id, light]));
        for (const [id, hp, respawnTimer, ttl] of snapshot.lightState) { const light = lights.get(id); if (light) Object.assign(light,{hp,respawnTimer,ttl}); }
      }
      this.onlineSnapshotReceived = true;
      this.onlineWorldReady = this.onlineWorldReceived;
    }

    updateOnlineInterpolation(dt) {
      const snapshotAge = this.onlineLastSnapshotAt ? Math.min(.16, Math.max(0, (performance.now() - this.onlineLastSnapshotAt) / 1000)) : 0;
      for (const player of this.players) {
        if (!player.onlineSnapshotReady || player.dead) continue;
        const targetX = Number(player.onlineTargetX ?? player.x) + Number(player.onlineTargetVx || 0) * snapshotAge;
        const targetY = Number(player.onlineTargetY ?? player.y) + Number(player.onlineTargetVy || 0) * snapshotAge;
        const distance = Math.hypot(targetX - player.x, targetY - player.y);
        if (distance > 760) {
          player.x = targetX;
          player.y = targetY;
        } else {
          const speed = player.human ? 22 : 15;
          const alpha = 1 - Math.exp(-speed * dt);
          player.x = lerp(player.x, targetX, alpha);
          player.y = lerp(player.y, targetY, alpha);
        }
        player.vx = lerp(Number(player.vx || 0), Number(player.onlineTargetVx || 0), 1 - Math.exp(-18 * dt));
        player.vy = lerp(Number(player.vy || 0), Number(player.onlineTargetVy || 0), 1 - Math.exp(-18 * dt));
        if (Number.isFinite(player.onlineTargetAim)) player.aim += angleDiff(player.onlineTargetAim, player.aim) * (1 - Math.exp(-20 * dt));
      }
    }

    updateOnlineMirrorVisuals(dt) {
      const snapshotAge = this.onlineLastSnapshotAt ? Math.min(.3, Math.max(0, (performance.now() - this.onlineLastSnapshotAt) / 1000)) : 0;
      for (const projectile of this.projectiles) {
        projectile.x += Number(projectile.vx || 0) * dt;
        projectile.y += Number(projectile.vy || 0) * dt;
        projectile.life = Number(projectile.life || 0) - dt;
        if (Number.isFinite(projectile.onlineTargetX)) {
          const targetX = projectile.onlineTargetX + Number(projectile.vx || 0) * snapshotAge;
          const targetY = projectile.onlineTargetY + Number(projectile.vy || 0) * snapshotAge;
          const alpha = 1 - Math.exp(-10 * dt);
          projectile.x = lerp(projectile.x, targetX, alpha);
          projectile.y = lerp(projectile.y, targetY, alpha);
        }
      }
      this.projectiles = this.projectiles.filter((projectile) => projectile.life > -.45);
      for (const effect of this.effects) effect.ttl = Number(effect.ttl || 0) - dt;
      this.effects = this.effects.filter((effect) => effect.ttl > 0);
      for (const pickup of this.pickups) pickup.pulse = Number(pickup.pulse || 0) + dt * 4;
    }

    updateOnlineHost(dt) {
      this.onlineSnapshotTimer -= dt;
      if (this.onlineSnapshotTimer > 0 || !window.trionOnline?.roomChannel) return;
      this.onlineSnapshotTimer = 1 / this.onlineSnapshotHz;
      window.trionOnline.broadcast('snapshot', { snapshot: this.buildOnlineSnapshot({ full: false }) });
    }

    updateOnlineMirror(dt) {
      this.elapsed += dt;
      if (this.onlinePendingSnapshot) {
        const snapshot = this.onlinePendingSnapshot;
        this.onlinePendingSnapshot = null;
        this.applyOnlineSnapshot(snapshot);
      }
      if (!this.isUnlimited && Number.isFinite(this.matchTime)) this.matchTime = Math.max(0, this.matchTime - dt);
      if (!this.onlineWorldReady) {
        this.onlineSyncRetryTimer -= dt;
        if (this.onlineSyncRetryTimer <= 0) {
          this.onlineSyncRetryTimer = 2;
          window.trionOnline?.broadcast('sync_request', { roomId: this.onlineSession?.roomId });
        }
      }
      if (this.isPlayerCombatant && this.human && !this.spectating) this.sendOnlineInput(dt);
      if (this.isPlayerOperator) this.updateOperatorCamera(dt);
      this.updateOnlineInterpolation(dt);
      this.updateOnlineMirrorVisuals(dt);
      this.updateCamera(dt);
      this.toastTimer = Math.max(0, this.toastTimer - dt);
      if (this.toastTimer <= 0) $('#toast').classList.remove('show');
      this.messageTimer = Math.max(0, this.messageTimer - dt);
      if (this.messageTimer <= 0) $('#centerMessage').classList.add('hidden');
      if (this.onlineLastSnapshotAt && performance.now() - this.onlineLastSnapshotAt > 4000) this.toast('ホストからの同期を待っています');
    }

    sendOnlineInput(dt) {
      this.onlineInputTimer -= dt;
      const p = this.human;
      const selectionKeys = [
        ['Digit1','main',0],['Digit2','main',1],['Digit3','main',2],['Digit4','main',3],
        ['Digit5','sub',0],['Digit6','sub',1],['Digit7','sub',2],['Digit8','sub',3],
      ];
      let selectionChanged = false;
      for (const [code, hand, index] of selectionKeys) if (this.input.consume(code)) { p.selected[hand] = index; selectionChanged = true; }
      if (this.onlineInputTimer > 0 && !selectionChanged && !this.input.mouse.justLeft && !this.input.mouse.justRight && !this.input.virtualMainJust && !this.input.virtualSubJust && !this.input.justKeys.has('KeyC')) return;
      this.onlineInputTimer = 1 / this.onlineInputHz;
      let dx = this.input.virtualMove.x, dy = this.input.virtualMove.y;
      if (this.input.isDown('KeyW')) dy -= 1; if (this.input.isDown('KeyS')) dy += 1;
      if (this.input.isDown('KeyA')) dx -= 1; if (this.input.isDown('KeyD')) dx += 1;
      if (dx || dy) { const len = Math.hypot(dx,dy); dx/=len; dy/=len; }
      let aim = p.aim;
      if (this.input.virtualAim.active) aim = Math.atan2(this.input.virtualAim.y,this.input.virtualAim.x);
      else { const point = this.screenToWorld(this.input.mouse.x,this.input.mouse.y); aim = Math.atan2(point.y-p.y,point.x-p.x); }
      p.aim = aim;
      const packet = {
        seq: ++this.onlineInputSequence, dx, dy, aim, selected: { ...p.selected },
        main: this.input.mouse.left || this.input.virtualMain,
        sub: this.input.mouse.right || this.input.virtualSub,
        mainJust: this.input.mouse.justLeft || this.input.virtualMainJust,
        subJust: this.input.mouse.justRight || this.input.virtualSubJust,
        shift: this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight') || this.input.isDown('Shift'),
        combo: this.input.consume('KeyC'),
      };
      window.trionOnline.broadcast('input', packet);
    }

    updateRemoteControlledPlayer(player, dt) {
      const packet = this.onlineRemoteInputs.get(player.onlineUserId);
      player.shields.main = null; player.shields.sub = null;
      if (!packet || this.elapsed - packet.receivedAt > .8 || player.dead) return;
      const fresh = packet.seq !== player.onlineLastInputSeq;
      if (fresh) {
        player.onlineLastInputSeq = packet.seq;
        if (packet.selected) player.selected = { ...player.selected, ...packet.selected };
      }
      if (Number.isFinite(packet.aim)) player.aim = packet.aim;
      if (packet.dx || packet.dy) {
        const len = Math.hypot(packet.dx,packet.dy) || 1;
        const speedFactor = player.pendingComposite ? .48 : 1;
        player.vx += packet.dx/len*player.speed*speedFactor*dt*6.2;
        player.vy += packet.dy/len*player.speed*speedFactor*dt*6.2;
      }
      this.handleHeldHand(player,'main',Boolean(packet.main),Boolean(fresh&&packet.mainJust),dt,Boolean(packet.shift));
      this.handleHeldHand(player,'sub',Boolean(packet.sub),Boolean(fresh&&packet.subJust),dt,Boolean(packet.shift));
      if (fresh && packet.combo) this.tryCombo(player);
    }

    getOnlineMemberByUserId(userId) {
      return this.onlineSession?.roster?.find((member) => member.userId === userId) || window.trionOnline?.members?.find((member) => member.user_id === userId) || null;
    }

    applyOnlineOperatorCommand(senderId, data = {}) {
      const member = this.getOnlineMemberByUserId(senderId);
      if (!member || member.role !== 'operator') return;
      const old = { team:this.playerTeam, unit:this.operatorSelectedUnit, enemy:this.operatorEnemyId, ally:this.operatorAllyId };
      this.playerTeam = Number(member.team || 0);
      this.operatorSelectedUnit = data.unit || 'all'; this.operatorEnemyId = data.enemy || 'nearest'; this.operatorAllyId = data.ally || 'nearest';
      this.onlineApplyingRemote = true; this.handleOperatorCommand(data.command); this.onlineApplyingRemote = false;
      Object.assign(this,{playerTeam:old.team,operatorSelectedUnit:old.unit,operatorEnemyId:old.enemy,operatorAllyId:old.ally});
    }

    applyOnlineOperatorSupport(senderId, data = {}) {
      const member = this.getOnlineMemberByUserId(senderId);
      if (!member || member.role !== 'operator') return;
      const oldTeam=this.playerTeam; this.playerTeam=Number(member.team||0); this.onlineApplyingRemote=true;
      if (data.point) this.applyOperatorSupportAt(data.support,data.point); else this.handleOperatorSupport(data.support);
      this.onlineApplyingRemote=false; this.playerTeam=oldTeam;
    }

    applyOnlineOperatorPoint(senderId, data = {}) {
      const member = this.getOnlineMemberByUserId(senderId);
      if (!member || member.role !== 'operator') return;
      const oldTeam=this.playerTeam; this.playerTeam=Number(member.team||0); this.onlineApplyingRemote=true;
      if (data.support) this.applyOperatorSupportAt(data.support,data.point);
      else if (data.command) {
        const units=this.players.filter((p)=>p.team===this.playerTeam&&!p.dead&&(data.units?.includes(p.id)||data.unit==='all'));
        units.forEach((unit,index)=>{ const point=data.point; unit.operatorOrder={type:data.command,x:point.x+(index%3-1)*70,y:point.y+Math.floor(index/3)*70,label:'オンライン指示'}; });
      }
      this.onlineApplyingRemote=false; this.playerTeam=oldTeam;
    }

    submitOnlineRanking() {
      if (!this.isOnlineMatch || !window.trionOnline || !this.human || this.playerRole !== 'combatant') return;
      if (!['solo','team'].includes(this.config.mode)) return;
      window.trionOnline.submitRanking({
        mode:this.config.mode, displayName:this.human.name, teamName:this.human.squadName,
        score:this.config.mode==='team'?(this.teamScores[this.human.team]||0):this.human.score,
        kills:this.human.kills, deaths:this.human.deaths, matchId:this.matchId,
      });
    }

    start() {
      this.running = true;
      if (this.isOnlineHost) setTimeout(() => this.sendOnlineBootstrap(), 450);
      if (this.isSetupSpectator) {
        this.ensureSpectatorTarget(1);
        $('#spectatorHud').classList.remove('hidden');
        $('#spectateButton').textContent = 'NEXT VIEW';
        $('#pauseSpectateButton').classList.add('hidden');
        this.showCenterMessage('SPECTATOR', 'Q / Eで観戦対象を変更', 1.8);
        this.logEvent('spectate_start', `出撃設定から観戦：${this.getSpectatorTarget()?.name || '対象なし'}`);
      } else if (this.isPlayerOperator) {
        this.operatorVisible = true;
        $('#operatorPanel').classList.remove('hidden');
        this.refreshOperatorUi();
        this.showCenterMessage('OPERATOR', '隊員へ戦術指示を送れ', 1.8);
      } else {
        this.showCenterMessage(this.isDefenseMode ? 'DEFENSE' : this.config.mode === 'team' ? 'TEAM BATTLE' : 'SOLO BATTLE', this.isDefenseMode ? 'フラッグを守れ' : 'TRIGGER ON', 1.8);
      }
      this.frameHandle = requestAnimationFrame((time) => this.loop(time));
    }

    destroy() {
      this.running = false;
      cancelAnimationFrame(this.frameHandle);
      this.input.destroy();
      this.sfx?.destroy();
      this.uiListeners.forEach((off) => off());
      if (this.onlineUnsubscribe) this.onlineUnsubscribe();
      this.onlineUnsubscribe = null;
      window.removeEventListener('resize', this.resizeHandler);
      window.visualViewport?.removeEventListener('resize', this.resizeHandler);
    }

    bindGameUi() {
      const bind = (selector, handler) => {
        const element = $(selector);
        if (!element) return;
        element.addEventListener('click', handler);
        this.uiListeners.push(() => element.removeEventListener('click', handler));
      };
      bind('#menuButton', () => this.togglePause(true));
      bind('#resumeButton', () => this.togglePause(false));
      bind('#bailoutButton', () => this.manualBailout());
      bind('#pauseBailoutButton', () => { this.togglePause(false); this.manualBailout(); });
      bind('#spectateButton', () => this.toggleSpectate());
      bind('#pauseSpectateButton', () => { this.togglePause(false); this.toggleSpectate(); });
      bind('#guideButton', () => this.setGuideVisible(!this.guideVisible));
      bind('#soundButton', () => this.setSoundEnabled(!this.soundEnabled));
      bind('#debugButton', () => this.toggleDebugPanel());
      bind('#operatorButton', () => this.toggleOperatorPanel());
      bind('#closeOperatorButton', () => this.toggleOperatorPanel(false));
      $$('#defenseBuildPanel [data-defense-build]').forEach((button) => {
        const handler = () => this.requestDefenseBuild(button.dataset.defenseBuild);
        button.addEventListener('click', handler);
        this.uiListeners.push(() => button.removeEventListener('click', handler));
      });
      bind('#closeDebugButton', () => this.toggleDebugPanel(false));
      const unitSelect = $('#operatorUnitSelect');
      const enemySelect = $('#operatorEnemySelect');
      const allySelect = $('#operatorAllySelect');
      if (unitSelect) { const handler = (e) => { this.operatorSelectedUnit = e.target.value; const selected = this.players.find((p) => p.id === e.target.value); if (selected && this.isPlayerOperator) this.operatorCamera.followId = selected.id; }; unitSelect.addEventListener('change', handler); this.uiListeners.push(() => unitSelect.removeEventListener('change', handler)); }
      if (enemySelect) { const handler = (e) => { this.operatorEnemyId = e.target.value; }; enemySelect.addEventListener('change', handler); this.uiListeners.push(() => enemySelect.removeEventListener('change', handler)); }
      if (allySelect) { const handler = (e) => { this.operatorAllyId = e.target.value; }; allySelect.addEventListener('change', handler); this.uiListeners.push(() => allySelect.removeEventListener('change', handler)); }
      $$('#operatorPanel [data-command]').forEach((button) => { const handler = () => this.handleOperatorCommand(button.dataset.command); button.addEventListener('click', handler); this.uiListeners.push(() => button.removeEventListener('click', handler)); });
      $$('#operatorPanel [data-support]').forEach((button) => { const handler = () => this.handleOperatorSupport(button.dataset.support); button.addEventListener('click', handler); this.uiListeners.push(() => button.removeEventListener('click', handler)); });
      const clickHandler = (e) => this.handleOperatorCanvasClick(e);
      this.canvas.addEventListener('click', clickHandler);
      this.uiListeners.push(() => this.canvas.removeEventListener('click', clickHandler));
      bind('#titleButton', () => this.returnToTitle('title_button'));
      bind('#exportCurrentJsonButton', () => this.exportCurrentLog('json'));
      bind('#exportCurrentCsvButton', () => this.exportCurrentLog('csv'));
      bind('#resultJsonButton', () => this.exportCurrentLog('json'));
      bind('#resultCsvButton', () => this.exportCurrentLog('csv'));
    }

    setSoundEnabled(enabled, announce = true) {
      this.soundEnabled = Boolean(enabled);
      setup.soundEnabled = this.soundEnabled;
      if ($('#soundEnabled')) $('#soundEnabled').checked = this.soundEnabled;
      this.sfx?.setEnabled(this.soundEnabled);
      const button = $('#soundButton');
      if (button) {
        button.textContent = this.soundEnabled ? 'SOUND ON' : 'SOUND OFF';
        button.classList.toggle('active', this.soundEnabled);
      }
      saveSetup();
      if (announce) this.toast(this.soundEnabled ? '効果音 ON' : '効果音 OFF');
    }

    togglePause(force) {
      if (this.ended) return;
      this.paused = typeof force === 'boolean' ? force : !this.paused;
      $('#pauseOverlay').classList.toggle('hidden', !this.paused);
    }

    closeMatchScreens() {
      $('#pauseOverlay').classList.add('hidden');
      $('#resultOverlay').classList.add('hidden');
      $('#debugPanel').classList.add('hidden');
      $('#operatorPanel').classList.add('hidden');
      $('#spectatorHud').classList.add('hidden');
      $('#controlGuide').classList.add('hidden');
      $('#gameScreen').classList.add('hidden');
    }

    returnToTitle(reason = 'abandoned') {
      if (!this.logFinalized && this.elapsed > .05) this.finalizeLog(reason);
      this.destroy();
      if (game === this) game = null;
      if (window.__TRION_GAME__ === this) window.__TRION_GAME__ = null;
      this.closeMatchScreens();
      if (this.isOnlineMatch) window.trionOnline?.leaveRoom();
      showTitle();
    }

    returnToSetup(reason = 'abandoned') {
      if (!this.logFinalized && this.elapsed > .05) this.finalizeLog(reason);
      this.destroy();
      if (game === this) game = null;
      if (window.__TRION_GAME__ === this) window.__TRION_GAME__ = null;
      this.closeMatchScreens();
      if (this.isOnlineMatch) window.trionOnline?.leaveRoom();
      showSetup();
    }

    setGuideVisible(visible) {
      this.guideVisible = Boolean(visible);
      $('#controlGuide')?.classList.toggle('hidden', !this.guideVisible);
      $('#guideButton')?.classList.toggle('active', this.guideVisible);
    }

    manualBailout() {
      if (!this.isPlayerCombatant || this.ended || this.spectating || !this.human || this.human.dead) return;
      if (this.onlineMirror) {
        window.trionOnline?.broadcast('player_action', { action: 'bailout' });
        this.toast('自主ベイルアウトをホストへ申請しました');
        return;
      }
      const contactAge = this.elapsed - (this.human.lastDamageAt || -999);
      if (contactAge < 4.2 || this.projectileThreat(this.human)) {
        this.toast('敵の攻撃を受けた直後は自主ベイルアウトできません');
        return;
      }
      this.logEvent('manual_bailout', 'YOUが自主ベイルアウト');
      this.bailout(this.human, null, '自主ベイルアウト', { kind: 'manual' });
    }

    toggleSpectate() {
      if (this.ended) return;
      if (this.isSetupSpectator) { this.ensureSpectatorTarget(1); return; }
      if (!this.isPlayerCombatant) return;
      if (this.spectating) this.exitSpectate();
      else this.enterSpectate();
    }

    enterSpectate() {
      if (!this.isPlayerCombatant) return;
      if (!this.human.dead) this.bailout(this.human, null, '観戦移行', { kind: 'spectate' });
      this.spectating = true;
      this.human.respawnTimer = Infinity;
      this.ensureSpectatorTarget(1);
      $('#spectatorHud').classList.remove('hidden');
      $('#spectateButton').textContent = 'RETURN';
      $('#pauseSpectateButton').textContent = '戦線復帰';
      this.logEvent('spectate_start', `観戦開始：${this.getSpectatorTarget()?.name || '対象なし'}`);
      this.showCenterMessage('SPECTATING', 'Q / Eで対象変更・Vで戦線復帰', 1.5);
      this.toast('観戦モード：Q / Eで対象変更、Vで戦線復帰');
    }

    exitSpectate() {
      if (!this.isPlayerCombatant) return;
      this.spectating = false;
      this.spectatorTargetId = null;
      $('#spectatorHud').classList.add('hidden');
      $('#spectateButton').textContent = 'SPECTATE';
      $('#pauseSpectateButton').textContent = '観戦モード';
      if (this.human.dead) this.respawnPlayer(this.human);
      this.buildSlotHud(this.human);
      this.logEvent('spectate_end', '観戦終了・戦線復帰');
    }

    getSpectatorTargets() {
      const alive = this.players.filter((player) => !player.dead && !player.human);
      if (this.config.mode !== 'team') return alive;
      return [...alive.filter((player) => player.team === this.playerTeam), ...alive.filter((player) => player.team !== this.playerTeam)];
    }

    getSpectatorTarget() {
      return this.players.find((player) => player.id === this.spectatorTargetId && !player.dead) || null;
    }

    ensureSpectatorTarget(direction = 1) {
      const targets = this.getSpectatorTargets();
      if (!targets.length) {
        this.spectatorTargetId = null;
        $('#spectatorName').textContent = 'NO ACTIVE UNIT';
        return null;
      }
      const currentIndex = targets.findIndex((player) => player.id === this.spectatorTargetId);
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + direction + targets.length) % targets.length;
      const target = targets[nextIndex];
      this.spectatorTargetId = target.id;
      $('#spectatorName').textContent = `${target.name} / ${target.archetype}`;
      this.buildSlotHud(target);
      this.logEvent('spectate_target', `観戦対象：${target.name}`, false);
      return target;
    }

    toggleOperatorPanel(force) {
      if (!this.isPlayerOperator) return;
      this.operatorVisible = typeof force === 'boolean' ? force : !this.operatorVisible;
      $('#operatorPanel').classList.toggle('hidden', !this.operatorVisible);
      if (this.operatorVisible) this.refreshOperatorUi();
    }

    refreshOperatorUi() {
      const unit = $('#operatorUnitSelect');
      const enemy = $('#operatorEnemySelect');
      const ally = $('#operatorAllySelect');
      if (!unit || !enemy || !ally) return;
      const allies = this.players.filter((p) => p.team === this.playerTeam && !p.dead);
      const foes = this.players.filter((p) => p.team !== this.playerTeam && !p.dead);
      unit.innerHTML = `<option value="all">味方全員</option>${allies.map((p) => `<option value="${p.id}"${p.id === this.operatorSelectedUnit ? ' selected' : ''}>${p.name} / ${p.archetype}</option>`).join('')}`;
      enemy.innerHTML = `<option value="nearest">最寄りの敵</option>${foes.map((p) => `<option value="${p.id}"${p.id === this.operatorEnemyId ? ' selected' : ''}>${p.name} / ${this.teamMeta?.[p.team]?.name || p.archetype}</option>`).join('')}`;
      ally.innerHTML = `<option value="nearest">最寄りの味方</option>${allies.map((p) => `<option value="${p.id}"${p.id === this.operatorAllyId ? ' selected' : ''}>${p.name} / ${p.archetype}</option>`).join('')}`;
      $('#operatorName').textContent = this.operators.find((op) => op.team === this.playerTeam)?.name || 'OPERATOR';
      const working = allies.find((p) => p.operatorOrder?.type === 'activate');
      $('#operatorWorkLabel').textContent = working ? `${working.name} 接続作業 ${Math.min(100, Math.round((working.operatorOrderProgress || 0) / 3 * 100))}%` : '指揮回線 接続中';
      const cooldownRoot = $('#operatorCooldowns');
      if (cooldownRoot) {
        const labels = { scan: '索敵', supply: '補給', flare: '照明', barrier: '障壁', rally: '機動', decoy: '囮', flagRepair: '旗修復' };
        cooldownRoot.innerHTML = Object.entries(this.operatorSupportCooldowns).map(([key, value]) => `<span class="${value > 0 ? 'cooling' : 'ready'}">${labels[key]} ${value > 0 ? `${Math.ceil(value)}s` : 'READY'}</span>`).join('');
      }
      $$('#operatorPanel [data-support]').forEach((button) => {
        const key = button.dataset.support;
        const remaining = this.operatorSupportCooldowns[key] || 0;
        button.classList.toggle('hidden', key === 'flagRepair' && !this.isDefenseMode);
        button.disabled = remaining > 0 || (key === 'flagRepair' && !this.isDefenseMode);
        button.classList.toggle('cooling', remaining > 0);
      });
    }

    getOperatorUnits(team = this.playerTeam) {
      const alive = this.players.filter((p) => p.team === team && !p.dead);
      if (team === this.playerTeam && this.operatorSelectedUnit !== 'all') return alive.filter((p) => p.id === this.operatorSelectedUnit);
      return alive;
    }

    findNearestEnemy(unit) {
      return this.players.filter((p) => this.canDamage(unit, p)).sort((a, b) => dist2(unit, a) - dist2(unit, b))[0] || null;
    }

    getTeamHome(team) {
      if (this.isDefenseMode) return { x: this.world.w / 2, y: this.world.h / 2 };
      if (this.teamCount <= 2) return team === 0 ? { x: 460, y: this.world.h / 2 } : { x: this.world.w - 460, y: this.world.h / 2 };
      const homes = [
        { x: 470, y: 470 },
        { x: this.world.w - 470, y: this.world.h - 470 },
        { x: this.world.w - 470, y: 470 },
        { x: 470, y: this.world.h - 470 },
      ];
      return homes[team % homes.length];
    }

    findNearestInstallation(unit, inactiveOnly = true) {
      return this.installations.filter((facility) => facility.hp > 0 && (!inactiveOnly || !facility.active)).sort((a, b) => dist2(unit, a) - dist2(unit, b))[0] || null;
    }

    handleOperatorCommand(command) {
      if (!this.isPlayerOperator && !this.onlineApplyingRemote) return;
      const units = this.getOperatorUnits(this.playerTeam);
      if (this.onlineMirror && !this.onlineApplyingRemote) {
        const message = $('#operatorMessage');
        if (!units.length) return;
        if (['move','defend','spread','suppress'].includes(command)) {
          this.operatorPendingCommand = { command, units: units.map((unit) => unit.id) };
          message.textContent = command === 'spread' ? '分散展開の中心地点をタップしてください。' : command === 'suppress' ? '制圧する地域をタップしてください。' : '戦場上の目的地をタップしてください。';
        } else {
          window.trionOnline?.broadcast('operator_command', { command, unit:this.operatorSelectedUnit, enemy:this.operatorEnemyId, ally:this.operatorAllyId });
          message.textContent = '戦術指示をホストへ送信しました。';
        }
        return;
      }
      if (!units.length) return;
      const message = $('#operatorMessage');
      if (['move', 'defend', 'spread', 'suppress'].includes(command)) {
        this.operatorPendingCommand = { command, units: units.map((unit) => unit.id) };
        message.textContent = command === 'spread' ? '分散展開の中心地点をタップしてください。' : command === 'suppress' ? '制圧する地域をタップしてください。' : '戦場上の目的地をタップしてください。';
        return;
      }
      for (const unit of units) {
        let order = null;
        const selectedEnemy = this.players.find((p) => p.id === this.operatorEnemyId && !p.dead) || this.findNearestEnemy(unit);
        const selectedAlly = this.players.find((p) => p.id === this.operatorAllyId && p.team === unit.team && !p.dead) || this.players.filter((p) => p.team === unit.team && !p.dead && p.id !== unit.id).sort((a, b) => dist2(unit, a) - dist2(unit, b))[0];
        if (command === 'focus' && selectedEnemy) order = { type: 'focus', targetId: selectedEnemy.id, label: `${selectedEnemy.name}を集中攻撃` };
        else if (command === 'hold') order = { type: 'hold', x: unit.x, y: unit.y, label: '現在位置を維持' };
        else if (command === 'regroup') order = { type: 'move', ...this.getTeamHome(unit.team), label: '隊本部へ集合' };
        else if (command === 'retreat') order = { type: 'retreat', ...this.getTeamHome(unit.team), label: '後方へ退避' };
        else if ((command === 'flankLeft' || command === 'flankRight') && selectedEnemy) {
          const angle = Math.atan2(selectedEnemy.y - unit.y, selectedEnemy.x - unit.x) + (command === 'flankLeft' ? -1 : 1) * Math.PI / 2;
          order = { type: 'flank', targetId: selectedEnemy.id, x: selectedEnemy.x + Math.cos(angle) * 320, y: selectedEnemy.y + Math.sin(angle) * 320, label: command === 'flankLeft' ? '左側面へ展開' : '右側面へ展開' };
        } else if (command === 'huntWeak') {
          const target = this.players.filter((p) => this.canDamage(unit, p)).sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
          if (target) order = { type: 'focus', targetId: target.id, label: `${target.name}を追撃` };
        } else if (command === 'escort' && selectedAlly) {
          order = { type: 'escort', allyId: selectedAlly.id, x: selectedAlly.x, y: selectedAlly.y, label: `${selectedAlly.name}を護衛` };
        } else if (command === 'activate') {
          const facility = this.findNearestInstallation(unit, true);
          if (facility) order = { type: 'activate', installationId: facility.id, x: facility.x, y: facility.y, label: `${facility.type === 'turret' ? '固定砲台' : facility.type === 'trap' ? 'トラップ' : 'バリケード'}を起動` };
        } else if (command === 'clear') order = null;
        unit.operatorOrder = order;
        unit.operatorOrderProgress = 0;
      }
      const operator = this.operators.find((op) => op.team === this.playerTeam);
      if (operator) operator.orders += 1;
      this.operatorStats.ordersIssued += 1;
      message.textContent = command === 'clear' ? '指示を解除しました。' : `${units.map((unit) => unit.name).join('・')}へ指示を送信しました。`;
      this.logEvent('operator_order', message.textContent);
      this.refreshOperatorUi();
    }

    handleOperatorSupport(support) {
      if ((!this.isPlayerOperator && !this.onlineApplyingRemote) || !(support in this.operatorSupportCooldowns)) return;
      if (support === 'flagRepair' && !this.isDefenseMode) return;
      if (this.operatorSupportCooldowns[support] > 0) return;
      const message = $('#operatorMessage');
      if (this.onlineMirror && !this.onlineApplyingRemote) {
        if (['supply','flare','barrier','decoy'].includes(support)) {
          this.operatorSupportPending = support;
          const labels = { supply:'補給物資の投下地点', flare:'照明ビーコンの投下地点', barrier:'バリケードの展開地点', decoy:'囮ビーコンの投下地点' };
          message.textContent = `${labels[support]}を戦場上でタップしてください。`;
        } else {
          window.trionOnline?.broadcast('operator_support', { support });
          message.textContent = '支援要請をホストへ送信しました。';
        }
        return;
      }
      if (support === 'scan') {
        const enemies = this.players.filter((p) => p.team !== this.playerTeam && !p.dead);
        enemies.forEach((enemy) => { enemy.revealTimer = Math.max(enemy.revealTimer, 8); enemy.markedTimer = Math.max(enemy.markedTimer, 5); });
        this.operatorSupportCooldowns.scan = this.operatorSupportDurations.scan;
        this.operatorStats.supportsUsed += 1; this.operatorStats.scan += 1;
        message.textContent = `広域索敵：敵${enemies.length}名を捕捉しました。`;
        this.logEvent('operator_support', message.textContent);
      } else if (support === 'rally') {
        const units = this.getOperatorUnits(this.playerTeam);
        units.forEach((unit) => { unit.operatorBoostTimer = Math.max(unit.operatorBoostTimer || 0, 10); unit.trion = Math.min(unit.maxTrion, unit.trion + unit.maxTrion * .12); });
        this.operatorSupportCooldowns.rally = this.operatorSupportDurations.rally;
        this.operatorStats.supportsUsed += 1; this.operatorStats.rally += 1;
        message.textContent = `${units.map((unit) => unit.name).join('・')}へ機動支援を送信しました。`;
        this.logEvent('operator_support', message.textContent);
      } else if (support === 'flagRepair' && this.isDefenseMode && this.defenseFlag) {
        const amount = this.defenseFlag.maxHp * .18;
        this.defenseFlag.hp = Math.min(this.defenseFlag.maxHp, this.defenseFlag.hp + amount);
        this.defenseFlag.repaired += amount;
        this.operatorSupportCooldowns.flagRepair = this.operatorSupportDurations.flagRepair;
        this.operatorStats.supportsUsed += 1; this.operatorStats.flagRepair += 1;
        message.textContent = `フラッグを${Math.round(amount)}回復しました。`;
        this.logEvent('operator_support', message.textContent);
      } else {
        this.operatorSupportPending = support;
        const labels = { supply: '補給物資の投下地点', flare: '照明ビーコンの投下地点', barrier: 'バリケードの展開地点', decoy: '囮ビーコンの投下地点' };
        message.textContent = `${labels[support]}を戦場上でタップしてください。`;
      }
      this.refreshOperatorUi();
    }

    applyOperatorSupportAt(support, point) {
      const x = clamp(point.x, 70, this.world.w - 70);
      const y = clamp(point.y, 70, this.world.h - 70);
      const message = $('#operatorMessage');
      if (support === 'supply') {
        for (let i = 0; i < 9; i++) this.pickups.push(this.makePickup(x + rand(-70, 70), y + rand(-70, 70), rand(5, 8), { temporary: true, ttl: 28, team: this.playerTeam, support: true }));
        this.operatorSupportCooldowns.supply = this.operatorSupportDurations.supply;
        this.operatorStats.supportsUsed += 1; this.operatorStats.supply += 1;
        message.textContent = 'トリオン補給物資を投下しました。';
      } else if (support === 'flare') {
        this.lightSources.push({ id: `support-light-${this.elapsed}-${Math.random()}`, x, y, radius: 15, hp: 70, maxHp: 70, lightRadius: 330, respawnTimer: 0, destroyedLogged: false, temporary: true, ttl: 38, team: this.playerTeam });
        this.operatorSupportCooldowns.flare = this.operatorSupportDurations.flare;
        this.operatorStats.supportsUsed += 1; this.operatorStats.flare += 1;
        message.textContent = '照明ビーコンを投下しました。';
      } else if (support === 'barrier') {
        for (let i = -1; i <= 1; i++) this.walls.push({ id: `support-barrier-${this.elapsed}-${i}-${Math.random()}`, x: x - 72 + i * 48, y: y - 14, w: 44, h: 28, type: 'barricade', hp: 135, maxHp: 135, ttl: 32, team: this.playerTeam });
        this.operatorSupportCooldowns.barrier = this.operatorSupportDurations.barrier;
        this.operatorStats.supportsUsed += 1; this.operatorStats.barrier += 1;
        message.textContent = '緊急バリケードを展開しました。';
      } else if (support === 'decoy') {
        for (let i = 0; i < 3; i++) this.beacons.push({ id: `operator-decoy-${this.elapsed}-${i}-${Math.random()}`, x: x + rand(-55, 55), y: y + rand(-55, 55), vx: rand(-34, 34), vy: rand(-34, 34), radius: 9, team: this.playerTeam, ownerId: 'operator', ttl: 24, hp: 24, maxHp: 24, createdAt: this.elapsed, exposedTeams: {} });
        this.operatorSupportCooldowns.decoy = this.operatorSupportDurations.decoy;
        this.operatorStats.supportsUsed += 1; this.operatorStats.decoy += 1;
        message.textContent = '囮ビーコンを展開しました。';
      }
      this.logEvent('operator_support', message.textContent);
      this.refreshOperatorUi();
    }

    handleOperatorCanvasClick(event) {
      if (!this.operatorVisible) return;
      const point = this.screenToWorld(event.clientX, event.clientY);
      if (this.onlineMirror && !this.onlineApplyingRemote) {
        if (this.operatorSupportPending) {
          const support = this.operatorSupportPending; this.operatorSupportPending = null;
          window.trionOnline?.broadcast('operator_support', { support, point });
          $('#operatorMessage').textContent = '支援地点をホストへ送信しました。';
          return;
        }
        if (this.operatorPendingCommand) {
          const pending = this.operatorPendingCommand; this.operatorPendingCommand = null;
          window.trionOnline?.broadcast('operator_point', { command:pending.command, units:pending.units, unit:this.operatorSelectedUnit, point });
          $('#operatorMessage').textContent = '指示地点をホストへ送信しました。';
          return;
        }
      }
      if (this.operatorSupportPending) {
        const support = this.operatorSupportPending;
        this.operatorSupportPending = null;
        this.applyOperatorSupportAt(support, point);
        return;
      }
      if (!this.operatorPendingCommand) return;
      const pending = this.operatorPendingCommand;
      const units = this.players.filter((p) => pending.units.includes(p.id));
      units.forEach((unit, index) => {
        let order;
        if (pending.command === 'spread') {
          const angle = index / Math.max(1, units.length) * TAU;
          const radius = units.length <= 2 ? 90 : 150;
          order = { type: 'move', x: clamp(point.x + Math.cos(angle) * radius, 50, this.world.w - 50), y: clamp(point.y + Math.sin(angle) * radius, 50, this.world.h - 50), label: '分散展開' };
        } else if (pending.command === 'suppress') {
          order = { type: 'suppress', x: clamp(point.x, 50, this.world.w - 50), y: clamp(point.y, 50, this.world.h - 50), radius: 330, label: '指定地域を制圧' };
        } else {
          order = { type: pending.command, x: clamp(point.x, 50, this.world.w - 50), y: clamp(point.y, 50, this.world.h - 50), label: pending.command === 'defend' ? '指定地点を防衛' : '指定地点へ移動' };
        }
        unit.operatorOrder = order;
        unit.operatorOrderProgress = 0;
      });
      $('#operatorMessage').textContent = `座標 ${Math.round(point.x)}, ${Math.round(point.y)} を指定しました。`;
      this.operatorStats.ordersIssued += 1;
      const operator = this.operators.find((op) => op.team === this.playerTeam);
      if (operator) operator.orders += 1;
      this.logEvent('operator_position', $('#operatorMessage').textContent);
      this.operatorPendingCommand = null;
    }

    getOperatorMoveDirective(p, target) {
      const order = p.operatorOrder;
      if (!order) return null;
      if (order.type === 'hold') {
        if (Math.hypot(p.x - order.x, p.y - order.y) < 55) return { x: order.x, y: order.y, hold: true };
        return order;
      }
      if (order.type === 'escort') {
        const ally = this.players.find((unit) => unit.id === order.allyId && !unit.dead);
        if (!ally) { p.operatorOrder = null; return null; }
        order.x = ally.x + Math.cos((p.id.charCodeAt(p.id.length - 1) || 1) * 1.7) * 90;
        order.y = ally.y + Math.sin((p.id.charCodeAt(p.id.length - 1) || 1) * 1.7) * 90;
        return order;
      }
      if (['move', 'defend', 'retreat', 'flank', 'activate', 'suppress'].includes(order.type)) {
        if (order.type === 'flank' && target) { order.x = lerp(order.x, target.x, .012); order.y = lerp(order.y, target.y, .012); }
        if (Math.hypot(p.x - order.x, p.y - order.y) < 65 && order.type === 'move') p.operatorOrder = null;
        return order;
      }
      return null;
    }

    updateOperatorCamera(dt) {
      if (!this.isPlayerOperator) return;
      const followed = this.players.find((p) => p.id === this.operatorCamera.followId && !p.dead);
      if (followed && !this.input.virtualMove.active && !this.input.isDown('KeyW') && !this.input.isDown('KeyS') && !this.input.isDown('KeyA') && !this.input.isDown('KeyD')) {
        this.operatorCamera.x = lerp(this.operatorCamera.x, followed.x, 1 - Math.pow(.02, dt));
        this.operatorCamera.y = lerp(this.operatorCamera.y, followed.y, 1 - Math.pow(.02, dt));
      } else {
        let dx = this.input.virtualMove.x;
        let dy = this.input.virtualMove.y;
        if (this.input.isDown('KeyW')) dy -= 1;
        if (this.input.isDown('KeyS')) dy += 1;
        if (this.input.isDown('KeyA')) dx -= 1;
        if (this.input.isDown('KeyD')) dx += 1;
        if (dx || dy) {
          const len = Math.hypot(dx, dy) || 1;
          this.operatorCamera.x += dx / len * 620 * dt;
          this.operatorCamera.y += dy / len * 620 * dt;
          this.operatorCamera.followId = null;
        }
      }
      this.operatorCamera.x = clamp(this.operatorCamera.x, this.viewW / 2, this.world.w - this.viewW / 2);
      this.operatorCamera.y = clamp(this.operatorCamera.y, this.viewH / 2, this.world.h - this.viewH / 2);
    }

    updateOperators(dt) {
      for (const key of Object.keys(this.operatorSupportCooldowns)) this.operatorSupportCooldowns[key] = Math.max(0, this.operatorSupportCooldowns[key] - dt);
      for (const p of this.players) {
        p.operatorBoostTimer = Math.max(0, (p.operatorBoostTimer || 0) - dt);
        const order = p.operatorOrder;
        if (!order || p.dead) continue;
        if (order.type === 'activate') {
          const facility = this.installations.find((item) => item.id === order.installationId && item.hp > 0 && !item.active);
          if (!facility) { p.operatorOrder = null; continue; }
          if (Math.hypot(p.x - facility.x, p.y - facility.y) < 95) {
            p.operatorOrderProgress += dt;
            p.vx *= .82;
            p.vy *= .82;
            if (p.operatorOrderProgress >= 3) { this.activateInstallation(facility, p.team, p); p.operatorOrder = null; p.operatorOrderProgress = 0; }
          }
        }
      }
      this.operatorAiTimer -= dt;
      if (this.operatorAiTimer > 0) return;
      this.operatorAiTimer = rand(6, 10);
      for (let team = 0; team < this.teamCount; team++) {
        if (this.isPlayerOperator && team === this.playerTeam) continue;
        const teamUnits = this.players.filter((p) => p.team === team && !p.dead);
        for (const p of teamUnits) {
          if (p.hp < p.maxHp * .28) { p.operatorOrder = { type: 'retreat', ...this.getTeamHome(team), label: 'オペレーター退避指示' }; continue; }
          if (Math.random() < .2) {
            const facility = this.findNearestInstallation(p, true);
            if (facility && Math.hypot(p.x - facility.x, p.y - facility.y) < 900) { p.operatorOrder = { type: 'activate', installationId: facility.id, x: facility.x, y: facility.y, label: '設備起動' }; continue; }
          }
          const target = this.findNearestEnemy(p);
          if (!target) continue;
          const roll = Math.random();
          if (roll < .18) p.operatorOrder = { type: 'flank', targetId: target.id, x: target.x + rand(-340, 340), y: target.y + rand(-340, 340), label: '側面展開' };
          else if (roll < .3) p.operatorOrder = { type: 'defend', ...this.getTeamHome(team), label: '本部防衛' };
          else p.operatorOrder = { type: 'focus', targetId: target.id, label: '集中攻撃' };
        }
        const operator = this.operators.find((op) => op.team === team);
        if (operator) operator.orders += 1;
      }
    }

    availableWeatherTypes(){ return this.mapId === 'desert' ? ['clear','cloudy'] : WEATHER_TYPES; }
    updateEnvironment(dt){
      if(this.environment.timeProgression){
        this.environment.timeTimer+=dt;
        if(this.environment.timeTimer>=90){
          this.environment.timeTimer=0;
          this.environment.timeOfDay=TIME_PHASES[(TIME_PHASES.indexOf(this.environment.timeOfDay)+1)%TIME_PHASES.length];
          this.logEvent('time_change',TIME_LABELS[this.environment.timeOfDay]);
        }
      }
      if(this.mapId === 'desert' && this.environment.weather === 'rain') this.environment.weather = 'clear';
      if(this.environment.weatherChange){
        this.environment.weatherTimer-=dt;
        if(this.environment.weatherTimer<=0){
          const options=this.availableWeatherTypes().filter(w=>w!==this.environment.weather);
          this.environment.weather=choose(options) || 'clear';
          this.environment.weatherTimer=rand(75,115);
          this.logEvent('weather_change',WEATHER_LABELS[this.environment.weather]);
        }
      }
      this.updateEnvironmentLabel();
      if(this.operatorVisible&&Math.floor(this.elapsed*2)!==this._lastOperatorRefresh){this._lastOperatorRefresh=Math.floor(this.elapsed*2);this.refreshOperatorUi();}
    }
    updateEnvironmentLabel(){
      const el=$('#environmentLabel');
      if(el) el.textContent=`${MAP_LABELS[this.mapId]}・${TIME_LABELS[this.environment.timeOfDay]}・${WEATHER_LABELS[this.environment.weather]}`;
    }
    isInCircleZone(x,y,zone){ return Math.hypot(x-zone.x,y-zone.y) <= zone.radius; }
    isInDesertShade(p){ return this.terrain.shades.some(zone=>this.isPointInRect(p.x,p.y,zone)); }
    isInOasis(p){ return this.terrain.oases.some(zone=>this.isInCircleZone(p.x,p.y,zone)); }
    isNearDesertFire(p){ return this.lightSources.some(light=>light.fire&&light.hp>0&&Math.hypot(light.x-p.x,light.y-p.y)<=Math.max(150,light.lightRadius*.72)); }
    desertReliefState(p){
      if(this.mapId!=='desert') return { relieved:true, multiplier:1, label:'' };
      if(this.environment.timeOfDay==='night'){
        const relieved=this.isNearDesertFire(p);
        return { relieved, multiplier:relieved?1:1.28, label:relieved?'火のそば':'夜冷負荷 +28%' };
      }
      const shade=this.isInDesertShade(p), oasis=this.isInOasis(p), relieved=shade||oasis;
      return { relieved, multiplier:relieved?1:1.38, label:oasis?'オアシス':shade?'日陰':'灼熱負荷 +38%' };
    }
    nearestDesertReliefPoint(p){
      if(this.mapId!=='desert') return null;
      const points=[];
      if(this.environment.timeOfDay==='night'){
        for(const light of this.lightSources){
          if(!light.fire||light.hp<=0) continue;
          const angle=Math.atan2(p.y-light.y,p.x-light.x);
          const standRadius=Math.max(76,Math.min(150,light.lightRadius*.48));
          points.push({id:light.id,x:light.x+Math.cos(angle)*standRadius,y:light.y+Math.sin(angle)*standRadius,type:'fire'});
        }
      }else{
        for(const oasis of this.terrain.oases){
          const angle=Math.atan2(p.y-oasis.y,p.x-oasis.x);
          const standRadius=Math.max(55,oasis.radius*.7);
          points.push({id:oasis.id,x:oasis.x+Math.cos(angle)*standRadius,y:oasis.y+Math.sin(angle)*standRadius,type:'oasis'});
        }
        for(const shade of this.terrain.shades){
          points.push({
            id:shade.id,
            x:clamp(p.x,shade.x+24,shade.x+shade.w-24),
            y:clamp(p.y,shade.y+24,shade.y+shade.h-24),
            type:'shade'
          });
        }
      }
      for(const point of points){
        const distanceScore=Math.hypot(point.x-p.x,point.y-p.y);
        const crowd=this.players.filter(other=>other!==p&&!other.dead&&Math.hypot(other.x-point.x,other.y-point.y)<180).length;
        const enemyPressure=this.players.filter(other=>this.canDamage(p,other)&&Math.hypot(other.x-point.x,other.y-point.y)<420).length;
        point.score=distanceScore+crowd*260+enemyPressure*390;
      }
      points.sort((a,b)=>a.score-b.score);
      return points[0]||null;
    }
    applyTerrainPhysics(p,dt){
      let factor=1;
      const onRoad=this.terrain.roads.some(r=>this.isPointInRect(p.x,p.y,r));
      const onPlaza=this.terrain.plazas.some(r=>this.isPointInRect(p.x,p.y,r));
      if(onRoad) factor*=this.mapId==='desert'?1.03:1.08;
      if(this.terrain.forests.some(r=>this.isPointInRect(p.x,p.y,r))) factor*=.82;
      if(this.isInRiver(p.x,p.y)){ const river=this.terrain.rivers[0]; factor*=.48; p.vx+=river.flowX*dt; p.vy+=river.flowY*dt; }
      if(this.mapId==='desert'){
        if(this.terrain.dunes.some(r=>this.isPointInRect(p.x,p.y,r))) factor*=.86;
        for(const oasis of this.terrain.oases) if(this.isInCircleZone(p.x,p.y,oasis)) factor*=.74;
        for(const zone of this.terrain.quicksand){
          if(!this.isInCircleZone(p.x,p.y,zone)) continue;
          factor*=.42;
          p.vx+=zone.flowX*dt*2.2; p.vy+=zone.flowY*dt*2.2;
          const dx=zone.x-p.x,dy=zone.y-p.y,len=Math.hypot(dx,dy)||1;
          p.vx+=dx/len*24*dt; p.vy+=dy/len*24*dt;
        }
        for(const cliff of this.terrain.cliffs){
          if(!this.isPointInRect(p.x,p.y,cliff)) continue;
          const forward=p.vx*cliff.dirX+p.vy*cliff.dirY;
          if(forward<0){ p.vx-=cliff.dirX*forward*1.35; p.vy-=cliff.dirY*forward*1.35; }
          p.vx+=cliff.dirX*42*dt; p.vy+=cliff.dirY*42*dt;
          factor*=.92;
        }
      }
      p.groundFrictionBase = this.environment.weather==='rain' ? (onRoad||onPlaza ? .48 : .22) : .0008;
      p.vx*=factor; p.vy*=factor;
    }

    activateInstallation(facility,team,worker){
      facility.active=true; facility.team=team; facility.work=0;
      facility.activeTimer = facility.type==='barricade' ? 48 : facility.type==='trap' ? 70 : 62;
      if(facility.type==='barricade'){
        for(let i=-1;i<=1;i++) this.walls.push({id:`${facility.id}-bar-${i}-${this.elapsed}`,facilityId:facility.id,x:facility.x-55,y:facility.y+i*34-13,w:110,h:26,type:'barricade',hp:160,maxHp:160,ttl:facility.activeTimer,team});
      }
      this.logEvent('installation_activate',`${worker?.name||'OPERATOR'}が${facility.type}を起動`); this.toast('設備を起動しました');
    }
    deactivateInstallation(facility, reason='timeout'){
      if(!facility.active) return;
      facility.active=false; facility.team=null; facility.work=0; facility.activeTimer=0;
      for(const wall of this.walls) if(wall.facilityId===facility.id) wall.ttl=Math.min(wall.ttl,1.2);
      this.logEvent('installation_deactivate',`${facility.id} ${reason}`);
    }
    updateInstallations(dt){
      for(let index=this.installations.length-1;index>=0;index--){
        const f=this.installations[index];
        f.cooldown=Math.max(0,(f.cooldown||0)-dt);
        if(f.temporary){
          f.ttl=(f.ttl??f.activeTimer??60)-dt;
          f.activeTimer=f.ttl;
          if(f.hp<=0||f.ttl<=0){
            this.deactivateInstallation(f,f.hp<=0?'destroyed':'timeout');
            this.installations.splice(index,1);
            continue;
          }
        }
        if(f.hp<=0){
          if(!f.destroyedLogged){
            f.destroyedLogged=true; f.respawnTimer=rand(45,70); this.deactivateInstallation(f,'destroyed');
            for(const wall of this.walls) if(wall.facilityId===f.id) wall.hp=0;
            this.lifecycleStats.installationsDestroyed += 1; this.logEvent('installation_destroyed',f.id);
          }
          f.respawnTimer-=dt;
          if(f.respawnTimer<=0){
            f.hp=f.maxHp; f.destroyedLogged=false; f.respawnTimer=0; f.active=false; f.team=null; f.work=0;
            this.lifecycleStats.installationsRespawned += 1; this.logEvent('installation_respawn',f.id);
          }
          continue;
        }
        if(!f.active) continue;
        if(!f.temporary) f.activeTimer=(f.activeTimer||0)-dt;
        if(f.activeTimer<=0){
          if(f.temporary){this.installations.splice(index,1);continue;}
          this.deactivateInstallation(f,'timeout'); continue;
        }
        const hostile=(p)=>!p.dead&&((this.config.mode==='team'||this.isDefenseMode)?p.team!==f.team:true);
        if(f.type==='turret'&&f.cooldown<=0){
          const target=this.players.filter(hostile).sort((a,b)=>Math.hypot(a.x-f.x,a.y-f.y)-Math.hypot(b.x-f.x,b.y-f.y))[0];
          if(target&&Math.hypot(target.x-f.x,target.y-f.y)<820){ const owner=this.players.find(p=>p.team===f.team&&!p.dead); if(owner){ const ang=Math.atan2(target.y-f.y,target.x-f.x); this.spawnProjectile(owner,'main',{angle:ang,speed:650,damage:this.isDefenseMode?19:15,radius:5,life:1.4,color:'#ffd369',sourceKey:'fixedTurret',sourceName:'固定砲台'}); const proj=this.projectiles[this.projectiles.length-1]; if(proj){proj.x=f.x;proj.y=f.y;} f.cooldown=this.isDefenseMode?.58:.72; } }
        } else if(f.type==='trap'&&f.cooldown<=0){ const target=this.players.find(p=>hostile(p)&&Math.hypot(p.x-f.x,p.y-f.y)<88); if(target){ const owner=this.players.find(p=>p.team===f.team&&!p.dead); if(owner){ this.explode(f.x,f.y,138,this.isDefenseMode?38:28,owner.id,owner.team,null,'固定トラップ',{sourceKey:'fixedTrap'}); f.cooldown=this.isDefenseMode?6.5:8; } } }
      }
    }
    toggleDebugPanel(force) {
      this.debugVisible = typeof force === 'boolean' ? force : !this.debugVisible;
      $('#debugPanel').classList.toggle('hidden', !this.debugVisible);
      if (this.debugVisible) this.updateDebugPanel(true);
    }

    logEvent(type, message, store = true) {
      const event = { time: Number(this.elapsed.toFixed(3)), type, message };
      if (store) {
        this.battleEvents.push(event);
        if (this.battleEvents.length > MAX_BATTLE_EVENTS) {
          const protectedTypes = new Set(['match_start', 'match_end', 'manual_bailout', 'spectate_start', 'spectate_end']);
          const removable = this.battleEvents.findIndex((item) => !protectedTypes.has(item.type));
          this.battleEvents.splice(removable >= 0 ? removable : 0, 1);
        }
      }
      return event;
    }

    beginTriggerActivation(player, triggerId, displayName = null) {
      const name = displayName || DATA.triggers[triggerId]?.name || ATTACK_LABELS[triggerId] || triggerId;
      const activationId = `${player.id}:${++this.activationCounter}`;
      player._activationHits.set(activationId, new Set());
      if (player._activationHits.size > 1200) {
        for (const key of [...player._activationHits.keys()].slice(0, 300)) player._activationHits.delete(key);
      }
      this.activeActivation = { id: activationId, playerId: player.id, triggerId, name };
      return this.activeActivation;
    }

    ensureTriggerStat(player, key, name = key) {
      const stat = player.metrics.triggerStats[key] ||= {
        name, uses: 0, projectiles: 0, projectileHits: 0, hitActivations: 0, uniqueTargetsHit: 0,
        damage: 0, kills: 0, trionSpent: 0, effectApplications: 0, effectDurationSeconds: 0,
        placements: 0, manualActivations: 0, automaticActivations: 0, damageTriggers: 0,
      };
      stat.name = name || stat.name;
      return stat;
    }

    recordTriggerUse(player, triggerId, displayName = null, activationId = null, trionSpent = 0) {
      const name = displayName || DATA.triggers[triggerId]?.name || ATTACK_LABELS[triggerId] || triggerId;
      player.metrics.triggerActivations += 1;
      const kind = DATA.triggers[triggerId]?.kind;
      const offensive = ['melee', 'shooter', 'gun', 'sniper', 'pairedOption'].includes(kind) || triggerId === 'mantis' || triggerId === 'scorpionLong' || triggerId === 'switchbox' || String(triggerId).startsWith('composite:');
      if (offensive) {
        player.metrics.attackActions += 1;
        player.metrics.attackActivations += 1;
      }
      player.metrics.triggerUses[name] = (player.metrics.triggerUses[name] || 0) + 1;
      const key = triggerId || name;
      const stat = this.ensureTriggerStat(player, key, name);
      stat.uses += 1;
      stat.trionSpent += Math.max(0, Number(trionSpent || 0));
      if (triggerId === 'switchbox' || triggerId === 'spider' || triggerId === 'dummyBeacon') stat.placements += 1;
    }

    registerEffectApplication(owner, sourceKey, sourceName, target, duration = 0, activationId = null) {
      if (!owner?.metrics) return;
      owner.metrics.effectApplications += 1;
      const stat = this.ensureTriggerStat(owner, sourceKey, sourceName);
      stat.effectApplications += 1;
      stat.effectDurationSeconds += Math.max(0, duration);
      const before = owner.metrics.activationsWithHit;
      this.registerActivationHit(owner, { sourceKey, name: sourceName, activationId }, target);
      if (owner.metrics.activationsWithHit > before) owner.metrics.successfulEffectActivations += 1;
    }

    supportScale() { return (this.config.mode === 'team' || this.isDefenseMode) ? 1 : .55; }

    awardSupport(owner, basePoints) {
      if (!owner?.metrics || basePoints <= 0) return 0;
      const points = basePoints * this.supportScale();
      owner.metrics.supportScore += points;
      owner.score += points;
      if (this.config.mode === 'team') this.teamScores[owner.team] += points;
      return points;
    }

    registerActivationHit(attacker, info, target) {
      if (!attacker?.metrics) return;
      const activationId = info.activationId;
      if (!activationId) return;
      let targets = attacker._activationHits.get(activationId);
      if (!targets) {
        targets = new Set();
        attacker._activationHits.set(activationId, targets);
      }
      const firstHit = targets.size === 0;
      if (firstHit) attacker.metrics.activationsWithHit += 1;
      if (!targets.has(target.id)) {
        targets.add(target.id);
        attacker.metrics.uniqueTargetsHit += 1;
        const key = info.sourceKey || info.name || 'attack';
        const stat = this.ensureTriggerStat(attacker, key, info.name || key);
        if (firstHit) stat.hitActivations += 1;
        stat.uniqueTargetsHit += 1;
      }
    }

    buildBalanceSummary() {
      const triggers = {};
      for (const player of this.players) {
        for (const [key, stat] of Object.entries(player.metrics.triggerStats || {})) {
          const total = triggers[key] ||= { name: stat.name || key, uses: 0, projectiles: 0, projectileHits: 0, hitActivations: 0, uniqueTargetsHit: 0, damage: 0, kills: 0, trionSpent: 0, effectApplications: 0, effectDurationSeconds: 0, placements: 0, automaticActivations: 0, damageTriggers: 0 };
          for (const field of ['uses', 'projectiles', 'projectileHits', 'hitActivations', 'uniqueTargetsHit', 'damage', 'kills', 'trionSpent', 'effectApplications', 'effectDurationSeconds', 'placements', 'automaticActivations', 'damageTriggers']) total[field] += Number(stat[field] || 0);
        }
      }
      return Object.fromEntries(Object.entries(triggers).map(([key, value]) => [key, {
        ...value,
        damage: Number(value.damage.toFixed(2)),
        damagePerUse: value.uses ? Number((value.damage / value.uses).toFixed(3)) : 0,
        damagePerTrion: value.trionSpent ? Number((value.damage / value.trionSpent).toFixed(3)) : 0,
        activationHitRate: value.uses ? Number((value.hitActivations / value.uses).toFixed(4)) : 0,
        projectileHitRate: value.projectiles ? Number((value.projectileHits / value.projectiles).toFixed(4)) : 0,
      }]));
    }

    getClockLabel() {
      return this.isUnlimited ? `∞ ${formatTime(this.elapsed)}` : formatTime(this.matchTime);
    }

    buildLog(reason = 'snapshot') {
      return {
        schemaVersion: 18,
        matchId: this.matchId,
        startedAt: this.startedAt,
        endedAt: new Date().toISOString(),
        reason,
        completed: this.ended,
        durationSeconds: Number(this.elapsed.toFixed(2)),
        configuredDurationSeconds: this.isUnlimited ? null : this.config.matchLength,
        unlimited: this.isUnlimited,
        mode: this.config.mode,
        modeLabel: MODE_LABELS[this.config.mode] || '個人戦',
        difficulty: this.config.difficulty,
        difficultyLabel: AI_DIFFICULTIES[this.config.difficulty]?.label || '普通',
        aiProfile: { ...(AI_DIFFICULTIES[this.config.difficulty] || AI_DIFFICULTIES.normal) },
        cpuCount: this.config.cpuCount,
        playerRole: this.playerRole,
        playerTeam: this.playerTeam,
        teamCount: this.teamCount || null,
        teamSize: this.config.teamSize || null,
        online: this.isOnlineMatch ? {
          roomId: this.onlineSession?.roomId || null,
          roomCode: this.onlineSession?.roomCode || null,
          host: this.isOnlineHost,
          localUserId: this.localOnlineUserId,
          roster: (this.onlineSession?.roster || []).map((member) => ({ userId:member.userId, displayName:member.displayName, team:member.team, role:member.role })),
          snapshotHz: this.onlineSnapshotHz,
        } : null,
        operatorStats: { ...this.operatorStats },
        operators: this.operators.map((op) => ({ ...op })),
        environment: { ...this.environment },
        soundEnabled: this.soundEnabled,
        cpuConfigs: this.config.cpuConfigs || [],
        map: { id: this.mapId, label: MAP_LABELS[this.mapId], width: this.world.w, height: this.world.h, areaMultiplier: 4, basePickupCount: BASE_PICKUP_COUNT, terrain: Object.fromEntries(Object.entries(this.terrain).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])), installations: this.installations.length, lightSources: this.lightSources.length },
        lifecycle: { ...this.lifecycleStats, pendingTerrainRespawns: this.worldRespawns.length, activeLights: this.lightSources.filter((light) => light.hp > 0).length },
        pickupStats: { ...this.pickupStats, currentTotal: this.pickups.length, currentTemporary: this.pickups.filter((pickup) => pickup.temporary).length },
        defense: this.isDefenseMode ? {
          round: this.defenseRound,
          tier: this.defenseTier,
          waveActive: this.defenseWaveActive,
          nextRoundSeconds: Number(Math.max(0, this.defenseRoundTimer).toFixed(2)),
          enemiesDefeated: this.defenseEnemiesDefeated,
          bossesDefeated: this.defenseBossesDefeated,
          activeEnemies: this.players.filter((player) => player.isDefenseEnemy && !player.dead).map((enemy) => ({ id: enemy.id, type: enemy.defenseType, boss: enemy.isDefenseBoss, hp: Number(enemy.hp.toFixed(2)), maxHp: enemy.maxHp, objective: enemy.defenseAI?.objectiveMode || null, flagAttacks: enemy.defenseAI?.flagAttacks || 0 })),
          flag: this.defenseFlag ? { hp: Number(this.defenseFlag.hp.toFixed(2)), maxHp: this.defenseFlag.maxHp, repaired: Number(this.defenseFlag.repaired.toFixed(2)), lastDamageAt: Number(this.defenseFlag.lastDamageAt.toFixed(2)), armor: this.defenseFlag.armor || 0 } : null,
          fortification: { points: Number(this.defenseBuildPoints.toFixed(2)), maxPoints: this.defenseBuildMaxPoints, built: { ...this.defenseBuildStats } },
        } : null,
        teamScores: this.teamScores.map((score) => Number(score.toFixed(2))),
        humanConfig: { role: this.playerRole, stats: this.config.stats, loadout: this.config.loadout, teamConfig: this.config.teamConfig || null, offBoard: !this.isPlayerCombatant },
        balanceSummary: this.buildBalanceSummary(),
        players: this.players.map((player) => ({
          id: player.id,
          name: player.name,
          human: player.human,
          team: player.team,
          archetype: player.archetype,
          squadName: player.squadName,
          stats: player.stats,
          loadout: player.loadout,
          spawnHistory: player.spawnHistory,
          score: Number(player.score.toFixed(2)),
          kills: player.kills,
          deaths: player.deaths,
          metrics: {
            ...player.metrics,
            damageDealt: Number(player.metrics.damageDealt.toFixed(2)),
            damageTaken: Number(player.metrics.damageTaken.toFixed(2)),
            blockedDamage: Number(player.metrics.blockedDamage.toFixed(2)),
            shieldDamagePrevented: Number(player.metrics.shieldDamagePrevented.toFixed(2)),
            trionSpent: Number(player.metrics.trionSpent.toFixed(2)),
            pickupTrionGained: Number(player.metrics.pickupTrionGained.toFixed(2)),
            aliveTime: Number(player.metrics.aliveTime.toFixed(2)),
            longestLife: Number(Math.max(player.metrics.longestLife, player.metrics.currentLife).toFixed(2)),
            projectileHitRate: player.metrics.projectilesSpawned ? Number((player.metrics.projectilesHit / player.metrics.projectilesSpawned).toFixed(4)) : 0,
            projectileHitEventRate: player.metrics.projectilesFired ? Number((player.metrics.projectileHits / player.metrics.projectilesFired).toFixed(4)) : 0,
            activationHitRate: player.metrics.attackActivations ? Number((player.metrics.activationsWithHit / player.metrics.attackActivations).toFixed(4)) : 0,
          },
        })),
        events: [...this.battleEvents],
      };
    }

    finalizeLog(reason = 'match_end') {
      if (this.logFinalized) return this.finalLog;
      this.logEvent('match_end', `試合記録確定：${reason}`);
      this.finalLog = this.buildLog(reason);
      const logs = readSavedLogs();
      logs.unshift(this.finalLog);
      writeSavedLogs(logs);
      this.logFinalized = true;
      renderSavedLogSummary();
      return this.finalLog;
    }

    logToCsv(log) {
      const headers = ['matchId', 'difficulty', 'mode', 'unlimited', 'player', 'human', 'team', 'archetype', 'trion', 'technique', 'combat', 'score', 'kills', 'assists', 'supportScore', 'deaths', 'combatDeaths', 'manualBailouts', 'spectateTransitions', 'damageDealt', 'damageTaken', 'blockedDamage', 'triggerActivations', 'attackActivations', 'activationsWithHit', 'activationHitRate', 'projectilesSpawned', 'projectilesHit', 'projectileHitRate', 'projectileHitEvents', 'meleeHits', 'trionSpent', 'pickups', 'pickupTrionGained', 'aliveTime', 'longestLife', 'spiderSlowSeconds', 'dummyBeaconTargetSeconds', 'switchboxTriggers', 'leadBulletSlowSeconds', 'starmakerRevealSeconds', 'effectApplications', 'successfulEffectActivations', 'aiVoluntaryBailouts', 'desertReliefVisits', 'desertReliefDepartures', 'triggerUses', 'triggerDamage', 'triggerStats', 'aiTriggerSelections'];
      const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const rows = log.players.map((player) => {
        const m = player.metrics || {};
        const values = [log.matchId, log.difficulty, log.mode, log.unlimited, player.name, player.human, player.team, player.archetype, player.stats.trion, player.stats.technique, player.stats.combat, player.score, player.kills, m.assists, m.supportScore, player.deaths, m.combatDeaths, m.manualBailouts, m.spectateTransitions, m.damageDealt, m.damageTaken, m.blockedDamage, m.triggerActivations, m.attackActivations, m.activationsWithHit, m.activationHitRate, m.projectilesSpawned, m.projectilesHit, m.projectileHitRate, m.projectileHits, m.meleeHits, m.trionSpent, m.pickups, m.pickupTrionGained, m.aliveTime, m.longestLife, m.spiderSlowSeconds, m.dummyBeaconTargetSeconds, m.switchboxTriggers, m.leadBulletSlowSeconds, m.starmakerRevealSeconds, m.effectApplications, m.successfulEffectActivations, m.aiVoluntaryBailouts, m.desertReliefVisits, m.desertReliefDepartures, JSON.stringify(m.triggerUses || {}), JSON.stringify(m.triggerDamage || {}), JSON.stringify(m.triggerStats || {}), JSON.stringify(m.aiTriggerSelections || {})];
        return values.map(quote).join(',');
      });
      return `\uFEFF${headers.join(',')}\n${rows.join('\n')}`;
    }

    exportCurrentLog(format) {
      const log = this.logFinalized ? this.finalLog : this.buildLog('manual_export');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      if (format === 'csv') downloadText(`trion-arena-${this.matchId}-${stamp}.csv`, this.logToCsv(log), 'text/csv');
      else downloadText(`trion-arena-${this.matchId}-${stamp}.json`, JSON.stringify(log, null, 2));
    }

    updateDebugPanel(force = false) {
      if (!this.debugVisible && !force) return;
      const difficulty = AI_DIFFICULTIES[this.config.difficulty]?.label || '普通';
      $('#debugMatchLabel').textContent = `${this.isDefenseMode ? 'DEFENSE' : this.config.mode === 'team' ? 'TEAM' : 'SOLO'} / ${difficulty} / ${this.getClockLabel()}`;
      const totalDamage = this.players.reduce((sum, player) => sum + player.metrics.damageDealt, 0);
      const totalShots = this.players.reduce((sum, player) => sum + player.metrics.projectilesSpawned, 0);
      const totalHits = this.players.reduce((sum, player) => sum + player.metrics.projectilesHit, 0);
      const totalBailouts = this.players.reduce((sum, player) => sum + player.deaths, 0);
      $('#debugSummary').innerHTML = `
        <div><span>DAMAGE</span><strong>${Math.round(totalDamage)}</strong></div>
        <div><span>PROJECTILES</span><strong>${totalShots}</strong></div>
        <div><span>HIT RATE</span><strong>${totalShots ? Math.round(totalHits / totalShots * 100) : 0}%</strong></div>
        <div><span>BAIL OUT</span><strong>${totalBailouts}</strong></div>`;
      const ranked = [...this.players].sort((a, b) => b.score - a.score || b.metrics.damageDealt - a.metrics.damageDealt);
      $('#debugTable').innerHTML = `<div class="debug-row header"><span>UNIT</span><span>K/D</span><span>DMG</span><span>TAKEN</span><span>HIT%</span><span>TRION</span></div>${ranked.map((player) => {
        const hitRate = player.metrics.projectilesSpawned ? Math.round(player.metrics.projectilesHit / player.metrics.projectilesSpawned * 100) : 0;
        return `<div class="debug-row${player.human ? ' player' : ''}"><strong>${player.name}</strong><span>${player.kills}/${player.deaths}</span><span>${Math.round(player.metrics.damageDealt)}</span><span>${Math.round(player.metrics.damageTaken)}</span><span>${hitRate}%</span><span>${Math.round(player.metrics.trionSpent)}</span></div>`;
      }).join('')}`;
      $('#debugEvents').textContent = this.battleEvents.slice(-35).map((event) => `${event.time.toFixed(1).padStart(6, ' ')}  ${event.type.padEnd(15, ' ')} ${event.message}`).join('\n');
      $('#debugEvents').scrollTop = $('#debugEvents').scrollHeight;
    }

    resize() {
      const dprCap = this.onlineMirror ? (this.onlineLowPowerGuest ? .85 : 1) : 1.25;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const viewport = window.visualViewport;
      const nextW = Math.max(320, Math.round(viewport?.width || document.documentElement.clientWidth || window.innerWidth));
      const nextH = Math.max(320, Math.round(viewport?.height || document.documentElement.clientHeight || window.innerHeight));
      if (this.viewW === nextW && this.viewH === nextH && this.dpr === dpr) return;
      const centerX = Number.isFinite(this.viewW) ? this.camera.x + this.viewW / 2 : this.world.w / 2;
      const centerY = Number.isFinite(this.viewH) ? this.camera.y + this.viewH / 2 : this.world.h / 2;
      this.viewW = nextW;
      this.viewH = nextH;
      this.canvas.width = Math.round(this.viewW * dpr);
      this.canvas.height = Math.round(this.viewH * dpr);
      this.canvas.style.width = `${this.viewW}px`;
      this.canvas.style.height = `${this.viewH}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.environmentCanvas.width = Math.max(1, Math.ceil(this.viewW));
      this.environmentCanvas.height = Math.max(1, Math.ceil(this.viewH));
      this.camera.x = clamp(centerX - this.viewW / 2, 0, Math.max(0, this.world.w - this.viewW));
      this.camera.y = clamp(centerY - this.viewH / 2, 0, Math.max(0, this.world.h - this.viewH));
      this.dpr = dpr;
    }

    generateArena() {
      if (this.mapId === 'desert') this.generateDesertArena();
      else this.generateCityArena();
    }

    generateDesertArena() {
      this.terrain.roads.push(
        { x: 0, y: 1960, w: this.world.w, h: 250, desertRoad: true },
        { x: 3010, y: 0, w: 380, h: this.world.h, desertRoad: true },
        { x: 620, y: 720, w: 2050, h: 150, desertRoad: true },
        { x: 3820, y: 3380, w: 1960, h: 150, desertRoad: true }
      );
      this.terrain.dunes.push(
        { id: 'dune-0', x: 80, y: 140, w: 1720, h: 1180 },
        { id: 'dune-1', x: 1960, y: 180, w: 1620, h: 1020 },
        { id: 'dune-2', x: 4180, y: 180, w: 1960, h: 1320 },
        { id: 'dune-3', x: 320, y: 2660, w: 2100, h: 1480 },
        { id: 'dune-4', x: 3800, y: 2500, w: 2260, h: 1520 }
      );
      this.terrain.oases.push(
        { id: 'oasis-0', x: 980, y: 1580, radius: 235 },
        { id: 'oasis-1', x: 5170, y: 2840, radius: 270 },
        { id: 'oasis-2', x: 3180, y: 3550, radius: 190 }
      );
      this.terrain.quicksand.push(
        { id: 'quicksand-0', x: 1700, y: 2900, radius: 310, flowX: 86, flowY: 24 },
        { id: 'quicksand-1', x: 4430, y: 1650, radius: 350, flowX: -58, flowY: 78 },
        { id: 'quicksand-2', x: 2660, y: 1180, radius: 245, flowX: 34, flowY: 92 }
      );
      this.terrain.cliffs.push(
        { id: 'cliff-0', x: 150, y: 2280, w: 1320, h: 250, dirX: 1, dirY: 0 },
        { id: 'cliff-1', x: 4760, y: 1780, w: 1380, h: 250, dirX: -1, dirY: 0 },
        { id: 'cliff-2', x: 2680, y: 250, w: 240, h: 1260, dirX: 0, dirY: 1 },
        { id: 'cliff-3', x: 3500, y: 2760, w: 240, h: 1320, dirX: 0, dirY: -1 }
      );
      for (const cliff of this.terrain.cliffs) {
        if (cliff.w > cliff.h) this.terrain.shades.push({ id: `${cliff.id}-shade`, x: cliff.x, y: cliff.y + cliff.h - 72, w: cliff.w, h: 96, kind: 'cliff' });
        else this.terrain.shades.push({ id: `${cliff.id}-shade`, x: cliff.x + cliff.w - 72, y: cliff.y, w: 96, h: cliff.h, kind: 'cliff' });
      }
      this.addAncientFortress(360, 320, 1180, 840, 'fortress-west');
      this.addAncientFortress(4520, 3100, 1320, 900, 'fortress-east');
      this.terrain.gasFields.push(
        { id: 'gas-0', x: 2180, y: 1860, radius: 175, active: true, cooldown: 0 },
        { id: 'gas-1', x: 3970, y: 900, radius: 190, active: true, cooldown: 0 },
        { id: 'gas-2', x: 4120, y: 3520, radius: 165, active: true, cooldown: 0 },
        { id: 'gas-3', x: 1260, y: 3560, radius: 180, active: true, cooldown: 0 },
        { id: 'gas-4', x: 5670, y: 1320, radius: 150, active: true, cooldown: 0 }
      );
      const scatteredTorches = [
        [720,1430],[1460,2010],[2470,690],[3270,1710],[3800,2260],[4910,2280],[5650,3560],[3020,4010],[830,3060],[6100,2050]
      ];
      scatteredTorches.forEach(([x,y],i)=>this.lightSources.push({id:`torch-open-${i}`,kind:'torch',fire:true,x,y,radius:13,hp:72,maxHp:72,lightRadius:245,respawnTimer:0,destroyedLogged:false}));
      for (const wall of this.walls) {
        if (['fortressWall'].includes(wall.type)) {
          wall.respawnable = true;
          wall.respawnDelay = [70, 100];
        }
      }
      for (let i = 0; i < BASE_PICKUP_COUNT; i++) this.pickups.push(this.makePickup());
      this.pickupStats.baseSpawned = BASE_PICKUP_COUNT;
      this.pickupStats.peakTotal = this.pickups.length;
    }

    addAncientFortress(x, y, w, h, id) {
      const wall = 42;
      const gate = 170;
      const fortress = { id, x, y, w, h };
      this.terrain.fortresses.push(fortress);
      this.terrain.buildings.push({ ...fortress, desertFortress: true });
      this.terrain.plazas.push({ id: `${id}-court`, x: x + wall, y: y + wall, w: w - wall * 2, h: h - wall * 2, fortress: true });
      this.terrain.shades.push({ id: `${id}-shade`, x: x + wall, y: y + wall, w: w - wall * 2, h: h - wall * 2, kind: 'fortress' });
      const parts = [
        { x, y, w: w * .5 - gate / 2, h: wall }, { x: x + w * .5 + gate / 2, y, w: w * .5 - gate / 2, h: wall },
        { x, y: y + h - wall, w: w * .5 - gate / 2, h: wall }, { x: x + w * .5 + gate / 2, y: y + h - wall, w: w * .5 - gate / 2, h: wall },
        { x, y, w: wall, h }, { x: x + w - wall, y, w: wall, h }
      ];
      parts.forEach((rect, index) => this.walls.push({ ...rect, id: `${id}-wall-${index}`, type: 'fortressWall', hp: 620, maxHp: 620, ttl: Infinity }));
      const facilityTypes = ['barricade','trap','turret','turret','trap','barricade'];
      facilityTypes.forEach((type, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        this.installations.push({
          id: `${id}-facility-${index}`, type,
          x: x + wall + 170 + col * ((w - wall * 2 - 340) / 2),
          y: y + wall + 190 + row * (h - wall * 2 - 380),
          radius: 24, hp: type === 'barricade' ? 300 : 220, maxHp: type === 'barricade' ? 300 : 220,
          active: false, team: null, work: 0, cooldown: 0, activeTimer: 0, respawnTimer: 0, destroyedLogged: false,
          ancient: true,
        });
      });
      const torchPoints = [
        [x + 100, y + 110], [x + w - 100, y + 110], [x + 100, y + h - 110], [x + w - 100, y + h - 110],
        [x + w * .5, y + 120], [x + w * .5, y + h - 120]
      ];
      torchPoints.forEach(([tx,ty],index)=>this.lightSources.push({id:`${id}-torch-${index}`,kind:'torch',fire:true,x:tx,y:ty,radius:13,hp:85,maxHp:85,lightRadius:270,respawnTimer:0,destroyedLogged:false,fortressId:id}));
    }

    generateCityArena() {
      const addRect = (list, rect) => { list.push(rect); return rect; };
      this.terrain.roads.push({ x: 0, y: 1980, w: this.world.w, h: 360 }, { x: 2920, y: 0, w: 560, h: this.world.h }, { x: 0, y: 670, w: this.world.w, h: 170 }, { x: 0, y: 3500, w: this.world.w, h: 160 });
      this.terrain.plazas.push({ x: 2450, y: 1580, w: 1500, h: 1120 }, { x: 420, y: 460, w: 850, h: 620 }, { x: 4930, y: 3060, w: 930, h: 700 });
      const river = { id: 'river-0', width: 250, flowX: 48, flowY: 8 };
      this.terrain.rivers.push(river);
      [1050, 3200, 5350].forEach((x, i) => {
        const y = this.riverCenterAt(x);
        const bridge = { id: `bridge-${i}`, x: x - 105, y: y - river.width / 2 - 24, w: 210, h: river.width + 48, hp: 760, maxHp: 760, destroyed: false };
        this.terrain.bridges.push(bridge);
        this.walls.push({ ...bridge, type: 'bridge', ttl: Infinity, nonBlocking: true });
      });
      const compounds = [
        [300,1250,760,540],[1370,250,900,590],[4050,280,930,630],[5160,1120,810,620],
        [450,2820,980,720],[1760,3060,900,700],[3940,3000,790,690],[5200,350,760,490]
      ];
      compounds.forEach((v,i)=>this.addBuildingCompound(...v,`building-${i}`));
      const forestSpecs = [[90,80,980,360],[120,3800,1300,480],[1500,1180,800,620],[3650,850,1020,500],[4820,2250,1300,560],[2860,3740,1250,540]];
      forestSpecs.forEach((f,i)=>{
        const zone={id:`forest-${i}`,x:f[0],y:f[1],w:f[2],h:f[3]}; this.terrain.forests.push(zone);
        const count=Math.floor(f[2]*f[3]/18500);
        for(let j=0;j<count;j++){ const size=rand(22,42); this.walls.push({id:`tree-${i}-${j}`,x:rand(zone.x,zone.x+zone.w-size),y:rand(zone.y,zone.y+zone.h-size),w:size,h:size,type:'tree',hp:75,maxHp:75,ttl:Infinity}); }
      });
      const facilityTypes=['barricade','trap','turret'];
      for(let i=0;i<15;i++){
        const road=choose(this.terrain.roads); const horizontal=road.w>road.h;
        const x=horizontal?rand(road.x+120,road.x+road.w-120):rand(road.x+25,road.x+road.w-25);
        const y=horizontal?rand(road.y+25,road.y+road.h-25):rand(road.y+120,road.y+road.h-120);
        const type=facilityTypes[i%facilityTypes.length];
        this.installations.push({id:`facility-${i}`,type,x,y,radius:24,hp:type==='barricade'?260:190,maxHp:type==='barricade'?260:190,active:false,team:null,work:0,cooldown:0,activeTimer:0,respawnTimer:0,destroyedLogged:false});
      }
      for(const wall of this.walls){
        if(['tree','buildingWall','bridge'].includes(wall.type)){
          wall.respawnable=true;
          wall.respawnDelay=wall.type==='tree'?[32,52]:wall.type==='bridge'?[75,105]:[58,88];
        }
      }
      this.generateLightSources();
      for (let i = 0; i < BASE_PICKUP_COUNT; i++) this.pickups.push(this.makePickup());
      this.pickupStats.baseSpawned = BASE_PICKUP_COUNT;
      this.pickupStats.peakTotal = this.pickups.length;
    }

    generateLightSources(){
      const points=[];
      const add=(x,y)=>{
        if(x<60||y<60||x>this.world.w-60||y>this.world.h-60) return;
        if(points.some(p=>Math.hypot(p.x-x,p.y-y)<260)) return;
        points.push({x,y});
      };
      for(const road of this.terrain.roads){
        if(road.w>road.h){ for(let x=road.x+260;x<road.x+road.w-180;x+=620) add(x,road.y+road.h*.25); }
        else { for(let y=road.y+260;y<road.y+road.h-180;y+=620) add(road.x+road.w*.72,y); }
      }
      for(const plaza of this.terrain.plazas){ add(plaza.x+70,plaza.y+70); add(plaza.x+plaza.w-70,plaza.y+plaza.h-70); }
      this.lightSources=points.slice(0,34).map((p,i)=>({id:`light-${i}`,x:p.x,y:p.y,radius:15,hp:95,maxHp:95,lightRadius:255+(i%3)*25,respawnTimer:0,destroyedLogged:false}));
    }

    updateLightSources(dt){
      for(let i=this.lightSources.length-1;i>=0;i--){
        const light=this.lightSources[i];
        if(light.temporary){
          light.ttl-=dt;
          if(light.ttl<=0){this.lightSources.splice(i,1);continue;}
          if(light.hp<=0){this.lightSources.splice(i,1);continue;}
          continue;
        }
        if(light.hp>0) continue;
        if(!light.destroyedLogged){ light.destroyedLogged=true; light.respawnTimer=rand(38,62); this.lifecycleStats.lightsDestroyed += 1; this.logEvent('light_destroyed',light.id); }
        light.respawnTimer-=dt;
        if(light.respawnTimer<=0){ light.hp=light.maxHp; light.respawnTimer=0; light.destroyedLogged=false; this.lifecycleStats.lightsRespawned += 1; this.logEvent('light_respawn',light.id); }
      }
    }

    updateGasFields(dt){
      if(this.mapId!=='desert') return;
      for(const gas of this.terrain.gasFields){
        if(gas.active) continue;
        gas.cooldown=Math.max(0,(gas.cooldown||0)-dt);
        if(gas.cooldown<=0){ gas.active=true; this.logEvent('gas_field_restore',gas.id,false); }
      }
    }

    igniteGasField(gas, ownerId, team){
      if(!gas||!gas.active) return;
      gas.active=false; gas.cooldown=rand(38,58);
      this.lifecycleStats.gasExplosions += 1;
      this.logEvent('gas_field_explosion',gas.id);
      this.effects.push({type:'gasBurst',x:gas.x,y:gas.y,radius:360,ttl:.85,maxTtl:.85});
      this.explode(gas.x,gas.y,360,175,ownerId,team,null,'ガス田爆発',{sourceKey:'gasFieldExplosion',gasChain:true});
    }

    riverCenterAt(x) { return 1130 + Math.sin(x / 670) * 210 + Math.sin(x / 210) * 55; }

    addBuildingCompound(x, y, w, h, id) {
      const wall=28, gap=Math.min(150,w*.2);
      this.terrain.buildings.push({id,x,y,w,h});
      const parts=[
        {x,y,w:w*.45-gap/2,h:wall},{x:x+w*.55+gap/2,y,w:w*.45-gap/2,h:wall},
        {x,y:y+h-wall,w:w*.38,h:wall},{x:x+w*.38+gap,y:y+h-wall,w:w*.62-gap,h:wall},
        {x,y,w:wall,h:h*.52},{x,y:y+h*.65,w:wall,h:h*.35},
        {x:x+w-wall,y,w:wall,h:h*.36},{x:x+w-wall,y:y+h*.49,w:wall,h:h*.51}
      ];
      parts.forEach((r,i)=>this.walls.push({...r,id:`${id}-wall-${i}`,type:'buildingWall',hp:340,maxHp:340,ttl:Infinity}));
      this.walls.push({id:`${id}-core`,x:x+w*.38,y:y+h*.25,w:wall,h:h*.45,type:'buildingWall',hp:280,maxHp:280,ttl:Infinity});
    }

    isPointInRect(x,y,r){ return x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h; }
    isOnActiveBridge(x,y){ return this.terrain.bridges.some(b=>{ const wall=this.walls.find(w=>w.id===b.id); return wall&&wall.hp>0&&this.isPointInRect(x,y,b); }); }
    isInRiver(x,y){ const river=this.terrain.rivers[0]; return Boolean(river)&&Math.abs(y-this.riverCenterAt(x))<river.width/2&&!this.isOnActiveBridge(x,y); }
    makePickup(x = rand(50, this.world.w - 50), y = rand(50, this.world.h - 50), value = rand(1.5, 4), options = {}) {
      const temporary = Boolean(options.temporary);
      return {
        id: `pickup-${performance.now()}-${Math.random()}`,
        x, y, radius: 3 + value * 0.55, value, pulse: rand(0, TAU), active: true, respawn: 0,
        temporary, kind: options.support ? 'support' : temporary ? 'bailout' : 'base',
        ttl: temporary ? (options.ttl || rand(12, 15)) : Infinity,
        scoreValue: temporary ? 0 : 1,
        team: Number.isInteger(options.team) ? options.team : null,
        support: Boolean(options.support),
      };
    }

    spawnOnlineCombatants() {
      this.players.length = 0;
      const roster = Array.isArray(this.onlineSession?.roster) ? this.onlineSession.roster : [];
      const combatants = roster.filter((member) => member.role === 'combatant');
      const maxRosterTeam = roster.reduce((max, member) => Math.max(max, Number(member.team || 0)), 0);
      if (this.config.mode === 'team') {
        this.teamCount = clamp(Math.max(this.teamCount || 2, maxRosterTeam + 1), 2, 4);
        this.teamScores = new Array(this.teamCount).fill(0);
      }
      const metaCount = this.config.mode === 'team' ? this.teamCount : this.isDefenseMode ? 1 : Math.max(1, combatants.length);
      this.teamMeta = [];
      for (let team = 0; team < metaCount; team++) {
        const representative = roster.find((member) => Number(member.team || 0) === team);
        const cfg = representative?.playerConfig?.teamConfig || {};
        const preset = EMBLEM_PRESETS[team % EMBLEM_PRESETS.length];
        this.teamMeta.push({
          name: cfg.squadName || (team === 0 ? this.config.teamConfig?.squadName : GENERIC_SQUAD_NAMES[(team + 1) % GENERIC_SQUAD_NAMES.length]) || GENERIC_SQUAD_NAMES[team % GENERIC_SQUAD_NAMES.length],
          emblemPixels: cfg.emblemPixels || emblemToString(makeEmblemPreset(preset)),
        });
      }
      const local = roster.find((member) => member.userId === this.localOnlineUserId) || { role: this.playerRole, team: this.playerTeam };
      this.playerRole = local.role || this.playerRole;
      this.playerTeam = this.isDefenseMode ? 0 : Number(local.team || 0);
      this.isPlayerCombatant = this.playerRole === 'combatant';
      this.isPlayerOperator = (this.config.mode === 'team' || this.isDefenseMode) && this.playerRole === 'operator';
      this.isSetupSpectator = this.playerRole === 'spectator';
      this.spectating = this.isSetupSpectator;
      this.playerProfile = null;
      this.human = null;

      for (const member of combatants) {
        const pc = member.playerConfig || {};
        const stats = pc.stats && Object.values(pc.stats).reduce((sum, value) => sum + Number(value || 0), 0) === 18 ? pc.stats : { trion: 6, technique: 6, combat: 6 };
        const loadout = pc.loadout?.main?.length === 4 && pc.loadout?.sub?.length === 4 ? { main: [...pc.loadout.main], sub: [...pc.loadout.sub] } : { main: [...DATA.defaultLoadout.main], sub: [...DATA.defaultLoadout.sub] };
        const appearance = { ...createDefaultTeamConfig(), ...(pc.teamConfig || {}) };
        if (this.config.mode === 'team' || this.isDefenseMode) appearance.bodyColor = appearance.bodyColor || TEAM_COLORS[Number(member.team || 0)];
        const isLocal = member.userId === this.localOnlineUserId;
        const team = this.isDefenseMode ? 0 : Number(member.team || 0);
        const player = this.createPlayer({
          id: `online-${member.userId}`,
          name: member.displayName || appearance.playerName || '隊員',
          human: isLocal,
          team,
          stats,
          loadout,
          archetype: 'オンライン隊員',
          appearance,
          squadName: appearance.squadName || this.teamMeta[team]?.name || '無所属隊',
          emblemPixels: appearance.emblemPixels || this.teamMeta[team]?.emblemPixels || null,
        });
        player.onlineUserId = member.userId;
        player.remoteControlled = this.isOnlineHost && !isLocal;
        player.onlineLastInputSeq = -1;
        this.players.push(player);
        if (isLocal) {
          this.human = player;
          this.playerProfile = { name:player.name,team,role:'combatant',stats:{...stats},loadout:{main:[...loadout.main],sub:[...loadout.sub]},appearance:{...appearance},squadName:player.squadName,emblemPixels:player.emblemPixels };
        }
      }

      this.operators = (this.config.mode === 'team' || this.isDefenseMode) ? this.teamMeta.map((meta, team) => {
        const onlineOperator = roster.find((member) => member.role === 'operator' && (this.isDefenseMode || Number(member.team || 0) === team));
        return { id:`operator-${team}`, name:`${meta.name} OPERATOR`, team, orders:0, playerControlled:Boolean(onlineOperator && onlineOperator.userId === this.localOnlineUserId), onlineUserId:onlineOperator?.userId || null };
      }) : [];

      let cpuSerial = 0;
      const configuredCpus = Array.isArray(this.config.cpuConfigs) ? this.config.cpuConfigs : [];
      const addCpu = (team) => {
        const template = DATA.aiLoadouts[cpuSerial % DATA.aiLoadouts.length];
        const fallback = makeCpuConfig(cpuSerial);
        const cfg = { ...fallback, ...(configuredCpus[cpuSerial] || {}) };
        const stats = cfg.stats && Object.values(cfg.stats).reduce((sum, value) => sum + Number(value || 0), 0) === 18 ? cfg.stats : fallback.stats;
        const loadout = {
          main: Array.isArray(cfg.main) && cfg.main.length === 4 ? [...cfg.main] : [...template.main],
          sub: Array.isArray(cfg.sub) && cfg.sub.length === 4 ? [...cfg.sub] : [...template.sub],
        };
        const appearance = { ...randomCpuAppearance(cpuSerial, team), ...(cfg.appearance || {}), bodyColor: TEAM_COLORS[team % TEAM_COLORS.length] };
        const squadName = this.config.mode === 'solo' ? (cfg.squadName || GENERIC_SQUAD_NAMES[cpuSerial % GENERIC_SQUAD_NAMES.length]) : (this.teamMeta[team]?.name || cfg.squadName);
        const emblemPixels = this.config.mode === 'solo' ? (appearance.emblemPixels || emblemToString(makeEmblemPreset(appearance.emblemPreset || 'cube'))) : (this.teamMeta[team]?.emblemPixels || appearance.emblemPixels);
        const player = this.createPlayer({ id:`cpu-online-${team}-${cpuSerial}`, name:cfg.name, human:false, team, stats, loadout, archetype:cfg.archetype || template.name, appearance, squadName, emblemPixels });
        this.players.push(player); cpuSerial++;
      };
      if (this.config.mode === 'team') {
        const targetSize = Math.max(1, Math.min(4, Number(this.config.teamSize || 3)));
        this.config.teamSize = targetSize;
        for (let team = 0; team < this.teamCount; team++) {
          const current = combatants.filter((member) => Number(member.team || 0) === team).length;
          for (let i = current; i < targetSize; i++) addCpu(team);
        }
      } else if (this.isDefenseMode) {
        const targetSize = Math.max(1, Math.min(4, Number(this.config.teamSize || 3)));
        this.config.teamSize = targetSize;
        const current = combatants.length;
        for (let i = current; i < targetSize; i++) addCpu(0);
      } else {
        const targetTotal = Math.max(combatants.length, Math.max(2, Number(this.config.cpuCount ?? 11) + 1));
        for (let i = combatants.length; i < targetTotal; i++) addCpu(i + 1);
      }
      if (this.isOnlineHost) this.logEvent('online_cpu_fill', `オンライン参加 ${combatants.length}人 / CPU補充 ${cpuSerial}人`);

      this.placeInitialPlayers();
      if (this.isDefenseMode) this.initializeDefenseMode();
    }

    spawnCombatants() {
      if (this.isOnlineMatch) return this.spawnOnlineCombatants();
      this.players.length = 0;
      const teamCfg = { ...createDefaultTeamConfig(), ...(this.config.teamConfig || {}) };
      const count = this.config.mode === 'team' ? this.teamCount : this.isDefenseMode ? 1 : 0;
      this.teamMeta = [];
      for (let team = 0; team < count; team++) {
        const preset = EMBLEM_PRESETS[team % EMBLEM_PRESETS.length];
        this.teamMeta.push({
          name: team === 0 ? (teamCfg.squadName || '蒼迅隊') : GENERIC_SQUAD_NAMES[(team + 1) % GENERIC_SQUAD_NAMES.length],
          emblemPixels: team === 0 ? (teamCfg.emblemPixels || emblemToString(makeEmblemPreset('cube'))) : emblemToString(makeEmblemPreset(preset)),
        });
      }

      this.playerProfile = {
        name: teamCfg.playerName || 'YOU',
        team: this.playerTeam,
        role: this.playerRole,
        stats: { ...this.config.stats },
        loadout: { main: [...this.config.loadout.main], sub: [...this.config.loadout.sub] },
        appearance: { ...teamCfg },
        squadName: teamCfg.squadName,
        emblemPixels: teamCfg.emblemPixels,
      };
      this.human = this.isPlayerCombatant ? this.createPlayer({
        id: 'human',
        name: this.playerProfile.name,
        human: true,
        team: this.playerTeam,
        stats: this.config.stats,
        loadout: this.config.loadout,
        appearance: teamCfg,
        squadName: teamCfg.squadName,
        emblemPixels: teamCfg.emblemPixels,
        archetype: 'プレイヤー',
      }) : null;
      if (this.human) this.players.push(this.human);

      this.operators = (this.config.mode === 'team' || this.isDefenseMode)
        ? this.teamMeta.map((meta, team) => ({
            id: `operator-${team}`,
            name: `${meta.name} OPERATOR`,
            team,
            orders: 0,
            playerControlled: this.isPlayerOperator && team === this.playerTeam,
          }))
        : [];

      const configs = Array.isArray(this.config.cpuConfigs) ? this.config.cpuConfigs : [];
      for (let i = 0; i < this.config.cpuCount; i++) {
        const template = DATA.aiLoadouts[i % DATA.aiLoadouts.length];
        const fallback = makeCpuConfig(i);
        const cfg = { ...fallback, ...(configs[i] || {}) };
        const team = this.isDefenseMode ? 0 : this.config.mode === 'team' ? cpuTeamForIndex(i, this.config) : i + 1;
        const stats = cfg.stats && Object.values(cfg.stats).reduce((a, b) => a + Number(b || 0), 0) === 18 ? cfg.stats : this.randomStats();
        const loadout = {
          main: Array.isArray(cfg.main) && cfg.main.length === 4 ? [...cfg.main] : [...template.main],
          sub: Array.isArray(cfg.sub) && cfg.sub.length === 4 ? [...cfg.sub] : [...template.sub],
        };
        const squadName = (this.config.mode === 'team' || this.isDefenseMode)
          ? this.teamMeta[team].name
          : (cfg.squadName || GENERIC_SQUAD_NAMES[i % GENERIC_SQUAD_NAMES.length]);
        const appearance = { ...randomCpuAppearance(i, team), ...(cfg.appearance || {}) };
        if (this.config.mode === 'team' || this.isDefenseMode) appearance.bodyColor = team === 0 ? (teamCfg.bodyColor || TEAM_COLORS[0]) : TEAM_COLORS[team];
        const emblemPixels = (this.config.mode === 'team' || this.isDefenseMode)
          ? this.teamMeta[team].emblemPixels
          : (appearance.emblemPixels || emblemToString(makeEmblemPreset(appearance.emblemPreset || 'cube')));
        this.players.push(this.createPlayer({
          id: `cpu-${i}`,
          name: cfg.name || CPU_NAMES[i] || `CPU-${i + 1}`,
          human: false,
          team,
          stats,
          loadout,
          archetype: cfg.archetype || template.name,
          appearance,
          squadName,
          emblemPixels,
        }));
      }
      this.placeInitialPlayers();
      if (this.isDefenseMode) this.initializeDefenseMode();
    }


    initializeDefenseMode() {
      const home = this.getTeamHome(0);
      this.walls = this.walls.filter((wall) => Math.hypot((wall.x + wall.w / 2) - home.x, (wall.y + wall.h / 2) - home.y) > 260);
      this.installations = this.installations.filter((facility) => Math.hypot(facility.x - home.x, facility.y - home.y) > 230);
      const teamSize = this.config.teamSize || 3;
      const maxHp = 2200 + teamSize * 520;
      this.defenseFlag = { x: home.x, y: home.y, radius: 46, maxHp, hp: maxHp, pulse: 0, lastDamageAt: -999, repaired: 0, armor: .22 };
      this.defenseBuildMaxPoints = 150 + teamSize * 18;
      this.defenseBuildPoints = this.defenseBuildMaxPoints;
      this.defenseBuildCooldowns = { barrier: 0, trap: 0, turret: 0, decoy: 0 };
      this.defenseBuildSerial = 0;
      this.defenseNpcBuildTimer = 3;
      this.defenseBuildStats = { barrier: 0, trap: 0, turret: 0, decoy: 0 };
      const defenders = this.players.filter((player) => !player.isDefenseEnemy);
      defenders.forEach((player, index) => {
        const angle = index / Math.max(1, defenders.length) * TAU;
        player.x = home.x + Math.cos(angle) * 150;
        player.y = home.y + Math.sin(angle) * 150;
        player.spawnHistory[player.spawnHistory.length - 1] = { time: 0, x: Number(player.x.toFixed(1)), y: Number(player.y.toFixed(1)), initial: true };
      });
      this.defenseRound = 0;
      this.defenseTier = 0;
      this.defenseWaveActive = false;
      this.defenseRoundTimer = 5;
      this.deployDefenseBuild('barrier', null, 0, { free: true, silent: true, ignoreCooldown: true });
      this.deployDefenseBuild('barrier', null, 0, { free: true, silent: true, ignoreCooldown: true });
      this.deployDefenseBuild('trap', null, 0, { free: true, silent: true, ignoreCooldown: true });
      this.defenseBuildCooldowns = { barrier: 0, trap: 0, turret: 0, decoy: 0 };
      this.updateDefenseHud();
      $('#defenseHud')?.classList.remove('hidden');
      $('#teamScoreCard')?.classList.add('hidden');
      this.logEvent('defense_ready', `防衛フラッグ耐久 ${maxHp}`);
    }

    getDefenseSpawnPoint(index = 0, total = 1) {
      const flag = this.defenseFlag || this.getTeamHome(0);
      for (let attempt = 0; attempt < 60; attempt++) {
        const angle = (index / Math.max(1, total)) * TAU + rand(-.35, .35) + attempt * .17;
        const radius = rand(1350, 2100);
        const point = {
          x: clamp(flag.x + Math.cos(angle) * radius, 90, this.world.w - 90),
          y: clamp(flag.y + Math.sin(angle) * radius, 90, this.world.h - 90),
          radius: 60,
        };
        if (this.isInRiver(point.x, point.y)) continue;
        if (this.walls.some((wall) => wall.hp > 0 && !wall.nonBlocking && circleRectOverlap(point, wall))) continue;
        return point;
      }
      return this.randomOpenPoint(null);
    }

    createDefenseEnemy(type, index = 0, total = 1) {
      const tier = this.defenseTier;
      const hpScale = 1 + tier * .22;
      const damageScale = 1 + tier * .14;
      const speedScale = 1 + Math.min(.2, tier * .035);
      const definitions = {
        marmod: { name: 'モールモッド', hp: 112, speed: 184, radius: 24, damage: 16, color: '#c8c9c7', archetype: '戦闘用トリオン兵' },
        ilgar: { name: 'イルガー', hp: 395, speed: 82, radius: 58, damage: 19, color: '#e2bd38', archetype: '爆撃用トリオン兵', flying: true },
        rabbit: { name: 'ラービット', hp: 485, speed: 114, radius: 33, damage: 25, color: '#f2f3ef', archetype: '捕獲用トリオン兵' },
        fujin: { name: '風刃', hp: 1650, speed: 137, radius: 27, damage: 35, color: '#39d57a', archetype: 'ブラックトリガー', boss: true },
        seals: { name: '印', hp: 1780, speed: 151, radius: 27, damage: 32, color: '#d7d7df', archetype: 'ブラックトリガー', boss: true },
        alektor: { name: 'アレクトール', hp: 1920, speed: 116, radius: 29, damage: 29, color: '#b4e2a0', archetype: 'ブラックトリガー', boss: true },
        borboros: { name: 'ボルボロス', hp: 1840, speed: 139, radius: 29, damage: 33, color: '#a37ad7', archetype: 'ブラックトリガー', boss: true },
        organon: { name: 'オルガノン', hp: 2150, speed: 101, radius: 29, damage: 39, color: '#d3c9a8', archetype: 'ブラックトリガー', boss: true },
      };
      const def = definitions[type] || definitions.marmod;
      const enemy = this.createPlayer({
        id: `defense-enemy-${++this.defenseEnemySerial}`,
        name: def.name,
        human: false,
        team: 1,
        stats: { trion: 6, technique: 6, combat: 6 },
        loadout: { main: ['empty', 'empty', 'empty', 'empty'], sub: ['empty', 'empty', 'empty', 'empty'] },
        archetype: def.archetype,
        appearance: { bodyColor: def.color },
        squadName: '近界侵攻群',
        emblemPixels: emblemToString(makeEmblemPreset('fang')),
      });
      const point = this.getDefenseSpawnPoint(index, total);
      enemy.x = point.x; enemy.y = point.y;
      enemy.isDefenseEnemy = true;
      enemy.defenseType = type;
      enemy.isDefenseBoss = Boolean(def.boss);
      enemy.maxHp = Math.round(def.hp * hpScale * (def.boss ? 1 + tier * .07 : 1));
      enemy.hp = enemy.maxHp;
      enemy.maxTrion = 0; enemy.trion = 0; enemy.regen = 0;
      enemy.speed = def.speed * speedScale;
      enemy.radius = def.radius;
      enemy.invulnTimer = .65;
      enemy.flying = Boolean(def.flying);
      enemy.defenseAI = {
        attackCooldown: rand(.5, 1.4), specialCooldown: rand(1.5, 3.2), phaseTimer: 3.5,
        phase: type === 'borboros' ? 'solid' : 'normal', selfDestruct: false, selfDestructTimer: 0,
        rearBurstCooldown: 0, shieldTimer: 0, sealCount: 0, damage: def.damage * damageScale,
        objectiveMode: (def.boss || index % 3 === 0 || (type === 'ilgar' && index % 2 === 0))
          ? 'flag'
          : (Math.random() < (type === 'rabbit' ? .46 : .68) ? 'flag' : 'defender'),
        objectiveTimer: rand(2.4, 5.2), flagAttacks: 0,
      };
      enemy.respawnTimer = Infinity;
      enemy.scoreValue = def.boss ? 1000 : type === 'rabbit' ? 220 : type === 'ilgar' ? 180 : 100;
      this.players.push(enemy);
      return enemy;
    }

    startDefenseRound() {
      this.defenseRound += 1;
      this.defenseTier = Math.floor(this.defenseRound / 5);
      const isBossRound = this.defenseRound % 5 === 0;
      if (isBossRound) {
        const bosses = ['fujin', 'seals', 'alektor', 'borboros', 'organon'];
        const type = bosses[(Math.floor(this.defenseRound / 5) - 1) % bosses.length];
        this.createDefenseEnemy(type, 0, 1);
        this.showCenterMessage(`ROUND ${this.defenseRound}`, `BLACK TRIGGER：${this.players[this.players.length - 1].name}`, 2.8);
        this.logEvent('defense_boss_round', `Round ${this.defenseRound} / ${this.players[this.players.length - 1].name}`);
      } else {
        const teamSize = this.config.teamSize || 3;
        const count = Math.min(14, 1 + teamSize + Math.floor(this.defenseRound * .55));
        for (let i = 0; i < count; i++) {
          const roll = Math.random();
          let type = 'marmod';
          if (this.defenseRound >= 4 && roll > .84) type = 'rabbit';
          else if (this.defenseRound >= 2 && roll > .67) type = 'ilgar';
          this.createDefenseEnemy(type, i, count);
        }
        this.showCenterMessage(`ROUND ${this.defenseRound}`, `侵攻群 ${count}体`, 2.1);
        this.logEvent('defense_round', `Round ${this.defenseRound} / enemies ${count}`);
      }
      this.defenseWaveActive = true;
      this.updateDefenseHud();
    }

    updateDefenseMode(dt) {
      if (!this.isDefenseMode || this.ended) return;
      this.updateDefenseHazards(dt);
      this.updateDefenseFlag(dt);
      for (const key of Object.keys(this.defenseBuildCooldowns)) this.defenseBuildCooldowns[key] = Math.max(0, (this.defenseBuildCooldowns[key] || 0) - dt);
      this.updateDefenseNpcConstruction(dt);
      for (let i = this.players.length - 1; i >= 0; i--) {
        const enemy = this.players[i];
        if (!enemy.isDefenseEnemy || !enemy.dead) continue;
        enemy.corpseTimer = (enemy.corpseTimer ?? .7) - dt;
        if (enemy.corpseTimer <= 0) this.players.splice(i, 1);
      }
      const aliveEnemies = this.players.filter((player) => player.isDefenseEnemy && !player.dead);
      if (this.defenseWaveActive && aliveEnemies.length === 0) {
        this.defenseWaveActive = false;
        this.defenseRoundTimer = 6;
        const defenders = this.players.filter((player) => !player.isDefenseEnemy && !player.dead);
        defenders.forEach((player) => { player.trion = Math.min(player.maxTrion, player.trion + player.maxTrion * .24); });
        if (this.defenseFlag) this.defenseFlag.hp = Math.min(this.defenseFlag.maxHp, this.defenseFlag.hp + this.defenseFlag.maxHp * .12);
        this.defenseBuildPoints = Math.min(this.defenseBuildMaxPoints, this.defenseBuildPoints + 42 + (this.config.teamSize || 3) * 6);
        this.showCenterMessage('ROUND CLEAR', '次の侵攻に備えろ', 1.7);
        this.logEvent('defense_round_clear', `Round ${this.defenseRound}`);
      }
      if (!this.defenseWaveActive) {
        this.defenseRoundTimer -= dt;
        if (this.defenseRoundTimer <= 0) this.startDefenseRound();
      }
      this.updateDefenseHud();
    }

    updateDefenseFlag(dt) {
      const flag = this.defenseFlag;
      if (!flag || flag.hp <= 0) return;
      flag.pulse += dt * 3;
      if (this.elapsed - flag.lastDamageAt > 7 && flag.hp < flag.maxHp) {
        const passive = 5.5 + flag.maxHp * .00115;
        flag.hp = Math.min(flag.maxHp, flag.hp + passive * dt);
      }
      if (this.input.consume('KeyF')) this.flagChannelTimer = 1.15;
      this.flagChannelTimer = Math.max(0, this.flagChannelTimer - dt);
      const defenders = this.players.filter((player) => !player.isDefenseEnemy && !player.dead);
      for (const player of defenders) {
        const near = Math.hypot(player.x - flag.x, player.y - flag.y) <= flag.radius + player.radius + 55;
        const hostileNear = this.players.some((enemy) => enemy.isDefenseEnemy && !enemy.dead && Math.hypot(enemy.x - flag.x, enemy.y - flag.y) < 300);
        let channel = false;
        if (player.human) channel = near && (this.input.isDown('KeyF') || this.flagChannelTimer > 0);
        else channel = near && !hostileNear && flag.hp < flag.maxHp * .68 && player.trion > player.maxTrion * .55;
        if (!channel || player.trion <= 2 || flag.hp >= flag.maxHp) continue;
        const cost = Math.min(player.trion, (player.human ? 17 : 10) * dt);
        const healing = cost * (player.human ? 2.9 : 2.25);
        player.trion -= cost;
        player.metrics.trionSpent += cost;
        flag.hp = Math.min(flag.maxHp, flag.hp + healing);
        flag.repaired += healing;
        this.effects.push({ type: 'flagHeal', x: flag.x + rand(-20, 20), y: flag.y + rand(-20, 20), ttl: .35, maxTtl: .35 });
      }
    }

    damageDefenseFlag(amount, source = null, name = '敵攻撃') {
      const flag = this.defenseFlag;
      if (!this.isDefenseMode || !flag || flag.hp <= 0 || amount <= 0) return;
      const mitigated = amount * (1 - clamp(flag.armor || 0, 0, .55));
      flag.hp = Math.max(0, flag.hp - mitigated);
      flag.lastDamageAt = this.elapsed;
      if (source?.defenseAI) source.defenseAI.flagAttacks = (source.defenseAI.flagAttacks || 0) + 1;
      this.sfx?.play('explosion', { x: flag.x, y: flag.y, bucket: 'flag-hit', cooldown: .13, volume: .38, rate: 1.12 });
      this.effects.push({ type: 'flagHit', x: flag.x, y: flag.y, ttl: .35, maxTtl: .35 });
      this.logEvent('flag_damage', `${name} / ${Math.round(mitigated)} damage / ${Math.round(flag.hp)} HP`, false);
      if (flag.hp <= 0) this.endDefenseMatch();
    }

    updateDefenseHud() {
      if (!this.isDefenseMode) return;
      const flag = this.defenseFlag;
      $('#defenseRoundLabel').textContent = String(Math.max(1, this.defenseRound || 1));
      $('#defenseFlagLabel').textContent = flag ? `${Math.ceil(flag.hp / flag.maxHp * 100)}%` : '---';
      $('#modeLabel').textContent = '防衛戦';
      $('#timerLabel').textContent = this.defenseWaveActive ? `R${Math.max(1, this.defenseRound)}` : `NEXT ${Math.max(0, Math.ceil(this.defenseRoundTimer))}`;
      this.updateDefenseBuildUi();
    }

    getDefenseBuildActiveCount(type) {
      if (type === 'barrier') return new Set(this.walls.filter((wall) => wall.defenseBuildType === 'barrier' && wall.hp > 0 && wall.ttl > 0).map((wall) => wall.defenseBuildGroup || wall.id)).size;
      if (type === 'decoy') return this.beacons.filter((beacon) => beacon.defenseDecoy && beacon.hp > 0 && beacon.ttl > 0).length;
      return this.installations.filter((facility) => facility.defenseBuildType === type && facility.hp > 0 && facility.active).length;
    }

    findDefenseBuildPoint(type) {
      const flag = this.defenseFlag;
      if (!flag) return null;
      const radiusByType = { barrier: 160, trap: 215, turret: 255, decoy: 190 };
      const ring = radiusByType[type] || 200;
      const base = this.defenseBuildSerial * 2.399963229728653;
      for (let attempt = 0; attempt < 30; attempt++) {
        const angle = base + attempt * .47;
        const radius = ring + ((attempt % 3) - 1) * 28;
        const point = { x: flag.x + Math.cos(angle) * radius, y: flag.y + Math.sin(angle) * radius, angle };
        if (point.x < 80 || point.y < 80 || point.x > this.world.w - 80 || point.y > this.world.h - 80) continue;
        if (this.isInRiver(point.x, point.y)) continue;
        if (this.walls.some((wall) => wall.hp > 0 && Math.hypot(wall.x + wall.w / 2 - point.x, wall.y + wall.h / 2 - point.y) < 82)) continue;
        if (this.installations.some((facility) => facility.hp > 0 && Math.hypot(facility.x - point.x, facility.y - point.y) < 86)) continue;
        if (this.beacons.some((beacon) => beacon.hp > 0 && Math.hypot(beacon.x - point.x, beacon.y - point.y) < 58)) continue;
        return point;
      }
      return null;
    }

    deployDefenseBuild(type, builder = null, team = 0, options = {}) {
      const def = DEFENSE_BUILD_DEFS[type];
      if (!this.isDefenseMode || !this.defenseFlag || !def || team !== 0) return false;
      if (this.onlineMirror && !options.remote) {
        window.trionOnline?.broadcast('player_action', { action: 'defense_build', buildType: type });
        this.toast(`${def.label}の展開を要請しました`);
        return true;
      }
      if (!options.ignoreCooldown && (this.defenseBuildCooldowns[type] || 0) > 0) { if (!options.silent) this.toast(`${def.label}は準備中です`); return false; }
      if (this.getDefenseBuildActiveCount(type) >= def.maxActive) { if (!options.silent) this.toast(`${def.label}は上限です`); return false; }
      if (!options.free && this.defenseBuildPoints < def.cost) { if (!options.silent) this.toast('防衛資材が足りません'); return false; }
      const point = this.findDefenseBuildPoint(type);
      if (!point) { if (!options.silent) this.toast('フラッグ周辺に設置場所がありません'); return false; }
      const id = `flag-build-${type}-${++this.defenseBuildSerial}-${Math.round(this.elapsed * 10)}`;
      if (type === 'barrier') {
        const vertical = Math.abs(Math.cos(point.angle)) > Math.abs(Math.sin(point.angle));
        for (let i = -1; i <= 1; i++) {
          const w = vertical ? 28 : 58, h = vertical ? 58 : 28;
          this.walls.push({
            id: `${id}-${i}`, x: point.x - w / 2 + (vertical ? 0 : i * 56), y: point.y - h / 2 + (vertical ? i * 56 : 0),
            w, h, type: 'barricade', defenseBuildType: 'barrier', defenseBuildGroup: id, hp: 245, maxHp: 245, ttl: def.ttl, team: 0, respawnable: false,
          });
        }
      } else if (type === 'decoy') {
        this.beacons.push({ id, x: point.x, y: point.y, vx: rand(-9, 9), vy: rand(-9, 9), radius: 18, team: 0, ownerId: builder?.id || 'defense-command', ttl: def.ttl, hp: 105, maxHp: 105, createdAt: this.elapsed, exposedTeams: {}, defenseDecoy: true });
      } else {
        const hp = type === 'turret' ? 280 : 205;
        this.installations.push({ id, type, defenseBuildType: type, x: point.x, y: point.y, radius: 24, hp, maxHp: hp, active: true, team: 0, work: 0, cooldown: 0, activeTimer: def.ttl, ttl: def.ttl, temporary: true, destroyedLogged: false });
      }
      if (!options.free) this.defenseBuildPoints = Math.max(0, this.defenseBuildPoints - def.cost);
      if (!options.ignoreCooldown) this.defenseBuildCooldowns[type] = def.cooldown;
      this.defenseBuildStats[type] = (this.defenseBuildStats[type] || 0) + 1;
      this.effects.push({ type: 'flagHeal', x: point.x, y: point.y, ttl: .55, maxTtl: .55 });
      if (!options.silent) this.toast(`${def.label}をフラッグ周辺へ展開`);
      this.logEvent('defense_build', `${builder?.name || (options.role === 'operator' ? 'OPERATOR' : '防衛隊')}：${def.label}`, false);
      return true;
    }

    requestDefenseBuild(type) {
      if (!this.isDefenseMode || this.ended || this.spectating || this.playerRole === 'spectator') return;
      const builder = this.isPlayerCombatant ? this.human : null;
      this.deployDefenseBuild(type, builder, this.playerTeam, { role: this.playerRole });
    }

    updateDefenseBuildUi() {
      const panel = $('#defenseBuildPanel');
      if (!panel) return;
      const available = this.isDefenseMode && this.playerRole !== 'spectator' && !this.spectating;
      panel.classList.toggle('hidden', !this.isDefenseMode);
      panel.classList.toggle('read-only', !available);
      const resource = $('#defenseBuildResource');
      if (resource) resource.textContent = `${Math.floor(this.defenseBuildPoints)} / ${Math.floor(this.defenseBuildMaxPoints)}`;
      $$('#defenseBuildPanel [data-defense-build]').forEach((button) => {
        const type = button.dataset.defenseBuild;
        const def = DEFENSE_BUILD_DEFS[type];
        const cooldown = Math.max(0, this.defenseBuildCooldowns[type] || 0);
        const count = this.getDefenseBuildActiveCount(type);
        button.disabled = !available || cooldown > 0 || this.defenseBuildPoints < def.cost || count >= def.maxActive;
        const small = button.querySelector('small');
        if (small) small.textContent = cooldown > 0 ? `${cooldown.toFixed(1)}秒` : `${def.cost}資材・${count}/${def.maxActive}`;
      });
    }

    updateDefenseNpcConstruction(dt) {
      if (!this.isDefenseMode || this.onlineMirror || this.ended) return;
      this.defenseNpcBuildTimer -= dt;
      if (this.defenseNpcBuildTimer > 0) return;
      this.defenseNpcBuildTimer = this.defenseWaveActive ? rand(7, 11) : rand(2.6, 4.4);
      if (this.defenseBuildPoints < 62) return;
      const enemiesNear = this.players.some((enemy) => enemy.isDefenseEnemy && !enemy.dead && Math.hypot(enemy.x - this.defenseFlag.x, enemy.y - this.defenseFlag.y) < 520);
      if (enemiesNear) return;
      const desired = [
        ['barrier', 4], ['trap', 2], ['turret', 2], ['decoy', 1],
      ].find(([type, wanted]) => this.getDefenseBuildActiveCount(type) < wanted && (this.defenseBuildCooldowns[type] || 0) <= 0);
      if (!desired) return;
      const builder = this.players.filter((unit) => !unit.isDefenseEnemy && !unit.dead && !unit.human).sort((a, b) => Math.hypot(a.x - this.defenseFlag.x, a.y - this.defenseFlag.y) - Math.hypot(b.x - this.defenseFlag.x, b.y - this.defenseFlag.y))[0] || null;
      this.deployDefenseBuild(desired[0], builder, 0, { silent: true });
    }

    selectDefenseObjective(enemy, defenders, flag) {
      const ai = enemy.defenseAI || (enemy.defenseAI = {});
      const nearest = defenders.length ? [...defenders].sort((a, b) => dist2(enemy, a) - dist2(enemy, b))[0] : null;
      const decoys = this.beacons.filter((beacon) => beacon.defenseDecoy && beacon.hp > 0 && beacon.ttl > 0);
      const nearestDecoy = decoys.length ? [...decoys].sort((a, b) => dist2(enemy, a) - dist2(enemy, b))[0] : null;
      if (!flag) return nearestDecoy || nearest;
      if (!nearest && !nearestDecoy) return flag;
      const dFlag = Math.hypot(flag.x - enemy.x, flag.y - enemy.y);
      const dNearest = nearest ? Math.hypot(nearest.x - enemy.x, nearest.y - enemy.y) : Infinity;
      const dDecoy = nearestDecoy ? Math.hypot(nearestDecoy.x - enemy.x, nearestDecoy.y - enemy.y) : Infinity;
      const recentlyHit = this.elapsed - (enemy.lastDamageAt || -999) < 2.25;
      const threatRadius = enemy.defenseType === 'rabbit' ? 205 : enemy.defenseType === 'marmod' ? 170 : 225;
      if (recentlyHit && dNearest < threatRadius) { ai.objectiveMode = 'defender'; ai.objectiveTimer = Math.max(ai.objectiveTimer || 0, 1.5); return nearest; }
      if (nearestDecoy && dDecoy < 620 && (ai.objectiveMode === 'decoy' || ai.objectiveTimer <= 0) && Math.random() < (enemy.isDefenseBoss ? .35 : .68)) {
        ai.objectiveMode = 'decoy'; ai.objectiveTimer = rand(2.4, 4.8); ai.objectiveId = nearestDecoy.id;
      }
      if (ai.objectiveMode === 'decoy') {
        const selected = this.beacons.find((beacon) => beacon.id === ai.objectiveId && beacon.defenseDecoy && beacon.hp > 0 && beacon.ttl > 0);
        if (selected) return selected;
        ai.objectiveTimer = 0;
      }
      if (dFlag < 340 && !(dNearest < 120 && recentlyHit)) return flag;
      if (ai.objectiveTimer <= 0 || !['flag', 'defender', 'decoy'].includes(ai.objectiveMode)) {
        const baseBias = enemy.defenseType === 'ilgar' ? .68
          : enemy.defenseType === 'marmod' ? .60
          : enemy.defenseType === 'rabbit' ? .38
          : enemy.isDefenseBoss ? .52 : .5;
        const damagedFlagBonus = flag.hp < flag.maxHp * .45 ? .1 : 0;
        ai.objectiveMode = Math.random() < Math.min(.82, baseBias + damagedFlagBonus) ? 'flag' : 'defender';
        ai.objectiveTimer = rand(4.2, 7.2);
      }
      if (ai.objectiveMode === 'flag') return flag;
      if (!nearest || dNearest > dFlag * 1.3) return flag;
      return nearest;
    }

    moveDefenseEnemy(enemy, target, dt, speedFactor = 1) {
      if (!target) return Infinity;
      const dx = target.x - enemy.x, dy = target.y - enemy.y;
      const d = Math.hypot(dx, dy) || 1;
      const directAngle = Math.atan2(dy, dx);
      let moveAngle = enemy.flying || !enemy.ai
        ? directAngle
        : this.getAINavigationAngle(enemy, target.x, target.y, directAngle, dt, Math.abs(speedFactor));
      if (enemy.ai) moveAngle = this.stabilizeAIMovementAngle(enemy, moveAngle, target.x, target.y, dt, Math.abs(speedFactor));
      enemy.aim = directAngle;
      enemy.vx += Math.cos(moveAngle) * enemy.speed * speedFactor * dt * 4.65;
      enemy.vy += Math.sin(moveAngle) * enemy.speed * speedFactor * dt * 4.65;
      if (enemy.ai) this.applyAISeparation(enemy, dt, true);
      return d;
    }

    tryDefenseEnemyAttackBarrier(enemy, target, dt) {
      if (!enemy?.ai || enemy.flying || !target) return false;
      const wallId = enemy.ai.wallBreakTarget;
      if (!wallId || enemy.ai.wallBreakTimer <= 0) return false;
      const wall = this.walls.find((candidate) => candidate.id === wallId && candidate.hp > 0);
      if (!wall) { enemy.ai.wallBreakTarget = null; return false; }
      const cx = wall.x + wall.w / 2, cy = wall.y + wall.h / 2;
      const reach = enemy.radius + Math.max(wall.w, wall.h) * .55 + 54;
      const distance = Math.hypot(cx - enemy.x, cy - enemy.y);
      if (distance > reach) return false;
      enemy.aim = Math.atan2(cy - enemy.y, cx - enemy.x);
      if ((enemy.defenseAI?.attackCooldown || 0) > 0) return true;
      const damage = Math.max(11, (enemy.defenseAI?.damage || 18) * (enemy.defenseType === 'rabbit' ? 1.08 : .82));
      wall.hp -= damage;
      enemy.defenseAI.attackCooldown = enemy.defenseType === 'marmod' ? .72 : enemy.defenseType === 'rabbit' ? 1.05 : 1.25;
      this.effects.push({ type: 'hit', x: cx, y: cy, ttl: .18, maxTtl: .18 });
      if (wall.hp <= 0) {
        enemy.ai.wallBreakTarget = null;
        enemy.ai.wallBreakTimer = 0;
        enemy.ai.stuckTimer = 0;
        this.effects.push({ type: 'explosion', x: cx, y: cy, radius: 52, ttl: .3, maxTtl: .3 });
      }
      return true;
    }

    updateDefenseEnemyAI(enemy, dt) {
      if (enemy.dead) return;
      const ai = enemy.defenseAI;
      ai.attackCooldown -= dt; ai.specialCooldown -= dt; ai.phaseTimer -= dt;
      ai.objectiveTimer = (ai.objectiveTimer || 0) - dt;
      ai.rearBurstCooldown = Math.max(0, ai.rearBurstCooldown - dt);
      ai.shieldTimer = Math.max(0, ai.shieldTimer - dt);
      const defenders = this.players.filter((player) => !player.isDefenseEnemy && !player.dead);
      const nearest = defenders.length ? [...defenders].sort((a, b) => dist2(enemy, a) - dist2(enemy, b))[0] : null;
      const flag = this.defenseFlag;
      const objective = this.selectDefenseObjective(enemy, defenders, flag);
      const type = enemy.defenseType;
      if (this.tryDefenseEnemyAttackBarrier(enemy, objective || flag, dt)) return;
      if (type === 'ilgar') {
        if (!ai.selfDestruct && enemy.hp <= enemy.maxHp * .34) {
          ai.selfDestruct = true; ai.selfDestructTimer = 4.6; enemy.speed *= 1.65;
          this.showCenterMessage('SELF-DESTRUCT', 'イルガーの墜落地点から離れろ', 1.3);
          this.logEvent('ilgar_self_destruct', enemy.id);
        }
        const target = ai.selfDestruct ? (defenders.length >= 2 ? { x: defenders.reduce((n, p) => n + p.x, 0) / defenders.length, y: defenders.reduce((n, p) => n + p.y, 0) / defenders.length } : flag) : (objective || flag);
        const d = this.moveDefenseEnemy(enemy, target, dt, ai.selfDestruct ? 1.3 : .8);
        if (ai.selfDestruct) {
          ai.selfDestructTimer -= dt;
          if (d < 105 || ai.selfDestructTimer <= 0) {
            this.queueDefenseHazard({ type: 'circle', x: enemy.x, y: enemy.y, radius: 235, delay: .42, damage: ai.damage * 2.55, owner: enemy, name: 'イルガー自爆', hitsFlag: true, color: '#ffd24d' });
            this.defeatDefenseEnemy(enemy, null, '自爆');
          }
        } else if (ai.attackCooldown <= 0 && target) {
          const targetingFlag = target === flag;
          const tx = targetingFlag ? flag.x : target.x + (target.vx || 0) * .45;
          const ty = targetingFlag ? flag.y : target.y + (target.vy || 0) * .45;
          this.queueDefenseHazard({ type: 'circle', x: tx, y: ty, radius: 105, delay: .8, damage: ai.damage, owner: enemy, name: 'イルガー爆撃', hitsFlag: true, color: '#e7bf35' });
          ai.attackCooldown = rand(2.7, 3.8);
        }
        return;
      }
      if (type === 'marmod') {
        const target = objective || flag;
        const d = this.moveDefenseEnemy(enemy, target, dt, 1.15);
        if (ai.attackCooldown <= 0 && d < (target === flag ? 225 : 72)) {
          if (target === flag) this.damageDefenseFlag(ai.damage, enemy, 'モールモッドのブレード');
          else if (target.defenseDecoy) this.damageDefenseDecoy(target, ai.damage * 1.2, enemy, 'モールモッドのブレード');
          else this.damagePlayer(target, ai.damage, enemy, { x: enemy.x, y: enemy.y, type: 'melee', name: 'モールモッド・ブレード', sourceKey: 'marmodBlade' });
          ai.attackCooldown = .78;
        }
        return;
      }
      if (type === 'rabbit') {
        const target = objective || flag;
        const d = this.moveDefenseEnemy(enemy, target, dt, .92);
        if (ai.attackCooldown <= 0 && d < (target === flag ? 240 : 86)) {
          if (target === flag) this.damageDefenseFlag(ai.damage * .8, enemy, 'ラービット打撃');
          else if (target.defenseDecoy) this.damageDefenseDecoy(target, ai.damage, enemy, 'ラービット打撃');
          else {
            this.damagePlayer(target, ai.damage * .55, enemy, { x: enemy.x, y: enemy.y, type: 'melee', name: 'ラービット捕獲腕', sourceKey: 'rabbitCapture' });
            target.cubedTimer = Math.max(target.cubedTimer || 0, 1.9);
            target.slowTimer = Math.max(target.slowTimer, 2.7); target.slowFactor = Math.min(target.slowFactor, .28);
            target.trion = Math.max(0, target.trion - 10);
          }
          ai.attackCooldown = 1.55;
        }
        return;
      }
      this.updateBlackTriggerAI(enemy, dt, objective, nearest, flag);
    }

    updateBlackTriggerAI(enemy, dt, objective, nearest, flag) {
      const ai = enemy.defenseAI;
      const type = enemy.defenseType;
      const target = objective || nearest || flag;
      if (type === 'fujin') {
        const currentD = target ? Math.hypot(target.x - enemy.x, target.y - enemy.y) : Infinity;
        this.moveDefenseEnemy(enemy, target, dt, currentD > 430 ? .7 : -.15);
        if (ai.specialCooldown <= 0) {
          const targets = this.players.filter((p) => !p.isDefenseEnemy && !p.dead).sort((a, b) => dist2(enemy, a) - dist2(enemy, b)).slice(0, 3 + Math.min(2, this.defenseTier));
          targets.forEach((p, index) => this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: p.x, y2: p.y, width: 30, delay: .72 + index * .1, damage: ai.damage, owner: enemy, name: '風刃・遠隔斬撃', hitsFlag: true, color: '#45ef83' }));
          if (flag) this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: flag.x, y2: flag.y, width: 24, delay: 1.05, damage: ai.damage * .75, owner: enemy, name: '風刃・伝播斬撃', hitsFlag: true, color: '#45ef83' });
          ai.specialCooldown = 3.5;
        }
        return;
      }
      if (type === 'seals') {
        this.moveDefenseEnemy(enemy, target, dt, .68);
        if (ai.specialCooldown <= 0) {
          ai.sealCount += 1;
          const combo = ai.sealCount % 4 === 0;
          const roll = irand(0, 5);
          if (target === flag && ai.sealCount % 2 === 1) this.queueDefenseHazard({ type: 'circle', x: flag.x, y: flag.y, radius: combo ? 175 : 130, delay: .62, damage: ai.damage * (combo ? .82 : .62), status: 'anchor', owner: enemy, name: combo ? '二重錨印・旗封' : '錨印・旗封', hitsFlag: true, color: '#252c35' });
          else if (roll === 0 && nearest) this.queueDefenseHazard({ type: 'circle', x: nearest.x, y: nearest.y, radius: 125, delay: .65, damage: ai.damage * .55, status: 'anchor', owner: enemy, name: combo ? '二重錨印' : '錨印', color: '#252c35' });
          else if (roll === 1) this.players.filter((p) => !p.isDefenseEnemy && !p.dead).forEach((p) => { p.revealTimer = Math.max(p.revealTimer, 6); p.markedTimer = Math.max(p.markedTimer, 4); });
          else if (roll === 2 && nearest) { enemy.x = clamp(nearest.x + rand(-180, 180), 60, this.world.w - 60); enemy.y = clamp(nearest.y + rand(-180, 180), 60, this.world.h - 60); }
          else if (roll === 3) ai.shieldTimer = combo ? 4.5 : 2.7;
          else if (roll === 4 && nearest) this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: nearest.x, y2: nearest.y, width: 38, delay: .5, damage: ai.damage * .65, status: 'chain', owner: enemy, name: '鎖印', color: '#d5d9e3' });
          else if (nearest) this.queueDefenseHazard({ type: 'circle', x: nearest.x, y: nearest.y, radius: combo ? 170 : 120, delay: .55, damage: ai.damage * .7, status: 'bounce', owner: enemy, name: combo ? '三重弾印' : '弾印', color: '#f5f5ff' });
          ai.specialCooldown = combo ? 3.9 : 2.7;
        }
        return;
      }
      if (type === 'alektor') {
        const currentD = target ? Math.hypot(target.x - enemy.x, target.y - enemy.y) : Infinity;
        this.moveDefenseEnemy(enemy, target, dt, currentD > 360 ? .55 : -.18);
        if (ai.specialCooldown <= 0 && target) {
          const count = 2 + Math.min(3, this.defenseTier);
          for (let i = 0; i < count; i++) this.queueDefenseHazard({ type: 'circle', x: target.x + (target === flag ? rand(-35, 35) : rand(-100, 100)), y: target.y + (target === flag ? rand(-35, 35) : rand(-100, 100)), radius: 58, delay: .65 + i * .18, damage: ai.damage * .35, status: 'cube', owner: enemy, name: 'アレクトール弾', hitsFlag: target === flag, color: '#b1e893' });
          ai.specialCooldown = 3.1;
        }
        return;
      }
      if (type === 'borboros') {
        if (ai.phaseTimer <= 0) {
          ai.phase = ai.phase === 'solid' ? 'liquid' : ai.phase === 'liquid' ? 'gas' : 'solid';
          ai.phaseTimer = ai.phase === 'gas' ? 3.3 : 2.7;
          this.logEvent('borboros_phase', ai.phase, false);
        }
        if (ai.phase === 'gas') {
          this.moveDefenseEnemy(enemy, target, dt, .7);
          if (ai.attackCooldown <= 0) {
            this.queueDefenseHazard({ type: 'circle', x: enemy.x, y: enemy.y, radius: 190, delay: .15, damage: ai.damage * .3, status: 'poison', owner: enemy, name: 'ボルボロス毒ガス', hitsFlag: target === flag, color: '#9c73ca' });
            ai.attackCooldown = .9;
          }
        } else if (ai.phase === 'liquid') {
          this.moveDefenseEnemy(enemy, target, dt, 1.35);
        } else {
          const d = this.moveDefenseEnemy(enemy, target, dt, .86);
          if (ai.attackCooldown <= 0 && d < 180) {
            this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: target.x, y2: target.y, width: 55, delay: .38, damage: ai.damage, owner: enemy, name: 'ボルボロス固体斬撃', hitsFlag: true, color: '#b68be2' });
            ai.attackCooldown = 1.35;
          }
        }
        return;
      }
      if (type === 'organon') {
        this.moveDefenseEnemy(enemy, target, dt, .45);
        if (ai.specialCooldown <= 0) {
          const rings = 3 + Math.min(2, this.defenseTier);
          for (let i = 0; i < rings; i++) this.queueDefenseHazard({ type: 'ring', x: enemy.x, y: enemy.y, radius: 145 + i * 105, width: 28, delay: .85 + i * .14, damage: ai.damage, owner: enemy, name: 'オルガノン円軌道刃', hitsFlag: true, color: '#e8ddbb' });
          ai.specialCooldown = 4.15;
        }
      }
    }

    damageDefenseDecoy(decoy, amount, source = null, name = '敵攻撃') {
      if (!decoy || decoy.hp <= 0 || amount <= 0) return;
      decoy.hp = Math.max(0, decoy.hp - amount);
      this.effects.push({ type: 'hit', x: decoy.x, y: decoy.y, ttl: .2, maxTtl: .2 });
      if (decoy.hp <= 0) {
        this.effects.push({ type: 'explosion', x: decoy.x, y: decoy.y, radius: 58, ttl: .34, maxTtl: .34 });
        this.logEvent('defense_decoy_destroyed', `${name}で囮破壊`, false);
        if (source?.defenseAI) { source.defenseAI.objectiveTimer = 0; source.defenseAI.objectiveMode = 'flag'; }
      }
    }

    queueDefenseHazard(hazard) {
      this.defenseHazards.push({ ...hazard, delay: hazard.delay ?? .6, ttl: (hazard.delay ?? .6) + .55, resolved: false });
    }

    updateDefenseHazards(dt) {
      for (let i = this.defenseHazards.length - 1; i >= 0; i--) {
        const hazard = this.defenseHazards[i];
        hazard.delay -= dt; hazard.ttl -= dt;
        if (!hazard.resolved && hazard.delay <= 0) {
          hazard.resolved = true;
          this.resolveDefenseHazard(hazard);
        }
        if (hazard.ttl <= 0) this.defenseHazards.splice(i, 1);
      }
    }

    resolveDefenseHazard(hazard) {
      if (hazard.type === 'circle' || hazard.type === 'ring') this.sfx?.play('explosion', { x: hazard.x, y: hazard.y, bucket: `defense-explosion:${hazard.name}`, cooldown: .14, volume: .58, rate: hazard.type === 'ring' ? .82 : 1 });
      else if (hazard.type === 'line') this.sfx?.play('attacker', { x: hazard.x2 ?? hazard.x, y: hazard.y2 ?? hazard.y, bucket: `defense-line:${hazard.name}`, cooldown: .11, volume: .45, rate: 1.04 });
      const targets = this.players.filter((player) => !player.isDefenseEnemy && !player.dead);
      const hits = [];
      for (const target of targets) {
        let hit = false;
        if (hazard.type === 'circle') hit = Math.hypot(target.x - hazard.x, target.y - hazard.y) <= hazard.radius + target.radius;
        else if (hazard.type === 'line') hit = segmentPointDistance(hazard.x, hazard.y, hazard.x2, hazard.y2, target.x, target.y).distance <= (hazard.width || 24) + target.radius;
        else if (hazard.type === 'ring') hit = Math.abs(Math.hypot(target.x - hazard.x, target.y - hazard.y) - hazard.radius) <= (hazard.width || 24) + target.radius;
        if (!hit) continue;
        hits.push(target);
        this.damagePlayer(target, hazard.damage || 0, hazard.owner, { x: hazard.x, y: hazard.y, type: 'explosion', name: hazard.name, sourceKey: `defense:${hazard.name}` });
        if (hazard.status === 'cube') target.cubedTimer = Math.max(target.cubedTimer || 0, 2.35);
        if (hazard.status === 'anchor') { target.leadWeights = Math.min(8, target.leadWeights + 2); target.slowTimer = Math.max(target.slowTimer, 3.8); target.slowFactor = Math.min(target.slowFactor, .52); }
        if (hazard.status === 'chain') { const a = Math.atan2(hazard.y - target.y, hazard.x - target.x); target.vx += Math.cos(a) * 520; target.vy += Math.sin(a) * 520; }
        if (hazard.status === 'bounce') { const a = Math.atan2(target.y - hazard.y, target.x - hazard.x); target.vx += Math.cos(a) * 650; target.vy += Math.sin(a) * 650; }
        if (hazard.status === 'poison') target.defensePoisonTimer = Math.max(target.defensePoisonTimer || 0, 4.5);
      }
      for (const decoy of this.beacons.filter((beacon) => beacon.defenseDecoy && beacon.hp > 0)) {
        let hitDecoy = false;
        if (hazard.type === 'circle') hitDecoy = Math.hypot(decoy.x - hazard.x, decoy.y - hazard.y) <= hazard.radius + decoy.radius;
        else if (hazard.type === 'line') hitDecoy = segmentPointDistance(hazard.x, hazard.y, hazard.x2, hazard.y2, decoy.x, decoy.y).distance <= (hazard.width || 24) + decoy.radius;
        else if (hazard.type === 'ring') hitDecoy = Math.abs(Math.hypot(decoy.x - hazard.x, decoy.y - hazard.y) - hazard.radius) <= (hazard.width || 24) + decoy.radius;
        if (hitDecoy) this.damageDefenseDecoy(decoy, (hazard.damage || 0) * .9, hazard.owner, hazard.name);
      }
      const hazardHitsPoint = (x, y, radius = 0) => {
        if (hazard.type === 'circle') return Math.hypot(x - hazard.x, y - hazard.y) <= hazard.radius + radius;
        if (hazard.type === 'line') return segmentPointDistance(hazard.x, hazard.y, hazard.x2, hazard.y2, x, y).distance <= (hazard.width || 24) + radius;
        if (hazard.type === 'ring') return Math.abs(Math.hypot(x - hazard.x, y - hazard.y) - hazard.radius) <= (hazard.width || 24) + radius;
        return false;
      };
      for (const wall of this.walls) {
        if (!wall.defenseBuildType || wall.hp <= 0) continue;
        const cx = wall.x + wall.w / 2, cy = wall.y + wall.h / 2;
        if (hazardHitsPoint(cx, cy, Math.max(wall.w, wall.h) * .42)) wall.hp -= (hazard.damage || 0) * .55;
      }
      for (const facility of this.installations) {
        if (!facility.defenseBuildType || facility.hp <= 0) continue;
        if (hazardHitsPoint(facility.x, facility.y, facility.radius || 24)) facility.hp -= (hazard.damage || 0) * .62;
      }
      if (hazard.hitsFlag && this.defenseFlag) {
        let hitFlag = false;
        const flag = this.defenseFlag;
        if (hazard.type === 'circle') hitFlag = Math.hypot(flag.x - hazard.x, flag.y - hazard.y) <= hazard.radius + flag.radius;
        else if (hazard.type === 'line') hitFlag = segmentPointDistance(hazard.x, hazard.y, hazard.x2, hazard.y2, flag.x, flag.y).distance <= (hazard.width || 24) + flag.radius;
        else if (hazard.type === 'ring') hitFlag = Math.abs(Math.hypot(flag.x - hazard.x, flag.y - hazard.y) - hazard.radius) <= (hazard.width || 24) + flag.radius;
        if (hitFlag) this.damageDefenseFlag((hazard.damage || 0) * .62, hazard.owner, hazard.name);
      }
      this.effects.push({ type: 'defenseImpact', x: hazard.x2 ?? hazard.x, y: hazard.y2 ?? hazard.y, ttl: .35, maxTtl: .35, color: hazard.color });
    }

    defeatDefenseEnemy(enemy, attacker, sourceName = '撃破') {
      if (!enemy || enemy.dead) return;
      enemy.hp = 0; enemy.dead = true; enemy.respawnTimer = Infinity; enemy.corpseTimer = .8;
      this.defenseEnemiesDefeated += 1;
      if (enemy.isDefenseBoss) this.defenseBossesDefeated += 1;
      const resourceReward = enemy.isDefenseBoss ? 28 : enemy.defenseType === 'rabbit' ? 8 : enemy.defenseType === 'ilgar' ? 6 : 4;
      this.defenseBuildPoints = Math.min(this.defenseBuildMaxPoints, this.defenseBuildPoints + resourceReward);
      if (attacker && !attacker.isDefenseEnemy) {
        attacker.kills += 1;
        attacker.score += enemy.scoreValue || 100;
      }
      const drops = enemy.isDefenseBoss ? 10 : enemy.defenseType === 'rabbit' ? 5 : 3;
      for (let i = 0; i < drops; i++) this.pickups.push(this.makePickup(enemy.x + rand(-55, 55), enemy.y + rand(-55, 55), rand(2, 5), { temporary: true, ttl: rand(12, 16) }));
      this.effects.push({ type: 'bailout', x: enemy.x, y: enemy.y, ttl: .9, maxTtl: .9 });
      this.addKillFeed(`${enemy.name}撃破`);
      this.logEvent(enemy.isDefenseBoss ? 'defense_boss_defeated' : 'defense_enemy_defeated', `${enemy.name} [${sourceName}]`);
    }

    endDefenseMatch() {
      if (this.ended) return;
      this.ended = true; this.paused = false;
      $('#pauseOverlay').classList.add('hidden');
      const defenders = this.players.filter((player) => !player.isDefenseEnemy).sort((a, b) => b.score - a.score || b.kills - a.kills);
      $('#resultTitle').textContent = `ROUND ${this.defenseRound} 防衛終了`;
      $('#resultSummary').innerHTML = `
        <div><span>REACHED</span><strong>R${this.defenseRound}</strong></div>
        <div><span>ENEMIES</span><strong>${this.defenseEnemiesDefeated}</strong></div>
        <div><span>BOSSES</span><strong>${this.defenseBossesDefeated}</strong></div>`;
      $('#rankingList').innerHTML = defenders.map((player, index) => `<div class="rank-row${player.human ? ' player' : ''}"><span class="rank">${index + 1}</span><strong>${player.name}</strong><span class="meta">${player.kills}K / ${player.deaths}D</span><span>${Math.floor(player.score)}pt</span></div>`).join('');
      this.finalizeLog('flag_destroyed');
      this.updateDebugPanel(true);
      $('#resultOverlay').classList.remove('hidden');
    }

    randomStats() {
      const stats = { trion: 2, technique: 2, combat: 2 };
      let remaining = 12;
      const keys = Object.keys(stats);
      while (remaining > 0) {
        const key = choose(keys);
        if (stats[key] < 10) {
          stats[key] += 1;
          remaining -= 1;
        }
      }
      return stats;
    }

    createPlayer({ id, name, human, team, stats, loadout, archetype = 'プレイヤー', appearance = null, squadName = '無所属隊', emblemPixels = null }) {
      const maxHp = 78 + stats.combat * 8;
      const maxTrion = 105 + stats.trion * 25;
      const app = { ...randomCpuAppearance(irand(0, 99), team), ...(appearance || {}) };
      return {
        id, name, human, team, stats: { ...stats }, loadout,
        archetype,
        squadName,
        emblemPixels: emblemPixels || app.emblemPixels,
        appearance: app,
        x: 0, y: 0, vx: 0, vy: 0,
        radius: 17 + stats.trion * 0.38,
        aim: 0,
        facing: 'down',
        walkTime: 0,
        walkFrame: 0,
        isMoving: false,
        maxHp, hp: maxHp,
        maxTrion, trion: maxTrion,
        regen: 2.4 + stats.trion * 0.72,
        speed: 155 + stats.combat * 8.5,
        selected: { main: 0, sub: 0 },
        cooldowns: {}, cooldownMax: {},
        shields: { main: null, sub: null },
        toggles: { bagworm: false, bagwormTag: false, chameleon: false },
        revealTimer: 0,
        markedTimer: 0,
        slowTimer: 0,
        slowFactor: 1,
        leadWeights: 0,
        modifierReady: { main: null, sub: null },
        pendingComposite: null,
        trapMode: 0,
        dead: false,
        respawnTimer: 0,
        invulnTimer: 0,
        score: 0,
        kills: 0,
        deaths: 0,
        combo: 0,
        lastDamageAt: -999,
        operatorOrder: null,
        operatorOrderProgress: 0,
        metrics: {
          triggerActivations: 0, attackActions: 0, attackActivations: 0, activationsWithHit: 0, uniqueTargetsHit: 0,
          projectilesFired: 0, projectilesSpawned: 0, projectilesHit: 0, projectileHits: 0, meleeHits: 0,
          damageDealt: 0, damageTaken: 0, blockedDamage: 0, shieldDamagePrevented: 0, shieldBlocks: 0,
          trionSpent: 0, pickups: 0, pickupTrionGained: 0, pickupScore: 0,
          aliveTime: 0, currentLife: 0, longestLife: 0, assists: 0, supportScore: 0,
          combatDeaths: 0, manualBailouts: 0, spectateTransitions: 0, effectApplications: 0, successfulEffectActivations: 0,
          spiderSlowSeconds: 0, switchboxTriggers: 0, switchboxDamage: 0,
          dummyBeaconTargetSeconds: 0, bagwormHiddenSeconds: 0, chameleonHiddenSeconds: 0,
          leadBulletSlowSeconds: 0, leadBulletWeightsApplied: 0, starmakerRevealSeconds: 0, starmakerMarks: 0,
          grasshopperBoostImpulse: 0, escudoDamagePrevented: 0,
          aiWallAvoidances: 0, aiWallBreakFallbacks: 0, aiStuckEscapes: 0, aiOscillationBreaks: 0, dummyBeaconIdentifications: 0,
          aiVoluntaryBailouts: 0, desertReliefVisits: 0, desertReliefDepartures: 0,
          triggerUses: {}, triggerDamage: {}, triggerStats: {}, aiTriggerSelections: {},
        },
        _activationHits: new Map(),
        _hitProjectileIds: new Set(),
        damageContributors: new Map(),
        spawnHistory: [],
        ai: {
          rethink: 0, target: null, targetType: 'player', strafe: Math.random() < .5 ? -1 : 1,
          targetLockTimer: 0, targetAge: 0, aimNoise: 0, aimNoiseTimer: 0, relocateTimer: 0, threatTime: 0,
          beaconDistracted: false, beaconCreditByOwner: {},
          utilityTimer: rand(1, 4), attackTimer: 0, lastWeaponId: null, repeatCount: 0, forcedRangedHand: null, placePoint: null,
          concealmentTimer: 0, concealmentCooldown: 0,
          desertRecoveryActive: false, desertRecoveryTimer: 0, desertRecoveryCooldown: rand(4, 8), desertRecoveryPoint: null,
          desertReliefOccupancyTimer: 0, desertReliefStayTimer: 0, desertDepartureTimer: 0, desertDeparturePoint: null,
          voluntaryBailoutCooldown: rand(9, 16), voluntaryBailoutCheckTimer: rand(.5, 1.2), lastHostileContactAt: -999,
          wanderTimer: 0, wanderPoint: null,
          navCheckTimer: 0, navProgressTimer: 0, navLastX: null, navLastY: null, stuckTimer: 0, navBlockerId: null,
          avoidWaypoint: null, avoidWallId: null, avoidTimer: 0, wallBreakTarget: null, wallBreakTimer: 0,
          movementMode: 'advance', movementModeTimer: 0, movementAngle: null, movementAngleTimer: 0,
          lastMoveAngle: null, lastDesiredMoveAngle: null, directionFlipCount: 0, directionFlipTimer: 0, strafeTimer: rand(1.4, 2.8),
          escapeWaypoint: null, escapeTimer: 0, recentNavPoints: [], navLastGoalDistance: null, failedDetours: 0,
          separationSide: Math.random() < .5 ? -1 : 1,
          beaconMemory: {},
        },
      };
    }

    placeInitialPlayers() {
      for (const p of this.players) this.respawnPlayer(p, true);
      if (this.isPlayerCombatant) {
        this.camera.x = this.human.x - this.viewW / 2;
        this.camera.y = this.human.y - this.viewH / 2;
      } else if (this.isPlayerOperator) {
        const home = this.getTeamHome(this.playerTeam);
        this.operatorCamera.x = home.x;
        this.operatorCamera.y = home.y;
        this.camera.x = home.x - this.viewW / 2;
        this.camera.y = home.y - this.viewH / 2;
      } else {
        const first = this.players.find((p) => !p.dead);
        if (first) { this.camera.x = first.x - this.viewW / 2; this.camera.y = first.y - this.viewH / 2; }
      }
      this.camera.x = clamp(this.camera.x, 0, Math.max(0, this.world.w - this.viewW));
      this.camera.y = clamp(this.camera.y, 0, Math.max(0, this.world.h - this.viewH));
    }

    randomOpenPoint(team = null) {
      for (let attempt = 0; attempt < 180; attempt++) {
        let minX = 100, maxX = this.world.w - 100, minY = 100, maxY = this.world.h - 100;
        if ((this.config.mode === 'team' || this.isDefenseMode) && team !== null) {
          const home = this.getTeamHome(team);
          const spreadX = this.teamCount <= 2 ? this.world.w * .42 : this.world.w * .32;
          const spreadY = this.teamCount <= 2 ? this.world.h * .78 : this.world.h * .34;
          minX = clamp(home.x - spreadX / 2, 100, this.world.w - 200);
          maxX = clamp(home.x + spreadX / 2, minX + 100, this.world.w - 100);
          minY = clamp(home.y - spreadY / 2, 100, this.world.h - 200);
          maxY = clamp(home.y + spreadY / 2, minY + 100, this.world.h - 100);
        }
        const point = { x: rand(minX, maxX), y: rand(minY, maxY), radius: 35 };
        if (this.isInRiver(point.x, point.y)) continue;
        if (this.mapId === 'desert' && this.terrain.quicksand.some((zone) => this.isInCircleZone(point.x, point.y, zone))) continue;
        if (this.mapId === 'desert' && this.terrain.gasFields.some((zone) => zone.active && Math.hypot(point.x - zone.x, point.y - zone.y) < zone.radius + 80)) continue;
        if (this.walls.some((w) => w.hp > 0 && !w.nonBlocking && circleRectOverlap(point, w))) continue;
        if (this.installations.some((f) => f.hp > 0 && Math.hypot(f.x - point.x, f.y - point.y) < 70)) continue;
        return point;
      }
      const home = this.getTeamHome(team || 0);
      return { x: home.x, y: home.y };
    }

    respawnPlayer(p, initial = false) {
      let point = this.randomOpenPoint(p.team);
      for (let attempt = 0; attempt < 80; attempt++) {
        const candidate = this.randomOpenPoint(p.team);
        const safe = this.players.every((other) => other === p || other.dead || Math.hypot(other.x - candidate.x, other.y - candidate.y) > 260);
        if (safe) { point = candidate; break; }
      }
      p.x = point.x;
      p.y = point.y;
      p.vx = 0;
      p.vy = 0;
      p.hp = p.maxHp;
      p.trion = p.maxTrion;
      p.dead = false;
      p.respawnTimer = 0;
      p.invulnTimer = initial ? 3.2 : 1.8;
      p.revealTimer = initial ? 0 : 1.5;
      p.markedTimer = 0;
      p.slowTimer = 0;
      p.slowFactor = 1;
      p.leadWeights = 0;
      if (p.pendingComposite?.activationId) p._activationHits.delete(p.pendingComposite.activationId);
      p.pendingComposite = null;
      p.modifierReady.main = null;
      p.modifierReady.sub = null;
      p.metrics.currentLife = 0;
      p.damageContributors.clear();
      p.spawnHistory.push({ time: Number(this.elapsed.toFixed(3)), x: Number(p.x.toFixed(1)), y: Number(p.y.toFixed(1)), initial });
      if (p.spawnHistory.length > 20) p.spawnHistory.shift();
      p.toggles.bagworm = false;
      p.toggles.bagwormTag = false;
      p.toggles.chameleon = false;
      if (p.ai) {
        p.ai.concealmentTimer = 0;
        p.ai.concealmentCooldown = 0;
        p.ai.desertRecoveryActive = false;
        p.ai.desertRecoveryTimer = 0;
        p.ai.desertRecoveryCooldown = rand(7, 12);
        p.ai.desertRecoveryPoint = null;
        p.ai.desertReliefOccupancyTimer = 0;
        p.ai.desertReliefStayTimer = 0;
        p.ai.desertDepartureTimer = 0;
        p.ai.desertDeparturePoint = null;
        p.ai.voluntaryBailoutCooldown = rand(9, 16);
        p.ai.voluntaryBailoutCheckTimer = rand(.5, 1.2);
        p.ai.lastHostileContactAt = -999;
        p.lastDamageAt = -999;
        p.ai.wanderTimer = 0;
        p.ai.wanderPoint = null;
      }
      if (!initial) {
        this.logEvent('respawn', `${p.name}が戦線復帰`);
        if (p.human) this.showCenterMessage('RETURN', '戦線復帰', 1.1);
      }
    }

    buildSlotHud(subject = this.human) {
      if (!subject) return;
      this.hudSubjectId = subject.id;
      for (const hand of ['main', 'sub']) {
        const root = $(`#${hand}HudSlots`);
        root.innerHTML = '';
        subject.loadout[hand].forEach((id, index) => {
          const t = DATA.triggers[id] || DATA.triggers.empty;
          const key = hand === 'main' ? index + 1 : index + 5;
          const slot = document.createElement('div');
          slot.className = 'hud-slot';
          slot.dataset.hand = hand;
          slot.dataset.index = index;
          slot.innerHTML = `<span class="key">${key}</span><span class="name">${t.short || t.name}</span><span class="cooldown"><i></i></span>`;
          root.appendChild(slot);
        });
      }
      this.updateSlotHud();
    }

    updateStaticHud() {
      const difficulty = AI_DIFFICULTIES[this.config.difficulty]?.label || '普通';
      const roleLabel = this.isPlayerOperator ? 'オペレーター' : this.isSetupSpectator ? '観戦' : '戦闘員';
      const teamText = this.isDefenseMode ? `防衛隊 ${this.config.teamSize || 3}人` : this.config.mode === 'team' ? `${this.teamCount}チーム・各${this.config.teamSize || 3}人` : '個人戦';
      $('#modeLabel').textContent = `${MAP_LABELS[this.mapId]} / ${teamText} / ${roleLabel} / ${difficulty}`;
      $('#teamScoreCard').classList.toggle('hidden', this.config.mode !== 'team');
      $('#defenseHud')?.classList.toggle('hidden', !this.isDefenseMode);
      $('#defenseBuildPanel')?.classList.toggle('hidden', !this.isDefenseMode);
      $('#operatorButton').classList.toggle('hidden', !this.isPlayerOperator);
      $('#bailoutButton').classList.toggle('hidden', !this.isPlayerCombatant);
      $('#spectateButton').classList.toggle('hidden', this.isPlayerOperator);
      $('#slotHud').classList.toggle('hidden', !this.isPlayerCombatant && !this.spectating);
      $('#mobileControls').classList.toggle('operator-mode', this.isPlayerOperator);
      $('#gameScreen').classList.toggle('operator-role', this.isPlayerOperator);
      $('#pauseBailoutButton').classList.toggle('hidden', !this.isPlayerCombatant);
      if (this.isPlayerOperator) $('#operatorButton').textContent = 'COMMAND';
      this.setSoundEnabled(this.soundEnabled, false);
    }

    loop(time) {
      if (!this.running) return;
      const dt = Math.min((time - this.lastTime) / 1000, 0.04);
      this.lastTime = time;
      this.handleGlobalInput();
      if (!this.paused && !this.ended) {
        if (this.onlineMirror) this.updateOnlineMirror(dt);
        else this.update(dt);
      }
      this.hudRefreshTimer -= dt;
      this.radarRefreshTimer -= dt;
      let shouldRender = true;
      if (this.onlineMirror) {
        this.onlineRenderAccumulator += dt;
        shouldRender = this.onlineRenderAccumulator >= this.onlineRenderInterval;
        if (shouldRender) this.onlineRenderAccumulator %= this.onlineRenderInterval;
      }
      if (shouldRender) this.render();
      if (this.radarRefreshTimer <= 0) {
        this.renderRadar();
        this.radarRefreshTimer = this.onlineMirror ? .16 : .06;
      }
      if (this.hudRefreshTimer <= 0) {
        this.updateHud();
        this.hudRefreshTimer = this.onlineMirror ? .1 : .05;
      }
      this.input.endFrame();
      this.frameHandle = requestAnimationFrame((next) => this.loop(next));
    }

    handleGlobalInput() {
      if ((this.input.consume('KeyP') || this.input.consume('Escape')) && !this.ended) this.togglePause();
      if (this.input.consume('KeyG')) this.setGuideVisible(!this.guideVisible);
      if (this.input.consume('KeyL')) this.toggleDebugPanel();
      if (this.input.consume('KeyO') && this.isPlayerOperator) this.toggleOperatorPanel();
      if (this.paused || this.ended) return;
      if (this.input.consume('KeyB')) this.manualBailout();
      if (this.input.consume('KeyV')) this.toggleSpectate();
      if (this.spectating && this.input.consume('KeyQ')) this.ensureSpectatorTarget(-1);
      if (this.spectating && this.input.consume('KeyE')) this.ensureSpectatorTarget(1);
      if (this.input.consume('KeyZ') && this.isPlayerCombatant && !this.human.dead && !this.spectating) {
        this.human.trapMode = (this.human.trapMode + 1) % 3;
        this.toast(`スイッチボックス：${['攻撃', '拘束', '加速'][this.human.trapMode]}トラップ`);
      }
    }

    update(dt) {
      this.elapsed += dt;
      if (!this.isUnlimited) this.matchTime -= dt;
      if (!this.isUnlimited && this.matchTime <= 0) {
        this.endMatch();
        return;
      }

      this.updateEnvironment(dt);
      if (this.config.mode === 'team' || this.isDefenseMode) this.updateOperators(dt);
      if (this.isDefenseMode) this.updateDefenseMode(dt);
      this.updateInstallations(dt);
      this.updateLightSources(dt);
      this.updateGasFields(dt);
      if (this.isPlayerOperator) this.updateOperatorCamera(dt);
      else if (this.isPlayerCombatant && !this.spectating) this.updateHuman(dt);
      for (const player of [...this.players]) {
        if (!player.human) {
          if (player.remoteControlled) this.updateRemoteControlledPlayer(player, dt);
          else if (player.isDefenseEnemy) this.updateDefenseEnemyAI(player, dt);
          else this.updateAI(player, dt);
        }
        this.updatePlayer(player, dt);
      }
      if (this.spectating && !this.getSpectatorTarget()) this.ensureSpectatorTarget(1);
      this.updateProjectiles(dt);
      this.updateWorldObjects(dt);
      this.updatePickups(dt);
      this.updateEffects(dt);
      this.updateCamera(dt);
      this.toastTimer = Math.max(0, this.toastTimer - dt);
      if (this.toastTimer <= 0) $('#toast').classList.remove('show');
      this.messageTimer = Math.max(0, this.messageTimer - dt);
      if (this.messageTimer <= 0) $('#centerMessage').classList.add('hidden');
      if (this.isOnlineHost) this.updateOnlineHost(dt);
      this.debugRefreshTimer -= dt;
      if (this.debugRefreshTimer <= 0) {
        this.updateDebugPanel();
        this.debugRefreshTimer = .35;
      }
    }

    updateHuman(dt) {
      const p = this.human;
      if (!this.isPlayerCombatant || p.dead || this.spectating) return;
      if ((p.cubedTimer || 0) > 0) { p.vx *= Math.pow(.03, dt); p.vy *= Math.pow(.03, dt); return; }

      const selectMap = [
        ['Digit1', 'main', 0], ['Digit2', 'main', 1], ['Digit3', 'main', 2], ['Digit4', 'main', 3],
        ['Digit5', 'sub', 0], ['Digit6', 'sub', 1], ['Digit7', 'sub', 2], ['Digit8', 'sub', 3],
      ];
      for (const [code, hand, index] of selectMap) if (this.input.consume(code)) p.selected[hand] = index;

      if (this.input.virtualAim.active) p.aim = Math.atan2(this.input.virtualAim.y, this.input.virtualAim.x);
      else {
        const mouseWorld = this.screenToWorld(this.input.mouse.x, this.input.mouse.y);
        p.aim = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);
      }
      let dx = this.input.virtualMove.x;
      let dy = this.input.virtualMove.y;
      if (this.input.isDown('KeyW')) dy -= 1;
      if (this.input.isDown('KeyS')) dy += 1;
      if (this.input.isDown('KeyA')) dx -= 1;
      if (this.input.isDown('KeyD')) dx += 1;
      if (dx || dy) {
        const len = Math.hypot(dx, dy);
        const speedFactor = p.pendingComposite ? 0.48 : 1;
        p.vx += (dx / len) * p.speed * speedFactor * dt * 6.2;
        p.vy += (dy / len) * p.speed * speedFactor * dt * 6.2;
        if (Math.abs(dx) > Math.abs(dy)) p.facing = dx > 0 ? 'right' : 'left';
        else p.facing = dy > 0 ? 'down' : 'up';
      }

      p.shields.main = null;
      p.shields.sub = null;
      this.handleHeldHand(p, 'main', this.input.mouse.left || this.input.virtualMain, this.input.mouse.justLeft || this.input.virtualMainJust, dt);
      this.handleHeldHand(p, 'sub', this.input.mouse.right || this.input.virtualSub, this.input.mouse.justRight || this.input.virtualSubJust, dt);

      if (this.input.consume('KeyC')) this.tryCombo(p);
    }

    handleHeldHand(p, hand, held, justPressed, dt, shiftOverride = null) {
      if (!held && !justPressed) return;
      const trigger = this.getSelectedTrigger(p, hand);
      if (!trigger || trigger.kind === 'empty') return;
      const shift = shiftOverride === null ? (this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight')) : Boolean(shiftOverride);
      if (trigger.kind === 'shield') {
        if (held) p.shields[hand] = { type: 'shield', strength: 1 };
        return;
      }
      if (trigger.id === 'raygust' && shift) {
        if (held) p.shields[hand] = { type: 'raygust', strength: 1.55 };
        return;
      }
      const automatic = trigger.kind === 'gun' && ['assault', 'gatling'].includes(trigger.gun);
      if (justPressed || (held && automatic)) this.tryUseHand(p, hand, { shift, continuous: !justPressed });
    }

    getSelectedTrigger(p, hand) {
      return DATA.triggers[p.loadout[hand][p.selected[hand]]] || DATA.triggers.empty;
    }

    getSlotKey(p, hand) { return `${hand}:${p.selected[hand]}`; }

    cooldownReady(p, hand) {
      return (p.cooldowns[this.getSlotKey(p, hand)] || 0) <= 0;
    }

    setCooldown(p, hand, seconds) {
      const key = this.getSlotKey(p, hand);
      const techniqueFactor = 1 - (p.stats.technique - 2) * 0.025;
      const value = Math.max(0.04, seconds * techniqueFactor);
      p.cooldowns[key] = value;
      p.cooldownMax[key] = value;
    }

    consumeTrion(p, amount, silent = false) {
      const relief = this.desertReliefState(p);
      const effectiveAmount = amount * relief.multiplier;
      if (p.trion + 0.001 < effectiveAmount) {
        if (p.human && !silent) this.toast('トリオン不足');
        return false;
      }
      p.trion -= effectiveAmount;
      if (p.metrics) p.metrics.trionSpent += effectiveAmount;
      return true;
    }

    tryUseHand(p, hand, options = {}) {
      const trigger = this.getSelectedTrigger(p, hand);
      if (!trigger || trigger.kind === 'empty' || p.dead) return false;
      if (p.toggles.chameleon && trigger.id !== 'chameleon') {
        if (p.human) this.toast('カメレオン中は他トリガーを使用できません');
        return false;
      }
      if (!this.cooldownReady(p, hand)) return false;
      if (trigger.kind !== 'shield' && !(trigger.id === 'raygust' && options.shift)) p.shields[hand] = null;

      p._activeUseName = null;
      p._activeSourceKey = trigger.id;
      const trionSpentBefore = p.metrics?.trionSpent || 0;
      const activation = this.beginTriggerActivation(p, trigger.id);
      let used = false;
      try {
        switch (trigger.kind) {
          case 'melee': used = this.useMelee(p, hand, trigger, options); break;
          case 'pairedOption': used = this.usePairedOption(p, hand, trigger); break;
          case 'shooter': used = this.fireShooter(p, hand, trigger, options.shift); break;
          case 'gun': used = this.fireGun(p, hand, trigger); break;
          case 'sniper': used = this.fireSniper(p, hand, trigger); break;
          case 'shotModifier': used = this.armShotModifier(p, hand, trigger); break;
          case 'toggle': used = this.toggleTrigger(p, hand, trigger); break;
          case 'placeWall': used = this.placeEscudo(p, hand, trigger); break;
          case 'wire': used = this.placeWire(p, hand, trigger); break;
          case 'teleport': used = this.teleport(p, hand, trigger); break;
          case 'boost': used = this.grasshopper(p, hand, trigger); break;
          case 'beacon': used = this.placeBeacon(p, hand, trigger); break;
          case 'trap': used = this.placeTrap(p, hand, trigger); break;
          default: used = false;
        }
      } finally {
        if (used) this.recordTriggerUse(p, p._activeSourceKey || trigger.id, p._activeUseName, activation.id, (p.metrics?.trionSpent || 0) - trionSpentBefore);
        else p._activationHits.delete(activation.id);
        this.activeActivation = null;
        p._activeUseName = null;
        p._activeSourceKey = null;
      }
      return used;
    }

    useMelee(p, hand, trigger, options) {
      if (!this.consumeTrion(p, trigger.cost)) return false;
      let range = trigger.range;
      let damage = trigger.damage;
      let arc = 1.35;
      let style = trigger.id;
      if (trigger.id === 'scorpion' && options.shift) {
        range = 145 + p.stats.trion * 3;
        damage *= 0.76;
        arc = 0.72;
        style = 'scorpionLong';
        p._activeUseName = ATTACK_LABELS.scorpionLong;
        p._activeSourceKey = 'scorpionLong';
      }
      this.performSlash(p, range, damage * (0.82 + p.stats.combat * 0.045), arc, style);
      this.setCooldown(p, hand, trigger.cooldown);
      this.revealOnAttack(p, 1.2);
      return true;
    }

    performSlash(p, range, damage, arc, style) {
      this.sfx?.play('attacker', { x: p.x, y: p.y, bucket: `attacker:${p.id}`, cooldown: .085, rate: style === 'mantis' ? 1.08 : 1 });
      const origin = { x: p.x + Math.cos(p.aim) * p.radius * .55, y: p.y + Math.sin(p.aim) * p.radius * .55 };
      this.effects.push({ type: 'slash', x: origin.x, y: origin.y, angle: p.aim, range, arc, style, ttl: .22, maxTtl: .22 });
      this.damageWorldArc(p.x, p.y, p.aim, range, arc, damage * .7, p.team);
      for (const target of this.players) {
        if (!this.canDamage(p, target)) continue;
        const d = distance(p, target);
        if (d > range + target.radius) continue;
        const a = Math.atan2(target.y - p.y, target.x - p.x);
        if (Math.abs(angleDiff(a, p.aim)) > arc / 2) continue;
        const sourceName = DATA.triggers[style]?.name || ATTACK_LABELS[style] || '斬撃';
        this.damagePlayer(target, damage, p, { x: p.x, y: p.y, type: 'melee', name: sourceName, sourceKey: style, activationId: this.activeActivation?.playerId === p.id ? this.activeActivation.id : null });
        const knock = 120 + p.stats.combat * 8;
        target.vx += Math.cos(p.aim) * knock;
        target.vy += Math.sin(p.aim) * knock;
      }
    }

    usePairedOption(p, hand, trigger) {
      if (!p.loadout[hand].includes(trigger.base)) {
        if (p.human) this.toast(`${trigger.name}には同じ側の${DATA.triggers[trigger.base].name}が必要です`);
        return false;
      }
      if (!this.consumeTrion(p, trigger.cost)) return false;
      if (trigger.id === 'senku') this.performSenku(p, trigger);
      if (trigger.id === 'thruster') this.performThruster(p, trigger);
      this.setCooldown(p, hand, trigger.cooldown);
      this.revealOnAttack(p, 1.6);
      return true;
    }

    performSenku(p, trigger) {
      this.sfx?.play('attacker', { x: p.x, y: p.y, bucket: `senku:${p.id}`, cooldown: .12, volume: .5, rate: .94 });
      const range = trigger.range + p.stats.trion * 8;
      const end = { x: p.x + Math.cos(p.aim) * range, y: p.y + Math.sin(p.aim) * range };
      this.effects.push({ type: 'senku', x: p.x, y: p.y, x2: end.x, y2: end.y, ttl: .23, maxTtl: .23 });
      this.damageWorldSegment(p.x, p.y, end.x, end.y, trigger.damage * .8, p.team, 20);
      const hits = [];
      for (const target of this.players) {
        if (!this.canDamage(p, target)) continue;
        const hit = segmentPointDistance(p.x, p.y, end.x, end.y, target.x, target.y);
        if (hit.distance <= target.radius + 15) hits.push({ target, hit });
      }
      hits.sort((a, b) => b.hit.t - a.hit.t);
      const penetrationFalloff = [1, .62, .38, .25];
      hits.forEach(({ target, hit }, index) => {
        const tipFactor = .72 + hit.t * .62;
        const multiFactor = penetrationFalloff[Math.min(index, penetrationFalloff.length - 1)];
        this.damagePlayer(target, trigger.damage * tipFactor * multiFactor * (0.82 + p.stats.combat * .04), p, {
          x: p.x, y: p.y, type: 'melee', name: '旋空', sourceKey: 'senku', activationId: this.activeActivation?.playerId === p.id ? this.activeActivation.id : null,
        });
      });
    }

    performThruster(p, trigger) {
      this.sfx?.play('attacker', { x: p.x, y: p.y, bucket: `thruster:${p.id}`, cooldown: .15, volume: .44, rate: 1.1 });
      const range = trigger.range + p.stats.combat * 8;
      const old = { x: p.x, y: p.y };
      p.x = clamp(p.x + Math.cos(p.aim) * range, p.radius, this.world.w - p.radius);
      p.y = clamp(p.y + Math.sin(p.aim) * range, p.radius, this.world.h - p.radius);
      if (!p.flying) this.resolveWallCollision(p);
      p.vx += Math.cos(p.aim) * 440;
      p.vy += Math.sin(p.aim) * 440;
      this.effects.push({ type: 'thruster', x: old.x, y: old.y, x2: p.x, y2: p.y, ttl: .3, maxTtl: .3 });
      this.damageWorldSegment(old.x, old.y, p.x, p.y, trigger.damage * .75, p.team, 28);
      for (const target of this.players) {
        if (!this.canDamage(p, target)) continue;
        const hit = segmentPointDistance(old.x, old.y, p.x, p.y, target.x, target.y);
        if (hit.distance < target.radius + 25) this.damagePlayer(target, trigger.damage * (0.9 + p.stats.combat * .05), p, { x: old.x, y: old.y, type: 'melee', name: 'スラスター', sourceKey: 'thruster', activationId: this.activeActivation?.playerId === p.id ? this.activeActivation.id : null });
      }
    }

    fireShooter(p, hand, trigger, shift) {
      if (trigger.bullet === 'meteor' && shift) return this.placeMeteorMine(p, hand, trigger);
      if (!this.consumeTrion(p, trigger.cost)) return false;
      const technique = p.stats.technique;
      const trion = p.stats.trion;
      const modifiers = this.consumeShotModifier(p, hand);
      if (trigger.bullet === 'asteroid') {
        const count = 4 + Math.floor(technique / 3);
        for (let i = 0; i < count; i++) {
          const spread = (i - (count - 1) / 2) * (0.065 - technique * .0036);
          this.spawnProjectile(p, hand, {
            angle: p.aim + spread, speed: 610 + trion * 18, damage: 8.5 + trion * .85,
            radius: 4.2, life: 1.05 + trion * .028, color: '#72e8ff', ...modifiers,
          });
        }
      } else if (trigger.bullet === 'meteor') {
        this.spawnProjectile(p, hand, {
          angle: p.aim, speed: 520 + trion * 10, damage: 27 + trion * 1.2,
          radius: 7, life: 1.4, explosive: true, explosionRadius: 90 + trion * 3, color: '#ffb55e', ...modifiers,
        });
      } else if (trigger.bullet === 'viper') {
        const count = 3 + Math.floor(technique / 4);
        const fixedTarget = this.getFixedShotTarget(p, 0.5);
        const baseAngle = Math.atan2(fixedTarget.y - p.y, fixedTarget.x - p.x);
        const targetDistance = Math.hypot(fixedTarget.x - p.x, fixedTarget.y - p.y);
        for (let i = 0; i < count; i++) {
          const lane = i - (count - 1) / 2;
          const side = 55 + Math.abs(lane) * 24;
          const midpoint = {
            x: p.x + Math.cos(baseAngle) * targetDistance * .48 + Math.cos(baseAngle + Math.PI / 2) * lane * side,
            y: p.y + Math.sin(baseAngle) * targetDistance * .48 + Math.sin(baseAngle + Math.PI / 2) * lane * side,
          };
          const launchAngle = Math.atan2(midpoint.y - p.y, midpoint.x - p.x);
          this.spawnProjectile(p, hand, {
            angle: launchAngle, speed: 655 + trion * 11,
            damage: 9.5 + trion * .62, radius: 4.7, life: 1.68,
            routePoints: [midpoint, fixedTarget], routeTurn: 2.9 + technique * .16,
            color: '#c88cff', ...modifiers,
          });
        }
      } else if (trigger.bullet === 'hound') {
        const target = this.findTargetNearAim(p, 250);
        const count = 4 + Math.floor(trion / 4);
        for (let i = 0; i < count; i++) {
          this.spawnProjectile(p, hand, {
            angle: p.aim + rand(-.22, .22), speed: 500 + trion * 11,
            damage: 7.35 + trion * .54, radius: 4.4, life: 1.85,
            homing: .82 + technique * .108, targetId: target?.id || null, color: '#7dffb8', ...modifiers,
          });
        }
      }
      this.setCooldown(p, hand, trigger.cooldown);
      this.revealOnAttack(p, 1.25);
      return true;
    }

    getHumanAimPoint(p, distance = 520) {
      if (this.input.virtualAim.active) return { x: p.x + Math.cos(p.aim) * distance, y: p.y + Math.sin(p.aim) * distance };
      return this.screenToWorld(this.input.mouse.x, this.input.mouse.y);
    }

    getFixedShotTarget(p, leadSeconds = .45) {
      if (p.human) return this.getHumanAimPoint(p, 520);
      const target = this.resolveAITarget(p);
      if (!target) return { x: p.x + Math.cos(p.aim) * 520, y: p.y + Math.sin(p.aim) * 520 };
      return { x: target.x + (target.vx || 0) * leadSeconds, y: target.y + (target.vy || 0) * leadSeconds };
    }

    placeMeteorMine(p, hand, trigger) {
      if (!this.consumeTrion(p, trigger.cost * .82)) return false;
      const point = p.human ? this.getHumanAimPoint(p, 220) : {
        x: p.x + Math.cos(p.aim) * 80, y: p.y + Math.sin(p.aim) * 80,
      };
      const d = Math.hypot(point.x - p.x, point.y - p.y);
      const scale = Math.min(1, 220 / Math.max(d, 1));
      const x = p.x + (point.x - p.x) * scale;
      const y = p.y + (point.y - p.y) * scale;
      this.mines.push({ x, y, radius: 10, team: p.team, ownerId: p.id, damage: 40 + p.stats.trion * 2, explosionRadius: 115, hp: 8, ttl: 70, sourceName: ATTACK_LABELS.meteorMine, sourceKey: 'meteorMine', activationId: this.activeActivation?.id || null });
      this.setCooldown(p, hand, trigger.cooldown * .8);
      if (p.human) this.toast('メテオラ設置弾');
      return true;
    }

    fireGun(p, hand, trigger) {
      if (!this.consumeTrion(p, trigger.cost, !p.human)) return false;
      const modifiers = this.consumeShotModifier(p, hand);
      const techSpread = trigger.spread * (1.14 - p.stats.technique * .045);
      const target = trigger.bullet === 'hound' ? this.findTargetNearAim(p, 210) : null;
      for (let i = 0; i < trigger.count; i++) {
        let angle = p.aim + rand(-techSpread, techSpread);
        if (trigger.count > 1) angle = p.aim + lerp(-trigger.spread, trigger.spread, i / Math.max(1, trigger.count - 1));
        const opts = {
          angle,
          speed: trigger.speed + p.stats.trion * (trigger.bullet === 'asteroid' ? 8 : 4),
          damage: trigger.damage * (0.78 + p.stats.trion * .035),
          radius: trigger.gun === 'grenade' ? 7 : 3.6,
          life: 1.25 * trigger.range,
          color: trigger.bullet === 'meteor' ? '#ffb55e' : trigger.bullet === 'viper' ? '#c88cff' : trigger.bullet === 'hound' ? '#7dffb8' : '#72e8ff',
          ...modifiers,
        };
        if (trigger.bullet === 'meteor' || trigger.explosive) {
          opts.explosive = true;
          opts.explosionRadius = trigger.gun === 'grenade' ? 105 : 64;
          opts.damage *= .9;
        }
        if (trigger.bullet === 'viper') {
          const fixedTarget = this.getFixedShotTarget(p, .42);
          const baseAngle = Math.atan2(fixedTarget.y - p.y, fixedTarget.x - p.x);
          const d = Math.hypot(fixedTarget.x - p.x, fixedTarget.y - p.y);
          const lane = i - (trigger.count - 1) / 2;
          const midpoint = { x: p.x + Math.cos(baseAngle) * d * .52 + Math.cos(baseAngle + Math.PI / 2) * lane * 36, y: p.y + Math.sin(baseAngle) * d * .52 + Math.sin(baseAngle + Math.PI / 2) * lane * 36 };
          opts.angle = Math.atan2(midpoint.y - p.y, midpoint.x - p.x);
          opts.routePoints = [midpoint, fixedTarget];
          opts.routeTurn = 2.5 + p.stats.technique * .13;
          opts.speed *= 1.08;
          opts.life *= 1.12;
        }
        if (trigger.bullet === 'hound') {
          opts.homing = .74 + p.stats.technique * .072;
          opts.damage *= .94;
          opts.targetId = target?.id || null;
        }
        this.spawnProjectile(p, hand, opts);
      }
      this.setCooldown(p, hand, trigger.rate);
      this.revealOnAttack(p, trigger.gun === 'gatling' ? .5 : 1.15);
      return true;
    }

    fireSniper(p, hand, trigger) {
      if (!this.consumeTrion(p, trigger.cost)) return false;
      const modifiers = this.consumeShotModifier(p, hand);
      const speedBonus = trigger.id === 'lightning' ? p.stats.trion * 55 : p.stats.trion * 15;
      const shotSpeed = trigger.speed + speedBonus;
      const damageBonus = trigger.id === 'ibis' ? p.stats.trion * 3.4 : p.stats.trion * .8;
      const rangeFactor = trigger.id === 'egret' ? 1.35 + p.stats.trion * .06 : 1.22;
      let shotAngle = p.aim;
      if (!p.human && p.ai?.targetType === 'player') {
        const target = this.resolveAITarget(p);
        if (target) {
          const travelTime = Math.hypot(target.x - p.x, target.y - p.y) / Math.max(shotSpeed, 1);
          const lead = clamp(travelTime * .94, .08, .78);
          shotAngle = Math.atan2(target.y + (target.vy || 0) * lead - p.y, target.x + (target.vx || 0) * lead - p.x);
        }
      }
      const spreadScale = p.human ? 1 : (this.config.difficulty === 'strong' ? .42 : this.config.difficulty === 'normal' ? .72 : 1.15);
      this.spawnProjectile(p, hand, {
        angle: shotAngle + rand(-.018, .018) * (11 - p.stats.technique) * spreadScale,
        speed: shotSpeed,
        damage: trigger.damage + damageBonus,
        radius: trigger.id === 'ibis' ? 6.5 : trigger.id === 'egret' ? 5.2 : 4.8,
        life: rangeFactor,
        color: trigger.id === 'ibis' ? '#ffd27a' : '#d8fbff',
        trail: true,
        penetration: trigger.id === 'ibis' ? 1 : 0,
        ...modifiers,
      });
      this.setCooldown(p, hand, trigger.cooldown);
      this.revealOnAttack(p, 2.3);
      this.effects.push({ type: 'muzzle', x: p.x, y: p.y, angle: p.aim, ttl: .12, maxTtl: .12 });
      return true;
    }

    armShotModifier(p, hand, trigger) {
      if (!this.consumeTrion(p, trigger.cost)) return false;
      const other = hand === 'main' ? 'sub' : 'main';
      p.modifierReady[other] = { type: trigger.modifier, timer: trigger.modifier === 'lead' ? 4 : 5, sourceKey: trigger.id, sourceName: trigger.name, activationId: this.activeActivation?.id || null };
      this.setCooldown(p, hand, trigger.cooldown);
      if (p.human) this.toast(`${trigger.name}：反対側の次弾へ付与`);
      return true;
    }

    consumeShotModifier(p, hand) {
      const modifier = p.modifierReady[hand];
      if (!modifier) return {};
      p.modifierReady[hand] = null;
      if (modifier.type === 'lead') return { lead: true, shieldPierce: true, speedMultiplier: .54, damageOverride: 0, leadWeight: 1 + Math.floor(p.stats.trion / 4), effectSourceKey: modifier.sourceKey, effectSourceName: modifier.sourceName, effectActivationId: modifier.activationId };
      if (modifier.type === 'mark') return { mark: true, markDuration: 9 + p.stats.technique * .45, effectSourceKey: modifier.sourceKey, effectSourceName: modifier.sourceName, effectActivationId: modifier.activationId };
      return {};
    }

    toggleTrigger(p, hand, trigger) {
      if (trigger.toggle === 'chameleon' && !p.toggles.chameleon && !this.consumeTrion(p, trigger.cost)) return false;
      p.toggles[trigger.toggle] = !p.toggles[trigger.toggle];
      if (trigger.toggle === 'chameleon' && p.toggles.chameleon) {
        p.shields.main = null;
        p.shields.sub = null;
      }
      this.setCooldown(p, hand, .24);
      if (p.human) this.toast(`${trigger.name} ${p.toggles[trigger.toggle] ? 'ON' : 'OFF'}`);
      return true;
    }

    placeEscudo(p, hand, trigger) {
      if (!this.consumeTrion(p, trigger.cost)) return false;
      const target = p.human ? this.getHumanAimPoint(p, 150) : { x: p.x + Math.cos(p.aim) * 150, y: p.y + Math.sin(p.aim) * 150 };
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const maxRange = 230 + p.stats.trion * 5;
      const x = p.x + dx / d * Math.min(d, maxRange);
      const y = p.y + dy / d * Math.min(d, maxRange);
      const vertical = Math.abs(dx) > Math.abs(dy);
      const rect = vertical
        ? { x: x - 14, y: y - 82, w: 28, h: 164 }
        : { x: x - 82, y: y - 14, w: 164, h: 28 };
      this.walls.push({ ...rect, type: 'escudo', team: p.team, ownerId: p.id, hp: 145 + p.stats.trion * 12, maxHp: 145 + p.stats.trion * 12, ttl: 18, id: `escudo-${performance.now()}-${Math.random()}` });
      this.setCooldown(p, hand, trigger.cooldown);
      return true;
    }

    placeWire(p, hand, trigger) {
      if (!this.consumeTrion(p, trigger.cost)) return false;
      const target = p.human ? this.getHumanAimPoint(p, 180) : (p.ai.placePoint || { x: p.x + Math.cos(p.aim) * 180, y: p.y + Math.sin(p.aim) * 180 });
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const length = Math.min(d, 290 + p.stats.trion * 9);
      this.wires.push({ x1: p.x, y1: p.y, x2: p.x + dx / d * length, y2: p.y + dy / d * length, team: p.team, ownerId: p.id, ttl: 60, hp: 22 });
      this.setCooldown(p, hand, trigger.cooldown);
      return true;
    }

    teleport(p, hand, trigger) {
      const target = p.human ? this.getHumanAimPoint(p, 260) : { x: p.x + Math.cos(p.aim) * 260, y: p.y + Math.sin(p.aim) * 260 };
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const maxDistance = 115 + p.stats.technique * 25;
      const travel = Math.min(d, maxDistance);
      const cost = trigger.cost * (.45 + travel / maxDistance * .75);
      if (!this.consumeTrion(p, cost)) return false;
      const old = { x: p.x, y: p.y };
      p.x = clamp(p.x + dx / d * travel, p.radius, this.world.w - p.radius);
      p.y = clamp(p.y + dy / d * travel, p.radius, this.world.h - p.radius);
      if (!p.flying) this.resolveWallCollision(p);
      this.effects.push({ type: 'teleport', x: old.x, y: old.y, x2: p.x, y2: p.y, ttl: .34, maxTtl: .34 });
      this.setCooldown(p, hand, .55 + travel / 95);
      return true;
    }

    grasshopper(p, hand, trigger) {
      if (!this.consumeTrion(p, trigger.cost)) return false;
      const power = 360 + p.stats.combat * 22;
      p.vx += Math.cos(p.aim) * power;
      p.metrics.grasshopperBoostImpulse += power;
      p.vy += Math.sin(p.aim) * power;
      this.effects.push({ type: 'grasshopper', x: p.x + Math.cos(p.aim) * 30, y: p.y + Math.sin(p.aim) * 30, angle: p.aim, ttl: .45, maxTtl: .45 });
      this.setCooldown(p, hand, trigger.cooldown);
      return true;
    }

    placeBeacon(p, hand, trigger) {
      if (!this.consumeTrion(p, trigger.cost)) return false;
      const target = p.human ? this.getHumanAimPoint(p, 150) : { x: p.x + Math.cos(p.aim) * 150, y: p.y + Math.sin(p.aim) * 150 };
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const travel = Math.min(d, 220);
      this.beacons.push({
        id: `beacon-${performance.now()}-${Math.random()}`,
        x: p.x + dx / d * travel, y: p.y + dy / d * travel,
        vx: rand(-38, 38), vy: rand(-38, 38), radius: 10, hp: 22, maxHp: 22,
        team: p.team, ownerId: p.id, ttl: 28 + p.stats.trion, activationId: this.activeActivation?.id || null,
        createdAt: this.elapsed, exposedTeams: {},
      });
      this.setCooldown(p, hand, trigger.cooldown);
      return true;
    }

    placeTrap(p, hand, trigger) {
      if (!this.consumeTrion(p, trigger.cost)) return false;
      const target = p.human ? this.getHumanAimPoint(p, 120) : (p.ai.placePoint || { x: p.x + Math.cos(p.aim) * 120, y: p.y + Math.sin(p.aim) * 120 });
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const travel = Math.min(d, p.human ? 210 : 300);
      this.traps.push({
        x: p.x + dx / d * travel, y: p.y + dy / d * travel,
        radius: 14, team: p.team, ownerId: p.id, type: p.trapMode,
        ttl: 48, armed: .75, hp: 18, activationId: this.activeActivation?.id || null,
      });
      this.setCooldown(p, hand, trigger.cooldown);
      return true;
    }

    tryCombo(p) {
      if (p.dead || p.toggles.chameleon || p.pendingComposite) return;
      const main = this.getSelectedTrigger(p, 'main');
      const sub = this.getSelectedTrigger(p, 'sub');

      if (main.id === 'scorpion' && sub.id === 'scorpion') {
        const cost = 18;
        if (!this.cooldownReady(p, 'main') || !this.cooldownReady(p, 'sub')) return;
        if (!this.consumeTrion(p, cost)) return;
        const range = 300 + p.stats.trion * 9;
        const previousActivation = this.activeActivation;
        const activation = this.beginTriggerActivation(p, 'mantis', 'マンティス');
        this.performSlash(p, range, 34 * (0.82 + p.stats.combat * .045), .5, 'mantis');
        p.vx += Math.cos(p.aim) * 120;
        p.vy += Math.sin(p.aim) * 120;
        this.setCooldownForHandIndex(p, 'main', p.selected.main, 1.65);
        this.setCooldownForHandIndex(p, 'sub', p.selected.sub, 1.65);
        this.recordTriggerUse(p, 'mantis', 'マンティス', activation.id, cost);
        this.activeActivation = previousActivation;
        if (p.human) this.toast('マンティス');
        return;
      }

      const modifierHand = main.kind === 'shotModifier' ? 'main' : sub.kind === 'shotModifier' ? 'sub' : null;
      const rangedHand = main.kind === 'shotModifier' ? 'sub' : sub.kind === 'shotModifier' ? 'main' : null;
      if (modifierHand && rangedHand) {
        if (this.tryUseHand(p, modifierHand)) this.tryUseHand(p, rangedHand);
        return;
      }

      const bulletA = this.getBulletType(main);
      const bulletB = this.getBulletType(sub);
      if (!bulletA || !bulletB) {
        if (p.human) this.toast('現在の左右選択では組み合わせ技を使用できません');
        return;
      }
      const key = canonicalCompositeKey(bulletA, bulletB);
      const composite = DATA.composites[key];
      if (!composite) {
        if (p.human) this.toast('この合成弾は未設定です');
        return;
      }
      if (!this.cooldownReady(p, 'main') || !this.cooldownReady(p, 'sub')) return;
      if (!this.consumeTrion(p, composite.cost)) return;
      const charge = Math.max(.28, 1.1 - p.stats.technique * .075);
      const sourceKey = `composite:${key}`;
      const activation = this.beginTriggerActivation(p, sourceKey, composite.name);
      this.activeActivation = null;
      p.pendingComposite = { timer: charge, total: charge, composite, key, angle: p.aim, sourceKey, activationId: activation.id, targetId: p.ai?.targetType === 'player' ? p.ai.target : null, trionSpent: composite.cost };
      this.setCooldownForHandIndex(p, 'main', p.selected.main, charge + 1.5);
      this.setCooldownForHandIndex(p, 'sub', p.selected.sub, charge + 1.5);
      if (p.human) this.toast(`${composite.name} 合成中`);
    }

    getBulletType(trigger) {
      if (!trigger) return null;
      if (trigger.kind === 'shooter' || trigger.kind === 'gun') return trigger.bullet;
      return null;
    }

    setCooldownForHandIndex(p, hand, index, seconds) {
      const key = `${hand}:${index}`;
      const value = seconds * (1 - (p.stats.technique - 2) * .02);
      p.cooldowns[key] = value;
      p.cooldownMax[key] = value;
    }

    fireComposite(p, pending) {
      const c = pending.composite;
      const target = this.players.find((candidate) => candidate.id === pending.targetId && !candidate.dead)
        || (p.ai?.targetType === 'player' ? this.resolveAITarget(p) : null);
      let launchAngle = pending.angle;
      let fixedTarget = null;
      if (target) {
        const d = Math.hypot(target.x - p.x, target.y - p.y);
        const travel = d / Math.max(c.speed, 1);
        const lead = clamp(travel * .72, .12, .72);
        fixedTarget = { x: target.x + (target.vx || 0) * lead, y: target.y + (target.vy || 0) * lead };
        launchAngle = Math.atan2(fixedTarget.y - p.y, fixedTarget.x - p.x);
      }
      const route = (side = 0) => {
        if (!fixedTarget) return null;
        const d = Math.hypot(fixedTarget.x - p.x, fixedTarget.y - p.y);
        return [
          { x: p.x + Math.cos(launchAngle) * d * .52 + Math.cos(launchAngle + Math.PI / 2) * side, y: p.y + Math.sin(launchAngle) * d * .52 + Math.sin(launchAngle + Math.PI / 2) * side },
          fixedTarget,
        ];
      };
      const base = { angle: launchAngle, speed: c.speed, damage: c.damage * (0.82 + p.stats.trion * .035), radius: 7, life: 1.85, color: '#fff3a6', sourceName: c.name, sourceKey: pending.sourceKey, activationId: pending.activationId };
      switch (c.behavior) {
        case 'pierce': this.spawnProjectile(p, 'main', { ...base, penetration: 4, radius: 8, trail: true }); break;
        case 'curveExplode': this.spawnProjectile(p, 'main', { ...base, routePoints: route(85), routeTurn: 3.1, explosive: true, explosionRadius: 145, proximityFuse: 68 }); break;
        case 'homeExplode': this.spawnProjectile(p, 'main', { ...base, homing: 2.2, targetId: target?.id || null, explosive: true, explosionRadius: 140, proximityFuse: 62 }); break;
        case 'hardHome':
          for (let i = 0; i < 5; i++) this.spawnProjectile(p, 'main', { ...base, angle: launchAngle + rand(-.3, .3), damage: base.damage / 2.9, radius: 5, homing: 3.1, targetId: target?.id || null, color: '#b8ffdf' });
          break;
        case 'fastCurve': this.spawnProjectile(p, 'main', { ...base, routePoints: route(-75), routeTurn: 3.4, penetration: 1, trail: true }); break;
        case 'fastExplode': this.spawnProjectile(p, 'main', { ...base, routePoints: route(0), routeTurn: 2.3, explosive: true, explosionRadius: 108, proximityFuse: 58, speed: c.speed }); break;
        case 'fastHome': this.spawnProjectile(p, 'main', { ...base, homing: 1.25, targetId: target?.id || null, penetration: 1 }); break;
        case 'heavyExplode': this.spawnProjectile(p, 'main', { ...base, routePoints: route(0), routeTurn: 1.75, radius: 11, explosive: true, explosionRadius: 190, proximityFuse: 82, life: 2.35 }); break;
        case 'multiCurve':
          for (let i = 0; i < 3; i++) this.spawnProjectile(p, 'main', { ...base, angle: launchAngle + (i - 1) * .08, damage: base.damage * .55, routePoints: route((i - 1) * 95), routeTurn: 3.5 });
          break;
        case 'smartRoute': this.spawnProjectile(p, 'main', { ...base, routePoints: route(105), routeTurn: 2.7, homing: 1.45, homingDelay: .68, targetId: target?.id || null }); break;
        default: this.spawnProjectile(p, 'main', base);
      }
      this.effects.push({ type: 'composite', x: p.x, y: p.y, angle: launchAngle, ttl: .42, maxTtl: .42 });
      this.recordTriggerUse(p, pending.sourceKey || `composite:${pending.key}`, c.name, pending.activationId || null, pending.trionSpent || 0);
      this.revealOnAttack(p, 2);
      if (p.human) this.toast(`${c.name} 発射${c.canon ? '' : '（ゲーム独自）'}`);
    }

    markProjectileHit(owner, projectileId, sourceKey) {
      if (!owner?.metrics || !projectileId || owner._hitProjectileIds.has(projectileId)) return;
      owner._hitProjectileIds.add(projectileId);
      if (owner._hitProjectileIds.size > 4000) {
        for (const key of [...owner._hitProjectileIds].slice(0, 1000)) owner._hitProjectileIds.delete(key);
      }
      owner.metrics.projectilesHit += 1;
      const stat = owner.metrics.triggerStats[sourceKey];
      if (stat) stat.projectileHits += 1;
    }

    spawnProjectile(owner, hand, opts) {
      const speedMultiplier = opts.speedMultiplier ?? 1;
      const speed = opts.speed * speedMultiplier;
      const damage = opts.damageOverride ?? opts.damage;
      const projectile = {
        id: `p-${performance.now()}-${Math.random()}`,
        ownerId: owner.id, team: owner.team, hand,
        x: owner.x + Math.cos(opts.angle) * (owner.radius + 8),
        y: owner.y + Math.sin(opts.angle) * (owner.radius + 8),
        vx: Math.cos(opts.angle) * speed + owner.vx * .08,
        vy: Math.sin(opts.angle) * speed + owner.vy * .08,
        angle: opts.angle, speed,
        radius: opts.radius || 4,
        damage: damage || 0,
        life: opts.life || 1.4,
        maxLife: opts.life || 1.4,
        age: 0,
        color: opts.color || '#ffffff',
        explosive: Boolean(opts.explosive),
        explosionRadius: opts.explosionRadius || 80,
        homing: opts.homing || 0,
        homingDelay: opts.homingDelay || 0,
        targetId: opts.targetId || null,
        curve: opts.curve || 0,
        curveFlip: opts.curveFlip || 999,
        curveFlipped: false,
        routePoints: Array.isArray(opts.routePoints) ? opts.routePoints.map((point) => ({ x: point.x, y: point.y })) : null,
        routeIndex: 0,
        routeTurn: opts.routeTurn || 0,
        proximityFuse: opts.proximityFuse || 0,
        penetration: opts.penetration || 0,
        trail: Boolean(opts.trail),
        lead: Boolean(opts.lead),
        shieldPierce: Boolean(opts.shieldPierce),
        leadWeight: opts.leadWeight || 1,
        mark: Boolean(opts.mark),
        markDuration: opts.markDuration || 8,
        effectSourceKey: opts.effectSourceKey || null,
        effectSourceName: opts.effectSourceName || null,
        effectActivationId: opts.effectActivationId || null,
        sourceName: opts.sourceName || this.activeActivation?.name || DATA.triggers[owner.loadout[hand]?.[owner.selected[hand]]]?.name || '射撃',
        sourceKey: opts.sourceKey || this.activeActivation?.triggerId || owner.loadout[hand]?.[owner.selected[hand]] || 'shot',
        activationId: opts.activationId || (this.activeActivation?.playerId === owner.id ? this.activeActivation.id : null),
        hitRegistered: false,
      };
      const trigger = DATA.triggers[projectile.sourceKey];
      const isSniper = trigger?.kind === 'sniper' || ['egret','lightning','ibis'].includes(projectile.sourceKey) || /イーグレット|ライトニング|アイビス|狙撃/.test(projectile.sourceName || '');
      this.sfx?.play(isSniper ? 'sniper' : 'gunner', {
        x: owner.x, y: owner.y,
        bucket: `${isSniper ? 'sniper' : 'gunner'}:${owner.id}:${projectile.sourceKey}`,
        cooldown: isSniper ? .16 : .075,
        rate: isSniper ? rand(.96, 1.02) : rand(.94, 1.08),
      });
      owner.metrics.projectilesFired += 1;
      owner.metrics.projectilesSpawned += 1;
      const stat = this.ensureTriggerStat(owner, projectile.sourceKey, projectile.sourceName);
      stat.projectiles += 1;
      this.projectiles.push(projectile);
      return projectile;
    }

    updatePlayer(p, dt) {
      if (p.dead) {
        if (p.isDefenseEnemy) return;
        if (!(p.human && this.spectating)) {
          p.respawnTimer -= dt;
          if (p.respawnTimer <= 0) this.respawnPlayer(p);
        }
        return;
      }

      p.metrics.aliveTime += dt;
      p.metrics.currentLife += dt;
      p.metrics.longestLife = Math.max(p.metrics.longestLife, p.metrics.currentLife);

      for (const key of Object.keys(p.cooldowns)) p.cooldowns[key] = Math.max(0, p.cooldowns[key] - dt);
      for (const hand of ['main', 'sub']) {
        if (p.modifierReady[hand]) {
          p.modifierReady[hand].timer -= dt;
          if (p.modifierReady[hand].timer <= 0) p.modifierReady[hand] = null;
        }
      }
      if (p.pendingComposite) {
        p.pendingComposite.timer -= dt;
        if (p.pendingComposite.timer <= 0) {
          const pending = p.pendingComposite;
          p.pendingComposite = null;
          this.fireComposite(p, pending);
        }
      }

      p.revealTimer = Math.max(0, p.revealTimer - dt);
      p.invulnTimer = Math.max(0, p.invulnTimer - dt);
      p.markedTimer = Math.max(0, p.markedTimer - dt);
      p.slowTimer = Math.max(0, p.slowTimer - dt);
      p.cubedTimer = Math.max(0, (p.cubedTimer || 0) - dt);
      p.defensePoisonTimer = Math.max(0, (p.defensePoisonTimer || 0) - dt);
      if (p.defensePoisonTimer > 0 && !p.isDefenseEnemy) {
        p.defensePoisonTick = (p.defensePoisonTick || 0) - dt;
        if (p.defensePoisonTick <= 0) { p.defensePoisonTick = .55; this.damagePlayer(p, 5 + this.defenseTier * 1.2, null, { x: p.x, y: p.y, type: 'poison', name: 'ボルボロス毒ガス', sourceKey: 'borborosGas' }); }
      }
      if (p.slowTimer <= 0) p.slowFactor = 1;

      const desertRelief = this.desertReliefState(p);
      p.desertRelieved = desertRelief.relieved;
      p.desertTrionMultiplier = desertRelief.multiplier;
      p.desertReliefLabel = desertRelief.label;
      if (!p.human && p.trion < p.maxTrion * .22 && (p.toggles.bagworm || p.toggles.bagwormTag || p.toggles.chameleon)) {
        p.toggles.bagworm = false;
        p.toggles.bagwormTag = false;
        p.toggles.chameleon = false;
        if (p.ai) { p.ai.concealmentTimer = 0; p.ai.concealmentCooldown = Math.max(p.ai.concealmentCooldown || 0, 5); }
      }
      let drain = 0;
      if (p.toggles.bagworm) drain += DATA.triggers.bagworm.drain;
      if (p.toggles.bagwormTag) drain += DATA.triggers.bagwormTag.drain;
      if (p.toggles.chameleon) drain += DATA.triggers.chameleon.drain;
      drain *= desertRelief.multiplier;
      if (p.toggles.bagworm || p.toggles.bagwormTag) p.metrics.bagwormHiddenSeconds += dt;
      if (p.toggles.chameleon) p.metrics.chameleonHiddenSeconds += dt;
      if (drain > 0) {
        p.trion -= drain * dt;
        if (p.trion <= 0) {
          p.trion = 0;
          p.toggles.bagworm = false;
          p.toggles.bagwormTag = false;
          p.toggles.chameleon = false;
          if (p.human) this.toast('継続トリガーがトリオン不足で解除されました');
        }
      } else {
        p.trion = Math.min(p.maxTrion, p.trion + p.regen * dt);
      }

      const weightSlow = Math.max(.38, 1 - p.leadWeights * .11);
      const operatorBoost = p.operatorBoostTimer > 0 ? 1.18 : 1;
      if (p.operatorBoostTimer > 0) p.trion = Math.min(p.maxTrion, p.trion + p.regen * .55 * dt);
      const cubeFactor = (p.cubedTimer || 0) > 0 ? .04 : 1;
      const maxSpeed = p.speed * p.slowFactor * weightSlow * operatorBoost * cubeFactor;
      const velocity = Math.hypot(p.vx, p.vy);
      if (velocity > maxSpeed) {
        const factor = maxSpeed / velocity;
        p.vx *= factor;
        p.vy *= factor;
      }
      if (!p.flying) this.applyTerrainPhysics(p, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const movementSpeed = Math.hypot(p.vx, p.vy);
      p.isMoving = movementSpeed > 24;
      if (p.isMoving) {
        if (Math.abs(p.vx) > Math.abs(p.vy)) p.facing = p.vx > 0 ? 'right' : 'left';
        else p.facing = p.vy > 0 ? 'down' : 'up';
        p.walkTime += dt * clamp(movementSpeed / Math.max(1, p.speed), .55, 1.5) * 8;
        p.walkFrame = Math.floor(p.walkTime) % 4;
      } else {
        p.walkFrame = 0;
      }
      const friction = Math.pow(p.groundFrictionBase || .0008, dt);
      p.vx *= friction;
      p.vy *= friction;
      p.x = clamp(p.x, p.radius, this.world.w - p.radius);
      p.y = clamp(p.y, p.radius, this.world.h - p.radius);
      if (!p.flying) this.resolveWallCollision(p);
      this.resolvePlayerCollision(p);
      this.checkWireContact(p, dt);
    }

    resolveWallCollision(p) {
      for (const wall of this.walls) {
        if (wall.hp <= 0 || wall.nonBlocking) continue;
        if (!circleRectOverlap(p, wall)) continue;
        const closestX = clamp(p.x, wall.x, wall.x + wall.w);
        const closestY = clamp(p.y, wall.y, wall.y + wall.h);
        let dx = p.x - closestX;
        let dy = p.y - closestY;
        let len = Math.hypot(dx, dy);
        if (len < .001) {
          const distances = [Math.abs(p.x - wall.x), Math.abs(p.x - (wall.x + wall.w)), Math.abs(p.y - wall.y), Math.abs(p.y - (wall.y + wall.h))];
          const min = Math.min(...distances);
          if (min === distances[0]) { dx = -1; dy = 0; len = 1; }
          else if (min === distances[1]) { dx = 1; dy = 0; len = 1; }
          else if (min === distances[2]) { dx = 0; dy = -1; len = 1; }
          else { dx = 0; dy = 1; len = 1; }
        }
        const push = p.radius - len + .5;
        p.x += dx / len * push;
        p.y += dy / len * push;
        p.vx *= .55;
        p.vy *= .55;
      }
    }

    resolvePlayerCollision(p) {
      for (const other of this.players) {
        if (other === p || other.dead) continue;
        const dx = p.x - other.x;
        const dy = p.y - other.y;
        const d = Math.hypot(dx, dy) || 1;
        const overlap = p.radius + other.radius - d;
        if (overlap > 0) {
          p.x += dx / d * overlap * .28;
          p.y += dy / d * overlap * .28;
        }
      }
    }

    checkWireContact(p, dt) {
      for (const wire of this.wires) {
        if (wire.team === p.team && (this.config.mode === 'team' || this.isDefenseMode)) continue;
        const hit = segmentPointDistance(wire.x1, wire.y1, wire.x2, wire.y2, p.x, p.y);
        if (hit.distance < p.radius + 5) {
          p.slowTimer = Math.max(p.slowTimer, .18);
          p.slowFactor = Math.min(p.slowFactor, .45);
          const owner = this.players.find((player) => player.id === wire.ownerId);
          if (owner?.metrics) {
            const support = dt * 1.6;
            owner.metrics.spiderSlowSeconds += dt;
            this.awardSupport(owner, support);
          }
          for (const mine of this.mines) {
            if (mine.team === wire.team && Math.hypot(mine.x - hit.x, mine.y - hit.y) < 125) this.detonateMine(mine);
          }
        }
      }
    }

    getTargetLockDuration(p) {
      const base = TARGET_LOCK_SECONDS[p.archetype] || 1;
      const scale = this.config.difficulty === 'weak' ? 1.15 : this.config.difficulty === 'normal' ? 1.05 : 1;
      return base * scale * rand(.9, 1.12);
    }

    updateAIConcealment(p, target, distanceToTarget, dt) {
      const active = p.toggles.bagworm || p.toggles.bagwormTag || p.toggles.chameleon;
      if (!active) {
        p.ai.concealmentTimer = 0;
        return;
      }
      p.ai.concealmentTimer += dt;
      const trionRatio = p.trion / Math.max(1, p.maxTrion);
      const recentlyHit = this.elapsed - (p.lastDamageAt || -999) < 2.4;
      const combatClose = Number.isFinite(distanceToTarget) && distanceToTarget < (p.toggles.chameleon ? 430 : 470);
      const durationLimit = p.toggles.chameleon ? 3.2 : 9.5;
      const shouldRelease = recentlyHit || combatClose || trionRatio < .34 || p.ai.concealmentTimer > durationLimit || Boolean(p.operatorOrder?.type === 'focus');
      if (!shouldRelease) return;
      p.toggles.bagworm = false;
      p.toggles.bagwormTag = false;
      p.toggles.chameleon = false;
      p.ai.concealmentTimer = 0;
      p.ai.concealmentCooldown = rand(4, 7);
      p.revealTimer = Math.max(p.revealTimer, .7);
    }

    getNearestEnemyDistance(p) {
      let nearest = Infinity;
      for (const other of this.players) {
        if (!this.canDamage(p, other)) continue;
        nearest = Math.min(nearest, Math.hypot(other.x - p.x, other.y - p.y));
      }
      return nearest;
    }

    getDesertDeparturePoint(p, target = null) {
      const baseAngle = target && !target.dead ? Math.atan2(target.y - p.y, target.x - p.x) : rand(0, TAU);
      for (let attempt = 0; attempt < 18; attempt++) {
        const angle = baseAngle + rand(-1.15, 1.15) + (attempt > 8 ? Math.PI : 0);
        const range = rand(390, 690);
        const point = {
          x: clamp(p.x + Math.cos(angle) * range, 70, this.world.w - 70),
          y: clamp(p.y + Math.sin(angle) * range, 70, this.world.h - 70),
          radius: p.radius,
        };
        if (this.desertReliefState(point).relieved) continue;
        if (this.terrain.quicksand.some(zone => this.isInCircleZone(point.x, point.y, zone))) continue;
        if (this.terrain.gasFields.some(zone => zone.active && Math.hypot(point.x - zone.x, point.y - zone.y) < zone.radius + 90)) continue;
        if (this.walls.some(wall => wall.hp > 0 && !wall.nonBlocking && circleRectOverlap(point, wall))) continue;
        return { x: point.x, y: point.y, type: 'departure' };
      }
      return this.randomOpenPoint((this.config.mode === 'team' || this.isDefenseMode) ? p.team : null);
    }

    tryAIVoluntaryBailout(p, threatened, dt) {
      if (!p.ai || p.human || p.dead || p.invulnTimer > 0) return false;
      p.ai.voluntaryBailoutCooldown = Math.max(0, (p.ai.voluntaryBailoutCooldown || 0) - dt);
      p.ai.voluntaryBailoutCheckTimer = Math.max(0, (p.ai.voluntaryBailoutCheckTimer || 0) - dt);
      if (threatened) p.ai.lastHostileContactAt = this.elapsed;
      if (p.ai.voluntaryBailoutCooldown > 0 || p.ai.voluntaryBailoutCheckTimer > 0 || p.metrics.currentLife < 7) return false;
      p.ai.voluntaryBailoutCheckTimer = rand(.55, 1.05);

      const roleThresholds = { '狙撃手': .18, '工作手': .18, '射手': .15, '銃手': .14, '万能手': .13, '攻撃手': .1, '重装手': .09 };
      const hpRatio = p.hp / Math.max(1, p.maxHp);
      const threshold = roleThresholds[p.archetype] || .14;
      if (hpRatio > threshold) return false;

      const lastContact = Math.max(p.lastDamageAt || -999, p.ai.lastHostileContactAt || -999);
      const contactAge = this.elapsed - lastContact;
      const nearestEnemy = this.getNearestEnemyDistance(p);
      const critical = hpRatio < .055;
      if (contactAge < 4.2 || threatened || nearestEnemy < (critical ? 260 : 380)) return false;
      if (p.operatorOrder?.type === 'focus' && !critical) return false;

      const severity = clamp((threshold - hpRatio) / Math.max(.03, threshold), 0, 1);
      const lowTrion = p.trion < p.maxTrion * .16 ? .16 : 0;
      const difficultyBonus = this.config.difficulty === 'strong' ? .14 : this.config.difficulty === 'weak' ? -.08 : 0;
      const chance = critical ? .9 : clamp(.16 + severity * .52 + lowTrion + difficultyBonus, .08, .78);
      if (Math.random() > chance) return false;

      p.metrics.aiVoluntaryBailouts = (p.metrics.aiVoluntaryBailouts || 0) + 1;
      p.ai.voluntaryBailoutCooldown = rand(14, 22);
      this.logEvent('ai_manual_bailout', `${p.name}が自主ベイルアウト`, false);
      this.bailout(p, null, '自主ベイルアウト', { kind: 'manual', ai: true });
      return true;
    }

    getAIDesertRecoveryDirective(p, target, threatened, dt) {
      if (this.mapId !== 'desert') return null;
      const targetDistance = target ? Math.hypot(target.x - p.x, target.y - p.y) : Infinity;
      const trionRatio = p.trion / Math.max(1, p.maxTrion);
      const recentlyHit = this.elapsed - (p.lastDamageAt || -999) < 3;
      const hasOrder = Boolean(p.operatorOrder);
      const concealmentActive = p.toggles.bagworm || p.toggles.bagwormTag || p.toggles.chameleon;
      const urgent = trionRatio < .075;

      p.ai.desertReliefOccupancyTimer = p.desertRelieved ? (p.ai.desertReliefOccupancyTimer || 0) + dt : 0;
      p.ai.desertReliefStayTimer = Math.max(0, (p.ai.desertReliefStayTimer || 0) - dt);
      p.ai.desertDepartureTimer = Math.max(0, (p.ai.desertDepartureTimer || 0) - dt);

      if (p.desertRelieved && p.ai.desertRecoveryActive) {
        p.ai.desertRecoveryActive = false;
        p.ai.desertRecoveryTimer = 0;
        p.ai.desertRecoveryPoint = null;
        p.ai.desertReliefStayTimer = urgent ? rand(1.4, 2.4) : rand(.45, 1.15);
        p.ai.desertRecoveryCooldown = urgent ? rand(9, 13) : rand(15, 23);
        p.ai.desertDeparturePoint = this.getDesertDeparturePoint(p, target);
        p.ai.desertDepartureTimer = rand(3.2, 5.2);
        p.metrics.desertReliefVisits = (p.metrics.desertReliefVisits || 0) + 1;
      }

      const overstayed = p.desertRelieved && p.ai.desertReliefOccupancyTimer > (urgent ? 4.8 : 3.2);
      if (overstayed && !recentlyHit && !threatened && !hasOrder && targetDistance > 270 && !p.ai.desertDeparturePoint) {
        p.ai.desertDeparturePoint = this.getDesertDeparturePoint(p, target);
        p.ai.desertDepartureTimer = rand(3.2, 5.4);
        p.ai.desertRecoveryCooldown = Math.max(p.ai.desertRecoveryCooldown || 0, rand(14, 22));
        p.metrics.desertReliefDepartures = (p.metrics.desertReliefDepartures || 0) + 1;
      }

      if (p.ai.desertDeparturePoint && p.ai.desertDepartureTimer > 0) {
        const departureDistance = Math.hypot(p.ai.desertDeparturePoint.x - p.x, p.ai.desertDeparturePoint.y - p.y);
        if (departureDistance < 85 || recentlyHit || threatened || hasOrder || targetDistance < 240) {
          p.ai.desertDeparturePoint = null;
          p.ai.desertDepartureTimer = 0;
        } else if (p.ai.desertReliefStayTimer <= 0) {
          return p.ai.desertDeparturePoint;
        }
      } else if (p.ai.desertDepartureTimer <= 0) {
        p.ai.desertDeparturePoint = null;
      }

      const stopRecovery = trionRatio > .28 || recentlyHit || threatened || hasOrder || targetDistance < 390;
      if (p.ai.desertRecoveryActive && stopRecovery) {
        p.ai.desertRecoveryActive = false;
        p.ai.desertRecoveryTimer = 0;
        p.ai.desertRecoveryPoint = null;
        p.ai.desertRecoveryCooldown = rand(10, 17);
      }
      if (p.ai.desertRecoveryActive) {
        p.ai.desertRecoveryTimer -= dt;
        if (p.ai.desertRecoveryTimer <= 0) {
          p.ai.desertRecoveryActive = false;
          p.ai.desertRecoveryPoint = null;
          p.ai.desertRecoveryCooldown = rand(13, 20);
          return null;
        }
        return p.ai.desertRecoveryPoint;
      }

      const canStart = !p.desertRelieved
        && !concealmentActive
        && p.ai.desertRecoveryCooldown <= 0
        && trionRatio < (urgent ? .11 : .165)
        && targetDistance > (urgent ? 380 : 680)
        && !recentlyHit
        && !threatened
        && !hasOrder;
      if (!canStart) return null;
      const point = this.nearestDesertReliefPoint(p);
      if (!point) return null;
      p.ai.desertRecoveryActive = true;
      p.ai.desertRecoveryPoint = point;
      p.ai.desertRecoveryTimer = urgent ? rand(4.2, 6) : rand(2.6, 4.2);
      return point;
    }

    segmentHitsExpandedRect(ax, ay, bx, by, rect, padding = 0) {
      const minX = rect.x - padding;
      const maxX = rect.x + rect.w + padding;
      const minY = rect.y - padding;
      const maxY = rect.y + rect.h + padding;
      const dx = bx - ax;
      const dy = by - ay;
      let tMin = 0;
      let tMax = 1;
      const axes = [[ax, dx, minX, maxX], [ay, dy, minY, maxY]];
      for (const [origin, delta, min, max] of axes) {
        if (Math.abs(delta) < 0.00001) {
          if (origin < min || origin > max) return null;
          continue;
        }
        let t1 = (min - origin) / delta;
        let t2 = (max - origin) / delta;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return null;
      }
      return tMin;
    }

    findBlockingWall(ax, ay, bx, by, padding = 0, ignoreWallId = null) {
      let best = null;
      let bestT = Infinity;
      for (const wall of this.walls) {
        if (wall.id === ignoreWallId || wall.hp <= 0 || wall.nonBlocking) continue;
        const t = this.segmentHitsExpandedRect(ax, ay, bx, by, wall, padding);
        if (t === null || t < 0.015 || t >= bestT) continue;
        best = wall;
        bestT = t;
      }
      return best;
    }

    isAINavPointOpen(x, y, radius, ignoreWallId = null) {
      if (x < radius + 8 || y < radius + 8 || x > this.world.w - radius - 8 || y > this.world.h - radius - 8) return false;
      const probe = { x, y, radius: radius + 5 };
      return !this.walls.some((wall) => wall.id !== ignoreWallId && wall.hp > 0 && !wall.nonBlocking && circleRectOverlap(probe, wall));
    }

    chooseAIWallDetour(p, wall, goalX, goalY) {
      const margin = p.radius + 34;
      const candidates = [
        { x: wall.x - margin, y: wall.y - margin },
        { x: wall.x + wall.w + margin, y: wall.y - margin },
        { x: wall.x - margin, y: wall.y + wall.h + margin },
        { x: wall.x + wall.w + margin, y: wall.y + wall.h + margin },
      ];
      const viable = candidates.filter((point) => {
        if (!this.isAINavPointOpen(point.x, point.y, p.radius, wall.id)) return false;
        const firstBlock = this.findBlockingWall(p.x, p.y, point.x, point.y, p.radius + 4, wall.id);
        return !firstBlock;
      });
      if (!viable.length) return null;
      viable.sort((a, b) => {
        const recentPenalty = (point) => (p.ai.recentNavPoints || []).reduce((sum, old) => sum + (Math.hypot(old.x - point.x, old.y - point.y) < 95 ? 260 : 0), 0);
        const scoreA = Math.hypot(a.x - p.x, a.y - p.y) + Math.hypot(goalX - a.x, goalY - a.y) + (this.findBlockingWall(a.x, a.y, goalX, goalY, p.radius * .6, wall.id) ? 180 : 0) + recentPenalty(a);
        const scoreB = Math.hypot(b.x - p.x, b.y - p.y) + Math.hypot(goalX - b.x, goalY - b.y) + (this.findBlockingWall(b.x, b.y, goalX, goalY, p.radius * .6, wall.id) ? 180 : 0) + recentPenalty(b);
        return scoreA - scoreB;
      });
      return viable[0];
    }

    updateAINavigationProgress(p, dt, wantsMovement, goalX = null, goalY = null) {
      if (p.ai.navLastX === null) {
        p.ai.navLastX = p.x;
        p.ai.navLastY = p.y;
        p.ai.navLastGoalDistance = Number.isFinite(goalX) ? Math.hypot(goalX - p.x, goalY - p.y) : null;
      }
      p.ai.navProgressTimer += dt;
      if (p.ai.navProgressTimer < .55) return;
      const moved = Math.hypot(p.x - p.ai.navLastX, p.y - p.ai.navLastY);
      const goalDistance = Number.isFinite(goalX) ? Math.hypot(goalX - p.x, goalY - p.y) : null;
      const progress = goalDistance !== null && p.ai.navLastGoalDistance !== null ? p.ai.navLastGoalDistance - goalDistance : moved;
      if (wantsMovement && (moved < 9 || progress < -4)) p.ai.stuckTimer += p.ai.navProgressTimer;
      else p.ai.stuckTimer = Math.max(0, p.ai.stuckTimer - p.ai.navProgressTimer * 1.9);
      p.ai.navLastX = p.x;
      p.ai.navLastY = p.y;
      p.ai.navLastGoalDistance = goalDistance;
      p.ai.navProgressTimer = 0;
    }

    chooseAIStuckEscape(p, goalX, goalY) {
      const base = Math.atan2(goalY - p.y, goalX - p.x);
      const sides = [p.ai.separationSide || 1, -(p.ai.separationSide || 1)];
      for (const side of sides) {
        for (const distance of [145, 205, 265]) {
          const angle = base + side * Math.PI / 2 + rand(-.2, .2);
          const point = { x: p.x + Math.cos(angle) * distance, y: p.y + Math.sin(angle) * distance };
          if (!this.isAINavPointOpen(point.x, point.y, p.radius)) continue;
          if (this.findBlockingWall(p.x, p.y, point.x, point.y, p.radius + 4)) continue;
          p.ai.separationSide = side;
          return point;
        }
      }
      return null;
    }

    stabilizeAIMovementAngle(p, desiredAngle, goalX, goalY, dt, movementScale = 1) {
      p.ai.movementAngleTimer = Math.max(0, (p.ai.movementAngleTimer || 0) - dt);
      p.ai.directionFlipTimer = Math.max(0, (p.ai.directionFlipTimer || 0) - dt);
      p.ai.escapeTimer = Math.max(0, (p.ai.escapeTimer || 0) - dt);

      if (p.ai.lastDesiredMoveAngle !== null && movementScale > .22) {
        const reversal = Math.abs(angleDiff(desiredAngle, p.ai.lastDesiredMoveAngle));
        if (reversal > 2.25) {
          p.ai.directionFlipCount = (p.ai.directionFlipCount || 0) + 1;
          p.ai.directionFlipTimer = 1.8;
        } else if (p.ai.directionFlipTimer <= 0) {
          p.ai.directionFlipCount = Math.max(0, (p.ai.directionFlipCount || 0) - 1);
        }
      }
      p.ai.lastDesiredMoveAngle = desiredAngle;

      const oscillating = (p.ai.directionFlipCount || 0) >= 3;
      if ((oscillating || p.ai.stuckTimer > 1.7) && !p.ai.escapeWaypoint) {
        const point = this.chooseAIStuckEscape(p, goalX, goalY);
        if (point) {
          p.ai.escapeWaypoint = point;
          p.ai.escapeTimer = rand(1.55, 2.45);
          p.ai.stuckTimer = Math.max(0, p.ai.stuckTimer - 1.35);
          p.ai.movementAngleTimer = 0;
          if (oscillating) p.metrics.aiOscillationBreaks = (p.metrics.aiOscillationBreaks || 0) + 1;
          else p.metrics.aiStuckEscapes = (p.metrics.aiStuckEscapes || 0) + 1;
        }
        p.ai.directionFlipCount = 0;
      }

      if (p.ai.escapeWaypoint) {
        const d = Math.hypot(p.ai.escapeWaypoint.x - p.x, p.ai.escapeWaypoint.y - p.y);
        if (d < 48 || p.ai.escapeTimer <= 0) {
          p.ai.escapeWaypoint = null;
          p.ai.movementAngleTimer = 0;
        } else {
          desiredAngle = Math.atan2(p.ai.escapeWaypoint.y - p.y, p.ai.escapeWaypoint.x - p.x);
        }
      }

      if (p.ai.movementAngle === null) {
        p.ai.movementAngle = desiredAngle;
        p.ai.movementAngleTimer = rand(.48, .82);
      } else {
        const diff = angleDiff(desiredAngle, p.ai.movementAngle);
        const urgentTurn = p.ai.escapeWaypoint || p.ai.stuckTimer > 2.5;
        if (p.ai.movementAngleTimer <= 0) {
          p.ai.movementAngle = desiredAngle;
          p.ai.movementAngleTimer = rand(.48, .82);
        } else {
          const maxTurn = (urgentTurn ? 3.6 : 1.85) * dt;
          p.ai.movementAngle += clamp(diff, -maxTurn, maxTurn);
        }
      }
      p.ai.lastMoveAngle = p.ai.movementAngle;
      return p.ai.movementAngle;
    }

    applyAISeparation(p, dt, includeEnemies = false) {
      let sx = 0, sy = 0, weight = 0;
      for (const other of this.players) {
        if (other === p || other.dead) continue;
        const allied = other.team === p.team;
        if (!allied && !includeEnemies) continue;
        const dx = p.x - other.x, dy = p.y - other.y;
        const d = Math.hypot(dx, dy) || 1;
        const range = p.radius + other.radius + (allied ? 34 : 18);
        if (d >= range) continue;
        const force = (range - d) / range;
        sx += dx / d * force; sy += dy / d * force; weight += force;
      }
      if (weight > 0) {
        p.vx += sx / weight * p.speed * dt * 2.1;
        p.vy += sy / weight * p.speed * dt * 2.1;
      }
    }

    chooseAIMovementMode(p, distanceToTarget, preferred, role, lowHeavyResources, hasSniper, dt) {
      p.ai.movementModeTimer = Math.max(0, (p.ai.movementModeTimer || 0) - dt);
      p.ai.strafeTimer = Math.max(0, (p.ai.strafeTimer || 0) - dt);
      if (p.ai.strafeTimer <= 0) { p.ai.strafeTimer = rand(1.7, 3.3); if (Math.random() < .42) p.ai.strafe *= -1; }
      let desired = p.ai.movementMode || 'advance';
      if (lowHeavyResources) desired = 'retreat';
      else if (role === '工作手' && distanceToTarget < 295) desired = 'retreat';
      else if (distanceToTarget < preferred * .61) desired = 'retreat';
      else if (distanceToTarget > preferred * 1.42) desired = 'advance';
      else if (distanceToTarget > preferred * .8 && distanceToTarget < preferred * 1.2) desired = hasSniper ? 'hold' : 'strafe';
      if (p.ai.movementModeTimer <= 0 || desired === 'retreat' && distanceToTarget < preferred * .52 || desired === 'advance' && distanceToTarget > preferred * 1.58) {
        p.ai.movementMode = desired;
        p.ai.movementModeTimer = rand(.65, 1.15);
      }
      return p.ai.movementMode;
    }

    getAINavigationAngle(p, goalX, goalY, fallbackAngle, dt, movementScale = 1) {
      p.ai.navCheckTimer = Math.max(0, (p.ai.navCheckTimer || 0) - dt);
      p.ai.avoidTimer = Math.max(0, (p.ai.avoidTimer || 0) - dt);
      p.ai.wallBreakTimer = Math.max(0, (p.ai.wallBreakTimer || 0) - dt);
      this.updateAINavigationProgress(p, dt, movementScale > .18, goalX, goalY);

      if (p.ai.wallBreakTimer <= 0) p.ai.wallBreakTarget = null;
      if (p.ai.avoidWaypoint) {
        const reached = Math.hypot(p.ai.avoidWaypoint.x - p.x, p.ai.avoidWaypoint.y - p.y) < Math.max(38, p.radius * 2.2);
        const wallGone = !this.walls.some((wall) => wall.id === p.ai.avoidWallId && wall.hp > 0);
        if (reached || wallGone || p.ai.avoidTimer <= 0) {
          p.ai.avoidWaypoint = null;
          p.ai.avoidWallId = null;
        }
      }

      const directDistance = Math.hypot(goalX - p.x, goalY - p.y);
      const lookDistance = Math.min(330, directDistance);
      const lookX = p.x + Math.cos(fallbackAngle) * lookDistance;
      const lookY = p.y + Math.sin(fallbackAngle) * lookDistance;
      let blocker = p.ai.navBlockerId ? this.walls.find((wall) => wall.id === p.ai.navBlockerId && wall.hp > 0) || null : null;
      if (p.ai.navCheckTimer <= 0) {
        blocker = this.findBlockingWall(p.x, p.y, lookX, lookY, p.radius + 7);
        p.ai.navBlockerId = blocker?.id || null;
        p.ai.navCheckTimer = .14;
      }

      if (blocker && p.ai.wallBreakTarget !== blocker.id && (!p.ai.avoidWaypoint || p.ai.avoidWallId !== blocker.id)) {
        const waypoint = this.chooseAIWallDetour(p, blocker, goalX, goalY);
        if (waypoint) {
          const changedWall = p.ai.avoidWallId !== blocker.id;
          p.ai.avoidWaypoint = waypoint;
          p.ai.avoidWallId = blocker.id;
          p.ai.avoidTimer = 4.2;
          p.ai.recentNavPoints = [...(p.ai.recentNavPoints || []).slice(-3), { x: waypoint.x, y: waypoint.y }];
          p.ai.failedDetours = changedWall ? 0 : (p.ai.failedDetours || 0) + 1;
          if (changedWall) p.metrics.aiWallAvoidances = (p.metrics.aiWallAvoidances || 0) + 1;
        } else if (p.ai.stuckTimer > 6.2 && (p.ai.failedDetours || 0) >= 1 && Number.isFinite(blocker.hp)) {
          p.ai.wallBreakTarget = blocker.id;
          p.ai.wallBreakTimer = 2.2;
          p.ai.stuckTimer = 1.8;
          p.metrics.aiWallBreakFallbacks = (p.metrics.aiWallBreakFallbacks || 0) + 1;
        }
      }

      if (!blocker && p.ai.avoidWaypoint && p.ai.navCheckTimer <= .02 && !this.findBlockingWall(p.x, p.y, goalX, goalY, p.radius + 5)) {
        p.ai.avoidWaypoint = null;
        p.ai.avoidWallId = null;
      }

      if (p.ai.wallBreakTarget) {
        const wall = this.walls.find((candidate) => candidate.id === p.ai.wallBreakTarget && candidate.hp > 0);
        if (wall) return Math.atan2(wall.y + wall.h / 2 - p.y, wall.x + wall.w / 2 - p.x);
      }
      if (p.ai.avoidWaypoint) return Math.atan2(p.ai.avoidWaypoint.y - p.y, p.ai.avoidWaypoint.x - p.x);
      if (p.ai.stuckTimer > 1.9 && !p.ai.escapeWaypoint) {
        const escape = this.chooseAIStuckEscape(p, goalX, goalY);
        if (escape) { p.ai.escapeWaypoint = escape; p.ai.escapeTimer = rand(1.4, 2.2); p.metrics.aiStuckEscapes = (p.metrics.aiStuckEscapes || 0) + 1; }
      }
      return fallbackAngle;
    }

    getAIBeaconMemory(p, beacon) {
      const memory = p.ai.beaconMemory[beacon.id] ||= {
        observe: 0, suspicion: 0, identified: false,
        lastX: beacon.x, lastY: beacon.y, lastVx: beacon.vx || 0, lastVy: beacon.vy || 0,
      };
      if (beacon.exposedTeams?.[p.team]) memory.identified = true;
      return memory;
    }

    updateAIBeaconRecognition(p, beacon, dt) {
      const memory = this.getAIBeaconMemory(p, beacon);
      if (memory.identified) return true;
      const d = Math.hypot(beacon.x - p.x, beacon.y - p.y);
      const visible = !this.findBlockingWall(p.x, p.y, beacon.x, beacon.y, 4);
      if (!visible) return false;

      const observationRate = d < 130 ? 2.2 : d < 280 ? 1.45 : d < 520 ? .72 : .28;
      memory.observe += dt * observationRate;
      const speed = Math.hypot(beacon.vx || 0, beacon.vy || 0);
      const velocityChange = Math.hypot((beacon.vx || 0) - memory.lastVx, (beacon.vy || 0) - memory.lastVy);
      memory.suspicion += dt * (.08 + (speed < 72 ? .18 : 0) + (velocityChange > 32 ? .18 : 0));
      if (d < 120) memory.suspicion += dt * .55;
      if (beacon.hp < (beacon.maxHp || 22)) memory.suspicion += dt * .5;
      const visibleRealEnemy = this.players.some((other) => this.canDamage(p, other) && Math.hypot(other.x - p.x, other.y - p.y) < 560 && !this.findBlockingWall(p.x, p.y, other.x, other.y, 3));
      if (visibleRealEnemy) memory.suspicion += dt * .36;

      memory.lastX = beacon.x;
      memory.lastY = beacon.y;
      memory.lastVx = beacon.vx || 0;
      memory.lastVy = beacon.vy || 0;

      const difficultyTime = this.config.difficulty === 'strong' ? 1.15 : this.config.difficulty === 'weak' ? 4.2 : 2.25;
      const techniqueFactor = clamp(1.18 - p.stats.technique * .045, .7, 1.08);
      if (memory.observe >= difficultyTime * techniqueFactor || memory.suspicion >= 1.15) {
        memory.identified = true;
        beacon.exposedTeams ||= {};
        if (this.config.mode === 'team' || this.isDefenseMode) beacon.exposedTeams[p.team] = true;
        p.metrics.dummyBeaconIdentifications = (p.metrics.dummyBeaconIdentifications || 0) + 1;
        this.logEvent('dummy_beacon_identified', `${p.name} がダミービーコンを識別`, false);
        return true;
      }
      return false;
    }

    updateAIWander(p, dt) {
      p.ai.wanderTimer -= dt;
      const point = p.ai.wanderPoint;
      const reached = point && Math.hypot(point.x - p.x, point.y - p.y) < 72;
      if (!point || p.ai.wanderTimer <= 0 || reached) {
        let next = null;
        for (let attempt = 0; attempt < 8; attempt++) {
          const candidate = this.randomOpenPoint((this.config.mode === 'team' || this.isDefenseMode) ? p.team : null);
          if (!candidate) continue;
          const tooRecent = (p.ai.recentNavPoints || []).some((old) => Math.hypot(old.x - candidate.x, old.y - candidate.y) < 260);
          if (!tooRecent || attempt === 7) { next = candidate; break; }
        }
        p.ai.wanderPoint = next;
        p.ai.wanderTimer = rand(5.2, 9.4);
        if (next) p.ai.recentNavPoints = [...(p.ai.recentNavPoints || []).slice(-3), { x: next.x, y: next.y }];
      }
      const target = p.ai.wanderPoint;
      if (!target) return;
      let angle = Math.atan2(target.y - p.y, target.x - p.x);
      angle = this.getAINavigationAngle(p, target.x, target.y, angle, dt, .72);
      angle = this.stabilizeAIMovementAngle(p, angle, target.x, target.y, dt, .72);
      p.vx += Math.cos(angle) * p.speed * dt * 3.05;
      p.vy += Math.sin(angle) * p.speed * dt * 3.05;
      this.applyAISeparation(p, dt, false);
      p.aim += clamp(angleDiff(angle, p.aim), -3.2 * dt, 3.2 * dt);
    }

    updateAI(p, dt) {
      if (p.dead) return;
      if ((p.cubedTimer || 0) > 0) { p.vx *= Math.pow(.02, dt); p.vy *= Math.pow(.02, dt); return; }
      const profile = AI_DIFFICULTIES[this.config.difficulty] || AI_DIFFICULTIES.normal;
      p.shields.main = null;
      p.shields.sub = null;
      if (this.config.difficulty === 'sandbag') {
        p.vx *= Math.pow(.01, dt);
        p.vy *= Math.pow(.01, dt);
        return;
      }

      p.ai.rethink -= dt;
      p.ai.targetLockTimer -= dt;
      p.ai.targetAge += dt;
      p.ai.aimNoiseTimer -= dt;
      p.ai.relocateTimer -= dt;
      p.ai.utilityTimer -= dt;
      p.ai.attackTimer -= dt;
      p.ai.concealmentCooldown = Math.max(0, (p.ai.concealmentCooldown || 0) - dt);
      p.ai.desertRecoveryCooldown = Math.max(0, (p.ai.desertRecoveryCooldown || 0) - dt);
      const immediateThreat = this.projectileThreat(p);
      if (immediateThreat) p.ai.lastHostileContactAt = this.elapsed;
      if (this.tryAIVoluntaryBailout(p, immediateThreat, dt)) return;
      if (this.isDefenseMode && this.defenseFlag && this.defenseFlag.hp < this.defenseFlag.maxHp * .55 && p.trion > p.maxTrion * .62 && !p.operatorOrder) {
        const eligible = this.players.filter((unit) => !unit.isDefenseEnemy && !unit.dead && !unit.human && unit.trion > unit.maxTrion * .62).sort((a, b) => Math.hypot(a.x - this.defenseFlag.x, a.y - this.defenseFlag.y) - Math.hypot(b.x - this.defenseFlag.x, b.y - this.defenseFlag.y));
        const hostileNearFlag = this.players.some((enemy) => enemy.isDefenseEnemy && !enemy.dead && Math.hypot(enemy.x - this.defenseFlag.x, enemy.y - this.defenseFlag.y) < 340);
        if (eligible[0] === p && !hostileNearFlag) {
          const dFlag = Math.hypot(this.defenseFlag.x - p.x, this.defenseFlag.y - p.y) || 1;
          if (dFlag > 85) {
            let angle = Math.atan2(this.defenseFlag.y - p.y, this.defenseFlag.x - p.x);
            angle = this.getAINavigationAngle(p, this.defenseFlag.x, this.defenseFlag.y, angle, dt, 1);
            angle = this.stabilizeAIMovementAngle(p, angle, this.defenseFlag.x, this.defenseFlag.y, dt, 1);
            p.vx += Math.cos(angle) * p.speed * dt * 4.5;
            p.vy += Math.sin(angle) * p.speed * dt * 4.5;
            this.applyAISeparation(p, dt, false);
          }
          return;
        }
      }
      const currentTarget = this.resolveAITarget(p);
      if (!currentTarget) {
        this.chooseAITarget(p, true);
        p.ai.rethink = rand(profile.rethink[0], profile.rethink[1]);
      } else if (p.ai.targetLockTimer <= 0 && p.ai.rethink <= 0) {
        this.chooseAITarget(p, false);
        p.ai.rethink = rand(profile.rethink[0], profile.rethink[1]);
      }
      let target = this.resolveAITarget(p);
      if (p.operatorOrder?.type === 'focus') {
        const forced = this.players.find((other) => other.id === p.operatorOrder.targetId && !other.dead);
        if (forced && this.canDamage(p, forced)) { target = forced; p.ai.target = forced.id; p.ai.targetType = 'player'; }
      } else if (p.operatorOrder?.type === 'suppress') {
        const zone = p.operatorOrder;
        const zoneTarget = this.players.filter((other) => this.canDamage(p, other) && Math.hypot(other.x - zone.x, other.y - zone.y) <= (zone.radius || 330)).sort((a, b) => Math.hypot(a.x - zone.x, a.y - zone.y) - Math.hypot(b.x - zone.x, b.y - zone.y))[0];
        if (zoneTarget) { target = zoneTarget; p.ai.target = zoneTarget.id; p.ai.targetType = 'player'; }
      }
      if (!target) {
        this.updateAIConcealment(p, null, Infinity, dt);
        const reliefPoint = this.getAIDesertRecoveryDirective(p, null, immediateThreat, dt);
        if (reliefPoint) {
          let angle = Math.atan2(reliefPoint.y - p.y, reliefPoint.x - p.x);
          angle = this.getAINavigationAngle(p, reliefPoint.x, reliefPoint.y, angle, dt, 1);
          angle = this.stabilizeAIMovementAngle(p, angle, reliefPoint.x, reliefPoint.y, dt, 1);
          p.vx += Math.cos(angle) * p.speed * dt * 4.4 * profile.move;
          p.vy += Math.sin(angle) * p.speed * dt * 4.4 * profile.move;
          this.applyAISeparation(p, dt, false);
        } else {
          this.updateAIWander(p, dt);
        }
        return;
      }
      if (p.ai.targetType === 'beacon') {
        if (this.updateAIBeaconRecognition(p, target, dt)) {
          p.ai.target = null;
          p.ai.targetType = 'player';
          p.ai.targetLockTimer = 0;
          p.ai.beaconDistracted = false;
          this.chooseAITarget(p, true);
          target = this.resolveAITarget(p);
          if (!target) { this.updateAIWander(p, dt); return; }
        } else {
          const owner = this.players.find((player) => player.id === target.ownerId);
          if (owner?.metrics) {
            owner.metrics.dummyBeaconTargetSeconds += dt;
            if (p.ai.beaconDistracted) {
              const credited = p.ai.beaconCreditByOwner[owner.id] || 0;
              const diminishing = Math.max(.08, Math.exp(-credited / 14));
              this.awardSupport(owner, dt * .4 * diminishing);
              p.ai.beaconCreditByOwner[owner.id] = credited + dt;
            }
          }
        }
      }

      const predictedX = target.x + (target.vx || 0) * profile.prediction;
      const predictedY = target.y + (target.vy || 0) * profile.prediction;
      const dx = predictedX - p.x;
      const dy = predictedY - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const targetAngle = Math.atan2(dy, dx);
      const role = p.archetype;
      const hasSniper = [...p.loadout.main, ...p.loadout.sub].some((id) => DATA.triggers[id]?.kind === 'sniper');
      const hasMelee = [...p.loadout.main, ...p.loadout.sub].some((id) => DATA.triggers[id]?.kind === 'melee');
      const concealmentError = target.toggles?.chameleon ? 3.4 : 1;
      const weatherAim = this.environment.weather === 'rain' ? 1.18 : 1;
      const lightAim = this.environment.timeOfDay === 'night' ? 1.15 : 1;
      const aimError = (11 - p.stats.technique) * .0075 * concealmentError * profile.aimError * weatherAim * lightAim;
      if (p.ai.aimNoiseTimer <= 0) {
        p.ai.aimNoise = rand(-aimError, aimError);
        p.ai.aimNoiseTimer = hasSniper ? rand(.22, .36) : rand(.08, .16);
      }
      const desiredAim = targetAngle + p.ai.aimNoise;
      const turnRate = hasSniper ? (p.ai.targetAge < .45 ? 2.4 : 4.2) : 8;
      p.aim += clamp(angleDiff(desiredAim, p.aim), -turnRate * dt, turnRate * dt);

      this.updateAIConcealment(p, target, d, dt);
      const threatened = this.projectileThreat(p);
      const lowHeavyResources = role === '重装手' && (p.trion < p.maxTrion * .35 || p.hp < p.maxHp * .35);
      const preferred = role === '重装手' ? 145 : role === '工作手' ? 390 : hasSniper ? 690 : hasMelee ? 105 : 330;
      let moveAngle = targetAngle;
      let movementScale = 1;
      const movementMode = this.chooseAIMovementMode(p, d, preferred, role, lowHeavyResources, hasSniper, dt);
      if (movementMode === 'retreat') moveAngle += Math.PI;
      else if (movementMode === 'strafe') moveAngle += p.ai.strafe * Math.PI / 2;
      else if (movementMode === 'hold') movementScale = .16;
      if (hasSniper && d > 560 && d < 820 && p.ai.targetAge < .55) movementScale = Math.min(movementScale, .24);
      if (hasSniper && p.ai.relocateTimer > 0) { moveAngle = targetAngle + p.ai.strafe * Math.PI * .68; movementScale = 1.2; }
      const directive = this.getOperatorMoveDirective(p, target);
      if (directive) {
        moveAngle = Math.atan2(directive.y - p.y, directive.x - p.x); movementScale = directive.hold ? 0 : 1.15;
      } else {
        const reliefPoint = this.getAIDesertRecoveryDirective(p, target, threatened, dt);
        if (reliefPoint) {
          moveAngle = Math.atan2(reliefPoint.y - p.y, reliefPoint.x - p.x);
          movementScale = 1.18;
        }
      }
      const navGoalDistance = Math.max(180, Math.min(420, d));
      let navGoalX = p.x + Math.cos(moveAngle) * navGoalDistance;
      let navGoalY = p.y + Math.sin(moveAngle) * navGoalDistance;
      if (directive && Number.isFinite(directive.x) && Number.isFinite(directive.y)) { navGoalX = directive.x; navGoalY = directive.y; }
      moveAngle = this.getAINavigationAngle(p, navGoalX, navGoalY, moveAngle, dt, movementScale);
      moveAngle = this.stabilizeAIMovementAngle(p, moveAngle, navGoalX, navGoalY, dt, movementScale);
      p.vx += Math.cos(moveAngle) * p.speed * dt * 4.2 * profile.move * movementScale;
      p.vy += Math.sin(moveAngle) * p.speed * dt * 4.2 * profile.move * movementScale;
      this.applyAISeparation(p, dt, false);

      p.ai.threatTime = threatened ? p.ai.threatTime + dt : 0;
      const baseReaction = this.config.difficulty === 'strong' ? .11 : this.config.difficulty === 'normal' ? .18 : .32;
      const canReact = threatened && p.ai.threatTime >= baseReaction * (role === '重装手' ? .62 : 1);
      if (role === '重装手' && (canReact || d > 190)) {
        const raygust = this.findTriggerHand(p, (trigger) => trigger.id === 'raygust');
        if (raygust) {
          p.selected[raygust.hand] = raygust.index;
          p.shields[raygust.hand] = { type: 'raygust', strength: 1.55 };
        }
      } else if (canReact && Math.random() < profile.shieldChance) {
        const shieldHand = this.findTriggerHand(p, (trigger) => trigger.kind === 'shield');
        if (shieldHand) {
          p.selected[shieldHand.hand] = shieldHand.index;
          p.shields[shieldHand.hand] = { type: 'shield', strength: 1 };
        }
      }

      if (p.ai.utilityTimer <= 0) {
        if (Math.random() < profile.utilityChance || role === '工作手') this.aiUseUtility(p, d, target, profile);
        let baseMin = this.config.difficulty === 'strong' ? 1.5 : this.config.difficulty === 'weak' ? 4 : 2.4;
        let baseMax = this.config.difficulty === 'strong' ? 3.5 : this.config.difficulty === 'weak' ? 7.5 : 5.8;
        if (role === '工作手') { baseMin *= .48; baseMax *= .58; }
        if (role === '重装手') { baseMin *= .82; baseMax *= .9; }
        p.ai.utilityTimer = rand(baseMin, baseMax);
      }

      if (p.ai.attackTimer > 0) return;
      p.ai.attackTimer = rand(profile.attackInterval[0], profile.attackInterval[1]);
      const attackBlocker = this.findBlockingWall(p.x, p.y, target.x, target.y, Math.max(3, p.radius * .22));
      const allowedWallBreak = attackBlocker && p.ai.wallBreakTarget === attackBlocker.id && p.ai.wallBreakTimer > 0;
      if (attackBlocker && !allowedWallBreak) { p.ai.attackTimer = Math.max(p.ai.attackTimer, .12); return; }
      if (lowHeavyResources && d > 120) { p.ai.attackTimer = .28; return; }

      if (role === '攻撃手' && this.aiTryMantis(p, d, profile)) return;
      if (role === '重装手' && d > 105 && d < 305 && p.trion > p.maxTrion * .32) {
        const thruster = this.findTriggerHand(p, (trigger) => trigger.id === 'thruster');
        if (thruster && this.slotReady(p, thruster.hand, thruster.index, thruster.trigger) && Math.random() < .58) {
          p.selected[thruster.hand] = thruster.index;
          p.metrics.aiTriggerSelections.thruster = (p.metrics.aiTriggerSelections.thruster || 0) + 1;
          if (this.tryUseHand(p, thruster.hand)) return;
        }
      }
      if (this.aiPrepareShotModifier(p, target, d, profile)) return;
      if (this.aiTryComposite(p, target, d, profile)) return;

      if (d < 175) {
        const melee = this.findTriggerHand(p, (trigger) => trigger.kind === 'melee');
        if (melee) {
          p.selected[melee.hand] = melee.index;
          const useLong = melee.trigger.id === 'scorpion' && d > 128;
          p.metrics.aiTriggerSelections[useLong ? 'scorpionLong' : melee.trigger.id] = (p.metrics.aiTriggerSelections[useLong ? 'scorpionLong' : melee.trigger.id] || 0) + 1;
          this.tryUseHand(p, melee.hand, { shift: useLong });
          return;
        }
      }

      const ranged = this.chooseAIRanged(p, target, d, profile);
      if (ranged) {
        if (ranged.trigger.kind === 'sniper') {
          const requiredAim = ranged.trigger.id === 'lightning' ? .3 : ranged.trigger.id === 'egret' ? .46 : .62;
          if (p.ai.targetAge < requiredAim) { p.ai.attackTimer = .08; return; }
        }
        p.selected[ranged.hand] = ranged.index;
        const key = ranged.trigger.id;
        p.metrics.aiTriggerSelections[key] = (p.metrics.aiTriggerSelections[key] || 0) + 1;
        p.ai.repeatCount = p.ai.lastWeaponId === key ? p.ai.repeatCount + 1 : 0;
        p.ai.lastWeaponId = key;
        p.ai.forcedRangedHand = null;
        const used = this.tryUseHand(p, ranged.hand);
        if (used && ranged.trigger.kind === 'sniper') { p.ai.relocateTimer = rand(.55, .95); p.ai.utilityTimer = 0; }
      }
    }

    scoreAITargetCandidate(p, target, type) {
      const d = Math.hypot(target.x - p.x, target.y - p.y);
      if (type === 'beacon') {
        const memory = this.getAIBeaconMemory(p, target);
        if (memory.identified || target.exposedTeams?.[p.team]) return Infinity;
        return d * (1.02 + memory.suspicion * 2.8 + memory.observe * .22);
      }
      const hidden = (target.toggles.bagworm || target.toggles.bagwormTag) && target.markedTimer <= 0 && target.revealTimer <= 0;
      if (hidden && d > 300) return Infinity;
      let score = d * (target.toggles.chameleon ? 1.25 : 1);
      if (this.config.difficulty === 'strong') score *= .68 + (target.hp / target.maxHp) * .45;
      if (this.config.difficulty === 'weak') score *= rand(.88, 1.18);
      return score;
    }

    chooseAITarget(p, force = false) {
      const candidates = [];
      for (const other of this.players) {
        if (!this.canDamage(p, other)) continue;
        const score = this.scoreAITargetCandidate(p, other, 'player');
        if (Number.isFinite(score)) candidates.push({ target: other, type: 'player', score });
      }
      for (const beacon of this.beacons) {
        if (beacon.team === p.team && (this.config.mode === 'team' || this.isDefenseMode)) continue;
        candidates.push({ target: beacon, type: 'beacon', score: this.scoreAITargetCandidate(p, beacon, 'beacon') });
      }
      if (!candidates.length) { p.ai.target = null; return; }
      candidates.sort((a, b) => a.score - b.score);
      const current = this.resolveAITarget(p);
      const currentEntry = current ? { target: current, type: p.ai.targetType, score: this.scoreAITargetCandidate(p, current, p.ai.targetType) } : null;
      const immediateThreat = candidates.find((item) => item.type === 'player' && item.score < 145);
      const choicePool = candidates.slice(0, this.config.difficulty === 'weak' ? 3 : 2);
      let choice = immediateThreat || weightedChoice(choicePool, (item) => 1 / Math.max(1, item.score));
      if (!force && currentEntry && choice?.target.id !== currentEntry.target.id) {
        const meaningfullyBetter = choice.score < currentEntry.score * .7;
        if (!meaningfullyBetter && !immediateThreat) choice = currentEntry;
      }
      const oldTarget = p.ai.target;
      const oldType = p.ai.targetType;
      p.ai.target = choice?.target.id || null;
      p.ai.targetType = choice?.type || 'player';
      const switched = oldTarget && oldTarget !== p.ai.target;
      if (switched) p.metrics.aiTargetChanges = (p.metrics.aiTargetChanges || 0) + 1;
      if (!oldTarget || switched) {
        p.ai.targetAge = 0;
        p.ai.aimNoiseTimer = 0;
      }
      p.ai.targetLockTimer = this.getTargetLockDuration(p);
      if (switched) p.ai.beaconDistracted = Boolean(oldType === 'player' && p.ai.targetType === 'beacon');
      else if (p.ai.targetType !== 'beacon') p.ai.beaconDistracted = false;
    }

    resolveAITarget(p) {
      if (!p.ai.target) return null;
      if (p.ai.targetType === 'beacon') return this.beacons.find((beacon) => beacon.id === p.ai.target) || null;
      const target = this.players.find((other) => other.id === p.ai.target);
      return target && !target.dead ? target : null;
    }

    aiTryMantis(p, d, profile) {
      if (p.toggles.chameleon || p.pendingComposite || d < 185 || d > 355 || p.trion < 18 || Math.random() > (.22 + profile.comboChance * .45)) return false;
      const mainScorpion = p.loadout.main.indexOf('scorpion');
      const subScorpion = p.loadout.sub.indexOf('scorpion');
      if (mainScorpion < 0 || subScorpion < 0) return false;
      p.selected.main = mainScorpion;
      p.selected.sub = subScorpion;
      if (!this.cooldownReady(p, 'main') || !this.cooldownReady(p, 'sub')) return false;
      p.metrics.aiTriggerSelections.mantis = (p.metrics.aiTriggerSelections.mantis || 0) + 1;
      this.tryCombo(p);
      return true;
    }

    countEnemiesNear(p, point, radius) {
      return this.players.filter((other) => this.canDamage(p, other) && Math.hypot(other.x - point.x, other.y - point.y) <= radius).length;
    }

    slotReady(p, hand, index, trigger) {
      const cooldown = p.cooldowns[`${hand}:${index}`] || 0;
      return cooldown <= 0 && p.trion + .001 >= Number(trigger.cost || 0);
    }

    chooseAIRanged(p, target, d, profile) {
      const candidates = [];
      const targetSpeed = Math.hypot(target.vx || 0, target.vy || 0);
      const targetAngle = Math.atan2(target.y - p.y, target.x - p.x);
      const lateralSpeed = Math.abs((target.vx || 0) * -Math.sin(targetAngle) + (target.vy || 0) * Math.cos(targetAngle));
      const cluster = this.countEnemiesNear(p, target, 145);
      const repeatPenalty = (id) => p.ai.lastWeaponId === id ? Math.max(.35, 1 - p.ai.repeatCount * .16) : 1;

      for (const hand of ['main', 'sub']) {
        if (p.ai.forcedRangedHand && hand !== p.ai.forcedRangedHand) continue;
        p.loadout[hand].forEach((id, index) => {
          const trigger = DATA.triggers[id];
          if (!trigger || !this.slotReady(p, hand, index, trigger)) return;
          let score = -Infinity;
          if (trigger.kind === 'sniper') {
            if (trigger.id === 'lightning' && d > 230) score = 4.2 + targetSpeed / 170 - Math.abs(d - 480) / 260;
            if (trigger.id === 'egret' && d > 330) score = 5.2 - Math.abs(d - 650) / 280;
            if (trigger.id === 'ibis' && d > 450) score = 4.5 + (targetSpeed < 75 ? 1.2 : -.6) - Math.abs(d - 720) / 330;
          } else if (trigger.kind === 'gun') {
            if (trigger.gun === 'shotgun') {
              const maxRange = p.archetype === '重装手' ? 245 : 290;
              const idealRange = p.archetype === '重装手' ? 128 : 145;
              score = d < maxRange ? 6.5 - Math.abs(d - idealRange) / 62 : -Infinity;
            }
            else if (trigger.gun === 'handgun') score = d < 420 ? 4.8 - Math.abs(d - 220) / 150 : -Infinity;
            else if (trigger.gun === 'assault') score = d < 720 ? 4.9 - Math.abs(d - 360) / 250 : -Infinity;
            else if (trigger.gun === 'gatling') score = d < 650 ? 4.3 - Math.abs(d - 330) / 270 : -Infinity;
            else if (trigger.gun === 'grenade') score = d > 160 && d < 650 ? 3.7 + cluster * 1.4 : -Infinity;
            if (Number.isFinite(score)) {
              if (trigger.bullet === 'hound') score += targetSpeed / 150;
              if (trigger.bullet === 'viper') score += lateralSpeed / 180;
              if (trigger.bullet === 'meteor') score += (cluster - 1) * 1.1;
              if (trigger.bullet === 'asteroid') score += targetSpeed < 90 ? .7 : 0;
            }
          } else if (trigger.kind === 'shooter') {
            if (trigger.bullet === 'asteroid') score = d < 620 ? 4.8 + (targetSpeed < 90 ? .9 : 0) - Math.abs(d - 330) / 260 : -Infinity;
            if (trigger.bullet === 'hound') score = d < 690 ? 4.5 + targetSpeed / 135 - Math.abs(d - 380) / 300 : -Infinity;
            if (trigger.bullet === 'viper') score = d > 190 && d < 650 && lateralSpeed > 38 ? 4.8 + lateralSpeed / 115 - Math.abs(d - 410) / 280 : -Infinity;
            if (trigger.bullet === 'meteor') {
              score = d > 100 && d < 640 ? 3.7 + (cluster - 1) * 1.65 : -Infinity;
              if (p.archetype === '重装手' && cluster < 2) score -= 2.25;
            }
          } else if (trigger.id === 'senku' && d > 125 && d < 410) {
            score = 3.65 - Math.abs(d - 265) / 115;
            if (profile.comboChance < .1) score -= .35;
          } else if (trigger.id === 'thruster' && d > 75 && d < 285) {
            score = (p.archetype === '重装手' ? 7.8 : 3.7) - Math.abs(d - 175) / 85;
          }
          if (!Number.isFinite(score)) return;
          score *= repeatPenalty(id);
          score += rand(-.32, .32) * profile.aimError;
          candidates.push({ hand, index, trigger, score });
        });
      }
      candidates.sort((a, b) => b.score - a.score);
      const top = candidates.filter((candidate) => candidate.score >= (candidates[0]?.score ?? 0) - 2.2).slice(0, 5);
      return weightedChoice(top, (candidate) => Math.exp(candidate.score * .62));
    }

    aiPrepareShotModifier(p, target, d, profile) {
      if (p.trion < p.maxTrion * .28 || Math.random() > (this.config.difficulty === 'strong' ? .24 : .11)) return false;
      for (const hand of ['main', 'sub']) {
        const other = hand === 'main' ? 'sub' : 'main';
        const rangedAvailable = p.loadout[other].some((id, index) => {
          const trigger = DATA.triggers[id];
          return trigger && ['gun', 'shooter', 'sniper'].includes(trigger.kind) && this.slotReady(p, other, index, trigger);
        });
        if (!rangedAvailable) continue;
        for (let index = 0; index < p.loadout[hand].length; index++) {
          const trigger = DATA.triggers[p.loadout[hand][index]];
          if (!trigger || trigger.kind !== 'shotModifier' || !this.slotReady(p, hand, index, trigger)) continue;
          const hidden = target.toggles?.bagworm || target.toggles?.bagwormTag || target.toggles?.chameleon;
          const useStar = trigger.id === 'starmaker' && hidden;
          const useLead = trigger.id === 'leadBullet' && d < 520 && (Math.hypot(target.vx || 0, target.vy || 0) > 110 || target.hp > target.maxHp * .65);
          if (!useStar && !useLead) continue;
          p.selected[hand] = index;
          p.metrics.aiTriggerSelections[trigger.id] = (p.metrics.aiTriggerSelections[trigger.id] || 0) + 1;
          const used = this.tryUseHand(p, hand);
          if (used) p.ai.forcedRangedHand = other;
          return used;
        }
      }
      return false;
    }

    aiTryComposite(p, target, d, profile) {
      if (d < 210 || d > 680 || p.pendingComposite || Math.random() > profile.comboChance * .45) return false;
      const bulletSlots = {};
      for (const hand of ['main', 'sub']) {
        bulletSlots[hand] = p.loadout[hand].map((id, index) => ({ id, index, trigger: DATA.triggers[id] })).filter(({ trigger }) => trigger && ['shooter', 'gun'].includes(trigger.kind));
      }
      if (!bulletSlots.main.length || !bulletSlots.sub.length) return false;
      const pairs = [];
      for (const main of bulletSlots.main) for (const sub of bulletSlots.sub) {
        const key = canonicalCompositeKey(this.getBulletType(main.trigger), this.getBulletType(sub.trigger));
        const composite = DATA.composites[key];
        if (composite && p.trion >= composite.cost && this.slotReady(p, 'main', main.index, main.trigger) && this.slotReady(p, 'sub', sub.index, sub.trigger)) pairs.push({ main, sub, composite });
      }
      const targetSpeed = Math.hypot(target.vx || 0, target.vy || 0);
      const cluster = this.countEnemiesNear(p, target, 145);
      const viable = pairs.map((pair) => {
        let weight = 1;
        if (['homeExplode', 'hardHome', 'fastHome', 'smartRoute'].includes(pair.composite.behavior)) weight += targetSpeed / 90;
        if (['curveExplode', 'fastCurve', 'multiCurve', 'smartRoute'].includes(pair.composite.behavior)) weight += targetSpeed / 125;
        if (['curveExplode', 'homeExplode', 'fastExplode', 'heavyExplode'].includes(pair.composite.behavior)) weight += Math.max(0, cluster - 1) * 1.4;
        if (pair.composite.behavior === 'heavyExplode' && targetSpeed > 150) weight *= .45;
        return { ...pair, weight };
      });
      const pair = weightedChoice(viable, (item) => item.weight);
      if (!pair) return false;
      p.selected.main = pair.main.index;
      p.selected.sub = pair.sub.index;
      this.tryCombo(p);
      return Boolean(p.pendingComposite);
    }

    aiUseUtility(p, distanceToTarget, target, profile) {
      if (p.trion < p.maxTrion * .2) return;
      const heavyLow = p.archetype === '重装手' && p.trion < p.maxTrion * .42;
      const options = [];
      for (const hand of ['main', 'sub']) {
        p.loadout[hand].forEach((id, index) => {
          const trigger = DATA.triggers[id];
          if (!trigger || !this.slotReady(p, hand, index, trigger)) return;
          let score = -Infinity;
          if (id === 'switchbox') score = p.archetype === '工作手' ? 8 : 2;
          if (id === 'spider') score = p.archetype === '攻撃手' && distanceToTarget < 350 ? -Infinity : distanceToTarget < 430 ? (p.archetype === '工作手' ? 6 : 3.2) : 1;
          if (id === 'dummyBeacon') score = p.archetype === '攻撃手' && distanceToTarget < 350 ? -Infinity : p.hp < p.maxHp * .65 || distanceToTarget < 310 ? 5.4 : 2.4;
          if (id === 'escudo') score = heavyLow ? -Infinity : (p.hp < p.maxHp * .7 || this.projectileThreat(p) ? 6 : -Infinity);
          if (id === 'grasshopper') {
            if (p.archetype === '攻撃手') score = distanceToTarget > 210 ? 6.2 : 1.2;
            else if (p.archetype === '重装手') score = distanceToTarget > 650 ? 2.7 : p.hp < p.maxHp * .35 ? 4.1 : -Infinity;
            else score = distanceToTarget > 360 || p.hp < p.maxHp * .45 ? 4.2 : 1.5;
          }
          if (id === 'bagworm' || id === 'bagwormTag') {
            const desertReserve = this.mapId === 'desert' && !p.desertRelieved ? .72 : .52;
            score = distanceToTarget > 520 && !p.toggles[trigger.toggle] && (p.ai.concealmentCooldown || 0) <= 0 && p.trion > p.maxTrion * desertReserve ? 4 : -Infinity;
          }
          if (id === 'chameleon') {
            const desertReserve = this.mapId === 'desert' && !p.desertRelieved ? .64 : .42;
            score = distanceToTarget < 330 && !p.toggles.chameleon && (p.ai.concealmentCooldown || 0) <= 0 && p.trion > p.maxTrion * desertReserve && p.hp < p.maxHp * .75 ? 4.4 : -Infinity;
          }
          if (Number.isFinite(score)) options.push({ hand, index, trigger, score });
        });
      }
      const chosen = weightedChoice(options, (option) => Math.exp(option.score * .42));
      if (!chosen) return;
      p.selected[chosen.hand] = chosen.index;
      const originalAim = p.aim;
      p.ai.placePoint = null;
      if (chosen.trigger.id === 'switchbox' || chosen.trigger.id === 'spider') {
        p.ai.placePoint = { x: target.x + (target.vx || 0) * .55, y: target.y + (target.vy || 0) * .55 };
      }
      if (chosen.trigger.id === 'switchbox') {
        p.trapMode = distanceToTarget < 210 ? 1 : this.countEnemiesNear(p, target, 130) >= 2 ? 0 : (Math.random() < .65 ? 0 : 1);
      }
      if (chosen.trigger.id === 'dummyBeacon') p.aim += Math.random() < .5 ? 1.15 : -1.15;
      if (chosen.trigger.id === 'grasshopper' && distanceToTarget < 260) p.aim += Math.PI;
      p.metrics.aiTriggerSelections[chosen.trigger.id] = (p.metrics.aiTriggerSelections[chosen.trigger.id] || 0) + 1;
      this.tryUseHand(p, chosen.hand);
      p.ai.placePoint = null;
      p.aim = originalAim;
    }

    findTriggerHand(p, predicate) {
      for (const hand of ['main', 'sub']) {
        for (let index = 0; index < p.loadout[hand].length; index++) {
          const trigger = DATA.triggers[p.loadout[hand][index]];
          if (trigger && predicate(trigger)) return { hand, index, trigger };
        }
      }
      return null;
    }

    projectileThreat(p) {
      return this.projectiles.some((proj) => {
        if (proj.team === p.team && (this.config.mode === 'team' || this.isDefenseMode)) return false;
        if (Math.hypot(proj.x - p.x, proj.y - p.y) > 190) return false;
        const toward = (p.x - proj.x) * proj.vx + (p.y - proj.y) * proj.vy;
        return toward > 0;
      });
    }

    updateProjectiles(dt) {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.age += dt;
        p.life -= dt;
        if (p.routePoints?.length && p.routeTurn > 0) {
          let point = p.routePoints[Math.min(p.routeIndex, p.routePoints.length - 1)];
          if (Math.hypot(point.x - p.x, point.y - p.y) < 48 && p.routeIndex < p.routePoints.length - 1) {
            p.routeIndex += 1;
            point = p.routePoints[p.routeIndex];
          }
          const desired = Math.atan2(point.y - p.y, point.x - p.x);
          const current = Math.atan2(p.vy, p.vx);
          const turn = clamp(angleDiff(desired, current), -p.routeTurn * dt, p.routeTurn * dt);
          const angle = current + turn;
          p.vx = Math.cos(angle) * p.speed;
          p.vy = Math.sin(angle) * p.speed;
        }
        if (p.homing && p.age >= p.homingDelay) {
          const target = this.players.find((t) => t.id === p.targetId && !t.dead) || this.findClosestEnemyToProjectile(p);
          if (target) {
            const desired = Math.atan2(target.y - p.y, target.x - p.x);
            const current = Math.atan2(p.vy, p.vx);
            const turn = clamp(angleDiff(desired, current), -p.homing * dt, p.homing * dt);
            const angle = current + turn;
            p.vx = Math.cos(angle) * p.speed;
            p.vy = Math.sin(angle) * p.speed;
          }
        }
        if (p.curve) {
          if (!p.curveFlipped && p.age > p.curveFlip) {
            p.curve *= -1;
            p.curveFlipped = true;
          }
          const angle = Math.atan2(p.vy, p.vx) + p.curve * dt;
          p.vx = Math.cos(angle) * p.speed;
          p.vy = Math.sin(angle) * p.speed;
        }
        if (p.trail) this.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, radius: p.radius * .8, color: p.color, ttl: .16, maxTtl: .16 });
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        let removed = false;
        if (p.explosive && p.proximityFuse > 0) {
          const nearby = this.players.find((target) => !target.dead && target.id !== p.ownerId && !(target.team === p.team && (this.config.mode === 'team' || this.isDefenseMode)) && Math.hypot(p.x - target.x, p.y - target.y) <= p.proximityFuse + target.radius);
          if (nearby) {
            this.explode(p.x, p.y, p.explosionRadius, p.damage, p.ownerId, p.team, null, p.sourceName, { sourceKey: p.sourceKey, activationId: p.activationId, projectileId: p.id });
            this.projectiles.splice(i, 1);
            continue;
          }
        }
        if (p.x < 0 || p.y < 0 || p.x > this.world.w || p.y > this.world.h || p.life <= 0) {
          if (p.explosive && p.life <= 0) this.explode(p.x, p.y, p.explosionRadius, p.damage, p.ownerId, p.team, null, p.sourceName, { sourceKey: p.sourceKey, activationId: p.activationId, projectileId: p.id });
          this.projectiles.splice(i, 1);
          continue;
        }

        for (const wall of this.walls) {
          if (p.x + p.radius < wall.x || p.x - p.radius > wall.x + wall.w || p.y + p.radius < wall.y || p.y - p.radius > wall.y + wall.h) continue;
          if (p.lead) {
            this.effects.push({ type: 'weight', x: p.x, y: p.y, ttl: 4.5, maxTtl: 4.5 });
          } else if (Number.isFinite(wall.hp)) {
            const prevented = Math.min(wall.hp, p.damage);
            wall.hp -= p.damage;
            if (wall.type === 'escudo') {
              const wallOwner = this.players.find((player) => player.id === wall.ownerId);
              if (wallOwner?.metrics) wallOwner.metrics.escudoDamagePrevented += prevented;
            }
          }
          if (p.explosive) this.explode(p.x, p.y, p.explosionRadius, p.damage, p.ownerId, p.team, null, p.sourceName, { sourceKey: p.sourceKey, activationId: p.activationId, projectileId: p.id });
          this.projectiles.splice(i, 1);
          removed = true;
          break;
        }
        if (removed) continue;

        for (const mine of this.mines) {
          if (Math.hypot(p.x - mine.x, p.y - mine.y) < p.radius + mine.radius) {
            this.detonateMine(mine);
            this.projectiles.splice(i, 1);
            removed = true;
            break;
          }
        }
        if (removed) continue;

        for (const facility of this.installations) {
          if (facility.hp <= 0 || (facility.team === p.team && (this.config.mode === 'team' || this.isDefenseMode))) continue;
          if (Math.hypot(p.x - facility.x, p.y - facility.y) < p.radius + facility.radius) {
            facility.hp -= Math.max(4, p.damage);
            if (p.explosive) this.explode(p.x, p.y, p.explosionRadius, p.damage, p.ownerId, p.team, null, p.sourceName, { sourceKey: p.sourceKey, activationId: p.activationId, projectileId: p.id });
            this.projectiles.splice(i, 1); removed = true; break;
          }
        }
        if (removed) continue;

        for (const light of this.lightSources) {
          if(light.hp<=0) continue;
          if (Math.hypot(p.x-light.x,p.y-light.y) < p.radius+light.radius) {
            light.hp-=Math.max(4,p.damage);
            if(p.explosive) this.explode(p.x,p.y,p.explosionRadius,p.damage,p.ownerId,p.team,null,p.sourceName,{sourceKey:p.sourceKey,activationId:p.activationId,projectileId:p.id});
            this.projectiles.splice(i,1); removed=true; break;
          }
        }
        if (removed) continue;

        for (const beacon of this.beacons) {
          if (beacon.team === p.team && (this.config.mode === 'team' || this.isDefenseMode)) continue;
          if (Math.hypot(p.x - beacon.x, p.y - beacon.y) < p.radius + beacon.radius) {
            beacon.hp -= Math.max(4, p.damage);
            if (p.explosive) this.explode(p.x, p.y, p.explosionRadius, p.damage, p.ownerId, p.team, null, p.sourceName, { sourceKey: p.sourceKey, activationId: p.activationId, projectileId: p.id });
            this.projectiles.splice(i, 1);
            removed = true;
            break;
          }
        }
        if (removed) continue;

        for (const target of this.players) {
          if (target.dead || target.id === p.ownerId || (target.team === p.team && (this.config.mode === 'team' || this.isDefenseMode))) continue;
          if (Math.hypot(p.x - target.x, p.y - target.y) >= p.radius + target.radius) continue;
          const owner = this.players.find((ownerPlayer) => ownerPlayer.id === p.ownerId) || null;
          if (p.lead) {
            target.leadWeights += p.leadWeight;
            target.slowTimer = Math.max(target.slowTimer, 7);
            this.effects.push({ type: 'weight', x: target.x, y: target.y, ttl: 7, maxTtl: 7 });
            if (owner?.metrics) {
              owner.metrics.leadBulletSlowSeconds += 7; owner.metrics.leadBulletWeightsApplied += p.leadWeight;
              this.registerEffectApplication(owner, p.effectSourceKey || 'leadBullet', p.effectSourceName || '鉛弾（レッドバレット）', target, 7, p.effectActivationId);
            }
            if (target.human) this.toast(`鉛弾：重し ${target.leadWeights}`);
          } else {
            this.markProjectileHit(owner, p.id, p.sourceKey);
            this.damagePlayer(target, p.damage, owner, { x: p.x, y: p.y, type: 'projectile', shieldPierce: p.shieldPierce, name: p.sourceName, sourceKey: p.sourceKey, activationId: p.activationId });
          }
          if (p.mark) {
            target.markedTimer = Math.max(target.markedTimer, p.markDuration);
            if (owner?.metrics) {
              owner.metrics.starmakerMarks += 1; owner.metrics.starmakerRevealSeconds += p.markDuration;
              this.registerEffectApplication(owner, p.effectSourceKey || 'starmaker', p.effectSourceName || 'スタアメーカー', target, p.markDuration, p.effectActivationId);
            }
          }
          if (p.explosive) this.explode(p.x, p.y, p.explosionRadius, p.damage, p.ownerId, p.team, target.id, p.sourceName, { sourceKey: p.sourceKey, activationId: p.activationId, projectileId: p.id });
          if (p.penetration > 0) {
            p.penetration -= 1;
            p.damage *= .72;
            p.x += p.vx * .02;
            p.y += p.vy * .02;
          } else {
            this.projectiles.splice(i, 1);
            removed = true;
          }
          break;
        }
      }
    }

    findClosestEnemyToProjectile(projectile) {
      let best = null;
      let bestD = Infinity;
      for (const target of this.players) {
        if (target.dead || target.id === projectile.ownerId || (target.team === projectile.team && (this.config.mode === 'team' || this.isDefenseMode))) continue;
        const d = (target.x - projectile.x) ** 2 + (target.y - projectile.y) ** 2;
        if (d < bestD) { best = target; bestD = d; }
      }
      return best;
    }

    damageWorldArc(x,y,angle,range,arc,damage,team){
      for(const wall of this.walls){if(!Number.isFinite(wall.hp)||wall.hp<=0)continue;const cx=wall.x+wall.w/2,cy=wall.y+wall.h/2,d=Math.hypot(cx-x,cy-y);if(d>range+Math.max(wall.w,wall.h)/2)continue;if(Math.abs(angleDiff(Math.atan2(cy-y,cx-x),angle))<=arc/2+.2)wall.hp-=damage;}
      for(const f of this.installations){if(f.hp<=0||(this.config.mode==='team'&&f.team===team))continue;const d=Math.hypot(f.x-x,f.y-y);if(d<=range+f.radius&&Math.abs(angleDiff(Math.atan2(f.y-y,f.x-x),angle))<=arc/2+.2)f.hp-=damage;}
      for(const light of this.lightSources){if(light.hp<=0)continue;const d=Math.hypot(light.x-x,light.y-y);if(d<=range+light.radius&&Math.abs(angleDiff(Math.atan2(light.y-y,light.x-x),angle))<=arc/2+.2)light.hp-=damage;}
    }
    damageWorldSegment(ax,ay,bx,by,damage,team,width=18){
      for(const wall of this.walls){if(!Number.isFinite(wall.hp)||wall.hp<=0)continue;const hit=segmentPointDistance(ax,ay,bx,by,wall.x+wall.w/2,wall.y+wall.h/2);if(hit.distance<width+Math.max(wall.w,wall.h)*.45)wall.hp-=damage;}
      for(const f of this.installations){if(f.hp<=0||(this.config.mode==='team'&&f.team===team))continue;const hit=segmentPointDistance(ax,ay,bx,by,f.x,f.y);if(hit.distance<width+f.radius)f.hp-=damage;}
      for(const light of this.lightSources){if(light.hp<=0)continue;const hit=segmentPointDistance(ax,ay,bx,by,light.x,light.y);if(hit.distance<width+light.radius)light.hp-=damage;}
    }

    explode(x, y, radius, damage, ownerId, team, excludeId = null, sourceName = 'メテオラ', context = {}) {
      this.sfx?.play('explosion', { x, y, bucket: `explosion:${Math.round(x / 80)}:${Math.round(y / 80)}`, cooldown: .1, volume: radius > 180 ? .68 : .52, rate: radius > 220 ? .88 : rand(.94, 1.06) });
      if (this.mapId === 'desert' && !context.gasChain) {
        const ignitionTargets = this.terrain.gasFields.filter((gas) => gas.active && Math.hypot(gas.x - x, gas.y - y) <= radius + gas.radius + 45);
        for (const gas of ignitionTargets) this.igniteGasField(gas, ownerId, team);
      }
      this.effects.push({ type: 'explosion', x, y, radius, ttl: .44, maxTtl: .44 });
      const owner = this.players.find((player) => player.id === ownerId) || null;
      let hitCount = 0;
      for (const target of this.players) {
        if (target.dead || target.id === excludeId || target.id === ownerId || (target.team === team && (this.config.mode === 'team' || this.isDefenseMode))) continue;
        const d = Math.hypot(target.x - x, target.y - y);
        if (d > radius + target.radius) continue;
        const scale = 1 - clamp(d / radius, 0, .82);
        this.damagePlayer(target, damage * scale, owner, { x, y, type: 'explosion', name: sourceName, sourceKey: context.sourceKey || sourceName, activationId: context.activationId || null });
        target.vx += (target.x - x) / Math.max(d, 1) * 190 * scale;
        target.vy += (target.y - y) / Math.max(d, 1) * 190 * scale;
        hitCount += 1;
      }
      for (const wall of this.walls) {
        if (!Number.isFinite(wall.hp) || wall.hp <= 0) continue;
        const cx=wall.x+wall.w/2,cy=wall.y+wall.h/2,d=Math.hypot(cx-x,cy-y);
        if(d<radius+Math.max(wall.w,wall.h)*.35) wall.hp-=damage*(1-clamp(d/(radius+1),0,.85))*.8;
      }
      for(const f of this.installations){if(f.hp<=0||((this.config.mode==='team'||this.isDefenseMode)&&f.team===team))continue;const d=Math.hypot(f.x-x,f.y-y);if(d<radius+f.radius)f.hp-=damage*(1-clamp(d/(radius+1),0,.85));}
      for(const beacon of this.beacons){if(beacon.hp<=0||((this.config.mode==='team'||this.isDefenseMode)&&beacon.team===team))continue;const d=Math.hypot(beacon.x-x,beacon.y-y);if(d<radius+(beacon.radius||9))beacon.hp-=damage*(1-clamp(d/(radius+1),0,.85));}
      for(const light of this.lightSources){if(light.hp<=0)continue;const d=Math.hypot(light.x-x,light.y-y);if(d<radius+light.radius)light.hp-=damage*(1-clamp(d/(radius+1),0,.85));}
      for (const mine of [...this.mines]) if (Math.hypot(mine.x - x, mine.y - y) < radius + 35) this.detonateMine(mine);
      for (const wire of this.wires) {
        const hit = segmentPointDistance(wire.x1, wire.y1, wire.x2, wire.y2, x, y);
        if (hit.distance < radius) wire.hp -= damage * .6;
      }
      if (hitCount > 0 && context.projectileId) this.markProjectileHit(owner, context.projectileId, context.sourceKey || sourceName);
      return hitCount;
    }

    detonateMine(mine) {
      const index = this.mines.indexOf(mine);
      if (index < 0) return;
      this.mines.splice(index, 1);
      this.explode(mine.x, mine.y, mine.explosionRadius, mine.damage, mine.ownerId, mine.team, null, mine.sourceName || ATTACK_LABELS.meteorMine, { sourceKey: mine.sourceKey || 'meteorMine', activationId: mine.activationId || null });
    }

    canDamage(attacker, target) {
      return !target.dead && attacker.id !== target.id && !((this.config.mode === 'team' || this.isDefenseMode) && attacker.team === target.team);
    }

    damagePlayer(target, amount, attacker, info = {}) {
      if (target.dead || amount <= 0 || target.invulnTimer > 0) return;
      if (target.isDefenseEnemy) {
        const sourceAngle = attacker ? Math.atan2(attacker.y - target.y, attacker.x - target.x) : 0;
        if (target.defenseType === 'rabbit' && attacker) {
          const front = Math.abs(angleDiff(sourceAngle, target.aim)) < 1.18;
          amount *= front ? .38 : 1.08;
        }
        if (target.defenseType === 'ilgar' && target.defenseAI?.selfDestruct) amount *= .44;
        if (target.defenseType === 'seals' && target.defenseAI?.shieldTimer > 0) amount *= .28;
        if (target.defenseType === 'borboros' && ['liquid', 'gas'].includes(target.defenseAI?.phase)) amount *= .08;
        if (target.defenseType === 'ilgar' && attacker && target.defenseAI?.rearBurstCooldown <= 0) {
          const behind = Math.abs(Math.abs(angleDiff(sourceAngle, target.aim)) - Math.PI) < .78;
          if (behind) {
            target.defenseAI.rearBurstCooldown = 5.5;
            const bx = target.x - Math.cos(target.aim) * target.radius * .75;
            const by = target.y - Math.sin(target.aim) * target.radius * .75;
            this.queueDefenseHazard({ type: 'circle', x: bx, y: by, radius: 120, delay: .32, damage: target.defenseAI.damage * .65, owner: target, name: 'イルガー背面迎撃', color: '#ffd859' });
          }
        }
      }
      target.lastDamageAt = this.elapsed;
      if (target.ai && attacker && attacker.id !== target.id) target.ai.lastHostileContactAt = this.elapsed;
      const attackAngle = Math.atan2(info.y - target.y, info.x - target.x);
      const shields = Object.values(target.shields).filter(Boolean);
      let blocked = false;
      if (!info.shieldPierce && shields.length) {
        const fullGuard = shields.length >= 2;
        const facing = target.aim;
        const inArc = Math.abs(angleDiff(attackAngle, facing)) < 1.18;
        if (fullGuard || inArc) {
          const movementPenalty = Math.hypot(target.vx, target.vy) > target.speed * .25 ? .74 : 1;
          const shieldStrength = shields.reduce((sum, shield) => sum + shield.strength, 0) * movementPenalty;
          const trionCost = amount * .12 / Math.max(shieldStrength, .4);
          if (target.trion >= trionCost) {
            target.trion -= trionCost;
            target.metrics.trionSpent += trionCost;
            target.metrics.blockedDamage += amount;
            target.metrics.shieldDamagePrevented += amount;
            target.metrics.shieldBlocks += 1;
            blocked = true;
            this.effects.push({ type: 'shieldHit', x: target.x, y: target.y, angle: attackAngle, ttl: .18, maxTtl: .18 });
          }
        }
      }
      if (blocked) return;
      const effectiveDamage = Math.min(target.hp, amount);
      target.hp -= amount;
      target.metrics.damageTaken += effectiveDamage;
      if (attacker && attacker.metrics && attacker.id !== target.id) {
        attacker.metrics.damageDealt += effectiveDamage;
        const sourceName = info.name || '攻撃';
        const sourceKey = info.sourceKey || sourceName;
        attacker.metrics.triggerDamage[sourceName] = (attacker.metrics.triggerDamage[sourceName] || 0) + effectiveDamage;
        const stat = this.ensureTriggerStat(attacker, sourceKey, sourceName);
        stat.name = sourceName;
        stat.damage += effectiveDamage;
        if (sourceKey === 'switchboxAttack') attacker.metrics.switchboxDamage += effectiveDamage;
        if (info.type === 'melee') attacker.metrics.meleeHits += 1;
        if (info.type === 'projectile' || info.type === 'explosion') attacker.metrics.projectileHits += 1;
        this.registerActivationHit(attacker, { ...info, sourceKey }, target);
        const contribution = target.damageContributors.get(attacker.id) || { damage: 0, lastHit: 0 };
        contribution.damage += effectiveDamage;
        contribution.lastHit = this.elapsed;
        target.damageContributors.set(attacker.id, contribution);
        if (target.hp <= 0) stat.kills += 1;
      }
      this.effects.push({ type: 'hit', x: target.x, y: target.y, ttl: .2, maxTtl: .2 });
      if (target.hp <= 0) {
        if (target.isDefenseEnemy) this.defeatDefenseEnemy(target, attacker, info.name || '攻撃');
        else this.bailout(target, attacker, info.name || '攻撃', { kind: 'combat' });
      }
    }

    bailout(target, attacker, sourceName, context = {}) {
      if (target.dead) return;
      target.metrics.longestLife = Math.max(target.metrics.longestLife, target.metrics.currentLife);
      target.hp = 0;
      target.dead = true;
      target.respawnTimer = 4.2;
      const kind = context.kind || (attacker ? 'combat' : 'other');
      if (kind === 'combat') { target.deaths += 1; target.metrics.combatDeaths += 1; }
      if (kind === 'manual') target.metrics.manualBailouts += 1;
      if (kind === 'spectate') target.metrics.spectateTransitions += 1;
      target.toggles.bagworm = false;
      target.toggles.bagwormTag = false;
      target.toggles.chameleon = false;
      const existingTemporary = this.pickups.filter((pickup) => pickup.temporary).length;
      const dropCount = Math.max(0, Math.min(4, MAX_TEMP_PICKUPS - existingTemporary));
      for (let i = 0; i < dropCount; i++) {
        this.pickups.push(this.makePickup(target.x + rand(-35, 35), target.y + rand(-35, 35), rand(2, 5), { temporary: true, ttl: rand(12, 15) }));
      }
      this.pickupStats.temporarySpawned += dropCount;
      this.pickupStats.peakTotal = Math.max(this.pickupStats.peakTotal, this.pickups.length);
      this.effects.push({ type: 'bailout', x: target.x, y: target.y, ttl: .9, maxTtl: .9 });
      if (attacker && attacker.id !== target.id) {
        attacker.kills += 1;
        attacker.score += 100;
        if (this.config.mode === 'team') this.teamScores[attacker.team] += 100;
        for (const [contributorId, contribution] of target.damageContributors.entries()) {
          if (contributorId === attacker.id || this.elapsed - contribution.lastHit > 8 || contribution.damage < 10) continue;
          const contributor = this.players.find((player) => player.id === contributorId);
          if (!contributor || contributor.dead && this.elapsed - contribution.lastHit > 5) continue;
          contributor.metrics.assists += 1;
          contributor.score += 30;
          if (this.config.mode === 'team') this.teamScores[contributor.team] += 30;
          this.logEvent('assist', `${contributor.name} → ${target.name} [${Math.round(contribution.damage)} damage]`);
        }
        this.addKillFeed(`${attacker.name} → ${target.name}［${sourceName}］`);
        this.logEvent('bailout', `${attacker.name} → ${target.name} [${sourceName}]`);
      } else {
        if (kind === 'manual' && context.ai) {
          this.addKillFeed(`${target.name} 自主BAIL OUT`);
          this.logEvent('bailout', `${target.name} [自主ベイルアウト・キルなし]`);
        } else {
          this.addKillFeed(`${target.name} BAILED OUT`);
          this.logEvent('bailout', `${target.name} [${sourceName}]`);
        }
      }
      target.damageContributors.clear();
      if (target.human) this.showCenterMessage('BAIL OUT', this.spectating ? '観戦中' : '4秒後に復帰 / Vで観戦', 2.8);
    }

    updateWorldObjects(dt) {
      for (let i = this.walls.length - 1; i >= 0; i--) {
        const wall = this.walls[i];
        if (wall.type === 'building') continue;
        wall.ttl -= dt;
        if (wall.ttl <= 0 || wall.hp <= 0) {
          const destroyed=wall.hp<=0;
          if(destroyed&&['tree','buildingWall','fortressWall','bridge','barricade'].includes(wall.type)){ this.lifecycleStats.terrainDestroyed += 1; this.logEvent('terrain_destroyed',`${wall.type}:${wall.id}`,false); }
          if(!destroyed&&wall.ttl<=0&&!wall.respawnable) this.lifecycleStats.placedDespawned += 1;
          if(destroyed&&wall.respawnable){
            const delay=Array.isArray(wall.respawnDelay)?rand(wall.respawnDelay[0],wall.respawnDelay[1]):60;
            this.worldRespawns.push({timer:delay,template:{...wall,hp:wall.maxHp,ttl:Infinity,destroyedLogged:false}});
          }
          this.walls.splice(i, 1);
        }
      }
      for(let i=this.worldRespawns.length-1;i>=0;i--){
        const item=this.worldRespawns[i]; item.timer-=dt;
        if(item.timer>0) continue;
        const wall=item.template;
        const cx=wall.x+wall.w/2,cy=wall.y+wall.h/2;
        if(this.players.some(p=>!p.dead&&Math.hypot(p.x-cx,p.y-cy)<Math.max(75,Math.max(wall.w,wall.h)*.7))){ item.timer=3; continue; }
        if(!this.walls.some(w=>w.id===wall.id)) this.walls.push({...wall});
        this.worldRespawns.splice(i,1);
        this.lifecycleStats.terrainRespawned += 1; this.logEvent('terrain_respawn',`${wall.type}:${wall.id}`,false);
      }
      for (let i = this.wires.length - 1; i >= 0; i--) {
        const wire = this.wires[i];
        wire.ttl -= dt;
        if (wire.ttl <= 0 || wire.hp <= 0) this.wires.splice(i, 1);
      }
      for (let i = this.mines.length - 1; i >= 0; i--) {
        this.mines[i].ttl -= dt;
        if (this.mines[i].ttl <= 0 || this.mines[i].hp <= 0) this.mines.splice(i, 1);
      }
      for (let i = this.beacons.length - 1; i >= 0; i--) {
        const beacon = this.beacons[i];
        beacon.ttl -= dt;
        beacon.vx = Number.isFinite(beacon.vx) ? beacon.vx : rand(-32, 32);
        beacon.vy = Number.isFinite(beacon.vy) ? beacon.vy : rand(-32, 32);
        beacon.maxHp = beacon.maxHp || beacon.hp || 22;
        beacon.exposedTeams ||= {};
        beacon.x += beacon.vx * dt;
        beacon.y += beacon.vy * dt;
        if (beacon.x < 20 || beacon.x > this.world.w - 20) beacon.vx *= -1;
        if (beacon.y < 20 || beacon.y > this.world.h - 20) beacon.vy *= -1;
        if (Math.random() < (beacon.defenseDecoy ? .004 : .015)) {
          const limit = beacon.defenseDecoy ? 14 : 55;
          beacon.vx = rand(-limit, limit);
          beacon.vy = rand(-limit, limit);
        }
        if (beacon.ttl <= 0 || beacon.hp <= 0) this.beacons.splice(i, 1);
      }
      for (let i = this.traps.length - 1; i >= 0; i--) {
        const trap = this.traps[i];
        trap.ttl -= dt;
        trap.armed -= dt;
        if (trap.ttl <= 0 || trap.hp <= 0) {
          this.traps.splice(i, 1);
          continue;
        }
        if (trap.armed > 0) continue;
        const owner = this.players.find((p) => p.id === trap.ownerId) || null;
        for (const target of this.players) {
          if (target.dead || target.id === trap.ownerId) continue;
          const ally = (this.config.mode === 'team' || this.isDefenseMode) && target.team === trap.team;
          const d = Math.hypot(target.x - trap.x, target.y - trap.y);
          if (d > 68 + target.radius) continue;
          if (trap.type === 0 && !ally) {
            if (owner?.metrics) {
              owner.metrics.switchboxTriggers += 1;
              this.awardSupport(owner, 10);
              const switchStat = this.ensureTriggerStat(owner, 'switchboxAttack', ATTACK_LABELS.switchboxAttack);
              switchStat.uses += 1; switchStat.automaticActivations += 1; switchStat.damageTriggers += 1;
            }
            this.logEvent('trap_trigger', `${owner?.name || 'UNKNOWN'} 攻撃トラップ起動`);
            this.explode(trap.x, trap.y, 105, 48, trap.ownerId, trap.team, null, ATTACK_LABELS.switchboxAttack, { sourceKey: 'switchboxAttack', activationId: trap.activationId || null });
            this.traps.splice(i, 1);
            break;
          }
          if (trap.type === 1 && !ally) {
            target.slowTimer = Math.max(target.slowTimer, 4.5);
            target.slowFactor = .3;
            if (owner?.metrics) {
              owner.metrics.switchboxTriggers += 1;
              owner.metrics.spiderSlowSeconds += 4.5;
              this.awardSupport(owner, 15);
              const switchStat = this.ensureTriggerStat(owner, 'switchbox', 'スイッチボックス');
              switchStat.automaticActivations += 1; switchStat.effectApplications += 1; switchStat.effectDurationSeconds += 4.5;
            }
            this.logEvent('trap_trigger', `${owner?.name || 'UNKNOWN'} 拘束トラップ起動`);
            this.effects.push({ type: 'bind', x: target.x, y: target.y, ttl: .65, maxTtl: .65 });
            this.traps.splice(i, 1);
            break;
          }
          if (trap.type === 2 && (ally || this.config.mode === 'solo' && target.id === trap.ownerId)) {
            const angle = target.aim;
            target.vx += Math.cos(angle) * 520;
            target.vy += Math.sin(angle) * 520;
            this.effects.push({ type: 'grasshopper', x: trap.x, y: trap.y, angle, ttl: .5, maxTtl: .5 });
            this.traps.splice(i, 1);
            break;
          }
        }
      }
    }

    updatePickups(dt) {
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pickup = this.pickups[i];
        pickup.pulse += dt * 2.2;
        if (pickup.temporary) {
          pickup.ttl -= dt;
          if (pickup.ttl <= 0) {
            this.pickups.splice(i, 1);
            this.pickupStats.temporaryExpired += 1;
            continue;
          }
        }
        if (!pickup.active) {
          if (pickup.temporary) {
            this.pickups.splice(i, 1);
            continue;
          }
          pickup.respawn -= dt;
          if (pickup.respawn <= 0) {
            const point = this.randomOpenPoint();
            pickup.x = point.x;
            pickup.y = point.y;
            pickup.active = true;
          }
          continue;
        }
        for (const p of this.players) {
          if (p.dead || (pickup.team !== null && pickup.team !== p.team) || Math.hypot(p.x - pickup.x, p.y - pickup.y) > p.radius + pickup.radius + 3) continue;
          const trionBefore = p.trion;
          p.trion = Math.min(p.maxTrion, p.trion + pickup.value * 2.5);
          const gained = p.trion - trionBefore;
          p.metrics.pickups += 1;
          p.metrics.pickupTrionGained += gained;
          p.score += pickup.scoreValue;
          p.metrics.pickupScore += pickup.scoreValue;
          if (this.config.mode === 'team') this.teamScores[p.team] += pickup.scoreValue;
          if (pickup.temporary) this.pickups.splice(i, 1);
          else {
            pickup.active = false;
            pickup.respawn = rand(7, 14);
          }
          break;
        }
      }
      this.pickupStats.peakTotal = Math.max(this.pickupStats.peakTotal, this.pickups.length);
    }

    updateEffects(dt) {
      for (let i = this.effects.length - 1; i >= 0; i--) {
        this.effects[i].ttl -= dt;
        if (this.effects[i].ttl <= 0) this.effects.splice(i, 1);
      }
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.ttl -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.ttl <= 0) this.particles.splice(i, 1);
      }
    }

    updateCamera(dt) {
      if (this.isPlayerOperator) {
        this.camera.x = lerp(this.camera.x, this.operatorCamera.x - this.viewW / 2, 1 - Math.pow(.0015, dt));
        this.camera.y = lerp(this.camera.y, this.operatorCamera.y - this.viewH / 2, 1 - Math.pow(.0015, dt));
      } else {
        const focus = this.spectating ? (this.getSpectatorTarget() || this.players[0]) : this.human;
        if (!focus) return;
        const targetX = focus.x - this.viewW / 2;
        const targetY = focus.y - this.viewH / 2;
        this.camera.x = lerp(this.camera.x, targetX, 1 - Math.pow(.0008, dt));
        this.camera.y = lerp(this.camera.y, targetY, 1 - Math.pow(.0008, dt));
      }
      this.camera.x = clamp(this.camera.x, 0, Math.max(0, this.world.w - this.viewW));
      this.camera.y = clamp(this.camera.y, 0, Math.max(0, this.world.h - this.viewH));
    }

    revealOnAttack(p, duration) {
      p.revealTimer = Math.max(p.revealTimer, duration);
    }

    findTargetNearAim(p, radius) {
      const aimPoint = p.human ? this.getHumanAimPoint(p, radius) : { x: p.x + Math.cos(p.aim) * radius, y: p.y + Math.sin(p.aim) * radius };
      let best = null;
      let bestScore = Infinity;
      for (const target of this.players) {
        if (!this.canDamage(p, target)) continue;
        const cursorDistance = Math.hypot(target.x - aimPoint.x, target.y - aimPoint.y);
        const angle = Math.abs(angleDiff(Math.atan2(target.y - p.y, target.x - p.x), p.aim));
        const score = cursorDistance + angle * 160;
        if (cursorDistance < radius && score < bestScore) { best = target; bestScore = score; }
      }
      return best;
    }

    screenToWorld(x, y) { return { x: x + this.camera.x, y: y + this.camera.y }; }
    worldToScreen(x, y) { return { x: x - this.camera.x, y: y - this.camera.y }; }

    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.viewW, this.viewH);
      ctx.fillStyle = '#06131d';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      if (this.onlineMirror && !this.onlineWorldReady) {
        const pulse = .55 + Math.sin(performance.now() / 260) * .16;
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(101,232,255,${pulse})`;
        ctx.font = '900 18px Inter, sans-serif';
        ctx.fillText('戦場を同期中', this.viewW / 2, this.viewH / 2 - 4);
        ctx.fillStyle = 'rgba(234,250,255,.58)';
        ctx.font = '700 11px Inter, sans-serif';
        ctx.fillText('ホストから初期状態を受信しています', this.viewW / 2, this.viewH / 2 + 21);
        return;
      }
      ctx.save();
      ctx.translate(-this.camera.x, -this.camera.y);
      this.drawTerrain(ctx);
      this.drawGrid(ctx);
      this.drawArenaBounds(ctx);
      this.drawPickups(ctx);
      this.drawWires(ctx);
      this.drawWalls(ctx);
      this.drawInstallations(ctx);
      this.drawDesertFeatures(ctx);
      this.drawLightSources(ctx);
      this.drawDefenseFlag(ctx);
      this.drawDefenseHazards(ctx);
      this.drawOperatorOrders(ctx);
      this.drawMinesTrapsBeacons(ctx);
      this.drawProjectiles(ctx);
      this.drawPlayers(ctx);
      this.drawEffects(ctx);
      ctx.restore();
      this.drawScreenVignette(ctx);
      this.drawEnvironmentOverlay(ctx);
    }

    drawCubeRect(ctx,x,y,w,h,front='#153848',top='#1e5265',side='#0a2633'){
      ctx.fillStyle=front;ctx.fillRect(x,y,w,h);const d=Math.min(10,w*.18,h*.18);
      ctx.fillStyle=top;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+d,y-d);ctx.lineTo(x+w+d,y-d);ctx.lineTo(x+w,y);ctx.closePath();ctx.fill();
      ctx.fillStyle=side;ctx.beginPath();ctx.moveTo(x+w,y);ctx.lineTo(x+w+d,y-d);ctx.lineTo(x+w+d,y+h-d);ctx.lineTo(x+w,y+h);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(101,232,255,.2)';ctx.strokeRect(x,y,w,h);
    }
    drawTerrain(ctx) {
      const size = this.terrainChunkSize;
      const minCx = Math.max(0, Math.floor(this.camera.x / size));
      const maxCx = Math.min(Math.ceil(this.world.w / size) - 1, Math.floor((this.camera.x + this.viewW) / size));
      const minCy = Math.max(0, Math.floor(this.camera.y / size));
      const maxCy = Math.min(Math.ceil(this.world.h / size) - 1, Math.floor((this.camera.y + this.viewH) / size));
      for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cx = minCx; cx <= maxCx; cx++) {
          const chunk = this.getTerrainChunk(cx, cy);
          ctx.drawImage(chunk.canvas, chunk.x, chunk.y);
        }
      }
    }

    getTerrainChunk(cx, cy) {
      const key = `${cx}:${cy}`;
      const existing = this.terrainChunks.get(key);
      if (existing) {
        existing.lastUsed = this.elapsed;
        return existing;
      }
      const size = this.terrainChunkSize;
      const x = cx * size;
      const y = cy * size;
      const width = Math.min(size, this.world.w - x);
      const height = Math.min(size, this.world.h - y);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const chunk = { canvas, x, y, width, height, lastUsed: this.elapsed };
      this.renderTerrainChunk(chunk);
      this.terrainChunks.set(key, chunk);
      if (this.terrainChunks.size > this.maxTerrainChunks) {
        let oldestKey = null;
        let oldestTime = Infinity;
        for (const [candidateKey, candidate] of this.terrainChunks.entries()) {
          if (candidateKey === key) continue;
          if (candidate.lastUsed < oldestTime) { oldestTime = candidate.lastUsed; oldestKey = candidateKey; }
        }
        if (oldestKey) this.terrainChunks.delete(oldestKey);
      }
      return chunk;
    }

    renderTerrainChunk(chunk) {
      if (this.mapId === 'desert') this.renderDesertTerrainChunk(chunk);
      else this.renderCityTerrainChunk(chunk);
    }

    renderDesertTerrainChunk(chunk) {
      const ctx = chunk.canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(-chunk.x, -chunk.y);
      ctx.beginPath(); ctx.rect(chunk.x, chunk.y, chunk.width, chunk.height); ctx.clip();
      const x0=chunk.x,y0=chunk.y,x1=x0+chunk.width,y1=y0+chunk.height;
      const sand=['#d9b968','#e3c578','#cfaa58','#ebcf86'];
      ctx.fillStyle='#d5b360'; ctx.fillRect(x0,y0,chunk.width,chunk.height);
      const sx0=Math.floor(x0/32)*32,sy0=Math.floor(y0/32)*32;
      for(let y=sy0;y<y1;y+=32){
        for(let x=sx0;x<x1;x+=32){
          const index=((x/32|0)*3+(y/32|0)*5)%sand.length;
          ctx.fillStyle=sand[index];ctx.fillRect(x,y,32,32);
          ctx.fillStyle='rgba(255,246,190,.12)';ctx.fillRect(x+4,y+5,14,3);
          ctx.fillStyle='rgba(112,75,30,.08)';ctx.fillRect(x+21,y+22,7,3);
        }
      }
      for(const dune of this.terrain.dunes){
        if(dune.x>x1||dune.x+dune.w<x0||dune.y>y1||dune.y+dune.h<y0)continue;
        ctx.fillStyle='rgba(235,202,118,.32)';ctx.fillRect(dune.x,dune.y,dune.w,dune.h);
        ctx.strokeStyle='rgba(126,83,32,.14)';ctx.lineWidth=7;
        for(let y=dune.y+36;y<dune.y+dune.h;y+=66){ctx.beginPath();for(let x=dune.x;x<=dune.x+dune.w;x+=48){const yy=y+Math.sin((x+dune.x)*.012)*18;if(x===dune.x)ctx.moveTo(x,yy);else ctx.lineTo(x,yy)}ctx.stroke()}
      }
      for(const road of this.terrain.roads){
        if(road.x>x1||road.x+road.w<x0||road.y>y1||road.y+road.h<y0)continue;
        ctx.fillStyle='#b89452';ctx.fillRect(road.x,road.y,road.w,road.h);
        ctx.strokeStyle='rgba(248,224,156,.28)';ctx.setLineDash([24,20]);ctx.beginPath();
        if(road.w>road.h){ctx.moveTo(road.x,road.y+road.h/2);ctx.lineTo(road.x+road.w,road.y+road.h/2)}else{ctx.moveTo(road.x+road.w/2,road.y);ctx.lineTo(road.x+road.w/2,road.y+road.h)}ctx.stroke();ctx.setLineDash([]);
      }
      for(const cliff of this.terrain.cliffs){
        if(cliff.x>x1||cliff.x+cliff.w<x0||cliff.y>y1||cliff.y+cliff.h<y0)continue;
        ctx.fillStyle='#8e643d';ctx.fillRect(cliff.x,cliff.y,cliff.w,cliff.h);
        ctx.strokeStyle='#c69a5b';ctx.lineWidth=8;ctx.strokeRect(cliff.x+4,cliff.y+4,cliff.w-8,cliff.h-8);
        ctx.fillStyle='rgba(255,232,171,.55)';
        const count=cliff.w>cliff.h?Math.floor(cliff.w/90):Math.floor(cliff.h/90);
        for(let i=0;i<count;i++){
          const cx=cliff.w>cliff.h?cliff.x+45+i*90:cliff.x+cliff.w/2;
          const cy=cliff.w>cliff.h?cliff.y+cliff.h/2:cliff.y+45+i*90;
          ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.atan2(cliff.dirY,cliff.dirX));ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(-10,-11);ctx.lineTo(-10,11);ctx.closePath();ctx.fill();ctx.restore();
        }
      }
      for(const zone of this.terrain.quicksand){
        const r=zone.radius;if(zone.x+r<x0||zone.x-r>x1||zone.y+r<y0||zone.y-r>y1)continue;
        const g=ctx.createRadialGradient(zone.x,zone.y,20,zone.x,zone.y,r);g.addColorStop(0,'#9e773f');g.addColorStop(.55,'#bd9450');g.addColorStop(1,'rgba(199,164,92,.08)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(zone.x,zone.y,r,0,TAU);ctx.fill();
        ctx.strokeStyle='rgba(88,55,25,.28)';for(let ring=.35;ring<1;ring+=.2){ctx.beginPath();ctx.arc(zone.x,zone.y,r*ring,0,TAU);ctx.stroke()}
      }
      for(const oasis of this.terrain.oases){
        const r=oasis.radius;if(oasis.x+r<x0||oasis.x-r>x1||oasis.y+r<y0||oasis.y-r>y1)continue;
        ctx.fillStyle='rgba(72,142,69,.55)';ctx.beginPath();ctx.arc(oasis.x,oasis.y,r+48,0,TAU);ctx.fill();
        ctx.fillStyle='#43a5b7';ctx.beginPath();ctx.arc(oasis.x,oasis.y,r,0,TAU);ctx.fill();
        ctx.strokeStyle='rgba(196,247,241,.38)';ctx.lineWidth=7;ctx.beginPath();ctx.arc(oasis.x,oasis.y,r*.72,0,TAU);ctx.stroke();
        ctx.fillStyle='#347649';for(let i=0;i<12;i++){const a=i/12*TAU,rr=r+28;ctx.fillRect(oasis.x+Math.cos(a)*rr-7,oasis.y+Math.sin(a)*rr-17,14,34)}
      }
      for(const fortress of this.terrain.fortresses){
        if(fortress.x>x1||fortress.x+fortress.w<x0||fortress.y>y1||fortress.y+fortress.h<y0)continue;
        ctx.fillStyle='#8b6c43';ctx.fillRect(fortress.x,fortress.y,fortress.w,fortress.h);
        ctx.fillStyle='#a78955';ctx.fillRect(fortress.x+42,fortress.y+42,fortress.w-84,fortress.h-84);
        for(let yy=fortress.y+48;yy<fortress.y+fortress.h-48;yy+=32)for(let xx=fortress.x+48;xx<fortress.x+fortress.w-48;xx+=32){ctx.strokeStyle='rgba(66,44,25,.2)';ctx.strokeRect(xx,yy,30,30)}
      }
      for(const gas of this.terrain.gasFields){
        const r=gas.radius;if(gas.x+r<x0||gas.x-r>x1||gas.y+r<y0||gas.y-r>y1)continue;
        ctx.fillStyle='rgba(70,91,50,.18)';ctx.beginPath();ctx.arc(gas.x,gas.y,r,0,TAU);ctx.fill();
        ctx.strokeStyle='rgba(68,92,48,.45)';ctx.setLineDash([10,8]);ctx.beginPath();ctx.arc(gas.x,gas.y,r*.72,0,TAU);ctx.stroke();ctx.setLineDash([]);
      }
      ctx.restore();
    }

    renderCityTerrainChunk(chunk) {
      const ctx = chunk.canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(-chunk.x, -chunk.y);
      ctx.beginPath();
      ctx.rect(chunk.x, chunk.y, chunk.width, chunk.height);
      ctx.clip();
      const x0 = chunk.x, y0 = chunk.y, x1 = x0 + chunk.width, y1 = y0 + chunk.height;
      const grass = ['#6ea55d','#79b266','#86bc72','#6aa15a'];
      const dirt = ['#85715d','#9b856f','#ac987d'];
      ctx.fillStyle = '#5f9551';
      ctx.fillRect(x0, y0, chunk.width, chunk.height);
      const tileStartX = Math.floor(x0 / 32) * 32;
      const tileStartY = Math.floor(y0 / 32) * 32;
      for (let y = tileStartY; y < y1; y += 32) {
        for (let x = tileStartX; x < x1; x += 32) {
          ctx.fillStyle = grass[((x / 32 | 0) + (y / 32 | 0)) % grass.length];
          ctx.fillRect(x, y, 32, 32);
          ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(x + 4, y + 4, 6, 6);
          ctx.fillStyle = 'rgba(0,0,0,.04)'; ctx.fillRect(x + 18, y + 18, 5, 5);
        }
      }
      for (const r of this.terrain.roads) {
        if (r.x > x1 || r.x + r.w < x0 || r.y > y1 || r.y + r.h < y0) continue;
        ctx.fillStyle = dirt[0]; ctx.fillRect(r.x, r.y, r.w, r.h);
        const sx = Math.floor(Math.max(r.x, x0) / 16) * 16;
        const sy = Math.floor(Math.max(r.y, y0) / 16) * 16;
        for (let y = sy; y < Math.min(r.y + r.h, y1); y += 16) for (let x = sx; x < Math.min(r.x + r.w, x1); x += 16) {
          if (x < r.x || y < r.y) continue;
          ctx.fillStyle = dirt[((x / 16 | 0) + (y / 16 | 0)) % dirt.length]; ctx.fillRect(x, y, 16, 16);
        }
        ctx.strokeStyle = 'rgba(250,240,220,.18)'; ctx.beginPath();
        if (r.w > r.h) {
          for (let x = Math.max(r.x + 10, x0 - 30); x < Math.min(r.x + r.w, x1 + 30); x += 30) { ctx.moveTo(x, r.y + r.h / 2); ctx.lineTo(Math.min(x + 14, r.x + r.w), r.y + r.h / 2); }
        } else {
          for (let y = Math.max(r.y + 10, y0 - 30); y < Math.min(r.y + r.h, y1 + 30); y += 30) { ctx.moveTo(r.x + r.w / 2, y); ctx.lineTo(r.x + r.w / 2, Math.min(y + 14, r.y + r.h)); }
        }
        ctx.stroke();
      }
      for (const r of this.terrain.plazas) {
        if (r.x > x1 || r.x + r.w < x0 || r.y > y1 || r.y + r.h < y0) continue;
        ctx.fillStyle = '#8c7b65'; ctx.fillRect(r.x, r.y, r.w, r.h);
        const sx = Math.floor(Math.max(r.x, x0) / 32) * 32;
        const sy = Math.floor(Math.max(r.y, y0) / 32) * 32;
        for (let y = sy; y < Math.min(r.y + r.h, y1); y += 32) for (let x = sx; x < Math.min(r.x + r.w, x1); x += 32) {
          if (x < r.x || y < r.y) continue;
          this.drawCubeRect(ctx, x, y, 32, 32, '#8d7a64', '#a48e74', '#6b5947');
        }
      }
      const river = this.terrain.rivers[0];
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#4aa5c7'; ctx.lineWidth = river.width; ctx.beginPath();
      for (let x = Math.max(0, x0 - 180); x <= Math.min(this.world.w, x1 + 180); x += 42) { const y = this.riverCenterAt(x); if (x === Math.max(0, x0 - 180)) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
      ctx.lineWidth = river.width * .52; ctx.strokeStyle = 'rgba(191,237,255,.28)'; ctx.beginPath();
      let first = true;
      for (let x = Math.max(0, x0 - 180); x <= Math.min(this.world.w, x1 + 180); x += 56) { const y = this.riverCenterAt(x); if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); } ctx.stroke();
      for (const r of this.terrain.forests) {
        if (r.x > x1 || r.x + r.w < x0 || r.y > y1 || r.y + r.h < y0) continue;
        ctx.fillStyle = 'rgba(42,94,57,.22)'; ctx.fillRect(r.x, r.y, r.w, r.h);
        const sx = r.x + 10 + Math.max(0, Math.floor((x0 - r.x - 10) / 30)) * 30;
        const sy = r.y + 10 + Math.max(0, Math.floor((y0 - r.y - 10) / 30)) * 30;
        for (let y = sy; y < Math.min(r.y + r.h, y1); y += 30) for (let x = sx; x < Math.min(r.x + r.w, x1); x += 30) {
          this.drawCubeRect(ctx, x, y, 12, 14, '#2c6f45', '#4e9a62', '#234f36');
          ctx.fillStyle = '#70bb72'; ctx.fillRect(x - 3, y - 6, 18, 8);
        }
      }
      for (const b of this.terrain.buildings) {
        if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
        this.drawCubeRect(ctx, b.x, b.y, b.w, b.h, '#8d6e5f', '#b08e7b', '#6c5247');
        ctx.fillStyle = '#c7b7a5'; ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 8);
        for (let y = b.y + 18; y < b.y + b.h - 10; y += 18) for (let x = b.x + 8; x < b.x + b.w - 8; x += 18) { ctx.fillStyle = 'rgba(236,245,255,.38)'; ctx.fillRect(x, y, 8, 10); }
      }
      ctx.restore();
    }

    drawDesertFeatures(ctx){
      if(this.mapId!=='desert') return;
      for(const gas of this.terrain.gasFields){
        if(!this.inView(gas.x,gas.y,gas.radius+90)) continue;
        if(gas.active){
          for(let i=0;i<6;i++){
            const a=i/6*TAU+this.elapsed*.17,rr=gas.radius*(.18+(i%3)*.16);
            const x=gas.x+Math.cos(a)*rr,y=gas.y+Math.sin(a)*rr;
            const glow=ctx.createRadialGradient(x,y,4,x,y,48);
            glow.addColorStop(0,'rgba(168,191,105,.34)');glow.addColorStop(1,'rgba(76,96,54,0)');
            ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,48,0,TAU);ctx.fill();
          }
          ctx.fillStyle='#5e7046';ctx.fillRect(gas.x-14,gas.y-8,28,16);
          ctx.fillStyle='#9db36a';ctx.fillRect(gas.x-5,gas.y-20,10,14);
        }else{
          ctx.strokeStyle='rgba(96,79,47,.45)';ctx.strokeRect(gas.x-18,gas.y-18,36,36);
        }
      }
    }

    drawLightSources(ctx){
      for(const light of this.lightSources){
        if(light.hp<=0||!this.inView(light.x,light.y,light.lightRadius+30)) continue;
        if(this.environment.timeOfDay==='night'||light.fire){
          const glow=ctx.createRadialGradient(light.x,light.y,4,light.x,light.y,light.fire?68:55);
          glow.addColorStop(0,light.fire?'rgba(255,191,74,.72)':'rgba(255,241,170,.55)');
          glow.addColorStop(1,'rgba(255,220,120,0)');
          ctx.fillStyle=glow;ctx.beginPath();ctx.arc(light.x,light.y,light.fire?68:55,0,TAU);ctx.fill();
        }
        if(light.fire){
          ctx.fillStyle='#57402c';ctx.fillRect(light.x-5,light.y-4,10,20);
          ctx.fillStyle='#ffb13b';ctx.beginPath();ctx.moveTo(light.x,light.y-22);ctx.lineTo(light.x-10,light.y-5);ctx.lineTo(light.x,light.y);ctx.lineTo(light.x+10,light.y-5);ctx.closePath();ctx.fill();
          ctx.fillStyle='#fff1a2';ctx.fillRect(light.x-3,light.y-12,6,9);
        }else{
          this.drawCubeRect(ctx,light.x-7,light.y-10,14,22,'#59616a','#818b93','#353b42');
          ctx.fillStyle='#fff1a8';ctx.fillRect(light.x-9,light.y-18,18,10);
          ctx.strokeStyle='rgba(255,252,210,.9)';ctx.strokeRect(light.x-9,light.y-18,18,10);
        }
      }
    }

    drawInstallations(ctx){for(const f of this.installations){if(f.hp<=0||!this.inView(f.x,f.y,80))continue;const color=f.active?(this.teamColors[f.team]||'#2daed0'):'#495a61';this.drawCubeRect(ctx,f.x-18,f.y-18,36,36,color,tintColor(color,.2),tintColor(color,-.12));ctx.fillStyle='#d9f8ff';ctx.font='8px sans-serif';ctx.textAlign='center';ctx.fillText(f.type==='turret'?'砲':f.type==='trap'?'罠':'壁',f.x,f.y+3);if(!f.active){ctx.strokeStyle='#ffdf67';ctx.strokeRect(f.x-23,f.y-23,46,46)}}}
    drawOperatorOrders(ctx){if(this.config.mode!=='team'&&!this.isDefenseMode)return;ctx.save();ctx.setLineDash([8,6]);for(const p of this.players){const o=p.operatorOrder;if(!o||p.dead)continue;const target=o.targetId?this.players.find(x=>x.id===o.targetId):o;const x=target?.x??o.x,y=target?.y??o.y;if(!Number.isFinite(x)||!Number.isFinite(y))continue;ctx.strokeStyle=`${this.teamColors[p.team] || '#ffffff'}88`;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(x,y);ctx.stroke();ctx.strokeRect(x-18,y-18,36,36)}ctx.restore()}
    drawEnvironmentOverlay(ctx){
      const overlay=this.environmentCtx;
      overlay.clearRect(0,0,this.viewW,this.viewH);
      if(this.environment.timeOfDay==='night'){
        overlay.globalCompositeOperation='source-over';
        overlay.fillStyle='rgba(0,3,12,.965)'; overlay.fillRect(0,0,this.viewW,this.viewH);
        overlay.globalCompositeOperation='destination-out';
        const reveal=(worldX,worldY,inner,outer,strength=1)=>{
          const x=worldX-this.camera.x,y=worldY-this.camera.y;
          if(x<-outer||y<-outer||x>this.viewW+outer||y>this.viewH+outer) return;
          const gradient=overlay.createRadialGradient(x,y,inner,x,y,outer);
          gradient.addColorStop(0,`rgba(0,0,0,${strength})`);
          gradient.addColorStop(.55,`rgba(0,0,0,${strength*.82})`);
          gradient.addColorStop(1,'rgba(0,0,0,0)');
          overlay.fillStyle=gradient; overlay.beginPath(); overlay.arc(x,y,outer,0,TAU); overlay.fill();
        };
        const viewer=this.getHudSubject();
        if(viewer&&!viewer.dead) reveal(viewer.x,viewer.y,75,215,1);
        for(const pickup of this.pickups) if(pickup.active) reveal(pickup.x,pickup.y,8,48+pickup.value*7,.72);
        for(const light of this.lightSources) if(light.hp>0) reveal(light.x,light.y,55,light.lightRadius,1);
        if(this.isDefenseMode&&this.defenseFlag) reveal(this.defenseFlag.x,this.defenseFlag.y,45,150,.82);
        overlay.globalCompositeOperation='source-over';
      } else if(this.environment.timeOfDay==='morning'){
        overlay.fillStyle='rgba(255,169,85,.08)'; overlay.fillRect(0,0,this.viewW,this.viewH);
      }
      if(this.environment.weather==='cloudy'){overlay.fillStyle='rgba(145,164,174,.12)';overlay.fillRect(0,0,this.viewW,this.viewH)}
      ctx.save(); ctx.drawImage(this.environmentCanvas,0,0,this.viewW,this.viewH); ctx.restore();
      if(this.environment.weather==='rain'){
        ctx.save(); ctx.fillStyle='rgba(74,116,140,.12)';ctx.fillRect(0,0,this.viewW,this.viewH);ctx.strokeStyle='rgba(190,232,248,.38)';ctx.lineWidth=1;
        const drops=this.onlineReducedEffects?Math.min(54,Math.max(28,Math.floor(this.viewW/24))):Math.min(110,Math.max(55,Math.floor(this.viewW/13)));
        for(let i=0;i<drops;i++){const x=(i*83+this.elapsed*230)%this.viewW,y=(i*47+this.elapsed*520)%this.viewH;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-7,y+20);ctx.stroke()}
        ctx.restore();
      }
    }
    drawGrid(ctx) { /* 背景チャンクに32pxタイルを焼き込んでいるため追加グリッドは描画しません。 */ }

    drawArenaBounds(ctx) {
      ctx.strokeStyle = 'rgba(101, 232, 255, .55)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, this.world.w - 4, this.world.h - 4);
    }

    drawPickups(ctx) {
      for (const p of this.pickups) {
        if (!p.active || !this.inView(p.x, p.y, 20)) continue;
        const pulse = 1 + Math.sin(p.pulse) * .18;
        ctx.globalAlpha = .7;
        ctx.fillStyle = '#6befff';
        const size=p.radius*2*pulse; ctx.fillRect(p.x-size/2,p.y-size/2,size,size);
        ctx.globalAlpha = .16;
        const glow=size*2.8; ctx.fillRect(p.x-glow/2,p.y-glow/2,glow,glow);
      }
      ctx.globalAlpha = 1;
    }

    drawWalls(ctx) {
      for (const wall of this.walls) {
        if (!this.rectInView(wall)) continue;
        const hp = Number.isFinite(wall.maxHp) ? clamp(wall.hp / wall.maxHp, 0, 1) : 1;
        const palette = wall.type==='tree'?['#285844','#39755a','#17392c']:wall.type==='bridge'?['#6c6557','#8e846f','#4c473d']:wall.type==='fortressWall'?['#8d6b43','#b28d59','#654b31']:wall.type==='buildingWall'?['#263e49','#385965','#172a33']:wall.type==='barricade'?['#375d69','#4d8090','#203b44']:['#2f6973','#448c96','#1c434a'];
        this.drawCubeRect(ctx,wall.x,wall.y,wall.w,wall.h,...palette);
        if(Number.isFinite(wall.maxHp)){ctx.fillStyle='rgba(0,0,0,.42)';ctx.fillRect(wall.x,wall.y-6,wall.w,3);ctx.fillStyle=hp>.35?'#72e4bc':'#ff6879';ctx.fillRect(wall.x,wall.y-6,wall.w*hp,3);}
      }
    }

    drawWires(ctx) {
      ctx.lineWidth = 1.5;
      for (const wire of this.wires) {
        if (!this.inView((wire.x1 + wire.x2) / 2, (wire.y1 + wire.y2) / 2, 260)) continue;
        ctx.strokeStyle = `${this.teamColors[wire.team] || '#8be6ff'}bb`;
        ctx.beginPath(); ctx.moveTo(wire.x1, wire.y1); ctx.lineTo(wire.x2, wire.y2); ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath(); ctx.arc(wire.x1, wire.y1, 3, 0, TAU); ctx.arc(wire.x2, wire.y2, 3, 0, TAU); ctx.fill();
      }
    }

    drawMinesTrapsBeacons(ctx) {
      for (const mine of this.mines) {
        if (!this.inView(mine.x, mine.y, 20)) continue;
        ctx.fillStyle = '#ff9c43';
        ctx.strokeStyle = '#ffe2a9';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.rect(mine.x - 8, mine.y - 8, 16, 16); ctx.fill(); ctx.stroke();
      }
      for (const trap of this.traps) {
        if (!this.inView(trap.x, trap.y, 20)) continue;
        const colors = ['#ff6a6a', '#b48aff', '#67f6ae'];
        ctx.strokeStyle = colors[trap.type];
        ctx.fillStyle = `${colors[trap.type]}33`;
        ctx.lineWidth = 2;
        ctx.fillRect(trap.x-13,trap.y-13,26,26);ctx.strokeRect(trap.x-13,trap.y-13,26,26);
        ctx.strokeRect(trap.x-5,trap.y-5,10,10);
      }
      for (const beacon of this.beacons) {
        if (!this.inView(beacon.x, beacon.y, 25)) continue;
        ctx.fillStyle = beacon.defenseDecoy ? '#ffd96a' : '#79d7ff';
        ctx.strokeStyle = beacon.defenseDecoy ? '#fff1b8' : '#d8f7ff';
        ctx.lineWidth = 1.5;
        ctx.fillRect(beacon.x-beacon.radius,beacon.y-beacon.radius,beacon.radius*2,beacon.radius*2);ctx.strokeRect(beacon.x-beacon.radius,beacon.y-beacon.radius,beacon.radius*2,beacon.radius*2);
        ctx.globalAlpha = .22;
        const bs=beacon.radius+8+Math.sin(this.elapsed*4)*3;ctx.strokeRect(beacon.x-bs,beacon.y-bs,bs*2,bs*2);
        ctx.globalAlpha = 1;
      }
    }

    drawProjectiles(ctx) {
      for (const p of this.particles) {
        if (!this.inView(p.x, p.y, 20)) continue;
        ctx.globalAlpha = p.ttl / p.maxTtl * .5;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const p of this.projectiles) {
        if (!this.inView(p.x, p.y, 30)) continue;
        ctx.fillStyle = p.lead ? '#181b1f' : p.color;
        ctx.strokeStyle = p.lead ? '#b8c0c8' : 'rgba(255,255,255,.7)';
        ctx.lineWidth = 1;
        ctx.fillRect(p.x-p.radius,p.y-p.radius,p.radius*2,p.radius*2);ctx.strokeRect(p.x-p.radius,p.y-p.radius,p.radius*2,p.radius*2);
        if (p.lead) {
          ctx.fillStyle = '#8f969d';
          ctx.fillRect(p.x - 2, p.y - 8, 4, 16);
        }
      }
    }

    drawEmblemIcon(ctx, pixelsString, x, y, size = 16) {
      const pixels = emblemFromString(pixelsString);
      const scale = size / 32;
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      for (let yy = 0; yy < 32; yy++) for (let xx = 0; xx < 32; xx++) if (pixels[yy * 32 + xx]) ctx.fillRect(x + xx * scale, y + yy * scale, scale, scale);
    }

    drawHumanoid(ctx, p, alpha = 1) {
      const x = Math.round(p.x - 16);
      const y = Math.round(p.y - 24);
      const color = p.appearance?.bodyColor || p.appearance?.uniformColor || ((this.config.mode === 'team' || this.isDefenseMode) ? this.teamColors[p.team] : '#76d7ff');
      const light = tintColor(color, .22);
      const dark = (() => {
        const v = String(color).replace('#', '').padEnd(6, '0');
        const rgb = [0,2,4].map((i) => Math.max(0, Math.round(parseInt(v.slice(i,i+2),16) * .52)));
        return '#' + rgb.map((value) => value.toString(16).padStart(2,'0')).join('');
      })();
      const frame = p.isMoving ? p.walkFrame : 0;
      const phase = frame % 4;
      const step = phase === 1 ? 2 : phase === 3 ? -2 : 0;
      const arm = phase === 1 ? -2 : phase === 3 ? 2 : 0;
      const dir = p.facing || 'down';
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = false;
      if (p.toggles.bagworm || p.toggles.bagwormTag) {
        ctx.fillStyle = 'rgba(20,24,30,.82)';
        ctx.fillRect(x + 4, y + 8, 24, 22);
      }
      ctx.fillStyle = dark;
      ctx.fillRect(x + 8, y + 2, 16, 12);
      ctx.fillStyle = color;
      ctx.fillRect(x + 9, y + 3, 14, 10);
      ctx.fillStyle = light;
      if (dir === 'down') {
        ctx.fillRect(x + 11, y + 5, 3, 3);
        ctx.fillRect(x + 18, y + 5, 3, 3);
      } else if (dir === 'left') {
        ctx.fillRect(x + 10, y + 6, 3, 3);
      } else if (dir === 'right') {
        ctx.fillRect(x + 19, y + 6, 3, 3);
      } else {
        ctx.fillRect(x + 10, y + 3, 12, 3);
      }
      ctx.fillStyle = dark;
      ctx.fillRect(x + 7, y + 13, 18, 15);
      ctx.fillStyle = color;
      ctx.fillRect(x + 8, y + 14, 16, 13);
      ctx.fillStyle = light;
      ctx.fillRect(x + 10, y + 15, 12, 4);
      if (dir === 'left' || dir === 'right') {
        const front = dir === 'left' ? -1 : 1;
        ctx.fillStyle = dark;
        ctx.fillRect(x + (front < 0 ? 3 : 25), y + 15 + arm, 4, 10);
        ctx.fillRect(x + (front < 0 ? 25 : 3), y + 15 - arm, 4, 10);
        ctx.fillStyle = color;
        ctx.fillRect(x + (front < 0 ? 4 : 25), y + 16 + arm, 3, 8);
        ctx.fillRect(x + (front < 0 ? 25 : 4), y + 16 - arm, 3, 8);
      } else {
        ctx.fillStyle = dark;
        ctx.fillRect(x + 3, y + 15 + arm, 5, 10);
        ctx.fillRect(x + 24, y + 15 - arm, 5, 10);
        ctx.fillStyle = color;
        ctx.fillRect(x + 4, y + 16 + arm, 4, 8);
        ctx.fillRect(x + 24, y + 16 - arm, 4, 8);
      }
      ctx.fillStyle = dark;
      ctx.fillRect(x + 9, y + 27 + Math.max(0, step), 6, 5);
      ctx.fillRect(x + 17, y + 27 + Math.max(0, -step), 6, 5);
      ctx.fillStyle = color;
      ctx.fillRect(x + 10, y + 27 + Math.max(0, step), 4, 4);
      ctx.fillRect(x + 18, y + 27 + Math.max(0, -step), 4, 4);
      ctx.strokeStyle = p.human ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.28)';
      ctx.strokeRect(x + 8.5, y + 13.5, 16, 14);
      ctx.restore();
    }


    drawDefenseFlag(ctx) {
      const flag = this.defenseFlag;
      if (!this.isDefenseMode || !flag || !this.inView(flag.x, flag.y, 120)) return;
      const hp = clamp(flag.hp / flag.maxHp, 0, 1);
      ctx.save();
      ctx.translate(flag.x, flag.y);
      const pulse = 1 + Math.sin(flag.pulse) * .06;
      ctx.scale(pulse, pulse);
      this.drawCubeRect(ctx, -30, -24, 60, 48, '#1f6e8c', '#4ad9ff', '#123c51');
      ctx.fillStyle = '#dffbff'; ctx.fillRect(-4, -70, 8, 48);
      ctx.fillStyle = '#4ad9ff'; ctx.beginPath(); ctx.moveTo(4, -68); ctx.lineTo(47, -55); ctx.lineTo(4, -42); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(101,232,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 74, 0, TAU); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,.68)'; ctx.fillRect(flag.x - 72, flag.y - 91, 144, 8);
      ctx.fillStyle = hp > .45 ? '#63e6a2' : hp > .2 ? '#ffd369' : '#ff5f73'; ctx.fillRect(flag.x - 72, flag.y - 91, 144 * hp, 8);
      ctx.fillStyle = '#eafaff'; ctx.font = '800 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`DEFENSE FLAG ${Math.ceil(flag.hp)}`, flag.x, flag.y - 98);
    }

    drawDefenseHazards(ctx) {
      if (!this.isDefenseMode) return;
      for (const hazard of this.defenseHazards) {
        const telegraph = !hazard.resolved;
        ctx.save();
        ctx.globalAlpha = telegraph ? .28 + Math.sin(this.elapsed * 12) * .12 : .7;
        ctx.strokeStyle = hazard.color || '#ff665f';
        ctx.fillStyle = `${hazard.color || '#ff665f'}33`;
        ctx.lineWidth = telegraph ? 3 : 8;
        if (hazard.type === 'circle') {
          ctx.beginPath(); ctx.arc(hazard.x, hazard.y, hazard.radius, 0, TAU); ctx.fill(); ctx.stroke();
        } else if (hazard.type === 'line') {
          ctx.beginPath(); ctx.moveTo(hazard.x, hazard.y); ctx.lineTo(hazard.x2, hazard.y2); ctx.stroke();
        } else if (hazard.type === 'ring') {
          ctx.beginPath(); ctx.arc(hazard.x, hazard.y, hazard.radius, 0, TAU); ctx.stroke();
        }
        ctx.restore();
      }
    }

    drawBlackTriggerHumanoid(ctx, p) {
      const type = p.defenseType;
      const phaseAlpha = type === 'borboros' && ['liquid', 'gas'].includes(p.defenseAI?.phase) ? .48 : 1;
      this.drawHumanoid(ctx, p, phaseAlpha);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = phaseAlpha;
      const symbol = { fujin: '風', seals: '印', alektor: '卵', borboros: '泥', organon: '星' }[type] || '黒';
      ctx.fillStyle = 'rgba(8,12,18,.82)';
      ctx.fillRect(-8, -11, 16, 16);
      ctx.fillStyle = '#f5fbff';
      ctx.font = '900 10px serif';
      ctx.textAlign = 'center';
      ctx.fillText(symbol, 0, 1);
      if (type === 'fujin') {
        ctx.strokeStyle = '#52ee87'; ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(0, -2, 27 + i * 5, -.55 + i * .13, .15 + i * .13); ctx.stroke(); }
      }
      if (type === 'seals') {
        ctx.fillStyle = '#f5f6ff'; ctx.font = '900 11px serif';
        const seal = ['錨', '響', '門', '盾', '鎖', '弾'][Math.floor(this.elapsed * 1.6) % 6];
        ctx.fillText(seal, 0, -35);
        if (p.defenseAI?.shieldTimer > 0) { ctx.strokeStyle = '#f5f6ff'; ctx.lineWidth = 3; ctx.strokeRect(-25, -34, 50, 64); }
      }
      if (type === 'alektor') {
        ctx.fillStyle = '#b6ee9b';
        for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + this.elapsed; ctx.fillRect(Math.cos(a) * 35 - 4, Math.sin(a) * 35 - 4, 8, 8); }
      }
      if (type === 'borboros') {
        ctx.fillStyle = 'rgba(166,117,216,.35)';
        ctx.beginPath(); ctx.arc(0, 0, 36 + Math.sin(this.elapsed * 3) * 5, 0, TAU); ctx.fill();
      }
      if (type === 'organon') {
        ctx.strokeStyle = '#e4d8b6'; ctx.lineWidth = 2;
        for (let r = 30; r <= 60; r += 15) { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
      }
      ctx.restore();
    }

    drawDefenseEnemy(ctx, p) {
      const type = p.defenseType;
      const color = p.appearance?.bodyColor || '#ddd';
      if (p.isDefenseBoss) {
        this.drawBlackTriggerHumanoid(ctx, p);
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.aim || 0);
        if (type === 'ilgar') {
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.ellipse(0, 0, 66, 30, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.42)';
          ctx.beginPath(); ctx.moveTo(-12, -8); ctx.lineTo(-55, -42); ctx.lineTo(18, -22); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-12, 8); ctx.lineTo(-55, 42); ctx.lineTo(18, 22); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#4a3b18'; ctx.fillRect(42, -5, 16, 10);
          ctx.fillStyle = '#2e2412'; for (let i = -2; i <= 2; i++) ctx.fillRect(-8 + i * 16, 24, 8, 9);
          if (p.defenseAI?.selfDestruct) {
            ctx.strokeStyle = '#ff5d3c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 78 + Math.sin(this.elapsed * 14) * 8, 0, TAU); ctx.stroke();
            ctx.fillStyle = '#ff7a42'; for (let i = -2; i <= 2; i++) ctx.fillRect(-28 + i * 14, -42, 6, 20);
          }
        } else if (type === 'marmod') {
          ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, 29, 19, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#717575'; ctx.lineWidth = 5;
          for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 12); ctx.lineTo(Math.cos(a) * 39, Math.sin(a) * 28); ctx.stroke(); }
          ctx.strokeStyle = '#dfe4e4'; ctx.lineWidth = 2;
          for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 32, Math.sin(a) * 22); ctx.lineTo(Math.cos(a) * 48, Math.sin(a) * 34); ctx.stroke(); }
        } else if (type === 'rabbit') {
          ctx.fillStyle = color; ctx.fillRect(-24, -27, 48, 54);
          ctx.fillStyle = '#d5d7d4'; ctx.fillRect(-34, -18, 14, 40); ctx.fillRect(20, -18, 14, 40);
          ctx.fillStyle = '#1a2225'; ctx.fillRect(-7, -19, 14, 12);
          ctx.fillStyle = '#59d882'; ctx.fillRect(-4, -16, 8, 6);
          ctx.fillStyle = color; ctx.fillRect(-12, -47, 7, 24); ctx.fillRect(5, -47, 7, 24);
          ctx.fillStyle = '#b9bbb8'; ctx.fillRect(-18, 27, 13, 19); ctx.fillRect(5, 27, 13, 19);
        }
        ctx.restore();
      }
      const hp = clamp(p.hp / p.maxHp, 0, 1);
      const width = p.isDefenseBoss ? 160 : 90;
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(p.x - width / 2, p.y - p.radius - 34, width, 7);
      ctx.fillStyle = p.isDefenseBoss ? '#ff5f73' : '#ffd369'; ctx.fillRect(p.x - width / 2, p.y - p.radius - 34, width * hp, 7);
      ctx.fillStyle = '#fff'; ctx.font = p.isDefenseBoss ? '900 12px sans-serif' : '800 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.isDefenseBoss ? `BLACK TRIGGER：${p.name}` : p.name, p.x, p.y - p.radius - 42);
    }

    drawPlayers(ctx) {
      const ordered = [...this.players].sort((a, b) => Number(a.human) - Number(b.human));
      for (const p of ordered) {
        if (p.dead || !this.inView(p.x, p.y, 120)) continue;
        if (p.isDefenseEnemy) { this.drawDefenseEnemy(ctx, p); continue; }
        let alpha = 1;
        if (p.toggles.chameleon && !p.human && p.markedTimer <= 0) alpha = .12;
        if (p.toggles.chameleon && p.human) alpha = .48;
        const color = p.appearance?.bodyColor || p.appearance?.uniformColor || ((this.config.mode === 'team' || this.isDefenseMode) ? this.teamColors[p.team] : (p.human ? '#66ecff' : '#ff8b75'));
        ctx.save();
        if (!this.onlineReducedEffects) { ctx.shadowColor = color; ctx.shadowBlur = p.human ? 16 : 6; }
        this.drawHumanoid(ctx, p, alpha);
        ctx.shadowBlur = 0;
        ctx.restore();

        if (p.shields.main || p.shields.sub) this.drawPlayerShield(ctx, p);
        if (p.invulnTimer > 0) {
          ctx.strokeStyle = `rgba(255,255,255,${.32 + Math.sin(this.elapsed * 8) * .14})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(p.x-p.radius-14,p.y-p.radius-14,(p.radius+14)*2,(p.radius+14)*2);
        }
        if (p.pendingComposite) {
          const progress = 1 - p.pendingComposite.timer / p.pendingComposite.total;
          ctx.strokeStyle = '#fff1a0';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 10, -Math.PI / 2, -Math.PI / 2 + TAU * progress); ctx.stroke();
        }
        if (p.markedTimer > 0) {
          ctx.strokeStyle = '#ffdf67';
          ctx.lineWidth = 2;
          ctx.strokeRect(p.x-p.radius-8,p.y-p.radius-8,(p.radius+8)*2,(p.radius+8)*2);
          ctx.fillStyle = '#ffdf67';
          ctx.fillRect(p.x - 2, p.y - p.radius - 16, 4, 7);
        }
        if (p.leadWeights > 0) {
          ctx.fillStyle = '#141719';
          for (let i = 0; i < Math.min(p.leadWeights, 6); i++) ctx.fillRect(p.x - p.radius + i * 7, p.y + p.radius + 5, 5, 8);
        }
        if ((p.cubedTimer || 0) > 0) {
          ctx.fillStyle = 'rgba(145,232,255,.28)'; ctx.fillRect(p.x - 22, p.y - 28, 44, 52);
          ctx.strokeStyle = '#9feeff'; ctx.lineWidth = 3; ctx.strokeRect(p.x - 22, p.y - 28, 44, 52);
        }
        this.drawPlayerLabel(ctx, p);
      }
    }

    drawPlayerShield(ctx, p) {
      const count = Number(Boolean(p.shields.main)) + Number(Boolean(p.shields.sub));
      const full = count >= 2;
      const raygust = p.shields.main?.type === 'raygust' || p.shields.sub?.type === 'raygust';
      ctx.strokeStyle = raygust ? 'rgba(155, 250, 255, .9)' : 'rgba(104, 204, 255, .75)';
      ctx.lineWidth = raygust ? 8 : 5;
      if (full) ctx.strokeRect(p.x-p.radius-10,p.y-p.radius-10,(p.radius+10)*2,(p.radius+10)*2);
      else {const cx=p.x+Math.cos(p.aim)*(p.radius+10),cy=p.y+Math.sin(p.aim)*(p.radius+10);ctx.save();ctx.translate(cx,cy);ctx.rotate(p.aim);ctx.strokeRect(-3,-p.radius-8,6,(p.radius+8)*2);ctx.restore();}
    }

    drawPlayerLabel(ctx, p) {
      const width = 120;
      const hp = clamp(p.hp / p.maxHp, 0, 1);
      ctx.textAlign = 'center';
      ctx.font = '700 10px Inter, sans-serif';
      ctx.fillStyle = p.human ? '#dffcff' : 'rgba(224, 244, 250, .86)';
      ctx.fillText(`${p.name}${p.squadName ? `・${p.squadName}` : ''}`, p.x, p.y - p.radius - 19);
      ctx.fillStyle = 'rgba(0,0,0,.52)';
      ctx.fillRect(p.x - width / 2, p.y - p.radius - 13, width, 3);
      ctx.fillStyle = hp > .35 ? '#63e6a2' : '#ff6175';
      ctx.fillRect(p.x - width / 2, p.y - p.radius - 13, width * hp, 3);
    }

    drawEffects(ctx) {
      for (const e of this.effects) {
        const cx = Number.isFinite(e.x2) ? (Number(e.x || 0) + Number(e.x2 || 0)) / 2 : Number(e.x || 0);
        const cy = Number.isFinite(e.y2) ? (Number(e.y || 0) + Number(e.y2 || 0)) / 2 : Number(e.y || 0);
        const span = Number.isFinite(e.x2) ? Math.hypot(Number(e.x2 || 0) - Number(e.x || 0), Number(e.y2 || 0) - Number(e.y || 0)) / 2 : 0;
        const margin = Math.min(900, Math.max(100, Number(e.radius || e.range || 0) + span + 80));
        if (!this.inView(cx, cy, margin)) continue;
        const t = clamp(e.ttl / e.maxTtl, 0, 1);
        ctx.save();
        if (e.type === 'slash') {
          ctx.globalAlpha = t;
          ctx.strokeStyle = e.style === 'mantis' ? '#c7fff4' : e.style.includes('scorpion') ? '#b59cff' : '#e2fbff';
          ctx.lineWidth = e.style === 'mantis' ? 13 : 8;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.range, e.angle - e.arc / 2, e.angle + e.arc / 2); ctx.stroke();
        } else if (e.type === 'senku') {
          ctx.globalAlpha = t;
          ctx.strokeStyle = '#e8feff';
          ctx.lineWidth = 13 * t + 2;
          ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x2, e.y2); ctx.stroke();
        } else if (e.type === 'thruster' || e.type === 'teleport') {
          ctx.globalAlpha = t * .7;
          ctx.strokeStyle = e.type === 'thruster' ? '#70efff' : '#cba6ff';
          ctx.lineWidth = 18 * t + 2;
          ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x2, e.y2); ctx.stroke();
        } else if (e.type === 'grasshopper') {
          ctx.globalAlpha = t;
          ctx.strokeStyle = '#76ffb7';
          ctx.lineWidth = 3;
          ctx.translate(e.x, e.y); ctx.rotate(e.angle);
          ctx.strokeRect(-17, -17, 34, 34);
          ctx.strokeRect(-10, -10, 20, 20);
        } else if (e.type === 'explosion' || e.type === 'gasBurst') {
          const progress = 1 - t;
          ctx.globalAlpha = t * (e.type === 'gasBurst' ? .84 : .72);
          ctx.fillStyle = e.type === 'gasBurst' ? '#d7ef7b' : '#ff9e53';
          ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * (.2 + progress * .8), 0, TAU); ctx.fill();
          ctx.strokeStyle = e.type === 'gasBurst' ? '#fff8be' : '#fff1b7'; ctx.lineWidth = e.type === 'gasBurst' ? 9 : 5; ctx.stroke();
        } else if (e.type === 'shieldHit') {
          ctx.globalAlpha = t;
          ctx.strokeStyle = '#b6f7ff'; ctx.lineWidth = 7;
          ctx.beginPath(); ctx.arc(e.x, e.y, 35, e.angle - .55, e.angle + .55); ctx.stroke();
        } else if (e.type === 'hit') {
          ctx.globalAlpha = t;
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
          for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + e.ttl * 8;
            ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8); ctx.lineTo(e.x + Math.cos(a) * 24, e.y + Math.sin(a) * 24); ctx.stroke();
          }
        } else if (e.type === 'weight') {
          ctx.globalAlpha = Math.min(1, t * 1.5);
          ctx.fillStyle = '#181b1f';
          ctx.fillRect(e.x - 8, e.y - 8, 16, 16);
        } else if (e.type === 'bind') {
          ctx.globalAlpha = t;
          ctx.strokeStyle = '#c49bff'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(e.x, e.y, 30 + (1 - t) * 22, 0, TAU); ctx.stroke();
        } else if (e.type === 'bailout') {
          ctx.globalAlpha = t;
          ctx.strokeStyle = '#d8fbff'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(e.x, e.y, 20 + (1 - t) * 80, 0, TAU); ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.font = '900 15px Inter'; ctx.textAlign = 'center'; ctx.fillText('BAIL OUT', e.x, e.y - 28 - (1 - t) * 30);
        } else if (e.type === 'composite') {
          ctx.globalAlpha = t;
          ctx.strokeStyle = '#fff1a0'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(e.x, e.y, 18 + (1 - t) * 45, 0, TAU); ctx.stroke();
        } else if (e.type === 'muzzle') {
          ctx.globalAlpha = t;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(e.x + Math.cos(e.angle) * 28, e.y + Math.sin(e.angle) * 28, 18 * t, 0, TAU); ctx.fill();
        } else if (e.type === 'flagHeal') {
          ctx.globalAlpha = t; ctx.fillStyle = '#65f1c0'; ctx.fillRect(e.x - 5, e.y - 18 * (1 - t), 10, 10);
        } else if (e.type === 'flagHit') {
          ctx.globalAlpha = t; ctx.strokeStyle = '#ff6b5f'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(e.x, e.y, 48 + (1 - t) * 28, 0, TAU); ctx.stroke();
        } else if (e.type === 'defenseImpact') {
          ctx.globalAlpha = t; ctx.strokeStyle = e.color || '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(e.x, e.y, 14 + (1 - t) * 34, 0, TAU); ctx.stroke();
        }
        ctx.restore();
      }
    }

    drawScreenVignette(ctx) {
      const gradient = ctx.createRadialGradient(this.viewW / 2, this.viewH / 2, Math.min(this.viewW, this.viewH) * .2, this.viewW / 2, this.viewH / 2, Math.max(this.viewW, this.viewH) * .72);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,.34)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      if (this.human && this.human.hp / this.human.maxHp < .28 && !this.human.dead) {
        ctx.fillStyle = `rgba(255, 45, 70, ${.04 + Math.sin(this.elapsed * 6) * .025})`;
        ctx.fillRect(0, 0, this.viewW, this.viewH);
      }
    }

    renderRadar() {
      const ctx = this.radarCtx;
      const w = this.radarCanvas.width;
      const h = this.radarCanvas.height;
      const observer = this.getHudSubject() || { id: '', team: this.playerTeam };
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = this.mapId === 'desert' ? '#a88445' : '#06131d'; ctx.fillRect(0, 0, w, h);
      const sx = w / this.world.w;
      const sy = h / this.world.h;
      ctx.fillStyle=this.mapId === 'desert'?'rgba(120,83,43,.45)':'rgba(75,95,105,.3)'; for(const r of this.terrain.roads) ctx.fillRect(r.x*sx,r.y*sy,r.w*sx,r.h*sy);
      const river=this.terrain.rivers[0];
      if(river){ctx.strokeStyle='rgba(42,127,157,.55)';ctx.lineWidth=Math.max(2,river.width*sy);ctx.beginPath();for(let x=0;x<=this.world.w;x+=90){const y=this.riverCenterAt(x);if(x===0)ctx.moveTo(x*sx,y*sy);else ctx.lineTo(x*sx,y*sy)}ctx.stroke();}
      if(this.mapId==='desert'){
        ctx.fillStyle='rgba(58,145,157,.75)';for(const oasis of this.terrain.oases){ctx.beginPath();ctx.arc(oasis.x*sx,oasis.y*sy,Math.max(2,oasis.radius*sx),0,TAU);ctx.fill();}
        ctx.fillStyle='rgba(83,53,28,.55)';for(const cliff of this.terrain.cliffs)ctx.fillRect(cliff.x*sx,cliff.y*sy,Math.max(2,cliff.w*sx),Math.max(2,cliff.h*sy));
        ctx.strokeStyle='rgba(69,91,46,.8)';for(const gas of this.terrain.gasFields){if(!gas.active)continue;ctx.beginPath();ctx.arc(gas.x*sx,gas.y*sy,Math.max(2,gas.radius*sx),0,TAU);ctx.stroke();}
      }
      ctx.strokeStyle = 'rgba(101,232,255,.18)'; ctx.strokeRect(.5, .5, w - 1, h - 1);
      for (const wall of this.walls) {
        if (!['buildingWall','bridge','barricade'].includes(wall.type)) continue;
        ctx.fillStyle = wall.type==='bridge'?'rgba(180,160,105,.5)':'rgba(85,145,165,.3)';
        ctx.fillRect(wall.x * sx, wall.y * sy, Math.max(1,wall.w * sx), Math.max(1,wall.h * sy));
      }
      for(const facility of this.installations){if(facility.hp<=0)continue;ctx.fillStyle=facility.active?(facility.team===0?'#55eaff':'#ff8871'):'#9daeb4';ctx.fillRect(facility.x*sx-1.5,facility.y*sy-1.5,3,3);}
      for (const beacon of this.beacons) {
        const sameTeam = (this.config.mode === 'team' || this.isDefenseMode) && beacon.team === observer.team;
        ctx.fillStyle = sameTeam ? '#55eaff' : '#ff8871';
        ctx.fillRect(beacon.x*sx-2,beacon.y*sy-2,4,4);
      }
      if (this.isDefenseMode && this.defenseFlag) {
        ctx.fillStyle = '#4ad9ff'; ctx.fillRect(this.defenseFlag.x * sx - 4, this.defenseFlag.y * sy - 4, 8, 8);
        ctx.strokeStyle = '#dffcff'; ctx.strokeRect(this.defenseFlag.x * sx - 5, this.defenseFlag.y * sy - 5, 10, 10);
      }
      for (const p of this.players) {
        if (p.dead) continue;
        const sameTeam = (this.config.mode === 'team' || this.isDefenseMode) && p.team === observer.team;
        const isObserver = p.id === observer.id;
        const hidden = !sameTeam && !isObserver && (p.toggles.bagworm || p.toggles.bagwormTag) && p.markedTimer <= 0 && p.revealTimer <= 0;
        if (hidden) continue;
        ctx.fillStyle = p.isDefenseEnemy ? (p.isDefenseBoss ? '#ff3158' : '#ffb347') : isObserver ? '#ffffff' : sameTeam ? '#55eaff' : '#ff8871';
        const rs=p.isDefenseBoss?7:p.isDefenseEnemy?5.2:isObserver?6:4.6;ctx.fillRect(p.x*sx-rs/2,p.y*sy-rs/2,rs,rs);
        if (p.markedTimer > 0) { ctx.strokeStyle = '#ffdf67'; ctx.strokeRect(p.x*sx-rs/2-1,p.y*sy-rs/2-1,rs+2,rs+2); }
      }
      ctx.strokeStyle = 'rgba(255,255,255,.22)';
      ctx.strokeRect(this.camera.x * sx, this.camera.y * sy, this.viewW * sx, this.viewH * sy);
    }

    inView(x, y, margin = 0) {
      return x > this.camera.x - margin && x < this.camera.x + this.viewW + margin && y > this.camera.y - margin && y < this.camera.y + this.viewH + margin;
    }

    rectInView(rect) {
      return rect.x + rect.w > this.camera.x && rect.x < this.camera.x + this.viewW && rect.y + rect.h > this.camera.y && rect.y < this.camera.y + this.viewH;
    }

    getHudSubject() {
      if (this.spectating) return this.getSpectatorTarget() || this.players.find((p) => !p.dead) || null;
      if (this.isPlayerOperator) return this.players.find((p) => p.id === this.operatorSelectedUnit && !p.dead) || this.players.find((p) => p.team === this.playerTeam && !p.dead) || this.players.find((p) => !p.dead) || null;
      return this.human;
    }

    updateHud() {
      const p = this.getHudSubject();
      if (!p) return;
      if (this.hudSubjectId !== p.id) this.buildSlotHud(p);
      if (this.isDefenseMode) this.updateDefenseHud();
      else $('#timerLabel').textContent = this.getClockLabel();
      $('#scoreLabel').textContent = Math.floor(p.score);
      $('#kdLabel').textContent = `${p.kills} / ${p.deaths}`;
      $('#hpText').textContent = `${Math.ceil(p.hp)} / ${Math.ceil(p.maxHp)}`;
      $('#trionText').textContent = `${Math.ceil(p.trion)} / ${Math.ceil(p.maxTrion)}`;
      $('#hpBar').style.width = `${clamp(p.hp / p.maxHp, 0, 1) * 100}%`;
      $('#trionBar').style.width = `${p.maxTrion > 0 ? clamp(p.trion / p.maxTrion, 0, 1) * 100 : 0}%`;
      if (this.config.mode === 'team') {
        $('#teamScoreCard').innerHTML = this.teamScores.map((score, team) => `<span style="color:${this.teamColors[team]}">${this.teamMeta?.[team]?.name || TEAM_SHORT_NAMES[team]} ${Math.floor(score)}</span>`).join('<b>·</b>');
      }
      this.updateStatusHud(p);
      this.updateSlotHud(p);
    }

    updateStatusHud(p = this.getHudSubject()) {
      if (!p) return;
      const statuses = [`${MAP_LABELS[this.mapId]}・${TIME_LABELS[this.environment.timeOfDay]}・${WEATHER_LABELS[this.environment.weather]}`];
      if (this.mapId === 'desert' && p.desertReliefLabel) statuses.push(p.desertReliefLabel);
      if (p.operatorOrder) statuses.push(`ORDER ${p.operatorOrder.label || p.operatorOrder.type}`);
      if (this.isPlayerOperator) statuses.push(`COMMAND ${p.name}`);
      if (this.spectating) statuses.push(`VIEW ${p.name}`);
      if (p.operatorBoostTimer > 0) statuses.push(`MOBILITY ${p.operatorBoostTimer.toFixed(1)}s`);
      if (p.toggles.bagworm || p.toggles.bagwormTag) statuses.push('RADAR OFF');
      if (p.toggles.chameleon) statuses.push('CAMOUFLAGE');
      if (p.markedTimer > 0) statuses.push(`MARK ${p.markedTimer.toFixed(1)}s`);
      if (p.leadWeights > 0) statuses.push(`WEIGHT ×${p.leadWeights}`);
      if ((p.cubedTimer || 0) > 0) statuses.push(`CUBED ${(p.cubedTimer || 0).toFixed(1)}s`);
      if ((p.defensePoisonTimer || 0) > 0) statuses.push(`GAS ${(p.defensePoisonTimer || 0).toFixed(1)}s`);
      if (this.isDefenseMode && this.defenseFlag && Math.hypot(p.x - this.defenseFlag.x, p.y - this.defenseFlag.y) < 130) statuses.push('F：TRION → FLAG');
      if (p.pendingComposite) statuses.push(`COMBINE ${Math.ceil((1 - p.pendingComposite.timer / p.pendingComposite.total) * 100)}%`);
      for (const hand of ['main', 'sub']) if (p.modifierReady[hand]) statuses.push(`${p.modifierReady[hand].type === 'lead' ? 'LEAD' : 'STAR'}→${hand.toUpperCase()}`);
      $('#statusList').innerHTML = statuses.map((status) => `<span class="status-chip">${status}</span>`).join('');
    }

    updateSlotHud(p = this.getHudSubject()) {
      if (!p) return;
      for (const hand of ['main', 'sub']) {
        $$(`#${hand}HudSlots .hud-slot`).forEach((slot, index) => {
          slot.classList.toggle('active', p.selected[hand] === index);
          const id = p.loadout[hand][index];
          slot.classList.toggle('disabled', id === 'empty');
          const key = `${hand}:${index}`;
          const remaining = p.cooldowns[key] || 0;
          const max = p.cooldownMax[key] || 1;
          slot.querySelector('.cooldown i').style.width = `${clamp(remaining / max, 0, 1) * 100}%`;
        });
      }
      $$('[data-mobile-key^="Digit"]').forEach((button) => {
        const digit = Number(button.dataset.mobileKey.replace('Digit', ''));
        const active = digit <= 4 ? p.selected.main === digit - 1 : p.selected.sub === digit - 5;
        button.classList.toggle('active', active);
      });
    }

    toast(text) {
      const element = $('#toast');
      element.textContent = text;
      element.classList.add('show');
      this.toastTimer = 1.7;
    }

    showCenterMessage(title, subtitle, duration) {
      const element = $('#centerMessage');
      element.innerHTML = `${title}<small>${subtitle}</small>`;
      element.classList.remove('hidden');
      this.messageTimer = duration;
    }

    addKillFeed(text) {
      this.killFeedItems.unshift({ text, timer: 5 });
      this.killFeedItems = this.killFeedItems.slice(0, 5);
      $('#killFeed').innerHTML = this.killFeedItems.map((item) => `<div class="kill-item">${item.text}</div>`).join('');
      setTimeout(() => {
        this.killFeedItems.pop();
        if ($('#killFeed')) $('#killFeed').innerHTML = this.killFeedItems.map((item) => `<div class="kill-item">${item.text}</div>`).join('');
      }, 5000);
    }

    endMatch() {
      if (this.ended) return;
      this.ended = true;
      if (!this.isUnlimited) this.matchTime = 0;
      this.paused = false;
      $('#pauseOverlay').classList.add('hidden');
      const ranking = [...this.players].sort((a, b) => b.score - a.score || b.kills - a.kills);
      const teamRanking = this.teamScores.map((score, team) => ({ team, score })).sort((a, b) => b.score - a.score);
      const ownTeamRank = teamRanking.findIndex((entry) => entry.team === this.playerTeam) + 1;
      const winner = teamRanking[0];
      let title;
      if (this.config.mode === 'team') title = `${this.teamMeta?.[winner.team]?.name || TEAM_SHORT_NAMES[winner.team]} WIN`;
      else if (this.isPlayerCombatant) title = `${ranking.findIndex((p) => p.human) + 1}位`;
      else title = '観戦終了';
      $('#resultTitle').textContent = title;
      if (this.isPlayerOperator) {
        $('#resultSummary').innerHTML = `
          <div><span>TEAM RANK</span><strong>${ownTeamRank}位</strong></div>
          <div><span>ORDERS</span><strong>${this.operatorStats.ordersIssued}</strong></div>
          <div><span>SUPPORT</span><strong>${this.operatorStats.supportsUsed}</strong></div>`;
      } else if (this.isSetupSpectator) {
        $('#resultSummary').innerHTML = `
          <div><span>TEAMS</span><strong>${this.config.mode === 'team' ? this.teamCount : ranking.length}</strong></div>
          <div><span>BATTLE TIME</span><strong>${formatTime(this.elapsed)}</strong></div>
          <div><span>BAILOUTS</span><strong>${ranking.reduce((sum, p) => sum + p.deaths, 0)}</strong></div>`;
      } else {
        $('#resultSummary').innerHTML = `
          <div><span>SCORE</span><strong>${Math.floor(this.human.score)}</strong></div>
          <div><span>KILLS</span><strong>${this.human.kills}</strong></div>
          <div><span>DEATHS</span><strong>${this.human.deaths}</strong></div>`;
      }
      $('#rankingList').innerHTML = ranking.map((p, index) => `
        <div class="rank-row${p.human ? ' player' : ''}">
          <span class="rank">${index + 1}</span>
          <strong>${p.name}</strong>
          <span class="meta">${p.kills}K / ${p.metrics.assists || 0}A / ${p.deaths}D</span>
          <span>${Math.floor(p.score)}pt</span>
        </div>`).join('');
      this.finalizeLog('time_end');
      this.submitOnlineRanking();
      if (this.isOnlineHost) {
        const finalSnapshot = this.buildOnlineSnapshot({ full: true });
        window.trionOnline?.broadcast('match_end', { snapshot: finalSnapshot, title });
        window.trionOnline?.endRoom({ matchId:this.matchId, mode:this.config.mode, teamScores:this.teamScores, elapsed:this.elapsed });
      }
      this.updateDebugPanel(true);
      $('#resultOverlay').classList.remove('hidden');
    }
  }

  loadSetup();
  bindSetupControls();
  bindTeamCustomizationControls();
  syncSetupUI();
  showTriggerInfo('kogetsu');
  initCubeStreams();
  renderSavedLogSummary();
  renderTitleRankings();
  showTitle();
})();
