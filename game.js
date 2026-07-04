const $ = id => document.getElementById(id);
const SAVE_KEY='random_growth_game_v14';
let state = null;
let loop = null;
let passiveTimer = null;
let pendingChoices = [];
let dataMode = 'export';
const base = { power:10, expNeed:100, baseAttackMs:900 };
const RANDOM_NAME_PREFIX=['검은','붉은','푸른','황금','은빛','그림자','폭풍','심연','새벽','혼돈','운명의','떠도는','작은','거대한'];
const RANDOM_NAME_BODY=['슬라임','고블린','오크','트롤','키메라','마수','망령','용아','불씨','늑대','거인','마검','별조각','왕눈이'];
const RANDOM_NAME_SUFFIX=['씨앗','초보자','방랑자','각성체','행운아','포식자','도전자','계승자','수집가','생존자'];

function rand(max){ return Math.floor(Math.random()*max); }
function nowSec(){ return Math.floor(Date.now()/1000); }
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
function defenseFromHp(maxHp){ return Math.floor(Math.max(1, maxHp)/10); }
function makeMonster(){
  const maxHp=currentEnemyMaxHp();
  const defense=defenseFromHp(maxHp);
  const lv=Math.max(1, Math.floor(1 + state.kills/5 + state.level*0.75 + Math.log10(maxHp)));
  const names=['슬라임','뿔토끼','고블린','늑대','오크','트롤','오우거','키메라','마룡의 그림자','고대 재앙'];
  const tier=Math.min(names.length-1, monsterFormTier(defense));
  return { name:names[tier], level:lv, maxHp:maxHp, hp:maxHp, atk:Math.round(3+lv*1.4), hitCount:0, defense:defense, formTier:monsterFormTier(defense) };
}
function growMonsterOnHit(){
  state.enemyMaxHp=Math.max(1, Math.floor(state.enemyMaxHp || state.monster?.maxHp || 1)) + 1;
  const m=state.monster;
  if(!m) return;
  m.hitCount=(m.hitCount||0)+1;
  m.maxHp=state.enemyMaxHp;
  m.hp+=1;
  m.defense=defenseFromHp(m.maxHp);
  m.formTier=monsterFormTier(m.defense);
  const names=['슬라임','뿔토끼','고블린','늑대','오크','트롤','오우거','키메라','마룡의 그림자','고대 재앙'];
  m.name=names[Math.min(names.length-1, m.formTier)];
}

function createCharacter(){
  const name=makeRandomName();
  const first=rollSkill([]);
  first.level = 1;
  state={ name, level:1, exp:0, kills:0, enemyMaxHp:1, passives:[first], claimedMilestones:[], auto:true, monster:null, lastPassiveTick:{}, createdAt:Date.now() };
  state.monster=makeMonster();
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
  stats.power=Math.round(stats.power * (1 + Math.min(250, stats.combo)/100));
  stats.crit=Math.min(85,stats.crit);
  stats.critDamage=Math.min(1000,stats.critDamage);
  stats.pierce=Math.min(95,stats.pierce);
  stats.execute=Math.min(500,stats.execute);
  stats.overdrive=Math.min(300,stats.overdrive);
  stats.attackMs=Math.max(220, Math.round(stats.attackMs));
  stats.attackSpeed=+(1000/stats.attackMs).toFixed(2);
  return stats;
}
function needExp(){ return Math.max(1, Math.round(base.expNeed*Math.pow(1.18,state.level-1)/4)); }

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
  const expGain=actual + (st.flatExp||0); state.exp+=expGain;
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
          const exp=Math.round((s.value*s.level)+state.level*2);
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
  $('monsterLevelText').textContent=`몬스터 Lv. ${state.monster.level} · 방어력 ${state.monster.defense||0}`;
  $('zoneText').textContent=`${zoneName()} ${Math.max(1,Math.floor(state.monster.level/10)+1)}구역`;
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
  e.className='enemy monster-tier-' + monsterFormTier(state.monster.defense||0);
}
function displayClass(s){ return s.gradeClass; }
function passiveTotalLv(list=passiveStacks()){ return list.reduce((a,s)=>a+(s.level||1),0); }
function playerVisualTier(list=passiveStacks()){ const c=list.length, total=passiveTotalLv(list); if(c>=40||total>=90)return 6; if(c>=28||total>=60)return 5; if(c>=18||total>=38)return 4; if(c>=10||total>=22)return 3; if(c>=5||total>=10)return 2; if(c>=2||total>=4)return 1; return 0; }
function auraOpacity(list=passiveStacks()){ return Math.min(.88, .16 + playerVisualTier(list)*.11 + passiveTotalLv(list)*.003); }
function updatePlayerVisual(list=passiveStacks()){ const p=$('playerSprite'); const a=$('aura'); if(!p||!a)return; const tier=playerVisualTier(list); p.className='player player-tier-' + tier; a.className='aura aura-tier-' + tier; }
function spawnAttackEffect(type='normal', label=''){ const layer=$('effectLayer'); if(!layer)return; const el=document.createElement('div'); el.className='attack-effect ' + (type==='skill'?'skill-effect':'normal-effect'); el.textContent=type==='skill' ? (label||'스킬') : '일반공격'; layer.appendChild(el); setTimeout(()=>el.remove(),700); }
function spawnPlayerEffect(type='heal', label=''){ const layer=$('effectLayer'); if(!layer)return; const el=document.createElement('div'); el.className='player-effect ' + type; el.textContent=label; layer.appendChild(el); setTimeout(()=>el.remove(),900); }
function renderPassives(){
  const stacks=passiveStacks();
  const totalLv=stacks.reduce((a,s)=>a+(s.level||1),0);
  $('passiveSummary').innerHTML=`고유 패시브 ${stacks.length}종 · 총 패시브 레벨 ${totalLv} · 같은 스킬 선택 시 레벨 상승`; 
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
    ['닉네임', state.name], ['레벨', state.level], ['현재 EXP', `${state.exp} / ${needExp()}`], ['공격력', st.power],
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
  `;
}

function titleByLevel(lv){ if(lv>=100)return '신화적 존재'; if(lv>=80)return '운명을 찢는 존재'; if(lv>=60)return '초월자'; if(lv>=40)return '군림자'; if(lv>=20)return '각성체'; if(lv>=10)return '성장체'; return '새싹 존재'; }
function zoneName(){ const lv=state.monster.level; if(lv>=80)return '종말'; if(lv>=60)return '마계'; if(lv>=40)return '심연'; if(lv>=20)return '황무지'; return '초원'; }
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
  const raw=localStorage.getItem(SAVE_KEY) || localStorage.getItem('random_growth_game_v13') || localStorage.getItem('random_growth_game_v12') || localStorage.getItem('random_growth_game_v11') || localStorage.getItem('random_growth_game_v10') || localStorage.getItem('random_growth_game_v9') || localStorage.getItem('random_growth_game_v8') || localStorage.getItem('random_growth_game_v7') || localStorage.getItem('random_growth_game_v6') || localStorage.getItem('random_growth_game_v5') || localStorage.getItem('random_growth_game_v4') || localStorage.getItem('random_growth_game_v3') || localStorage.getItem('random_growth_game_v2') || localStorage.getItem('random_growth_game_v1');
  if(!raw) return false;
  try{ state=JSON.parse(raw); state=migrate(state); $('createModal').classList.remove('active'); render(); startLoop(); log('저장 데이터를 불러왔습니다.'); return true; }catch(e){ return false; }
}
function startLoop(){ clearInterval(loop); clearInterval(passiveTimer); const st=calcStats(); loop=setInterval(hunt, st.attackMs); passiveTimer=setInterval(tickPassiveSkills,1000); }


function openStatusDetail(){ renderStatusDetails(); $('statusDetailModal').classList.add('active'); }
const statusBtn=$('statusBtn');
if(statusBtn){ statusBtn.onclick=openStatusDetail; }

$('createBtn').onclick=createCharacter;
$('newCharBtn').onclick=()=>{ if(confirm('새 캐릭터를 만들면 현재 저장 데이터가 삭제됩니다.')){ clearInterval(loop); clearInterval(passiveTimer); ['random_growth_game_v14','random_growth_game_v13','random_growth_game_v12','random_growth_game_v11','random_growth_game_v10','random_growth_game_v9','random_growth_game_v8','random_growth_game_v7','random_growth_game_v6','random_growth_game_v5','random_growth_game_v4','random_growth_game_v3','random_growth_game_v2','random_growth_game_v1'].forEach(k=>localStorage.removeItem(k)); state=null; pendingChoices=[]; $('choiceModal').classList.remove('active'); $('passiveModal').classList.remove('active'); $('dataModal').classList.remove('active'); $('createModal').classList.add('active'); $('log').innerHTML=''; } };
$('saveBtn').onclick=()=>{ save(); log('저장 완료.'); };
$('huntBtn').onclick=()=>{ state.auto=!state.auto; save(); render(); };
$('passiveBtn').onclick=()=>{$('passiveModal').classList.add('active'); renderPassives();};
$('passiveClose').onclick=()=>$('passiveModal').classList.remove('active');
$('skillDexBtn').onclick=()=>{ $('skillDexModal').classList.add('active'); renderSkillDex(); };
$('skillDexClose').onclick=()=>$('skillDexModal').classList.remove('active');
$('statusDetailBtn').onclick=openStatusDetail;
$('statusDetailClose').onclick=()=>$('statusDetailModal').classList.remove('active');
$('noticeBtn').onclick=()=>$('noticeModal').classList.add('active');
$('noticePanelBtn').onclick=()=>$('noticeModal').classList.add('active');
$('missionBtn').onclick=()=>{ renderMissions(); $('missionModal').classList.add('active'); };
$('missionPanelBtn').onclick=()=>{ renderMissions(); $('missionModal').classList.add('active'); };
$('noticeClose').onclick=()=>$('noticeModal').classList.remove('active');
$('missionClose').onclick=()=>$('missionModal').classList.remove('active');
$('exportBtn').onclick=()=>{ dataMode='export'; $('dataTitle').textContent='저장 데이터 내보내기'; $('dataBox').value=btoa(unescape(encodeURIComponent(JSON.stringify(state)))); $('dataApply').style.display='none'; $('dataModal').classList.add('active'); };
$('importBtn').onclick=()=>{ dataMode='import'; $('dataTitle').textContent='저장 데이터 가져오기'; $('dataBox').value=''; $('dataApply').style.display='inline-block'; $('dataModal').classList.add('active'); };
$('dataClose').onclick=()=>$('dataModal').classList.remove('active');
$('dataApply').onclick=()=>{ try{ state=JSON.parse(decodeURIComponent(escape(atob($('dataBox').value.trim())))); state=migrate(state); save(); $('dataModal').classList.remove('active'); render(); startLoop(); log('가져오기 완료.'); }catch(e){ alert('저장 데이터 형식이 올바르지 않습니다.'); } };
if(!load()) $('createModal').classList.add('active');
