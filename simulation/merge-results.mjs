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

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}
function ratio(numerator, denominator) { return denominator ? numerator / denominator : 0; }
function round(value, digits = 4) { return Number(Number(value || 0).toFixed(digits)); }

const scenarios = [...groups.values()].map((group) => {
  const matches = group.results.length;
  const first = group.results[0] || {};
  let winnerA = 0; let winnerB = 0; let draw = 0;
  const reasonCounts = {};
  const participants = new Map();
  let totalCritical = 0; let totalHits = 0; let totalJust = 0; let totalBlocks = 0;
  for (const result of group.results) {
    reasonCounts[result.reason || 'unknown'] = (reasonCounts[result.reason || 'unknown'] || 0) + 1;
    if (result.outcome?.draw) draw += 1;
    else if (result.outcome?.winnerSlot === 0 || result.outcome?.winnerTeam === 0 || result.outcome?.defenseSuccess === true) winnerA += 1;
    else winnerB += 1;
    for (const player of result.players || []) {
      const slot = Number(player.slot || 0);
      const row = participants.get(slot) || {
        slot, label: player.name, archetype: player.archetype, extraType: player.extraType, team: player.team,
        matches: 0, wins: 0, damage: 0, damageTaken: 0, criticalHits: 0, hitEvents: 0, justGuards: 0, mastery: 0,
      };
      row.matches += 1;
      if (result.outcome?.winnerSlot === slot || (!result.outcome?.draw && result.outcome?.winnerTeam === player.team)) row.wins += 1;
      row.damage += Number(player.metrics?.damageDealt || 0);
      row.damageTaken += Number(player.metrics?.damageTaken || 0);
      row.criticalHits += Number(player.metrics?.criticalHits || 0);
      row.hitEvents += Math.max(Number(player.metrics?.criticalHits || 0), Number(player.metrics?.activationsWithHit || 0), Number(player.metrics?.projectileHits || 0) + Number(player.metrics?.meleeHits || 0));
      row.justGuards += Number(player.metrics?.justGuards || 0);
      row.mastery += Number(player.masteryValue || 0);
      participants.set(slot, row);
      totalCritical += Number(player.metrics?.criticalHits || 0);
      totalHits += Math.max(Number(player.metrics?.criticalHits || 0), Number(player.metrics?.activationsWithHit || 0), Number(player.metrics?.projectileHits || 0) + Number(player.metrics?.meleeHits || 0));
      totalJust += Number(player.metrics?.justGuards || 0);
      totalBlocks += Number(player.metrics?.shieldBlocks || 0);
    }
  }
  return {
    id: group.id,
    label: group.label,
    mode: first.mode,
    modeLabel: first.modeLabel,
    map: first.map,
    mapLabel: first.mapLabel,
    difficulty: first.difficulty,
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
    participants: [...participants.values()].sort((a, b) => a.slot - b.slot).map((row) => ({
      slot: row.slot, label: row.label, archetype: row.archetype, extraType: row.extraType, team: row.team,
      winRate: round(ratio(row.wins, row.matches)),
      averageDamage: round(ratio(row.damage, row.matches), 2),
      averageDamageTaken: round(ratio(row.damageTaken, row.matches), 2),
      criticalRate: round(ratio(row.criticalHits, row.hitEvents)),
      averageJustGuards: round(ratio(row.justGuards, row.matches), 3),
      averageMastery: round(ratio(row.mastery, row.matches), 2),
    })),
  };
});

const report = {
  schemaVersion: 1,
  status: 'ready',
  generatedAt: new Date().toISOString(),
  gameVersion: scenarios[0]?.results?.[0]?.gameVersion || 60,
  totalMatches: scenarios.reduce((sum, scenario) => sum + scenario.matches, 0),
  failedMatches,
  browserErrors: [...browserErrors],
  scenarios,
};
report.gameVersion = Math.max(60, ...partials.flatMap((partial) => partial.results || []).map((result) => Number(result.gameVersion || 0)));

const csvHeaders = ['scenario_id','scenario_label','mode','map','difficulty','matches','winner_a_rate','winner_b_rate','draw_rate','average_duration_seconds','critical_rate','just_guard_rate','failed_matches'];
const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const csvRows = scenarios.map((scenario) => [
  scenario.id, scenario.label, scenario.mode, scenario.map, scenario.difficulty, scenario.matches,
  scenario.outcomes.winnerA, scenario.outcomes.winnerB, scenario.outcomes.draw,
  scenario.averageDurationSeconds, scenario.combat.criticalRate, scenario.defense.justGuardRate, failedMatches,
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
process.stdout.write(`Merged ${report.totalMatches} matches across ${scenarios.length} scenarios.\n`);
