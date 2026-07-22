import { loadScenarioFile, parseArgs } from './common.mjs';

const args = parseArgs();
const source = await loadScenarioFile(args.file);
const requestedShards = Math.max(1, Math.min(16, Number(args.shards || 4)));
const matrixLimit = 256;
const leagueScenarios = source.scenarios.filter((scenario) => Boolean(scenario.league));
const regularScenarios = source.scenarios.filter((scenario) => !scenario.league);
const availableForRegular = Math.max(regularScenarios.length, matrixLimit - leagueScenarios.length);
const maxRegularShards = regularScenarios.length
  ? Math.max(1, Math.floor(availableForRegular / regularScenarios.length))
  : 1;
const regularShardCount = Math.min(requestedShards, maxRegularShards);
const include = [];

for (const scenario of regularScenarios) {
  for (let shard = 0; shard < regularShardCount; shard += 1) {
    include.push({ scenario: scenario.id, shard, shardCount: regularShardCount, category: 'standard' });
  }
}
for (const scenario of leagueScenarios) {
  include.push({ scenario: scenario.id, shard: 0, shardCount: 1, category: 'league' });
}
if (include.length > matrixLimit) {
  throw new Error(`GitHub Actions のマトリクス上限を超えました: ${include.length}/${matrixLimit}`);
}
process.stdout.write(JSON.stringify({
  include,
  meta: {
    requestedShards,
    regularShardCount,
    regularScenarios: regularScenarios.length,
    leagueScenarios: leagueScenarios.length,
    jobs: include.length,
  },
}));
