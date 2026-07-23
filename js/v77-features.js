(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const storageGet=(key,fallback=null)=>{try{const value=localStorage.getItem(key);return value==null?fallback:value;}catch(_){return fallback;}};
  const storageSet=(key,value)=>{try{localStorage.setItem(key,value);return true;}catch(_){return false;}};
  const readObject=(key)=>{try{const value=JSON.parse(storageGet(key,'{}'));return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch(_){return {};}};
  const settings=Object.assign({senkuDuration:.7,shieldCoverage:.55,grasshopperMode:'instant'},readObject('trion-v77-settings'));
  const save=()=>storageSet('trion-v77-settings',JSON.stringify(settings));
  let patchedProto=null,currentGame=null,shiftHeld=false,rosterMounted=false;
  const hasTrigger=(p,id)=>[...(p?.loadout?.main||[]),...(p?.loadout?.sub||[])].includes(id);
  const humanOf=g=>g?.players?.find(p=>p.human&&!p.dead)||g?.players?.find(p=>p.human);
  const nearestEnemy=(g,p,max=900)=>{if(!p||!Array.isArray(g?.players))return null;return g.players.filter(t=>t!==p&&!t.dead&&g.canDamage?.(p,t)).map(t=>({t,d:Math.hypot(t.x-p.x,t.y-p.y)})).filter(x=>x.d<=max).sort((a,b)=>a.d-b.d)[0]?.t||null;};
  const lang=()=>window.TRION_I18N?.getLanguage?.()==='en'?'en':'ja';
  const labelOf=a=>lang()==='en'?a.en:a.ja;
  const norm=(arr,n=4)=>[...arr,...Array(n).fill('empty')].slice(0,n);
  const A=(ja,en,role,stats,main,sub,extra={})=>({ja,en,role,stats,main:norm(main),sub:norm(sub),...extra});
  const SQUADS=[
    {id:'ninomiya',ja:'ニノミヤ隊',en:'NINOMIYA SQUAD',agents:[
      A('ニノミヤ','NINOMIYA','シューター',[8,6,4],['shooter_asteroid','shooter_hound','shield','shooter_meteor'],['shooter_asteroid','shield','bagworm','empty'],{tetra:true}),
      A('イヌカイ','INUKAI','ガンナー',[6,6,6],['gun_assault_asteroid','gun_assault_hound','shield','scorpion'],['shooter_hound','shield','bagworm','empty']),
      A('ツジ','TSUJI','アタッカー',[4,6,8],['kogetsu','senku','shield','empty'],['shield','bagworm','empty','empty'])]},
    {id:'tamakoma2',ja:'タマコマ第二',en:'TAMAKOMA SECOND',agents:[
      A('ミクモ','MIKUMO','シューター',[2,10,6],['raygust','thruster','shooter_asteroid','shield'],['bagworm','spider','empty','empty']),
      A('クガ','KUGA','アタッカー',[4,6,10],['scorpion','grasshopper','shield','empty'],['scorpion','shield','bagworm','empty']),
      A('アマトリ','AMATORI','スナイパー',[14,6,6],['egret','lightning','ibis','shield'],['shooter_hound','shooter_meteor','shield','bagworm']),
      A('ヒュース','HYUSE','アタッカー',[9,5,6],['kogetsu','senku','shield','shooter_viper'],['escudo','shield','bagworm','empty'])]},
    {id:'kageura',ja:'カゲウラ隊',en:'KAGEURA SQUAD',agents:[
      A('カゲウラ','KAGEURA','アタッカー',[4,5,11],['scorpion','shield','empty','empty'],['scorpion','shield','bagworm','empty']),
      A('キタゾエ','KITAZOE','ガンナー',[7,5,6],['gun_grenade_asteroid','gun_grenade_meteor','shield','empty'],['shooter_meteor','shield','bagworm','empty']),
      A('エマ','EMA','スナイパー',[4,8,6],['egret','lightning','ibis','shield'],['shield','bagworm','empty','empty'])]},
    {id:'ikoma',ja:'イコマ隊',en:'IKOMA SQUAD',agents:[
      A('イコマ','IKOMA','アタッカー',[4,8,8],['kogetsu','senku','shield','empty'],['shield','bagworm','empty','empty']),
      A('ミズカミ','MIZUKAMI','シューター',[3,9,6],['shooter_asteroid','shooter_meteor','shield','empty'],['shooter_asteroid','shield','bagworm','empty']),
      A('オキ','OKI','スナイパー',[5,8,5],['egret','lightning','shield','empty'],['grasshopper','shield','bagworm','empty']),
      A('ミナミサワ','MINAMISAWA','アタッカー',[3,5,10],['kogetsu','senku','shield','empty'],['grasshopper','shield','bagworm','empty'])]},
    {id:'oji',ja:'オウジ隊',en:'OJI SQUAD',agents:[
      A('オウジ','OJI','アタッカー',[4,8,6],['kogetsu','senku','shield','shooter_hound'],['scorpion','grasshopper','shield','bagworm']),
      A('クラウチ','KURAUCHI','シューター',[4,8,6],['shooter_asteroid','shooter_meteor','shooter_hound','shield'],['shooter_hound','shield','bagworm','empty']),
      A('カシオ','KASHIO','アタッカー',[3,6,9],['kogetsu','senku','shield','shooter_hound'],['grasshopper','shield','bagworm','empty'])]},
    {id:'azuma',ja:'アズマ隊',en:'AZUMA SQUAD',agents:[
      A('アズマ','AZUMA','スナイパー',[4,13,4],['egret','lightning','ibis','shield'],['dummyBeacon','shield','bagworm','empty']),
      A('コアライ','KOARAI','アタッカー',[3,5,10],['kogetsu','senku','shield','empty'],['grasshopper','shield','bagworm','empty']),
      A('オクデラ','OKUDERA','アタッカー',[3,6,9],['kogetsu','senku','shield','empty'],['grasshopper','shield','bagworm','empty'])]},
    {id:'nasu',ja:'ナス隊',en:'NASU SQUAD',agents:[
      A('ナス','NASU','シューター',[5,10,5],['shooter_asteroid','shooter_viper','shooter_meteor','shield'],['shield','bagworm','empty','empty']),
      A('クマガイ','KUMAGAI','アタッカー',[3,6,9],['kogetsu','senku','shooter_meteor','shield'],['shield','bagworm','empty','empty']),
      A('ヒウラ','HIURA','スナイパー',[3,8,7],['egret','lightning','ibis','shield'],['shooter_meteor','shield','bagworm','empty'])]},
    {id:'yuba',ja:'ユバ隊',en:'YUBA SQUAD',agents:[
      A('ユバ','YUBA','ガンナー',[4,7,8],['gun_handgun_asteroid','gun_handgun_viper','shield','empty'],['gun_handgun_asteroid','gun_handgun_viper','shield','bagworm']),
      A('オビシマ','OBISHIMA','万能手',[3,6,9],['kogetsu','senku','gun_assault_asteroid','gun_assault_hound'],['grasshopper','shield','shield','bagworm']),
      A('トノオカ','TONOOKA','スナイパー',[4,9,5],['egret','lightning','ibis','shield'],['shield','bagworm','empty','empty'])]},
    {id:'kuruma',ja:'クルマ隊',en:'KURUMA SQUAD',agents:[
      A('クルマ','KURUMA','ガンナー',[4,7,7],['gun_assault_asteroid','gun_assault_hound','shield','empty'],['gun_assault_asteroid','shield','bagworm','empty']),
      A('ムラカミ','MURAKAMI','アタッカー',[4,8,8],['kogetsu','senku','shield','empty'],['raygust','thruster','shield','bagworm']),
      A('ベツヤク','BETSUYAKU','スナイパー',[3,8,7],['egret','lightning','ibis','shield'],['escudo','shield','bagworm','empty'])]},
    {id:'arafune',ja:'アラフネ隊',en:'ARAFUNE SQUAD',agents:[
      A('アラフネ','ARAFUNE','スナイパー',[4,11,5],['kogetsu','senku','egret','shield'],['shield','bagworm','empty','empty']),
      A('ホカリ','HOKARI','スナイパー',[4,7,7],['egret','shield','empty','empty'],['shield','bagworm','empty','empty']),
      A('ハンザキ','HANZAKI','スナイパー',[3,12,5],['egret','shield','empty','empty'],['shield','bagworm','empty','empty'])]},
    {id:'katori',ja:'カトリ隊',en:'KATORI SQUAD',agents:[
      A('カトリ','KATORI','万能手',[4,5,9],['scorpion','gun_handgun_asteroid','gun_handgun_hound','shield'],['scorpion','chameleon','shield','bagworm']),
      A('ミウラ','MIURA','アタッカー',[3,6,9],['kogetsu','senku','shield','empty'],['shield','bagworm','empty','empty']),
      A('ワカムラ','WAKAMURA','ガンナー',[4,7,7],['gun_assault_asteroid','gun_assault_hound','shield','empty'],['chameleon','shield','bagworm','empty'])]},
    {id:'suwa',ja:'スワ隊',en:'SUWA SQUAD',agents:[
      A('スワ','SUWA','ガンナー',[4,5,9],['gun_shotgun_asteroid','shield','starmaker','empty'],['gun_shotgun_asteroid','shield','bagworm','empty']),
      A('ツツミ','TSUTSUMI','ガンナー',[4,6,8],['gun_shotgun_asteroid','shield','starmaker','empty'],['gun_shotgun_asteroid','shield','bagworm','empty']),
      A('ササモリ','SASAMORI','アタッカー',[3,6,9],['kogetsu','senku','shield','empty'],['chameleon','shield','bagworm','empty'])]},
    {id:'kakizaki',ja:'カキザキ隊',en:'KAKIZAKI SQUAD',agents:[
      A('カキザキ','KAKIZAKI','万能手',[4,7,7],['kogetsu','senku','gun_assault_asteroid','gun_assault_meteor'],['shield','shield','bagworm','empty']),
      A('テルヤ','TERUYA','万能手',[4,8,6],['kogetsu','senku','gun_assault_asteroid','gun_assault_hound'],['shield','shield','bagworm','empty']),
      A('トモエ','TOMOE','ガンナー',[3,6,9],['kogetsu','gun_handgun_asteroid','gun_handgun_hound','shield'],['grasshopper','shield','bagworm','empty'])]}
  ];

  const SQUAD_COLORS={
    ninomiya:{body:'#2b3038',accent:'#d7dce2'}, tamakoma2:{body:'#2f6f9f',accent:'#d8efff'},
    kageura:{body:'#382f43',accent:'#bb8de0'}, ikoma:{body:'#8e3d2f',accent:'#f1c4b7'},
    oji:{body:'#263f70',accent:'#d8b35a'}, azuma:{body:'#315f62',accent:'#d5ecec'},
    nasu:{body:'#8b6eaf',accent:'#f1e8ff'}, yuba:{body:'#7e2f43',accent:'#e7c6cf'},
    kuruma:{body:'#39704c',accent:'#d6ecdc'}, arafune:{body:'#657044',accent:'#e2e6ca'},
    katori:{body:'#d16a32',accent:'#ffe0c7'}, suwa:{body:'#83383d',accent:'#efc9cc'},
    kakizaki:{body:'#385985',accent:'#d8e6f7'}
  };

  const NAMED_BEHAVIORS={
    NINOMIYA:{style:'artillery',preferredRange:430,aggression:.86,defense:.9,special:'ninomiya'},
    INUKAI:{style:'herder',preferredRange:300,aggression:.72,defense:.78,special:'herd'},
    TSUJI:{style:'guard',preferredRange:90,aggression:.7,defense:.9,special:'guardLeader'},
    MIKUMO:{style:'support',preferredRange:330,aggression:.42,defense:.78,special:'wireField'},
    KUGA:{style:'assassin',preferredRange:75,aggression:.96,defense:.72,special:'kuga'},
    AMATORI:{style:'sniper',preferredRange:760,aggression:.58,defense:.92,special:'chika'},
    HYUSE:{style:'controller',preferredRange:260,aggression:.78,defense:.84,special:'hyuse'},
    KAGEURA:{style:'berserker',preferredRange:70,aggression:.98,defense:.7,special:'hostilitySense'},
    KITAZOE:{style:'bombard',preferredRange:470,aggression:.74,defense:.7,special:'areaBombard'},
    EMA:{style:'sniper',preferredRange:720,aggression:.62,defense:.74,special:'coverSnipe'},
    IKOMA:{style:'senku',preferredRange:300,aggression:.9,defense:.72,special:'ikomaSenku'},
    MIZUKAMI:{style:'controller',preferredRange:380,aggression:.62,defense:.8,special:'tactician'},
    OKI:{style:'mobileSniper',preferredRange:720,aggression:.62,defense:.74,special:'mobileSnipe'},
    MINAMISAWA:{style:'rush',preferredRange:80,aggression:.98,defense:.55,special:'rush'},
    OJI:{style:'hunter',preferredRange:180,aggression:.88,defense:.8,special:'leaderHunter'},
    KURAUCHI:{style:'controller',preferredRange:360,aggression:.7,defense:.78,special:'compositeControl'},
    KASHIO:{style:'pincer',preferredRange:110,aggression:.84,defense:.72,special:'pincer'},
    AZUMA:{style:'predictiveSniper',preferredRange:820,aggression:.55,defense:.95,special:'prediction'},
    KOARAI:{style:'pairAttacker',preferredRange:85,aggression:.84,defense:.78,special:'pair'},
    OKUDERA:{style:'pairGuard',preferredRange:100,aggression:.72,defense:.88,special:'pair'},
    NASU:{style:'curvedShooter',preferredRange:410,aggression:.82,defense:.76,special:'birdcage'},
    KUMAGAI:{style:'bodyguard',preferredRange:90,aggression:.75,defense:.9,special:'guardLeader'},
    HIURA:{style:'sniper',preferredRange:700,aggression:.62,defense:.74,special:'terrainShot'},
    YUBA:{style:'duelist',preferredRange:165,aggression:.98,defense:.72,special:'quickdraw'},
    OBISHIMA:{style:'allrounder',preferredRange:180,aggression:.78,defense:.76,special:'yubaSetup'},
    TONOOKA:{style:'watcher',preferredRange:760,aggression:.45,defense:.82,special:'priorityWatch'},
    KURUMA:{style:'gunner',preferredRange:300,aggression:.72,defense:.82,special:'fullAttackWithMurakami'},
    MURAKAMI:{style:'tank',preferredRange:90,aggression:.78,defense:.98,special:'learningGuard'},
    BETSUYAKU:{style:'terrainSniper',preferredRange:720,aggression:.48,defense:.82,special:'escudoTerrain'},
    ARAFUNE:{style:'hybridSniper',preferredRange:720,aggression:.58,defense:.86,special:'hybrid'},
    HOKARI:{style:'sniper',preferredRange:760,aggression:.52,defense:.78,special:'spreadSnipe'},
    HANZAKI:{style:'precisionSniper',preferredRange:850,aggression:.45,defense:.82,special:'precision'},
    KATORI:{style:'adaptive',preferredRange:140,aggression:.96,defense:.64,special:'adaptive'},
    MIURA:{style:'bodyguard',preferredRange:90,aggression:.72,defense:.9,special:'guardLeader'},
    WAKAMURA:{style:'supportGunner',preferredRange:310,aggression:.58,defense:.82,special:'support'},
    SUWA:{style:'shotgunRush',preferredRange:120,aggression:.96,defense:.74,special:'shotgun'},
    TSUTSUMI:{style:'shotgunSupport',preferredRange:150,aggression:.82,defense:.8,special:'alternatingShotgun'},
    SASAMORI:{style:'ambusher',preferredRange:70,aggression:.88,defense:.68,special:'chameleonGrab'},
    KAKIZAKI:{style:'formationLead',preferredRange:190,aggression:.66,defense:.94,special:'formation'},
    TERUYA:{style:'formationFlex',preferredRange:170,aggression:.76,defense:.86,special:'formation'},
    TOMOE:{style:'formationRush',preferredRange:140,aggression:.86,defense:.76,special:'formation'}
  };
  const NAMED_TUNING_OVERRIDES={
    NINOMIYA:{offense:1.24,defense:1.15,cooldown:.74,reaction:.7,aim:.58,hp:1.08,trion:1.34,speed:.99},
    INUKAI:{offense:1.10,defense:1.08,cooldown:.79,reaction:.74,aim:.72,hp:1.04,trion:1.10,speed:1.04},
    TSUJI:{offense:1.10,defense:1.18,cooldown:.78,reaction:.7,aim:.78,hp:1.13,trion:1.03,speed:1.04},
    MIKUMO:{offense:.94,defense:1.07,cooldown:.72,reaction:.65,aim:.63,hp:.98,trion:.9,speed:1.00},
    KUGA:{offense:1.23,defense:1.08,cooldown:.66,reaction:.57,aim:.68,speed:1.22,hp:1.06,trion:1.04},
    AMATORI:{offense:1.36,defense:1.09,cooldown:.84,reaction:.7,aim:.54,trion:1.55,hp:.97,speed:.97},
    HYUSE:{offense:1.18,defense:1.15,cooldown:.73,reaction:.64,aim:.61,trion:1.30,hp:1.08,speed:1.06},
    KAGEURA:{offense:1.38,defense:1.18,cooldown:.58,reaction:.52,aim:.72,speed:1.18,hp:1.11,trion:1.04},
    KITAZOE:{offense:1.23,defense:1.12,cooldown:.72,reaction:.78,aim:.74,hp:1.10,trion:1.18,speed:.98},
    EMA:{offense:1.25,defense:1.10,cooldown:.68,reaction:.64,aim:.52,hp:1.00,trion:1.06,speed:1.02},
    IKOMA:{offense:1.23,defense:1.07,cooldown:.76,reaction:.70,aim:.68,speed:1.06,hp:1.07,trion:1.04},
    MIZUKAMI:{offense:1.00,defense:1.03,cooldown:.80,reaction:.57,aim:.57,hp:1.02,trion:1.00,speed:1.00},
    OKI:{offense:1.16,defense:1.08,cooldown:.68,reaction:.60,aim:.54,hp:1.02,trion:1.08,speed:1.12},
    MINAMISAWA:{offense:1.18,defense:1.02,cooldown:.70,reaction:.62,aim:.76,hp:1.10,trion:1.00,speed:1.18},
    OJI:{offense:1.14,defense:1.09,cooldown:.73,reaction:.58,aim:.61,speed:1.13,hp:1.07,trion:1.05},
    KURAUCHI:{offense:1.10,defense:1.07,cooldown:.75,reaction:.59,aim:.56,hp:1.04,trion:1.09,speed:1.02},
    KASHIO:{offense:1.18,defense:1.10,cooldown:.70,reaction:.60,aim:.68,hp:1.10,trion:1.02,speed:1.17},
    AZUMA:{offense:1.20,defense:1.19,cooldown:.70,reaction:.53,aim:.42,hp:1.06,trion:1.08,speed:1.03},
    KOARAI:{offense:1.17,defense:1.06,cooldown:.69,reaction:.66,aim:.76,hp:1.08,trion:1.00,speed:1.14},
    OKUDERA:{offense:1.12,defense:1.15,cooldown:.72,reaction:.63,aim:.72,hp:1.10,trion:1.00,speed:1.09},
    NASU:{offense:1.21,defense:1.07,cooldown:.67,reaction:.58,aim:.47,speed:1.10,hp:.99,trion:1.13},
    KUMAGAI:{offense:1.06,defense:1.10,cooldown:.78,reaction:.68,aim:.72,hp:1.09,trion:1.00,speed:1.05},
    HIURA:{offense:1.12,defense:1.04,cooldown:.75,reaction:.65,aim:.54,hp:1.01,trion:1.00,speed:1.04},
    YUBA:{offense:1.38,defense:1.13,cooldown:.50,reaction:.48,aim:.50,speed:1.14,hp:1.07,trion:1.05},
    OBISHIMA:{offense:1.13,defense:1.08,cooldown:.72,reaction:.69,aim:.67,speed:1.13,hp:1.06,trion:1.00},
    TONOOKA:{offense:1.13,defense:1.10,cooldown:.75,reaction:.58,aim:.46,speed:1.04,hp:1.00,trion:1.04},
    KURUMA:{offense:1.10,defense:1.14,cooldown:.74,reaction:.66,aim:.66,hp:1.09,trion:1.04,speed:1.00},
    MURAKAMI:{offense:1.15,defense:1.23,cooldown:.71,reaction:.60,aim:.68,hp:1.22,trion:1.05,speed:1.02},
    BETSUYAKU:{offense:1.07,defense:1.06,cooldown:.74,reaction:.67,aim:.56,hp:1.03,trion:1.00,speed:1.05},
    ARAFUNE:{offense:1.28,defense:1.17,cooldown:.62,reaction:.61,aim:.52,hp:1.08,trion:1.04,speed:1.06},
    HOKARI:{offense:1.22,defense:1.10,cooldown:.66,reaction:.68,aim:.57,hp:1.04,trion:1.04,speed:1.06},
    HANZAKI:{offense:1.29,defense:1.09,cooldown:.65,reaction:.58,aim:.39,hp:1.00,trion:1.00,speed:.99},
    KATORI:{offense:1.22,defense:1.02,cooldown:.63,reaction:.56,aim:.65,speed:1.18,hp:1.05,trion:1.05},
    MIURA:{offense:1.13,defense:1.18,cooldown:.71,reaction:.64,aim:.71,hp:1.11,trion:1.00,speed:1.07},
    WAKAMURA:{offense:1.06,defense:1.12,cooldown:.76,reaction:.75,aim:.68,hp:1.06,trion:1.04,speed:1.00},
    SUWA:{offense:1.21,defense:1.09,cooldown:.65,reaction:.62,aim:.72,speed:1.11,hp:1.09,trion:1.04},
    TSUTSUMI:{offense:1.16,defense:1.12,cooldown:.69,reaction:.62,aim:.67,hp:1.08,trion:1.04,speed:1.05},
    SASAMORI:{offense:1.15,defense:1.03,cooldown:.68,reaction:.60,aim:.73,hp:1.08,trion:1.00,speed:1.14},
    KAKIZAKI:{offense:1.08,defense:1.20,cooldown:.76,reaction:.66,aim:.66,hp:1.15,trion:1.04,speed:1.00},
    TERUYA:{offense:1.13,defense:1.13,cooldown:.70,reaction:.58,aim:.59,hp:1.08,trion:1.04,speed:1.07},
    TOMOE:{offense:1.15,defense:1.06,cooldown:.68,reaction:.63,aim:.67,hp:1.06,trion:1.00,speed:1.14}
  };
  // v105: 2026-07-22 generated league (12,596 matches) calibration.
  // This corrects systemic role/roster bias while preserving each agent's individual tuning.
  const SQUAD_BALANCE_V105={
    ninomiya:{offense:1.29,defense:1.19,cooldown:.84,reaction:.86,hp:1.09,trion:1.07,think:.70},
    tamakoma2:{offense:1.00,defense:1.00,cooldown:1.00,reaction:1.00,hp:1.00,think:1.00},
    kageura:{offense:1.20,defense:1.14,cooldown:.84,reaction:.90,speed:1.055,hp:1.08,trion:1.035,think:.75},
    ikoma:{offense:1.12,defense:1.07,cooldown:.90,reaction:.92,speed:1.025,hp:1.015,think:.83},
    oji:{offense:1.56,defense:1.40,cooldown:.64,reaction:.64,speed:1.14,hp:1.21,trion:1.12,think:.46},
    azuma:{offense:.89,defense:.93,cooldown:1.08,reaction:1.06,hp:.97,think:1.12},
    nasu:{offense:.96,defense:.97,cooldown:1.06,reaction:1.03,hp:.98,think:1.08},
    yuba:{offense:1.17,defense:1.10,cooldown:.91,reaction:.91,speed:1.05,hp:1.05,think:.86},
    kuruma:{offense:.80,defense:.84,cooldown:1.18,reaction:1.12,hp:.92,think:1.30},
    arafune:{offense:.78,defense:.85,cooldown:1.22,reaction:1.15,hp:.91,trion:.98,think:1.30},
    katori:{offense:.70,defense:.78,cooldown:1.28,reaction:1.18,hp:.86,think:1.42},
    suwa:{offense:.96,defense:.98,cooldown:1.05,reaction:1.03,hp:1.00,think:1.08},
    kakizaki:{offense:.61,defense:.67,cooldown:1.38,reaction:1.28,speed:.88,hp:.76,trion:.87,think:1.62},
  };
  function namedAgentData(name){for(const squad of SQUADS){const agent=squad.agents.find(a=>a.en===name);if(agent)return agent;}return null;}
  function namedTuningFor(name){
    const a=namedAgentData(name);if(!a)return null;
    const [trion,technique,combat]=a.stats.map(Number);
    const base={
      offense:clamp(.9+combat*.022+technique*.009,.96,1.2),
      defense:clamp(.91+combat*.014+technique*.008,.96,1.18),
      cooldown:clamp(1.08-technique*.026,.72,1),
      reaction:clamp(1.12-technique*.035,.58,1),
      aim:clamp(1.18-technique*.045,.5,1),
      speed:clamp(.96+combat*.012,.98,1.14),
      hp:clamp(.96+combat*.012,1,1.16),
      trion:clamp(.94+trion*.025,1,1.3)
    };
    const tuned=Object.assign(base,NAMED_TUNING_OVERRIDES[name]||{});
    const squad=SQUADS.find(item=>item.agents.some(agent=>agent.en===name));
    const balance=SQUAD_BALANCE_V105[squad?.id]||{};
    for(const key of ['offense','defense','cooldown','reaction','aim','speed','hp','trion']) if(Number.isFinite(balance[key])) tuned[key]*=balance[key];
    tuned.cooldown=clamp(tuned.cooldown,.46,1.35);tuned.reaction=clamp(tuned.reaction,.38,1.35);tuned.aim=clamp(tuned.aim,.34,1.25);
    tuned.offense=clamp(tuned.offense,.68,1.75);tuned.defense=clamp(tuned.defense,.72,1.55);tuned.speed=clamp(tuned.speed,.82,1.38);tuned.hp=clamp(tuned.hp,.72,1.55);tuned.trion=clamp(tuned.trion,.78,1.65);
    tuned.think=Number(balance.think)||1;
    return tuned;
  }
  function applyNamedTuning(p){
    if(!p?.v78Named||p.v96TuningApplied)return;
    const t=namedTuningFor(p.v78Named);if(!t)return;
    p.v96Tuning=t;p.v96TuningApplied=true;
    if(Number.isFinite(p.maxHp)){p.maxHp=Math.max(1,p.maxHp*t.hp);p.hp=p.maxHp;}
    if(Number.isFinite(p.maxTrion)){p.maxTrion=Math.max(p.maxTrion,p.maxTrion*t.trion);p.trion=p.maxTrion;}
    if(Number.isFinite(p.speed)){p.speed*=t.speed;p.v96NamedSpeed=p.speed;}
    p.ai=p.ai&&typeof p.ai==='object'?p.ai:{};
    p.ai.v96AimScale=t.aim;p.ai.v96ReactionScale=t.reaction;p.ai.v96Named=true;
  }
  const squadLeaderName={ninomiya:'NINOMIYA',tamakoma2:'MIKUMO',kageura:'KAGEURA',ikoma:'IKOMA',oji:'OJI',azuma:'AZUMA',nasu:'NASU',yuba:'YUBA',kuruma:'KURUMA',arafune:'ARAFUNE',katori:'KATORI',suwa:'SUWA',kakizaki:'KAKIZAKI'};
  function alliesOf(g,p){return (g.players||[]).filter(t=>t!==p&&!t.dead&&t.team===p.team)}
  function enemiesOf(g,p){return (g.players||[]).filter(t=>t!==p&&!t.dead&&g.canDamage?.(p,t))}
  function nearest(list,p){return list.map(t=>({t,d:Math.hypot(t.x-p.x,t.y-p.y)})).sort((a,b)=>a.d-b.d)[0]||null}
  function setAiTarget(p,target){
    if(!p||!target)return;
    p.ai=p.ai&&typeof p.ai==='object'?p.ai:{};
    p.ai.target=target.id??null;
    p.ai.targetType='player';
    delete p.ai.targetId;
    delete p.ai.targetPlayer;
  }
  function sanitizeAiState(p){
    const ai=p?.ai;if(!ai||typeof ai!=='object')return;
    const targetObject=ai.target&&typeof ai.target==='object'?ai.target:null;
    const legacyTarget=ai.targetPlayer&&typeof ai.targetPlayer==='object'?ai.targetPlayer:null;
    if(targetObject||legacyTarget)ai.target=(targetObject||legacyTarget)?.id??null;
    else if(ai.target!=null&&typeof ai.target!=='string'&&typeof ai.target!=='number')ai.target=null;
    if(ai.targetId&&typeof ai.targetId==='object')ai.targetId=ai.targetId.id??null;
    delete ai.targetPlayer;
    delete ai.targetId;
    if(ai.target&&!ai.targetType)ai.targetType='player';
  }
  function safeLogValue(value,seen=new WeakSet(),depth=0){
    if(value==null||typeof value==='string'||typeof value==='number'||typeof value==='boolean')return value;
    if(typeof value==='bigint')return Number(value);
    if(typeof value==='function'||typeof value==='symbol'||typeof value==='undefined')return null;
    if(depth>7)return '[MaxDepth]';
    if(typeof value!=='object')return String(value);
    if(seen.has(value))return '[Circular]';
    seen.add(value);
    if(Array.isArray(value))return value.slice(0,80).map(item=>safeLogValue(item,seen,depth+1));
    const result={};
    for(const [key,item] of Object.entries(value)){
      if(['game','owner','source','targetPlayer'].includes(key)&&item&&typeof item==='object'){
        result[key+'Id']=item.id??null;
        continue;
      }
      result[key]=safeLogValue(item,seen,depth+1);
    }
    return result;
  }
  function battleTimeout(g,p,callback,delay,target=null){
    return setTimeout(()=>{
      if(currentGame!==g||!Array.isArray(g?.players)||!g.players.includes(p)||p.dead)return;
      if(target&&(!g.players.includes(target)||target.dead))return;
      callback();
    },delay);
  }
  function nudgeToward(p,x,y,amount){const a=Math.atan2(y-p.y,x-p.x);p.vx=(p.vx||0)+Math.cos(a)*amount;p.vy=(p.vy||0)+Math.sin(a)*amount;}
  function nudgeAway(p,x,y,amount){const a=Math.atan2(p.y-y,p.x-x);p.vx=(p.vx||0)+Math.cos(a)*amount;p.vy=(p.vy||0)+Math.sin(a)*amount;}
  function selectTrigger(p,id){p.selected=p.selected&&typeof p.selected==='object'?p.selected:{main:0,sub:0};for(const hand of ['main','sub']){const i=(p.loadout?.[hand]||[]).indexOf(id);if(i>=0){p.selected[hand]=i;return hand;}}return null;}
  function tryNamedUse(g,p,id){const hand=selectTrigger(p,id);if(!hand)return false;try{return !!g.tryUseHand?.(p,hand)}catch{return false}}
  const NAMED_CAPTAINS=new Set(['NINOMIYA','MIKUMO','KAGEURA','IKOMA','OJI','AZUMA','NASU','YUBA','KURUMA','ARAFUNE','KATORI','SUWA','KAKIZAKI']);
  function namedState(p){return p.v100NamedState||(p.v100NamedState={cooldowns:{},cycle:0,shots:0,lastX:p.x,lastY:p.y,lastMoveAt:0});}
  function stableSide(p){return String(p?.id||p?.v78Named||'').split('').reduce((n,c)=>n+c.charCodeAt(0),0)%2?1:-1;}
  function ratio(p){return Math.max(0,Math.min(1,(Number(p?.hp)||0)/Math.max(1,Number(p?.maxHp)||Number(p?.hp)||1)));}
  function ready(state,key,seconds){const now=mobilityNow(),until=Number(state.cooldowns[key]||0);if(now<until)return false;state.cooldowns[key]=now+seconds*1000;return true;}
  function findMember(list,name){return list.find(a=>a?.v78Named===name&&!a.dead)||null;}
  function targetThreatening(g,ally,enemies){if(!ally)return null;return enemies.map(t=>({t,score:(t.ai?.target===ally.id?500:0)-Math.hypot(t.x-ally.x,t.y-ally.y)})).sort((a,b)=>b.score-a.score)[0]?.t||null;}
  function clusterTarget(enemies){return enemies.map(t=>({t,score:enemies.filter(e=>e!==t&&Math.hypot(e.x-t.x,e.y-t.y)<170).length})).sort((a,b)=>b.score-a.score)[0]?.t||enemies[0]||null;}
  function selectedId(p,hand){return p?.loadout?.[hand]?.[p?.selected?.[hand]??0]||'empty';}
  function useNamedTrigger(g,p,id,options={}){const hand=selectTrigger(p,id);if(!hand)return false;try{return !!g.tryUseHand?.(p,hand,options);}catch(_){return false;}}
  function useShooterCycle(g,p,id,division=1){const hand=selectTrigger(p,id);if(!hand)return false;p.shooterCharges=p.shooterCharges||{main:null,sub:null};const charge=p.shooterCharges[hand];try{
      if(!charge)return !!g.tryUseHand?.(p,hand);
      if(!charge.ready)return false;
      let guard=0;while((charge.division||1)<division&&guard++<6){if(!g.tryUseHand?.(p,hand,{shift:true}))break;}
      return !!g.tryUseHand?.(p,hand);
    }catch(_){return false;}}
  function findTriggerSlot(p,id,hand){const index=(p?.loadout?.[hand]||[]).indexOf(id);return index>=0?{hand,index}:null;}
  function tryNamedComposite(g,p,idA,idB){let a=findTriggerSlot(p,idA,'main'),b=findTriggerSlot(p,idB,'sub');if(!a||!b){a=findTriggerSlot(p,idB,'main');b=findTriggerSlot(p,idA,'sub');}if(!a||!b||typeof g.tryCombo!=='function')return false;p.selected=p.selected||{main:0,sub:0};p.selected.main=a.index;p.selected.sub=b.index;try{g.tryCombo(p);return Boolean(p.pendingComposite);}catch(_){return false;}}
  function useBoth(g,p,idMain,idSub=idMain){let a=findTriggerSlot(p,idMain,'main'),b=findTriggerSlot(p,idSub,'sub');if(!a||!b){const swappedA=findTriggerSlot(p,idSub,'main'),swappedB=findTriggerSlot(p,idMain,'sub');if(swappedA&&swappedB){a=swappedA;b=swappedB;}}let used=false;if(a){p.selected.main=a.index;used=Boolean(g.tryUseHand?.(p,'main'))||used;}if(b){p.selected.sub=b.index;used=Boolean(g.tryUseHand?.(p,'sub'))||used;}return used;}
  function directSlash(g,p,target,{range=110,damage=24,arc=.7,name='変則斬撃',sourceKey='namedSlash',knock=110}={}){if(!target||target.dead||Math.hypot(target.x-p.x,target.y-p.y)>range+(target.radius||18))return false;p.aim=Math.atan2(target.y-p.y,target.x-p.x);g.effects?.push({type:'slash',x:p.x,y:p.y,angle:p.aim,range,arc,style:sourceKey,ttl:.24,maxTtl:.24});const hit=g.damagePlayer?.(target,damage*(.82+(p.stats?.combat||0)*.045),p,{x:p.x,y:p.y,type:'melee',name,sourceKey});if(hit){target.vx=(target.vx||0)+Math.cos(p.aim)*knock;target.vy=(target.vy||0)+Math.sin(p.aim)*knock;}return Boolean(hit);}
  function placeMeteorMine(g,p,target){if(!g||!p||!target)return false;g.mines=Array.isArray(g.mines)?g.mines:[];const own=g.mines.filter(m=>m?.ownerId===p.id&&m?.sourceKey==='meteorMine');if(own.length>=2)return false;const lead=.38,x=target.x+(target.vx||0)*lead,y=target.y+(target.vy||0)*lead;g.mines.push({x,y,radius:11,team:p.team,ownerId:p.id,damage:48+(p.stats?.trion||0)*2.4,explosionRadius:132,hp:10,ttl:35,sourceName:'設置メテオラ',sourceKey:'meteorMine'});g.effects?.push({type:'bind',x,y,ttl:.35,maxTtl:.35,v100Mine:true});return true;}
  function squadOrders(g){return g.v100SquadOrders||(g.v100SquadOrders={});}
  function orderTarget(g,p,target,ttl=2200){if(!target)return;squadOrders(g)[p.team]={targetId:target.id,until:mobilityNow()+ttl,issuer:p.v78Named};}
  function orderedTarget(g,p,enemies){const order=squadOrders(g)[p.team];if(!order||mobilityNow()>order.until)return null;return enemies.find(e=>e.id===order.targetId)||null;}
  function hasWallBetween(g,a,b){if(typeof g.findBlockingWall==='function')return Boolean(g.findBlockingWall(a.x,a.y,b.x,b.y,3));for(const w of g.walls||[]){if(!w||!Number.isFinite(w.x)||!Number.isFinite(w.w))continue;const cx=w.x+w.w/2,cy=w.y+w.h/2,r=Math.hypot(w.w,w.h)*.42;if(segDist(a.x,a.y,b.x,b.y,cx,cy).d<r)return true;}return false;}
  function projectileThreatFor(g,p,horizon=.9){let best=null;for(const q of g.projectiles||[]){if(q.ownerId===p.id||(q.team===p.team&&(g.config?.mode==='team'||g.isDefenseMode)))continue;const rx=q.x-p.x,ry=q.y-p.y,rvx=(q.vx||0)-(p.vx||0),rvy=(q.vy||0)-(p.vy||0),vv=rvx*rvx+rvy*rvy;if(vv<1)continue;const t=-(rx*rvx+ry*rvy)/vv;if(t<0||t>horizon)continue;const miss=Math.hypot(rx+rvx*t,ry+rvy*t);if(miss>(p.radius||18)+(q.radius||5)+24)continue;if(!best||t<best.t)best={q,t,angle:Math.atan2(-rvy,-rvx)};}return best;}
  function strafe(p,target,amount,side=stableSide(p)){const a=Math.atan2(target.y-p.y,target.x-p.x)+side*Math.PI/2;p.vx=(p.vx||0)+Math.cos(a)*amount;p.vy=(p.vy||0)+Math.sin(a)*amount;}
  function maintainRange(p,target,desired,b,dt){const d=Math.hypot(target.x-p.x,target.y-p.y);if(d>desired*1.13)nudgeToward(p,target.x,target.y,(b.aggression||.7)*36*dt);else if(d<desired*.78)nudgeAway(p,target.x,target.y,(b.defense||.7)*42*dt);else strafe(p,target,18*dt);return d;}
  function setAimLead(p,target,lead=.3){p.aim=Math.atan2(target.y+(target.vy||0)*lead-p.y,target.x+(target.vx||0)*lead-p.x);}
  function markShotProfile(p,profile){p.v100ShotProfile=profile;}
  function activateGuard(g,p){if(hasTrigger(p,'shield'))return useNamedTrigger(g,p,'shield');if(hasTrigger(p,'raygust'))return useNamedTrigger(g,p,'raygust',{shift:true});return false;}
  function updateNamedStatus(g,dt){for(const p of g.players||[]){if((p.v100Restrained||0)>0){p.v100Restrained=Math.max(0,p.v100Restrained-dt);p.vx=(p.vx||0)*Math.max(0,1-dt*8);p.vy=(p.vy||0)*Math.max(0,1-dt*8);p.ai=p.ai||{};p.ai.attackTimer=Math.max(p.ai.attackTimer||0,p.v100Restrained+.15);}if(p.v78Named==='MURAKAMI'){delete p.v79DefenseScale;}if(p.v78Squad==='kakizaki'){const near=(g.players||[]).filter(a=>a!==p&&!a.dead&&a.team===p.team&&a.v78Squad==='kakizaki'&&Math.hypot(a.x-p.x,a.y-p.y)<230).length;p.v100FormationDefense=near>=2?1.04:near?1.02:1;}else p.v100FormationDefense=1;}}
  function tagCanonicalProjectiles(g,p,before){const profile=p?.v100ShotProfile;if(!profile)return;for(const key of ['projectiles','bullets','shots']){const arr=g[key];if(!Array.isArray(arr))continue;for(let i=before[key]||0;i<arr.length;i++){const q=arr[i],owner=q?.ownerId??q?.playerId??q?.sourceId??q?.owner?.id;if(owner!==p.id&&q?.owner!==p&&q?.source!==p)continue;if(profile.kind==='ninomiyaSmall'){q.radius=Math.max(2,(q.radius||6)*.64);q.damage=(q.damage||10)*.72;q.vx*=1.24;q.vy*=1.24;q.speed=(q.speed||Math.hypot(q.vx||0,q.vy||0))*1.24;}
        if(profile.kind==='ninomiyaLarge'){q.radius=(q.radius||6)*1.52;q.damage=(q.damage||10)*1.38;q.vx*=.76;q.vy*=.76;q.speed=(q.speed||Math.hypot(q.vx||0,q.vy||0))*.76;}
        if(profile.kind==='mikumoSlow'){q.damage=(q.damage||10)*1.18;q.vx*=.30;q.vy*=.30;q.speed=(q.speed||Math.hypot(q.vx||0,q.vy||0))*.30;q.life=(q.life||1)*2.1;q.v100PlacedShot=true;}
        if(profile.kind==='chikaLead'){q.lead=true;q.shieldPierce=true;q.leadWeight=3+Math.floor((p.stats?.trion||0)/5);q.damage=0;q.vx*=.86;q.vy*=.86;q.speed=(q.speed||Math.hypot(q.vx||0,q.vy||0))*.86;}
        if(profile.kind==='tonookaWatch'){q.damage=(q.damage||10)*1.18;q.vx*=1.08;q.vy*=1.08;}
      }}delete p.v100ShotProfile;}
  function namedDamageAdjustment(target,amount,source,meta){const key=String(meta?.sourceKey||meta?.name||meta?.type||'unknown');if(source?.v96Tuning?.offense)amount*=source.v96Tuning.offense;if(target?.v96Tuning?.defense)amount/=target.v96Tuning.defense;if(target?.v78Named==='MURAKAMI'){target.v100LearnedSources=target.v100LearnedSources||{};const seen=Number(target.v100LearnedSources[key]||0);amount*=Math.max(.68,1-seen*.065);target.v100LearnedSources[key]=Math.min(5,seen+1);}if(target?.v78Named==='KUGA'){target.v100ObservedSources=target.v100ObservedSources||{};const seen=Number(target.v100ObservedSources[key]||0);amount*=Math.max(.84,1-seen*.035);target.v100ObservedSources[key]=Math.min(4,seen+1);}if(target?.v78Named==='KAGEURA'&&source&&meta?.type!=='hazard'&&meta?.type!=='explosion')amount*=.80;if(target?.v100FormationDefense)amount/=target.v100FormationDefense;return amount;}
  function applyNamedBehavior(g,p,dt){
    const b=NAMED_BEHAVIORS[p.v78Named];if(!b||p.dead||p.human)return;
    p.v79Behavior=b;p.ai=p.ai||{};if(mobilityNow()<Number(p.ai.v98HazardUntil||0))return;const state=namedState(p);p.v79Think=Math.max(0,(p.v79Think||0)-dt);
    const enemies=enemiesOf(g,p),allies=alliesOf(g,p);if(!enemies.length)return;
    let target=orderedTarget(g,p,enemies)||nearest(enemies,p)?.t;
    if(b.special==='leaderHunter'){const leaders=enemies.filter(t=>NAMED_CAPTAINS.has(t.v78Named));target=nearest(leaders,p)?.t||target;}
    if(b.special==='priorityWatch'){const priority=enemies.filter(t=>['AMATORI','NINOMIYA','NASU','AZUMA'].includes(t.v78Named));target=nearest(priority,p)?.t||target;}
    const leader=findMember(allies,squadLeaderName[p.v78Squad]);
    if(['guardLeader','bodyguard'].includes(b.special)&&leader)target=targetThreatening(g,leader,enemies)||target;
    setAiTarget(p,target);if(!target)return;setAimLead(p,target,.08+(p.stats?.technique||0)*.018);
    let d=maintainRange(p,target,b.preferredRange||240,b,dt);
    if(p.v79Think>0)return;p.v79Think=(.24+Math.random()*.18)*(p.v96Tuning?.reaction||1)*(p.v96Tuning?.think||1);
    const now=mobilityNow(),side=stableSide(p),name=p.v78Named;
    switch(name){
      case 'NINOMIYA':{
        const shielded=Boolean(target.shields?.main||target.shields?.sub),mode=state.cycle++%4;
        if(mode===0){markShotProfile(p,{kind:'ninomiyaSmall'});useShooterCycle(g,p,'shooter_hound',4);}
        else if(mode===1){markShotProfile(p,{kind:'ninomiyaLarge'});useShooterCycle(g,p,'shooter_asteroid',1);}
        else if(mode===2&&tryNamedComposite(g,p,'shooter_asteroid','shooter_asteroid')){}
        else {markShotProfile(p,{kind:shielded?'ninomiyaLarge':'ninomiyaSmall'});useBoth(g,p,'shooter_asteroid','shooter_hound');}
        break;}
      case 'INUKAI':{
        const n=findMember(allies,'NINOMIYA'),anchor=n||leader;if(anchor){const a=Math.atan2(target.y-anchor.y,target.x-anchor.x)+Math.PI;nudgeToward(p,target.x+Math.cos(a)*150,target.y+Math.sin(a)*150,90);}if(d<115)useNamedTrigger(g,p,'scorpion');else{useNamedTrigger(g,p,'gun_assault_hound');const old=p.aim;p.aim+=side*.62;useShooterCycle(g,p,'shooter_hound',3);p.aim=old;}break;}
      case 'TSUJI':{
        const n=findMember(allies,'NINOMIYA');if(n){const threat=targetThreatening(g,n,enemies);if(threat){target=threat;setAiTarget(p,target);d=Math.hypot(target.x-p.x,target.y-p.y);setAimLead(p,target,.05);}if(Math.hypot(n.x-p.x,n.y-p.y)>135)nudgeToward(p,n.x,n.y,120);}if(projectileThreatFor(g,p,.55))activateGuard(g,p);if(d<115)useNamedTrigger(g,p,'kogetsu');else if(d<310)useNamedTrigger(g,p,'senku');break;}
      case 'MIKUMO':{
        const kuga=findMember(allies,'KUGA'),wireCenter=kuga||p;if(ready(state,'wire',1.65)){p.spiderMode=0;p.ai.placePoint={x:target.x+(target.vx||0)*.55+Math.cos(p.aim+side*1.15)*95,y:target.y+(target.vy||0)*.55+Math.sin(p.aim+side*1.15)*95};useNamedTrigger(g,p,'spider');}
        if(ready(state,'slowShot',2.1)){markShotProfile(p,{kind:'mikumoSlow'});useShooterCycle(g,p,'shooter_asteroid',3);}if(d<125){useNamedTrigger(g,p,'raygust',{shift:true});useNamedTrigger(g,p,'thruster');}if(kuga&&Math.hypot(wireCenter.x-p.x,wireCenter.y-p.y)>260)nudgeToward(p,wireCenter.x,wireCenter.y,65);break;}
      case 'KUGA':{
        const threat=projectileThreatFor(g,p,.48);if(threat){const a=threat.angle+side*Math.PI/2;p.vx+=Math.cos(a)*180;p.vy+=Math.sin(a)*180;}
        const nearbyWires=(g.wires||[]).filter(w=>w.ownerId!==p.id&&w.team===p.team&&Math.hypot((w.x1+w.x2)/2-p.x,(w.y1+w.y2)/2-p.y)<300);if(nearbyWires.length&&d<320&&ready(state,'wirePin',2.5))pinballFor(g,p,true,target,true);else if(d>150&&ready(state,'hop',.65))useNamedTrigger(g,p,'grasshopper');if(d<260&&hasTrigger(p,'scorpion')&&ready(state,'mantis',1.45))tryNamedComposite(g,p,'scorpion','scorpion');if(d<115)useNamedTrigger(g,p,'scorpion');if(ready(state,'mole',1.8))moleClaw(g,p,true);break;}
      case 'AMATORI':{
        const close=nearest(enemies,p);if(close&&close.d<260){p.ai.dodgeTimer=Math.max(p.ai.dodgeTimer||0,.5);nudgeAway(p,close.t.x,close.t.y,220);activateGuard(g,p);break;}if(Math.hypot(p.vx||0,p.vy||0)<35&&d>520)useNamedTrigger(g,p,'bagworm');if(ready(state,'chikaShot',1.8)){if(Math.hypot(target.vx||0,target.vy||0)>120){markShotProfile(p,{kind:'chikaLead'});useNamedTrigger(g,p,'lightning');}else if(hasWallBetween(g,p,target))useNamedTrigger(g,p,'ibis');else if(enemies.filter(e=>Math.hypot(e.x-target.x,e.y-target.y)<150).length>1)useShooterCycle(g,p,'shooter_meteor',2);else useNamedTrigger(g,p,d>680?'ibis':'egret');}break;}
      case 'HYUSE':{
        const reveal=(Number(g.elapsed)||0)>18||ratio(p)<.68||NAMED_CAPTAINS.has(target.v78Named);if(d<230&&ready(state,'escudo',1.15)){for(const off of [-.42,.42]){const old=p.aim;p.aim+=off;useNamedTrigger(g,p,'escudo');p.aim=old;}}if(reveal&&d>160){makeViperPlan(g,p,target);useShooterCycle(g,p,'shooter_viper',3);}else if(d<310)useNamedTrigger(g,p,d<120?'kogetsu':'senku');break;}
      case 'KAGEURA':{
        const threat=projectileThreatFor(g,p,.75);if(threat){const a=threat.angle+side*Math.PI/2;p.vx+=Math.cos(a)*250;p.vy+=Math.sin(a)*250;p.ai.dodgeTimer=Math.max(p.ai.dodgeTimer||0,.35);}if(d<260&&ready(state,'mantis',1.15))tryNamedComposite(g,p,'scorpion','scorpion');if(d<120)useNamedTrigger(g,p,'scorpion');break;}
      case 'KITAZOE':{
        target=clusterTarget(enemies)||target;setAiTarget(p,target);const escape=Math.atan2(target.vy||0,target.vx||0);p.aim=Number.isFinite(escape)&&Math.hypot(target.vx||0,target.vy||0)>30?escape:p.aim;if(ready(state,'bomb',1.65))useNamedTrigger(g,p,hasTrigger(p,'gun_grenade_meteor')?'gun_grenade_meteor':'shooter_meteor');break;}
      case 'EMA':{
        const k=findMember(allies,'KAGEURA'),z=findMember(allies,'KITAZOE'),threat=targetThreatening(g,k||z,enemies);if(threat)target=threat;setAiTarget(p,target);setAimLead(p,target,.38);useNamedTrigger(g,p,Math.hypot(target.x-p.x,target.y-p.y)>620?'egret':'lightning');break;}
      case 'IKOMA': if(d>145&&d<540){p.v79IkomaSenku=true;useNamedTrigger(g,p,'senku');p.v79IkomaSenku=false;}else if(d<135)useNamedTrigger(g,p,'kogetsu');break;
      case 'MIZUKAMI':{
        const iko=findMember(allies,'IKOMA'),candidate=enemies.slice().sort((a,c)=>Math.abs(Math.hypot(a.x-(iko?.x||p.x),a.y-(iko?.y||p.y))-300)-Math.abs(Math.hypot(c.x-(iko?.x||p.x),c.y-(iko?.y||p.y))-300))[0]||target;target=candidate;orderTarget(g,p,target,2400);setAiTarget(p,target);if(d<520)useShooterCycle(g,p,enemies.filter(e=>Math.hypot(e.x-target.x,e.y-target.y)<150).length>1?'shooter_meteor':'shooter_asteroid',3);break;}
      case 'OKI':{
        const moved=Math.hypot(p.x-state.lastX,p.y-state.lastY);if(moved<35&&state.shots>0&&ready(state,'relocate',1.2)){p.aim+=side*1.2;useNamedTrigger(g,p,'grasshopper');state.lastX=p.x;state.lastY=p.y;}else{setAimLead(p,target,.34);if(useNamedTrigger(g,p,d>680?'egret':'lightning'))state.shots++;}break;}
      case 'MINAMISAWA':{
        const water=findMember(allies,'MIZUKAMI'),order=orderedTarget(g,p,enemies);if(water&&!order&&d>130){nudgeToward(p,water.x,water.y,70);break;}if(d>125)useNamedTrigger(g,p,'grasshopper');if(d<320)useNamedTrigger(g,p,d<130?'kogetsu':'senku');break;}
      case 'OJI':{
        const leaders=enemies.filter(e=>NAMED_CAPTAINS.has(e.v78Named)),isolated=enemies.slice().sort((a,c)=>enemies.filter(e=>e!==a&&Math.hypot(e.x-a.x,e.y-a.y)<260).length-enemies.filter(e=>e!==c&&Math.hypot(e.x-c.x,e.y-c.y)<260).length)[0];target=nearest(leaders,p)?.t||isolated||target;orderTarget(g,p,target,2600);setAiTarget(p,target);if(d>170)useNamedTrigger(g,p,'shooter_hound');if(d>130&&d<360)useNamedTrigger(g,p,'grasshopper');if(d<210)useNamedTrigger(g,p,d<105?'scorpion':'kogetsu');break;}
      case 'KURAUCHI':{
        target=orderedTarget(g,p,enemies)||target;setAiTarget(p,target);const fast=Math.hypot(target.vx||0,target.vy||0)>150;if(fast)tryNamedComposite(g,p,'shooter_hound','shooter_hound');else if(hasWallBetween(g,p,target)||enemies.filter(e=>Math.hypot(e.x-target.x,e.y-target.y)<150).length>1)tryNamedComposite(g,p,'shooter_hound','shooter_meteor');else useShooterCycle(g,p,'shooter_hound',3);break;}
      case 'KASHIO':{
        target=orderedTarget(g,p,enemies)||target;const oji=findMember(allies,'OJI');if(oji){const a=Math.atan2(target.y-oji.y,target.x-oji.x)+side*Math.PI/2;nudgeToward(p,target.x+Math.cos(a)*120,target.y+Math.sin(a)*120,125);}if(d>135)useShooterCycle(g,p,'shooter_hound',2);if(d>115)useNamedTrigger(g,p,'grasshopper');if(d<220)useNamedTrigger(g,p,d<110?'kogetsu':'senku');break;}
      case 'AZUMA':{
        if(ready(state,'beacon',4.2)){const old=p.aim;p.aim+=side*1.3;useNamedTrigger(g,p,'dummyBeacon');p.aim=old;}setAimLead(p,target,.65+(p.stats?.technique||0)*.02);if(d>360&&ready(state,'snipe',.85)){useNamedTrigger(g,p,hasWallBetween(g,p,target)?'ibis':d>720?'egret':'lightning');state.postShot=now+700;}if(now<Number(state.postShot||0))nudgeAway(p,target.x,target.y,145);break;}
      case 'KOARAI':{
        const mate=findMember(allies,'OKUDERA'),order=orderedTarget(g,p,enemies);if(!order&&findMember(allies,'AZUMA')&&mate&&Math.hypot(mate.x-p.x,mate.y-p.y)>180){nudgeToward(p,mate.x,mate.y,100);break;}target=order||target;if(mate){const a=Math.atan2(target.y-mate.y,target.x-mate.x)+side*Math.PI/2;nudgeToward(p,target.x+Math.cos(a)*90,target.y+Math.sin(a)*90,120);}if(d>135)useNamedTrigger(g,p,'grasshopper');if(d<250)useNamedTrigger(g,p,d<115?'kogetsu':'senku');break;}
      case 'OKUDERA':{
        const mate=findMember(allies,'KOARAI');if(mate&&Math.hypot(mate.x-p.x,mate.y-p.y)>155)nudgeToward(p,mate.x,mate.y,115);const az=findMember(allies,'AZUMA');if(az){const line=Math.atan2(target.y-az.y,target.x-az.x);nudgeToward(p,target.x-Math.cos(line)*105,target.y-Math.sin(line)*105,80);}if(projectileThreatFor(g,mate||p,.55))activateGuard(g,p);if(d<130)useNamedTrigger(g,p,'kogetsu');else if(d<300)useNamedTrigger(g,p,'senku');break;}
      case 'NASU':{
        const fast=Math.hypot(target.vx||0,target.vy||0)>120;if(ready(state,'tomahawk',3.1)&&enemies.filter(e=>Math.hypot(e.x-target.x,e.y-target.y)<145).length>1)tryNamedComposite(g,p,'shooter_viper','shooter_meteor');else{makeViperPlan(g,p,target);useShooterCycle(g,p,'shooter_viper',fast?4:3);}strafe(p,target,45,side);break;}
      case 'KUMAGAI':{
        const nasu=findMember(allies,'NASU');if(nasu&&Math.hypot(nasu.x-p.x,nasu.y-p.y)>150)nudgeToward(p,nasu.x,nasu.y,120);if(ready(state,'mine',4.2))placeMeteorMine(g,p,target);if(ratio(p)<.24&&d<120&&ready(state,'trade',99)){g.explode?.(p.x,p.y,145,64+(p.stats?.trion||0)*2,p.id,p.team,null,'相打ちメテオラ',{sourceKey:'meteorMine'});}if(d<135)useNamedTrigger(g,p,'kogetsu');else if(d<300)useNamedTrigger(g,p,'senku');break;}
      case 'HIURA':{
        if(hasWallBetween(g,p,target)&&ready(state,'terrain',2.6))useShooterCycle(g,p,'shooter_meteor',2);else useNamedTrigger(g,p,d>650?'ibis':d>440?'egret':'lightning');if(ready(state,'move',1.8)){strafe(p,target,190,side);state.lastX=p.x;state.lastY=p.y;}break;}
      case 'YUBA':{
        if(d>245)nudgeToward(p,target.x,target.y,160);if(d<245&&ready(state,'quickdraw',.46)){p.v79QuickdrawUntil=now+430;useBoth(g,p,'gun_handgun_asteroid','gun_handgun_viper');battleTimeout(g,p,()=>useBoth(g,p,'gun_handgun_viper','gun_handgun_asteroid'),95,target);}break;}
      case 'OBISHIMA':{
        const yuba=findMember(allies,'YUBA');if(yuba){const a=Math.atan2(target.y-yuba.y,target.x-yuba.x)+Math.PI;nudgeToward(p,target.x+Math.cos(a)*120,target.y+Math.sin(a)*120,115);}if(d>190)useNamedTrigger(g,p,'gun_assault_hound');if(d>125&&d<340)useNamedTrigger(g,p,'grasshopper');if(d<180)useNamedTrigger(g,p,d<105?'kogetsu':'senku');break;}
      case 'TONOOKA':{
        const valuable=target.shooterCharges?.main||target.shooterCharges?.sub||target.pendingComposite||Math.hypot(target.vx||0,target.vy||0)<35||ratio(target)<.45;if(valuable&&ready(state,'watchShot',1.05)){markShotProfile(p,{kind:'tonookaWatch'});setAimLead(p,target,.52);useNamedTrigger(g,p,d>650?'egret':'lightning');}else{p.vx*=.96;p.vy*=.96;}break;}
      case 'KURUMA':{
        const mura=findMember(allies,'MURAKAMI'),protectedNow=mura&&Math.hypot(mura.x-p.x,mura.y-p.y)<175;if(protectedNow&&d<480){useBoth(g,p,'gun_assault_asteroid','gun_assault_hound');}else{activateGuard(g,p);if(d<400)useNamedTrigger(g,p,'gun_assault_asteroid');if(mura&&Math.hypot(mura.x-p.x,mura.y-p.y)>220)nudgeToward(p,mura.x,mura.y,90);}break;}
      case 'MURAKAMI':{
        const kuruma=findMember(allies,'KURUMA'),threat=targetThreatening(g,kuruma,enemies);if(threat)target=threat;if(kuruma&&Math.hypot(kuruma.x-p.x,kuruma.y-p.y)>100)nudgeToward(p,kuruma.x,kuruma.y,125);if(projectileThreatFor(g,kuruma||p,.75))useNamedTrigger(g,p,'raygust',{shift:true});if(d<170&&ready(state,'thruster',1.15))useNamedTrigger(g,p,'thruster');if(d<130)useNamedTrigger(g,p,'kogetsu');else if(d<320)useNamedTrigger(g,p,'senku');break;}
      case 'BETSUYAKU':{
        const kuruma=findMember(allies,'KURUMA');if(ready(state,'terrain',2.1)){const old=p.aim;if(kuruma&&ratio(kuruma)<.7)p.aim=Math.atan2(target.y-kuruma.y,target.x-kuruma.x);else p.aim+=side*.8;useNamedTrigger(g,p,'escudo');p.aim=old;}if(d>430)useNamedTrigger(g,p,d>700?'egret':'lightning');break;}
      case 'ARAFUNE': if(d<180)useNamedTrigger(g,p,'kogetsu');else if(d<330)useNamedTrigger(g,p,'senku');else useNamedTrigger(g,p,'egret');break;
      case 'HOKARI':{
        const mates=allies.filter(a=>['ARAFUNE','HANZAKI'].includes(a.v78Named));if(mates.length){const center=mates.reduce((o,a)=>({x:o.x+a.x/mates.length,y:o.y+a.y/mates.length}),{x:0,y:0});if(Math.hypot(center.x-p.x,center.y-p.y)<180)strafe(p,target,180,side);}setAimLead(p,target,.32);useNamedTrigger(g,p,'egret');break;}
      case 'HANZAKI':{
        const moving=Math.hypot(p.vx||0,p.vy||0);if(moving>45){p.vx*=.82;p.vy*=.82;break;}setAimLead(p,target,.22);if(!hasWallBetween(g,p,target)||d>700)useNamedTrigger(g,p,'egret');break;}
      case 'KATORI':{
        const wounded=ratio(p)<.55,allyDown=(g.players||[]).some(a=>a.dead&&a.team===p.team&&a.v78Squad==='katori');if(d>220&&!p.toggles?.chameleon&&ready(state,'cloak',2.2))useNamedTrigger(g,p,'chameleon');if(d<180&&p.toggles?.chameleon)useNamedTrigger(g,p,'chameleon');if(d<165){useNamedTrigger(g,p,'scorpion');if(wounded||allyDown)battleTimeout(g,p,()=>useNamedTrigger(g,p,'scorpion'),85,target);}else useNamedTrigger(g,p,Math.hypot(target.vx||0,target.vy||0)>100?'gun_handgun_hound':'gun_handgun_asteroid');break;}
      case 'MIURA':{
        const katori=findMember(allies,'KATORI');if(katori){const threat=targetThreatening(g,katori,enemies);if(threat)target=threat;if(Math.hypot(katori.x-p.x,katori.y-p.y)>125)nudgeToward(p,katori.x,katori.y,130);}if(d<170&&(target.shields?.main||target.shields?.sub)&&ready(state,'genyo',1.25))directSlash(g,p,target,{range:172,damage:27,arc:.32,name:'幻踊・曲刀',sourceKey:'genyo',knock:70});else if(d<130)useNamedTrigger(g,p,'kogetsu');else if(d<290)useNamedTrigger(g,p,'senku');break;}
      case 'WAKAMURA':{
        const katori=findMember(allies,'KATORI');if(katori&&Math.hypot(katori.x-p.x,katori.y-p.y)>260){nudgeToward(p,katori.x,katori.y,90);p.v79Think+=.12;}if(d<150)nudgeAway(p,target.x,target.y,100);if(d<500)useNamedTrigger(g,p,Math.hypot(target.vx||0,target.vy||0)>100?'gun_assault_hound':'gun_assault_asteroid');if(ratio(p)<.45&&!p.toggles?.chameleon)useNamedTrigger(g,p,'chameleon');break;}
      case 'SUWA':{
        g.v100SuwaVolley=g.v100SuwaVolley||{};const slot=g.v100SuwaVolley[p.team]||0;if(now>=slot&&d<250){useBoth(g,p,'gun_shotgun_asteroid');g.v100SuwaVolley[p.team]=now+360;}if(target.toggles?.bagworm||target.toggles?.chameleon)useNamedTrigger(g,p,'starmaker');break;}
      case 'TSUTSUMI':{
        g.v100SuwaVolley=g.v100SuwaVolley||{};const suwa=findMember(allies,'SUWA'),restrained=(target.v100Restrained||0)>0;if((!suwa||now>=Number(g.v100SuwaVolley[p.team]||0)||restrained)&&d<285){useBoth(g,p,'gun_shotgun_asteroid');g.v100SuwaVolley[p.team]=now+360;}break;}
      case 'SASAMORI':{
        if(d>105&&!p.toggles?.chameleon)useNamedTrigger(g,p,'chameleon');if(d<105){if(p.toggles?.chameleon)useNamedTrigger(g,p,'chameleon');if(ready(state,'grapple',2.6)){target.v100Restrained=Math.max(target.v100Restrained||0,.82);target.vx*=.08;target.vy*=.08;orderTarget(g,p,target,1200);g.effects?.push({type:'bind',x:target.x,y:target.y,ttl:.7,maxTtl:.7,v100Grapple:true});directSlash(g,p,target,{range:90,damage:9,arc:1.3,name:'カメレオン拘束',sourceKey:'sasamoriGrapple',knock:0});}else useNamedTrigger(g,p,'kogetsu');}break;}
      case 'KAKIZAKI':{
        const weak=allies.slice().sort((a,c)=>ratio(a)-ratio(c))[0];if(weak&&ratio(weak)<.62){nudgeToward(p,weak.x,weak.y,120);target=targetThreatening(g,weak,enemies)||target;activateGuard(g,p);}else if(d<180)useNamedTrigger(g,p,'kogetsu');else useNamedTrigger(g,p,enemies.filter(e=>Math.hypot(e.x-target.x,e.y-target.y)<150).length>1?'gun_assault_meteor':'gun_assault_asteroid');break;}
      case 'TERUYA':{
        const kaki=findMember(allies,'KAKIZAKI');if(kaki&&Math.hypot(kaki.vx||0,kaki.vy||0)<25&&d>260)nudgeToward(p,target.x,target.y,130);if(d>185)useNamedTrigger(g,p,'gun_assault_hound');else if(d<120)useNamedTrigger(g,p,'kogetsu');else useNamedTrigger(g,p,'senku');break;}
      case 'TOMOE':{
        const kaki=findMember(allies,'KAKIZAKI');if(kaki&&Math.hypot(kaki.x-p.x,kaki.y-p.y)>310)nudgeToward(p,kaki.x,kaki.y,100);else if(d>135&&ready(state,'ambush',1.25))useNamedTrigger(g,p,'grasshopper');if(d<190)useNamedTrigger(g,p,d<95?'kogetsu':Math.hypot(target.vx||0,target.vy||0)>100?'gun_handgun_hound':'gun_handgun_asteroid');break;}
    }
  }

  const USER_SQUAD_KEY='trion-v96-user-squad';
  const DEFAULT_CPU_MAIN=['kogetsu','senku','shield','gun_assault_asteroid'];
  const DEFAULT_CPU_SUB=['gun_assault_hound','bagworm','shield','grasshopper'];
  function defaultUserSquad(){return{name:'マイ部隊',members:[
    {type:'user',captain:true,name:'自分',role:'万能手',stats:[6,6,6],main:[...DEFAULT_CPU_MAIN],sub:[...DEFAULT_CPU_SUB]},
    {type:'cpu',name:'CPU-2',role:'攻撃手',stats:[5,6,7],main:['kogetsu','senku','shield','empty'],sub:['grasshopper','shield','bagworm','empty']},
    {type:'vacant',name:'',role:'攻撃手',stats:[6,6,6],main:[...DEFAULT_CPU_MAIN],sub:[...DEFAULT_CPU_SUB]},
    {type:'vacant',name:'',role:'攻撃手',stats:[6,6,6],main:[...DEFAULT_CPU_MAIN],sub:[...DEFAULT_CPU_SUB]}
  ]};}
  function normalizeUserMember(m,index){const base=defaultUserSquad().members[index];const type=index===0?'user':['cpu','user','vacant'].includes(m?.type)?m.type:'vacant';return{type,captain:index===0,name:String(m?.name||base.name||`MEMBER-${index+1}`).slice(0,24),role:String(m?.role||base.role||'攻撃手'),stats:norm((Array.isArray(m?.stats)?m.stats:base.stats).map(v=>clamp(Number(v)||0,1,14)),3),main:norm(Array.isArray(m?.main)?m.main:base.main),sub:norm(Array.isArray(m?.sub)?m.sub:base.sub)};}
  function loadUserSquad(){const raw=readObject(USER_SQUAD_KEY);const base=defaultUserSquad();return{name:String(raw.name||base.name).slice(0,24),members:Array.from({length:4},(_,i)=>normalizeUserMember(raw.members?.[i],i))};}
  let userSquad=loadUserSquad();
  function saveUserSquad(){storageSet(USER_SQUAD_KEY,JSON.stringify(userSquad));}
  function currentCaptainBuild(){const saved=readObject('trionArenaSetup'),stats=saved.stats&&typeof saved.stats==='object'?[saved.stats.trion,saved.stats.technique,saved.stats.combat].map(v=>clamp(Number(v)||6,1,14)):userSquad.members[0].stats;return{stats:norm(stats,3),main:norm(Array.isArray(saved.main)?saved.main:userSquad.members[0].main),sub:norm(Array.isArray(saved.sub)?saved.sub:userSquad.members[0].sub)};}
  function userSquadDefinition(){const roleMap={'攻撃手':'アタッカー','射手':'シューター','銃手':'ガンナー','狙撃手':'スナイパー','万能手':'万能手','工作手':'工作手'},captain=currentCaptainBuild();return{id:'userSquad',ja:userSquad.name||'マイ部隊',en:(userSquad.name||'MY SQUAD').toUpperCase(),userSquad:true,agents:userSquad.members.map((m,i)=>{if(m.type==='vacant')return null;const stats=i===0?captain.stats:m.stats,main=i===0?captain.main:m.main,sub=i===0?captain.sub:m.sub;return A(m.name||`MEMBER-${i+1}`,`USER-${i+1}`,roleMap[m.role]||'万能手',stats,main,sub,{userMember:true,userType:m.type,captain:i===0});}).filter(Boolean)};}
  function allSquads(){return[...SQUADS,userSquadDefinition()];}
  function triggerOptionHtml(selected='empty'){
    const triggers=window.WT_DATA?.triggers||{};
    const entries=Object.values(triggers).filter(t=>t?.id&&t.id!=='bagwormTag').sort((a,b)=>String(a.category||'').localeCompare(String(b.category||''))||String(a.name||a.id).localeCompare(String(b.name||b.id)));
    if(!entries.some(t=>t.id==='empty'))entries.unshift({id:'empty',name:'― 空き枠 ―'});
    return entries.map(t=>`<option value="${t.id}"${t.id===selected?' selected':''}>${t.name||t.id}</option>`).join('');
  }
  function renderUserSquadEditor(){
    const modal=document.querySelector('#v96UserSquadModal');if(!modal)return;
    const roles=['攻撃手','射手','銃手','狙撃手','万能手','工作手'];
    modal.querySelector('[data-squad-name]').value=userSquad.name;
    const list=modal.querySelector('[data-member-list]');
    list.innerHTML=userSquad.members.map((m,index)=>{
      const locked=index===0,editableCpu=m.type==='cpu';
      const typeOptions=locked?'<option value="user">隊長（自分）</option>':['vacant','cpu','user'].map(v=>`<option value="${v}"${m.type===v?' selected':''}>${v==='vacant'?'空き枠':v==='cpu'?'CPU':'他のユーザー'}</option>`).join('');
      const roleOptions=roles.map(v=>`<option value="${v}"${m.role===v?' selected':''}>${v}</option>`).join('');
      return `<article class="v96-squad-member" data-member="${index}" data-type="${m.type}">
        <header><strong>${index===0?'隊長':'隊員 '+(index+1)}</strong><select data-field="type"${locked?' disabled':''}>${typeOptions}</select></header>
        <label>名前<input data-field="name" maxlength="24" value="${String(m.name).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}"${m.type==='vacant'?' disabled':''}></label>
        <div class="v96-cpu-editor"${editableCpu?'':' hidden'}>
          <label>役割<select data-field="role">${roleOptions}</select></label>
          <div class="v96-stat-row">${['トリオン','技術','戦闘'].map((label,i)=>`<label>${label}<input type="number" min="1" max="14" data-stat-index="${i}" value="${m.stats[i]}"></label>`).join('')}</div>
          <div class="v96-loadout-editor"><div><b>MAIN</b>${m.main.map((v,i)=>`<select data-hand="main" data-slot="${i}">${triggerOptionHtml(v)}</select>`).join('')}</div><div><b>SUB</b>${m.sub.map((v,i)=>`<select data-hand="sub" data-slot="${i}">${triggerOptionHtml(v)}</select>`).join('')}</div></div>
        </div>
        ${index===0?'<p class="v96-user-note">隊長は出撃設定で保存している自分の能力配分・トリガー構成を使用します。対戦部隊として選んだ場合はCPU操作になります。</p>':m.type==='user'?'<p class="v96-user-note">対戦部隊として選んだ場合、このユーザー枠はCPU操作になります。</p>':''}
      </article>`;
    }).join('');
  }
  function ensureUserSquadEditor(){
    if(!document.body)return;
    let open=document.querySelector('#v96UserSquadOpen');
    if(!open){open=document.createElement('button');open.id='v96UserSquadOpen';open.className='v96-user-squad-open';open.type='button';}
    open.textContent=lang()==='en'?'Edit My Squad':'自分の部隊を編集';
    const squadBox=document.querySelector('#userPanel .squad-manage-box')||document.querySelector('#userSquadList')?.closest?.('.online-box');
    if(squadBox){
      let host=squadBox.querySelector('.v99-local-squad-tools');
      if(!host){host=document.createElement('div');host.className='v99-local-squad-tools';host.innerHTML=`<div><strong>${lang()==='en'?'Local Battle Squad':'対戦用の自分の部隊'}</strong><small>${lang()==='en'?'Edit the captain, CPU members and vacant slots used in offline battles.':'オフライン対戦で使用する隊長・CPU隊員・空き枠を編集します。'}</small></div>`;const list=squadBox.querySelector('#userSquadList');if(list)list.insertAdjacentElement('afterend',host);else squadBox.appendChild(host);}
      if(open.parentElement!==host)host.appendChild(open);open.hidden=false;const copy=host.querySelector('div');if(copy)copy.innerHTML=`<strong>${lang()==='en'?'Local Battle Squad':'対戦用の自分の部隊'}</strong><small>${lang()==='en'?'Edit the captain, CPU members and vacant slots used in offline battles.':'オフライン対戦で使用する隊長・CPU隊員・空き枠を編集します。'}</small>`;
    }else if(!open.isConnected){document.body.appendChild(open);open.hidden=true;}
    if(!document.querySelector('#v96UserSquadModal')){
      const modal=document.createElement('section');modal.id='v96UserSquadModal';modal.className='v96-user-squad-modal hidden';modal.innerHTML=`<div class="v96-user-squad-card"><header><div><span>MY SQUAD</span><h2>自分の所属部隊</h2></div><button type="button" data-close>×</button></header><label class="v96-squad-name">部隊名<input data-squad-name maxlength="24"></label><p>隊長は自分です。空き枠へCPUまたは他のユーザーを追加できます。CPU枠のみ能力とトリガーを編集できます。</p><div data-member-list></div><footer><button type="button" data-reset>初期化</button><button type="button" data-save class="primary">部隊を保存</button></footer></div>`;document.body.appendChild(modal);
    }
    const modal=document.querySelector('#v96UserSquadModal');
    const openModal=()=>{renderUserSquadEditor();modal.classList.remove('hidden');};
    document.querySelector('#v96UserSquadOpen').onclick=openModal;
    modal.querySelector('[data-close]').onclick=()=>modal.classList.add('hidden');
    modal.querySelector('[data-reset]').onclick=()=>{userSquad=defaultUserSquad();renderUserSquadEditor();};
    modal.querySelector('[data-save]').onclick=()=>{
      userSquad.name=(modal.querySelector('[data-squad-name]').value||'マイ部隊').trim().slice(0,24)||'マイ部隊';
      modal.querySelectorAll('[data-member]').forEach(card=>{const i=Number(card.dataset.member),old=userSquad.members[i],type=i===0?'user':card.querySelector('[data-field="type"]').value;old.type=type;old.name=(card.querySelector('[data-field="name"]')?.value||old.name||`MEMBER-${i+1}`).trim().slice(0,24);if(type==='cpu'){old.role=card.querySelector('[data-field="role"]').value;old.stats=[...card.querySelectorAll('[data-stat-index]')].map(input=>clamp(Number(input.value)||1,1,14));for(const hand of ['main','sub'])old[hand]=[...card.querySelectorAll(`select[data-hand="${hand}"]`)].map(select=>select.value);}});
      userSquad.members=userSquad.members.map(normalizeUserMember);saveUserSquad();saveRoster();mountRoster(true);modal.classList.add('hidden');flash('自分の部隊を保存しました');
    };
    modal.onchange=event=>{const type=event.target?.matches?.('[data-field="type"]')?event.target.value:null;if(!type)return;const card=event.target.closest('[data-member]'),i=Number(card.dataset.member);userSquad.members[i].type=type;renderUserSquadEditor();};
  }
  function ensureFourthTeamCards(){
    const root=document.querySelector('#cpuConfigList');if(!root)return;
    const cards=[...root.querySelectorAll('.cpu-card')],teamCount=Number(document.querySelector('#teamCount')?.value||0),teamSize=Math.max(1,Number(document.querySelector('#teamSize')?.value||3)),playerCombatant=(document.querySelector('#participationRole')?.value||'combatant')==='combatant',fourthStart=(teamSize-(playerCombatant?1:0))+teamSize*2;
    cards.forEach((card,index)=>{card.hidden=false;card.classList.remove('hidden');card.style.removeProperty('display');card.dataset.cpuIndex=String(index);if(teamCount>=4&&index>=fourthStart)card.dataset.v99FourthTeam='true';else delete card.dataset.v99FourthTeam;delete card.dataset.v96FourthTeam;});
  }

  const ROSTER_STORAGE_KEY='trion-v81-card-opponents';
  const MAX_OPPONENT_SLOTS=16;
  const ROLE_TO_ARCHETYPE={ 'アタッカー':'攻撃手','シューター':'射手','ガンナー':'銃手','スナイパー':'狙撃手','万能手':'万能手','工作手':'工作手' };
  function loadOpponentSlots(){
    try{
      const raw=JSON.parse(storageGet(ROSTER_STORAGE_KEY,'null'));
      if(Array.isArray(raw)) return Array.from({length:MAX_OPPONENT_SLOTS},(_,i)=>{const squad=raw[i]?.squad;return {squad:squad==='vacant'||allSquads().some(s=>s.id===squad)?squad:'mob',agent:raw[i]?.agent||''};});
    }catch(_){ }
    return Array.from({length:MAX_OPPONENT_SLOTS},()=>({squad:'mob',agent:''}));
  }
  const opponentSlots=loadOpponentSlots();
  const saveRoster=()=>storageSet(ROSTER_STORAGE_KEY,JSON.stringify(opponentSlots));
  const mobSnapshots=new Map();
  function snapshotCard(card,index){
    if(mobSnapshots.has(index))return;
    mobSnapshots.set(index,{
      name:card.querySelector('.cpu-name')?.value||`CPU-${index+1}`,
      archetype:card.querySelector('.cpu-archetype')?.value||'',
      stats:[...card.querySelectorAll('input[data-stat]')].map(el=>Number(el.value)),
      main:[...card.querySelectorAll('select[data-hand="main"]')].map(el=>el.value),
      sub:[...card.querySelectorAll('select[data-hand="sub"]')].map(el=>el.value),
      summary:card.querySelector('.cpu-card-title')?.innerHTML||''
    });
  }
  function setCardDisplay(card,index,agent){
    snapshotCard(card,index);
    const name=card.querySelector('.cpu-name');if(name)name.value=labelOf(agent);
    const archetype=card.querySelector('.cpu-archetype'),wanted=ROLE_TO_ARCHETYPE[agent.role]||agent.role;
    if(archetype&&[...archetype.options].some(o=>o.value===wanted))archetype.value=wanted;
    const statKeys=['trion','technique','combat'];
    statKeys.forEach((key,i)=>{const input=card.querySelector(`input[data-stat="${key}"]`);if(!input)return;input.max=String(Math.max(Number(input.max)||10,agent.stats[i]));input.value=String(agent.stats[i]);const output=input.closest('label')?.querySelector('output');if(output)output.value=String(agent.stats[i]);});
    for(const hand of ['main','sub']) card.querySelectorAll(`select[data-hand="${hand}"]`).forEach((select,i)=>{const value=agent[hand][i]||'empty';if([...select.options].some(o=>o.value===value))select.value=value;});
    const title=card.querySelector('.cpu-card-title');if(title)title.innerHTML=`<strong>${labelOf(agent)}</strong><span>${wanted} / T${agent.stats[0]} 技${agent.stats[1]} 戦${agent.stats[2]}</span>`;
    card.dataset.namedAgent=agent.en;
  }
  function restoreMobDisplay(card,index){
    const snap=mobSnapshots.get(index);if(!snap)return;
    const name=card.querySelector('.cpu-name');if(name)name.value=snap.name;
    const archetype=card.querySelector('.cpu-archetype');if(archetype)archetype.value=snap.archetype;
    ['trion','technique','combat'].forEach((key,i)=>{const input=card.querySelector(`input[data-stat="${key}"]`);if(!input)return;input.value=String(snap.stats[i]??input.value);const output=input.closest('label')?.querySelector('output');if(output)output.value=String(snap.stats[i]??input.value);});
    for(const hand of ['main','sub']) card.querySelectorAll(`select[data-hand="${hand}"]`).forEach((select,i)=>{const value=snap[hand][i];if(value&&[...select.options].some(o=>o.value===value))select.value=value;});
    const title=card.querySelector('.cpu-card-title');if(title&&snap.summary)title.innerHTML=snap.summary;
    delete card.dataset.namedAgent;
  }
  function setCardVacant(card,index){
    snapshotCard(card,index);
    card.classList.add('v84-vacant-card');
    card.dataset.vacant='true';
    const name=card.querySelector('.cpu-name');if(name)name.value=lang()==='en'?'VACANT':'空き枠';
    const title=card.querySelector('.cpu-card-title');if(title)title.innerHTML=`<strong>${lang()==='en'?'VACANT':'空き枠'}</strong><span>${lang()==='en'?'No combatant':'隊員なし'}</span>`;
    card.querySelectorAll('.cpu-basic-grid input,.cpu-basic-grid select:not([data-squad]):not([data-agent]),.cpu-loadout-grid select').forEach(el=>el.disabled=true);
    delete card.dataset.namedAgent;
  }
  function clearCardVacant(card){
    card.classList.remove('v84-vacant-card');
    delete card.dataset.vacant;
    card.querySelectorAll('.cpu-basic-grid input,.cpu-basic-grid select:not([data-squad]):not([data-agent]),.cpu-loadout-grid select').forEach(el=>el.disabled=false);
  }
  function mountRoster(force=false){
    ensureFourthTeamCards();ensureUserSquadEditor();
    document.querySelectorAll('.v80-opponent-slots,.v78-named-roster').forEach(el=>el.remove());
    const root=document.querySelector('#cpuConfigList');if(!root)return;
    const cards=[...root.querySelectorAll('.cpu-card')];
    const language=lang();
    cards.forEach((card,index)=>{
      const grid=card.querySelector('.cpu-basic-grid');if(!grid)return;
      let picker=grid.querySelector('.v81-card-agent-picker');
      const needsCreate=!picker;
      if(needsCreate){
        picker=document.createElement('div');picker.className='v81-card-agent-picker';picker.innerHTML='<label><span data-squad-label></span><select data-squad></select></label><label><span data-agent-label></span><select data-agent></select></label>';
        grid.prepend(picker);
      }
      if(!force&&!needsCreate&&picker.dataset.language===language)return;
      picker.dataset.language=language;
      const slot=opponentSlots[index]||{squad:'mob',agent:''},en=language==='en';
      picker.querySelector('[data-squad-label]').textContent=en?'Squad / Type':'部隊／種別';
      picker.querySelector('[data-agent-label]').textContent=en?'Agent':'隊員';
      const squadSel=picker.querySelector('[data-squad]'),agentSel=picker.querySelector('[data-agent]');
      const fillSquads=()=>{
        const current=slot.squad==='vacant'||allSquads().some(s=>s.id===slot.squad)?slot.squad:'mob';
        squadSel.innerHTML=`<option value="mob">${en?'MOB / CUSTOM':'モブ／カスタム'}</option><option value="vacant">${en?'VACANT':'空き枠'}</option>`+allSquads().map(s=>`<option value="${s.id}">${en?s.en:s.ja}</option>`).join('');
        squadSel.value=current;
      };
      const fillAgents=()=>{
        if(slot.squad==='vacant'){
          agentSel.disabled=true;
          agentSel.innerHTML=`<option value="">${en?'No combatant':'隊員なし'}</option>`;
          agentSel.value='';
          setCardVacant(card,index);
          return;
        }
        const squad=allSquads().find(s=>s.id===slot.squad);
        agentSel.disabled=!squad;
        clearCardVacant(card);
        if(!squad){
          agentSel.innerHTML=`<option value="">${en?'Use current custom settings':'現在のモブ設定を使用'}</option>`;
          agentSel.value='';
          restoreMobDisplay(card,index);
          return;
        }
        agentSel.innerHTML=squad.agents.map(a=>`<option value="${a.en}">${en?a.en:a.ja}</option>`).join('');
        if(!squad.agents.some(a=>a.en===slot.agent))slot.agent=squad.agents[0]?.en||'';
        agentSel.value=slot.agent;
        const agent=squad.agents.find(a=>a.en===slot.agent);if(agent)setCardDisplay(card,index,agent);
      };
      fillSquads();
      fillAgents();
      squadSel.onchange=()=>{
        slot.squad=squadSel.value==='vacant'?'vacant':(allSquads().some(s=>s.id===squadSel.value)?squadSel.value:'mob');
        slot.agent='';
        fillAgents();
        saveRoster();
      };
      agentSel.onchange=()=>{
        slot.agent=agentSel.value;
        const squad=allSquads().find(s=>s.id===slot.squad),agent=squad?.agents.find(a=>a.en===slot.agent);
        if(agent)setCardDisplay(card,index,agent);
        saveRoster();
      };
    });
    rosterMounted=true;
  }
  function applyNamed(g){
    if(!g||!Array.isArray(g.players))return;
    const cpuEntries=g.players.filter(p=>!p.human&&!p.isDefenseEnemy).map((p,order)=>{const match=/^cpu-(\d+)$/.exec(String(p.id||''));return{p,index:match?Number(match[1]):order};}).sort((a,b)=>a.index-b.index);
    const vacant=new Set();
    cpuEntries.forEach(({p,index})=>{
      const slot=opponentSlots[index];
      if(slot?.squad==='vacant'){vacant.add(p);return;}
      if(!slot||slot.squad==='mob'||!slot.agent)return;
      const squad=allSquads().find(s=>s.id===slot.squad),a=squad?.agents.find(agent=>agent.en===slot.agent);if(!a)return;
      p.name=labelOf(a);p.v78Named=a.en;p.v78Squad=slot.squad;p.v79BaseCombat=a.stats[2];p.v78Tetra=!!a.tetra;p.archetype=ROLE_TO_ARCHETYPE[a.role]||a.role;const squadColor=SQUAD_COLORS[slot.squad];if(squadColor){p.appearance={...(p.appearance||{}),bodyColor:squadColor.body,uniformColor:squadColor.body,accentColor:squadColor.accent};p.color=squadColor.body;p.characterColor=squadColor.body;p.bodyColor=squadColor.body;p.accentColor=squadColor.accent;}
      p.stats={...(p.stats||{}),trion:a.stats[0],technique:a.stats[1],combat:a.stats[2]};p.loadout={main:[...a.main],sub:[...a.sub]};p.selected={main:0,sub:0};p.v96UserMember=!!a.userMember;p.v96Captain=!!a.captain;
      if(p.maxTrion!=null){p.maxTrion=Math.max(p.maxTrion,a.stats[0]*12+40);p.trion=p.maxTrion;}
      applyNamedTuning(p);
    });
    if(vacant.size){
      for(let i=g.players.length-1;i>=0;i--){if(vacant.has(g.players[i]))g.players.splice(i,1);}
      if(g.player&&vacant.has(g.player))g.player=g.players.find(p=>p.human)||null;
    }
  }
  function applySimulationNamed(g){
    if(!g?.simulationMode||!Array.isArray(g.players))return;
    const vacant=new Set();
    for(const p of g.players){
      if(String(p?.name||'')==='__VACANT__'){vacant.add(p);continue;}
      if(p?.v78Named){applyNamedTuning(p);continue;}
      let squadMatch=null,agentMatch=null;
      for(const squad of SQUADS){const found=squad.agents.find(agent=>agent.ja===p.name||agent.en===p.name);if(found){squadMatch=squad;agentMatch=found;break;}}
      if(!agentMatch)continue;
      p.v78Named=agentMatch.en;p.v78Squad=squadMatch.id;p.v79BaseCombat=agentMatch.stats[2];p.v78Tetra=!!agentMatch.tetra;
      p.archetype=ROLE_TO_ARCHETYPE[agentMatch.role]||p.archetype||agentMatch.role;
      p.stats={...(p.stats||{}),trion:agentMatch.stats[0],technique:agentMatch.stats[1],combat:agentMatch.stats[2]};
      p.loadout={main:[...agentMatch.main],sub:[...agentMatch.sub]};p.selected={main:0,sub:0};
      const squadColor=SQUAD_COLORS[squadMatch.id];if(squadColor){p.appearance={...(p.appearance||{}),bodyColor:squadColor.body,uniformColor:squadColor.body,accentColor:squadColor.accent};p.color=squadColor.body;p.characterColor=squadColor.body;p.bodyColor=squadColor.body;p.accentColor=squadColor.accent;}
      if(p.maxTrion!=null){p.maxTrion=Math.max(p.maxTrion,agentMatch.stats[0]*12+40);p.trion=p.maxTrion;}
      applyNamedTuning(p);
    }
    if(vacant.size){for(let i=g.players.length-1;i>=0;i--){if(vacant.has(g.players[i]))g.players.splice(i,1);}if(g.player&&vacant.has(g.player))g.player=g.players[0]||null;}
    g.v102SimulationNamedApplied=true;
  }
  function flash(text){if(!document?.body?.appendChild)return;const e=document.createElement('div');e.className='v77-skill-flash';e.textContent=text;document.body.appendChild(e);setTimeout(()=>e.remove?.(),950);}
  function segDist(x1,y1,x2,y2,px,py){const dx=x2-x1,dy=y2-y1,l=dx*dx+dy*dy||1,t=clamp(((px-x1)*dx+(py-y1)*dy)/l,0,1);return{d:Math.hypot(px-(x1+dx*t),py-(y1+dy*t)),t};}
  function moleClaw(g,p=humanOf(g),quiet=false){if(!p||!hasTrigger(p,'scorpion'))return false;const walls=(g.walls||[]).filter(w=>{const cx=clamp(p.x,w.x,w.x+w.w),cy=clamp(p.y,w.y,w.y+w.h);return Math.hypot(p.x-cx,p.y-cy)<p.radius+26;});if(!walls.length)return false;const wall=walls[0];const target=(g.players||[]).filter(t=>g.canDamage?.(p,t)&&!t.dead).map(t=>({t,d:Math.hypot(t.x-clamp(t.x,wall.x,wall.x+wall.w),t.y-clamp(t.y,wall.y,wall.y+wall.h))})).filter(x=>x.d<x.t.radius+30).sort((a,b)=>a.d-b.d)[0]?.t;if(!target||!g.consumeTrion?.(p,4))return false;g.effects?.push({type:'slash',x:target.x,y:target.y,angle:Math.atan2(target.y-p.y,target.x-p.x),range:42,arc:6.1,style:'moleClaw',ttl:.28,maxTtl:.28});g.damagePlayer?.(target,28*(.82+(p.stats?.combat||0)*.05),p,{x:target.x,y:target.y,type:'melee',name:'モールクロー',sourceKey:'moleClaw'});if(!quiet)flash('モールクロー');return true;}
  function openPointNear(g,x,y,r,preferredAngle=0,maxRadius=170){
    const worldW=Number(g.world?.w)||1920,worldH=Number(g.world?.h)||1080,margin=r+7;
    const cx=clamp(x,margin,worldW-margin),cy=clamp(y,margin,worldH-margin);
    if(!pointBlocked(g,cx,cy,r))return{x:cx,y:cy};
    for(const radius of [28,44,64,88,118,maxRadius])for(const offset of [0,.45,-.45,.9,-.9,1.35,-1.35,Math.PI]){
      const a=preferredAngle+offset,nx=clamp(cx+Math.cos(a)*radius,margin,worldW-margin),ny=clamp(cy+Math.sin(a)*radius,margin,worldH-margin);
      if(!pointBlocked(g,nx,ny,r))return{x:nx,y:ny};
    }
    return null;
  }
  function computePinballRoute(g,p,target,count=8){
    const radius=clamp(82+(Number(p.stats?.combat)||0)*3.2,88,124),bodyRadius=Number(p.radius)||18;
    const rawCenter=target&&!target.dead?{x:Number(target.x)||p.x,y:Number(target.y)||p.y}:{x:p.x+Math.cos(Number(p.aim)||0)*130,y:p.y+Math.sin(Number(p.aim)||0)*130};
    const center=openPointNear(g,rawCenter.x,rawCenter.y,bodyRadius+8,Number(p.aim)||0,120)||rawCenter;
    const base=Math.atan2(p.y-center.y,p.x-center.x)||((Number(p.aim)||0)+Math.PI),route=[];let orbitAngle=base;
    for(let i=0;i<count;i++){
      if(i>0)orbitAngle+=Math.PI+(i%2?.28:-.28);
      const angle=orbitAngle,preferred={x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius};
      const point=openPointNear(g,preferred.x,preferred.y,bodyRadius+5,angle,radius*.55);
      if(!point)continue;
      route.push({x:point.x,y:point.y,angle:Math.atan2(center.y-point.y,center.x-point.x),centerX:center.x,centerY:center.y,bounced:true});
    }
    return{center,route};
  }
  function pinballFor(g,p,blade,target,quiet=false){
    if(!p||p.dead)return false;
    const all=[...(p.loadout?.main||[]),...(p.loadout?.sub||[])];
    if(blade){if(!all.includes('grasshopper')||!all.includes('scorpion'))return false;}
    else{if(all.filter(x=>x==='grasshopper').length<2||!['kogetsu','scorpion','raygust'].some(id=>all.includes(id)))return false;}
    const now=mobilityNow();if((p.v77PinballUntil||0)>now)return false;
    const cost=blade?15:12;if(!g.consumeTrion?.(p,cost))return false;
    const plan=computePinballRoute(g,p,target,8);if(!plan.route.length)return false;
    p.v77PinballUntil=now+2600;p.v101PinballActiveUntil=now+plan.route.length*115+260;p.v96PinballRoute=plan.route.map(pt=>({...pt}));
    if(!quiet)flash(blade?'ブレード乱反射':'乱反射');
    g.effects?.push({type:'grasshopper',x:plan.center.x,y:plan.center.y,angle:0,ttl:.52,maxTtl:.52,v101PinballAnchor:true});
    plan.route.forEach((pt,i)=>battleTimeout(g,p,()=>{
      if(p.dead||mobilityNow()>Number(p.v101PinballActiveUntil||0)+300)return;
      const ox=p.x,oy=p.y;p.x=pt.x;p.y=pt.y;p.aim=pt.angle;p.vx=0;p.vy=0;
      g.resolveWallCollision?.(p);g.effects?.push({type:'grasshopper',x:p.x,y:p.y,angle:p.aim,ttl:.32,maxTtl:.32,v101Pinball:true});
      for(const enemy of enemiesOf(g,p)){
        const through=segDist(ox,oy,p.x,p.y,enemy.x,enemy.y),anchorDistance=Math.hypot(enemy.x-plan.center.x,enemy.y-plan.center.y);
        if(through.d>(enemy.radius||18)+(blade?31:23)&&anchorDistance>(enemy.radius||18)+34)continue;
        g.damagePlayer?.(enemy,(blade?10:7)*(.9+(p.stats?.combat||0)*.035),p,{x:p.x,y:p.y,type:'melee',name:blade?'ブレード乱反射':'乱反射',sourceKey:blade?'bladePinball':'pinball'});
      }
      if(i===plan.route.length-1){delete p.v101PinballActiveUntil;const out=Math.atan2(p.y-plan.center.y,p.x-plan.center.x);p.vx=Math.cos(out)*145;p.vy=Math.sin(out)*145;}
    },i*110));
    return true;
  }
  function pinball(g,blade){const p=humanOf(g),target=nearestEnemy(g,p,650);if(!p||!target)return;if(!pinballFor(g,p,blade,target,false))flash(blade?'グラスホッパー＋スコーピオンが必要':'グラスホッパー×2＋攻撃手トリガーが必要');}
  const mobilityNow=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();
  const angleDelta=(to,from)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
  function pointBlocked(g,x,y,r=22){return (g.walls||[]).some(w=>w&&Number.isFinite(w.x)&&Number.isFinite(w.y)&&Number.isFinite(w.w)&&Number.isFinite(w.h)&&x+r>w.x&&x-r<w.x+w.w&&y+r>w.y&&y-r<w.y+w.h);}
  function mobilityPathOpen(g,p,angle,distance){
    const r=Math.max(6,(Number(p.radius)||18)-.75),worldW=Number(g.world?.w)||1920,worldH=Number(g.world?.h)||1080,steps=Math.max(2,Math.min(7,Math.ceil(distance/24)));
    for(let i=1;i<=steps;i++){
      const d=distance*i/steps,x=p.x+Math.cos(angle)*d,y=p.y+Math.sin(angle)*d;
      if(x<r||x>worldW-r||y<r||y>worldH-r||pointBlocked(g,x,y,r))return false;
    }
    return true;
  }
  function chooseOpenMobilityAngle(g,p,base,distance=210){
    let best=base,bestScore=Infinity;
    for(const offset of [0,.28,-.28,.52,-.52,.82,-.82,1.16,-1.16,Math.PI/2,-Math.PI/2,Math.PI]){
      const a=base+offset,nearOpen=mobilityPathOpen(g,p,a,Math.min(54,distance)),farOpen=nearOpen&&mobilityPathOpen(g,p,a,distance);
      if(!nearOpen)continue;
      const score=(farOpen?0:360)+Math.abs(offset)*42;
      if(score<bestScore){bestScore=score;best=a;}
    }
    return best;
  }
  function tacticalMobilityAngle(g,p,target){
    const toTarget=Math.atan2(target.y-p.y,target.x-p.x),d=Math.hypot(target.x-p.x,target.y-p.y),hpRatio=(Number(p.hp)||1)/Math.max(1,Number(p.maxHp)||Number(p.hp)||1),side=(String(p.id||'').split('').reduce((sum,ch)=>sum+ch.charCodeAt(0),0)%2?1:-1);
    let desired;
    if(hpRatio<.42||d<135)desired=toTarget+Math.PI+side*.28;
    else if(d>440)desired=toTarget+side*.24;
    else desired=toTarget+side*(.82+Math.random()*.34);
    return chooseOpenMobilityAngle(g,p,desired,hpRatio<.42?250:210);
  }
  function mobilityAlly(g,device,p){
    if(!p||p.dead)return false;
    if(g.config?.mode==='solo'&&!g.isDefenseMode)return p.id===device.ownerId;
    return p.team===device.team;
  }
  function capOwnerDevices(list,ownerId,max,predicate=()=>true){
    const owned=list.filter(item=>item?.ownerId===ownerId&&predicate(item)).sort((a,b)=>(a.v94PlacedAt||0)-(b.v94PlacedAt||0));
    while(owned.length>max){const old=owned.shift(),i=list.indexOf(old);if(i>=0)list.splice(i,1);}
  }
  function mobilityBoost(g,p,angle,basePower,source,options={}){
    if(!p||p.dead)return false;
    const now=mobilityNow(),chain=now<(p.v94ChainUntil||0)?Math.min(3,(p.v94Chain||0)+1):0,power=basePower*(1+chain*.1),dx=Math.cos(angle),dy=Math.sin(angle),tx=-dy,ty=dx,oldVx=Number(p.vx)||0,oldVy=Number(p.vy)||0;
    const forward=oldVx*dx+oldVy*dy,tangent=oldVx*tx+oldVy*ty,forwardCarry=Number.isFinite(options.forwardCarry)?options.forwardCarry:.24,tangentCarry=Number.isFinite(options.tangentCarry)?options.tangentCarry:.62;
    let nextForward=Math.max(power,power+Math.max(0,forward)*forwardCarry),nextTangent=tangent*tangentCarry,speed=Math.hypot(nextForward,nextTangent),cap=1080+(Number(p.stats?.combat)||0)*18;
    if(speed>cap){const scale=cap/speed;nextForward*=scale;nextTangent*=scale;}
    p.vx=dx*nextForward+tx*nextTangent;p.vy=dy*nextForward+ty*nextTangent;
    p.v94Chain=chain;p.v94ChainUntil=now+1050;p.v94SteerUntil=now+(source==='instantGrasshopper'?480:620);p.v94SteerAngle=angle;delete p.v97MobilityRoute;
    p.metrics=p.metrics&&typeof p.metrics==='object'?p.metrics:{};p.metrics.mobilityRouteUses=(p.metrics.mobilityRouteUses||0)+1;p.metrics.grasshopperBoostImpulse=(p.metrics.grasshopperBoostImpulse||0)+power;
    (g.effects||=[]).push({type:'grasshopper',x:p.x,y:p.y,angle,ttl:.5,maxTtl:.5,v94Route:true,source});
    return true;
  }
  function convertLegacyGrassPads(g){
    if(!Array.isArray(g.traps))return;
    g.v94MobilityPads=Array.isArray(g.v94MobilityPads)?g.v94MobilityPads:[];
    for(let i=g.traps.length-1;i>=0;i--){const trap=g.traps[i];if(!trap?.v77Grass)continue;const owner=(g.players||[]).find(p=>p.id===trap.ownerId),angle=Number.isFinite(trap.launchAngle)?trap.launchAngle:Number(owner?.aim)||0;g.v94MobilityPads.push({...trap,id:trap.id||`v97-pad-${mobilityNow()}-${Math.random()}`,radius:24,v94MobilityPad:true,v94PlacedAt:mobilityNow(),launchAngle:angle,power:trap.power||760,ttl:Math.min(Math.max(Number(trap.ttl)||5,1),7),uses:1,armedAt:mobilityNow()+100,v94Inside:{}});g.traps.splice(i,1);}
  }
  function steerAfterMobility(p,dt){
    const now=mobilityNow(),speed=Math.hypot(Number(p.vx)||0,Number(p.vy)||0);if(now>Number(p.v94SteerUntil||0)||speed<90)return;
    const desired=p.human&&Number.isFinite(p.aim)?p.aim:Number(p.v94SteerAngle);if(!Number.isFinite(desired))return;
    const current=Math.atan2(p.vy,p.vx),turn=(p.human?2.35:1.95)*Math.max(0,Number(dt)||0),next=current+clamp(angleDelta(desired,current),-turn,turn);p.vx=Math.cos(next)*speed;p.vy=Math.sin(next)*speed;
  }
  function springWireGeometry(w){
    const dx=Number(w.x2)-Number(w.x1),dy=Number(w.y2)-Number(w.y1),len=Math.hypot(dx,dy)||1,tx=dx/len,ty=dy/len,nx=-ty,ny=tx,mx=(Number(w.x1)+Number(w.x2))*.5,my=(Number(w.y1)+Number(w.y2))*.5;
    return{dx,dy,len,tx,ty,nx,ny,mx,my};
  }
  function routeEntryCandidates(g,p){
    const candidates=[];
    for(const pad of g.v94MobilityPads||[]){if(!pad||pad.ttl<=0||!mobilityAlly(g,pad,p))continue;candidates.push({x:pad.x,y:pad.y,angle:Number(pad.launchAngle)||0,kind:'pad',device:pad});}
    for(const w of g.wires||[]){if(w?.mode!=='spring'||!mobilityAlly(g,w,p))continue;const geo=springWireGeometry(w);for(const sign of [1,-1]){const angle=Math.atan2(geo.ny*sign,geo.nx*sign);candidates.push({x:geo.mx-geo.nx*sign*54,y:geo.my-geo.ny*sign*54,crossX:geo.mx+geo.nx*sign*48,crossY:geo.my+geo.ny*sign*48,angle,kind:'wire',device:w});}}
    return candidates;
  }
  function followMobilityRoute(p,dt){
    const route=p.v97MobilityRoute;if(!route||mobilityNow()>route.expiresAt){delete p.v97MobilityRoute;return false;}
    const crossed=route.stage==='cross',tx=crossed?route.crossX:route.x,ty=crossed?route.crossY:route.y,dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy)||1;
    if(!crossed&&d<24&&route.kind==='wire'){route.stage='cross';return true;}
    const push=(crossed?255:185)*Math.max(0,Number(dt)||0);p.vx=(Number(p.vx)||0)+dx/d*push;p.vy=(Number(p.vy)||0)+dy/d*push;p.v94SteerAngle=route.angle;return true;
  }
  function cpuUseExistingMobility(g,p,target,dt){
    if(p.human||p.dead||mobilityNow()<(p.v94ChainUntil||0)||mobilityNow()<Number(p.ai?.v98HazardUntil||0))return;
    if(followMobilityRoute(p,dt))return;
    p.v94SeekCd=Math.max(0,(p.v94SeekCd||0)-dt);if(p.v94SeekCd>0)return;p.v94SeekCd=.24+Math.random()*.2;
    const desired=tacticalMobilityAngle(g,p,target),best=routeEntryCandidates(g,p).map(entry=>{const d=Math.hypot(entry.x-p.x,entry.y-p.y),align=Math.cos(angleDelta(entry.angle,desired));return{entry,d,align,score:d+(1-align)*175};}).filter(x=>x.d<340&&x.align>.32).sort((a,b)=>a.score-b.score)[0];
    if(!best||best.score>365)return;const e=best.entry;p.v97MobilityRoute={...e,stage:'entry',expiresAt:mobilityNow()+2200};followMobilityRoute(p,dt);
  }
  function padCrossedByPlayer(p,pad,threshold){
    const px=Number.isFinite(p.v97PrevX)?p.v97PrevX:p.x,py=Number.isFinite(p.v97PrevY)?p.v97PrevY:p.y,hit=segDist(px,py,p.x,p.y,pad.x,pad.y),current=Math.hypot(p.x-pad.x,p.y-pad.y),previous=Math.hypot(px-pad.x,py-pad.y),speed=Math.hypot(Number(p.vx)||0,Number(p.vy)||0);
    return speed>38&&((previous>threshold&&current<=threshold)||hit.d<=threshold);
  }
  function springWireCrossing(p,w){
    const geo=springWireGeometry(w),px=Number.isFinite(p.v97PrevX)?p.v97PrevX:p.x,py=Number.isFinite(p.v97PrevY)?p.v97PrevY:p.y,prevHit=segDist(w.x1,w.y1,w.x2,w.y2,px,py),hit=segDist(w.x1,w.y1,w.x2,w.y2,p.x,p.y),limit=Number(p.radius||18)+8,prevSide=(px-w.x1)*geo.nx+(py-w.y1)*geo.ny,currentSide=(p.x-w.x1)*geo.nx+(p.y-w.y1)*geo.ny,normalVelocity=(Number(p.vx)||0)*geo.nx+(Number(p.vy)||0)*geo.ny,delta=currentSide-prevSide,crossed=prevSide*currentSide<=0&&Math.abs(delta)>2&&Math.min(prevHit.d,hit.d)<=limit;
    if(!crossed&&!(hit.d<=limit&&Math.abs(normalVelocity)>72&&prevHit.d>limit*.75))return null;
    const sign=Math.sign(Math.abs(delta)>2?delta:normalVelocity)||1;return{angle:Math.atan2(geo.ny*sign,geo.nx*sign),normalSpeed:Math.abs(normalVelocity),geo};
  }
  function updateMobilityRoutes(g,dt){
    const now=mobilityNow();g.v94MobilityPads=Array.isArray(g.v94MobilityPads)?g.v94MobilityPads:[];
    for(let i=g.v94MobilityPads.length-1;i>=0;i--){const pad=g.v94MobilityPads[i];pad.ttl=(Number(pad.ttl)||0)-dt;if(pad.ttl<=0||pad.hp<=0){g.v94MobilityPads.splice(i,1);continue;}pad.v94Inside=pad.v94Inside&&typeof pad.v94Inside==='object'?pad.v94Inside:{};let consumed=false;
      for(const p of g.players||[]){const key=String(p.id),threshold=Number(p.radius||18)+Number(pad.radius||24);if(!mobilityAlly(g,pad,p)||now<Number(pad.armedAt||0)||now<Number(pad.v97CooldownUntil?.[key]||0))continue;if(!padCrossedByPlayer(p,pad,threshold))continue;pad.v97CooldownUntil=pad.v97CooldownUntil&&typeof pad.v97CooldownUntil==='object'?pad.v97CooldownUntil:{};pad.v97CooldownUntil[key]=now+500;if(mobilityBoost(g,p,Number(pad.launchAngle)||0,Number(pad.power)||760,'placedGrasshopper',{forwardCarry:.2,tangentCarry:.58})){consumed=true;break;}}
      if(consumed)g.v94MobilityPads.splice(i,1);
    }
    for(let wi=(g.wires||[]).length-1;wi>=0;wi--){const w=g.wires[wi];if(w?.mode!=='spring')continue;w.ttl=(Number(w.ttl)||0)-dt;if(w.ttl<=0||w.hp<=0){g.wires.splice(wi,1);continue;}w.v97CooldownUntil=w.v97CooldownUntil&&typeof w.v97CooldownUntil==='object'?w.v97CooldownUntil:{};
      for(const p of g.players||[]){const key=String(p.id);if(!mobilityAlly(g,w,p)||now<Number(w.v94ArmedAt||0)||now<Number(w.v97CooldownUntil[key]||0))continue;const crossing=springWireCrossing(p,w);if(!crossing)continue;w.v97CooldownUntil[key]=now+720;mobilityBoost(g,p,crossing.angle,Number(w.springPower)||760,'springWire',{forwardCarry:.18,tangentCarry:.72});}
    }
    const hasRouteDevices=(g.v94MobilityPads||[]).length>0||(g.wires||[]).some(w=>w?.mode==='spring');for(const p of g.players||[]){steerAfterMobility(p,dt);if(hasRouteDevices&&!p.human&&!p.dead){const target=nearestEnemy(g,p,760);if(target)cpuUseExistingMobility(g,p,target,dt);}}
  }
  function drawRouteArrow(ctx,x,y,angle,size,color,alpha=.9){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.35;ctx.beginPath();ctx.moveTo(-size*.7,0);ctx.lineTo(size*.55,0);ctx.stroke();ctx.beginPath();ctx.moveTo(size*.65,0);ctx.lineTo(size*.15,-size*.35);ctx.lineTo(size*.15,size*.35);ctx.closePath();ctx.fill();ctx.restore();}
  function drawMobilityRoutes(g){const ctx=g?.ctx||g?.context;if(!ctx)return;const now=mobilityNow();ctx.save();
    for(const pad of g.v94MobilityPads||[]){if(!pad||pad.ttl<=0)continue;const sp=screenPoint(g,pad.x,pad.y),color=g.teamColors?.[pad.team]||'#67f6ae',pulse=1+Math.sin(now*.007+(pad.v94PlacedAt||0))*.08;ctx.save();ctx.translate(sp.x,sp.y);ctx.rotate(Number(pad.launchAngle)||0);ctx.globalAlpha=.72;ctx.fillStyle=`${color}30`;ctx.strokeStyle=color;ctx.lineWidth=1.35;ctx.beginPath();ctx.moveTo(0,-22*pulse);ctx.lineTo(22*pulse,0);ctx.lineTo(0,22*pulse);ctx.lineTo(-22*pulse,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();drawRouteArrow(ctx,sp.x,sp.y,Number(pad.launchAngle)||0,14,color,.95);}
    for(const w of g.wires||[]){if(w?.mode!=='spring')continue;const a=screenPoint(g,w.x1,w.y1),b=screenPoint(g,w.x2,w.y2),geo=springWireGeometry(w),mid={x:(a.x+b.x)*.5,y:(a.y+b.y)*.5},normal=Math.atan2(geo.ny,geo.nx),color=g.teamColors?.[w.team]||'#ffd66d';drawRouteArrow(ctx,mid.x,mid.y,normal,10,color,.82);drawRouteArrow(ctx,mid.x,mid.y,normal+Math.PI,10,color,.82);}
    ctx.restore();}
  function cpuActionReady(p,key,now=mobilityNow()){
    p.v99ActionCooldowns=p.v99ActionCooldowns&&typeof p.v99ActionCooldowns==='object'?p.v99ActionCooldowns:{};
    return now>=Number(p.v99ActionCooldowns[key]||0);
  }
  function lockCpuAction(p,key,seconds){p.v99ActionCooldowns=p.v99ActionCooldowns&&typeof p.v99ActionCooldowns==='object'?p.v99ActionCooldowns:{};p.v99ActionCooldowns[key]=mobilityNow()+Math.max(.1,Number(seconds)||.1)*1000;}
  function cpuPlaceTripWire(g,p,target,d){
    const own=(g.wires||[]).filter(w=>w?.ownerId===p.id&&w?.v96TripWire&&w.ttl>0).length;if(own>=2)return false;
    const lead=clamp(d/620,.22,.68),tx=target.x+(target.vx||0)*lead,ty=target.y+(target.vy||0)*lead,to=Math.atan2(ty-p.y,tx-p.x),side=(String(p.id||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0)%2?1:-1),wireAngle=to+side*(.58+Math.random()*.26),length=clamp(d*.72,155,285);
    p.ai=p.ai||{};const previous=p.ai.placePoint;p.ai.placePoint={x:p.x+Math.cos(wireAngle)*length,y:p.y+Math.sin(wireAngle)*length};p.spiderMode=false;
    const ok=tryNamedUse(g,p,'spider');if(previous)p.ai.placePoint=previous;else delete p.ai.placePoint;return ok;
  }
  function cpuRecentCombatActions(g,p,target,d,all,dt){
    if(!p||p.human||p.dead||(p.v96Knockdown||0)>0)return false;
    p.v99RecentThink=Math.max(0,(p.v99RecentThink||0)-dt);if(p.v99RecentThink>0)return false;p.v99RecentThink=.18+Math.random()*.16;
    const now=mobilityNow();
    if(p.v96KogetsuBranchReady&&now<Number(p.v96KogetsuBranchUntil||0)&&d<165&&cpuActionReady(p,'kogetsuBranch',now)){p.aim=Math.atan2(target.y-p.y,target.x-p.x);if(tryNamedUse(g,p,'kogetsu')){lockCpuAction(p,'kogetsuBranch',1.1);return true;}}
    if(all.includes('scorpion')&&d<175&&cpuActionReady(p,'moleClaw',now)&&Math.random()<.55){if(moleClaw(g,p,true)){lockCpuAction(p,'moleClaw',2.3);return true;}}
    const charging=Object.values(p.shooterCharges||{}).some(Boolean);
    if(all.includes('shooter_viper')&&!charging&&d>180&&d<760&&cpuActionReady(p,'viperPlan',now)&&Math.random()<(.2+Math.min(.28,(p.stats?.technique||0)*.025))){p.aim=Math.atan2(target.y+(target.vy||0)*.34-p.y,target.x+(target.vx||0)*.34-p.x);const hand=selectTrigger(p,'shooter_viper');if(hand){makeViperPlan(g,p,target);let ok=false;try{ok=!!g.tryUseHand?.(p,hand);}catch{}if(ok){lockCpuAction(p,'viperPlan',2.2);return true;}}}
    if(all.includes('spider')&&d>145&&d<520&&cpuActionReady(p,'tripWire',now)&&Math.random()<.22){if(cpuPlaceTripWire(g,p,target,d)){lockCpuAction(p,'tripWire',5.8+Math.random()*2.2);return true;}}
    return false;
  }
  function cpuAdvancedTechniques(g,p,dt){
    if(!p||p.human||p.dead||mobilityNow()<Number(p.ai?.v98HazardUntil||0))return;
    const target=nearestEnemy(g,p,760);if(!target)return;
    const d=Math.hypot(target.x-p.x,target.y-p.y),all=[...(p.loadout?.main||[]),...(p.loadout?.sub||[])],grassCount=all.filter(x=>x==='grasshopper').length,hpRatio=(Number(p.hp)||1)/Math.max(1,Number(p.maxHp)||Number(p.hp)||1),tactical=d<180||d>390||hpRatio<.48;
    if(cpuRecentCombatActions(g,p,target,d,all,dt))return;
    p.v92AdvancedCd=Math.max(0,(p.v92AdvancedCd||0)-dt);if(p.v92AdvancedCd>0)return;
    if(d<250&&all.includes('grasshopper')&&all.includes('scorpion')&&Math.random()<.38){if(pinballFor(g,p,true,target,true)){p.v92AdvancedCd=3.1;return;}}
    if(d<310&&grassCount>=2&&['kogetsu','scorpion','raygust'].some(id=>all.includes(id))&&Math.random()<.3){if(pinballFor(g,p,false,target,true)){p.v92AdvancedCd=3.5;return;}}
    const angle=tacticalMobilityAngle(g,p,target);
    const ownPads=(g.v94MobilityPads||[]).filter(item=>item?.ownerId===p.id&&item.ttl>0).length,ownSpringWires=(g.wires||[]).filter(item=>item?.ownerId===p.id&&item.mode==='spring'&&item.ttl>0).length,nearbyTeamPads=(g.v94MobilityPads||[]).filter(item=>item?.ttl>0&&mobilityAlly(g,item,p)&&Math.hypot(item.x-p.x,item.y-p.y)<280).length,nearbyTeamWires=(g.wires||[]).filter(item=>item?.mode==='spring'&&item.ttl>0&&mobilityAlly(g,item,p)&&segDist(item.x1,item.y1,item.x2,item.y2,p.x,p.y).d<220).length;
    if(all.includes('grasshopper')&&tactical&&ownPads===0&&nearbyTeamPads===0&&Math.random()<.15){p.v94MobilityAngle=angle;p.v77PlaceGrasshopper=true;const ok=tryNamedUse(g,p,'grasshopper');p.v77PlaceGrasshopper=false;delete p.v94MobilityAngle;if(ok){p.v92AdvancedCd=7+Math.random()*2;return;}}
    if(all.includes('spider')&&tactical&&ownSpringWires===0&&nearbyTeamWires===0&&Math.random()<.12){p.ai=p.ai||{};const oldPoint=p.ai.placePoint;p.v94MobilityAngle=angle;const wireAngle=angle+Math.PI/2;p.ai.placePoint={x:p.x+Math.cos(wireAngle)*190,y:p.y+Math.sin(wireAngle)*190};p.spiderMode=true;const ok=tryNamedUse(g,p,'spider');p.spiderMode=false;delete p.v94MobilityAngle;if(oldPoint)p.ai.placePoint=oldPoint;else delete p.ai.placePoint;if(ok){p.v92AdvancedCd=9+Math.random()*3;return;}}
    p.v92AdvancedCd=.8+Math.random()*.7;
  }
  function selectedTriggerId(p,hand){return p?.loadout?.[hand]?.[p?.selected?.[hand]]||null;}
  function viperHand(p){for(const hand of ['main','sub']){const id=selectedTriggerId(p,hand),charge=p?.shooterCharges?.[hand];if(id==='shooter_viper'||charge?.bullet==='viper'||charge?.triggerId==='shooter_viper')return hand;}return null;}
  function makeViperPlan(g,p,target=null){
    if(!p)return false;const hand=viperHand(p);if(!hand&&!hasTrigger(p,'shooter_viper'))return false;
    const aimPoint=p.human?g.getHumanAimPoint?.(p,650):null;target=target||nearestEnemy(g,p,820);
    const endpoint=aimPoint&&Number.isFinite(aimPoint.x)?aimPoint:target?{x:target.x+(target.vx||0)*.42,y:target.y+(target.vy||0)*.42}:{x:p.x+Math.cos(p.aim)*650,y:p.y+Math.sin(p.aim)*650};
    const dx=endpoint.x-p.x,dy=endpoint.y-p.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d,px=-uy,py=ux,side=(p.v96ViperSide=(p.v96ViperSide||-1)*-1),curve=clamp(80+(p.stats?.technique||0)*9,90,210)*side;
    const points=[{x:p.x+dx*.28+px*curve,y:p.y+dy*.28+py*curve},{x:p.x+dx*.62-px*curve*.55,y:p.y+dy*.62-py*curve*.55},{x:endpoint.x,y:endpoint.y}];
    p.v96ViperPlan={hand,points,createdAt:mobilityNow(),expiresAt:mobilityNow()+9000};
    if(p.human)flash('バイパー弾道を事前計算');return true;
  }
  function tagViperProjectiles(g,p,before){
    const plan=p?.v96ViperPlan;if(!plan||mobilityNow()>plan.expiresAt)return;
    for(const key of ['projectiles','bullets','shots']){const arr=g[key];if(!Array.isArray(arr))continue;for(let i=before[key]||0;i<arr.length;i++){const item=arr[i];const owner=item?.ownerId??item?.playerId??item?.sourceId??item?.owner?.id;const bullet=String(item?.bullet||item?.trigger?.bullet||item?.triggerId||item?.sourceKey||'').toLowerCase();if(owner!==p.id&&item?.owner!==p&&item?.source!==p)continue;if(!bullet.includes('viper')&&selectedTriggerId(p,plan.hand)!=='shooter_viper')continue;item.v96ViperRoute=plan.points.map(pt=>({...pt}));item.v96ViperIndex=0;item.v96ViperFixed=true;item.v96ViperOwner=p.id;}}
    p.v96ViperPlan=null;
  }
  function updateViperRoutes(g,dt){
    for(const key of ['projectiles','bullets','shots'])for(const item of g[key]||[]){const route=item?.v96ViperRoute;if(!Array.isArray(route)||!route.length||!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;let index=clamp(Number(item.v96ViperIndex)||0,0,route.length-1),point=route[index],dx=point.x-item.x,dy=point.y-item.y,d=Math.hypot(dx,dy);if(d<24&&index<route.length-1){index++;item.v96ViperIndex=index;point=route[index];dx=point.x-item.x;dy=point.y-item.y;d=Math.hypot(dx,dy);}const speed=Number(item.speed)||Math.hypot(Number(item.vx)||0,Number(item.vy)||0)||720,a=Math.atan2(dy,dx);item.vx=Math.cos(a)*speed;item.vy=Math.sin(a)*speed;item.angle=a;if(index>=route.length-1&&d<20){delete item.v96ViperRoute;}}
  }
  function drawViperPlan(g){const ctx=g?.ctx||g?.context,p=humanOf(g),plan=p?.v96ViperPlan;if(!ctx||!plan||mobilityNow()>plan.expiresAt)return;const start=screenPoint(g,p.x,p.y);ctx.save();ctx.strokeStyle='rgba(196,126,255,.9)';ctx.lineWidth=1.25;ctx.setLineDash?.([8,7]);ctx.beginPath();ctx.moveTo(start.x,start.y);for(const pt of plan.points){const sp=screenPoint(g,pt.x,pt.y);ctx.lineTo(sp.x,sp.y);}ctx.stroke();ctx.setLineDash?.([]);ctx.restore();}
  function tripWireOwner(g,w){return (g.players||[]).find(p=>p.id===w.ownerId)||null;}
  function updateTripWires(g,dt){
    const now=mobilityNow();
    for(const p of g.players||[]){if((p.v96Knockdown||0)>0){p.v96Knockdown=Math.max(0,p.v96Knockdown-dt);p.vx=(p.vx||0)*Math.max(0,1-dt*3.8);p.vy=(p.vy||0)*Math.max(0,1-dt*3.8);p.shields&&(p.shields.main=null,p.shields.sub=null);p.ai=p.ai||{};p.ai.attackTimer=Math.max(p.ai.attackTimer||0,p.v96Knockdown+.15);p.slowTimer=0;p.slowFactor=1;}}
    for(let wi=(g.wires||[]).length-1;wi>=0;wi--){const w=g.wires[wi];if(!w?.v96TripWire)continue;w.ttl=(Number(w.ttl)||0)-dt;if(w.ttl<=0||w.hp<=0){g.wires.splice(wi,1);continue;}w.v96TripHits=w.v96TripHits&&typeof w.v96TripHits==='object'?w.v96TripHits:{};for(const target of g.players||[]){if(target.dead||target.id===w.ownerId)continue;const owner=tripWireOwner(g,w),hostile=owner?g.canDamage?.(owner,target):target.team!==w.team;if(!hostile)continue;const hit=segDist(w.x1,w.y1,w.x2,w.y2,target.x,target.y),near=hit.d<=(target.radius||18)+7,key=String(target.id);if(!near){if(now-(w.v96TripHits[key]||0)>900)delete w.v96TripHits[key];continue;}target.slowTimer=0;target.slowFactor=1;if(Number.isFinite(w.v96TripHits[key])&&now-w.v96TripHits[key]<1200)continue;w.v96TripHits[key]=now;const dx=w.x2-w.x1,dy=w.y2-w.y1,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,sign=((target.x-w.x1)*nx+(target.y-w.y1)*ny)>=0?1:-1;target.vx=nx*sign*230;target.vy=ny*sign*230;target.v96Knockdown=Math.max(target.v96Knockdown||0,.72+Math.min(.38,(owner?.stats?.technique||0)*.025));target.v96KnockdownBy=w.ownerId;(g.effects||=[]).push({type:'bind',x:target.x,y:target.y,ttl:.55,maxTtl:.55,v96Trip:true});}}
  }
  function isEngineer(p){return p?.archetype==='工作手'||p?.role==='工作手'||hasTrigger(p,'switchbox');}
  function engineerTactics(g,p,dt){
    if(!p||p.human||p.dead||!isEngineer(p)||mobilityNow()<Number(p.ai?.v98HazardUntil||0))return;const target=nearestEnemy(g,p,820);if(!target)return;p.v96EngineerCd=Math.max(0,(p.v96EngineerCd||0)-dt);const d=Math.hypot(target.x-p.x,target.y-p.y),a=Math.atan2(target.y-p.y,target.x-p.x),side=(String(p.id).length%2?1:-1);if(d<410)nudgeAway(p,target.x,target.y,170*dt);p.vx=(p.vx||0)+Math.cos(a+side*Math.PI/2)*75*dt;p.vy=(p.vy||0)+Math.sin(a+side*Math.PI/2)*75*dt;
    if(p.v96EngineerCd>0)return;const own=(g.traps||[]).filter(t=>t.ownerId===p.id&&t.ttl>0);if(own.length>=3){p.v96EngineerCd=1.1;return;}const lead=clamp(d/520,.25,.8),tx=target.x+(target.vx||0)*lead,ty=target.y+(target.vy||0)*lead;p.ai=p.ai||{};p.ai.placePoint={x:tx+Math.cos(a+Math.PI)*55,y:ty+Math.sin(a+Math.PI)*55};p.trapMode=d<220?1:(own.length%3===0?0:1);if(tryNamedUse(g,p,'switchbox'))p.v96EngineerCd=3.2+Math.random()*1.8;else p.v96EngineerCd=.8;
  }
  function trapDisguiseSeed(trap){return String(trap?.id||trap?.ownerId||'trap').split('').reduce((sum,ch)=>sum+ch.charCodeAt(0),0)+(Math.floor(Number(trap?.x)||0)*3)+(Math.floor(Number(trap?.y)||0)*5);}
  function ensureTrapDisguise(g,trap){
    if(!trap?.v96EngineerTrap||trap.v101Disguised)return trap;
    const seed=trapDisguiseSeed(trap),smallWalls=(g.walls||[]).filter(w=>w&&Number.isFinite(w.x)&&Number.isFinite(w.y)&&Number.isFinite(w.w)&&Number.isFinite(w.h)&&w.w>8&&w.h>8&&Math.max(w.w,w.h)<=104&&w.w*w.h<=5600&&!['escudo','building','buildingWall','fortressWall','bridge','templeWall','shrineStone'].includes(w.type));
    const pickups=(g.pickups||[]).filter(item=>item&&item.active!==false&&Number.isFinite(item.x)&&Number.isFinite(item.y));
    const usePickup=pickups.length&&(seed%5<2||!smallWalls.length);
    if(usePickup){const source=pickups[seed%pickups.length];trap.v101Disguise={kind:'pickup',template:{radius:Number(source.radius)||9,value:Number(source.value)||3,scoreValue:Number(source.scoreValue)||0,team:source.team??null}};trap.v101TriggerRadius=36;}
    else if(smallWalls.length){const source=smallWalls[seed%smallWalls.length];trap.v101Disguise={kind:'wall',template:{type:source.type||'barricade',w:clamp(Number(source.w)||28,14,104),h:clamp(Number(source.h)||28,14,104)}};trap.v101TriggerRadius=clamp(Math.max(Number(source.w)||28,Number(source.h)||28)*.5+24,42,82);}
    else{trap.v101Disguise={kind:'pickup',template:{radius:9,value:3,scoreValue:0,team:null}};trap.v101TriggerRadius=36;}
    trap.v101Disguised=true;trap.v101DisguiseAt=mobilityNow();return trap;
  }
  function trapDisguiseRenderLists(g){
    const walls=[],pickups=[];for(const trap of g.traps||[]){if(!trap?.v101Disguised||trap.ttl<=0||trap.hp<=0)continue;const d=trap.v101Disguise||{};if(d.kind==='wall'){const t=d.template||{},w=Number(t.w)||28,h=Number(t.h)||28;walls.push({id:`v101-disguise-wall-${trap.ownerId}-${trap.x}-${trap.y}`,x:trap.x-w/2,y:trap.y-h/2,w,h,type:t.type||'barricade',ttl:Infinity,v101TrapDisguise:true});}else{const t=d.template||{};pickups.push({id:`v101-disguise-pickup-${trap.ownerId}-${trap.x}-${trap.y}`,x:trap.x,y:trap.y,radius:Number(t.radius)||9,value:Number(t.value)||3,scoreValue:Number(t.scoreValue)||0,team:t.team??null,active:true,temporary:false,pulse:(mobilityNow()*.002)%6.28,v101TrapDisguise:true});}}return{walls,pickups};
  }
  function drawFriendlyTrapHints(g){const ctx=g?.ctx||g?.context,human=humanOf(g);if(!ctx||!human)return;ctx.save();for(const trap of g.traps||[]){if(!trap?.v101Disguised||trap.ttl<=0||trap.hp<=0)continue;const friendly=g.config?.mode==='solo'&&!g.isDefenseMode?trap.ownerId===human.id:trap.team===human.team;if(!friendly)continue;const sp=screenPoint(g,trap.x,trap.y);ctx.globalAlpha=.72;ctx.fillStyle=g.teamColors?.[trap.team]||'#8be6ff';ctx.beginPath();ctx.arc(sp.x,sp.y,2.2,0,Math.PI*2);ctx.fill();}ctx.restore();}
  function normalizeFiniteTimers(p){
    if(!p)return;p.ai=p.ai&&typeof p.ai==='object'?p.ai:{};for(const key of ['attackTimer','dodgeTimer','dangerEscapeTimer'])if(!Number.isFinite(Number(p.ai[key]))||Number(p.ai[key])>30)p.ai[key]=0;
    for(const bucket of [p.cooldowns,p.cooldownMax,p.shooterHandLock])if(bucket&&typeof bucket==='object')for(const key of Object.keys(bucket))if(!Number.isFinite(Number(bucket[key]))||Number(bucket[key])>30)bucket[key]=0;
    if(!Number.isFinite(Number(p.v96Knockdown))||Number(p.v96Knockdown)>6)p.v96Knockdown=0;if(!Number.isFinite(Number(p.v100Restrained))||Number(p.v100Restrained)>6)p.v100Restrained=0;
  }
  function offensiveIdsFor(p,d){const all=[...(p.loadout?.main||[]),...(p.loadout?.sub||[])];const close=['kogetsu','scorpion','raygust','senku','gun_shotgun_asteroid','gun_handgun_asteroid','gun_handgun_viper'],far=['shooter_asteroid','shooter_hound','shooter_viper','shooter_meteor','gun_assault_asteroid','gun_assault_hound','gun_assault_meteor','gun_grenade_asteroid','gun_grenade_meteor','egret','lightning','ibis'];return(d<190?[...close,...far]:[...far,...close]).filter((id,index,list)=>all.includes(id)&&list.indexOf(id)===index);}
  function updateStallRecovery(g,p,dt){
    if(!p||p.dead)return;normalizeFiniteTimers(p);const now=mobilityNow();p.v101Stall=p.v101Stall&&typeof p.v101Stall==='object'?p.v101Stall:{x:p.x,y:p.y,movedAt:now,lastActionAt:now,lastRecoveryAt:0,routeX:p.x,routeY:p.y,routeAt:now};const state=p.v101Stall,move=Math.hypot(p.x-state.x,p.y-state.y);
    if(move>4.5){state.x=p.x;state.y=p.y;state.movedAt=now;}
    if(p.v97MobilityRoute){const routeMove=Math.hypot(p.x-state.routeX,p.y-state.routeY);if(routeMove>8){state.routeX=p.x;state.routeY=p.y;state.routeAt=now;}else if(now-state.routeAt>1500){delete p.v97MobilityRoute;state.routeAt=now;}}else{state.routeX=p.x;state.routeY=p.y;state.routeAt=now;}
    if(p.human||Number(p.v96Knockdown)>0||Number(p.v100Restrained)>0||now<Number(p.v101PinballActiveUntil||0))return;const target=g.resolveAITarget?.(p)||nearestEnemy(g,p,950);if(!target)return;const d=Math.hypot(target.x-p.x,target.y-p.y);
    if(d>120&&now-state.movedAt>1350&&now-state.lastRecoveryAt>700){const desired=chooseOpenMobilityAngle(g,p,Math.atan2(target.y-p.y,target.x-p.x),96),impulse=Math.max(76,(Number(p.speed)||150)*.54),blend=.64;p.vx=(Number(p.vx)||0)*(1-blend)+Math.cos(desired)*impulse*blend;p.vy=(Number(p.vy)||0)*(1-blend)+Math.sin(desired)*impulse*blend;p.ai.navPath=[];p.ai.navPathIndex=0;delete p.v97MobilityRoute;delete p.ai.v98HazardAngle;p.ai.v98HazardUntil=0;p.ai.dangerEscapeTimer=0;state.x=p.x;state.y=p.y;state.movedAt=now;state.lastRecoveryAt=now;}
    const actionAt=Math.max(Number(state.lastActionAt)||0,Number(p.v101LastActionAt)||0);if(d<920&&now-actionAt>4800&&now-state.lastRecoveryAt>700){p.ai.attackTimer=0;let used=false;for(const id of offensiveIdsFor(p,d)){p.aim=Math.atan2(target.y-p.y,target.x-p.x);if(tryNamedUse(g,p,id)){used=true;break;}}if(!used){for(const hand of ['main','sub']){if(p.shooterCharges?.[hand]){try{used=!!g.tryUseHand?.(p,hand);}catch{}if(!used){p.shooterCharges[hand]=null;if(p.shooterHandLock)p.shooterHandLock[hand]=0;}}}}state.lastActionAt=used?now:now-2800;state.lastRecoveryAt=now;}
  }
  function updateEngineerTraps(g,dt){
    if(!Array.isArray(g.traps))return;
    for(let i=g.traps.length-1;i>=0;i--){const trap=g.traps[i];if(!trap?.v96EngineerTrap)continue;ensureTrapDisguise(g,trap);trap.ttl=(Number(trap.ttl)||0)-dt;trap.armed=(Number(trap.armed)||0)-dt;if(trap.ttl<=0||trap.hp<=0){g.traps.splice(i,1);continue;}if(trap.armed>0)continue;const owner=(g.players||[]).find(p=>p.id===trap.ownerId&&!p.dead);if(!owner)continue;const hostile=(p)=>!p.dead&&p.id!==owner.id&&g.canDamage?.(owner,p),ally=(p)=>!p.dead&&(g.config?.mode==='solo'?!p.human&&p.id===owner.id:p.team===owner.team);
      if(trap.type===0){const target=(g.players||[]).find(p=>hostile(p)&&Math.hypot(p.x-trap.x,p.y-trap.y)<(Number(trap.v101TriggerRadius)||55)+(p.radius||18));if(target){g.explode?.(trap.x,trap.y,155,62+(owner.stats?.technique||0)*1.8,owner.id,owner.team,null,'強化攻撃トラップ',{sourceKey:'switchboxAttack'});g.traps.splice(i,1);}}
      else if(trap.type===1){const target=(g.players||[]).find(p=>hostile(p)&&Math.hypot(p.x-trap.x,p.y-trap.y)<(Number(trap.v101TriggerRadius)||52)+(p.radius||18));if(target){target.v96Knockdown=Math.max(target.v96Knockdown||0,1.05+(owner.stats?.technique||0)*.025);target.vx*=.18;target.vy*=.18;(g.effects||=[]).push({type:'bind',x:target.x,y:target.y,ttl:.8,maxTtl:.8});g.traps.splice(i,1);}}
      else if(trap.type===2){const target=(g.players||[]).find(p=>ally(p)&&Math.hypot(p.x-trap.x,p.y-trap.y)<(Number(trap.v101TriggerRadius)||48)+(p.radius||18));if(target){mobilityBoost(g,target,target.aim,730+(owner.stats?.technique||0)*20,'engineerBoostTrap');g.traps.splice(i,1);}}
    }
  }
  function updateEngineerTrapEffects(g){
    for(const p of g.players||[]){if((p.slowTimer||0)>4.1&&p.slowFactor<=.32&&!p.v96EngineerBindMarked){p.v96EngineerBindMarked=true;p.v96Knockdown=Math.max(p.v96Knockdown||0,.48);setTimeout(()=>{if(p)p.v96EngineerBindMarked=false;},650);}}
  }
  function updateKogetsuBranch(g,p,dt){if(!p||p.dead)return;if(p.v96KogetsuBranchUntil&&mobilityNow()>p.v96KogetsuBranchUntil){p.v96KogetsuBranchReady=false;p.v96KogetsuBranchUntil=0;}if(!p.human&&p.v96KogetsuBranchReady){const t=nearestEnemy(g,p,150);if(t){p.aim=Math.atan2(t.y-p.y,t.x-p.x);tryNamedUse(g,p,'kogetsu');}}}
  function hazardOwner(g,item){return (g.players||[]).find(unit=>unit?.id===item?.ownerId)||null;}
  function hazardIsHostile(g,item,p){
    if(!item||!p)return false;
    const owner=hazardOwner(g,item);
    if(owner&&typeof g.canDamage==='function')return Boolean(g.canDamage(owner,p));
    if(g.config?.mode==='solo'&&!g.isDefenseMode)return item.ownerId!==p.id;
    return item.team!==p.team;
  }
  function segmentPairDistance(ax,ay,bx,by,cx,cy,dx,dy){
    const cross=(x1,y1,x2,y2,x3,y3)=>(x2-x1)*(y3-y1)-(y2-y1)*(x3-x1),eps=1e-7,on=(x1,y1,x2,y2,x3,y3)=>Math.abs(cross(x1,y1,x2,y2,x3,y3))<=eps&&x3>=Math.min(x1,x2)-eps&&x3<=Math.max(x1,x2)+eps&&y3>=Math.min(y1,y2)-eps&&y3<=Math.max(y1,y2)+eps;
    const c1=cross(ax,ay,bx,by,cx,cy),c2=cross(ax,ay,bx,by,dx,dy),c3=cross(cx,cy,dx,dy,ax,ay),c4=cross(cx,cy,dx,dy,bx,by),proper=(c1>eps&&c2<-eps||c1<-eps&&c2>eps)&&(c3>eps&&c4<-eps||c3<-eps&&c4>eps);
    if(proper||on(ax,ay,bx,by,cx,cy)||on(ax,ay,bx,by,dx,dy)||on(cx,cy,dx,dy,ax,ay)||on(cx,cy,dx,dy,bx,by))return 0;
    return Math.min(segDist(ax,ay,bx,by,cx,cy).d,segDist(ax,ay,bx,by,dx,dy).d,segDist(cx,cy,dx,dy,ax,ay).d,segDist(cx,cy,dx,dy,bx,by).d);
  }
  function collectPlacedHazards(g,p){
    const snapshot=g.v98HazardSnapshot||{},seen=new Set(),hazards=[];
    const addWire=w=>{if(!w||seen.has(w)||!w.v96TripWire||w.mode==='spring'||Number(w.ttl)<=0||Number(w.hp)<=0||!hazardIsHostile(g,w,p))return;seen.add(w);hazards.push({kind:'wire',item:w});};
    const addTrap=t=>{if(!t||seen.has(t)||t.v101Disguised||Number(t.ttl)<=0||Number(t.hp)<=0||Number(t.type)===2||!hazardIsHostile(g,t,p))return;seen.add(t);hazards.push({kind:'trap',item:t});};
    for(const w of snapshot.wires||[])addWire(w);for(const w of g.wires||[])addWire(w);
    for(const t of snapshot.traps||[])addTrap(t);for(const t of g.traps||[])addTrap(t);
    return hazards;
  }
  function hazardPathCost(g,p,angle,lookahead,hazards){
    const endX=p.x+Math.cos(angle)*lookahead,endY=p.y+Math.sin(angle)*lookahead,r=Number(p.radius)||18;
    let cost=pointBlocked(g,endX,endY,r+8)?900:0,immediate=0;
    for(const hazard of hazards){
      if(hazard.kind==='wire'){
        const w=hazard.item,d=segmentPairDistance(p.x,p.y,endX,endY,Number(w.x1),Number(w.y1),Number(w.x2),Number(w.y2)),current=segDist(w.x1,w.y1,w.x2,w.y2,p.x,p.y).d,safe=r+44;
        if(d<safe)cost+=(safe-d)/safe*620;if(d<r+13)cost+=1250;if(current<safe){immediate=Math.max(immediate,(safe-current)/safe);cost+=(safe-current)/safe*780;}
      }else{
        const t=hazard.item,trigger=Number(t.type)===1?100:105,safe=trigger+r+58,d=segDist(p.x,p.y,endX,endY,Number(t.x),Number(t.y)).d,current=Math.hypot(p.x-Number(t.x),p.y-Number(t.y));
        if(d<safe)cost+=(safe-d)/safe*(Number(t.type)===0?760:650);if(d<trigger+r)cost+=1450;if(current<safe){immediate=Math.max(immediate,(safe-current)/safe);cost+=(safe-current)/safe*900;}
      }
    }
    return{cost,immediate,endX,endY};
  }
  function avoidPlacedHazards(g,p,dt){
    if(!p||p.dead||p.human||!p.ai)return false;
    const hazards=collectPlacedHazards(g,p);if(!hazards.length){delete p.ai.v98HazardAngle;delete p.ai.v98HazardUntil;return false;}
    const now=mobilityNow(),tech=Number(p.stats?.technique)||5,speed=Math.hypot(Number(p.vx)||0,Number(p.vy)||0),target=g.resolveAITarget?.(p)||nearestEnemy(g,p,900),base= speed>42?Math.atan2(p.vy,p.vx):target?Math.atan2(target.y-p.y,target.x-p.x):Number(p.aim)||0,lookahead=clamp(175+tech*15+speed*.14,210,430);
    const baseInfo=hazardPathCost(g,p,base,lookahead,hazards);
    if(baseInfo.cost<70&&baseInfo.immediate<.08&&now>Number(p.ai.v98HazardUntil||0)){delete p.ai.v98HazardAngle;return false;}
    let best={angle:base,info:baseInfo,score:baseInfo.cost};
    const held=now<Number(p.ai.v98HazardUntil||0)&&Number.isFinite(p.ai.v98HazardAngle)?p.ai.v98HazardAngle:null;
    const candidates=held===null?[0,.34,-.34,.62,-.62,.92,-.92,1.24,-1.24,1.58,-1.58,Math.PI]:[angleDelta(held,base),.34,-.34,.62,-.62,.92,-.92,1.24,-1.24,1.58,-1.58,Math.PI];
    for(const offset of candidates){const angle=base+offset,info=hazardPathCost(g,p,angle,lookahead,hazards),turnPenalty=Math.abs(offset)*24,continuity=held!==null?Math.abs(angleDelta(angle,held))*18:0,score=info.cost+turnPenalty+continuity;if(score<best.score)best={angle,info,score};}
    if(best.info.cost>=baseInfo.cost*.94&&baseInfo.immediate<.12)return false;
    const urgency=baseInfo.immediate>.18?1.32:1.08,accel=(Number(p.speed)||150)*Math.max(0,Number(dt)||0)*5.15*urgency;
    p.vx=(Number(p.vx)||0)+Math.cos(best.angle)*accel;p.vy=(Number(p.vy)||0)+Math.sin(best.angle)*accel;
    p.aim=(Number(p.aim)||0)+clamp(angleDelta(best.angle,Number(p.aim)||0),-5.2*dt,5.2*dt);
    p.ai.v98HazardAngle=best.angle;p.ai.v98HazardUntil=now+(baseInfo.immediate>.18?520:330);p.ai.dangerEscapeTimer=Math.max(Number(p.ai.dangerEscapeTimer)||0,.42);p.ai.navPath=[];p.ai.navPathIndex=0;p.ai.v98HazardAvoidances=(p.ai.v98HazardAvoidances||0)+1;
    g.applyAISeparation?.(p,dt,false);
    return true;
  }
  function screenPoint(g,x,y){const cam=g.camera||{x:0,y:0};return{x:x-(cam.x||0),y:y-(cam.y||0)};}
  function tetraPath(ctx,x,y,r,angle=0){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(-r*.78,r*.58);ctx.lineTo(r*.78,r*.58);ctx.closePath();ctx.moveTo(0,-r);ctx.lineTo(r*.12,r*.08);ctx.lineTo(-r*.78,r*.58);ctx.moveTo(r*.12,r*.08);ctx.lineTo(r*.78,r*.58);ctx.restore();}
  function tetraPalette(source){const key=String(source?.bullet||source?.trigger?.bullet||source?.triggerId||source?.id||source?.sourceKey||'').toLowerCase();if(key.includes('meteor'))return{fill:'rgba(255,118,76,.82)',stroke:'rgba(255,220,198,.95)'};if(key.includes('hound'))return{fill:'rgba(255,211,74,.82)',stroke:'rgba(255,246,187,.95)'};if(key.includes('viper'))return{fill:'rgba(177,93,255,.82)',stroke:'rgba(235,207,255,.95)'};return{fill:'rgba(74,153,218,.82)',stroke:'rgba(220,247,255,.95)'};}
  function drawTetraAt(ctx,x,y,r,angle=0,source=null){const palette=tetraPalette(source);ctx.save();ctx.fillStyle=palette.fill;ctx.strokeStyle=palette.stroke;ctx.lineWidth=.22;ctx.lineJoin='round';tetraPath(ctx,x,y,r,angle);ctx.fill();ctx.stroke();ctx.restore();}
  function projectileOwnerIsNinomiya(g,item){if(!item)return false;const id=item.ownerId??item.playerId??item.sourceId??item.owner?.id??item.source?.id;return (g.players||[]).some(p=>p.v78Named==='NINOMIYA'&&(p===item.owner||p===item.source||p.id===id));}
  function animatedTetraAngle(base,seed,speed=.0018){return base+Math.sin(performance.now()*speed+seed)*.42+performance.now()*speed*.16;}
  function splitCountOf(charge){
    const candidates=[charge?.splitCount,charge?.divisions,charge?.divisionCount,charge?.parts,charge?.level,charge?.splitLevel];
    for(const value of candidates)if(Number.isFinite(Number(value)))return clamp(Math.round(Number(value)),0,16);
    for(const key of ['fragments','cubes','orbits','pieces'])if(Array.isArray(charge?.[key]))return clamp(charge[key].length,0,16);
    return charge?.v86Tetra?4:0;
  }
  function nativeCubeDiameter(source,fallback=14){
    const direct=[source?.cubeSize,source?.size,source?.diameter,source?.edge,source?.width];
    for(const value of direct)if(Number.isFinite(Number(value))&&Number(value)>0)return Number(value);
    const radial=[source?.radius,source?.r];
    for(const value of radial)if(Number.isFinite(Number(value))&&Number(value)>0)return Number(value)*2;
    return fallback;
  }
  function nativeOrbitRadius(charge,owner,count){
    const values=[charge?.orbitRadius,charge?.orbitDistance,charge?.ringRadius,charge?.distanceFromOwner];
    for(const value of values)if(Number.isFinite(Number(value))&&Number(value)>0)return Number(value);
    const arrays=['fragments','cubes','orbits','pieces'];
    for(const key of arrays){
      const list=charge?.[key];
      if(!Array.isArray(list)||!list.length)continue;
      const distances=list.filter(Boolean).map(item=>Math.hypot((item.x??owner.x)-owner.x,(item.y??owner.y)-owner.y)).filter(Number.isFinite);
      if(distances.length)return distances.reduce((a,b)=>a+b,0)/distances.length;
    }
    return 38+Math.min(12,Math.max(0,count-1)*1.6);
  }
  function nativeFragmentList(charge){
    for(const key of ['fragments','cubes','orbits','pieces'])if(Array.isArray(charge?.[key]))return charge[key];
    return null;
  }
  function tetraRadiusFromCubeDiameter(diameter){return Math.max(2.2,diameter*.625);}
  function drawNinomiyaTetrahedrons(g){const ctx=g?.ctx||g?.context;if(!ctx)return;const n=(g.players||[]).find(p=>p.v78Named==='NINOMIYA'&&!p.dead);if(!n)return;
    const now=performance.now();
    const charges=n.shooterCharges?Object.values(n.shooterCharges).filter(Boolean):[];
    charges.forEach((charge,index)=>{
      const aim=Number.isFinite(charge.aim)?charge.aim:n.aim;
      const seed=charge.v88SpinSeed??(charge.v88SpinSeed=(index+1)*1.73);
      const baseDiameter=nativeCubeDiameter(charge,14);
      const count=splitCountOf(charge);
      const fragments=nativeFragmentList(charge);
      if(count<=0){
        const wx=Number.isFinite(charge.x)?charge.x:n.x+Math.cos(aim)*34;
        const wy=Number.isFinite(charge.y)?charge.y:n.y+Math.sin(aim)*34;
        const sp=screenPoint(g,wx,wy);
        drawTetraAt(ctx,sp.x,sp.y,tetraRadiusFromCubeDiameter(baseDiameter),animatedTetraAngle(aim+Math.PI/2,seed,.0027),charge);
        return;
      }
      const splitDiameter=baseDiameter/Math.sqrt(Math.max(1,count));
      if(fragments&&fragments.length){
        fragments.forEach((fragment,i)=>{
          if(!fragment)return;
          const wx=Number.isFinite(fragment.x)?fragment.x:n.x;
          const wy=Number.isFinite(fragment.y)?fragment.y:n.y;
          const sp=screenPoint(g,wx,wy);
          const diameter=nativeCubeDiameter(fragment,splitDiameter);
          const base=Number.isFinite(fragment.angle)?fragment.angle:Math.atan2(wy-n.y,wx-n.x);
          drawTetraAt(ctx,sp.x,sp.y,tetraRadiusFromCubeDiameter(diameter),animatedTetraAngle(base+Math.PI/2,seed+i*.83,.0031),fragment||charge);
        });
        return;
      }
      const orbit=nativeOrbitRadius(charge,n,count);
      const phase=Number.isFinite(charge.orbitAngle)?charge.orbitAngle:(Number.isFinite(charge.phase)?charge.phase:seed);
      const speed=Number.isFinite(charge.orbitSpeed)?charge.orbitSpeed:.00135;
      const ownerSp=screenPoint(g,n.x,n.y);
      for(let i=0;i<count;i++){
        const a=phase+now*speed+i*Math.PI*2/count;
        drawTetraAt(ctx,ownerSp.x+Math.cos(a)*orbit,ownerSp.y+Math.sin(a)*orbit,tetraRadiusFromCubeDiameter(splitDiameter),animatedTetraAngle(a+Math.PI/2,seed+i*.83,.0031),charge);
      }
    });
    const groups=[g.projectiles,g.bullets,g.shots].filter(Array.isArray);const seen=new Set();for(const group of groups)for(const item of group){if(!item||seen.has(item)||!projectileOwnerIsNinomiya(g,item))continue;seen.add(item);if(!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;const sp=screenPoint(g,item.x,item.y);const base=Number.isFinite(item.angle)?item.angle:Math.atan2(item.vy||0,item.vx||1);const seed=item.v88SpinSeed??(item.v88SpinSeed=Math.random()*Math.PI*2);const diameter=nativeCubeDiameter(item,Math.max(7,(item.radius||item.r||4)*2));drawTetraAt(ctx,sp.x,sp.y,tetraRadiusFromCubeDiameter(diameter),animatedTetraAngle(base+Math.PI/2,seed,.0031),item);}
  }
  function hideNinomiyaNativeCubes(g){const n=(g.players||[]).find(p=>p.v78Named==='NINOMIYA');const saved={charges:n?.shooterCharges,groups:[]};if(n&&n.shooterCharges)n.shooterCharges={};for(const key of ['projectiles','bullets','shots']){const arr=g[key];if(!Array.isArray(arr))continue;const filtered=arr.filter(item=>!projectileOwnerIsNinomiya(g,item));if(filtered.length!==arr.length){saved.groups.push([key,arr]);g[key]=filtered;}}return()=>{if(n&&saved.charges)n.shooterCharges=saved.charges;for(const [key,arr] of saved.groups)g[key]=arr;};}
  function tagNewNinomiyaProjectiles(g,p,before){if(p?.v78Named!=='NINOMIYA')return;for(const [key,count] of Object.entries(before)){const arr=g[key];if(!Array.isArray(arr))continue;for(const item of arr.slice(count)){if(item&&typeof item==='object'){item.v86Tetra=true;item.v88SpinSeed??=Math.random()*Math.PI*2;item.ownerId??=p.id;}}}}

  function patchGame(g){if(!g||!g.constructor)return;currentGame=g;if(g.simulationMode)applySimulationNamed(g);else applyNamed(g);window.requestAnimationFrame?.(()=>document.documentElement.classList.remove('v96-spawning'));const proto=Object.getPrototypeOf(g);if(patchedProto===proto)return;patchedProto=proto;
    const oldLogCombatDetail=proto.logCombatDetail;if(typeof oldLogCombatDetail==='function')proto.logCombatDetail=function(type,player=null,detail={},store=true){let safeDetail;try{safeDetail=safeLogValue(detail);}catch(_){safeDetail={message:String(detail?.message||`${player?.name||'SYSTEM'} ${type}`),sanitized:true};}if(!safeDetail||typeof safeDetail!=='object'||Array.isArray(safeDetail))safeDetail={value:safeDetail};return oldLogCombatDetail.call(this,type,player,safeDetail,store);};
    const oldDangerAvoidance=proto.updateAIDangerAvoidance;if(typeof oldDangerAvoidance==='function')proto.updateAIDangerAvoidance=function(p,dt){if(oldDangerAvoidance.call(this,p,dt))return true;return avoidPlacedHazards(this,p,dt);};
    const oldUseMelee=proto.useMelee;proto.useMelee=function(p,hand,trigger,options){if((p?.v96Knockdown||0)>0)return false;if(trigger?.id==='scorpion'&&moleClaw(this,p,true)){this.setCooldown?.(p,hand,Math.max(.28,(Number(trigger?.cooldown)||.34)*.8));this.revealOnAttack?.(p,1.2);return true;}const out=typeof oldUseMelee==='function'?oldUseMelee.call(this,p,hand,trigger,options):false;if(out&&trigger?.id==='kogetsu'&&p?.v96KogetsuBranchReady&&mobilityNow()<(p.v96KogetsuBranchUntil||0)){p.v96KogetsuBranchReady=false;p.v96KogetsuBranchUntil=0;const slot=`${hand}:${p.selected?.[hand]??0}`;if(Number.isFinite(p.cooldowns?.[slot]))p.cooldowns[slot]*=.52;battleTimeout(this,p,()=>{if(p.dead)return;this.performSlash?.(p,(Number(trigger.range)||94)*1.18,(Number(trigger.damage)||28)*.68,.72,'kogetsuBranch');(this.effects||=[]).push({type:'justCut',x:p.x,y:p.y,angle:p.aim,radius:(p.radius||18)+28,ttl:.26,maxTtl:.26,color:'#e8fdff'});},85);if(p.human)flash('弧月・ジャスト派生');}return out;};
    const oldSenku=proto.performSenku;proto.performSenku=function(p,trigger){const duration=p.v79IkomaSenku?.2:clamp(settings.senkuDuration,.18,1.2),ratio=.7/duration,range=((trigger?.range||390)+(p.stats?.trion||0)*8)*clamp(Math.sqrt(ratio),.72,p.v79IkomaSenku?2.75:2),end={x:p.x+Math.cos(p.aim)*range,y:p.y+Math.sin(p.aim)*range};this.sfx?.play('attacker',{x:p.x,y:p.y,bucket:`senku:${p.id}`,cooldown:.12,volume:.5,rate:.94});(this.effects||=[]).push({type:'senku',x:p.x,y:p.y,x2:end.x,y2:end.y,ttl:duration,maxTtl:duration});this.damageWorldSegment?.(p.x,p.y,end.x,end.y,trigger.damage*.8,p.team,20);const hits=[];for(const target of this.players||[]){if(!this.canDamage?.(p,target))continue;const hit=segDist(p.x,p.y,end.x,end.y,target.x,target.y);if(hit.d<=target.radius+20)hits.push({target,hit});}hits.sort((a,b)=>a.hit.t-b.hit.t).forEach(({target,hit},i)=>this.damagePlayer?.(target,trigger.damage*(.72+hit.t*.62)*[1,.62,.38,.25][Math.min(i,3)]*(.82+(p.stats?.combat||0)*.04),p,{x:p.x,y:p.y,type:'melee',name:'旋空',sourceKey:'senku'}));};
    const oldSlash=proto.performSlash;proto.performSlash=function(p,range,damage,arc,style){const before=this.effects?.length||0,result=typeof oldSlash==='function'?oldSlash.call(this,p,range,damage,arc,style):false;if(style==='kogetsu'&&this.effects?.length>before){const e=this.effects[this.effects.length-1],speed=clamp(.42-(p.stats?.combat||0)*.028,.12,.38);e.ttl=e.maxTtl=speed;e.v77Draw=true;}return result;};
    const oldWire=proto.placeWire;proto.placeWire=function(p,hand,trigger){const ok=typeof oldWire==='function'?oldWire.call(this,p,hand,trigger):false;if(ok){const wires=Array.isArray(this.wires)?this.wires:[];const w=wires[wires.length-1];if(w&&p.spiderMode){const now=mobilityNow();w.mode='spring';w.v94MobilityWire=true;w.v94PlacedAt=now;w.v94ArmedAt=now+(p.human?130:70);w.v94Inside={};w.v97CooldownUntil={};w.springPower=700+(p.stats?.combat||0)*29;w.hp=Math.max(w.hp||0,48);w.ttl=p.human?Math.min(Math.max(Number(w.ttl)||30,10),36):Math.min(Math.max(Number(w.ttl)||8,4),9);w.preferredLaunchAngle=Number.isFinite(p.v94MobilityAngle)?p.v94MobilityAngle:null;capOwnerDevices(wires,p.id,p.human?4:1,item=>item?.mode==='spring');}else if(w){w.v96TripWire=true;w.mode='normal';w.hp=Math.max(Number(w.hp)||0,34+(p.stats?.technique||0)*2);w.ttl=Math.min(Math.max(Number(w.ttl)||28,12),36);w.v96TripHits={};}}return ok;};
    const oldGrass=proto.grasshopper;proto.grasshopper=function(p,hand,trigger){if(p.human&&shiftHeld){settings.grasshopperMode=settings.grasshopperMode==='placed'?'instant':'placed';save();flash(`グラスホッパー：${settings.grasshopperMode==='placed'?'設置':'即時使用'}`);return true;}if((p.human&&settings.grasshopperMode==='placed')||p.v77PlaceGrasshopper){if(!this.consumeTrion?.(p,Number(trigger?.cost)||0))return false;const aimed=p.human?this.getHumanAimPoint?.(p,210):null,intended=Number.isFinite(p.v94MobilityAngle)?p.v94MobilityAngle:null,target=aimed&&Number.isFinite(aimed.x)&&Number.isFinite(aimed.y)?aimed:{x:p.x+Math.cos(intended??p.aim)*120,y:p.y+Math.sin(intended??p.aim)*120},dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy)||1,angle=intended??Math.atan2(dy,dx),travel=p.human?Math.min(Math.max(d,78),250):Math.min(Math.max(d,82),125),x=p.x+dx/d*travel,y=p.y+dy/d*travel,now=mobilityNow();this.v94MobilityPads=Array.isArray(this.v94MobilityPads)?this.v94MobilityPads:[];this.v94MobilityPads.push({id:`v97-pad-${now}-${Math.random()}`,x,y,radius:24,team:p.team,ownerId:p.id,ttl:p.human?6:3.6,armedAt:now+(p.human?160:90),hp:38,v94MobilityPad:true,v94PlacedAt:now,launchAngle:angle,power:710+(p.stats?.combat||0)*30,uses:1,v94Inside:{},v97CooldownUntil:{}});capOwnerDevices(this.v94MobilityPads,p.id,p.human?2:1);(this.effects||=[]).push({type:'grasshopper',x,y,angle,ttl:.62,maxTtl:.62,v94Route:true});this.setCooldown?.(p,hand,Math.max(.38,(Number(trigger?.cooldown)||.56)*.8));return true;}if(!this.consumeTrion?.(p,Number(trigger?.cost)||0))return false;const power=650+(p.stats?.combat||0)*34;mobilityBoost(this,p,Number(p.aim)||0,power,'instantGrasshopper',{forwardCarry:.28,tangentCarry:.5});this.setCooldown?.(p,hand,Math.max(.32,(Number(trigger?.cooldown)||.56)*.68));return true;};
    const oldUpdate=proto.update;proto.update=function(dt){
      if(this.simulationMode)applySimulationNamed(this);
      convertLegacyGrassPads(this);
      for(const p of this.players||[]){sanitizeAiState(p);p.v97PrevX=Number(p.x)||0;p.v97PrevY=Number(p.y)||0;if((p.v96Knockdown||0)>0){p.ai=p.ai||{};p.ai.attackTimer=Math.max(p.ai.attackTimer||0,p.v96Knockdown+.2);}}
      const hasSpecialWires=(this.wires||[]).some(w=>w?.v96TripWire||w?.mode==='spring'),hasEngineerTraps=(this.traps||[]).some(t=>t?.v96EngineerTrap);
      const specialWires=hasSpecialWires?(this.wires||[]).filter(w=>w?.v96TripWire||w?.mode==='spring'):[],coreWires=hasSpecialWires?(this.wires||[]).filter(w=>!w?.v96TripWire&&w?.mode!=='spring'):(this.wires||[]),engineerTraps=hasEngineerTraps?(this.traps||[]).filter(t=>t?.v96EngineerTrap):[],coreTraps=hasEngineerTraps?(this.traps||[]).filter(t=>!t?.v96EngineerTrap):(this.traps||[]);
      this.v98HazardSnapshot={wires:specialWires.filter(w=>w?.v96TripWire),traps:engineerTraps};this.wires=coreWires;this.traps=coreTraps;
      let out;try{out=typeof oldUpdate==='function'?oldUpdate.call(this,dt):undefined;}finally{if(hasSpecialWires)this.wires=[...(this.wires||[]),...specialWires];if(hasEngineerTraps)this.traps=[...(this.traps||[]),...engineerTraps];delete this.v98HazardSnapshot;}
      if(hasEngineerTraps)updateEngineerTraps(this,dt);updateMobilityRoutes(this,dt);updateViperRoutes(this,dt);if(hasSpecialWires)updateTripWires(this,dt);
      updateNamedStatus(this,dt);this.v105FeatureEffectTimer=Math.max(0,(this.v105FeatureEffectTimer||0)-dt);if(this.v105FeatureEffectTimer<=0){updateEngineerTrapEffects(this);this.v105FeatureEffectTimer=.16;}
      for(const p of this.players||[]){
        applyNamedTuning(p);if(p.v96NamedSpeed&&Number.isFinite(p.speed))p.speed=Math.max(p.speed,p.v96NamedSpeed);
        for(const hand of ['main','sub']){const sh=p.shields?.[hand];if(!sh)continue;const coverage=clamp(settings.shieldCoverage,.15,1),thickness=1/coverage;sh.v77Coverage=coverage;sh.arc=(sh.baseArc||sh.arc||1.3)*(.55+coverage*.8);sh.radius=(sh.baseRadius||sh.radius||70)*(.65+coverage*.75);sh.hp=Math.max(sh.hp||0,(sh.maxHp||80)*(.65+thickness*.65));}
        p.v105FeatureAccumulator=(p.v105FeatureAccumulator||0)+dt;const featureStep=this.simulationMode ? .12 : .08;if(p.v105FeatureAccumulator>=featureStep){const step=Math.min(.2,p.v105FeatureAccumulator);p.v105FeatureAccumulator=0;applyNamedBehavior(this,p,step);cpuAdvancedTechniques(this,p,step);if(isEngineer(p))engineerTactics(this,p,step);}updateKogetsuBranch(this,p,dt);
        p.v105StallTimer=Math.max(0,(p.v105StallTimer||0)-dt);if(p.v105StallTimer<=0){updateStallRecovery(this,p,.22);p.v105StallTimer=.22;}
      }
      return out;
    };
    const oldFireShooter=proto.fireShooter;if(oldFireShooter)proto.fireShooter=function(p,...args){const before={projectiles:Array.isArray(this.projectiles)?this.projectiles.length:0,bullets:Array.isArray(this.bullets)?this.bullets.length:0,shots:Array.isArray(this.shots)?this.shots.length:0};const out=oldFireShooter.call(this,p,...args);tagNewNinomiyaProjectiles(this,p,before);tagViperProjectiles(this,p,before);tagCanonicalProjectiles(this,p,before);return out;};
    const oldFireSniper=proto.fireSniper;if(oldFireSniper)proto.fireSniper=function(p,...args){const before={projectiles:Array.isArray(this.projectiles)?this.projectiles.length:0,bullets:Array.isArray(this.bullets)?this.bullets.length:0,shots:Array.isArray(this.shots)?this.shots.length:0};const out=oldFireSniper.call(this,p,...args);tagCanonicalProjectiles(this,p,before);return out;};
    const oldBeginShooterCharge=proto.beginShooterCharge;if(oldBeginShooterCharge)proto.beginShooterCharge=function(p,hand,trigger){if(trigger?.bullet==='viper'&&!p.human&&!p.v96ViperPlan)makeViperPlan(this,p,nearestEnemy(this,p,820));const out=oldBeginShooterCharge.call(this,p,hand,trigger);if(p?.shooterCharges?.[hand])p.shooterCharges[hand].v101StartedAt??=mobilityNow();if(p?.v78Named==='NINOMIYA'&&p.shooterCharges?.[hand]){p.shooterCharges[hand].v86Tetra=true;p.shooterCharges[hand].v88SpinSeed??=Math.random()*Math.PI*2;}return out;};
    const oldDamage=proto.damagePlayer;if(oldDamage)proto.damagePlayer=function(target,amount,source,meta){
      amount=namedDamageAdjustment(target,amount,source,meta||{});
      if(target?.v79DefenseScale&&target?.v78Named!=='MURAKAMI'&&!target?.v96Tuning?.defense)amount/=target.v79DefenseScale;
      if(source?.v78Named==='NINOMIYA'&&meta?.sourceKey?.includes('asteroid'))amount*=1.12;
      if(source?.v78Named==='YUBA'&&performance.now()<(source.v79QuickdrawUntil||0))amount*=1.18;
      if(source?.v78Named==='HANZAKI'&&meta?.type==='sniper')amount*=1.15;
      if(source?.v78Named==='KATORI'&&ratio(source)<.5)amount*=1.10;
      if(isEngineer(source)&&['switchboxAttack','fixedTrap','switchbox'].includes(meta?.sourceKey))amount*=1.42;
      const out=oldDamage.call(this,target,amount,source,meta);
      if(out&&target){target.v100LastHit={at:mobilityNow(),sourceId:source?.id||null,sourceKey:meta?.sourceKey||meta?.name||meta?.type||'unknown',amount};}
      return out;
    };
    const oldSetCooldown=proto.setCooldown;if(oldSetCooldown)proto.setCooldown=function(p,hand,seconds){return oldSetCooldown.call(this,p,hand,seconds*(p?.v96Tuning?.cooldown||1));};
    const oldSetCooldownIndex=proto.setCooldownForHandIndex;if(oldSetCooldownIndex)proto.setCooldownForHandIndex=function(p,hand,index,seconds){return oldSetCooldownIndex.call(this,p,hand,index,seconds*(p?.v96Tuning?.cooldown||1));};
    const oldTargetLock=proto.getTargetLockDuration;if(oldTargetLock)proto.getTargetLockDuration=function(p,...args){return oldTargetLock.call(this,p,...args)*(p?.v96Tuning?.reaction||1);};
    const oldTryUseHand=proto.tryUseHand;if(oldTryUseHand)proto.tryUseHand=function(p,...args){if((p?.v96Knockdown||0)>0)return false;const out=oldTryUseHand.call(this,p,...args);if(out&&p){p.v101LastActionAt=mobilityNow();p.v101Stall=p.v101Stall&&typeof p.v101Stall==='object'?p.v101Stall:{};p.v101Stall.lastActionAt=p.v101LastActionAt;}return out;};
    const oldToggleScope=proto.toggleScope;if(oldToggleScope)proto.toggleScope=function(...args){const p=humanOf(this);if(p&&viperHand(p)){makeViperPlan(this,p);return true;}return oldToggleScope.apply(this,args);};
    const oldTryJustCut=proto.tryJustCut;if(oldTryJustCut)proto.tryJustCut=function(target,...args){const out=oldTryJustCut.call(this,target,...args);if(out&&hasTrigger(target,'kogetsu')){target.v96KogetsuBranchReady=true;target.v96KogetsuBranchUntil=mobilityNow()+850;if(target.human)flash('JUST CUT：弧月派生可能');}return out;};
    const oldPlaceTrap=proto.placeTrap;if(oldPlaceTrap)proto.placeTrap=function(p,hand,trigger){const before=Array.isArray(this.traps)?this.traps.length:0,out=oldPlaceTrap.call(this,p,hand,trigger);if(out&&isEngineer(p)&&Array.isArray(this.traps)&&this.traps.length>before){const trap=this.traps[this.traps.length-1];trap.id??=`v101-trap-${mobilityNow()}-${Math.random()}`;trap.v96EngineerTrap=true;trap.radius=Math.max(Number(trap.radius)||14,22);trap.hp=Math.max(Number(trap.hp)||18,42+(p.stats?.technique||0)*3);trap.ttl=Math.max(Number(trap.ttl)||48,65);trap.v96OwnerTechnique=p.stats?.technique||0;ensureTrapDisguise(this,trap);}return out;};
    const oldRender=proto.render;if(oldRender)proto.render=function(...args){const restore=hideNinomiyaNativeCubes(this),originalTraps=this.traps,originalWalls=this.walls,originalPickups=this.pickups,disguises=trapDisguiseRenderLists(this);this.traps=(this.traps||[]).filter(trap=>!trap?.v101Disguised);this.walls=[...(this.walls||[]),...disguises.walls];this.pickups=[...(this.pickups||[]),...disguises.pickups];let out;try{out=oldRender.apply(this,args);}finally{this.traps=originalTraps;this.walls=originalWalls;this.pickups=originalPickups;restore();}drawMobilityRoutes(this);drawViperPlan(this);drawNinomiyaTetrahedrons(this);drawFriendlyTrapHints(this);return out;};
  }
  window.addEventListener('keydown',e=>{if(e.code==='ShiftLeft'||e.code==='ShiftRight')shiftHeld=true;if(e.repeat||e.code!=='KeyC'||!currentGame)return;const p=humanOf(currentGame);if(!p)return;const all=[...(p.loadout?.main||[]),...(p.loadout?.sub||[])],hasBlade=all.includes('grasshopper')&&all.includes('scorpion'),hasPin=all.filter(x=>x==='grasshopper').length>=2&&['kogetsu','scorpion','raygust'].some(id=>all.includes(id));if(!hasBlade&&!hasPin)return;e.preventDefault();e.stopImmediatePropagation();setTimeout(()=>pinball(currentGame,hasBlade),0);},true);
  window.addEventListener('keyup',e=>{if(e.code==='ShiftLeft'||e.code==='ShiftRight')shiftHeld=false;},true);window.addEventListener('blur',()=>shiftHeld=false);
  function resetNamedOpponentSlotsToMob(){
    for(let i=0;i<opponentSlots.length;i++) opponentSlots[i]={squad:'mob',agent:''};
    saveRoster();
    mobSnapshots.clear();
    document.querySelectorAll('#cpuConfigList .cpu-card').forEach(card=>{
      clearCardVacant(card);
      delete card.dataset.namedAgent;
    });
    mountRoster(true);
  }
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('button');
    if(!button)return;
    const text=(button.textContent||'').replace(/\s+/g,' ').trim();
    const isStandardReset=text.includes('標準編成に戻す')||(/standard/i.test(text)&&/(restore|reset|return)/i.test(text));
    if(!isStandardReset)return;
    setTimeout(resetNamedOpponentSlotsToMob,0);
  },true);
  function installImmediateGameCapture(){
    try{
      const desc=Object.getOwnPropertyDescriptor(window,'__TRION_GAME__');if(desc&&!desc.configurable)return;
      let value=window.__TRION_GAME__;
      Object.defineProperty(window,'__TRION_GAME__',{configurable:true,enumerable:true,get(){return value;},set(next){value=next;if(next){try{if(next.simulationMode)applySimulationNamed(next);else applyNamed(next);patchGame(next);}catch(error){console.error('[v105 game capture]',error);}requestAnimationFrame?.(()=>document.documentElement.classList.remove('v96-spawning'));}}});
      if(value)patchGame(value);
    }catch(_){ }
  }
  document.addEventListener('click',event=>{const button=event.target?.closest?.('button');if(!button)return;const id=String(button.id||''),text=(button.textContent||'').replace(/\s+/g,' ').trim();if(/start|battle|deploy/i.test(id)||text.includes('出撃')||text.includes('対戦開始'))document.documentElement.classList.add('v96-spawning');},true);
  installImmediateGameCapture();
  mountRoster(true);ensureUserSquadEditor();
  const scheduleRosterRefresh=()=>{setTimeout(()=>mountRoster(true),0);setTimeout(()=>mountRoster(true),80);};
  for(const id of ['teamCount','teamSize','participationRole']){const el=document.querySelector(`#${id}`);if(el&&!el.dataset.v99RosterRefresh){el.dataset.v99RosterRefresh='true';el.addEventListener('input',scheduleRosterRefresh);el.addEventListener('change',scheduleRosterRefresh);}}
  const modeSelector=document.querySelector('#modeSelector');if(modeSelector&&!modeSelector.dataset.v99RosterRefresh){modeSelector.dataset.v99RosterRefresh='true';modeSelector.addEventListener('click',scheduleRosterRefresh,true);}
  window.addEventListener('trion-language-change',()=>{mountRoster(true);ensureUserSquadEditor();});
  const rosterObserver=new MutationObserver(()=>mountRoster(false));
  const rosterRoot=document.querySelector('#cpuConfigList');if(rosterRoot)rosterObserver.observe(rosterRoot,{childList:true,subtree:true});
  function syncV96TriggerDocs(){const data=window.WT_DATA?.triggers;if(!data)return;if(data.shooter_viper){data.shooter_viper.controls='発動：キューブ展開／Shift＋発動：分割／R：固定弾道を事前計算／再発動：射撃';data.shooter_viper.description='Rで射出前に固定弾道を計算できる変化弾。計算後は敵を追尾せず、表示された経路を通ります。';}if(data.spider){data.spider.description='通常ワイヤーは接触した敵を転倒させます。ばねワイヤーは味方の移動ルートとして利用できます。';}if(data.switchbox){data.switchbox.description='強化された攻撃・転倒拘束・加速トラップを設置します。工作手CPUは撤退しながら進路へ罠を配置します。';}}
  function installSimulationApiV105(){const api=window.TRION_SIMULATION_API;if(!api||api.v105Wrapped||typeof api.runMatch!=='function')return;const oldRun=api.runMatch.bind(api);api.runMatch=async request=>{const result=await oldRun(request);if(result&&typeof result==='object'){result.gameVersion=Math.max(104,Number(result.gameVersion||0));result.featureVersion=105;result.namedSimulation=true;}return result;};api.version=105;api.v105Wrapped=true;}
  installSimulationApiV105();
  window.TRION_NAMED_AUDIT={version:105,agents:Object.keys(NAMED_BEHAVIORS),tunedAgents:Object.keys(NAMED_TUNING_OVERRIDES),count:Object.keys(NAMED_BEHAVIORS).length,allExplicitlyTuned:Object.keys(NAMED_BEHAVIORS).every(name=>Boolean(NAMED_TUNING_OVERRIDES[name]))};
  function syncVersionUI(){syncV96TriggerDocs();if(window.TRION_SIMULATION_API)window.TRION_SIMULATION_API.version=104;document.querySelectorAll('.version-badge,[data-version],#version,.version').forEach(el=>{if(/VERSION\s*\d+/i.test(el.textContent||'')||el.matches('.version-badge,[data-version],#version'))el.textContent='VERSION 105';});document.title=document.title.replace(/VERSION\s*\d+/ig,'VERSION 105');document.documentElement.dataset.gameVersion='105';}
  syncVersionUI();
  let lastVersionSync=Date.now();
  const timer=setInterval(()=>{const g=window.__TRION_GAME__;if(g&&g!==currentGame)patchGame(g);const now=Date.now();if(now-lastVersionSync>=1000){installSimulationApiV105();syncVersionUI();lastVersionSync=now;}document.querySelectorAll('.v77-trigger-panel').forEach(el=>el.remove());},1000);
  window.addEventListener('beforeunload',()=>{clearInterval(timer);rosterObserver.disconnect();});
})();
