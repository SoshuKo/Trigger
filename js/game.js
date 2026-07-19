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
  const MAP_IDS = ['city', 'desert', 'snowShrine', 'underground'];
  const MAP_LABELS = { city: '▦', desert: '◌', snowShrine: '❄', underground: '▤' };
  const MODE_LABELS = { solo: '◇', team: '◆', defense: '▣', extra: '✦', tutorial: '◎' };

  const EXTRA_BASE_MODE_LABELS = { solo: '個人戦', team: 'チーム戦', defense: '防衛戦' };
  const EXTRA_UNIT_DEFS = {
    agent: { label:'隊員', category:'隊員', hp:0, speed:0, radius:0, boss:false },
    marmod: { label:'モールモッド', category:'トリオン兵', hp:112, speed:184, radius:24, damage:16 },
    ilgar: { label:'イルガー', category:'トリオン兵', hp:395, speed:82, radius:58, damage:19, flying:true },
    rabbit: { label:'ラービット', category:'トリオン兵', hp:485, speed:114, radius:33, damage:25 },
    fujin: { label:'風刃', category:'ブラックトリガー', hp:1650, speed:137, radius:27, damage:35, boss:true },
    seals: { label:'印', category:'ブラックトリガー', hp:1780, speed:151, radius:27, damage:32, boss:true },
    alektor: { label:'アレクトール', category:'ブラックトリガー', hp:1920, speed:116, radius:29, damage:29, boss:true },
    borboros: { label:'ボルボロス', category:'ブラックトリガー', hp:1840, speed:139, radius:29, damage:33, boss:true },
    organon: { label:'オルガノン', category:'ブラックトリガー', hp:2150, speed:101, radius:29, damage:39, boss:true },
    skeletonAttacker: { label:'骸骨アタッカー', category:'百鬼夜行', hp:118, speed:168, radius:18, damage:18 },
    skeletonShooter: { label:'骸骨シューター', category:'百鬼夜行', hp:98, speed:146, radius:18, damage:17 },
    skeletonSniper: { label:'骸骨スナイパー', category:'百鬼夜行', hp:92, speed:136, radius:18, damage:21 },
    yamagu: { label:'山狗', category:'百鬼夜行', hp:2050, speed:124, radius:56, damage:31, boss:true },
    yagarasu: { label:'夜鴉', category:'百鬼夜行', hp:2140, speed:142, radius:58, damage:28, boss:true, flying:true },
    whitefox: { label:'白狐', category:'百鬼夜行', hp:2230, speed:152, radius:55, damage:30, boss:true },
    nekomata: { label:'猫又', category:'百鬼夜行', hp:2360, speed:146, radius:58, damage:32, boss:true },
    orochi: { label:'大蛇', category:'百鬼夜行', hp:3560, speed:86, radius:86, damage:36, boss:true },
    sogetsu: { label:'双月', category:'防衛助っ人', hp:330, speed:196, radius:18, damage:41, support:true },
    fullarms: { label:'全武装', category:'防衛助っ人', hp:395, speed:168, radius:19, damage:40, support:true },
    geist: { label:'ガイスト', category:'防衛助っ人', hp:334, speed:188, radius:18, damage:39, support:true },
  };
  const EXTRA_PARRY_TYPES = new Set(['fujin','alektor','organon','yamagu','yagarasu','whitefox','nekomata']);
  const effectiveSetupMode = (source = setup) => source.mode === 'extra' ? (source.extraBaseMode || 'solo') : source.mode;
  const extraUnitOptionsHtml = (selected = 'agent', includeAgent = true) => {
    const groups = {};
    for (const [id, def] of Object.entries(EXTRA_UNIT_DEFS)) {
      if (!includeAgent && id === 'agent') continue;
      (groups[def.category] ||= []).push([id, def]);
    }
    return Object.entries(groups).map(([group, items]) => `<optgroup label="${group}">${items.map(([id,def]) => `<option value="${id}"${id===selected?' selected':''}>${def.label}</option>`).join('')}</optgroup>`).join('');
  };
  const DEFENSE_SCENARIO_LABELS = { blackTrigger: '★', hyakki: '☯' };
  const isSquadModeValue = (mode) => mode === 'team' || mode === 'defense';
  const TIME_LABELS = { morning: '◐', day: '☀', night: '☾' };
  const WEATHER_LABELS = { clear: '○', cloudy: '☁', rain: '☂' };
  const MAX_TEMP_PICKUPS = 80;
  const MAX_BATTLE_EVENTS = 9000;
  const TARGET_LOCK_SECONDS = { '攻撃手': 1.8, '狙撃手': 2.7, '射手': 2.05, '銃手': 2.0, '万能手': 1.85, '重装手': 1.9, '工作手': 2.15, 'プレイヤー': 1.8 };
  const SHOOTER_CHARGE_BASE = { asteroid: .24, hound: .31, viper: .35, meteor: .43 };
  const MELEE_CHAIN_MAX = { kogetsu: 3, scorpion: 4, raygust: 3 };
  const MELEE_CHAIN_STEP = { kogetsu: .16, scorpion: .125, raygust: .19 };
  const ATTACK_LABELS = {
    scorpionLong: 'スコーピオン（長刃）',
    mantis: 'マンティス',
    switchboxAttack: 'スイッチボックス（攻撃）',
    meteorMine: '設置メテオラ',
  };
  const AI_DIFFICULTIES = {
    sandbag: { label: 'サンドバッグ', rethink: [1.4, 2.2], aimError: 4.2, move: 0, shieldChance: 0, utilityChance: 0, attackInterval: [99, 99], comboChance: 0, prediction: 0, guardSkill:0, parrySkill:0, dodgeSkill:0, patience:0 },
    weak: { label: '弱', rethink: [.72, 1.28], aimError: 2.35, move: .7, shieldChance: .22, utilityChance: .3, attackInterval: [.38, .78], comboChance: .015, prediction: 0, guardSkill:.2, parrySkill:.08, dodgeSkill:.18, patience:.12 },
    normal: { label: '普通', rethink: [.24, .54], aimError: 1, move: 1, shieldChance: .66, utilityChance: .72, attackInterval: [.16, .34], comboChance: .09, prediction: .08, guardSkill:.48, parrySkill:.3, dodgeSkill:.42, patience:.48 },
    strong: { label: '強', rethink: [.09, .22], aimError: .34, move: 1.1, shieldChance: .9, utilityChance: .94, attackInterval: [.1, .23], comboChance: .3, prediction: .26, guardSkill:.93, parrySkill:.8, dodgeSkill:.84, patience:.9 },
  };
  const DEFENSE_BUILD_DEFS = {
    barrier: { label: '防壁', cost: 22, cooldown: 7, ttl: 78, maxActive: 8 },
    trap: { label: '固定トラップ', cost: 26, cooldown: 10, ttl: 86, maxActive: 5 },
    turret: { label: '固定砲台', cost: 40, cooldown: 16, ttl: 92, maxActive: 4 },
    decoy: { label: '囮ビーコン', cost: 16, cooldown: 8, ttl: 48, maxActive: 5 },
  };
  const GAME_VERSION = 73;
  const MASTERY_RANKS = [
    { id:'C', min:0, color:'#9fb0b8' },
    { id:'B-', min:22, color:'#7fc7df' },
    { id:'B+', min:38, color:'#66e0d0' },
    { id:'A-', min:55, color:'#8cf58d' },
    { id:'A+', min:72, color:'#ffd36b' },
    { id:'S', min:90, color:'#ff8fcb' },
  ];
  const MASTERY_SPECIAL_ATTACKS = new Set(['senku','mantis','thruster']);
  const MASTERY_TRAP_SOURCES = new Set(['switchbox','switchboxAttack','fixedTrap','spider','meteorMine']);
  const BEGINNER_SKILLS = {
    none: { label: '使用しない', budget: 18, description: '従来どおり18ポイントを能力へ配分します。' },
    autoGuard: { label: 'オートガード', budget: 12, description: 'シールドまたはレイガスト装備時、被弾直前に自動防御します。' },
    aimAssist: { label: 'エイム補正', budget: 12, description: '銃手・狙撃手の照準を近い敵へ弱く補正します。' },
    thrifty: { label: '倹約家', budget: 12, description: 'すべてのトリオン消費を約18%削減します。' },
  };
  const DEFAULT_KEY_BINDINGS = {
    moveUp:'KeyW', moveDown:'KeyS', moveLeft:'KeyA', moveRight:'KeyD',
    mainSlot1:'Digit1', mainSlot2:'Digit2', mainSlot3:'Digit3', mainSlot4:'Digit4',
    subSlot1:'Digit5', subSlot2:'Digit6', subSlot3:'Digit7', subSlot4:'Digit8',
    modifier:'ShiftLeft', combo:'KeyC', scope:'KeyR', utility:'KeyZ', bailout:'KeyB', flagRepair:'KeyF',
    spectate:'KeyV', spectatorPrev:'KeyQ', spectatorNext:'KeyE', operatorPanel:'KeyO', battleLog:'KeyL', guide:'KeyG', pause:'KeyP',
  };
  const KEY_LABELS = {
    KeyW:'W',KeyA:'A',KeyS:'S',KeyD:'D',KeyC:'C',KeyR:'R',KeyZ:'Z',KeyB:'B',KeyF:'F',KeyP:'P',
    KeyQ:'Q',KeyE:'E',KeyG:'G',KeyL:'L',KeyO:'O',KeyV:'V',
    Digit1:'1',Digit2:'2',Digit3:'3',Digit4:'4',Digit5:'5',Digit6:'6',Digit7:'7',Digit8:'8',
    Numpad1:'NUM1',Numpad2:'NUM2',Numpad3:'NUM3',Numpad4:'NUM4',Numpad5:'NUM5',Numpad6:'NUM6',Numpad7:'NUM7',Numpad8:'NUM8',
    Space:'SPACE',Escape:'ESC',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',ShiftLeft:'SHIFT',ShiftRight:'SHIFT',
  };
  const AI_TIER_PROFILES = {
    lower: { label:'下級', aim:1.68, reaction:1.58, decision:.6, aggression:.66, defense:.62 },
    middle: { label:'中級', aim:1, reaction:1, decision:1, aggression:1, defense:1 },
    upper: { label:'上級', aim:.48, reaction:.52, decision:1.52, aggression:1.34, defense:1.42 },
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
    const defense = logs.filter((log) => log.mode === 'defense').map((log) => {
      const human = log.players?.find((player) => player.human) || log.players?.find((player) => !player.isDefenseEnemy) || {};
      const round = Number(log.defense?.round || log.defenseRound || 1);
      const score = Number(human.score || 0) + round * 500;
      return {
        name: human.squadName || log.humanConfig?.teamConfig?.squadName || '防衛隊',
        score,
        detail: `ROUND ${round} / ${human.kills || 0}撃破`,
      };
    }).sort((a, b) => b.score - a.score);
    makeRows(solo, '#soloTitleRanking');
    makeRows(team, '#teamTitleRanking', true);
    makeRows(defense, '#defenseTitleRanking', true);
  }

  function showTitle() {
    if (game) game.destroy();
    game = null;
    window.__TRION_GAME__ = null;
    document.body.classList.remove('game-active');
    document.documentElement.classList.remove('game-active');
    $('#gameScreen')?.classList.add('hidden');
    $('#setupScreen')?.classList.add('hidden');
    $('#tutorialScreen')?.classList.add('hidden');
    $('#titleGuidePanel')?.classList.add('hidden');
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
    $('#tutorialScreen')?.classList.add('hidden');
    $('#setupScreen')?.classList.remove('hidden');
    syncSetupUI();
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.dispatchEvent(new CustomEvent('trion:setup-shown', { detail: { manualGuide: Boolean(options.guide) } }));
    if (options.controls) {
      $('#controlsDetailPanel')?.setAttribute('open','');
      setTimeout(() => $('.controls-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    }
  }

  window.TRION_SHOW_TITLE = showTitle;
  window.TRION_SHOW_SETUP = showSetup;

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
    extraBaseMode: 'solo',
    extraPlayerType: 'agent',
    extraDefenseEnemyType: 'agent',
    stats: { trion: 6, technique: 6, combat: 6 },
    beginnerSkill: 'none',
    budget: 18,
    keyBindings: { ...DEFAULT_KEY_BINDINGS },
    difficulty: 'normal',
    mapId: 'city',
    playerRole: 'combatant',
    teamCount: 2,
    teamSize: 3,
    defenseScenario: 'blackTrigger',
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

  const TUTORIAL_COURSE_CONFIGS = {
    basic: {
      label: '基本操作', cpuCount: 1, targetDistance: 360,
      main: ['kogetsu', 'shield', 'empty', 'empty'],
      sub: ['shield', 'grasshopper', 'empty', 'empty'],
    },
    attacker: {
      label: '攻撃手訓練', cpuCount: 3, targetDistance: 170,
      main: ['kogetsu', 'senku', 'scorpion', 'raygust'],
      sub: ['shield', 'thruster', 'grasshopper', 'empty'],
    },
    shooter: {
      label: '射手訓練', cpuCount: 3, targetDistance: 520,
      main: ['shooter_asteroid', 'shooter_hound', 'shooter_viper', 'shooter_meteor'],
      sub: ['shield', 'shooter_asteroid', 'shooter_hound', 'empty'],
    },
    gunner: {
      label: '銃手訓練', cpuCount: 3, targetDistance: 560,
      main: ['gun_assault_asteroid', 'gun_assault_hound', 'gun_handgun_asteroid', 'gun_shotgun_asteroid'],
      sub: ['shield', 'starmaker', 'leadBullet', 'empty'],
    },
    sniper: {
      label: '狙撃手訓練', cpuCount: 3, targetDistance: 920,
      main: ['egret', 'lightning', 'ibis', 'shield'],
      sub: ['bagworm', 'shield', 'grasshopper', 'empty'],
    },
  };
  const TUTORIAL_COURSE_IDS = Object.keys(TUTORIAL_COURSE_CONFIGS);

  const CPU_NAMES = ['AZ-01', 'MI-02', 'KA-03', 'SU-04', 'NA-05', 'OU-06', 'IK-07', 'YU-08', 'AR-09', 'NI-10', 'KU-11', 'TS-12', 'KO-13', 'IK-14', 'SA-15', 'KI-16', 'UR-17', 'TO-18', 'EB-19'];

  function balancedCpuTemplateIndex(index, source = setup) {
    const effectiveMode = effectiveSetupMode(source);
    if (!isSquadModeValue(effectiveMode)) return index % DATA.aiLoadouts.length;
    const team = cpuTeamForIndex(index, source);
    let priorInTeam = 0;
    for (let i = 0; i < index; i++) if (cpuTeamForIndex(i, source) === team) priorInTeam += 1;
    const occupied = team === 0 && source.playerRole === 'combatant' ? 1 : 0;
    const slot = priorInTeam + occupied;
    const patterns = [
      [0, 2, 3, 4],
      [5, 2, 1, 4],
      [6, 0, 3, 2],
      [0, 5, 1, 4],
    ];
    if (Number(source.teamSize || 3) <= 1) return 0;
    return patterns[team % patterns.length][slot % 4];
  }

  function makeCpuConfig(index) {
    const template = DATA.aiLoadouts[balancedCpuTemplateIndex(index)];
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
      extraType: 'agent',
    };
  }

  function playerOccupiesCombatantSlot() {
    return setup.playerRole === 'combatant';
  }

  function requiredCpuCount() {
    const mode = effectiveSetupMode(setup);
    if (mode === 'solo') return Number($('#cpuCount')?.value || 11);
    if (mode === 'defense') return Math.max(0, setup.teamSize - (playerOccupiesCombatantSlot() ? 1 : 0));
    const totalCombatants = setup.teamSize * setup.teamCount;
    return Math.max(1, totalCombatants - (playerOccupiesCombatantSlot() ? 1 : 0));
  }

  function cpuTeamForIndex(index, source = setup) {
    const mode = effectiveSetupMode(source);
    if (mode === 'defense') return 0;
    if (mode !== 'team') return index + 1;
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
    setup.cpuConfigs = setup.cpuConfigs.slice(0, count).map((cfg, i) => ({ ...makeCpuConfig(i), ...cfg, extraType: EXTRA_UNIT_DEFS[cfg.extraType] ? cfg.extraType : 'agent', stats: { ...makeCpuConfig(i).stats, ...(cfg.stats || {}) }, main: Array.isArray(cfg.main) && cfg.main.length === 4 ? cfg.main : makeCpuConfig(i).main, sub: Array.isArray(cfg.sub) && cfg.sub.length === 4 ? cfg.sub : makeCpuConfig(i).sub }));
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
    const effectiveMode = effectiveSetupMode(setup);
    $('#cpuRosterSummary').textContent = effectiveMode === 'team'
      ? `${setup.teamCount}チーム × 戦闘員${setup.teamSize}人・オペレーター各1人${setup.mode==='extra'?' / EXTRA':''}`
      : effectiveMode === 'defense'
        ? `防衛隊 戦闘員${setup.teamSize}人・オペレーター1人${setup.mode==='extra'?' / EXTRA':''}`
        : `CPU ${count}人${setup.mode==='extra'?' / EXTRA':''}`;
    root.innerHTML = '';
    setup.cpuConfigs.forEach((config, index) => {
      const mode = effectiveSetupMode(setup);
      const team = isSquadModeValue(mode) ? cpuTeamForIndex(index) : index + 1;
      const teamText = mode === 'team' ? TEAM_SHORT_NAMES[team] : mode === 'defense' ? 'DEFENSE' : 'SOLO';
      const card = document.createElement('details');
      card.className = 'cpu-card';
      card.innerHTML = `<summary><span class="cpu-cube-icon">${String(index + 1).padStart(2, '0')}</span><span class="cpu-card-title"><strong>${config.name}</strong><span>${config.archetype} / T${config.stats.trion} 技${config.stats.technique} 戦${config.stats.combat}</span></span><span class="cpu-team-tag" style="color:${isSquadModeValue(mode) ? TEAM_COLORS[team] : '#9db3bc'}">${teamText}</span></summary><div class="cpu-card-body"><div class="cpu-basic-grid"><label>名称<input class="cpu-name" value="${config.name.replace(/"/g, '&quot;')}"></label><label>基本型<select class="cpu-archetype">${DATA.aiLoadouts.map((t) => `<option value="${t.name}"${t.name === config.archetype ? ' selected' : ''}>${t.name}</option>`).join('')}</select></label>${setup.mode==='extra'?`<label>エキストラ形態<select class="cpu-extra-type">${extraUnitOptionsHtml(config.extraType||'agent')}</select></label>`:''}</div><div class="cpu-stat-row">${['trion','technique','combat'].map((key) => `<label>${key === 'trion' ? 'トリオン' : key === 'technique' ? '技術' : '戦闘'} <output>${config.stats[key]}</output><input type="range" min="2" max="10" value="${config.stats[key]}" data-stat="${key}"></label>`).join('')}</div><div class="cpu-loadout">${['main','sub'].map((hand) => `<div class="cpu-loadout-column"><b>${hand === 'main' ? 'RIGHT / MAIN' : 'LEFT / SUB'}</b>${config[hand].map((id, slot) => `<label>${slot + 1}<select data-hand="${hand}" data-slot="${slot}">${triggerOptionsHtml(id)}</select></label>`).join('')}</div>`).join('')}</div></div>`;
      card.querySelector('.cpu-name').addEventListener('input', (event) => { config.name = event.target.value.slice(0, 18) || `CPU-${index + 1}`; saveSetup(); });
      card.querySelector('.cpu-extra-type')?.addEventListener('change', (event) => { config.extraType = EXTRA_UNIT_DEFS[event.target.value] ? event.target.value : 'agent'; saveSetup(); });
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
    const isExtra = setup.mode === 'extra';
    const effectiveMode = effectiveSetupMode(setup);
    const isTeam = effectiveMode === 'team';
    const isDefense = effectiveMode === 'defense';
    const isSquad = isTeam || isDefense;
    const teamSizeInput = $('#teamSize');
    if (teamSizeInput) {
      teamSizeInput.max = isDefense ? '8' : '4';
      setup.teamSize = clamp(Number(setup.teamSize || 3), 1, isDefense ? 8 : 4);
      teamSizeInput.value = setup.teamSize;
      if ($('#teamSizeValue')) $('#teamSizeValue').textContent = String(setup.teamSize);
    }
    if (!isSquad && setup.playerRole === 'operator') setup.playerRole = 'spectator';
    $('#extraModeFields')?.classList.toggle('hidden', !isExtra);
    $('#soloCountFields')?.classList.toggle('hidden', isSquad);
    $('#teamCountFields')?.classList.toggle('hidden', !isSquad);
    $('#teamCountOnly')?.classList.toggle('hidden', !isTeam);
    $('#matchLengthFields')?.classList.toggle('hidden', isDefense);
    $('#defenseScenarioField')?.classList.toggle('hidden', !isDefense);
    if ($('#defenseScenario')) $('#defenseScenario').value = setup.defenseScenario;
    if ($('#defenseScenarioHelp')) $('#defenseScenarioHelp').textContent = setup.defenseScenario === 'hyakki'
      ? '骸骨兵と五体の妖怪ボスが襲来する百鬼夜行の防衛戦です。'
      : '従来のブラックトリガー・近界民迎撃シナリオです。';
    const roleSelect = $('#participationRole');
    if (roleSelect) {
      const operatorOption = roleSelect.querySelector('option[value="operator"]');
      if (operatorOption) operatorOption.disabled = !isSquad;
      roleSelect.disabled = false;
      roleSelect.value = setup.playerRole;
    }
    const roleHelp = {
      combatant: isDefense ? '防衛隊の戦闘員としてフラッグを守ります。' : '自分で隊員を操作して戦います。',
      operator: isDefense ? '盤面外から防衛隊へ指示と支援を送り、フラッグ防衛を補助します。' : '盤面には出撃せず、戦闘員数にも含まれません。作戦画面からNPCへ指示と支援を送ります。',
      spectator: isDefense ? '戦闘員数には入らず、防衛戦を観戦します。' : isTeam ? '戦闘員数には入らず、各チームの戦闘を観戦します。' : 'プレイヤーを出撃させず、CPU戦を観戦します。',
    };
    if ($('#participationHelp')) $('#participationHelp').textContent = isExtra && setup.playerRole==='combatant' ? `${roleHelp[setup.playerRole]} エキストラ形態を選択できます。` : roleHelp[setup.playerRole];
    $$('.combatant-only').forEach((element) => element.classList.toggle('role-disabled', setup.playerRole !== 'combatant'));
    if ($('#teamRosterHelp')) $('#teamRosterHelp').textContent = isDefense
      ? (setup.playerRole === 'combatant' ? '設定人数にプレイヤーを1人として含みます。共通のフラッグを守ります。' : 'プレイヤーは戦闘員数に含まれず、設定人数ぶんのCPU戦闘員が出撃します。')
      : setup.playerRole === 'combatant'
        ? '自チームの戦闘員数にプレイヤーを1人として含みます。各チームにオペレーターが1人付きます。'
        : 'プレイヤーは戦闘員数に含まれません。全チームが設定人数ぶんのCPU戦闘員を持ちます。';
    if ($('#extraBaseMode')) $('#extraBaseMode').value = setup.extraBaseMode;
    if ($('#extraPlayerType')) $('#extraPlayerType').innerHTML = extraUnitOptionsHtml(setup.extraPlayerType || 'agent');
    if ($('#extraDefenseEnemyType')) $('#extraDefenseEnemyType').innerHTML = extraUnitOptionsHtml(setup.extraDefenseEnemyType || 'agent');
    $('#extraDefenseEnemyRow')?.classList.toggle('hidden', !isExtra || !isDefense);
    const rule = $('#mapRuleText');
    if (rule && isExtra) rule.textContent = `エキストラ：${EXTRA_BASE_MODE_LABELS[effectiveMode]}の通常ルールで、各参加者を隊員または防衛戦ユニットとして出撃させます。`;
    else if (rule && isDefense) rule.textContent = setup.defenseScenario === 'hyakki'
      ? 'フラッグを守りながら、骸骨兵と百鬼夜行の妖怪ボスを迎撃します。Fキーで自分のトリオンを注ぎ、フラッグを修復できます。'
      : 'フラッグを守りながら、ラウンドごとに現れるトリオン兵を撃退します。Fキーで自分のトリオンを注ぎ、フラッグを修復できます。';
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

  function normalizeStatsToBudget(stats, budget) {
    const result = { trion: clamp(Number(stats?.trion || 2), 2, 10), technique: clamp(Number(stats?.technique || 2), 2, 10), combat: clamp(Number(stats?.combat || 2), 2, 10) };
    let total = Object.values(result).reduce((a,b)=>a+b,0);
    const keys = ['trion','technique','combat'];
    let guard = 0;
    while (total > budget && guard++ < 100) {
      const key = [...keys].sort((a,b)=>result[b]-result[a])[0];
      if (result[key] <= 2) break;
      result[key]--; total--;
    }
    guard = 0;
    while (total < budget && guard++ < 100) {
      const key = [...keys].sort((a,b)=>result[a]-result[b])[0];
      if (result[key] >= 10) break;
      result[key]++; total++;
    }
    return result;
  }

  function applyBeginnerSkillBudget(skillId, announce = false) {
    setup.beginnerSkill = BEGINNER_SKILLS[skillId] ? skillId : 'none';
    setup.budget = BEGINNER_SKILLS[setup.beginnerSkill].budget;
    setup.stats = normalizeStatsToBudget(setup.stats, setup.budget);
    const help = $('#beginnerSkillHelp');
    if (help) help.textContent = BEGINNER_SKILLS[setup.beginnerSkill].description;
    if (announce && setup.beginnerSkill !== 'none') help.textContent += ' 能力配分上限は12です。';
    syncStatsUI();
  }

  function keyLabel(code) {
    return KEY_LABELS[code] || String(code || '').replace(/^Key/,'').replace(/^Digit/,'');
  }

  function syncKeybindUI() {
    $$('[data-keybind]').forEach((button) => {
      const action = button.dataset.keybind;
      button.textContent = keyLabel(setup.keyBindings[action] || DEFAULT_KEY_BINDINGS[action]);
    });
  }

  function bindKeyCapture() {
    let captureButton = null;
    const stopCapture = () => {
      if (captureButton) captureButton.classList.remove('capturing');
      captureButton = null;
    };
    $('#keybindGrid')?.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-keybind]');
      if (!button) return;
      stopCapture();
      captureButton = button;
      button.classList.add('capturing');
      button.textContent = '入力…';
      $('#keybindMessage').textContent = '割り当てるキーを押してください。Escでキャンセルします。';
    });
    window.addEventListener('keydown', (event) => {
      if (!captureButton) return;
      event.preventDefault();
      if (event.code === 'Escape') { stopCapture(); syncKeybindUI(); return; }
      const action = captureButton.dataset.keybind;
      setup.keyBindings[action] = event.code;
      stopCapture();
      syncKeybindUI();
      $('#keybindMessage').textContent = `${action} を ${keyLabel(event.code)} に変更しました。`;
      saveSetup();
    }, true);
    $('#resetKeybinds')?.addEventListener('click', () => {
      setup.keyBindings = { ...DEFAULT_KEY_BINDINGS };
      syncKeybindUI(); saveSetup();
      $('#keybindMessage').textContent = '標準キーへ戻しました。';
    });
  }

  async function loadEmblemImageFile(file, onPixels, messageElement) {
    if (!file) return;
    const message = messageElement || $('#emblemUploadMessage');
    try {
      const url = URL.createObjectURL(file);
      const image = new Image();
      await new Promise((resolve,reject)=>{ image.onload=resolve; image.onerror=reject; image.src=url; });
      URL.revokeObjectURL(url);
      if (image.naturalWidth !== 32 || image.naturalHeight !== 32) throw new Error('画像サイズは32×32ピクセルにしてください。');
      const canvas = document.createElement('canvas'); canvas.width=32; canvas.height=32;
      const ctx = canvas.getContext('2d',{willReadFrequently:true}); ctx.imageSmoothingEnabled=false; ctx.drawImage(image,0,0);
      const data = ctx.getImageData(0,0,32,32).data;
      const pixels=[];
      for(let i=0;i<32*32;i++){
        const a=data[i*4+3], r=data[i*4], g=data[i*4+1], b=data[i*4+2];
        if(a<20){pixels.push(0);continue;}
        const max=Math.max(r,g,b), min=Math.min(r,g,b), lum=(r+g+b)/3;
        if(max-min>18 || (lum>28 && lum<227)) throw new Error('白・黒・透明だけの画像を使用してください。');
        pixels.push(lum<128?1:0);
      }
      onPixels(pixels);
      if(message) message.textContent='32×32白黒隊章を読み込みました。';
    } catch(error) {
      if(message) message.textContent=error.message || '隊章を読み込めませんでした。';
    }
  }

  function bindSetupControls() {
    $('#enterSetupButton')?.addEventListener('click', () => showSetup());
    $('#titleGuideButton')?.addEventListener('click', () => window.TRION_ONBOARDING?.openGuide?.());
    $('#setupBackTitle')?.addEventListener('click', showTitle);

    $('#modeSelector').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-mode]');
      if (!button) return;
      if (button.dataset.mode === 'tutorial') {
        window.TRION_TUTORIAL?.open?.();
        return;
      }
      setup.mode = button.dataset.mode;
      $$('#modeSelector button').forEach((b) => b.classList.toggle('active', b.dataset.mode === setup.mode));
      syncModeFields();
      saveSetup();
    });

    $('#extraBaseMode')?.addEventListener('change', (event) => { setup.extraBaseMode = ['solo','team','defense'].includes(event.target.value) ? event.target.value : 'solo'; syncModeFields(); saveSetup(); });
    $('#extraPlayerType')?.addEventListener('change', (event) => { setup.extraPlayerType = EXTRA_UNIT_DEFS[event.target.value] ? event.target.value : 'agent'; saveSetup(); });
    $('#extraDefenseEnemyType')?.addEventListener('change', (event) => { setup.extraDefenseEnemyType = EXTRA_UNIT_DEFS[event.target.value] ? event.target.value : 'agent'; saveSetup(); });

    $('#cpuCount').addEventListener('input', (event) => {
      $('#cpuCountValue').textContent = event.target.value;
      buildCpuConfigList();
      saveSetup();
    });
    $('#participationRole').addEventListener('change', (event) => { setup.playerRole = PLAYER_ROLES.includes(event.target.value) ? event.target.value : 'combatant'; syncModeFields(); saveSetup(); });
    $('#teamCount').addEventListener('input', (event) => { setup.teamCount = clamp(Number(event.target.value), 2, 4); $('#teamCountValue').textContent = setup.teamCount; buildCpuConfigList(); saveSetup(); });
    $('#teamSize').addEventListener('input', (event) => { setup.teamSize = Number(event.target.value); $('#teamSizeValue').textContent = event.target.value; buildCpuConfigList(); saveSetup(); });
    $('#defenseScenario')?.addEventListener('change', (event) => { setup.defenseScenario = DEFENSE_SCENARIO_LABELS[event.target.value] ? event.target.value : 'blackTrigger'; syncModeFields(); saveSetup(); });
    $('#timeOfDay').addEventListener('change', (event) => { setup.timeOfDay = event.target.value; saveSetup(); });
    $('#timeProgression').addEventListener('change', (event) => { setup.timeProgression = event.target.value === 'on'; saveSetup(); });
    $('#weather').addEventListener('change', (event) => { setup.weather = event.target.value; saveSetup(); });
    $('#weatherChange').addEventListener('change', (event) => { setup.weatherChange = event.target.value === 'on'; saveSetup(); });
    $('#resetCpuConfigsButton').addEventListener('click', () => { setup.cpuConfigs = []; ensureCpuConfigs(); buildCpuConfigList(); saveSetup(); });
    $('#guideEnabled')?.addEventListener('change', (event) => { setup.guideEnabled = event.target.checked; saveSetup(); });
    $('#soundEnabled')?.addEventListener('change', (event) => { setup.soundEnabled = event.target.checked; saveSetup(); });
    $('#beginnerSkill')?.addEventListener('change', (event) => { applyBeginnerSkillBudget(event.target.value, true); saveSetup(); });
    $('#emblemUpload')?.addEventListener('change', (event) => loadEmblemImageFile(event.target.files?.[0], (pixels) => {
      setup.teamConfig.emblemPreset = 'custom'; setup.teamConfig.emblemPixels = emblemToString(pixels); syncTeamCustomizationUI(); saveSetup();
    }, $('#emblemUploadMessage')));
    bindKeyCapture();
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
    stats[changed] = clamp(desired, 2, 10);
    let delta = stats[changed] - old;
    const others = Object.keys(stats).filter((key) => key !== changed);
    let guard = 0;
    while (delta !== 0 && guard++ < 100) {
      let changedAny = false;
      for (const key of others) {
        if (delta > 0 && stats[key] > 2) { stats[key] -= 1; delta -= 1; changedAny = true; }
        else if (delta < 0 && stats[key] < 10) { stats[key] += 1; delta += 1; changedAny = true; }
        if (delta === 0) break;
      }
      if (!changedAny) break;
    }
    if (delta !== 0) stats[changed] = old;
    setup.stats = normalizeStatsToBudget(stats, setup.budget);
    syncStatsUI();
    saveSetup();
  }

  function syncStatsUI() {
    for (const stat of ['trion', 'technique', 'combat']) {
      $(`#${stat}Stat`).value = setup.stats[stat];
      $(`#${stat}Value`).textContent = setup.stats[stat];
    }
    const total = Object.values(setup.stats).reduce((a, b) => a + b, 0);
    if ($('#beginnerSkill')) $('#beginnerSkill').value = setup.beginnerSkill;
    $('#budgetValue').textContent = `${total} / ${setup.budget}`;
    $('#budgetValue').style.color = total === setup.budget ? 'var(--green)' : 'var(--red)';
  }

  function saveSetup() {
    try {
      localStorage.setItem('trionArenaSetup', JSON.stringify({
        mode: setup.mode,
        extraBaseMode: setup.extraBaseMode,
        extraPlayerType: setup.extraPlayerType,
        extraDefenseEnemyType: setup.extraDefenseEnemyType,
        stats: setup.stats,
        beginnerSkill: setup.beginnerSkill,
        keyBindings: setup.keyBindings,
        main: setup.main,
        sub: setup.sub,
        cpuCount: Number($('#cpuCount')?.value || 11),
        matchLength: Number($('#matchLength')?.value ?? 180),
        difficulty: setup.difficulty,
        mapId: setup.mapId,
        playerRole: setup.playerRole,
        teamCount: setup.teamCount,
        teamSize: setup.teamSize,
        defenseScenario: setup.defenseScenario,
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
      if (['solo', 'team', 'defense', 'extra'].includes(saved.mode)) setup.mode = saved.mode;
      else if (saved.mode === 'sandbox') setup.mode = 'extra';
      if (['solo','team','defense'].includes(saved.extraBaseMode)) setup.extraBaseMode = saved.extraBaseMode;
      if (EXTRA_UNIT_DEFS[saved.extraPlayerType]) setup.extraPlayerType = saved.extraPlayerType;
      if (EXTRA_UNIT_DEFS[saved.extraDefenseEnemyType]) setup.extraDefenseEnemyType = saved.extraDefenseEnemyType;
      setup.beginnerSkill = BEGINNER_SKILLS[saved.beginnerSkill] ? saved.beginnerSkill : 'none';
      setup.budget = BEGINNER_SKILLS[setup.beginnerSkill].budget;
      if (saved.stats) setup.stats = normalizeStatsToBudget(saved.stats, setup.budget);
      if (saved.keyBindings && typeof saved.keyBindings === 'object') setup.keyBindings = { ...DEFAULT_KEY_BINDINGS, ...saved.keyBindings };
      if (Array.isArray(saved.main) && saved.main.length === 4) setup.main = saved.main.map((id) => DATA.triggers[id] ? id : 'empty');
      if (Array.isArray(saved.sub) && saved.sub.length === 4) setup.sub = saved.sub.map((id) => DATA.triggers[id] ? id : 'empty');
      if (saved.cpuCount) $('#cpuCount').value = clamp(saved.cpuCount, 3, 19);
      if (saved.matchLength !== undefined && saved.matchLength !== null) $('#matchLength').value = String(saved.matchLength);
      if (AI_DIFFICULTIES[saved.difficulty]) setup.difficulty = saved.difficulty;
      if (MAP_IDS.includes(saved.mapId)) setup.mapId = saved.mapId;
      if (PLAYER_ROLES.includes(saved.playerRole)) setup.playerRole = saved.playerRole;
      if (saved.teamCount) setup.teamCount = clamp(Number(saved.teamCount), 2, 4);
      if (saved.teamSize) setup.teamSize = clamp(Number(saved.teamSize), 1, 8);
      if (DEFENSE_SCENARIO_LABELS[saved.defenseScenario]) setup.defenseScenario = saved.defenseScenario;
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
    const timeSelect = $('#timeOfDay');
    const timeProgression = $('#timeProgression');
    const weatherChange = $('#weatherChange');
    if (rainOption) {
      rainOption.disabled = mapId === 'desert' || mapId === 'underground';
      rainOption.hidden = mapId === 'desert' || mapId === 'underground';
    }
    const fixedUnderground = mapId === 'underground';
    if (mapId === 'desert' && setup.weather === 'rain') setup.weather = 'clear';
    if (fixedUnderground) {
      setup.weather = 'clear';
      setup.weatherChange = false;
      setup.timeOfDay = 'day';
      setup.timeProgression = false;
    }
    if (weatherSelect) {
      weatherSelect.disabled = fixedUnderground;
      weatherSelect.value = setup.weather;
    }
    if (timeSelect) {
      timeSelect.disabled = fixedUnderground;
      timeSelect.value = setup.timeOfDay;
    }
    if (timeProgression) timeProgression.disabled = fixedUnderground;
    if (weatherChange) weatherChange.disabled = fixedUnderground;
    const help = $('#mapHelp');
    const rule = $('#mapRuleText');
    if (help) help.textContent = mapId === 'desert'
      ? '古代要塞、崖、流砂、砂丘、オアシス、松明、ガス田がある乾燥地帯です。雨は降りません。'
      : mapId === 'snowShrine'
        ? '寝殿造の廊下と大部屋が雪庭を囲む和風神殿です。障子、酒樽、人魂、神像が配置されています。'
        : mapId === 'underground'
          ? '旅客用ホームと業務用通路が連結した地下通路です。通過電車、水路、汚泥、ブレーカーなどのギミックがあります。'
          : '道路・河川・林・ビルが混在する市街戦マップです。';
    if (rule && setup.mode !== 'defense' && setup.mode !== 'extra') rule.textContent = mapId === 'desert'
      ? '砂漠では昼は日陰・オアシス、夜は火のそばで環境によるトリオン消費増加を解除できます。ガス田付近で爆発攻撃を使うと大爆発します。'
      : mapId === 'snowShrine'
        ? '雪庭ではトリオン消費が34%増加します。障子と人魂は再生し、酒樽は爆発攻撃で誘爆します。東西の神像は一定間隔でトリオンを分けます。'
        : mapId === 'underground'
          ? '電光掲示板の残り時間が0になると通過電車が走ります。ホームドア、水門、ブレーカーは近くで特殊操作キーを押して切り替えます。線路を渡るにはホームドアを開けてください。'
          : '撃破・トリオン粒子回収でポイント獲得。時間終了時の個人／チームスコアで順位を決定します。';
  }

  function syncSetupUI() {
    $$('#modeSelector button').forEach((b) => b.classList.toggle('active', b.dataset.mode === setup.mode));
    if ($('#extraBaseMode')) $('#extraBaseMode').value = setup.extraBaseMode;
    if ($('#extraPlayerType')) $('#extraPlayerType').innerHTML = extraUnitOptionsHtml(setup.extraPlayerType || 'agent');
    if ($('#extraDefenseEnemyType')) $('#extraDefenseEnemyType').innerHTML = extraUnitOptionsHtml(setup.extraDefenseEnemyType || 'agent');
    $('#cpuCountValue').textContent = $('#cpuCount').value;
    $('#difficulty').value = setup.difficulty;
    $('#mapId').value = setup.mapId;
    $('#participationRole').value = setup.playerRole;
    $('#teamCount').value = setup.teamCount;
    $('#teamCountValue').textContent = setup.teamCount;
    $('#teamSize').value = setup.teamSize;
    $('#teamSizeValue').textContent = setup.teamSize;
    if ($('#defenseScenario')) $('#defenseScenario').value = setup.defenseScenario;
    $('#timeOfDay').value = setup.timeOfDay;
    $('#timeProgression').value = setup.timeProgression ? 'on' : 'off';
    $('#weather').value = setup.weather;
    $('#weatherChange').value = setup.weatherChange ? 'on' : 'off';
    if ($('#guideEnabled')) $('#guideEnabled').checked = setup.guideEnabled;
    if ($('#soundEnabled')) $('#soundEnabled').checked = setup.soundEnabled;
    applyBeginnerSkillBudget(setup.beginnerSkill);
    syncKeybindUI();
    syncStatsUI();
    buildLoadoutSlots();
    syncModeFields();
    syncMapWeatherUi();
    syncTeamCustomizationUI();
  }

  function getSetupConfig() {
    const effectiveMode = effectiveSetupMode(setup);
    return {
      mode: effectiveMode,
      extraEnabled: setup.mode === 'extra',
      extraBaseMode: effectiveMode,
      extraPlayerType: setup.mode === 'extra' ? setup.extraPlayerType : 'agent',
      extraDefenseEnemyType: setup.mode === 'extra' ? setup.extraDefenseEnemyType : 'agent',
      playerRole: setup.playerRole,
      cpuCount: requiredCpuCount(),
      teamCount: effectiveMode === 'team' ? setup.teamCount : effectiveMode === 'defense' ? 1 : 0,
      teamSize: setup.teamSize,
      defenseScenario: setup.defenseScenario,
      matchLength: effectiveMode === 'defense' ? 0 : Number($('#matchLength').value),
      difficulty: setup.difficulty,
      mapId: setup.mapId,
      timeOfDay: setup.timeOfDay,
      timeProgression: setup.timeProgression,
      weather: setup.weather,
      weatherChange: setup.weatherChange,
      guideEnabled: setup.guideEnabled,
      soundEnabled: setup.soundEnabled,
      beginnerSkill: setup.beginnerSkill,
      keyBindings: { ...setup.keyBindings },
      gameVersion: GAME_VERSION,
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
  window.TRION_APPLY_TEAM_CONFIG = (teamConfig = {}) => {
    setup.teamConfig = { ...setup.teamConfig, ...JSON.parse(JSON.stringify(teamConfig || {})) };
    syncTeamCustomizationUI();
    saveSetup();
  };
  window.TRION_SHOW_SETUP = (options = {}) => showSetup(options);
  window.TRION_SHOW_TITLE = () => showTitle();
  window.TRION_START_TUTORIAL = (courseId = 'basic') => {
    const course = TUTORIAL_COURSE_CONFIGS[courseId] || TUTORIAL_COURSE_CONFIGS.basic;
    const base = getSetupConfig();
    const cpuConfigs = Array.from({ length: course.cpuCount }, (_, index) => ({
      id: `tutorial-target-${index}`,
      name: `訓練標的 ${String.fromCharCode(65 + index)}`,
      archetype: '訓練標的',
      stats: { trion: 8, technique: 2, combat: 8 },
      main: ['empty', 'empty', 'empty', 'empty'],
      sub: ['empty', 'empty', 'empty', 'empty'],
      squadName: '訓練場',
      appearance: { bodyColor: index % 2 ? '#ff9f72' : '#e27070', emblemPreset: 'cross' },
      extraType: 'agent',
    }));
    const config = {
      ...base,
      mode: 'solo',
      playerRole: 'combatant',
      cpuCount: course.cpuCount,
      cpuConfigs,
      difficulty: 'sandbag',
      mapId: 'city',
      matchLength: 0,
      timeOfDay: 'day',
      timeProgression: false,
      weather: 'clear',
      weatherChange: false,
      guideEnabled: true,
      beginnerSkill: 'none',
      tutorialCourse: TUTORIAL_COURSE_IDS.includes(courseId) ? courseId : 'basic',
      tutorialLabel: course.label,
      tutorialTargetDistance: course.targetDistance,
      loadout: { main: [...course.main], sub: [...course.sub] },
      teamConfig: { ...base.teamConfig, playerName: 'YOU', squadName: '訓練隊' },
    };
    currentConfig = config;
    launchGame(config);
    return window.__TRION_GAME__;
  };
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
    if (base.mode === 'defense') base.teamSize = Math.min(8, Math.max(1, Number(base.teamSize || 3), combatants.length));
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
    $('#tutorialTrainingPanel')?.classList.add('hidden');
    document.body.classList.remove('tutorial-active');
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
      this.virtualAim = { x: 1, y: 0, active: false, touching: false };
      this.virtualMain = false;
      this.virtualSub = false;
      this.virtualMainJust = false;
      this.virtualSubJust = false;
      this.mouse = { x: innerWidth / 2, y: innerHeight / 2, dx: 0, dy: 0, wheel: 0, left: false, right: false, justLeft: false, justRight: false };
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
        this.mouse.dx += Number(e.movementX || 0);
        this.mouse.dy += Number(e.movementY || 0);
      });
      this.bind(canvas, 'wheel', (e) => {
        this.mouse.wheel += Number(e.deltaY || 0);
        e.preventDefault();
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
        this.virtualAim.touching = false;
        this.mouse.dx = 0;
        this.mouse.dy = 0;
        this.mouse.wheel = 0;
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
        const down = (event) => {
          pointerId = event.pointerId;
          if ('touching' in target) target.touching = true;
          pad.setPointerCapture?.(pointerId);
          update(event);
          event.preventDefault();
        };
        const move = (event) => { if (event.pointerId === pointerId) { update(event); event.preventDefault(); } };
        const up = (event) => {
          if (event.pointerId !== pointerId) return;
          pointerId = null;
          if ('touching' in target) target.touching = false;
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
      this.mouse.dx = 0;
      this.mouse.dy = 0;
      this.mouse.wheel = 0;
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
      this.tutorialCourse = TUTORIAL_COURSE_IDS.includes(config.tutorialCourse) ? config.tutorialCourse : null;
      this.isTutorial = Boolean(this.tutorialCourse);
      this.simulationMode = Boolean(config.simulationMode);
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
      this.isExtraMode = Boolean(config.extraEnabled);
      this.isDefenseMode = config.mode === 'defense';
      this.defenseScenario = DEFENSE_SCENARIO_LABELS[config.defenseScenario] ? config.defenseScenario : 'blackTrigger';
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
      this.scopeActive = false;
      this.scopeTarget = null;
      this.scopeAim = 0;
      this.scopeDistance = 0;
      this.scopeTargetDistance = 0;
      this.scopeReticle = { x: 0, y: 0 };
      this.scopeTargetPoint = { x: 0, y: 0 };
      this.terrain = { roads: [], plazas: [], rivers: [], forests: [], buildings: [], bridges: [], dunes: [], oases: [], quicksand: [], cliffs: [], fortresses: [], shades: [], gasFields: [], shrineGardens: [], shrineRooms: [], shrineCorridors: [], shrineCourts: [], shrineStatues: [], torii: [], frozenPonds: [], snowDrifts: [], shrineApproaches: [], shrineSteps: [], shrineDecor: [], subwayTracks: [], subwayPlatforms: [], subwayPassengerZones: [], subwayServiceZones: [], subwayWaterways: [], subwaySludge: [], subwayWires: [], subwayProps: [], subwaySigns: [], subwayCrossings: [] };
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
      this.operatorSupportCooldowns = { scan: 0, supply: 0, flare: 0, barrier: 0, rally: 0, decoy: 0, flagRepair: 0, summonSogetsu:0, summonFullarms:0, summonGeist:0 };
      this.operatorSupportDurations = { scan: 24, supply: 32, flare: 26, barrier: 36, rally: 30, decoy: 28, flagRepair: 32, summonSogetsu:9999, summonFullarms:9999, summonGeist:9999 };
      this.operatorSupportPending = null;
      this.defenseSupportSummoned = { sogetsu:false, fullarms:false, geist:false };
      this.defenseSupportSerial = 0;
      this.defenseSupportLastSummonAt = -999;
      this.operatorStats = { ordersIssued: 0, supportsUsed: 0, scan: 0, supply: 0, flare: 0, barrier: 0, rally: 0, decoy: 0, flagRepair: 0, summonSogetsu:0, summonFullarms:0, summonGeist:0 };
      const initialWeather = (this.mapId === 'desert' || this.mapId === 'underground') && config.weather === 'rain' ? 'clear' : (WEATHER_TYPES.includes(config.weather) ? config.weather : 'clear');
      this.environment = { timeOfDay: TIME_PHASES.includes(config.timeOfDay) ? config.timeOfDay : 'day', timeProgression: Boolean(config.timeProgression), timeTimer: 0, weather: initialWeather, weatherChange: Boolean(config.weatherChange), weatherTimer: rand(75, 115) };
      this.players = [];
      this.defenseFlag = null;
      this.defenseAreas = [];
      this.defenseUltimateUsed = false;
      this.defenseRound = 0;
      this.defenseTier = 0;
      this.defenseWaveActive = false;
      this.defenseRoundTimer = 3.5;
      this.defenseEnemiesDefeated = 0;
      this.defenseBossesDefeated = 0;
      this.defenseHazards = [];
      this.defenseAreas = [];
      this.defenseAreaSerial = 0;
      this.defenseUltimateUsed = false;
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
      this.lifecycleStats = { placedDespawned: 0, terrainDestroyed: 0, terrainRespawned: 0, installationsDestroyed: 0, installationsRespawned: 0, lightsDestroyed: 0, lightsRespawned: 0, gasExplosions: 0, sakeExplosions: 0, spiritsDestroyed: 0, spiritsRespawned: 0, statueBlessings: 0 };
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
      if (this.isTutorial) this.placeTutorialCombatants();
      if (this.isOnlineMatch) this.setupOnlineNetworking();
      this.buildSlotHud();
      this.updateStaticHud();
      this.bindGameUi();
      this.setGuideVisible(this.guideVisible);
      this.refreshOperatorUi();
      this.updateEnvironmentLabel();
      this.logEvent('match_start', `${MAP_LABELS[this.mapId]} / ${this.isExtraMode ? `エキストラ・${MODE_LABELS[this.config.mode]}` : (MODE_LABELS[this.config.mode] || '個人戦')} / ${AI_DIFFICULTIES[this.config.difficulty]?.label || '普通'}`);
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
          shooterCharges: player.shooterCharges, gunState: player.gunState, meleeChains: player.meleeChains, reloadVisual: player.reloadVisual,
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
        for (const key of ['name','team','archetype','squadName','appearance','emblemPixels','stats','loadout','radius','facing','walkFrame','isMoving','maxHp','hp','maxTrion','trion','dead','respawnTimer','invulnTimer','score','kills','deaths','selected','shields','shieldDurability','aiPersonality','masteryValue','masteryRank','toggles','revealTimer','markedTimer','slowTimer','slowFactor','leadWeights','pendingComposite','shooterCharges','gunState','meleeChains','reloadVisual','scorpionMode','spiderMode','aiTier','beginnerSkill','isDefenseEnemy','defenseType','isDefenseBoss','flying','cubedTimer']) {
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
        ['mainSlot1','main',0],['mainSlot2','main',1],['mainSlot3','main',2],['mainSlot4','main',3],
        ['subSlot1','sub',0],['subSlot2','sub',1],['subSlot3','sub',2],['subSlot4','sub',3],
      ];
      let selectionChanged = false;
      for (const [action, hand, index] of selectionKeys) if (this.actionConsume(action)) { p.selected[hand] = index; selectionChanged = true; }
      if (this.onlineInputTimer > 0 && !selectionChanged && !this.input.mouse.justLeft && !this.input.mouse.justRight && !this.input.virtualMainJust && !this.input.virtualSubJust && !this.input.justKeys.has(this.keyCode('combo'))) return;
      this.onlineInputTimer = 1 / this.onlineInputHz;
      let dx = this.input.virtualMove.x, dy = this.input.virtualMove.y;
      if (this.actionDown('moveUp')) dy -= 1; if (this.actionDown('moveDown')) dy += 1;
      if (this.actionDown('moveLeft')) dx -= 1; if (this.actionDown('moveRight')) dx += 1;
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
        shift: this.modifierDown(),
        combo: this.actionConsume('combo'),
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
      if (!['solo','team','defense'].includes(this.config.mode)) return;
      window.trionOnline.submitRanking({
        mode:this.config.mode, displayName:this.human.name, teamName:this.human.squadName,
        score:this.config.mode==='team'?(this.teamScores[this.human.team]||0):this.config.mode==='defense'?((this.human.score||0)+(this.defenseRound||1)*500):this.human.score,
        kills:this.human.kills, deaths:this.human.deaths, matchId:this.matchId, defenseRound:this.config.mode==='defense'?(this.defenseRound||1):0,
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
      } else if (this.isTutorial) {
        this.showCenterMessage('TRAINING', this.config.tutorialLabel || '基本操作', 1.8);
        document.body.classList.add('tutorial-active');
      } else {
        this.showCenterMessage(this.isDefenseMode ? 'DEFENSE' : this.config.mode === 'team' ? 'TEAM BATTLE' : 'SOLO BATTLE', this.isDefenseMode ? 'フラッグを守れ' : 'TRIGGER ON', 1.8);
      }
      if (this.isTutorial) window.dispatchEvent(new CustomEvent('trion:tutorial-game-ready', { detail: { course: this.tutorialCourse } }));
      this.frameHandle = requestAnimationFrame((time) => this.loop(time));
    }

    destroy() {
      this.running = false;
      if (this.isTutorial) {
        document.body.classList.remove('tutorial-active');
        window.dispatchEvent(new CustomEvent('trion:tutorial-game-ended', { detail: { course: this.tutorialCourse } }));
      }
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
      $('#tutorialTrainingPanel')?.classList.add('hidden');
      document.body.classList.remove('tutorial-active');
      $('#gameScreen').classList.add('hidden');
    }

    returnToTitle(reason = 'abandoned') {
      if (!this.isTutorial && !this.logFinalized && this.elapsed > .05) this.finalizeLog(reason);
      this.destroy();
      if (game === this) game = null;
      if (window.__TRION_GAME__ === this) window.__TRION_GAME__ = null;
      this.closeMatchScreens();
      if (this.isOnlineMatch) window.trionOnline?.leaveRoom();
      showTitle();
    }

    returnToSetup(reason = 'abandoned') {
      if (!this.isTutorial && !this.logFinalized && this.elapsed > .05) this.finalizeLog(reason);
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
        const labels = { scan:'索敵',supply:'補給',flare:'照明',barrier:'障壁',rally:'機動',decoy:'囮',flagRepair:'旗修復',summonSogetsu:'双月',summonFullarms:'全武装',summonGeist:'ガイスト' };
        cooldownRoot.innerHTML = Object.entries(this.operatorSupportCooldowns).map(([key, value]) => `<span class="${value > 0 ? 'cooling' : 'ready'}">${labels[key]} ${value > 0 ? `${Math.ceil(value)}s` : 'READY'}</span>`).join('');
      }
      $$('#operatorPanel [data-support]').forEach((button) => {
        const key = button.dataset.support;
        const remaining = this.operatorSupportCooldowns[key] || 0;
        const summonType={summonSogetsu:'sogetsu',summonFullarms:'fullarms',summonGeist:'geist'}[key];
        const defenseOnly=key==='flagRepair'||Boolean(summonType);
        const already=Boolean(summonType&&this.defenseSupportSummoned?.[summonType]);
        button.classList.toggle('hidden', defenseOnly && !this.isDefenseMode);
        button.disabled = remaining > 0 || already || (defenseOnly && !this.isDefenseMode);
        if(already)button.textContent=`${EXTRA_UNIT_DEFS[summonType]?.label||summonType} 召喚済`;
        else if(summonType)button.textContent=`${EXTRA_UNIT_DEFS[summonType]?.label||summonType}を召喚`;
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
      if (this.mapId === 'underground') {
        if (this.isDefenseMode) return { x: 3200, y: 3300 };
        const undergroundHomes = [{ x: 620, y: 1450 }, { x: 5780, y: 1450 }, { x: 1800, y: 2520 }, { x: 4600, y: 2520 }];
        return undergroundHomes[team % undergroundHomes.length];
      }
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
      const summonMap={summonSogetsu:'sogetsu',summonFullarms:'fullarms',summonGeist:'geist'};
      if(summonMap[support]){
        const summoned=this.summonDefenseSupport(summonMap[support],this.playerTeam,false);
        message.textContent=summoned?`${summoned.name}を防衛線へ召喚しました。`:'この助っ人は召喚できません。';
        this.refreshOperatorUi();return;
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
        const amount = this.defenseFlag.maxHp * .24;
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
      if (order.type === 'retreat') {
        const hpRatio = p.hp / Math.max(1, p.maxHp);
        const enemyNear = this.players.some((other) => this.canDamage(p, other) && Math.hypot(other.x - p.x, other.y - p.y) < 430);
        const retreatExpired = this.elapsed >= Number(p.ai?.operatorRetreatUntil || 0);
        if ((hpRatio > .48 && !enemyNear) || (retreatExpired && hpRatio > .32 && !enemyNear)) {
          p.operatorOrder = null;
          return null;
        }
      }
      if (['move', 'defend', 'retreat', 'flank', 'activate', 'subwayControl', 'suppress'].includes(order.type)) {
        if (order.type === 'flank' && target) { order.x = lerp(order.x, target.x, .012); order.y = lerp(order.y, target.y, .012); }
        if (order.type === 'suppress' && target) {
          const safeRadius = p.archetype === '工作手' ? 510 : p.archetype === '狙撃手' ? 690 : 390;
          const dZone = Math.hypot(p.x - order.x, p.y - order.y);
          if (dZone < Math.max(120, (order.radius || 330) * .7)) {
            const away = Math.atan2(p.y - target.y, p.x - target.x);
            return { ...order, x:clamp(target.x + Math.cos(away) * safeRadius, 55, this.world.w - 55), y:clamp(target.y + Math.sin(away) * safeRadius, 55, this.world.h - 55) };
          }
        }
        if (Math.hypot(p.x - order.x, p.y - order.y) < 65 && order.type === 'move') p.operatorOrder = null;
        return order;
      }
      return null;
    }

    updateOperatorCamera(dt) {
      if (!this.isPlayerOperator) return;
      const followed = this.players.find((p) => p.id === this.operatorCamera.followId && !p.dead);
      if (followed && !this.input.virtualMove.active && !this.actionDown('moveUp') && !this.actionDown('moveDown') && !this.actionDown('moveLeft') && !this.actionDown('moveRight')) {
        this.operatorCamera.x = lerp(this.operatorCamera.x, followed.x, 1 - Math.pow(.02, dt));
        this.operatorCamera.y = lerp(this.operatorCamera.y, followed.y, 1 - Math.pow(.02, dt));
      } else {
        let dx = this.input.virtualMove.x;
        let dy = this.input.virtualMove.y;
        if (this.actionDown('moveUp')) dy -= 1;
        if (this.actionDown('moveDown')) dy += 1;
        if (this.actionDown('moveLeft')) dx -= 1;
        if (this.actionDown('moveRight')) dx += 1;
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
        } else if (order.type === 'subwayControl') {
          const control = this.lightSources.find((item) => item.id === order.controlId && item.hp > 0);
          if (!control) { p.operatorOrder = null; continue; }
          order.x = control.x; order.y = control.y;
          if (Math.hypot(p.x-control.x,p.y-control.y) < 105) {
            const subway=this.environment.subway||{};
            const already = control.kind==='platformSwitch' ? (order.desired==='close' ? subway.homeDoorsClosed : !subway.homeDoorsClosed)
              : control.kind==='waterGateSwitch' ? (order.desired==='drain' ? subway.waterDrained : !subway.waterDrained)
              : control.kind==='breakerSwitch' ? (order.desired==='off' ? subway.breakerOff : !subway.breakerOff) : true;
            if (!already) this.tryInteractSubwayControl(p);
            p.operatorOrder=null; p.operatorOrderProgress=0;
          }
        }
      }
      this.operatorAiTimer -= dt;
      if (this.operatorAiTimer > 0) return;
      this.operatorAiTimer = 1;
      for (let team = 0; team < this.teamCount; team++) {
        if (this.isPlayerOperator && team === this.playerTeam) continue;
        const operator = this.operators.find((op) => op.team === team);
        if (!operator) continue;
        operator.nextOrderAt = Number(operator.nextOrderAt || 0) - 1;
        if (operator.nextOrderAt > 0) continue;
        if(this.tryCpuDefenseSupport(operator)){operator.nextOrderAt=rand(5.5,8.5);continue;}
        const teamUnits = this.players.filter((p) => p.team === team && !p.dead && !p.isDefenseEnemy);
        if (!teamUnits.length) { operator.nextOrderAt = rand(8, 13); continue; }
        if (this.isDefenseMode && team===0 && this.defenseFlag) {
          const flagRatio=this.defenseFlag.hp/Math.max(1,this.defenseFlag.maxHp);
          if (flagRatio<.62 && (this.operatorSupportCooldowns.flagRepair||0)<=0) {
            const amount=this.defenseFlag.maxHp*(flagRatio<.3?.3:.24);
            this.defenseFlag.hp=Math.min(this.defenseFlag.maxHp,this.defenseFlag.hp+amount);
            this.defenseFlag.repaired+=amount;
            this.operatorSupportCooldowns.flagRepair=this.operatorSupportDurations.flagRepair;
            this.operatorStats.supportsUsed+=1;this.operatorStats.flagRepair+=1;
            this.effects.push({type:'flagHeal',x:this.defenseFlag.x,y:this.defenseFlag.y,ttl:.8,maxTtl:.8});
            this.logEvent('operator_support','CPUオペレーター：緊急フラッグ修復');
            operator.nextOrderAt=rand(4.5,7);continue;
          }
          const subwayOrder=this.getCpuSubwayStrategicOrder(teamUnits);
          if(subwayOrder){
            subwayOrder.unit.operatorOrder={type:'subwayControl',controlId:subwayOrder.control.id,x:subwayOrder.control.x,y:subwayOrder.control.y,desired:subwayOrder.desired,label:'地下設備戦術操作'};
            subwayOrder.unit.operatorOrderProgress=0;
            operator.orders+=1;this.operatorStats.ordersIssued+=1;
            this.logEvent('operator_ai_order',`地下設備：${subwayOrder.control.kind} ${subwayOrder.desired}`,false);
            operator.nextOrderAt=rand(5,8);continue;
          }
        }
        const criticalUnits = teamUnits.filter((p) => p.hp < p.maxHp * .25);
        for (const unit of criticalUnits) {
          const retreatPoint = this.isDefenseMode && this.defenseFlag ? {x:this.defenseFlag.x,y:this.defenseFlag.y} : this.getTeamHome(team);
          unit.operatorOrder = { type:'retreat', ...retreatPoint, label:'重傷者のみ後方退避' };
          unit.ai.operatorRetreatUntil = this.elapsed + rand(4.2, 6.8);
          unit.metrics.aiOperatorOrderChanges += 1;
        }
        const activeUnits = teamUnits.filter((unit) => !criticalUnits.includes(unit));
        const anchor = [...activeUnits].sort((a,b)=>(b.hp/b.maxHp)-(a.hp/a.maxHp))[0] || teamUnits[0];
        const target = this.findNearestEnemy(anchor);

        if (this.isDefenseMode && this.defenseFlag) {
          const state = this.getDefenseFlagThreatState();
          if (state?.underAttack) {
            const candidates = [...activeUnits].sort((a,b) => {
              const guardA = this.getAIGuardOption(a) ? -150 : 0;
              const guardB = this.getAIGuardOption(b) ? -150 : 0;
              return Math.hypot(a.x-this.defenseFlag.x,a.y-this.defenseFlag.y)+guardA - (Math.hypot(b.x-this.defenseFlag.x,b.y-this.defenseFlag.y)+guardB);
            });
            const defendersNeeded = clamp(1 + Math.ceil(state.pressure / 4.2) + (state.severe ? 1 : 0), 1, Math.min(4, candidates.length));
            const defenders = candidates.slice(0, defendersNeeded);
            defenders.forEach((unit,index) => {
              const angle = index * 2.3999632297;
              unit.operatorOrder = {type:'defend',x:this.defenseFlag.x+Math.cos(angle)*145,y:this.defenseFlag.y+Math.sin(angle)*145,label:'必要人数でフラッグ防衛'};
              unit.metrics.aiOperatorOrderChanges += 1;
            });
            const attackers = activeUnits.filter((unit) => !defenders.includes(unit));
            const threats = [...state.flagFocused, ...state.close, ...state.near].filter((enemy,index,array)=>array.findIndex((item)=>item.id===enemy.id)===index);
            attackers.forEach((unit,index) => {
              const enemy = threats[index % Math.max(1, threats.length)] || target;
              if (!enemy) return;
              unit.ai.target = enemy.id; unit.ai.targetType='player'; unit.ai.targetLockTimer=rand(1.8,3.2);
              if (unit.archetype === '工作手') {
                const home=this.getTeamHome(team), a=Math.atan2(home.y-enemy.y,home.x-enemy.x);
                unit.operatorOrder={type:'defend',x:clamp(enemy.x+Math.cos(a)*500,60,this.world.w-60),y:clamp(enemy.y+Math.sin(a)*500,60,this.world.h-60),label:'工作支援線を維持'};
              } else if (unit.archetype === '狙撃手') {
                const home=this.getTeamHome(team), a=Math.atan2(home.y-enemy.y,home.x-enemy.x);
                unit.operatorOrder={type:'hold',x:clamp(enemy.x+Math.cos(a)*860,60,this.world.w-60),y:clamp(enemy.y+Math.sin(a)*860,60,this.world.h-60),label:'⌖'};
              } else {
                unit.operatorOrder={type:'focus',targetId:enemy.id,label:'フラッグから敵を押し返す'};
              }
              unit.metrics.aiOperatorOrderChanges += 1;
            });
            operator.orders += 1; this.operatorStats.ordersIssued += 1;
            operator.nextOrderAt = rand(5.5,8.5); continue;
          }
        }

        if (this.config.mode === 'team' && target && activeUnits.length) {
          const enemies = this.players.filter((unit)=>unit.team!==team&&!unit.dead&&!unit.isDefenseEnemy);
          const home = this.getTeamHome(team);
          activeUnits.forEach((unit,index) => {
            const pool = [...enemies].sort((a,b)=>this.scoreAITargetCandidate(unit,a,'player')-this.scoreAITargetCandidate(unit,b,'player')).slice(0,Math.min(4,enemies.length));
            const enemy = pool[index % Math.max(1,pool.length)] || target;
            if (!enemy) return;
            unit.ai.target=enemy.id; unit.ai.targetType='player'; unit.ai.targetLockTimer=rand(2.2,4.2);
            const towardHome=Math.atan2(home.y-enemy.y,home.x-enemy.x);
            const side=(index%2?1:-1)*Math.PI/2;
            if (unit.archetype === '工作手') {
              unit.operatorOrder={type:'hold',x:clamp(enemy.x+Math.cos(towardHome)*520+Math.cos(towardHome+side)*110,60,this.world.w-60),y:clamp(enemy.y+Math.sin(towardHome)*520+Math.sin(towardHome+side)*110,60,this.world.h-60),label:'工作・後方支援'};
            } else if (unit.archetype === '狙撃手') {
              unit.operatorOrder={type:'hold',x:clamp(enemy.x+Math.cos(towardHome)*820+Math.cos(towardHome+side)*180,60,this.world.w-60),y:clamp(enemy.y+Math.sin(towardHome)*820+Math.sin(towardHome+side)*180,60,this.world.h-60),label:'⌖'};
              unit.ai.coordinationRole='independentSniper';
            } else if (['射手','銃手'].includes(unit.archetype)) {
              unit.operatorOrder={type:'focus',targetId:enemy.id,label:'射撃・制圧目標'};
              unit.ai.coordinationRole='suppression';
              unit.ai.suppressionWindow=Math.max(unit.ai.suppressionWindow||0,3.2);
              unit.ai.attackTimer=Math.min(unit.ai.attackTimer||0,.08);
            } else if (unit.archetype === '攻撃手') {
              unit.operatorOrder={type:'flank',targetId:enemy.id,x:clamp(enemy.x+Math.cos(towardHome+side)*230,60,this.world.w-60),y:clamp(enemy.y+Math.sin(towardHome+side)*230,60,this.world.h-60),label:'攻撃手・個別側面攻撃'};
            } else {
              unit.operatorOrder={type:'focus',targetId:enemy.id,label:'個別目標を攻撃'};
            }
            unit.metrics.aiOperatorOrderChanges += 1;
          });
          operator.orders += 1; this.operatorStats.ordersIssued += 1;
          operator.nextOrderAt=rand(7,11);
          this.logCombatDetail('operator_ai_order',null,{team,operator:operator.name,order:'individual_coordination',targetId:target.id,losing:false});
          continue;
        }

        let order = null;
        if (target && Math.random() < .1) {
          const facility = this.findNearestInstallation(anchor, true);
          const engineer = activeUnits.find((unit)=>unit.archetype==='工作手');
          if (facility && engineer && Math.hypot(engineer.x-facility.x,engineer.y-facility.y)<420) {
            engineer.operatorOrder={type:'activate',installationId:facility.id,x:facility.x,y:facility.y,label:'近傍設備起動'};
            engineer.metrics.aiOperatorOrderChanges += 1;
            operator.orders += 1; this.operatorStats.ordersIssued += 1; operator.nextOrderAt=rand(7,11); continue;
          }
        }
        if (!order && target) {
          const roll = Math.random();
          if (roll < .34) order = { type:'flank',targetId:target.id,x:target.x+rand(-300,300),y:target.y+rand(-300,300),label:'側面展開' };
          else if (roll < .52) order = { type:'defend',...this.getTeamHome(team),label:'短時間の再編' };
          else order = { type:'focus',targetId:target.id,label:'攻撃再開' };
        }
        if (!order) { operator.nextOrderAt = rand(8,14); continue; }
        const recipients = activeUnits.filter((unit)=>unit.archetype!=='工作手' || order.type!=='focus');
        for (const unit of recipients) { unit.operatorOrder={...order}; unit.metrics.aiOperatorOrderChanges += 1; }
        operator.orders += 1;
        const teamScore=this.teamScores[team]||0,bestScore=Math.max(...this.teamScores,1),losing=teamScore<bestScore*.72;
        operator.nextOrderAt=rand(losing?6:9,losing?10:14);
        this.logCombatDetail('operator_ai_order',null,{team,operator:operator.name,order:order.type,targetId:order.targetId||null,losing});
      }
    }

    availableWeatherTypes(){ return this.mapId === 'desert' ? ['clear','cloudy'] : this.mapId === 'underground' ? ['clear'] : WEATHER_TYPES; }
    updateEnvironment(dt){
      if (this.mapId === 'underground') {
        this.environment.timeOfDay = 'day';
        this.environment.timeProgression = false;
        this.environment.weather = 'clear';
        this.environment.weatherChange = false;
        this.environment.subway ||= { trainTimer: 12, trainActive: false, trainDirection: 1, trainX: -1200, homeDoorsClosed: true, breakerOff: false, waterDrained: false };
      }
      if(this.environment.timeProgression){
        this.environment.timeTimer+=dt;
        if(this.environment.timeTimer>=90){
          this.environment.timeTimer=0;
          this.environment.timeOfDay=TIME_PHASES[(TIME_PHASES.indexOf(this.environment.timeOfDay)+1)%TIME_PHASES.length];
          this.logEvent('time_change',TIME_LABELS[this.environment.timeOfDay]);
        }
      }
      if((this.mapId === 'desert' || this.mapId === 'underground') && this.environment.weather === 'rain') this.environment.weather = 'clear';
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
      if(!el) return;
      if(this.mapId === 'underground'){
        const subway=this.environment.subway||{};
        const states=[];
        const waterLevel=this.subwayWaterLevel();
        let waterState='';
        if(waterLevel<=.02) waterState='水路排水済み';
        else if(waterLevel>=.98) waterState='水路通水中';
        else if(subway.waterDrained) waterState=`水路排水中 ${Math.round((1-waterLevel)*100)}%`;
        else waterState=`水路注水中 ${Math.round(waterLevel*100)}%`;
        states.push(subway.breakerOff ? '停電中' : '通常照明');
        states.push(subway.homeDoorsClosed ? 'ホームドア閉' : 'ホームドア開');
        states.push(waterState);
        el.textContent=`${MAP_LABELS[this.mapId]}・人工照明・${states.join('・')}`;
        return;
      }
      el.textContent=`${MAP_LABELS[this.mapId]}・${TIME_LABELS[this.environment.timeOfDay]}・${WEATHER_LABELS[this.environment.weather]}`;
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
    shrineGardenState(p){
      if(this.mapId!=='snowShrine') return { active:false, multiplier:1, label:'' };
      const garden=this.terrain.shrineGardens.find(zone=>this.isPointInRect(p.x,p.y,zone));
      if(!garden) return { active:false, multiplier:1, label:'' };
      return { active:true, multiplier:garden.trionMultiplier||1.34, label:'雪庭・トリオン消費 +34%' };
    }
    updateShrineBlessings(p,dt){
      if(this.mapId!=='snowShrine'||p.dead||p.isDefenseEnemy) return;
      p.shrineStatueCooldowns ||= {};
      for(const key of Object.keys(p.shrineStatueCooldowns)) p.shrineStatueCooldowns[key]=Math.max(0,p.shrineStatueCooldowns[key]-dt);
      for(const statue of this.terrain.shrineStatues){
        const distance=Math.hypot(p.x-statue.x,p.y-statue.y);
        if(distance>statue.aura||p.trion>=p.maxTrion*.94||(p.shrineStatueCooldowns[statue.id]||0)>0) continue;
        const restored=Math.min(statue.restore||12,p.maxTrion-p.trion);
        if(restored<=.1) continue;
        p.trion+=restored;
        p.shrineStatueCooldowns[statue.id]=18;
        this.lifecycleStats.statueBlessings+=1;
        this.effects.push({type:'shrineBlessing',x:statue.x,y:statue.y,x2:p.x,y2:p.y,color:statue.color,ttl:.7,maxTtl:.7});
        this.logEvent('statue_blessing',`${statue.label} → ${p.name} +${Math.round(restored)} TRION`,false);
        if(p.human) this.toast(`${statue.label}からトリオンを分けてもらった`);
      }
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
      const floorZones = [
        ...(this.terrain.buildings || []), ...(this.terrain.shrineRooms || []), ...(this.terrain.shrineCorridors || []),
        ...(this.terrain.shrineCourts || []), ...(this.terrain.subwayPlatforms || []), ...(this.terrain.subwayPassengerZones || []),
        ...(this.terrain.subwayServiceZones || [])
      ];
      const onConstructedFloor = floorZones.some((r) => this.isPointInRect(p.x, p.y, r));
      if(onRoad) factor*=this.mapId==='desert'?1.03:1.08;
      if(!onConstructedFloor && this.terrain.forests.some(r=>this.isPointInRect(p.x,p.y,r))) factor*=.82;
      if(!onConstructedFloor && this.isInRiver(p.x,p.y)){ const river=this.terrain.rivers[0]; factor*=.48; p.vx+=river.flowX*dt; p.vy+=river.flowY*dt; }
      if(this.mapId==='desert' && !onConstructedFloor){
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
      if(this.mapId==='snowShrine' && !onConstructedFloor){
        if(this.terrain.snowDrifts.some(r=>this.isPointInRect(p.x,p.y,r))) factor*=.84;
        if(this.terrain.frozenPonds.some(r=>this.isPointInRect(p.x,p.y,r))){
          factor*=1.08;
          p.vx*=1.006; p.vy*=1.006;
        }
      }
      if(this.mapId==='underground' && !onConstructedFloor){
        const subway=this.environment.subway||{};
        const waterLevel=this.subwayWaterLevel();
        if(waterLevel>.02){
          for(const water of this.terrain.subwayWaterways||[]){
            if(!this.isPointInRect(p.x,p.y,water)) continue;
            factor*=lerp(1,.58,waterLevel);
            p.vx += (water.flowX||0) * dt * waterLevel;
            p.vy += (water.flowY||0) * dt * waterLevel;
          }
        }
        for(const sludge of this.terrain.subwaySludge||[]){
          if(sludge.active===false) continue;
          if(this.isInCircleZone(p.x,p.y,sludge)) factor*=0.76;
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

    logCombatDetail(type, player = null, detail = {}, store = true) {
      const event = {
        time: Number(this.elapsed.toFixed(3)),
        type,
        actorId: player?.id || detail.actorId || null,
        actorName: player?.name || detail.actorName || null,
        team: player?.team ?? detail.team ?? null,
        detail: JSON.parse(JSON.stringify(detail || {})),
        message: detail.message || `${player?.name || 'SYSTEM'} ${type}`,
      };
      if (store) {
        this.battleEvents.push(event);
        if (this.battleEvents.length > MAX_BATTLE_EVENTS) this.battleEvents.splice(1, 1);
      }
      return event;
    }

    recordRangeSample(attacker, info, distanceValue, multiplier) {
      if (!attacker?.metrics) return;
      const key = info.sourceKey || info.name || 'ranged';
      const stat = this.ensureTriggerStat(attacker, key, info.name || key);
      stat.rangeSamples = (stat.rangeSamples || 0) + 1;
      stat.rangeDistanceTotal = (stat.rangeDistanceTotal || 0) + distanceValue;
      stat.optimalRangeHits = (stat.optimalRangeHits || 0) + (multiplier >= 1 ? 1 : 0);
      stat.closePenaltyHits = (stat.closePenaltyHits || 0) + (distanceValue < info.rangeProfile.min ? 1 : 0);
      stat.farPenaltyHits = (stat.farPenaltyHits || 0) + (distanceValue > info.rangeProfile.max ? 1 : 0);
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
        rangeSamples: 0, rangeDistanceTotal: 0, optimalRangeHits: 0, closePenaltyHits: 0, farPenaltyHits: 0,
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
        if (activationId) {
          this.ensureMasteryRuntime(player);
          const alreadyHit = (player._activationHits.get(activationId)?.size || 0) > 0;
          player._masteryPendingAttacks.set(activationId, { triggerId, hit:alreadyHit, expires:this.elapsed + (String(triggerId).startsWith('composite:') ? 4.2 : 2.8) });
        }
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
      this.adjustMastery(owner, .095, '有効効果');
      if (MASTERY_TRAP_SOURCES.has(String(sourceKey || ''))) this.recordMasteryUtilitySuccess(owner, sourceKey, target, .36, 'トラップ成功');
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
      this.ensureMasteryRuntime(attacker);
      const masteryAttempt = attacker._masteryPendingAttacks.get(activationId);
      if (masteryAttempt) masteryAttempt.hit = true;
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
          const total = triggers[key] ||= { name: stat.name || key, uses: 0, projectiles: 0, projectileHits: 0, hitActivations: 0, uniqueTargetsHit: 0, damage: 0, kills: 0, trionSpent: 0, effectApplications: 0, effectDurationSeconds: 0, placements: 0, automaticActivations: 0, damageTriggers: 0, rangeSamples: 0, rangeDistanceTotal: 0, optimalRangeHits: 0, closePenaltyHits: 0, farPenaltyHits: 0 };
          for (const field of ['uses', 'projectiles', 'projectileHits', 'hitActivations', 'uniqueTargetsHit', 'damage', 'kills', 'trionSpent', 'effectApplications', 'effectDurationSeconds', 'placements', 'automaticActivations', 'damageTriggers', 'rangeSamples', 'rangeDistanceTotal', 'optimalRangeHits', 'closePenaltyHits', 'farPenaltyHits']) total[field] += Number(stat[field] || 0);
        }
      }
      return Object.fromEntries(Object.entries(triggers).map(([key, value]) => [key, {
        ...value,
        damage: Number(value.damage.toFixed(2)),
        damagePerUse: value.uses ? Number((value.damage / value.uses).toFixed(3)) : 0,
        damagePerTrion: value.trionSpent ? Number((value.damage / value.trionSpent).toFixed(3)) : 0,
        activationHitRate: value.uses ? Number((value.hitActivations / value.uses).toFixed(4)) : 0,
        projectileHitRate: value.projectiles ? Number((value.projectileHits / value.projectiles).toFixed(4)) : 0,
        averageHitDistance: value.rangeSamples ? Number((value.rangeDistanceTotal / value.rangeSamples).toFixed(2)) : 0,
        optimalRangeRate: value.rangeSamples ? Number((value.optimalRangeHits / value.rangeSamples).toFixed(4)) : 0,
      }]));
    }

    getClockLabel() {
      return this.isUnlimited ? `∞ ${formatTime(this.elapsed)}` : formatTime(this.matchTime);
    }

    buildDetailedFeedbackSummary() {
      const players = this.players.filter((p) => !p.isDefenseEnemy);
      const byRole = {};
      for (const p of players) {
        const role = byRole[p.archetype] ||= { players:0, score:0, kills:0, deaths:0, damage:0, defense:0, rangeSamples:0, optimalHits:0, targetChanges:0, stuckEscapes:0, oscillationBreaks:0 };
        role.players += 1; role.score += p.score; role.kills += p.kills; role.deaths += p.deaths;
        role.damage += p.metrics.damageDealt || 0; role.defense += p.metrics.blockedDamage || 0;
        role.rangeSamples += (p.metrics.optimalRangeHits || 0) + (p.metrics.rangePenaltyHits || 0);
        role.optimalHits += p.metrics.optimalRangeHits || 0;
        role.targetChanges += p.metrics.aiTargetChanges || 0;
        role.stuckEscapes += p.metrics.aiStuckEscapes || 0;
        role.oscillationBreaks += p.metrics.aiOscillationBreaks || 0;
      }
      for (const role of Object.values(byRole)) {
        role.averageScore = Number((role.score / Math.max(1, role.players)).toFixed(2));
        role.averageKills = Number((role.kills / Math.max(1, role.players)).toFixed(3));
        role.optimalRangeRate = role.rangeSamples ? Number((role.optimalHits / role.rangeSamples).toFixed(4)) : null;
      }
      return {
        byRole,
        ai: {
          targetChanges: players.reduce((s,p)=>s+(p.metrics.aiTargetChanges||0),0),
          targetRetained: players.reduce((s,p)=>s+(p.metrics.aiTargetRetained||0),0),
          targetChangeReasons: players.reduce((out,p)=>{ for(const [k,v] of Object.entries(p.metrics.aiTargetChangeReasons||{})) out[k]=(out[k]||0)+v; return out; },{}),
          wallAvoidances: players.reduce((s,p)=>s+(p.metrics.aiWallAvoidances||0),0),
          stuckEscapes: players.reduce((s,p)=>s+(p.metrics.aiStuckEscapes||0),0),
          oscillationBreaks: players.reduce((s,p)=>s+(p.metrics.aiOscillationBreaks||0),0),
          rangeSeconds: {
            advance:Number(players.reduce((s,p)=>s+(p.metrics.aiRangeAdvanceSeconds||0),0).toFixed(2)),
            retreat:Number(players.reduce((s,p)=>s+(p.metrics.aiRangeRetreatSeconds||0),0).toFixed(2)),
            hold:Number(players.reduce((s,p)=>s+(p.metrics.aiRangeHoldSeconds||0),0).toFixed(2)),
            strafe:Number(players.reduce((s,p)=>s+(p.metrics.aiRangeStrafeSeconds||0),0).toFixed(2)),
            optimal:Number(players.reduce((s,p)=>s+(p.metrics.aiOptimalRangeSeconds||0),0).toFixed(2)),
            outside:Number(players.reduce((s,p)=>s+(p.metrics.aiOutOfRangeSeconds||0),0).toFixed(2)),
          },
        },
        weaponSystems: {
          shooterChargesStarted: players.reduce((s,p)=>s+(p.metrics.shooterChargesStarted||0),0),
          shooterChargesCompleted: players.reduce((s,p)=>s+(p.metrics.shooterChargesCompleted||0),0),
          shooterChargeCancelled: players.reduce((s,p)=>s+(p.metrics.shooterChargeCancelled||0),0),
          shooterSameHandLocks: players.reduce((s,p)=>s+(p.metrics.shooterSameHandLocks||0),0),
          gunShots: players.reduce((s,p)=>s+(p.metrics.gunShots||0),0),
          gunReloads: players.reduce((s,p)=>s+(p.metrics.gunReloads||0),0),
          gunEmptyAttempts: players.reduce((s,p)=>s+(p.metrics.gunEmptyAttempts||0),0),
          reloadSeconds: Number(players.reduce((s,p)=>s+(p.metrics.reloadSeconds||0),0).toFixed(2)),
          meleeChainHits: players.reduce((s,p)=>s+(p.metrics.meleeChainHits||0),0),
          meleeChainsCompleted: players.reduce((s,p)=>s+(p.metrics.meleeChainsCompleted||0),0),
          raygustShieldSeconds:Number(players.reduce((s,p)=>s+(p.metrics.raygustShieldSeconds||0),0).toFixed(2)),
        },
      };
    }

    buildEventSummary() {
      const byType = {};
      for (const event of this.battleEvents) byType[event.type] = (byType[event.type] || 0) + 1;
      return { total: this.battleEvents.length, limit: MAX_BATTLE_EVENTS, byType };
    }

    buildLog(reason = 'snapshot') {
      return {
        schemaVersion: 20,
        matchId: this.matchId,
        startedAt: this.startedAt,
        endedAt: new Date().toISOString(),
        reason,
        completed: this.ended,
        durationSeconds: Number(this.elapsed.toFixed(2)),
        configuredDurationSeconds: this.isUnlimited ? null : this.config.matchLength,
        unlimited: this.isUnlimited,
        mode: this.config.mode,
        modeLabel: this.isExtraMode ? `エキストラ・${MODE_LABELS[this.config.mode] || '個人戦'}` : (MODE_LABELS[this.config.mode] || '個人戦'),
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
        teamComposition: this.teamCount ? Array.from({length:this.teamCount},(_,team)=>({ team, roles:this.players.filter(p=>!p.isDefenseEnemy&&p.team===team).map(p=>p.archetype) })) : null,
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
        detailedFeedback: this.buildDetailedFeedbackSummary(),
        eventSummary: this.buildEventSummary(),
        players: this.players.map((player) => ({
          id: player.id,
          name: player.name,
          human: player.human,
          team: player.team,
          archetype: player.archetype,
          squadName: player.squadName,
          aiTier: player.aiTier,
          aiPersonality: player.aiPersonality ? { calmness:Number(player.aiPersonality.calmness.toFixed(3)), aggression:Number(player.aiPersonality.aggression.toFixed(3)) } : null,
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
      const headers = ['matchId', 'difficulty', 'mode', 'unlimited', 'player', 'human', 'team', 'archetype', 'trion', 'technique', 'combat', 'score', 'kills', 'assists', 'supportScore', 'deaths', 'combatDeaths', 'manualBailouts', 'spectateTransitions', 'damageDealt', 'damageTaken', 'blockedDamage', 'triggerActivations', 'attackActivations', 'activationsWithHit', 'activationHitRate', 'projectilesSpawned', 'projectilesHit', 'projectileHitRate', 'projectileHitEvents', 'meleeHits', 'trionSpent', 'pickups', 'pickupTrionGained', 'aliveTime', 'longestLife', 'spiderSlowSeconds', 'dummyBeaconTargetSeconds', 'switchboxTriggers', 'leadBulletSlowSeconds', 'starmakerRevealSeconds', 'effectApplications', 'successfulEffectActivations', 'aiVoluntaryBailouts', 'desertReliefVisits', 'desertReliefDepartures', 'triggerUses', 'triggerDamage', 'triggerStats', 'aiTriggerSelections', 'aiTargetChanges', 'aiTargetChangeReasons', 'aiOptimalRangeSeconds', 'aiOutOfRangeSeconds', 'aiRangeAdvanceSeconds', 'aiRangeRetreatSeconds', 'aiRangeHoldSeconds', 'aiRangeStrafeSeconds', 'shooterChargesStarted', 'shooterChargesCompleted', 'shooterChargeCancelled', 'shooterSameHandLocks', 'gunShots', 'gunReloads', 'gunEmptyAttempts', 'reloadSeconds', 'meleeChainHits', 'meleeChainsCompleted', 'raygustShieldSeconds'];
      const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const rows = log.players.map((player) => {
        const m = player.metrics || {};
        const values = [log.matchId, log.difficulty, log.mode, log.unlimited, player.name, player.human, player.team, player.archetype, player.stats.trion, player.stats.technique, player.stats.combat, player.score, player.kills, m.assists, m.supportScore, player.deaths, m.combatDeaths, m.manualBailouts, m.spectateTransitions, m.damageDealt, m.damageTaken, m.blockedDamage, m.triggerActivations, m.attackActivations, m.activationsWithHit, m.activationHitRate, m.projectilesSpawned, m.projectilesHit, m.projectileHitRate, m.projectileHits, m.meleeHits, m.trionSpent, m.pickups, m.pickupTrionGained, m.aliveTime, m.longestLife, m.spiderSlowSeconds, m.dummyBeaconTargetSeconds, m.switchboxTriggers, m.leadBulletSlowSeconds, m.starmakerRevealSeconds, m.effectApplications, m.successfulEffectActivations, m.aiVoluntaryBailouts, m.desertReliefVisits, m.desertReliefDepartures, JSON.stringify(m.triggerUses || {}), JSON.stringify(m.triggerDamage || {}), JSON.stringify(m.triggerStats || {}), JSON.stringify(m.aiTriggerSelections || {}), m.aiTargetChanges, JSON.stringify(m.aiTargetChangeReasons || {}), m.aiOptimalRangeSeconds, m.aiOutOfRangeSeconds, m.aiRangeAdvanceSeconds, m.aiRangeRetreatSeconds, m.aiRangeHoldSeconds, m.aiRangeStrafeSeconds, m.shooterChargesStarted, m.shooterChargesCompleted, m.shooterChargeCancelled, m.shooterSameHandLocks, m.gunShots, m.gunReloads, m.gunEmptyAttempts, m.reloadSeconds, m.meleeChainHits, m.meleeChainsCompleted, m.raygustShieldSeconds];
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
      else if (this.mapId === 'snowShrine') this.generateSnowShrineArena();
      else if (this.mapId === 'underground') this.generateUndergroundArena();
      else this.generateCityArena();
    }

    generateSnowShrineArena() {
      const addWall = (id, x, y, w, h, type = 'templeWall', hp = 520, options = {}) => {
        const wall = { id, x, y, w, h, type, hp, maxHp: hp, ttl: Infinity, ...options };
        this.walls.push(wall);
        return wall;
      };
      const addRoom = (id, x, y, w, h, label, motif = 'asanoha') => {
        const room = { id, x, y, w, h, label, motif };
        this.terrain.shrineRooms.push(room);
        this.terrain.buildings.push({ ...room, shrineBuilding: true });
        return room;
      };
      const addCorridor = (id, x, y, w, h, motif = 'asanoha') => {
        const corridor = { id, x, y, w, h, motif };
        this.terrain.shrineCorridors.push(corridor);
        this.terrain.roads.push({ ...corridor, shrineCorridor: true });
        return corridor;
      };
      const addWallRun = (id, x, y, length, vertical = false, gaps = [], type = 'templeWall', hp = 570, options = {}) => {
        const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
        let cursor = 0;
        let part = 0;
        for (const [rawStart, rawEnd] of sorted) {
          const start = clamp(rawStart, 0, length);
          const end = clamp(rawEnd, start, length);
          if (start > cursor + 1) {
            addWall(`${id}-${part++}`, vertical ? x : x + cursor, vertical ? y + cursor : y, vertical ? 32 : start - cursor, vertical ? start - cursor : 32, type, hp, options);
          }
          cursor = Math.max(cursor, end);
        }
        if (cursor < length - 1) {
          addWall(`${id}-${part++}`, vertical ? x : x + cursor, vertical ? y + cursor : y, vertical ? 32 : length - cursor, vertical ? length - cursor : 32, type, hp, options);
        }
      };
      const addRoomShell = (room, doors = {}) => {
        const common = { respawnable: true, respawnDelay: [72, 105], shrineStructure: true };
        addWallRun(`${room.id}-top`, room.x, room.y, room.w, false, doors.top || [], 'templeWall', 570, common);
        addWallRun(`${room.id}-bottom`, room.x, room.y + room.h - 32, room.w, false, doors.bottom || [], 'templeWall', 570, common);
        addWallRun(`${room.id}-left`, room.x, room.y, room.h, true, doors.left || [], 'templeWall', 570, common);
        addWallRun(`${room.id}-right`, room.x + room.w - 32, room.y, room.h, true, doors.right || [], 'templeWall', 570, common);
      };
      const addShojiPartition = (id, x, y, length, vertical = false, doorCenter = null, doorWidth = 180) => {
        const thickness = 16;
        const panelMax = 150;
        const panelGap = 8;
        const doorStart = doorCenter == null ? Infinity : clamp(doorCenter - doorWidth / 2, 0, length);
        const doorEnd = doorCenter == null ? Infinity : clamp(doorCenter + doorWidth / 2, 0, length);
        let cursor = 0;
        let index = 0;
        while (cursor < length - 1) {
          if (cursor >= doorStart && cursor < doorEnd) {
            cursor = doorEnd;
            continue;
          }
          const availableEnd = Math.min(length, cursor < doorStart ? doorStart : length);
          const panelLength = Math.min(panelMax, availableEnd - cursor);
          if (panelLength > 24) {
            addWall(`${id}-${index++}`, vertical ? x : x + cursor, vertical ? y + cursor : y, vertical ? thickness : panelLength, vertical ? panelLength : thickness, 'shoji', 105, { respawnable: true, respawnDelay: [20, 32], shrinePanel: true });
          }
          cursor += Math.max(panelLength, 0) + panelGap;
        }
      };
      const addGardenBorder = (id, x, y, length, vertical, gaps) => {
        addWallRun(id, x, y, length, vertical, gaps, 'shrineStone', 250, { respawnable: true, respawnDelay: [48, 72], lowCover: true });
      };

      // 敷地の中心を雪庭に置き、南の参道から一方向に読める寝殿造の配置へ整理。
      this.terrain.shrineGardens.push({ id: 'snow-garden-main', x: 1950, y: 1180, w: 2500, h: 2020, label: '雪庭', trionMultiplier: 1.34 });
      this.terrain.shrineCourts.push(
        { id: 'south-court', x: 2460, y: 3990, w: 1480, h: 360, label: '前庭' },
        { id: 'west-court', x: 1660, y: 1840, w: 290, h: 700, label: '西中庭' },
        { id: 'east-court', x: 4450, y: 1840, w: 290, h: 700, label: '東中庭' }
      );
      this.terrain.shrineApproaches.push({ id: 'omotesando', x: 2880, y: 3970, w: 640, h: 430, label: '表参道' });
      this.terrain.frozenPonds.push({ id: 'frozen-pond', x: 3570, y: 1460, w: 610, h: 430 });
      this.terrain.snowDrifts.push(
        { id: 'drift-0', x: 2090, y: 1370, w: 380, h: 150 },
        { id: 'drift-1', x: 3960, y: 2760, w: 330, h: 160 },
        { id: 'drift-2', x: 2300, y: 2790, w: 430, h: 150 },
        { id: 'drift-3', x: 4100, y: 1260, w: 260, h: 130 }
      );

      const northHall = addRoom('north-main-hall', 1900, 250, 2600, 660, '正殿', 'shippo');
      const westHall = addRoom('west-hall', 380, 1100, 1240, 2200, '西殿', 'asanoha');
      const eastHall = addRoom('east-hall', 4780, 1100, 1240, 2200, '東殿', 'seigaiha');
      const southHall = addRoom('south-hall', 2180, 3500, 2040, 500, '拝殿', 'kikkou');

      addCorridor('north-corridor', 1690, 940, 3020, 180, 'asanoha');
      addCorridor('west-corridor', 1690, 940, 220, 2440, 'seigaiha');
      addCorridor('east-corridor', 4490, 940, 220, 2440, 'seigaiha');
      addCorridor('south-corridor', 1690, 3260, 3020, 190, 'asanoha');
      addCorridor('west-upper-link', 1590, 1490, 130, 300, 'kikkou');
      addCorridor('west-lower-link', 1590, 2610, 130, 300, 'kikkou');
      addCorridor('east-upper-link', 4680, 1490, 130, 300, 'kikkou');
      addCorridor('east-lower-link', 4680, 2610, 130, 300, 'kikkou');

      // 各殿の出入口は壁を切り欠き、庭と回廊の間には必ず階段を置く。
      addRoomShell(northHall, { bottom: [[980, 1620]] });
      addRoomShell(westHall, { right: [[390, 690], [1510, 1810]] });
      addRoomShell(eastHall, { left: [[390, 690], [1510, 1810]] });
      addRoomShell(southHall, { top: [[700, 1340]], bottom: [[700, 1340]] });

      this.terrain.shrineSteps.push(
        { id: 'step-garden-north', x: 2910, y: 1090, w: 580, h: 120, direction: 'north', label: '正殿石段' },
        { id: 'step-garden-south', x: 2910, y: 3160, w: 580, h: 130, direction: 'south', label: '拝殿石段' },
        { id: 'step-garden-west', x: 1880, y: 2010, w: 100, h: 360, direction: 'west', label: '西渡り段' },
        { id: 'step-garden-east', x: 4420, y: 2010, w: 100, h: 360, direction: 'east', label: '東渡り段' },
        { id: 'step-south-hall', x: 2920, y: 3425, w: 560, h: 105, direction: 'north', label: '拝殿上段' },
        { id: 'step-south-entry', x: 2920, y: 3960, w: 560, h: 95, direction: 'south', label: '拝殿入口' }
      );

      // 雪庭の石縁は四方向の階段部分を広く空ける。
      addGardenBorder('garden-border-top', 1950, 1160, 2500, false, [[900, 1600]]);
      addGardenBorder('garden-border-bottom', 1950, 3200, 2500, false, [[900, 1600]]);
      addGardenBorder('garden-border-left', 1930, 1180, 2020, true, [[790, 1230]]);
      addGardenBorder('garden-border-right', 4450, 1180, 2020, true, [[790, 1230]]);

      // 障子は部屋の中を分けるが、必ず通行用の開口を残す。
      addShojiPartition('shoji-north-left', 2460, 390, 400, true, 210, 150);
      addShojiPartition('shoji-north-right', 3940, 390, 400, true, 210, 150);
      addShojiPartition('shoji-west-upper', 620, 1810, 760, false, 380, 190);
      addShojiPartition('shoji-west-lower', 620, 2570, 760, false, 380, 190);
      addShojiPartition('shoji-east-upper', 5020, 1810, 760, false, 380, 190);
      addShojiPartition('shoji-east-lower', 5020, 2570, 760, false, 380, 190);
      addShojiPartition('shoji-south-left', 2580, 3600, 300, true, 150, 150);
      addShojiPartition('shoji-south-right', 3820, 3600, 300, true, 150, 150);

      // 鳥居は表参道の正面一基に限定し、進行方向と直交させる。
      this.terrain.torii.push({ id: 'torii-south-main', x: 3200, y: 4230, w: 460, h: 150, facing: 'north' });

      // 景観物。戦闘導線を塞がない位置へ集約。
      this.terrain.shrineDecor.push(
        { kind: 'pine', x: 730, y: 620, r: 74 }, { kind: 'pine', x: 1250, y: 620, r: 66 },
        { kind: 'pine', x: 5150, y: 620, r: 70 }, { kind: 'pine', x: 5700, y: 650, r: 76 },
        { kind: 'pine', x: 840, y: 3650, r: 78 }, { kind: 'pine', x: 5580, y: 3660, r: 76 },
        { kind: 'sacredTree', x: 2250, y: 2360, r: 92 },
        { kind: 'rockGarden', x: 2440, y: 1510, w: 690, h: 500 },
        { kind: 'waterBasin', x: 2710, y: 4070, w: 90, h: 70 },
        { kind: 'bell', x: 3710, y: 4060, w: 90, h: 90 },
        { kind: 'stonePath', x1: 3200, y1: 4070, x2: 3200, y2: 3290, count: 8 },
        { kind: 'stonePath', x1: 3200, y1: 3160, x2: 3200, y2: 1220, count: 10 },
        { kind: 'altar', x: 3200, y: 455, w: 220, h: 82 },
        { kind: 'foldingScreen', x: 2390, y: 540, w: 210, h: 72 }, { kind: 'foldingScreen', x: 4010, y: 540, w: 210, h: 72 },
        { kind: 'offeringTable', x: 3200, y: 690, w: 128, h: 50 },
        { kind: 'floorCushion', x: 2920, y: 705, size: 40, color: '#81313b' }, { kind: 'floorCushion', x: 3480, y: 705, size: 40, color: '#81313b' },
        { kind: 'altar', x: 1040, y: 1330, w: 156, h: 66 }, { kind: 'altar', x: 5360, y: 1330, w: 156, h: 66 },
        { kind: 'foldingScreen', x: 710, y: 2850, w: 174, h: 64 }, { kind: 'foldingScreen', x: 5690, y: 2850, w: 174, h: 64 },
        { kind: 'offeringTable', x: 1040, y: 2325, w: 112, h: 46 }, { kind: 'offeringTable', x: 5360, y: 2325, w: 112, h: 46 },
        { kind: 'floorCushion', x: 820, y: 2420, size: 38, color: '#6f2b36' }, { kind: 'floorCushion', x: 1260, y: 2420, size: 38, color: '#6f2b36' },
        { kind: 'floorCushion', x: 5140, y: 2420, size: 38, color: '#394e70' }, { kind: 'floorCushion', x: 5580, y: 2420, size: 38, color: '#394e70' },
        { kind: 'drum', x: 2470, y: 3745, r: 34 }, { kind: 'drum', x: 3930, y: 3745, r: 34 },
        { kind: 'emaRack', x: 2360, y: 3850, w: 150, h: 82 }, { kind: 'emaRack', x: 4040, y: 3850, w: 150, h: 82 },
        { kind: 'incense', x: 3200, y: 3810 }
      );

      const facilityPoints = [
        ['barricade',760,1420],['trap',850,2220],['turret',1250,3000],
        ['turret',5150,1420],['trap',5550,2220],['barricade',5200,3000],
        ['barricade',2360,690],['trap',3200,650],['turret',4040,690],
        ['trap',2480,3750],['turret',3200,3740],['barricade',3920,3750]
      ];
      facilityPoints.forEach(([type,x,y],i)=>this.installations.push({id:`shrine-facility-${i}`,type,x,y,radius:24,hp:type==='barricade'?280:205,maxHp:type==='barricade'?280:205,active:false,team:null,work:0,cooldown:0,activeTimer:0,respawnTimer:0,destroyedLogged:false,shrine:true}));

      const barrelPoints = [[560,1290],[710,1290],[1320,3080],[4920,1290],[5070,1290],[5680,3080],[2380,3860],[4020,3860]];
      barrelPoints.forEach(([x,y],i)=>this.lightSources.push({id:`sake-barrel-${i}`,kind:'sakeBarrel',x,y,radius:20,hp:68,maxHp:68,lightRadius:0,respawnTimer:0,destroyedLogged:false,ignited:false}));

      const lanternPoints = [[1860,1070],[4540,1070],[1860,3310],[4540,3310],[2050,1320],[4350,1320],[2050,3060],[4350,3060],[2830,4110],[3570,4110]];
      lanternPoints.forEach(([x,y],i)=>this.lightSources.push({id:`shrine-lantern-${i}`,kind:'shrineLantern',fire:i>=8,x,y,radius:13,hp:82,maxHp:82,lightRadius:i>=8?265:220,respawnTimer:0,destroyedLogged:false}));

      const spiritSpecs = [
        [760,1500,500,1240,1450,3150],[1320,2380,520,1240,1460,3150],
        [5080,1500,4940,1240,5900,3150],[5660,2460,4940,1240,5900,3150],
        [2380,1030,1820,970,4580,1095],[4020,3350,1820,3290,4580,3410],
        [2500,2520,2030,1250,4320,3120],[3970,1770,2030,1250,4320,3120]
      ];
      spiritSpecs.forEach(([x,y,minX,minY,maxX,maxY],i)=>this.beacons.push({id:`hitodama-${i}`,shrineSpirit:true,kind:'hitodama',x,y,spawnX:x,spawnY:y,minX,minY,maxX,maxY,radius:11,hp:42,maxHp:42,ttl:Infinity,respawnTimer:0,active:true,team:null,vx:rand(-24,24),vy:rand(-24,24),exposedTeams:{}}));

      this.terrain.shrineStatues.push(
        { id:'statue-nekomata', kind:'nekomata', label:'西殿の猫又', x:1040, y:2200, radius:66, aura:155, restore:12, color:'#d5a865' },
        { id:'statue-kitsune', kind:'whiteFox', label:'東殿の白狐', x:5360, y:2200, radius:66, aura:155, restore:12, color:'#edf7ff' }
      );

      for (let i = 0; i < BASE_PICKUP_COUNT; i++) this.pickups.push(this.makePickup());
      this.pickupStats.baseSpawned = BASE_PICKUP_COUNT;
      this.pickupStats.peakTotal = this.pickups.length;
    }


    generateUndergroundArena() {
      const addWall = (id, x, y, w, h, type = 'buildingWall', hp = 520, options = {}) => {
        if (w <= 0 || h <= 0) return null;
        const wall = { id, x, y, w, h, type, hp, maxHp: hp, ttl: Infinity, ...options };
        this.walls.push(wall);
        return wall;
      };
      const addProp = (kind, x, y, w, h, extra = {}) => this.terrain.subwayProps.push({ kind, x, y, w, h, ...extra });
      const wallOptions = { respawnable: true, respawnDelay: [70, 96] };
      const addRoom = (id, x, y, w, h, roomType, doors = []) => {
        this.terrain.buildings.push({ id, x, y, w, h, subwayRoom: true, subwayRoomType: roomType });
        const t = 28;
        const openings = { north: [], south: [], west: [], east: [] };
        for (const door of doors) openings[door.side]?.push(door);
        const horizontal = (side, yy) => {
          const list = openings[side].map((d) => ({ start: x + d.offset - d.size / 2, end: x + d.offset + d.size / 2 })).sort((a, b) => a.start - b.start);
          let cursor = x;
          let n = 0;
          for (const opening of list) {
            const start = clamp(opening.start, x + 20, x + w - 20);
            const end = clamp(opening.end, x + 20, x + w - 20);
            addWall(`${id}-${side}-${n++}`, cursor, yy, Math.max(0, start - cursor), t, 'maintenanceWall', 470, wallOptions);
            cursor = Math.max(cursor, end);
          }
          addWall(`${id}-${side}-${n}`, cursor, yy, Math.max(0, x + w - cursor), t, 'maintenanceWall', 470, wallOptions);
        };
        const vertical = (side, xx) => {
          const list = openings[side].map((d) => ({ start: y + d.offset - d.size / 2, end: y + d.offset + d.size / 2 })).sort((a, b) => a.start - b.start);
          let cursor = y;
          let n = 0;
          for (const opening of list) {
            const start = clamp(opening.start, y + 20, y + h - 20);
            const end = clamp(opening.end, y + 20, y + h - 20);
            addWall(`${id}-${side}-${n++}`, xx, cursor, t, Math.max(0, start - cursor), 'maintenanceWall', 470, wallOptions);
            cursor = Math.max(cursor, end);
          }
          addWall(`${id}-${side}-${n}`, xx, cursor, t, Math.max(0, y + h - cursor), 'maintenanceWall', 470, wallOptions);
        };
        horizontal('north', y);
        horizontal('south', y + h - t);
        vertical('west', x);
        vertical('east', x + w - t);
      };

      const subway = this.environment.subway ||= {};
      Object.assign(subway, {
        trainTimer: 12,
        trainActive: false,
        trainDirection: 1,
        trainX: -1200,
        trainPrevX: -1200,
        homeDoorsClosed: true,
        breakerOff: false,
        waterDrained: false,
        waterLevel: 1,
        waterTarget: 1,
        waterTransitionSeconds: 7,
        doorControlCooldown: 0,
        doorControlCooldownMax: 4.5,
      });

      this.subwayBounds = { x: 32, y: 32, w: this.world.w - 64, h: this.world.h - 64 };
      const concourse = { id: 'concourse', x: 56, y: 56, w: 6288, h: 820 };
      const platform = { id: 'main-platform', x: 56, y: 876, w: 6288, h: 930 };
      const track = { id: 'main-track', x: 52, y: 1806, w: 6296, h: 492, safeMargin: 96 };
      const service = { id: 'service-deck', x: 56, y: 2298, w: 6288, h: 1846 };
      this.terrain.subwayPassengerZones.push(concourse, platform);
      this.terrain.subwayServiceZones.push(service);
      this.terrain.subwayTracks.push(track);
      this.terrain.subwayPlatforms.push(platform);
      this.terrain.plazas.push({ ...concourse, passenger: true }, { ...platform, passenger: true });

      addWall('station-north', 0, 0, this.world.w, 52, 'maintenanceWall', 9999, { indestructible: true });
      addWall('station-south', 0, this.world.h - 52, this.world.w, 52, 'maintenanceWall', 9999, { indestructible: true });
      addWall('station-west', 0, 52, 52, this.world.h - 104, 'maintenanceWall', 9999, { indestructible: true });
      addWall('station-east', this.world.w - 52, 52, 52, this.world.h - 104, 'maintenanceWall', 9999, { indestructible: true });

      // Home doors on both sides of the track. Both rows share the same open/closed state.
      let doorIndex = 0;
      const doorPanelWidth = 160;
      for (let x = track.x; x < track.x + track.w; x += doorPanelWidth) {
        const width = Math.min(doorPanelWidth, track.x + track.w - x);
        addWall(`platform-door-passenger-${doorIndex}`, x, track.y - 48, width, 22, 'platformDoor', 240, { subwayDoor: true, subwayDoorSide: 'passenger', indestructible: true });
        addWall(`platform-door-service-${doorIndex}`, x, track.y + track.h + 26, width, 22, 'platformDoor', 240, { subwayDoor: true, subwayDoorSide: 'service', indestructible: true });
        doorIndex += 1;
      }

      // Automatic ticket gates: the concourse and platform are separated except for the gate lanes.
      const gateCenters = [1240, 1440, 1640, 1840, 2040, 4360, 4560, 4760, 4960, 5160];
      const gateBarrierY = 806;
      const gateBarrierH = 46;
      let gateCursor = 56;
      gateCenters.forEach((center, i) => {
        const start = center - 56;
        const end = center + 56;
        addWall(`gate-barrier-${i}`, gateCursor, gateBarrierY, Math.max(0, start - gateCursor), gateBarrierH, 'maintenanceWall', 9999, { indestructible: true });
        addWall(`gate-post-left-${i}`, center - 46, gateBarrierY, 18, gateBarrierH + 18, 'ticketGate', 9999, { indestructible: true, lowCover: false });
        addWall(`gate-post-right-${i}`, center + 28, gateBarrierY, 18, gateBarrierH + 18, 'ticketGate', 9999, { indestructible: true, lowCover: false });
        gateCursor = end;
      });
      addWall('gate-barrier-final', gateCursor, gateBarrierY, Math.max(0, 6344 - gateCursor), gateBarrierH, 'maintenanceWall', 9999, { indestructible: true });
      addProp('ticketBooth', 3200, 670, 360, 132);
      gateCenters.forEach((x, i) => addProp('poster', x, 760, 44, 86, { variant: i & 1 ? 'blue' : 'red' }));

      // Concourse tenants and waiting area.
      addRoom('tenant-west-1', 120, 100, 760, 320, 'tenant', [{ side: 'south', offset: 380, size: 160 }]);
      addRoom('tenant-west-2', 940, 100, 680, 320, 'tenant', [{ side: 'south', offset: 340, size: 160 }]);
      addRoom('tenant-west-3', 1680, 100, 720, 320, 'tenant', [{ side: 'south', offset: 360, size: 160 }]);
      addRoom('tenant-east-1', 4000, 100, 720, 320, 'tenant', [{ side: 'south', offset: 360, size: 160 }]);
      addRoom('tenant-east-2', 4780, 100, 660, 320, 'tenant', [{ side: 'south', offset: 330, size: 160 }]);
      addRoom('tenant-east-3', 5500, 100, 720, 320, 'tenant', [{ side: 'south', offset: 360, size: 160 }]);
      for (let x = 520; x <= 5880; x += 560) addProp('pillar', x, 520, 46, 46);
      for (let x = 420; x <= 5980; x += 560) addProp('pillar', x, 1340, 48, 48);
      [760, 1560, 2440, 3960, 4840, 5720].forEach((x, i) => addProp('bench', x, 612, 170, 42, { variant: i & 1 ? 'metal' : 'wood' }));
      [760, 1640, 2520, 3880, 4760, 5640].forEach((x, i) => addProp('bench', x, 1530, 170, 42, { variant: i & 1 ? 'metal' : 'wood' }));
      addProp('locker', 440, 650, 220, 96); addProp('locker', 5960, 650, 220, 96);
      addProp('vending', 2600, 620, 96, 138); addProp('vending', 3800, 620, 96, 138); addProp('vending', 760, 640, 96, 138); addProp('vending', 5640, 640, 96, 138);
      addProp('kiosk', 2860, 290, 240, 180); addProp('kiosk', 3540, 290, 240, 180);
      addProp('planter', 2660, 510, 96, 42); addProp('planter', 3740, 510, 96, 42); addProp('planter', 3200, 510, 120, 42);
      [260, 900, 1740, 4080, 4860, 5580].forEach((x, i) => addProp('poster', x, 520, 44, 84, { variant: i % 3 === 0 ? 'yellow' : i & 1 ? 'blue' : 'green' }));
      [1080, 2280, 4120, 5320].forEach((x) => addProp('signStand', x, 730, 54, 90));
      addProp('warningStripe', track.x + track.w / 2, track.y - 66, track.w, 20);
      addProp('signalBox', 6040, 1690, 92, 98);
      this.terrain.subwaySigns.push({ id: 'board-west', x: 2040, y: 1120 }, { id: 'board-east', x: 4360, y: 1120 });

      // Service area: stronger sewer identity and more side rooms.
      this.terrain.roads.push(
        { id: 'service-main', x: 56, y: 2420, w: 6288, h: 180 },
        { id: 'service-upper', x: 56, y: 2880, w: 6288, h: 132 },
        { id: 'service-cross-west', x: 1090, y: 2420, w: 220, h: 1620 },
        { id: 'service-cross-center', x: 3090, y: 2420, w: 220, h: 1620 },
        { id: 'service-cross-east', x: 5090, y: 2420, w: 220, h: 1620 },
        { id: 'service-lower', x: 56, y: 3860, w: 6288, h: 180 },
      );
      this.terrain.plazas.push({ id: 'defense-plaza', x: 2560, y: 2645, w: 1280, h: 300, service: true }, { id: 'sewer-landing', x: 2580, y: 3380, w: 1240, h: 320, service: true });

      addRoom('pump-room', 80, 2660, 980, 340, 'pump', [{ side: 'east', offset: 170, size: 160 }, { side: 'south', offset: 740, size: 160 }]);
      addRoom('filter-room', 1160, 2660, 700, 340, 'drain', [{ side: 'west', offset: 170, size: 160 }, { side: 'south', offset: 360, size: 160 }]);
      addRoom('monitor-room', 1960, 2660, 940, 340, 'ops', [{ side: 'south', offset: 470, size: 170 }, { side: 'east', offset: 170, size: 160 }]);
      addRoom('workshop-room', 3400, 2660, 780, 340, 'maintenance', [{ side: 'south', offset: 390, size: 170 }, { side: 'west', offset: 170, size: 160 }]);
      addRoom('electrical-room', 5180, 2660, 1140, 340, 'electrical', [{ side: 'west', offset: 170, size: 160 }, { side: 'south', offset: 360, size: 170 }]);
      addRoom('drain-room', 80, 3360, 980, 500, 'drain', [{ side: 'east', offset: 250, size: 170 }, { side: 'north', offset: 740, size: 170 }]);
      addRoom('chemical-room', 1160, 3360, 740, 500, 'maintenance', [{ side: 'west', offset: 250, size: 170 }, { side: 'north', offset: 370, size: 170 }]);
      addRoom('storage-room', 1960, 3360, 820, 500, 'storage', [{ side: 'east', offset: 250, size: 170 }, { side: 'north', offset: 410, size: 170 }]);
      addRoom('sluice-room', 3600, 3360, 700, 500, 'ops', [{ side: 'west', offset: 250, size: 170 }, { side: 'north', offset: 350, size: 170 }]);
      addRoom('breaker-room', 5240, 3360, 1040, 500, 'breaker', [{ side: 'west', offset: 250, size: 170 }, { side: 'north', offset: 330, size: 170 }]);
      addRoom('tool-room', 4380, 2660, 640, 340, 'storage', [{ side: 'south', offset: 320, size: 160 }]);

      const maze = [
        ['maze-v1', 3770, 3430, 28, 350], ['maze-v2', 3940, 3550, 28, 280], ['maze-v3', 4110, 3430, 28, 350],
        ['maze-h1', 3770, 3430, 370, 28], ['maze-h2', 3940, 3700, 360, 28], ['maze-h3', 3770, 3830, 530, 28],
      ];
      for (const [id, x, y, w, h] of maze) addWall(id, x, y, w, h, 'maintenanceWall', 470, wallOptions);

      this.terrain.subwayWaterways.push(
        { id: 'sewer-west', x: 56, y: 3130, w: 980, h: 184, flowX: 76, flowY: 0 },
        { id: 'sewer-mid-west', x: 1320, y: 3130, w: 1660, h: 184, flowX: 76, flowY: 0 },
        { id: 'sewer-mid-east', x: 3420, y: 3130, w: 1660, h: 184, flowX: 76, flowY: 0 },
        { id: 'sewer-east', x: 5360, y: 3130, w: 984, h: 184, flowX: 76, flowY: 0 },
        { id: 'spill-west', x: 460, y: 2860, w: 110, h: 270, flowX: 0, flowY: 62 },
        { id: 'spill-east', x: 5700, y: 2860, w: 110, h: 270, flowX: 0, flowY: 62 },
      );
      this.terrain.subwaySludge.push(
        { id: 'sludge-west', x: 900, y: 3000, radius: 72, active: true, cooldown: 0 },
        { id: 'sludge-center-left', x: 2260, y: 3520, radius: 70, active: true, cooldown: 0 },
        { id: 'sludge-center-right', x: 3940, y: 3540, radius: 76, active: true, cooldown: 0 },
        { id: 'sludge-east', x: 5860, y: 3520, radius: 82, active: true, cooldown: 0 },
        { id: 'sludge-sewer', x: 3200, y: 3230, radius: 94, active: true, cooldown: 0 },
      );
      this.terrain.subwayWires.push(
        { x1: 3200, y1: 852, x2: 5700, y2: 2840 },
        { x1: 3200, y1: 852, x2: 700, y2: 2840 },
        { x1: 5700, y1: 2840, x2: 5700, y2: 3660 },
        { x1: 700, y1: 2840, x2: 700, y2: 3660 },
        { x1: 2100, y1: 2800, x2: 4300, y2: 2800 },
      );

      addProp('pipeRack', 670, 2470, 980, 40); addProp('pipeRack', 3200, 2470, 1240, 40); addProp('pipeRack', 5710, 2470, 980, 40);
      addProp('pump', 650, 2835, 220, 110); addProp('pump', 5700, 2835, 220, 110); addProp('generator', 5700, 3530, 220, 128);
      addProp('shelf', 1420, 2820, 180, 72); addProp('shelf', 1620, 2820, 180, 72); addProp('workbench', 2440, 2820, 220, 78); addProp('workbench', 3800, 2820, 220, 78);
      addProp('crate', 2100, 3520, 82, 82); addProp('crate', 2200, 3610, 82, 82); addProp('crate', 2300, 3520, 82, 82); addProp('crate', 2500, 3520, 82, 82);
      addProp('cabinet', 1420, 3520, 132, 78); addProp('cabinet', 5680, 3520, 148, 90); addProp('cabinet', 3920, 3530, 132, 78);
      addProp('cart', 2960, 3525, 144, 80); addProp('cart', 4700, 3525, 144, 80); addProp('grate', 3200, 3230, 210, 82); addProp('grate', 1180, 3230, 210, 76); addProp('grate', 5200, 3230, 210, 76);
      addProp('barrel', 860, 3550, 64, 88); addProp('barrel', 1020, 3550, 64, 88); addProp('barrel', 5480, 3550, 64, 88); addProp('barrel', 5640, 3550, 64, 88);
      addProp('valve', 1120, 3000, 54, 54); addProp('valve', 5580, 2890, 54, 54); addProp('valve', 5580, 3600, 54, 54);
      addProp('fence', 1200, 3230, 220, 30); addProp('fence', 3200, 3230, 220, 30); addProp('fence', 5200, 3230, 220, 30);
      [1160, 3200, 5240].forEach((x) => { addProp('planter', x, 2670, 90, 36); addProp('planter', x, 3770, 90, 36); });
      [820, 1760, 4040, 5840].forEach((x, i) => addProp('poster', x, 1220, 44, 84, { variant: i & 1 ? 'green' : 'yellow' }));

      const facilities = [
        ['barricade', 760, 1460], ['trap', 2420, 1480], ['turret', 5700, 1460],
        ['barricade', 1710, 2740], ['trap', 3200, 2740], ['turret', 4690, 2740],
        ['barricade', 1710, 3720], ['trap', 3200, 3720], ['turret', 4690, 3720],
      ];
      facilities.forEach(([type, x, y], i) => this.installations.push({
        id: `underground-facility-${i}`, type, x, y, radius: 24,
        hp: type === 'barricade' ? 280 : 205, maxHp: type === 'barricade' ? 280 : 205,
        active: false, team: null, work: 0, cooldown: 0, activeTimer: 0, respawnTimer: 0,
        destroyedLogged: false, subway: true,
      }));

      const lamps = [
        [520, 260], [1320, 260], [2120, 260], [2920, 260], [3720, 260], [4520, 260], [5320, 260], [6120, 260],
        [520, 1260], [1320, 1260], [2120, 1260], [2920, 1260], [3720, 1260], [4520, 1260], [5320, 1260], [6120, 1260],
      ];
      lamps.forEach(([x, y], i) => this.lightSources.push({ id: `fluorescent-${i}`, kind: 'fluorescent', x, y, radius: 13, hp: 84, maxHp: 84, length: 96, lightRadius: 250, respawnTimer: 0, destroyedLogged: false }));
      [[1240, 840], [2040, 840], [4360, 840], [5160, 840], [3200, 1730], [180, 2460], [3200, 2460], [6220, 2460], [3200, 4060]].forEach(([x, y], i) => this.lightSources.push({ id: `emergency-${i}`, kind: 'emergencyLight', x, y, radius: 11, hp: 72, maxHp: 72, lightRadius: 170, respawnTimer: 0, destroyedLogged: false, emergency: true }));
      this.lightSources.push(
        { id: 'platform-switch-passenger', kind: 'platformSwitch', x: 3200, y: 1640, radius: 18, hp: 9999, maxHp: 9999, lightRadius: 0, respawnTimer: 0, destroyedLogged: false, subwayControl: true, subwayDoorSide: 'passenger' },
        { id: 'platform-switch-service', kind: 'platformSwitch', x: 3200, y: 2470, radius: 18, hp: 9999, maxHp: 9999, lightRadius: 0, respawnTimer: 0, destroyedLogged: false, subwayControl: true, subwayDoorSide: 'service' },
        { id: 'watergate-switch', kind: 'waterGateSwitch', x: 1120, y: 3000, radius: 18, hp: 9999, maxHp: 9999, lightRadius: 0, respawnTimer: 0, destroyedLogged: false, subwayControl: true },
        { id: 'breaker-switch', kind: 'breakerSwitch', x: 5580, y: 3600, radius: 18, hp: 9999, maxHp: 9999, lightRadius: 0, respawnTimer: 0, destroyedLogged: false, subwayControl: true },
      );

      for (let i = 0; i < BASE_PICKUP_COUNT; i++) this.pickups.push(this.makePickup());
      this.pickupStats.baseSpawned = BASE_PICKUP_COUNT;
      this.pickupStats.peakTotal = this.pickups.length;
      this.syncUndergroundMechanisms();
    }

    syncUndergroundMechanisms() {
      if (this.mapId !== 'underground') return;
      const subway = this.environment.subway ||= { trainTimer: 12, trainActive: false, trainDirection: 1, trainX: -1200, homeDoorsClosed: true, breakerOff: false, waterDrained: false, waterLevel: 1, waterTarget: 1, waterTransitionSeconds: 7 };
      if (!Number.isFinite(subway.waterLevel)) subway.waterLevel = subway.waterDrained ? 0 : 1;
      if (!Number.isFinite(subway.waterTarget)) subway.waterTarget = subway.waterDrained ? 0 : 1;
      if (!Number.isFinite(subway.waterTransitionSeconds)) subway.waterTransitionSeconds = 7;
      for (const wall of this.walls) if (wall.subwayDoor) wall.hp = subway.homeDoorsClosed ? wall.maxHp : 0;
    }

    subwayWaterLevel() {
      const subway = this.environment.subway || {};
      return clamp(Number.isFinite(subway.waterLevel) ? subway.waterLevel : (subway.waterDrained ? 0 : 1), 0, 1);
    }

    subwayTrainCountdown() { const subway = this.environment.subway || {}; if (subway.trainActive) return 0; return Math.max(0, Math.ceil(subway.trainTimer || 0)); }
    subwayTrainRect(trainX = null) {
      if (this.mapId !== 'underground') return null;
      const subway = this.environment.subway || {};
      const track = this.terrain.subwayTracks?.[0];
      if (!track || !subway.trainActive) return null;
      const x = Number.isFinite(trainX) ? trainX : subway.trainX;
      return { x: x - 460, y: track.y + 10, w: 920, h: track.h - 20 };
    }

    subwayTrainSweepRect() {
      const subway = this.environment.subway || {};
      const current = this.subwayTrainRect(subway.trainX);
      if (!current) return null;
      const previous = this.subwayTrainRect(Number.isFinite(subway.trainPrevX) ? subway.trainPrevX : subway.trainX);
      const left = Math.min(current.x, previous.x);
      const right = Math.max(current.x + current.w, previous.x + previous.w);
      return { x: left, y: current.y, w: right - left, h: current.h };
    }
    updateSubwaySystems(dt) {
      if (this.mapId !== 'underground') return;
      const subway = this.environment.subway ||= { trainTimer: 12, trainActive: false, trainDirection: 1, trainX: -1200, homeDoorsClosed: true, breakerOff: false, waterDrained: false, waterLevel: 1, waterTarget: 1, waterTransitionSeconds: 7, doorControlCooldown: 0, doorControlCooldownMax: 4.5 };
      const track = this.terrain.subwayTracks?.[0];
      if (!track) return;
      subway.doorControlCooldown = Math.max(0, (subway.doorControlCooldown || 0) - dt);
      if (!Number.isFinite(subway.waterLevel)) subway.waterLevel = subway.waterDrained ? 0 : 1;
      if (!Number.isFinite(subway.waterTarget)) subway.waterTarget = subway.waterDrained ? 0 : 1;
      const waterTarget = clamp(subway.waterTarget, 0, 1);
      const waterStep = dt / Math.max(1, Number(subway.waterTransitionSeconds || 7));
      if (subway.waterLevel < waterTarget) subway.waterLevel = Math.min(waterTarget, subway.waterLevel + waterStep);
      else if (subway.waterLevel > waterTarget) subway.waterLevel = Math.max(waterTarget, subway.waterLevel - waterStep);
      this.syncUndergroundMechanisms();
      for (const sludge of this.terrain.subwaySludge || []) {
        if (sludge.active !== false) continue;
        sludge.cooldown = Math.max(0, (sludge.cooldown || 0) - dt);
        if (sludge.cooldown <= 0) sludge.active = true;
      }
      if (subway.trainActive) {
        subway.trainPrevX = subway.trainX;
        subway.trainX += subway.trainDirection * dt * 1850;
        const out = subway.trainDirection > 0 ? subway.trainX - 460 > this.world.w + 220 : subway.trainX + 460 < -220;
        if (out) {
          subway.trainActive = false;
          subway.trainTimer = rand(12, 19);
          subway.trainDirection *= -1;
          subway.trainX = subway.trainDirection > 0 ? -600 : this.world.w + 600;
          subway.trainPrevX = subway.trainX;
        }
      } else {
        subway.trainTimer -= dt;
        if (subway.trainTimer <= 0) {
          subway.trainActive = true;
          subway.trainDirection = Math.random() < .5 ? 1 : -1;
          subway.trainX = subway.trainDirection > 0 ? -600 : this.world.w + 600;
          subway.trainPrevX = subway.trainX;
          this.logEvent('subway_train_arrive', '通過電車が進入');
        }
      }
    }
    applyUndergroundRailSafety() {
      // No automatic push or dodge assistance. Entering the track is always the player's responsibility.
    }

    checkUndergroundHazards(p) {
      if (this.mapId !== 'underground' || p.dead) return;
      const train = this.subwayTrainRect();
      const sweep = this.subwayTrainSweepRect();
      if (!train || (!circleRectOverlap(p, train) && !circleRectOverlap(p, sweep))) return;
      const direction = this.environment.subway?.trainDirection || 1;
      p.vx = direction * 560;
      p.vy *= .2;
      this.effects.push({ type: 'slash', x: p.x, y: p.y, range: 160, angle: 0, arc: TAU, style: 'subwayTrain', ttl: .34, maxTtl: .34, color: '#ffd17a' });
      if (p.isDefenseEnemy) this.defeatDefenseEnemy(p, null, '通過電車');
      else this.bailout(p, null, '通過電車', { kind: 'hazard' });
      this.logEvent('subway_train_hit', p.id, false);
    }
    igniteSubwaySludge(sludge, ownerId, team) { if (!sludge || sludge.active === false) return; sludge.active = false; sludge.cooldown = rand(34, 52); this.effects.push({ type:'gasBurst', x: sludge.x, y: sludge.y, radius: 210, ttl:.72, maxTtl:.72 }); this.explode(sludge.x, sludge.y, 210, 112, ownerId, team, null, '汚泥爆発', { sourceKey:'subwaySludgeExplosion', sludgeChain:true }); }

    updateAutoPlatformDoorAccess(actor, dt) {
      if (this.mapId !== 'underground' || !actor || actor.dead || actor.human) return false;
      const subway = this.environment.subway || {};
      if (!subway.homeDoorsClosed) { actor.autoDoorAccess = null; return false; }
      const track = this.terrain.subwayTracks?.[0];
      if (!track) return false;
      const sideOf = (y) => y < track.y - 28 ? 'passenger' : y > track.y + track.h + 28 ? 'service' : 'track';
      const actorSide = sideOf(actor.y);
      if (actorSide === 'track') return false;
      const opponents = this.players.filter((p) => p !== actor && !p.dead && this.canDamage(actor, p));
      const opposite = opponents.filter((p) => { const side = sideOf(p.y); return side !== 'track' && side !== actorSide; });
      if (!opposite.length) { actor.autoDoorAccess = null; return false; }
      const controls = this.lightSources.filter((light) => light.kind === 'platformSwitch' && light.subwayDoorSide === actorSide && light.hp > 0);
      if (!controls.length) return false;
      const control = controls.sort((a,b)=>Math.hypot(a.x-actor.x,a.y-actor.y)-Math.hypot(b.x-actor.x,b.y-actor.y))[0];
      if (Math.hypot(control.x-actor.x,control.y-actor.y) > 620) { actor.autoDoorAccess = null; return false; }
      actor.autoDoorAccess = { side: actorSide, controlId: control.id };
      const dx=control.x-actor.x,dy=control.y-actor.y,d=Math.hypot(dx,dy)||1;
      actor.aim=Math.atan2(dy,dx);
      if(d<=100){
        actor.vx*=Math.pow(.02,dt);actor.vy*=Math.pow(.02,dt);
        if((subway.doorControlCooldown||0)<=0) this.tryInteractSubwayControl(actor);
        return true;
      }
      const angle=actor.ai?this.getAINavigationAngle(actor,control.x,control.y,actor.aim,dt,1):actor.aim;
      actor.vx+=Math.cos(angle)*actor.speed*dt*4.5;
      actor.vy+=Math.sin(angle)*actor.speed*dt*4.5;
      return true;
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
        let placed=0, attempts=0;
        while(placed<count && attempts++<count*10){
          const size=rand(22,42), x=rand(zone.x,zone.x+zone.w-size), y=rand(zone.y,zone.y+zone.h-size);
          if(this.isInRiver(x+size/2,y+size/2)) continue;
          this.walls.push({id:`tree-${i}-${placed}`,x,y,w:size,h:size,type:'tree',hp:75,maxHp:75,ttl:Infinity});
          placed++;
        }
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

    tryInteractSubwayControl(actor) {
      if (this.mapId !== 'underground' || !actor || actor.dead) return false;
      const controls = this.lightSources
        .filter((light) => light.subwayControl && light.hp > 0)
        .map((light) => ({ light, distance: Math.hypot(light.x - actor.x, light.y - actor.y) }))
        .filter((entry) => entry.distance <= 112)
        .sort((a, b) => a.distance - b.distance);
      if (!controls.length) return false;
      const control = controls[0].light;
      const subway = this.environment.subway ||= { trainTimer: 12, trainActive: false, trainDirection: 1, trainX: -1200, homeDoorsClosed: true, breakerOff: false, waterDrained: false, doorControlCooldown: 0, doorControlCooldownMax: 4.5 };
      let stateText = '';
      if (control.kind === 'platformSwitch') {
        if ((subway.doorControlCooldown || 0) > 0) {
          this.toast(`ホームドア操作待機 ${Math.ceil(subway.doorControlCooldown)}秒`);
          return true;
        }
        subway.homeDoorsClosed = !subway.homeDoorsClosed;
        subway.doorControlCooldown = subway.doorControlCooldownMax || 4.5;
        for (const linked of this.lightSources.filter((light) => light.kind === 'platformSwitch')) linked.cooldown = subway.doorControlCooldown;
        stateText = `両側ホームドア${subway.homeDoorsClosed ? '閉' : '開'} / 再操作まで${Math.ceil(subway.doorControlCooldown)}秒`;
      } else {
        if ((control.cooldown || 0) > 0) return true;
        if (control.kind === 'waterGateSwitch') {
          subway.waterDrained = !subway.waterDrained;
          subway.waterTarget = subway.waterDrained ? 0 : 1;
          if (!Number.isFinite(subway.waterLevel)) subway.waterLevel = subway.waterDrained ? 1 : 0;
          stateText = subway.waterDrained ? '水門開放・排水開始' : '水門閉鎖・注水開始';
        } else if (control.kind === 'breakerSwitch') {
          subway.breakerOff = !subway.breakerOff;
          stateText = `ブレーカー${subway.breakerOff ? 'OFF' : 'ON'}`;
        } else {
          return false;
        }
        control.cooldown = .65;
      }
      this.syncUndergroundMechanisms();
      this.toast(stateText);
      this.logEvent('subway_switch_toggle', stateText, false);
      return true;
    }

    updateLightSources(dt){
      for(let i=this.lightSources.length-1;i>=0;i--){
        const light=this.lightSources[i];
        if(['platformSwitch','waterGateSwitch','breakerSwitch'].includes(light.kind)){
          light.cooldown = Math.max(0, (light.cooldown || 0) - dt);
          light.hp = light.maxHp;
          continue;
        }
        if(light.kind==='sakeBarrel'){
          if(light.hp>0){ light.ignited=false; continue; }
          if(!light.destroyedLogged){ light.destroyedLogged=true; light.respawnTimer=rand(52,76); this.lifecycleStats.lightsDestroyed += 1; this.logEvent('sake_barrel_destroyed',light.id,false); }
          light.respawnTimer-=dt;
          if(light.respawnTimer<=0){ light.hp=light.maxHp; light.respawnTimer=0; light.destroyedLogged=false; light.ignited=false; this.lifecycleStats.lightsRespawned += 1; this.logEvent('sake_barrel_respawn',light.id,false); }
          continue;
        }
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

    igniteSakeBarrel(barrel, ownerId, team) {
      if(!barrel||barrel.kind!=='sakeBarrel'||barrel.hp<=0||barrel.ignited) return;
      barrel.ignited=true;
      barrel.hp=0;
      barrel.destroyedLogged=true;
      barrel.respawnTimer=rand(52,76);
      this.lifecycleStats.sakeExplosions+=1;
      this.effects.push({type:'sakeBurst',x:barrel.x,y:barrel.y,radius:185,ttl:.65,maxTtl:.65});
      this.logEvent('sake_barrel_explosion',barrel.id);
      this.explode(barrel.x,barrel.y,185,86,ownerId,team,null,'酒樽爆発',{sourceKey:'sakeBarrelExplosion',sakeChain:true});
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
    isOnSubwayCrossing(x, y, margin = 0) {
      if (this.mapId !== 'underground') return false;
      return (this.terrain.subwayCrossings || []).some((cross) => x >= cross.x - margin && x <= cross.x + cross.w + margin && y >= cross.y - margin && y <= cross.y + cross.h + margin);
    }
    isOnSubwayTrack(x, y, margin = 0) {
      if (this.mapId !== 'underground') return false;
      if (this.isOnSubwayCrossing(x, y, Math.max(0, margin * .35))) return false;
      return (this.terrain.subwayTracks || []).some((track) => x >= track.x - margin && x <= track.x + track.w + margin && y >= track.y - margin && y <= track.y + track.h + margin);
    }
    isUndergroundSafePoint(x, y, margin = 36) {
      if (this.mapId !== 'underground') return true;
      const bounds = this.subwayBounds || { x: 56, y: 56, w: this.world.w - 112, h: this.world.h - 112 };
      if (x < bounds.x + margin || x > bounds.x + bounds.w - margin || y < bounds.y + margin || y > bounds.y + bounds.h - margin) return false;
      if (this.isOnSubwayTrack(x, y, margin)) return false;
      if ((this.terrain.subwaySludge || []).some((zone) => zone.active !== false && Math.hypot(x - zone.x, y - zone.y) < zone.radius + margin)) return false;
      if (this.subwayWaterLevel() > .18 && (this.terrain.subwayWaterways || []).some((water) => x >= water.x - margin && x <= water.x + water.w + margin && y >= water.y - margin && y <= water.y + water.h + margin)) return false;
      return true;
    }
    isOnActiveBridge(x,y){ return this.terrain.bridges.some(b=>{ const wall=this.walls.find(w=>w.id===b.id); return wall&&wall.hp>0&&this.isPointInRect(x,y,b); }); }
    isInRiver(x,y){ const river=this.terrain.rivers[0]; return Boolean(river)&&Math.abs(y-this.riverCenterAt(x))<river.width/2&&!this.isOnActiveBridge(x,y); }
    makePickup(x = null, y = null, value = rand(1.5, 4), options = {}) {
      const temporary = Boolean(options.temporary);
      if (!Number.isFinite(x) || !Number.isFinite(y) || (this.mapId === 'underground' && !temporary && !this.isUndergroundSafePoint(x, y, 12))) {
        if (this.mapId === 'underground') { const point = this.randomOpenPoint(null); x = point.x; y = point.y; }
        else { x = rand(50, this.world.w - 50); y = rand(50, this.world.h - 50); }
      }
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
      const hostIdentity = { ...createDefaultTeamConfig(), ...(this.config.teamConfig || {}) };
      for (let team = 0; team < metaCount; team++) {
        const cfg = hostIdentity;
        const preset = EMBLEM_PRESETS[team % EMBLEM_PRESETS.length];
        this.teamMeta.push({
          name: cfg.squadName || 'オンライン隊',
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
        const onlineSkill = BEGINNER_SKILLS[pc.beginnerSkill] ? pc.beginnerSkill : 'none';
        const expectedBudget = BEGINNER_SKILLS[onlineSkill].budget;
        const statTotal = pc.stats && Object.values(pc.stats).reduce((sum, value) => sum + Number(value || 0), 0);
        const stats = pc.stats && statTotal === expectedBudget ? pc.stats : (expectedBudget === 12 ? { trion: 4, technique: 4, combat: 4 } : { trion: 6, technique: 6, combat: 6 });
        const loadout = pc.loadout?.main?.length === 4 && pc.loadout?.sub?.length === 4 ? { main: [...pc.loadout.main], sub: [...pc.loadout.sub] } : { main: [...DATA.defaultLoadout.main], sub: [...DATA.defaultLoadout.sub] };
        const appearance = { ...createDefaultTeamConfig(), ...hostIdentity };
        appearance.bodyColor = hostIdentity.bodyColor || TEAM_COLORS[Number(member.team || 0)];
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
          beginnerSkill: pc.beginnerSkill || 'none',
        });
        player.onlineUserId = member.userId;
        player.remoteControlled = this.isOnlineHost && !isLocal;
        player.onlineLastInputSeq = -1;
        this.applyPlayableDefenseForm(player, isLocal ? (this.config.extraPlayerType || 'agent') : (pc.extraType || 'agent'));
        this.players.push(player);
        if (isLocal) {
          this.human = player;
          this.playerProfile = { name:player.name,team,role:'combatant',stats:{...stats},loadout:{main:[...loadout.main],sub:[...loadout.sub]},appearance:{...appearance},squadName:player.squadName,emblemPixels:player.emblemPixels };
        }
      }

      this.operators = (this.config.mode === 'team' || this.isDefenseMode) ? this.teamMeta.map((meta, team) => {
        const onlineOperator = roster.find((member) => member.role === 'operator' && (this.isDefenseMode || Number(member.team || 0) === team));
        return { id:`operator-${team}`, name:`${meta.name} OPERATOR`, team, orders:0, nextOrderAt:rand(5 + team * 1.7, 11 + team * 2.2), lastOrderSignature:'', playerControlled:Boolean(onlineOperator && onlineOperator.userId === this.localOnlineUserId), onlineUserId:onlineOperator?.userId || null };
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
        this.applyPlayableDefenseForm(player, cfg.extraType || 'agent');
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
        const targetSize = Math.max(1, Math.min(8, Number(this.config.teamSize || 3)));
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
        beginnerSkill: this.config.beginnerSkill || 'none',
      }) : null;
      if (this.human) { this.applyPlayableDefenseForm(this.human, this.config.extraPlayerType || 'agent'); this.players.push(this.human); }

      this.operators = (this.config.mode === 'team' || this.isDefenseMode)
        ? this.teamMeta.map((meta, team) => ({
            id: `operator-${team}`,
            name: `${meta.name} OPERATOR`,
            team,
            orders: 0,
            nextOrderAt: rand(5 + team * 1.7, 11 + team * 2.2),
            lastOrderSignature: '',
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
        const cpuPlayer = this.createPlayer({
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
        });
        this.applyPlayableDefenseForm(cpuPlayer, cfg.extraType || 'agent');
        this.players.push(cpuPlayer);
      }
      this.placeInitialPlayers();
      if (this.isDefenseMode) this.initializeDefenseMode();
    }



    placeTutorialCombatants() {
      if (!this.isTutorial || !this.human) return;
      const origin = this.randomOpenPoint(null);
      this.human.x = origin.x; this.human.y = origin.y; this.human.vx = 0; this.human.vy = 0;
      this.human.invulnTimer = 1.2;
      const baseDistance = Number(this.config.tutorialTargetDistance || 420);
      const targets = this.players.filter((unit) => unit !== this.human);
      const pointIsOpen = (x, y, radius = 32) => {
        const point = { x, y, radius };
        if (x < 80 || y < 80 || x > this.world.w - 80 || y > this.world.h - 80) return false;
        if (this.isInRiver(x, y)) return false;
        if (this.walls.some((wall) => wall.hp > 0 && !wall.nonBlocking && circleRectOverlap(point, wall))) return false;
        if (this.installations.some((facility) => facility.hp > 0 && Math.hypot(facility.x - x, facility.y - y) < 72)) return false;
        return true;
      };
      targets.forEach((target, index) => {
        let placed = null;
        for (let attempt = 0; attempt < 80; attempt++) {
          const spread = targets.length <= 1 ? 0 : (index - (targets.length - 1) / 2) * .36;
          const angle = spread + (attempt % 2 ? 1 : -1) * Math.floor(attempt / 2) * .075;
          const distance = baseDistance + (attempt % 5) * 34;
          const x = origin.x + Math.cos(angle) * distance;
          const y = origin.y + Math.sin(angle) * distance;
          if (pointIsOpen(x, y, target.radius + 10)) { placed = { x, y }; break; }
        }
        if (!placed) placed = this.randomOpenPoint(target.team);
        target.x = placed.x; target.y = placed.y; target.vx = 0; target.vy = 0;
        target.invulnTimer = 0;
        target.maxHp = Math.max(target.maxHp, this.tutorialCourse === 'attacker' ? 240 : 180);
        target.hp = target.maxHp;
        target.respawnTimer = Infinity;
        target.name = `訓練標的 ${String.fromCharCode(65 + index)}`;
      });
      this.camera.x = clamp(this.human.x - this.viewW / 2, 0, Math.max(0, this.world.w - this.viewW));
      this.camera.y = clamp(this.human.y - this.viewH / 2, 0, Math.max(0, this.world.h - this.viewH));
    }

    applyPlayableDefenseForm(player, type = 'agent', force = false) {
      if (!player || (!this.isExtraMode && !force) || !EXTRA_UNIT_DEFS[type] || type === 'agent') return player;
      const def = EXTRA_UNIT_DEFS[type];
      player.playableDefenseType = type;
      player.defenseType = type;
      player.isDefenseBoss = Boolean(def.boss);
      player.defenseFaction = def.support ? 'defenseSupport' : ['skeletonAttacker','skeletonShooter','skeletonSniper','yamagu','yagarasu','whitefox','nekomata','orochi'].includes(type) ? 'hyakki' : 'bt';
      player.archetype = def.category === '百鬼夜行' ? `百鬼夜行・${def.label}` : def.category === 'ブラックトリガー' ? `黒トリガー・${def.label}` : def.category === '防衛助っ人' ? `防衛助っ人・${def.label}` : def.label;
      player.maxHp = Math.max(player.maxHp, Math.round(def.hp * (def.boss ? .68 : 1.25)));
      player.hp = player.maxHp;
      player.radius = def.radius;
      player.speed = def.speed;
      player.flying = Boolean(def.flying);
      player.maxTrion = Math.max(player.maxTrion, 180 + player.stats.trion * 18);
      player.trion = player.maxTrion;
      player.regen = Math.max(player.regen, 5.5 + player.stats.trion * .55);
      player.extraDamage = def.damage || 20;
      player.extraActionTimer = 0;
      player.extraAction = '';
      player.extraParryTimer = 0;
      player.extraParryCooldown = 0;
      player.extraBoost = 1;
      player.extraSealPrimary = 'bullet';
      player.extraSealSecondary = 'shield';
      player.sogetsuConnected = false;
      player.sogetsuConnectTimer = 0;
      player.fullArmsTimer = 0;
      player.geistActive = false;
      player.geistTimer = 0;
      player.geistMaxTimer = 38;
      player.geistLevels = { armor:1, slash:4, special:3, speed:5, shoot:4 };
      player.geistBaseSpeed = player.speed;
      player.defenseAI = {
        attackCooldown: 0, specialCooldown: 0, phaseTimer: type === 'borboros' ? 4 : 0,
        phase: type === 'borboros' ? 'solid' : 'normal', shieldTimer: 0, sealCount: 0,
        damage: def.damage || 20, castTimer: 0, castMode: null, chameleonTimer: 0,
        bodyHistory: [], bodySegments: [], trailTimer: .35, enraged: false,
        borborosCores: [], coreCooldown: 0,
      };
      if (type === 'orochi') this.initializeOrochiBodyPose?.(player);
      if (type === 'borboros') this.deployBorborosCores(player, true);
      return player;
    }

    getPlayableDefenseProfile(type) {
      const profiles = {
        marmod:{main:['ブレード','連続刃','突進','回転刃'],sub:['硬化','跳躍','後退斬り','捕食']},
        ilgar:{main:['爆撃','散開爆撃','機銃','急降下'],sub:['加速飛行','背面迎撃','自爆予告','自爆']},
        rabbit:{main:['打撃','捕獲腕','連撃','叩きつけ'],sub:['装甲防御','跳躍','キューブ化','突進']},
        fujin:{main:['遠隔斬撃','伝播斬撃','近接斬撃','斬撃陣'],sub:['いなし','高速移動','多重斬撃','残弾集中']},
        seals:{main:['弾印','錨印','鎖印','門印'],sub:['盾印','響印','射印','転送印']},
        alektor:{main:['生体弾','多重生体弾','鳥型弾','針弾'],sub:['いなし','キューブ波','装甲展開','捕獲領域']},
        borboros:{main:['固体斬撃','液体槍','毒ガス','形態連撃'],sub:['固体化','液体化','気体化','多重コア']},
        organon:{main:['円軌道刃','多重円刃','直線刃','収束斬'],sub:['いなし','軌道加速','外周刃','全周展開']},
        skeletonAttacker:{main:['孤月','旋空','連撃','突進斬り'],sub:['カメレオン','受け流し','跳躍','抜刀']},
        skeletonShooter:{main:['アステロイド','メテオラ','合成弾','連射'],sub:['回避射撃','弾幕','近接射撃','チャージ']},
        skeletonSniper:{main:['イーグレット','アイビス','鉛弾','速射'],sub:['伏せ撃ち','狙撃移動','照準集中','後退射撃']},
        yamagu:{main:['爪','連続引っ掻き','突進','咆哮'],sub:['いなし','爪研ぎ','飛びかかり','獣気']},
        yagarasu:{main:['黒い霧','羽ばたき','闇ブレス','羽根弾'],sub:['いなし','急上昇','滑空突進','鳴き']},
        whitefox:{main:['瞬歩斬り','転移斬り','時計輪剣','鈍足剣'],sub:['いなし','残像移動','三尾斬り','妖気解放']},
        nekomata:{main:['双尾突き','妖尾狙撃','妖光レーザー','尾薙ぎ'],sub:['いなし','跳躍','尾分身','妖力集中']},
        orochi:{main:['大蛇の牙','落星火','極炎ブレス','巨体薙ぎ'],sub:['炎纏い','火炎移動','終焉の炎','咆哮']},
        sogetsu:{main:['双月・右斧','メテオラ','シールド','接続器'],sub:['双月・左斧','メテオラ散弾','シールド','バッグワーム']},
        fullarms:{main:['レイガスト拳','機関砲／Shift:メテオラ','シールド','イーグレット／Shift:バッグワーム'],sub:['アステロイド突撃銃','ハウンド突撃銃','スパイダー','全武装']},
        geist:{main:['弧月','アステロイド突撃銃','バイパー突撃銃','シールド'],sub:['エスクード','ガイスト','メテオラ','バッグワーム']},
      };
      return profiles[type] || { main:['攻撃1','攻撃2','攻撃3','攻撃4'], sub:['特殊1','特殊2','特殊3','特殊4'] };
    }

    setPlayableDefenseCooldown(p, hand, index, seconds) {
      const key = `${hand}:${index}`;
      const value = Math.max(.08, seconds * (1 - (p.stats.technique - 2) * .018));
      p.cooldowns[key] = value;
      p.cooldownMax[key] = value;
    }

    setPlayableDefenseAction(p, action, duration = .35) {
      p.extraAction = action;
      p.extraActionTimer = duration;
      p.defenseAI ||= {};
      p.defenseAI.action = action;
      p.defenseAI.actionTimer = duration;
      p.defenseAI.actionMax = duration;
    }

    getPlayableDefenseTarget(p, maxRange = 900) {
      if (!p) return null;
      if (!p.human) return this.players.filter((other) => this.canDamage(p, other)).sort((a,b) => dist2(p,a)-dist2(p,b))[0] || null;
      const aimPoint = this.getHumanAimPoint(p, maxRange);
      const candidates = this.players.filter((other) => this.canDamage(p, other) && Math.hypot(other.x-p.x,other.y-p.y) <= maxRange);
      let best = null, score = Infinity;
      for (const target of candidates) {
        const along = segmentPointDistance(p.x,p.y,aimPoint.x,aimPoint.y,target.x,target.y);
        const d = Math.hypot(target.x-p.x,target.y-p.y);
        const s = along.distance * 4 + d * .08;
        if (along.distance <= target.radius + 70 && s < score) { best=target;score=s; }
      }
      return best || { id:null, x:aimPoint.x, y:aimPoint.y, vx:0, vy:0, radius:18, hp:1, maxHp:1, dead:false, extraAimPoint:true };
    }

    consumePlayableTrion(p, cost) {
      if (p.isDefenseEnemy) return true;
      if (p.trion < cost) { if (p.human) this.toast('トリオン不足'); return false; }
      p.trion -= cost; p.metrics.trionSpent += cost; return true;
    }

    beginPlayableParry(p) {
      if (!EXTRA_PARRY_TYPES.has(p.playableDefenseType || p.defenseType) || p.extraParryCooldown > 0) return false;
      if (!this.consumePlayableTrion(p, 5)) return false;
      p.extraParryTimer = .34;
      p.extraParryCooldown = 1.4;
      p.masteryParryAttempt = true;
      this.setPlayableDefenseAction(p, 'parry', .34);
      this.effects.push({ type:'justCut', x:p.x, y:p.y, radius:p.radius+28, angle:p.aim, color:'#fff3a8', ttl:.34, maxTtl:.34 });
      return true;
    }

    deployBorborosCores(p, initial = false) {
      p.defenseAI ||= {};
      if (!initial && (p.defenseAI.coreCooldown || 0) > 0) return false;
      const trueIndex = irand(0, 5);
      p.defenseAI.borborosCores = Array.from({length:6}, (_,i) => ({ angle:i/6*TAU + rand(-.18,.18), distance:50+rand(-8,12), radius:8, trueCore:i===trueIndex, hp:i===trueIndex?999:1, phase:rand(0,TAU) }));
      p.defenseAI.coreCooldown = 8;
      this.setPlayableDefenseAction(p, 'cores', .65);
      if (!initial) this.effects.push({type:'composite',x:p.x,y:p.y,ttl:.55,maxTtl:.55});
      return true;
    }


    getPlayableDefenseActionCost(type, hand, index, boost = 1) {
      const costs = {
        fujin:{main:[5,12,3,18],sub:[5,5,15,14]},
        alektor:{main:[4,14,11,6],sub:[5,15,12,20]},
        borboros:{main:[4,6,14,16],sub:[2,2,2,12]},
        organon:{main:[12,20,7,18],sub:[5,12,18,28]},
        yamagu:{main:[3,7,9,10],sub:[5,8,8,14]},
        yagarasu:{main:[6,7,14,8],sub:[5,5,9,8]},
        whitefox:{main:[4,9,14,7],sub:[5,6,10,12]},
        nekomata:{main:[4,6,16,6],sub:[5,5,10,12]},
        orochi:{main:[5,18,20,10],sub:[12,8,36,12]},
        sogetsu:{main:[2.5,6,.12,9],sub:[2.5,7.5,.12,1]},
        fullarms:{main:[4,6.5,.12,6],sub:[5,5.5,4,27]},
        geist:{main:[3,4,5,.12],sub:[6,10,8,1]},
      };
      if (type === 'seals') {
        const main = [4,4,4.5,6];
        const sub = [.15,5,4,7];
        return (hand === 'main' ? main[index] * boost : sub[index] * (index === 3 ? 1 : boost)) || 4;
      }
      const found = costs[type]?.[hand]?.[index];
      if (Number.isFinite(found)) return found;
      if (hand === 'main') return ['skeletonShooter','skeletonSniper'].includes(type) ? 4 : 3;
      return index === 0 ? 4 : 5;
    }

    usePlayableDefenseAction(p, hand, index, target = null, options = {}) {
      if ((!p?.playableDefenseType && !p?.isDefenseEnemy) || p.dead) return false;
      const key = `${hand}:${index}`;
      if ((p.cooldowns[key] || 0) > 0) return false;
      target ||= this.getPlayableDefenseTarget(p);
      if (!target) return false;
      const type = p.playableDefenseType || p.defenseType;
      const supportAi = Boolean(options.ai && (EXTRA_UNIT_DEFS[p.playableDefenseType || p.defenseType]?.support));
      const damage = (p.extraDamage || 20) * (options.ai ? (supportAi ? 1.08 : .92) : 1);
      const modifier = Boolean(options.modifier);
      const boost = type === 'seals' ? clamp(p.extraBoost || p.defenseAI?.sealBoost || 1,1,3) : 1;
      const requestedCost = this.getPlayableDefenseActionCost(type, hand, index, boost) + (type === 'seals' && modifier && hand === 'main' ? 2 * boost : 0);
      if (!p.isDefenseEnemy && p.trion < requestedCost) { if (p.human) this.toast('トリオン不足'); return false; }
      const angle = Math.atan2(target.y-p.y,target.x-p.x);
      p.aim = angle;
      const distanceTo = Math.hypot(target.x-p.x,target.y-p.y);
      const line = (name,width,amount,color,delay=.18,status=null,range=900) => {
        if (distanceTo > range || this.findBlockingWall(p.x,p.y,target.x,target.y,4)) return false;
        return this.queueDefenseHazard({type:'line',x:p.x,y:p.y,x2:target.x,y2:target.y,width,delay,damage:amount,owner:p,name,color,status,hitsFlag:false});
      };
      const circle = (name,radius,amount,color,delay=.3,status=null,at=target) => {
        if (Math.hypot(at.x-p.x,at.y-p.y) > 900 || this.findBlockingWall(p.x,p.y,at.x,at.y,4)) return false;
        return this.queueDefenseHazard({type:'circle',x:at.x,y:at.y,radius,delay,damage:amount,owner:p,name,color,status,hitsFlag:false});
      };
      const melee = (name,range,width,amount,color='#fff') => {
        const x2=p.x+Math.cos(p.aim)*range,y2=p.y+Math.sin(p.aim)*range;
        this.effects.push({type:'slash',x:p.x,y:p.y,range,angle:p.aim,arc:1.15,style:'extra',color,ttl:.22,maxTtl:.22});
        this.damageWorldArc(p.x,p.y,p.aim,range,1.15,amount*.65,p.team);
        return this.queueDefenseHazard({type:'line',x:p.x,y:p.y,x2,y2,width,delay:.08,damage:amount,owner:p,name,color,hitsFlag:false});
      };
      const projectile = (name,sourceKey,speed,amount,radius,color,extra={}) => this.fireDefenseProjectile(p,target,{sourceName:name,sourceKey,speed,damage:amount,radius,color,...extra});
      let used = false, cd = .8, cost = 4;

      if (type === 'fujin') {
        if (hand==='sub' && index===0) return this.beginPlayableParry(p);
        if (hand==='main' && index===0) { used=line('風刃・遠隔斬撃',28,damage,'#45ef83',.34,null,900); this.setPlayableDefenseAction(p,'fujinSlash',.38); cd=.7;cost=5; }
        else if(hand==='main'&&index===1){used=true;for(let i=-1;i<=1;i++){const a=angle+i*.12;const x2=p.x+Math.cos(a)*Math.min(860,distanceTo),y2=p.y+Math.sin(a)*Math.min(860,distanceTo);this.queueDefenseHazard({type:'line',x:p.x,y:p.y,x2,y2,width:24,delay:.28+Math.abs(i)*.08,damage:damage*.75,owner:p,name:'風刃・伝播斬撃',color:'#45ef83'});}this.setPlayableDefenseAction(p,'fujinMulti',.48);cd=1.8;cost=12;}
        else if(hand==='main'&&index===2){used=melee('風刃・近接斬撃',115,28,damage*1.1,'#73ff9d');this.setPlayableDefenseAction(p,'fujinMelee',.3);cd=.65;cost=3;}
        else if(hand==='main'&&index===3){used=true;for(let r=120;r<=360;r+=80)this.queueDefenseHazard({type:'ring',x:p.x,y:p.y,radius:r,width:22,delay:.35+r/1200,damage:damage*.7,owner:p,name:'風刃・斬撃陣',color:'#45ef83'});this.setPlayableDefenseAction(p,'fujinField',.75);cd=3.2;cost=18;}
        else if(hand==='sub'&&index===1){p.vx+=Math.cos(p.aim)*640;p.vy+=Math.sin(p.aim)*640;used=true;cd=1.4;cost=5;this.setPlayableDefenseAction(p,'dash',.28);}
        else if(hand==='sub'&&index===2){used=line('風刃・多重斬撃',42,damage*1.35,'#8affaa',.48,null,720);this.setPlayableDefenseAction(p,'fujinFocus',.6);cd=2.5;cost=15;}
        else if(hand==='sub'&&index===3){p.extraBoost=3;used=true;cd=4;cost=14;this.effects.push({type:'composite',x:p.x,y:p.y,ttl:.7,maxTtl:.7});}
      } else if (type === 'seals') {
        const mainSeals=['bullet','anchor','chain','gate']; const subSeals=['shield','echo','shoot','transfer'];
        if (hand==='main') p.extraSealPrimary=mainSeals[index]; else p.extraSealSecondary=subSeals[index];
        if (hand==='sub'&&index===0) { p.defenseAI.shieldTimer=Math.max(p.defenseAI.shieldTimer||0,.18); p.defenseAI.shieldHand='sub';this.activateShield(p,'sub','seal',{boost}); used=true;cd=.08;cost=.15;this.setPlayableDefenseAction(p,'sealShield',.18); }
        else if(hand==='main'&&index===0){used=circle(boost>1?`${boost}重弾印`:'弾印',90+boost*24,damage*(.45+.22*boost),'#f5f5ff',.35,'bounce');this.setPlayableDefenseAction(p,'sealBullet',.38);cd=1.15;cost=4*boost;}
        else if(hand==='main'&&index===1){used=circle(boost>1?`${boost}重錨印`:'錨印',92+boost*20,damage*(.32+.16*boost),'#252c35',.4,'anchor');this.setPlayableDefenseAction(p,'sealAnchor',.42);cd=1.35;cost=4*boost;}
        else if(hand==='main'&&index===2){used=line(boost>1?`${boost}重鎖印`:'鎖印',30+boost*7,damage*(.35+.18*boost),'#d5d9e3',.38,'chain',720);this.setPlayableDefenseAction(p,'sealChain',.42);cd=1.45;cost=4.5*boost;}
        else if(hand==='main'&&index===3){const max=220+boost*120;const scale=Math.min(1,max/Math.max(1,distanceTo));const ox=p.x,oy=p.y;p.x=clamp(p.x+(target.x-p.x)*scale,60,this.world.w-60);p.y=clamp(p.y+(target.y-p.y)*scale,60,this.world.h-60);this.effects.push({type:'teleport',x:ox,y:oy,x2:p.x,y2:p.y,ttl:.35,maxTtl:.35});used=true;cd=2.2;cost=6*boost;this.setPlayableDefenseAction(p,'sealGate',.35);}
        else if(hand==='sub'&&index===1){for(const enemy of this.players.filter(o=>this.canDamage(p,o)&&Math.hypot(o.x-p.x,o.y-p.y)<620)){enemy.revealTimer=Math.max(enemy.revealTimer,5+boost*2);enemy.markedTimer=Math.max(enemy.markedTimer,3+boost);}used=true;cd=2.8;cost=5*boost;this.setPlayableDefenseAction(p,'sealEcho',.5);}
        else if(hand==='sub'&&index===2){used=projectile('射印','asteroid',800+boost*120,damage*(.55+.25*boost),5+boost,'#eef5ff',{penetration:boost-1});this.setPlayableDefenseAction(p,'sealShoot',.32);cd=.9;cost=4*boost;}
        else if(hand==='sub'&&index===3){const ally=this.players.filter(o=>!o.dead&&o.team===p.team&&o!==p).sort((a,b)=>dist2(p,a)-dist2(p,b))[0];if(ally){const ox=p.x,oy=p.y;p.x=ally.x+Math.cos(p.aim+Math.PI)*60;p.y=ally.y+Math.sin(p.aim+Math.PI)*60;this.effects.push({type:'teleport',x:ox,y:oy,x2:p.x,y2:p.y,ttl:.35,maxTtl:.35});used=true;}cd=2.5;cost=7;this.setPlayableDefenseAction(p,'sealTransfer',.4);}
        if (modifier && hand === 'main' && used) {
          const secondary = subSeals[p.selected?.sub ?? 0] || p.extraSealSecondary || 'shield';
          if (secondary === 'shield') { p.defenseAI.shieldTimer=Math.max(p.defenseAI.shieldTimer||0,.7+.25*boost);p.defenseAI.shieldHand='main';this.activateShield(p,'main','seal',{boost}); }
          else if (secondary === 'echo') {
            for(const enemy of this.players.filter(o=>this.canDamage(p,o)&&Math.hypot(o.x-target.x,o.y-target.y)<220+boost*55)){enemy.revealTimer=Math.max(enemy.revealTimer,4+boost*2);enemy.markedTimer=Math.max(enemy.markedTimer,2+boost);}
            this.effects.push({type:'composite',x:target.x,y:target.y,ttl:.5,maxTtl:.5});
          } else if (secondary === 'shoot') {
            this.fireDefenseProjectile(p,target,{sourceName:`BOOST ${boost}・射印`,sourceKey:'asteroid',speed:900+boost*120,damage:damage*(.3+.18*boost),radius:4+boost,color:'#eef5ff',penetration:boost});
          } else if (secondary === 'transfer') {
            const ox=p.x,oy=p.y;const jump=Math.min(150+boost*70,Math.max(0,distanceTo-70));p.x=clamp(p.x+Math.cos(angle)*jump,60,this.world.w-60);p.y=clamp(p.y+Math.sin(angle)*jump,60,this.world.h-60);this.effects.push({type:'teleport',x:ox,y:oy,x2:p.x,y2:p.y,ttl:.3,maxTtl:.3});
          }
          cost += 2*boost; cd += .22; this.setPlayableDefenseAction(p,`sealCombine${secondary}`,Math.max(.46,cd*.25));
          if(p.human)this.toast(`${boost}重印 × ${secondary==='shield'?'盾':secondary==='echo'?'響':secondary==='shoot'?'射':'転送'}`);
        }
      } else if (type === 'alektor') {
        if(hand==='sub'&&index===0)return this.beginPlayableParry(p);
        if(hand==='main'&&index===0){used=projectile('アレクトール生体弾','asteroid',680,damage*.55,7,'#b1e893',{homing:1.2,targetId:target.id});this.setPlayableDefenseAction(p,'alektorEgg',.32);cd=.65;cost=4;}
        else if(hand==='main'&&index===1){used=true;for(let i=0;i<6;i++)this.fireDefenseProjectile(p,target,{sourceName:'アレクトール多重弾',sourceKey:'asteroid',speed:620+i*20,damage:damage*.39,radius:6,color:'#b1e893',homing:1.4,targetId:target.id});this.setPlayableDefenseAction(p,'alektorSwarm',.65);cd=2.2;cost=14;}
        else if(hand==='main'&&index===2){used=true;for(let i=-2;i<=2;i++){const a=angle+i*.16;this.spawnProjectile(p,'main',{angle:a,speed:720,damage:damage*.42,radius:6,life:1.25,color:'#d9ffbf',homing:.5,targetId:target.id,sourceKey:'alektorBird',sourceName:'アレクトール鳥型弾'});}this.setPlayableDefenseAction(p,'alektorBird',.55);cd=1.7;cost=11;}
        else if(hand==='main'&&index===3){used=line('アレクトール針弾',20,damage*1.05,'#caffad',.24,'cube',680);this.setPlayableDefenseAction(p,'alektorNeedle',.32);cd=1.05;cost=6;}
        else if(hand==='sub'&&index===1){used=circle('アレクトール・キューブ波',145,damage*.75,'#b1e893',.48,'cube');this.setPlayableDefenseAction(p,'alektorWave',.55);cd=2.5;cost=15;}
        else if(hand==='sub'&&index===2){p.defenseAI.shieldTimer=3;used=true;cd=3.8;cost=12;this.setPlayableDefenseAction(p,'alektorArmor',.5);}
        else if(hand==='sub'&&index===3){used=circle('アレクトール捕獲領域',210,damage*.35,'#8fdc81',.6,'cube');this.setPlayableDefenseAction(p,'alektorField',.7);cd=4.2;cost=20;}
      } else if (type === 'borboros') {
        if(hand==='main'&&index===0){used=melee('ボルボロス固体斬撃',140,48,damage*1.1,'#b68be2');this.setPlayableDefenseAction(p,'solidSlash',.36);cd=.8;cost=4;}
        else if(hand==='main'&&index===1){used=line('ボルボロス液体槍',42,damage*.9,'#ba91e4',.28,null,540);this.setPlayableDefenseAction(p,'liquidSpear',.4);cd=1.1;cost=6;}
        else if(hand==='main'&&index===2){this.spawnDefenseArea({kind:'mist',x:target.x,y:target.y,radius:180,ttl:5,damage:damage*.14,interval:.55,owner:p,name:'ボルボロス毒ガス'});used=true;this.setPlayableDefenseAction(p,'gas',.55);cd=3.2;cost=14;}
        else if(hand==='main'&&index===3){used=melee('ボルボロス形態連撃',190,62,damage*1.45,'#cf9cff');this.setPlayableDefenseAction(p,'morphCombo',.65);cd=2.4;cost=16;}
        else if(hand==='sub'&&index<3){p.defenseAI.phase=['solid','liquid','gas'][index];p.defenseAI.phaseTimer=99;used=true;cd=.5;cost=2;this.setPlayableDefenseAction(p,p.defenseAI.phase,.35);}
        else if(hand==='sub'&&index===3){used=this.deployBorborosCores(p);cd=4.5;cost=12;}
      } else if (type === 'organon') {
        if(hand==='sub'&&index===0)return this.beginPlayableParry(p);
        if(hand==='main'&&index===0){for(let r=135;r<=345;r+=105)this.queueDefenseHazard({type:'ring',x:p.x,y:p.y,radius:r,width:24,delay:.35+r/900,damage:damage*.7,owner:p,name:'オルガノン円軌道刃',color:'#e8ddbb'});used=true;this.setPlayableDefenseAction(p,'organonRings',.7);cd=2.2;cost=12;}
        else if(hand==='main'&&index===1){for(let r=100;r<=520;r+=84)this.queueDefenseHazard({type:'ring',x:p.x,y:p.y,radius:r,width:20,delay:.32+r/1200,damage:damage*.46,owner:p,name:'オルガノン多重円刃',color:'#e8ddbb'});used=true;this.setPlayableDefenseAction(p,'organonMulti',.85);cd=3.5;cost=20;}
        else if(hand==='main'&&index===2){used=line('オルガノン直線刃',34,damage*1.15,'#fff0bd',.28,null,700);this.setPlayableDefenseAction(p,'organonLine',.38);cd=1.1;cost=7;}
        else if(hand==='main'&&index===3){used=circle('オルガノン収束斬',120,damage*1.55,'#f7e8b8',.62,null);this.setPlayableDefenseAction(p,'organonFocus',.72);cd=3;cost=18;}
        else if(hand==='sub'&&index===1){p.extraBoost=3;used=true;cd=4;cost=12;this.setPlayableDefenseAction(p,'organonBoost',.6);}
        else if(hand==='sub'&&index===2){for(let i=0;i<5;i++){const a=i/5*TAU;const pt={x:p.x+Math.cos(a)*420,y:p.y+Math.sin(a)*420};this.queueDefenseHazard({type:'line',x:p.x,y:p.y,x2:pt.x,y2:pt.y,width:24,delay:.5+i*.06,damage:damage*.65,owner:p,name:'オルガノン外周刃',color:'#e8ddbb'});}used=true;cd=3;cost=18;}
        else if(hand==='sub'&&index===3){for(let r=120;r<=620;r+=100)this.queueDefenseHazard({type:'ring',x:p.x,y:p.y,radius:r,width:26,delay:.42+r/1000,damage:damage*.72,owner:p,name:'オルガノン全周展開',color:'#fff0bd'});used=true;cd=5;cost=28;this.setPlayableDefenseAction(p,'organonUltimate',1.1);}
      } else if (type === 'yamagu') {
        if(hand==='sub'&&index===0)return this.beginPlayableParry(p);
        if(hand==='main'&&index===0){used=melee('山狗の爪',105,40,damage,'#ffd5a0');this.setPlayableDefenseAction(p,'claw',.26);cd=.7;cost=3;}
        else if(hand==='main'&&index===1){used=true;for(let i=-1;i<=1;i++){const a=angle+i*.16;this.queueDefenseHazard({type:'line',x:p.x,y:p.y,x2:p.x+Math.cos(a)*240,y2:p.y+Math.sin(a)*240,width:30,delay:.16+Math.abs(i)*.08,damage:damage*.72,owner:p,name:'連続引っ掻き',color:'#ffd5a0'});}this.setPlayableDefenseAction(p,'claw',.38);cd=1.3;cost=7;}
        else if(hand==='main'&&index===2){p.vx+=Math.cos(angle)*760;p.vy+=Math.sin(angle)*760;used=line('山狗突進',56,damage*1.3,'#ffc46c',.2,null,650);this.setPlayableDefenseAction(p,'dash',.38);cd=2.2;cost=9;}
        else if(hand==='main'&&index===3){used=circle('山狗の咆哮',180,damage*.6,'#ffd49a',.3,'bounce',p);this.setPlayableDefenseAction(p,'roar',.6);cd=2.8;cost=10;}
        else if(hand==='sub'&&index===1){p.extraBoost=2;used=true;this.setPlayableDefenseAction(p,'sharpen',.8);cd=3;cost=8;}
        else if(hand==='sub'&&index===2){p.vx+=Math.cos(angle)*540;p.vy+=Math.sin(angle)*540;used=melee('山狗飛びかかり',150,55,damage*1.15,'#ffe0ad');this.setPlayableDefenseAction(p,'dash',.5);cd=2;cost=8;}
        else if(hand==='sub'&&index===3){p.speed*=1.08;used=true;this.setPlayableDefenseAction(p,'roar',.7);cd=5;cost=14;}
      } else if (type === 'yagarasu') {
        if(hand==='sub'&&index===0)return this.beginPlayableParry(p);
        if(hand==='main'&&index===0){this.spawnDefenseArea({kind:'mist',x:target.x,y:target.y,radius:125,ttl:5.5,damage:damage*.14,interval:.65,owner:p,name:'黒い霧'});used=true;this.setPlayableDefenseAction(p,'mist',.38);cd=1.4;cost=6;}
        else if(hand==='main'&&index===1){used=line('夜鴉の羽ばたき',96,damage*.6,'#8a939d',.28,'bounce',540);this.setPlayableDefenseAction(p,'flap',.46);cd=1.6;cost=7;}
        else if(hand==='main'&&index===2){used=line('夜鴉の闇ブレス',92,damage*1.45,'#6c5975',.72,null,720);this.setPlayableDefenseAction(p,'breath',.9);cd=2.8;cost=14;}
        else if(hand==='main'&&index===3){used=true;for(let i=-2;i<=2;i++)this.spawnProjectile(p,'main',{angle:angle+i*.12,speed:690,damage:damage*.35,radius:5,life:1.2,color:'#727e89',sourceKey:'crowFeather',sourceName:'夜鴉の羽根弾'});this.setPlayableDefenseAction(p,'flap',.42);cd=1.4;cost=8;}
        else if(hand==='sub'&&index===1){p.vy-=540;used=true;this.setPlayableDefenseAction(p,'flap',.55);cd=1.2;cost=5;}
        else if(hand==='sub'&&index===2){p.vx+=Math.cos(angle)*720;p.vy+=Math.sin(angle)*720;used=line('夜鴉滑空突進',70,damage,'#aab4bd',.18,null,600);this.setPlayableDefenseAction(p,'flap',.48);cd=2.2;cost=9;}
        else if(hand==='sub'&&index===3){used=circle('夜鴉の鳴き',170,damage*.35,'#c2cad2',.25,'bounce',p);this.setPlayableDefenseAction(p,'cry',.55);cd=2.4;cost=8;}
      } else if (type === 'whitefox') {
        if(hand==='sub'&&index===0)return this.beginPlayableParry(p);
        if(hand==='main'&&index===0){used=melee('白狐・瞬歩斬り',115,34,damage,'#e6f7ff');this.setPlayableDefenseAction(p,'slash',.28);cd=.7;cost=4;}
        else if(hand==='main'&&index===1){const ox=p.x,oy=p.y;const s=Math.min(1,520/Math.max(1,distanceTo));p.x=clamp(p.x+(target.x-p.x)*s,60,this.world.w-60);p.y=clamp(p.y+(target.y-p.y)*s,60,this.world.h-60);this.effects.push({type:'teleport',x:ox,y:oy,x2:p.x,y2:p.y,ttl:.3,maxTtl:.3});used=melee('白狐・転移斬り',100,36,damage*1.1,'#e6f7ff');this.setPlayableDefenseAction(p,'teleport',.42);cd=1.8;cost=9;}
        else if(hand==='main'&&index===2){used=this.queueDefenseHazard({type:'ring',x:p.x,y:p.y,radius:170,width:30,delay:.65,damage:damage*1.25,owner:p,name:'時計輪剣',color:'#d6f0ff'});this.setPlayableDefenseAction(p,'clock',.72);cd=2.7;cost=14;}
        else if(hand==='main'&&index===3){used=line('白狐・鈍足剣',40,damage*.8,'#8ed5ff',.25,'anchor',440);this.setPlayableDefenseAction(p,'slow',.38);cd=1.4;cost=7;}
        else if(hand==='sub'&&index===1){p.vx+=Math.cos(angle)*650;p.vy+=Math.sin(angle)*650;used=true;this.effects.push({type:'teleport',x:p.x-Math.cos(angle)*100,y:p.y-Math.sin(angle)*100,x2:p.x,y2:p.y,ttl:.25,maxTtl:.25});cd=1.4;cost=6;}
        else if(hand==='sub'&&index===2){used=true;for(let i=-1;i<=1;i++){const a=angle+i*.22;this.queueDefenseHazard({type:'line',x:p.x,y:p.y,x2:p.x+Math.cos(a)*220,y2:p.y+Math.sin(a)*220,width:26,delay:.2+Math.abs(i)*.05,damage:damage*.65,owner:p,name:'白狐・三尾斬り',color:'#dff6ff'});}this.setPlayableDefenseAction(p,'slash',.48);cd=1.8;cost=10;}
        else if(hand==='sub'&&index===3){p.extraBoost=2;used=true;this.effects.push({type:'composite',x:p.x,y:p.y,ttl:.7,maxTtl:.7});cd=4;cost=12;}
      } else if (type === 'nekomata') {
        if(hand==='sub'&&index===0)return this.beginPlayableParry(p);
        if(hand==='main'&&index===0){used=line('猫又・双尾突き',34,damage*.9,'#b073ff',.2,null,300);this.setPlayableDefenseAction(p,'tails',.34);cd=.75;cost=4;}
        else if(hand==='main'&&index===1){used=projectile('猫又・妖尾狙撃','egret',1280,damage,4,'#b073ff',{trail:true});this.setPlayableDefenseAction(p,'snipe',.34);cd=1.2;cost=6;}
        else if(hand==='main'&&index===2){used=line('猫又・空中妖光レーザー',72,damage*1.55,'#ff6ad5',.75,null,760);this.setPlayableDefenseAction(p,'laser',.9);cd=3;cost=16;}
        else if(hand==='main'&&index===3){used=melee('猫又・尾薙ぎ',150,52,damage,'#c38cff');this.setPlayableDefenseAction(p,'tails',.42);cd=1.2;cost=6;}
        else if(hand==='sub'&&index===1){p.vx+=Math.cos(angle)*380;p.vy+=Math.sin(angle)*380;p.vy-=260;used=true;this.setPlayableDefenseAction(p,'jump',.55);cd=1.3;cost=5;}
        else if(hand==='sub'&&index===2){used=true;for(let i=-1;i<=1;i++)this.fireDefenseProjectile(p,target,{sourceName:'猫又・尾分身',sourceKey:'asteroid',speed:760+i*60,damage:damage*.42,radius:5,color:'#b073ff',homing:1,targetId:target.id});this.setPlayableDefenseAction(p,'tails',.45);cd=1.8;cost=10;}
        else if(hand==='sub'&&index===3){p.extraBoost=2;used=true;this.effects.push({type:'composite',x:p.x,y:p.y,ttl:.65,maxTtl:.65});cd=4;cost=12;}
      } else if (type === 'sogetsu') {
        const connected = (p.sogetsuConnectTimer || 0) > 0 || p.sogetsuConnected;
        if ((hand==='main'&&index===2)||(hand==='sub'&&index===2)) { p.defenseAI.shieldTimer=Math.max(p.defenseAI.shieldTimer||0,.18);p.defenseAI.shieldHand=hand;used=this.activateShield(p,hand,'shield');cd=.08;cost=.12;this.setPlayableDefenseAction(p,'sogetsuGuard',.18); }
        else if(hand==='main'&&index===0){used=melee(connected?'双月・連結大斧':'双月・右斧',connected?185:108,connected?68:38,damage*(connected?1.75:.88),connected?'#ffd36a':'#8de8ff');this.setPlayableDefenseAction(p,connected?'sogetsuHeavy':'sogetsuRight',connected?.72:.3);cd=connected?1.55:.55;cost=connected?7:3;if(connected)this.effects.push({type:'sogetsuConnector',x:p.x,y:p.y,angle:p.aim,ttl:.75,maxTtl:.75});}
        else if(hand==='sub'&&index===0){used=melee(connected?'双月・連結薙ぎ':'双月・左斧',connected?170:108,connected?62:38,damage*(connected?1.45:.88),connected?'#ffd36a':'#8de8ff');this.setPlayableDefenseAction(p,connected?'sogetsuHeavy':'sogetsuLeft',connected?.66:.3);cd=connected?1.35:.55;cost=connected?6:3;}
        else if(hand==='main'&&index===1){used=projectile('双月・メテオラ','meteor',560,damage*.9,8,'#ff9a4f',{explosionRadius:92});this.setPlayableDefenseAction(p,'sogetsuMeteor',.42);cd=1.1;cost=7;}
        else if(hand==='sub'&&index===1){used=true;for(let i=-1;i<=1;i++)this.fireDefenseProjectile(p,target,{sourceName:'双月・メテオラ散弾',sourceKey:'meteor',speed:520,damage:damage*.48,radius:7,color:'#ff9a4f',explosionRadius:70,angleOffset:i*.16});this.setPlayableDefenseAction(p,'sogetsuMeteor',.5);cd=1.7;cost=9;}
        else if(hand==='main'&&index===3){p.sogetsuConnected=true;p.sogetsuConnectTimer=8;used=true;this.setPlayableDefenseAction(p,'sogetsuConnect',.9);this.effects.push({type:'sogetsuConnector',x:p.x,y:p.y,angle:p.aim,ttl:1,maxTtl:1});cd=4.2;cost=12;}
        else if(hand==='sub'&&index===3){p.toggles.bagworm=!p.toggles.bagworm;used=true;this.setPlayableDefenseAction(p,'bagworm',.25);cd=.35;cost=1;}
      } else if (type === 'fullarms') {
        if(hand==='main'&&index===0){p.vx+=Math.cos(angle)*430;p.vy+=Math.sin(angle)*430;used=melee('全武装・スラスター拳',125,48,damage*1.28,'#a8f6ff');this.setPlayableDefenseAction(p,'fullarmsPunch',.52);this.effects.push({type:'thruster',x:p.x-Math.cos(angle)*55,y:p.y-Math.sin(angle)*55,x2:p.x,y2:p.y,ttl:.35,maxTtl:.35});cd=1.05;cost=5;}
        else if(hand==='main'&&index===1){if(modifier){used=projectile('全武装・メテオラ','meteor',560,damage,8,'#ff9a4f',{explosionRadius:105});this.setPlayableDefenseAction(p,'fullarmsMeteor',.48);cd=1.25;cost=9;}else{used=true;for(let i=0;i<8;i++)this.fireDefenseProjectile(p,target,{sourceName:'全武装・機関砲',sourceKey:'asteroid',speed:900,damage:damage*.19,radius:4,color:'#72e8ff',angleOffset:rand(-.07,.07)});this.setPlayableDefenseAction(p,'fullarmsGatling',.75);this.effects.push({type:'fullArmsVolley',x:p.x,y:p.y,angle:p.aim,ttl:.8,maxTtl:.8});cd=1.2;cost=8;}}
        else if(hand==='main'&&index===2){p.defenseAI.shieldTimer=Math.max(p.defenseAI.shieldTimer||0,.18);p.defenseAI.shieldHand='main';used=this.activateShield(p,'main','shield');this.setPlayableDefenseAction(p,'fullarmsGuard',.18);cd=.08;cost=.12;}
        else if(hand==='main'&&index===3){if(modifier){p.toggles.bagworm=!p.toggles.bagworm;used=true;this.setPlayableDefenseAction(p,'bagworm',.25);cd=.35;cost=1;}else{used=projectile('全武装・イーグレット','egret',1320,damage*1.22,4,'#e8fbff',{trail:true});this.setPlayableDefenseAction(p,'fullarmsSnipe',.4);cd=1.25;cost=7;}}
        else if(hand==='sub'&&index===0){used=true;for(let i=0;i<4;i++)this.fireDefenseProjectile(p,target,{sourceName:'アステロイド（突撃銃）',sourceKey:'assaultAsteroid',speed:870,damage:damage*.34,radius:5,color:'#72e8ff',angleOffset:rand(-.045,.045)});this.setPlayableDefenseAction(p,'fullarmsRifle',.48);cd=.62;cost=6;}
        else if(hand==='sub'&&index===1){used=true;for(let i=-1;i<=1;i++)this.fireDefenseProjectile(p,target,{sourceName:'ハウンド（突撃銃）',sourceKey:'assaultHound',speed:690,damage:damage*.39,radius:5,color:'#7dffb8',homing:1.7,targetId:target.id,angleOffset:i*.12});this.setPlayableDefenseAction(p,'fullarmsHound',.48);cd=.9;cost=7;}
        else if(hand==='sub'&&index===2){const sx=target.x,sy=target.y;this.wires.push({id:`fullarms-wire-${this.elapsed}-${Math.random()}`,x1:sx-75,y1:sy-45,x2:sx+75,y2:sy+45,ownerId:p.id,team:p.team,ttl:22,color:'#9edfff',triggered:new Set()});this.wires.push({id:`fullarms-wire-${this.elapsed}-${Math.random()}-b`,x1:sx-75,y1:sy+45,x2:sx+75,y2:sy-45,ownerId:p.id,team:p.team,ttl:22,color:'#9edfff',triggered:new Set()});used=true;this.setPlayableDefenseAction(p,'fullarmsSpider',.5);cd=2.2;cost=5;}
        else if(hand==='sub'&&index===3){used=true;p.fullArmsTimer=2.2;this.setPlayableDefenseAction(p,'fullarmsUltimate',1.7);this.effects.push({type:'fullArmsVolley',x:p.x,y:p.y,angle:p.aim,ttl:1.8,maxTtl:1.8,ultimate:true});for(let i=0;i<24;i++)this.fireDefenseProjectile(p,target,{sourceName:'全武装・一斉掃射',sourceKey:i%5===0?'meteor':i%3===0?'hound':'asteroid',speed:i%5===0?520:i%3===0?700:930,damage:damage*(i%5===0?.48:.21),radius:i%5===0?8:4,color:i%5===0?'#ff9a4f':i%3===0?'#7dffb8':'#72e8ff',explosionRadius:i%5===0?80:0,homing:i%3===0?1.2:0,targetId:target.id,angleOffset:rand(-.18,.18)});this.fireDefenseProjectile(p,target,{sourceName:'全武装・イーグレット斉射',sourceKey:'egret',speed:1350,damage:damage*1.18,radius:4,color:'#f0ffff',trail:true});cd=6.2;cost=27;}
      } else if (type === 'geist') {
        const gm=p.geistActive?1.62:1;
        if(hand==='main'&&index===0){used=melee(p.geistActive?'弧月・ガイスト強化':'弧月',p.geistActive?150:112,p.geistActive?52:34,damage*gm,'#d8fbff');this.setPlayableDefenseAction(p,p.geistActive?'geistSlash':'geistKogetsu',p.geistActive?.44:.3);cd=p.geistActive?.48:.7;cost=4;}
        else if(hand==='main'&&index===1){used=true;for(let i=0;i<(p.geistActive?6:3);i++)this.fireDefenseProjectile(p,target,{sourceName:'アステロイド（突撃銃）',sourceKey:'assaultAsteroid',speed:p.geistActive?1020:850,damage:damage*(p.geistActive?.27:.31),radius:5,color:'#72e8ff',angleOffset:rand(-.06,.06)});this.setPlayableDefenseAction(p,'geistRifle',.48);cd=p.geistActive?.48:.68;cost=5;}
        else if(hand==='main'&&index===2){used=true;for(let i=-1;i<=1;i++)this.fireDefenseProjectile(p,target,{sourceName:'バイパー（突撃銃）',sourceKey:'assaultViper',speed:p.geistActive?930:760,damage:damage*(p.geistActive?.34:.3),radius:5,color:'#c88cff',curve:(i)*.75,curveFlip:.55,targetId:target.id});this.setPlayableDefenseAction(p,'geistViper',.52);cd=p.geistActive?.62:.9;cost=6;}
        else if(hand==='main'&&index===3){p.defenseAI.shieldTimer=Math.max(p.defenseAI.shieldTimer||0,.18);p.defenseAI.shieldHand='main';used=this.activateShield(p,'main','shield');this.setPlayableDefenseAction(p,'geistGuard',.18);cd=.08;cost=.12;}
        else if(hand==='sub'&&index===0){const ex=p.x+Math.cos(angle)*110,ey=p.y+Math.sin(angle)*110;this.walls.push({id:`geist-escudo-${this.elapsed}-${Math.random()}`,x:ex-34,y:ey-70,w:68,h:140,type:'escudo',team:p.team,ownerId:p.id,hp:210,maxHp:210,ttl:18});used=true;this.setPlayableDefenseAction(p,'geistEscudo',.55);cd=2.5;cost=8;}
        else if(hand==='sub'&&index===1){if(p.geistActive)return false;p.geistActive=true;p.geistTimer=p.geistMaxTimer||38;p.geistBaseSpeed=p.speed;p.speed*=1.42;used=true;this.setPlayableDefenseAction(p,'geistActivate',1.3);this.effects.push({type:'geistActivate',x:p.x,y:p.y,ttl:1.5,maxTtl:1.5});cd=99;cost=10;}
        else if(hand==='sub'&&index===2){used=projectile('ガイスト・メテオラ','meteor',p.geistActive?680:540,damage*(p.geistActive?1.18:.92),8,'#ff9a4f',{explosionRadius:p.geistActive?120:92});this.setPlayableDefenseAction(p,'geistMeteor',.48);cd=p.geistActive?.8:1.2;cost=10;}
        else if(hand==='sub'&&index===3){p.toggles.bagworm=!p.toggles.bagworm;used=true;this.setPlayableDefenseAction(p,'bagworm',.25);cd=.35;cost=1;}
      } else if (type === 'orochi') {
        if(hand==='main'&&index===0){used=melee('大蛇の牙',180,70,damage*1.2,'#ffc26b');this.setPlayableDefenseAction(p,'bite',.55);this.effects.push({type:'orochiBite',x:p.x,y:p.y,angle:p.aim,range:180,ttl:.65,maxTtl:.65});cd=1.1;cost=5;}
        else if(hand==='main'&&index===1){used=true;for(let i=0;i<5;i++){const ox=(i-2)*70,oy=(i%2)*50;this.effects.push({type:'orochiMeteor',x:target.x+ox,y:target.y+oy,radius:95,ttl:1.55,maxTtl:1.55});this.queueDefenseHazard({type:'circle',x:target.x+ox,y:target.y+oy,radius:92,delay:.5+i*.1,damage:damage*.82,owner:p,name:'落星火',color:'#ff954a'});}this.setPlayableDefenseAction(p,'meteor',1.25);cd=3.5;cost=18;}
        else if(hand==='main'&&index===2){used=line('大蛇・極炎ブレス',125,damage*1.75,'#ff8d46',.82,null,880);this.effects.push({type:'orochiBreath',x:p.x,y:p.y,x2:target.x,y2:target.y,ttl:1.45,maxTtl:1.45});this.setPlayableDefenseAction(p,'breath',1.35);cd=3.2;cost=20;}
        else if(hand==='main'&&index===3){used=this.queueDefenseHazard({type:'ring',x:p.x,y:p.y,radius:250,width:70,delay:.5,damage:damage,owner:p,name:'大蛇の巨体薙ぎ',color:'#cfb56e'});this.setPlayableDefenseAction(p,'bite',.72);cd=2.2;cost=10;}
        else if(hand==='sub'&&index===0){p.defenseAI.enraged=!p.defenseAI.enraged;used=true;this.effects.push({type:'orochiAura',x:p.x,y:p.y,radius:250,ttl:1.55,maxTtl:1.55});this.setPlayableDefenseAction(p,'enrage',1.35);cd=4;cost=12;}
        else if(hand==='sub'&&index===1){p.vx+=Math.cos(angle)*420;p.vy+=Math.sin(angle)*420;this.spawnDefenseArea({kind:'fire',x:p.x,y:p.y,radius:100,ttl:4,damage:damage*.12,interval:.45,owner:p,name:'大蛇の残火'});used=true;cd=1.8;cost=8;}
        else if(hand==='sub'&&index===2){used=true;this.effects.push({type:'orochiUltimate',x:p.x,y:p.y,radius:460,ttl:2.75,maxTtl:2.75});for(let i=0;i<16;i++){const a=i/16*TAU,r=rand(180,760),pt={x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};if(!this.findBlockingWall(p.x,p.y,pt.x,pt.y,4))this.spawnDefenseArea({kind:'fire',x:pt.x,y:pt.y,radius:130,ttl:5,damage:damage*.15,interval:.4,owner:p,name:'終焉の炎'});}this.setPlayableDefenseAction(p,'ultimate',2.5);cd=8;cost=36;}
        else if(hand==='sub'&&index===3){used=circle('大蛇の咆哮',280,damage*.55,'#ffb15e',.4,'bounce',p);this.setPlayableDefenseAction(p,'roar',.7);cd=3;cost=12;}
      } else {
        // Basic defense units and skeletons share concise action behavior.
        if (hand==='main' && ['skeletonShooter','skeletonSniper'].includes(type)) {
          const sniper=type==='skeletonSniper'; used=projectile(sniper?'骸骨狙撃':'骸骨射撃',sniper?'egret':'asteroid',sniper?1250:760,damage,sniper?4:5,sniper?'#f2f8ff':'#72e8ff',{trail:sniper});cd=sniper?1.25:.75;cost=4;this.setPlayableDefenseAction(p,sniper?'shoot':'shoot',.3);
        } else if (hand==='main') { used=melee(`${EXTRA_UNIT_DEFS[type]?.label || type}攻撃`,120,42,damage,'#e9f4f5');cd=.75;cost=3;this.setPlayableDefenseAction(p,'slash',.3); }
        else if(hand==='sub'&&index===0){p.defenseAI.shieldTimer=1.5;p.shields.sub={type:'shield',strength:1.2};used=true;cd=1.3;cost=4;}
        else {p.vx+=Math.cos(angle)*420;p.vy+=Math.sin(angle)*420;used=true;cd=1.5;cost=5;}
      }

      if (!used) return false;
      if (!p.isDefenseEnemy) { p.trion = Math.max(0, p.trion - cost); p.metrics.trionSpent += cost; }
      this.setPlayableDefenseCooldown(p, hand, index, cd);
      return true;
    }

    updatePlayableDefenseHuman(p, dt) {
      const selectMap = [
        ['mainSlot1','main',0],['mainSlot2','main',1],['mainSlot3','main',2],['mainSlot4','main',3],
        ['subSlot1','sub',0],['subSlot2','sub',1],['subSlot3','sub',2],['subSlot4','sub',3],
      ];
      for (const [action,hand,index] of selectMap) if (this.actionConsume(action)) p.selected[hand]=index;
      if (this.input.virtualAim.active) p.aim=Math.atan2(this.input.virtualAim.y,this.input.virtualAim.x);
      else {const point=this.screenToWorld(this.input.mouse.x,this.input.mouse.y);p.aim=Math.atan2(point.y-p.y,point.x-p.x);}
      let dx=this.input.virtualMove.x,dy=this.input.virtualMove.y;
      if(this.actionDown('moveUp'))dy-=1;if(this.actionDown('moveDown'))dy+=1;if(this.actionDown('moveLeft'))dx-=1;if(this.actionDown('moveRight'))dx+=1;
      if(dx||dy){const l=Math.hypot(dx,dy)||1;p.vx+=dx/l*p.speed*dt*6.2;p.vy+=dy/l*p.speed*dt*6.2;}
      p.shields.main=null;p.shields.sub=null;
      const target=this.getPlayableDefenseTarget(p);
      const mod=this.modifierDown();
      const mainHeld=this.input.mouse.left||this.input.virtualMain,subHeld=this.input.mouse.right||this.input.virtualSub;
      const mainJust=this.input.mouse.justLeft||this.input.virtualMainJust,subJust=this.input.mouse.justRight||this.input.virtualSubJust;
      const type=p.playableDefenseType;
      const mainShieldHeld=mainHeld&&((type==='sogetsu'&&p.selected.main===2)||(type==='fullarms'&&p.selected.main===2)||(type==='geist'&&p.selected.main===3));
      const subShieldHeld=subHeld&&(type==='sogetsu'&&p.selected.sub===2);
      if(type==='seals'&&subHeld&&p.selected.sub===0)this.usePlayableDefenseAction(p,'sub',0,target,{modifier:mod,held:true});
      else if(subShieldHeld)this.usePlayableDefenseAction(p,'sub',p.selected.sub,target,{modifier:mod,held:true});
      else if(subJust)this.usePlayableDefenseAction(p,'sub',p.selected.sub,target,{modifier:mod});
      if(mainShieldHeld)this.usePlayableDefenseAction(p,'main',p.selected.main,target,{modifier:mod,held:true});
      else if(mainJust)this.usePlayableDefenseAction(p,'main',p.selected.main,target,{modifier:mod});
      if(this.actionConsume('combo')){
        if(p.playableDefenseType==='seals'){p.extraBoost=p.extraBoost>=3?1:p.extraBoost+1;this.toast(`印 BOOST ×${p.extraBoost}`);}
        else if(p.playableDefenseType==='borboros')this.deployBorborosCores(p);
        else if(EXTRA_PARRY_TYPES.has(p.playableDefenseType))this.beginPlayableParry(p);
        else if(p.playableDefenseType==='orochi')this.usePlayableDefenseAction(p,'sub',2,target,{});
        else if(p.playableDefenseType==='sogetsu')this.usePlayableDefenseAction(p,'main',3,target,{});
        else if(p.playableDefenseType==='fullarms')this.usePlayableDefenseAction(p,'sub',3,target,{});
        else if(p.playableDefenseType==='geist')this.usePlayableDefenseAction(p,'sub',1,target,{});
      }
    }

    updatePlayableDefenseAI(p, dt) {
      if (!p || p.dead) return;
      const target=this.getPlayableDefenseTarget(p);
      if(!target)return;
      const d=Math.hypot(target.x-p.x,target.y-p.y);
      const supportUnit = Boolean(EXTRA_UNIT_DEFS[p.playableDefenseType]?.support);
      const preferredSupportRange = p.playableDefenseType==='fullarms'?390:p.playableDefenseType==='geist'?310:165;
      this.moveDefenseEnemy(p,target,dt,d>preferredSupportRange*1.18?(supportUnit?1.02:.82):d<preferredSupportRange*.58?-.28:.16);
      p.extraAiTimer=(p.extraAiTimer||0)-dt;
      const tier=AI_TIER_PROFILES[p.aiTier]||AI_TIER_PROFILES.middle,base=AI_DIFFICULTIES[this.config.difficulty]||AI_DIFFICULTIES.normal;
      const pers=p.aiPersonality||{calmness:.5,aggression:.5};
      const profile={...base,calmness:pers.calmness,aggression:pers.aggression,guardSkill:clamp((base.guardSkill||0)*(tier.defense||1),0,1),parrySkill:clamp((base.parrySkill||0)*(tier.defense||1),0,1),dodgeSkill:clamp((base.dodgeSkill||0)*(tier.defense||1),0,1)};
      const defended=this.aiTryDefensiveRead(p,this.getProjectileThreatInfo(p),profile,tier,dt);
      if(defended&&Math.random()<(base.patience||0)*(supportUnit?.42:1))return;
      if(p.extraAiTimer>0)return;
      const attackBias=clamp(.42+pers.aggression*.46+(supportUnit?.16:0),0,1);
      let hand=Math.random()<attackBias?'main':'sub';
      let index=irand(0,3);
      if(p.playableDefenseType==='sogetsu'){if(d<135){hand=Math.random()<.68?'main':'sub';index=0;}else if(d<520){hand=Math.random()<.55?'main':'sub';index=1;}else{hand='main';index=1;}if(!p.sogetsuConnected&&d<190&&Math.random()<.2){hand='main';index=3;}}
      else if(p.playableDefenseType==='fullarms'){if(d<145){hand='main';index=0;}else if(d>650){hand='main';index=3;}else if(Math.random()<.3){hand='sub';index=3;}else{hand=Math.random()<.48?'main':'sub';index=hand==='main'?1:irand(0,1);}}
      else if(p.playableDefenseType==='geist'){if(!p.geistActive&&((p.hp/p.maxHp)<.78||this.isDefenseMode&&this.defenseFlag&&this.defenseFlag.hp/this.defenseFlag.maxHp<.62)&&Math.random()<.48){hand='sub';index=1;}else if(d<150){hand='main';index=0;}else{hand=Math.random()<.62?'main':'sub';index=hand==='main'?irand(1,2):2;}}
      if(p.playableDefenseType==='seals'){p.extraBoost=pers.calmness>.66?irand(1,3):(Math.random()<.58?3:irand(1,2));if(hand==='sub'&&index===0){p.defenseAI.shieldTimer=1.2;p.defenseAI.shieldHand='sub';this.activateShield(p,'sub','seal',{boost:p.extraBoost});}}
      this.usePlayableDefenseAction(p,hand,index,target,{ai:true,modifier:(p.playableDefenseType==='seals'&&hand==='main'&&Math.random()<(.2+pers.calmness*.42))||(p.playableDefenseType==='fullarms'&&hand==='main'&&[1,3].includes(index)&&Math.random()<.16)});
      const skillPace=.75+tier.decision*.25;
      p.extraAiTimer=rand(supportUnit?.32:.5,supportUnit?.86:1.3)/(skillPace*(.7+pers.aggression*.55));
    }


    getDefenseSupportDefinition(type) {
      const defs={
        sogetsu:{name:'双月',stats:{trion:8,technique:8,combat:10},main:['kogetsu','shooter_meteor','shield','empty'],sub:['kogetsu','shooter_meteor','shield','bagworm'],color:'#2b98c9'},
        fullarms:{name:'全武装',stats:{trion:10,technique:9,combat:9},main:['raygust','thruster','shield','egret'],sub:['assaultAsteroid','assaultHound','spider','empty'],color:'#516b7f'},
        geist:{name:'ガイスト',stats:{trion:9,technique:9,combat:9},main:['kogetsu','assaultAsteroid','assaultViper','shield'],sub:['escudo','empty','shooter_meteor','bagworm'],color:'#3e7cb4'},
      };
      return defs[type]||null;
    }

    summonDefenseSupport(type, team=0, byCpu=false) {
      if(!this.isDefenseMode||team!==0||this.defenseSupportSummoned?.[type])return null;
      const spec=this.getDefenseSupportDefinition(type),def=EXTRA_UNIT_DEFS[type];
      if(!spec||!def)return null;
      this.defenseSupportSummoned[type]=true;
      this.defenseSupportLastSummonAt=this.elapsed;
      const support=this.createPlayer({id:`defense-support-${type}-${++this.defenseSupportSerial}`,name:spec.name,human:false,team,stats:spec.stats,loadout:{main:[...spec.main],sub:[...spec.sub]},archetype:`防衛助っ人・${spec.name}`,appearance:{bodyColor:spec.color,uniformColor:spec.color},squadName:this.teamMeta?.[team]?.name||'防衛隊',emblemPixels:this.teamMeta?.[team]?.emblemPixels||null});
      this.applyPlayableDefenseForm(support,type,true);
      support.defenseSupportType=type;
      support.summonedByOperator=true;
      support.supportBuff={damage:1.22,defense:.78,trionCost:.72,cooldown:.86};
      support.maxHp=Math.round(support.maxHp*1.18);support.hp=support.maxHp;
      support.maxTrion=Math.round(support.maxTrion*1.22);support.trion=support.maxTrion;
      support.defenseAI.damage*=1.22;support.geistMaxTimer=type==='geist'?44:support.geistMaxTimer;
      support.respawnTimer=Infinity;
      const flag=this.defenseFlag||this.getTeamHome(team),a=({sogetsu:-.7,fullarms:0,geist:.7}[type]||0);
      support.x=clamp(flag.x+Math.cos(a)*125,60,this.world.w-60);support.y=clamp(flag.y+Math.sin(a)*125,60,this.world.h-60);support.invulnTimer=2.4;
      support.operatorOrder=null;
      support.ai.attackTimer=0; support.ai.utilityTimer=.3; support.ai.targetLockTimer=0;
      this.players.push(support);
      this.effects.push({type:'supportSummon',x:support.x,y:support.y,color:spec.color,ttl:1.45,maxTtl:1.45});
      this.showCenterMessage('SUPPORT ARRIVAL',`${spec.name}を召喚`,1.8);
      this.logEvent('defense_support_summon',`${byCpu?'CPUオペレーター':'オペレーター'}：${spec.name}を召喚`);
      const key=`summon${type.charAt(0).toUpperCase()}${type.slice(1)}`;
      this.operatorSupportCooldowns[key]=9999;this.operatorStats.supportsUsed+=1;if(key in this.operatorStats)this.operatorStats[key]+=1;
      this.refreshOperatorUi();
      return support;
    }

    tryCpuDefenseSupport(operator) {
      if(!this.isDefenseMode||this.isPlayerOperator||!this.defenseFlag||!operator||operator.team!==0)return false;
      if(this.elapsed-this.defenseSupportLastSummonAt<7.5)return false;
      const ratio=this.defenseFlag.hp/Math.max(1,this.defenseFlag.maxHp);
      const plan=[['sogetsu',.58],['fullarms',.37],['geist',.2]];
      const next=plan.find(([type,threshold])=>!this.defenseSupportSummoned[type]&&ratio<=threshold);
      if(!next)return false;
      return Boolean(this.summonDefenseSupport(next[0],0,true));
    }

    getDefenseScenarioLabel() {
      return DEFENSE_SCENARIO_LABELS[this.defenseScenario] || DEFENSE_SCENARIO_LABELS.blackTrigger;
    }

    isHyakkiDefense() {
      return this.defenseScenario === 'hyakki';
    }


    getDefenseAttackMaxRange(enemy, attackName = '', sourceKey = '') {
      const type = String(enemy?.defenseType || '');
      const name = String(attackName || '');
      const key = String(sourceKey || '');
      const exact = [
        [/モールモッド|ラービット|孤月|山狗の爪|瞬歩斬り|大蛇の牙|固体斬撃/, 220],
        [/旋空|連続引っ掻き|双尾突き/, 290],
        [/ダッシュ突進/, 650],
        [/黒い霧/, 620],
        [/羽ばたき/, 540],
        [/闇のブレス/, 720],
        [/白狐・斬|転移斬り/, 620],
        [/時計輪剣|毒ガス|円軌道刃/, 620],
        [/妖尾狙撃/, 860],
        [/空中妖光レーザー/, 760],
        [/落星火/, 820],
        [/極炎ブレス/, 880],
        [/風刃/, 900],
        [/錨印|鎖印|弾印/, 720],
        [/アレクトール/, 680],
        [/イルガー爆撃/, 760],
        [/合成弾|アステロイド/, 680],
        [/メテオラ/, 620],
        [/イーグレット/, 1000],
        [/アイビス/, 900],
        [/鉛弾/, 820],
      ];
      for (const [pattern, range] of exact) if (pattern.test(name)) return range;
      if (key === 'egret') return 1000;
      if (key === 'ibis') return 900;
      if (key === 'meteor') return 620;
      if (key === 'asteroid') return 680;
      return ({
        marmod: 220, rabbit: 230, ilgar: 760,
        skeletonAttacker: 290, skeletonShooter: 680, skeletonSniper: 1000,
        yamagu: 650, yagarasu: 720, whitefox: 620, nekomata: 860, orochi: 880,
        fujin: 900, seals: 720, alektor: 680, borboros: 260, organon: 620,
      })[type] || 680;
    }

    canDefenseEnemyAttackPoint(enemy, x, y, maxRange = null, padding = 4) {
      if (!enemy || !Number.isFinite(x) || !Number.isFinite(y)) return false;
      const range = Number.isFinite(maxRange) ? maxRange : this.getDefenseAttackMaxRange(enemy);
      if (Math.hypot(x - enemy.x, y - enemy.y) > range + (enemy.radius || 0)) return false;
      return !this.findBlockingWall(enemy.x, enemy.y, x, y, Math.max(2, padding));
    }

    canDefenseEnemyAttackTarget(enemy, target, maxRange = null, padding = 4) {
      if (!enemy || !target || target.dead || target.hp === 0) return false;
      const range = Number.isFinite(maxRange) ? maxRange : this.getDefenseAttackMaxRange(enemy);
      return this.canDefenseEnemyAttackPoint(enemy, target.x, target.y, range + (target.radius || 0), padding);
    }

    canDefenseEnemyCreateRemoteEffect(owner, x, y, name = '', sourceKey = '') {
      if (!owner?.isDefenseEnemy && !owner?.playableDefenseType) return true;
      const range = this.getDefenseAttackMaxRange(owner, name, sourceKey);
      return this.canDefenseEnemyAttackPoint(owner, x, y, range, 4);
    }

    spawnDefenseArea(area = {}) {
      const owner = area.owner || null;
      const areaX = Number(area.x || 0), areaY = Number(area.y || 0);
      if (!this.canDefenseEnemyCreateRemoteEffect(owner, areaX, areaY, area.name || (area.kind === 'mist' ? '黒い霧' : '残火'))) return null;
      const patch = {
        id: `defense-area-${++this.defenseAreaSerial}`,
        kind: area.kind || 'fire', x: area.x || 0, y: area.y || 0,
        radius: area.radius || 90, ttl: area.ttl || 4.2, maxTtl: area.ttl || 4.2,
        damage: area.damage || 12, interval: area.interval || .45, tick: 0,
        owner: area.owner || null, hitsFlag: Boolean(area.hitsFlag),
        name: area.name || (area.kind === 'mist' ? '黒い霧' : '残火'),
        vx: area.vx || 0, vy: area.vy || 0,
      };
      this.defenseAreas.push(patch);
      return patch;
    }

    updateDefenseAreas(dt) {
      if (!this.isDefenseMode && !this.isExtraMode) return;
      for (let i = this.defenseAreas.length - 1; i >= 0; i--) {
        const area = this.defenseAreas[i];
        area.ttl -= dt; area.tick -= dt;
        area.x += (area.vx || 0) * dt;
        area.y += (area.vy || 0) * dt;
        area.vx *= Math.max(0, 1 - dt * .8);
        area.vy *= Math.max(0, 1 - dt * .8);
        if (area.tick <= 0) {
          area.tick = area.interval || .45;
          for (const target of this.players.filter((player) => !player.dead && (!area.owner || this.canDamage(area.owner, player)))) {
            if (Math.hypot(target.x - area.x, target.y - area.y) > area.radius + target.radius) continue;
            if (this.findBlockingWall(area.x, area.y, target.x, target.y, 3)) continue;
            if (area.kind === 'mist') {
              this.damagePlayer(target, area.damage, area.owner, { x: area.x, y: area.y, type: 'poison', name: area.name, sourceKey: 'hyakkiMist' });
              target.defensePoisonTimer = Math.max(target.defensePoisonTimer || 0, 2.8);
            } else {
              this.damagePlayer(target, area.damage, area.owner, { x: area.x, y: area.y, type: 'fire', name: area.name, sourceKey: 'hyakkiFire', shieldPierce: false });
            }
          }
          if (area.hitsFlag && this.defenseFlag && Math.hypot(this.defenseFlag.x - area.x, this.defenseFlag.y - area.y) <= area.radius + this.defenseFlag.radius
            && !this.findBlockingWall(area.x, area.y, this.defenseFlag.x, this.defenseFlag.y, 3)) {
            const flagAmount=area.damage*.42;
            const synthetic={type:'circle',x:area.x,y:area.y,radius:area.radius,width:area.radius,originX:area.x,originY:area.y,name:area.name};
            if(!this.absorbFlagHazardWithShield(synthetic,flagAmount)) this.damageDefenseFlag(synthetic._flagGuardRemainder ?? flagAmount, area.owner, area.name, { guardChecked: true });
          }
          for (const decoy of this.beacons.filter((beacon) => beacon.defenseDecoy && beacon.hp > 0)) {
            if (Math.hypot(decoy.x - area.x, decoy.y - area.y) <= area.radius + decoy.radius
              && !this.findBlockingWall(area.x, area.y, decoy.x, decoy.y, 3)) this.damageDefenseDecoy(decoy, area.damage * .75, area.owner, area.name);
          }
        }
        if (area.ttl <= 0) this.defenseAreas.splice(i, 1);
      }
    }

    fireDefenseProjectile(enemy, target, options = {}) {
      if (!enemy || !target) return null;
      const maxRange = this.getDefenseAttackMaxRange(enemy, options.sourceName, options.sourceKey);
      if (!this.canDefenseEnemyAttackTarget(enemy, target, maxRange, 4)) return null;
      const tx = target.x + (target.vx || 0) * (options.leadTime || .18);
      const ty = target.y + (target.vy || 0) * (options.leadTime || .18);
      const angle = Math.atan2(ty - enemy.y, tx - enemy.x) + Number(options.angleOffset || 0);
      enemy.aim = angle;
      const projectile = this.spawnProjectile(enemy, 'main', {
        angle,
        speed: options.speed || 700,
        damage: options.damage || 18,
        radius: options.radius || 5,
        life: options.life || 1.6,
        color: options.color || '#ffffff',
        explosive: Boolean(options.explosive || options.explosionRadius || options.sourceKey === 'meteor'),
        explosionRadius: options.explosionRadius || 80,
        homing: options.homing || 0,
        targetId: options.targetId || target.id || null,
        penetration: options.penetration || 0,
        trail: Boolean(options.trail),
        shieldPierce: Boolean(options.shieldPierce),
        lead: Boolean(options.lead),
        leadWeight: options.leadWeight || 1,
        sourceKey: options.sourceKey || 'asteroid',
        sourceName: options.sourceName || '射撃',
      });
      if (projectile && ['asteroid', 'meteor', 'egret', 'ibis'].includes(projectile.sourceKey)) {
        this.effects.push({ type: 'muzzle', x: enemy.x, y: enemy.y, angle, ttl: projectile.sourceKey === 'ibis' ? .16 : .12, maxTtl: projectile.sourceKey === 'ibis' ? .16 : .12 });
      }
      return projectile;
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
        if (this.mapId === 'underground' && !this.isUndergroundSafePoint(point.x, point.y, point.radius)) continue;
        if (this.walls.some((wall) => wall.hp > 0 && !wall.nonBlocking && circleRectOverlap(point, wall))) continue;
        return point;
      }
      return this.randomOpenPoint(null);
    }

    createDefenseEnemy(type, index = 0, total = 1) {
      const tier = this.defenseTier;
      const hpScale = .76 + tier * .17;
      const damageScale = .70 + tier * .105;
      const speedScale = 1 + Math.min(.22, tier * .035);
      const definitions = {
        marmod: { name: 'モールモッド', hp: 112, speed: 184, radius: 24, damage: 16, color: '#c8c9c7', archetype: '戦闘用トリオン兵', resource: 4, drops: 3, score: 100 },
        ilgar: { name: 'イルガー', hp: 395, speed: 82, radius: 58, damage: 19, color: '#e2bd38', archetype: '爆撃用トリオン兵', flying: true, resource: 6, drops: 5, score: 180 },
        rabbit: { name: 'ラービット', hp: 485, speed: 114, radius: 33, damage: 25, color: '#f2f3ef', archetype: '捕獲用トリオン兵', resource: 8, drops: 5, score: 220 },
        fujin: { name: '風刃', hp: 1650, speed: 137, radius: 27, damage: 35, color: '#39d57a', archetype: 'ブラックトリガー', boss: true, resource: 28, drops: 10, score: 1000 },
        seals: { name: '印', hp: 1780, speed: 151, radius: 27, damage: 32, color: '#d7d7df', archetype: 'ブラックトリガー', boss: true, resource: 28, drops: 10, score: 1000 },
        alektor: { name: 'アレクトール', hp: 1920, speed: 116, radius: 29, damage: 29, color: '#b4e2a0', archetype: 'ブラックトリガー', boss: true, resource: 28, drops: 10, score: 1000 },
        borboros: { name: 'ボルボロス', hp: 1840, speed: 139, radius: 29, damage: 33, color: '#a37ad7', archetype: 'ブラックトリガー', boss: true, resource: 28, drops: 10, score: 1000 },
        organon: { name: 'オルガノン', hp: 2150, speed: 101, radius: 29, damage: 39, color: '#d3c9a8', archetype: 'ブラックトリガー', boss: true, resource: 28, drops: 10, score: 1200 },
        skeletonAttacker: { name: '骸骨アタッカー', hp: 118, speed: 168, radius: 18, damage: 18, color: '#d9ddd8', accent: '#c84f4f', archetype: '百鬼夜行', faction: 'hyakki', role: 'attacker', resource: 4, drops: 3, score: 115 },
        skeletonShooter: { name: '骸骨シューター', hp: 98, speed: 146, radius: 18, damage: 17, color: '#dbe1dd', accent: '#4ea3dc', archetype: '百鬼夜行', faction: 'hyakki', role: 'shooter', resource: 4, drops: 3, score: 115 },
        skeletonSniper: { name: '骸骨スナイパー', hp: 92, speed: 136, radius: 18, damage: 21, color: '#dfe4da', accent: '#74bf7a', archetype: '百鬼夜行', faction: 'hyakki', role: 'sniper', resource: 5, drops: 3, score: 130 },
        yamagu: { name: '山狗', hp: 2050, speed: 124, radius: 56, damage: 31, color: '#d9b274', accent: '#9e4735', archetype: '百鬼夜行', faction: 'hyakki', boss: true, role: 'boss', resource: 28, drops: 10, score: 1000 },
        yagarasu: { name: '夜鴉', hp: 2140, speed: 142, radius: 58, damage: 28, color: '#24272c', accent: '#8b8f98', archetype: '百鬼夜行', faction: 'hyakki', boss: true, flying: true, role: 'boss', resource: 28, drops: 10, score: 1000 },
        whitefox: { name: '白狐', hp: 2230, speed: 152, radius: 55, damage: 30, color: '#eef2f7', accent: '#8ed5ff', archetype: '百鬼夜行', faction: 'hyakki', boss: true, role: 'boss', resource: 28, drops: 10, score: 1050 },
        nekomata: { name: '猫又', hp: 2360, speed: 146, radius: 58, damage: 32, color: '#676a77', accent: '#af72ff', archetype: '百鬼夜行', faction: 'hyakki', boss: true, role: 'boss', resource: 28, drops: 10, score: 1100 },
        orochi: { name: '大蛇', hp: 3560, speed: 86, radius: 86, damage: 36, color: '#658a46', accent: '#ff8e3c', archetype: '百鬼夜行', faction: 'hyakki', boss: true, role: 'boss', resource: 36, drops: 14, score: 1600, reflectThreshold: 24 },
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
        appearance: { bodyColor: def.color, accentColor: def.accent || '#ffffff' },
        squadName: def.faction === 'hyakki' ? '百鬼夜行' : '近界侵攻群',
        emblemPixels: emblemToString(makeEmblemPreset(def.faction === 'hyakki' ? 'wing' : 'fang')),
      });
      const point = this.getDefenseSpawnPoint(index, total);
      enemy.x = point.x; enemy.y = point.y;
      enemy.isDefenseEnemy = true;
      enemy.defenseType = type;
      enemy.isDefenseBoss = Boolean(def.boss);
      enemy.defenseFaction = def.faction || 'bt';
      enemy.defenseCore = def.faction === 'hyakki' || def.boss ? null : {
        angle: type === 'ilgar' ? Math.PI : type === 'rabbit' ? 0 : Math.PI * .5,
        distance: type === 'ilgar' ? 34 : type === 'rabbit' ? 12 : 8,
        radius: type === 'ilgar' ? 11 : type === 'rabbit' ? 9 : 7,
      };
      enemy.maxHp = Math.round(def.hp * hpScale * (def.boss ? 1 + tier * .07 : 1) * 2);
      enemy.hp = enemy.maxHp;
      enemy.maxTrion = 0; enemy.trion = 0; enemy.regen = 0;
      enemy.speed = def.speed * speedScale;
      enemy.radius = def.radius;
      enemy.invulnTimer = .65;
      enemy.flying = Boolean(def.flying);
      enemy.resourceReward = def.resource;
      enemy.dropCount = def.drops;
      enemy.reflectThreshold = def.reflectThreshold || 0;
      enemy.defenseAI = {
        attackCooldown: rand(.5, 1.4), specialCooldown: rand(1.5, 3.2), phaseTimer: 3.5,
        phase: type === 'borboros' ? 'solid' : 'normal', selfDestruct: false, selfDestructTimer: 0,
        rearBurstCooldown: 0, shieldTimer: 0, sealCount: 0, damage: def.damage * damageScale,
        objectiveMode: (def.boss || index % 3 === 0 || (type === 'ilgar' && index % 2 === 0)) ? 'flag' : (Math.random() < .58 ? 'flag' : 'defender'),
        objectiveTimer: rand(2.4, 5.2), flagAttacks: 0,
        role: def.role || null, chameleonTimer: 0, castTimer: 0, castMode: null,
        trailTimer: .4, bodyHistory: [], bodySegments: [], enraged: false, ultimateUsed: false,
        borborosCores: [], coreCooldown: 0, parryTimer: 0, parryCooldown: 0,
      };
      if (type === 'borboros') this.deployBorborosCores(enemy, true);
      enemy.respawnTimer = Infinity;
      enemy.scoreValue = def.score || (def.boss ? 1000 : 100);
      this.players.push(enemy);
      return enemy;
    }

    startDefenseRound() {
      this.defenseRound += 1;
      this.defenseTier = Math.floor(this.defenseRound / 5);
      if (this.isExtraMode && this.config.extraDefenseEnemyType && this.config.extraDefenseEnemyType !== 'agent') { const fixed=this.createDefenseEnemy(this.config.extraDefenseEnemyType,0,1); if(fixed)fixed.extraFixedInvader=true; }
      const isBossRound = this.defenseRound % 5 === 0;
      if (this.isHyakkiDefense()) {
        if (isBossRound) {
          const bosses = ['yamagu', 'yagarasu', 'whitefox', 'nekomata', 'orochi'];
          const type = bosses[(Math.floor(this.defenseRound / 5) - 1) % bosses.length];
          const boss = this.createDefenseEnemy(type, 0, 1);
          this.showCenterMessage(`ROUND ${this.defenseRound}`, `百鬼夜行：${boss.name}`, 2.8);
          this.logEvent('defense_boss_round', `Round ${this.defenseRound} / 百鬼夜行 ${boss.name}`);
        } else {
          const teamSize = this.config.teamSize || 3;
          const count = Math.min(16, 2 + teamSize + Math.floor(this.defenseRound * .68));
          for (let i = 0; i < count; i++) {
            const roll = Math.random();
            let type = 'skeletonAttacker';
            if (this.defenseRound > 15) type = roll > .72 ? 'skeletonSniper' : roll > .34 ? 'skeletonShooter' : 'skeletonAttacker';
            else if (this.defenseRound > 8) type = roll > .78 ? 'skeletonSniper' : roll > .42 ? 'skeletonShooter' : 'skeletonAttacker';
            else type = roll > .65 ? 'skeletonShooter' : 'skeletonAttacker';
            this.createDefenseEnemy(type, i, count);
          }
          this.showCenterMessage(`ROUND ${this.defenseRound}`, `百鬼夜行 ${count}体`, 2.1);
          this.logEvent('defense_round', `Round ${this.defenseRound} / 百鬼夜行 ${count}`);
        }
      } else if (isBossRound) {
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
      this.updateDefenseAreas(dt);
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
        if (this.defenseRound >= 25) { this.completeDefenseMatch(); return; }
        this.defenseWaveActive = false;
        this.defenseRoundTimer = 5.2;
        const defenders = this.players.filter((player) => !player.isDefenseEnemy && !player.dead);
        defenders.forEach((player) => { player.trion = Math.min(player.maxTrion, player.trion + player.maxTrion * .24); });
        if (this.defenseFlag) this.defenseFlag.hp = Math.min(this.defenseFlag.maxHp, this.defenseFlag.hp + this.defenseFlag.maxHp * .16);
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
      if (this.elapsed - flag.lastDamageAt > 5.8 && flag.hp < flag.maxHp) {
        const passive = 6.5 + flag.maxHp * .00135;
        flag.hp = Math.min(flag.maxHp, flag.hp + passive * dt);
      }
      if (this.actionConsume('flagRepair')) this.flagChannelTimer = 1.15;
      this.flagChannelTimer = Math.max(0, this.flagChannelTimer - dt);
      const defenders = this.players.filter((player) => !player.isDefenseEnemy && !player.dead);
      for (const player of defenders) {
        const near = Math.hypot(player.x - flag.x, player.y - flag.y) <= flag.radius + player.radius + 55;
        const hostileNear = this.players.some((enemy) => enemy.isDefenseEnemy && !enemy.dead && Math.hypot(enemy.x - flag.x, enemy.y - flag.y) < 300);
        let channel = false;
        if (player.human) channel = near && (this.actionDown('flagRepair') || this.flagChannelTimer > 0);
        else {
          const nearbyAllies = defenders.filter((ally) => !ally.dead && Math.hypot(ally.x - flag.x, ally.y - flag.y) < 250).length;
          const emergencyRepair = flag.hp < flag.maxHp * .35 && nearbyAllies >= 2;
          channel = near && (!hostileNear || emergencyRepair) && flag.hp < flag.maxHp * .86 && player.trion > player.maxTrion * .34;
        }
        if (!channel || player.trion <= 2 || flag.hp >= flag.maxHp) continue;
        const cost = Math.min(player.trion, (player.human ? 17 : 8.5) * dt);
        const healing = cost * (player.human ? 2.9 : 3.05);
        player.trion -= cost;
        player.metrics.trionSpent += cost;
        flag.hp = Math.min(flag.maxHp, flag.hp + healing);
        flag.repaired += healing;
        this.effects.push({ type: 'flagHeal', x: flag.x + rand(-20, 20), y: flag.y + rand(-20, 20), ttl: .35, maxTtl: .35 });
      }
    }

    damageDefenseFlag(amount, source = null, name = '敵攻撃', options = {}) {
      const flag = this.defenseFlag;
      if (!this.isDefenseMode || !flag || flag.hp <= 0 || amount <= 0) return;
      if (!options.guardChecked && source && Number.isFinite(source.x) && Number.isFinite(source.y)) {
        const directHazard = {
          type: 'line', x: source.x, y: source.y, x2: flag.x, y2: flag.y,
          originX: source.x, originY: source.y,
          width: Math.max(22, (source.radius || 18) + 10), owner: source, name
        };
        if (this.absorbFlagHazardWithShield(directHazard, amount)) return;
        amount = directHazard._flagGuardRemainder ?? amount;
      }
      const mitigated = amount * (1 - clamp(flag.armor || 0, 0, .55));
      flag.hp = Math.max(0, flag.hp - mitigated);
      flag.lastDamageAt = this.elapsed;
      if (source?.defenseAI) { source.defenseAI.flagAttacks = (source.defenseAI.flagAttacks || 0) + 1; source.defenseAI.assaultClock=0; }
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
      $('#modeLabel').textContent = `防衛戦 / ${this.getDefenseScenarioLabel()}`;
      $('#timerLabel').textContent = this.defenseWaveActive ? `R${Math.max(1, this.defenseRound)} ${formatTime(this.elapsed)}` : `NEXT ${Math.max(0, Math.ceil(this.defenseRoundTimer))} / ${formatTime(this.elapsed)}`;
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
        if (this.mapId === 'underground' && !this.isUndergroundSafePoint(point.x, point.y, 52)) continue;
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
      const enemiesNear = this.players.filter((enemy) => enemy.isDefenseEnemy && !enemy.dead && Math.hypot(enemy.x - this.defenseFlag.x, enemy.y - this.defenseFlag.y) < 520);
      const flagRatio=this.defenseFlag.hp/Math.max(1,this.defenseFlag.maxHp);
      if (enemiesNear.length && flagRatio>.62) return;
      const priorities=flagRatio<.48 ? [['barrier',4],['turret',3],['decoy',2],['trap',3]]
        : enemiesNear.length ? [['turret',3],['barrier',4],['trap',3],['decoy',1]]
        : [['barrier',4],['trap',3],['turret',3],['decoy',2]];
      const desired = priorities.find(([type, wanted]) => this.getDefenseBuildActiveCount(type) < wanted && (this.defenseBuildCooldowns[type] || 0) <= 0);
      if (!desired) return;
      const builder = this.players.filter((unit) => !unit.isDefenseEnemy && !unit.dead && !unit.human).sort((a, b) => Math.hypot(a.x - this.defenseFlag.x, a.y - this.defenseFlag.y) - Math.hypot(b.x - this.defenseFlag.x, b.y - this.defenseFlag.y))[0] || null;
      this.deployDefenseBuild(desired[0], builder, 0, { silent: true });
    }

    selectDefenseObjective(enemy, defenders, flag) {
      const ai = enemy.defenseAI || (enemy.defenseAI = {});
      const nearest = defenders.length ? [...defenders].sort((a, b) => dist2(enemy, a) - dist2(enemy, b))[0] : null;
      const threatTarget = defenders.map((unit) => ({ unit, threat:this.getThreat(enemy, unit) })).sort((a,b) => b.threat - a.threat)[0];
      if (threatTarget?.threat >= 12 && Math.hypot(threatTarget.unit.x-enemy.x,threatTarget.unit.y-enemy.y)<310) { ai.objectiveMode='defender'; ai.objectiveTimer=Math.max(ai.objectiveTimer||0,1.4); return threatTarget.unit; }
      const decoys = this.beacons.filter((beacon) => beacon.defenseDecoy && beacon.hp > 0 && beacon.ttl > 0);
      const nearestDecoy = decoys.length ? [...decoys].sort((a, b) => dist2(enemy, a) - dist2(enemy, b))[0] : null;
      if (!flag) return nearestDecoy || nearest;
      if (!nearest && !nearestDecoy) return flag;
      const dFlag = Math.hypot(flag.x - enemy.x, flag.y - enemy.y);
      const dNearest = nearest ? Math.hypot(nearest.x - enemy.x, nearest.y - enemy.y) : Infinity;
      const dDecoy = nearestDecoy ? Math.hypot(nearestDecoy.x - enemy.x, nearestDecoy.y - enemy.y) : Infinity;
      const recentlyHit = this.elapsed - (enemy.lastDamageAt || -999) < 2.25;
      const threatRadius = enemy.defenseType === 'rabbit' ? 205 : enemy.defenseType === 'marmod' ? 170 : 225;
      if (recentlyHit && dNearest < threatRadius) { ai.objectiveMode = 'defender'; ai.objectiveTimer = Math.max(ai.objectiveTimer || 0, .9); return nearest; }
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
        const baseBias = enemy.defenseType === 'ilgar' ? .82
          : enemy.defenseType === 'marmod' ? .76
          : enemy.defenseType === 'rabbit' ? .62
          : enemy.isDefenseBoss ? .72 : .68;
        const damagedFlagBonus = flag.hp < flag.maxHp * .45 ? .1 : 0;
        ai.objectiveMode = Math.random() < Math.min(.82, baseBias + damagedFlagBonus) ? 'flag' : 'defender';
        ai.objectiveTimer = rand(2.8, 5.1);
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
      this.updateThreatAwareness(enemy, dt);
      const ai = enemy.defenseAI;
      ai.attackCooldown -= dt; ai.specialCooldown -= dt; ai.phaseTimer -= dt;
      ai.objectiveTimer = (ai.objectiveTimer || 0) - dt;
      ai.assaultClock = (ai.assaultClock || 0) + dt;
      if (ai.assaultClock > 6.5 && this.defenseFlag) { ai.objectiveMode='flag'; ai.objectiveTimer=Math.max(ai.objectiveTimer,6.2); ai.assaultClock=0; }
      ai.rearBurstCooldown = Math.max(0, ai.rearBurstCooldown - dt);
      ai.shieldTimer = Math.max(0, ai.shieldTimer - dt);
      ai.castTimer = Math.max(0, (ai.castTimer || 0) - dt);
      ai.chameleonTimer = Math.max(0, (ai.chameleonTimer || 0) - dt);
      ai.actionTimer = Math.max(0, (ai.actionTimer || 0) - dt);
      const defenseParryWasActive = (ai.parryTimer || 0) > 0;
      ai.parryTimer = Math.max(0, (ai.parryTimer || 0) - dt);
      if (defenseParryWasActive && ai.parryTimer <= 0 && enemy.masteryParryAttempt) { this.adjustMastery(enemy, -.12, 'いなし失敗'); enemy.masteryParryAttempt = false; }
      ai.parryCooldown = Math.max(0, (ai.parryCooldown || 0) - dt);
      ai.coreCooldown = Math.max(0, (ai.coreCooldown || 0) - dt);
      if (ai.actionTimer <= 0) ai.action = '';
      const defenseTier = AI_TIER_PROFILES[enemy.aiTier] || AI_TIER_PROFILES.middle;
      const defenseBase = AI_DIFFICULTIES[this.config.difficulty] || AI_DIFFICULTIES.normal;
      const defensePersonality = enemy.aiPersonality || {calmness:.5,aggression:.5};
      const defenseProfile = { ...defenseBase, calmness:defensePersonality.calmness, aggression:defensePersonality.aggression, guardSkill:clamp((defenseBase.guardSkill||0)*(defenseTier.defense||1),0,1), parrySkill:clamp((defenseBase.parrySkill||0)*(defenseTier.defense||1),0,1), dodgeSkill:clamp((defenseBase.dodgeSkill||0)*(defenseTier.defense||1),0,1) };
      this.aiTryDefensiveRead(enemy, this.getProjectileThreatInfo(enemy), defenseProfile, defenseTier, dt);
      if (enemy.defenseType === 'borboros' && (!ai.borborosCores || !ai.borborosCores.length || ai.coreCooldown <= 0)) this.deployBorborosCores(enemy, !ai.borborosCores?.length);
      const defenders = this.players.filter((player) => !player.isDefenseEnemy && !player.dead);
      const nearest = defenders.length ? [...defenders].sort((a, b) => dist2(enemy, a) - dist2(enemy, b))[0] : null;
      const flag = this.defenseFlag;
      const objective = this.selectDefenseObjective(enemy, defenders, flag);
      const type = enemy.defenseType;
      if (['skeletonAttacker', 'skeletonShooter', 'skeletonSniper', 'yamagu', 'yagarasu', 'whitefox', 'nekomata', 'orochi'].includes(type)) {
        this.updateHyakkiEnemyAI(enemy, dt, objective, nearest, flag);
        return;
      }
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
        } else if (ai.attackCooldown <= 0 && target && this.canDefenseEnemyAttackTarget(enemy, target, 760, 4)) {
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
        if (ai.attackCooldown <= 0 && this.canDefenseEnemyAttackTarget(enemy, target, 220, 4) && d < (target === flag ? 225 : 72)) {
          if (target === flag && this.canDefenseEnemyAttackTarget(enemy, flag, 220, 4)) this.damageDefenseFlag(ai.damage, enemy, 'モールモッドのブレード');
          else if (target.defenseDecoy) this.damageDefenseDecoy(target, ai.damage * 1.2, enemy, 'モールモッドのブレード');
          else this.damagePlayer(target, ai.damage, enemy, { x: enemy.x, y: enemy.y, type: 'melee', name: 'モールモッド・ブレード', sourceKey: 'marmodBlade' });
          ai.attackCooldown = .78;
        }
        return;
      }
      if (type === 'rabbit') {
        const target = objective || flag;
        const d = this.moveDefenseEnemy(enemy, target, dt, .92);
        if (ai.attackCooldown <= 0 && this.canDefenseEnemyAttackTarget(enemy, target, 230, 4) && d < (target === flag ? 240 : 86)) {
          if (target === flag && this.canDefenseEnemyAttackTarget(enemy, flag, 230, 4)) this.damageDefenseFlag(ai.damage * .8, enemy, 'ラービット打撃');
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

    updateHyakkiEnemyAI(enemy, dt, objective, nearest, flag) {
      const ai = enemy.defenseAI || (enemy.defenseAI = {});
      const type = enemy.defenseType;
      const target = objective || nearest || flag;
      const targetAttackable = target && this.canDefenseEnemyAttackTarget(enemy, target, this.getDefenseAttackMaxRange(enemy), 4);
      const round = this.defenseRound;
      enemy.toggles.chameleon = ai.chameleonTimer > 0;
      if (['yamagu', 'yagarasu', 'whitefox', 'nekomata', 'orochi'].includes(type)) {
        this.updateHyakkiBossAI(enemy, dt, target, nearest, flag);
        return;
      }
      if (this.tryDefenseEnemyAttackBarrier(enemy, target || flag, dt) && type !== 'skeletonSniper') return;
      if (type === 'skeletonAttacker') {
        const d = this.moveDefenseEnemy(enemy, target, dt, ai.chameleonTimer > 0 ? 1.18 : 1.02);
        if (round > 20 && ai.specialCooldown <= 0 && ai.chameleonTimer <= 0 && nearest && d > 170 && d < 520) {
          ai.chameleonTimer = 2.7; ai.specialCooldown = 6.2;
        }
        if (round > 10 && ai.specialCooldown <= 0 && targetAttackable && d < 240 && d > 70) {
          ai.action = 'senku'; ai.actionTimer = .34; ai.actionMax = .34;
          this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: target.x, y2: target.y, width: 38, delay: .32, damage: ai.damage * 1.45, owner: enemy, name: '旋空', hitsFlag: target === flag, color: '#d7f0ff' });
          ai.specialCooldown = 4.4; ai.attackCooldown = .95;
        } else if (ai.attackCooldown <= 0 && targetAttackable && d < (target === flag ? 175 : 78)) {
          ai.action = 'slash'; ai.actionTimer = .22; ai.actionMax = .22;
          this.effects.push({ type: 'slash', x: enemy.x, y: enemy.y, range: 44, angle: enemy.aim, arc: 1.02, ttl: .14, maxTtl: .14, color: '#e6f7ff' });
          if (target === flag && this.canDefenseEnemyAttackTarget(enemy, flag, 220, 4)) this.damageDefenseFlag(ai.damage * .95, enemy, '孤月');
          else if (target.defenseDecoy) this.damageDefenseDecoy(target, ai.damage, enemy, '孤月');
          else this.damagePlayer(target, ai.damage, enemy, { x: enemy.x, y: enemy.y, type: 'melee', name: '孤月', sourceKey: 'kogetsu' });
          ai.attackCooldown = .82;
        }
        return;
      }
      if (type === 'skeletonShooter') {
        const d = target ? Math.hypot(target.x - enemy.x, target.y - enemy.y) : Infinity;
        this.moveDefenseEnemy(enemy, target, dt, d > 390 ? .82 : d < 250 ? -.38 : .15);
        if (round > 20 && ai.specialCooldown <= 0 && targetAttackable) {
          ai.action = 'composite'; ai.actionTimer = .34; ai.actionMax = .34;
          if (target === flag) this.queueDefenseHazard({ type: 'circle', x: flag.x, y: flag.y, radius: 110, delay: .65, damage: ai.damage * 1.05, owner: enemy, name: '合成弾', hitsFlag: true, color: '#d28dff' });
          else {
            this.fireDefenseProjectile(enemy, target, { sourceKey: 'asteroid', sourceName: '合成弾', speed: 760, damage: ai.damage * .82, radius: 6, explosive: true, explosionRadius: 92, homing: 1.15, targetId: target.id, color: '#d28dff' });
            this.fireDefenseProjectile(enemy, target, { sourceKey: 'asteroid', sourceName: '合成弾', speed: 720, damage: ai.damage * .66, radius: 5, homing: 1.45, targetId: target.id, color: '#7dffb8' });
          }
          ai.specialCooldown = 5.4;
        } else if (round > 10 && ai.specialCooldown <= 0 && target && this.canDefenseEnemyAttackTarget(enemy, target, 620, 4)) {
          ai.action = 'meteor'; ai.actionTimer = .34; ai.actionMax = .34;
          if (target === flag) this.queueDefenseHazard({ type: 'circle', x: flag.x, y: flag.y, radius: 102, delay: .75, damage: ai.damage, owner: enemy, name: 'メテオラ', hitsFlag: true, color: '#ffb95d' });
          else this.fireDefenseProjectile(enemy, target, { sourceKey: 'meteor', sourceName: 'メテオラ', speed: 620, damage: ai.damage, radius: 8, explosive: true, explosionRadius: 108, color: '#ffb95d', life: 1.8 });
          ai.specialCooldown = 5.8;
        }
        if (ai.attackCooldown <= 0 && targetAttackable) {
          ai.action = 'shoot'; ai.actionTimer = .22; ai.actionMax = .22;
          if (target === flag) this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: flag.x, y2: flag.y, width: 24, delay: .24, damage: ai.damage * .88, owner: enemy, name: 'アステロイド', hitsFlag: true, color: '#72e8ff' });
          else this.fireDefenseProjectile(enemy, target, { sourceKey: 'asteroid', sourceName: 'アステロイド', speed: 760, damage: ai.damage * .9, radius: 5, color: '#72e8ff' });
          ai.attackCooldown = 1.08;
        }
        return;
      }
      if (type === 'skeletonSniper') {
        const d = target ? Math.hypot(target.x - enemy.x, target.y - enemy.y) : Infinity;
        this.moveDefenseEnemy(enemy, target, dt, d > 760 ? .72 : d < 500 ? -.34 : .05);
        if (round > 20 && ai.specialCooldown <= 0 && nearest && this.canDefenseEnemyAttackTarget(enemy, nearest, this.getDefenseAttackMaxRange(enemy, '鉛弾', 'egret'), 4)) {
          ai.action = 'lead'; ai.actionTimer = .3; ai.actionMax = .3;
          this.fireDefenseProjectile(enemy, nearest, { sourceKey: 'egret', sourceName: '鉛弾', speed: 840, damage: 0, radius: 5, trail: true, shieldPierce: true, lead: true, leadWeight: 3 + Math.min(2, this.defenseTier), color: '#c6e0ff' });
          ai.specialCooldown = 6.2;
        } else if (round > 10 && ai.specialCooldown <= 0 && target && this.canDefenseEnemyAttackTarget(enemy, target, 900, 4)) {
          ai.action = 'ibis'; ai.actionTimer = .4; ai.actionMax = .4;
          if (target === flag) this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: flag.x, y2: flag.y, width: 28, delay: .42, damage: ai.damage * 1.72, owner: enemy, name: 'アイビス', hitsFlag: true, color: '#ffd1a6' });
          else this.fireDefenseProjectile(enemy, target, { sourceKey: 'ibis', sourceName: 'アイビス', speed: 1120, damage: ai.damage * 1.75, radius: 8, trail: true, penetration: 2, color: '#ffd1a6' });
          ai.specialCooldown = 5.2;
        }
        if (ai.attackCooldown <= 0 && targetAttackable) {
          ai.action = 'shoot'; ai.actionTimer = .26; ai.actionMax = .26;
          if (target === flag) this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: flag.x, y2: flag.y, width: 18, delay: .2, damage: ai.damage * 1.05, owner: enemy, name: 'イーグレット', hitsFlag: true, color: '#f2f8ff' });
          else this.fireDefenseProjectile(enemy, target, { sourceKey: 'egret', sourceName: 'イーグレット', speed: 1380, damage: ai.damage * 1.05, radius: 4, trail: true, penetration: 1, color: '#f2f8ff' });
          ai.attackCooldown = 1.55;
        }
      }
    }

    updateOrochiBodyPose(enemy) {
      if (!enemy || enemy.defenseType !== 'orochi') return;
      const ai = enemy.defenseAI || (enemy.defenseAI = {});
      const segmentCount = 20;
      const spacing = 34;
      const angle = Number.isFinite(enemy.aim) ? enemy.aim : 0;
      let path = ai.bodyPath;
      if (!Array.isArray(path) || path.length < 2) {
        path = [];
        for (let i = 0; i <= segmentCount; i++) {
          const wave = Math.sin(i * .62) * Math.min(34, i * 2.2);
          path.push({
            x: enemy.x - Math.cos(angle) * spacing * i + Math.cos(angle + Math.PI / 2) * wave,
            y: enemy.y - Math.sin(angle) * spacing * i + Math.sin(angle + Math.PI / 2) * wave,
          });
        }
        ai.bodyPath = path;
      }
      path[0] = { x: enemy.x, y: enemy.y };
      for (let i = 1; i <= segmentCount; i++) {
        const prev = path[i - 1];
        const current = path[i] || {
          x: prev.x - Math.cos(angle) * spacing,
          y: prev.y - Math.sin(angle) * spacing,
        };
        let dx = current.x - prev.x;
        let dy = current.y - prev.y;
        let distance = Math.hypot(dx, dy);
        if (distance < .001) {
          dx = -Math.cos(angle); dy = -Math.sin(angle); distance = 1;
        }
        const curve = Math.sin(this.elapsed * 2.2 - i * .62) * Math.min(4.5, i * .22);
        const nx = dx / distance, ny = dy / distance;
        path[i] = {
          x: prev.x + nx * spacing - ny * curve,
          y: prev.y + ny * spacing + nx * curve,
        };
      }
      path.length = segmentCount + 1;
      ai.bodySegments = [];
      for (let i = 1; i <= segmentCount; i++) {
        const current = path[i];
        const ahead = path[Math.max(0, i - 1)];
        const behind = path[Math.min(segmentCount, i + 1)] || current;
        const taper = i / segmentCount;
        const radius = Math.max(16, 50 * (1 - taper * .7));
        ai.bodySegments.push({
          x: current.x,
          y: current.y,
          radius,
          angle: Math.atan2(ahead.y - behind.y, ahead.x - behind.x),
          index: i,
        });
      }
    }

    updateHyakkiBossAI(enemy, dt, target, nearest, flag) {
      const ai = enemy.defenseAI || (enemy.defenseAI = {});
      const type = enemy.defenseType;
      if (!target) target = nearest || flag;
      const targetAttackable = target && this.canDefenseEnemyAttackTarget(enemy, target, this.getDefenseAttackMaxRange(enemy), 4);
      ai.extraActionCooldown = Math.max(0,(ai.extraActionCooldown||0)-dt);
      if (target && ai.extraActionCooldown <= 0 && Math.random() < .014) { const hand=Math.random()<.72?'main':'sub';const index=irand(0,3);if(this.usePlayableDefenseAction(enemy,hand,index,target,{ai:true})){ai.extraActionCooldown=rand(3.4,6.5);return;} }
      if (type === 'yamagu') {
        const d = this.moveDefenseEnemy(enemy, target, dt, ai.castMode === 'dash' ? 1.45 : .96);
        if (ai.attackCooldown <= 0 && targetAttackable && d < (target === flag ? 190 : 95)) {
          ai.action = 'claw'; ai.actionTimer = .22; ai.actionMax = .22;
          this.effects.push({ type:'yamaguClaw', x:enemy.x, y:enemy.y, angle:enemy.aim, range:118, ttl:.34, maxTtl:.34 });
          if (target === flag && this.canDefenseEnemyAttackTarget(enemy, flag, 220, 4)) this.damageDefenseFlag(ai.damage, enemy, '山狗の爪');
          else this.damagePlayer(target, ai.damage, enemy, { x: enemy.x, y: enemy.y, type: 'melee', name: '山狗の爪', sourceKey: 'yamaguClaw' });
          ai.attackCooldown = .88;
        }
        if (ai.castMode === 'sharpen' && ai.castTimer <= 0 && targetAttackable) {
          ai.action = 'claw'; ai.actionTimer = .3; ai.actionMax = .3;
          this.effects.push({ type:'yamaguClaw', x:enemy.x, y:enemy.y, angle:enemy.aim, range:138, ttl:.42, maxTtl:.42 });
          for (let i = -1; i <= 1; i++) this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: target.x + i * 30, y2: target.y + i * 16, width: 34, delay: .18 + (i + 1) * .08, damage: ai.damage * 1.2, owner: enemy, name: '連続引っ掻き', hitsFlag: target === flag, color: '#ffd5a0' });
          ai.castMode = null;
        } else if (ai.castMode === 'dash' && ai.castTimer <= 0 && targetAttackable) {
          ai.action = 'dash'; ai.actionTimer = .22; ai.actionMax = .22;
          this.effects.push({ type:'yamaguDash', x:enemy.x, y:enemy.y, x2:target.x, y2:target.y, ttl:.4, maxTtl:.4 });
          this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: target.x, y2: target.y, width: 56, delay: .12, damage: ai.damage * 1.35, owner: enemy, name: 'ダッシュ突進', hitsFlag: true, color: '#ffc46c' });
          ai.castMode = null;
        }
        if (ai.specialCooldown <= 0 && targetAttackable) {
          if (d < 240) { ai.castMode = 'sharpen'; ai.castTimer = .8; ai.action = 'sharpen'; ai.actionTimer = .8; ai.actionMax = .8; this.effects.push({ type:'yamaguSharpen', x:enemy.x, y:enemy.y, angle:enemy.aim, ttl:.8, maxTtl:.8 }); ai.specialCooldown = 5.8; }
          else if (d < 620) { ai.castMode = 'dash'; ai.castTimer = .35; ai.action = 'dash'; ai.actionTimer = .35; ai.actionMax = .35; ai.specialCooldown = 6.4; }
        }
        return;
      }
      if (type === 'yagarasu') {
        this.moveDefenseEnemy(enemy, target, dt, .78);
        if (ai.attackCooldown <= 0 && target && this.canDefenseEnemyAttackTarget(enemy, target, 620, 4)) {
          ai.action = 'mist'; ai.actionTimer = .34; ai.actionMax = .34;
          this.effects.push({ type:'yagarasuMist', x:enemy.x, y:enemy.y, x2:target === flag ? flag.x : target.x, y2:target === flag ? flag.y : target.y, ttl:.7, maxTtl:.7 });
          this.spawnDefenseArea({ kind: 'mist', x: target === flag ? flag.x + rand(-40, 40) : target.x + rand(-65, 65), y: target === flag ? flag.y + rand(-40, 40) : target.y + rand(-65, 65), radius: 118, ttl: 5.6, damage: ai.damage * .16, interval: .7, owner: enemy, name: '黒い霧', hitsFlag: target === flag });
          ai.attackCooldown = 1.45;
        }
        if (ai.specialCooldown <= 0 && targetAttackable) {
          const canFlap = this.canDefenseEnemyAttackTarget(enemy, target, 540, 4);
          const canBreath = this.canDefenseEnemyAttackTarget(enemy, target, 720, 4);
          if (canFlap && (Math.random() < .58 || !canBreath)) {
            const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
            ai.action = 'flap'; ai.actionTimer = .42; ai.actionMax = .42;
            this.effects.push({ type:'yagarasuFlap', x:enemy.x, y:enemy.y, angle, range:190, ttl:.5, maxTtl:.5 });
            ai.action='solidSlash';ai.actionTimer=.45;ai.actionMax=.45;
            this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: target.x, y2: target.y, width: 92, delay: .32, damage: ai.damage * .58, owner: enemy, name: '羽ばたき', status: 'bounce', hitsFlag: true, color: '#8a939d' });
            for (const area of this.defenseAreas.filter((patch) => patch.kind === 'mist')) { area.vx += Math.cos(angle) * 80; area.vy += Math.sin(angle) * 80; }
            ai.specialCooldown = 4.1;
          } else if (canBreath) {
            ai.action = 'breath'; ai.actionTimer = 1.02; ai.actionMax = 1.02;
            this.effects.push({ type:'yagarasuBreath', x:enemy.x, y:enemy.y, x2:target.x, y2:target.y, ttl:1.08, maxTtl:1.08 });
            this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: target.x, y2: target.y, width: 86, delay: 1.02, damage: ai.damage * 1.52, owner: enemy, name: '闇のブレス', hitsFlag: true, color: '#6c5975' });
            ai.specialCooldown = 6.5;
          }
        }
        return;
      }
      if (type === 'whitefox') {
        const whitefoxDistance = target ? Math.hypot(target.x - enemy.x, target.y - enemy.y) : Infinity;
        const d = this.moveDefenseEnemy(enemy, target, dt, whitefoxDistance > 160 ? .82 : -.08);
        if (ai.attackCooldown <= 0 && targetAttackable && d < (target === flag ? 175 : 88)) {
          ai.action = 'slowSlash'; ai.actionTimer = .34; ai.actionMax = .34;
          this.effects.push({ type:'whitefoxSlash', x:enemy.x, y:enemy.y, angle:enemy.aim, range:112, slow:true, ttl:.42, maxTtl:.42 });
          if (target === flag && this.canDefenseEnemyAttackTarget(enemy, flag, 220, 4)) this.damageDefenseFlag(ai.damage * .94, enemy, '瞬歩斬り');
          else {
            const damaged = this.damagePlayer(target, ai.damage, enemy, { x: enemy.x, y: enemy.y, type: 'melee', name: '瞬歩斬り', sourceKey: 'whitefoxSlash' });
            if (damaged) { target.slowTimer = Math.max(target.slowTimer, 3.6); target.slowFactor = Math.min(target.slowFactor, .58); }
          }
          ai.attackCooldown = .9;
        }
        if (ai.specialCooldown <= 0 && targetAttackable) {
          const visibleNearest = nearest && this.canDefenseEnemyAttackTarget(enemy, nearest, 620, 4) ? nearest : null;
          if (visibleNearest && Math.random() < .55) {
            const ox=enemy.x, oy=enemy.y;
            enemy.x = clamp(visibleNearest.x + rand(-72, 72), 60, this.world.w - 60);
            enemy.y = clamp(visibleNearest.y + rand(-72, 72), 60, this.world.h - 60);
            enemy.aim = Math.atan2(visibleNearest.y-enemy.y, visibleNearest.x-enemy.x);
            ai.action='teleport';ai.actionTimer=.38;ai.actionMax=.38;
            this.effects.push({type:'whitefoxTeleport',x:ox,y:oy,x2:enemy.x,y2:enemy.y,ttl:.42,maxTtl:.42});
            this.effects.push({type:'whitefoxSlash',x:enemy.x,y:enemy.y,angle:enemy.aim,range:125,ttl:.38,maxTtl:.38});
            this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: visibleNearest.x, y2: visibleNearest.y, width: 38, delay: .18, damage: ai.damage * 1.05, owner: enemy, name: '白狐・斬', color: '#e6f7ff' });
          } else {
            ai.castMode='clock';ai.castTimer=1.05;ai.action='clock';ai.actionTimer=1.05;ai.actionMax=1.05;
            this.effects.push({type:'whitefoxClock',x:enemy.x,y:enemy.y,radius:164,ttl:1.12,maxTtl:1.12});
            this.queueDefenseHazard({ type: 'ring', x: enemy.x, y: enemy.y, radius: 164, width: 32, delay: 1.05, damage: ai.damage * 1.58, owner: enemy, name: '時計輪剣', hitsFlag: true, color: '#d6f0ff' });
          }
          ai.specialCooldown = 5.6;
        }
        return;
      }
      if (type === 'nekomata') {
        const visibleNearest = nearest && this.canDefenseEnemyAttackTarget(enemy, nearest, 860, 4) ? nearest : null;
        const d = target ? Math.hypot(target.x - enemy.x, target.y - enemy.y) : Infinity;
        this.moveDefenseEnemy(enemy, target, dt, d > 260 ? .84 : d < 160 ? -.18 : .08);
        if (ai.attackCooldown <= 0 && targetAttackable) {
          if (d < 215) {
            ai.action='tailStrike';ai.actionTimer=.42;ai.actionMax=.42;this.effects.push({type:'nekomataTail',x:enemy.x,y:enemy.y,angle:enemy.aim,range:150,ttl:.48,maxTtl:.48});
            for (const shift of [-18, 18]) this.queueDefenseHazard({ type: 'line', x: enemy.x + shift, y: enemy.y, x2: target.x, y2: target.y, width: 24, delay: .22, damage: ai.damage * .72, owner: enemy, name: '双尾突き', hitsFlag: true, color: '#b073ff' });
          } else if (visibleNearest) {
            ai.action='snipe';ai.actionTimer=.32;ai.actionMax=.32;this.effects.push({type:'nekomataSnipe',x:enemy.x,y:enemy.y,x2:visibleNearest.x,y2:visibleNearest.y,ttl:.34,maxTtl:.34});
            this.fireDefenseProjectile(enemy, visibleNearest, { sourceKey: 'egret', sourceName: '妖尾狙撃', speed: 1280, damage: ai.damage, radius: 4, trail: true, color: '#b073ff' });
          }
          ai.attackCooldown = 1.2;
        }
        if (ai.specialCooldown <= 0) {
          const beamTarget = visibleNearest && this.canDefenseEnemyAttackTarget(enemy, visibleNearest, 760, 4)
            ? visibleNearest
            : (flag && this.canDefenseEnemyAttackTarget(enemy, flag, 760, 4) ? flag : null);
          if (beamTarget) {
            ai.action='laser';ai.actionTimer=1.0;ai.actionMax=1.0;this.effects.push({type:'nekomataLaser',x:beamTarget.x,y:beamTarget.y-300,x2:beamTarget.x,y2:beamTarget.y+25,ttl:1.08,maxTtl:1.08});
            this.queueDefenseHazard({ type: 'line', x: beamTarget.x, y: beamTarget.y - 280, x2: beamTarget.x, y2: beamTarget.y, width: 70, delay: 1.0, damage: ai.damage * 1.62, owner: enemy, name: '空中妖光レーザー', hitsFlag: beamTarget === flag, color: '#ff6ad5' });
            ai.specialCooldown = 5.9;
          }
        }
        return;
      }
      if (type === 'orochi') {
        const focus = flag && flag.hp < flag.maxHp * .64 ? flag : (nearest || flag);
        this.moveDefenseEnemy(enemy, focus, dt, .44);
        const crushDamage = ai.enraged ? ai.damage * .92 : ai.damage * .74;
        for (const defender of this.players.filter((player) => !player.isDefenseEnemy && !player.dead)) {
          let contact = Math.hypot(defender.x - enemy.x, defender.y - enemy.y) <= enemy.radius + defender.radius ? enemy : null;
          if (!contact) for (const segment of ai.bodySegments) {
            if (Math.hypot(defender.x - segment.x, defender.y - segment.y) <= segment.radius + defender.radius) { contact = segment; break; }
          }
          if (!contact || this.findBlockingWall(contact.x, contact.y, defender.x, defender.y, 3)
            || this.elapsed - (defender.lastOrochiBodyHitAt || -999) < .55) continue;
          defender.lastOrochiBodyHitAt = this.elapsed;
          this.damagePlayer(defender, crushDamage, enemy, { x: contact.x, y: contact.y, type: 'hazard', name: '大蛇の巨体', sourceKey: 'orochiBody', skipJustCut: true });
        }
        if (!ai.enraged && enemy.hp <= enemy.maxHp * .62) {
          ai.enraged = true; ai.action='enrage'; ai.actionTimer=1.45; ai.actionMax=1.45;this.effects.push({ type:'orochiAura', x:enemy.x, y:enemy.y, radius:250, ttl:1.55, maxTtl:1.55 });
          this.showCenterMessage('大蛇覚醒', '大蛇が炎を纏った', 1.8);
        }
        if (ai.enraged) {
          ai.trailTimer -= dt;
          if (ai.trailTimer <= 0) {
            ai.trailTimer = .34;
            this.spawnDefenseArea({ kind: 'fire', x: enemy.x + rand(-18, 18), y: enemy.y + rand(-18, 18), radius: 88, ttl: 4.8, damage: ai.damage * .2, interval: .42, owner: enemy, name: '大蛇の残火', hitsFlag: true });
          }
        }
        if (ai.specialCooldown <= 0 && focus && this.canDefenseEnemyAttackTarget(enemy, focus, this.getDefenseAttackMaxRange(enemy), 4)) {
          if (Math.random() < .52) {
            const targets = this.players.filter((player) => !player.isDefenseEnemy && !player.dead && this.canDefenseEnemyAttackTarget(enemy, player, 820, 4));
            const points = targets.slice(0, 4).map((player) => ({ x: player.x + rand(-50, 50), y: player.y + rand(-50, 50) }));
            if (flag && this.canDefenseEnemyAttackTarget(enemy, flag, 820, 4)) points.push({ x: flag.x + rand(-65, 65), y: flag.y + rand(-65, 65) });
            ai.action = 'meteor'; ai.actionTimer = 1.35; ai.actionMax = 1.35;
            points.slice(0, 5).forEach((point, index) => {
              const meteorDuration=1.55+index*.08;this.effects.push({ type:'orochiMeteor', x:point.x, y:point.y, radius:96 + index * 5, stagger:.08+index*.08, ttl:meteorDuration, maxTtl:meteorDuration });
              this.queueDefenseHazard({ type: 'circle', x: point.x, y: point.y, radius: 92 + index * 4, delay: .58 + index * .12, damage: ai.damage * (ai.enraged ? 1.15 : .95), owner: enemy, name: '落星火', hitsFlag: true, color: '#ff954a' });
            });
          } else {
            ai.action='breath'; ai.actionTimer=1.4; ai.actionMax=1.4;this.effects.push({ type:'orochiBreath', x:enemy.x, y:enemy.y, x2:focus.x, y2:focus.y, ttl:1.48, maxTtl:1.48 });
            this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: focus.x, y2: focus.y, width: 120, delay: .88, damage: ai.damage * (ai.enraged ? 2.05 : 1.6), owner: enemy, name: '極炎ブレス', hitsFlag: true, color: '#ff8d46' });
            for (let i = 1; i <= 5; i++) {
              const x = enemy.x + (focus.x - enemy.x) * (i / 5);
              const y = enemy.y + (focus.y - enemy.y) * (i / 5);
              this.spawnDefenseArea({ kind: 'fire', x, y, radius: 82 + i * 8, ttl: 4.2, damage: ai.damage * .22, interval: .36, owner: enemy, name: '灼熱の残火', hitsFlag: true });
            }
          }
          ai.specialCooldown = 5.9;
        }
        if (ai.attackCooldown <= 0 && flag && this.canDefenseEnemyAttackTarget(enemy, flag, 220, 4) && Math.hypot(flag.x - enemy.x, flag.y - enemy.y) < 210) {
          ai.action='bite'; ai.actionTimer=.52; ai.actionMax=.52;this.effects.push({ type:'orochiBite', x:enemy.x, y:enemy.y, angle:enemy.aim, range:135, ttl:.62, maxTtl:.62 });
          if (this.canDefenseEnemyAttackTarget(enemy, flag, 220, 4)) this.damageDefenseFlag(ai.damage * (ai.enraged ? .95 : .7), enemy, '大蛇の牙');
          ai.attackCooldown = 1.35;
        }
        if (!ai.ultimateUsed && enemy.hp <= enemy.maxHp * .28 && flag) {
          ai.ultimateUsed = true; ai.action='ultimate'; ai.actionTimer=2.55; ai.actionMax=2.55;this.effects.push({ type:'orochiUltimate', x:enemy.x, y:enemy.y, radius:460, ttl:2.75, maxTtl:2.75 });
          for (let i = 0; i < 24; i++) {
            let x, y, tries = 0;
            do {
              const angle = rand(0, TAU), distance = rand(240, 840);
              x = clamp(enemy.x + Math.cos(angle) * distance, 90, this.world.w - 90);
              y = clamp(enemy.y + Math.sin(angle) * distance, 90, this.world.h - 90);
              tries += 1;
            } while ((Math.hypot(x - flag.x, y - flag.y) < 300 || !this.canDefenseEnemyAttackPoint(enemy, x, y, 880, 4)) && tries < 28);
            if (this.canDefenseEnemyAttackPoint(enemy, x, y, 880, 4)) this.spawnDefenseArea({ kind: 'fire', x, y, radius: 150 + rand(-15, 26), ttl: 5.6, damage: ai.damage * (ai.enraged ? .36 : .3), interval: .32, owner: enemy, name: '終焉の炎', hitsFlag: false });
          }
          this.showCenterMessage('終焉の炎', 'フラッグ周辺へ退避せよ', 2.1);
        }
        return;
      }
    }

    updateBlackTriggerAI(enemy, dt, objective, nearest, flag) {
      const ai = enemy.defenseAI;
      const type = enemy.defenseType;
      const target = objective || nearest || flag;
      const targetAttackable = target && this.canDefenseEnemyAttackTarget(enemy, target, this.getDefenseAttackMaxRange(enemy), 4);
      ai.extraActionCooldown = Math.max(0,(ai.extraActionCooldown||0)-dt);
      if (targetAttackable && ai.extraActionCooldown <= 0 && Math.random() < .018) { const hand=Math.random()<.72?'main':'sub';const index=irand(0,3);if(this.usePlayableDefenseAction(enemy,hand,index,target,{ai:true,modifier:Math.random()<.24})){ai.extraActionCooldown=rand(3.2,6.1);return;} }
      if (type === 'fujin') {
        const currentD = target ? Math.hypot(target.x - enemy.x, target.y - enemy.y) : Infinity;
        this.moveDefenseEnemy(enemy, target, dt, currentD > 430 ? .7 : -.15);
        if (ai.specialCooldown <= 0) {
          const targets = this.players.filter((p) => !p.isDefenseEnemy && !p.dead && this.canDefenseEnemyAttackTarget(enemy, p, 900, 4)).sort((a, b) => dist2(enemy, a) - dist2(enemy, b)).slice(0, 3 + Math.min(2, this.defenseTier));
          if (targets.length || (flag && this.canDefenseEnemyAttackTarget(enemy, flag, 900, 4))) { ai.action='fujinMulti';ai.actionTimer=.75;ai.actionMax=.75; }
          targets.forEach((p, index) => this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: p.x, y2: p.y, width: 30, delay: .72 + index * .1, damage: ai.damage, owner: enemy, name: '風刃・遠隔斬撃', hitsFlag: true, color: '#45ef83' }));
          const flagVisible = flag && this.canDefenseEnemyAttackTarget(enemy, flag, 900, 4);
          if (flagVisible) this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: flag.x, y2: flag.y, width: 24, delay: 1.05, damage: ai.damage * .75, owner: enemy, name: '風刃・伝播斬撃', hitsFlag: true, color: '#45ef83' });
          if (targets.length || flagVisible) ai.specialCooldown = 3.5;
        }
        return;
      }
      if (type === 'seals') {
        this.moveDefenseEnemy(enemy, target, dt, .68);
        if (ai.specialCooldown <= 0 && targetAttackable) {
          ai.sealCount += 1;
          const combo = ai.sealCount % 4 === 0;
          ai.sealBoost = combo ? 3 : 1 + (ai.sealCount % 2); enemy.extraBoost = ai.sealBoost;
          ai.action = combo ? 'sealCombine' : 'sealCast'; ai.actionTimer = .55; ai.actionMax = .55;
          const roll = irand(0, 5);
          if (target === flag && ai.sealCount % 2 === 1) this.queueDefenseHazard({ type: 'circle', x: flag.x, y: flag.y, radius: combo ? 175 : 130, delay: .62, damage: ai.damage * (combo ? .82 : .62), status: 'anchor', owner: enemy, name: combo ? '二重錨印・旗封' : '錨印・旗封', hitsFlag: true, color: '#252c35' });
          else if (roll === 0 && nearest) this.queueDefenseHazard({ type: 'circle', x: nearest.x, y: nearest.y, radius: 125, delay: .65, damage: ai.damage * .55, status: 'anchor', owner: enemy, name: combo ? '二重錨印' : '錨印', color: '#252c35' });
          else if (roll === 1) this.players.filter((p) => !p.isDefenseEnemy && !p.dead).forEach((p) => { p.revealTimer = Math.max(p.revealTimer, 6); p.markedTimer = Math.max(p.markedTimer, 4); });
          else if (roll === 2 && nearest) { enemy.x = clamp(nearest.x + rand(-180, 180), 60, this.world.w - 60); enemy.y = clamp(nearest.y + rand(-180, 180), 60, this.world.h - 60); }
          else if (roll === 3) { ai.shieldTimer = combo ? 4.5 : 2.7; ai.shieldHand='sub'; }
          else if (roll === 4 && nearest) this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: nearest.x, y2: nearest.y, width: 38, delay: .5, damage: ai.damage * .65, status: 'chain', owner: enemy, name: '鎖印', color: '#d5d9e3' });
          else if (nearest) this.queueDefenseHazard({ type: 'circle', x: nearest.x, y: nearest.y, radius: combo ? 170 : 120, delay: .55, damage: ai.damage * .7, status: 'bounce', owner: enemy, name: combo ? '三重弾印' : '弾印', color: '#f5f5ff' });
          ai.specialCooldown = combo ? 3.9 : 2.7;
        }
        return;
      }
      if (type === 'alektor') {
        const currentD = target ? Math.hypot(target.x - enemy.x, target.y - enemy.y) : Infinity;
        this.moveDefenseEnemy(enemy, target, dt, currentD > 360 ? .55 : -.18);
        if (ai.specialCooldown <= 0 && targetAttackable) {
          ai.action='alektorSwarm';ai.actionTimer=.72;ai.actionMax=.72;
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
            ai.action='gas';ai.actionTimer=.55;ai.actionMax=.55;
            this.queueDefenseHazard({ type: 'circle', x: enemy.x, y: enemy.y, radius: 190, delay: .15, damage: ai.damage * .3, status: 'poison', owner: enemy, name: 'ボルボロス毒ガス', hitsFlag: target === flag, color: '#9c73ca' });
            ai.attackCooldown = .9;
          }
        } else if (ai.phase === 'liquid') {
          this.moveDefenseEnemy(enemy, target, dt, 1.35);
        } else {
          const d = this.moveDefenseEnemy(enemy, target, dt, .86);
          if (ai.attackCooldown <= 0 && targetAttackable && d < 180) {
            this.queueDefenseHazard({ type: 'line', x: enemy.x, y: enemy.y, x2: target.x, y2: target.y, width: 55, delay: .38, damage: ai.damage, owner: enemy, name: 'ボルボロス固体斬撃', hitsFlag: true, color: '#b68be2' });
            ai.attackCooldown = 1.35;
          }
        }
        return;
      }
      if (type === 'organon') {
        this.moveDefenseEnemy(enemy, target, dt, .45);
        if (ai.specialCooldown <= 0) {
          ai.action='organonRings';ai.actionTimer=.9;ai.actionMax=.9;
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
      const owner = hazard.owner || null;
      if (owner?.isDefenseEnemy) {
        const targetX = hazard.type === 'line' ? Number(hazard.x2) : Number(hazard.x);
        const targetY = hazard.type === 'line' ? Number(hazard.y2) : Number(hazard.y);
        if (!this.canDefenseEnemyCreateRemoteEffect(owner, targetX, targetY, hazard.name || '敵攻撃')) return false;
      }
      this.defenseHazards.push({
        ...hazard,
        originX: Number.isFinite(hazard.originX) ? hazard.originX : (Number.isFinite(owner?.x) ? owner.x : hazard.x),
        originY: Number.isFinite(hazard.originY) ? hazard.originY : (Number.isFinite(owner?.y) ? owner.y : hazard.y),
        delay: hazard.delay ?? .6, ttl: (hazard.delay ?? .6) + .55, resolved: false,
      });
      return true;
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
      const targets = this.players.filter((player) => !player.dead && (!hazard.owner || this.canDamage(hazard.owner, player)));
      const hits = [];
      for (const target of targets) {
        let hit = false;
        if (hazard.type === 'circle') hit = Math.hypot(target.x - hazard.x, target.y - hazard.y) <= hazard.radius + target.radius;
        else if (hazard.type === 'line') hit = segmentPointDistance(hazard.x, hazard.y, hazard.x2, hazard.y2, target.x, target.y).distance <= (hazard.width || 24) + target.radius;
        else if (hazard.type === 'ring') hit = Math.abs(Math.hypot(target.x - hazard.x, target.y - hazard.y) - hazard.radius) <= (hazard.width || 24) + target.radius;
        if (!hit) continue;
        const attackOriginX = Number.isFinite(hazard.originX) ? hazard.originX : hazard.x;
        const attackOriginY = Number.isFinite(hazard.originY) ? hazard.originY : hazard.y;
        if (this.findBlockingWall(attackOriginX, attackOriginY, target.x, target.y, 3)) continue;
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
        if (hitDecoy) {
          const attackOriginX = Number.isFinite(hazard.originX) ? hazard.originX : hazard.x;
          const attackOriginY = Number.isFinite(hazard.originY) ? hazard.originY : hazard.y;
          if (!this.findBlockingWall(attackOriginX, attackOriginY, decoy.x, decoy.y, 3)) this.damageDefenseDecoy(decoy, (hazard.damage || 0) * .9, hazard.owner, hazard.name);
        }
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
        if (hitFlag) {
          const attackOriginX = Number.isFinite(hazard.originX) ? hazard.originX : hazard.x;
          const attackOriginY = Number.isFinite(hazard.originY) ? hazard.originY : hazard.y;
          if (!this.findBlockingWall(attackOriginX, attackOriginY, flag.x, flag.y, 3)) {
            const flagAmount=(hazard.damage||0)*.62;
            if(!this.absorbFlagHazardWithShield(hazard,flagAmount)) this.damageDefenseFlag(hazard._flagGuardRemainder ?? flagAmount,hazard.owner,hazard.name,{ guardChecked: true });
          }
        }
      }
      this.effects.push({ type: 'defenseImpact', x: hazard.x2 ?? hazard.x, y: hazard.y2 ?? hazard.y, ttl: .35, maxTtl: .35, color: hazard.color });
    }

    defeatDefenseEnemy(enemy, attacker, sourceName = '撃破') {
      if (!enemy || enemy.dead) return;
      enemy.hp = 0; enemy.dead = true; enemy.respawnTimer = Infinity; enemy.corpseTimer = .8;
      this.defenseEnemiesDefeated += 1;
      if (enemy.isDefenseBoss) this.defenseBossesDefeated += 1;
      const resourceReward = enemy.resourceReward ?? (enemy.isDefenseBoss ? 28 : enemy.defenseType === 'rabbit' ? 8 : enemy.defenseType === 'ilgar' ? 6 : 4);
      this.defenseBuildPoints = Math.min(this.defenseBuildMaxPoints, this.defenseBuildPoints + resourceReward);
      if (attacker && !attacker.isDefenseEnemy) {
        attacker.kills += 1;
        attacker.score += enemy.scoreValue || 100;
      }
      const drops = enemy.dropCount ?? (enemy.isDefenseBoss ? 10 : enemy.defenseType === 'rabbit' ? 5 : 3);
      for (let i = 0; i < drops; i++) this.pickups.push(this.makePickup(enemy.x + rand(-55, 55), enemy.y + rand(-55, 55), rand(2, 5), { temporary: true, ttl: rand(12, 16) }));
      this.effects.push({ type: 'bailout', x: enemy.x, y: enemy.y, ttl: .9, maxTtl: .9 });
      this.addKillFeed(`${enemy.name}撃破`);
      this.logEvent(enemy.isDefenseBoss ? 'defense_boss_defeated' : 'defense_enemy_defeated', `${enemy.name} [${sourceName}]`);
      if (enemy.defenseType === 'organon' && !enemy.extraFixedInvader) this.completeDefenseMatch();
    }

    completeDefenseMatch() {
      if (this.ended) return;
      this.ended = true; this.paused = false;
      $('#pauseOverlay').classList.add('hidden');
      const defenders = this.players.filter((player) => !player.isDefenseEnemy).sort((a,b) => b.score-a.score || b.kills-a.kills);
      const clearLabel = this.isHyakkiDefense() ? '百鬼夜行制圧' : 'オルガノン撃破';
      $('#resultTitle').textContent = `防衛成功：${clearLabel}`;
      $('#resultSummary').innerHTML = `
        <div><span>RESULT</span><strong>SUCCESS</strong></div>
        <div><span>CLEAR TIME</span><strong>${formatTime(this.elapsed)}</strong></div>
        <div><span>ENEMIES</span><strong>${this.defenseEnemiesDefeated}</strong></div>
        <div><span>BOSSES</span><strong>${this.defenseBossesDefeated}</strong></div>`;
      $('#rankingList').innerHTML = defenders.map((player,index) => `<div class="rank-row${player.human?' player':''}"><span class="rank">${index+1}</span><strong>${player.name}</strong><span class="meta">${player.kills}K / ${player.deaths}D</span><span>${Math.floor(player.score)}pt</span></div>`).join('');
      this.finalizeLog('defense_success');
      this.updateDebugPanel(true);
      $('#resultOverlay').classList.remove('hidden');
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

    getMasteryRank(value = 0) {
      const score = clamp(Number(value) || 0, 0, 100);
      return [...MASTERY_RANKS].reverse().find((rank) => score >= rank.min) || MASTERY_RANKS[0];
    }

    createInitialMastery(human, aiTier = 'middle', stats = null) {
      if (human) return clamp(50 + ((Number(stats?.technique) || 6) - 6) * 1.25, 43, 59);
      const ranges = { lower:[12,46], middle:[32,70], upper:[54,88] };
      const [min,max] = ranges[aiTier] || ranges.middle;
      const difficultyShift = this.config?.difficulty === 'strong' ? 4 : this.config?.difficulty === 'weak' ? -4 : 0;
      return clamp(rand(min,max) + difficultyShift, 4, 89);
    }

    ensureMasteryRuntime(p) {
      if (!p) return;
      p.masteryValue = clamp(Number.isFinite(p.masteryValue) ? p.masteryValue : 50, 0, 100);
      p.masteryRank = this.getMasteryRank(p.masteryValue).id;
      p.masteryHitStreak = Number(p.masteryHitStreak || 0);
      p.masteryLastHitAt = Number.isFinite(p.masteryLastHitAt) ? p.masteryLastHitAt : -999;
      p.masteryLastSuccessAt = Number.isFinite(p.masteryLastSuccessAt) ? p.masteryLastSuccessAt : -999;
      p._masteryPendingAttacks = p._masteryPendingAttacks instanceof Map ? p._masteryPendingAttacks : new Map();
      p._masteryAwardKeys = p._masteryAwardKeys instanceof Map ? p._masteryAwardKeys : new Map();
    }

    adjustMastery(p, rawDelta, reason = '', options = {}) {
      if (!p || !Number.isFinite(rawDelta) || rawDelta === 0) return 0;
      this.ensureMasteryRuntime(p);
      const before = p.masteryValue;
      let delta = rawDelta;
      if (delta > 0) {
        const gainScale = clamp(1.02 - before * .0082, .2, 1);
        delta *= gainScale;
        p.masteryLastSuccessAt = this.elapsed;
      } else {
        const lossScale = .62 + before * .0042;
        delta *= lossScale;
        p.masteryHitStreak = 0;
      }
      const perEventCap = options.major ? 1.15 : .72;
      delta = clamp(delta, -perEventCap, perEventCap);
      p.masteryValue = clamp(before + delta, 0, 100);
      const oldRank = p.masteryRank || this.getMasteryRank(before).id;
      const newRank = this.getMasteryRank(p.masteryValue).id;
      p.masteryRank = newRank;
      p.masteryRecentDelta = delta;
      p.masteryRecentReason = reason;
      p.masteryRecentAt = this.elapsed;
      if (p.human && newRank !== oldRank) this.toast(`熟練度 ${oldRank} → ${newRank}`);
      return p.masteryValue - before;
    }

    awardMasteryOnce(p, key, delta, reason, cooldown = .35, options = {}) {
      if (!p || !key) return 0;
      this.ensureMasteryRuntime(p);
      const last = p._masteryAwardKeys.get(key) ?? -999;
      if (this.elapsed - last < cooldown) return 0;
      p._masteryAwardKeys.set(key, this.elapsed);
      if (p._masteryAwardKeys.size > 900) {
        for (const [oldKey, time] of p._masteryAwardKeys) if (this.elapsed - time > 20) p._masteryAwardKeys.delete(oldKey);
      }
      return this.adjustMastery(p, delta, reason, options);
    }

    recordMasteryHit(attacker, info = {}, target, effectiveDamage = 0, rangeMultiplier = 1, shotDistance = null) {
      if (!attacker || !target || attacker.id === target.id || effectiveDamage <= 0) return;
      this.ensureMasteryRuntime(attacker);
      const continuous = this.elapsed - attacker.masteryLastHitAt <= 3.2;
      attacker.masteryHitStreak = continuous ? Math.min(18, attacker.masteryHitStreak + 1) : 1;
      attacker.masteryLastHitAt = this.elapsed;
      const streakBonus = Math.min(.09, Math.max(0, attacker.masteryHitStreak - 2) * .008);
      this.adjustMastery(attacker, .105 + streakBonus, '有効打');

      const sourceKey = String(info.sourceKey || info.name || 'attack');
      const activationKey = info.activationId ? `${info.activationId}:${sourceKey}` : `${sourceKey}:${target.id}:${Math.floor(this.elapsed * 3)}`;
      if (MASTERY_SPECIAL_ATTACKS.has(sourceKey)) this.awardMasteryOnce(attacker, `special:${activationKey}`, .46, `${info.name || sourceKey}命中`, 20, {major:true});
      if (sourceKey.startsWith('composite:')) this.awardMasteryOnce(attacker, `composite:${activationKey}`, .5, '合成弾命中', 20, {major:true});
      if (MASTERY_TRAP_SOURCES.has(sourceKey)) this.awardMasteryOnce(attacker, `trap:${activationKey}`, .38, 'トラップ成功', .5, {major:true});
      if (info.rangeProfile && ['gun','sniper'].includes(info.rangeProfile.kind) && rangeMultiplier >= 1) {
        const label = info.rangeProfile.kind === 'sniper' ? '狙撃適正距離' : '銃撃適正距離';
        this.awardMasteryOnce(attacker, `range:${activationKey}`, .14, label, .15);
      }
    }

    recordMasteryUtilitySuccess(owner, sourceKey, target, delta = .35, reason = 'トラップ成功') {
      if (!owner || !target) return;
      const key = `utility:${sourceKey}:${target.id}:${Math.floor(this.elapsed * 2)}`;
      this.awardMasteryOnce(owner, key, delta, reason, .65, {major:true});
    }

    updateMasteryState(p, dt) {
      if (!p || p.dead) return;
      this.ensureMasteryRuntime(p);
      for (const [activationId, attempt] of [...p._masteryPendingAttacks.entries()]) {
        if (attempt.hit) { p._masteryPendingAttacks.delete(activationId); continue; }
        if (this.elapsed < attempt.expires) continue;
        const special = MASTERY_SPECIAL_ATTACKS.has(attempt.triggerId) || String(attempt.triggerId).startsWith('composite:');
        this.adjustMastery(p, special ? -.15 : -.065, special ? '特殊攻撃失敗' : '攻撃失敗');
        p._masteryPendingAttacks.delete(activationId);
      }
      if (p.masteryDodgeAttempt && this.elapsed >= p.masteryDodgeAttempt.until) {
        const success = p.lastDamageAt < p.masteryDodgeAttempt.startedAt && Math.hypot(p.x-p.masteryDodgeAttempt.x,p.y-p.masteryDodgeAttempt.y) >= 28;
        this.adjustMastery(p, success ? .34 : -.11, success ? '回避成功' : '回避失敗', {major:success});
        p.masteryDodgeAttempt = null;
      }
      if (p.masteryValue > 90) {
        const idle = Math.max(0, this.elapsed - p.masteryLastSuccessAt - 4);
        const decay = (.03 + Math.min(.03, idle * .0032)) * dt;
        p.masteryValue = Math.max(89.65, p.masteryValue - decay);
        p.masteryRank = this.getMasteryRank(p.masteryValue).id;
      }
    }

    trackProjectileDodges(projectile) {
      if (!projectile || projectile.life <= 0) return;
      projectile.nearMisses ||= {};
      for (const target of this.players) {
        if (target.dead || target.id === projectile.ownerId || (target.team === projectile.team && (this.config.mode === 'team' || this.isDefenseMode))) continue;
        const dx = target.x - projectile.x, dy = target.y - projectile.y;
        const d = Math.hypot(dx,dy);
        const collision = target.radius + (projectile.radius || 5);
        const danger = collision + 31;
        if (d > danger + 35) continue;
        const entry = projectile.nearMisses[target.id] ||= { min:d, awarded:false };
        entry.min = Math.min(entry.min,d);
        const movingAway = dx * projectile.vx + dy * projectile.vy < 0;
        const targetMoving = Math.hypot(target.vx,target.vy) > Math.max(70,target.speed*.38);
        if (!entry.awarded && targetMoving && movingAway && entry.min > collision + 2 && entry.min <= danger && d >= entry.min + 5) {
          entry.awarded = true;
          this.awardMasteryOnce(target, `dodge:${projectile.id}`, .32, '回避成功', 30, {major:true});
          if (target.human) this.effects.push({type:'dash',x:target.x,y:target.y,angle:Math.atan2(target.vy,target.vx),color:'#d9fbff',ttl:.16,maxTtl:.16});
        }
      }
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

    createPlayer({ id, name, human, team, stats, loadout, archetype = 'プレイヤー', appearance = null, squadName = '無所属隊', emblemPixels = null, beginnerSkill = 'none' }) {
      const maxHp = 78 + stats.combat * 8;
      const maxTrion = 105 + stats.trion * 25;
      const app = { ...randomCpuAppearance(irand(0, 99), team), ...(appearance || {}) };
      const aiTier = human ? 'player' : weightedChoice([{id:'lower',weight:42},{id:'middle',weight:34},{id:'upper',weight:24}]).id;
      const aiPersonality = human ? { calmness:.5, aggression:.5 } : { calmness:rand(0,1), aggression:rand(0,1) };
      const masteryValue = this.createInitialMastery(human, aiTier, stats);
      return {
        id, name, human, team, stats: { ...stats }, loadout,
        archetype,
        beginnerSkill: BEGINNER_SKILLS[beginnerSkill] ? beginnerSkill : 'none',
        aiTier,
        aiPersonality,
        masteryValue, masteryRank:this.getMasteryRank(masteryValue).id, masteryHitStreak:0, masteryLastHitAt:-999, masteryLastSuccessAt:-999, masteryRecentDelta:0, masteryRecentReason:'', masteryRecentAt:-999, masteryDodgeAttempt:null,
        _masteryPendingAttacks:new Map(), _masteryAwardKeys:new Map(),
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
        shooterCharges: { main: null, sub: null },
        shooterHandLock: { main: 0, sub: 0 },
        scorpionMode: { main: 0, sub: 0 },
        spiderMode: 0,
        stationaryTimer: 0,
        gunState: {},
        meleeChains: {},
        reloadVisual: null,
        justCut: null,
        shields: { main: null, sub: null },
        shieldDurability: { main: null, sub: null },
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
          damageDealt: 0, damageTaken: 0, blockedDamage: 0, shieldDamagePrevented: 0, shieldBlocks: 0, justGuards: 0,
          justCuts: 0, rangePenaltyHits: 0, optimalRangeHits: 0, closeRangePenaltyHits: 0, farRangePenaltyHits: 0,
          shooterChargesStarted: 0, shooterChargesCompleted: 0, shooterChargeCancelled: 0, shooterSameHandLocks: 0,
          gunShots: 0, gunReloads: 0, gunEmptyAttempts: 0, reloadSeconds: 0,
          meleeChainHits: 0, meleeChainsCompleted: 0, raygustShieldSeconds: 0,
          trionSpent: 0, pickups: 0, pickupTrionGained: 0, pickupScore: 0,
          aliveTime: 0, currentLife: 0, longestLife: 0, assists: 0, supportScore: 0, naturalHealing: 0,
          combatDeaths: 0, manualBailouts: 0, spectateTransitions: 0, effectApplications: 0, successfulEffectActivations: 0,
          spiderSlowSeconds: 0, switchboxTriggers: 0, switchboxDamage: 0,
          dummyBeaconTargetSeconds: 0, bagwormHiddenSeconds: 0, chameleonHiddenSeconds: 0,
          leadBulletSlowSeconds: 0, leadBulletWeightsApplied: 0, starmakerRevealSeconds: 0, starmakerMarks: 0,
          grasshopperBoostImpulse: 0, escudoDamagePrevented: 0, criticalHits: 0, criticalDamage: 0, coreHits: 0, parryAttacks: 0,
          aiWallAvoidances: 0, aiWallBreakFallbacks: 0, aiStuckEscapes: 0, aiOscillationBreaks: 0, dummyBeaconIdentifications: 0,
          aiVoluntaryBailouts: 0, desertReliefVisits: 0, desertReliefDepartures: 0,
          aiTargetChanges: 0, aiTargetRetained: 0, aiTargetChangeReasons: {}, aiRangeAdvanceSeconds: 0, aiRangeRetreatSeconds: 0, aiRangeHoldSeconds: 0, aiRangeStrafeSeconds: 0, aiOptimalRangeSeconds: 0, aiOutOfRangeSeconds: 0, aiOperatorOrderChanges: 0,
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
          navPath: [], navPathIndex: 0, navPathGoalX: null, navPathGoalY: null, navPathRecalcTimer: 0,
          movementMode: 'advance', movementModeTimer: 0, movementAngle: null, movementAngleTimer: 0,
          lastMoveAngle: null, lastDesiredMoveAngle: null, directionFlipCount: 0, directionFlipTimer: 0, strafeTimer: rand(1.4, 2.8),
          escapeWaypoint: null, escapeTimer: 0, recentNavPoints: [], navLastGoalDistance: null, failedDetours: 0,
          separationSide: Math.random() < .5 ? -1 : 1,
          beaconMemory: {},
          lastAttackerId: null, lastTargetSwitchReason: 'initial', engagementPoint: null, engagementPointTimer: 0,
          threat: {}, sightMemory: {}, visionTimer: 0, retaliationTargetId: null, retaliationTimer: 0,
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
        if (this.mapId === 'underground' && !this.isUndergroundSafePoint(point.x, point.y, point.radius)) continue;
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
      p.shields.main = null; p.shields.sub = null;
      p.shieldDurability = { main:null, sub:null };
      p.sogetsuConnected=false;p.sogetsuConnectTimer=0;p.fullArmsTimer=0;if(p.geistActive||p.playableDefenseType==='geist'){p.geistActive=false;p.geistTimer=0;p.speed=p.geistBaseSpeed||p.speed;}
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
      const extraProfile = subject.playableDefenseType ? this.getPlayableDefenseProfile(subject.playableDefenseType) : null;
      for (const hand of ['main', 'sub']) {
        const root = $(`#${hand}HudSlots`);
        root.innerHTML = '';
        const entries = extraProfile ? extraProfile[hand] : subject.loadout[hand];
        entries.forEach((entry, index) => {
          const trigger = extraProfile ? null : (DATA.triggers[entry] || DATA.triggers.empty);
          const key = hand === 'main' ? index + 1 : index + 5;
          const slot = document.createElement('div');
          slot.className = 'hud-slot'; slot.dataset.hand = hand; slot.dataset.index = index;
          slot.innerHTML = `<span class="key">${key}</span><span class="name">${extraProfile ? entry : (trigger.short || trigger.name)}</span><span class="ammo"></span><span class="cooldown"><i></i></span>`;
          root.appendChild(slot);
        });
      }
      this.updateSlotHud();
    }

    updateStaticHud() {
      const difficulty = AI_DIFFICULTIES[this.config.difficulty]?.label || '普通';
      const roleLabel = this.isPlayerOperator ? 'オペレーター' : this.isSetupSpectator ? '観戦' : '戦闘員';
      const teamText = this.isDefenseMode ? `防衛隊 ${this.config.teamSize || 3}人` : this.config.mode === 'team' ? `${this.teamCount}チーム・各${this.config.teamSize || 3}人` : '個人戦';
      $('#modeLabel').textContent = this.isTutorial
        ? `v${GAME_VERSION} / TRAINING / ${this.config.tutorialLabel || '基本操作'}`
        : `v${GAME_VERSION} / ${MAP_LABELS[this.mapId]} / ${teamText} / ${roleLabel} / ${difficulty}`;
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

    keyCode(action) { return this.config.keyBindings?.[action] || DEFAULT_KEY_BINDINGS[action]; }

    actionDown(action) { return this.input.isDown(this.keyCode(action)); }

    actionConsume(action) { return this.input.consume(this.keyCode(action)); }

    modifierDown() {
      return this.actionDown('modifier') || this.input.virtualKeys.has('ShiftLeft') || this.input.virtualKeys.has('ShiftRight');
    }

    handleGlobalInput() {
      if ((this.actionConsume('pause') || this.input.consume('Escape')) && !this.ended) this.togglePause();
      if (this.actionConsume('guide')) this.setGuideVisible(!this.guideVisible);
      if (this.actionConsume('battleLog')) this.toggleDebugPanel();
      if (this.actionConsume('operatorPanel') && this.isPlayerOperator) this.toggleOperatorPanel();
      if (this.paused || this.ended) return;
      if (this.actionConsume('scope')) this.toggleScope();
      if (this.actionConsume('bailout')) this.manualBailout();
      if (this.actionConsume('spectate')) this.toggleSpectate();
      if (this.spectating && this.actionConsume('spectatorPrev')) this.ensureSpectatorTarget(-1);
      if (this.spectating && this.actionConsume('spectatorNext')) this.ensureSpectatorTarget(1);
      if (this.actionConsume('utility') && this.isPlayerCombatant && !this.human.dead && !this.spectating) {
        if (this.tryInteractSubwayControl(this.human)) return;
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
      else if (this.isExtraMode) { this.updateDefenseHazards(dt); this.updateDefenseAreas(dt); }
      this.updateInstallations(dt);
      this.updateLightSources(dt);
      this.updateGasFields(dt);
      this.updateSubwaySystems(dt);
      if (this.isPlayerOperator) this.updateOperatorCamera(dt);
      else if (this.isPlayerCombatant && !this.spectating) this.updateHuman(dt);
      for (const player of [...this.players]) {
        if (!player.human) {
          const escapingDanger = this.updateAIDangerAvoidance(player, dt);
          const strategicDefense = !escapingDanger && this.updateDefenseStrategicAI(player, dt);
          const seekingDoor = !escapingDanger && !strategicDefense && this.updateAutoPlatformDoorAccess(player, dt);
          if (!escapingDanger && !strategicDefense && !seekingDoor) {
            if (player.remoteControlled) this.updateRemoteControlledPlayer(player, dt);
            else if (player.isDefenseEnemy) this.updateDefenseEnemyAI(player, dt);
            else if (player.playableDefenseType) this.updatePlayableDefenseAI(player, dt);
            else this.updateAI(player, dt);
          }
        }
        this.updatePlayer(player, dt);
        if (player.defenseType === 'orochi') this.updateOrochiBodyPose(player);
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
      if (p.playableDefenseType) { this.updatePlayableDefenseHuman(p, dt); return; }
      if ((p.cubedTimer || 0) > 0) { p.vx *= Math.pow(.03, dt); p.vy *= Math.pow(.03, dt); return; }

      const selectMap = [
        ['mainSlot1', 'main', 0], ['mainSlot2', 'main', 1], ['mainSlot3', 'main', 2], ['mainSlot4', 'main', 3],
        ['subSlot1', 'sub', 0], ['subSlot2', 'sub', 1], ['subSlot3', 'sub', 2], ['subSlot4', 'sub', 3],
      ];
      for (const [action, hand, index] of selectMap) if (this.actionConsume(action)) p.selected[hand] = index;

      const scopeTrigger = this.scopeActive ? this.getScopeTrigger(p) : null;
      if (this.scopeActive && !scopeTrigger) this.scopeActive = false;
      if (scopeTrigger) this.updateScopeControl(p, scopeTrigger, dt);
      else if (this.input.virtualAim.active) p.aim = Math.atan2(this.input.virtualAim.y, this.input.virtualAim.x);
      else {
        const mouseWorld = this.screenToWorld(this.input.mouse.x, this.input.mouse.y);
        p.aim = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);
      }
      let dx = this.input.virtualMove.x;
      let dy = this.input.virtualMove.y;
      if (this.actionDown('moveUp')) dy -= 1;
      if (this.actionDown('moveDown')) dy += 1;
      if (this.actionDown('moveLeft')) dx -= 1;
      if (this.actionDown('moveRight')) dx += 1;
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

      if (this.actionConsume('combo')) this.tryCombo(p);
    }

    getShieldMaxDurability(p, type = 'shield', boost = 1) {
      const trionStat = clamp(Number(p?.stats?.trion) || 6, 2, 10);
      if (type === 'raygust') return 250;
      if (type === 'seal') return Math.round((105 + trionStat * 14) * (1 + (clamp(boost, 1, 3) - 1) * .28));
      return Math.round(105 + trionStat * 16);
    }

    getShieldRegenRate(p, type = 'shield') {
      if (type === 'raygust') return 29;
      if (type === 'seal') return 24;
      return 22 + clamp(Number(p?.stats?.trion) || 6, 2, 10) * 1.25;
    }

    activateShield(p, hand, type = 'shield', options = {}) {
      if (!p || !['main','sub'].includes(hand)) return false;
      p.shieldDurability ||= { main:null, sub:null };
      const boost = type === 'seal' ? clamp(Number(options.boost) || 1, 1, 3) : 1;
      const max = this.getShieldMaxDurability(p, type, boost);
      let state = p.shieldDurability[hand];
      if (!state || state.type !== type || state.boost !== boost) {
        const previous = state;
        const ratio = previous && previous.max > 0 ? clamp(previous.current / previous.max, 0, 1) : 1;
        state = {
          type, boost, max, current:max * ratio,
          lastActiveAt:previous?.lastActiveAt ?? -999,
          lastHitAt:previous?.lastHitAt ?? -999,
          brokenUntil:previous?.brokenUntil || 0,
          redeployCooldownUntil:previous?.redeployCooldownUntil || 0,
          tacticalReleaseUntil:previous?.tacticalReleaseUntil || 0,
          lastJustGuardAt:previous?.lastJustGuardAt ?? -999,
          justGuardUntil:0, justGuardAvailable:false, active:false,
        };
        p.shieldDurability[hand] = state;
      } else if (state.max !== max) {
        const ratio = state.max > 0 ? clamp(state.current / state.max, 0, 1) : 1;
        state.max = max; state.current = max * ratio;
      }
      if (state.current <= 0 && this.elapsed >= (state.brokenUntil || 0)) state.current = state.max * .42;
      const newlyRaised = this.elapsed - (state.lastActiveAt ?? -999) > .055;
      const ignoreRedeployCooldown = Boolean(options.ignoreRedeployCooldown);
      if (this.elapsed < (state.brokenUntil || 0) || state.current <= 0 || (newlyRaised && !ignoreRedeployCooldown && this.elapsed < (state.redeployCooldownUntil || 0))) {
        p.shields[hand] = null;
        return false;
      }
      state.lastActiveAt = this.elapsed;
      state.active = true;
      if (newlyRaised) {
        state.raisedAt = this.elapsed;
        state.justGuardUntil = this.elapsed + (Number(options.justGuardWindow) || .145);
        state.justGuardAvailable = true;
        state.masteryAttempt = Boolean(options.masteryAttempt || this.getProjectileThreatInfo(p, .42));
      }
      const strength = type === 'raygust' ? 1.08 : type === 'seal' ? 1.02 + (boost - 1) * .035 : 1;
      p.shields[hand] = { type, boost, strength, hand, state };
      return true;
    }

    updateShieldDurability(p, dt) {
      if (!p) return;
      p.shieldDurability ||= { main:null, sub:null };
      p.shields ||= { main:null, sub:null };
      for (const hand of ['main','sub']) {
        const state = p.shieldDurability[hand];
        if (!state) { p.shields[hand] = null; continue; }
        if (state.justGuardAvailable && this.elapsed > (state.justGuardUntil || 0)) {
          state.justGuardAvailable = false;
          if (state.masteryAttempt) this.adjustMastery(p, -.09, 'ジャストガード失敗');
          state.masteryAttempt = false;
        }
        const wasActive = Boolean(state.active);
        const active = this.elapsed - (state.lastActiveAt ?? -999) <= .06 && state.current > 0 && this.elapsed >= (state.brokenUntil || 0);
        state.active = active;
        if (wasActive && !active) {
          const justGuardRelease = this.elapsed - (state.lastJustGuardAt ?? -999) <= .34;
          const tacticalRelease = this.elapsed <= (state.tacticalReleaseUntil || 0);
          if (!justGuardRelease) {
            const normalCooldown = state.type === 'raygust' ? .42 : state.type === 'seal' ? .68 : .62;
            state.redeployCooldownUntil = Math.max(state.redeployCooldownUntil || 0, this.elapsed + (tacticalRelease ? .18 : normalCooldown));
          }
        }
        if (!active) {
          p.shields[hand] = null;
          if (state.current <= 0 && this.elapsed >= (state.brokenUntil || 0)) state.current = state.max * .42;
          const recoveryDelay = state.type === 'raygust' ? 1.25 : 1.05;
          if (state.current > 0 && this.elapsed - (state.lastHitAt ?? -999) > recoveryDelay) {
            state.current = Math.min(state.max, state.current + this.getShieldRegenRate(p, state.type) * dt);
          }
        } else if (p.shields[hand]) {
          p.shields[hand].state = state;
        }
      }
    }

    breakShield(p, hand, state) {
      if (!state) return;
      state.current = 0;
      state.justGuardAvailable = false;
      state.brokenUntil = this.elapsed + (state.type === 'raygust' ? 2.8 : state.type === 'seal' ? 3 : 2.4);
      state.redeployCooldownUntil = state.brokenUntil;
      if (p?.shields) p.shields[hand] = null;
      this.effects.push({ type:'shieldBreak', x:p.x, y:p.y, angle:p.aim, color:state.type === 'raygust' ? '#b8ffff' : state.type === 'seal' ? '#f4f1ff' : '#74d8ff', ttl:.42, maxTtl:.42 });
      if (p?.human) this.toast(state.type === 'raygust' ? 'レイガスト盾が破損' : state.type === 'seal' ? '盾印が破損' : 'シールドが破損');
    }

    getActiveShieldEntries(p) {
      if (!p?.shields) return [];
      return ['main','sub'].map((hand) => ({ hand, shield:p.shields[hand], state:p.shields[hand]?.state || p.shieldDurability?.[hand] })).filter(({shield,state}) => shield && state && state.current > 0 && this.elapsed - (state.lastActiveAt ?? -999) <= .07 && this.elapsed >= (state.brokenUntil || 0));
    }

    handleHeldHand(p, hand, held, justPressed, dt, shiftOverride = null) {
      if (!held && !justPressed) return;
      const trigger = this.getSelectedTrigger(p, hand);
      if (!trigger || trigger.kind === 'empty') return;
      const shift = shiftOverride === null ? this.modifierDown() : Boolean(shiftOverride);
      if (trigger.kind === 'shield') {
        if (held) this.activateShield(p, hand, 'shield');
        return;
      }
      if (trigger.id === 'raygust' && shift) {
        if (held && this.activateShield(p, hand, 'raygust')) p.metrics.raygustShieldSeconds += dt;
        return;
      }
      const automatic = (trigger.kind === 'gun' && ['assault', 'gatling'].includes(trigger.gun)) || (trigger.kind === 'melee' && ['kogetsu','scorpion','raygust'].includes(trigger.id));
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

    getTriggerRangeProfile(trigger) {
      if (!trigger || !['shooter', 'gun', 'sniper'].includes(trigger.kind)) return null;
      const min = Number(trigger.optimalMin);
      const max = Number(trigger.optimalMax);
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
      return { min, max, kind: trigger.kind, id: trigger.id || '' };
    }

    getRangeDamageMultiplier(target, info = {}) {
      const profile = info.rangeProfile;
      if (!profile || !Number.isFinite(info.originX) || !Number.isFinite(info.originY)) return 1;
      const shotDistance = Math.hypot(target.x - info.originX, target.y - info.originY);
      if (shotDistance < profile.min || shotDistance > profile.max) return profile.kind === 'sniper' ? .58 : .55;
      if (profile.kind === 'sniper') return 1.68;
      if (profile.kind === 'gun') return 1.48;
      return 1.08;
    }

    tryJustCut(target, attacker, info = {}) {
      const cut = target.justCut;
      if (!cut || cut.timer <= 0 || target.isDefenseEnemy || !['projectile', 'melee'].includes(info.type)) return false;
      let sourceAngle = Number(info.incomingAngle);
      if (!Number.isFinite(sourceAngle)) {
        const sx = Number.isFinite(info.x) ? info.x : attacker?.x;
        const sy = Number.isFinite(info.y) ? info.y : attacker?.y;
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) return false;
        sourceAngle = Math.atan2(sy - target.y, sx - target.x);
      }
      const acceptance = cut.sourceKey === 'kogetsu' ? .94 : .84;
      if (Math.abs(angleDiff(sourceAngle, cut.angle)) > acceptance) return false;
      const key = cut.slotKey;
      if (key && Number.isFinite(target.cooldowns[key])) target.cooldowns[key] *= .5;
      target.metrics.justCuts = (target.metrics.justCuts || 0) + 1;
      this.adjustMastery(target, cut.sourceKey === 'kogetsuParry' ? .52 : .34, cut.sourceKey === 'kogetsuParry' ? 'いなし成功' : 'ジャストいなし', {major:true});
      this.effects.push({ type: 'justCut', x: target.x, y: target.y, angle: cut.angle, radius: target.radius + 31, ttl: .3, maxTtl: .3, color: cut.sourceKey === 'kogetsu' ? '#e7fbff' : '#c1a7ff' });
      this.sfx?.play('attacker', { x: target.x, y: target.y, bucket: `just-cut:${target.id}`, cooldown: .04, volume: .54, rate: 1.22 });
      if (target.human) this.toast('JUST CUT　クールダウン半減');
      this.logCombatDetail('just_cut', target, { attackerId: attacker?.id || null, source: info.sourceKey || info.name || info.type, slotKey: key, cooldownAfter: key ? Number((target.cooldowns[key] || 0).toFixed(3)) : null });
      target.justCut = null;
      return true;
    }

    consumeTrion(p, amount, silent = false) {
      const relief = this.desertReliefState(p);
      const snow = this.shrineGardenState(p);
      const skillMultiplier = p.beginnerSkill === 'thrifty' ? .82 : 1;
      const effectiveAmount = amount * relief.multiplier * snow.multiplier * skillMultiplier;
      if (p.trion + 0.001 < effectiveAmount) {
        if (p.human && !silent) this.toast('トリオン不足');
        return false;
      }
      p.trion -= effectiveAmount;
      if (p.metrics) p.metrics.trionSpent += effectiveAmount;
      return true;
    }

    getGunState(p, hand, trigger, slotIndex = p.selected[hand]) {
      const key = `${hand}:${slotIndex}`;
      const capacity = Math.max(1, Number(trigger.magazine || 1));
      let state = p.gunState[key];
      if (!state || state.triggerId !== trigger.id) state = p.gunState[key] = { triggerId: trigger.id, ammo: capacity, capacity, reloadTimer: 0, reloadMax: Number(trigger.reload || 1.5) };
      state.capacity = capacity;
      state.reloadMax = Number(trigger.reload || state.reloadMax || 1.5);
      return state;
    }

    beginGunReload(p, hand, trigger, state = this.getGunState(p, hand, trigger)) {
      if (state.reloadTimer > 0 || state.ammo >= state.capacity) return false;
      const techniqueFactor = 1 - (p.stats.technique - 2) * .018;
      state.reloadTimer = Math.max(.55, state.reloadMax * techniqueFactor);
      state.reloadStartedAt = this.elapsed;
      state.reloadDuration = state.reloadTimer;
      p.reloadVisual = { hand, slot: p.selected[hand], triggerId: trigger.id, timer: state.reloadTimer, max: state.reloadTimer };
      p.metrics.gunReloads += 1;
      this.logCombatDetail('reload_start', p, { hand, triggerId: trigger.id, ammo: state.ammo, capacity: state.capacity, duration: Number(state.reloadTimer.toFixed(3)) });
      return true;
    }

    beginShooterCharge(p, hand, trigger) {
      if ((p.shooterHandLock[hand] || 0) > 0 || p.shooterCharges[hand] || !this.cooldownReady(p, hand)) return false;
      const base = SHOOTER_CHARGE_BASE[trigger.bullet] || .3;
      const chargeTime = Math.max(.12, base * (1 - (p.stats.technique - 2) * .035));
      p.shooterCharges[hand] = { hand, slot: p.selected[hand], triggerId: trigger.id, bullet: trigger.bullet, timer: chargeTime, max: chargeTime, ready: false, division: 1, aim: p.aim };
      p.shooterHandLock[hand] = chargeTime + .08;
      p.metrics.shooterChargesStarted += 1;
      this.logCombatDetail('shooter_charge_start', p, { hand, slot: p.selected[hand], triggerId: trigger.id, chargeTime: Number(chargeTime.toFixed(3)) });
      if (p.human) this.toast('トリオンキューブ展開中');
      return true;
    }

    splitShooterCube(p, hand, charge) {
      if (!charge?.ready) return false;
      charge.division = charge.division >= 5 ? 1 : charge.division + 1;
      if (p.human) this.toast(`キューブ分割 ${charge.division}/5`);
      this.effects.push({ type:'cubeSplit', x:p.x, y:p.y, division:charge.division, ttl:.24, maxTtl:.24 });
      return true;
    }

    updateWeaponStates(p, dt) {
      for (const hand of ['main', 'sub']) {
        p.shooterHandLock[hand] = Math.max(0, (p.shooterHandLock[hand] || 0) - dt);
        const charge = p.shooterCharges[hand];
        if (charge) {
          charge.aim = p.aim;
          if (!charge.ready) {
            charge.timer -= dt;
            if (charge.timer <= 0) {
              charge.timer = 0;
              charge.ready = true;
              p.metrics.shooterChargesCompleted += 1;
              if (!p.human) charge.division = clamp(2 + Math.floor(p.stats.technique / 3), 2, 5);
              if (p.human) this.toast('キューブ展開完了：Shift+クリックで分割');
            }
          }
        }
      }
      let anyReload = null;
      for (const [key, state] of Object.entries(p.gunState || {})) {
        if ((state.reloadTimer || 0) <= 0) continue;
        const elapsed = Math.min(dt, state.reloadTimer);
        state.reloadTimer = Math.max(0, state.reloadTimer - dt);
        p.metrics.reloadSeconds += elapsed;
        anyReload = { key, state };
        if (state.reloadTimer <= 0) {
          state.ammo = state.capacity;
          const [hand, slot] = key.split(':');
          this.logCombatDetail('reload_complete', p, { hand, slot: Number(slot), triggerId: state.triggerId, ammo: state.ammo });
        }
      }
      if (anyReload) {
        const [hand, slot] = anyReload.key.split(':');
        p.reloadVisual = { hand, slot: Number(slot), triggerId: anyReload.state.triggerId, timer: anyReload.state.reloadTimer, max: anyReload.state.reloadDuration || anyReload.state.reloadMax };
      } else p.reloadVisual = null;

      for (const [key, chain] of Object.entries(p.meleeChains || {})) {
        chain.timer -= dt;
        if (chain.timer > 0) continue;
        if (chain.count > 0 && !chain.recoveryApplied) {
          const trigger = DATA.triggers[chain.triggerId];
          const recovery = Number(trigger?.cooldown || .45) * (.72 + chain.count * .1);
          p.cooldowns[key] = Math.max(p.cooldowns[key] || 0, recovery);
          p.cooldownMax[key] = Math.max(p.cooldownMax[key] || 0, recovery);
          chain.recoveryApplied = true;
          this.logCombatDetail('melee_chain_end', p, { slotKey: key, triggerId: chain.triggerId, hits: chain.count, recovery: Number(recovery.toFixed(3)), reason: 'timeout' });
        }
        delete p.meleeChains[key];
      }
    }

    applyMeleeChainCooldown(p, hand, trigger) {
      const key = this.getSlotKey(p, hand);
      const maxHits = MELEE_CHAIN_MAX[trigger.id] || 1;
      const step = MELEE_CHAIN_STEP[trigger.id] || .16;
      const chain = p.meleeChains[key] || { triggerId: trigger.id, count: 0, timer: 0, recoveryApplied: false };
      chain.count += 1;
      chain.timer = .48;
      chain.recoveryApplied = false;
      p.meleeChains[key] = chain;
      p.metrics.meleeChainHits += 1;
      if (chain.count >= maxHits) {
        const recovery = trigger.cooldown * (1.08 + (maxHits - 1) * .12);
        p.cooldowns[key] = recovery;
        p.cooldownMax[key] = recovery;
        p.metrics.meleeChainsCompleted += 1;
        this.logCombatDetail('melee_chain_end', p, { slotKey: key, triggerId: trigger.id, hits: chain.count, recovery: Number(recovery.toFixed(3)), reason: 'max_chain' });
        delete p.meleeChains[key];
      } else {
        p.cooldowns[key] = step;
        p.cooldownMax[key] = step;
        this.logCombatDetail('melee_chain_step', p, { slotKey: key, triggerId: trigger.id, hit: chain.count, maxHits });
      }
    }

    tryUseHand(p, hand, options = {}) {
      const trigger = this.getSelectedTrigger(p, hand);
      if (!trigger || trigger.kind === 'empty' || p.dead) return false;
      if (p.toggles.chameleon && trigger.id !== 'chameleon') {
        if (p.human) this.toast('カメレオン中は他トリガーを使用できません');
        return false;
      }
      if (p.ai && trigger.kind !== 'shield' && !(trigger.id === 'raygust' && options.shift)) this.markRaygustTacticalRelease(p, hand, trigger);
      if (trigger.kind === 'shooter') {
        const charge = p.shooterCharges[hand];
        if (!charge) return this.beginShooterCharge(p, hand, trigger);
        if (!charge.ready) return false;
        if (options.shift) return this.splitShooterCube(p, hand, charge);
        if (charge.slot !== p.selected[hand] || charge.triggerId !== trigger.id) return false;
        p.shooterCharges[hand] = null;
        const trionSpentBefore = p.metrics?.trionSpent || 0;
        const activation = this.beginTriggerActivation(p, trigger.id);
        let used = false;
        try {
          used = this.fireShooter(p, hand, trigger, charge.division || 1);
          if (used) this.recordTriggerUse(p, trigger.id, trigger.name, activation.id, (p.metrics?.trionSpent || 0) - trionSpentBefore);
          else p._activationHits.delete(activation.id);
        } finally {
          this.activeActivation = null;
        }
        return used;
      }
      if ((trigger.kind === 'gun' || trigger.kind === 'sniper') && options.shift) return this.beginGunReload(p, hand, trigger);
      if (trigger.id === 'scorpion' && options.shift) {
        p.scorpionMode[hand] = ((p.scorpionMode[hand] || 0) + 1) % 3;
        if (p.human) this.toast(`スコーピオン：${['通常刃','長刃','短刃'][p.scorpionMode[hand]]}`);
        return true;
      }
      if (trigger.kind === 'wire' && options.shift) {
        p.spiderMode = (p.spiderMode + 1) % 2;
        if (p.human) this.toast(`スパイダー：${p.spiderMode ? 'ばね' : '通常'}`);
        return true;
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
          case 'shooter': used = false; break;
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
      let range = trigger.range;
      let damage = trigger.damage;
      let arc = 1.35;
      let style = trigger.id;
      let cost = trigger.cost;
      if (trigger.id === 'kogetsu' && options.shift) {
        cost *= .82; damage *= .72; range *= .92; arc = 1.72; style = 'kogetsuParry';
        p._activeUseName = '弧月・いなし'; p._activeSourceKey = style; p.metrics.parryAttacks += 1;
      }
      if (trigger.id === 'scorpion') {
        const mode = p.scorpionMode[hand] || 0;
        if (mode === 1) { range = 145 + p.stats.trion * 3; damage *= .76; cost *= 1.34; arc = .72; style = 'scorpionLong'; p._activeUseName = ATTACK_LABELS.scorpionLong; p._activeSourceKey = style; }
        if (mode === 2) { range = 54 + p.stats.trion * 1.2; damage *= 1.2; cost *= .7; arc = 1.05; style = 'scorpionShort'; p._activeUseName = 'スコーピオン（短刃）'; p._activeSourceKey = style; }
      }
      if (!this.consumeTrion(p, cost)) return false;
      this.performSlash(p, range, damage * (0.82 + p.stats.combat * 0.045), arc, style);
      if (['kogetsu','scorpion','raygust'].includes(trigger.id)) this.applyMeleeChainCooldown(p, hand, trigger);
      else this.setCooldown(p, hand, trigger.cooldown);
      if (trigger.id === 'kogetsu' || trigger.id === 'scorpion') {
        p.justCut = {
          timer: trigger.id === 'kogetsu' && options.shift ? clamp(.18 + p.stats.technique * .014, .22, .36) : clamp(.105 + p.stats.technique * .009, .13, .205),
          hand,
          slotKey: this.getSlotKey(p, hand),
          angle: p.aim,
          sourceKey: trigger.id === 'kogetsu' && options.shift ? 'kogetsuParry' : trigger.id,
          masteryAttempt: trigger.id === 'kogetsu' && options.shift,
        };
      }
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
        const damaged = this.damagePlayer(target, damage, p, { x: p.x, y: p.y, type: 'melee', name: sourceName, sourceKey: style, activationId: this.activeActivation?.playerId === p.id ? this.activeActivation.id : null });
        if (damaged) {
          const knock = 120 + p.stats.combat * 8;
          target.vx += Math.cos(p.aim) * knock;
          target.vy += Math.sin(p.aim) * knock;
        }
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

    fireShooter(p, hand, trigger, division = 1) {
      division = clamp(Math.round(division || 1), 1, 5);
      const technique = p.stats.technique;
      const trion = p.stats.trion;
      const projectileCount = [1, 2, 4, 8, 12][division - 1];
      const costScale = [1.34, 1.18, 1.04, .94, .88][division - 1];
      const damageScale = [1.9, 1.24, .79, .50, .38][division - 1];
      if (!this.consumeTrion(p, trigger.cost * costScale)) return false;
      const modifiers = this.consumeShotModifier(p, hand);
      const aimPoint = trigger.bullet === 'viper' ? this.getFixedShotTarget(p, .5) : null;
      for (let i = 0; i < projectileCount; i++) {
        const lane = i - (projectileCount - 1) / 2;
        const spread = lane * Math.max(.018, .105 - technique * .006) / Math.max(1, Math.sqrt(projectileCount));
        const common = { angle:p.aim + spread, speed:610 + trion * 16 + division * 18, radius:Math.max(3.2, 6.3 - division * .55), life:1.12 + trion * .026, ...modifiers };
        if (trigger.bullet === 'asteroid') Object.assign(common, { damage:(15.2 + trion * 1.14) * damageScale, color:'#72e8ff' });
        if (trigger.bullet === 'meteor') Object.assign(common, { damage:(29 + trion * 1.3) * damageScale, speed:520 + trion * 10, explosive:true, explosionRadius:(92 + trion * 3) * (1.08 - division * .055), color:'#ffb55e' });
        if (trigger.bullet === 'hound') {
          const target=this.findTargetNearAim(p,280);
          Object.assign(common,{damage:(11.4+trion*.72)*damageScale,homing:.84+technique*.105,targetId:target?.id||null,color:'#7dffb8'});
        }
        if (trigger.bullet === 'viper') {
          const baseAngle=Math.atan2(aimPoint.y-p.y,aimPoint.x-p.x), d=Math.hypot(aimPoint.x-p.x,aimPoint.y-p.y);
          const mid={x:p.x+Math.cos(baseAngle)*d*.48+Math.cos(baseAngle+Math.PI/2)*lane*22,y:p.y+Math.sin(baseAngle)*d*.48+Math.sin(baseAngle+Math.PI/2)*lane*22};
          Object.assign(common,{angle:Math.atan2(mid.y-p.y,mid.x-p.x),damage:(12.2+trion*.72)*damageScale,routePoints:[mid,aimPoint],routeTurn:2.9+technique*.16,color:'#c88cff'});
        }
        this.spawnProjectile(p, hand, common);
      }
      this.setCooldown(p, hand, trigger.cooldown * [1.32,1.16,1,.83,.7][division-1]);
      this.logCombatDetail('shooter_volley', p, { hand, triggerId:trigger.id, bullet:trigger.bullet, division, projectileCount });
      this.revealOnAttack(p, 1.25, 520 + projectileCount * 18);
      p.shooterHandLock[hand] = Math.max(p.shooterHandLock[hand], .38);
      return true;
    }

    getAssistedShotAngle(p, baseAngle, kind) {
      if (p.beginnerSkill !== 'aimAssist' || !p.human || !['gun','sniper'].includes(kind)) return baseAngle;
      let best = null, bestScore = Infinity;
      for (const target of this.players) {
        if (!this.canDamage(p, target)) continue;
        const d = Math.hypot(target.x - p.x, target.y - p.y);
        const desired = Math.atan2(target.y - p.y, target.x - p.x);
        const diff = Math.abs(angleDiff(desired, baseAngle));
        const cone = kind === 'sniper' ? .095 : .16;
        if (diff > cone || this.findBlockingWall(p.x, p.y, target.x, target.y, 3)) continue;
        const score = diff * 900 + d * .025;
        if (score < bestScore) { best = desired; bestScore = score; }
      }
      return best === null ? baseAngle : baseAngle + angleDiff(best, baseAngle) * (kind === 'sniper' ? .72 : .52);
    }

    getHumanAimPoint(p, distance = 520) {
      if (this.scopeActive && p === this.human && this.getScopeTrigger(p)) return this.getScopeReticlePoint(p);
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
      const state = this.getGunState(p, hand, trigger);
      if (state.reloadTimer > 0) return false;
      if (state.ammo <= 0) {
        p.metrics.gunEmptyAttempts += 1;
        this.beginGunReload(p, hand, trigger, state);
        return false;
      }
      if (!this.consumeTrion(p, trigger.cost, !p.human)) return false;
      state.ammo -= 1;
      p.metrics.gunShots += 1;
      const modifiers = this.consumeShotModifier(p, hand);
      const stationary = Math.hypot(p.vx, p.vy) < p.speed * .08;
      const techSpread = trigger.spread * (1.14 - p.stats.technique * .045) * (stationary ? .5 : 1);
      const target = trigger.bullet === 'hound' ? this.findTargetNearAim(p, 210) : null;
      const assistedAim = this.getAssistedShotAngle(p, p.aim, 'gun');
      for (let i = 0; i < trigger.count; i++) {
        let angle = assistedAim + rand(-techSpread, techSpread);
        if (trigger.count > 1) angle = assistedAim + lerp(-trigger.spread, trigger.spread, i / Math.max(1, trigger.count - 1));
        const opts = {
          angle,
          speed: trigger.speed + p.stats.trion * (trigger.bullet === 'asteroid' ? 8 : 4),
          damage: trigger.damage * (0.78 + p.stats.trion * .035),
          radius: trigger.gun === 'grenade' ? 7 : 3.6,
          life: 1.25 * trigger.range,
          color: trigger.bullet === 'meteor' ? '#ffb55e' : trigger.bullet === 'viper' ? '#c88cff' : trigger.bullet === 'hound' ? '#7dffb8' : '#72e8ff',
          ...modifiers, stationaryShot: stationary,
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
      if (state.ammo <= 2 || state.ammo % 5 === 0) this.logCombatDetail('gun_ammo_checkpoint', p, { hand, triggerId: trigger.id, gun: trigger.gun, bullet: trigger.bullet, ammoAfter: state.ammo, capacity: state.capacity });
      if (state.ammo <= 0) this.beginGunReload(p, hand, trigger, state);
      this.revealOnAttack(p, trigger.gun === 'gatling' ? .5 : 1.15);
      return true;
    }

    fireSniper(p, hand, trigger) {
      const state = this.getGunState(p, hand, trigger);
      if (state.reloadTimer > 0) return false;
      if (state.ammo <= 0) { p.metrics.gunEmptyAttempts += 1; this.beginGunReload(p, hand, trigger, state); return false; }
      if (!this.consumeTrion(p, trigger.cost)) return false;
      state.ammo -= 1;
      p.metrics.gunShots += 1;
      const modifiers = this.consumeShotModifier(p, hand);
      const speedBonus = trigger.id === 'lightning' ? p.stats.trion * 55 : p.stats.trion * 15;
      const shotSpeed = trigger.speed + speedBonus;
      const damageBonus = trigger.id === 'ibis' ? p.stats.trion * 3.4 : p.stats.trion * .8;
      const rangeFactor = trigger.id === 'egret' ? 1.35 + p.stats.trion * .06 : 1.22;
      let shotAngle = this.getAssistedShotAngle(p, p.aim, 'sniper');
      if (!p.human && p.ai?.targetType === 'player') {
        const target = this.resolveAITarget(p);
        if (target) {
          const travelTime = Math.hypot(target.x - p.x, target.y - p.y) / Math.max(shotSpeed, 1);
          const lead = clamp(travelTime * .94, .08, .78);
          shotAngle = Math.atan2(target.y + (target.vy || 0) * lead - p.y, target.x + (target.vx || 0) * lead - p.x);
        }
      }
      const stationary = Math.hypot(p.vx, p.vy) < p.speed * .08;
      const tierAim = AI_TIER_PROFILES[p.aiTier]?.aim || 1;
      const spreadScale = (p.human ? 1 : (this.config.difficulty === 'strong' ? .42 : this.config.difficulty === 'normal' ? .72 : 1.15) * tierAim) * (stationary ? .38 : 1);
      this.spawnProjectile(p, hand, {
        angle: shotAngle + rand(-.018, .018) * (11 - p.stats.technique) * spreadScale,
        speed: shotSpeed,
        damage: trigger.damage + damageBonus,
        radius: trigger.id === 'ibis' ? 6.5 : trigger.id === 'egret' ? 5.2 : 4.8,
        life: rangeFactor,
        color: trigger.id === 'ibis' ? '#ffd27a' : '#d8fbff',
        trail: true,
        penetration: trigger.id === 'ibis' ? 1 : 0,
        ...modifiers, stationaryShot: stationary,
      });
      this.setCooldown(p, hand, trigger.cooldown);
      if (state.ammo <= 0) this.beginGunReload(p, hand, trigger, state);
      this.logCombatDetail('sniper_fire', p, { hand, triggerId: trigger.id, aim: Number(shotAngle.toFixed(4)), optimalMin: trigger.optimalMin, optimalMax: trigger.optimalMax });
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
      this.wires.push({ x1: p.x, y1: p.y, x2: p.x + dx / d * length, y2: p.y + dy / d * length, team: p.team, ownerId: p.id, ttl: 60, hp: 22, mode: p.spiderMode ? 'spring' : 'normal' });
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
      const power = 520 + p.stats.combat * 28;
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
      const base = { angle: launchAngle, speed: c.speed, damage: c.damage * (0.82 + p.stats.trion * .035), radius: 7, life: 1.85, color: '#fff3a6', sourceName: c.name, sourceKey: pending.sourceKey, activationId: pending.activationId, rangeProfile: { min: 220, max: 760, kind: 'shooter', id: pending.sourceKey } };
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
      const sourceKey = opts.sourceKey || this.activeActivation?.triggerId || owner.loadout[hand]?.[owner.selected[hand]] || 'shot';
      const sourceName = opts.sourceName || this.activeActivation?.name || DATA.triggers[sourceKey]?.name || '射撃';
      const rangeProfile = opts.rangeProfile || this.getTriggerRangeProfile(DATA.triggers[sourceKey]);
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
        sourceName,
        sourceKey,
        rangeProfile: rangeProfile ? { ...rangeProfile } : null,
        originX: Number.isFinite(opts.originX) ? opts.originX : owner.x,
        originY: Number.isFinite(opts.originY) ? opts.originY : owner.y,
        activationId: opts.activationId || (this.activeActivation?.playerId === owner.id ? this.activeActivation.id : null),
        stationaryShot: Boolean(opts.stationaryShot),
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

    updateNaturalHealing(p, dt, activeDrain = 0) {
      if (!p || p.dead || p.isDefenseEnemy || p.hp >= p.maxHp - .001 || p.geistActive || activeDrain > 0 || (p.defensePoisonTimer || 0) > 0) return;
      const trionRatio = p.trion / Math.max(1, p.maxTrion);
      const contactAge = this.elapsed - Math.max(p.lastDamageAt || -999, p.ai?.lastHostileContactAt || -999);
      if (trionRatio < .68 || contactAge < 5.8) return;
      const healRate = clamp(.22 + Number(p.stats?.trion || 2) * .075, .35, .98);
      const requested = Math.min(p.maxHp - p.hp, healRate * dt);
      const trionCost = requested * .72;
      if (p.trion - trionCost < p.maxTrion * .58) return;
      p.hp += requested;
      p.trion = Math.max(0, p.trion - trionCost);
      p.metrics.naturalHealing = (p.metrics.naturalHealing || 0) + requested;
      p.naturalHealFxTimer = Math.max(0, (p.naturalHealFxTimer || 0) - dt);
      if (p.naturalHealFxTimer <= 0) {
        p.naturalHealFxTimer = .85;
        this.effects.push({type:'healSpark',x:p.x+rand(-10,10),y:p.y+rand(-18,14),ttl:.42,maxTtl:.42,color:'#8fffd4'});
      }
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
      this.updateMasteryState(p, dt);

      for (const key of Object.keys(p.cooldowns)) p.cooldowns[key] = Math.max(0, p.cooldowns[key] - dt);
      if (p.playableDefenseType) {
        p.extraActionTimer = Math.max(0, (p.extraActionTimer || 0) - dt);
        const parryWasActive = (p.extraParryTimer || 0) > 0;
        p.extraParryTimer = Math.max(0, (p.extraParryTimer || 0) - dt);
        if (parryWasActive && p.extraParryTimer <= 0 && p.masteryParryAttempt) { this.adjustMastery(p, -.12, 'いなし失敗'); p.masteryParryAttempt = false; }
        p.extraParryCooldown = Math.max(0, (p.extraParryCooldown || 0) - dt);
        if (p.defenseAI) { p.defenseAI.shieldTimer=Math.max(0,(p.defenseAI.shieldTimer||0)-dt); p.defenseAI.coreCooldown=Math.max(0,(p.defenseAI.coreCooldown||0)-dt); p.defenseAI.actionTimer=Math.max(0,(p.defenseAI.actionTimer||0)-dt); }
        p.sogetsuConnectTimer=Math.max(0,(p.sogetsuConnectTimer||0)-dt);if(p.sogetsuConnectTimer<=0)p.sogetsuConnected=false;
        p.fullArmsTimer=Math.max(0,(p.fullArmsTimer||0)-dt);
        if(p.geistActive){p.geistTimer=Math.max(0,(p.geistTimer||0)-dt);p.trion=Math.max(0,p.trion-dt*(p.summonedByOperator?.42:.62));p.geistLeakTimer=(p.geistLeakTimer||0)-dt;if(p.geistLeakTimer<=0){p.geistLeakTimer=.09;this.effects.push({type:'geistLeak',x:p.x+rand(-16,16),y:p.y+rand(-24,20),ttl:.5,maxTtl:.5});}if(p.geistTimer<=0||p.trion<=0){p.geistActive=false;p.speed=p.geistBaseSpeed||p.speed;this.bailout(p,null,'ガイスト強制緊急脱出',{kind:'other'});}}
      }
      if ((p.playableDefenseType === 'seals' || p.defenseType === 'seals') && (p.defenseAI?.shieldTimer || 0) > 0) {
        this.activateShield(p, p.defenseAI?.shieldHand || 'sub', 'seal', { boost:clamp(p.extraBoost || p.defenseAI?.sealBoost || 1, 1, 3) });
      }
      this.updateShieldDurability(p, dt);
      this.updateWeaponStates(p, dt);
      if (p.justCut) {
        p.justCut.timer -= dt;
        if (p.justCut.timer <= 0) {
          if (p.justCut.masteryAttempt) this.adjustMastery(p, -.1, 'いなし失敗');
          p.justCut = null;
        }
      }
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
      const shrineGarden = this.shrineGardenState(p);
      p.desertRelieved = desertRelief.relieved;
      p.desertTrionMultiplier = desertRelief.multiplier;
      p.desertReliefLabel = desertRelief.label;
      p.shrineGardenDebuff = shrineGarden.active;
      p.shrineGardenLabel = shrineGarden.label;
      this.updateShrineBlessings(p,dt);
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
      if (p.beginnerSkill === 'thrifty') drain *= .82;
      drain *= desertRelief.multiplier * shrineGarden.multiplier;
      if (p.toggles.bagworm || p.toggles.bagwormTag) p.metrics.bagwormHiddenSeconds += dt;
      if (p.toggles.chameleon) p.metrics.chameleonHiddenSeconds += dt;
      if (drain > 0) {
        const drained = drain * dt;
        p.trion -= drained;
        p.metrics.trionSpent += drained;
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
      this.updateNaturalHealing(p, dt, drain);

      const weightSlow = Math.max(.22, 1 - p.leadWeights * .17);
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
      this.applyUndergroundRailSafety(p, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const movementSpeed = Math.hypot(p.vx, p.vy);
      p.isMoving = movementSpeed > 24;
      p.stationaryTimer = p.isMoving ? 0 : (p.stationaryTimer || 0) + dt;
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
      this.checkUndergroundHazards(p);
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
          if (wire.mode === 'spring') {
            const angle = Math.atan2(wire.y2 - wire.y1, wire.x2 - wire.x1) + Math.PI / 2;
            const side = Math.sign((p.x - hit.x) * Math.cos(angle) + (p.y - hit.y) * Math.sin(angle)) || 1;
            p.vx += Math.cos(angle) * side * 620;
            p.vy += Math.sin(angle) * side * 620;
            p.slowTimer = Math.max(p.slowTimer, .08);
          } else {
            p.slowTimer = Math.max(p.slowTimer, .3);
            p.slowFactor = Math.min(p.slowFactor, .28);
          }
          const owner = this.players.find((player) => player.id === wire.ownerId);
          if (owner?.metrics) {
            const support = dt * 1.6;
            owner.metrics.spiderSlowSeconds += dt;
            this.awardSupport(owner, support);
            wire.masteryTargets ||= {};
            if (!wire.masteryTargets[p.id]) { wire.masteryTargets[p.id] = true; this.recordMasteryUtilitySuccess(owner, 'spider', p, .34, 'スパイダー成功'); }
          }
          for (const mine of this.mines) {
            if (mine.team === wire.team && Math.hypot(mine.x - hit.x, mine.y - hit.y) < 125) this.detonateMine(mine);
          }
        }
      }
    }

    getAIRangeBand(p) {
      const profiles = [];
      for (const hand of ['main','sub']) for (const id of p.loadout?.[hand] || []) {
        const trigger = DATA.triggers[id];
        const profile = this.getTriggerRangeProfile(trigger);
        if (profile) profiles.push({ ...profile, triggerId: id });
      }
      if (!profiles.length) return null;
      let relevant = profiles;
      if (p.archetype === '狙撃手') relevant = profiles.filter((x) => x.kind === 'sniper');
      else if (p.archetype === '銃手') relevant = profiles.filter((x) => x.kind === 'gun');
      else if (p.archetype === '射手') relevant = profiles.filter((x) => x.kind === 'shooter');
      else if (profiles.some((x) => x.kind === 'sniper')) relevant = profiles.filter((x) => x.kind === 'sniper');
      if (!relevant.length) relevant = profiles;
      const min = relevant.reduce((sum, x) => sum + x.min, 0) / relevant.length;
      const max = relevant.reduce((sum, x) => sum + x.max, 0) / relevant.length;
      return { min, max, preferred: min + (max - min) * (p.archetype === '狙撃手' ? .74 : .46), kind: relevant[0].kind };
    }

    getAIEngagementPoint(p, target, band, dt) {
      p.ai.engagementPointTimer = Math.max(0, (p.ai.engagementPointTimer || 0) - dt);
      const current = p.ai.engagementPoint;
      if (current && p.ai.engagementPointTimer > 0 && current.targetId === target.id) return current;
      const desired = p.archetype === '狙撃手' ? Math.max(760, band?.preferred || 760) : (band?.preferred || 330);
      const angleFromTarget = Math.atan2(p.y - target.y, p.x - target.x);
      const side = p.ai.strafe || 1;
      const offset = side * rand(-.22, .22);
      p.ai.engagementPoint = {
        targetId: target.id,
        x: clamp(target.x + Math.cos(angleFromTarget + offset) * desired, 55, this.world.w - 55),
        y: clamp(target.y + Math.sin(angleFromTarget + offset) * desired, 55, this.world.h - 55),
      };
      p.ai.engagementPointTimer = rand(1.35, 2.35);
      return p.ai.engagementPoint;
    }

    getTargetLockDuration(p) {
      const base = TARGET_LOCK_SECONDS[p.archetype] || 1;
      const scale = this.config.difficulty === 'weak' ? 1.12 : this.config.difficulty === 'normal' ? 1.04 : 1;
      return clamp(base * scale * rand(.92, 1.12), 1.5, 3.2);
    }

    updateAIConcealment(p, target, distanceToTarget, dt) {
      const active = p.toggles.bagworm || p.toggles.bagwormTag || p.toggles.chameleon;
      if (!active) {
        p.ai.concealmentTimer = 0;
        return;
      }
      p.ai.concealmentTimer += dt;
      const trionRatio = p.trion / Math.max(1, p.maxTrion);
      const recentlyHit = this.elapsed - (p.lastMajorDamageAt || -999) < 2.4;
      const combatClose = Number.isFinite(distanceToTarget) && distanceToTarget < (p.toggles.chameleon ? 220 : (p.archetype==='工作手'?290:470));
      const durationLimit = p.toggles.chameleon ? (p.archetype==='工作手'?13:8.5) : (p.archetype==='工作手'?22:12);
      const shouldRelease = recentlyHit || combatClose || trionRatio < .22 || p.ai.concealmentTimer > durationLimit || Boolean(p.operatorOrder?.type === 'focus');
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
      if (this.config.mode === 'solo') return false;
      if (!p.ai || p.human || p.dead || p.invulnTimer > 0) return false;
      p.ai.voluntaryBailoutCooldown = Math.max(0, (p.ai.voluntaryBailoutCooldown || 0) - dt);
      p.ai.voluntaryBailoutCheckTimer = Math.max(0, (p.ai.voluntaryBailoutCheckTimer || 0) - dt);
      if (threatened) p.ai.lastHostileContactAt = this.elapsed;
      if (p.ai.voluntaryBailoutCooldown > 0 || p.ai.voluntaryBailoutCheckTimer > 0 || p.metrics.currentLife < 7) return false;
      p.ai.voluntaryBailoutCheckTimer = rand(.55, 1.05);

      const roleThresholds = { '狙撃手': .18, '工作手': .18, '射手': .15, '銃手': .14, '万能手': .13, '攻撃手': .1, '重装手': .09 };
      const hpRatio = p.hp / Math.max(1, p.maxHp);
      const leadRatio=clamp((p.leadWeights||0)/8,0,1);
      const leadCritical=(p.leadWeights||0)>=4;
      const threshold = Math.max(roleThresholds[p.archetype] || .14, leadCritical ? (.34 + leadRatio*.18) : 0);
      if (hpRatio > threshold && !leadCritical) return false;

      const lastContact = Math.max(p.lastDamageAt || -999, p.ai.lastHostileContactAt || -999);
      const contactAge = this.elapsed - lastContact;
      const nearestEnemy = this.getNearestEnemyDistance(p);
      const critical = hpRatio < .055;
      if (!leadCritical && (contactAge < 4.2 || threatened || nearestEnemy < (critical ? 260 : 380))) return false;
      if (leadCritical && nearestEnemy < 170 && threatened) return false;
      if (p.operatorOrder?.type === 'focus' && !critical) return false;

      const severity = clamp((threshold - hpRatio) / Math.max(.03, threshold), 0, 1);
      const lowTrion = p.trion < p.maxTrion * .16 ? .16 : 0;
      const difficultyBonus = this.config.difficulty === 'strong' ? .14 : this.config.difficulty === 'weak' ? -.08 : 0;
      const chance = leadCritical ? clamp(.68+leadRatio*.28,0,0.96) : critical ? .9 : clamp(.16 + severity * .52 + lowTrion + difficultyBonus, .08, .78);
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
      const urgent = trionRatio < .11;

      p.ai.desertReliefOccupancyTimer = p.desertRelieved ? (p.ai.desertReliefOccupancyTimer || 0) + dt : 0;
      p.ai.desertReliefStayTimer = Math.max(0, (p.ai.desertReliefStayTimer || 0) - dt);
      p.ai.desertDepartureTimer = Math.max(0, (p.ai.desertDepartureTimer || 0) - dt);

      if (p.desertRelieved && p.ai.desertRecoveryActive) {
        p.ai.desertRecoveryActive = false;
        p.ai.desertRecoveryTimer = 0;
        p.ai.desertRecoveryPoint = null;
        p.ai.desertReliefStayTimer = urgent ? rand(.9, 1.5) : rand(.45, 1.1);
        p.ai.desertRecoveryCooldown = rand(20, 25);
        p.ai.desertDeparturePoint = this.getDesertDeparturePoint(p, target);
        p.ai.desertDepartureTimer = rand(3.2, 5.2);
        p.metrics.desertReliefVisits = (p.metrics.desertReliefVisits || 0) + 1;
      }

      const overstayed = p.desertRelieved && (p.ai.desertReliefOccupancyTimer > 1.5 || trionRatio >= .4);
      if (overstayed && !recentlyHit && !threatened && !hasOrder && targetDistance > 270 && !p.ai.desertDeparturePoint) {
        p.ai.desertDeparturePoint = this.getDesertDeparturePoint(p, target);
        p.ai.desertDepartureTimer = rand(3.2, 5.4);
        p.ai.desertRecoveryCooldown = Math.max(p.ai.desertRecoveryCooldown || 0, rand(20, 25));
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

      const stopRecovery = trionRatio >= .4 || recentlyHit || threatened || hasOrder || targetDistance < 500;
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
        && trionRatio < .22
        && targetDistance > 500
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


    isAIWallBreakable(wall, actor = null) {
      if (!(wall && wall.hp > 0 && !wall.nonBlocking && !wall.indestructible && Number.isFinite(wall.hp) && Number.isFinite(wall.maxHp || wall.hp))) return false;
      if (actor && !actor.isDefenseEnemy) {
        const friendlyOwned = Number.isInteger(wall.team) && wall.team === actor.team;
        const friendlyEscudo = wall.type === 'escudo' && (friendlyOwned || wall.ownerId === actor.id || this.players.some((unit) => unit.id === wall.ownerId && unit.team === actor.team));
        const friendlyDefenseWall = Boolean(wall.defenseBuildType) && (friendlyOwned || actor.team === 0);
        if (friendlyEscudo || friendlyDefenseWall) return false;
        if (this.isDefenseMode && actor.team === 0 && this.defenseFlag && ['barricade','escudo'].includes(wall.type)) {
          const cx = wall.x + wall.w / 2, cy = wall.y + wall.h / 2;
          if (Math.hypot(cx - this.defenseFlag.x, cy - this.defenseFlag.y) < 390) return false;
        }
      }
      return true;
    }

    findAIWallBreakTarget(p, goalX, goalY, preferred = null) {
      if (this.isAIWallBreakable(preferred, p)) return preferred;
      const candidates = this.walls.filter((wall) => {
        if (!this.isAIWallBreakable(wall, p)) return false;
        const centerX = wall.x + wall.w / 2;
        const centerY = wall.y + wall.h / 2;
        const nearby = Math.hypot(centerX - p.x, centerY - p.y) <= 390 + p.radius;
        const onRoute = this.segmentHitsExpandedRect(p.x, p.y, goalX, goalY, wall, p.radius + 9) !== null;
        return nearby && onRoute;
      });
      candidates.sort((a, b) => {
        const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
        const bx = b.x + b.w / 2, by = b.y + b.h / 2;
        return Math.hypot(ax - p.x, ay - p.y) - Math.hypot(bx - p.x, by - p.y);
      });
      return candidates[0] || null;
    }

    findAINavigationPath(p, goalX, goalY) {
      const directDistance = Math.hypot(goalX - p.x, goalY - p.y);
      if (directDistance < 80 || !this.findBlockingWall(p.x, p.y, goalX, goalY, p.radius + 6)) return [];
      const cell = clamp(Math.round((96 + p.radius * .42) / 16) * 16, 96, 144);
      const margin = clamp(560 + directDistance * .28, 620, 1380);
      const radius = p.radius + 8;
      const minX = Math.max(radius + 10, Math.min(p.x, goalX) - margin);
      const minY = Math.max(radius + 10, Math.min(p.y, goalY) - margin);
      const maxX = Math.min(this.world.w - radius - 10, Math.max(p.x, goalX) + margin);
      const maxY = Math.min(this.world.h - radius - 10, Math.max(p.y, goalY) + margin);
      const cols = Math.max(2, Math.floor((maxX - minX) / cell) + 1);
      const rows = Math.max(2, Math.floor((maxY - minY) / cell) + 1);
      const keyOf = (ix, iy) => iy * cols + ix;
      const pointOf = (ix, iy) => ({ x: minX + ix * cell, y: minY + iy * cell });
      const openMemo = new Map();
      const isOpen = (ix, iy) => {
        if (ix < 0 || iy < 0 || ix >= cols || iy >= rows) return false;
        const key = keyOf(ix, iy);
        if (openMemo.has(key)) return openMemo.get(key);
        const point = pointOf(ix, iy);
        const open = this.isAINavPointOpen(point.x, point.y, p.radius);
        openMemo.set(key, open);
        return open;
      };
      const nearestOpen = (x, y, requireStartLine = false) => {
        const baseX = clamp(Math.round((x - minX) / cell), 0, cols - 1);
        const baseY = clamp(Math.round((y - minY) / cell), 0, rows - 1);
        for (let ring = 0; ring <= 5; ring++) {
          let best = null;
          let bestDistance = Infinity;
          for (let oy = -ring; oy <= ring; oy++) for (let ox = -ring; ox <= ring; ox++) {
            if (Math.max(Math.abs(ox), Math.abs(oy)) !== ring) continue;
            const ix = baseX + ox, iy = baseY + oy;
            if (!isOpen(ix, iy)) continue;
            const point = pointOf(ix, iy);
            if (requireStartLine && this.findBlockingWall(p.x, p.y, point.x, point.y, p.radius + 4)) continue;
            const distance = Math.hypot(point.x - x, point.y - y);
            if (distance < bestDistance) { best = { ix, iy, point }; bestDistance = distance; }
          }
          if (best) return best;
        }
        return null;
      };
      const start = nearestOpen(p.x, p.y, true);
      const goal = nearestOpen(goalX, goalY, false);
      if (!start || !goal) return null;

      const heap = [];
      const push = (node) => {
        heap.push(node);
        let index = heap.length - 1;
        while (index > 0) {
          const parent = (index - 1) >> 1;
          if (heap[parent].f <= node.f) break;
          heap[index] = heap[parent]; index = parent;
        }
        heap[index] = node;
      };
      const pop = () => {
        if (!heap.length) return null;
        const root = heap[0];
        const tail = heap.pop();
        if (heap.length && tail) {
          let index = 0;
          while (true) {
            const left = index * 2 + 1, right = left + 1;
            if (left >= heap.length) break;
            const child = right < heap.length && heap[right].f < heap[left].f ? right : left;
            if (heap[child].f >= tail.f) break;
            heap[index] = heap[child]; index = child;
          }
          heap[index] = tail;
        }
        return root;
      };
      const startKey = keyOf(start.ix, start.iy);
      const goalKey = keyOf(goal.ix, goal.iy);
      const gScore = new Map([[startKey, 0]]);
      const cameFrom = new Map();
      const closed = new Set();
      const heuristic = (ix, iy) => {
        const dx = Math.abs(goal.ix - ix), dy = Math.abs(goal.iy - iy);
        return cell * (Math.max(dx, dy) + .4142 * Math.min(dx, dy));
      };
      push({ key: startKey, ix: start.ix, iy: start.iy, f: heuristic(start.ix, start.iy) });
      const directions = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      let expansions = 0;
      let found = false;
      while (heap.length && expansions < 1900) {
        const current = pop();
        if (!current || closed.has(current.key)) continue;
        if (current.key === goalKey) { found = true; break; }
        closed.add(current.key); expansions++;
        const currentPoint = pointOf(current.ix, current.iy);
        for (const [dx, dy] of directions) {
          const nx = current.ix + dx, ny = current.iy + dy;
          if (!isOpen(nx, ny)) continue;
          if (dx && dy && (!isOpen(current.ix + dx, current.iy) || !isOpen(current.ix, current.iy + dy))) continue;
          const nextPoint = pointOf(nx, ny);
          if (this.findBlockingWall(currentPoint.x, currentPoint.y, nextPoint.x, nextPoint.y, p.radius + 3)) continue;
          const nextKey = keyOf(nx, ny);
          if (closed.has(nextKey)) continue;
          const tentative = (gScore.get(current.key) ?? Infinity) + cell * (dx && dy ? 1.4142 : 1);
          if (tentative >= (gScore.get(nextKey) ?? Infinity)) continue;
          cameFrom.set(nextKey, current.key);
          gScore.set(nextKey, tentative);
          push({ key: nextKey, ix: nx, iy: ny, f: tentative + heuristic(nx, ny) });
        }
      }
      if (!found) return null;
      const raw = [];
      let cursor = goalKey;
      while (cursor !== startKey && cameFrom.has(cursor)) {
        const ix = cursor % cols;
        const iy = Math.floor(cursor / cols);
        raw.push(pointOf(ix, iy));
        cursor = cameFrom.get(cursor);
      }
      raw.reverse();
      if (!raw.length) return [];
      const simplified = [];
      let anchor = { x: p.x, y: p.y };
      let index = 0;
      while (index < raw.length) {
        let farthest = index;
        for (let probe = index; probe < Math.min(raw.length, index + 7); probe++) {
          const point = raw[probe];
          if (this.findBlockingWall(anchor.x, anchor.y, point.x, point.y, p.radius + 4)) break;
          farthest = probe;
        }
        const point = raw[farthest];
        simplified.push(point);
        anchor = point;
        index = farthest + 1;
      }
      return simplified.slice(0, 28);
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

    chooseAIMovementMode(p, distanceToTarget, preferred, role, lowHeavyResources, hasSniper, dt, rangeBand = null) {
      p.ai.movementModeTimer = Math.max(0, (p.ai.movementModeTimer || 0) - dt);
      p.ai.strafeTimer = Math.max(0, (p.ai.strafeTimer || 0) - dt);
      if (p.ai.strafeTimer <= 0) { p.ai.strafeTimer = rand(1.7, 3.3); if (Math.random() < .42) p.ai.strafe *= -1; }
      let desired = p.ai.movementMode || 'advance';
      const personality = p.aiPersonality || { calmness:.5, aggression:.5 };
      const calmness = clamp(personality.calmness,0,1), aggression = clamp(personality.aggression,0,1);
      if (lowHeavyResources) desired = 'retreat';
      else if (aggression < .24 && distanceToTarget < preferred * 1.28) desired = calmness > .42 ? 'retreat' : 'strafe';
      else if (aggression > .8 && distanceToTarget > preferred * .72) desired = 'advance';
      else if (calmness < .2 && p.hp < p.maxHp * .38 && aggression > .48) desired = 'advance';
      else if (role === '工作手' && distanceToTarget < 430) desired = 'retreat';
      else if (rangeBand && distanceToTarget < rangeBand.min * .92) desired = 'retreat';
      else if (rangeBand && distanceToTarget > rangeBand.max * 1.03) desired = 'advance';
      else if (rangeBand && distanceToTarget >= rangeBand.min && distanceToTarget <= rangeBand.max) desired = hasSniper ? 'hold' : 'strafe';
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
      p.ai.navPathRecalcTimer = Math.max(0, (p.ai.navPathRecalcTimer || 0) - dt);
      this.updateAINavigationProgress(p, dt, movementScale > .18, goalX, goalY);

      if (p.ai.wallBreakTimer <= 0) p.ai.wallBreakTarget = null;
      const pathGoalMoved = Number.isFinite(p.ai.navPathGoalX)
        && Math.hypot(goalX - p.ai.navPathGoalX, goalY - p.ai.navPathGoalY) > 260;
      if (pathGoalMoved) { p.ai.navPath = []; p.ai.navPathIndex = 0; }

      let path = Array.isArray(p.ai.navPath) ? p.ai.navPath : [];
      let pathIndex = p.ai.navPathIndex || 0;
      while (pathIndex < path.length && Math.hypot(path[pathIndex].x - p.x, path[pathIndex].y - p.y) < Math.max(46, p.radius * 2.15)) pathIndex++;
      if (pathIndex < path.length) {
        for (let probe = Math.min(path.length - 1, pathIndex + 3); probe > pathIndex; probe--) {
          if (!this.findBlockingWall(p.x, p.y, path[probe].x, path[probe].y, p.radius + 4)) { pathIndex = probe; break; }
        }
        const waypoint = path[pathIndex];
        if (this.findBlockingWall(p.x, p.y, waypoint.x, waypoint.y, p.radius + 4)) {
          p.ai.navPath = []; p.ai.navPathIndex = 0; path = [];
        } else {
          p.ai.navPathIndex = pathIndex;
          p.ai.failedDetours = Math.max(0, (p.ai.failedDetours || 0) - dt * .7);
          return Math.atan2(waypoint.y - p.y, waypoint.x - p.x);
        }
      } else if (path.length) {
        p.ai.navPath = []; p.ai.navPathIndex = 0;
      }

      if (p.ai.avoidWaypoint) {
        const reached = Math.hypot(p.ai.avoidWaypoint.x - p.x, p.ai.avoidWaypoint.y - p.y) < Math.max(38, p.radius * 2.2);
        const wallGone = !this.walls.some((wall) => wall.id === p.ai.avoidWallId && wall.hp > 0);
        if (reached || wallGone || p.ai.avoidTimer <= 0) {
          p.ai.avoidWaypoint = null;
          p.ai.avoidWallId = null;
        }
      }

      let blocker = p.ai.navBlockerId ? this.walls.find((wall) => wall.id === p.ai.navBlockerId && wall.hp > 0) || null : null;
      if (p.ai.navCheckTimer <= 0) {
        blocker = this.findBlockingWall(p.x, p.y, goalX, goalY, p.radius + 7);
        p.ai.navBlockerId = blocker?.id || null;
        p.ai.navCheckTimer = .18;
      }

      if (blocker && p.ai.navPathRecalcTimer <= 0) {
        const planned = this.findAINavigationPath(p, goalX, goalY);
        p.ai.navPathRecalcTimer = rand(.78, 1.18);
        p.ai.navPathGoalX = goalX; p.ai.navPathGoalY = goalY;
        if (planned && planned.length) {
          p.ai.navPath = planned;
          p.ai.navPathIndex = 0;
          p.ai.failedDetours = 0;
          p.ai.avoidWaypoint = null; p.ai.avoidWallId = null;
          p.metrics.aiWallAvoidances = (p.metrics.aiWallAvoidances || 0) + 1;
          return Math.atan2(planned[0].y - p.y, planned[0].x - p.x);
        }
        p.ai.failedDetours = (p.ai.failedDetours || 0) + 1;
      }

      if (blocker && p.ai.wallBreakTarget !== blocker.id && (!p.ai.avoidWaypoint || p.ai.avoidWallId !== blocker.id)) {
        const waypoint = this.chooseAIWallDetour(p, blocker, goalX, goalY);
        if (waypoint) {
          p.ai.avoidWaypoint = waypoint;
          p.ai.avoidWallId = blocker.id;
          p.ai.avoidTimer = 3.2;
          p.ai.recentNavPoints = [...(p.ai.recentNavPoints || []).slice(-4), { x: waypoint.x, y: waypoint.y }];
        }
      }

      const shouldBreak = blocker && ((p.ai.failedDetours || 0) >= 3 || p.ai.stuckTimer > 5.2);
      if (shouldBreak && !p.ai.wallBreakTarget) {
        const breakWall = this.findAIWallBreakTarget(p, goalX, goalY, blocker);
        if (breakWall) {
          p.ai.wallBreakTarget = breakWall.id;
          p.ai.wallBreakTimer = 4.8;
          p.ai.navPath = []; p.ai.navPathIndex = 0;
          p.ai.avoidWaypoint = null; p.ai.avoidWallId = null;
          p.ai.stuckTimer = Math.max(1.8, p.ai.stuckTimer * .45);
          p.metrics.aiWallBreakFallbacks = (p.metrics.aiWallBreakFallbacks || 0) + 1;
        }
      }

      if (!blocker && p.ai.avoidWaypoint && !this.findBlockingWall(p.x, p.y, goalX, goalY, p.radius + 5)) {
        p.ai.avoidWaypoint = null; p.ai.avoidWallId = null;
      }
      if (!blocker) {
        p.ai.failedDetours = Math.max(0, (p.ai.failedDetours || 0) - dt * 1.6);
        p.ai.navPath = []; p.ai.navPathIndex = 0;
      }

      if (p.ai.wallBreakTarget) {
        const wall = this.walls.find((candidate) => candidate.id === p.ai.wallBreakTarget && candidate.hp > 0);
        if (wall && this.isAIWallBreakable(wall, p)) return Math.atan2(wall.y + wall.h / 2 - p.y, wall.x + wall.w / 2 - p.x);
        p.ai.wallBreakTarget = null; p.ai.wallBreakTimer = 0;
      }
      if (p.ai.avoidWaypoint) return Math.atan2(p.ai.avoidWaypoint.y - p.y, p.ai.avoidWaypoint.x - p.x);
      if (p.ai.stuckTimer > 1.9 && !p.ai.escapeWaypoint) {
        const escape = this.chooseAIStuckEscape(p, goalX, goalY);
        if (escape) { p.ai.escapeWaypoint = escape; p.ai.escapeTimer = rand(1.4, 2.2); p.metrics.aiStuckEscapes = (p.metrics.aiStuckEscapes || 0) + 1; }
      }
      return fallbackAngle;
    }


    aiTryBreakNavigationWall(p) {
      const wall = this.walls.find((candidate) => candidate.id === p.ai.wallBreakTarget && candidate.hp > 0);
      if (!this.isAIWallBreakable(wall, p)) {
        p.ai.wallBreakTarget = null; p.ai.wallBreakTimer = 0;
        return false;
      }
      const cx = wall.x + wall.w / 2;
      const cy = wall.y + wall.h / 2;
      const closestX = clamp(p.x, wall.x, wall.x + wall.w);
      const closestY = clamp(p.y, wall.y, wall.y + wall.h);
      const edgeDistance = Math.hypot(closestX - p.x, closestY - p.y);
      p.aim = Math.atan2(cy - p.y, cx - p.x);
      if (edgeDistance > 620) return false;
      if ((p.ai.attackTimer || 0) > 0) return true;

      let choice = null;
      if (edgeDistance <= 178 + p.radius) {
        choice = this.findTriggerHand(p, (trigger) => trigger.kind === 'melee');
        if (choice && !this.slotReady(p, choice.hand, choice.index, choice.trigger)) choice = null;
      }
      if (!choice) {
        const candidates = [];
        for (const hand of ['main', 'sub']) for (let index = 0; index < p.loadout[hand].length; index++) {
          const trigger = DATA.triggers[p.loadout[hand][index]];
          if (!trigger || !['gun', 'shooter', 'sniper'].includes(trigger.kind) || !this.slotReady(p, hand, index, trigger)) continue;
          const range = this.getTriggerRangeProfile(trigger)?.max || 520;
          if (edgeDistance > range * 1.08) continue;
          candidates.push({ hand, index, trigger, range });
        }
        candidates.sort((a, b) => b.range - a.range);
        choice = candidates[0] || null;
      }
      if (!choice) return true;
      p.selected[choice.hand] = choice.index;
      if (choice.trigger.id === 'scorpion') p.scorpionMode[choice.hand] = edgeDistance > 118 ? 1 : 0;
      const used = this.tryUseHand(p, choice.hand, { shift: choice.trigger.id === 'kogetsu' && edgeDistance > 105 });
      p.ai.attackTimer = used ? (choice.trigger.kind === 'melee' ? .32 : .46) : .12;
      return true;
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

    getAICoverPoint(p, target, desiredDistance = 330) {
      if (!p || !target) return null;
      p.ai ||= {};
      p.ai.coverPointTimer = Math.max(0, Number(p.ai.coverPointTimer || 0));
      const cached = p.ai.coverPoint;
      if (cached && p.ai.coverPointTimer > 0 && cached.targetId === target.id
        && this.isAINavPointOpen(cached.x, cached.y, p.radius)
        && this.findBlockingWall(target.x, target.y, cached.x, cached.y, 4)) return cached;
      const candidates = [];
      const margin = Math.max(42, p.radius + 22);
      for (const wall of this.walls) {
        if (wall.hp <= 0 || wall.nonBlocking) continue;
        const wcx = wall.x + wall.w / 2, wcy = wall.y + wall.h / 2;
        if (Math.hypot(wcx - p.x, wcy - p.y) > 760) continue;
        const points = [
          {x:wall.x-margin,y:wall.y-margin},{x:wall.x+wall.w+margin,y:wall.y-margin},
          {x:wall.x-margin,y:wall.y+wall.h+margin},{x:wall.x+wall.w+margin,y:wall.y+wall.h+margin},
          {x:wcx,y:wall.y-margin},{x:wcx,y:wall.y+wall.h+margin},
          {x:wall.x-margin,y:wcy},{x:wall.x+wall.w+margin,y:wcy},
        ];
        for (const point of points) {
          point.x = clamp(point.x, 55, this.world.w - 55); point.y = clamp(point.y, 55, this.world.h - 55);
          if (!this.isAINavPointOpen(point.x, point.y, p.radius)) continue;
          if (!this.findBlockingWall(target.x, target.y, point.x, point.y, 4)) continue;
          const targetDistance = Math.hypot(point.x-target.x,point.y-target.y);
          if (targetDistance < Math.max(150, desiredDistance*.48)) continue;
          const travel = Math.hypot(point.x-p.x,point.y-p.y);
          const rangePenalty = Math.abs(targetDistance-desiredDistance)*.34;
          const cornerPenalty = this.isAINearWorldCorner(point.x,point.y,150) ? 280 : 0;
          candidates.push({...point,targetId:target.id,score:travel+rangePenalty+cornerPenalty});
        }
      }
      candidates.sort((a,b)=>a.score-b.score);
      p.ai.coverPoint = candidates[0] || null;
      p.ai.coverPointTimer = candidates[0] ? rand(1.1,2.1) : .45;
      return p.ai.coverPoint;
    }

    isAINearWorldCorner(x, y, margin = 135) {
      return (x < margin || x > this.world.w-margin) && (y < margin || y > this.world.h-margin);
    }

    getAICenterEscapePoint(p) {
      const cx=this.world.w/2, cy=this.world.h/2;
      const a=Math.atan2(cy-p.y,cx-p.x)+rand(-.28,.28);
      return {x:clamp(p.x+Math.cos(a)*320,90,this.world.w-90),y:clamp(p.y+Math.sin(a)*320,90,this.world.h-90)};
    }

    getDefenseFlagThreatState() {
      const flag = this.defenseFlag;
      if (!this.isDefenseMode || !flag) return null;
      const enemies = this.players.filter((unit) => unit.isDefenseEnemy && !unit.dead);
      const near = enemies.filter((unit) => Math.hypot(unit.x - flag.x, unit.y - flag.y) < 720);
      const close = near.filter((unit) => Math.hypot(unit.x - flag.x, unit.y - flag.y) < 360);
      const flagFocused = near.filter((unit) => unit.defenseAI?.objectiveMode === 'flag' || unit.defenseAI?.objectiveId === 'defense-flag');
      const incoming = this.defenseHazards.filter((hazard) => hazard.hitsFlag && hazard.delay > 0 && hazard.delay < 1.35);
      const hostileArea = this.defenseAreas.filter((area) => area.hitsFlag && area.owner?.isDefenseEnemy && Math.hypot(area.x - flag.x, area.y - flag.y) < area.radius + flag.radius + 90);
      const ratio = flag.hp / Math.max(1, flag.maxHp);
      const pressure = close.length * 2 + near.length * .45 + flagFocused.length * .8 + incoming.length * 1.7 + hostileArea.length * 1.4;
      return {
        flag, enemies, near, close, flagFocused, incoming, hostileArea, ratio, pressure,
        underAttack: pressure >= 1.5 || this.elapsed - flag.lastDamageAt < 4.5,
        critical: ratio < .42 || pressure >= 5,
        severe: ratio < .24 || pressure >= 8,
      };
    }

    getAIGuardOption(p) {
      if (!p || p.dead) return null;
      const type = p.playableDefenseType || p.defenseType;
      if (type === 'seals') return { hand:'sub', index:0, type:'seal', boost:clamp(p.extraBoost || p.defenseAI?.sealBoost || 1, 1, 3) };
      const support = { sogetsu:{hand:'main',index:2,type:'shield'}, fullarms:{hand:'main',index:2,type:'shield'}, geist:{hand:'main',index:3,type:'shield'} }[type];
      if (support) return support;
      const raygust = !type ? this.findTriggerHand(p, (trigger) => trigger.id === 'raygust') : null;
      const shield = !type ? this.findTriggerHand(p, (trigger) => trigger.kind === 'shield') : null;
      const selected = raygust && (p.archetype === '重装手' || !shield) ? raygust : (shield || raygust);
      if (!selected) return null;
      return { hand:selected.hand, index:selected.index, type:selected.trigger.id === 'raygust' ? 'raygust' : 'shield' };
    }

    activateAIGuard(p, facingAngle, duration = .42, options = {}) {
      const guard = this.getAIGuardOption(p);
      if (!guard) return false;
      p.aim = facingAngle;
      p.selected[guard.hand] = guard.index;
      p.ai ||= {};
      p.ai.defenseCommitTimer = Math.max(p.ai.defenseCommitTimer || 0, duration);
      if (options.extend !== false) p.ai.sustainedGuardUntil = Math.max(p.ai.sustainedGuardUntil || 0, this.elapsed + duration);
      p.defenseAI ||= {};
      p.defenseAI.shieldTimer = Math.max(p.defenseAI.shieldTimer || 0, duration);
      p.defenseAI.shieldHand = guard.hand;
      if (guard.type === 'seal') p.defenseAI.sealBoost = guard.boost;
      return this.activateShield(p, guard.hand, guard.type, { boost:guard.boost || 1, masteryAttempt:Boolean(options.masteryAttempt) });
    }

    maintainAIGuardPosture(p, target, threatInfo = null) {
      if (!p?.ai || p.dead) return false;
      const guard = this.getAIGuardOption(p);
      if (!guard) return false;
      const targetDistance = target ? Math.hypot(target.x - p.x, target.y - p.y) : Infinity;
      const raygustPreferred = guard.type === 'raygust'
        && p.trion > p.maxTrion * .12
        && targetDistance < 1120
        && this.elapsed >= (p.ai.raygustTacticalReleaseUntil || 0);
      const sustained = (p.ai.sustainedGuardUntil || 0) > this.elapsed;
      if (!raygustPreferred && !sustained) return false;
      const facing = target ? Math.atan2(target.y - p.y, target.x - p.x) : p.aim;
      p.selected[guard.hand] = guard.index;
      p.defenseAI ||= {};
      p.defenseAI.shieldTimer = Math.max(p.defenseAI.shieldTimer || 0, .2);
      p.defenseAI.shieldHand = guard.hand;
      if (guard.type === 'seal') p.defenseAI.sealBoost = guard.boost;
      return this.activateShield(p, guard.hand, guard.type, {
        boost:guard.boost || 1,
        masteryAttempt:Boolean(threatInfo),
        extend:false,
      });
    }

    markRaygustTacticalRelease(p, hand, trigger) {
      if (!p?.ai || !hand || trigger?.id === 'raygust') return;
      const guard = this.getAIGuardOption(p);
      if (!guard || guard.type !== 'raygust' || guard.hand !== hand) return;
      const state = p.shieldDurability?.[hand];
      if (state?.type === 'raygust') state.tacticalReleaseUntil = Math.max(state.tacticalReleaseUntil || 0, this.elapsed + .34);
      p.ai.raygustTacticalReleaseUntil = Math.max(p.ai.raygustTacticalReleaseUntil || 0, this.elapsed + .3);
      p.ai.sustainedGuardUntil = Math.max(p.ai.sustainedGuardUntil || 0, this.elapsed + .72);
    }

    moveAIToStrategicPoint(p, point, dt, speedScale = 1.1) {
      if (!p?.ai || !point) return false;
      let angle = Math.atan2(point.y - p.y, point.x - p.x);
      angle = this.getAINavigationAngle(p, point.x, point.y, angle, dt, speedScale);
      angle = this.stabilizeAIMovementAngle(p, angle, point.x, point.y, dt, speedScale);
      p.vx += Math.cos(angle) * p.speed * dt * 4.55 * speedScale;
      p.vy += Math.sin(angle) * p.speed * dt * 4.55 * speedScale;
      this.applyAISeparation(p, dt, Boolean(p.isDefenseEnemy));
      p.aim += clamp(angleDiff(angle, p.aim), -5.5 * dt, 5.5 * dt);
      return true;
    }

    getSubwayEscapePoint(p) {
      if (this.mapId !== 'underground') return null;
      const candidates = [
        ...(this.terrain.subwayPlatforms || []), ...(this.terrain.subwayPassengerZones || []), ...(this.terrain.subwayServiceZones || [])
      ].map((rect) => ({
        x: clamp(p.x, rect.x + 42, rect.x + rect.w - 42),
        y: clamp(p.y, rect.y + 42, rect.y + rect.h - 42),
      })).filter((point) => this.isUndergroundSafePoint(point.x, point.y, 24));
      candidates.sort((a,b) => Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
      if (candidates[0]) return candidates[0];
      const track = this.terrain.subwayTracks?.[0];
      if (!track) return null;
      const above = { x:clamp(p.x, 70, this.world.w-70), y:track.y - 92 };
      const below = { x:clamp(p.x, 70, this.world.w-70), y:track.y + track.h + 92 };
      return Math.abs(p.y-above.y) < Math.abs(p.y-below.y) ? above : below;
    }

    updateAIDangerAvoidance(p, dt) {
      if (!p || p.dead || p.human || !p.ai) return false;
      p.ai.dangerEscapeTimer = Math.max(0, (p.ai.dangerEscapeTimer || 0) - dt);
      let escape = null;
      let urgency = 0;
      if (this.mapId === 'underground') {
        const subway = this.environment.subway || {};
        const onTrack = this.isOnSubwayTrack(p.x, p.y, p.radius + 8);
        const nearTrack = this.isOnSubwayTrack(p.x, p.y, p.radius + 90);
        const trainActive = Boolean(subway.trainActive);
        const countdown = Number(subway.trainTimer || 99);
        const track = this.terrain.subwayTracks?.[0];
        const crossingSeconds = track
          ? clamp(track.h / Math.max(110, (p.speed || 150) * 1.12) + 1.1, 3.2, 5.2)
          : 4.2;
        // The track is a valid route while no train is approaching. Evacuate only when
        // the current crossing cannot be completed before the next train arrives.
        const unsafeToCross = trainActive || countdown <= crossingSeconds;
        const platformWarning = trainActive || countdown <= Math.min(2.8, crossingSeconds * .62);
        if ((onTrack && unsafeToCross) || (nearTrack && platformWarning)) {
          escape = this.getSubwayEscapePoint(p);
          urgency = onTrack ? 2 : 1.3;
        }
      }
      let awayX = 0, awayY = 0, dangerCount = 0;
      const consider = (x, y, radius, weight = 1) => {
        const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx,dy) || 1;
        if (d > radius) return;
        awayX += dx / d * weight * (1 - d / Math.max(1,radius));
        awayY += dy / d * weight * (1 - d / Math.max(1,radius));
        dangerCount++;
      };
      for (const hazard of this.defenseHazards || []) {
        if (!hazard.owner || !this.canDamage(hazard.owner, p) || hazard.delay < 0 || hazard.delay > 1.1) continue;
        if (hazard.type === 'circle') consider(hazard.x,hazard.y,(hazard.radius||90)+p.radius+75,1.5);
        else if (hazard.type === 'ring') {
          const d = Math.hypot(p.x-hazard.x,p.y-hazard.y);
          if (Math.abs(d-(hazard.radius||0)) < (hazard.width||24)+p.radius+55) consider(hazard.x,hazard.y,d+1,1.25);
        } else if (hazard.type === 'line') {
          const info = segmentPointDistance(hazard.x,hazard.y,hazard.x2,hazard.y2,p.x,p.y);
          if (info.distance < (hazard.width||24)+p.radius+65) consider(info.x,info.y,(hazard.width||24)+p.radius+90,1.7);
        }
      }
      for (const area of this.defenseAreas || []) {
        if (!area.owner || !this.canDamage(area.owner,p)) continue;
        consider(area.x,area.y,(area.radius||90)+p.radius+65,1.15);
      }
      for (const facility of this.installations || []) {
        if (!facility.active || facility.hp <= 0 || facility.type !== 'trap') continue;
        if (facility.team === p.team && (this.config.mode === 'team' || this.isDefenseMode)) continue;
        consider(facility.x,facility.y,(facility.radius||24)+165,1.1);
      }
      if (!escape && dangerCount && Math.hypot(awayX,awayY) > .05) {
        const a = Math.atan2(awayY,awayX);
        escape = { x:clamp(p.x+Math.cos(a)*220,55,this.world.w-55), y:clamp(p.y+Math.sin(a)*220,55,this.world.h-55) };
        urgency = 1.25;
      }
      if (!escape) return false;
      p.ai.dangerEscapeTimer = Math.max(p.ai.dangerEscapeTimer || 0, .65);
      p.ai.navPath = []; p.ai.navPathIndex = 0;
      return this.moveAIToStrategicPoint(p, escape, dt, urgency || 1.15);
    }

    updateDefenseStrategicAI(p, dt) {
      if (!this.isDefenseMode || !this.defenseFlag || !p || p.dead || p.human || p.isDefenseEnemy || !p.ai) return false;
      const state = this.getDefenseFlagThreatState();
      if (!state) return false;
      p.ai.flagDutyTimer = Math.max(0, (p.ai.flagDutyTimer || 0) - dt);
      p.ai.flagBaitTimer = Math.max(0, (p.ai.flagBaitTimer || 0) - dt);
      const allies = this.players.filter((unit) => !unit.isDefenseEnemy && !unit.dead && !unit.human);
      const byFlag = [...allies].sort((a,b) => Math.hypot(a.x-state.flag.x,a.y-state.flag.y)-Math.hypot(b.x-state.flag.x,b.y-state.flag.y));
      const repairers = [...allies].filter((unit) => unit.trion > unit.maxTrion * .38).sort((a,b) => {
        const sa = Math.hypot(a.x-state.flag.x,a.y-state.flag.y) - a.trion/a.maxTrion*180;
        const sb = Math.hypot(b.x-state.flag.x,b.y-state.flag.y) - b.trion/b.maxTrion*180;
        return sa-sb;
      });
      const hostileNearRepair = state.close.some((enemy) => Math.hypot(enemy.x-state.flag.x,enemy.y-state.flag.y)<285);
      const repairCount = state.ratio < .28 ? 2 : 1;
      if (state.ratio < .55 && !state.underAttack && !hostileNearRepair && repairers.slice(0,repairCount).includes(p)) {
        const d = Math.hypot(p.x-state.flag.x,p.y-state.flag.y);
        if (d > state.flag.radius + p.radius + 42) return this.moveAIToStrategicPoint(p, state.flag, dt, 1.08);
        p.vx *= Math.pow(.03,dt); p.vy *= Math.pow(.03,dt);
        return true;
      }

      const incomingLine = state.incoming.filter((hazard) => hazard.type === 'line').sort((a,b)=>a.delay-b.delay)[0];
      const guardUnits = allies.filter((unit) => this.getAIGuardOption(unit)).sort((a,b) => Math.hypot(a.x-state.flag.x,a.y-state.flag.y)-Math.hypot(b.x-state.flag.x,b.y-state.flag.y));
      if (incomingLine && guardUnits.slice(0,state.severe?3:2).includes(p)) {
        const ox = Number.isFinite(incomingLine.originX) ? incomingLine.originX : incomingLine.x;
        const oy = Number.isFinite(incomingLine.originY) ? incomingLine.originY : incomingLine.y;
        const a = Math.atan2(state.flag.y-oy,state.flag.x-ox);
        const intercept = { x:state.flag.x-Math.cos(a)*(state.flag.radius+p.radius+34), y:state.flag.y-Math.sin(a)*(state.flag.radius+p.radius+34) };
        const d = Math.hypot(p.x-intercept.x,p.y-intercept.y);
        if (d > 42) this.moveAIToStrategicPoint(p, intercept, dt, 1.35);
        this.activateAIGuard(p, Math.atan2(oy-p.y,ox-p.x), Math.max(.34,incomingLine.delay+.2), {masteryAttempt:true});
        return true;
      }

      if (state.underAttack) {
        const returnCount = clamp(1 + Math.ceil(state.pressure/4.2) + (state.severe?1:0), 1, Math.min(4,allies.length));
        if (byFlag.slice(0,returnCount).includes(p)) {
          const angleSeed = (byFlag.indexOf(p)+1)*2.3999632297;
          const ring = 135 + (byFlag.indexOf(p)%2)*70;
          p.operatorOrder = {type:'defend',x:state.flag.x+Math.cos(angleSeed)*ring,y:state.flag.y+Math.sin(angleSeed)*ring,label:'必要人数で旗を守る'};
          const threat = this.getProjectileThreatInfo(p,.8);
          if (threat && this.getAIGuardOption(p)) this.activateAIGuard(p,threat.sourceAngle,.5,{masteryAttempt:true});
        }
        const baitCandidates = allies.filter((unit) => unit.archetype !== '狙撃手' && unit.archetype !== '工作手' && unit.hp > unit.maxHp*.62).sort((a,b) => (b.stats?.combat||0)-(a.stats?.combat||0));
        const bait = baitCandidates[0];
        const enemy = [...state.flagFocused,...state.close,...state.near][0];
        if (bait === p && enemy && p.ai.flagBaitTimer <= 0) {
          const away = Math.atan2(enemy.y-state.flag.y,enemy.x-state.flag.x);
          p.operatorOrder = { type:'suppress', x:clamp(enemy.x+Math.cos(away)*250,60,this.world.w-60), y:clamp(enemy.y+Math.sin(away)*250,60,this.world.h-60), radius:280, label:'囮・敵を旗から引き離す' };
          p.ai.target = enemy.id; p.ai.targetType='player'; p.ai.targetLockTimer=2.8;
          p.ai.flagBaitTimer = 5.2;
          this.addThreat(enemy,p,30,'noise',5.5);
        }
      } else if (p.operatorOrder?.label === '必要人数で旗を守る' || p.operatorOrder?.label === 'フラッグ緊急防衛') {
        p.operatorOrder = null;
      }
      return false;
    }

    getCpuSubwayStrategicOrder(teamUnits) {
      if (this.mapId !== 'underground' || !teamUnits?.length) return null;
      const subway = this.environment.subway || {};
      const state = this.getDefenseFlagThreatState();
      const enemies = this.players.filter((unit) => unit.isDefenseEnemy && !unit.dead);
      const alliesInWater = teamUnits.filter((unit) => (this.terrain.subwayWaterways||[]).some((water)=>this.isPointInRect(unit.x,unit.y,water))).length;
      const enemiesInWater = enemies.filter((unit) => (this.terrain.subwayWaterways||[]).some((water)=>this.isPointInRect(unit.x,unit.y,water))).length;
      let kind = null, desired = null;
      const trainSoon = subway.trainActive || Number(subway.trainTimer||99)<4.5;
      if (trainSoon && !subway.homeDoorsClosed) { kind='platformSwitch'; desired='close'; }
      else if (!subway.waterDrained && (alliesInWater>0 || state?.underAttack)) { kind='waterGateSwitch'; desired='drain'; }
      else if (subway.waterDrained && enemiesInWater>=2 && alliesInWater===0 && !state?.critical) { kind='waterGateSwitch'; desired='fill'; }
      else if (subway.breakerOff && state?.underAttack) { kind='breakerSwitch'; desired='on'; }
      else {
        const rangedEnemies = enemies.filter((unit)=>['skeletonShooter','skeletonSniper','fujin','seals','alektor','organon'].includes(unit.defenseType)).length;
        if (!subway.breakerOff && rangedEnemies>=3 && !state?.critical) { kind='breakerSwitch'; desired='off'; }
      }
      if (!kind) return null;
      const controls = this.lightSources.filter((light)=>light.kind===kind && light.hp>0);
      let best = null;
      for (const control of controls) for (const unit of teamUnits) {
        const d=Math.hypot(unit.x-control.x,unit.y-control.y);
        if (d>560) continue;
        if (!best || d<best.distance) best={unit,control,distance:d,desired};
      }
      return best;
    }

    absorbFlagHazardWithShield(hazard, amount) {
      if (!this.isDefenseMode || !this.defenseFlag || !hazard || amount<=0) return false;
      const flag=this.defenseFlag;
      const ox=Number.isFinite(hazard.originX)?hazard.originX:hazard.x;
      const oy=Number.isFinite(hazard.originY)?hazard.originY:hazard.y;
      const defenders=this.players.filter((unit)=>!unit.isDefenseEnemy&&!unit.dead&&this.getActiveShieldEntries(unit).length);
      const eligible=defenders.filter((unit)=>{
        if (Math.hypot(unit.x-flag.x,unit.y-flag.y)>230) return false;
        if (hazard.type==='line') return segmentPointDistance(ox,oy,flag.x,flag.y,unit.x,unit.y).distance <= (hazard.width||24)+unit.radius+32;
        return Math.hypot(unit.x-flag.x,unit.y-flag.y)<=flag.radius+unit.radius+90;
      }).sort((a,b)=>Math.hypot(a.x-flag.x,a.y-flag.y)-Math.hypot(b.x-flag.x,b.y-flag.y));
      const guard=eligible[0];
      if (!guard) return false;
      const entries=this.getActiveShieldEntries(guard).sort((a,b)=>(b.state.current*b.shield.strength)-(a.state.current*a.shield.strength));
      let remaining=amount;
      for (const entry of entries) {
        const capacity=entry.state.current*entry.shield.strength;
        const absorbed=Math.min(remaining,capacity);
        entry.state.current=Math.max(0,entry.state.current-absorbed/Math.max(.4,entry.shield.strength));
        entry.state.lastHitAt=this.elapsed; entry.state.justGuardAvailable=false;
        remaining-=absorbed;
        guard.metrics.blockedDamage += absorbed;
        guard.metrics.shieldDamagePrevented += absorbed;
        guard.metrics.shieldBlocks += 1;
        if(entry.state.current<=.001)this.breakShield(guard,entry.hand,entry.state);
        if(remaining<=.001)break;
      }
      this.effects.push({type:'shieldHit',x:guard.x,y:guard.y,angle:Math.atan2(oy-guard.y,ox-guard.x),ttl:.24,maxTtl:.24});
      if (remaining<=.001) {
        this.logEvent('flag_guard',`${guard.name}が${hazard.name||'攻撃'}を遮断`,false);
        return true;
      }
      hazard._flagGuardRemainder=remaining;
      return false;
    }

    updateAI(p, dt) {
      if (p.dead) return;
      if ((p.cubedTimer || 0) > 0) { p.vx *= Math.pow(.02, dt); p.vy *= Math.pow(.02, dt); return; }
      const baseProfile = AI_DIFFICULTIES[this.config.difficulty] || AI_DIFFICULTIES.normal;
      const tier = AI_TIER_PROFILES[p.aiTier] || AI_TIER_PROFILES.middle;
      const personality = p.aiPersonality || { calmness:.5, aggression:.5 };
      const calmness = clamp(personality.calmness, 0, 1), aggression = clamp(personality.aggression, 0, 1);
      const emotionalRisk = 1 - calmness;
      const attackDrive = tier.aggression * (.64 + aggression * .78) * (.94 + emotionalRisk * .14);
      const profile = {
        ...baseProfile,
        calmness, aggression, emotionalRisk,
        aimError: baseProfile.aimError * tier.aim * (1.14 - calmness * .22),
        move: baseProfile.move * (.88 + tier.decision * .12),
        attackInterval: baseProfile.attackInterval.map((v) => v / Math.max(.42, attackDrive)),
        utilityChance: clamp(baseProfile.utilityChance * tier.decision * (.78 + calmness * .35), 0, 1),
        comboChance: clamp(baseProfile.comboChance * tier.decision * (.65 + calmness * .48), 0, 1),
        shieldChance: clamp(baseProfile.shieldChance * (tier.defense || 1) * (.72 + calmness * .52) * (1.22 - aggression * .38), 0, 1),
        guardSkill: clamp((baseProfile.guardSkill || 0) * (tier.defense || 1) * (.62 + calmness * .5), 0, 1),
        parrySkill: clamp((baseProfile.parrySkill || 0) * (tier.defense || 1) * (.5 + calmness * .62), 0, 1),
        dodgeSkill: clamp((baseProfile.dodgeSkill || 0) * (tier.defense || 1) * (.58 + calmness * .5), 0, 1),
        patience: clamp((baseProfile.patience || 0) * tier.decision * (.5 + calmness * .65) * (1.18 - aggression * .35), 0, 1),
      };
      this.updateThreatAwareness(p, dt);
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
      p.ai.suppressionWindow = Math.max(0, (p.ai.suppressionWindow || 0) - dt);
      p.ai.concealmentCooldown = Math.max(0, (p.ai.concealmentCooldown || 0) - dt);
      p.ai.desertRecoveryCooldown = Math.max(0, (p.ai.desertRecoveryCooldown || 0) - dt);
      const immediateThreat = this.projectileThreat(p);
      if (immediateThreat) p.ai.lastHostileContactAt = this.elapsed;
      if (this.tryAIVoluntaryBailout(p, immediateThreat, dt)) return;
      if (this.isDefenseMode && this.defenseFlag && this.defenseFlag.hp < this.defenseFlag.maxHp * .42 && this.elapsed-this.defenseFlag.lastDamageAt>4.5 && p.trion > p.maxTrion * .66 && !p.operatorOrder) {
        const eligible = this.players.filter((unit) => !unit.isDefenseEnemy && !unit.dead && !unit.human && unit.trion > unit.maxTrion * .66).sort((a, b) => Math.hypot(a.x - this.defenseFlag.x, a.y - this.defenseFlag.y) - Math.hypot(b.x - this.defenseFlag.x, b.y - this.defenseFlag.y));
        const hostileNearFlag = this.players.some((enemy) => enemy.isDefenseEnemy && !enemy.dead && Math.hypot(enemy.x - this.defenseFlag.x, enemy.y - this.defenseFlag.y) < 420);
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
      const rangeBand = this.getAIRangeBand(p);
      let preferred = role === '重装手' ? 170 : role === '工作手' ? 520 : rangeBand?.preferred || (hasSniper ? 860 : hasMelee ? 128 : 360);
      if (role === '攻撃手') preferred = Math.max(preferred, 145);
      if (role === '工作手') preferred = Math.max(preferred, 500);
      if (hasSniper) preferred = Math.max(preferred, 690);
      const closeEnemies=this.players.filter((other)=>this.canDamage(p,other)&&Math.hypot(other.x-p.x,other.y-p.y)<340).length;
      const targetUsesRanged=target.isDefenseEnemy || target.archetype==='狙撃手' || target.archetype==='銃手' || target.archetype==='射手'
        || (!target.playableDefenseType && [...(target.loadout?.main||[]),...(target.loadout?.sub||[])].some((id)=>['gun','sniper','shooter'].includes(DATA.triggers[id]?.kind)));
      const suppressionRole = ['射手','銃手'].includes(role) || (!p.playableDefenseType && [...p.loadout.main,...p.loadout.sub].some((id)=>['gun','shooter'].includes(DATA.triggers[id]?.kind)));
      if (rangeBand) {
        if (d >= rangeBand.min && d <= rangeBand.max) p.metrics.aiOptimalRangeSeconds += dt;
        else p.metrics.aiOutOfRangeSeconds += dt;
      }
      let moveAngle = targetAngle;
      let movementScale = 1;
      const movementMode = this.chooseAIMovementMode(p, d, preferred, role, lowHeavyResources, hasSniper, dt, rangeBand);
      const movementMetric = { advance:'aiRangeAdvanceSeconds', retreat:'aiRangeRetreatSeconds', hold:'aiRangeHoldSeconds', strafe:'aiRangeStrafeSeconds' }[movementMode];
      if (movementMetric) p.metrics[movementMetric] += dt;
      if (movementMode === 'retreat') moveAngle += Math.PI;
      else if (movementMode === 'strafe') moveAngle += p.ai.strafe * Math.PI / 2;
      else if (movementMode === 'hold') movementScale = .16;
      if (hasSniper) {
        if (rangeBand && d >= rangeBand.min * .96 && d <= rangeBand.max * 1.05) movementScale = Math.min(movementScale, p.ai.targetAge < .55 ? .1 : .18);
        if (d < Math.max(560,(rangeBand?.min||500)*1.12)) { moveAngle = targetAngle + Math.PI; movementScale = Math.max(movementScale, 1.3); }
        if (rangeBand && d > rangeBand.max * 1.2) movementScale = Math.min(movementScale, .62);
      }
      if (role==='攻撃手' && this.elapsed-(p.ai.lastAttackAt||-999)<.72 && d<105 && closeEnemies>0) { moveAngle=targetAngle+Math.PI; movementScale=Math.max(movementScale,.78); }
      if (hasSniper && p.ai.relocateTimer > 0) { moveAngle = targetAngle + p.ai.strafe * Math.PI * .68; movementScale = 1.2; }
      let directive = this.getOperatorMoveDirective(p, target);
      const overEngaged=closeEnemies>=2 || (closeEnemies>=1 && p.hp<p.maxHp*.43) || (hasSniper && d<560);
      if (!directive && (overEngaged || (targetUsesRanged && (threatened || p.hp<p.maxHp*.64 || (role==='攻撃手' && d>360) || hasSniper)))) {
        const cover=this.getAICoverPoint(p,target,hasSniper?720:role==='攻撃手'?260:rangeBand?.preferred||390);
        if (cover) directive={type:'cover',x:cover.x,y:cover.y,label:'遮蔽へ退避'};
      }
      if (!directive && this.isAINearWorldCorner(p.x,p.y,145) && d>220) {
        const center=this.getAICenterEscapePoint(p);
        directive={type:'antiCorner',x:center.x,y:center.y,label:'角から離脱'};
      }
      if (overEngaged && !directive) {
        const away=Math.atan2(p.y-target.y,p.x-target.x);
        directive={type:'disengage',x:clamp(p.x+Math.cos(away)*300,70,this.world.w-70),y:clamp(p.y+Math.sin(away)*300,70,this.world.h-70),label:'過剰接敵を回避'};
      }
      if (directive) {
        moveAngle = Math.atan2(directive.y - p.y, directive.x - p.x); movementScale = directive.hold ? 0 : 1.15;
      } else {
        const reliefPoint = this.getAIDesertRecoveryDirective(p, target, threatened, dt);
        if (reliefPoint) {
          moveAngle = Math.atan2(reliefPoint.y - p.y, reliefPoint.x - p.x);
          movementScale = 1.18;
        }
      }
      const engagementPoint = rangeBand && !directive ? this.getAIEngagementPoint(p, target, rangeBand, dt) : null;
      const navGoalDistance = Math.max(180, Math.min(520, d));
      let navGoalX = engagementPoint && ['advance','retreat','hold'].includes(movementMode) ? engagementPoint.x : p.x + Math.cos(moveAngle) * navGoalDistance;
      let navGoalY = engagementPoint && ['advance','retreat','hold'].includes(movementMode) ? engagementPoint.y : p.y + Math.sin(moveAngle) * navGoalDistance;
      if (directive && Number.isFinite(directive.x) && Number.isFinite(directive.y)) { navGoalX = directive.x; navGoalY = directive.y; }
      const combatRouteBlocked = !directive && movementMode !== 'retreat' && this.findBlockingWall(p.x, p.y, target.x, target.y, p.radius + 5);
      if (combatRouteBlocked) { navGoalX = target.x; navGoalY = target.y; movementScale = Math.max(movementScale, .72); }
      moveAngle = this.getAINavigationAngle(p, navGoalX, navGoalY, moveAngle, dt, movementScale);
      moveAngle = this.stabilizeAIMovementAngle(p, moveAngle, navGoalX, navGoalY, dt, movementScale);
      p.vx += Math.cos(moveAngle) * p.speed * dt * 4.2 * profile.move * movementScale;
      p.vy += Math.sin(moveAngle) * p.speed * dt * 4.2 * profile.move * movementScale;
      this.applyAISeparation(p, dt, false);

      p.ai.threatTime = threatened ? p.ai.threatTime + dt : 0;
      p.ai.defenseCommitTimer = Math.max(0, (p.ai.defenseCommitTimer || 0) - dt);
      const threatInfo = this.getProjectileThreatInfo(p);
      const maintainedGuard = this.maintainAIGuardPosture(p, target, threatInfo);
      const defensiveRead = this.aiTryDefensiveRead(p, threatInfo, profile, tier, dt);
      const targetFacing=Math.abs(angleDiff(Math.atan2(p.y-target.y,p.x-target.x),target.aim||0))<.62;
      const clearAttackLine = !this.findBlockingWall(p.x,p.y,target.x,target.y,Math.max(3,p.radius*.22));
      const safeAttackOpportunity = clearAttackLine && !threatened && closeEnemies <= 1 && p.hp > p.maxHp*.36 && p.trion > p.maxTrion*.16
        && d < (hasSniper ? 980 : suppressionRole ? 760 : hasMelee ? 430 : 690);
      if (suppressionRole && clearAttackLine && d < 760 && closeEnemies <= 2) p.ai.suppressionWindow = Math.max(p.ai.suppressionWindow || 0, .65);
      const exposedToRanged=targetUsesRanged && targetFacing && d<920 && !this.findBlockingWall(target.x,target.y,p.x,p.y,4);
      const guardOption = this.getAIGuardOption(p);
      const shouldHoldGuard=!defensiveRead && !maintainedGuard && guardOption && (threatInfo || (exposedToRanged && (profile.calmness>.36 || p.hp<p.maxHp*.68)))
        && p.trion>p.maxTrion*.14 && Math.random()<(.28+profile.guardSkill*.58);
      if (shouldHoldGuard) {
        const normalGuardDuration = threatInfo ? Math.max(.58, threatInfo.time + .5) : rand(.95,1.65);
        this.activateAIGuard(p,Math.atan2(target.y-p.y,target.x-p.x),normalGuardDuration,{masteryAttempt:Boolean(threatInfo)});
        if (!threatInfo) movementScale=Math.min(movementScale,.52);
      }

      if (p.ai.utilityTimer <= 0) {
        if (Math.random() < profile.utilityChance || role === '工作手') this.aiUseUtility(p, d, target, profile);
        let baseMin = this.config.difficulty === 'strong' ? 1.5 : this.config.difficulty === 'weak' ? 4 : 2.4;
        let baseMax = this.config.difficulty === 'strong' ? 3.5 : this.config.difficulty === 'weak' ? 7.5 : 5.8;
        if (role === '工作手') { baseMin *= .48; baseMax *= .58; }
        if (role === '重装手') { baseMin *= .82; baseMax *= .9; }
        p.ai.utilityTimer = rand(baseMin, baseMax);
      }

      for (const hand of ['main','sub']) {
        const charge = p.shooterCharges?.[hand];
        if (charge?.ready) {
          const previous = p.selected[hand]; p.selected[hand] = charge.slot;
          const fired = this.tryUseHand(p, hand, { shift:false });
          p.selected[hand] = previous;
          if (fired) { p.ai.attackTimer = rand(profile.attackInterval[0], profile.attackInterval[1]) * .9; return; }
        }
      }
      if (p.ai.wallBreakTarget && this.aiTryBreakNavigationWall(p)) return;
      if (defensiveRead && p.ai.defenseCommitTimer > 0 && !safeAttackOpportunity && Math.random() < profile.patience * .72) return;
      const targetGuarding = this.getActiveShieldEntries(target).length > 0;
      if (targetGuarding && !suppressionRole && !safeAttackOpportunity && p.ai.attackTimer <= 0 && Math.random() < profile.patience * (.58 + profile.calmness * .24)) {
        p.ai.strafe *= -1;
        p.ai.attackTimer = rand(.14, .38) * (1.22 - profile.aggression * .28);
        return;
      }
      if (safeAttackOpportunity) p.ai.attackTimer = Math.min(p.ai.attackTimer, suppressionRole ? .035 : .09);
      if (p.ai.attackTimer > 0) return;
      const attackPace = suppressionRole ? (safeAttackOpportunity ? .48 : .68) : safeAttackOpportunity ? .72 : 1;
      p.ai.attackTimer = rand(profile.attackInterval[0], profile.attackInterval[1]) * attackPace;
      p.ai.lastAttackAt=this.elapsed;
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
          const desiredMode = melee.trigger.id === 'scorpion' ? (d > 128 ? 1 : d < 72 ? 2 : 0) : 0;
          if (melee.trigger.id === 'scorpion') p.scorpionMode[melee.hand] = desiredMode;
          const key = desiredMode === 1 ? 'scorpionLong' : desiredMode === 2 ? 'scorpionShort' : melee.trigger.id;
          p.metrics.aiTriggerSelections[key] = (p.metrics.aiTriggerSelections[key] || 0) + 1;
          this.tryUseHand(p, melee.hand, { shift: melee.trigger.id === 'kogetsu' && immediateThreat && Math.random() < .28 });
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
        if (used && suppressionRole && ['gun','shooter'].includes(ranged.trigger.kind)) {
          p.ai.suppressionWindow = Math.max(p.ai.suppressionWindow || 0, 1.1);
          p.ai.attackTimer = Math.min(p.ai.attackTimer, safeAttackOpportunity ? rand(.08,.2) : rand(.18,.34));
        }
        if (used && ranged.trigger.kind === 'sniper') { p.ai.relocateTimer = rand(.55, .95); p.ai.utilityTimer = 0; }
      }
    }

    stealthBlocksAggro(observer, target, reason = 'sight') {
      if (!target) return false;
      const bagworm = target.toggles?.bagworm || target.toggles?.bagwormTag;
      if (bagworm) {
        if (['attacked','majorHit','objective'].includes(reason)) return false;
        // バッグワームはレーダーだけを消す。遮蔽物の裏なら未発見、
        // 実視界が通っていれば低優先度の敵として認識できる。
        return !observer || !this.hasBagwormVisualContact(observer, target);
      }
      if (target.toggles?.chameleon && !['attacked','majorHit'].includes(reason)) return true;
      return false;
    }

    addThreat(observer, target, amount, reason = 'sight', duration = 5) {
      if (!observer?.ai || !target || observer.id === target.id || !this.canDamage(observer, target)) return false;
      if (this.stealthBlocksAggro(observer, target, reason)) return false;
      observer.ai.threat ||= {};
      const entry = observer.ai.threat[target.id] || { value:0, timer:0, reason };
      entry.value = clamp(entry.value + amount, 0, 100);
      entry.timer = Math.max(entry.timer, duration);
      entry.reason = reason === 'attacked' || reason === 'majorHit' ? reason : entry.reason;
      observer.ai.threat[target.id] = entry;
      return true;
    }

    getThreat(observer, target) {
      return Number(observer?.ai?.threat?.[target?.id]?.value || 0);
    }

    getVisualDetectionRange(observer) {
      return observer?.isDefenseEnemy ? 820 : observer?.archetype === '狙撃手' ? 1120 : observer?.archetype === '銃手' ? 920 : 760;
    }

    hasEffectiveSight(observer, target) {
      if (!observer || !target || target.dead) return false;
      const d = Math.hypot(target.x - observer.x, target.y - observer.y);
      if (d > this.getVisualDetectionRange(observer)) return false;
      const targetAngle = Math.atan2(target.y - observer.y, target.x - observer.x);
      const fov = observer.isDefenseEnemy ? 2.45 : observer.archetype === '狙撃手' ? 1.72 : 2.18;
      if (d > 150 && Math.abs(angleDiff(targetAngle, observer.aim || 0)) > fov / 2) return false;
      return !this.findBlockingWall(observer.x, observer.y, target.x, target.y, 3);
    }

    isInsideObserverScreenView(observer, target, margin = 72) {
      if (!observer || !target) return false;
      const halfW = Math.max(360, Number(this.viewW || 1280) / 2) + margin;
      const halfH = Math.max(260, Number(this.viewH || 720) / 2) + margin;
      return Math.abs(target.x - observer.x) <= halfW && Math.abs(target.y - observer.y) <= halfH;
    }

    hasBagwormVisualContact(observer, target) {
      if (!observer || !target || target.dead) return false;
      const d = Math.hypot(target.x - observer.x, target.y - observer.y);
      const longRangeSniperSight = observer.archetype === '狙撃手' && d <= this.getVisualDetectionRange(observer);
      // バッグワームは視覚を消さない。AIの向きではなく、相手を中心とした実画面内に入っていれば視認できる。
      // ただし壁・建物などの遮蔽物が線上にある場合は未発見のままにする。
      if (!this.isInsideObserverScreenView(observer, target) && !longRangeSniperSight) return false;
      return !this.findBlockingWall(observer.x, observer.y, target.x, target.y, 3);
    }

    updateThreatAwareness(observer, dt) {
      if (!observer?.ai) return;
      observer.ai.threat ||= {};
      for (const [id, entry] of Object.entries(observer.ai.threat)) {
        entry.timer -= dt;
        entry.value = Math.max(0, entry.value - dt * (entry.reason === 'attacked' ? 2.1 : 4.5));
        if (entry.timer <= 0 || entry.value <= .05) delete observer.ai.threat[id];
      }
      observer.ai.visionTimer = (observer.ai.visionTimer || 0) - dt;
      if (observer.ai.visionTimer > 0) return;
      observer.ai.visionTimer = observer.isDefenseEnemy ? .14 : .18;
      for (const target of this.players) {
        if (!this.canDamage(observer, target)) continue;
        const d = Math.hypot(target.x - observer.x, target.y - observer.y);
        const bagworm = target.toggles?.bagworm || target.toggles?.bagwormTag;
        const sight = bagworm ? this.hasBagwormVisualContact(observer, target) : this.hasEffectiveSight(observer, target);
        if (bagworm) {
          if (!sight) continue; // 遮蔽物の裏なら画面範囲内でも敵視しない。
          // 視界内なら会敵対象にはするが、未攻撃時は通常の敵より低い敵視値に留める。
          const desiredThreat = d <= 285 ? 15 : 5.5;
          const threatDelta = desiredThreat - this.getThreat(observer, target);
          if (threatDelta > .05) this.addThreat(observer, target, threatDelta, d <= 285 ? 'proximity' : 'sight', d <= 285 ? 3.0 : 2.1);
          continue;
        }
        if (this.stealthBlocksAggro(observer, target, 'sight')) continue;
        if (d <= 285) this.addThreat(observer, target, 7.5, 'proximity', 3.2);
        else if (sight) this.addThreat(observer, target, 2.4, 'sight', 2.2);
      }
    }

    emitCombatNoise(source, radius = 620, amount = 8, reason = 'noise') {
      if (!source) return;
      const bagworm = source.toggles?.bagworm || source.toggles?.bagwormTag;
      for (const observer of this.players) {
        if (!observer.ai || !this.canDamage(observer, source)) continue;
        const d = Math.hypot(observer.x - source.x, observer.y - source.y);
        if (d > radius) continue;
        if (bagworm && !this.hasBagwormVisualContact(observer, source) && d > 240) continue;
        this.addThreat(observer, source, amount * (1 - d / Math.max(radius * 1.25, 1)), bagworm ? 'attacked' : reason, bagworm ? 5.5 : 4.2);
      }
    }

    scoreAITargetCandidate(p, target, type) {
      const d = Math.hypot(target.x - p.x, target.y - p.y);
      if (type === 'beacon') {
        const memory = this.getAIBeaconMemory(p, target);
        if (memory.identified || target.exposedTeams?.[p.team]) return Infinity;
        return d * (1.02 + memory.suspicion * 2.8 + memory.observe * .22);
      }
      const threatEntry = p.ai?.threat?.[target.id];
      const threat = Number(threatEntry?.value || 0);
      const bagworm = target.toggles.bagworm || target.toggles.bagwormTag;
      const attackedThroughStealth = ['attacked','majorHit'].includes(threatEntry?.reason);
      const visible = bagworm ? this.hasBagwormVisualContact(p, target) : this.hasEffectiveSight(p, target);
      if (bagworm && !attackedThroughStealth && !visible) return Infinity;
      if (target.toggles.chameleon && !attackedThroughStealth) return Infinity;
      const proximityAware = d <= 285 && !target.toggles.chameleon && !bagworm;
      if (threat <= 0 && !proximityAware && !visible) return Infinity;
      let score = d / (1 + threat * .115);
      if (bagworm && !attackedThroughStealth) score *= 1.35;
      if (proximityAware) score *= .38;
      const axisDx=Math.abs(target.x-p.x), axisDy=Math.abs(target.y-p.y);
      if (axisDx < 92 && axisDy > 210) score *= 1.22;
      const alliedFocus=this.players.filter((ally)=>ally!==p&&!ally.dead&&ally.team===p.team&&ally.ai?.target===target.id).length;
      score *= 1 + Math.min(.9, alliedFocus*.22);
      if (this.isAINearWorldCorner(target.x,target.y,105) && d>380) score *= 1.14;
      if (target.toggles.chameleon) score *= 1.7;
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
        if(beacon.hp<=0||beacon.active===false||beacon.ttl<=0) continue;
        if (beacon.team === p.team && (this.config.mode === 'team' || this.isDefenseMode)) continue;
        candidates.push({ target: beacon, type: 'beacon', score: this.scoreAITargetCandidate(p, beacon, 'beacon') });
      }
      if (!candidates.length) { p.ai.target = null; return; }
      candidates.sort((a, b) => a.score - b.score);
      const current = this.resolveAITarget(p);
      const currentEntry = current ? { target: current, type: p.ai.targetType, score: this.scoreAITargetCandidate(p, current, p.ai.targetType) } : null;
      const attackedBy = this.elapsed - (p.lastDamageAt || -999) < 2.4 ? candidates.find((item) => item.type === 'player' && item.target.id === p.ai.lastAttackerId) : null;
      const immediateClose = candidates
        .filter((item) => item.type === 'player' && Math.hypot(item.target.x - p.x, item.target.y - p.y) <= 265)
        .sort((a,b) => Math.hypot(a.target.x-p.x,a.target.y-p.y) - Math.hypot(b.target.x-p.x,b.target.y-p.y))[0] || null;
      const immediateThreat = candidates.find((item) => item.type === 'player' && item.score < 118);
      const choicePool = candidates.slice(0, this.config.difficulty === 'weak' ? 4 : this.config.difficulty === 'strong' ? 3 : 4);
      let choice = attackedBy || immediateClose || immediateThreat || weightedChoice(choicePool, (item) => 1 / Math.max(1, item.score));
      let switchReason = force ? 'forced_or_missing' : attackedBy ? 'attacked_by' : immediateClose ? 'nearby_enemy' : immediateThreat ? 'immediate_threat' : 'score';
      if (!force && currentEntry && choice?.target.id !== currentEntry.target.id) {
        const currentLost = !Number.isFinite(currentEntry.score);
        const meaningfullyBetter = choice.score < currentEntry.score * .55;
        if (!currentLost && !meaningfullyBetter && !attackedBy && !immediateThreat) { choice = currentEntry; switchReason = 'retained'; }
      }
      const oldTarget = p.ai.target;
      const oldType = p.ai.targetType;
      p.ai.target = choice?.target.id || null;
      p.ai.targetType = choice?.type || 'player';
      const switched = oldTarget && oldTarget !== p.ai.target;
      if (switched) {
        p.metrics.aiTargetChanges = (p.metrics.aiTargetChanges || 0) + 1;
        p.metrics.aiTargetChangeReasons[switchReason] = (p.metrics.aiTargetChangeReasons[switchReason] || 0) + 1;
        p.ai.lastTargetSwitchReason = switchReason;
        p.ai.engagementPoint = null; p.ai.engagementPointTimer = 0;
        this.logCombatDetail('ai_target_change', p, { from: oldTarget, to: p.ai.target, fromType: oldType, toType: p.ai.targetType, reason: switchReason });
      } else if (currentEntry) p.metrics.aiTargetRetained += 1;
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
      if (p.ai.targetType === 'beacon') return this.beacons.find((beacon) => beacon.id === p.ai.target && beacon.hp > 0 && beacon.active !== false) || null;
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
      if (trigger.kind === 'gun' || trigger.kind === 'sniper') {
        const state = this.getGunState(p, hand, trigger, index);
        if (state.reloadTimer > 0 || state.ammo <= 0) return false;
      }
      if (trigger.kind === 'shooter' && ((p.shooterHandLock?.[hand] || 0) > 0 || p.shooterCharges?.[hand])) return false;
      return cooldown <= 0 && p.trion + .001 >= Number(trigger.cost || 0);
    }

    chooseAIRanged(p, target, d, profile) {
      const candidates = [];
      const targetSpeed = Math.hypot(target.vx || 0, target.vy || 0);
      const targetAngle = Math.atan2(target.y - p.y, target.x - p.x);
      const lateralSpeed = Math.abs((target.vx || 0) * -Math.sin(targetAngle) + (target.vy || 0) * Math.cos(targetAngle));
      const cluster = this.countEnemiesNear(p, target, 145);
      const suppressionRole = ['射手','銃手'].includes(p.archetype);
      const repeatPenalty = (id) => p.ai.lastWeaponId === id ? Math.max(.35, 1 - p.ai.repeatCount * .16) : 1;

      for (const hand of ['main', 'sub']) {
        if (p.ai.forcedRangedHand && hand !== p.ai.forcedRangedHand) continue;
        p.loadout[hand].forEach((id, index) => {
          const trigger = p.playableDefenseType ? null : DATA.triggers[id];
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
          if (suppressionRole && ['gun','shooter'].includes(trigger.kind)) {
            score += 1.15 + Math.min(1.2, cluster * .22);
            if (p.ai?.suppressionWindow > 0) score += .8;
          }
          const rangeProfile = this.getTriggerRangeProfile(trigger);
          if (rangeProfile) {
            const inRange = d >= rangeProfile.min && d <= rangeProfile.max;
            score += inRange ? 2.25 : -3.4;
            if (trigger.kind === 'sniper' && d < rangeProfile.min) score -= 3.6;
          }
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
          const trigger = p.playableDefenseType ? null : DATA.triggers[id];
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
          const trigger = p.playableDefenseType ? null : DATA.triggers[id];
          if (!trigger || !this.slotReady(p, hand, index, trigger)) return;
          let score = -Infinity;
          if (id === 'switchbox') score = p.archetype === '工作手' ? (distanceToTarget>360?12:8.5) : 2;
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
        const lead=p.archetype==='工作手'?1.45:.55;const lane=this.getAIEngagementPoint(p,target,this.getAIRangeBand(p),0);p.ai.placePoint={x:clamp(target.x+(target.vx||0)*lead+(lane?lane.x-target.x:0)*.22,55,this.world.w-55),y:clamp(target.y+(target.vy||0)*lead+(lane?lane.y-target.y:0)*.22,55,this.world.h-55)};
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

    getProjectileThreatInfo(p, horizon = 1.15) {
      let best = null;
      let count = 0;
      for (const proj of this.projectiles) {
        if (proj.ownerId === p.id) continue;
        if (proj.team === p.team && (this.config.mode === 'team' || this.isDefenseMode)) continue;
        const rx = proj.x - p.x, ry = proj.y - p.y;
        const rvx = proj.vx - (p.vx || 0), rvy = proj.vy - (p.vy || 0);
        const vv = rvx * rvx + rvy * rvy;
        if (vv < 1) continue;
        const time = -(rx * rvx + ry * rvy) / vv;
        if (time < 0 || time > horizon) continue;
        const cx = rx + rvx * time, cy = ry + rvy * time;
        const miss = Math.hypot(cx, cy);
        const dangerRadius = p.radius + (proj.radius || 5) + 18;
        if (miss > dangerRadius) continue;
        count += 1;
        const info = { projectile:proj, time, miss, count:1, incomingAngle:Math.atan2(-rvy, -rvx), sourceAngle:Math.atan2(proj.y-p.y, proj.x-p.x) };
        if (!best || time < best.time) best = info;
      }
      if (best) best.count = count;
      return best;
    }

    projectileThreat(p) {
      return Boolean(this.getProjectileThreatInfo(p, .72));
    }

    aiTryDefensiveRead(p, threat, profile, tier, dt) {
      if (!p || p.dead || !threat) return false;
      const calmness = clamp(profile?.calmness ?? p.aiPersonality?.calmness ?? .5, 0, 1);
      const aggression = clamp(profile?.aggression ?? p.aiPersonality?.aggression ?? .5, 0, 1);
      const guardSkill = clamp(profile?.guardSkill ?? 0, 0, 1);
      const parrySkill = clamp(profile?.parrySkill ?? 0, 0, 1);
      const dodgeSkill = clamp(profile?.dodgeSkill ?? 0, 0, 1);
      const reactionFactor = Math.max(.42, tier?.reaction || 1);
      const idealLead = clamp((.36 - guardSkill * .22) * (.82 + reactionFactor * .22) + (1-calmness) * rand(-.035,.055), .095, .48);
      if (threat.time > idealLead) return false;
      const composure = clamp((guardSkill + parrySkill + dodgeSkill) / 2.4 * (.62 + calmness * .55), .05, .98);
      const gambleChance = (1-calmness) * (.22 + aggression * .35);
      const responseChance = clamp(composure * (1 - gambleChance * .72), .03, .98);
      if (Math.random() > responseChance) return false;

      const type = p.playableDefenseType || p.defenseType;
      const canExtraParry = EXTRA_PARRY_TYPES.has(type) && (p.extraParryCooldown || p.defenseAI?.parryCooldown || 0) <= 0;
      const kogetsu = !type ? this.findTriggerHand(p, (trigger) => trigger.id === 'kogetsu') : null;
      const raygust = !type ? this.findTriggerHand(p, (trigger) => trigger.id === 'raygust') : null;
      const shield = !type ? this.findTriggerHand(p, (trigger) => trigger.kind === 'shield') : null;
      const canSealGuard = type === 'seals';
      const supportGuard={sogetsu:{hand:'main',index:2},fullarms:{hand:'main',index:2},geist:{hand:'main',index:3}}[type]||null;
      const urgent = threat.time <= .15 || threat.count > 1;
      const parryWeight = (canExtraParry || kogetsu) ? parrySkill * (.72 + aggression * .4) * (urgent ? 1.15 : .82) : 0;
      const guardWeight = (raygust || shield || canSealGuard || supportGuard) ? guardSkill * (1.28 - aggression * .48) * (threat.count > 1 ? 1.35 : 1) : 0;
      const dodgeWeight = dodgeSkill * (.72 + calmness * .46) * (threat.count > 1 ? .55 : 1.1);
      const choice = weightedChoice([
        {id:'parry',weight:parryWeight}, {id:'guard',weight:guardWeight}, {id:'dodge',weight:dodgeWeight}
      ].filter((item) => item.weight > 0), (item) => item.weight);
      if (!choice) return false;

      p.aim = threat.sourceAngle;
      if (choice.id === 'parry') {
        if (canExtraParry) {
          if (p.isDefenseEnemy) {
            p.defenseAI.parryTimer = .32; p.defenseAI.parryCooldown = 1.55; p.defenseAI.action='parry'; p.defenseAI.actionTimer=.32; p.defenseAI.actionMax=.32; p.masteryParryAttempt=true;
          } else if (!this.beginPlayableParry(p)) return false;
        } else if (kogetsu && this.slotReady(p, kogetsu.hand, kogetsu.index, kogetsu.trigger)) {
          p.selected[kogetsu.hand] = kogetsu.index;
          if (!this.tryUseHand(p, kogetsu.hand, { shift:true })) return false;
        } else return false;
        p.ai.defenseCommitTimer = .24;
        return true;
      }
      if (choice.id === 'guard') {
        if (canSealGuard) {
          const boost = clamp(p.extraBoost || p.defenseAI?.sealBoost || 1, 1, 3);
          p.defenseAI ||= {}; p.defenseAI.shieldTimer = Math.max(p.defenseAI.shieldTimer || 0, .2); p.defenseAI.shieldHand='sub';
          if (!this.activateShield(p, 'sub', 'seal', {boost})) return false;
        } else if(supportGuard){
          p.selected[supportGuard.hand]=supportGuard.index;p.defenseAI ||= {};p.defenseAI.shieldTimer=Math.max(p.defenseAI.shieldTimer||0,.22);p.defenseAI.shieldHand=supportGuard.hand;
          if(!this.activateShield(p,supportGuard.hand,'shield'))return false;
        } else {
          const selected = raygust && (p.archetype === '重装手' || !shield || Math.random() < .58) ? raygust : shield;
          if (!selected) return false;
          p.selected[selected.hand] = selected.index;
          if (!this.activateShield(p, selected.hand, selected.trigger.id === 'raygust' ? 'raygust' : 'shield')) return false;
        }
        p.ai.defenseCommitTimer = urgent ? .32 : .46;
        p.ai.sustainedGuardUntil = Math.max(p.ai.sustainedGuardUntil || 0, this.elapsed + (urgent ? .62 : .88));
        return true;
      }

      const velocityAngle = Math.atan2(threat.projectile.vy, threat.projectile.vx);
      let side = p.ai?.strafe || (Math.random() < .5 ? -1 : 1);
      const testDistance = 90;
      const a1 = velocityAngle + side * Math.PI/2;
      const tx = p.x + Math.cos(a1) * testDistance, ty = p.y + Math.sin(a1) * testDistance;
      if (this.findBlockingWall(p.x,p.y,tx,ty,p.radius+3)) side *= -1;
      const dodgeAngle = velocityAngle + side * Math.PI/2 + (1-calmness) * rand(-.22,.22);
      const impulse = (250 + dodgeSkill * 180) * (urgent ? 1.08 : 1);
      p.vx += Math.cos(dodgeAngle) * impulse;
      p.vy += Math.sin(dodgeAngle) * impulse;
      p.masteryDodgeAttempt = { startedAt:this.elapsed, until:this.elapsed + Math.max(.34, threat.time + .28), x:p.x, y:p.y, projectileId:threat.projectile?.id || null };
      if (p.ai) { p.ai.strafe = side; p.ai.defenseCommitTimer = .18; p.ai.escapeTimer = Math.max(p.ai.escapeTimer || 0, .22); }
      this.effects.push({type:'dash',x:p.x,y:p.y,angle:dodgeAngle,color:'#b9f4ff',ttl:.18,maxTtl:.18});
      return true;
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
        this.trackProjectileDodges(p);

        let removed = false;
        if (p.explosive && p.proximityFuse > 0) {
          const nearby = this.players.find((target) => !target.dead && target.id !== p.ownerId && !(target.team === p.team && (this.config.mode === 'team' || this.isDefenseMode)) && Math.hypot(p.x - target.x, p.y - target.y) <= p.proximityFuse + target.radius);
          if (nearby) {
            this.explode(p.x, p.y, p.explosionRadius, p.damage, p.ownerId, p.team, null, p.sourceName, { sourceKey: p.sourceKey, activationId: p.activationId, projectileId: p.id, rangeProfile: p.rangeProfile, originX: p.originX, originY: p.originY, stationaryShot: p.stationaryShot });
            this.projectiles.splice(i, 1);
            continue;
          }
        }
        if (p.x < 0 || p.y < 0 || p.x > this.world.w || p.y > this.world.h || p.life <= 0) {
          if (p.explosive && p.life <= 0) this.explode(p.x, p.y, p.explosionRadius, p.damage, p.ownerId, p.team, null, p.sourceName, { sourceKey: p.sourceKey, activationId: p.activationId, projectileId: p.id, rangeProfile: p.rangeProfile, originX: p.originX, originY: p.originY, stationaryShot: p.stationaryShot });
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
          if (p.explosive) this.explode(p.x, p.y, p.explosionRadius, p.damage, p.ownerId, p.team, null, p.sourceName, { sourceKey: p.sourceKey, activationId: p.activationId, projectileId: p.id, rangeProfile: p.rangeProfile, originX: p.originX, originY: p.originY, stationaryShot: p.stationaryShot });
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
            if (p.explosive) this.explode(p.x, p.y, p.explosionRadius, p.damage, p.ownerId, p.team, null, p.sourceName, { sourceKey: p.sourceKey, activationId: p.activationId, projectileId: p.id, rangeProfile: p.rangeProfile, originX: p.originX, originY: p.originY, stationaryShot: p.stationaryShot });
            this.projectiles.splice(i, 1); removed = true; break;
          }
        }
        if (removed) continue;

        for (const light of this.lightSources) {
          if(light.hp<=0) continue;
          if (Math.hypot(p.x-light.x,p.y-light.y) < p.radius+light.radius) {
            if(light.kind==='sakeBarrel'&&p.explosive) this.igniteSakeBarrel(light,p.ownerId,p.team);
            else light.hp-=Math.max(4,p.damage)*(light.kind==='sakeBarrel'?.35:1);
            if(p.explosive) this.explode(p.x,p.y,p.explosionRadius,p.damage,p.ownerId,p.team,null,p.sourceName,{sourceKey:p.sourceKey,activationId:p.activationId,projectileId:p.id,rangeProfile:p.rangeProfile,originX:p.originX,originY:p.originY});
            this.projectiles.splice(i,1); removed=true; break;
          }
        }
        if (removed) continue;

        for (const beacon of this.beacons) {
          if (beacon.team === p.team && (this.config.mode === 'team' || this.isDefenseMode)) continue;
          if (Math.hypot(p.x - beacon.x, p.y - beacon.y) < p.radius + beacon.radius) {
            beacon.hp -= Math.max(4, p.damage);
            if (p.explosive) this.explode(p.x, p.y, p.explosionRadius, p.damage, p.ownerId, p.team, null, p.sourceName, { sourceKey: p.sourceKey, activationId: p.activationId, projectileId: p.id, rangeProfile: p.rangeProfile, originX: p.originX, originY: p.originY, stationaryShot: p.stationaryShot });
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
          const hitInfo = {
            x: p.x, y: p.y, type: 'projectile', shieldPierce: p.shieldPierce,
            name: p.sourceName, sourceKey: p.sourceKey, activationId: p.activationId,
            incomingAngle: Math.atan2(-p.vy, -p.vx), rangeProfile: p.rangeProfile,
            originX: p.originX, originY: p.originY, stationaryShot: p.stationaryShot,
          };
          const cut = this.tryJustCut(target, owner, hitInfo);
          if (!cut && p.lead) {
            target.leadWeights += p.leadWeight;
            target.slowTimer = Math.max(target.slowTimer, 7);
            this.effects.push({ type: 'weight', x: target.x, y: target.y, ttl: 7, maxTtl: 7 });
            if (owner?.metrics) {
              owner.metrics.leadBulletSlowSeconds += 7; owner.metrics.leadBulletWeightsApplied += p.leadWeight;
              this.registerEffectApplication(owner, p.effectSourceKey || 'leadBullet', p.effectSourceName || '鉛弾（レッドバレット）', target, 7, p.effectActivationId);
            }
            if (target.human) this.toast(`鉛弾：重し ${target.leadWeights}`);
          } else if (!cut) {
            const damaged = this.damagePlayer(target, p.damage, owner, { ...hitInfo, skipJustCut: true });
            if (damaged) this.markProjectileHit(owner, p.id, p.sourceKey);
          }
          if (!cut && p.mark) {
            target.markedTimer = Math.max(target.markedTimer, p.markDuration);
            if (owner?.metrics) {
              owner.metrics.starmakerMarks += 1; owner.metrics.starmakerRevealSeconds += p.markDuration;
              this.registerEffectApplication(owner, p.effectSourceKey || 'starmaker', p.effectSourceName || 'スタアメーカー', target, p.markDuration, p.effectActivationId);
            }
          }
          if (!cut && p.explosive) this.explode(p.x, p.y, p.explosionRadius, p.damage, p.ownerId, p.team, target.id, p.sourceName, { sourceKey: p.sourceKey, activationId: p.activationId, projectileId: p.id, rangeProfile: p.rangeProfile, originX: p.originX, originY: p.originY, stationaryShot: p.stationaryShot });
          if (cut) {
            this.projectiles.splice(i, 1);
            removed = true;
          } else if (p.penetration > 0) {
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
      for(const light of this.lightSources){if(light.hp<=0||light.subwayControl)continue;const d=Math.hypot(light.x-x,light.y-y);if(d<=range+light.radius&&Math.abs(angleDiff(Math.atan2(light.y-y,light.x-x),angle))<=arc/2+.2)light.hp-=damage;}
    }
    damageWorldSegment(ax,ay,bx,by,damage,team,width=18){
      for(const wall of this.walls){if(!Number.isFinite(wall.hp)||wall.hp<=0)continue;const hit=segmentPointDistance(ax,ay,bx,by,wall.x+wall.w/2,wall.y+wall.h/2);if(hit.distance<width+Math.max(wall.w,wall.h)*.45)wall.hp-=damage;}
      for(const f of this.installations){if(f.hp<=0||(this.config.mode==='team'&&f.team===team))continue;const hit=segmentPointDistance(ax,ay,bx,by,f.x,f.y);if(hit.distance<width+f.radius)f.hp-=damage;}
      for(const light of this.lightSources){if(light.hp<=0||light.subwayControl)continue;const hit=segmentPointDistance(ax,ay,bx,by,light.x,light.y);if(hit.distance<width+light.radius)light.hp-=damage;}
    }

    explode(x, y, radius, damage, ownerId, team, excludeId = null, sourceName = 'メテオラ', context = {}) {
      this.sfx?.play('explosion', { x, y, bucket: `explosion:${Math.round(x / 80)}:${Math.round(y / 80)}`, cooldown: .1, volume: radius > 180 ? .68 : .52, rate: radius > 220 ? .88 : rand(.94, 1.06) });
      if (this.mapId === 'desert' && !context.gasChain) {
        const ignitionTargets = this.terrain.gasFields.filter((gas) => gas.active && Math.hypot(gas.x - x, gas.y - y) <= radius + gas.radius + 45);
        for (const gas of ignitionTargets) this.igniteGasField(gas, ownerId, team);
      }
      if (this.mapId === 'snowShrine' && !context.sakeChain) {
        const barrels = this.lightSources.filter((light) => light.kind==='sakeBarrel'&&light.hp>0&&Math.hypot(light.x-x,light.y-y)<=radius+light.radius+28);
        for(const barrel of barrels) this.igniteSakeBarrel(barrel,ownerId,team);
      }
      if (this.mapId === 'underground' && !context.sludgeChain) {
        const sludges = (this.terrain.subwaySludge || []).filter((sludge) => sludge.active !== false && Math.hypot(sludge.x - x, sludge.y - y) <= radius + sludge.radius + 24);
        for (const sludge of sludges) this.igniteSubwaySludge(sludge, ownerId, team);
      }
      this.effects.push({ type: 'explosion', x, y, radius, ttl: .44, maxTtl: .44 });
      const owner = this.players.find((player) => player.id === ownerId) || null;
      let hitCount = 0;
      for (const target of this.players) {
        if (target.dead || target.id === excludeId || target.id === ownerId || (target.team === team && (this.config.mode === 'team' || this.isDefenseMode))) continue;
        const d = Math.hypot(target.x - x, target.y - y);
        if (d > radius + target.radius) continue;
        if (owner?.isDefenseEnemy && this.findBlockingWall(x, y, target.x, target.y, 3)) continue;
        const scale = 1 - clamp(d / radius, 0, .82);
        this.damagePlayer(target, damage * scale, owner, {
          x, y, type: 'explosion', name: sourceName,
          sourceKey: context.sourceKey || sourceName, activationId: context.activationId || null,
          rangeProfile: context.rangeProfile || null, originX: context.originX, originY: context.originY, stationaryShot: context.stationaryShot,
        });
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
      for(const light of this.lightSources){if(light.hp<=0||light.subwayControl)continue;const d=Math.hypot(light.x-x,light.y-y);if(d<radius+light.radius)light.hp-=damage*(1-clamp(d/(radius+1),0,.85));}
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

    tryAutoGuard(target, info, incomingAmount) {
      if (target.beginnerSkill !== 'autoGuard' || target.dead || info.shieldPierce || Object.values(target.shields).some(Boolean)) return false;
      const guard = this.findTriggerHand(target, (trigger) => trigger.kind === 'shield' || trigger.id === 'raygust');
      if (!guard || (target.cooldowns[`${guard.hand}:${guard.index}`] || 0) > 0) return false;
      const cost = guard.trigger.id === 'raygust' ? 1.35 : .9;
      if (!this.consumeTrion(target, cost, true)) return false;
      if (!this.activateShield(target, guard.hand, guard.trigger.id === 'raygust' ? 'raygust' : 'shield', { justGuardWindow:.18 })) return false;
      this.setCooldownForHandIndex(target, guard.hand, guard.index, guard.trigger.cooldown || 1.15);
      if (target.human) this.toast('オートガード');
      return true;
    }

    getAttackDamageModifiers(attacker, target, amount, info = {}) {
      if (!attacker || !attacker.metrics || attacker.id === target.id) return { amount, critical:false };
      const hpRatio = attacker.maxHp > 0 ? attacker.hp / attacker.maxHp : 1;
      if (hpRatio <= .38) amount *= 1 + (.38 - hpRatio) * .9;
      this.ensureMasteryRuntime(attacker);
      const masteryRatio = clamp(attacker.masteryValue / 100, 0, 1);
      const qualityCenter = .93 + masteryRatio * .13;
      const qualitySpread = .13 - masteryRatio * .075;
      const qualityMultiplier = clamp(qualityCenter + rand(-qualitySpread, qualitySpread), .78, 1.14);
      amount *= qualityMultiplier;
      let critChance = .025 + attacker.stats.technique * .012;
      critChance += clamp((attacker.masteryValue - 28) / 72, 0, 1) * .105;
      if (info.stationaryShot && info.rangeProfile && ['gun','sniper'].includes(info.rangeProfile.kind)) critChance += info.rangeProfile.kind === 'sniper' ? .11 : .07;
      if (attacker.beginnerSkill === 'aimAssist' && info.rangeProfile && ['gun','sniper'].includes(info.rangeProfile.kind)) critChance += .025;
      if (attacker.aiTier === 'upper') critChance += .025;
      const critical = Math.random() < clamp(critChance, .03, .42);
      if (critical) {
        const before = amount;
        amount *= 1.55;
        attacker.metrics.criticalHits += 1;
        attacker.metrics.criticalDamage += amount - before;
        this.effects.push({ type:'critical', x:target.x, y:target.y, ttl:.34, maxTtl:.34 });
      }
      return { amount, critical };
    }

    damagePlayer(target, amount, attacker, info = {}) {
      if (target.dead || amount <= 0 || target.invulnTimer > 0) return false;
      if (attacker?.isDefenseEnemy && !target.isDefenseEnemy && info.type === 'melee') {
        const maxRange = this.getDefenseAttackMaxRange(attacker, info.name, info.sourceKey);
        if (!this.canDefenseEnemyAttackTarget(attacker, target, maxRange, 4)) return false;
      }
      if ((target.playableDefenseType || target.isDefenseEnemy) && (target.extraParryTimer > 0 || target.defenseAI?.parryTimer > 0) && attacker && attacker !== target && EXTRA_PARRY_TYPES.has(target.playableDefenseType || target.defenseType)) {
        target.extraParryTimer = 0; if(target.defenseAI)target.defenseAI.parryTimer=0; target.extraParryCooldown = Math.max(target.extraParryCooldown || 0, 1.2);
        target.masteryParryAttempt = false;
        target.metrics.parryAttacks += 1;
        this.adjustMastery(target, .54, 'いなし成功', {major:true});
        this.effects.push({ type:'justCut', x:target.x, y:target.y, radius:target.radius+34, angle:target.aim, color:'#fff3a8', ttl:.38, maxTtl:.38 });
        const counterDamage = Math.max(10, (target.extraDamage || 20) * .72);
        this.damagePlayer(attacker, counterDamage, target, { x:attacker.x, y:attacker.y, type:'melee', name:'いなし反撃', sourceKey:'extraParry', skipJustCut:true });
        return false;
      }
      if (!info.skipJustCut && this.tryJustCut(target, attacker, info)) return false;
      const attackModifiers = this.getAttackDamageModifiers(attacker, target, amount, info);
      amount = attackModifiers.amount;
      const rangeMultiplier = this.getRangeDamageMultiplier(target, info);
      let masteryShotDistance = null;
      if (info.rangeProfile && Number.isFinite(info.originX) && Number.isFinite(info.originY) && attacker?.metrics) {
        const shotDistance = Math.hypot(target.x - info.originX, target.y - info.originY);
        masteryShotDistance = shotDistance;
        if (rangeMultiplier < 1) {
          attacker.metrics.rangePenaltyHits = (attacker.metrics.rangePenaltyHits || 0) + 1;
          if (shotDistance < info.rangeProfile.min) attacker.metrics.closeRangePenaltyHits += 1;
          else attacker.metrics.farRangePenaltyHits += 1;
        } else attacker.metrics.optimalRangeHits += 1;
        this.recordRangeSample(attacker, info, shotDistance, rangeMultiplier);
      }
      if (rangeMultiplier < 1) amount *= rangeMultiplier;
      if (target.isDefenseEnemy || target.playableDefenseType) {
        if (target.defenseCore && Number.isFinite(info.x) && Number.isFinite(info.y)) {
          const coreX = target.x + Math.cos(target.aim + target.defenseCore.angle) * target.defenseCore.distance;
          const coreY = target.y + Math.sin(target.aim + target.defenseCore.angle) * target.defenseCore.distance;
          if (Math.hypot(info.x - coreX, info.y - coreY) <= target.defenseCore.radius + (info.type === 'projectile' ? 7 : 16)) {
            amount *= 4.4;
            if (attacker?.metrics) attacker.metrics.coreHits += 1;
            this.effects.push({ type:'coreHit', x:coreX, y:coreY, ttl:.42, maxTtl:.42 });
          }
        }
        if (target.defenseType === 'borboros' && target.defenseAI?.borborosCores?.length && Number.isFinite(info.x) && Number.isFinite(info.y)) {
          for (let i=target.defenseAI.borborosCores.length-1;i>=0;i--) {
            const core=target.defenseAI.borborosCores[i];
            const a=target.aim+core.angle+Math.sin(this.elapsed*1.7+core.phase)*.18;
            const coreX=target.x+Math.cos(a)*core.distance, coreY=target.y+Math.sin(a)*core.distance;
            if (Math.hypot(info.x-coreX,info.y-coreY)>core.radius+(info.type==='projectile'?7:16)) continue;
            if (core.trueCore) { amount*=4.4; if(attacker?.metrics)attacker.metrics.coreHits+=1; this.effects.push({type:'coreHit',x:coreX,y:coreY,ttl:.48,maxTtl:.48}); }
            else { target.defenseAI.borborosCores.splice(i,1); amount*=.12; this.effects.push({type:'hit',x:coreX,y:coreY,ttl:.24,maxTtl:.24}); }
            break;
          }
        }
        const sourceAngle = attacker ? Math.atan2(attacker.y - target.y, attacker.x - target.x) : 0;
        if (target.defenseType === 'rabbit' && attacker) {
          const front = Math.abs(angleDiff(sourceAngle, target.aim)) < 1.18;
          amount *= front ? .38 : 1.08;
        }
        if (target.defenseType === 'ilgar' && target.defenseAI?.selfDestruct) amount *= .44;
        if (target.defenseType === 'borboros' && ['liquid', 'gas'].includes(target.defenseAI?.phase)) amount *= .08;
        if (target.defenseType === 'orochi' && attacker && amount <= (target.reflectThreshold || 0) && !attacker.dead) {
          this.damagePlayer(attacker, Math.max(8, amount * .72), target, { x: target.x, y: target.y, type: 'fire', name: '大蛇の反火', sourceKey: 'orochiReflect', skipJustCut: true, shieldPierce: true });
        }
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
      if (target.ai && attacker?.id) {
        target.ai.lastAttackerId = attacker.id; target.ai.lastHostileContactAt = this.elapsed;
        const major = amount >= target.maxHp * .18;
        this.addThreat(target, attacker, major ? 34 : 22, major ? 'majorHit' : 'attacked', major ? 8 : 5.5);
      }
      if (target.ai && attacker && attacker.id !== target.id) target.ai.lastHostileContactAt = this.elapsed;
      const attackAngle = Math.atan2((Number.isFinite(info.y) ? info.y : attacker?.y || target.y) - target.y, (Number.isFinite(info.x) ? info.x : attacker?.x || target.x) - target.x);
      this.tryAutoGuard(target, info, amount);
      const shieldEntries = this.getActiveShieldEntries(target);
      if (!info.shieldPierce && shieldEntries.length) {
        const fullGuard = shieldEntries.length >= 2;
        const facing = target.aim;
        const inArc = Math.abs(angleDiff(attackAngle, facing)) < 1.18;
        if (fullGuard || inArc) {
          const justEntry = shieldEntries.find(({state}) => state.justGuardAvailable && this.elapsed <= (state.justGuardUntil || 0));
          if (justEntry) {
            justEntry.state.justGuardAvailable = false;
            justEntry.state.lastJustGuardAt = this.elapsed;
            justEntry.state.redeployCooldownUntil = this.elapsed;
            target.metrics.blockedDamage += amount;
            target.metrics.shieldDamagePrevented += amount;
            target.metrics.shieldBlocks += 1;
            target.metrics.justGuards = (target.metrics.justGuards || 0) + 1;
            justEntry.state.masteryAttempt = false;
            this.adjustMastery(target, .5, 'ジャストガード成功', {major:true});
            this.effects.push({ type:'justCut', x:target.x, y:target.y, angle:attackAngle, radius:target.radius+34, ttl:.3, maxTtl:.3, color:justEntry.state.type === 'raygust' ? '#c9ffff' : justEntry.state.type === 'seal' ? '#fff7d2' : '#e0f8ff' });
            if (target.human) this.toast('JUST GUARD');
            return false;
          }
          const originalAmount = amount;
          let remaining = amount;
          const moving = Math.hypot(target.vx, target.vy) > target.speed * .25;
          const durabilityLossFactor = moving ? 1.2 : 1;
          for (const entry of shieldEntries.sort((a,b) => (b.state.current*b.shield.strength)-(a.state.current*a.shield.strength))) {
            if (remaining <= .001) break;
            const capacity = entry.state.current * entry.shield.strength / durabilityLossFactor;
            const absorbed = Math.min(remaining, capacity);
            entry.state.current = Math.max(0, entry.state.current - absorbed / Math.max(.4, entry.shield.strength) * durabilityLossFactor);
            entry.state.lastHitAt = this.elapsed;
            entry.state.justGuardAvailable = false;
            remaining -= absorbed;
            if (entry.state.current <= .001) this.breakShield(target, entry.hand, entry.state);
          }
          const prevented = originalAmount - remaining;
          if (prevented > 0) {
            target.metrics.blockedDamage += prevented;
            target.metrics.shieldDamagePrevented += prevented;
            target.metrics.shieldBlocks += 1;
            this.effects.push({ type:'shieldHit', x:target.x, y:target.y, angle:attackAngle, ttl:.18, maxTtl:.18 });
          }
          if (remaining <= .001) return false;
          amount = remaining;
        }
      }
      amount *= (target.supportBuff?.defense || 1);
      const effectiveDamage = Math.min(target.hp, amount);
      target.hp -= amount;
      if (attacker && attacker !== target && effectiveDamage > 0) this.recordMasteryHit(attacker, info, target, effectiveDamage, rangeMultiplier, masteryShotDistance);
      if (effectiveDamage >= target.maxHp * .18) target.lastMajorDamageAt = this.elapsed;
      target.metrics.damageTaken += effectiveDamage;
      if (target.toggles.chameleon && amount < target.maxHp * .18) {
        for (const observer of this.players) if (observer.ai?.threat?.[target.id] && observer !== attacker) delete observer.ai.threat[target.id];
      } else if (target.toggles.chameleon && amount >= target.maxHp * .18) target.toggles.chameleon = false;
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
      return true;
    }

    bailout(target, attacker, sourceName, context = {}) {
      if (target.dead) return;
      target.metrics.longestLife = Math.max(target.metrics.longestLife, target.metrics.currentLife);
      target.hp = 0;
      target.dead = true;
      target.respawnTimer = target.defenseSupportType ? Infinity : 4.2;
      if(target.geistActive){target.geistActive=false;target.geistTimer=0;target.speed=target.geistBaseSpeed||target.speed;}
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
        if(wall.type==='shoji'&&wall.respawnable){
          if(wall.hp<=0){
            if(!wall.destroyedLogged){wall.destroyedLogged=true;wall.respawnTimer=Array.isArray(wall.respawnDelay)?rand(wall.respawnDelay[0],wall.respawnDelay[1]):26;this.lifecycleStats.terrainDestroyed+=1;this.logEvent('terrain_destroyed',`shoji:${wall.id}`,false);}
            wall.respawnTimer-=dt;
            const cx=wall.x+wall.w/2,cy=wall.y+wall.h/2;
            if(wall.respawnTimer<=0&&!this.players.some(p=>!p.dead&&Math.hypot(p.x-cx,p.y-cy)<Math.max(65,Math.max(wall.w,wall.h)*.62))){wall.hp=wall.maxHp;wall.destroyedLogged=false;wall.respawnTimer=0;this.lifecycleStats.terrainRespawned+=1;this.logEvent('terrain_respawn',`shoji:${wall.id}`,false);}
          }
          continue;
        }
        wall.ttl -= dt;
        if (wall.ttl <= 0 || wall.hp <= 0) {
          const destroyed=wall.hp<=0;
          if(destroyed&&['tree','buildingWall','fortressWall','bridge','barricade','shoji','templeWall','shrineStone'].includes(wall.type)){ this.lifecycleStats.terrainDestroyed += 1; this.logEvent('terrain_destroyed',`${wall.type}:${wall.id}`,false); }
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
        if(beacon.shrineSpirit){
          beacon.maxHp=beacon.maxHp||42;
          beacon.exposedTeams||={};
          if(beacon.hp<=0){
            if(beacon.active!==false){ beacon.active=false; beacon.respawnTimer=rand(28,42); this.lifecycleStats.spiritsDestroyed+=1; this.logEvent('hitodama_destroyed',beacon.id,false); }
            beacon.respawnTimer-=dt;
            if(beacon.respawnTimer<=0){ beacon.hp=beacon.maxHp; beacon.active=true; beacon.x=beacon.spawnX; beacon.y=beacon.spawnY; beacon.vx=rand(-24,24); beacon.vy=rand(-24,24); beacon.exposedTeams={}; this.lifecycleStats.spiritsRespawned+=1; this.logEvent('hitodama_respawn',beacon.id,false); }
            continue;
          }
          beacon.vx=Number.isFinite(beacon.vx)?beacon.vx:rand(-24,24);
          beacon.vy=Number.isFinite(beacon.vy)?beacon.vy:rand(-24,24);
          beacon.x+=beacon.vx*dt; beacon.y+=beacon.vy*dt;
          if(beacon.x<beacon.minX||beacon.x>beacon.maxX){beacon.vx*=-1;beacon.x=clamp(beacon.x,beacon.minX,beacon.maxX);}
          if(beacon.y<beacon.minY||beacon.y>beacon.maxY){beacon.vy*=-1;beacon.y=clamp(beacon.y,beacon.minY,beacon.maxY);}
          if(Math.random()<.012){beacon.vx=rand(-34,34);beacon.vy=rand(-34,34);}
          continue;
        }
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
              this.recordMasteryUtilitySuccess(owner, 'switchboxBind', target, .4, '拘束トラップ成功');
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

    getScopeTrigger(p = this.human) {
      if (!p || p.dead) return null;
      const selected = ['main', 'sub'].map((hand) => DATA.triggers[p.loadout?.[hand]?.[p.selected?.[hand]]]).filter(Boolean);
      return selected.find((trigger) => trigger.kind === 'sniper') || selected.find((trigger) => trigger.kind === 'gun') || null;
    }

    toggleScope() {
      if (!this.isPlayerCombatant || this.spectating || !this.human || this.human.dead) return;
      const trigger = this.getScopeTrigger(this.human);
      if (!trigger) {
        this.scopeActive = false;
        this.toast('スコープ対応の銃手・狙撃手トリガーを選択してください');
        return;
      }
      this.scopeActive = !this.scopeActive;
      if (this.scopeActive) {
        const profile = this.getTriggerRangeProfile(trigger);
        this.scopeAim = this.human.aim;
        const initial = trigger.kind === 'sniper'
          ? clamp((profile?.min || 500) * .72, 260, 620)
          : clamp((profile?.min || 160) * .82, 100, 300);
        this.scopeDistance = initial;
        this.scopeTargetDistance = initial;
        this.updateScopeReticle(this.human);
        this.scopeTargetPoint.x = this.scopeReticle.x;
        this.scopeTargetPoint.y = this.scopeReticle.y;
        this.input.mouse.dx = 0;
        this.input.mouse.dy = 0;
        this.input.mouse.wheel = 0;
      }
      this.toast(this.scopeActive ? `${trigger.name}　SCOPE ON　上下で距離調整` : 'SCOPE OFF');
    }

    getScopeDistanceLimits(trigger) {
      const profile = this.getTriggerRangeProfile(trigger) || { min: 100, max: 700 };
      const min = trigger?.kind === 'sniper' ? 70 : 45;
      const max = trigger?.kind === 'sniper'
        ? Math.max(profile.max * 2.45, profile.max + 1900)
        : Math.max(profile.max * 1.65, profile.max + 520);
      return { min, max: Math.min(max, Math.hypot(this.world.w, this.world.h)) };
    }

    updateScopeReticle(p) {
      if (!p) return this.scopeReticle;
      this.scopeReticle.x = clamp(p.x + Math.cos(this.scopeAim) * this.scopeDistance, 0, this.world.w);
      this.scopeReticle.y = clamp(p.y + Math.sin(this.scopeAim) * this.scopeDistance, 0, this.world.h);
      return this.scopeReticle;
    }

    getScopeReticlePoint(p = this.human) {
      if (!p) return { x: 0, y: 0 };
      if (!this.scopeActive) return { x: p.x + Math.cos(p.aim) * 520, y: p.y + Math.sin(p.aim) * 520 };
      return this.updateScopeReticle(p);
    }

    updateScopeControl(p, trigger, dt) {
      const limits = this.getScopeDistanceLimits(trigger);
      const mobileTouch = Boolean(this.input.virtualAim.touching);
      const target = this.scopeTargetPoint || (this.scopeTargetPoint = { x: this.scopeReticle.x, y: this.scopeReticle.y });
      const pointerSpeed = trigger.kind === 'sniper' ? 245 : 185;
      const mouseScale = trigger.kind === 'sniper' ? .72 : .58;
      const keySpeed = trigger.kind === 'sniper' ? 520 : 360;

      // Move the reticle in screen/world directions directly. This avoids the
      // orientation-dependent reversal caused by rotating around the player.
      if (mobileTouch) {
        target.x += this.input.virtualAim.x * pointerSpeed * dt;
        target.y += this.input.virtualAim.y * pointerSpeed * dt;
      } else {
        target.x += this.input.mouse.dx * mouseScale;
        target.y += this.input.mouse.dy * mouseScale;
      }

      if (this.input.isDown('ArrowLeft')) target.x -= keySpeed * dt;
      if (this.input.isDown('ArrowRight')) target.x += keySpeed * dt;
      if (this.input.isDown('ArrowUp')) target.y -= keySpeed * dt;
      if (this.input.isDown('ArrowDown')) target.y += keySpeed * dt;

      // The wheel only changes distance along the current sight line.
      const tx = target.x - p.x;
      const ty = target.y - p.y;
      const targetLength = Math.hypot(tx, ty) || 1;
      if (!mobileTouch && this.input.mouse.wheel) {
        const wheelDistance = -this.input.mouse.wheel * (trigger.kind === 'sniper' ? .82 : .55);
        const nextLength = clamp(targetLength + wheelDistance, limits.min, limits.max);
        target.x = p.x + tx / targetLength * nextLength;
        target.y = p.y + ty / targetLength * nextLength;
      }

      let dx = target.x - p.x;
      let dy = target.y - p.y;
      let distance = Math.hypot(dx, dy);
      if (distance < .001) {
        dx = Math.cos(this.scopeAim || p.aim);
        dy = Math.sin(this.scopeAim || p.aim);
        distance = 1;
      }
      const clampedDistance = clamp(distance, limits.min, limits.max);
      target.x = clamp(p.x + dx / distance * clampedDistance, 0, this.world.w);
      target.y = clamp(p.y + dy / distance * clampedDistance, 0, this.world.h);

      const follow = 1 - Math.exp(-(trigger.kind === 'sniper' ? 4.1 : 5.0) * dt);
      this.scopeReticle.x = lerp(this.scopeReticle.x, target.x, follow);
      this.scopeReticle.y = lerp(this.scopeReticle.y, target.y, follow);
      this.scopeAim = Math.atan2(this.scopeReticle.y - p.y, this.scopeReticle.x - p.x);
      this.scopeDistance = Math.hypot(this.scopeReticle.x - p.x, this.scopeReticle.y - p.y);
      this.scopeTargetDistance = clampedDistance;
      p.aim = this.scopeAim;
    }

    getScopeTargetInfo(p, trigger) {
      const profile = this.getTriggerRangeProfile(trigger);
      if (!p || !profile) return null;
      const reticle = this.getScopeReticlePoint(p);
      const aimedDistance = Math.hypot(reticle.x - p.x, reticle.y - p.y);
      let bestTarget = null;
      let bestScore = Infinity;
      const acquireRadius = trigger.kind === 'sniper' ? 66 : 54;
      for (const target of this.players) {
        if (!this.canDamage(p, target)) continue;
        const cursorDistance = Math.hypot(target.x - reticle.x, target.y - reticle.y);
        if (cursorDistance > acquireRadius + target.radius) continue;
        if (this.findBlockingWall(p.x, p.y, target.x, target.y, 3)) continue;
        if (cursorDistance < bestScore) {
          bestScore = cursorDistance;
          bestTarget = target;
        }
      }
      const distance = bestTarget ? Math.hypot(bestTarget.x - p.x, bestTarget.y - p.y) : aimedDistance;
      return {
        target: bestTarget,
        distance,
        aimedDistance,
        optimal: distance >= profile.min && distance <= profile.max,
        profile,
        reticle,
      };
    }

    updateCamera(dt) {
      if (this.isPlayerOperator) {
        this.camera.x = lerp(this.camera.x, this.operatorCamera.x - this.viewW / 2, 1 - Math.pow(.0015, dt));
        this.camera.y = lerp(this.camera.y, this.operatorCamera.y - this.viewH / 2, 1 - Math.pow(.0015, dt));
      } else {
        const focus = this.spectating ? (this.getSpectatorTarget() || this.players[0]) : this.human;
        if (!focus) return;
        let targetX = focus.x - this.viewW / 2;
        let targetY = focus.y - this.viewH / 2;
        const scopeTrigger = focus === this.human && this.scopeActive ? this.getScopeTrigger(this.human) : null;
        if (this.scopeActive && !scopeTrigger) this.scopeActive = false;
        if (scopeTrigger) {
          const reticle = this.getScopeReticlePoint(focus);
          const cameraShare = scopeTrigger.kind === 'sniper' ? .86 : .74;
          targetX = lerp(focus.x, reticle.x, cameraShare) - this.viewW / 2;
          targetY = lerp(focus.y, reticle.y, cameraShare) - this.viewH / 2;
        }
        this.camera.x = lerp(this.camera.x, targetX, 1 - Math.pow(scopeTrigger ? .025 : .0008, dt));
        this.camera.y = lerp(this.camera.y, targetY, 1 - Math.pow(scopeTrigger ? .025 : .0008, dt));
      }
      this.camera.x = clamp(this.camera.x, 0, Math.max(0, this.world.w - this.viewW));
      this.camera.y = clamp(this.camera.y, 0, Math.max(0, this.world.h - this.viewH));
    }

    revealOnAttack(p, duration, noiseRadius = 640) {
      p.revealTimer = Math.max(p.revealTimer, duration);
      this.emitCombatNoise(p, noiseRadius, noiseRadius > 800 ? 14 : 9, 'noise');
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
      this.drawSnowShrineFeatures(ctx);
      this.drawUndergroundFeatures(ctx);
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
      this.drawScopeOverlay(ctx);
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
      else if (this.mapId === 'snowShrine') this.renderSnowShrineTerrainChunk(chunk);
      else if (this.mapId === 'underground') this.renderUndergroundTerrainChunk(chunk);
      else this.renderCityTerrainChunk(chunk);
    }

    drawJapanesePattern(ctx, rect, motif='asanoha', alpha=.14) {
      ctx.save();
      ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
      ctx.imageSmoothingEnabled = false;
      const ink = `rgba(91,34,43,${alpha})`;
      const hi = `rgba(244,211,139,${alpha * .62})`;
      const step = motif === 'seigaiha' ? 24 : motif === 'kikkou' ? 28 : motif === 'shippo' ? 24 : 26;
      ctx.lineWidth = 2;
      for (let y = Math.floor(rect.y / step) * step - step; y < rect.y + rect.h + step; y += step) {
        for (let x = Math.floor(rect.x / step) * step - step; x < rect.x + rect.w + step; x += step) {
          ctx.strokeStyle = ink;
          if (motif === 'seigaiha') {
            ctx.beginPath(); ctx.arc(x, y + step * .48, step * .42, Math.PI, TAU); ctx.stroke();
            ctx.beginPath(); ctx.arc(x, y + step * .48, step * .22, Math.PI, TAU); ctx.stroke();
            ctx.fillStyle = hi; ctx.fillRect(x - 1, y + step * .44, 3, 3);
          } else if (motif === 'kikkou') {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const a = i / 6 * TAU, px = Math.round(x + Math.cos(a) * step * .32), py = Math.round(y + Math.sin(a) * step * .32);
              if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.stroke();
            ctx.fillStyle = hi; ctx.fillRect(x - 2, y - 2, 4, 4);
          } else if (motif === 'shippo') {
            ctx.beginPath(); ctx.arc(x - step * .12, y, step * .24, 0, TAU); ctx.stroke();
            ctx.beginPath(); ctx.arc(x + step * .12, y, step * .24, 0, TAU); ctx.stroke();
            ctx.fillStyle = hi; ctx.fillRect(x - 1, y - 1, 3, 3);
          } else {
            ctx.beginPath();
            ctx.moveTo(x - step * .34, y); ctx.lineTo(x, y - step * .34); ctx.lineTo(x + step * .34, y); ctx.lineTo(x, y + step * .34); ctx.closePath(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x - step * .24, y - step * .24); ctx.lineTo(x + step * .24, y + step * .24); ctx.moveTo(x + step * .24, y - step * .24); ctx.lineTo(x - step * .24, y + step * .24); ctx.stroke();
          }
        }
      }
      ctx.restore();
    }


renderUndergroundTerrainChunk(chunk) {
  const ctx = chunk.canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(-chunk.x, -chunk.y);
  ctx.beginPath(); ctx.rect(chunk.x, chunk.y, chunk.width, chunk.height); ctx.clip();
  const x0 = chunk.x, y0 = chunk.y, x1 = x0 + chunk.width, y1 = y0 + chunk.height;
  const inChunk = r => !(r.x > x1 || r.x + r.w < x0 || r.y > y1 || r.y + r.h < y0);
  ctx.fillStyle = '#17242b'; ctx.fillRect(x0, y0, chunk.width, chunk.height);
  for (let y = Math.floor(y0 / 32) * 32; y < y1; y += 32) {
    for (let x = Math.floor(x0 / 32) * 32; x < x1; x += 32) {
      const n = (((x / 32) | 0) * 7 + ((y / 32) | 0) * 13) & 3;
      ctx.fillStyle = n === 0 ? '#203039' : n === 1 ? '#1c2b33' : n === 2 ? '#22343d' : '#19272e';
      ctx.fillRect(x, y, 32, 32);
      ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(x + 3, y + 3, 20, 2);
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x + 20, y + 24, 8, 2);
    }
  }
  for (const zone of this.terrain.subwayPassengerZones || []) {
    if (!inChunk(zone)) continue;
    ctx.fillStyle = zone.id === 'main-platform' ? '#5e6870' : '#3d4950';
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    for (let y = zone.y; y < zone.y + zone.h; y += 40) {
      for (let x = zone.x; x < zone.x + zone.w; x += 56) {
        const n = (((x - zone.x) / 56) | 0) + (((y - zone.y) / 40) | 0);
        ctx.fillStyle = zone.id === 'main-platform' ? (n & 1 ? '#7b858e' : '#8b949b') : (n & 1 ? '#49565e' : '#55626a');
        ctx.fillRect(x + 2, y + 2, Math.min(52, zone.x + zone.w - x - 4), Math.min(36, zone.y + zone.h - y - 4));
      }
    }
  }
  for (const track of this.terrain.subwayTracks || []) {
    if (!inChunk(track)) continue;
    ctx.fillStyle = '#0b1418'; ctx.fillRect(track.x, track.y, track.w, track.h);
    ctx.fillStyle = '#2c3b41'; ctx.fillRect(track.x, track.y + 44, track.w, track.h - 88);
    for (let x = track.x + 12; x < track.x + track.w; x += 64) {
      ctx.fillStyle = '#645844'; ctx.fillRect(x, track.y + 86, 20, track.h - 172);
      ctx.fillRect(x + 28, track.y + 86, 20, track.h - 172);
    }
    ctx.fillStyle = '#c8d0d2'; ctx.fillRect(track.x, track.y + 112, track.w, 7); ctx.fillRect(track.x, track.y + track.h - 119, track.w, 7);
    ctx.fillStyle = '#929b9f'; ctx.fillRect(track.x, track.y + 102, track.w, 4); ctx.fillRect(track.x, track.y + track.h - 106, track.w, 4);
  }
  for (const zone of this.terrain.subwayServiceZones || []) if (inChunk(zone)) { ctx.fillStyle = '#2a3339'; ctx.fillRect(zone.x, zone.y, zone.w, zone.h); }
  ctx.strokeStyle = 'rgba(215,178,88,.45)'; ctx.lineWidth = 4;
  for (const wire of this.terrain.subwayWires || []) {
    const minX = Math.min(wire.x1, wire.x2), minY = Math.min(wire.y1, wire.y2), maxX = Math.max(wire.x1, wire.x2), maxY = Math.max(wire.y1, wire.y2);
    if (maxX < x0 || minX > x1 || maxY < y0 || minY > y1) continue;
    ctx.beginPath(); ctx.moveTo(wire.x1, wire.y1); ctx.lineTo(wire.x2, wire.y2); ctx.stroke();
  }
  for (const prop of this.terrain.subwayProps || []) {
    const rect = { x: (prop.x || 0) - (prop.w || 0) / 2, y: (prop.y || 0) - (prop.h || 0) / 2, w: prop.w || 0, h: prop.h || 0 };
    if (prop.kind === 'pillar') {
      if (prop.x + prop.w/2 < x0 || prop.x - prop.w/2 > x1 || prop.y + prop.h/2 < y0 || prop.y - prop.h/2 > y1) continue;
      ctx.fillStyle = '#4d5960'; ctx.fillRect(prop.x - prop.w / 2, prop.y - prop.h / 2, prop.w, prop.h);
      ctx.fillStyle = '#98a4aa'; ctx.fillRect(prop.x - prop.w / 2 + 6, prop.y - prop.h / 2 + 6, prop.w - 12, prop.h - 12);
      continue;
    }
    if (!inChunk(rect)) continue;
    if (prop.kind === 'bench') {
      ctx.fillStyle = '#394147'; ctx.fillRect(prop.x - prop.w / 2, prop.y - prop.h / 2, prop.w, prop.h);
      ctx.fillStyle = '#7f4d2d'; ctx.fillRect(prop.x - prop.w / 2 + 6, prop.y - prop.h / 2 + 6, prop.w - 12, 10); ctx.fillRect(prop.x - prop.w / 2 + 10, prop.y + 2, prop.w - 20, 8);
    } else if (prop.kind === 'locker') {
      ctx.fillStyle = '#263038'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); for (let i = 0; i < 4; i++) { ctx.fillStyle = i & 1 ? '#4a5c69' : '#536773'; ctx.fillRect(rect.x + 8 + i * 39, rect.y + 8, 32, rect.h - 16); }
    } else if (prop.kind === 'vending') {
      ctx.fillStyle = '#202a32'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.fillStyle = '#4ea0d8'; ctx.fillRect(rect.x + 10, rect.y + 10, rect.w - 20, 36); ctx.fillStyle = '#edf5f6'; for (let i = 0; i < 3; i++) ctx.fillRect(rect.x + 16, rect.y + 56 + i * 16, rect.w - 32, 8);
    } else if (prop.kind === 'ticketBooth') {
      ctx.fillStyle = '#29343c'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.fillStyle = '#6fb8de'; ctx.fillRect(rect.x + 12, rect.y + 12, rect.w - 24, 28); ctx.fillStyle = '#9caab1'; ctx.fillRect(rect.x + 18, rect.y + 52, rect.w - 36, 38);
    } else if (prop.kind === 'warningStripe') {
      for (let x = rect.x; x < rect.x + rect.w; x += 22) { ctx.fillStyle = ((x - rect.x) / 22 | 0) & 1 ? '#1b1b1b' : '#dfc04a'; ctx.fillRect(x, rect.y, Math.min(20, rect.x + rect.w - x), rect.h); }
    } else if (prop.kind === 'stairs') {
      ctx.fillStyle = '#4d5760'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); for (let y = rect.y + 6; y < rect.y + rect.h; y += 10) { ctx.fillStyle = '#929ca1'; ctx.fillRect(rect.x + 8, y, rect.w - 16, 4); }
    } else if (prop.kind === 'pipeRack') {
      ctx.fillStyle = '#364148'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.fillStyle = '#8b9aa3'; ctx.fillRect(rect.x, rect.y + 6, rect.w, 6); ctx.fillRect(rect.x, rect.y + 18, rect.w, 6);
    } else if (prop.kind === 'generator') {
      ctx.fillStyle = '#20282d'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.fillStyle = '#58666e'; ctx.fillRect(rect.x + 10, rect.y + 10, rect.w - 20, rect.h - 20); ctx.fillStyle = '#e4c65c'; for (let i = 0; i < 4; i++) ctx.fillRect(rect.x + 20 + i * 36, rect.y + 20, 20, 12);
    } else if (prop.kind === 'pump') {
      ctx.fillStyle = '#314149'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.fillStyle = '#688290'; ctx.fillRect(rect.x + 10, rect.y + 14, rect.w - 20, rect.h - 28); ctx.strokeStyle = '#b7d4df'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(rect.x + 26, rect.y + 16); ctx.lineTo(rect.x + 26, rect.y - 24); ctx.lineTo(rect.x + rect.w - 22, rect.y - 24); ctx.stroke();
    } else if (prop.kind === 'crate') {
      ctx.fillStyle = '#5a4735'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.fillStyle = '#82654b'; ctx.fillRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
    } else if (prop.kind === 'cart') {
      ctx.fillStyle = '#2c3940'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.fillStyle = '#8da3ad'; ctx.fillRect(rect.x + 8, rect.y + 8, rect.w - 16, rect.h - 20); ctx.fillStyle = '#1d2428'; ctx.fillRect(rect.x + 12, rect.y + rect.h - 10, 18, 10); ctx.fillRect(rect.x + rect.w - 30, rect.y + rect.h - 10, 18, 10);
    } else if (prop.kind === 'grate') {
      ctx.fillStyle = '#1e252a'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.strokeStyle = '#71818a'; ctx.lineWidth = 2; for (let x = rect.x + 8; x < rect.x + rect.w; x += 14) { ctx.beginPath(); ctx.moveTo(x, rect.y + 4); ctx.lineTo(x, rect.y + rect.h - 4); ctx.stroke(); }
    }
  }
  ctx.restore();
}


    renderUndergroundTerrainChunk(chunk) {
      const ctx = chunk.canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(-chunk.x, -chunk.y);
      ctx.beginPath(); ctx.rect(chunk.x, chunk.y, chunk.width, chunk.height); ctx.clip();
      const x0 = chunk.x, y0 = chunk.y, x1 = x0 + chunk.width, y1 = y0 + chunk.height;
      const visible = (r) => !(r.x > x1 || r.x + r.w < x0 || r.y > y1 || r.y + r.h < y0);
      const tiled = (r, size, palette, inset = 1) => {
        if (!visible(r)) return;
        const sx = Math.floor(Math.max(r.x, x0) / size) * size;
        const sy = Math.floor(Math.max(r.y, y0) / size) * size;
        for (let y = sy; y < Math.min(r.y + r.h, y1); y += size) {
          for (let x = sx; x < Math.min(r.x + r.w, x1); x += size) {
            if (x + size < r.x || y + size < r.y) continue;
            const ix = Math.floor((x - r.x) / size), iy = Math.floor((y - r.y) / size);
            const base = palette[(ix * 3 + iy * 5) % palette.length];
            ctx.fillStyle = base; ctx.fillRect(x, y, size, size);
            ctx.fillStyle = 'rgba(255,255,255,.045)'; ctx.fillRect(x + inset + 1, y + inset + 1, Math.max(2, size - inset * 2 - 3), 1);
            ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x + size - inset - 3, y + size - inset - 2, 2, 1);
            if (((ix + iy) & 3) === 0) { ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(x + size - 5, y + 4, 2, 2); }
          }
        }
      };

      ctx.fillStyle = '#11181e'; ctx.fillRect(x0, y0, chunk.width, chunk.height);
      tiled({ x: 0, y: 0, w: this.world.w, h: this.world.h }, 16, ['#182229', '#1b262d', '#1e2930', '#202c33']);

      for (const zone of this.terrain.subwayPassengerZones || []) {
        if (zone.id === 'concourse') {
          tiled(zone, 16, ['#536168', '#5e6d74', '#66747a']);
          ctx.fillStyle = '#75838a'; ctx.fillRect(zone.x, zone.y, zone.w, 16); ctx.fillRect(zone.x, zone.y + zone.h - 16, zone.w, 16);
          for (let x = zone.x + 32; x < zone.x + zone.w; x += 96) { ctx.fillStyle = '#8c989e'; ctx.fillRect(x, zone.y + 22, 48, 4); }
        } else {
          tiled(zone, 16, ['#6f787e', '#7b858a', '#838c91']);
          ctx.fillStyle = '#424c52'; ctx.fillRect(zone.x, zone.y, zone.w, 18);
          ctx.fillStyle = '#d2b94f'; ctx.fillRect(zone.x, zone.y + zone.h - 44, zone.w, 18);
          for (let x = zone.x + 8; x < zone.x + zone.w; x += 24) { ctx.fillStyle = ((x / 24) & 1) ? '#e2ce75' : '#78652d'; ctx.fillRect(x, zone.y + zone.h - 42, 12, 14); }
        }
      }

      for (const track of this.terrain.subwayTracks || []) {
        if (!visible(track)) continue;
        ctx.fillStyle = '#080d11'; ctx.fillRect(track.x, track.y, track.w, track.h);
        tiled({ x: track.x, y: track.y + 28, w: track.w, h: track.h - 56 }, 16, ['#262b2d', '#303638', '#373b3b']);
        for (let x = track.x + 20; x < track.x + track.w; x += 48) {
          ctx.fillStyle = '#5d4633'; ctx.fillRect(x, track.y + 82, 18, track.h - 164);
          ctx.fillRect(x + 20, track.y + 82, 18, track.h - 164);
        }
        ctx.fillStyle = '#c8d2d5'; ctx.fillRect(track.x, track.y + 98, track.w, 7); ctx.fillRect(track.x, track.y + track.h - 105, track.w, 7);
        ctx.fillStyle = '#899499'; ctx.fillRect(track.x, track.y + 94, track.w, 3); ctx.fillRect(track.x, track.y + track.h - 101, track.w, 3);
        ctx.fillStyle = '#080d11'; ctx.fillRect(track.x + 48, track.y + track.h / 2 - 24, track.w - 96, 48);
      }

      for (const zone of this.terrain.subwayServiceZones || []) tiled(zone, 16, ['#37444a', '#3f4d54', '#45545a']);
      for (const road of this.terrain.roads || []) {
        if (!String(road.id || '').startsWith('service-')) continue;
        tiled(road, 16, ['#606b70', '#69747a', '#737d82']);
        ctx.fillStyle = 'rgba(220,230,232,.08)'; ctx.fillRect(road.x, road.y, road.w, 4);
      }
      for (const plaza of this.terrain.plazas || []) {
        if (!plaza.service) continue;
        tiled(plaza, 16, ['#68757a', '#748086', '#7c888d']);
        ctx.fillStyle = '#334148'; ctx.fillRect(plaza.x, plaza.y, plaza.w, 10); ctx.fillRect(plaza.x, plaza.y + plaza.h - 10, plaza.w, 10);
      }

      const roomPalettes = {
        pump: ['#4d656d', '#56717a'], drain: ['#455b64', '#506872'], storage: ['#645b4e', '#706657'],
        ops: ['#4e626d', '#5a707c'], workshop: ['#62665e', '#6d7268'], maintenance: ['#505a60', '#5b666c'],
        electrical: ['#484e5a', '#535b68'], breaker: ['#444b54', '#505a64'], tenant: ['#6c6356', '#7a7061'],
      };
      for (const room of this.terrain.buildings.filter((b) => b.subwayRoom)) {
        tiled(room, 16, roomPalettes[room.subwayRoomType] || ['#525f66', '#5d6a71']);
        ctx.strokeStyle = 'rgba(14,19,22,.65)'; ctx.lineWidth = 4; ctx.strokeRect(room.x + 2, room.y + 2, room.w - 4, room.h - 4);
        if (room.subwayRoomType === 'tenant') {
          ctx.fillStyle = '#3a2f28'; ctx.fillRect(room.x + 16, room.y + room.h - 56, room.w - 32, 28);
          ctx.fillStyle = '#d4b35d'; for (let x = room.x + 24; x < room.x + room.w - 30; x += 48) ctx.fillRect(x, room.y + room.h - 52, 24, 8);
        }
      }

      for (const water of this.terrain.subwayWaterways || []) {
        if (!visible(water)) continue;
        ctx.fillStyle = '#20292d'; ctx.fillRect(water.x, water.y, water.w, water.h);
        tiled(water, 16, ['#273238', '#2e3a40']);
        ctx.fillStyle = '#68757a';
        if (water.w >= water.h) { ctx.fillRect(water.x, water.y - 6, water.w, 6); ctx.fillRect(water.x, water.y + water.h, water.w, 6); }
        else { ctx.fillRect(water.x - 6, water.y, 6, water.h); ctx.fillRect(water.x + water.w, water.y, 6, water.h); }
      }

      ctx.strokeStyle = 'rgba(218,186,86,.42)'; ctx.lineWidth = 4;
      for (const wire of this.terrain.subwayWires || []) { ctx.beginPath(); ctx.moveTo(wire.x1, wire.y1); ctx.lineTo(wire.x2, wire.y2); ctx.stroke(); }

      const drawProp = (prop) => {
        const r = { x: prop.x - prop.w / 2, y: prop.y - prop.h / 2, w: prop.w, h: prop.h };
        if (!visible(r)) return;
        if (prop.kind === 'pillar') {
          ctx.fillStyle = '#424d54'; ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.fillStyle = '#9aa6ab'; ctx.fillRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12);
          ctx.fillStyle = '#d8e1e4'; ctx.fillRect(r.x + 8, r.y + 8, r.w - 16, 4);
        } else if (prop.kind === 'bench') {
          ctx.fillStyle = '#303a40'; ctx.fillRect(r.x, r.y + 10, r.w, r.h - 12);
          ctx.fillStyle = prop.variant === 'metal' ? '#8d9da5' : '#8d623e'; ctx.fillRect(r.x + 8, r.y, r.w - 16, 12); ctx.fillRect(r.x + 12, r.y + 20, r.w - 24, 7);
        } else if (prop.kind === 'ticketBooth') {
          ctx.fillStyle = '#28343b'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#75abc0'; ctx.fillRect(r.x + 12, r.y + 12, r.w - 24, 32); ctx.fillStyle = '#9daab0'; ctx.fillRect(r.x + 18, r.y + 58, r.w - 36, r.h - 76);
        } else if (prop.kind === 'locker') {
          ctx.fillStyle = '#273139'; ctx.fillRect(r.x, r.y, r.w, r.h);
          for (let x = r.x + 8; x < r.x + r.w - 30; x += 40) { ctx.fillStyle = ((x / 40) & 1) ? '#526873' : '#5e7480'; ctx.fillRect(x, r.y + 8, 32, r.h - 16); ctx.fillStyle = '#d5dee2'; ctx.fillRect(x + 26, r.y + 22, 2, 14); }
        } else if (prop.kind === 'vending') {
          ctx.fillStyle = '#202a32'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#4ea0d8'; ctx.fillRect(r.x + 10, r.y + 10, r.w - 20, 38); ctx.fillStyle = '#edf5f6'; for (let i = 0; i < 4; i++) ctx.fillRect(r.x + 16, r.y + 58 + i * 16, r.w - 32, 8);
        } else if (prop.kind === 'warningStripe') {
          for (let x = r.x; x < r.x + r.w; x += 20) { ctx.fillStyle = (((x - r.x) / 20) | 0) & 1 ? '#171717' : '#dfc04a'; ctx.fillRect(x, r.y, Math.min(18, r.x + r.w - x), r.h); }
        } else if (prop.kind === 'stairs') {
          ctx.fillStyle = '#4d5860'; ctx.fillRect(r.x, r.y, r.w, r.h); for (let y = r.y + 6; y < r.y + r.h; y += 10) { ctx.fillStyle = '#9aa4aa'; ctx.fillRect(r.x + 8, y, r.w - 16, 4); }
        } else if (prop.kind === 'pipeRack') {
          ctx.fillStyle = '#344047'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#8d9ba3'; ctx.fillRect(r.x, r.y + 6, r.w, 6); ctx.fillRect(r.x, r.y + 20, r.w, 6); for (let x = r.x + 20; x < r.x + r.w; x += 64) { ctx.fillStyle = '#58666e'; ctx.fillRect(x, r.y + 2, 6, r.h - 4); }
        } else if (prop.kind === 'pump') {
          ctx.fillStyle = '#2f4048'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#6d8996'; ctx.fillRect(r.x + 12, r.y + 14, r.w - 24, r.h - 28); ctx.fillStyle = '#bfd8e0'; ctx.fillRect(r.x + 24, r.y - 20, 8, 36); ctx.fillRect(r.x + 24, r.y - 20, r.w - 48, 8);
        } else if (prop.kind === 'generator') {
          ctx.fillStyle = '#20282d'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#59676f'; ctx.fillRect(r.x + 10, r.y + 10, r.w - 20, r.h - 20); ctx.fillStyle = '#e4c65c'; for (let i = 0; i < 4; i++) ctx.fillRect(r.x + 20 + i * 42, r.y + 20, 22, 12);
        } else if (prop.kind === 'crate') {
          ctx.fillStyle = '#5a4735'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#82654b'; ctx.fillRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10); ctx.fillStyle = '#4f3928'; ctx.fillRect(r.x + r.w / 2 - 2, r.y + 4, 4, r.h - 8);
        } else if (prop.kind === 'cabinet') {
          ctx.fillStyle = '#425159'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#94aab5'; ctx.fillRect(r.x + 8, r.y + 8, r.w - 16, r.h - 16); ctx.fillStyle = '#263138'; ctx.fillRect(r.x + r.w / 2 - 2, r.y + 10, 4, r.h - 20);
        } else if (prop.kind === 'cart') {
          ctx.fillStyle = '#2c3940'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#8da3ad'; ctx.fillRect(r.x + 8, r.y + 8, r.w - 16, r.h - 20); ctx.fillStyle = '#1d2428'; ctx.fillRect(r.x + 12, r.y + r.h - 10, 18, 10); ctx.fillRect(r.x + r.w - 30, r.y + r.h - 10, 18, 10);
        } else if (prop.kind === 'grate') {
          ctx.fillStyle = '#1e252a'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = '#71818a'; ctx.lineWidth = 2; for (let x = r.x + 8; x < r.x + r.w; x += 14) { ctx.beginPath(); ctx.moveTo(x, r.y + 4); ctx.lineTo(x, r.y + r.h - 4); ctx.stroke(); } for (let y = r.y + 8; y < r.y + r.h; y += 14) { ctx.beginPath(); ctx.moveTo(r.x + 4, y); ctx.lineTo(r.x + r.w - 4, y); ctx.stroke(); }
        } else if (prop.kind === 'fence') {
          ctx.fillStyle = '#707e86'; ctx.fillRect(r.x, r.y + r.h / 2 - 3, r.w, 6); for (let x = r.x + 8; x < r.x + r.w; x += 18) ctx.fillRect(x, r.y, 4, r.h);
        } else if (prop.kind === 'signalBox') {
          ctx.fillStyle = '#2a343a'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#94aeb8'; ctx.fillRect(r.x + 10, r.y + 8, r.w - 20, r.h - 16); ctx.fillStyle = '#e75f55'; ctx.fillRect(r.x + 18, r.y + 18, 14, 14); ctx.fillStyle = '#70e197'; ctx.fillRect(r.x + 18, r.y + 42, 14, 14);
        } else if (prop.kind === 'kiosk') {
          ctx.fillStyle = '#2b353b'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#c45f4e'; ctx.fillRect(r.x + 10, r.y + 10, r.w - 20, 26); ctx.fillStyle = '#d8ddd9'; ctx.fillRect(r.x + 14, r.y + 42, r.w - 28, 42); ctx.fillStyle = '#8b9ca3'; ctx.fillRect(r.x + 18, r.y + 92, r.w - 36, r.h - 106);
        } else if (prop.kind === 'planter') {
          ctx.fillStyle = '#4f5a60'; ctx.fillRect(r.x, r.y + 10, r.w, r.h - 10); ctx.fillStyle = '#80936d'; ctx.fillRect(r.x + 8, r.y + 2, r.w - 16, 18); ctx.fillStyle = '#98b27e'; for (let x = r.x + 14; x < r.x + r.w - 14; x += 16) ctx.fillRect(x, r.y - 8 + ((x / 16) & 1) * 4, 8, 16);
        } else if (prop.kind === 'poster') {
          const c = prop.variant === 'red' ? '#d96c61' : prop.variant === 'green' ? '#7fc77a' : prop.variant === 'yellow' ? '#e0c35c' : '#65a7d5';
          ctx.fillStyle = '#273139'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#dde4e7'; ctx.fillRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8); ctx.fillStyle = c; ctx.fillRect(r.x + 8, r.y + 10, r.w - 16, 18); ctx.fillStyle = '#74838c'; ctx.fillRect(r.x + 8, r.y + 38, r.w - 16, 6); ctx.fillRect(r.x + 8, r.y + 52, r.w - 16, 6);
        } else if (prop.kind === 'signStand') {
          ctx.fillStyle = '#2d373d'; ctx.fillRect(r.x + r.w / 2 - 6, r.y + 10, 12, r.h - 16); ctx.fillStyle = '#9eb4bc'; ctx.fillRect(r.x + 6, r.y, r.w - 12, 34); ctx.fillStyle = '#1d252a'; ctx.fillRect(r.x + 10, r.y + 5, r.w - 20, 8);
        } else if (prop.kind === 'shelf') {
          ctx.fillStyle = '#584b3e'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#8b775e'; ctx.fillRect(r.x + 6, r.y + 10, r.w - 12, 8); ctx.fillRect(r.x + 6, r.y + 32, r.w - 12, 8); ctx.fillRect(r.x + 6, r.y + 54, r.w - 12, 8);
        } else if (prop.kind === 'workbench') {
          ctx.fillStyle = '#594b3e'; ctx.fillRect(r.x, r.y + 16, r.w, r.h - 16); ctx.fillStyle = '#9a7f60'; ctx.fillRect(r.x + 4, r.y, r.w - 8, 20); ctx.fillStyle = '#4b5d67'; ctx.fillRect(r.x + 18, r.y + 6, 18, 8); ctx.fillRect(r.x + 44, r.y + 8, 24, 6); ctx.fillRect(r.x + r.w - 48, r.y + 6, 18, 8);
        } else if (prop.kind === 'barrel') {
          ctx.fillStyle = '#3a2c24'; ctx.fillRect(r.x + 6, r.y, r.w - 12, r.h); ctx.fillStyle = '#7e5438'; ctx.fillRect(r.x, r.y + 8, r.w, r.h - 16); ctx.fillStyle = '#b38a58'; ctx.fillRect(r.x + 4, r.y + 18, r.w - 8, 6); ctx.fillRect(r.x + 4, r.y + r.h - 24, r.w - 8, 6);
        } else if (prop.kind === 'valve') {
          ctx.fillStyle = '#324148'; ctx.fillRect(r.x + r.w / 2 - 6, r.y + 20, 12, r.h - 20); ctx.strokeStyle = '#d26955'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + 18, 16, 0, TAU); ctx.stroke(); ctx.fillStyle = '#e7d7d1'; ctx.fillRect(r.x + r.w / 2 - 4, r.y + 4, 8, 28); ctx.fillRect(r.x + 10, r.y + 14, r.w - 20, 8);
        }
      };
      for (const prop of this.terrain.subwayProps || []) drawProp(prop);
      ctx.restore();
    }

    renderSnowShrineTerrainChunk(chunk) {
      const ctx = chunk.canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(-chunk.x, -chunk.y);
      ctx.beginPath(); ctx.rect(chunk.x, chunk.y, chunk.width, chunk.height); ctx.clip();
      const x0 = chunk.x, y0 = chunk.y, x1 = x0 + chunk.width, y1 = y0 + chunk.height;
      const inChunk = r => !(r.x > x1 || r.x + r.w < x0 || r.y > y1 || r.y + r.h < y0);

      // 16-bit JRPG風の雪タイル。小さな陰影を積み重ね、文字に頼らず場所を読み分けられるようにする。
      const snowPalette = ['#dce9ee', '#d5e4ea', '#e5f0f3', '#cfdee5'];
      ctx.fillStyle = '#c7d8e0'; ctx.fillRect(x0, y0, chunk.width, chunk.height);
      const tile = 32;
      for (let y = Math.floor(y0 / tile) * tile; y < y1; y += tile) {
        for (let x = Math.floor(x0 / tile) * tile; x < x1; x += tile) {
          const n = Math.abs(((x / tile | 0) * 13 + (y / tile | 0) * 7)) % snowPalette.length;
          ctx.fillStyle = snowPalette[n]; ctx.fillRect(x, y, tile, tile);
          ctx.fillStyle = 'rgba(255,255,255,.52)'; ctx.fillRect(x + 3, y + 3, 18, 3);
          ctx.fillStyle = 'rgba(103,139,155,.18)'; ctx.fillRect(x + 24, y + 23, 5, 3);
          if ((n & 1) === 0) { ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.fillRect(x + 9, y + 15, 4, 4); }
        }
      }

      for (const approach of this.terrain.shrineApproaches || []) {
        if (!inChunk(approach)) continue;
        ctx.fillStyle = '#596268'; ctx.fillRect(approach.x - 8, approach.y - 8, approach.w + 16, approach.h + 16);
        ctx.fillStyle = '#8d969a'; ctx.fillRect(approach.x, approach.y, approach.w, approach.h);
        const tw = 64, th = 44;
        for (let y = approach.y + 8; y < approach.y + approach.h - 8; y += th) {
          const row = ((y - approach.y) / th) | 0;
          for (let x = approach.x + 8 - (row % 2 ? 30 : 0); x < approach.x + approach.w - 8; x += tw) {
            const w = Math.min(tw - 6, approach.x + approach.w - 8 - x);
            if (w < 14) continue;
            ctx.fillStyle = row % 2 ? '#aab1b4' : '#b6bdc0'; ctx.fillRect(x, y, w, th - 6);
            ctx.fillStyle = 'rgba(242,249,250,.55)'; ctx.fillRect(x + 3, y + 3, Math.max(0, w - 6), 3);
            ctx.fillStyle = 'rgba(53,61,65,.28)'; ctx.fillRect(x + 3, y + th - 10, Math.max(0, w - 6), 3);
          }
        }
        ctx.fillStyle = '#742b34'; ctx.fillRect(approach.x - 5, approach.y - 5, 10, approach.h + 10); ctx.fillRect(approach.x + approach.w - 5, approach.y - 5, 10, approach.h + 10);
        ctx.fillStyle = '#d4a85c'; ctx.fillRect(approach.x - 2, approach.y, 4, approach.h); ctx.fillRect(approach.x + approach.w - 2, approach.y, 4, approach.h);
      }

      for (const garden of this.terrain.shrineGardens) {
        if (!inChunk(garden)) continue;
        ctx.fillStyle = '#edf5f7'; ctx.fillRect(garden.x, garden.y, garden.w, garden.h);
        for (let y = garden.y; y < garden.y + garden.h; y += 32) {
          for (let x = garden.x; x < garden.x + garden.w; x += 32) {
            const n = (((x - garden.x) / 32 | 0) * 5 + ((y - garden.y) / 32 | 0) * 9) & 3;
            ctx.fillStyle = n === 0 ? '#f7fbfc' : n === 1 ? '#e3eff3' : '#edf5f7'; ctx.fillRect(x, y, 32, 32);
            ctx.fillStyle = 'rgba(112,151,167,.14)'; ctx.fillRect(x + 4 + n * 3, y + 24 - n * 2, 12, 2);
          }
        }
        ctx.strokeStyle = 'rgba(106,139,151,.34)'; ctx.lineWidth = 2;
        for (let y = garden.y + 64; y < garden.y + garden.h; y += 96) {
          ctx.beginPath();
          for (let x = garden.x + 20; x < garden.x + garden.w - 20; x += 24) {
            const yy = y + (((x / 24 | 0) & 1) ? 3 : -3);
            if (x === garden.x + 20) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
      }

      for (const drift of this.terrain.snowDrifts) {
        if (!inChunk(drift)) continue;
        ctx.fillStyle = '#b7ccd5'; ctx.fillRect(drift.x + 8, drift.y + 12, drift.w - 8, drift.h - 8);
        ctx.fillStyle = '#f8fcfd';
        const block = 24;
        for (let y = drift.y; y < drift.y + drift.h; y += block) {
          for (let x = drift.x; x < drift.x + drift.w; x += block) {
            const edge = Math.min(x - drift.x, drift.x + drift.w - x, y - drift.y, drift.y + drift.h - y);
            if (edge < -8) continue;
            const n = ((x / block | 0) * 3 + (y / block | 0) * 5) & 3;
            ctx.fillStyle = n ? '#f6fbfc' : '#e7f2f5'; ctx.fillRect(x, y + (n & 1 ? 4 : 0), block + 2, block);
          }
        }
        ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(drift.x + 12, drift.y + 8, Math.max(0, drift.w - 24), 5);
      }

      for (const pond of this.terrain.frozenPonds) {
        if (!inChunk(pond)) continue;
        ctx.fillStyle = '#527f93'; ctx.fillRect(pond.x - 8, pond.y - 8, pond.w + 16, pond.h + 16);
        const ice = ['#83bfd3', '#91cadb', '#77b3ca', '#a5d4e1'];
        for (let y = pond.y; y < pond.y + pond.h; y += 32) {
          for (let x = pond.x; x < pond.x + pond.w; x += 32) {
            const n = (((x - pond.x) / 32 | 0) + ((y - pond.y) / 32 | 0) * 3) & 3;
            ctx.fillStyle = ice[n]; ctx.fillRect(x, y, Math.min(32, pond.x + pond.w - x), Math.min(32, pond.y + pond.h - y));
            ctx.fillStyle = 'rgba(237,252,255,.48)'; ctx.fillRect(x + 4, y + 4, 18, 3);
          }
        }
        ctx.strokeStyle = 'rgba(48,104,128,.55)'; ctx.lineWidth = 3;
        for (let i = 0; i < 9; i++) {
          const sx = pond.x + 38 + (i * 71) % Math.max(70, pond.w - 76), sy = pond.y + 42 + (i * 47) % Math.max(60, pond.h - 80);
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + (i % 2 ? 30 : -28), sy + 20); ctx.lineTo(sx + (i % 3 ? 54 : -44), sy + 28); ctx.stroke();
        }
      }

      for (const court of this.terrain.shrineCourts) {
        if (!inChunk(court)) continue;
        ctx.fillStyle = '#687176'; ctx.fillRect(court.x - 6, court.y - 6, court.w + 12, court.h + 12);
        for (let y = court.y; y < court.y + court.h; y += 36) {
          for (let x = court.x; x < court.x + court.w; x += 48) {
            const n = (((x - court.x) / 48 | 0) + ((y - court.y) / 36 | 0)) & 1;
            ctx.fillStyle = n ? '#aab2b5' : '#bbc2c4'; ctx.fillRect(x, y, Math.min(46, court.x + court.w - x), Math.min(34, court.y + court.h - y));
            ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 3, y + 3, Math.min(36, court.x + court.w - x - 6), 2);
          }
        }
      }

      for (const corridor of this.terrain.shrineCorridors) {
        if (!inChunk(corridor)) continue;
        ctx.fillStyle = '#32252a'; ctx.fillRect(corridor.x - 12, corridor.y - 12, corridor.w + 24, corridor.h + 24);
        ctx.fillStyle = '#742d36'; ctx.fillRect(corridor.x - 7, corridor.y - 7, corridor.w + 14, corridor.h + 14);
        ctx.fillStyle = '#a96745'; ctx.fillRect(corridor.x, corridor.y, corridor.w, corridor.h);
        const horizontal = corridor.w > corridor.h;
        if (horizontal) {
          for (let x = corridor.x; x < corridor.x + corridor.w; x += 28) {
            const n = ((x - corridor.x) / 28 | 0) & 1;
            ctx.fillStyle = n ? '#b97850' : '#c28659'; ctx.fillRect(x, corridor.y, Math.min(26, corridor.x + corridor.w - x), corridor.h);
            ctx.fillStyle = 'rgba(244,194,124,.35)'; ctx.fillRect(x + 3, corridor.y + 4, 3, corridor.h - 8);
          }
          ctx.fillStyle = '#47252b'; ctx.fillRect(corridor.x, corridor.y + 10, corridor.w, 6); ctx.fillRect(corridor.x, corridor.y + corridor.h - 16, corridor.w, 6);
        } else {
          for (let y = corridor.y; y < corridor.y + corridor.h; y += 28) {
            const n = ((y - corridor.y) / 28 | 0) & 1;
            ctx.fillStyle = n ? '#b97850' : '#c28659'; ctx.fillRect(corridor.x, y, corridor.w, Math.min(26, corridor.y + corridor.h - y));
            ctx.fillStyle = 'rgba(244,194,124,.35)'; ctx.fillRect(corridor.x + 4, y + 3, corridor.w - 8, 3);
          }
          ctx.fillStyle = '#47252b'; ctx.fillRect(corridor.x + 10, corridor.y, 6, corridor.h); ctx.fillRect(corridor.x + corridor.w - 16, corridor.y, 6, corridor.h);
        }
        const band = horizontal ? { x: corridor.x, y: corridor.y + 18, w: corridor.w, h: 22 } : { x: corridor.x + 18, y: corridor.y, w: 22, h: corridor.h };
        this.drawJapanesePattern(ctx, band, corridor.motif, .16);
      }

      for (const step of this.terrain.shrineSteps || []) {
        if (!inChunk(step)) continue;
        const horizontal = step.direction === 'north' || step.direction === 'south';
        ctx.fillStyle = '#596166'; ctx.fillRect(step.x - 5, step.y - 5, step.w + 10, step.h + 10);
        const count = 6;
        for (let i = 0; i < count; i++) {
          const shade = i & 1 ? '#98a2a6' : '#adb6b9';
          ctx.fillStyle = shade;
          if (horizontal) {
            const yy = step.y + Math.floor(step.h * i / count), hh = Math.ceil(step.h / count);
            ctx.fillRect(step.x, yy, step.w, hh);
            ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.fillRect(step.x + 4, yy + 2, step.w - 8, 2);
          } else {
            const xx = step.x + Math.floor(step.w * i / count), ww = Math.ceil(step.w / count);
            ctx.fillRect(xx, step.y, ww, step.h);
            ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.fillRect(xx + 2, step.y + 4, 2, step.h - 8);
          }
        }
      }

      for (const room of this.terrain.shrineRooms) {
        if (!inChunk(room)) continue;
        // 雪を載せた屋根縁・漆塗りの框・畳という三層構造。
        ctx.fillStyle = '#1c2028'; ctx.fillRect(room.x - 22, room.y - 22, room.w + 44, room.h + 44);
        ctx.fillStyle = '#313642'; ctx.fillRect(room.x - 16, room.y - 16, room.w + 32, room.h + 32);
        ctx.fillStyle = '#e7f1f4'; ctx.fillRect(room.x - 12, room.y - 16, room.w + 24, 8);
        ctx.fillStyle = '#6c2731'; ctx.fillRect(room.x - 10, room.y - 10, room.w + 20, room.h + 20);
        ctx.fillStyle = '#d2ad75'; ctx.fillRect(room.x + 14, room.y + 14, room.w - 28, room.h - 28);

        const matW = 96, matH = 48;
        for (let y = room.y + 24; y < room.y + room.h - 24; y += matH) {
          for (let x = room.x + 24; x < room.x + room.w - 24; x += matW) {
            const col = ((x - room.x) / matW) | 0, row = ((y - room.y) / matH) | 0;
            const w = Math.min(matW - 4, room.x + room.w - 24 - x), h = Math.min(matH - 4, room.y + room.h - 24 - y);
            if (w < 10 || h < 10) continue;
            ctx.fillStyle = (col + row) & 1 ? '#d9c58d' : '#e4d39e'; ctx.fillRect(x, y, w, h);
            ctx.fillStyle = '#806840'; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3);
            ctx.fillStyle = 'rgba(255,245,194,.38)'; ctx.fillRect(x + 5, y + 6, Math.max(0, w - 10), 2);
            for (let sx = x + 10; sx < x + w - 6; sx += 12) { ctx.fillStyle = 'rgba(100,83,47,.12)'; ctx.fillRect(sx, y + 7, 2, Math.max(0, h - 14)); }
          }
        }
        // 小さな紋様帯だけを残し、巨大な文字看板は置かない。
        const topBand = { x: room.x + 22, y: room.y + 20, w: room.w - 44, h: 24 };
        const bottomBand = { x: room.x + 22, y: room.y + room.h - 44, w: room.w - 44, h: 24 };
        ctx.fillStyle = '#4e252c'; ctx.fillRect(topBand.x, topBand.y, topBand.w, topBand.h); ctx.fillRect(bottomBand.x, bottomBand.y, bottomBand.w, bottomBand.h);
        this.drawJapanesePattern(ctx, topBand, room.motif, .32); this.drawJapanesePattern(ctx, bottomBand, room.motif, .26);
        ctx.fillStyle = '#d5a75c';
        for (let x = room.x + 36; x < room.x + room.w - 36; x += 64) { ctx.fillRect(x, room.y + 27, 4, 4); ctx.fillRect(x, room.y + room.h - 37, 4, 4); }
      }

      for (const torii of this.terrain.torii) {
        if (torii.x + torii.w < x0 || torii.x - torii.w > x1 || torii.y + torii.h < y0 || torii.y - torii.h > y1) continue;
        ctx.fillStyle = 'rgba(45,24,30,.22)'; ctx.fillRect(torii.x - torii.w * .58, torii.y + torii.h * .35, torii.w * 1.16, 18);
      }
      ctx.restore();
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
        ctx.fillStyle = 'rgba(78,92,58,.16)'; ctx.fillRect(r.x, r.y, r.w, r.h);
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

    drawShrineGuardianStatue(ctx, statue) {
      const isFox = statue.kind === 'whiteFox';
      const phase = this.elapsed * 2.2 + (isFox ? 1.35 : 0);
      const pulse = .34 + Math.sin(phase) * .07;
      const aura = ctx.createRadialGradient(statue.x, statue.y - 8, 18, statue.x, statue.y - 8, statue.aura);
      aura.addColorStop(0, isFox ? `rgba(214,246,255,${pulse})` : `rgba(255,210,121,${pulse})`);
      aura.addColorStop(.58, isFox ? 'rgba(122,210,237,.13)' : 'rgba(239,153,63,.12)');
      aura.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(statue.x, statue.y - 8, statue.aura, 0, TAU); ctx.fill();

      ctx.fillStyle = 'rgba(25,31,36,.30)'; ctx.beginPath(); ctx.ellipse(statue.x, statue.y + 54, 64, 24, 0, 0, TAU); ctx.fill();
      // 三段の石台座。
      ctx.fillStyle = '#424b51'; ctx.fillRect(statue.x - 58, statue.y + 34, 116, 26);
      ctx.fillStyle = '#707b81'; ctx.fillRect(statue.x - 52, statue.y + 28, 104, 24);
      ctx.fillStyle = '#a6b1b5'; ctx.fillRect(statue.x - 44, statue.y + 19, 88, 22);
      ctx.fillStyle = '#d9e2e4'; ctx.fillRect(statue.x - 38, statue.y + 19, 76, 5);
      ctx.fillStyle = '#8b6a35'; ctx.fillRect(statue.x - 28, statue.y + 35, 56, 4);
      ctx.fillStyle = isFox ? '#79cce5' : '#e1a84f'; ctx.fillRect(statue.x - 5, statue.y + 31, 10, 10);

      if (isFox) {
        // 白狐：座った胴、細い鼻、扇状の尾、赤い前掛け。
        ctx.fillStyle = '#6f8490';
        ctx.beginPath(); ctx.moveTo(statue.x - 33, statue.y + 18); ctx.lineTo(statue.x - 28, statue.y - 20); ctx.lineTo(statue.x - 12, statue.y - 40); ctx.lineTo(statue.x + 15, statue.y - 38); ctx.lineTo(statue.x + 32, statue.y - 14); ctx.lineTo(statue.x + 34, statue.y + 18); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#eaf5f8';
        ctx.beginPath(); ctx.moveTo(statue.x - 28, statue.y + 15); ctx.lineTo(statue.x - 23, statue.y - 18); ctx.lineTo(statue.x - 9, statue.y - 34); ctx.lineTo(statue.x + 12, statue.y - 33); ctx.lineTo(statue.x + 27, statue.y - 12); ctx.lineTo(statue.x + 29, statue.y + 15); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f8fdff'; ctx.beginPath(); ctx.ellipse(statue.x, statue.y - 39, 23, 20, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#6f8490';
        ctx.beginPath(); ctx.moveTo(statue.x - 20, statue.y - 48); ctx.lineTo(statue.x - 11, statue.y - 75); ctx.lineTo(statue.x - 3, statue.y - 49); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(statue.x + 20, statue.y - 48); ctx.lineTo(statue.x + 11, statue.y - 75); ctx.lineTo(statue.x + 3, statue.y - 49); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f6fbfd'; ctx.fillRect(statue.x - 11, statue.y - 42, 22, 20);
        ctx.fillStyle = '#c7dce3'; ctx.fillRect(statue.x - 2, statue.y - 31, 22, 7); ctx.fillRect(statue.x + 13, statue.y - 27, 12, 5);
        ctx.fillStyle = '#2b3941'; ctx.fillRect(statue.x - 11, statue.y - 43, 4, 4); ctx.fillRect(statue.x + 7, statue.y - 43, 4, 4);
        ctx.fillStyle = '#d6424c'; ctx.fillRect(statue.x - 18, statue.y - 17, 36, 8); ctx.fillRect(statue.x - 10, statue.y - 9, 20, 17);
        ctx.fillStyle = '#e8b64f'; ctx.fillRect(statue.x - 5, statue.y + 2, 10, 10);
        ctx.fillStyle = '#d7e9ee';
        const tails = [[38, 8, 58, -18], [34, 17, 65, 2], [28, 25, 57, 23]];
        ctx.strokeStyle = '#6f8490'; ctx.lineWidth = 14; ctx.lineCap = 'square';
        for (const [x1, y1, x2, y2] of tails) { ctx.beginPath(); ctx.moveTo(statue.x + x1, statue.y + y1); ctx.quadraticCurveTo(statue.x + x2, statue.y + y1 - 18, statue.x + x2, statue.y + y2); ctx.stroke(); }
        ctx.strokeStyle = '#eef8fa'; ctx.lineWidth = 9;
        for (const [x1, y1, x2, y2] of tails) { ctx.beginPath(); ctx.moveTo(statue.x + x1, statue.y + y1); ctx.quadraticCurveTo(statue.x + x2, statue.y + y1 - 18, statue.x + x2, statue.y + y2); ctx.stroke(); }
        ctx.fillStyle = '#f7fcfd'; ctx.fillRect(statue.x - 25, statue.y + 7, 18, 15); ctx.fillRect(statue.x + 7, statue.y + 7, 18, 15);
        ctx.fillStyle = '#8a9ba3'; ctx.fillRect(statue.x - 23, statue.y + 18, 14, 4); ctx.fillRect(statue.x + 9, statue.y + 18, 14, 4);
      } else {
        // 猫又：丸い顔、鈴、前脚、左右に分かれた二本尾。
        ctx.fillStyle = '#4b372d';
        ctx.beginPath(); ctx.moveTo(statue.x - 35, statue.y + 18); ctx.lineTo(statue.x - 29, statue.y - 22); ctx.lineTo(statue.x - 14, statue.y - 40); ctx.lineTo(statue.x + 16, statue.y - 39); ctx.lineTo(statue.x + 31, statue.y - 18); ctx.lineTo(statue.x + 36, statue.y + 18); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c58a47';
        ctx.beginPath(); ctx.moveTo(statue.x - 29, statue.y + 15); ctx.lineTo(statue.x - 24, statue.y - 18); ctx.lineTo(statue.x - 10, statue.y - 33); ctx.lineTo(statue.x + 12, statue.y - 32); ctx.lineTo(statue.x + 26, statue.y - 13); ctx.lineTo(statue.x + 29, statue.y + 15); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d9a55e'; ctx.beginPath(); ctx.ellipse(statue.x, statue.y - 40, 24, 21, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#4b372d';
        ctx.beginPath(); ctx.moveTo(statue.x - 21, statue.y - 49); ctx.lineTo(statue.x - 12, statue.y - 73); ctx.lineTo(statue.x - 4, statue.y - 48); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(statue.x + 21, statue.y - 49); ctx.lineTo(statue.x + 12, statue.y - 73); ctx.lineTo(statue.x + 4, statue.y - 48); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f2d38c'; ctx.fillRect(statue.x - 12, statue.y - 35, 24, 12);
        ctx.fillStyle = '#201b19'; ctx.fillRect(statue.x - 12, statue.y - 44, 5, 5); ctx.fillRect(statue.x + 7, statue.y - 44, 5, 5); ctx.fillRect(statue.x - 2, statue.y - 33, 5, 4);
        ctx.fillStyle = '#8e2530'; ctx.fillRect(statue.x - 19, statue.y - 18, 38, 8); ctx.fillRect(statue.x - 11, statue.y - 10, 22, 16);
        ctx.fillStyle = '#e3b54f'; ctx.fillRect(statue.x - 6, statue.y + 1, 12, 12); ctx.fillStyle = '#fff0a6'; ctx.fillRect(statue.x - 2, statue.y + 4, 4, 4);
        ctx.strokeStyle = '#4b372d'; ctx.lineWidth = 15; ctx.lineCap = 'square';
        ctx.beginPath(); ctx.moveTo(statue.x - 27, statue.y + 8); ctx.quadraticCurveTo(statue.x - 62, statue.y - 2, statue.x - 54, statue.y - 34); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(statue.x + 27, statue.y + 8); ctx.quadraticCurveTo(statue.x + 62, statue.y - 2, statue.x + 54, statue.y - 34); ctx.stroke();
        ctx.strokeStyle = '#c58a47'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(statue.x - 27, statue.y + 8); ctx.quadraticCurveTo(statue.x - 62, statue.y - 2, statue.x - 54, statue.y - 34); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(statue.x + 27, statue.y + 8); ctx.quadraticCurveTo(statue.x + 62, statue.y - 2, statue.x + 54, statue.y - 34); ctx.stroke();
        ctx.fillStyle = '#d6a15b'; ctx.fillRect(statue.x - 27, statue.y + 6, 18, 16); ctx.fillRect(statue.x + 9, statue.y + 6, 18, 16);
        ctx.fillStyle = '#5d4334'; ctx.fillRect(statue.x - 25, statue.y + 18, 14, 4); ctx.fillRect(statue.x + 11, statue.y + 18, 14, 4);
      }

      // 供給状態を文字ではなく宝珠の脈動で示す。
      const orbY = statue.y + 47;
      ctx.fillStyle = isFox ? '#2c788f' : '#8c5423'; ctx.fillRect(statue.x - 10, orbY - 10, 20, 20);
      ctx.fillStyle = isFox ? '#9cecff' : '#ffd277'; ctx.fillRect(statue.x - 6, orbY - 6, 12, 12);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(statue.x - 3, orbY - 4, 4, 4);
      ctx.strokeStyle = isFox ? 'rgba(162,239,255,.72)' : 'rgba(255,211,121,.72)'; ctx.lineWidth = 2;
      ctx.strokeRect(statue.x - 14 - Math.sin(phase) * 2, orbY - 14 - Math.sin(phase) * 2, 28 + Math.sin(phase) * 4, 28 + Math.sin(phase) * 4);
    }

    drawSnowShrineFeatures(ctx){
      if(this.mapId!=='snowShrine') return;

      for(const decor of this.terrain.shrineDecor||[]){
        if(decor.kind==='stonePath'){
          const cx=(decor.x1+decor.x2)/2,cy=(decor.y1+decor.y2)/2;
          if(!this.inView(cx,cy,Math.hypot(decor.x2-decor.x1,decor.y2-decor.y1)/2+80))continue;
          for(let i=0;i<decor.count;i++){
            const t=decor.count<=1?0:i/(decor.count-1),x=Math.round(lerp(decor.x1,decor.x2,t)),y=Math.round(lerp(decor.y1,decor.y2,t));
            ctx.fillStyle='rgba(50,60,65,.24)';ctx.fillRect(x-26,y-12,56,28);
            ctx.fillStyle=i%2?'#879195':'#9ca5a8';ctx.fillRect(x-24,y-15,48,26);
            ctx.fillStyle='#cbd3d5';ctx.fillRect(x-18,y-11,31,4);
            ctx.fillStyle='rgba(255,255,255,.72)';ctx.fillRect(x-17,y-13,28,3);
          }
          continue;
        }
        if(!this.inView(decor.x,decor.y,Math.max(decor.r||0,decor.w||0,decor.h||0)+110))continue;
        if(decor.kind==='pine'||decor.kind==='sacredTree'){
          const r=decor.r||70;
          ctx.fillStyle='rgba(30,40,43,.24)';ctx.fillRect(decor.x-r*.48,decor.y+r*.42,r*.96,r*.28);
          ctx.fillStyle='#4d392e';ctx.fillRect(decor.x-10,decor.y+r*.08,20,r*.85);
          const greens=decor.kind==='sacredTree'?['#163d33','#205344','#2d6952']:['#214d3d','#2b6049','#39745a'];
          for(let layer=0;layer<4;layer++){
            const yy=decor.y-r*(.78-layer*.25),ww=r*(.65-layer*.08),hh=r*.54;
            ctx.fillStyle=greens[layer%greens.length];
            ctx.beginPath();ctx.moveTo(decor.x,yy-hh*.42);ctx.lineTo(decor.x-ww,yy+hh*.5);ctx.lineTo(decor.x+ww,yy+hh*.5);ctx.closePath();ctx.fill();
            ctx.fillStyle='rgba(239,248,250,.76)';ctx.fillRect(decor.x-ww*.46,yy-hh*.10,ww*.82,7);
          }
          if(decor.kind==='sacredTree'){
            ctx.strokeStyle='#efe5c5';ctx.lineWidth=7;ctx.beginPath();ctx.arc(decor.x,decor.y+r*.28,r*.25,0,TAU);ctx.stroke();
            ctx.fillStyle='#f6f1df';for(let i=-2;i<=2;i++)ctx.fillRect(decor.x+i*13-4,decor.y+r*.50,8,18+Math.abs(i)*4);
            ctx.fillStyle='#d33e4a';ctx.fillRect(decor.x-r*.34,decor.y+r*.25,r*.68,5);
          }
        }else if(decor.kind==='rockGarden'){
          ctx.fillStyle='#7b8589';ctx.fillRect(decor.x-6,decor.y-6,decor.w+12,decor.h+12);
          ctx.fillStyle='#dde5e6';ctx.fillRect(decor.x,decor.y,decor.w,decor.h);
          ctx.strokeStyle='rgba(92,104,108,.36)';ctx.lineWidth=2;
          for(let yy=decor.y+22;yy<decor.y+decor.h;yy+=26){ctx.beginPath();for(let xx=decor.x+12;xx<decor.x+decor.w-12;xx+=18){const py=yy+(((xx/18|0)&1)?2:-2);if(xx===decor.x+12)ctx.moveTo(xx,py);else ctx.lineTo(xx,py)}ctx.stroke();}
          const rocks=[[.23,.35,42,30],[.52,.58,52,36],[.76,.30,36,26]];
          for(const [rx,ry,rw,rh] of rocks){const px=decor.x+decor.w*rx,py=decor.y+decor.h*ry;ctx.fillStyle='#4d5559';ctx.fillRect(px-rw,py-rh*.2,rw*2,rh*.65);ctx.fillStyle='#747e82';ctx.beginPath();ctx.ellipse(px,py,rw,rh,0,0,TAU);ctx.fill();ctx.fillStyle='#aeb8bb';ctx.fillRect(px-rw*.45,py-rh*.58,rw*.7,5);ctx.fillStyle='rgba(255,255,255,.76)';ctx.fillRect(px-rw*.25,py-rh*.72,rw*.45,4);}
        }else if(decor.kind==='waterBasin'){
          ctx.fillStyle='#4d575c';ctx.fillRect(decor.x-decor.w/2-5,decor.y-decor.h/2-5,decor.w+10,decor.h+10);
          ctx.fillStyle='#899397';ctx.fillRect(decor.x-decor.w/2,decor.y-decor.h/2,decor.w,decor.h);
          ctx.fillStyle='#68b6d0';ctx.fillRect(decor.x-decor.w*.34,decor.y-decor.h*.27,decor.w*.68,decor.h*.43);
          ctx.fillStyle='#dce8eb';ctx.fillRect(decor.x-decor.w*.27,decor.y-decor.h*.20,decor.w*.32,4);
          ctx.fillStyle='#5d432f';ctx.fillRect(decor.x+decor.w*.29,decor.y-decor.h*.63,9,decor.h*.84);ctx.fillRect(decor.x+decor.w*.23,decor.y-decor.h*.61,28,7);
        }else if(decor.kind==='bell'){
          ctx.fillStyle='#442f25';ctx.fillRect(decor.x-decor.w*.5,decor.y-decor.h*.48,12,decor.h);ctx.fillRect(decor.x+decor.w*.5-12,decor.y-decor.h*.48,12,decor.h);ctx.fillRect(decor.x-decor.w*.55,decor.y-decor.h*.52,decor.w*1.1,12);
          ctx.fillStyle='#6f4b2d';ctx.fillRect(decor.x-5,decor.y-decor.h*.48,10,34);
          ctx.fillStyle='#7e6135';ctx.beginPath();ctx.moveTo(decor.x-30,decor.y-10);ctx.lineTo(decor.x-23,decor.y-42);ctx.lineTo(decor.x+23,decor.y-42);ctx.lineTo(decor.x+30,decor.y-10);ctx.closePath();ctx.fill();
          ctx.fillStyle='#b4934e';ctx.fillRect(decor.x-22,decor.y-36,44,5);ctx.fillRect(decor.x-28,decor.y-12,56,6);ctx.fillStyle='#2b221e';ctx.fillRect(decor.x-4,decor.y-8,8,40);
        }else if(decor.kind==='altar'){
          const w=decor.w||170,h=decor.h||76;
          ctx.fillStyle='#251e24';ctx.fillRect(decor.x-w/2-6,decor.y-h/2-6,w+12,h+12);
          ctx.fillStyle='#652632';ctx.fillRect(decor.x-w/2,decor.y-h/2,w,h);
          ctx.fillStyle='#a73b44';ctx.fillRect(decor.x-w/2+8,decor.y-h/2+8,w-16,h-16);
          ctx.fillStyle='#d8aa58';ctx.fillRect(decor.x-w/2+12,decor.y-h/2+12,w-24,5);ctx.fillRect(decor.x-w/2+12,decor.y+h/2-17,w-24,5);
          ctx.fillStyle='#efe2be';for(let i=-2;i<=2;i++)ctx.fillRect(decor.x+i*24-5,decor.y-8,10,22);
          ctx.fillStyle='#f0b54d';ctx.fillRect(decor.x-7,decor.y-18,14,14);ctx.fillStyle='#fff3ad';ctx.fillRect(decor.x-3,decor.y-15,5,5);
        }else if(decor.kind==='foldingScreen'){
          const w=decor.w||190,h=decor.h||64,panels=4,pw=w/panels;
          ctx.fillStyle='rgba(31,23,25,.28)';ctx.fillRect(decor.x-w/2+8,decor.y-h/2+9,w,h);
          for(let i=0;i<panels;i++){const px=decor.x-w/2+i*pw;ctx.fillStyle='#3d2929';ctx.fillRect(px,decor.y-h/2,pw-3,h);ctx.fillStyle=i&1?'#c99148':'#dfb761';ctx.fillRect(px+4,decor.y-h/2+4,pw-11,h-8);ctx.fillStyle='#7e3037';ctx.fillRect(px+8,decor.y-h/2+9,pw-19,5);ctx.fillStyle='rgba(255,237,172,.55)';ctx.fillRect(px+9,decor.y-h/2+18,pw-21,3);}
        }else if(decor.kind==='offeringTable'){
          const w=decor.w||110,h=decor.h||48;
          ctx.fillStyle='#2d2224';ctx.fillRect(decor.x-w/2-4,decor.y-h/2-4,w+8,h+8);ctx.fillStyle='#7a2a34';ctx.fillRect(decor.x-w/2,decor.y-h/2,w,h);
          ctx.fillStyle='#b54248';ctx.fillRect(decor.x-w/2+5,decor.y-h/2+5,w-10,10);ctx.fillStyle='#d8aa58';ctx.fillRect(decor.x-w/2+8,decor.y+h/2-9,w-16,4);
          ctx.fillStyle='#e9e1cd';ctx.fillRect(decor.x-28,decor.y-7,18,12);ctx.fillRect(decor.x+10,decor.y-7,18,12);ctx.fillStyle='#e0b84f';ctx.fillRect(decor.x-5,decor.y-12,10,18);
        }else if(decor.kind==='floorCushion'){
          const s=decor.size||38;ctx.fillStyle='#2a2024';ctx.fillRect(decor.x-s/2-3,decor.y-s/2-3,s+6,s+6);ctx.fillStyle=decor.color||'#8e2f3a';ctx.fillRect(decor.x-s/2,decor.y-s/2,s,s);ctx.fillStyle='rgba(255,214,126,.35)';ctx.fillRect(decor.x-s/2+5,decor.y-s/2+5,s-10,4);ctx.fillStyle='#d5a75c';ctx.fillRect(decor.x-3,decor.y-3,6,6);
        }else if(decor.kind==='drum'){
          const r=decor.r||34;ctx.fillStyle='#38252a';ctx.fillRect(decor.x-r-6,decor.y-r*.48,r*2+12,r);ctx.fillStyle='#8e3038';ctx.fillRect(decor.x-r,decor.y-r*.42,r*2,r*.84);ctx.fillStyle='#e4d7b1';ctx.beginPath();ctx.arc(decor.x-r,decor.y,r*.45,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(decor.x+r,decor.y,r*.45,0,TAU);ctx.fill();ctx.fillStyle='#d6a34f';for(let i=-2;i<=2;i++)ctx.fillRect(decor.x+i*12-2,decor.y-r*.42,4,r*.84);
        }else if(decor.kind==='emaRack'){
          const w=decor.w||150,h=decor.h||82;ctx.fillStyle='#3d2b24';ctx.fillRect(decor.x-w/2,decor.y-h/2,w,9);ctx.fillRect(decor.x-w/2+8,decor.y-h/2,8,h);ctx.fillRect(decor.x+w/2-16,decor.y-h/2,8,h);ctx.fillStyle='#c49153';for(let row=0;row<2;row++)for(let i=0;i<5;i++){const px=decor.x-w/2+20+i*25,py=decor.y-h/2+18+row*26;ctx.fillRect(px,py,18,14);ctx.fillStyle='#6d3032';ctx.fillRect(px+8,py-4,2,4);ctx.fillStyle='#c49153';}
        }else if(decor.kind==='incense'){
          ctx.fillStyle='#42363a';ctx.fillRect(decor.x-22,decor.y-12,44,24);ctx.fillStyle='#7a8285';ctx.fillRect(decor.x-18,decor.y-16,36,18);ctx.fillStyle='#d1a04f';ctx.fillRect(decor.x-12,decor.y-13,24,4);ctx.strokeStyle='rgba(218,235,238,.42)';ctx.lineWidth=3;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(decor.x+i*8,decor.y-18);ctx.quadraticCurveTo(decor.x+i*8+8,decor.y-30,decor.x+i*8,decor.y-42);ctx.stroke();}
        }
      }

      for(const torii of this.terrain.torii){
        if(!this.inView(torii.x,torii.y,torii.w*.75)) continue;
        const left=Math.round(torii.x-torii.w*.46),right=Math.round(torii.x+torii.w*.46),top=Math.round(torii.y-torii.h*.50);
        ctx.fillStyle='rgba(34,23,27,.28)';ctx.fillRect(left-18,torii.y+torii.h*.40,54,18);ctx.fillRect(right-36,torii.y+torii.h*.40,54,18);
        ctx.fillStyle='#3a2027';ctx.fillRect(left-8,top+6,38,torii.h+8);ctx.fillRect(right-30,top+6,38,torii.h+8);
        ctx.fillStyle='#9e2833';ctx.fillRect(left,top+9,22,torii.h);ctx.fillRect(right-22,top+9,22,torii.h);
        ctx.fillStyle='#c94449';ctx.fillRect(torii.x-torii.w*.56,top,torii.w*1.12,22);
        ctx.fillStyle='#6d2029';ctx.fillRect(torii.x-torii.w*.48,top+31,torii.w*.96,16);
        ctx.fillStyle='#24262d';ctx.fillRect(torii.x-torii.w*.60,top-7,torii.w*1.20,8);
        ctx.fillStyle='#eef7f9';ctx.fillRect(torii.x-torii.w*.58,top-12,torii.w*1.16,6);
        ctx.fillStyle='#d9aa58';ctx.fillRect(torii.x-22,top+23,44,14);ctx.fillRect(left+5,top+18,12,12);ctx.fillRect(right-17,top+18,12,12);
        ctx.fillStyle='#646e72';ctx.fillRect(left-11,torii.y+torii.h*.42,44,13);ctx.fillRect(right-33,torii.y+torii.h*.42,44,13);
      }

      // 回廊柱は輪郭・影・金具を描き分ける。
      for(const corridor of this.terrain.shrineCorridors){
        if(!this.rectInView(corridor))continue;
        const horizontal=corridor.w>corridor.h;
        if(horizontal){
          for(let x=corridor.x+24;x<corridor.x+corridor.w;x+=112){ctx.fillStyle='rgba(32,20,24,.35)';ctx.fillRect(x-8,corridor.y-9,18,corridor.h+22);ctx.fillStyle='#792b34';ctx.fillRect(x-5,corridor.y-8,10,corridor.h+16);ctx.fillStyle='#d4a756';ctx.fillRect(x-6,corridor.y-2,12,5);ctx.fillRect(x-6,corridor.y+corridor.h-3,12,5);}
        }else{
          for(let y=corridor.y+24;y<corridor.y+corridor.h;y+=112){ctx.fillStyle='rgba(32,20,24,.35)';ctx.fillRect(corridor.x-9,y-8,corridor.w+22,18);ctx.fillStyle='#792b34';ctx.fillRect(corridor.x-8,y-5,corridor.w+16,10);ctx.fillStyle='#d4a756';ctx.fillRect(corridor.x-2,y-6,5,12);ctx.fillRect(corridor.x+corridor.w-3,y-6,5,12);}
        }
      }

      for(const statue of this.terrain.shrineStatues){
        if(!this.inView(statue.x,statue.y,210)) continue;
        this.drawShrineGuardianStatue(ctx,statue);
      }

      const garden=this.terrain.shrineGardens[0];
      if(garden){
        ctx.save();ctx.beginPath();ctx.rect(garden.x,garden.y,garden.w,garden.h);ctx.clip();ctx.fillStyle='rgba(255,255,255,.78)';
        const flakes=this.onlineReducedEffects?28:56;
        for(let i=0;i<flakes;i++){const x=Math.round(garden.x+(i*137+this.elapsed*(18+(i%5)*7))%garden.w),y=Math.round(garden.y+(i*83+this.elapsed*(42+(i%4)*11))%garden.h),r=1+(i%2);ctx.fillRect(x,y,r*2,r*2);}
        ctx.restore();
      }
    }


drawUndergroundFeatures(ctx){
  if(this.mapId!=='underground') return;
  const subway=this.environment.subway||{};
  if(!subway.waterDrained){
    for(const water of this.terrain.subwayWaterways||[]){
      if(!this.rectInView(water)) continue;
      ctx.fillStyle='#325f6d';ctx.fillRect(water.x,water.y,water.w,water.h);
      for(let x=water.x+((this.elapsed*60)%24);x<water.x+water.w+24;x+=24){ctx.fillStyle='rgba(180,235,245,.38)';ctx.fillRect(x,water.y+18,16,4);ctx.fillRect(x-12,water.y+water.h-26,12,3);}
    }
  }
  for(const sludge of this.terrain.subwaySludge||[]){
    if(sludge.active===false||!this.inView(sludge.x,sludge.y,sludge.radius+30)) continue;
    const glow=ctx.createRadialGradient(sludge.x,sludge.y,10,sludge.x,sludge.y,sludge.radius+18);glow.addColorStop(0,'rgba(93,88,46,.74)');glow.addColorStop(.68,'rgba(74,62,33,.5)');glow.addColorStop(1,'rgba(40,34,18,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(sludge.x,sludge.y,sludge.radius+18,0,TAU);ctx.fill();
    ctx.fillStyle='#594f28';ctx.beginPath();ctx.arc(sludge.x,sludge.y,sludge.radius,0,TAU);ctx.fill();
    ctx.fillStyle='rgba(162,144,84,.42)';for(let i=0;i<5;i++){const a=i/5*TAU+this.elapsed*.6,r=sludge.radius*.48;ctx.beginPath();ctx.arc(sludge.x+Math.cos(a)*r,sludge.y+Math.sin(a)*r,8+i,0,TAU);ctx.fill();}
  }
  for(const sign of this.terrain.subwaySigns||[]){
    if(!this.inView(sign.x,sign.y,120)) continue;
    ctx.fillStyle='#1a2024';ctx.fillRect(sign.x-70,sign.y-30,140,48);ctx.fillStyle='#2d3941';ctx.fillRect(sign.x-64,sign.y-24,128,36);
    const countdown=this.subwayTrainCountdown();
    const digits=String(Math.max(0,Math.min(99,countdown))).padStart(2,'0');
    const drawDigit=(digit,x,y)=>{const segments={0:[1,1,1,0,1,1,1],1:[0,0,1,0,0,1,0],2:[1,0,1,1,1,0,1],3:[1,0,1,1,0,1,1],4:[0,1,1,1,0,1,0],5:[1,1,0,1,0,1,1],6:[1,1,0,1,1,1,1],7:[1,0,1,0,0,1,0],8:[1,1,1,1,1,1,1],9:[1,1,1,1,0,1,1]}[digit]||[0,0,0,0,0,0,0];const color=subway.trainActive||countdown<4?'#ff6f61':'#6bf4c8';ctx.fillStyle=color;if(segments[0])ctx.fillRect(x+6,y,24,4); if(segments[1])ctx.fillRect(x,y+4,4,18); if(segments[2])ctx.fillRect(x+30,y+4,4,18); if(segments[3])ctx.fillRect(x+6,y+20,24,4); if(segments[4])ctx.fillRect(x,y+24,4,18); if(segments[5])ctx.fillRect(x+30,y+24,4,18); if(segments[6])ctx.fillRect(x+6,y+40,24,4);};
    drawDigit(Number(digits[0]), sign.x-46, sign.y-18); drawDigit(Number(digits[1]), sign.x+6, sign.y-18);
  }
  const train=this.subwayTrainRect();
  if(train&&this.rectInView(train)){
    ctx.fillStyle='rgba(0,0,0,.26)';ctx.fillRect(train.x+12,train.y+train.h-10,train.w,18);
    ctx.fillStyle='#bcc8cf';ctx.fillRect(train.x,train.y,train.w,train.h);
    ctx.fillStyle='#8d2633';ctx.fillRect(train.x,train.y+22,train.w,36);ctx.fillRect(train.x,train.y+train.h-58,train.w,22);
    for(let x=train.x+24;x<train.x+train.w-30;x+=86){ctx.fillStyle='#6fa8c9';ctx.fillRect(x,train.y+76,58,52);ctx.fillStyle='rgba(255,255,255,.4)';ctx.fillRect(x+4,train.y+80,18,4);}
    for(let x=train.x+74;x<train.x+train.w-50;x+=172){ctx.fillStyle='#445057';ctx.fillRect(x,train.y+58,16,train.h-94);}        
    ctx.fillStyle='#273036';ctx.fillRect(train.x+6,train.y+6,34,train.h-12);ctx.fillRect(train.x+train.w-40,train.y+6,34,train.h-12);
    ctx.fillStyle='#f6e082';ctx.fillRect(train.x+14,train.y+92,12,26);ctx.fillRect(train.x+train.w-26,train.y+92,12,26);
  }
}


    drawUndergroundFeatures(ctx) {
      if (this.mapId !== 'underground') return;
      const subway = this.environment.subway || {};
      const waterLevel = this.subwayWaterLevel();
      if (waterLevel > .005) {
        for (const water of this.terrain.subwayWaterways || []) {
          if (!this.rectInView(water)) continue;
          const horizontal = water.w >= water.h;
          const fillRect = horizontal
            ? { x: water.x, y: water.y + water.h * (1 - waterLevel) / 2, w: water.w, h: water.h * waterLevel }
            : { x: water.x + water.w * (1 - waterLevel) / 2, y: water.y, w: water.w * waterLevel, h: water.h };
          if (fillRect.w < 1 || fillRect.h < 1) continue;
          ctx.save();
          ctx.beginPath(); ctx.rect(fillRect.x, fillRect.y, fillRect.w, fillRect.h); ctx.clip();
          ctx.globalAlpha = .42 + waterLevel * .58;
          ctx.fillStyle = '#315c68'; ctx.fillRect(fillRect.x, fillRect.y, fillRect.w, fillRect.h);
          for (let n = 0; n < 3; n++) {
            const travel = (this.elapsed * (48 + waterLevel * 42) + n * 31) % 52;
            ctx.fillStyle = `rgba(190,242,248,${(.16 + n * .05) * waterLevel})`;
            if (horizontal) {
              const lineY = fillRect.y + Math.min(fillRect.h - 2, Math.max(1, fillRect.h * ((n + 1) / 4)));
              for (let x = water.x - 40 + travel; x < water.x + water.w; x += 52) ctx.fillRect(x, lineY, 22, 3);
            } else {
              const lineX = fillRect.x + Math.min(fillRect.w - 2, Math.max(1, fillRect.w * ((n + 1) / 4)));
              for (let y = water.y - 40 + travel; y < water.y + water.h; y += 52) ctx.fillRect(lineX, y, 3, 22);
            }
          }
          ctx.restore();
        }
      }
      for (const sludge of this.terrain.subwaySludge || []) {
        if (sludge.active === false || !this.inView(sludge.x, sludge.y, sludge.radius + 28)) continue;
        const glow = ctx.createRadialGradient(sludge.x, sludge.y, 8, sludge.x, sludge.y, sludge.radius + 20);
        glow.addColorStop(0, 'rgba(110,101,50,.78)'); glow.addColorStop(.68, 'rgba(70,62,31,.56)'); glow.addColorStop(1, 'rgba(40,34,18,0)');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sludge.x, sludge.y, sludge.radius + 20, 0, TAU); ctx.fill();
        ctx.fillStyle = '#574d27'; ctx.beginPath(); ctx.arc(sludge.x, sludge.y, sludge.radius, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(172,153,84,.44)';
        for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + this.elapsed * .48; const r = sludge.radius * (.25 + (i % 3) * .15); ctx.beginPath(); ctx.arc(sludge.x + Math.cos(a) * r, sludge.y + Math.sin(a) * r, 5 + i % 3, 0, TAU); ctx.fill(); }
      }

      const train = this.subwayTrainRect();
      if (train && this.rectInView(train)) {
        ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fillRect(train.x + 16, train.y + train.h - 10, train.w, 18);
        ctx.fillStyle = '#bcc8cf'; ctx.fillRect(train.x, train.y, train.w, train.h);
        ctx.fillStyle = '#842530'; ctx.fillRect(train.x, train.y + 22, train.w, 38); ctx.fillRect(train.x, train.y + train.h - 62, train.w, 24);
        for (let x = train.x + 28; x < train.x + train.w - 30; x += 84) { ctx.fillStyle = '#6fa8c9'; ctx.fillRect(x, train.y + 78, 56, 52); ctx.fillStyle = 'rgba(255,255,255,.36)'; ctx.fillRect(x + 4, train.y + 82, 20, 4); }
        for (let x = train.x + 76; x < train.x + train.w - 50; x += 168) { ctx.fillStyle = '#445057'; ctx.fillRect(x, train.y + 58, 16, train.h - 94); }
        ctx.fillStyle = '#273036'; ctx.fillRect(train.x + 8, train.y + 8, 36, train.h - 16); ctx.fillRect(train.x + train.w - 44, train.y + 8, 36, train.h - 16);
        ctx.fillStyle = '#f6e082'; ctx.fillRect(train.x + 16, train.y + 92, 12, 26); ctx.fillRect(train.x + train.w - 28, train.y + 92, 12, 26);
      }

      for (const sign of this.terrain.subwaySigns || []) {
        if (!this.inView(sign.x, sign.y, 120)) continue;
        ctx.fillStyle = '#171d21'; ctx.fillRect(sign.x - 72, sign.y - 30, 144, 52);
        ctx.fillStyle = '#2b373e'; ctx.fillRect(sign.x - 66, sign.y - 24, 132, 40);
        const countdown = this.subwayTrainCountdown();
        const digits = String(Math.max(0, Math.min(99, countdown))).padStart(2, '0');
        const drawDigit = (digit, x, y) => {
          const seg = { 0:[1,1,1,0,1,1,1], 1:[0,0,1,0,0,1,0], 2:[1,0,1,1,1,0,1], 3:[1,0,1,1,0,1,1], 4:[0,1,1,1,0,1,0], 5:[1,1,0,1,0,1,1], 6:[1,1,0,1,1,1,1], 7:[1,0,1,0,0,1,0], 8:[1,1,1,1,1,1,1], 9:[1,1,1,1,0,1,1] }[digit] || [];
          ctx.fillStyle = subway.trainActive || countdown < 4 ? '#ff6f61' : '#6bf4c8';
          if (seg[0]) ctx.fillRect(x + 6, y, 24, 4); if (seg[1]) ctx.fillRect(x, y + 4, 4, 18); if (seg[2]) ctx.fillRect(x + 30, y + 4, 4, 18); if (seg[3]) ctx.fillRect(x + 6, y + 20, 24, 4); if (seg[4]) ctx.fillRect(x, y + 24, 4, 18); if (seg[5]) ctx.fillRect(x + 30, y + 24, 4, 18); if (seg[6]) ctx.fillRect(x + 6, y + 40, 24, 4);
        };
        drawDigit(Number(digits[0]), sign.x - 46, sign.y - 18); drawDigit(Number(digits[1]), sign.x + 6, sign.y - 18);
      }
    }

    drawLightSources(ctx){
      for(const light of this.lightSources){
        if(light.hp<=0||!this.inView(light.x,light.y,Math.max(55,(light.lightRadius||0)+30))) continue;
        if(light.kind==='platformSwitch' || light.kind==='waterGateSwitch' || light.kind==='breakerSwitch'){
          const subway=this.environment.subway||{};
          const active = light.kind==='platformSwitch' ? !subway.homeDoorsClosed : light.kind==='waterGateSwitch' ? subway.waterDrained : subway.breakerOff;
          ctx.fillStyle='#1f2529';ctx.fillRect(light.x-18,light.y-18,36,36);ctx.fillStyle=active?'#7be49a':'#d76868';ctx.fillRect(light.x-10,light.y-10,20,20);ctx.fillStyle='#dbe7ea';ctx.fillRect(light.x-3,light.y-14,6,28);ctx.fillRect(light.x-14,light.y-3,28,6);
          continue;
        }
        if(light.kind==='fluorescent'){
          const breakerOff = this.mapId==='underground' && (this.environment.subway||{}).breakerOff;
          ctx.fillStyle='#364248';ctx.fillRect(light.x-light.length/2, light.y-7, light.length, 14);
          ctx.fillStyle='#cfe7ed';ctx.fillRect(light.x-light.length/2+6, light.y-4, light.length-12, 8);
          if(!breakerOff){ const glow=ctx.createRadialGradient(light.x,light.y,6,light.x,light.y,70);glow.addColorStop(0,'rgba(240,252,255,.72)');glow.addColorStop(1,'rgba(220,244,250,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(light.x,light.y,70,0,TAU);ctx.fill(); }
          continue;
        }
        if(light.kind==='emergencyLight'){
          const glow=ctx.createRadialGradient(light.x,light.y,4,light.x,light.y,54);glow.addColorStop(0,'rgba(255,123,123,.72)');glow.addColorStop(1,'rgba(255,123,123,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(light.x,light.y,54,0,TAU);ctx.fill();
          ctx.fillStyle='#4a2323';ctx.fillRect(light.x-10,light.y-7,20,14);ctx.fillStyle='#ff7b7b';ctx.fillRect(light.x-6,light.y-3,12,6);
          continue;
        }
        if(light.kind==='sakeBarrel'){
          ctx.fillStyle='rgba(38,27,24,.28)';ctx.fillRect(light.x-23,light.y+13,46,9);
          ctx.fillStyle='#2f211c';ctx.fillRect(light.x-22,light.y-17,44,35);
          ctx.fillStyle='#6f4227';ctx.fillRect(light.x-18,light.y-18,36,36);
          ctx.fillStyle='#8b5730';ctx.fillRect(light.x-13,light.y-16,7,32);ctx.fillRect(light.x+2,light.y-16,7,32);
          ctx.fillStyle='#2a2020';ctx.fillRect(light.x-20,light.y-8,40,5);ctx.fillRect(light.x-20,light.y+8,40,5);
          ctx.fillStyle='#d2b66f';ctx.fillRect(light.x-19,light.y-5,38,3);ctx.fillRect(light.x-19,light.y+11,38,3);
          ctx.fillStyle='#c9a86a';ctx.fillRect(light.x-15,light.y-21,30,6);ctx.fillStyle='#f0e3c6';ctx.fillRect(light.x-11,light.y-22,18,3);
          ctx.fillStyle='#d8c18a';ctx.fillRect(light.x-3,light.y-25,6,8);ctx.fillRect(light.x-11,light.y-23,8,3);ctx.fillRect(light.x+3,light.y-23,8,3);
          continue;
        }
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
          if(light.kind==='shrineLantern'){
            ctx.fillStyle='#6e777b';ctx.fillRect(light.x-5,light.y-4,10,25);ctx.fillRect(light.x-14,light.y+18,28,7);
            ctx.fillStyle='#30383b';ctx.fillRect(light.x-13,light.y-23,26,20);ctx.fillStyle='#ffe6a6';ctx.fillRect(light.x-8,light.y-19,16,12);
            ctx.fillStyle='#6e1f2b';ctx.fillRect(light.x-16,light.y-27,32,5);
          }else{
            this.drawCubeRect(ctx,light.x-7,light.y-10,14,22,'#59616a','#818b93','#353b42');
            ctx.fillStyle='#fff1a8';ctx.fillRect(light.x-9,light.y-18,18,10);
            ctx.strokeStyle='rgba(255,252,210,.9)';ctx.strokeRect(light.x-9,light.y-18,18,10);
          }
        }
      }
    }

    drawInstallations(ctx){
      for(const f of this.installations){
        if(f.hp<=0||!this.inView(f.x,f.y,80))continue;
        const color=f.active?(this.teamColors[f.team]||'#2daed0'):'#495a61';
        this.drawCubeRect(ctx,f.x-18,f.y-18,36,36,color,tintColor(color,.2),tintColor(color,-.12));
        // 文字の代わりに形だけで設備を識別する。
        ctx.fillStyle='#d9f8ff';ctx.strokeStyle='#d9f8ff';ctx.lineWidth=3;
        if(f.type==='turret'){
          ctx.fillRect(f.x-7,f.y-6,14,13);ctx.fillRect(f.x+4,f.y-3,13,5);ctx.fillRect(f.x-3,f.y+7,6,7);
        }else if(f.type==='trap'){
          ctx.beginPath();ctx.moveTo(f.x-11,f.y+9);ctx.lineTo(f.x-5,f.y-8);ctx.lineTo(f.x,f.y+4);ctx.lineTo(f.x+6,f.y-10);ctx.lineTo(f.x+12,f.y+9);ctx.stroke();
        }else{
          ctx.fillRect(f.x-12,f.y-8,5,18);ctx.fillRect(f.x-2,f.y-8,5,18);ctx.fillRect(f.x+8,f.y-8,5,18);ctx.fillRect(f.x-14,f.y-2,28,5);
        }
        if(!f.active){ctx.strokeStyle='#ffdf67';ctx.strokeRect(f.x-23,f.y-23,46,46)}
      }
    }
    drawOperatorOrders(ctx) {
      if (this.config.mode !== 'team' && !this.isDefenseMode) return;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 9]);
      for (const p of this.players) {
        const order = p.operatorOrder;
        if (!order || p.dead) continue;
        const target = order.targetId ? this.players.find((unit) => unit.id === order.targetId) : order;
        const x = target?.x ?? order.x;
        const y = target?.y ?? order.y;
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1;
        const shortLength = Math.min(92, Math.max(28, d * .18));
        ctx.strokeStyle = `${this.teamColors[p.team] || '#ffffff'}26`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + dx / d * shortLength, p.y + dy / d * shortLength);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `${this.teamColors[p.team] || '#ffffff'}2e`;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, TAU);
        ctx.fill();
        ctx.setLineDash([3, 9]);
      }
      ctx.restore();
    }
    drawEnvironmentOverlay(ctx){
      const overlay=this.environmentCtx;
      overlay.clearRect(0,0,this.viewW,this.viewH);
      const breakerDark = this.mapId==='underground' && (this.environment.subway||{}).breakerOff;
      const reveal=(worldX,worldY,inner,outer,strength=1)=>{
        const x=worldX-this.camera.x,y=worldY-this.camera.y;
        if(x<-outer||y<-outer||x>this.viewW+outer||y>this.viewH+outer) return;
        const gradient=overlay.createRadialGradient(x,y,inner,x,y,outer);
        gradient.addColorStop(0,`rgba(0,0,0,${strength})`);
        gradient.addColorStop(.55,`rgba(0,0,0,${strength*.82})`);
        gradient.addColorStop(1,'rgba(0,0,0,0)');
        overlay.fillStyle=gradient; overlay.beginPath(); overlay.arc(x,y,outer,0,TAU); overlay.fill();
      };
      if(breakerDark){
        overlay.globalCompositeOperation='source-over';
        overlay.fillStyle='rgba(0,4,9,.94)'; overlay.fillRect(0,0,this.viewW,this.viewH);
        overlay.globalCompositeOperation='destination-out';
        const viewer=this.getHudSubject();
        if(viewer&&!viewer.dead) reveal(viewer.x,viewer.y,70,210,1);
        for(const player of this.players) if(!player.dead) reveal(player.x,player.y,36,92,.72);
        for(const pickup of this.pickups) if(pickup.active) reveal(pickup.x,pickup.y,6,38,.62);
        for(const light of this.lightSources) if(light.hp>0&&(light.kind==='emergencyLight'||light.fire)) reveal(light.x,light.y,28,light.lightRadius||120,.94);
        for(const projectile of this.projectiles) reveal(projectile.x,projectile.y,2,22,.42);
        overlay.globalCompositeOperation='source-over';
      } else if(this.environment.timeOfDay==='night'){
        overlay.globalCompositeOperation='source-over';
        overlay.fillStyle='rgba(0,3,12,.965)'; overlay.fillRect(0,0,this.viewW,this.viewH);
        overlay.globalCompositeOperation='destination-out';
        const viewer=this.getHudSubject();
        if(viewer&&!viewer.dead) reveal(viewer.x,viewer.y,75,215,1);
        for(const pickup of this.pickups) if(pickup.active) reveal(pickup.x,pickup.y,8,48+pickup.value*7,.72);
        for(const light of this.lightSources) if(light.hp>0&&(light.lightRadius||0)>0) reveal(light.x,light.y,55,light.lightRadius,1);
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
        if (wall.hp<=0||!this.rectInView(wall)) continue;
        const hp = Number.isFinite(wall.maxHp) ? clamp(wall.hp / wall.maxHp, 0, 1) : 1;
        if(wall.type==='shoji'){
          const horizontal=wall.w>=wall.h;
          ctx.fillStyle='#49362b';ctx.fillRect(wall.x,wall.y,wall.w,wall.h);
          ctx.fillStyle='#f1ead7';ctx.fillRect(wall.x+4,wall.y+4,Math.max(0,wall.w-8),Math.max(0,wall.h-8));
          ctx.fillStyle='rgba(255,252,231,.66)';ctx.fillRect(wall.x+7,wall.y+7,Math.max(0,wall.w-14),Math.max(0,wall.h-14));
          ctx.strokeStyle='#87613e';ctx.lineWidth=2;
          if(horizontal){
            for(let x=wall.x+20;x<wall.x+wall.w;x+=20){ctx.beginPath();ctx.moveTo(x,wall.y+3);ctx.lineTo(x,wall.y+wall.h-3);ctx.stroke();}
            ctx.beginPath();ctx.moveTo(wall.x+3,wall.y+wall.h*.5);ctx.lineTo(wall.x+wall.w-3,wall.y+wall.h*.5);ctx.stroke();
          }else{
            for(let y=wall.y+20;y<wall.y+wall.h;y+=20){ctx.beginPath();ctx.moveTo(wall.x+3,y);ctx.lineTo(wall.x+wall.w-3,y);ctx.stroke();}
            ctx.beginPath();ctx.moveTo(wall.x+wall.w*.5,wall.y+3);ctx.lineTo(wall.x+wall.w*.5,wall.y+wall.h-3);ctx.stroke();
          }
          ctx.fillStyle='rgba(255,255,255,.72)';ctx.fillRect(wall.x+5,wall.y+5,horizontal?Math.max(0,wall.w-10):3,horizontal?3:Math.max(0,wall.h-10));
        }else if(wall.type==='templeWall'){
          const horizontal=wall.w>=wall.h;
          ctx.fillStyle='#20242c';ctx.fillRect(wall.x,wall.y,wall.w,wall.h);
          ctx.fillStyle='#6f2731';ctx.fillRect(wall.x+3,wall.y+3,Math.max(0,wall.w-6),Math.max(0,wall.h-6));
          ctx.fillStyle='#eee4ca';
          if(horizontal)ctx.fillRect(wall.x+7,wall.y+10,Math.max(0,wall.w-14),Math.max(0,wall.h-20));
          else ctx.fillRect(wall.x+10,wall.y+7,Math.max(0,wall.w-20),Math.max(0,wall.h-14));
          ctx.fillStyle='#d4a657';
          if(horizontal){for(let x=wall.x+18;x<wall.x+wall.w-8;x+=34)ctx.fillRect(x,wall.y+4,4,wall.h-8);}
          else{for(let y=wall.y+18;y<wall.y+wall.h-8;y+=34)ctx.fillRect(wall.x+4,y,wall.w-8,4);}
          ctx.fillStyle='#f3f8f9';if(horizontal)ctx.fillRect(wall.x+2,wall.y,wall.w-4,5);else ctx.fillRect(wall.x,wall.y+2,5,wall.h-4);
        }else if(wall.type==='shrineStone'){
          const horizontal=wall.w>=wall.h;
          ctx.fillStyle='#4f595e';ctx.fillRect(wall.x,wall.y,wall.w,wall.h);
          ctx.fillStyle='#919ba0';ctx.fillRect(wall.x+3,wall.y+3,Math.max(0,wall.w-6),Math.max(0,wall.h-6));
          ctx.fillStyle='#b7c0c3';
          if(horizontal){for(let x=wall.x+5;x<wall.x+wall.w-4;x+=28)ctx.fillRect(x,wall.y+5,Math.min(23,wall.x+wall.w-4-x),Math.max(0,wall.h-10));}
          else{for(let y=wall.y+5;y<wall.y+wall.h-4;y+=28)ctx.fillRect(wall.x+5,y,Math.max(0,wall.w-10),Math.min(23,wall.y+wall.h-4-y));}
          ctx.fillStyle='#edf5f7';if(horizontal)ctx.fillRect(wall.x,wall.y,wall.w,6);else ctx.fillRect(wall.x,wall.y,6,wall.h);
        }else if(wall.type==='platformDoor'){
          ctx.fillStyle='#2a3940';ctx.fillRect(wall.x,wall.y,wall.w,wall.h);
          ctx.fillStyle='#b9d8e4';ctx.fillRect(wall.x+4,wall.y+4,Math.max(0,wall.w-8),Math.max(0,wall.h-8));
          ctx.fillStyle='rgba(255,255,255,.45)';ctx.fillRect(wall.x+8,wall.y+3,Math.max(0,wall.w-16),3);
        }else if(wall.type==='platformEdge'){
          ctx.fillStyle='#2c3135';ctx.fillRect(wall.x,wall.y,wall.w,wall.h);ctx.fillStyle='#d6be51';for(let x=wall.x;x<wall.x+wall.w;x+=20){ctx.fillRect(x,wall.y,10,wall.h);}
        }else if(wall.type==='ticketGate'){
          ctx.fillStyle='#25323a';ctx.fillRect(wall.x,wall.y,wall.w,wall.h);ctx.fillStyle='#79c5e6';ctx.fillRect(wall.x+8,wall.y+6,wall.w-16,10);ctx.fillStyle='#cfd7dc';ctx.fillRect(wall.x+12,wall.y+22,wall.w-24,14);
        }else if(wall.type==='maintenanceWall'){
          ctx.fillStyle='#1f282d';ctx.fillRect(wall.x,wall.y,wall.w,wall.h);ctx.fillStyle='#6b767b';ctx.fillRect(wall.x+3,wall.y+3,Math.max(0,wall.w-6),Math.max(0,wall.h-6));ctx.fillStyle='rgba(255,255,255,.15)';ctx.fillRect(wall.x+5,wall.y+5,Math.max(0,wall.w-10),3);
        }else{
          const palette = wall.type==='tree'?['#285844','#39755a','#17392c']:wall.type==='bridge'?['#6c6557','#8e846f','#4c473d']:wall.type==='fortressWall'?['#8d6b43','#b28d59','#654b31']:wall.type==='buildingWall'?['#263e49','#385965','#172a33']:wall.type==='barricade'?['#375d69','#4d8090','#203b44']:['#2f6973','#448c96','#1c434a'];
          this.drawCubeRect(ctx,wall.x,wall.y,wall.w,wall.h,...palette);
        }
        const shrineTerrain=['shoji','templeWall','shrineStone'].includes(wall.type);
        if(Number.isFinite(wall.maxHp)&&(!shrineTerrain||hp<.995)){
          ctx.fillStyle='rgba(0,0,0,.42)';ctx.fillRect(wall.x,wall.y-6,wall.w,3);ctx.fillStyle=hp>.35?'#72e4bc':'#ff6879';ctx.fillRect(wall.x,wall.y-6,wall.w*hp,3);
        }
      }
    }


    drawWires(ctx) {
      ctx.lineWidth = 1.5;
      for (const wire of this.wires) {
        if (!this.inView((wire.x1 + wire.x2) / 2, (wire.y1 + wire.y2) / 2, 260)) continue;
        ctx.strokeStyle = wire.mode === 'spring' ? '#ffd66d' : `${this.teamColors[wire.team] || '#8be6ff'}bb`;
        ctx.lineWidth = wire.mode === 'spring' ? 3 : 1.5;
        if (wire.mode === 'spring') ctx.setLineDash([6,5]);
        ctx.beginPath(); ctx.moveTo(wire.x1, wire.y1); ctx.lineTo(wire.x2, wire.y2); ctx.stroke();
        ctx.setLineDash([]);
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
        if(beacon.hp<=0||beacon.active===false||!this.inView(beacon.x, beacon.y, 40)) continue;
        if(beacon.shrineSpirit){
          const pulse=9+Math.sin(this.elapsed*5+beacon.x*.01)*3;
          const glow=ctx.createRadialGradient(beacon.x,beacon.y,2,beacon.x,beacon.y,34);glow.addColorStop(0,'rgba(178,255,238,.92)');glow.addColorStop(.4,'rgba(89,210,219,.48)');glow.addColorStop(1,'rgba(65,158,180,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(beacon.x,beacon.y,34,0,TAU);ctx.fill();
          ctx.fillStyle='#bfffee';ctx.beginPath();ctx.arc(beacon.x,beacon.y,pulse,0,TAU);ctx.fill();
          ctx.fillStyle='rgba(115,220,222,.7)';ctx.beginPath();ctx.moveTo(beacon.x-6,beacon.y+5);ctx.quadraticCurveTo(beacon.x-14,beacon.y+24,beacon.x+2,beacon.y+30);ctx.quadraticCurveTo(beacon.x+12,beacon.y+19,beacon.x+6,beacon.y+6);ctx.fill();
          continue;
        }
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
        if (!this.inView(p.x, p.y, 40)) continue;
        const key = String(p.sourceKey || '');
        if (['egret', 'ibis'].includes(key)) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle || 0);
          ctx.imageSmoothingEnabled = false;
          if (key === 'ibis') {
            ctx.fillStyle = '#4a392c';
            ctx.fillRect(-10, -4, 16, 8);
            ctx.fillStyle = '#caa36f';
            ctx.fillRect(4, -3, 9, 6);
            ctx.fillStyle = '#f2ead8';
            ctx.fillRect(12, -2, 4, 4);
            ctx.strokeStyle = 'rgba(255,255,255,.7)';
            ctx.strokeRect(-10.5, -4.5, 26, 9);
          } else {
            ctx.fillStyle = p.lead ? '#2d3338' : '#d9e2e7';
            ctx.fillRect(-8, -3, 13, 6);
            ctx.fillStyle = p.lead ? '#8f989f' : '#ffffff';
            ctx.fillRect(5, -2, 5, 4);
            ctx.fillStyle = p.lead ? '#666d73' : '#c1ccd2';
            ctx.fillRect(-10, -2, 3, 4);
            ctx.strokeStyle = 'rgba(255,255,255,.65)';
            ctx.strokeRect(-8.5, -3.5, 18, 7);
          }
          if (p.trail) {
            ctx.globalAlpha = .4;
            ctx.fillStyle = key === 'ibis' ? '#ffe0ba' : p.lead ? '#9aa3aa' : '#f4f8fb';
            ctx.fillRect(-16, -1, 6, 2);
          }
          ctx.restore();
          continue;
        }
        if (key === 'meteor') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle || 0);
          ctx.fillStyle = '#ffb95d';
          ctx.fillRect(-7, -7, 14, 14);
          ctx.fillStyle = '#fff1c2';
          ctx.fillRect(-3, -3, 6, 6);
          ctx.strokeStyle = 'rgba(255,255,255,.7)';
          ctx.strokeRect(-7.5, -7.5, 15, 15);
          ctx.restore();
          continue;
        }
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
      const charges = Object.values(p.shooterCharges || {}).filter(Boolean);
      for (const charge of charges) {
        const progress = 1 - clamp(charge.timer / Math.max(.001, charge.max), 0, 1);
        const cubeColor = charge.bullet === 'meteor' ? '#ffb55e' : charge.bullet === 'viper' ? '#c88cff' : charge.bullet === 'hound' ? '#7dffb8' : '#72e8ff';
        for (let i = 0; i < 4; i++) {
          const a = i / 4 * TAU + this.elapsed * 2.8;
          const r = 21 + progress * 9;
          ctx.fillStyle = cubeColor;
          ctx.globalAlpha = alpha * (.45 + progress * .45);
          ctx.fillRect(Math.round(x + 16 + Math.cos(a) * r - 3), Math.round(y + 17 + Math.sin(a) * r - 3), 6, 6);
        }
      }
      if (p.reloadVisual) {
        const progress = 1 - clamp(p.reloadVisual.timer / Math.max(.001, p.reloadVisual.max), 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(4,10,15,.82)'; ctx.fillRect(x + 4, y - 7, 24, 4);
        ctx.fillStyle = '#ffd369'; ctx.fillRect(x + 4, y - 7, 24 * progress, 4);
        ctx.fillStyle = '#dcecff'; ctx.fillRect(x + 25, y + 16 + Math.sin(this.elapsed * 14) * 2, 7, 3);
      }
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
      if (!this.isDefenseMode && !this.isExtraMode) return;
      for (const area of this.defenseAreas) {
        const alpha = clamp(area.ttl / Math.max(.001, area.maxTtl || area.ttl), 0, 1);
        ctx.save();
        ctx.globalAlpha = (area.kind === 'mist' ? .22 : .28) + Math.sin(this.elapsed * 10) * .04;
        const grad = ctx.createRadialGradient(area.x, area.y, 8, area.x, area.y, area.radius);
        if (area.kind === 'mist') {
          grad.addColorStop(0, 'rgba(30,28,36,.9)'); grad.addColorStop(.65, 'rgba(58,48,70,.55)'); grad.addColorStop(1, 'rgba(58,48,70,0)');
          ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(area.x, area.y, area.radius, 0, TAU); ctx.fill();
        } else {
          grad.addColorStop(0, 'rgba(255,225,120,.88)'); grad.addColorStop(.4, 'rgba(255,133,66,.7)'); grad.addColorStop(1, 'rgba(255,102,52,0)');
          ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(area.x, area.y, area.radius, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = alpha;
        ctx.restore();
      }
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

    drawDefenseSupportHumanoid(ctx,p){
      const type=p.playableDefenseType||p.defenseType,ai=p.defenseAI||{},action=String(ai.action||p.extraAction||'');
      const colors={sogetsu:'#2b98c9',fullarms:'#516b7f',geist:'#3e7cb4'};const old=p.appearance?.bodyColor;p.appearance||={};p.appearance.bodyColor=colors[type]||old||'#6a91a8';this.drawHumanoid(ctx,p,1);p.appearance.bodyColor=old;
      ctx.save();ctx.translate(p.x,p.y);const facing=Math.cos(p.aim||0)<0?-1:1;ctx.scale(facing,1);ctx.imageSmoothingEnabled=false;const max=Math.max(.001,ai.actionMax||p.extraActionTimer||1),at=(ai.actionTimer||p.extraActionTimer||0)>0?1-clamp((ai.actionTimer||p.extraActionTimer)/max,0,1):0;const swing=Math.sin(at*Math.PI)*12;
      if(type==='sogetsu'){
        const linked=(p.sogetsuConnectTimer||0)>0;
        const walkPhase=(p.isMoving?p.walkFrame:0)%4;
        const walkArm=walkPhase===1?-2:walkPhase===3?2:0;
        const rightHand={x:11,y:-1+walkArm};
        const leftHand={x:-11,y:-1-walkArm};
        const drawAxe=(hand,rotation,scale=1)=>{
          ctx.save();ctx.translate(hand.x,hand.y);ctx.rotate(rotation);ctx.scale(scale,scale);
          // The grip begins exactly at the humanoid hand. The handle extends away
          // from the palm so the weapon never floats beside the arm.
          ctx.fillStyle='#183745';ctx.fillRect(-2,-2,5,31);
          ctx.fillStyle='#83eaff';ctx.fillRect(-3,-3,7,6);
          ctx.fillStyle='#d7f7ff';ctx.beginPath();ctx.moveTo(-12,20);ctx.lineTo(13,20);ctx.lineTo(16,32);ctx.lineTo(-16,32);ctx.closePath();ctx.fill();
          ctx.fillStyle='#72d9f4';ctx.fillRect(-10,22,20,3);
          ctx.restore();
        };
        if(linked){
          const hand={x:(rightHand.x+leftHand.x)/2+9,y:(rightHand.y+leftHand.y)/2};
          ctx.save();ctx.translate(hand.x,hand.y);ctx.rotate(-.72+swing*.05);
          ctx.fillStyle='#183745';ctx.fillRect(-4,-3,9,58);
          ctx.fillStyle='#ffd36a';ctx.fillRect(-6,-4,13,8);
          ctx.fillStyle='#fff0a8';ctx.beginPath();ctx.moveTo(-25,42);ctx.lineTo(27,42);ctx.lineTo(36,60);ctx.lineTo(-34,60);ctx.closePath();ctx.fill();
          ctx.fillStyle='#ffc44f';ctx.fillRect(-23,45,47,4);ctx.restore();
        } else {
          drawAxe(rightHand,.34+swing*.025,1);
          drawAxe(leftHand,-.34-swing*.025,1);
        }
        if(action.includes('Meteor')){ctx.fillStyle='#ffad5b';for(let i=0;i<4;i++){const a=i/4*TAU+this.elapsed*3;ctx.fillRect(Math.cos(a)*28-3,Math.sin(a)*28-3,7,7);}}
      }else if(type==='fullarms'){
        ctx.fillStyle='#263744';ctx.fillRect(-22,-19,8,36);ctx.fillRect(14,-19,8,36);ctx.fillStyle='#9eeaff';ctx.fillRect(17,-2+swing*.15,46,6);ctx.fillStyle='#dffcff';ctx.fillRect(54,-5+swing*.15,14,3);ctx.fillStyle='#687b87';ctx.fillRect(-50,-11,40,12);ctx.fillStyle='#d1e4ea';ctx.fillRect(-57,-7,12,4);
        if(action.includes('Ultimate')||p.fullArmsTimer>0){ctx.strokeStyle='#ffd36a';ctx.lineWidth=3;for(let i=0;i<6;i++){const a=i/6*TAU+this.elapsed*4;ctx.beginPath();ctx.arc(0,0,34+i*4,a,a+.75);ctx.stroke();}}
      }else if(type==='geist'){
        ctx.fillStyle='#24394b';ctx.fillRect(-19,-19,7,34);ctx.fillStyle='#d8fbff';ctx.fillRect(17,-2+swing*.15,46,5);ctx.fillStyle='#72e8ff';ctx.fillRect(-54,-8,42,9);if(p.geistActive){ctx.strokeStyle='#ff7bce';ctx.lineWidth=4;ctx.globalAlpha=.75;ctx.beginPath();ctx.arc(0,0,34+Math.sin(this.elapsed*8)*4,0,TAU);ctx.stroke();const lv=p.geistLevels||{armor:1,slash:4,special:3,speed:5,shoot:4},vals=[lv.armor,lv.slash,lv.special,lv.speed,lv.shoot],radarLabels=['甲','斬','特','速','射'];ctx.translate(25,-18);ctx.strokeStyle='#e9fbff';ctx.lineWidth=1.5;ctx.beginPath();vals.forEach((v,i)=>{const a=-Math.PI/2+i*TAU/5,r=2+v*2.45;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.stroke();ctx.fillStyle='#e9fbff';ctx.font='700 5px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';radarLabels.forEach((label,i)=>{const a=-Math.PI/2+i*TAU/5,x=Math.cos(a)*20,y=Math.sin(a)*20;ctx.save();ctx.translate(x,y);ctx.scale(facing,1);ctx.fillText(label,0,0);ctx.restore();});ctx.fillStyle='#ff8bd4';ctx.font='700 7px sans-serif';ctx.textAlign='center';ctx.fillText(`${Math.ceil(p.geistTimer||0)}`,0,3);}
      }
      ctx.restore();
    }

    drawBlackTriggerHumanoid(ctx, p) {
      const type = p.defenseType;
      const ai = p.defenseAI || {};
      const action = String(ai.action || p.extraAction || '');
      const phaseAlpha = type === 'borboros' && ['liquid','gas'].includes(ai.phase) ? (ai.phase === 'gas' ? .38 : .62) : 1;
      const colors = {
        fujin:'#23704a', seals:'#dfe7ef', alektor:'#628d55', borboros:'#724c96', organon:'#89784f'
      };
      const previousColor = p.appearance?.bodyColor;
      p.appearance ||= {};
      p.appearance.bodyColor = colors[type] || previousColor || '#728895';
      this.drawHumanoid(ctx, p, phaseAlpha);
      p.appearance.bodyColor = previousColor;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = phaseAlpha;
      ctx.imageSmoothingEnabled = false;
      const facing = Math.cos(p.aim || 0) < 0 ? -1 : 1;
      ctx.scale(facing, 1);
      const moving = Math.hypot(p.vx || 0, p.vy || 0) > 18;
      const step = moving ? Math.round(Math.sin(this.elapsed * 9 + p.x * .002) * 2) : 0;
      const actionMax = Math.max(.001, ai.actionMax || p.extraActionTimer || 1);
      const actionT = (ai.actionTimer || p.extraActionTimer || 0) > 0 ? clamp((ai.actionTimer || p.extraActionTimer) / actionMax, 0, 1) : 0;
      const swing = action ? Math.round((1 - actionT) * 10) : step;

      if (type === 'fujin') {
        ctx.fillStyle = '#10261c'; ctx.fillRect(-18,-19,7,33);
        ctx.fillStyle = '#45ef83'; ctx.fillRect(17, -3 + swing, 43, 4); ctx.fillRect(52,-7+swing,11,3);
        ctx.fillStyle = '#d9ffe7'; ctx.fillRect(59,-6+swing,8,2);
        const count = action.includes('Multi') || action.includes('Field') ? 9 : 5;
        ctx.strokeStyle = '#45ef83'; ctx.lineWidth = action === 'parry' ? 6 : 2;
        for (let i=0;i<count;i++) { const a=i/count*TAU+this.elapsed*(action?2.8:1.15);const r=29+(i%3)*10;ctx.beginPath();ctx.arc(0,-2,r,a-.34,a+.18);ctx.stroke(); }
        if(action==='parry'){ctx.strokeStyle='#dffff0';ctx.beginPath();ctx.arc(24,0,39,-.9,.9);ctx.stroke();}
      } else if (type === 'seals') {
        const boost=clamp(p.extraBoost||ai.sealBoost||1,1,3);
        ctx.strokeStyle='#f7fbff';ctx.lineWidth=2+boost*.7;
        for(let i=0;i<boost;i++){ctx.beginPath();ctx.arc(22+i*7,-5+swing,9+i*3,0,TAU);ctx.stroke();}
        ctx.fillStyle='#607080';ctx.fillRect(-18,-18,5,32);ctx.fillRect(13,-18,5,32);
        if ((ai.shieldTimer||0)>0 || p.shields?.sub || p.shields?.main) {
          ctx.save();ctx.globalAlpha=.5;ctx.fillStyle='#dceaff';ctx.strokeStyle='#fff';ctx.lineWidth=3;
          ctx.beginPath();ctx.moveTo(30,-40);ctx.lineTo(68,-19);ctx.lineTo(68,29);ctx.lineTo(30,46);ctx.lineTo(19,2);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
        }
        if(action.includes('seal') || action.includes('Seal')){ctx.fillStyle='#fff';for(let i=0;i<5;i++){const a=i/5*TAU+this.elapsed*3;ctx.fillRect(Math.round(Math.cos(a)*32)-3,Math.round(Math.sin(a)*32)-3,6,6);}}
      } else if (type === 'alektor') {
        ctx.fillStyle='#315b2f';ctx.fillRect(-21,-19,7,34);ctx.fillRect(14,-19,7,34);
        const orbit=action.includes('Swarm')?12:action.includes('Field')?9:6;
        for(let i=0;i<orbit;i++){const a=i/orbit*TAU+this.elapsed*(action?3.1:1.35);const r=34+(i%2)*10;ctx.save();ctx.translate(Math.cos(a)*r,Math.sin(a)*r);ctx.rotate(a);ctx.fillStyle='#b6ee9b';ctx.beginPath();ctx.ellipse(0,0,6,9,0,0,TAU);ctx.fill();ctx.fillStyle='#efffe6';ctx.fillRect(-2,-5,4,3);ctx.restore();}
        if(action==='parry'){ctx.strokeStyle='#d9ffc8';ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,0,49,-1.1,1.1);ctx.stroke();}
      } else if (type === 'borboros') {
        ctx.save();ctx.globalAlpha*=ai.phase==='gas'?.42:ai.phase==='liquid'?.64:.82;
        ctx.fillStyle=ai.phase==='gas'?'#c7a6ea':ai.phase==='liquid'?'#9967c8':'#68458a';
        ctx.beginPath();ctx.ellipse(0,4,31+Math.sin(this.elapsed*4)*4,37+Math.cos(this.elapsed*3)*3,0,0,TAU);ctx.fill();ctx.restore();
        for(const core of ai.borborosCores||[]){
          const a=(p.aim||0)+core.angle+Math.sin(this.elapsed*1.7+core.phase)*.18;
          const x=Math.cos(a)*core.distance, y=Math.sin(a)*core.distance;
          ctx.fillStyle='#b890e2';ctx.strokeStyle='#eadff5';ctx.lineWidth=2;
          ctx.beginPath();ctx.moveTo(x,y-core.radius);ctx.lineTo(x+core.radius,y);ctx.lineTo(x,y+core.radius);ctx.lineTo(x-core.radius,y);ctx.closePath();ctx.fill();ctx.stroke();
        }
      } else if (type === 'organon') {
        ctx.fillStyle='#5d5138';ctx.fillRect(-21,-19,7,34);ctx.fillRect(14,-19,7,34);
        ctx.strokeStyle='#e8ddbb';ctx.lineWidth=action==='parry'?6:2;
        for(let r=28;r<=(action.includes('Ultimate')?84:58);r+=14){const a=this.elapsed*(r%2?1.8:-1.4);ctx.beginPath();ctx.arc(0,0,r,a,a+Math.PI*1.45);ctx.stroke();}
        ctx.fillStyle='#fff0bd';for(let i=0;i<5;i++){const a=i/5*TAU+this.elapsed*2;ctx.save();ctx.translate(Math.cos(a)*48,Math.sin(a)*48);ctx.rotate(a);ctx.fillRect(-2,-8,4,16);ctx.restore();}
      }
      ctx.restore();
    }

    drawPixelSprite(ctx, rows, palette, pixel = 4, ox = 0, oy = 0, flip = 1) {
      const h = rows.length;
      const w = rows.reduce((m, row) => Math.max(m, row.length), 0);
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(flip, 1);
      for (let y = 0; y < h; y++) {
        const row = rows[y];
        for (let x = 0; x < row.length; x++) {
          const key = row[x];
          const color = palette[key];
          if (!color) continue;
          ctx.fillStyle = color;
          const dx = (x - w / 2) * pixel;
          const dy = (y - h / 2) * pixel;
          ctx.fillRect(dx, dy, pixel, pixel);
        }
      }
      ctx.restore();
    }

    drawOrochiSegment(ctx, x, y, r, enraged, angle = 0, index = 0, pulse = 0) {
      const outer = enraged ? '#6f2918' : '#2f4f2b';
      const mid = enraged ? '#b94b23' : '#547d3e';
      const light = enraged ? '#ff9a45' : '#98bd68';
      const belly = enraged ? '#ffd17a' : '#d7e4a2';
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(angle || 0);
      ctx.imageSmoothingEnabled = false;
      const length = Math.max(22, r * 1.28);
      const height = Math.max(16, r * .92);
      ctx.fillStyle = outer;
      ctx.beginPath(); ctx.ellipse(0, 0, length, height, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = mid;
      ctx.beginPath(); ctx.ellipse(2, -height * .06, length * .87, height * .78, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = light;
      ctx.beginPath(); ctx.ellipse(length * .18, -height * .28, length * .55, height * .22, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = belly;
      ctx.beginPath(); ctx.ellipse(length * .08, height * .42, length * .58, height * .2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = enraged ? '#ffcb72' : '#b8d584';
      ctx.lineWidth = Math.max(2, r * .07);
      for (let i = -1; i <= 1; i++) {
        const px = i * length * .42;
        ctx.beginPath(); ctx.moveTo(px, -height * .55); ctx.lineTo(px + length * .12, height * .5); ctx.stroke();
      }
      const plate = Math.max(4, r * .18);
      ctx.fillStyle = enraged ? '#ff7b31' : '#688f4a';
      for (let i = -1; i <= 1; i++) {
        const px = i * length * .38 - length * .08;
        ctx.beginPath();
        ctx.moveTo(px - plate, -height * .7);
        ctx.lineTo(px, -height * (.95 + pulse * .08));
        ctx.lineTo(px + plate, -height * .7);
        ctx.closePath(); ctx.fill();
      }
      if (enraged) {
        ctx.globalAlpha = .28 + pulse * .18;
        ctx.strokeStyle = '#ffad52'; ctx.lineWidth = Math.max(3, r * .12);
        ctx.beginPath(); ctx.ellipse(0, 0, length * 1.08, height * 1.12, 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }

    drawHyakkiEnemySprite(ctx, p) {
      const type = p.defenseType;
      const ai = p.defenseAI || {};
      const moving = Math.hypot(p.vx || 0, p.vy || 0) > 24;
      const aimFacing = Math.cos(p.aim || 0) < 0 ? -1 : 1;
      const horizontalSpeed = Number(p.vx || 0);
      const moveFacing = Math.abs(horizontalSpeed) > 12 ? (horizontalSpeed < 0 ? -1 : 1) : aimFacing;
      const hasActiveAction = Boolean(ai.action && (ai.actionTimer || 0) > 0);
      const facing = hasActiveAction ? aimFacing : moving ? moveFacing : aimFacing;
      p.spriteFacing = facing;
      const phase = this.elapsed * 8.5 + (p.x + p.y) * .002;
      const step = moving ? Math.sin(phase) * 3 : 0;
      const bob = moving ? Math.cos(phase * 2) * 1.5 : 0;
      const attackMax = Math.max(.001, ai.actionMax || 0);
      const attackT = ai.actionTimer > 0 ? clamp(ai.actionTimer / attackMax, 0, 1) : 0;
      const action = String(ai.action || '');
      const drawSkeletonCore = (clothMain, clothDark, accent = '#cfd8d5') => {
        this.drawPixelSprite(ctx, [
          '.....111111.....',
          '....122222221....',
          '...12233333221...',
          '...12334444321...',
          '...12343334321...',
          '...12344444321...',
          '....123333321....',
          '....125555521....',
          '...12656666521...',
          '...12666666621...',
          '...12666666621...',
          '....127777721....'
        ], { '1':'#9ea8ac','2':'#edf2ef','3':'#101417','4':accent,'5':clothMain,'6':'#7f888d','7':clothDark }, 3, 0, -6, facing);
      };
      const drawBoneArm = (x, y, dir, bend = 0, fore = '#e8efed', joint = '#9ca8ac') => {
        ctx.fillStyle = joint;
        ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.fillStyle = fore;
        ctx.fillRect(x, y + Math.min(0, bend), 4, 14 + Math.abs(bend));
        ctx.fillRect(x + dir * 4, y + 10 + bend, 4, 12);
        ctx.fillStyle = joint;
        ctx.fillRect(x + dir * 4 - 1, y + 9 + bend, 6, 4);
      };
      const drawBoneLeg = (x, y, bend = 0) => {
        ctx.fillStyle = '#7d858a';
        ctx.fillRect(x, y, 4, 14 + Math.max(0, bend));
        ctx.fillStyle = '#e7eeeb';
        ctx.fillRect(x + Math.sign(bend || 1) * 2, y + 12, 4, 14 - Math.min(0, bend));
        ctx.fillStyle = '#9ca8ac';
        ctx.fillRect(x + Math.sign(bend || 1), y + 10, 6, 4);
      };
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = (ai.chameleonTimer > 0 || p.toggles?.chameleon) ? (p.human ? .1 : .012) : 1;
      if (type === 'skeletonAttacker') {
        drawSkeletonCore('#c55353', '#7f2f2f');
        ctx.save();
        ctx.scale(facing, 1);
        const slashSwing = action === 'slash' ? -1.7 + (1 - attackT) * 2.1 : action === 'senku' ? -1.15 + (1 - attackT) * .35 : -.25 + step * .05;
        const guardArm = action === 'senku' ? -4 : step * .7;
        drawBoneArm(-18, -2, -1, Math.round(-step));
        drawBoneArm(10, -3, 1, Math.round(guardArm));
        drawBoneLeg(-9, 18, Math.round(step));
        drawBoneLeg(5, 18, Math.round(-step));
        ctx.save();
        ctx.translate(18, 1);
        ctx.rotate(slashSwing);
        ctx.fillStyle = '#d7dee2'; ctx.fillRect(-2, -4, 6, 26);
        ctx.fillStyle = '#f4fbff'; ctx.fillRect(3, -16, 4, 22);
        ctx.fillStyle = '#91c7e5'; ctx.fillRect(6, -22, 3, 10);
        ctx.fillStyle = '#5d4131'; ctx.fillRect(-4, 18, 10, 4);
        ctx.restore();
        if (action === 'senku') {
          ctx.strokeStyle = 'rgba(221,247,255,.9)';
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(34, -2, 18 + (1 - attackT) * 12, -.5, .6); ctx.stroke();
        }
        ctx.restore();
      } else if (type === 'skeletonShooter') {
        drawSkeletonCore('#4d9ad2', '#2d5471', '#d3dbdf');
        ctx.save();
        ctx.scale(facing, 1);
        const castLift = action ? -10 * attackT : 0;
        drawBoneArm(-18, -1, -1, Math.round(-step));
        drawBoneArm(9, -3 + castLift, 1, Math.round(2 + castLift));
        drawBoneLeg(-9, 18, Math.round(step));
        drawBoneLeg(5, 18, Math.round(-step));
        ctx.fillStyle = '#263743'; ctx.fillRect(2, -2, 14, 5);
        if (action) {
          const cubeCount = action === 'composite' ? 3 : action === 'meteor' ? 2 : 1;
          const cubeColor = action === 'composite' ? '#d28dff' : action === 'meteor' ? '#ffb95d' : '#72e8ff';
          for (let i = 0; i < cubeCount; i++) {
            const ox = 22 + i * 8;
            const oy = -14 - (i % 2) * 6 - attackT * 6;
            ctx.fillStyle = cubeColor;
            ctx.fillRect(ox, oy, 6, 6);
            ctx.strokeStyle = 'rgba(255,255,255,.75)';
            ctx.strokeRect(ox - .5, oy - .5, 7, 7);
          }
        }
        ctx.restore();
      } else if (type === 'skeletonSniper') {
        drawSkeletonCore('#6ea96e', '#39573b', '#d8dfd9');
        ctx.save();
        ctx.scale(facing, 1);
        const recoil = action ? (1 - attackT) * 6 : 0;
        const proneLean = action === 'ibis' ? -3 : 0;
        drawBoneArm(-16, -2, -1, Math.round(-1 - step * .4));
        drawBoneArm(6 - recoil, -5 + proneLean, 1, Math.round(-4 + proneLean));
        drawBoneLeg(-9, 18, Math.round(step * .6));
        drawBoneLeg(5, 18, Math.round(-step * .6));
        ctx.fillStyle = '#2b3a2d'; ctx.fillRect(-2 - recoil, -5 + proneLean, 28, 6);
        ctx.fillStyle = '#4e5d4f'; ctx.fillRect(4 - recoil, -8 + proneLean, 8, 4);
        ctx.fillStyle = '#e9f0f4'; ctx.fillRect(23 - recoil, -7 + proneLean, 10, 4);
        ctx.fillStyle = '#5b4230'; ctx.fillRect(-6 - recoil, -3 + proneLean, 10, 4);
        ctx.fillStyle = '#89a58a'; ctx.fillRect(10 - recoil, -2 + proneLean, 8, 2);
        if (action) {
          ctx.fillStyle = action === 'lead' ? '#c6d7ff' : action === 'ibis' ? '#ffd1a6' : '#ffffff';
          ctx.beginPath(); ctx.arc(34 - recoil, -5 + proneLean, 6 * Math.max(.3, attackT), 0, TAU); ctx.fill();
        }
        ctx.restore();
      } else if (type === 'yamagu') {
        ctx.save();
        ctx.scale(facing, 1);
        const dashShift = action === 'dash' ? Math.round((1 - attackT) * 10) : action === 'claw' ? Math.round((1 - attackT) * 4) : 0;
        const bodyBounce = moving ? Math.round(Math.cos(phase * 2) * 1) : 0;
        const gait = moving ? Math.sin(phase) : 0;
        ctx.translate(dashShift, bodyBounce);

        const bodyRows = [
          '..........................................',
          '.................................1........',
          '.....1..........................13........',
          '..11131.........................331...1...',
          '..155511.....................111331..31...',
          '.115553......11111111111....12223331331...',
          '.133331...11113333333333111142224433331...',
          '..11331111555555555555555522222244463311..',
          '...1111333555555555555555522244444444311..',
          '......1144445555555555544444244444444411..',
          '.....1134444555555555554444424444444555551',
          '.....1133344444444444444442224444444555511',
          '......113333344444444443332224444422222211',
          '......122233322222222222222333444222222251',
          '.......22233322222222222222333444222266661',
          '.......222333222222222222223332222221.....',
          '..........................................',
          '..........................................',
          '..........................................',
          '..........................................',
          '..........................................',
          '..........................................',
          '..........................................',
          '..........................................',
          '..........................................',
          '..........................................',
        ];
        const palette = { '1':'#372219','2':'#653b28','3':'#a6643a','4':'#d29c5b','5':'#f0c987','6':'#fff0d5' };

        const drawLeg = (rootX, gaitValue, near, front = false, attackLeg = false) => {
          let swing = moving ? Math.round(gaitValue * 6) : 0;
          let lift = moving ? Math.round(Math.max(0, -gaitValue) * 5) : 0;
          if (action === 'dash') { swing = front ? 7 : -5; lift = front ? 4 : 1; }
          if (attackLeg && action === 'claw') { swing = 12 + Math.round((1 - attackT) * 8); lift = 10 + Math.round((1 - attackT) * 5); }
          const hipX = rootX;
          const shinX = rootX + Math.round(swing * .45);
          const footX = rootX + swing;
          const hipY = -2;
          const shinY = 7 - lift;
          const footY = 20 - lift;
          const dark = near ? '#653b28' : '#4d2d20';
          const mid = near ? '#d29c5b' : '#9d663d';
          const paw = near ? '#f0c987' : '#c3945a';
          ctx.fillStyle = dark;
          ctx.fillRect(hipX, hipY, 9, 13);
          ctx.fillRect(Math.min(hipX + 2, shinX), 6 - lift, Math.abs(shinX - (hipX + 2)) + 8, 7);
          ctx.fillStyle = mid;
          ctx.fillRect(shinX, shinY, 8, 15);
          ctx.fillRect(Math.min(shinX, footX), 17 - lift, Math.abs(footX - shinX) + 8, 7);
          ctx.fillStyle = paw;
          ctx.fillRect(footX, footY, 13, 7);
          ctx.fillStyle = '#fff0d5';
          ctx.fillRect(footX + 9, footY + 1, 3, 3);
          if (front) ctx.fillRect(footX + 12, footY + 2, 3, 2);
        };

        // 奥側の脚 → 胴体 → 手前側の脚。付け根は常に胴体へ重ねる。
        drawLeg(-24, -gait, false, false, false);
        drawLeg(24, gait, false, true, false);
        this.drawPixelSprite(ctx, bodyRows, palette, 3, 0, -8, 1);
        ctx.fillStyle = '#a6643a'; ctx.fillRect(-31, -4, 84, 10);
        ctx.fillStyle = '#d29c5b'; ctx.fillRect(-20, 2, 58, 5);
        drawLeg(-7, gait, true, false, false);
        drawLeg(41, -gait, true, true, true);

        if (action === 'roar') {
          const open = Math.max(.2, 1 - attackT);
          ctx.fillStyle = '#24120f'; ctx.fillRect(53, -2, 14 + Math.round(open * 8), 7 + Math.round(open * 4));
          ctx.fillStyle = '#c7453b'; ctx.fillRect(57, 4, 12 + Math.round(open * 7), 3 + Math.round(open * 3));
          ctx.fillStyle = '#fff4dc'; ctx.fillRect(56, -1, 3, 4); ctx.fillRect(63, -1, 3, 4);
        }
        ctx.restore();
      } else if (type === 'yagarasu') {
        ctx.save();
        ctx.scale(facing, 1);
        const flapPhase = action === 'flap' ? 1 - attackT : moving ? (.5 + Math.sin(phase * 1.25) * .5) : .08;
        const wingFrame = flapPhase > .66 ? 2 : flapPhase > .25 ? 1 : 0;
        const flyingPose = action === 'flap' || (p.flying && moving);
        const crowBob = flyingPose ? -Math.round(flapPhase * 5) : moving ? Math.round(Math.cos(phase * 2) * 1) : 0;
        const gait = moving ? Math.sin(phase) : 0;
        ctx.translate(0, crowBob);

        const bodyRows = [
          '............1111........',
          '.........111222211......',
          '......11222333332211....',
          '....112233344444333221..',
          '..1122333444555444333221',
          '.12233344445555444433321',
          '122333344445555444433321',
          '122333344444444444433321',
          '.12233333334444443333221',
          '..112222333333333322211.',
          '....11112222222222111...',
          '........111111111.......'
        ];
        const bodyPalette = { '1':'#080c10','2':'#151c22','3':'#323c45','4':'#505d68','5':'#65737e' };
        const foldedWing = [
          '...1111........',
          '..1222211......',
          '.123333221.....',
          '12333333221....',
          '123333333221...',
          '.123333333221..',
          '..122333332211.',
          '....122222211..',
          '......11111....'
        ];
        const middleWing = [
          '........111....',
          '......112221...',
          '....112333221..',
          '..112333333221.',
          '.12333333333221',
          '123333333333321',
          '.12333333333221',
          '..122333333221.',
          '....122222211..',
          '......11111....'
        ];
        const raisedWing = [
          '.......11......',
          '......1221.....',
          '.....123321....',
          '....1233321....',
          '...12333321....',
          '..1233333221...',
          '.123333333221..',
          '12333333333221.',
          '.12333333333221',
          '..123333333221.',
          '...1223333221..',
          '....12222221...',
          '......11111....'
        ];
        const wingRows = wingFrame === 2 ? raisedWing : wingFrame === 1 ? middleWing : foldedWing;
        const drawWing = (front) => {
          if (!front) {
            this.drawPixelSprite(ctx, foldedWing, { '1':'#080c10','2':'#10171c','3':'#252e35' }, 2, -18, -4, 1);
            ctx.fillStyle = '#10161b';
            ctx.fillRect(-15, -8, 18, 11);
            return;
          }
          const ox = wingFrame === 2 ? -18 : wingFrame === 1 ? -22 : -25;
          const oy = wingFrame === 2 ? -27 : wingFrame === 1 ? -17 : -6;
          this.drawPixelSprite(ctx, wingRows, { '1':'#080c10','2':'#151c22','3':'#3b4650' }, 3, ox + 4, oy + 2, 1);
          ctx.fillStyle = '#151c22';
          ctx.fillRect(-15, -9, 22, 13); // 肩と翼を必ず接続
        };
        const drawCrowLeg = (rootX, gaitValue, near) => {
          let swing = moving ? Math.round(gaitValue * 5) : 0;
          let lift = moving ? Math.round(Math.max(0, -gaitValue) * 3) : 0;
          if (flyingPose) { swing = -6 + Math.round(gaitValue * 3); lift = 7 + Math.round(Math.max(0, -gaitValue) * 2); }
          const rootY = 7;
          const shinX = rootX + Math.round(swing * .4);
          const footX = rootX + swing;
          ctx.fillStyle = near ? '#d7ad58' : '#a8834a';
          ctx.fillRect(rootX, rootY, 4, 13);
          ctx.fillRect(Math.min(rootX, shinX), rootY + 8 - lift, Math.abs(shinX - rootX) + 4, 5);
          ctx.fillRect(shinX, rootY + 10 - lift, 4, 11);
          ctx.fillRect(Math.min(shinX, footX), rootY + 18 - lift, Math.abs(footX - shinX) + 4, 4);
          ctx.fillRect(footX - 6, rootY + 20 - lift, 13, 4);
          ctx.fillRect(footX - 4, rootY + 23 - lift, 3, 3);
          ctx.fillRect(footX + 3, rootY + 23 - lift, 3, 3);
        };

        drawWing(false);
        drawCrowLeg(-8, -gait, false);
        this.drawPixelSprite(ctx, bodyRows, bodyPalette, 3, 0, -12, 1);
        // 尾・頭・嘴
        ctx.fillStyle = '#080c10'; ctx.fillRect(-49, -1, 20, 8); ctx.fillRect(-60, 6, 18, 6);
        ctx.fillStyle = '#151c22'; ctx.fillRect(28, -21, 22, 17); ctx.fillRect(40, -25, 12, 12);
        ctx.fillStyle = '#e14848'; ctx.fillRect(43, -21, 4, 4);
        const cryOpen = action === 'cry' ? Math.max(.15, 1 - attackT) : 0;
        ctx.fillStyle = '#d7ad58'; ctx.fillRect(48, -15, 22 + Math.round(cryOpen * 10), 5);
        ctx.fillStyle = '#edc46a'; ctx.fillRect(55, -9, 16 + Math.round(cryOpen * 8), 4);
        if (cryOpen > 0) { ctx.fillStyle = '#17100e'; ctx.fillRect(50, -10, 16 + Math.round(cryOpen * 8), 3); }
        drawWing(true);
        drawCrowLeg(9, gait, true);
        ctx.restore();
      } else if (type === 'whitefox') {
        ctx.save();
        ctx.scale(facing, 1);
        const gait = moving ? Math.round(Math.sin(phase) * 4) : 0;
        const actionProgress = 1 - attackT;
        const dashLean = action === 'teleport' ? Math.round(actionProgress * 6) : 0;
        const slashLift = ['slash','slowSlash'].includes(action) ? Math.round(Math.sin(actionProgress * Math.PI) * 10) : 0;
        const clockCharge = action === 'clock' ? Math.max(.15, actionProgress) : 0;
        const bodyLift = action === 'teleport' ? -3 : moving ? Math.round(Math.cos(phase * 2)) : 0;
        ctx.translate(dashLean, bodyLift);
        const tailWave = moving ? Math.round(Math.sin(phase * .8) * 4) : 0;
        const tailPose = action === 'clock' ? -8 : action === 'teleport' ? 5 : 0;
        const drawFoxTail = (x, y, bend, shade) => {
          ctx.fillStyle = '#cfdce6'; ctx.fillRect(x, y, 18, 9);
          ctx.fillStyle = shade; ctx.fillRect(x - 14, y - 8 + bend, 18, 10);
          ctx.fillStyle = '#f8fbff'; ctx.fillRect(x - 27, y - 16 + bend * 2, 17, 11);
          ctx.fillStyle = '#8ed5ff'; ctx.fillRect(x - 31, y - 18 + bend * 2, 7, 7);
        };
        drawFoxTail(-35, -4, tailWave + tailPose, '#e8f0f6');
        drawFoxTail(-38, 5, -tailWave + tailPose + 3, '#dce8f0');
        drawFoxTail(-34, 13, Math.round(tailWave * .5) + tailPose + 5, '#edf4f8');
        const bodyRows = [
          '........1111111111........','.....1112222222222111.....','...11222333333333322211...','..122333444444444333221...','.12333444455554444333221..','123334445555555544433321..','123334445566665544433321..','123334445566665544433321..','.12333444555555444333221..','..122333444444443333221...','...11222333333333322211...','......1112222222111.......'
        ];
        const foxPalette = {'1':'#aab8c4','2':'#d5e0e9','3':'#edf4f8','4':'#f8fbff','5':'#ffffff','6':'#a5dcff'};
        this.drawPixelSprite(ctx, bodyRows, foxPalette, 3, -6, -17, 1);
        ctx.fillStyle = '#dce8f0'; ctx.fillRect(-25, 2, 62, 10);
        ctx.fillStyle = '#f8fbff'; ctx.fillRect(-17, 5, 48, 7);
        const drawFoxLeg = (rootX, rootY, stride, lift, front = false) => {
          const kneeX = rootX + stride, yy = rootY - lift;
          ctx.fillStyle = '#c8d6df'; ctx.fillRect(Math.min(rootX, kneeX), yy, Math.abs(kneeX-rootX)+7, 7);
          ctx.fillStyle = '#eff6fa'; ctx.fillRect(kneeX, yy+4, 7, 19);
          ctx.fillStyle = '#a5dcff'; ctx.fillRect(kneeX-2, yy+20, 12, 5);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(kneeX+6, yy+21, front ? 8 : 6, 4);
        };
        drawFoxLeg(-22, 8, -gait, Math.max(0, gait));
        drawFoxLeg(-3, 9, gait, Math.max(0, -gait));
        drawFoxLeg(17, 7, gait, Math.max(0, -gait), true);
        drawFoxLeg(34, 6, -gait, Math.max(0, gait) + slashLift, true);
        ctx.fillStyle = '#edf4f8'; ctx.fillRect(27, -22, 19, 25);
        const headRows = [
          '....11......11......',
          '...1221....1221.....',
          '..12332111123321....',
          '.1233332223333321...',
          '.12334444444443321..',
          '.123445555544443321.',
          '.123444444447844321.',
          '..1234444444433aa219',
          '...123333333333321..',
          '....122222222221....',
          '......11111111......'
        ];
        this.drawPixelSprite(ctx, headRows, {
          '1':'#aab8c4','2':'#d5e0e9','3':'#edf4f8','4':'#ffffff','5':'#a5dcff',
          '7':'#17202a','8':'#79c9ff','9':'#222a30','a':'#596975'
        }, 3, 40, -28, 1);
        ctx.save();ctx.translate(46, -1);
        let swordAngle = -.18;
        if (action === 'slash') swordAngle = -1.15 + actionProgress * 1.7;
        else if (action === 'slowSlash') swordAngle = -.9 + actionProgress * 1.25;
        else if (action === 'teleport') swordAngle = -.55;
        ctx.rotate(swordAngle);
        ctx.fillStyle = '#5c7486'; ctx.fillRect(-5, -2, 11, 5);
        ctx.fillStyle = '#e9faff'; ctx.fillRect(4, -2, 30, 4);
        ctx.fillStyle = '#8ed5ff'; ctx.fillRect(30, -1, 12, 2);
        ctx.restore();
        if (clockCharge > 0) {
          ctx.save();ctx.globalAlpha *= .45 + clockCharge * .35;ctx.strokeStyle = '#bce9ff';ctx.lineWidth = 3;
          ctx.beginPath();ctx.arc(0,-4,48+clockCharge*15,0,TAU);ctx.stroke();
          for(let i=0;i<8;i++){const a=i*TAU/8;ctx.beginPath();ctx.moveTo(Math.cos(a)*39,-4+Math.sin(a)*39);ctx.lineTo(Math.cos(a)*50,-4+Math.sin(a)*50);ctx.stroke();}
          ctx.restore();
        }
        ctx.restore();
      } else if (type === 'nekomata') {
        ctx.save();
        ctx.scale(facing, 1);
        const gait = moving ? Math.round(Math.sin(phase) * 4) : 0;
        const actionProgress = 1 - attackT;
        const jumpLift = action === 'jump' ? Math.round(Math.sin(actionProgress * Math.PI) * 28) : 0;
        const tailStrike = action === 'tailStrike' ? Math.round(Math.sin(actionProgress * Math.PI) * 26) : 0;
        const laserCharge = action === 'laser' ? Math.max(.1, actionProgress) : 0;
        const snipeRecoil = action === 'snipe' ? Math.round(actionProgress * 5) : 0;
        ctx.translate(0, -jumpLift);
        const tailWave = moving ? Math.round(Math.sin(phase * .75) * 4) : 0;
        const drawCatTail = (baseY, wave, high) => {
          const rootX=-37, tipX=action==='tailStrike'?32+tailStrike:-69, midX=action==='tailStrike'?-5+Math.round(tailStrike*.4):-55;
          ctx.strokeStyle=high?'#7d53c7':'#5f3b9c';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(rootX,baseY);ctx.quadraticCurveTo(midX,baseY-24-wave,tipX,baseY-34-wave);ctx.stroke();
          ctx.strokeStyle='#c38cff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(rootX,baseY);ctx.quadraticCurveTo(midX,baseY-24-wave,tipX,baseY-34-wave);ctx.stroke();
          ctx.fillStyle='#ff7ae5';ctx.fillRect(tipX-5,baseY-39-wave,10,10);
        };
        drawCatTail(-2,tailWave,false);drawCatTail(8,-tailWave+4,true);
        const bodyRows=['.......111111111........','....111222222222111.....','..1122233333333332211...','.122333444444444333221..','12333444455554444333221.','12334445555555544433321.','12334445566665544433321.','12334445566665544433321.','.1233344555555544433321.','..12233344444444333221..','...112223333333322211...','......11122222111........'];
        const catPalette={'1':'#262833','2':'#414452','3':'#636877','4':'#8d95a3','5':'#c3cad3','6':'#2a172f'};
        this.drawPixelSprite(ctx,bodyRows,catPalette,3,-7,-16,1);
        ctx.fillStyle='#555a68';ctx.fillRect(-25,3,62,9);ctx.fillStyle='#8d95a3';ctx.fillRect(-16,6,46,6);
        const catLeg=(rootX,rootY,stride,lift,front=false)=>{
          if(action==='jump'){stride=front?8:-7;lift+=7;}
          const pawX=rootX+stride,yy=rootY-lift;
          ctx.fillStyle='#4c505f';ctx.fillRect(Math.min(rootX,pawX),yy,Math.abs(pawX-rootX)+7,7);
          ctx.fillStyle='#9da5b1';ctx.fillRect(pawX,yy+4,7,18);
          ctx.fillStyle='#c8ced7';ctx.fillRect(pawX-3,yy+19,13,5);
          ctx.fillStyle='#af72ff';ctx.fillRect(pawX+7,yy+20,front?7:5,3);
        };
        catLeg(-22,8,-gait,Math.max(0,gait));catLeg(-3,9,gait,Math.max(0,-gait));catLeg(18,7,gait,Math.max(0,-gait),true);catLeg(35,6,-gait,Math.max(0,gait),true);
        ctx.fillStyle='#7a808d';ctx.fillRect(28,-20,18,23);
        const catHead=[
          '...11........11.....',
          '..1221......1221....',
          '.1233211111123321...',
          '123333222223333321..',
          '123344444444443321..',
          '123445555554443321..',
          '123444444447844321..',
          '.1234444444433aa219.',
          '..123333333333321...',
          '...122222222221.....',
          '.....11111111.......'
        ];
        this.drawPixelSprite(ctx,catHead,{
          '1':'#262833','2':'#414452','3':'#636877','4':'#aab2bd','5':'#e0e4e9',
          '7':'#211526','8':'#ff7ae5','9':'#221526','a':'#5f5268'
        },3,41-snipeRecoil,-27,1);
        ctx.strokeStyle='#d9dce2';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(60-snipeRecoil,-13);ctx.lineTo(76-snipeRecoil,-17);ctx.moveTo(60-snipeRecoil,-10);ctx.lineTo(78-snipeRecoil,-9);ctx.stroke();
        if(action==='snipe'){ctx.fillStyle='#b073ff';ctx.beginPath();ctx.arc(66-snipeRecoil,-8,7*Math.max(.3,attackT),0,TAU);ctx.fill();}
        if(laserCharge>0){ctx.save();ctx.globalAlpha*=.55+laserCharge*.3;ctx.fillStyle='#ff6ad5';ctx.beginPath();ctx.arc(0,-59,12+laserCharge*13,0,TAU);ctx.fill();ctx.strokeStyle='#d5a5ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-59,24+laserCharge*10,0,TAU);ctx.stroke();ctx.restore();}
        if(action==='jump'){ctx.save();ctx.globalAlpha*=.35;ctx.fillStyle='#8055bd';ctx.beginPath();ctx.ellipse(0,42+jumpLift,Math.max(14,48-jumpLift*.4),Math.max(5,13-jumpLift*.1),0,0,TAU);ctx.fill();ctx.restore();}
        ctx.restore();
      } else if (type === 'orochi') {
        const pulse = .5 + Math.sin(this.elapsed * 6) * .5;
        const headAngle = Number.isFinite(p.aim) ? p.aim : 0;
        const fallback = [];
        if (!(ai.bodySegments || []).length) {
          for (let i = 1; i <= 20; i++) {
            const spacing = 34 * i;
            const wave = Math.sin(i * .62 + this.elapsed * 1.8) * Math.min(38, i * 2.2);
            fallback.push({
              x: p.x - Math.cos(headAngle) * spacing + Math.cos(headAngle + Math.PI / 2) * wave,
              y: p.y - Math.sin(headAngle) * spacing + Math.sin(headAngle + Math.PI / 2) * wave,
              radius: Math.max(16, 50 * (1 - (i / 20) * .7)),
              angle: headAngle,
              index: i,
            });
          }
        }
        const segments = (ai.bodySegments || []).length ? ai.bodySegments : fallback;
        for (let i = segments.length - 1; i >= 0; i--) {
          const segment = segments[i];
          this.drawOrochiSegment(ctx, segment.x - p.x, segment.y - p.y, segment.radius, ai.enraged, segment.angle, segment.index, pulse);
        }
        ctx.save();
        ctx.rotate(headAngle);
        const bite = action === 'bite' ? (1 - attackT) : 0;
        const breath = action === 'breath' ? (1 - attackT) : 0;
        const meteor = action === 'meteor' ? (1 - attackT) : 0;
        const ultimate = action === 'ultimate' ? (1 - attackT) : 0;
        const enraged = Boolean(ai.enraged);
        const outer = enraged ? '#6d2513' : '#294a2a';
        const mid = enraged ? '#b84620' : '#517a3d';
        const light = enraged ? '#ff9140' : '#91b966';
        const belly = enraged ? '#ffd27f' : '#d5e3a0';
        // neck bridge
        ctx.fillStyle = outer; ctx.beginPath(); ctx.ellipse(-38, 0, 72, 62, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = mid; ctx.beginPath(); ctx.ellipse(-28, -3, 62, 51, 0, 0, TAU); ctx.fill();
        // flame mane
        ctx.fillStyle = enraged ? '#ff6e2d' : '#6f934e';
        for (let i = -3; i <= 3; i++) {
          const y = i * 15;
          ctx.beginPath(); ctx.moveTo(-34, y - 8); ctx.lineTo(-72 - Math.abs(i) * 4, y); ctx.lineTo(-34, y + 8); ctx.closePath(); ctx.fill();
        }
        // angular dragon-serpent head: long skull, narrow eyes, exposed fangs
        ctx.fillStyle = outer;
        ctx.beginPath();
        ctx.moveTo(-18,-38); ctx.lineTo(12,-58); ctx.lineTo(48,-55); ctx.lineTo(76,-43);
        ctx.lineTo(104,-28); ctx.lineTo(132,-9); ctx.lineTo(126,15); ctx.lineTo(98,29);
        ctx.lineTo(56,31); ctx.lineTo(18,20); ctx.lineTo(-12,6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = mid;
        ctx.beginPath();
        ctx.moveTo(-4,-31); ctx.lineTo(20,-47); ctx.lineTo(50,-44); ctx.lineTo(78,-34);
        ctx.lineTo(105,-21); ctx.lineTo(124,-7); ctx.lineTo(114,9); ctx.lineTo(88,18);
        ctx.lineTo(54,18); ctx.lineTo(21,10); ctx.lineTo(-2,-1); ctx.closePath(); ctx.fill();
        // cheek armor and bony ridges
        ctx.fillStyle = light;
        ctx.beginPath(); ctx.moveTo(8,-33); ctx.lineTo(38,-44); ctx.lineTo(68,-35); ctx.lineTo(48,-24); ctx.lineTo(18,-23); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(18,8); ctx.lineTo(55,14); ctx.lineTo(82,11); ctx.lineTo(61,24); ctx.lineTo(29,21); ctx.closePath(); ctx.fill();
        // swept-back horns
        ctx.fillStyle = '#ead8ae';
        ctx.beginPath(); ctx.moveTo(2,-42); ctx.lineTo(-42,-83); ctx.lineTo(-18,-38); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(30,-50); ctx.lineTo(8,-96); ctx.lineTo(46,-48); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#b99a70';
        ctx.beginPath(); ctx.moveTo(4,-43); ctx.lineTo(-26,-70); ctx.lineTo(-12,-40); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(31,-49); ctx.lineTo(17,-81); ctx.lineTo(41,-47); ctx.closePath(); ctx.fill();
        // crown spines
        ctx.fillStyle = enraged ? '#ff7131' : '#5f8447';
        for (let i = 0; i < 5; i++) {
          const x = -8 + i * 18;
          ctx.beginPath(); ctx.moveTo(x,-40); ctx.lineTo(x+7,-64-i*3); ctx.lineTo(x+15,-39); ctx.closePath(); ctx.fill();
        }
        // hostile brow and slit eye
        ctx.strokeStyle = '#1b120d'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(42,-35); ctx.lineTo(79,-27); ctx.stroke();
        ctx.fillStyle = '#100c09'; ctx.beginPath(); ctx.moveTo(49,-28); ctx.lineTo(76,-24); ctx.lineTo(64,-16); ctx.lineTo(47,-20); ctx.closePath(); ctx.fill();
        ctx.fillStyle = enraged ? '#fff2a3' : '#dfff9b';
        ctx.fillRect(56,-24,12,4);
        ctx.fillStyle = '#d82f26'; ctx.fillRect(64,-24,3,5);
        // long snout and nostril slits
        ctx.fillStyle = mid;
        ctx.beginPath(); ctx.moveTo(74,-21); ctx.lineTo(126,-12); ctx.lineTo(143,-2); ctx.lineTo(129,12); ctx.lineTo(82,8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#17100d';
        ctx.fillRect(125,-5,13,5); ctx.fillRect(117,5,10,4);
        // lower jaw and mouth cavity
        const jawY = 17 + bite * 18 + breath * 8;
        ctx.fillStyle = outer;
        ctx.beginPath(); ctx.moveTo(50,9); ctx.lineTo(92,11); ctx.lineTo(132,17); ctx.lineTo(118,jawY+17); ctx.lineTo(74,jawY+18); ctx.lineTo(43,jawY+8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4d1110';
        ctx.beginPath(); ctx.moveTo(56,8); ctx.lineTo(125,13); ctx.lineTo(112,jawY+10); ctx.lineTo(71,jawY+11); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#9d2922';
        ctx.beginPath(); ctx.moveTo(70,jawY+3); ctx.lineTo(108,jawY+4); ctx.lineTo(96,jawY+11); ctx.lineTo(75,jawY+10); ctx.closePath(); ctx.fill();
        // exposed upper and lower fangs
        ctx.fillStyle = '#f8efdc';
        for (const fang of [[64,8,9,25],[83,10,8,29],[104,12,8,24]]) {
          const [x,y,w,h]=fang; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+w/2,y+h+bite*7); ctx.lineTo(x+w,y); ctx.closePath(); ctx.fill();
        }
        for (const fang of [[73,jawY+15,8,18],[98,jawY+14,8,20]]) {
          const [x,y,w,h]=fang; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+w/2,y-h-bite*5); ctx.lineTo(x+w,y); ctx.closePath(); ctx.fill();
        }
        // facial scars
        ctx.strokeStyle = enraged ? '#ffb15e' : '#264321'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(34,-16); ctx.lineTo(47,-7); ctx.moveTo(38,-10); ctx.lineTo(51,-1); ctx.stroke();
        // long whiskers
        ctx.strokeStyle = '#e8d6ad'; ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(103,4);ctx.quadraticCurveTo(143,-10,174,-34);ctx.stroke();
        ctx.beginPath();ctx.moveTo(100,10);ctx.quadraticCurveTo(146,31,177,52);ctx.stroke();
        // action charge
        if (meteor > 0 || ultimate > 0) {
          ctx.globalAlpha = .45 + Math.max(meteor,ultimate)*.35;
          ctx.strokeStyle = '#ffb05b'; ctx.lineWidth = 6;
          for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(14,0,82+i*18+Math.sin(this.elapsed*7+i)*8,0,TAU);ctx.stroke();}
        }
        if (breath > 0) {
          ctx.globalAlpha = .7 + breath*.25;
          ctx.fillStyle = '#fff3b0'; ctx.beginPath();ctx.arc(111,13,14+breath*18,0,TAU);ctx.fill();
          ctx.fillStyle = '#ff6a26';ctx.beginPath();ctx.arc(111,13,8+breath*11,0,TAU);ctx.fill();
        }
        if (enraged) {
          ctx.globalAlpha = .22 + pulse*.14;
          ctx.strokeStyle = '#ff8d3d';ctx.lineWidth=9;ctx.beginPath();ctx.ellipse(10,0,128,88,0,0,TAU);ctx.stroke();
        }
        ctx.restore();

      }
      ctx.restore();
    }

    drawDefenseEnemy(ctx, p) {
      const type = p.defenseType;
      const defenseChameleonHidden = (p.toggles?.chameleon || (p.defenseAI?.chameleonTimer || 0) > 0) && (p.markedTimer || 0) <= 0;
      const hyakkiTypes = ['skeletonAttacker', 'skeletonShooter', 'skeletonSniper', 'yamagu', 'yagarasu', 'whitefox', 'nekomata', 'orochi'];
      const supportTypes=['sogetsu','fullarms','geist'];
      if(supportTypes.includes(type)){this.drawDefenseSupportHumanoid(ctx,p);}
      else if (hyakkiTypes.includes(type)) {
        this.drawHyakkiEnemySprite(ctx, p);
      } else if (p.isDefenseBoss) {
        this.drawBlackTriggerHumanoid(ctx, p);
      } else {
        const color = p.appearance?.bodyColor || '#ddd';
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
        if (p.defenseCore) {
          const a = p.defenseCore.angle, d = p.defenseCore.distance;
          const cx = Math.cos(a) * d, cy = Math.sin(a) * d;
          ctx.fillStyle = '#ff315f'; ctx.strokeStyle = '#fff2b4'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx, cy - p.defenseCore.radius); ctx.lineTo(cx + p.defenseCore.radius, cy); ctx.lineTo(cx, cy + p.defenseCore.radius); ctx.lineTo(cx - p.defenseCore.radius, cy); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
      }
      if (defenseChameleonHidden) return;
      const hp = clamp(p.hp / p.maxHp, 0, 1);
      const width = p.defenseType === 'orochi' ? 220 : p.isDefenseBoss ? 160 : 90;
      const title = p.playableDefenseType ? `${p.name}：${EXTRA_UNIT_DEFS[type]?.label || type}` : hyakkiTypes.includes(type) && p.isDefenseBoss ? `百鬼夜行：${p.name}` : p.isDefenseBoss ? `BLACK TRIGGER：${p.name}` : p.name;
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(p.x - width / 2, p.y - p.radius - 34, width, 7);
      ctx.fillStyle = p.defenseSupportType ? '#55eaff' : p.isDefenseBoss ? '#ff5f73' : '#ffd369'; ctx.fillRect(p.x - width / 2, p.y - p.radius - 34, width * hp, 7);
      ctx.fillStyle = '#fff'; ctx.font = p.isDefenseBoss ? '900 12px sans-serif' : '800 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(title, p.x, p.y - p.radius - 42);
    }

    drawPlayers(ctx) {
      const ordered = [...this.players].sort((a, b) => Number(a.human) - Number(b.human));
      for (const p of ordered) {
        if (p.dead || !this.inView(p.x, p.y, 120)) continue;
        if (p.isDefenseEnemy || p.playableDefenseType) { this.drawDefenseEnemy(ctx, p); continue; }
        const chameleonHidden = p.toggles.chameleon && p.markedTimer <= 0;
        let alpha = 1;
        if (chameleonHidden && !p.human) alpha = .012;
        if (chameleonHidden && p.human) alpha = .1;
        const color = p.appearance?.bodyColor || p.appearance?.uniformColor || ((this.config.mode === 'team' || this.isDefenseMode) ? this.teamColors[p.team] : (p.human ? '#66ecff' : '#ff8b75'));
        ctx.save();
        if (!this.onlineReducedEffects && !chameleonHidden) { ctx.shadowColor = color; ctx.shadowBlur = p.human ? 16 : 6; }
        this.drawHumanoid(ctx, p, alpha);
        ctx.shadowBlur = 0;
        ctx.restore();

        if (!chameleonHidden && (p.shields.main || p.shields.sub)) this.drawPlayerShield(ctx, p);
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
        if (!chameleonHidden) this.drawPlayerLabel(ctx, p);
      }
    }

    drawPlayerShield(ctx, p) {
      const entries = this.getActiveShieldEntries(p);
      const count = entries.length;
      const full = count >= 2;
      const raygust = entries.some(({state}) => state.type === 'raygust');
      const seal = entries.some(({state}) => state.type === 'seal');
      const ratio = entries.length ? entries.reduce((sum,{state}) => sum + clamp(state.current/state.max,0,1),0)/entries.length : 1;
      ctx.globalAlpha = .42 + ratio * .58;
      ctx.strokeStyle = raygust ? 'rgba(155,250,255,.95)' : seal ? 'rgba(244,241,255,.9)' : 'rgba(104,204,255,.82)';
      ctx.lineWidth = raygust ? 8 : seal ? 6 : 5;
      if (full) ctx.strokeRect(p.x-p.radius-10,p.y-p.radius-10,(p.radius+10)*2,(p.radius+10)*2);
      else {const cx=p.x+Math.cos(p.aim)*(p.radius+10),cy=p.y+Math.sin(p.aim)*(p.radius+10);ctx.save();ctx.translate(cx,cy);ctx.rotate(p.aim);ctx.strokeRect(-3,-p.radius-8,6,(p.radius+8)*2);if(ratio<.45){ctx.beginPath();ctx.moveTo(-4,-p.radius*.4);ctx.lineTo(5,0);ctx.lineTo(-3,p.radius*.45);ctx.stroke();}ctx.restore();}
      ctx.globalAlpha = 1;
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
          const slashStyle = String(e.style || '');
          ctx.strokeStyle = e.color || (slashStyle === 'mantis' ? '#c7fff4' : slashStyle === 'kogetsuParry' ? '#fff3a8' : slashStyle.includes('scorpion') ? '#b59cff' : '#e2fbff');
          ctx.lineWidth = e.style === 'mantis' ? 13 : e.style === 'kogetsuParry' ? 11 : 8;
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
        } else if (e.type === 'yamaguClaw') {
          const progress = 1 - t;
          ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle || 0);
          ctx.globalAlpha = Math.min(1, t * 1.35);
          for (let i = 0; i < 3; i++) {
            ctx.strokeStyle = i === 1 ? '#fff0c9' : '#ffc47a';
            ctx.lineWidth = 7 - i * 1.2;
            const offset = (i - 1) * 18;
            ctx.beginPath();
            ctx.moveTo(28 + progress * 12, offset - 22);
            ctx.quadraticCurveTo((e.range || 120) * .58, offset, e.range || 120, offset + 24);
            ctx.stroke();
          }
          ctx.restore();
        } else if (e.type === 'yamaguSharpen') {
          const progress = 1 - t;
          ctx.globalAlpha = Math.min(1, t * 1.5);
          ctx.strokeStyle = '#ffd08a'; ctx.lineWidth = 3;
          for (let i = 0; i < 9; i++) {
            const a = i * TAU / 9 + progress * 2.1;
            const inner = 24 + (i % 3) * 7;
            const outer = inner + 16 + progress * 18;
            ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * inner, e.y + Math.sin(a) * inner); ctx.lineTo(e.x + Math.cos(a) * outer, e.y + Math.sin(a) * outer); ctx.stroke();
          }
        } else if (e.type === 'yamaguDash') {
          const progress = 1 - t;
          ctx.globalAlpha = t * .72;
          ctx.strokeStyle = '#ffc46c'; ctx.lineWidth = 18 * t + 4;
          ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x2, e.y2); ctx.stroke();
          ctx.strokeStyle = '#fff0c2'; ctx.lineWidth = 4;
          for (let i = -1; i <= 1; i++) {
            const ox = i * 18;
            ctx.beginPath(); ctx.moveTo(e.x, e.y + ox); ctx.lineTo(e.x + (e.x2 - e.x) * (.45 + progress * .35), e.y + (e.y2 - e.y) * (.45 + progress * .35) + ox); ctx.stroke();
          }
        } else if (e.type === 'yamaguRoar') {
          const progress = 1 - t;
          ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle || 0);
          ctx.globalAlpha = t * .75;
          ctx.strokeStyle = '#ffd49a';
          for (let i = 0; i < 3; i++) {
            ctx.lineWidth = 5 - i;
            ctx.beginPath(); ctx.arc(0, 0, 34 + progress * (e.radius || 180) + i * 18, -1.0, 1.0); ctx.stroke();
          }
          ctx.restore();
        } else if (e.type === 'yagarasuMist') {
          const progress = 1 - t;
          const dx = (e.x2 - e.x), dy = (e.y2 - e.y);
          for (let i = 0; i < 9; i++) {
            const q = clamp(progress * 1.25 - i * .075, 0, 1);
            const x = e.x + dx * q, y = e.y + dy * q;
            ctx.globalAlpha = t * (.22 + (i % 3) * .07);
            ctx.fillStyle = i % 2 ? '#51445f' : '#312b39';
            ctx.beginPath(); ctx.arc(x, y, 18 + i % 3 * 7 + progress * 10, 0, TAU); ctx.fill();
          }
        } else if (e.type === 'yagarasuFlap') {
          const progress = 1 - t;
          ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle || 0);
          ctx.globalAlpha = t * .78;
          ctx.strokeStyle = '#cbd5de';
          for (let i = 0; i < 5; i++) {
            ctx.lineWidth = 6 - i * .7;
            const r = 55 + i * 25 + progress * 45;
            ctx.beginPath(); ctx.arc(0, 0, r, -.68, .68); ctx.stroke();
          }
          ctx.fillStyle = '#202830';
          for (let i = 0; i < 7; i++) {
            const x = 35 + i * 18 + progress * 45;
            const y = (i - 3) * 15;
            ctx.fillRect(x, y, 13, 5);
          }
          ctx.restore();
        } else if (e.type === 'yagarasuBreath') {
          const progress = 1 - t;
          const dx = e.x2 - e.x, dy = e.y2 - e.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len;
          ctx.globalAlpha = Math.min(.9, t * 1.2);
          ctx.strokeStyle = '#6c5975'; ctx.lineWidth = 30 + progress * 30;
          ctx.beginPath(); ctx.moveTo(e.x + ux * 40, e.y + uy * 40); ctx.lineTo(e.x + dx * Math.min(1, progress * 1.35), e.y + dy * Math.min(1, progress * 1.35)); ctx.stroke();
          ctx.strokeStyle = '#b09bc2'; ctx.lineWidth = 8;
          ctx.beginPath(); ctx.moveTo(e.x + ux * 45, e.y + uy * 45); ctx.lineTo(e.x + dx * Math.min(1, progress * 1.35), e.y + dy * Math.min(1, progress * 1.35)); ctx.stroke();
          for (let i = 0; i < 7; i++) {
            const q = clamp(progress - i * .08, 0, 1);
            ctx.fillStyle = i % 2 ? '#493c55' : '#2c2632';
            ctx.globalAlpha = t * .35;
            ctx.beginPath(); ctx.arc(e.x + dx * q, e.y + dy * q, 14 + i * 4, 0, TAU); ctx.fill();
          }
        } else if (e.type === 'yagarasuCry') {
          const progress = 1 - t;
          ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle || 0);
          ctx.globalAlpha = t * .72;
          ctx.strokeStyle = '#aeb8c1';
          for (let i = 0; i < 4; i++) {
            ctx.lineWidth = 4 - i * .5;
            ctx.beginPath(); ctx.arc(0, 0, 28 + progress * (e.radius || 180) + i * 20, -.9, .9); ctx.stroke();
          }
          ctx.restore();
        } else if (e.type === 'whitefoxSlash') {
          const progress=1-t;ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle||0);ctx.globalAlpha=Math.min(1,t*1.4);ctx.strokeStyle=e.slow?'#8ed5ff':'#effcff';ctx.lineWidth=e.slow?12:9;ctx.beginPath();ctx.arc(0,0,40+progress*(e.range||105),-.78,.78);ctx.stroke();ctx.strokeStyle='#ffffff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,52+progress*(e.range||105),-.65,.65);ctx.stroke();if(e.slow){ctx.fillStyle='#bcecff';for(let i=0;i<6;i++){const a=(i-2.5)*.24;ctx.fillRect(Math.cos(a)*(60+progress*70),Math.sin(a)*(60+progress*70)-3,7,7);}}ctx.restore();
        } else if (e.type === 'whitefoxTeleport') {
          const progress=1-t,dx=e.x2-e.x,dy=e.y2-e.y;ctx.globalAlpha=t*.65;ctx.strokeStyle='#bdeaff';ctx.lineWidth=14*t+3;ctx.setLineDash([18,12]);ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+dx*Math.min(1,progress*1.7),e.y+dy*Math.min(1,progress*1.7));ctx.stroke();ctx.setLineDash([]);for(let i=0;i<5;i++){const q=clamp(progress-i*.12,0,1);ctx.globalAlpha=t*(.18+i*.06);ctx.fillStyle='#ecf9ff';ctx.beginPath();ctx.arc(e.x+dx*q,e.y+dy*q,28-i*3,0,TAU);ctx.fill();}
        } else if (e.type === 'whitefoxClock') {
          const progress=1-t,r=(e.radius||164)*(.35+progress*.65);ctx.save();ctx.translate(e.x,e.y);ctx.globalAlpha=t*.78;ctx.strokeStyle='#bdeaff';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();ctx.strokeStyle='#ffffff';ctx.lineWidth=2;for(let i=0;i<12;i++){const a=i*TAU/12;ctx.beginPath();ctx.moveTo(Math.cos(a)*(r-18),Math.sin(a)*(r-18));ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);ctx.stroke();}ctx.rotate(progress*3.4);ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(r*.58,0);ctx.stroke();ctx.rotate(-progress*5.8);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(r*.38,0);ctx.stroke();ctx.restore();
        } else if (e.type === 'nekomataTail') {
          const progress=1-t;ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle||0);ctx.globalAlpha=Math.min(1,t*1.35);for(let i=-1;i<=1;i+=2){ctx.strokeStyle=i<0?'#9b62e5':'#d08cff';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(-18,i*17);ctx.quadraticCurveTo(42+progress*35,i*30,(e.range||150),i*10);ctx.stroke();ctx.strokeStyle='#ffd6ff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-12,i*17);ctx.quadraticCurveTo(48+progress*35,i*30,(e.range||150),i*10);ctx.stroke();}ctx.restore();
        } else if (e.type === 'nekomataSnipe') {
          const progress=1-t,dx=e.x2-e.x,dy=e.y2-e.y;ctx.globalAlpha=t*.75;ctx.strokeStyle='#b073ff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+dx*Math.min(1,progress*2.2),e.y+dy*Math.min(1,progress*2.2));ctx.stroke();ctx.fillStyle='#ff7ae5';ctx.beginPath();ctx.arc(e.x,e.y,12*t,0,TAU);ctx.fill();
        } else if (e.type === 'nekomataLaser') {
          const progress=1-t;ctx.globalAlpha=Math.min(.9,t*1.25);ctx.strokeStyle='#ff6ad5';ctx.lineWidth=46+progress*18;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x2,e.y2);ctx.stroke();ctx.strokeStyle='#fff0ff';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x2,e.y2);ctx.stroke();ctx.fillStyle='#c88cff';for(let i=0;i<8;i++){const q=(i+progress*3)%8/8;ctx.globalAlpha=t*.45;ctx.beginPath();ctx.arc(e.x+(e.x2-e.x)*q,e.y+(e.y2-e.y)*q,8+i%3*4,0,TAU);ctx.fill();}
        } else if (e.type === 'nekomataJump') {
          const progress=1-t;ctx.globalAlpha=t*.55;ctx.strokeStyle='#b073ff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(e.x,e.y,20+progress*(e.radius||90),0,TAU);ctx.stroke();for(let i=0;i<8;i++){const a=i*TAU/8;ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*24,e.y+Math.sin(a)*12);ctx.lineTo(e.x+Math.cos(a)*(50+progress*50),e.y+Math.sin(a)*(22+progress*25));ctx.stroke();}

        } else if (e.type === 'orochiBite') {
          const progress = 1 - t;
          const snap = Math.sin(clamp(progress, 0, 1) * Math.PI);
          const close = clamp((progress - .18) / .42, 0, 1);
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(e.angle || 0);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = Math.min(1, t * 1.7);
          // jaw-shaped flame trails
          for (let jaw = -1; jaw <= 1; jaw += 2) {
            ctx.strokeStyle = jaw < 0 ? '#ff8d3c' : '#ffd06a';
            ctx.lineWidth = 14 - close * 5;
            ctx.beginPath();
            ctx.arc(48, 0, 42 + snap * (e.range || 125), jaw < 0 ? -.98 : .08, jaw < 0 ? -.08 : .98);
            ctx.stroke();
            ctx.strokeStyle = '#fff0bb';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(48, 0, 34 + snap * (e.range || 125), jaw < 0 ? -.9 : .1, jaw < 0 ? -.1 : .9);
            ctx.stroke();
          }
          // closing fang silhouettes
          ctx.fillStyle = '#fff7dc';
          for (let i = 0; i < 5; i++) {
            const q = i / 4;
            const x = 74 + q * 86;
            const spread = (1 - close) * (34 - q * 8) + 5;
            ctx.beginPath(); ctx.moveTo(x, -spread - 16); ctx.lineTo(x + 7, -spread + 4); ctx.lineTo(x + 14, -spread - 16); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(x, spread + 16); ctx.lineTo(x + 7, spread - 4); ctx.lineTo(x + 14, spread + 16); ctx.closePath(); ctx.fill();
          }
          // impact cross and ember fragments
          if (progress > .48) {
            const impact = clamp((progress - .48) / .22, 0, 1);
            ctx.strokeStyle = '#fff5c9'; ctx.lineWidth = 7 * (1 - impact) + 2;
            for (let i = 0; i < 8; i++) {
              const a = i * TAU / 8;
              ctx.beginPath(); ctx.moveTo(145 + Math.cos(a) * 12, Math.sin(a) * 12); ctx.lineTo(145 + Math.cos(a) * (42 + impact * 38), Math.sin(a) * (42 + impact * 38)); ctx.stroke();
            }
          }
          ctx.restore();
        } else if (e.type === 'orochiMeteor') {
          const progress = 1 - t;
          const stagger = Number(e.stagger ?? e.delay ?? 0);
          const local = clamp((progress - stagger) / Math.max(.12, 1 - stagger), 0, 1);
          const fall = clamp(local / .66, 0, 1);
          const burst = clamp((local - .62) / .38, 0, 1);
          const radius = e.radius || 92;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          // rotating warning sigil
          ctx.translate(e.x, e.y);
          ctx.globalAlpha = Math.min(1, t * 1.6) * (1 - burst * .55);
          ctx.rotate(this.elapsed * 1.6 + stagger * 9);
          ctx.strokeStyle = '#ff7a32'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(0, 0, radius * (.45 + local * .45), 0, TAU); ctx.stroke();
          ctx.strokeStyle = '#ffd46d'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, radius * (.3 + local * .35), 0, TAU); ctx.stroke();
          for (let i = 0; i < 8; i++) {
            const a = i * TAU / 8;
            ctx.beginPath(); ctx.moveTo(Math.cos(a) * radius * .35, Math.sin(a) * radius * .35); ctx.lineTo(Math.cos(a) * radius * (.7 + local * .2), Math.sin(a) * radius * (.7 + local * .2)); ctx.stroke();
          }
          ctx.rotate(-(this.elapsed * 1.6 + stagger * 9));
          // descending meteor and tail
          const meteorY = -260 + fall * 260;
          ctx.globalAlpha = Math.min(1, local * 3) * (1 - burst);
          const grad = ctx.createLinearGradient(0, meteorY - 130, 0, meteorY + 15);
          grad.addColorStop(0, 'rgba(255,68,24,0)'); grad.addColorStop(.55, 'rgba(255,92,28,.7)'); grad.addColorStop(1, '#fff0a4');
          ctx.strokeStyle = grad; ctx.lineWidth = 28 + fall * 18;
          ctx.beginPath(); ctx.moveTo(-70, meteorY - 160); ctx.lineTo(0, meteorY); ctx.stroke();
          ctx.fillStyle = '#fff5bc'; ctx.beginPath(); ctx.arc(0, meteorY, 15 + fall * 16, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ff6428'; ctx.beginPath(); ctx.arc(0, meteorY, 9 + fall * 11, 0, TAU); ctx.fill();
          // impact blossom
          if (burst > 0) {
            ctx.globalAlpha = (1 - burst) * .8 + .18;
            const rg = ctx.createRadialGradient(0, 0, 8, 0, 0, radius * (1 + burst * .75));
            rg.addColorStop(0, '#fff8c8'); rg.addColorStop(.25, '#ffbe52'); rg.addColorStop(.65, 'rgba(255,73,25,.62)'); rg.addColorStop(1, 'rgba(255,42,10,0)');
            ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, radius * (1 + burst * .75), 0, TAU); ctx.fill();
            ctx.strokeStyle = '#ffe596'; ctx.lineWidth = 8 * (1 - burst) + 2;
            ctx.beginPath(); ctx.arc(0, 0, radius * (.25 + burst * 1.15), 0, TAU); ctx.stroke();
            for (let i = 0; i < 12; i++) {
              const a = i * TAU / 12 + stagger * 4;
              ctx.fillStyle = i % 2 ? '#ff6a28' : '#ffd162';
              ctx.beginPath(); ctx.moveTo(Math.cos(a) * radius * .25, Math.sin(a) * radius * .25); ctx.lineTo(Math.cos(a - .06) * radius * (1.1 + burst), Math.sin(a - .06) * radius * (1.1 + burst)); ctx.lineTo(Math.cos(a + .06) * radius * (1.1 + burst), Math.sin(a + .06) * radius * (1.1 + burst)); ctx.closePath(); ctx.fill();
            }
          }
          ctx.restore();
        } else if (e.type === 'orochiBreath') {
          const progress = 1 - t;
          const dx = e.x2 - e.x, dy = e.y2 - e.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len;
          const angle = Math.atan2(dy, dx);
          const charge = clamp(progress / .24, 0, 1);
          const fire = clamp((progress - .2) / .3, 0, 1);
          const fade = progress > .82 ? 1 - clamp((progress - .82) / .18, 0, 1) : 1;
          const reach = fire * len;
          ctx.save();
          ctx.translate(e.x, e.y); ctx.rotate(angle);
          ctx.globalCompositeOperation = 'lighter';
          // charging orb and rotating rings at mouth
          ctx.globalAlpha = (1 - fire * .55) * t + .2;
          for (let i = 0; i < 3; i++) {
            ctx.strokeStyle = i === 2 ? '#fff4bd' : i === 1 ? '#ffb74d' : '#ff5725';
            ctx.lineWidth = 5 - i;
            ctx.beginPath(); ctx.arc(94, 0, 18 + charge * (16 + i * 9), this.elapsed * (i + 1), this.elapsed * (i + 1) + Math.PI * 1.55); ctx.stroke();
          }
          ctx.fillStyle = '#fff8c9'; ctx.beginPath(); ctx.arc(94, 0, 8 + charge * 16, 0, TAU); ctx.fill();
          // turbulent layered flame cone
          if (fire > 0) {
            ctx.globalAlpha = fade * .86;
            const cone = ctx.createLinearGradient(92, 0, 92 + reach, 0);
            cone.addColorStop(0, '#fff7bc'); cone.addColorStop(.16, '#ffd15a'); cone.addColorStop(.5, '#ff742c'); cone.addColorStop(1, 'rgba(226,34,13,0)');
            ctx.fillStyle = cone;
            ctx.beginPath();
            ctx.moveTo(90, 0);
            for (let i = 0; i <= 12; i++) {
              const q = i / 12, x = 92 + reach * q;
              const spread = 18 + q * 58 + Math.sin(this.elapsed * 19 + i * 1.7) * 8;
              ctx.lineTo(x, -spread);
            }
            for (let i = 12; i >= 0; i--) {
              const q = i / 12, x = 92 + reach * q;
              const spread = 18 + q * 58 + Math.cos(this.elapsed * 17 + i * 1.9) * 8;
              ctx.lineTo(x, spread);
            }
            ctx.closePath(); ctx.fill();
            // white-hot core
            ctx.strokeStyle = '#fff9d3'; ctx.lineWidth = 18 + fire * 8;
            ctx.beginPath(); ctx.moveTo(96, 0); ctx.lineTo(92 + reach * .88, Math.sin(this.elapsed * 13) * 5); ctx.stroke();
            ctx.strokeStyle = '#ffb83d'; ctx.lineWidth = 7;
            ctx.beginPath(); ctx.moveTo(104, 0); ctx.lineTo(92 + reach, 0); ctx.stroke();
            // rotating shock rings along beam
            for (let i = 1; i <= 5; i++) {
              const q = ((i / 5) + progress * 1.8) % 1;
              const x = 100 + reach * q;
              const r = 16 + q * 48;
              ctx.strokeStyle = i % 2 ? '#ff8a32' : '#ffd362'; ctx.lineWidth = 4;
              ctx.beginPath(); ctx.ellipse(x, 0, 5, r, 0, 0, TAU); ctx.stroke();
            }
            // embers
            for (let i = 0; i < 18; i++) {
              const q = ((i * .073 + progress * 1.7) % 1);
              const x = 104 + reach * q;
              const y = Math.sin(i * 5.1 + this.elapsed * 15) * (14 + q * 54);
              ctx.fillStyle = i % 3 ? '#ff842f' : '#fff09d';
              ctx.fillRect(x, y, 5 + i % 3 * 2, 5 + i % 3 * 2);
            }
          }
          ctx.restore();
        } else if (e.type === 'orochiAura') {
          const progress = 1 - t;
          const radius = e.radius || 220;
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = t * .82;
          // runic fire circle
          ctx.rotate(progress * 2.2);
          for (let ring = 0; ring < 3; ring++) {
            ctx.strokeStyle = ring === 2 ? '#fff0a4' : ring === 1 ? '#ff9d3d' : '#ff4d23';
            ctx.lineWidth = 9 - ring * 2;
            ctx.setLineDash([20 + ring * 5, 12]);
            ctx.beginPath(); ctx.arc(0, 0, 56 + progress * radius + ring * 26, 0, TAU); ctx.stroke();
          }
          ctx.setLineDash([]);
          ctx.rotate(-progress * 4.6);
          // upward flame pillars
          for (let i = 0; i < 14; i++) {
            const a = i * TAU / 14;
            const r = 72 + progress * 115;
            const x = Math.cos(a) * r, y = Math.sin(a) * r;
            const h = 34 + (Math.sin(this.elapsed * 10 + i * 1.7) * .5 + .5) * 70 + progress * 48;
            const grad = ctx.createLinearGradient(x, y, x, y - h);
            grad.addColorStop(0, '#ff4c22'); grad.addColorStop(.55, '#ff9b39'); grad.addColorStop(1, 'rgba(255,244,157,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.quadraticCurveTo(x - 20, y - h * .48, x, y - h); ctx.quadraticCurveTo(x + 20, y - h * .48, x + 11, y); ctx.closePath(); ctx.fill();
          }
          // central dragon-energy pulse
          const rg = ctx.createRadialGradient(0, 0, 5, 0, 0, 90 + progress * 75);
          rg.addColorStop(0, 'rgba(255,251,205,.9)'); rg.addColorStop(.35, 'rgba(255,138,49,.62)'); rg.addColorStop(1, 'rgba(255,54,21,0)');
          ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, 90 + progress * 75, 0, TAU); ctx.fill();
          ctx.restore();
        } else if (e.type === 'orochiUltimate') {
          const progress = 1 - t;
          const radius = e.radius || 420;
          const charge = clamp(progress / .36, 0, 1);
          const eruption = clamp((progress - .3) / .42, 0, 1);
          const fade = progress > .84 ? 1 - clamp((progress - .84) / .16, 0, 1) : 1;
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.globalCompositeOperation = 'lighter';
          // black-red eclipse core
          ctx.globalAlpha = fade * .88;
          const core = ctx.createRadialGradient(0, 0, 8, 0, 0, 78 + charge * 54);
          core.addColorStop(0, '#fff6bd'); core.addColorStop(.18, '#ff8d36'); core.addColorStop(.55, '#8e1b16'); core.addColorStop(.83, '#1c0708'); core.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, 78 + charge * 54, 0, TAU); ctx.fill();
          // rotating ritual rings and serpent motifs
          for (let ring = 0; ring < 4; ring++) {
            ctx.save(); ctx.rotate((ring % 2 ? -1 : 1) * progress * (1.7 + ring * .45));
            const rr = radius * (.22 + ring * .13) * (.45 + charge * .55);
            ctx.strokeStyle = ring % 2 ? '#ffd369' : '#ff4b25'; ctx.lineWidth = 10 - ring * 1.5;
            ctx.setLineDash([24 + ring * 7, 14 + ring * 3]);
            ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
            ctx.setLineDash([]);
            for (let i = 0; i < 6 + ring * 2; i++) {
              const a = i * TAU / (6 + ring * 2);
              ctx.fillStyle = ring % 2 ? '#fff0a2' : '#ff7130';
              ctx.beginPath(); ctx.moveTo(Math.cos(a) * (rr - 10), Math.sin(a) * (rr - 10)); ctx.lineTo(Math.cos(a - .05) * (rr + 28), Math.sin(a - .05) * (rr + 28)); ctx.lineTo(Math.cos(a + .05) * (rr + 28), Math.sin(a + .05) * (rr + 28)); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
          }
          // massive expanding fire wave
          if (eruption > 0) {
            const waveR = radius * (.18 + eruption * .96);
            ctx.globalAlpha = fade * (.9 - eruption * .25);
            ctx.strokeStyle = '#fff2a8'; ctx.lineWidth = 18 * (1 - eruption) + 4;
            ctx.beginPath(); ctx.arc(0, 0, waveR, 0, TAU); ctx.stroke();
            ctx.strokeStyle = '#ff5a26'; ctx.lineWidth = 42 * (1 - eruption) + 10;
            ctx.beginPath(); ctx.arc(0, 0, waveR * .94, 0, TAU); ctx.stroke();
            // radial dragon-fire eruptions
            for (let i = 0; i < 24; i++) {
              const a = i * TAU / 24 + progress * .7;
              const inner = radius * .18;
              const outer = radius * (.4 + eruption * .78);
              const wobble = Math.sin(this.elapsed * 11 + i) * 24;
              ctx.fillStyle = i % 3 ? '#ff6d2b' : '#ffd15f';
              ctx.beginPath();
              ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
              ctx.lineTo(Math.cos(a - .045) * (outer + wobble), Math.sin(a - .045) * (outer + wobble));
              ctx.lineTo(Math.cos(a + .045) * (outer + wobble), Math.sin(a + .045) * (outer + wobble));
              ctx.closePath(); ctx.fill();
            }
          }
          // embers orbiting outward
          for (let i = 0; i < 34; i++) {
            const q = ((i * .047 + progress * 1.15) % 1);
            const a = i * 2.399 + progress * 5.2;
            const rr = 48 + q * radius * 1.08;
            ctx.globalAlpha = fade * (1 - q) * .9;
            ctx.fillStyle = i % 4 ? '#ff7c31' : '#fff0a0';
            ctx.fillRect(Math.cos(a) * rr, Math.sin(a) * rr, 4 + i % 3 * 2, 4 + i % 3 * 2);
          }
          ctx.restore();
        } else if(e.type==='shrineBlessing'){
          ctx.globalAlpha=t;ctx.strokeStyle=e.color||'#dffcff';ctx.lineWidth=4;ctx.setLineDash([8,6]);ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x2,e.y2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=e.color||'#dffcff';ctx.beginPath();ctx.arc(e.x2,e.y2,18+(1-t)*35,0,TAU);ctx.fill();
        } else if(e.type==='supportSummon'){
          const progress=1-t;ctx.globalAlpha=t;ctx.strokeStyle=e.color||'#55eaff';ctx.lineWidth=4;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(e.x,e.y,22+progress*(48+i*22),0,TAU);ctx.stroke();}ctx.fillStyle='#eaffff';for(let i=0;i<8;i++){const a=i/8*TAU+progress*2;ctx.fillRect(e.x+Math.cos(a)*(28+progress*70)-3,e.y+Math.sin(a)*(28+progress*70)-3,6,6);}
        } else if(e.type==='sogetsuConnector'){
          const progress=1-t;ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle||0);ctx.globalAlpha=t;ctx.strokeStyle='#ffd36a';ctx.lineWidth=8;ctx.beginPath();ctx.arc(0,0,45+progress*90,-1.1,1.1);ctx.stroke();ctx.strokeStyle='#dffcff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,60+progress*110,-.9,.9);ctx.stroke();ctx.restore();
        } else if(e.type==='fullArmsVolley'){
          const progress=1-t;ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle||0);ctx.globalAlpha=t*.85;for(let i=-4;i<=4;i++){ctx.strokeStyle=i%2?'#7dffb8':'#72e8ff';ctx.lineWidth=e.ultimate?5:3;ctx.beginPath();ctx.moveTo(20,i*8);ctx.lineTo(90+progress*(e.ultimate?320:160),i*18);ctx.stroke();}if(e.ultimate){ctx.strokeStyle='#ffb15e';ctx.lineWidth=8;ctx.beginPath();ctx.arc(0,0,55+progress*160,-.8,.8);ctx.stroke();}ctx.restore();
        } else if(e.type==='geistActivate'){
          const progress=1-t;ctx.globalAlpha=t*.9;ctx.strokeStyle='#ff7bce';ctx.lineWidth=6;for(let i=0;i<5;i++){const a=i/5*TAU+progress*3;ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*20,e.y+Math.sin(a)*20);ctx.lineTo(e.x+Math.cos(a)*(80+progress*80),e.y+Math.sin(a)*(80+progress*80));ctx.stroke();}ctx.strokeStyle='#dffcff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,25+progress*95,0,TAU);ctx.stroke();
        } else if(e.type==='geistLeak'){
          const progress=1-t;ctx.globalAlpha=t*.7;ctx.fillStyle='#ff7bce';ctx.beginPath();ctx.arc(e.x,e.y-progress*30,4+progress*7,0,TAU);ctx.fill();ctx.strokeStyle='#8feaff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.sin(progress*8)*10,e.y-progress*40);ctx.stroke();
        } else if (e.type === 'explosion' || e.type === 'gasBurst' || e.type === 'sakeBurst') {
          const progress = 1 - t;
          ctx.globalAlpha = t * (e.type === 'gasBurst' ? .84 : e.type === 'sakeBurst' ? .9 : .72);
          ctx.fillStyle = e.type === 'gasBurst' ? '#d7ef7b' : e.type === 'sakeBurst' ? '#ffb33f' : '#ff9e53';
          ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * (.2 + progress * .8), 0, TAU); ctx.fill();
          ctx.strokeStyle = e.type === 'gasBurst' ? '#fff8be' : e.type === 'sakeBurst' ? '#fff1a8' : '#fff1b7'; ctx.lineWidth = e.type === 'gasBurst' ? 9 : e.type === 'sakeBurst' ? 7 : 5; ctx.stroke();
        } else if (e.type === 'shieldBreak') {
          const t=1-e.ttl/e.maxTtl;ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle||0);ctx.strokeStyle=e.color||'#9eeeff';ctx.lineWidth=3;ctx.globalAlpha=1-t;for(let i=0;i<9;i++){const a=(i/9-.5)*2.4;ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(24+Math.cos(a)*18,Math.sin(a)*34);ctx.stroke();}ctx.restore();ctx.globalAlpha=1;
        } else if (e.type === 'shieldHit') {
          ctx.globalAlpha = t;
          ctx.strokeStyle = '#b6f7ff'; ctx.lineWidth = 7;
          ctx.beginPath(); ctx.arc(e.x, e.y, 35, e.angle - .55, e.angle + .55); ctx.stroke();
        } else if (e.type === 'justCut') {
          ctx.globalAlpha = t;
          ctx.strokeStyle = e.color || '#e7fbff'; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.radius || 48, e.angle - .78, e.angle + .78); ctx.stroke();
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(e.x, e.y, (e.radius || 48) + (1 - t) * 30, e.angle - .65, e.angle + .65); ctx.stroke();
        } else if (e.type === 'hit') {
          ctx.globalAlpha = t;
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
          for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + e.ttl * 8;
            ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8); ctx.lineTo(e.x + Math.cos(a) * 24, e.y + Math.sin(a) * 24); ctx.stroke();
          }
        } else if (e.type === 'critical') {
          ctx.globalAlpha = t;
          ctx.strokeStyle = '#ffe36d'; ctx.fillStyle = '#fff8c9'; ctx.lineWidth = 4;
          for (let i = 0; i < 8; i++) {
            const a = i * TAU / 8 + (1 - t) * .4;
            const inner = 12 + (1 - t) * 8, outer = 34 + (1 - t) * 22;
            ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * inner, e.y + Math.sin(a) * inner); ctx.lineTo(e.x + Math.cos(a) * outer, e.y + Math.sin(a) * outer); ctx.stroke();
          }
          ctx.beginPath(); ctx.arc(e.x, e.y, 7 + (1 - t) * 5, 0, TAU); ctx.fill();
        } else if (e.type === 'coreHit') {
          ctx.globalAlpha = t;
          ctx.strokeStyle = '#ff566f'; ctx.fillStyle = '#fff0f3'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(e.x, e.y, 12 + (1 - t) * 28, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(e.x - 24, e.y); ctx.lineTo(e.x + 24, e.y); ctx.moveTo(e.x, e.y - 24); ctx.lineTo(e.x, e.y + 24); ctx.stroke();
          ctx.beginPath(); ctx.arc(e.x, e.y, 5, 0, TAU); ctx.fill();
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
        } else if (e.type === 'healSpark') {
          ctx.globalAlpha = t; ctx.fillStyle = e.color || '#8fffd4';
          ctx.beginPath(); ctx.arc(e.x, e.y - (1 - t) * 16, 3 + t * 2, 0, TAU); ctx.fill();
          ctx.strokeStyle = e.color || '#8fffd4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.x - 7, e.y - (1 - t) * 16); ctx.lineTo(e.x + 7, e.y - (1 - t) * 16); ctx.moveTo(e.x, e.y - 7 - (1 - t) * 16); ctx.lineTo(e.x, e.y + 7 - (1 - t) * 16); ctx.stroke();
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

    drawScopeOverlay(ctx) {
      if (!this.scopeActive || !this.isPlayerCombatant || this.spectating || !this.human || this.human.dead) return;
      const trigger = this.getScopeTrigger(this.human);
      if (!trigger) return;
      const profile = this.getTriggerRangeProfile(trigger);
      const info = this.getScopeTargetInfo(this.human, trigger);
      this.scopeTarget = info?.target?.id || null;
      const distance = info?.distance ?? this.scopeDistance;
      const optimal = distance >= profile.min && distance <= profile.max;
      const color = optimal ? '#84ff95' : '#ffad62';
      const reticle = info?.reticle || this.getScopeReticlePoint(this.human);
      const screen = this.worldToScreen(reticle.x, reticle.y);
      const rx = clamp(screen.x, 42, this.viewW - 42);
      const ry = clamp(screen.y, 42, this.viewH - 42);
      const radius = Math.min(this.viewW, this.viewH) * (trigger.kind === 'sniper' ? .31 : .25);
      const playerScreen = this.worldToScreen(this.human.x, this.human.y);
      ctx.save();
      ctx.fillStyle = 'rgba(0,5,10,.2)';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.strokeStyle = 'rgba(116,234,255,.24)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(clamp(playerScreen.x, 0, this.viewW), clamp(playerScreen.y, 0, this.viewH));
      ctx.lineTo(rx, ry);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(220,250,255,.2)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rx, ry, radius, 0, TAU); ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = optimal ? 3 : 2;
      ctx.beginPath(); ctx.arc(rx, ry, 25, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx - 58, ry); ctx.lineTo(rx - 10, ry); ctx.moveTo(rx + 10, ry); ctx.lineTo(rx + 58, ry); ctx.moveTo(rx, ry - 58); ctx.lineTo(rx, ry - 10); ctx.moveTo(rx, ry + 10); ctx.lineTo(rx, ry + 58); ctx.stroke();
      ctx.fillStyle = color; ctx.fillRect(rx - 2, ry - 2, 4, 4);
      ctx.textAlign = 'center';
      ctx.font = '900 12px Inter, sans-serif';
      ctx.fillStyle = color;
      ctx.fillText(optimal ? 'OPTIMAL RANGE' : distance < profile.min ? 'TOO CLOSE / 50% DAMAGE' : 'TOO FAR / 50% DAMAGE', rx, clamp(ry - radius - 13, 82, this.viewH - 58));
      ctx.font = '800 10px Inter, sans-serif';
      ctx.fillStyle = 'rgba(226,250,255,.82)';
      const targetText = info?.target ? `　TARGET ${info.target.name}` : '';
      ctx.fillText(`${trigger.short || trigger.name}　DIST ${Math.round(distance)}　適正 ${profile.min}–${profile.max}${targetText}`, rx, Math.min(this.viewH - 18, ry + radius + 21));
      ctx.fillText('左右：方向　上下／ホイール：近・遠', rx, Math.min(this.viewH - 6, ry + radius + 36));
      ctx.restore();
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
      ctx.fillStyle = this.mapId === 'desert' ? '#a88445' : this.mapId === 'snowShrine' ? '#d7e5eb' : this.mapId === 'underground' ? '#1a252b' : '#06131d'; ctx.fillRect(0, 0, w, h);
      const sx = w / this.world.w;
      const sy = h / this.world.h;
      ctx.fillStyle=this.mapId === 'desert'?'rgba(120,83,43,.45)':this.mapId==='snowShrine'?'rgba(135,91,65,.42)':this.mapId==='underground'?'rgba(119,135,144,.32)':'rgba(75,95,105,.3)'; for(const r of this.terrain.roads) ctx.fillRect(r.x*sx,r.y*sy,r.w*sx,r.h*sy);
      const river=this.terrain.rivers[0];
      if(river){ctx.strokeStyle='rgba(42,127,157,.55)';ctx.lineWidth=Math.max(2,river.width*sy);ctx.beginPath();for(let x=0;x<=this.world.w;x+=90){const y=this.riverCenterAt(x);if(x===0)ctx.moveTo(x*sx,y*sy);else ctx.lineTo(x*sx,y*sy)}ctx.stroke();}
      if(this.mapId==='desert'){
        ctx.fillStyle='rgba(58,145,157,.75)';for(const oasis of this.terrain.oases){ctx.beginPath();ctx.arc(oasis.x*sx,oasis.y*sy,Math.max(2,oasis.radius*sx),0,TAU);ctx.fill();}
        ctx.fillStyle='rgba(83,53,28,.55)';for(const cliff of this.terrain.cliffs)ctx.fillRect(cliff.x*sx,cliff.y*sy,Math.max(2,cliff.w*sx),Math.max(2,cliff.h*sy));
        ctx.strokeStyle='rgba(69,91,46,.8)';for(const gas of this.terrain.gasFields){if(!gas.active)continue;ctx.beginPath();ctx.arc(gas.x*sx,gas.y*sy,Math.max(2,gas.radius*sx),0,TAU);ctx.stroke();}
      }
      if(this.mapId==='snowShrine'){
        ctx.fillStyle='rgba(245,252,255,.75)';for(const garden of this.terrain.shrineGardens)ctx.fillRect(garden.x*sx,garden.y*sy,garden.w*sx,garden.h*sy);
        ctx.fillStyle='rgba(130,87,57,.55)';for(const room of this.terrain.shrineRooms)ctx.fillRect(room.x*sx,room.y*sy,room.w*sx,room.h*sy);
        ctx.fillStyle='rgba(96,171,202,.7)';for(const pond of this.terrain.frozenPonds)ctx.fillRect(pond.x*sx,pond.y*sy,pond.w*sx,pond.h*sy);
      }
      if(this.mapId==='underground'){
        ctx.fillStyle='rgba(90,101,110,.75)'; for(const zone of this.terrain.subwayPassengerZones||[]) ctx.fillRect(zone.x*sx,zone.y*sy,zone.w*sx,zone.h*sy);
        ctx.fillStyle='rgba(19,30,34,.85)'; for(const track of this.terrain.subwayTracks||[]) ctx.fillRect(track.x*sx,track.y*sy,track.w*sx,track.h*sy);
        { const waterLevel=this.subwayWaterLevel(); if(waterLevel>.005){ ctx.fillStyle=`rgba(68,132,160,${.65*waterLevel})`; for(const water of this.terrain.subwayWaterways||[]){ if(water.w>=water.h){ const hh=water.h*waterLevel; ctx.fillRect(water.x*sx,(water.y+(water.h-hh)/2)*sy,water.w*sx,hh*sy); } else { const ww=water.w*waterLevel; ctx.fillRect((water.x+(water.w-ww)/2)*sx,water.y*sy,ww*sx,water.h*sy); } } } }
      }
      ctx.strokeStyle = 'rgba(101,232,255,.18)'; ctx.strokeRect(.5, .5, w - 1, h - 1);
      for (const wall of this.walls) {
        if(wall.hp<=0) continue;
        if (!['buildingWall','bridge','barricade','shoji','templeWall','shrineStone','maintenanceWall','platformDoor','platformEdge','ticketGate'].includes(wall.type)) continue;
        ctx.fillStyle = wall.type==='bridge'?'rgba(180,160,105,.5)':wall.type==='shoji'?'rgba(235,225,201,.72)':wall.type==='templeWall'?'rgba(118,42,49,.58)':wall.type==='platformDoor'?'rgba(181,215,227,.8)':wall.type==='platformEdge'?'rgba(227,205,84,.7)':wall.type==='ticketGate'?'rgba(74,116,136,.75)':'rgba(85,145,165,.3)';
        ctx.fillRect(wall.x * sx, wall.y * sy, Math.max(1,wall.w * sx), Math.max(1,wall.h * sy));
      }
      for(const facility of this.installations){if(facility.hp<=0)continue;ctx.fillStyle=facility.active?(facility.team===0?'#55eaff':'#ff8871'):'#9daeb4';ctx.fillRect(facility.x*sx-1.5,facility.y*sy-1.5,3,3);}
      for (const beacon of this.beacons) {
        if(beacon.hp<=0||beacon.active===false) continue;
        const sameTeam = (this.config.mode === 'team' || this.isDefenseMode) && beacon.team === observer.team;
        ctx.fillStyle = beacon.shrineSpirit ? '#ff8871' : sameTeam ? '#55eaff' : '#ff8871';
        const size=beacon.shrineSpirit?5:4;ctx.fillRect(beacon.x*sx-size/2,beacon.y*sy-size/2,size,size);
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
        ctx.fillStyle = p.isDefenseEnemy ? (p.isDefenseBoss ? '#ff3158' : '#ffb347') : p.playableDefenseType ? (isObserver ? '#ffffff' : sameTeam ? '#55eaff' : '#ff8871') : isObserver ? '#ffffff' : sameTeam ? '#55eaff' : '#ff8871';
        const rs=p.isDefenseBoss?7:(p.isDefenseEnemy||p.playableDefenseType)?5.2:isObserver?6:4.6;ctx.fillRect(p.x*sx-rs/2,p.y*sy-rs/2,rs,rs);
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
      this.ensureMasteryRuntime(p);
      const masteryRank = this.getMasteryRank(p.masteryValue);
      $('#masteryRank').textContent = masteryRank.id;
      $('#masteryRank').style.color = masteryRank.color;
      $('#masteryText').textContent = p.masteryValue.toFixed(1);
      $('#masteryBar').style.width = `${p.masteryValue}%`;
      $('#masteryBar').style.background = masteryRank.color;
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
      if (this.mapId === 'snowShrine' && p.shrineGardenLabel) statuses.push(p.shrineGardenLabel);
      if (p.operatorOrder) statuses.push(`ORDER ${p.operatorOrder.label || p.operatorOrder.type}`);
      if (this.isPlayerOperator) statuses.push(`COMMAND ${p.name}`);
      if (this.spectating) statuses.push(`VIEW ${p.name}`);
      if (this.isExtraMode && p.playableDefenseType) statuses.push(`EXTRA ${EXTRA_UNIT_DEFS[p.playableDefenseType]?.label || p.playableDefenseType}`);
      statuses.push(`MASTERY ${this.getMasteryRank(p.masteryValue).id}`);
      if (p.operatorBoostTimer > 0) statuses.push(`MOBILITY ${p.operatorBoostTimer.toFixed(1)}s`);
      if (p.toggles.bagworm || p.toggles.bagwormTag) statuses.push('RADAR OFF');
      if (p.toggles.chameleon) statuses.push('CAMOUFLAGE');
      if (p.markedTimer > 0) statuses.push(`MARK ${p.markedTimer.toFixed(1)}s`);
      if (p.leadWeights > 0) statuses.push(`WEIGHT ×${p.leadWeights}`);
      if ((p.cubedTimer || 0) > 0) statuses.push(`CUBED ${(p.cubedTimer || 0).toFixed(1)}s`);
      if ((p.defensePoisonTimer || 0) > 0) statuses.push(`GAS ${(p.defensePoisonTimer || 0).toFixed(1)}s`);
      for (const {hand,state} of this.getActiveShieldEntries(p)) statuses.push(`${state.type==='raygust'?'RAYGUST':state.type==='seal'?`SEAL×${state.boost}`:'SHIELD'} ${Math.ceil(state.current)}/${state.max}`);
      if (this.isDefenseMode && this.defenseFlag && Math.hypot(p.x - this.defenseFlag.x, p.y - this.defenseFlag.y) < 130) statuses.push('F：TRION → FLAG');
      if (p.pendingComposite) statuses.push(`COMBINE ${Math.ceil((1 - p.pendingComposite.timer / p.pendingComposite.total) * 100)}%`);
      for (const hand of ['main', 'sub']) {
        const charge = p.shooterCharges?.[hand];
        if (charge) statuses.push(charge.ready ? `TRION CUBE ${hand.toUpperCase()} ×${charge.division}` : `TRION CUBE ${hand.toUpperCase()} ${Math.round((1 - charge.timer / Math.max(.001, charge.max)) * 100)}%`);
      }
      if (p.reloadVisual) statuses.push(`RELOAD ${String(p.reloadVisual.hand).toUpperCase()} ${Math.max(0,p.reloadVisual.timer).toFixed(1)}s`);
      for (const hand of ['main', 'sub']) if (p.modifierReady[hand]) statuses.push(`${p.modifierReady[hand].type === 'lead' ? 'LEAD' : 'STAR'}→${hand.toUpperCase()}`);
      $('#statusList').innerHTML = statuses.map((status) => `<span class="status-chip">${status}</span>`).join('');
    }

    updateSlotHud(p = this.getHudSubject()) {
      if (!p) return;
      for (const hand of ['main', 'sub']) {
        $$(`#${hand}HudSlots .hud-slot`).forEach((slot, index) => {
          slot.classList.toggle('active', p.selected[hand] === index);
          const id = p.playableDefenseType ? `extra:${hand}:${index}` : p.loadout[hand][index];
          slot.classList.toggle('disabled', !p.playableDefenseType && id === 'empty');
          const key = `${hand}:${index}`;
          const remaining = p.cooldowns[key] || 0;
          const max = p.cooldownMax[key] || 1;
          slot.querySelector('.cooldown i').style.width = `${clamp(remaining / max, 0, 1) * 100}%`;
          const ammo = slot.querySelector('.ammo');
          const trigger = p.playableDefenseType ? null : DATA.triggers[id];
          if (ammo) {
            if (trigger?.kind === 'gun') {
              const state = this.getGunState(p, hand, trigger, index);
              ammo.textContent = state.reloadTimer > 0 ? `RELOAD ${state.reloadTimer.toFixed(1)}` : `${state.ammo}/${state.capacity}`;
              ammo.classList.toggle('warning', state.ammo <= Math.max(2, state.capacity * .18));
            } else if (trigger?.kind === 'shooter' && p.shooterCharges?.[hand]?.slot === index) {
              const charge = p.shooterCharges[hand];
              ammo.textContent = charge.ready ? `READY ×${charge.division}` : `CUBE ${Math.round((1 - charge.timer / Math.max(.001, charge.max)) * 100)}%`;
              ammo.classList.remove('warning');
            } else ammo.textContent = '';
          }
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


  function createSimulationRandom(seedText = 'trion-arena') {
    let hash = 2166136261 >>> 0;
    for (const char of String(seedText)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    let state = hash >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function buildSimulationOutcome(simulation, reason) {
    if (simulation.isDefenseMode) {
      const defenseSuccess = reason === 'defense_success';
      const defenseFailed = reason === 'flag_destroyed';
      return { defenseSuccess, draw: !defenseSuccess && !defenseFailed, winnerTeam: defenseSuccess ? 0 : defenseFailed ? 1 : null, winnerSlot: defenseSuccess ? 0 : null };
    }
    if (simulation.config.mode === 'team') {
      const best = Math.max(...simulation.teamScores);
      const winners = simulation.teamScores.map((score, team) => ({score, team})).filter((entry) => Math.abs(entry.score - best) < .001);
      return { draw: winners.length !== 1, winnerTeam: winners.length === 1 ? winners[0].team : null, winnerSlot: null };
    }
    const ranked = simulation.players.map((player, slot) => ({slot, score:player.score, kills:player.kills})).sort((a,b) => b.score-a.score || b.kills-a.kills);
    const draw = ranked.length > 1 && Math.abs(ranked[0].score-ranked[1].score) < .001 && ranked[0].kills === ranked[1].kills;
    return { draw, winnerTeam: draw ? null : simulation.players[ranked[0].slot]?.team ?? null, winnerSlot: draw ? null : ranked[0].slot };
  }

  async function runSimulationMatch(request = {}) {
    request = request && typeof request === 'object' ? request : {};
    const originalRandom = Math.random;
    const seededRandom = createSimulationRandom(request.seed || `${request.id || 'scenario'}:${request.matchIndex || 0}`);
    Math.random = seededRandom;
    let simulation = null;
    try {
      if (game) { game.destroy(); game = null; }
      const config = {
        ...request.config,
        simulationMode: true,
        soundEnabled: false,
        guideEnabled: false,
        onlineSession: null,
      };
      config.difficulty = AI_DIFFICULTIES[config.difficulty] ? config.difficulty : 'normal';
      $('#gameScreen')?.classList.remove('hidden');
      $('#titleScreen')?.classList.add('hidden');
      $('#setupScreen')?.classList.add('hidden');
      simulation = new ArenaGame(config);
      game = simulation;
      window.__TRION_GAME__ = simulation;
      simulation.running = false;
      simulation.paused = false;
      simulation.simulationMode = true;
      simulation.isPlayerCombatant = false;
      simulation.spectating = false;
      simulation.guideVisible = false;
      simulation.sfx?.destroy?.();
      simulation.sfx = { play(){}, setEnabled(){}, destroy(){} };
      simulation.toast = () => {};
      simulation.showCenterMessage = () => {};
      simulation.addKillFeed = () => {};
      simulation.updateDebugPanel = () => {};
      simulation.players.forEach((player, slot) => {
        player.human = false;
        player.simulationSlot = slot;
        const participant = request.participantLabels?.[slot];
        if (participant?.label) player.name = participant.label;
        if (participant?.archetype) player.archetype = participant.archetype;
      });
      simulation.finalizeLog = function(reason = 'simulation_end') {
        if (this.logFinalized) return this.finalLog;
        this.finalLog = this.buildLog(reason);
        this.logFinalized = true;
        return this.finalLog;
      };
      simulation.endMatch = function() {
        if (this.ended) return;
        this.ended = true;
        if (!this.isUnlimited) this.matchTime = 0;
        this.finalizeLog('time_end');
      };
      simulation.completeDefenseMatch = function() {
        if (this.ended) return;
        this.ended = true;
        this.finalizeLog('defense_success');
      };
      simulation.endDefenseMatch = function() {
        if (this.ended) return;
        this.ended = true;
        this.finalizeLog('flag_destroyed');
      };

      const tickRate = clamp(Number(request.tickRate || 25), 10, 60);
      const dt = 1 / tickRate;
      const maxSeconds = Math.max(10, Number(request.maxSeconds || 180));
      const maxTicks = Math.ceil(maxSeconds * tickRate);
      const maxRounds = Math.max(1, Number(request.maxRounds || 25));
      let ticks = 0;
      let forcedReason = null;
      while (!simulation.ended && ticks < maxTicks) {
        simulation.update(dt);
        ticks += 1;
        if (simulation.isDefenseMode && simulation.defenseRound >= maxRounds && !simulation.defenseWaveActive) {
          forcedReason = 'simulation_max_rounds';
          break;
        }
        if (ticks % 400 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (!simulation.logFinalized) {
        forcedReason ||= ticks >= maxTicks ? 'simulation_timeout' : 'simulation_complete';
        simulation.ended = true;
        simulation.finalizeLog(forcedReason);
      }
      const reason = simulation.finalLog?.reason || forcedReason || 'simulation_complete';
      const outcome = buildSimulationOutcome(simulation, reason);
      const result = {
        schemaVersion: 1,
        gameVersion: GAME_VERSION,
        scenarioId: request.id || 'scenario',
        scenarioLabel: request.label || request.id || 'scenario',
        seed: String(request.seed || ''),
        matchIndex: Number(request.matchIndex || 0),
        mode: config.mode,
        modeLabel: simulation.isExtraMode ? `エキストラ・${MODE_LABELS[config.mode] || config.mode}` : (MODE_LABELS[config.mode] || config.mode),
        map: simulation.mapId,
        mapLabel: MAP_LABELS[simulation.mapId] || simulation.mapId,
        difficulty: config.difficulty,
        durationSeconds: Number(simulation.elapsed.toFixed(3)),
        reason,
        outcome,
        teamScores: simulation.teamScores.map((value) => Number(value.toFixed(3))),
        defense: simulation.isDefenseMode ? {
          round: simulation.defenseRound,
          enemiesDefeated: simulation.defenseEnemiesDefeated,
          bossesDefeated: simulation.defenseBossesDefeated,
          flagHp: Number(simulation.defenseFlag?.hp || 0),
          flagMaxHp: Number(simulation.defenseFlag?.maxHp || 0),
        } : null,
        players: simulation.players.map((player, slot) => ({
          slot,
          id: player.id,
          name: player.name,
          team: player.team,
          archetype: player.archetype,
          extraType: player.playableDefenseType || player.defenseType || 'agent',
          score: Number(player.score.toFixed(3)),
          kills: player.kills,
          deaths: player.deaths,
          masteryValue: Number((player.masteryValue || 0).toFixed(3)),
          masteryRank: player.masteryRank || null,
          aiTier: player.aiTier || null,
          aiPersonality: player.aiPersonality ? {
            calmness: Number(player.aiPersonality.calmness.toFixed(4)),
            aggression: Number(player.aiPersonality.aggression.toFixed(4)),
          } : null,
          metrics: {
            damageDealt: Number((player.metrics?.damageDealt || 0).toFixed(3)),
            damageTaken: Number((player.metrics?.damageTaken || 0).toFixed(3)),
            blockedDamage: Number((player.metrics?.blockedDamage || 0).toFixed(3)),
            shieldBlocks: Number(player.metrics?.shieldBlocks || 0),
            justGuards: Number(player.metrics?.justGuards || 0),
            criticalHits: Number(player.metrics?.criticalHits || 0),
            criticalDamage: Number((player.metrics?.criticalDamage || 0).toFixed(3)),
            projectileHits: Number(player.metrics?.projectileHits || 0),
            meleeHits: Number(player.metrics?.meleeHits || 0),
            projectilesSpawned: Number(player.metrics?.projectilesSpawned || 0),
            attackActivations: Number(player.metrics?.attackActivations || 0),
            activationsWithHit: Number(player.metrics?.activationsWithHit || 0),
            trionSpent: Number((player.metrics?.trionSpent || 0).toFixed(3)),
            naturalHealing: Number((player.metrics?.naturalHealing || 0).toFixed(3)),
            aiTargetChanges: Number(player.metrics?.aiTargetChanges || 0),
            aiStuckEscapes: Number(player.metrics?.aiStuckEscapes || 0),
          },
        })),
      };
      simulation.destroy();
      game = null;
      window.__TRION_GAME__ = null;
      return result;
    } finally {
      Math.random = originalRandom;
      if (simulation && game === simulation) {
        simulation.destroy();
        game = null;
        window.__TRION_GAME__ = null;
      }
    }
  }

  window.TRION_SIMULATION_API = {
    version: GAME_VERSION,
    runMatch: runSimulationMatch,
  };

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
