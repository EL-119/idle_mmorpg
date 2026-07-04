const $ = id => document.getElementById(id);
const SAVE_KEY='random_growth_game_v34';
let state = null;
let loop = null;
let passiveTimer = null;
let pendingChoices = [];
let dataMode = 'export';
const base = { power:10, expNeed:100, baseAttackMs:900 };
const RANDOM_NAME_PREFIX=['검은','붉은','푸른','황금','은빛','그림자','폭풍','심연','새벽','혼돈','운명의','떠도는','작은','거대한'];
const RANDOM_NAME_BODY=['슬라임','고블린','오크','트롤','키메라','마수','망령','용아','불씨','늑대','거인','마검','별조각','왕눈이'];
const RANDOM_NAME_SUFFIX=['씨앗','초보자','방랑자','각성체','행운아','포식자','도전자','계승자','수집가','생존자'];

const ZONES=[
  {name:'초원의 시작', min:1, exp:0, power:0, speed:0, bg:'zone-0', defense:1.00, monsters:['풀잎 슬라임','들판 뿔토끼','작은 고블린']},
  {name:'안개 숲', min:10, exp:10, power:5, speed:3, bg:'zone-1', defense:1.15, monsters:['안개 늑대','독버섯 정령','숲 고블린']},
  {name:'붉은 협곡', min:25, exp:25, power:12, speed:7, bg:'zone-2', defense:1.35, monsters:['붉은 전갈','협곡 오크','사막 도마뱀']},
  {name:'망각의 폐허', min:45, exp:45, power:22, speed:12, bg:'zone-3', defense:1.65, monsters:['해골 병사','저주 갑옷','폐허 망령']},
  {name:'심연의 늪', min:70, exp:70, power:35, speed:18, bg:'zone-4', defense:2.05, monsters:['독성 늪괴물','심연 촉수','검은 개구리']},
  {name:'화염의 분화구', min:100, exp:110, power:55, speed:27, bg:'zone-5', defense:2.60, monsters:['화염 임프','용암 골렘','불꽃 정령']},
  {name:'얼어붙은 성채', min:140, exp:165, power:85, speed:40, bg:'zone-6', defense:3.35, monsters:['서리 늑대','빙결 기사','얼음 거인']},
  {name:'타락한 천공', min:190, exp:240, power:125, speed:58, bg:'zone-7', defense:4.35, monsters:['번개 와이번','타락 천사','공허의 눈']},
  {name:'마왕의 심장부', min:250, exp:340, power:180, speed:82, bg:'zone-8', defense:5.70, monsters:['지옥 사냥개','마족 장군','마왕의 분신']},
  {name:'신들의 균열', min:330, exp:500, power:260, speed:115, bg:'zone-9', defense:7.50, monsters:['신벌의 사도','혼돈룡','균열의 군주']}
];
function currentZone(){
  const lv=state?.level || 1;
  let z=ZONES[0], idx=0;
  ZONES.forEach((zone,i)=>{ if(lv>=zone.min){ z=zone; idx=i; } });
  return {...z, index:idx};
}
function nextZone(){
  const z=currentZone();
  return ZONES[Math.min(ZONES.length-1, z.index+1)];
}

function rand(max){ return Math.floor(Math.random()*max); }
function nowSec(){ return Math.floor(Date.now()/1000); }

function isFakePlayerName(name){
  const fakeNames=['랜덤용사','패시브왕','오라장인','초월검사','운빨마스터','성장천재','별빛유저','심연도전자','천공러너','마왕도전자','불멸자','패시브황','초월러너'];
  return fakeNames.includes(String(name||'').trim());
}
function isRealLocalPlayer(obj){
  if(!obj || !obj.name || !obj.id) return false;
  if(isFakePlayerName(obj.name)) return false;
  if(obj.isDummy===true || obj.fake===true || obj.npc===true) return false;
  return true;
}
function clearFakeRankingCaches(){
  const fakeNames=['랜덤용사','패시브왕','오라장인','초월검사','운빨마스터','성장천재','별빛유저','심연도전자','천공러너','마왕도전자','불멸자','패시브황','초월러너'];
  try{
    for(let i=localStorage.length-1;i>=0;i--){
      const k=localStorage.key(i);
      const v=localStorage.getItem(k)||'';
      const isRankCache=/rank|ranking|leader|score|dummy|fake/i.test(k);
      const hasFakeName=fakeNames.some(n=>v.includes(n));
      if(isRankCache || hasFakeName) localStorage.removeItem(k);
    }
  }catch(e){}
}

function log(msg){ const el=$('log'); el.innerHTML = `<div>${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} · ${msg}</div>` + el.innerHTML; }

function weightedGrade(){
  const total=GRADES.reduce((a,g)=>a+g.weight,0);
  let r=Math.random()*total;
  for(const g of GRADES){ r-=g.weight; if(r<=0) return g.key; }
  return 'normal';
}
function rollSkill(excludeIds=[]){
  const grade=weightedGrade();
  const list=SKILL_POOL.filter(s=>s.grade===grade && !excludeIds.includes(s.id));
  const picked = list[rand(list.length)] || SKILL_POOL[rand(SKILL_POOL.length)];
  return JSON.parse(JSON.stringify(picked));
}
function rollChoices(){
  const picked=[];
  while(picked.length<3){
    const skill=rollSkill(picked.map(s=>s.id));
    if(!picked.find(s=>s.id===skill.id)) picked.push(skill);
  }
  return picked;
}
function makeRandomName(){
  return RANDOM_NAME_PREFIX[rand(RANDOM_NAME_PREFIX.length)] + ' ' + RANDOM_NAME_BODY[rand(RANDOM_NAME_BODY.length)] + ' ' + RANDOM_NAME_SUFFIX[rand(RANDOM_NAME_SUFFIX.length)];
}
function currentEnemyMaxHp(){
  state.enemyMaxHp=Math.max(1, Math.floor(state.enemyMaxHp || 1));
  return state.enemyMaxHp;
}
function defenseFromHp(maxHp){ const z=currentZone(); return Math.floor((Math.max(1, maxHp)/10) * (z.defense || 1)); }
function makeMonster(){
  const zone=currentZone();
  const maxHp=currentEnemyMaxHp();
  const defense=defenseFromHp(maxHp);
  const zoneBonus=zone.index*7;
  const lv=Math.max(1, Math.floor(1 + state.kills/5 + state.level*0.75 + Math.log10(maxHp) + zoneBonus));
  const tier=Math.min(2, Math.floor(Math.random()*3));
  const name=zone.monsters[tier] || zone.monsters[0];
  return { name, level:lv, maxHp:maxHp, hp:maxHp, atk:Math.round(3+lv*1.4), hitCount:0, defense:defense, formTier:zone.index, zoneIndex:zone.index };
}
function growMonsterOnHit(){
  state.enemyMaxHp=Math.max(1, Math.floor(state.enemyMaxHp || state.monster?.maxHp || 1)) + 1;
  const m=state.monster;
  if(!m) return;
  const zone=currentZone();
  m.hitCount=(m.hitCount||0)+1;
  m.maxHp=state.enemyMaxHp;
  m.hp+=1;
  m.defense=defenseFromHp(m.maxHp);
  m.formTier=zone.index;
  m.zoneIndex=zone.index;
  const tier=Math.min(2, Math.floor((m.hitCount||0)/35)%3);
  m.name=zone.monsters[tier] || zone.monsters[0];
}


function createCharacter(){
  // 실제로 생성 버튼을 누른 순간에만 기존 캐릭터를 새 캐릭터로 교체한다.
  clearInterval(loop);
  clearInterval(passiveTimer);
  const name=makeRandomName();
  const first=rollSkill([]);
  first.level = 1;
  state={ id:'player_'+Date.now()+'_'+Math.random().toString(36).slice(2,8), name, level:1, exp:0, kills:0, enemyMaxHp:1, passives:[first], claimedMilestones:[], auto:true, monster:null, lastPassiveTick:{}, createdAt:Date.now(), localHumanPlayer:true, rankingEligible:true, saveVersion:34 };
  state.monster=makeMonster();
  newCharacterModalMode=false;
  $('createModal').classList.remove('active');
  log(`${name} 생성 완료. 시작 패시브 ${first.gradeName} [${first.name}] 획득.`);
  save(); render(); startLoop();
}

function passiveStacks(){
  const list = (state?.passives || []).map(s => ({...s, level: Math.max(1, s.level || s.stack || 1)}));
  return list.sort((a,b)=>gradePower(b.grade)-gradePower(a.grade) || b.level-a.level || a.name.localeCompare(b.name));
}
function gradePower(g){ return {normal:1,magic:2,rare:3,unique:4,legend:5,epic:6,god:7}[g] || 1; }

function calcStats(){
  const stats={ power:base.power+state.level*2, crit:3, critDamage:180, attackMs:base.baseAttackMs, pierce:0, combo:0, flatExp:0, execute:0, overdrive:0, autoStrike:[], expPulse:[] };
  state.passives.forEach(s=>{
    const lv = Math.max(1, s.level || 1);
    if(s.statType==='hp') s.statType='power';
    if(s.statType==='regen') s.statType='expPulse';
    if(s.statType==='power') stats.power+=s.value*lv;
    if(s.statType==='crit') stats.crit+=Math.max(1,Math.floor(s.value/2))*lv;
    if(s.statType==='critDamage') stats.critDamage+=Math.max(2,Math.floor(s.value*1.4))*lv;
    if(s.statType==='speed') stats.attackMs-=Math.max(8,Math.floor(s.value*2))*lv;
    if(s.statType==='pierce') stats.pierce+=Math.max(1, Math.floor(s.value/2))*lv;
    if(s.statType==='combo') stats.combo+=Math.max(1, Math.floor(s.value/2))*lv;
    if(s.statType==='flatExp') stats.flatExp+=s.value*lv;
    if(s.statType==='execute') stats.execute+=Math.max(1, Math.floor(s.value))*lv;
    if(s.statType==='overdrive') stats.overdrive+=Math.max(1,Math.floor(s.value/2))*lv;
    if(['autoStrike','expPulse'].includes(s.statType)) stats[s.statType].push({...s, level: lv});
  });
  const zone=currentZone();
  stats.zone=zone;
  stats.zoneExp=zone.exp||0;
  stats.power=Math.round(stats.power * (1 + Math.min(250, stats.combo)/100) * (1 + (zone.power||0)/100));
  stats.attackMs-=Math.round(base.baseAttackMs*((zone.speed||0)/100));
  stats.crit=Math.min(85,stats.crit);
  stats.critDamage=Math.min(1000,stats.critDamage);
  stats.pierce=Math.min(95,stats.pierce);
  stats.execute=Math.min(500,stats.execute);
  stats.overdrive=Math.min(300,stats.overdrive);
  stats.attackMs=Math.max(220, Math.round(stats.attackMs));
  stats.attackSpeed=+(1000/stats.attackMs).toFixed(2);
  return stats;
}
function needExp(){ return Math.max(1, Math.round(base.expNeed*Math.pow(1.18,state.level-1)*0.7/4)); }

function hunt(){
  if(!state || !state.auto || pendingChoices.length) return;
  if(!state.monster) state.monster=makeMonster();
  const st=calcStats();
  const crit=Math.random()*100 < st.crit;
  const heat=1 + Math.min(3, (state.monster?.hitCount||0) * (st.overdrive||0) / 10000);
  const dmg=Math.round(st.power*(crit?(st.critDamage/100):1)*heat*(0.85+Math.random()*0.3));
  damageMonster(dmg, crit?'CRIT ':'', 'normal');
  save(); render();
}
function damageMonster(amount,prefix='', effectType='normal'){
  growMonsterOnHit();
  const st=calcStats();
  const effectiveDefense=Math.round((state.monster.defense||0) * (1 - (st.pierce||0)/100));
  let actual=Math.max(1, amount-effectiveDefense);
  if((st.execute||0)>0 && state.monster.hp/state.monster.maxHp <= 0.3){ actual=Math.round(actual*(1+st.execute/100)); }
  state.monster.hp-=actual;
  const expGain=Math.max(1, Math.round((actual + (st.flatExp||0)) * (1 + (st.zoneExp||0)/100))); state.exp+=expGain;
  showHit(`${prefix}-${actual} · EXP +${expGain}`);
  spawnAttackEffect(effectType, prefix);

  $('enemySprite').classList.add('shake'); setTimeout(()=>$('enemySprite').classList.remove('shake'),260);
  if(state.monster.hp<=0) killMonster();
}
function killMonster(){
  state.kills++;
  log(`${state.monster.name} 처치. 누적 피해 경험치 보상.`);
  while(state.exp>=needExp()){
    state.exp-=needExp(); state.level++;
    log(`레벨 ${state.level} 달성.`);
    if(state.level%10===0 && !state.claimedMilestones.includes(state.level)) openChoice();
  }
  state.monster=makeMonster();
}
function tickPassiveSkills(){
  if(!state || !state.auto || pendingChoices.length) return;
  const st=calcStats();
  const t=nowSec();
  ['autoStrike','expPulse'].forEach(type=>{
    st[type].forEach((s,idx)=>{
      const key=s.id;
      const last=state.lastPassiveTick[key] || 0;
      if(t-last>=s.interval){
        state.lastPassiveTick[key]=t;
        if(type==='autoStrike'){
          const dmg=Math.round(st.power*(0.45+(s.value*s.level)/100));
          damageMonster(dmg, `${s.name} `, 'skill');
          log(`[${s.name}] 발동. 추가 피해 ${dmg}.`);
        }
        if(type==='expPulse'){
          const exp=Math.round(((s.value*s.level)+state.level*2) * (1 + (st.zoneExp||0)/100));
          state.exp+=exp;
          spawnPlayerEffect('exp', s.name);
          log(`[${s.name}] 발동. 경험치 ${exp} 획득.`);
        }
      }
    });
  });
  while(state.exp>=needExp()){
    state.exp-=needExp(); state.level++;
    log(`레벨 ${state.level} 달성.`);
    if(state.level%10===0 && !state.claimedMilestones.includes(state.level)) openChoice();
  }
  save(); render();
}

function openChoice(){
  state.claimedMilestones.push(state.level);
  pendingChoices=rollChoices();
  const box=$('choiceList'); box.innerHTML='';
  pendingChoices.forEach(s=>{
    const ownedSkill=state.passives.find(p=>p.id===s.id);
    const owned=ownedSkill ? Math.max(1, ownedSkill.level || 1) : 0;
    const btn=document.createElement('button'); btn.className='choice-card';
    btn.innerHTML=`<b><span class="${displayClass(s)}">${s.name}</span><em class="grade ${displayClass(s)}">${s.gradeName}</em></b><p>${s.desc}</p><small>현재 Lv.${owned || 0} · 선택 시 Lv.${owned+1}</small>`;
    btn.onclick=()=>chooseSkill(s);
    box.appendChild(btn);
  });
  $('choiceModal').classList.add('active');
}
function chooseSkill(skill){
  skill=sanitizeSkill(skill);
  const owned = state.passives.find(p=>p.id===skill.id);
  if(owned){
    owned.level = Math.max(1, owned.level || 1) + 1;
    log(`${skill.gradeName} 패시브 [${skill.name}] 레벨 상승. Lv.${owned.level}`);
  }else{
    skill.level = 1;
    state.passives.push(skill);
    log(`${skill.gradeName} 패시브 [${skill.name}] 신규 획득. Lv.1`);
  }
  pendingChoices=[];
  $('choiceModal').classList.remove('active');
  save(); render(); startLoop();
}

function render(){
  if(!state) return;
  const st=calcStats();
  if(!state.monster) state.monster=makeMonster();
  $('charName').textContent=state.name;
  $('charTitle').textContent=`Lv. ${state.level} · ${titleByLevel(state.level)}`;
  $('level').textContent=state.level; $('attackPower').textContent=st.power; $('attackSpeed').textContent=`${st.attackSpeed}/s`; $('kills').textContent=state.kills;
  const stacksForCount=passiveStacks();
  $('passiveCount').textContent=stacksForCount.length; $('stackCount').textContent=stacksForCount.reduce((a,s)=>a+(s.level||1),0);
  $('expText').textContent=`${state.exp} / ${needExp()}`; $('expBar').style.width=`${Math.min(100,state.exp/needExp()*100)}%`;
  $('huntBtn').textContent=state.auto?'자동 사냥 중':'자동 사냥 정지';
  updatePlayerVisual(stacksForCount);
  $('aura').style.opacity = auraOpacity(stacksForCount);
  $('monsterName').textContent=state.monster.name;
  if($('monsterLevelText')) $('monsterLevelText').textContent='';
  const zone=currentZone();
  $('zoneText').textContent=`${zone.name} · EXP +${zone.exp}% · 공격 +${zone.power}% · 속도 +${zone.speed}%`;
  $('stage').className='stage ' + zone.bg;
  $('monsterHpText').textContent=`HP ${Math.max(0,Math.round(state.monster.hp))} / ${state.monster.maxHp} · 방어 ${state.monster.defense||0} · 피격 ${state.monster.hitCount||0}회`;
  $('monsterHpBar').style.width=`${Math.max(0,Math.min(100,state.monster.hp/state.monster.maxHp*100))}%`;
  renderMonsterForm();
  renderPassives();
  renderStatusDetails();
  renderMissions();
}
function monsterFormTier(defense){
  if(defense < 1) return 0;
  return Math.min(7, Math.floor(Math.log10(Math.max(1, defense))) + 1);
}
function renderMonsterForm(){
  const e=$('enemySprite');
  if(!e || !state?.monster) return;
  const zone=currentZone();
  const tier=zone.index;
  e.className='enemy monster-tier-' + Math.min(7,tier) + ' monster-skin-' + Math.min(7,tier) + ' zone-monster-' + tier;
  e.setAttribute('data-monster', state.monster.name || '몬스터');
}
function displayClass(s){ return s.gradeClass; }
function passiveTotalLv(list=passiveStacks()){ return list.reduce((a,s)=>a+(s.level||1),0); }
function playerVisualTier(list=passiveStacks()){ const c=list.length, total=passiveTotalLv(list); if(c>=40||total>=90)return 6; if(c>=28||total>=60)return 5; if(c>=18||total>=38)return 4; if(c>=10||total>=22)return 3; if(c>=5||total>=10)return 2; if(c>=2||total>=4)return 1; return 0; }
function auraOpacity(list=passiveStacks()){ return Math.min(.88, .16 + playerVisualTier(list)*.11 + passiveTotalLv(list)*.003); }
function updatePlayerVisual(list=passiveStacks()){ const p=$('playerSprite'); const a=$('aura'); if(!p||!a)return; const tier=playerVisualTier(list); p.className='player player-tier-' + tier; a.className='aura aura-tier-' + tier; }
function spawnAttackEffect(type='normal', label=''){ const layer=$('effectLayer'); if(!layer)return; const el=document.createElement('div'); el.className='attack-effect ' + (type==='skill'?'skill-effect':'normal-effect'); el.textContent=type==='skill' ? (label||'스킬') : '일반공격'; layer.appendChild(el); setTimeout(()=>el.remove(),700); }
function spawnPlayerEffect(type='heal', label=''){ const layer=$('effectLayer'); if(!layer)return; const el=document.createElement('div'); el.className='player-effect ' + type; el.textContent=label; layer.appendChild(el); setTimeout(()=>el.remove(),900); }
function passiveStatSummary(stacks=passiveStacks()){
  const sum={power:0, crit:0, critDamage:0, speed:0, pierce:0, combo:0, flatExp:0, execute:0, overdrive:0, autoStrike:0, expPulse:0};
  stacks.forEach(s=>{
    const lv=Math.max(1, s.level||1);
    let t=s.statType;
    if(t==='hp') t='power';
    if(t==='regen') t='expPulse';
    if(t==='power') sum.power += s.value*lv;
    if(t==='crit') sum.crit += Math.max(1,Math.floor(s.value/2))*lv;
    if(t==='critDamage') sum.critDamage += Math.max(2,Math.floor(s.value*1.4))*lv;
    if(t==='speed') sum.speed += Math.max(8,Math.floor(s.value*2))*lv;
    if(t==='pierce') sum.pierce += Math.max(1, Math.floor(s.value/2))*lv;
    if(t==='combo') sum.combo += Math.max(1, Math.floor(s.value/2))*lv;
    if(t==='flatExp') sum.flatExp += s.value*lv;
    if(t==='execute') sum.execute += Math.max(1, Math.floor(s.value))*lv;
    if(t==='overdrive') sum.overdrive += Math.max(1,Math.floor(s.value/2))*lv;
    if(t==='autoStrike') sum.autoStrike += 1;
    if(t==='expPulse') sum.expPulse += 1;
  });
  sum.crit=Math.min(85,sum.crit);
  sum.pierce=Math.min(95,sum.pierce);
  sum.execute=Math.min(500,sum.execute);
  sum.overdrive=Math.min(300,sum.overdrive);
  return sum;
}
function renderPassives(){
  const stacks=passiveStacks();
  const totalLv=stacks.reduce((a,s)=>a+(s.level||1),0);
  const ps=passiveStatSummary(stacks);
  $('passiveSummary').innerHTML=`
    <div class="passive-summary-head">고유 패시브 ${stacks.length}종 · 총 패시브 레벨 ${totalLv} · 같은 스킬 선택 시 레벨 상승</div>
    <div class="passive-stat-total">
      <div><span>패시브 공격력</span><b>+${Math.round(ps.power)}</b></div>
      <div><span>공격간격 감소</span><b>${Math.round(ps.speed)}ms</b></div>
      <div><span>치명타 확률</span><b>+${ps.crit}%</b></div>
      <div><span>치명타 데미지</span><b>+${ps.critDamage}%</b></div>
      <div><span>방어 관통</span><b>+${ps.pierce}%</b></div>
      <div><span>일반공격 보정</span><b>+${ps.combo}%</b></div>
      <div><span>추가 EXP</span><b>+${Math.round(ps.flatExp)}</b></div>
      <div><span>처형 피해</span><b>+${ps.execute}%</b></div>
      <div><span>가열 피해</span><b>+${ps.overdrive}%</b></div>
      <div><span>발동형 스킬</span><b>${ps.autoStrike + ps.expPulse}개</b></div>
    </div>`; 
  $('passiveList').innerHTML=stacks.map(s=>`<div class="passive"><b><span class="${displayClass(s)}">${s.name}</span><em class="grade ${displayClass(s)}">${s.gradeName} Lv.${s.level}</em></b><p>${s.desc}</p></div>`).join('');
}

let currentDexGrade='normal';
function renderSkillDex(grade=currentDexGrade){
  currentDexGrade=grade;
  const tabs=$('skillDexTabs');
  const list=$('skillDexList');
  if(!tabs || !list) return;
  tabs.innerHTML=GRADES.map(g=>`<button class="${g.key===grade?'active':''}" data-grade="${g.key}"><span class="${g.cls}">${g.name}</span><small>${g.count}개</small></button>`).join('');
  tabs.querySelectorAll('button').forEach(btn=>btn.onclick=()=>renderSkillDex(btn.dataset.grade));
  const ownedMap=new Map((state?.passives||[]).map(p=>[p.id, p]));
  list.innerHTML=SKILL_POOL.filter(s=>s.grade===grade).map(s=>{
    const owned=ownedMap.get(s.id);
    const lv=owned ? Math.max(1, owned.level||1) : 0;
    const cls=s.gradeClass;
    return `<div class="passive dex-item ${owned?'owned':'locked'}"><b><span class="${cls}">${s.name}</span><em class="grade ${cls}">${s.gradeName}${owned?' Lv.'+lv:' 미획득'}</em></b><p>${s.desc}</p></div>`;
  }).join('');
}


function renderStatusDetails(){
  if(!state) return;
  const st=calcStats();
  const stacks=passiveStacks();
  const totalLv=stacks.reduce((a,s)=>a+(s.level||1),0);
  const m=state.monster || makeMonster();
  const rows=[
    ['닉네임', state.name], ['레벨', state.level], ['현재 EXP', `${state.exp} / ${needExp()}`], ['현재 구역', st.zone?.name || currentZone().name], ['구역 버프', `EXP +${st.zoneExp||0}% · 공격 +${st.zone?.power||0}% · 속도 +${st.zone?.speed||0}%`], ['공격력', st.power],
    ['공격속도', `${st.attackSpeed}/s`], ['공격 간격', `${st.attackMs}ms`], ['치명타 확률', `${st.crit}%`], ['치명타 데미지', `${st.critDamage}%`],
    ['방어 관통', `${st.pierce}%`], ['일반공격 보정', `${st.combo}%`], ['추가 EXP', `공격당 +${st.flatExp||0}`], ['처형 피해', `${st.execute||0}%`],
    ['가열 피해', `${st.overdrive||0}%`], ['자동공격 스킬', `${st.autoStrike.length}개`], ['경험치 발동 스킬', `${st.expPulse.length}개`], ['처치 수', state.kills],
    ['보유 패시브', `${stacks.length}종`], ['총 패시브 Lv', totalLv], ['몬스터', `${m.name} Lv.${m.level}`], ['몬스터 HP', `${Math.max(0,Math.round(m.hp))} / ${m.maxHp}`],
    ['몬스터 방어력', m.defense||0], ['몬스터 피격', `${m.hitCount||0}회`]
  ];
  const box=$('statusDetailGrid');
  if(box) box.innerHTML=rows.map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join('');
}

function renderMissions(){
  const box=$('missionList');
  if(!box || !state) return;
  const stacks=passiveStacks();
  const uniqueCount=stacks.length;
  const totalLv=passiveTotalLv(stacks);
  const charSteps=[
    ['기본 외형',0],['외형 1단계',2],['외형 2단계',5],['외형 3단계',10],['외형 4단계',18],['외형 5단계',28],['최종 외형',40]
  ];
  const auraSteps=[
    ['기본 오라',1],['오라 1단계',4],['오라 2단계',10],['오라 3단계',22],['오라 4단계',38],['오라 5단계',60],['최종 오라',90]
  ];
  const autoCounts={};
  SKILL_POOL.filter(s=>s.statType==='autoStrike').forEach(s=>{autoCounts[s.grade]=(autoCounts[s.grade]||0)+1;});
  const autoRows=GRADES.filter(g=>autoCounts[g.key]).map(g=>`<div class="mission-item"><b><span class="${g.cls}">${g.name}</span> 자동공격 패시브</b><p>도감 내 ${autoCounts[g.key]}개 구성</p></div>`).join('');
  box.innerHTML=`
    <h3>캐릭터 외형 변경 조건</h3>
    ${charSteps.map(([name,need])=>`<div class="mission-item ${uniqueCount>=need?'done':''}"><b>${name}</b><p>고유 패시브 ${need}개 필요 · 현재 ${uniqueCount}개</p></div>`).join('')}
    <h3>오라 변경 조건</h3>
    ${auraSteps.map(([name,need])=>`<div class="mission-item ${totalLv>=need?'done':''}"><b>${name}</b><p>총 패시브 레벨 ${need} 필요 · 현재 ${totalLv}</p></div>`).join('')}
    <h3>자동공격 스킬 구성</h3>
    ${autoRows}
    <h3>구역 개방 조건</h3>
    ${ZONES.map(z=>`<div class="mission-item ${state.level>=z.min?'done':''}"><b>${z.name}</b><p>Lv.${z.min} 개방 · EXP +${z.exp}% · 공격 +${z.power}% · 속도 +${z.speed}% · 몬스터 방어 보정 x${z.defense}</p></div>`).join('')}
  `;
}


let currentRankMode='level';
function buildRankingRows(mode='level'){
  clearFakeRankingCaches();
  if(!state || !state.name || !state.id || !isRealLocalPlayer(state)) return [];
  const z=currentZone();
  return [{rank:1,name:state.name,level:Math.max(1,state.level||1),zone:z.name,zoneIndex:z.index,me:true}];
}
function renderRanking(mode=currentRankMode){
  currentRankMode=mode;
  const list=$('rankingList'); if(!list) return;
  const lvTab=$('rankLevelTab'), zoneTab=$('rankZoneTab');
  if(lvTab) lvTab.classList.toggle('active', mode==='level');
  if(zoneTab) zoneTab.classList.toggle('active', mode==='zone');
  const rows=buildRankingRows(mode);
  if(!rows.length){
    list.innerHTML='<div class="empty-rank">아직 랭킹에 등록된 실제 플레이어가 없습니다. 캐릭터를 생성하고 플레이하면 여기에 표시됩니다.</div>';
    return;
  }
  list.innerHTML=rows.map(r=>`<div class="rank-row ${r.me?'me':''}"><b>${r.rank}</b><span>${r.name}</span><em>Lv.${r.level}</em><small>${r.zone}</small></div>`).join('');
}
function openRanking(){ renderRanking(currentRankMode); $('rankingModal').classList.add('active'); }

function titleByLevel(lv){ if(lv>=100)return '신화적 존재'; if(lv>=80)return '운명을 찢는 존재'; if(lv>=60)return '초월자'; if(lv>=40)return '군림자'; if(lv>=20)return '각성체'; if(lv>=10)return '성장체'; return '새싹 존재'; }
function zoneName(){ return currentZone().name; }
function hasHighGrade(){ return state.passives.some(s=>['legend','epic','god'].includes(s.grade)); }
function showHit(text){ const f=$('floatingText'); f.textContent=text; f.classList.remove('float'); void f.offsetWidth; f.classList.add('float'); }
function save(){ if(state) localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }

function sanitizeSkill(skill){
  if(!skill) return skill;
  if(skill.statType==='hp'){ skill.statType='power'; skill.name=skill.name.replace('재생력','투지').replace('피부','투지'); }
  if(skill.statType==='regen'){ skill.statType='expPulse'; skill.name=skill.name.replace('재생력','흡수력').replace('심장','흡수력'); }
  const fresh=SKILL_POOL.find(x=>x.id===skill.id);
  if(fresh){
    skill.grade=fresh.grade; skill.gradeName=fresh.gradeName; skill.gradeClass=fresh.gradeClass;
    skill.value=fresh.value; skill.interval=fresh.interval; skill.desc=describeSkill(skill.statType, skill.value, skill.gradeName, skill.interval);
  }else{
    skill.desc=describeSkill(skill.statType, skill.value||1, skill.gradeName||'일반', skill.interval||5);
  }
  return skill;
}

function migrate(s){
  if(!s.lastPassiveTick) s.lastPassiveTick={};
  if(s && s.name && s.id && !isFakePlayerName(s.name) && s.isDummy!==true && s.fake!==true && s.npc!==true){
    // 기존 내 저장 데이터는 유지하되, 더미 랭킹 이름은 절대 실제 유저로 승격하지 않는다.
    s.localHumanPlayer = s.localHumanPlayer !== false;
    s.rankingEligible = s.rankingEligible !== false;
    s.isDummy = false;
    s.fake = false;
    s.npc = false;
  }
  if(Array.isArray(s.passives)){
    const merged={};
    s.passives.forEach(p=>{
      if(!p || !p.id) return;
      if(!merged[p.id]) merged[p.id]={...p, level:0};
      merged[p.id].level += Math.max(1, p.level || p.stack || 1);
    });
    s.passives=Object.values(merged).map(p=>sanitizeSkill(p));
  }else{
    s.passives=[];
  }
  if(typeof s.kills!=='number') s.kills=0;
  delete s.hp;
  if(typeof s.enemyMaxHp!=='number') s.enemyMaxHp=Math.max(1, s.monster?.maxHp || 1);
  delete s.gold;
  state=s;
  if(!state.monster) state.monster=makeMonster();
  state.monster.maxHp=Math.max(state.enemyMaxHp || 1, state.monster.maxHp || 1);
  state.monster.defense=defenseFromHp(state.monster.maxHp);
  state.monster.formTier=monsterFormTier(state.monster.defense||0);
  return state;
}
function load(){
  const raw=localStorage.getItem(SAVE_KEY);
  if(!raw) return false;
  try{
    state=JSON.parse(raw);
    state=migrate(state);
    if(!isRealLocalPlayer(state)){ localStorage.removeItem(SAVE_KEY); state=null; return false; }
    $('createModal').classList.remove('active'); render(); startLoop(); log('저장 데이터를 불러왔습니다.'); return true;
  }catch(e){ return false; }
}
function startLoop(){ clearInterval(loop); clearInterval(passiveTimer); const st=calcStats(); loop=setInterval(hunt, st.attackMs); passiveTimer=setInterval(tickPassiveSkills,1000); }


function openStatusDetail(){ renderStatusDetails(); $('statusDetailModal').classList.add('active'); }
const statusBtn=$('statusBtn');
if(statusBtn){ statusBtn.onclick=openStatusDetail; }


function cleanupCreateModalCloseButtons(){
  // 생성창에서는 하단 '창 닫기' 버튼 하나만 남긴다.
  document.querySelectorAll('.create-close-fixed, .modal-x').forEach(el=>el.remove());
  document.querySelectorAll('body > button').forEach(btn=>{
    if((btn.textContent||'').trim()==='닫기') btn.remove();
  });
  const modal=$('createModal');
  if(modal){
    modal.querySelectorAll('button').forEach(btn=>{
      if(btn.id !== 'createBtn' && btn.id !== 'createCloseBottom') btn.remove();
    });
  }
}

$('createBtn').onclick=createCharacter;
function closeCreateModal(){
  cleanupCreateModalCloseButtons();
  const m=$('createModal');
  if(m) m.classList.remove('active');
  newCharacterModalMode=false;
  if(state){
    state.auto=true;
    save();
    render();
    startLoop();
  }
}
if($('createCloseBottom')) $('createCloseBottom').onclick=closeCreateModal;

function closeModalById(id){
  const m=$(id);
  if(m) m.classList.remove('active');
  if(id==='createModal' && state){
    state.auto = true;
    save();
    render();
    startLoop();
  }
}
document.addEventListener('click', (e)=>{
  const btn=e.target.closest('[data-close-modal]');
  if(btn){ closeModalById(btn.dataset.closeModal); }
});

$('newCharBtn').onclick=()=>{
  if(!confirm('새 캐릭터 생성창을 열까요? 실제 생성 버튼을 누르기 전까지 현재 캐릭터는 유지됩니다.')) return;
  newCharacterModalMode=true;
  if(state){ state.auto=true; save(); render(); startLoop(); }
  ['passiveModal','dataModal','rankingModal','missionModal','noticeModal','supportModal','statusDetailModal','skillDexModal'].forEach(id=>$(id)?.classList.remove('active'));
  cleanupCreateModalCloseButtons();
  $('createModal').classList.add('active');
  // 혹시 이전 캐시에서 만든 상단 닫기 버튼이 뒤늦게 붙어도 바로 제거
  setTimeout(cleanupCreateModalCloseButtons, 0);
  setTimeout(cleanupCreateModalCloseButtons, 100);
};
$('saveBtn').onclick=()=>{ save(); log('저장 완료.'); };
$('huntBtn').onclick=()=>{ state.auto=!state.auto; save(); render(); };
$('passiveBtn').onclick=()=>{$('passiveModal').classList.add('active'); renderPassives();};
$('passiveClose').onclick=()=>$('passiveModal').classList.remove('active');
$('skillDexBtn').onclick=()=>{ $('skillDexModal').classList.add('active'); renderSkillDex(); };
$('skillDexClose').onclick=()=>$('skillDexModal').classList.remove('active');
$('statusDetailBtn').onclick=openStatusDetail;
$('statusDetailClose').onclick=()=>$('statusDetailModal').classList.remove('active');
if($('noticeBtn')) $('noticeBtn').onclick=()=>$('noticeModal').classList.add('active');
if($('noticeClose')) $('noticeClose').onclick=()=>$('noticeModal').classList.remove('active');
$('rankingBtn').onclick=openRanking;
$('rankingPanelBtn').onclick=openRanking;
$('missionBtn').onclick=()=>{ renderMissions(); $('missionModal').classList.add('active'); };
$('missionPanelBtn').onclick=()=>{ renderMissions(); $('missionModal').classList.add('active'); };
$('rankingClose').onclick=()=>$('rankingModal').classList.remove('active');
$('rankLevelTab').onclick=()=>renderRanking('level');
$('rankZoneTab').onclick=()=>renderRanking('zone');
$('missionClose').onclick=()=>$('missionModal').classList.remove('active');

if($('supportBtn')) $('supportBtn').onclick=()=> $('supportModal').classList.add('active');
if($('supportClose')) $('supportClose').onclick=()=> $('supportModal').classList.remove('active');

$('exportBtn').onclick=()=>{ dataMode='export'; $('dataTitle').textContent='저장 데이터 내보내기'; $('dataBox').value=btoa(unescape(encodeURIComponent(JSON.stringify(state)))); $('dataApply').style.display='none'; $('dataModal').classList.add('active'); };
$('importBtn').onclick=()=>{ dataMode='import'; $('dataTitle').textContent='저장 데이터 가져오기'; $('dataBox').value=''; $('dataApply').style.display='inline-block'; $('dataModal').classList.add('active'); };
$('dataClose').onclick=()=>$('dataModal').classList.remove('active');
$('dataApply').onclick=()=>{ try{ state=JSON.parse(decodeURIComponent(escape(atob($('dataBox').value.trim())))); state=migrate(state); save(); $('dataModal').classList.remove('active'); render(); startLoop(); log('가져오기 완료.'); }catch(e){ alert('저장 데이터 형식이 올바르지 않습니다.'); } };
clearFakeRankingCaches();
cleanupCreateModalCloseButtons();
setInterval(cleanupCreateModalCloseButtons, 500);
if(!load()) { $('createModal').classList.add('active'); cleanupCreateModalCloseButtons(); }
