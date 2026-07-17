(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const percent = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;
  const number = (value, digits = 1) => Number(value || 0).toLocaleString('ja-JP', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

  let report = null;

  async function loadReport() {
    if (window.TRION_SIMULATION_RESULTS) return window.TRION_SIMULATION_RESULTS;
    try {
      const response = await fetch('./simulation-results/latest.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      return {
        schemaVersion: 1,
        status: 'error',
        generatedAt: null,
        gameVersion: null,
        totalMatches: 0,
        scenarios: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  function renderScenarioOptions() {
    const select = $('#simulationScenarioFilter');
    if (!select) return;
    const options = (report?.scenarios || []).map((scenario) =>
      `<option value="${escapeHtml(scenario.id)}">${escapeHtml(scenario.label || scenario.id)}</option>`
    );
    select.innerHTML = `<option value="all">全条件</option>${options.join('')}`;
  }

  function renderSummary() {
    const meta = $('#simulationMeta');
    const summary = $('#simulationSummary');
    if (!meta || !summary) return;
    if (!report || report.status === 'empty' || !(report.scenarios || []).length) {
      meta.textContent = 'まだシミュレーション結果がありません。GitHub Actionsの「Battle Simulation」を実行してください。';
      summary.innerHTML = `
        <div><span>GAME VERSION</span><strong>${escapeHtml(report?.gameVersion ?? 60)}</strong></div>
        <div><span>TOTAL MATCHES</span><strong>0</strong></div>
        <div><span>SCENARIOS</span><strong>0</strong></div>`;
      return;
    }
    const generated = report.generatedAt ? new Date(report.generatedAt).toLocaleString('ja-JP') : '---';
    meta.textContent = `生成日時 ${generated} / シミュレーション本体 v${report.gameVersion ?? '---'}`;
    summary.innerHTML = `
      <div><span>TOTAL MATCHES</span><strong>${Number(report.totalMatches || 0).toLocaleString('ja-JP')}</strong></div>
      <div><span>SCENARIOS</span><strong>${(report.scenarios || []).length}</strong></div>
      <div><span>FAILED</span><strong>${Number(report.failedMatches || 0).toLocaleString('ja-JP')}</strong></div>`;
  }

  function renderTable() {
    const body = $('#simulationTableBody');
    if (!body) return;
    const filter = $('#simulationScenarioFilter')?.value || 'all';
    const scenarios = (report?.scenarios || []).filter((scenario) => filter === 'all' || scenario.id === filter);
    if (!scenarios.length) {
      body.innerHTML = '<tr><td colspan="8" class="simulation-empty">表示できる結果がありません。</td></tr>';
      return;
    }
    body.innerHTML = scenarios.map((scenario) => {
      const a = scenario.outcomes?.winnerA || 0;
      const b = scenario.outcomes?.winnerB || 0;
      const draw = scenario.outcomes?.draw || 0;
      return `<tr data-simulation-id="${escapeHtml(scenario.id)}">
        <td><strong>${escapeHtml(scenario.label || scenario.id)}</strong><small>${escapeHtml(scenario.modeLabel || scenario.mode || '')} / ${escapeHtml(scenario.mapLabel || scenario.map || '')}</small></td>
        <td>${Number(scenario.matches || 0).toLocaleString('ja-JP')}</td>
        <td><span class="simulation-rate a" style="--rate:${Math.max(0, Math.min(1, a))}">${percent(a)}</span></td>
        <td><span class="simulation-rate b" style="--rate:${Math.max(0, Math.min(1, b))}">${percent(b)}</span></td>
        <td>${percent(draw)}</td>
        <td>${number(scenario.averageDurationSeconds)}秒</td>
        <td>${percent(scenario.combat?.criticalRate)}</td>
        <td>${percent(scenario.defense?.justGuardRate)}</td>
      </tr>`;
    }).join('');
  }

  function renderDetail(scenarioId) {
    const detail = $('#simulationDetail');
    if (!detail) return;
    const scenario = (report?.scenarios || []).find((item) => item.id === scenarioId) || report?.scenarios?.[0];
    if (!scenario) {
      detail.innerHTML = '<p>条件を選択すると詳細が表示されます。</p>';
      return;
    }
    const participants = (scenario.participants || []).map((participant) => `
      <div class="simulation-participant">
        <strong>${escapeHtml(participant.label || participant.name || participant.slot)}</strong>
        <small>${escapeHtml(participant.archetype || participant.extraType || '隊員')} / TEAM ${Number(participant.team || 0) + 1}</small>
        <dl>
          <div><dt>勝率</dt><dd>${percent(participant.winRate)}</dd></div>
          <div><dt>平均与ダメージ</dt><dd>${number(participant.averageDamage)}</dd></div>
          <div><dt>平均被ダメージ</dt><dd>${number(participant.averageDamageTaken)}</dd></div>
          <div><dt>クリティカル率</dt><dd>${percent(participant.criticalRate)}</dd></div>
          <div><dt>ジャストガード</dt><dd>${number(participant.averageJustGuards, 2)}</dd></div>
          <div><dt>終了熟練度</dt><dd>${number(participant.averageMastery)}</dd></div>
        </dl>
      </div>`).join('');
    detail.innerHTML = `
      <header><div><span>SCENARIO DETAIL</span><h3>${escapeHtml(scenario.label || scenario.id)}</h3></div><small>${escapeHtml(scenario.id)}</small></header>
      <div class="simulation-detail-grid">
        <div><span>試合数</span><strong>${Number(scenario.matches || 0).toLocaleString('ja-JP')}</strong></div>
        <div><span>平均時間</span><strong>${number(scenario.averageDurationSeconds)}秒</strong></div>
        <div><span>平均総ダメージ</span><strong>${number(scenario.combat?.averageTotalDamage)}</strong></div>
        <div><span>平均ベイルアウト</span><strong>${number(scenario.combat?.averageDeaths, 2)}</strong></div>
      </div>
      <div class="simulation-participants">${participants || '<p>参加者別データはありません。</p>'}</div>`;
  }

  function showResults() {
    $('#titleScreen')?.classList.add('hidden');
    $('#setupScreen')?.classList.add('hidden');
    $('#simulationResultsScreen')?.classList.remove('hidden');
    document.body.classList.remove('game-active');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function hideResults() {
    $('#simulationResultsScreen')?.classList.add('hidden');
    $('#titleScreen')?.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  async function init() {
    report = await loadReport();
    renderSummary();
    renderScenarioOptions();
    renderTable();
    renderDetail(report?.scenarios?.[0]?.id);

    $('#simulationResultsButton')?.addEventListener('click', showResults);
    $('#simulationBackButton')?.addEventListener('click', hideResults);
    $('#simulationScenarioFilter')?.addEventListener('change', (event) => {
      renderTable();
      if (event.target.value !== 'all') renderDetail(event.target.value);
    });
    $('#simulationTableBody')?.addEventListener('click', (event) => {
      const row = event.target.closest('[data-simulation-id]');
      if (row) renderDetail(row.dataset.simulationId);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
