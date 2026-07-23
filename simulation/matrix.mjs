import { loadScenarioFile, parseArgs } from './common.mjs';

const args = parseArgs();
const source = await loadScenarioFile(args.file);
const shards = Math.max(1, Math.min(32, Number(args.shards || 4)));
const include = [];
for (const scenario of source.scenarios) {
  for (let shard = 0; shard < shards; shard += 1) include.push({ scenario: scenario.id, shard });
}
process.stdout.write(JSON.stringify({ include }));
