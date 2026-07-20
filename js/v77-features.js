(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const settings=Object.assign({senkuDuration:.7,shieldCoverage:.55,grasshopperMode:'instant'},JSON.parse(localStorage.getItem('trion-v77-settings')||'{}'));
  const save=()=>localStorage.setItem('trion-v77-settings',JSON.stringify(settings));
  let patchedProto=null, currentGame=null, panel=null, shiftHeld=false;
  const hasTrigger=(p,id)=>[...(p?.loadout?.main||[]),...(p?.loadout?.sub||[])].includes(id);
  const humanOf=g=>g?.players?.find(p=>p.human&&!p.dead)||g?.players?.find(p=>p.human);
  const nearestEnemy=(g,p,max=900)=>g?.players?.filter(t=>t!==p&&!t.dead&&g.canDamage?.(p,t)).map(t=>({t,d:Math.hypot(t.x-p.x,t.y-p.y)})).filter(x=>x.d<=max).sort((a,b)=>a.d-b.d)[0]?.t;
  function flash(text){const e=document.createElement('div');e.className='v77-skill-flash';e.textContent=text;document.body.appendChild(e);setTimeout(()=>e.remove(),950);}
  function segDist(x1,y1,x2,y2,px,py){const dx=x2-x1,dy=y2-y1,l=dx*dx+dy*dy||1,t=clamp(((px-x1)*dx+(py-y1)*dy)/l,0,1);return{d:Math.hypot(px-(x1+dx*t),py-(y1+dy*t)),t};}
  function ensurePanel(){
    if(panel)return panel; panel=document.createElement('section');panel.className='v77-trigger-panel';panel.innerHTML=`<header><h3>TRIGGER TUNING v77</h3><button type="button" data-close aria-label="折りたたむ">−</button></header><div data-panel-body>
    <div class="row"><label>旋空・効果時間</label><input data-senku type="range" min="0.18" max="1.20" step="0.01"><output data-senku-out></output></div>
    <div class="row"><label>シールド・広さ</label><input data-shield type="range" min="0.15" max="1" step="0.01"><output data-shield-out></output></div>
    <div class="row"><label>グラスホッパー</label><select data-gh><option value="instant">即時使用</option><option value="placed">設置</option></select><span></span></div>
    <small>旋空は短時間ほど射程が伸びます。シールドは狭いほど厚くなります。グラスホッパー選択中は既存のShiftで即時使用／設置を切り替えます。乱反射系は既存のC、モールクローは壁際での通常攻撃です。</small></div>`;document.body.appendChild(panel);
    const s=panel.querySelector('[data-senku]'),sh=panel.querySelector('[data-shield]'),gh=panel.querySelector('[data-gh]');
    s.value=settings.senkuDuration;sh.value=settings.shieldCoverage;gh.value=settings.grasshopperMode;
    const render=()=>{panel.querySelector('[data-senku-out]').textContent=`${Number(s.value).toFixed(2)}s`;panel.querySelector('[data-shield-out]').textContent=`${Math.round(Number(sh.value)*100)}%`;};render();
    s.oninput=()=>{settings.senkuDuration=+s.value;save();render();};sh.oninput=()=>{settings.shieldCoverage=+sh.value;save();render();};gh.onchange=()=>{settings.grasshopperMode=gh.value;save();};
    panel.querySelector('[data-close]').onclick=()=>{const body=panel.querySelector('[data-panel-body]');const collapsed=body.classList.toggle('hidden');panel.querySelector('[data-close]').textContent=collapsed?'＋':'−';};
    return panel;
  }
  function moleClaw(g, quiet=false){
    const p=humanOf(g);
    if(!p||!hasTrigger(p,'scorpion'))return false;
    const walls=(g.walls||[]).filter(w=>{const cx=clamp(p.x,w.x,w.x+w.w),cy=clamp(p.y,w.y,w.y+w.h);return Math.hypot(p.x-cx,p.y-cy)<p.radius+26;});
    if(!walls.length)return false;
    const wall=walls[0];
    const target=(g.players||[]).filter(t=>g.canDamage?.(p,t)&&!t.dead).map(t=>({t,d:Math.hypot(t.x-clamp(t.x,wall.x,wall.x+wall.w),t.y-clamp(t.y,wall.y,wall.y+wall.h))})).filter(x=>x.d<x.t.radius+30).sort((a,b)=>a.d-b.d)[0]?.t;
    if(!target)return false;
    if(!g.consumeTrion?.(p,4))return false;
    g.effects?.push({type:'slash',x:target.x,y:target.y,angle:Math.atan2(target.y-p.y,target.x-p.x),range:42,arc:6.1,style:'moleClaw',ttl:.28,maxTtl:.28});
    g.damagePlayer?.(target,28*(.82+p.stats.combat*.05),p,{x:target.x,y:target.y,type:'melee',name:'モールクロー',sourceKey:'moleClaw'});
    if(!quiet)flash('モールクロー');
    return true;
  }
  function pinball(g,blade){const p=humanOf(g),target=nearestEnemy(g,p,650);if(!p||!target)return;if(blade){if(!hasTrigger(p,'grasshopper')||!hasTrigger(p,'scorpion'))return flash('グラスホッパー＋スコーピオンが必要');}else{const count=[...(p.loadout.main||[]),...(p.loadout.sub||[])].filter(x=>x==='grasshopper').length;if(count<2||!['kogetsu','scorpion','raygust'].some(id=>hasTrigger(p,id)))return flash('グラスホッパー×2＋攻撃手トリガーが必要');}if(p.v77PinballUntil>performance.now())return;const cost=blade?15:12;if(!g.consumeTrion?.(p,cost))return;p.v77PinballUntil=performance.now()+2600;flash(blade?'ブレード乱反射':'乱反射');const points=Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return{x:target.x+Math.cos(a)*110,y:target.y+Math.sin(a)*110};});points.forEach((pt,i)=>setTimeout(()=>{if(p.dead||target.dead)return;p.x=clamp(pt.x,p.radius,g.world.w-p.radius);p.y=clamp(pt.y,p.radius,g.world.h-p.radius);p.vx=Math.cos(i*Math.PI/4+Math.PI/2)*420;p.vy=Math.sin(i*Math.PI/4+Math.PI/2)*420;g.effects?.push({type:'grasshopper',x:p.x,y:p.y,angle:p.aim,ttl:.35,maxTtl:.35});const dmg=blade?10:7;g.damagePlayer?.(target,dmg*(.9+p.stats.combat*.035),p,{x:p.x,y:p.y,type:'melee',name:blade?'ブレード乱反射':'乱反射',sourceKey:blade?'bladePinball':'pinball'});},i*110));}
  function patchGame(g){if(!g||!g.constructor)return;currentGame=g;ensurePanel();const proto=Object.getPrototypeOf(g);if(patchedProto===proto)return;patchedProto=proto;
    const oldUseMelee=proto.useMelee;proto.useMelee=function(p,hand,trigger,options){if(trigger?.id==='scorpion'&&moleClaw(this,true)){this.setCooldown?.(p,hand,Math.max(.28,trigger.cooldown*.8));this.revealOnAttack?.(p,1.2);return true;}return oldUseMelee.call(this,p,hand,trigger,options);};
    const oldSenku=proto.performSenku;proto.performSenku=function(p,trigger){const duration=clamp(settings.senkuDuration,.18,1.2),ratio=.7/duration,range=(trigger.range+p.stats.trion*8)*clamp(Math.sqrt(ratio),.72,2.0),end={x:p.x+Math.cos(p.aim)*range,y:p.y+Math.sin(p.aim)*range};this.sfx?.play('attacker',{x:p.x,y:p.y,bucket:`senku:${p.id}`,cooldown:.12,volume:.5,rate:.94});this.effects.push({type:'senku',x:p.x,y:p.y,x2:end.x,y2:end.y,ttl:duration,maxTtl:duration});this.damageWorldSegment?.(p.x,p.y,end.x,end.y,trigger.damage*.8,p.team,20);const hits=[];for(const target of this.players){if(!this.canDamage?.(p,target))continue;const hit=segDist(p.x,p.y,end.x,end.y,target.x,target.y);if(hit.d<=target.radius+20)hits.push({target,hit});}hits.sort((a,b)=>a.hit.t-b.hit.t).forEach(({target,hit},i)=>{const tip=.72+hit.t*.62,multi=[1,.62,.38,.25][Math.min(i,3)];this.damagePlayer?.(target,trigger.damage*tip*multi*(.82+p.stats.combat*.04),p,{x:p.x,y:p.y,type:'melee',name:'旋空',sourceKey:'senku'});});};
    const oldSlash=proto.performSlash;proto.performSlash=function(p,range,damage,arc,style){const before=this.effects?.length||0;const result=oldSlash.call(this,p,range,damage,arc,style);if(style==='kogetsu'&&this.effects?.length>before){const e=this.effects[this.effects.length-1],speed=clamp(.42-p.stats.combat*.028,.12,.38);e.ttl=e.maxTtl=speed;e.v77Draw=true;}return result;};
    const oldWire=proto.placeWire;proto.placeWire=function(p,hand,trigger){const ok=oldWire.call(this,p,hand,trigger);if(ok&&p.spiderMode){const w=this.wires[this.wires.length-1];if(w){w.mode='spring';w.springPower=760+p.stats.combat*34;w.hp=Math.max(w.hp||0,42);w.ttl=Math.max(w.ttl||0,90);}}return ok;};
    const oldGrass=proto.grasshopper;proto.grasshopper=function(p,hand,trigger){if(p.human&&shiftHeld){settings.grasshopperMode=settings.grasshopperMode==='placed'?'instant':'placed';save();const gh=ensurePanel().querySelector('[data-gh]');if(gh)gh.value=settings.grasshopperMode;flash(`グラスホッパー：${settings.grasshopperMode==='placed'?'設置':'即時使用'}`);return true;}if((p.human&&settings.grasshopperMode==='placed')||p.v77PlaceGrasshopper){if(!this.consumeTrion?.(p,trigger.cost))return false;const target=p.human?this.getHumanAimPoint?.(p,210):{x:p.x+Math.cos(p.aim)*150,y:p.y+Math.sin(p.aim)*150},dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy)||1,travel=Math.min(d,250);this.traps.push({x:p.x+dx/d*travel,y:p.y+dy/d*travel,radius:25,team:p.team,ownerId:p.id,type:2,ttl:55,armed:.1,hp:38,v77Grass:true,power:780+p.stats.combat*36});this.effects.push({type:'grasshopper',x:p.x+dx/d*travel,y:p.y+dy/d*travel,angle:p.aim,ttl:.7,maxTtl:.7});this.setCooldown?.(p,hand,Math.max(.35,trigger.cooldown*.72));return true;}if(!this.consumeTrion?.(p,trigger.cost))return false;const power=680+p.stats.combat*36;p.vx+=Math.cos(p.aim)*power;p.vy+=Math.sin(p.aim)*power;p.metrics.grasshopperBoostImpulse=(p.metrics.grasshopperBoostImpulse||0)+power;this.effects.push({type:'grasshopper',x:p.x+Math.cos(p.aim)*30,y:p.y+Math.sin(p.aim)*30,angle:p.aim,ttl:.55,maxTtl:.55});this.setCooldown?.(p,hand,Math.max(.3,trigger.cooldown*.65));return true;};
    const oldUpdate=proto.update;proto.update=function(dt){const out=oldUpdate.call(this,dt);for(const p of this.players||[]){for(const hand of ['main','sub']){const s=p.shields?.[hand];if(!s)continue;const coverage=clamp(settings.shieldCoverage,.15,1),thickness=1/coverage;s.v77Coverage=coverage;s.arc=(s.baseArc||s.arc||1.3)*(.55+coverage*.8);s.radius=(s.baseRadius||s.radius||70)*(.65+coverage*.75);s.hp=Math.max(s.hp||0,(s.maxHp||80)*(.65+thickness*.65));}for(const w of this.wires||[]){if(w.mode!=='spring')continue;const hit=segDist(w.x1,w.y1,w.x2,w.y2,p.x,p.y);if(hit.d>p.radius+8||p.v77WireBounce>performance.now())continue;const ally=w.team===p.team||this.config?.mode==='solo'&&w.ownerId===p.id;if(!ally)continue;const nx=-(w.y2-w.y1),ny=w.x2-w.x1,n=Math.hypot(nx,ny)||1,power=w.springPower||720;p.vx+=nx/n*power;p.vy+=ny/n*power;p.v77WireBounce=performance.now()+700;this.effects.push({type:'grasshopper',x:p.x,y:p.y,angle:Math.atan2(ny,nx),ttl:.45,maxTtl:.45});}}
      return out;};
  }
  window.addEventListener('keydown',e=>{if(e.code==='ShiftLeft'||e.code==='ShiftRight')shiftHeld=true;if(e.repeat||e.code!=='KeyC'||!currentGame)return;const p=humanOf(currentGame);if(!p)return;const all=[...(p.loadout?.main||[]),...(p.loadout?.sub||[])];const hasBlade=all.includes('grasshopper')&&all.includes('scorpion');const hasPin=all.filter(x=>x==='grasshopper').length>=2&&['kogetsu','scorpion','raygust'].some(id=>all.includes(id));if(!hasBlade&&!hasPin)return;e.preventDefault();e.stopImmediatePropagation();setTimeout(()=>pinball(currentGame,hasBlade),0);},true);
  window.addEventListener('keyup',e=>{if(e.code==='ShiftLeft'||e.code==='ShiftRight')shiftHeld=false;},true);
  window.addEventListener('blur',()=>{shiftHeld=false;});
  const timer=setInterval(()=>{const g=window.__TRION_GAME__;if(g&&g!==currentGame)patchGame(g);if(window.TRION_SIMULATION_API)window.TRION_SIMULATION_API.version=77;document.querySelectorAll('.version-badge').forEach(el=>el.textContent='VERSION 77');},250);
  window.addEventListener('beforeunload',()=>clearInterval(timer));
})();
