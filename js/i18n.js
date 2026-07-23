(() => {
  'use strict';
  const STORAGE_KEY = 'trion-arena-language';
  const queryLanguage = new URLSearchParams(location.search).get('lang');
  let language = queryLanguage === 'en' || queryLanguage === 'ja'
    ? queryLanguage
    : (localStorage.getItem(STORAGE_KEY) || (navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'ja'));
  let applying = false;
  const originalText = new WeakMap();
  const originalAttrs = new WeakMap();

  const pairs = {
    '戦場を駆け、トリガーを選び、勝ち残れ。':'Enter the battlefield, choose your Triggers, and survive.',
    '出撃準備へ':'Battle Setup','はじめてでもガイド付き':'Beginner guide included','オンライン出撃':'Online Battle','操作案内':'Controls Guide','シミュレーション結果':'Simulation Results',
    '未設定':'Not configured','Supabase設定後に利用できます。':'Available after Supabase setup.','個人ランキング':'Solo Ranking','チームランキング':'Team Ranking','防衛戦ランキング':'Defense Ranking',
    'アップデートログ':'Update Log','開発・テストプレイ':'Development & Playtesting','一緒に開発したりテストプレイをしてくれる方を募集しています。連絡はX(旧Twitter)まで':'We are looking for collaborators and playtesters. Contact us on X (formerly Twitter).',
    '非公式ファンゲームです。権利者様から問題のご指摘があった場合は、公開停止・削除など速やかに対応します。':'This is an unofficial fan game. We will promptly suspend or remove it if requested by the rights holders.',
    'まずは移動・照準・左右のトリガーを覚えれば遊べます。細かなキー設定は後から変更できます。':'Learn movement, aiming, and MAIN/SUB Trigger controls first. Key bindings can be changed later.',
    '移動':'Movement','照準':'Aim','キャラクターを移動します。':'Move your character.','カーソル方向へ狙いを定めます。':'Aim toward the cursor.','右手・左手のトリガーを発動します。':'Activate MAIN and SUB Triggers.',
    '装備切替':'Switch Loadout','MAIN・SUBの使用トリガーを選びます。':'Select the active MAIN or SUB Trigger.','特殊操作':'Special Actions','変形・合成・スコープを使います。':'Use transformations, combines, and scopes.',
    'メニュー':'Menu','一時停止して設定や退出を行います。':'Pause to change settings or leave the match.','攻撃手':'Attacker','射手':'Shooter','銃手':'Gunner','狙撃手':'Sniper','万能手':'All-Rounder','重装手':'Heavy Gunner','工作手':'Engineer',
    '接近して斬る':'Close in and slash','キューブを生成・射出':'Create and fire cubes','連射と弾種切替':'Rapid fire and ammo switching','遠距離から精密射撃':'Precision shots from long range',
    'チュートリアルを開始':'Start Tutorial','キー設定を開く':'Open Key Settings','タイトルへ戻る':'Back to Title','結果を読み込んでいます。':'Loading results…','表示条件':'Filter','全条件':'All Conditions',
    '条件':'Scenario','試合数':'Matches','A側勝率':'Side A Win Rate','B側勝率':'Side B Win Rate','引分':'Draws','平均時間':'Average Time','読み込み中です。':'Loading…','条件を選択すると詳細が表示されます。':'Select a scenario to view details.',
    '隊員プロフィール':'Agent Profile','隊名':'Squad Name','無所属隊':'Independent','キャラクターカラー':'Character Color','お気に入りのトリガー構成':'Favorite Trigger Loadout',
    'ランク戦・出撃設定':'Rank War & Battle Setup','設定ガイド':'Setup Guide','オンライン':'Online','オンライン出撃準備':'Online Battle Preparation','オフラインと同じ設定を整えてから、ロビーへ進みます。':'Configure the same settings as offline mode, then proceed to the lobby.',
    '通常出撃へ戻す':'Return to Offline Battle','試合設定':'Match Settings','対戦形式と戦場条件を選択します。':'Choose the battle format and battlefield conditions.','個人戦':'Solo','チーム戦':'Team','防衛戦':'Defense','エキストラ':'Extra','チュートリアル':'Tutorial',
    '通常ルールへ防衛戦ユニットを参加させます。':'Add defense units to a standard ruleset.','基礎ルール':'Base Rules','自分の形態':'Player Form','侵攻側へ追加する固定個体':'Fixed Invader Unit','参加方法':'Participation','戦闘員として出撃':'Deploy as Combatant','オペレーターとして参加':'Join as Operator','観戦する':'Spectate',
    '戦闘員':'Combatant','オペレーター':'Operator','観戦':'Spectator','参加CPU':'CPU Participants','参加チーム':'Teams','1隊の戦闘員':'Combatants per Squad','防衛戦シナリオ':'Defense Scenario','ブラックトリガー':'Black Trigger','百鬼夜行':'Night Parade',
    '戦場':'Battlefield','市街':'City','砂漠':'Desert','雪山神殿':'Snow Shrine','地下通路':'Underground Passage','試合時間':'Match Time','無制限（経過時間表示）':'Unlimited (elapsed time)','敵の難易度':'Enemy Difficulty','サンドバッグ（移動・攻撃なし）':'Training Dummy (no movement or attacks)','弱':'Easy','普通':'Normal','強':'Hard',
    '開始時間':'Start Time','朝':'Morning','昼':'Day','夜':'Night','時間経過':'Time Progression','固定':'Fixed','変化あり':'Dynamic','開始天候':'Start Weather','晴':'Clear','曇り':'Cloudy','雨':'Rain','天候変化':'Weather Changes','勝利条件':'Victory Conditions',
    '能力配分':'Stat Allocation','トリオン総量':'Trion Capacity','技術力':'Technique','戦闘力':'Combat Power','使用ポイント':'Points Used','ビギナーズスキル':'Beginner Skill','使用しない':'None','オートガード':'Auto Guard','エイム補正':'Aim Assist','倹約家':'Thrifty',
    'トリガーセット':'Trigger Loadout','右手4枠＋左手4枠。改造・専用トリガーは収録していません。':'Four MAIN slots and four SUB slots. Modified and exclusive Triggers are not included.','お気に入りプリセット':'Favorite Presets','選択してください':'Select','保存':'Save','削除':'Delete','プロフィールに設定':'Set on Profile','トリガーを選択してください':'Select a Trigger','各枠をクリックすると説明が表示されます。':'Click a slot to view its description.',
    '隊カスタマイズ':'Squad Customization','隊員名、隊色、隊章、隊名を設定します。':'Set agent name, squad color, emblem, and squad name.','プレイヤー名':'Player Name','隊章プリセット':'Emblem Preset','キューブ':'Cube','クロス':'Cross','ファング':'Fang','ウィング':'Wing','ロード':'Road','タワー':'Tower','カスタム':'Custom','クリア':'Clear','白黒反転':'Invert','画像読込':'Load Image',
    '対戦隊員設定':'CPU Agent Settings','必要な場合だけ開き、対戦隊員の装備と能力を変更できます。':'Open only when needed to edit CPU agents and loadouts.','標準編成に戻す':'Restore Default Roster','操作':'Controls','キー説明と割り当て変更':'Key guide and rebinding','キー割り当て標準に戻す':'Reset Key Bindings','変更する項目を押してから、新しいキーを入力してください。':'Select an action, then press the new key.','操作ガイド':'Control Guide','効果音':'Sound Effects',
    '準備ができたら出撃':'Deploy when ready','設定はブラウザに自動保存されます。':'Settings are saved automatically in your browser.','ランク戦を開始':'Start Rank War','オンラインロビーへ':'Open Online Lobby','戦闘記録':'Battle Records','直近30試合をブラウザ内に保存します。':'The latest 30 matches are saved in your browser.','保存ログはありません。':'No saved logs.','全ログをJSON保存':'Export All Logs as JSON','保存ログを削除':'Delete Saved Logs',
    '新規登録':'Create Account','ユーザー名':'Username','パスワード':'Password','登録する':'Register','ログイン':'Log In','ログアウト':'Log Out','プロフィール':'Profile','ゲーム内表示名':'Display Name','表示名を保存':'Save Display Name','フレンド管理':'Friends','追加':'Add','フレンドはまだいません':'No friends yet','フレンドと隊を結成':'Create a Squad with Friends','所属隊':'Current Squad','所属隊はありません':'Not in a squad','隊設定を保存':'Save Squad Settings','出撃設定へ反映':'Apply to Battle Setup','隊を離れる':'Leave Squad',
    'オンラインロビー':'Online Lobby','設定を読み込み中':'Loading setup','出撃設定を編集':'Edit Battle Setup','ユーザー／フレンド／隊':'User / Friends / Squad','ルームを作る':'Create Room','ルーム作成':'Create Room','ルームへ参加':'Join Room','参加':'Join','参加中':'In Room','自分のチーム':'Your Team','自分の役割':'Your Role','準備完了':'Ready','退出':'Leave','同じTEAMを選べば共闘、別のTEAMを選べば対戦できます。観戦を選ぶと戦闘員枠には入りません。':'Choose the same TEAM to cooperate or another TEAM to fight. Spectators do not occupy combatant slots.',
    '弧月':'Kogetsu','旋空':'Senkū','スコーピオン':'Scorpion','レイガスト':'Raygust','スラスター':'Thruster','アステロイド':'Asteroid','メテオラ':'Meteora','バイパー':'Viper','ハウンド':'Hound','イーグレット':'Egret','ライトニング':'Lightning','アイビス':'Ibis','シールド':'Shield','エスクード':'Escudo','グラスホッパー':'Grasshopper','テレポーター':'Teleporter','スパイダー':'Spider','バッグワーム':'Bagworm','バッグワームタグ':'Bagworm Tag','カメレオン':'Chameleon',
    '総合順位':'Standings','対戦相性':'Head-to-Head','対戦カード':'Matchups','部隊比較':'Squad Comparison','隊員ランキング':'Agent Ranking','全シナリオ':'All Scenarios','全ての部隊':'All Squads','全マップ':'All Maps','総試合数':'Total Matches','リーグ試合数':'League Matches','参加部隊':'Squads','失敗試合':'Failed Matches',
        '通常刃':'Standard Blade','長刃':'Long Blade','短刃':'Short Blade','ばね':'Spring','通常':'Normal','モールクロー':'Mole Claw','乱反射':'Pinball','ブレード乱反射':'Blade Pinball','即時使用':'Instant Boost','設置':'Place Pad','厚み':'Thickness','広さ':'Coverage','射程':'Range','効果時間':'Duration'
  };
  const translations = new Map(Object.entries(pairs));
  const regexes = [
    [/^(\d+)\s*人$/, '$1 players'], [/^(\d+)\s*チーム$/, '$1 teams'], [/^(\d+)\s*分$/, '$1 min'], [/^(\d+)\s*秒$/, '$1 sec'],
    [/^CPU\s*(\d+)人$/, 'CPU × $1'], [/^TEAM\s*(\d+)$/, 'TEAM $1'], [/^使用ポイント(\d+)\s*\/\s*(\d+)$/, 'Points Used $1 / $2']
  ];
  function translateText(value) {
    const trimmed = value.trim();
    if (!trimmed) return value;
    let translated = translations.get(trimmed);
    if (!translated) for (const [rx, replacement] of regexes) if (rx.test(trimmed)) { translated = trimmed.replace(rx, replacement); break; }
    return translated ? value.replace(trimmed, translated) : value;
  }
  function processTextNode(node) {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const original = originalText.get(node);
    node.nodeValue = language === 'en' ? translateText(original) : original;
  }
  function processElement(element) {
    if (!(element instanceof Element)) return;
    if (['SCRIPT','STYLE','NOSCRIPT','CANVAS'].includes(element.tagName)) return;
    if (!originalAttrs.has(element)) originalAttrs.set(element, { title:element.getAttribute('title'), ariaLabel:element.getAttribute('aria-label'), placeholder:element.getAttribute('placeholder') });
    const attrs = originalAttrs.get(element);
    for (const [prop, attr] of [['title','title'],['ariaLabel','aria-label'],['placeholder','placeholder']]) {
      if (attrs[prop] != null) element.setAttribute(attr, language === 'en' ? translateText(attrs[prop]) : attrs[prop]);
    }
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) processTextNode(child);
      else if (child.nodeType === Node.ELEMENT_NODE) processElement(child);
    }
  }
  function updateMetadata() {
    document.documentElement.lang = language;
    const english = language === 'en';
    document.title = english ? 'TRION ARENA | Free Browser Battle Game' : 'TRION ARENA | ワールドトリガー風ブラウザ対戦ゲーム';
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = english ? 'TRION ARENA is a free unofficial browser battle game featuring customizable Trigger loadouts, solo, team, defense, tutorial and ranking modes.' : 'TRION ARENAは、トリガー構成を選び、個人戦・チーム戦・防衛戦を遊べる非公式ブラウザ対戦ゲームです。';
    const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState(null, '', url);
  }
  function ensureToggle() {
    let button = document.getElementById('languageToggleButton');
    if (!button) {
      button = document.createElement('button'); button.id='languageToggleButton'; button.type='button'; button.className='title-sub language-toggle';
      button.addEventListener('click',()=>setLanguage(language==='ja'?'en':'ja'));
      document.querySelector('.title-actions')?.appendChild(button);
    }
    const nextText=language==='ja'?'EN':'日本語'; const nextLabel=language==='ja'?'Switch to English':'日本語に切り替え';
    if (button.textContent!==nextText) button.textContent=nextText;
    if (button.getAttribute('aria-label')!==nextLabel) button.setAttribute('aria-label',nextLabel);
  }
  function loadV77() {
    if (!document.querySelector('link[data-v77]')) { const l=document.createElement('link'); l.rel='stylesheet'; l.href='v77-features.css?v=104'; l.dataset.v77='1'; document.head.appendChild(l); }
    if (!document.querySelector('link[data-simulation-v102]')) { const l=document.createElement('link'); l.rel='stylesheet'; l.href='v102-simulation-dashboard.css?v=104'; l.dataset.simulationV102='1'; document.head.appendChild(l); }
    if (!document.querySelector('script[data-v77]')) { const s=document.createElement('script'); s.src='js/v77-features.js?v=104'; s.defer=true; s.dataset.v77='1'; document.head.appendChild(s); }
    if (!document.querySelector('script[data-simulation-v102]')) { const s=document.createElement('script'); s.src='js/simulation-dashboard-v102.js?v=104'; s.defer=true; s.dataset.simulationV102='1'; document.head.appendChild(s); }
    document.querySelectorAll('.version-badge').forEach(el=>el.textContent='VERSION 104');
  }
  function setLanguage(nextLanguage) {
    language=nextLanguage==='en'?'en':'ja'; localStorage.setItem(STORAGE_KEY,language); applying=true; processElement(document.body); updateMetadata(); ensureToggle(); applying=false;
    window.dispatchEvent(new CustomEvent('trion-language-change',{detail:{language}}));
  }
  const observer=new MutationObserver(records=>{ if(applying)return; applying=true; for(const record of records) for(const node of record.addedNodes){ if(node.nodeType===Node.TEXT_NODE)processTextNode(node); else if(node.nodeType===Node.ELEMENT_NODE)processElement(node); } ensureToggle(); applying=false; });
  function initialize(){ loadV77(); setLanguage(language); observer.observe(document.body,{childList:true,subtree:true}); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true}); else initialize();
  window.TRION_I18N={setLanguage,getLanguage:()=>language,translateText};
})();
