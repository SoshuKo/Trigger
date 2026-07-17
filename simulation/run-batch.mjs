import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { findScenario, loadScenarioFile, parseArgs, projectRoot } from './common.mjs';

async function buildInlineGameHtml(root) {
  let html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const css = await fs.readFile(path.join(root, 'styles.css'), 'utf8');
  html = html.replace(/<link rel="stylesheet"[^>]+>/, `<style>${css}</style>`);
  html = html.replace('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>', '');
  const scripts = [
    'js/online-config.js', 'js/trigger-data.js', 'js/online.js', 'js/community.js',
    'simulation-results/latest.js', 'js/simulation-results.js', 'js/game.js',
  ];
  for (const source of scripts) {
    const code = await fs.readFile(path.join(root, source), 'utf8');
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`<script src="${escaped}(?:\\?v=\\d+)?"></script>`), () => `<script>\n${code}\n</script>`);
  }
  return html;
}

const args = parseArgs();
const scenarioId = String(args.scenario || '');
if (!scenarioId) throw new Error('--scenario は必須です。');
const shard = Math.max(0, Number(args.shard || 0));
const shardCount = Math.max(1, Number(args['shard-count'] || 1));
const matches = Math.max(1, Number(args.matches || 20));
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
const startedAt = new Date().toISOString();
try {
  await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 0 });
  await page.waitForFunction(() => Boolean(window.TRION_SIMULATION_API?.runMatch), null, { timeout: 0 });
  for (let index = shard; index < matches; index += shardCount) {
    const seed = `${scenario.id}:${index}`;
    try {
      const result = await page.evaluate(async ({ scenario, seed, index }) => {
        return await window.TRION_SIMULATION_API.runMatch({ ...scenario, seed, matchIndex: index });
      }, { scenario, seed, index });
      results.push(result);
      process.stdout.write(`[${scenario.id}] shard ${shard}/${shardCount} match ${index + 1}/${matches}\n`);
    } catch (error) {
      failures.push({ matchIndex: index, seed, error: error instanceof Error ? error.message : String(error) });
    }
  }
} finally {
  await browser.close();
}

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify({
  schemaVersion: 1,
  scenarioId: scenario.id,
  scenarioLabel: scenario.label,
  shard,
  shardCount,
  matchesRequested: matches,
  matchesCompleted: results.length,
  startedAt,
  endedAt: new Date().toISOString(),
  browserErrors: [...new Set(browserErrors)],
  failures,
  results,
}, null, 2));

if (failures.length) process.exitCode = 2;
