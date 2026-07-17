import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadScenarioFile, parseArgs, projectRoot } from './common.mjs';

const args = parseArgs();
const matches = Math.max(1, Number(args.matches || 10));
const source = await loadScenarioFile(args.file);
const outputDir = path.join(projectRoot, 'simulation-output-local');
await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: 'inherit', cwd: projectRoot });
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

for (const scenario of source.scenarios) {
  await run(process.execPath, [
    'simulation/run-batch.mjs', '--scenario', scenario.id, '--matches', String(matches),
    '--shard', '0', '--shard-count', '1', '--output', path.join(outputDir, `${scenario.id}.json`),
  ]);
}
await run(process.execPath, [
  'simulation/merge-results.mjs', '--input', outputDir,
  '--json-output', 'simulation-results/latest.json', '--csv-output', 'simulation-results/latest.csv', '--js-output', 'simulation-results/latest.js',
]);
