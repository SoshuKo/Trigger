(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  const num = (value, digits = 1) => Number(value || 0).toLocaleString('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const int = (value) => Number(value || 0).toLocaleString('ja-JP');
  const pct = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const state = { report:null, tab:'league', leagueId:'', squadId:'all', map:'all', query:'', selected:null, agentMetric:'averageDamage' };

  async function loadReport() {
    if (window.TRION_SIMULATION_RESULTS) return window.TRION_SIMULATION_RESULTS;
    try {
      const response = await fetch('./simulation-results/latest.json', { cache:'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      return { schemaVersion:2, status:'error', totalMatches:0, scenarios:[], leagues:[], error:String(error) };
    }
  }

  function deriveLeagues(report) {
    if (Array.isArray(report?.leagues) && report.leagues.length) return report.leagues;
    const groups = new Map();
    for (const scenario of report?.scenarios || []) {
      const meta = scenario.league;
      if (!meta?.id) continue;
      const group = groups.get(meta.id) || { id:meta.id, label:meta.label || meta.id, description:meta.description || '', matchups:[], rows:new Map(), agents:new Map(), maps:new Map() };
      const matches = Number(scenario.matches || 0), counts = scenario.outcomes?.counts || {};
      const homeWins = Number(counts.winnerA || 0), awayWins = Number(counts.winnerB || 0), draws = Number(counts.draw || 0);
      group.matchups.push({ scenarioId:scenario.id, map:scenario.map, mapLabel:scenario.mapLabel || scenario.map, matches, averageDurationSeconds:scenario.averageDurationSeconds, homeSquadId:meta.homeSquadId, homeSquadLabel:meta.homeSquadLabel, awaySquadId:meta.awaySquadId, awaySquadLabel:meta.awaySquadLabel, homeWins, awayWins, draws, homeWinRate:matches?homeWins/matches:0, awayWinRate:matches?awayWins/matches:0, drawRate:matches?draws/matches:0, homeAverageDamage:scenario.teams?.[0]?.averageDamage || 0, awayAverageDamage:scenario.teams?.[1]?.averageDamage || 0 });
      const update = (id, label, wins, losses, damageFor, damageAgainst) => {
        const row = group.rows.get(id) || { id, label, played:0, wins:0, losses:0, draws:0, points:0, damageFor:0, damageAgainst:0, duration:0 };
        row.played += matches; row.wins += wins; row.losses += losses; row.draws += draws; row.points += wins * 3 + draws;
        row.damageFor += Number(damageFor || 0) * matches; row.damageAgainst += Number(damageAgainst || 0) * matches; row.duration += Number(scenario.averageDurationSeconds || 0) * matches;
        group.rows.set(id, row);
      };
      update(meta.homeSquadId, meta.homeSquadLabel, homeWins, awayWins, scenario.teams?.[0]?.averageDamage, scenario.teams?.[1]?.averageDamage);
      update(meta.awaySquadId, meta.awaySquadLabel, awayWins, homeWins, scenario.teams?.[1]?.averageDamage, scenario.teams?.[0]?.averageDamage);
      const mapRow = group.maps.get(scenario.map) || { map:scenario.map, label:scenario.mapLabel || scenario.map, matchups:0, matches:0, duration:0, draws:0 };
      mapRow.matchups += 1; mapRow.matches += matches; mapRow.duration += Number(scenario.averageDurationSeconds || 0) * matches; mapRow.draws += draws; group.maps.set(scenario.map, mapRow);
      for (const participant of scenario.participants || []) {
        const home = Number(participant.team || 0) === 0;
        const squadId = home ? meta.homeSquadId : meta.awaySquadId, squadLabel = home ? meta.homeSquadLabel : meta.awaySquadLabel;
        const key = `${squadId}:${participant.label}`;
        const row = group.agents.get(key) || { name:participant.label, squadId, squadLabel, archetype:participant.archetype, matches:0, wins:0, damage:0, damageTaken:0, kills:0, deaths:0, critical:0, mastery:0 };
        row.matches += matches; row.wins += Number(participant.winRate || 0) * matches; row.damage += Number(participant.averageDamage || 0) * matches; row.damageTaken += Number(participant.averageDamageTaken || 0) * matches; row.kills += Number(participant.averageKills || 0) * matches; row.deaths += Number(participant.averageDeaths || 0) * matches; row.critical += Number(participant.criticalRate || 0) * matches; row.mastery += Number(participant.averageMastery || 0) * matches;
        group.agents.set(key, row);
      }
      groups.set(meta.id, group);
    }
    return [...groups.values()].map((group) => {
      const standings = [...group.rows.values()].map((row) => ({ ...row, winRate:row.played?row.wins/row.played:0, averageDamageFor:row.played?row.damageFor/row.played:0, averageDamageAgainst:row.played?row.damageAgainst/row.played:0, damageDifference:row.played?(row.damageFor-row.damageAgainst)/row.played:0, averageDurationSeconds:row.played?row.duration/row.played:0 })).sort((a,b)=>b.points-a.points||b.winRate-a.winRate||b.damageDifference-a.damageDifference).map((row,index)=>({rank:index+1,...row}));
      const agents = [...group.agents.values()].map((row)=>({ ...row, winRate:row.matches?row.wins/row.matches:0, averageDamage:row.matches?row.damage/row.matches:0, averageDamageTaken:row.matches?row.damageTaken/row.matches:0, averageKills:row.matches?row.kills/row.matches:0, averageDeaths:row.matches?row.deaths/row.matches:0, criticalRate:row.matches?row.critical/row.matches:0, averageMastery:row.matches?row.mastery/row.matches:0 })).sort((a,b)=>b.averageDamage-a.averageDamage);
      const maps = [...group.maps.values()].map((row)=>({ ...row, averageDurationSeconds:row.matches?row.duration/row.matches:0, drawRate:row.matches?row.draws/row.matches:0 }));
      return { id:group.id, label:group.label, description:group.description, squads:standings.length, standings, matchups:group.matchups, agents, maps, totalMatches:group.matchups.reduce((sum,item)=>sum+item.matches,0) };
    });
  }

  function currentLeague() {
    const leagues = deriveLeagues(state.report);
    return leagues.find((league) => league.id === state.leagueId) || leagues[0] || null;
  }

  function filteredMatchups(league) {
    const query = state.query.trim().toLowerCase();
    return (league?.matchups || []).filter((matchup) => {
      if (state.squadId !== 'all' && matchup.homeSquadId !== state.squadId && matchup.awaySquadId !== state.squadId) return false;
      if (state.map !== 'all' && matchup.map !== state.map) return false;
      if (query && !`${matchup.homeSquadLabel} ${matchup.awaySquadLabel} ${matchup.mapLabel}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  function summaryHtml(report, league) {
    const generated = report?.generatedAt ? new Date(report.generatedAt).toLocaleString('ja-JP') : '未生成';
    return `<div class="sim102-summary-grid">
      <article><span>総試合数</span><strong>${int(report?.totalMatches)}</strong><small>全シナリオ合計</small></article>
      <article><span>リーグ試合数</span><strong>${int(league?.totalMatches)}</strong><small>${int(league?.matchups?.length)}カード</small></article>
      <article><span>参加部隊</span><strong>${int(league?.squads)}</strong><small>全ネームド部隊</small></article>
      <article><span>失敗試合</span><strong>${int(report?.failedMatches)}</strong><small>生成 ${esc(generated)}</small></article>
    </div>`;
  }

  function standingsHtml(league) {
    if (!league?.standings?.length) return emptyLeagueHtml();
    const maxPoints = Math.max(1, ...league.standings.map((row) => Number(row.points || 0)));
    const rows = league.standings.map((row) => `<tr data-squad-id="${esc(row.id)}">
      <td><b class="sim102-rank">${row.rank}</b></td><td><strong>${esc(row.label)}</strong></td>
      <td>${int(row.points)}</td><td>${int(row.wins)}-${int(row.draws)}-${int(row.losses)}</td><td>${pct(row.winRate)}</td>
      <td>${num(row.averageDamageFor)}</td><td>${num(row.averageDamageAgainst)}</td><td class="${Number(row.damageDifference)>=0?'positive':'negative'}">${Number(row.damageDifference)>=0?'+':''}${num(row.damageDifference)}</td>
      <td><span class="sim102-bar"><i style="--value:${clamp(Number(row.points||0)/maxPoints,0,1)}"></i></span></td>
    </tr>`).join('');
    const mapCards = (league.maps || []).map((map) => `<article class="sim102-map-card"><span>${esc(map.label)}</span><strong>${int(map.matches)}試合</strong><dl><div><dt>カード</dt><dd>${int(map.matchups)}</dd></div><div><dt>平均時間</dt><dd>${num(map.averageDurationSeconds)}秒</dd></div><div><dt>引分率</dt><dd>${pct(map.drawRate)}</dd></div></dl></article>`).join('');
    return `<section class="sim102-section"><header><div><span>LEAGUE TABLE</span><h3>総合順位</h3></div><p>勝利3点・引分1点。勝点、勝率、ダメージ差の順で順位を決定します。</p></header><div class="sim102-table-wrap"><table class="sim102-table standings"><thead><tr><th>#</th><th>部隊</th><th>勝点</th><th>勝-分-敗</th><th>勝率</th><th>平均与ダメ</th><th>平均被ダメ</th><th>差</th><th>勢力</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="sim102-section"><header><div><span>MAP BREAKDOWN</span><h3>マップ別傾向</h3></div></header><div class="sim102-map-grid">${mapCards}</div></section>`;
  }

  function matrixHtml(league) {
    if (!league?.standings?.length) return emptyLeagueHtml();
    const squads = league.standings;
    const matchupMap = new Map();
    for (const matchup of league.matchups || []) { matchupMap.set(`${matchup.homeSquadId}:${matchup.awaySquadId}`, matchup); matchupMap.set(`${matchup.awaySquadId}:${matchup.homeSquadId}`, matchup); }
    const head = squads.map((squad) => `<th title="${esc(squad.label)}"><span>${esc(squad.label.replace(/隊$/,'').slice(0,4))}</span></th>`).join('');
    const body = squads.map((rowSquad) => `<tr><th>${esc(rowSquad.label)}</th>${squads.map((colSquad) => {
      if (rowSquad.id === colSquad.id) return '<td class="diagonal">—</td>';
      const match = matchupMap.get(`${rowSquad.id}:${colSquad.id}`); if (!match) return '<td>未</td>';
      const rate = match.homeSquadId === rowSquad.id ? match.homeWinRate : match.awayWinRate;
      return `<td class="matrix-cell" style="--value:${clamp(rate,0,1)}" data-matchup-id="${esc(match.scenarioId)}"><strong>${pct(rate)}</strong><small>${int(match.matches)}戦</small></td>`;
    }).join('')}</tr>`).join('');
    return `<section class="sim102-section"><header><div><span>HEAD TO HEAD</span><h3>対戦相性マトリクス</h3></div><p>縦軸側の部隊から見た勝率です。セルを選ぶと対戦詳細を表示します。</p></header><div class="sim102-matrix-wrap"><table class="sim102-matrix"><thead><tr><th>部隊</th>${head}</tr></thead><tbody>${body}</tbody></table></div></section>`;
  }

  function matchupsHtml(league) {
    const items = filteredMatchups(league).sort((a,b)=>b.matches-a.matches||b.homeWinRate-a.homeWinRate);
    if (!items.length) return '<div class="sim102-empty"><strong>条件に合う対戦カードがありません。</strong></div>';
    return `<div class="sim102-matchup-grid">${items.map((matchup) => `<button class="sim102-matchup" type="button" data-matchup-id="${esc(matchup.scenarioId)}"><span class="map">${esc(matchup.mapLabel || matchup.map)}</span><div class="teams"><strong>${esc(matchup.homeSquadLabel)}</strong><b>VS</b><strong>${esc(matchup.awaySquadLabel)}</strong></div><div class="rates"><i style="--value:${clamp(matchup.homeWinRate,0,1)}">${pct(matchup.homeWinRate)}</i><span>引分 ${pct(matchup.drawRate)}</span><i style="--value:${clamp(matchup.awayWinRate,0,1)}">${pct(matchup.awayWinRate)}</i></div><small>${int(matchup.matches)}試合 / 平均${num(matchup.averageDurationSeconds)}秒</small></button>`).join('')}</div>`;
  }

  function squadsHtml(league) {
    if (!league?.standings?.length) return emptyLeagueHtml();
    return `<div class="sim102-squad-grid">${league.standings.map((row) => {
      const opponents = (league.matchups || []).filter((m)=>m.homeSquadId===row.id||m.awaySquadId===row.id).sort((a,b)=>{
        const ar=a.homeSquadId===row.id?a.homeWinRate:a.awayWinRate, br=b.homeSquadId===row.id?b.homeWinRate:b.awayWinRate;return br-ar;
      });
      const best=opponents[0], worst=opponents[opponents.length-1];
      const rival=(m)=>m?(m.homeSquadId===row.id?m.awaySquadLabel:m.homeSquadLabel):'---';
      return `<article class="sim102-squad-card" data-squad-id="${esc(row.id)}"><header><b>${row.rank}</b><div><h3>${esc(row.label)}</h3><span>${pct(row.winRate)} / ${int(row.points)}pt</span></div></header><dl><div><dt>平均与ダメ</dt><dd>${num(row.averageDamageFor)}</dd></div><div><dt>平均被ダメ</dt><dd>${num(row.averageDamageAgainst)}</dd></div><div><dt>平均撃破</dt><dd>${num(row.averageKills,2)}</dd></div><div><dt>平均脱落</dt><dd>${num(row.averageDeaths,2)}</dd></div></dl><footer><span>好相性 <b>${esc(rival(best))}</b></span><span>苦手 <b>${esc(rival(worst))}</b></span></footer></article>`;
    }).join('')}</div>`;
  }

  function agentsHtml(league) {
    const metric = state.agentMetric;
    const labels = { averageDamage:'平均与ダメージ', winRate:'勝率', averageKills:'平均撃破', criticalRate:'クリティカル率', averageMastery:'熟練度' };
    const agents = [...(league?.agents || [])].filter((agent)=>state.squadId==='all'||agent.squadId===state.squadId).sort((a,b)=>Number(b[metric]||0)-Number(a[metric]||0));
    if (!agents.length) return emptyLeagueHtml();
    return `<section class="sim102-section"><header><div><span>AGENT RANKING</span><h3>隊員別ランキング</h3></div><label>並び順<select id="sim102AgentMetric">${Object.entries(labels).map(([key,label])=>`<option value="${key}"${metric===key?' selected':''}>${label}</option>`).join('')}</select></label></header><div class="sim102-table-wrap"><table class="sim102-table agents"><thead><tr><th>#</th><th>隊員</th><th>部隊</th><th>役割</th><th>勝率</th><th>平均与ダメ</th><th>平均被ダメ</th><th>平均撃破</th><th>CRIT</th><th>熟練度</th></tr></thead><tbody>${agents.map((agent,index)=>`<tr><td>${index+1}</td><td><strong>${esc(agent.name)}</strong></td><td>${esc(agent.squadLabel)}</td><td>${esc(agent.archetype||'')}</td><td>${pct(agent.winRate)}</td><td>${num(agent.averageDamage)}</td><td>${num(agent.averageDamageTaken)}</td><td>${num(agent.averageKills,2)}</td><td>${pct(agent.criticalRate)}</td><td>${num(agent.averageMastery)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function scenariosHtml() {
    const query=state.query.trim().toLowerCase();
    const rows=(state.report?.scenarios||[]).filter((scenario)=>{
      if(state.map!=='all'&&scenario.map!==state.map)return false;
      if(query&&!`${scenario.label} ${scenario.modeLabel} ${scenario.mapLabel}`.toLowerCase().includes(query))return false;
      return true;
    });
    return `<section class="sim102-section"><header><div><span>ALL SCENARIOS</span><h3>全シナリオ</h3></div><p>従来の個人戦・チーム戦・防衛戦も同じ画面で比較できます。</p></header><div class="sim102-table-wrap"><table class="sim102-table"><thead><tr><th>条件</th><th>区分</th><th>試合</th><th>A勝率</th><th>B勝率</th><th>引分</th><th>平均時間</th><th>CRIT</th><th>JUST</th></tr></thead><tbody>${rows.map((scenario)=>`<tr data-scenario-id="${esc(scenario.id)}"><td><strong>${esc(scenario.label||scenario.id)}</strong><small>${esc(scenario.mapLabel||scenario.map||'')}</small></td><td>${scenario.league?'リーグ':esc(scenario.modeLabel||scenario.mode||'')}</td><td>${int(scenario.matches)}</td><td>${pct(scenario.outcomes?.winnerA)}</td><td>${pct(scenario.outcomes?.winnerB)}</td><td>${pct(scenario.outcomes?.draw)}</td><td>${num(scenario.averageDurationSeconds)}秒</td><td>${pct(scenario.combat?.criticalRate)}</td><td>${pct(scenario.defense?.justGuardRate)}</td></tr>`).join('')||'<tr><td colspan="9">表示できるシナリオがありません。</td></tr>'}</tbody></table></div></section>`;
  }

  function emptyLeagueHtml() {
    return `<div class="sim102-empty"><strong>リーグ戦の集計データはまだありません。</strong><p>GitHub Actionsの「Battle Simulation」を実行すると、全13部隊・78カードの結果がここへ表示されます。</p></div>`;
  }

  function matchupDetail(matchup, league) {
    if (!matchup) return '<p>対戦カードを選択すると詳細が表示されます。</p>';
    const scenario=(state.report?.scenarios||[]).find((item)=>item.id===matchup.scenarioId);
    const participants=scenario?.participants||[];
    return `<header><div><span>MATCHUP DETAIL</span><h3>${esc(matchup.homeSquadLabel)} vs ${esc(matchup.awaySquadLabel)}</h3></div><button type="button" data-close-detail>×</button></header><div class="sim102-detail-score"><article><span>${esc(matchup.homeSquadLabel)}</span><strong>${pct(matchup.homeWinRate)}</strong><small>${int(matchup.homeWins)}勝 / 平均与ダメ ${num(matchup.homeAverageDamage)}</small></article><b>VS</b><article><span>${esc(matchup.awaySquadLabel)}</span><strong>${pct(matchup.awayWinRate)}</strong><small>${int(matchup.awayWins)}勝 / 平均与ダメ ${num(matchup.awayAverageDamage)}</small></article></div><div class="sim102-detail-meta"><span>${esc(matchup.mapLabel||matchup.map)}</span><span>${int(matchup.matches)}試合</span><span>引分 ${pct(matchup.drawRate)}</span><span>平均 ${num(matchup.averageDurationSeconds)}秒</span></div><div class="sim102-detail-agents">${participants.map((p)=>`<article><strong>${esc(p.label)}</strong><small>TEAM ${Number(p.team||0)+1} / ${esc(p.archetype||'')}</small><dl><div><dt>勝率</dt><dd>${pct(p.winRate)}</dd></div><div><dt>与ダメ</dt><dd>${num(p.averageDamage)}</dd></div><div><dt>被ダメ</dt><dd>${num(p.averageDamageTaken)}</dd></div><div><dt>撃破</dt><dd>${num(p.averageKills,2)}</dd></div></dl></article>`).join('')}</div>`;
  }

  function scenarioDetail(scenario) {
    if(!scenario)return '<p>シナリオを選択すると詳細が表示されます。</p>';
    return `<header><div><span>SCENARIO DETAIL</span><h3>${esc(scenario.label||scenario.id)}</h3></div><button type="button" data-close-detail>×</button></header><div class="sim102-detail-meta"><span>${esc(scenario.modeLabel||scenario.mode||'')}</span><span>${esc(scenario.mapLabel||scenario.map||'')}</span><span>${int(scenario.matches)}試合</span><span>平均 ${num(scenario.averageDurationSeconds)}秒</span></div><div class="sim102-detail-agents">${(scenario.participants||[]).map((p)=>`<article><strong>${esc(p.label)}</strong><small>TEAM ${Number(p.team||0)+1} / ${esc(p.archetype||'')}</small><dl><div><dt>勝率</dt><dd>${pct(p.winRate)}</dd></div><div><dt>与ダメ</dt><dd>${num(p.averageDamage)}</dd></div><div><dt>被ダメ</dt><dd>${num(p.averageDamageTaken)}</dd></div><div><dt>熟練</dt><dd>${num(p.averageMastery)}</dd></div></dl></article>`).join('')}</div>`;
  }

  function render() {
    const root=$('#simulationDashboardV102'); if(!root)return;
    const leagues=deriveLeagues(state.report), league=currentLeague();
    if(!state.leagueId&&league)state.leagueId=league.id;
    const squads=league?.standings||[], maps=league?.maps||[];
    root.innerHTML=`${summaryHtml(state.report,league)}<div class="sim102-toolbar"><label>リーグ<select id="sim102League">${leagues.map((item)=>`<option value="${esc(item.id)}"${item.id===state.leagueId?' selected':''}>${esc(item.label)}</option>`).join('')||'<option value="">リーグ結果なし</option>'}</select></label><label>部隊<select id="sim102Squad"><option value="all">全ての部隊</option>${squads.map((item)=>`<option value="${esc(item.id)}"${item.id===state.squadId?' selected':''}>${esc(item.label)}</option>`).join('')}</select></label><label>マップ<select id="sim102Map"><option value="all">全マップ</option>${maps.map((item)=>`<option value="${esc(item.map)}"${item.map===state.map?' selected':''}>${esc(item.label)}</option>`).join('')}</select></label><label class="search">検索<input id="sim102Search" type="search" value="${esc(state.query)}" placeholder="部隊・対戦カード・条件"></label><div class="downloads"><a href="simulation-results/latest.json" download>JSON</a><a href="simulation-results/latest.csv" download>CSV</a></div></div><nav class="sim102-tabs" aria-label="分析視点">${[['league','順位表'],['matrix','対戦相性'],['matchups','対戦カード'],['squads','部隊比較'],['agents','隊員ランキング'],['scenarios','全シナリオ']].map(([id,label])=>`<button type="button" data-tab="${id}" class="${state.tab===id?'active':''}">${label}</button>`).join('')}</nav><div class="sim102-content">${state.tab==='league'?standingsHtml(league):state.tab==='matrix'?matrixHtml(league):state.tab==='matchups'?matchupsHtml(league):state.tab==='squads'?squadsHtml(league):state.tab==='agents'?agentsHtml(league):scenariosHtml()}</div><aside id="sim102Detail" class="sim102-detail ${state.selected?'open':''}">${state.selected?.type==='matchup'?matchupDetail((league?.matchups||[]).find((m)=>m.scenarioId===state.selected.id),league):state.selected?.type==='scenario'?scenarioDetail((state.report?.scenarios||[]).find((s)=>s.id===state.selected.id)):'<p>項目を選択すると詳細が表示されます。</p>'}</aside>`;
  }

  function mount() {
    const shell=$('#simulationResultsScreen .simulation-results-shell'); if(!shell||$('#simulationDashboardV102'))return;
    shell.querySelectorAll(':scope > .simulation-summary,:scope > .simulation-panel,:scope > .simulation-detail,:scope > .simulation-note').forEach((el)=>el.classList.add('sim102-legacy-hidden'));
    const root=document.createElement('section');root.id='simulationDashboardV102';root.className='sim102-dashboard';
    const header=$('.simulation-results-header',shell);if(header)header.insertAdjacentElement('afterend',root);else shell.prepend(root);
    root.addEventListener('click',(event)=>{
      const tab=event.target.closest('[data-tab]');if(tab){state.tab=tab.dataset.tab;state.selected=null;render();return;}
      const matchup=event.target.closest('[data-matchup-id]');if(matchup){state.selected={type:'matchup',id:matchup.dataset.matchupId};render();return;}
      const scenario=event.target.closest('[data-scenario-id]');if(scenario){state.selected={type:'scenario',id:scenario.dataset.scenarioId};render();return;}
      if(event.target.closest('[data-close-detail]')){state.selected=null;render();}
    });
    root.addEventListener('change',(event)=>{
      if(event.target.id==='sim102League'){state.leagueId=event.target.value;state.squadId='all';state.map='all';state.selected=null;}
      if(event.target.id==='sim102Squad')state.squadId=event.target.value;
      if(event.target.id==='sim102Map')state.map=event.target.value;
      if(event.target.id==='sim102AgentMetric')state.agentMetric=event.target.value;
      render();
    });
    root.addEventListener('input',(event)=>{if(event.target.id==='sim102Search'){state.query=event.target.value;clearTimeout(root.v102SearchTimer);root.v102SearchTimer=setTimeout(render,120);}});
  }

  async function init() {
    state.report=await loadReport();mount();const first=deriveLeagues(state.report)[0];state.leagueId=first?.id||'';render();
    window.TRION_SIMULATION_DASHBOARD={ version:102, getReport:()=>state.report, refresh:async()=>{state.report=await loadReport();render();} };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
