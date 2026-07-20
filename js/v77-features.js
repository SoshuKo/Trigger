(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const settings=Object.assign({senkuDuration:.7,shieldCoverage:.55,grasshopperMode:'instant'},JSON.parse(localStorage.getItem('trion-v77-settings')||'{}'));
  const save=()=>localStorage.setItem('trion-v77-settings',JSON.stringify(settings));
  let patchedProto=null,currentGame=null,shiftHeld=false,rosterMounted=false;
  const hasTrigger=(p,id)=>[...(p?.loadout?.main||[]),...(p?.loadout?.sub||[])].includes(id);
  const humanOf=g=>g?.players?.find(p=>p.human&&!p.dead)||g?.players?.find(p=>p.human);
  const nearestEnemy=(g,p,max=900)=>g?.players?.filter(t=>t!==p&&!t.dead&&g.canDamage?.(p,t)).map(t=>({t,d:Math.hypot(t.x-p.x,t.y-p.y)})).filter(x=>x.d<=max).sort((a,b)=>a.d-b.d)[0]?.t;
  const lang=()=>window.TRION_I18N?.getLanguage?.()==='en'?'en':'ja';
  const labelOf=a=>lang()==='en'?a.en:a.ja;
  const norm=(arr,n=4)=>[...arr,...Array(n).fill('empty')].slice(0,n);
  const A=(ja,en,role,stats,main,sub,extra={})=>({ja,en,role,stats,main:norm(main),sub:norm(sub),...extra});
  const SQUADS=[
    {id:'ninomiya',ja:'ニノミヤ隊',en:'NINOMIYA SQUAD',agents:[
      A('ニノミヤ','NINOMIYA','シューター',[8,6,4],['shooter_asteroid','shooter_hound','shield','shooter_meteor'],['shooter_asteroid','shield','bagworm'],{tetra:true}),
      A('イヌカイ','INUKAI','ガンナー',[6,6,6],['gun_asteroid','gun_hound','shield'],['shooter_hound','scorpion','shield','bagworm']),
      A('ツジ','TSUJI','アタッカー',[4,6,8],['kogetsu','senku','shield'],['shield','bagworm'])]},
    {id:'tamakoma2',ja:'タマコマ第二',en:'TAMAKOMA SECOND',agents:[
      A('ミクモ','MIKUMO','シューター',[2,10,6],['raygust','thruster','shooter_asteroid','shield'],['bagworm','spider']),
      A('クガ','KUGA','アタッカー',[4,6,10],['scorpion','grasshopper','shield'],['scorpion','shield','bagworm']),
      A('アマトリ','AMATORI','スナイパー',[14,6,6],['egret','lightning','ibis','shield'],['shooter_hound','shooter_meteor','shield','bagworm']),
      A('ヒュース','HYUSE','アタッカー',[9,5,6],['kogetsu','senku','viper','shield'],['escudo','shield','bagworm'])]},
    {id:'kageura',ja:'カゲウラ隊',en:'KAGEURA SQUAD',agents:[A('カゲウラ','KAGEURA','アタッカー',[4,5,11],['scorpion','shield'],['scorpion','shield','bagworm']),A('キタゾエ','KITAZOE','ガンナー',[7,5,6],['gun_asteroid','gun_meteor','shield'],['shooter_meteor','shield','bagworm']),A('エマ','EMA','スナイパー',[4,8,6],['egret','lightning','ibis','shield'],['shield','bagworm'])]},
    {id:'ikoma',ja:'イコマ隊',en:'IKOMA SQUAD',agents:[A('イコマ','IKOMA','アタッカー',[4,8,8],['kogetsu','senku','shield'],['shield','bagworm']),A('ミズカミ','MIZUKAMI','シューター',[3,9,6],['shooter_asteroid','shooter_meteor','shield'],['shooter_asteroid','shield','bagworm']),A('オキ','OKI','スナイパー',[5,8,5],['egret','lightning','shield'],['grasshopper','shield','bagworm']),A('ミナミサワ','MINAMISAWA','アタッカー',[3,5,10],['kogetsu','senku','shield'],['grasshopper','shield','bagworm'])]},
    {id:'oji',ja:'オウジ隊',en:'OJI SQUAD',agents:[A('オウジ','OJI','アタッカー',[4,8,6],['kogetsu','senku','hound','shield'],['scorpion','grasshopper','shield','bagworm']),A('クラウチ','KURAUCHI','シューター',[4,8,6],['shooter_asteroid','shooter_meteor','shooter_hound','shield'],['shooter_hound','shield','bagworm']),A('カシオ','KASHIO','アタッカー',[3,6,9],['kogetsu','senku','hound','shield'],['grasshopper','shield','bagworm'])]},
    {id:'azuma',ja:'アズマ隊',en:'AZUMA SQUAD',agents:[A('アズマ','AZUMA','スナイパー',[4,13,4],['egret','lightning','ibis','shield'],['dummyBeacon','shield','bagworm']),A('コアライ','KOARAI','アタッカー',[3,5,10],['kogetsu','senku','shield'],['grasshopper','shield','bagworm']),A('オクデラ','OKUDERA','アタッカー',[3,6,9],['kogetsu','senku','shield'],['grasshopper','shield','bagworm'])]},
    {id:'nasu',ja:'ナス隊',en:'NASU SQUAD',agents:[A('ナス','NASU','シューター',[5,10,5],['shooter_asteroid','viper','shooter_meteor','shield'],['shield','bagworm']),A('クマガイ','KUMAGAI','アタッカー',[3,6,9],['kogetsu','senku','shooter_meteor','shield'],['shield','bagworm']),A('ヒウラ','HIURA','スナイパー',[3,8,7],['egret','lightning','ibis','shield'],['shooter_meteor','shield','bagworm'])]},
    {id:'yuba',ja:'ユバ隊',en:'YUBA SQUAD',agents:[A('ユバ','YUBA','ガンナー',[4,7,8],['handgun_asteroid','handgun_viper','shield'],['handgun_asteroid','handgun_viper','shield','bagworm']),A('オビシマ','OBISHIMA','万能手',[3,6,9],['kogetsu','senku','gun_asteroid','gun_hound'],['grasshopper','shield','shield','bagworm']),A('トノオカ','TONOOKA','スナイパー',[4,9,5],['egret','lightning','ibis','shield'],['shield','bagworm'])]},
    {id:'kuruma',ja:'クルマ隊',en:'KURUMA SQUAD',agents:[A('クルマ','KURUMA','ガンナー',[4,7,7],['gun_asteroid','gun_hound','shield'],['gun_asteroid','shield','bagworm']),A('ムラカミ','MURAKAMI','アタッカー',[4,8,8],['kogetsu','senku','shield'],['raygust','thruster','shield','bagworm']),A('ベツヤク','BETSUYAKU','スナイパー',[3,8,7],['egret','lightning','ibis','shield'],['escudo','shield','bagworm'])]},
    {id:'arafune',ja:'アラフネ隊',en:'ARAFUNE SQUAD',agents:[A('アラフネ','ARAFUNE','スナイパー',[4,11,5],['kogetsu','senku','egret','shield'],['shield','bagworm']),A('ホカリ','HOKARI','スナイパー',[4,7,7],['egret','shield'],['shield','bagworm']),A('ハンザキ','HANZAKI','スナイパー',[3,12,5],['egret','shield'],['shield','bagworm'])]},
    {id:'katori',ja:'カトリ隊',en:'KATORI SQUAD',agents:[A('カトリ','KATORI','万能手',[4,5,9],['scorpion','handgun_asteroid','handgun_hound','shield'],['scorpion','chameleon','shield','bagworm']),A('ミウラ','MIURA','アタッカー',[3,6,9],['kogetsu','senku','shield'],['shield','bagworm']),A('ワカムラ','WAKAMURA','ガンナー',[4,7,7],['gun_asteroid','gun_hound','shield'],['chameleon','shield','bagworm'])]},
    {id:'suwa',ja:'スワ隊',en:'SUWA SQUAD',agents:[A('スワ','SUWA','ガンナー',[4,5,9],['shotgun_asteroid','shield','starmaker'],['shotgun_asteroid','shield','bagworm']),A('ツツミ','TSUTSUMI','ガンナー',[4,6,8],['shotgun_asteroid','shield','starmaker'],['shotgun_asteroid','shield','bagworm']),A('ササモリ','SASAMORI','アタッカー',[3,6,9],['kogetsu','senku','shield'],['chameleon','shield','bagworm'])]},
    {id:'kakizaki',ja:'カキザキ隊',en:'KAKIZAKI SQUAD',agents:[A('カキザキ','KAKIZAKI','万能手',[4,7,7],['kogetsu','senku','gun_asteroid','gun_meteor'],['shield','shield','bagworm']),A('テルヤ','TERUYA','万能手',[4,8,6],['kogetsu','senku','gun_asteroid','gun_hound'],['shield','shield','bagworm']),A('トモエ','TOMOE','ガンナー',[3,6,9],['kogetsu','handgun_asteroid','handgun_hound','shield'],['grasshopper','shield','bagworm'])]}
  ];

  const CHARACTER_COLORS={
    NINOMIYA:{body:'#2b3038',accent:'#d7dce2'}, INUKAI:{body:'#6f7f8f',accent:'#eef4fa'}, TSUJI:{body:'#3d4f63',accent:'#c9d8e7'},
    MIKUMO:{body:'#2f6f9f',accent:'#d8efff'}, KUGA:{body:'#eef1f4',accent:'#5d6a76'}, AMATORI:{body:'#d7a7b8',accent:'#fff3f7'}, HYUSE:{body:'#496b86',accent:'#d8e7f2'},
    KAGEURA:{body:'#382f43',accent:'#bb8de0'}, KITAZOE:{body:'#7b5d39',accent:'#f0d3a8'}, EMA:{body:'#5c7990',accent:'#e0f1ff'},
    IKOMA:{body:'#8e3d2f',accent:'#f1c4b7'}, MIZUKAMI:{body:'#49667a',accent:'#cde0ec'}, OKI:{body:'#7a6655',accent:'#ead8c7'}, MINAMISAWA:{body:'#b95a36',accent:'#ffe0c8'},
    OJI:{body:'#263f70',accent:'#d8b35a'}, KURAUCHI:{body:'#556d8c',accent:'#dbe8f8'}, KASHIO:{body:'#3f6093',accent:'#d9e7ff'},
    AZUMA:{body:'#315f62',accent:'#d5ecec'}, KOARAI:{body:'#5f7d79',accent:'#dcebe7'}, OKUDERA:{body:'#3f5a5c',accent:'#c9dcdd'},
    NASU:{body:'#8b6eaf',accent:'#f1e8ff'}, KUMAGAI:{body:'#6f588b',accent:'#e4d8f3'}, HIURA:{body:'#a48bc0',accent:'#f5efff'},
    YUBA:{body:'#7e2f43',accent:'#e7c6cf'}, OBISHIMA:{body:'#a45465',accent:'#f7d9df'}, TONOOKA:{body:'#5f3f4a',accent:'#dfc4cc'},
    KURUMA:{body:'#39704c',accent:'#d6ecdc'}, MURAKAMI:{body:'#294f3a',accent:'#c7dfcf'}, BETSUYAKU:{body:'#5f7e65',accent:'#e0efe3'},
    ARAFUNE:{body:'#657044',accent:'#e2e6ca'}, HOKARI:{body:'#7b8052',accent:'#edf0d7'}, HANZAKI:{body:'#4f5940',accent:'#d7ddc7'},
    KATORI:{body:'#d16a32',accent:'#ffe0c7'}, MIURA:{body:'#94513b',accent:'#f0d0c5'}, WAKAMURA:{body:'#b47b48',accent:'#f7e2cd'},
    SUWA:{body:'#83383d',accent:'#efc9cc'}, TSUTSUMI:{body:'#664045',accent:'#e1cdd0'}, SASAMORI:{body:'#a55d5f',accent:'#f4d9da'},
    KAKIZAKI:{body:'#385985',accent:'#d8e6f7'}, TERUYA:{body:'#567cad',accent:'#e4efff'}, TOMOE:{body:'#2d476c',accent:'#ccdcef'}
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
    OKI:{style:'mobileSniper',preferredRange:600,aggression:.7,defense:.7,special:'mobileSnipe'},
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
    BETSUYAKU:{style:'terrainSniper',preferredRange:650,aggression:.52,defense:.8,special:'escudoTerrain'},
    ARAFUNE:{style:'hybridSniper',preferredRange:520,aggression:.74,defense:.82,special:'hybrid'},
    HOKARI:{style:'sniper',preferredRange:680,aggression:.62,defense:.74,special:'spreadSnipe'},
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
  const squadLeaderName={ninomiya:'NINOMIYA',tamakoma2:'MIKUMO',kageura:'KAGEURA',ikoma:'IKOMA',oji:'OJI',azuma:'AZUMA',nasu:'NASU',yuba:'YUBA',kuruma:'KURUMA',arafune:'ARAFUNE',katori:'KATORI',suwa:'SUWA',kakizaki:'KAKIZAKI'};
  function alliesOf(g,p){return (g.players||[]).filter(t=>t!==p&&!t.dead&&t.team===p.team)}
  function enemiesOf(g,p){return (g.players||[]).filter(t=>t!==p&&!t.dead&&g.canDamage?.(p,t))}
  function nearest(list,p){return list.map(t=>({t,d:Math.hypot(t.x-p.x,t.y-p.y)})).sort((a,b)=>a.d-b.d)[0]||null}
  function setAiTarget(p,target){if(!p.ai||!target)return;p.ai.target=target;p.ai.targetId=target.id;p.ai.targetPlayer=target;}
  function nudgeToward(p,x,y,amount){const a=Math.atan2(y-p.y,x-p.x);p.vx=(p.vx||0)+Math.cos(a)*amount;p.vy=(p.vy||0)+Math.sin(a)*amount;}
  function nudgeAway(p,x,y,amount){const a=Math.atan2(p.y-y,p.x-x);p.vx=(p.vx||0)+Math.cos(a)*amount;p.vy=(p.vy||0)+Math.sin(a)*amount;}
  function selectTrigger(p,id){for(const hand of ['main','sub']){const i=(p.loadout?.[hand]||[]).indexOf(id);if(i>=0){p.selected[hand]=i;return hand;}}return null;}
  function tryNamedUse(g,p,id){const hand=selectTrigger(p,id);if(!hand)return false;try{return !!g.tryUseHand?.(p,hand)}catch{return false}}
  function applyNamedBehavior(g,p,dt){
    const b=NAMED_BEHAVIORS[p.v78Named];if(!b||p.dead||p.human)return;
    p.v79Behavior=b;p.ai=p.ai||{};p.v79SpecialCd=Math.max(0,(p.v79SpecialCd||0)-dt);p.v79Think=Math.max(0,(p.v79Think||0)-dt);
    const enemies=enemiesOf(g,p),allies=alliesOf(g,p);if(!enemies.length)return;
    let target=nearest(enemies,p)?.t;
    if(b.special==='leaderHunter'){const leaders=enemies.filter(t=>['MIKUMO','NINOMIYA','KAGEURA','IKOMA','OJI','AZUMA','NASU','YUBA','KURUMA','ARAFUNE','KATORI','SUWA','KAKIZAKI'].includes(t.v78Named));target=nearest(leaders,p)?.t||target;}
    if(b.special==='priorityWatch'){const priority=enemies.filter(t=>['AMATORI','NINOMIYA','NASU','AZUMA'].includes(t.v78Named));target=nearest(priority,p)?.t||target;}
    setAiTarget(p,target);if(!target)return;
    const d=Math.hypot(target.x-p.x,target.y-p.y);p.aim=Math.atan2(target.y-p.y,target.x-p.x);
    const desired=b.preferredRange||240;if(d>desired*1.2)nudgeToward(p,target.x,target.y,(b.aggression||.7)*28*dt);if(d<desired*.65)nudgeAway(p,target.x,target.y,(b.defense||.7)*26*dt);
    if(p.v79Think>0)return;p.v79Think=.18+Math.random()*.18;
    const leader=allies.find(a=>a.v78Named===squadLeaderName[p.v78Squad]);
    if(['guardLeader','bodyguard'].includes(b.special)&&leader){const ld=Math.hypot(leader.x-p.x,leader.y-p.y);if(ld>140)nudgeToward(p,leader.x,leader.y,95);const threat=nearest(enemies,leader)?.t;if(threat)setAiTarget(p,threat);}
    if(b.special==='pair'){const mate=allies.find(a=>['KOARAI','OKUDERA'].includes(a.v78Named));if(mate){const md=Math.hypot(mate.x-p.x,mate.y-p.y);if(md>150)nudgeToward(p,mate.x,mate.y,75);else{p.stats.combat=Math.max(p.stats.combat,p.v79BaseCombat? p.v79BaseCombat+1.2:p.stats.combat);}}}
    if(b.special==='formation'){const mates=allies.filter(a=>['KAKIZAKI','TERUYA','TOMOE'].includes(a.v78Named));const far=mates.find(a=>Math.hypot(a.x-p.x,a.y-p.y)>210);if(far)nudgeToward(p,far.x,far.y,70);else{p.v79FormationBonus=1;p.hp=Math.min(p.maxHp||p.hp,p.hp+dt*.3);}}
    if(b.special==='ninomiya'&&p.v79SpecialCd<=0&&d<560){tryNamedUse(g,p,'shooter_hound');setTimeout(()=>tryNamedUse(g,p,'shooter_asteroid'),90);p.v79SpecialCd=2.4;}
    if(b.special==='wireField'&&p.v79SpecialCd<=0&&d<430){p.ai.placePoint={x:p.x+Math.cos(p.aim+1.25)*160,y:p.y+Math.sin(p.aim+1.25)*160};tryNamedUse(g,p,'spider');p.v79SpecialCd=2.1;}
    if(b.special==='kuga'&&p.v79SpecialCd<=0&&d<230){if(hasTrigger(p,'grasshopper'))tryNamedUse(g,p,'grasshopper');if(d<120)tryNamedUse(g,p,'scorpion');p.v79SpecialCd=.9;}
    if(b.special==='chika'&&p.v79SpecialCd<=0&&d>340){const id=d>650?'ibis':(hasTrigger(p,'shooter_meteor')?'shooter_meteor':'lightning');tryNamedUse(g,p,id);p.v79SpecialCd=2.8;}
    if(b.special==='hyuse'&&p.v79SpecialCd<=0){if(d<210)tryNamedUse(g,p,'escudo');else tryNamedUse(g,p,'viper');p.v79SpecialCd=1.7;}
    if(b.special==='hostilitySense'){p.v79ThreatSense=1;p.ai.dodgeTimer=Math.max(p.ai.dodgeTimer||0,.22);}
    if(b.special==='areaBombard'&&p.v79SpecialCd<=0&&d<650){tryNamedUse(g,p,hasTrigger(p,'gun_meteor')?'gun_meteor':'shooter_meteor');p.v79SpecialCd=2.3;}
    if(b.special==='ikomaSenku'&&p.v79SpecialCd<=0&&d>150&&d<500){p.v79IkomaSenku=true;tryNamedUse(g,p,'senku');p.v79IkomaSenku=false;p.v79SpecialCd=2.2;}
    if(b.special==='mobileSnipe'&&p.v79SpecialCd<=0){if(d<450)tryNamedUse(g,p,'grasshopper');else tryNamedUse(g,p,'egret');p.v79SpecialCd=1.6;}
    if(b.special==='birdcage'&&p.v79SpecialCd<=0&&d<560){for(let i=0;i<3;i++)setTimeout(()=>{p.aim+=i?-.28:.56;tryNamedUse(g,p,'viper')},i*120);p.v79SpecialCd=2.8;}
    if(b.special==='quickdraw'&&p.v79SpecialCd<=0&&d<230){p.v79QuickdrawUntil=performance.now()+420;tryNamedUse(g,p,hasTrigger(p,'handgun_asteroid')?'handgun_asteroid':'handgun_viper');p.v79SpecialCd=.55;}
    if(b.special==='fullAttackWithMurakami'){const m=allies.find(a=>a.v78Named==='MURAKAMI'&&Math.hypot(a.x-p.x,a.y-p.y)<180);if(m&&p.v79SpecialCd<=0){tryNamedUse(g,p,'gun_asteroid');setTimeout(()=>tryNamedUse(g,p,'gun_asteroid'),80);p.v79SpecialCd=.8;}}
    if(b.special==='learningGuard'){p.v79GuardLearn=(p.v79GuardLearn||0)+dt;p.v79DefenseScale=1+Math.min(.22,p.v79GuardLearn/120);if(d<150&&p.v79SpecialCd<=0){tryNamedUse(g,p,'raygust');p.v79SpecialCd=.7;}}
    if(b.special==='hybrid'){if(d<240)tryNamedUse(g,p,'kogetsu');else if(p.v79SpecialCd<=0){tryNamedUse(g,p,'egret');p.v79SpecialCd=1.4;}}
    if(b.special==='adaptive'){p.v79Adaptive=(p.v79Adaptive||0)+dt;if(d<180)tryNamedUse(g,p,'scorpion');else tryNamedUse(g,p,'handgun_asteroid');}
    if(b.special==='shotgun'&&p.v79SpecialCd<=0&&d<220){tryNamedUse(g,p,'shotgun_asteroid');p.v79SpecialCd=.65;}
    if(b.special==='alternatingShotgun'&&p.v79SpecialCd<=0&&d<260){const suwa=allies.find(a=>a.v78Named==='SUWA');if(!suwa||!(suwa.v79SpecialCd>0)){tryNamedUse(g,p,'shotgun_asteroid');p.v79SpecialCd=.8;}}
    if(b.special==='chameleonGrab'&&p.v79SpecialCd<=0&&d<260){if(d>90)tryNamedUse(g,p,'chameleon');else tryNamedUse(g,p,'kogetsu');p.v79SpecialCd=1.2;}
  }

  const ROSTER_STORAGE_KEY='trion-v81-card-opponents';
  const MAX_OPPONENT_SLOTS=12;
  const ROLE_TO_ARCHETYPE={ 'アタッカー':'攻撃手','シューター':'射手','ガンナー':'銃手','スナイパー':'狙撃手','万能手':'万能手' };
  function loadOpponentSlots(){
    try{
      const raw=JSON.parse(localStorage.getItem(ROSTER_STORAGE_KEY)||'null');
      if(Array.isArray(raw)) return Array.from({length:MAX_OPPONENT_SLOTS},(_,i)=>{const squad=raw[i]?.squad;return {squad:squad==='vacant'||SQUADS.some(s=>s.id===squad)?squad:'mob',agent:raw[i]?.agent||''};});
    }catch(_){ }
    return Array.from({length:MAX_OPPONENT_SLOTS},()=>({squad:'mob',agent:''}));
  }
  const opponentSlots=loadOpponentSlots();
  const saveRoster=()=>localStorage.setItem(ROSTER_STORAGE_KEY,JSON.stringify(opponentSlots));
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
        const current=slot.squad==='vacant'||SQUADS.some(s=>s.id===slot.squad)?slot.squad:'mob';
        squadSel.innerHTML=`<option value="mob">${en?'MOB / CUSTOM':'モブ／カスタム'}</option><option value="vacant">${en?'VACANT':'空き枠'}</option>`+SQUADS.map(s=>`<option value="${s.id}">${en?s.en:s.ja}</option>`).join('');
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
        const squad=SQUADS.find(s=>s.id===slot.squad);
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
        slot.squad=squadSel.value==='vacant'?'vacant':(SQUADS.some(s=>s.id===squadSel.value)?squadSel.value:'mob');
        slot.agent='';
        fillAgents();
        saveRoster();
      };
      agentSel.onchange=()=>{
        slot.agent=agentSel.value;
        const squad=SQUADS.find(s=>s.id===slot.squad),agent=squad?.agents.find(a=>a.en===slot.agent);
        if(agent)setCardDisplay(card,index,agent);
        saveRoster();
      };
    });
    rosterMounted=true;
  }
  function applyNamed(g){
    if(!g||g.simulationMode||!Array.isArray(g.players))return;
    const cpus=g.players.filter(p=>!p.human);
    const vacant=new Set();
    cpus.forEach((p,i)=>{
      const slot=opponentSlots[i];
      if(slot?.squad==='vacant'){vacant.add(p);return;}
      if(!slot||slot.squad==='mob'||!slot.agent)return;
      const squad=SQUADS.find(s=>s.id===slot.squad),a=squad?.agents.find(agent=>agent.en===slot.agent);if(!a)return;
      p.name=labelOf(a);p.v78Named=a.en;p.v78Squad=slot.squad;p.v79BaseCombat=a.stats[2];p.v78Tetra=!!a.tetra;p.archetype=ROLE_TO_ARCHETYPE[a.role]||a.role;const characterColor=CHARACTER_COLORS[a.en];if(characterColor){p.appearance={...(p.appearance||{}),bodyColor:characterColor.body,uniformColor:characterColor.body,accentColor:characterColor.accent};p.color=characterColor.body;p.characterColor=characterColor.body;p.bodyColor=characterColor.body;p.accentColor=characterColor.accent;}
      p.stats={...(p.stats||{}),trion:a.stats[0],technique:a.stats[1],combat:a.stats[2]};p.loadout={main:[...a.main],sub:[...a.sub]};p.selected={main:0,sub:0};
      if(p.maxTrion!=null){p.maxTrion=Math.max(p.maxTrion,a.stats[0]*12+40);p.trion=p.maxTrion;}
    });
    if(vacant.size){
      for(let i=g.players.length-1;i>=0;i--){if(vacant.has(g.players[i]))g.players.splice(i,1);}
      if(g.player&&vacant.has(g.player))g.player=g.players.find(p=>p.human)||null;
    }
  }
  function flash(text){const e=document.createElement('div');e.className='v77-skill-flash';e.textContent=text;document.body.appendChild(e);setTimeout(()=>e.remove(),950);}
  function segDist(x1,y1,x2,y2,px,py){const dx=x2-x1,dy=y2-y1,l=dx*dx+dy*dy||1,t=clamp(((px-x1)*dx+(py-y1)*dy)/l,0,1);return{d:Math.hypot(px-(x1+dx*t),py-(y1+dy*t)),t};}
  function moleClaw(g,p=humanOf(g),quiet=false){if(!p||!hasTrigger(p,'scorpion'))return false;const walls=(g.walls||[]).filter(w=>{const cx=clamp(p.x,w.x,w.x+w.w),cy=clamp(p.y,w.y,w.y+w.h);return Math.hypot(p.x-cx,p.y-cy)<p.radius+26;});if(!walls.length)return false;const wall=walls[0];const target=(g.players||[]).filter(t=>g.canDamage?.(p,t)&&!t.dead).map(t=>({t,d:Math.hypot(t.x-clamp(t.x,wall.x,wall.x+wall.w),t.y-clamp(t.y,wall.y,wall.y+wall.h))})).filter(x=>x.d<x.t.radius+30).sort((a,b)=>a.d-b.d)[0]?.t;if(!target||!g.consumeTrion?.(p,4))return false;g.effects?.push({type:'slash',x:target.x,y:target.y,angle:Math.atan2(target.y-p.y,target.x-p.x),range:42,arc:6.1,style:'moleClaw',ttl:.28,maxTtl:.28});g.damagePlayer?.(target,28*(.82+p.stats.combat*.05),p,{x:target.x,y:target.y,type:'melee',name:'モールクロー',sourceKey:'moleClaw'});if(!quiet)flash('モールクロー');return true;}
  function pinball(g,blade){const p=humanOf(g),target=nearestEnemy(g,p,650);if(!p||!target)return;if(blade){if(!hasTrigger(p,'grasshopper')||!hasTrigger(p,'scorpion'))return flash('グラスホッパー＋スコーピオンが必要');}else{const count=[...(p.loadout.main||[]),...(p.loadout.sub||[])].filter(x=>x==='grasshopper').length;if(count<2||!['kogetsu','scorpion','raygust'].some(id=>hasTrigger(p,id)))return flash('グラスホッパー×2＋攻撃手トリガーが必要');}if(p.v77PinballUntil>performance.now())return;const cost=blade?15:12;if(!g.consumeTrion?.(p,cost))return;p.v77PinballUntil=performance.now()+2600;flash(blade?'ブレード乱反射':'乱反射');const points=Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return{x:target.x+Math.cos(a)*110,y:target.y+Math.sin(a)*110};});points.forEach((pt,i)=>setTimeout(()=>{if(p.dead||target.dead)return;p.x=clamp(pt.x,p.radius,g.world.w-p.radius);p.y=clamp(pt.y,p.radius,g.world.h-p.radius);p.vx=Math.cos(i*Math.PI/4+Math.PI/2)*420;p.vy=Math.sin(i*Math.PI/4+Math.PI/2)*420;g.effects?.push({type:'grasshopper',x:p.x,y:p.y,angle:p.aim,ttl:.35,maxTtl:.35});g.damagePlayer?.(target,(blade?10:7)*(.9+p.stats.combat*.035),p,{x:p.x,y:p.y,type:'melee',name:blade?'ブレード乱反射':'乱反射',sourceKey:blade?'bladePinball':'pinball'});},i*110));}
  function screenPoint(g,x,y){const cam=g.camera||{x:0,y:0};return{x:x-(cam.x||0),y:y-(cam.y||0)};}
  function tetraPath(ctx,x,y,r,angle=0){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(-r*.92,r*.72);ctx.lineTo(r*.92,r*.72);ctx.closePath();ctx.moveTo(0,-r);ctx.lineTo(0,r*.18);ctx.lineTo(-r*.92,r*.72);ctx.moveTo(0,r*.18);ctx.lineTo(r*.92,r*.72);ctx.restore();}
  function drawTetraAt(ctx,x,y,r,angle=0){ctx.save();ctx.fillStyle='rgba(74,153,218,.96)';ctx.strokeStyle='rgba(205,240,255,.98)';ctx.lineWidth=Math.max(1.5,r*.12);tetraPath(ctx,x,y,r,angle);ctx.fill();ctx.stroke();ctx.restore();}
  function projectileOwnerIsNinomiya(g,item){if(!item)return false;const id=item.ownerId??item.playerId??item.sourceId??item.owner?.id??item.source?.id;return (g.players||[]).some(p=>p.v78Named==='NINOMIYA'&&(p===item.owner||p===item.source||p.id===id));}
  function drawNinomiyaTetrahedrons(g){const ctx=g?.ctx||g?.context;if(!ctx)return;const n=(g.players||[]).find(p=>p.v78Named==='NINOMIYA'&&!p.dead);if(!n)return;
    const charges=n.shooterCharges?Object.values(n.shooterCharges).filter(Boolean):[];
    for(const charge of charges){const aim=Number.isFinite(charge.aim)?charge.aim:n.aim;const wx=Number.isFinite(charge.x)?charge.x:n.x+Math.cos(aim)*42;const wy=Number.isFinite(charge.y)?charge.y:n.y+Math.sin(aim)*42;const sp=screenPoint(g,wx,wy);drawTetraAt(ctx,sp.x,sp.y,18,aim+Math.PI/2);}
    const groups=[g.projectiles,g.bullets,g.shots].filter(Array.isArray);
    const seen=new Set();for(const group of groups)for(const item of group){if(!item||seen.has(item)||!projectileOwnerIsNinomiya(g,item))continue;seen.add(item);if(!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;const sp=screenPoint(g,item.x,item.y);const ang=Number.isFinite(item.angle)?item.angle:Math.atan2(item.vy||0,item.vx||1);drawTetraAt(ctx,sp.x,sp.y,Math.max(7,Math.min(18,item.radius||item.r||10)),ang+Math.PI/2);}
  }
  function tagNewNinomiyaProjectiles(g,p,before){if(p?.v78Named!=='NINOMIYA')return;for(const [key,count] of Object.entries(before)){const arr=g[key];if(!Array.isArray(arr))continue;for(const item of arr.slice(count)){if(item&&typeof item==='object'){item.v86Tetra=true;item.ownerId??=p.id;}}}}

  function patchGame(g){if(!g||!g.constructor)return;currentGame=g;applyNamed(g);const proto=Object.getPrototypeOf(g);if(patchedProto===proto)return;patchedProto=proto;
    const oldUseMelee=proto.useMelee;proto.useMelee=function(p,hand,trigger,options){if(trigger?.id==='scorpion'&&moleClaw(this,p,true)){this.setCooldown?.(p,hand,Math.max(.28,trigger.cooldown*.8));this.revealOnAttack?.(p,1.2);return true;}return typeof oldUseMelee==='function'?oldUseMelee.call(this,p,hand,trigger,options):false;};
    const oldSenku=proto.performSenku;proto.performSenku=function(p,trigger){const duration=p.v79IkomaSenku?.2:clamp(settings.senkuDuration,.18,1.2),ratio=.7/duration,range=(trigger.range+p.stats.trion*8)*clamp(Math.sqrt(ratio),.72,p.v79IkomaSenku?2.75:2),end={x:p.x+Math.cos(p.aim)*range,y:p.y+Math.sin(p.aim)*range};this.sfx?.play('attacker',{x:p.x,y:p.y,bucket:`senku:${p.id}`,cooldown:.12,volume:.5,rate:.94});this.effects.push({type:'senku',x:p.x,y:p.y,x2:end.x,y2:end.y,ttl:duration,maxTtl:duration});this.damageWorldSegment?.(p.x,p.y,end.x,end.y,trigger.damage*.8,p.team,20);const hits=[];for(const target of this.players){if(!this.canDamage?.(p,target))continue;const hit=segDist(p.x,p.y,end.x,end.y,target.x,target.y);if(hit.d<=target.radius+20)hits.push({target,hit});}hits.sort((a,b)=>a.hit.t-b.hit.t).forEach(({target,hit},i)=>this.damagePlayer?.(target,trigger.damage*(.72+hit.t*.62)*[1,.62,.38,.25][Math.min(i,3)]*(.82+p.stats.combat*.04),p,{x:p.x,y:p.y,type:'melee',name:'旋空',sourceKey:'senku'}));};
    const oldSlash=proto.performSlash;proto.performSlash=function(p,range,damage,arc,style){const before=this.effects?.length||0,result=oldSlash.call(this,p,range,damage,arc,style);if(style==='kogetsu'&&this.effects?.length>before){const e=this.effects[this.effects.length-1],speed=clamp(.42-p.stats.combat*.028,.12,.38);e.ttl=e.maxTtl=speed;e.v77Draw=true;}return result;};
    const oldWire=proto.placeWire;proto.placeWire=function(p,hand,trigger){const ok=typeof oldWire==='function'?oldWire.call(this,p,hand,trigger):false;if(ok&&p.spiderMode){const w=this.wires[this.wires.length-1];if(w){w.mode='spring';w.springPower=760+p.stats.combat*34;w.hp=Math.max(w.hp||0,42);w.ttl=Math.max(w.ttl||0,90);}}return ok;};
    const oldGrass=proto.grasshopper;proto.grasshopper=function(p,hand,trigger){if(p.human&&shiftHeld){settings.grasshopperMode=settings.grasshopperMode==='placed'?'instant':'placed';save();flash(`グラスホッパー：${settings.grasshopperMode==='placed'?'設置':'即時使用'}`);return true;}if((p.human&&settings.grasshopperMode==='placed')||p.v77PlaceGrasshopper){if(!this.consumeTrion?.(p,trigger.cost))return false;const target=p.human?this.getHumanAimPoint?.(p,210):{x:p.x+Math.cos(p.aim)*150,y:p.y+Math.sin(p.aim)*150},dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy)||1,travel=Math.min(d,250);this.traps.push({x:p.x+dx/d*travel,y:p.y+dy/d*travel,radius:25,team:p.team,ownerId:p.id,type:2,ttl:55,armed:.1,hp:38,v77Grass:true,power:780+p.stats.combat*36});this.effects.push({type:'grasshopper',x:p.x+dx/d*travel,y:p.y+dy/d*travel,angle:p.aim,ttl:.7,maxTtl:.7});this.setCooldown?.(p,hand,Math.max(.35,trigger.cooldown*.72));return true;}if(!this.consumeTrion?.(p,trigger.cost))return false;const power=680+p.stats.combat*36;p.vx+=Math.cos(p.aim)*power;p.vy+=Math.sin(p.aim)*power;p.metrics.grasshopperBoostImpulse=(p.metrics.grasshopperBoostImpulse||0)+power;this.effects.push({type:'grasshopper',x:p.x+Math.cos(p.aim)*30,y:p.y+Math.sin(p.aim)*30,angle:p.aim,ttl:.55,maxTtl:.55});this.setCooldown?.(p,hand,Math.max(.3,trigger.cooldown*.65));return true;};
    const oldUpdate=proto.update;proto.update=function(dt){const out=oldUpdate.call(this,dt);for(const p of this.players||[]){for(const hand of ['main','sub']){const s=p.shields?.[hand];if(!s)continue;const coverage=clamp(settings.shieldCoverage,.15,1),thickness=1/coverage;s.v77Coverage=coverage;s.arc=(s.baseArc||s.arc||1.3)*(.55+coverage*.8);s.radius=(s.baseRadius||s.radius||70)*(.65+coverage*.75);s.hp=Math.max(s.hp||0,(s.maxHp||80)*(.65+thickness*.65));}for(const w of this.wires||[]){if(w.mode!=='spring')continue;const hit=segDist(w.x1,w.y1,w.x2,w.y2,p.x,p.y);if(hit.d>p.radius+8||p.v77WireBounce>performance.now())continue;const ally=w.team===p.team||this.config?.mode==='solo'&&w.ownerId===p.id;if(!ally)continue;const nx=-(w.y2-w.y1),ny=w.x2-w.x1,n=Math.hypot(nx,ny)||1,power=w.springPower||720;p.vx+=nx/n*power;p.vy+=ny/n*power;p.v77WireBounce=performance.now()+700;this.effects.push({type:'grasshopper',x:p.x,y:p.y,angle:Math.atan2(ny,nx),ttl:.45,maxTtl:.45});}applyNamedBehavior(this,p,dt);}return out;};
    const oldFireShooter=proto.fireShooter;if(oldFireShooter)proto.fireShooter=function(p,...args){const before={projectiles:Array.isArray(this.projectiles)?this.projectiles.length:0,bullets:Array.isArray(this.bullets)?this.bullets.length:0,shots:Array.isArray(this.shots)?this.shots.length:0};const out=oldFireShooter.call(this,p,...args);tagNewNinomiyaProjectiles(this,p,before);return out;};
    const oldBeginShooterCharge=proto.beginShooterCharge;if(oldBeginShooterCharge)proto.beginShooterCharge=function(p,hand,trigger){const out=oldBeginShooterCharge.call(this,p,hand,trigger);if(p?.v78Named==='NINOMIYA'&&p.shooterCharges?.[hand])p.shooterCharges[hand].v86Tetra=true;return out;};
    const oldDamage=proto.damagePlayer;if(oldDamage)proto.damagePlayer=function(target,amount,source,meta){if(target?.v79DefenseScale)amount/=target.v79DefenseScale;if(source?.v78Named==='NINOMIYA'&&meta?.sourceKey?.includes('asteroid'))amount*=1.12;if(source?.v78Named==='YUBA'&&performance.now()<(source.v79QuickdrawUntil||0))amount*=1.18;if(source?.v78Named==='HANZAKI'&&meta?.type==='sniper')amount*=1.15;return oldDamage.call(this,target,amount,source,meta);};
    const oldRender=proto.render;if(oldRender)proto.render=function(...args){const out=oldRender.apply(this,args);drawNinomiyaTetrahedrons(this);return out;};
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
  mountRoster(true);
  window.addEventListener('trion-language-change',()=>mountRoster(true));
  const rosterObserver=new MutationObserver(()=>mountRoster(false));
  const rosterRoot=document.querySelector('#cpuConfigList');if(rosterRoot)rosterObserver.observe(rosterRoot,{childList:true,subtree:true});
  const timer=setInterval(()=>{const g=window.__TRION_GAME__;if(g&&g!==currentGame)patchGame(g);if(window.TRION_SIMULATION_API)window.TRION_SIMULATION_API.version=87;document.querySelectorAll('.version-badge').forEach(el=>el.textContent='VERSION 87');document.querySelectorAll('.v77-trigger-panel').forEach(el=>el.remove());},250);
  window.addEventListener('beforeunload',()=>{clearInterval(timer);rosterObserver.disconnect();});
})();
