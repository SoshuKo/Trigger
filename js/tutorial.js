(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const COURSE_ORDER = ['basic', 'attacker', 'shooter', 'gunner', 'sniper'];
  const COURSES = {
    basic: {
      kicker: 'BASIC TRAINING', title: '基本操作', description: '通常戦と同じHUD・カメラ・操作で移動、照準、左右トリガーを確認します。',
      objectives: [
        { id: 'move', text: 'WASDで移動する', test: (state) => state.moved },
        { id: 'aim', text: 'マウスで照準を動かす', test: (state) => state.aimed },
        { id: 'main', text: '左クリックでMAINを発動する', test: (state) => state.mainUsed },
        { id: 'sub', text: '右クリックでSUBのシールドを使う', test: (state) => state.subUsed },
      ],
      hints: ['WASDで移動してください。', 'マウスを動かして照準を標的へ合わせます。', '左クリックでMAINを発動します。', '右クリックを押してSUBのシールドを展開します。'],
    },
    attacker: {
      kicker: 'ATTACKER TRAINING', title: '攻撃手トリガー', description: '弧月・旋空・スコーピオン・レイガストを通常戦と同じスロットから使います。',
      objectives: [
        { id: 'kogetsu', text: '1：弧月で標的へ攻撃する', test: (_, game) => uses(game, 'kogetsu') > 0 && damage(game) > 0 },
        { id: 'senku', text: '2：旋空で離れた標的を攻撃する', test: (_, game) => uses(game, 'senku') > 0 },
        { id: 'otherBlade', text: '3または4：別のブレードを使う', test: (_, game) => uses(game, 'scorpion') > 0 || uses(game, 'raygust') > 0 },
      ],
      hints: ['1で弧月を選び、標的へ接近して左クリックします。', '2で旋空を選び、少し離れて左クリックします。', '3のスコーピオンか4のレイガストも試してください。'],
    },
    shooter: {
      kicker: 'SHOOTER TRAINING', title: '射手トリガー', description: 'キューブ展開から射出まで、射手固有の二段階操作を練習します。',
      objectives: [
        { id: 'charge', text: '1：アステロイドのキューブを展開する', test: (_, game) => metric(game, 'shooterChargesStarted') > 0 },
        { id: 'fire', text: 'もう一度左クリックして射出する', test: (_, game) => metric(game, 'projectilesFired') > 0 },
        { id: 'variant', text: '2〜4：ハウンド・バイパー・メテオラを使う', test: (_, game) => ['shooter_hound','shooter_viper','shooter_meteor'].some((id) => uses(game,id)>0) },
      ],
      hints: ['1を選び、左クリックでキューブを展開します。', '照準を合わせ、もう一度左クリックして射出します。', '2〜4の弾種も同じ二段階操作で使用します。'],
    },
    gunner: {
      kicker: 'GUNNER TRAINING', title: '銃手トリガー', description: '銃型トリガーの連射、弾種・銃種の切替を通常戦の操作で確認します。',
      objectives: [
        { id: 'burst', text: '1：アサルトライフルを長押しで連射する', test: (_, game) => metric(game, 'gunShots') >= 5 },
        { id: 'hound', text: '2：ハウンドへ切り替えて射撃する', test: (_, game) => uses(game, 'gun_assault_hound') > 0 },
        { id: 'weapon', text: '3または4：別の銃型トリガーを使う', test: (_, game) => uses(game, 'gun_handgun_asteroid') > 0 || uses(game, 'gun_shotgun_asteroid') > 0 },
      ],
      hints: ['1を選び、左クリックを長押しします。', '2でハウンドへ切り替えて左クリックします。', '3のハンドガンか4のショットガンも試してください。'],
    },
    sniper: {
      kicker: 'SNIPER TRAINING', title: '狙撃手トリガー', description: 'スコープを展開し、遠距離標的への精密射撃を練習します。',
      objectives: [
        { id: 'scope', text: 'R：スコープを展開する', test: (state, game) => state.scopeUsed || Boolean(game?.scopeActive) },
        { id: 'shot', text: '1：イーグレットで標的を狙撃する', test: (_, game) => uses(game, 'egret') > 0 && metric(game, 'projectilesFired') > 0 },
        { id: 'hit', text: '遠距離標的へ命中させる', test: (_, game) => damage(game) > 0 },
      ],
      hints: ['Rでスコープを展開します。', '1でイーグレットを選び、照準を標的へ合わせます。', '左クリックで狙撃し、命中させてください。'],
    },
  };

  const state = { course: 'basic', moved: false, aimed: false, mainUsed: false, subUsed: false, scopeUsed: false, active: false, completed: new Set() };
  let previousPosition = null;
  let frameId = 0;

  function game() { return window.__TRION_GAME__ || null; }
  function human(g = game()) { return g?.human || null; }
  function metric(g, key) { return Number(human(g)?.metrics?.[key] || 0); }
  function uses(g, id) {
    const metrics = human(g)?.metrics;
    if (!metrics) return 0;
    // Game records triggerUses by display name, while triggerStats is keyed by trigger ID.
    // Tutorial objectives must use the stable ID-keyed counter.
    return Number(metrics.triggerStats?.[id]?.uses || 0);
  }
  function damage(g) { return metric(g, 'damageDealt'); }

  function resetState(course) {
    state.course = COURSE_ORDER.includes(course) ? course : 'basic';
    state.moved = state.aimed = state.mainUsed = state.subUsed = state.scopeUsed = false;
    state.completed.clear(); previousPosition = null;
  }

  function render() {
    const data = COURSES[state.course]; if (!data) return;
    $('#tutorialCourseKicker').textContent = data.kicker;
    $('#tutorialCourseTitle').textContent = data.title;
    $('#tutorialCourseDescription').textContent = data.description;
    document.querySelectorAll('#tutorialCourseTabs [data-course]').forEach((button) => button.classList.toggle('active', button.dataset.course === state.course));
    let done = 0;
    $('#tutorialObjectives').innerHTML = data.objectives.map((objective, index) => {
      const complete = state.completed.has(objective.id); if (complete) done += 1;
      const current = !complete && index === data.objectives.findIndex((item) => !state.completed.has(item.id));
      return `<li class="${complete ? 'done' : current ? 'current' : ''}"><i>${complete ? '✓' : index + 1}</i><span>${objective.text}</span></li>`;
    }).join('');
    $('#tutorialHint').textContent = done >= data.objectives.length ? '訓練完了です。次の訓練へ進めます。' : data.hints[Math.min(done, data.hints.length - 1)];
    $('#tutorialProgressBar').style.width = `${done / data.objectives.length * 100}%`;
    $('#tutorialNextButton').disabled = done < data.objectives.length;
    $('#tutorialNextButton').textContent = state.course === COURSE_ORDER.at(-1) ? '全訓練完了' : '次の訓練へ';
  }

  function update() {
    if (!state.active) return;
    const g = game(); const p = human(g);
    if (!g?.isTutorial || !p) { frameId = requestAnimationFrame(update); return; }
    if (previousPosition) {
      const d = Math.hypot(p.x - previousPosition.x, p.y - previousPosition.y);
      if (d > 8) state.moved = true;
    }
    previousPosition = { x: p.x, y: p.y };
    const data = COURSES[state.course];
    for (const objective of data.objectives) if (objective.test(state, g)) state.completed.add(objective.id);
    render();
    frameId = requestAnimationFrame(update);
  }

  function open(course = 'basic') {
    resetState(course); state.active = true;
    window.TRION_START_TUTORIAL?.(state.course);
    document.body.classList.add('tutorial-active');
    $('#tutorialTrainingPanel')?.classList.remove('hidden');
    render();
    cancelAnimationFrame(frameId); frameId = requestAnimationFrame(update);
  }

  function exit() {
    state.active = false; cancelAnimationFrame(frameId);
    $('#tutorialTrainingPanel')?.classList.add('hidden'); document.body.classList.remove('tutorial-active');
    const g = game(); if (g?.isTutorial) g.returnToTitle('tutorial_exit'); else window.TRION_SHOW_TITLE?.();
  }

  function restart() { open(state.course); }
  function next() {
    if ($('#tutorialNextButton')?.disabled) return;
    const index = COURSE_ORDER.indexOf(state.course);
    if (index >= COURSE_ORDER.length - 1) {
      try { localStorage.setItem('trionArenaTutorialCompletedV68', '1'); } catch (_) {}
      exit(); return;
    }
    open(COURSE_ORDER[index + 1]);
  }

  window.addEventListener('keydown', (event) => { if (!state.active) return; if (['KeyW','KeyA','KeyS','KeyD'].includes(event.code)) state.moved = true; if (event.code === 'KeyR') state.scopeUsed = true; }, true);
  window.addEventListener('pointermove', () => { if (state.active) state.aimed = true; }, true);
  window.addEventListener('pointerdown', (event) => { if (!state.active || !event.target.closest?.('#gameScreen')) return; if (event.button === 0) state.mainUsed = true; if (event.button === 2) state.subUsed = true; }, true);
  window.addEventListener('trion:tutorial-game-ready', () => { if (!state.active) return; $('#tutorialTrainingPanel')?.classList.remove('hidden'); document.body.classList.add('tutorial-active'); render(); });
  window.addEventListener('trion:tutorial-game-ended', () => { $('#tutorialTrainingPanel')?.classList.add('hidden'); });

  $('#guideStartTutorialButton')?.addEventListener('click', () => { $('#titleGuidePanel')?.classList.add('hidden'); open('basic'); });
  $('#tutorialExitButton')?.addEventListener('click', exit);
  $('#tutorialResetButton')?.addEventListener('click', restart);
  $('#tutorialNextButton')?.addEventListener('click', next);
  $('#tutorialCourseTabs')?.addEventListener('click', (event) => { const button = event.target.closest('button[data-course]'); if (button) open(button.dataset.course); });



  function openGuide() {
    $('#titleGuidePanel')?.classList.remove('hidden');
  }

  function closeGuide() {
    $('#titleGuidePanel')?.classList.add('hidden');
  }

  function enterSetupFromGuide(openKeys = false) {
    closeGuide();
    $('#enterSetupButton')?.click();
    if (!openKeys) return;
    requestAnimationFrame(() => {
      const details = $('#controlsDetailPanel');
      if (details) details.open = true;
      requestAnimationFrame(() => details?.scrollIntoView?.({ behavior:'smooth', block:'start' }));
    });
  }

  $('#titleGuideCloseButton')?.addEventListener('click', closeGuide);
  $('#titleGuidePanel')?.addEventListener('click', (event) => {
    if (event.target === $('#titleGuidePanel')) closeGuide();
  });
  $('#guideOpenKeySettings')?.addEventListener('click', () => enterSetupFromGuide(true));
  $('#guideEnterSetupButton')?.addEventListener('click', () => enterSetupFromGuide(false));



  const SETUP_GUIDE_STEPS = [
    { selector:'.match-panel', title:'1 / 4　試合設定', text:'まず対戦形式、参加人数、戦場、試合時間、難易度を選びます。迷った場合は「個人戦・普通・3分」のままで始められます。' },
    { selector:'.stats-panel', title:'2 / 4　能力配分', text:'トリオン総量・技術力・戦闘力を配分します。合計値を超えると出撃できないため、表示される使用ポイントを確認してください。' },
    { selector:'.loadout-panel', title:'3 / 4　トリガーセット', text:'右手MAINと左手SUBへトリガーを設定します。各スロットを選ぶと下に説明が表示されます。警告が出た場合は装備構成を修正してください。' },
    { selector:'.setup-start-zone', title:'4 / 4　出撃', text:'設定が終わったら「ランク戦を開始」を押します。操作を先に練習する場合は、上部の「チュートリアル」を選んでください。' },
  ];
  let setupGuideIndex = 0;
  let setupGuideOverlay = null;
  let setupGuideFocus = null;

  function ensureSetupGuideOverlay() {
    if (setupGuideOverlay) return setupGuideOverlay;
    setupGuideOverlay = document.createElement('div');
    setupGuideOverlay.id = 'setupGuideOverlay';
    setupGuideOverlay.className = 'setup-guide-overlay hidden';
    setupGuideOverlay.innerHTML = `<div class="setup-guide-card" role="dialog" aria-modal="true" aria-labelledby="setupGuideTitle"><span>FIRST SORTIE GUIDE</span><h2 id="setupGuideTitle"></h2><p id="setupGuideText"></p><div><button id="setupGuideClose" type="button">閉じる</button><button id="setupGuidePrev" type="button">戻る</button><button id="setupGuideNext" type="button">次へ</button></div></div>`;
    document.body.appendChild(setupGuideOverlay);
    setupGuideOverlay.querySelector('#setupGuideClose')?.addEventListener('click', closeSetupGuide);
    setupGuideOverlay.querySelector('#setupGuidePrev')?.addEventListener('click', () => showSetupGuideStep(setupGuideIndex - 1));
    setupGuideOverlay.querySelector('#setupGuideNext')?.addEventListener('click', () => {
      if (setupGuideIndex >= SETUP_GUIDE_STEPS.length - 1) closeSetupGuide();
      else showSetupGuideStep(setupGuideIndex + 1);
    });
    return setupGuideOverlay;
  }

  function clearSetupGuideFocus() {
    setupGuideFocus?.classList.remove('setup-guide-focus');
    setupGuideFocus = null;
  }

  function showSetupGuideStep(index) {
    const overlay = ensureSetupGuideOverlay();
    setupGuideIndex = Math.max(0, Math.min(SETUP_GUIDE_STEPS.length - 1, index));
    const step = SETUP_GUIDE_STEPS[setupGuideIndex];
    clearSetupGuideFocus();
    setupGuideFocus = document.querySelector(step.selector);
    setupGuideFocus?.classList.add('setup-guide-focus');
    overlay.querySelector('#setupGuideTitle').textContent = step.title;
    overlay.querySelector('#setupGuideText').textContent = step.text;
    const prev = overlay.querySelector('#setupGuidePrev');
    const next = overlay.querySelector('#setupGuideNext');
    if (prev) prev.disabled = setupGuideIndex === 0;
    if (next) next.textContent = setupGuideIndex === SETUP_GUIDE_STEPS.length - 1 ? '完了' : '次へ';
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => setupGuideFocus?.scrollIntoView?.({ behavior:'smooth', block:'center' }));
  }

  function openSetupGuide() {
    if ($('#setupScreen')?.classList.contains('hidden')) $('#enterSetupButton')?.click();
    requestAnimationFrame(() => showSetupGuideStep(0));
  }

  function closeSetupGuide() {
    clearSetupGuideFocus();
    setupGuideOverlay?.classList.add('hidden');
  }

  $('#setupGuideButton')?.addEventListener('click', openSetupGuide);
  window.addEventListener('trion:setup-shown', (event) => {
    if (event.detail?.manualGuide) openSetupGuide();
  });


  window.TRION_ONBOARDING = { openGuide, closeGuide, enterSetup: enterSetupFromGuide, openSetupGuide, closeSetupGuide };

  window.TRION_TUTORIAL = { open, close: exit, reset: restart };
})();
