(() => {
  'use strict';

  const STORAGE_KEY = 'trion-arena-language';
  const queryLanguage = new URLSearchParams(location.search).get('lang');
  const initialLanguage = queryLanguage === 'en' || queryLanguage === 'ja'
    ? queryLanguage
    : (localStorage.getItem(STORAGE_KEY) || (navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'ja'));

  const translations = new Map(Object.entries({
    '戦場を駆け、トリガーを選び、勝ち残れ。': 'Enter the battlefield, choose your Triggers, and survive.',
    '出撃準備へ': 'Battle Setup',
    'はじめてでもガイド付き': 'Beginner guide included',
    'オンライン出撃': 'Online Battle',
    '操作案内': 'Controls Guide',
    'シミュレーション結果': 'Simulation Results',
    '未設定': 'Not configured',
    'Supabase設定後に利用できます。': 'Available after Supabase setup.',
    '個人ランキング': 'Solo Ranking',
    'チームランキング': 'Team Ranking',
    '防衛戦ランキング': 'Defense Ranking',
    'アップデートログ': 'Update Log',
    '開発・テストプレイ': 'Development & Playtesting',
    '一緒に開発したりテストプレイをしてくれる方を募集しています。連絡はX(旧Twitter)まで': 'We are looking for collaborators and playtesters. Contact us on X (formerly Twitter).',
    '非公式ファンゲームです。権利者様から問題のご指摘があった場合は、公開停止・削除など速やかに対応します。': 'This is an unofficial fan game. We will promptly suspend or remove it if requested by the rights holders.',
    'まずは移動・照準・左右のトリガーを覚えれば遊べます。細かなキー設定は後から変更できます。': 'Learn movement, aiming, and left/right Trigger controls first. Key bindings can be changed later.',
    '移動': 'Movement', '照準': 'Aim', '左 / 右クリック': 'Left / Right Click',
    'キャラクターを移動します。': 'Move your character.',
    'カーソル方向へ狙いを定めます。': 'Aim toward the cursor.',
    '右手・左手のトリガーを発動します。': 'Activate MAIN and SUB Triggers.',
    '装備切替': 'Switch Loadout', 'MAIN・SUBの使用トリガーを選びます。': 'Select the active MAIN or SUB Trigger.',
    '特殊操作': 'Special Actions', '変形・合成・スコープを使います。': 'Use transformations, composites, and scopes.',
    'メニュー': 'Menu', '一時停止して設定や退出を行います。': 'Pause to change settings or leave the match.',
    '攻撃手': 'Attacker', '射手': 'Shooter', '銃手': 'Gunner', '狙撃手': 'Sniper',
    '接近して斬る': 'Close in and slash', 'キューブを生成・射出': 'Create and fire cubes',
    '連射と弾種切替': 'Rapid fire and ammo switching', '遠距離から精密射撃': 'Precision shots from long range',
    'チュートリアルを開始': 'Start Tutorial', 'キー設定を開く': 'Open Key Settings',
    'タイトルへ戻る': 'Back to Title', '結果を読み込んでいます。': 'Loading results…',
    '表示条件': 'Filter', '全条件': 'All Conditions', '条件': 'Scenario', '試合数': 'Matches',
    'A側勝率': 'Side A Win Rate', 'B側勝率': 'Side B Win Rate', '引分': 'Draws', '平均時間': 'Average Time',
    '読み込み中です。': 'Loading…', '条件を選択すると詳細が表示されます。': 'Select a scenario to view details.',
    '隊員プロフィール': 'Agent Profile', '隊名': 'Squad Name', '無所属隊': 'Independent',
    'キャラクターカラー': 'Character Color', 'お気に入りのトリガー構成': 'Favorite Trigger Loadout',
    'ランク戦・出撃設定': 'Rank War & Battle Setup', '設定ガイド': 'Setup Guide', 'オンライン': 'Online',
    'オンライン出撃準備': 'Online Battle Preparation',
    'オフラインと同じ設定を整えてから、ロビーへ進みます。': 'Configure the same settings as offline mode, then proceed to the lobby.',
    '通常出撃へ戻す': 'Return to Offline Battle', '試合設定': 'Match Settings',
    '対戦形式と戦場条件を選択します。': 'Choose the battle format and battlefield conditions.',
    '個人戦': 'Solo', 'チーム戦': 'Team', '防衛戦': 'Defense', 'エキストラ': 'Extra', 'チュートリアル': 'Tutorial',
    '通常ルールへ防衛戦ユニットを参加させます。': 'Add defense units to a standard ruleset.',
    '基礎ルール': 'Base Rules', '自分の形態': 'Player Form', '侵攻側へ追加する固定個体': 'Fixed Invader Unit',
    '参加方法': 'Participation', '戦闘員として出撃': 'Deploy as Combatant', 'オペレーターとして参加': 'Join as Operator', '観戦する': 'Spectate',
    'マップ': 'Map', '時間': 'Time', '天候': 'Weather', '難易度': 'Difficulty', '参加CPU': 'CPU Participants',
    '能力配分': 'Stat Allocation', 'トリオン総量': 'Trion Capacity', '技術力': 'Technique', '戦闘力': 'Combat Power',
    '隊カスタマイズ': 'Squad Customization', 'トリガーセット': 'Trigger Loadout', '操作': 'Controls', '戦闘記録': 'Battle Records',
    '出撃': 'Deploy', '試合開始': 'Start Match', '保存': 'Save', '削除': 'Delete', '読み込み': 'Load', '上書き保存': 'Overwrite',
    'プリセット': 'Preset', 'お気に入りに設定': 'Set as Favorite', '閉じる': 'Close', '戻る': 'Back', '次へ': 'Next', '完了': 'Done',
    '一時停止': 'Paused', '試合へ戻る': 'Resume Match', '設定': 'Settings', '退出': 'Leave',
    '勝利': 'Victory', '敗北': 'Defeat', '引き分け': 'Draw', '再出撃': 'Play Again',
    '朝': 'Morning', '昼': 'Day', '夕方': 'Evening', '夜': 'Night',
    '晴れ': 'Clear', '曇り': 'Cloudy', '雨': 'Rain', '霧': 'Fog', 'ランダム': 'Random',
    '市街地A': 'Urban Area A', '市街地B': 'Urban Area B', '河川敷': 'Riverside', '工業地帯': 'Industrial Zone', '砂漠': 'Desert', '地下通路': 'Underground Passage',
    'バッグワーム': 'Bagworm', 'バッグワームタグ': 'Bagworm Tag', 'カメレオン': 'Chameleon',
    '弧月': 'Kogetsu', '旋空': 'Senkū', 'スコーピオン': 'Scorpion', 'レイガスト': 'Raygust', 'スラスター': 'Thruster',
    'アステロイド': 'Asteroid', 'メテオラ': 'Meteora', 'バイパー': 'Viper', 'ハウンド': 'Hound',
    'イーグレット': 'Egret', 'ライトニング': 'Lightning', 'アイビス': 'Ibis', 'シールド': 'Shield',
    'エスクード': 'Escudo', 'グラスホッパー': 'Grasshopper', 'テレポーター': 'Teleporter', 'スパイダー': 'Spider',
    'CPU複数会敵・プリセット・プロフィール・コメント欄を追加': 'Added CPU multi-target combat, presets, profiles, and comments',
    'バッグワーム会敵判定と射手訓練を修正': 'Fixed Bagworm engagement and Shooter training',
    '重いタイトル背景デモを削除': 'Removed the heavy title background demo'
  }));

  const originalText = new WeakMap();
  const originalAttrs = new WeakMap();
  let language = initialLanguage;
  let applying = false;

  function translateText(value) {
    const trimmed = value.trim();
    if (!trimmed || !translations.has(trimmed)) return value;
    return value.replace(trimmed, translations.get(trimmed));
  }

  function processTextNode(node) {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const original = originalText.get(node);
    node.nodeValue = language === 'en' ? translateText(original) : original;
  }

  function processElement(element) {
    if (!(element instanceof Element)) return;
    const tag = element.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;
    if (!originalAttrs.has(element)) {
      originalAttrs.set(element, {
        title: element.getAttribute('title'),
        ariaLabel: element.getAttribute('aria-label'),
        placeholder: element.getAttribute('placeholder')
      });
    }
    const attrs = originalAttrs.get(element);
    for (const [prop, attr] of [['title','title'], ['ariaLabel','aria-label'], ['placeholder','placeholder']]) {
      const original = attrs[prop];
      if (original == null) continue;
      element.setAttribute(attr, language === 'en' ? translateText(original) : original);
    }
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) processTextNode(child);
      else if (child.nodeType === Node.ELEMENT_NODE) processElement(child);
    }
  }

  function updateMetadata() {
    document.documentElement.lang = language;
    const english = language === 'en';
    document.title = english
      ? 'TRION ARENA | Free Browser Battle Game'
      : 'TRION ARENA | ワールドトリガー風ブラウザ対戦ゲーム';
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = english
      ? 'TRION ARENA is a free unofficial browser battle game featuring customizable Trigger loadouts, solo, team, defense, tutorial and ranking modes.'
      : 'TRION ARENAは、トリガー構成を選び、個人戦・チーム戦・防衛戦を遊べる非公式ブラウザ対戦ゲームです。チュートリアル、ランキング、オンライン機能に対応。';
    const ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) ogLocale.content = english ? 'en_US' : 'ja_JP';
    const url = new URL(location.href);
    url.searchParams.set('lang', language);
    history.replaceState(null, '', url);
  }

  function ensureToggle() {
    let button = document.getElementById('languageToggleButton');
    if (!button) {
      button = document.createElement('button');
      button.id = 'languageToggleButton';
      button.type = 'button';
      button.className = 'title-sub language-toggle';
      button.addEventListener('click', () => setLanguage(language === 'ja' ? 'en' : 'ja'));
      const actions = document.querySelector('.title-actions');
      if (actions) actions.appendChild(button);
    }
    const nextText = language === 'ja' ? 'EN' : '日本語';
    const nextLabel = language === 'ja' ? 'Switch to English' : '日本語に切り替え';
    if (button.textContent !== nextText) button.textContent = nextText;
    if (button.getAttribute('aria-label') !== nextLabel) button.setAttribute('aria-label', nextLabel);
  }

  function setLanguage(nextLanguage) {
    language = nextLanguage === 'en' ? 'en' : 'ja';
    localStorage.setItem(STORAGE_KEY, language);
    applying = true;
    processElement(document.body);
    updateMetadata();
    ensureToggle();
    applying = false;
    window.dispatchEvent(new CustomEvent('trion-language-change', { detail: { language } }));
  }

  const observer = new MutationObserver(records => {
    if (applying) return;
    applying = true;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) processTextNode(node);
        else if (node.nodeType === Node.ELEMENT_NODE) processElement(node);
      }
    }
    ensureToggle();
    applying = false;
  });

  function initialize() {
    setLanguage(language);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();

  window.TRION_I18N = { setLanguage, getLanguage: () => language };
})();
