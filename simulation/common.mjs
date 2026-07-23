import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const simulationDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(simulationDir, '..');

const DEFAULT_STATS = Object.freeze({ trion: 6, technique: 6, combat: 6 });
const DEFAULT_MAIN = Object.freeze(['kogetsu', 'senku', 'shield', 'shooter_hound']);
const DEFAULT_SUB = Object.freeze(['shooter_asteroid', 'bagworm', 'shield', 'grasshopper']);
const VACANT_MEMBER = Object.freeze({
  name: '__VACANT__', archetype: '万能手', stats: { trion: 6, technique: 6, combat: 6 },
  main: ['empty', 'empty', 'empty', 'empty'], sub: ['empty', 'empty', 'empty', 'empty'],
  extraType: 'agent', vacant: true,
});

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function leaguePairId(leagueId, homeId, awayId) {
  return `${leagueId}--${homeId}-vs-${awayId}`;
}

export function expandLeagueScenarios(source) {
  const expanded = [];
  for (const league of source.leagues || []) {
    if (!league?.id || !Array.isArray(league.squads) || league.squads.length < 2) {
      throw new Error('各リーグには id と2部隊以上の squads が必要です。');
    }
    const maps = Array.isArray(league.mapRotation) && league.mapRotation.length
      ? league.mapRotation
      : [league.map || source.defaults?.map || 'city'];
    let pairingIndex = 0;
    for (let homeIndex = 0; homeIndex < league.squads.length; homeIndex += 1) {
      for (let awayIndex = homeIndex + 1; awayIndex < league.squads.length; awayIndex += 1) {
        const home = league.squads[homeIndex];
        const away = league.squads[awayIndex];
        if (!home?.id || !away?.id || !Array.isArray(home.members) || !Array.isArray(away.members)) {
          throw new Error(`${league.id}: 部隊IDまたは members が不足しています。`);
        }
        const map = maps[pairingIndex % maps.length];
        expanded.push({
          id: leaguePairId(league.id, home.id, away.id),
          label: `${league.label || league.id}：${home.label || home.id} vs ${away.label || away.id}`,
          mode: 'team',
          map,
          difficulty: league.difficulty || 'strong',
          matchLength: Number(league.matchLength || source.defaults?.matchLength || 180),
          maxSeconds: Number(league.maxSeconds || 210),
          timeOfDay: league.timeOfDay || source.defaults?.timeOfDay || 'day',
          weather: league.weather || source.defaults?.weather || 'clear',
          allowUnevenTeams: league.allowUnevenTeams !== false,
          teams: [
            { id: home.id, label: home.label || home.id, members: clone(home.members) },
            { id: away.id, label: away.label || away.id, members: clone(away.members) },
          ],
          league: {
            id: league.id,
            label: league.label || league.id,
            description: league.description || '',
            pairingIndex,
            scoring: { win: 3, draw: 1, loss: 0, ...(league.scoring || {}) },
            homeSquadId: home.id,
            homeSquadLabel: home.label || home.id,
            awaySquadId: away.id,
            awaySquadLabel: away.label || away.id,
            map,
          },
        });
        pairingIndex += 1;
      }
    }
  }
  return expanded;
}

export async function loadScenarioFile(filePath = path.join(simulationDir, 'scenarios.json')) {
  const source = await readJson(filePath);
  if (!Array.isArray(source.scenarios)) throw new Error('scenarios.json に scenarios 配列がありません。');
  const leagueScenarios = expandLeagueScenarios(source);
  const scenarios = [...source.scenarios, ...leagueScenarios];
  const ids = new Set();
  for (const scenario of scenarios) {
    if (!scenario.id || typeof scenario.id !== 'string') throw new Error('各シナリオには文字列の id が必要です。');
    if (ids.has(scenario.id)) throw new Error(`シナリオIDが重複しています: ${scenario.id}`);
    ids.add(scenario.id);
  }
  return { ...source, scenarios, baseScenarioCount: source.scenarios.length, leagueScenarioCount: leagueScenarios.length };
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
  if (!participant.namedAgent && total !== 18) throw new Error(`${participant.name || fallbackName} の能力値合計は18にしてください。現在値: ${total}`);
  if (participant.namedAgent && (!Number.isFinite(total) || total < 1 || total > 40)) throw new Error(`${participant.name || fallbackName} のネームド能力値が不正です。現在値: ${total}`);
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
    namedAgent: participant.namedAgent || null,
    namedSquadId: participant.namedSquadId || null,
    squadLabel: participant.squadLabel || null,
    vacant: Boolean(participant.vacant),
  };
}

function equalizeTeams(teams, allowUnevenTeams) {
  const sizes = teams.map((team) => team.members?.length || 0);
  if (!sizes[0]) throw new Error('チームには1名以上の隊員が必要です。');
  if (!allowUnevenTeams && sizes.some((size) => size !== sizes[0])) throw new Error('全チームの人数を同じにしてください。');
  const maxSize = Math.max(...sizes);
  return teams.map((team, teamIndex) => ({
    id: team.id || `team-${teamIndex + 1}`,
    label: team.label || `TEAM ${teamIndex + 1}`,
    members: Array.from({ length: maxSize }, (_, memberIndex) => participantDefaults(
      team.members?.[memberIndex] || VACANT_MEMBER,
      `T${teamIndex + 1}-${memberIndex + 1}`,
    )),
  }));
}

function flattenScenarioParticipants(scenario) {
  if (scenario.mode === 'team') {
    if (!Array.isArray(scenario.teams) || scenario.teams.length < 2) throw new Error(`${scenario.id}: teamモードには2チーム以上が必要です。`);
    const teams = equalizeTeams(scenario.teams, Boolean(scenario.allowUnevenTeams || scenario.league));
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
    gameVersion: 104,
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
  let orderedTeamLabels = [];
  if (scenario.mode === 'team') {
    base.teamCount = participants.teams.length;
    base.teamSize = participants.teams[0].members.length;
    ordered = [
      ...participants.teams[0].members.slice(1),
      ...participants.teams.slice(1).flatMap((team) => team.members),
    ];
    orderedTeamLabels = [
      ...participants.teams[0].members.slice(1).map(() => participants.teams[0].label),
      ...participants.teams.slice(1).flatMap((team) => team.members.map(() => team.label)),
    ];
  } else if (scenario.mode === 'defense') {
    base.teamCount = 1;
    base.teamSize = participants.defenders.length;
    ordered = participants.defenders.slice(1);
    orderedTeamLabels = ordered.map(() => 'DEFENDERS');
  } else {
    ordered = participants.fighters.slice(1);
    orderedTeamLabels = ordered.map(() => 'SIM');
  }

  base.cpuConfigs = ordered.map((member, index) => ({
    id: `sim-cpu-${index}`,
    name: member.name,
    archetype: member.archetype,
    stats: member.stats,
    main: member.main,
    sub: member.sub,
    squadName: orderedTeamLabels[index] || member.squadLabel || 'SIM',
    extraType: member.extraType,
  }));
  base.cpuCount = base.cpuConfigs.length;
  base.extraEnabled = [participants.player, ...ordered].some((member) => member.extraType !== 'agent') || base.extraDefenseEnemyType !== 'agent';

  const labels = [participants.player, ...ordered];
  return {
    id: scenario.id,
    label: scenario.label || scenario.id,
    maxSeconds: Number(scenario.maxSeconds || (scenario.mode === 'defense' ? 420 : base.matchLength + 20)),
    maxRounds: Number(scenario.maxRounds || 25),
    tickRate: Number(scenario.tickRate || 25),
    config: base,
    league: scenario.league ? clone(scenario.league) : null,
    participantLabels: labels.map((member, index) => ({
      slot: index,
      label: member.name,
      archetype: member.archetype,
      extraType: member.extraType,
      namedAgent: member.namedAgent,
      namedSquadId: member.namedSquadId,
      vacant: member.vacant,
    })),
  };
}

export function findScenario(source, id) {
  const scenario = source.scenarios.find((entry) => entry.id === id);
  if (!scenario) throw new Error(`シナリオが見つかりません: ${id}`);
  return buildGameConfig(scenario, source.defaults || {});
}
