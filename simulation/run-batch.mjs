import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { findScenario, loadScenarioFile, parseArgs, projectRoot } from './common.mjs';

async function buildInlineGameHtml(root) {
  let html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const css = await fs.readFile(path.join(root, 'styles.css'), 'utf8');
  const featureCss = await fs.readFile(path.join(root, 'v77-features.css'), 'utf8').catch(() => '');
  const v108Css = await fs.readFile(path.join(root, 'v108-features.css'), 'utf8').catch(() => '');
  html = html.replace(/<link rel="stylesheet"[^>]+>/, `<style>${css}\n${featureCss}\n${v108Css}</style>`);
  html = html.replace('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>', '');
  const scripts = [
    'js/online-config.js', 'js/trigger-data.js', 'js/online.js', 'js/community.js',
    'simulation-results/latest.js', 'js/simulation-results.js', 'js/game.js', 'js/v77-features.js',
    'js/v108-features.js',
  ];
  for (const source of scripts) {
    const code = await fs.readFile(path.join(root, source), 'utf8');
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`<script src="${escaped}(?:\\?v=\\d+)?"></script>`);
    if (pattern.test(html)) html = html.replace(pattern, () => `<script>\n${code}\n</script>`);
    else if (source === 'js/v77-features.js' || source === 'js/v108-features.js') html = html.replace('</body>', `<script>\n${code}\n</script>\n</body>`);
  }
  return html;
}

const args = parseArgs();
const scenarioId = String(args.scenario || '');
if (!scenarioId) throw new Error('--scenario は必須です。');
const shard = Math.max(0, Number(args.shard || 0));
const shardCount = Math.max(1, Number(args['shard-count'] || 1));
const matches = Math.max(1, Number(args.matches || 20));
const retries = Math.max(0, Math.min(4, Number(args.retries ?? 2)));
const maxFailureRate = Math.max(0, Math.min(1, Number(args['max-failure-rate'] ?? 0.12)));
const output = path.resolve(args.output || path.join(projectRoot, 'simulation-output', `${scenarioId}-${shard}.json`));
const source = await loadScenarioFile(args.file);
const scenario = findScenario(source, scenarioId);
const html = await buildInlineGameHtml(projectRoot);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
const browser = await chromium.launch({ headless: true, executablePath, args: ['--disable-dev-shm-usage', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(0);
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });

const results = [];
const failures = [];
const retryEvents = [];
const startedAt = new Date().toISOString();

async function runOne(index) {
  const seed = `${scenario.id}:${index}`;
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await page.evaluate(async ({ scenario: runScenario, seed: runSeed, index: runIndex }) => {
        return await window.TRION_SIMULATION_API.runMatch({ ...runScenario, seed: runSeed, matchIndex: runIndex });
      }, { scenario, seed, index });
      result.gameVersion = Math.max(108, Number(result.gameVersion || 0));
      result.featureVersion = 108;
      if (scenario.league) result.league = scenario.league;
      if (attempt > 0) retryEvents.push({ matchIndex: index, seed, recoveredOnAttempt: attempt + 1 });
      return { ok: true, result, seed, attempts: attempt + 1 };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < retries) {
        retryEvents.push({ matchIndex: index, seed, retryAttempt: attempt + 2, error: lastError });
        await page.waitForTimeout(25);
      }
    }
  }
  return { ok: false, seed, error: lastError || 'unknown simulation error', attempts: retries + 1 };
}

try {
  await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 0 });
  await page.waitForFunction(() => Boolean(window.TRION_SIMULATION_API?.runMatch) && Number(window.TRION_NAMED_AUDIT?.version || 0) >= 108 && Number(window.TRION_V108_AUDIT?.version || 0) >= 108, null, { timeout: 0 });
  for (let index = shard; index < matches; index += shardCount) {
    const outcome = await runOne(index);
    if (outcome.ok) {
      results.push(outcome.result);
      process.stdout.write(`[${scenario.id}] shard ${shard}/${shardCount} match ${index + 1}/${matches} ok (${outcome.attempts} attempt${outcome.attempts === 1 ? '' : 's'})\n`);
    } else {
      failures.push({ matchIndex: index, seed: outcome.seed, error: outcome.error, attempts: outcome.attempts });
      process.stderr.write(`[${scenario.id}] shard ${shard}/${shardCount} match ${index + 1}/${matches} failed after ${outcome.attempts} attempts: ${outcome.error}\n`);
    }
  }
} finally {
  await browser.close();
}

const assignedMatches = Array.from({ length: matches }, (_, index) => index).filter((index) => index % shardCount === shard).length;
const failureRate = assignedMatches > 0 ? failures.length / assignedMatches : 1;
const status = results.length === 0 ? 'fatal' : failureRate > maxFailureRate ? 'degraded' : failures.length ? 'partial' : 'ok';
const report = {
  schemaVersion: 2,
  status,
  scenarioId: scenario.id,
  scenarioLabel: scenario.label,
  shard,
  shardCount,
  matchesRequested: matches,
  matchesAssigned: assignedMatches,
  matchesCompleted: results.length,
  failureRate,
  maxFailureRate,
  retryLimit: retries,
  startedAt,
  endedAt: new Date().toISOString(),
  browserErrors: [...new Set(browserErrors)],
  retryEvents,
  failures,
  results,
};

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(report, null, 2));
const stat = await fs.stat(output);
process.stdout.write(`WROTE ${output} (${stat.size} bytes) status=${status} completed=${results.length}/${assignedMatches} failures=${failures.length}\n`);

if (status === 'fatal' || status === 'degraded') process.exitCode = 2;
