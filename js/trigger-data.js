(() => {
  'use strict';

  const bulletNames = {
    asteroid: 'アステロイド',
    meteor: 'メテオラ',
    viper: 'バイパー',
    hound: 'ハウンド',
  };

  const gunNames = {
    assault: 'アサルトライフル',
    handgun: 'ハンドガン',
    shotgun: 'ショットガン',
    grenade: 'グレネードガン',
    gatling: 'ガトリングガン',
  };

  const categories = [
    { id: 'attacker', name: '攻撃手用' },
    { id: 'shooter', name: '射手用' },
    { id: 'gunner', name: '銃手用' },
    { id: 'sniper', name: '狙撃手用' },
    { id: 'option', name: '射撃オプション' },
    { id: 'defense', name: '防御・隠密' },
    { id: 'mobility', name: '機動・工作' },
  ];

  const triggers = {
    empty: {
      id: 'empty', name: '― 空き枠 ―', short: 'EMPTY', category: 'none', kind: 'empty',
      cost: 0, cooldown: 0, description: 'トリガーを装備しない空き枠です。',
    },

    kogetsu: {
      id: 'kogetsu', name: '弧月', short: '弧月', category: 'attacker', kind: 'melee',
      cost: 3.4, cooldown: 0.46, damage: 28, range: 94,
      description: '攻撃力・耐久力・間合いのバランスに優れた標準ブレード。鞘に戻してOFFにすれば追加消費なしで再使用できます。',
      controls: '発動：斬撃',
    },
    senku: {
      id: 'senku', name: '旋空', short: '旋空', category: 'attacker', kind: 'pairedOption', base: 'kogetsu',
      cost: 15, cooldown: 2.8, damage: 31, range: 390,
      description: '弧月専用オプション。瞬間的に刀身を延長し、先端ほど威力が高くなる長距離斬撃を放ちます。',
      controls: '同じ側に弧月が必要',
    },
    scorpion: {
      id: 'scorpion', name: 'スコーピオン', short: 'SCORP', category: 'attacker', kind: 'melee',
      cost: 3.1, cooldown: 0.34, damage: 22, range: 82,
      description: '軽量で出し入れと変形が自在なブレード。長く伸ばすほど耐久が落ちる性質を、間合いと威力のトレードオフで再現しています。',
      controls: '発動：斬撃／Shift＋発動：長刃',
    },
    raygust: {
      id: 'raygust', name: 'レイガスト', short: 'RAYG', category: 'attacker', kind: 'melee',
      cost: 3.8, cooldown: 0.56, damage: 20, range: 80,
      description: '重く攻撃力は低めですが耐久力が高いブレード。Shiftを押しながら発動すると盾モードになります。',
      controls: '発動：斬撃／Shift＋長押し：盾',
    },
    thruster: {
      id: 'thruster', name: 'スラスター', short: 'THRUST', category: 'attacker', kind: 'pairedOption', base: 'raygust',
      cost: 15, cooldown: 3.65, damage: 31, range: 175,
      description: 'レイガスト専用オプション。噴射による突進斬り・移動・投擲を、前方への高速突進としてまとめています。',
      controls: '同じ側にレイガストが必要',
    },

    shooter_asteroid: {
      id: 'shooter_asteroid', name: 'アステロイド（射手）', short: 'AST', category: 'shooter', kind: 'shooter', bullet: 'asteroid',
      cost: 8, cooldown: 0.59,
      description: '特殊機能を持たない通常弾。威力と弾速へ多く配分でき、複数弾を正面へ射出します。',
      controls: '発動：分割射撃',
    },
    shooter_meteor: {
      id: 'shooter_meteor', name: 'メテオラ（射手）', short: 'MET', category: 'shooter', kind: 'shooter', bullet: 'meteor',
      cost: 12, cooldown: 1.12,
      description: '着弾時に爆発する炸裂弾。Shift＋発動で設置弾に切り替え、射撃や爆発で起爆できます。',
      controls: '発動：炸裂弾／Shift＋発動：設置',
    },
    shooter_viper: {
      id: 'shooter_viper', name: 'バイパー（射手）', short: 'VIP', category: 'shooter', kind: 'shooter', bullet: 'viper',
      cost: 10, cooldown: 0.78,
      description: '射出ごとに弾道を設定できる変化弾。技術力が高いほど複雑な経路と高い命中精度を得ます。',
      controls: '発動：変化弾',
    },
    shooter_hound: {
      id: 'shooter_hound', name: 'ハウンド（射手）', short: 'HOUND', category: 'shooter', kind: 'shooter', bullet: 'hound',
      cost: 10, cooldown: 0.86,
      description: '敵のトリオン反応を追う誘導弾。照準付近の敵を優先し、技術力に応じて追尾性能が上がります。',
      controls: '発動：追尾弾',
    },

    egret: {
      id: 'egret', name: 'イーグレット', short: 'EGR', category: 'sniper', kind: 'sniper',
      cost: 17, cooldown: 2.2, damage: 49, speed: 1280,
      description: '射程を重視した万能型狙撃銃。トリオン総量が高いほど有効射程が伸びます。',
      controls: '発動：狙撃',
    },
    lightning: {
      id: 'lightning', name: 'ライトニング', short: 'LTN', category: 'sniper', kind: 'sniper',
      cost: 12, cooldown: 1.18, damage: 27, speed: 1750,
      description: '軽量で弾速が高く当てやすい狙撃銃。威力は低めですが、トリオン総量に応じてさらに弾速が上がります。',
      controls: '発動：高速狙撃',
    },
    ibis: {
      id: 'ibis', name: 'アイビス', short: 'IBIS', category: 'sniper', kind: 'sniper',
      cost: 25, cooldown: 3.15, damage: 72, speed: 820,
      description: '威力特化の重量級狙撃銃。弾速は遅いものの、トリオン総量が高いほど破壊力が増します。',
      controls: '発動：重狙撃',
    },

    leadBullet: {
      id: 'leadBullet', name: '鉛弾（レッドバレット）', short: 'LEAD', category: 'option', kind: 'shotModifier', modifier: 'lead',
      cost: 12, cooldown: 2.4,
      description: '次に反対側から撃つ射撃を、ダメージのない拘束弾へ変えます。シールドを無視しますが、弾速と射程が落ちます。',
      controls: '発動後4秒以内に反対側で射撃',
    },
    starmaker: {
      id: 'starmaker', name: 'スタアメーカー', short: 'STAR', category: 'option', kind: 'shotModifier', modifier: 'mark',
      cost: 7, cooldown: 1.8,
      description: '次に反対側から撃つ射撃へマーカー効果を付与します。命中した敵は一定時間、隠密状態でも表示されます。',
      controls: '発動後5秒以内に反対側で射撃',
    },

    shield: {
      id: 'shield', name: 'シールド', short: 'SHIELD', category: 'defense', kind: 'shield',
      cost: 0.8, cooldown: 0.05,
      description: '発動中、照準方向に防御面を展開します。二枚同時なら全周防御。移動中は耐久力が下がります。',
      controls: '長押し：防御',
    },
    escudo: {
      id: 'escudo', name: 'エスクード', short: 'ESC', category: 'defense', kind: 'placeWall',
      cost: 18, cooldown: 4.2,
      description: '地面から堅牢な防壁を生成します。変形はできませんが、シールドより硬く鉛弾も遮ります。',
      controls: '発動：照準地点に防壁',
    },
    bagworm: {
      id: 'bagworm', name: 'バッグワーム', short: 'BAG', category: 'defense', kind: 'toggle', toggle: 'bagworm',
      cost: 0, drain: 2.4,
      description: '使用中は敵レーダーから消えます。継続的にトリオンを消費し、攻撃すると一時的に位置が露見します。',
      controls: '発動：ON/OFF',
    },
    bagwormTag: {
      id: 'bagwormTag', name: 'バッグワームタグ', short: 'B-TAG', category: 'defense', kind: 'toggle', toggle: 'bagwormTag', occupiesSide: true,
      cost: 0, drain: 1.15,
      description: '低消費のバッグワーム。装備した側の残り3枠を使用できなくなる制約をロードアウトで再現します。',
      controls: '発動：ON/OFF／片側4枠を占有',
    },
    chameleon: {
      id: 'chameleon', name: 'カメレオン', short: 'CAMO', category: 'defense', kind: 'toggle', toggle: 'chameleon',
      cost: 3, drain: 5.2,
      description: '風景に溶け込み視認されにくくなります。レーダーには映り、使用中は他のトリガーを発動できません。',
      controls: '発動：ON/OFF',
    },

    spider: {
      id: 'spider', name: 'スパイダー', short: 'SPIDER', category: 'mobility', kind: 'wire',
      cost: 5, cooldown: 0.72,
      description: '自分と照準地点の間にワイヤーを張ります。敵の移動を阻害し、メテオラ設置弾と近接させると罠として機能します。',
      controls: '発動：ワイヤー設置',
    },
    teleporter: {
      id: 'teleporter', name: 'テレポーター', short: 'TELE', category: 'mobility', kind: 'teleport',
      cost: 13, cooldown: 2.5,
      description: '視線方向へ瞬間移動します。距離が長いほどトリオン消費と再使用時間が増えます。',
      controls: '発動：照準方向へ瞬間移動',
    },
    grasshopper: {
      id: 'grasshopper', name: 'グラスホッパー', short: 'GRASS', category: 'mobility', kind: 'boost',
      cost: 7, cooldown: 0.62,
      description: '空中足場の反発力で急加速します。自分だけでなく接触した他の物体にも作用します。',
      controls: '発動：照準方向へ跳躍',
    },
    dummyBeacon: {
      id: 'dummyBeacon', name: 'ダミービーコン', short: 'DUMMY', category: 'mobility', kind: 'beacon',
      cost: 10, cooldown: 1.25,
      description: '偽のトリオン反応を発生させる球状ビーコン。敵レーダーとCPUの索敵を撹乱し、外部操作風に自律移動します。',
      controls: '発動：照準地点に偽反応を設置',
    },
    switchbox: {
      id: 'switchbox', name: 'スイッチボックス', short: 'SWBOX', category: 'mobility', kind: 'trap',
      cost: 19, cooldown: 2.8,
      description: 'トラップを設置する特殊工作兵向けトリガー。攻撃・拘束・加速の3種を順番に設置し、トリオン消費が非常に大きい仕様です。',
      controls: '発動：罠設置／Z：種類切替',
    },
  };

  const gunStats = {
    assault: { rate: 0.13, speed: 760, damage: 8.3, spread: 0.045, count: 1, cost: 2.15, range: 1.2 },
    handgun: { rate: 0.28, speed: 820, damage: 13.5, spread: 0.025, count: 1, cost: 3.2, range: 1.2 },
    shotgun: { rate: 0.9, speed: 690, damage: 6.4, spread: 0.27, count: 8, cost: 10.5, range: 0.78 },
    grenade: { rate: 1.18, speed: 500, damage: 30, spread: 0.025, count: 1, cost: 14, range: 0.9, explosive: true },
    gatling: { rate: 0.075, speed: 720, damage: 5.7, spread: 0.085, count: 1, cost: 1.65, range: 1.08 },
  };

  for (const [gun, gunName] of Object.entries(gunNames)) {
    for (const [bullet, bulletName] of Object.entries(bulletNames)) {
      const id = `gun_${gun}_${bullet}`;
      triggers[id] = {
        id,
        name: `${bulletName}（${gunName}）`,
        short: `${gunName.slice(0, 2)}:${bulletName.slice(0, 2)}`,
        category: 'gunner',
        kind: 'gun',
        gun,
        bullet,
        ...gunStats[gun],
        description: `${gunName}に${bulletName}を設定。射手弾より自由度は低い代わりに扱いやすく、有効射程が約20％長いゲーム設計です。`,
        controls: gun === 'assault' || gun === 'gatling' ? '長押し：連射' : '発動：射撃',
      };
    }
  }

  const composites = {
    'asteroid+asteroid': {
      name: 'ギムレット', canon: true, damage: 58, speed: 980, cost: 27, behavior: 'pierce',
      description: '高い貫通力を持つ二重通常弾。',
    },
    'meteor+viper': {
      name: 'トマホーク', canon: true, damage: 45, speed: 630, cost: 31, behavior: 'curveExplode',
      description: '複雑な軌道を描いて炸裂する変化炸裂弾。',
    },
    'hound+meteor': {
      name: 'サラマンダー', canon: true, damage: 42, speed: 610, cost: 31, behavior: 'homeExplode',
      description: '目標を追尾して炸裂する誘導炸裂弾。',
    },
    'hound+hound': {
      name: 'ホーネット', canon: true, damage: 31, speed: 720, cost: 27, behavior: 'hardHome',
      description: '通常のハウンドより急角度で追尾する強化誘導弾。',
    },
    'asteroid+viper': {
      name: 'コブラ', canon: true, detailUnknown: true, damage: 43, speed: 840, cost: 28, behavior: 'fastCurve',
      description: '名称と組み合わせのみ判明しているため、本作では高速かつ高威力の変化弾として解釈。',
    },
    'asteroid+meteor': {
      name: '高速炸裂弾', canon: false, damage: 54, speed: 900, cost: 30, behavior: 'fastExplode',
      description: 'ゲーム独自解釈：通常弾の速度・威力を残した小範囲炸裂弾。',
    },
    'asteroid+hound': {
      name: '高速追尾弾', canon: false, damage: 39, speed: 880, cost: 28, behavior: 'fastHome',
      description: 'ゲーム独自解釈：追尾性能を抑え、速度と威力を高めた誘導弾。',
    },
    'meteor+meteor': {
      name: '重炸裂弾', canon: false, damage: 67, speed: 470, cost: 36, behavior: 'heavyExplode',
      description: 'ゲーム独自解釈：弾速と取り回しを犠牲に爆発範囲を強化。',
    },
    'viper+viper': {
      name: '多重変化弾', canon: false, damage: 34, speed: 680, cost: 28, behavior: 'multiCurve',
      description: 'ゲーム独自解釈：複数回の急旋回を行う変化弾。',
    },
    'hound+viper': {
      name: '変化誘導弾', canon: false, damage: 34, speed: 700, cost: 29, behavior: 'smartRoute',
      description: 'ゲーム独自解釈：設定軌道を進んだ後、終盤に目標へ誘導。',
    },
  };

  const defaultLoadout = {
    main: ['kogetsu', 'senku', 'shield', 'shooter_hound'],
    sub: ['shooter_asteroid', 'bagworm', 'shield', 'grasshopper'],
  };

  const aiLoadouts = [
    {
      name: '万能手', main: ['kogetsu', 'senku', 'shield', 'gun_assault_asteroid'],
      sub: ['gun_assault_hound', 'bagworm', 'shield', 'grasshopper'],
    },
    {
      name: '射手', main: ['shooter_asteroid', 'shooter_hound', 'shield', 'meteor'],
      sub: ['shooter_meteor', 'shooter_viper', 'shield', 'bagworm'],
    },
    {
      name: '攻撃手', main: ['scorpion', 'shield', 'grasshopper', 'bagworm'],
      sub: ['scorpion', 'shield', 'dummyBeacon', 'spider'],
    },
    {
      name: '銃手', main: ['gun_assault_asteroid', 'gun_assault_hound', 'shield', 'starmaker'],
      sub: ['gun_handgun_asteroid', 'bagworm', 'shield', 'leadBullet'],
    },
    {
      name: '狙撃手', main: ['egret', 'lightning', 'shield', 'spider'],
      sub: ['bagworm', 'dummyBeacon', 'shield', 'grasshopper'],
    },
    {
      name: '重装手', main: ['raygust', 'thruster', 'shield', 'gun_shotgun_asteroid'],
      sub: ['shooter_meteor', 'escudo', 'shield', 'grasshopper'],
    },
    {
      name: '工作手', main: ['switchbox', 'dummyBeacon', 'shield', 'spider'],
      sub: ['bagwormTag', 'empty', 'empty', 'empty'],
    },
  ];

  // Correct a human-readable placeholder accidentally used above.
  aiLoadouts[1].main[3] = 'shooter_meteor';

  window.WT_DATA = {
    categories,
    triggers,
    composites,
    defaultLoadout,
    aiLoadouts,
    bulletNames,
    gunNames,
  };
})();
