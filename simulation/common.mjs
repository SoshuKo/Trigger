import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const simulationDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(simulationDir, '..');

const DEFAULT_STATS = Object.freeze({ trion: 6, technique: 6, combat: 6 });
const DEFAULT_MAIN = Object.freeze(['kogetsu', 'senku', 'shield', 'shooter_hound']);
const DEFAULT_SUB = Object.freeze(['shooter_asteroid', 'bagworm', 'shield', 'grasshopper']);

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

export async function loadScenarioFile(filePath = path.join(simulationDir, 'scenarios.json')) {
  const source = await readJson(filePath);
  if (!Array.isArray(source.scenarios)) throw new Error('scenarios.json に scenarios 配列がありません。');
  const ids = new Set();
  for (const scenario of source.scenarios) {
    if (!scenario.id || typeof scenario.id !== 'string') throw new Error('各シナリオには文字列の id が必要です。');
    if (ids.has(scenario.id)) throw new Error(`シナリオIDが重複しています: ${scenario.id}`);
    ids.add(scenario.id);
  }
  return source;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else { args[key] = next; index += 1; }
  }
  return args;
}

export function participantDefaults(participant = {}, fallbackName = 'CPU') {
  const stats = { ...DEFAULT_STATS, ...(participant.stats || {}) };
  const total = Number(stats.trion) + Number(stats.technique) + Number(stats.combat);
  if (total !== 18) throw new Error(`${participant.name || fallbackName} の能力値合計は18にしてください。現在値: ${total}`);
  const main = Array.isArray(participant.main) ? participant.main.slice(0, 4) : [...DEFAULT_MAIN];
  const sub = Array.isArray(participant.sub) ? participant.sub.slice(0, 4) : [...DEFAULT_SUB];
  while (main.length < 4) main.push('empty');
  while (sub.length < 4) sub.push('empty');
  return {
    name: participant.name || fallbackName,
    archetype: participant.archetype || '万能手',
    stats,
    main,
    sub,
    extraType: participant.extraType || 'agent',
  };
}

function flattenScenarioParticipants(scenario) {
  if (scenario.mode === 'team') {
    if (!Array.isArray(scenario.teams) || scenario.teams.length < 2) throw new Error(`${scenario.id}: teamモードには2チーム以上が必要です。`);
    const sizes = scenario.teams.map((team) => team.members?.length || 0);
    if (!sizes[0] || sizes.some((size) => size !== sizes[0])) throw new Error(`${scenario.id}: 全チームの人数を同じにしてください。`);
    const teams = scenario.teams.map((team, teamIndex) => ({
      label: team.label || `TEAM ${teamIndex + 1}`,
      members: team.members.map((member, memberIndex) => participantDefaults(member, `T${teamIndex + 1}-${memberIndex + 1}`)),
    }));
    return { player: teams[0].members[0], teams };
  }
  if (scenario.mode === 'defense') {
    if (!Array.isArray(scenario.defenders) || !scenario.defenders.length) throw new Error(`${scenario.id}: defenseモードには defenders が必要です。`);
    const defenders = scenario.defenders.map((member, index) => participantDefaults(member, `DEF-${index + 1}`));
    return { player: defenders[0], defenders };
  }
  if (!Array.isArray(scenario.fighters) || scenario.fighters.length < 2) throw new Error(`${scenario.id}: soloモードには fighters が2人以上必要です。`);
  const fighters = scenario.fighters.map((member, index) => participantDefaults(member, `FIGHTER-${index + 1}`));
  return { player: fighters[0], fighters };
}

export function buildGameConfig(rawScenario, defaults = {}) {
  const scenario = { ...defaults, ...rawScenario };
  const participants = flattenScenarioParticipants(scenario);
  const base = {
    mode: scenario.mode || 'solo',
    extraEnabled: false,
    extraBaseMode: scenario.mode || 'solo',
    extraPlayerType: participants.player.extraType,
    extraDefenseEnemyType: scenario.fixedEnemy || 'agent',
    playerRole: 'combatant',
    cpuCount: 0,
    teamCount: 0,
    teamSize: 1,
    defenseScenario: scenario.defenseScenario || 'blackTrigger',
    matchLength: scenario.mode === 'defense' ? 0 : Number(scenario.matchLength || 120),
    difficulty: scenario.difficulty || 'normal',
    mapId: scenario.map || 'city',
    timeOfDay: scenario.timeOfDay || 'day',
    timeProgression: Boolean(scenario.timeProgression),
    weather: scenario.weather || 'clear',
    weatherChange: Boolean(scenario.weatherChange),
    guideEnabled: false,
    soundEnabled: false,
    beginnerSkill: 'none',
    keyBindings: {},
    gameVersion: 60,
    simulationMode: true,
    teamConfig: {
      playerName: participants.player.name,
      squadName: scenario.teams?.[0]?.label || 'SIM-A',
      bodyColor: '#4aa8ff',
      emblemPreset: 'cube',
      emblemPixels: '0'.repeat(1024),
    },
    stats: participants.player.stats,
    loadout: { main: participants.player.main, sub: participants.player.sub },
    cpuConfigs: [],
  };

  let ordered = [];
  if (scenario.mode === 'team') {
    base.teamCount = participants.teams.length;
    base.teamSize = participants.teams[0].members.length;
    ordered = [
      ...participants.teams[0].members.slice(1),
      ...participants.teams.slice(1).flatMap((team) => team.members),
    ];
  } else if (scenario.mode === 'defense') {
    base.teamCount = 1;
    base.teamSize = participants.defenders.length;
    ordered = participants.defenders.slice(1);
  } else {
    ordered = participants.fighters.slice(1);
  }

  base.cpuConfigs = ordered.map((member, index) => ({
    id: `sim-cpu-${index}`,
    name: member.name,
    archetype: member.archetype,
    stats: member.stats,
    main: member.main,
    sub: member.sub,
    squadName: 'SIM',
    extraType: member.extraType,
  }));
  base.cpuCount = base.cpuConfigs.length;
  base.extraEnabled = [participants.player, ...ordered].some((member) => member.extraType !== 'agent') || base.extraDefenseEnemyType !== 'agent';

  return {
    id: scenario.id,
    label: scenario.label || scenario.id,
    maxSeconds: Number(scenario.maxSeconds || (scenario.mode === 'defense' ? 420 : base.matchLength + 20)),
    maxRounds: Number(scenario.maxRounds || 25),
    tickRate: Number(scenario.tickRate || 25),
    config: base,
    participantLabels: [participants.player, ...ordered].map((member, index) => ({
      slot: index,
      label: member.name,
      archetype: member.archetype,
      extraType: member.extraType,
    })),
  };
}

export function findScenario(source, id) {
  const scenario = source.scenarios.find((entry) => entry.id === id);
  if (!scenario) throw new Error(`シナリオが見つかりません: ${id}`);
  return buildGameConfig(scenario, source.defaults || {});
}
