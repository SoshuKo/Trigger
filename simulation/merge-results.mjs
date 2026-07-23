import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, projectRoot } from './common.mjs';

const args = parseArgs();
const input = path.resolve(args.input || path.join(projectRoot, 'simulation-output'));
const jsonOutput = path.resolve(args['json-output'] || path.join(projectRoot, 'simulation-results/latest.json'));
const csvOutput = path.resolve(args['csv-output'] || path.join(projectRoot, 'simulation-results/latest.csv'));
const jsOutput = path.resolve(args['js-output'] || path.join(projectRoot, 'simulation-results/latest.js'));

async function collectJsonFiles(directory) {
  const found = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await collectJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) found.push(full);
  }
  return found;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}
function ratio(numerator, denominator) { return denominator ? numerator / denominator : 0; }
function round(value, digits = 4) { return Number(Number(value || 0).toFixed(digits)); }
function quote(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }

const files = await collectJsonFiles(input);
if (!files.length) throw new Error(`部分結果がありません: ${input}`);
const partials = await Promise.all(files.map(async (file) => JSON.parse(await fs.readFile(file, 'utf8'))));
const groups = new Map();
let failedMatches = 0;
const browserErrors = new Set();
for (const partial of partials) {
  const group = groups.get(partial.scenarioId) || { id: partial.scenarioId, label: partial.scenarioLabel, results: [] };
  group.results.push(...(partial.results || []));
  groups.set(partial.scenarioId, group);
  failedMatches += (partial.failures || []).length;
  for (const error of partial.browserErrors || []) browserErrors.add(error);
}

const scenarios = [...groups.values()].map((group) => {
  const matches = group.results.length;
  const first = group.results[0] || {};
  let winnerA = 0; let winnerB = 0; let draw = 0;
  const reasonCounts = {};
  const participants = new Map();
  const teams = new Map();
  let totalCritical = 0; let totalHits = 0; let totalJust = 0; let totalBlocks = 0;
  for (const result of group.results) {
    reasonCounts[result.reason || 'unknown'] = (reasonCounts[result.reason || 'unknown'] || 0) + 1;
    if (result.outcome?.draw) draw += 1;
    else if (result.outcome?.winnerSlot === 0 || result.outcome?.winnerTeam === 0 || result.outcome?.defenseSuccess === true) winnerA += 1;
    else winnerB += 1;
    for (const player of result.players || []) {
      const slot = Number(player.slot || 0);
      const team = Number(player.team || 0);
      const row = participants.get(slot) || {
        slot, label: player.name, archetype: player.archetype, extraType: player.extraType, team,
        matches: 0, wins: 0, damage: 0, damageTaken: 0, criticalHits: 0, hitEvents: 0,
        justGuards: 0, mastery: 0, kills: 0, deaths: 0, trionSpent: 0,
      };
      row.matches += 1;
      if (result.outcome?.winnerSlot === slot || (!result.outcome?.draw && result.outcome?.winnerTeam === team)) row.wins += 1;
      row.damage += Number(player.metrics?.damageDealt || 0);
      row.damageTaken += Number(player.metrics?.damageTaken || 0);
      row.criticalHits += Number(player.metrics?.criticalHits || 0);
      row.hitEvents += Math.max(Number(player.metrics?.criticalHits || 0), Number(player.metrics?.activationsWithHit || 0), Number(player.metrics?.projectileHits || 0) + Number(player.metrics?.meleeHits || 0));
      row.justGuards += Number(player.metrics?.justGuards || 0);
      row.mastery += Number(player.masteryValue || 0);
      row.kills += Number(player.kills || 0);
      row.deaths += Number(player.deaths || 0);
      row.trionSpent += Number(player.metrics?.trionSpent || 0);
      participants.set(slot, row);

      const teamRow = teams.get(team) || { team, matches: 0, damage: 0, damageTaken: 0, kills: 0, deaths: 0 };
      teamRow.damage += Number(player.metrics?.damageDealt || 0);
      teamRow.damageTaken += Number(player.metrics?.damageTaken || 0);
      teamRow.kills += Number(player.kills || 0);
      teamRow.deaths += Number(player.deaths || 0);
      teams.set(team, teamRow);

      totalCritical += Number(player.metrics?.criticalHits || 0);
      totalHits += Math.max(Number(player.metrics?.criticalHits || 0), Number(player.metrics?.activationsWithHit || 0), Number(player.metrics?.projectileHits || 0) + Number(player.metrics?.meleeHits || 0));
      totalJust += Number(player.metrics?.justGuards || 0);
      totalBlocks += Number(player.metrics?.shieldBlocks || 0);
    }
  }
  for (const row of teams.values()) row.matches = matches;
  return {
    id: group.id,
    label: group.label,
    mode: first.mode,
    modeLabel: first.modeLabel,
    map: first.map,
    mapLabel: first.mapLabel,
    difficulty: first.difficulty,
    league: first.league || null,
    matches,
    outcomes: {
      winnerA: round(ratio(winnerA, matches)),
      winnerB: round(ratio(winnerB, matches)),
      draw: round(ratio(draw, matches)),
      counts: { winnerA, winnerB, draw },
      reasons: reasonCounts,
    },
    averageDurationSeconds: round(average(group.results.map((result) => result.durationSeconds)), 2),
    combat: {
      averageTotalDamage: round(average(group.results.map((result) => result.players?.reduce((sum, player) => sum + Number(player.metrics?.damageDealt || 0), 0) || 0)), 2),
      averageDeaths: round(average(group.results.map((result) => result.players?.reduce((sum, player) => sum + Number(player.deaths || 0), 0) || 0)), 3),
      criticalRate: round(ratio(totalCritical, totalHits)),
    },
    defense: { justGuardRate: round(ratio(totalJust, totalBlocks + totalJust)) },
    teams: [...teams.values()].sort((a, b) => a.team - b.team).map((row) => ({
      team: row.team,
      averageDamage: round(ratio(row.damage, matches), 2),
      averageDamageTaken: round(ratio(row.damageTaken, matches), 2),
      averageKills: round(ratio(row.kills, matches), 3),
      averageDeaths: round(ratio(row.deaths, matches), 3),
    })),
    participants: [...participants.values()].sort((a, b) => a.slot - b.slot).map((row) => ({
      slot: row.slot, label: row.label, archetype: row.archetype, extraType: row.extraType, team: row.team,
      winRate: round(ratio(row.wins, row.matches)),
      averageDamage: round(ratio(row.damage, row.matches), 2),
      averageDamageTaken: round(ratio(row.damageTaken, row.matches), 2),
      criticalRate: round(ratio(row.criticalHits, row.hitEvents)),
      averageJustGuards: round(ratio(row.justGuards, row.matches), 3),
      averageMastery: round(ratio(row.mastery, row.matches), 2),
      averageKills: round(ratio(row.kills, row.matches), 3),
      averageDeaths: round(ratio(row.deaths, row.matches), 3),
      averageTrionSpent: round(ratio(row.trionSpent, row.matches), 2),
    })),
  };
});

function aggregateLeagues(scenarioRows) {
  const leagueGroups = new Map();
  for (const scenario of scenarioRows) {
    const meta = scenario.league;
    if (!meta?.id) continue;
    const league = leagueGroups.get(meta.id) || {
      id: meta.id, label: meta.label || meta.id, description: meta.description || '',
      scoring: { win: 3, draw: 1, loss: 0, ...(meta.scoring || {}) },
      matchups: [], squads: new Map(), agents: new Map(), maps: new Map(),
    };
    const counts = scenario.outcomes?.counts || {};
    const homeWins = Number(counts.winnerA || 0);
    const awayWins = Number(counts.winnerB || 0);
    const draws = Number(counts.draw || 0);
    const matches = Number(scenario.matches || 0);
    const team0 = scenario.teams?.find((team) => team.team === 0) || {};
    const team1 = scenario.teams?.find((team) => team.team === 1) || {};
    const matchup = {
      scenarioId: scenario.id,
      map: scenario.map,
      mapLabel: scenario.mapLabel,
      matches,
      averageDurationSeconds: scenario.averageDurationSeconds,
      homeSquadId: meta.homeSquadId,
      homeSquadLabel: meta.homeSquadLabel,
      awaySquadId: meta.awaySquadId,
      awaySquadLabel: meta.awaySquadLabel,
      homeWins, awayWins, draws,
      homeWinRate: round(ratio(homeWins, matches)),
      awayWinRate: round(ratio(awayWins, matches)),
      drawRate: round(ratio(draws, matches)),
      homeAverageDamage: Number(team0.averageDamage || 0),
      awayAverageDamage: Number(team1.averageDamage || 0),
    };
    league.matchups.push(matchup);

    const updateSquad = (id, label, wins, losses, teamStats, opponentStats) => {
      const row = league.squads.get(id) || {
        id, label, played: 0, wins: 0, losses: 0, draws: 0, points: 0,
        durationTotal: 0, damageForTotal: 0, damageAgainstTotal: 0, killsTotal: 0, deathsTotal: 0,
      };
      row.played += matches;
      row.wins += wins;
      row.losses += losses;
      row.draws += draws;
      row.points += wins * Number(league.scoring.win || 3) + draws * Number(league.scoring.draw || 1) + losses * Number(league.scoring.loss || 0);
      row.durationTotal += Number(scenario.averageDurationSeconds || 0) * matches;
      row.damageForTotal += Number(teamStats.averageDamage || 0) * matches;
      row.damageAgainstTotal += Number(opponentStats.averageDamage || 0) * matches;
      row.killsTotal += Number(teamStats.averageKills || 0) * matches;
      row.deathsTotal += Number(teamStats.averageDeaths || 0) * matches;
      league.squads.set(id, row);
    };
    updateSquad(meta.homeSquadId, meta.homeSquadLabel, homeWins, awayWins, team0, team1);
    updateSquad(meta.awaySquadId, meta.awaySquadLabel, awayWins, homeWins, team1, team0);

    const mapRow = league.maps.get(scenario.map) || { map: scenario.map, label: scenario.mapLabel || scenario.map, matchups: 0, matches: 0, durationTotal: 0, draws: 0 };
    mapRow.matchups += 1; mapRow.matches += matches; mapRow.durationTotal += Number(scenario.averageDurationSeconds || 0) * matches; mapRow.draws += draws;
    league.maps.set(scenario.map, mapRow);

    for (const participant of scenario.participants || []) {
      const squadId = Number(participant.team || 0) === 0 ? meta.homeSquadId : meta.awaySquadId;
      const squadLabel = Number(participant.team || 0) === 0 ? meta.homeSquadLabel : meta.awaySquadLabel;
      const key = `${squadId}:${participant.label}`;
      const row = league.agents.get(key) || {
        name: participant.label, squadId, squadLabel, archetype: participant.archetype,
        matches: 0, winsWeighted: 0, damageTotal: 0, damageTakenTotal: 0, killsTotal: 0, deathsTotal: 0,
        criticalWeighted: 0, masteryTotal: 0,
      };
      row.matches += matches;
      row.winsWeighted += Number(participant.winRate || 0) * matches;
      row.damageTotal += Number(participant.averageDamage || 0) * matches;
      row.damageTakenTotal += Number(participant.averageDamageTaken || 0) * matches;
      row.killsTotal += Number(participant.averageKills || 0) * matches;
      row.deathsTotal += Number(participant.averageDeaths || 0) * matches;
      row.criticalWeighted += Number(participant.criticalRate || 0) * matches;
      row.masteryTotal += Number(participant.averageMastery || 0) * matches;
      league.agents.set(key, row);
    }
    leagueGroups.set(meta.id, league);
  }

  return [...leagueGroups.values()].map((league) => {
    const standings = [...league.squads.values()].map((row) => ({
      id: row.id,
      label: row.label,
      played: row.played,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      points: row.points,
      winRate: round(ratio(row.wins, row.played)),
      averageDurationSeconds: round(ratio(row.durationTotal, row.played), 2),
      averageDamageFor: round(ratio(row.damageForTotal, row.played), 2),
      averageDamageAgainst: round(ratio(row.damageAgainstTotal, row.played), 2),
      damageDifference: round(ratio(row.damageForTotal - row.damageAgainstTotal, row.played), 2),
      averageKills: round(ratio(row.killsTotal, row.played), 3),
      averageDeaths: round(ratio(row.deathsTotal, row.played), 3),
    })).sort((a, b) => b.points - a.points || b.winRate - a.winRate || b.damageDifference - a.damageDifference || a.label.localeCompare(b.label, 'ja'))
      .map((row, index) => ({ rank: index + 1, ...row }));

    const agents = [...league.agents.values()].map((row) => ({
      name: row.name,
      squadId: row.squadId,
      squadLabel: row.squadLabel,
      archetype: row.archetype,
      matches: row.matches,
      winRate: round(ratio(row.winsWeighted, row.matches)),
      averageDamage: round(ratio(row.damageTotal, row.matches), 2),
      averageDamageTaken: round(ratio(row.damageTakenTotal, row.matches), 2),
      averageKills: round(ratio(row.killsTotal, row.matches), 3),
      averageDeaths: round(ratio(row.deathsTotal, row.matches), 3),
      criticalRate: round(ratio(row.criticalWeighted, row.matches)),
      averageMastery: round(ratio(row.masteryTotal, row.matches), 2),
    })).sort((a, b) => b.averageDamage - a.averageDamage || b.winRate - a.winRate);

    const maps = [...league.maps.values()].map((row) => ({
      map: row.map,
      label: row.label,
      matchups: row.matchups,
      matches: row.matches,
      averageDurationSeconds: round(ratio(row.durationTotal, row.matches), 2),
      drawRate: round(ratio(row.draws, row.matches)),
    }));

    return {
      id: league.id,
      label: league.label,
      description: league.description,
      scoring: league.scoring,
      squads: standings.length,
      matchups: league.matchups.sort((a, b) => a.homeSquadLabel.localeCompare(b.homeSquadLabel, 'ja') || a.awaySquadLabel.localeCompare(b.awaySquadLabel, 'ja')),
      standings,
      agents,
      maps,
      totalMatches: league.matchups.reduce((sum, matchup) => sum + matchup.matches, 0),
    };
  });
}

const leagues = aggregateLeagues(scenarios);
const report = {
  schemaVersion: 2,
  status: 'ready',
  generatedAt: new Date().toISOString(),
  gameVersion: 102,
  totalMatches: scenarios.reduce((sum, scenario) => sum + scenario.matches, 0),
  failedMatches,
  browserErrors: [...browserErrors],
  leagues,
  scenarios,
};
report.gameVersion = Math.max(102, ...partials.flatMap((partial) => partial.results || []).map((result) => Number(result.featureVersion || result.gameVersion || 0)));

const csvHeaders = [
  'scenario_id','scenario_label','mode','map','difficulty','matches','winner_a_rate','winner_b_rate','draw_rate',
  'average_duration_seconds','critical_rate','just_guard_rate','league_id','home_squad','away_squad','failed_matches',
];
const csvRows = scenarios.map((scenario) => [
  scenario.id, scenario.label, scenario.mode, scenario.map, scenario.difficulty, scenario.matches,
  scenario.outcomes.winnerA, scenario.outcomes.winnerB, scenario.outcomes.draw,
  scenario.averageDurationSeconds, scenario.combat.criticalRate, scenario.defense.justGuardRate,
  scenario.league?.id || '', scenario.league?.homeSquadLabel || '', scenario.league?.awaySquadLabel || '', failedMatches,
].map(quote).join(','));

await fs.mkdir(path.dirname(jsonOutput), { recursive: true });
await fs.writeFile(jsonOutput, `${JSON.stringify(report, null, 2)}\n`);
await fs.writeFile(csvOutput, `\uFEFF${csvHeaders.join(',')}\n${csvRows.join('\n')}\n`);
await fs.writeFile(jsOutput, `window.TRION_SIMULATION_RESULTS = ${JSON.stringify(report, null, 2)};\n`);
const historyDir = path.join(path.dirname(jsonOutput), 'history');
await fs.mkdir(historyDir, { recursive: true });
const stamp = report.generatedAt.replace(/[:.]/g, '-');
await fs.writeFile(path.join(historyDir, `${stamp}.json`), `${JSON.stringify(report, null, 2)}\n`);
const historyFiles = (await fs.readdir(historyDir)).filter((name) => name.endsWith('.json')).sort().reverse();
for (const oldFile of historyFiles.slice(30)) await fs.rm(path.join(historyDir, oldFile), { force: true });
process.stdout.write(`Merged ${report.totalMatches} matches across ${scenarios.length} scenarios and ${leagues.length} leagues.\n`);
