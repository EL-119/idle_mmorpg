const $ = id => document.getElementById(id);
const SAVE_KEY='random_growth_game_v2';
let state = null;
let loop = null;
let passiveTimer = null;
let pendingChoices = [];
let dataMode = 'export';
const base = { hp:100, power:10, expNeed:100 };

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
  return structuredClone(list[rand(list.length)] || SKILL_POOL[rand(SKILL_POOL.length)]);
}
function rollChoices(){
  const picked=[];
  while(picked.length<3){
    const skill=rollSkill(picked.map(s=>s.id));
    if(!picked.find(s=>s.id===skill.id)) picked.push(skill);
  }
  return picked;
}
function makeMonster(){
  const lv=Math.max(1, Math.floor(1 + state.kills/5 + state.level*0.75));
  const names=['슬라임','뿔토끼','고블린','늑대','오크','트롤','오우거','키메라','마룡의 그림자'];
  const tier=Math.min(names.length-1, Math.floor(lv/12));
  const maxHp=Math.round(34*Math.pow(1.095,lv-1) + lv*15 + state.kills*1.5);
  const atk=Math.round(3 + lv*1.4 + Math.pow(lv,1.08));
  return { name:names[tier], level:lv, maxHp, hp:maxHp, atk };
}

function createCharacter(){
  const name=$('nameInput').value.trim() || '랜덤러';
  const first=rollSkill([]);
  state={ name, level:1, exp:0, hp:100, gold:0, kills:0, passives:[first], claimedMilestones:[], auto:true, monster:null, lastPassiveTick:{}, createdAt:Date.now() };
  state.monster=makeMonster();
  $('createModal').classList.remove('active');
  log(`${name} 생성 완료. 시작 패시브 ${first.gradeName} [${first.name}] 획득.`);
  save(); render(); startLoop();
}

function passiveStacks(){
  const map={};
  state.passives.forEach(s=>{ if(!map[s.id]) map[s.id]={...s, stack:0}; map[s.id].stack++; });
  return Object.values(map).sort((a,b)=>gradePower(b.grade)-gradePower(a.grade) || b.stack-a.stack);
}
function gradePower(g){ return {normal:1,magic:2,rare:3,unique:4,legend:5,epic:6,god:7}[g] || 1; }

function calcStats(){
  const stats={ maxHp:base.hp, power:base.power+state.level*2, expBonus:0, goldBonus:0, crit:3, speedBonus:0, autoStrike:[], regen:[], goldRain:[], expPulse:[] };
  state.passives.forEach(s=>{
    if(s.statType==='power') stats.power+=s.value;
    if(s.statType==='hp') stats.maxHp+=s.value*4;
    if(s.statType==='exp') stats.expBonus+=s.value;
    if(s.statType==='gold') stats.goldBonus+=s.value;
    if(s.statType==='crit') stats.crit+=Math.max(1,Math.floor(s.value/2));
    if(s.statType==='speed') stats.speedBonus+=Math.max(1,Math.floor(s.value/3));
    if(['autoStrike','regen','goldRain','expPulse'].includes(s.statType)) stats[s.statType].push(s);
  });
  stats.maxHp=Math.round(stats.maxHp); stats.power=Math.round(stats.power); stats.crit=Math.min(85,stats.crit);
  return stats;
}
function needExp(){ return Math.round(base.expNeed*Math.pow(1.18,state.level-1)); }

function hunt(){
  if(!state || !state.auto || pendingChoices.length) return;
  if(!state.monster) state.monster=makeMonster();
  const st=calcStats();
  const crit=Math.random()*100 < st.crit;
  const dmg=Math.round(st.power*(crit?1.8:1)*(0.85+Math.random()*0.3));
  damageMonster(dmg, crit?'CRIT ':'');
  const taken=Math.max(1,Math.round(state.monster.atk*(0.75+Math.random()*0.35)));
  state.hp=Math.max(1,state.hp-taken);
  save(); render();
}
function damageMonster(amount,prefix=''){
  state.monster.hp-=amount;
  showHit(`${prefix}-${amount}`);
  $('enemySprite').classList.add('shake'); setTimeout(()=>$('enemySprite').classList.remove('shake'),260);
  if(state.monster.hp<=0) killMonster();
}
function killMonster(){
  const st=calcStats();
  const expGain=Math.round((18+state.monster.level*4)*(1+st.expBonus/100));
  const goldGain=Math.round((5+state.monster.level*2)*(1+st.goldBonus/100));
  state.exp+=expGain; state.gold+=goldGain; state.kills++;
  log(`${state.monster.name} 처치. 경험치 ${expGain}, 골드 ${goldGain} 획득.`);
  while(state.exp>=needExp()){
    state.exp-=needExp(); state.level++; state.hp=calcStats().maxHp;
    log(`레벨 ${state.level} 달성.`);
    if(state.level%10===0 && !state.claimedMilestones.includes(state.level)) openChoice();
  }
  state.monster=makeMonster();
}
function tickPassiveSkills(){
  if(!state || !state.auto || pendingChoices.length) return;
  const st=calcStats();
  const t=nowSec();
  ['autoStrike','regen','goldRain','expPulse'].forEach(type=>{
    st[type].forEach((s,idx)=>{
      const key=`${s.id}_${idx}`;
      const last=state.lastPassiveTick[key] || 0;
      if(t-last>=s.interval){
        state.lastPassiveTick[key]=t;
        if(type==='autoStrike'){
          const dmg=Math.round(st.power*(0.35+s.value/100));
          damageMonster(dmg,'자동 ');
          log(`[${s.name}] 자동 발동. 추가 피해 ${dmg}.`);
        }
        if(type==='regen'){
          const heal=Math.round(st.maxHp*(Math.min(25,s.value)/100));
          state.hp=Math.min(st.maxHp,state.hp+heal);
          log(`[${s.name}] 자동 발동. HP ${heal} 회복.`);
        }
        if(type==='goldRain'){
          const gold=Math.round(s.value+state.level*1.5);
          state.gold+=gold;
          log(`[${s.name}] 자동 발동. 골드 ${gold} 획득.`);
        }
        if(type==='expPulse'){
          const exp=Math.round(s.value+state.level*2);
          state.exp+=exp;
          log(`[${s.name}] 자동 발동. 경험치 ${exp} 획득.`);
        }
      }
    });
  });
  while(state.exp>=needExp()){
    state.exp-=needExp(); state.level++; state.hp=calcStats().maxHp;
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
    const owned=state.passives.filter(p=>p.id===s.id).length;
    const btn=document.createElement('button'); btn.className='choice-card';
    btn.innerHTML=`<b><span class="${s.gradeClass}">${s.name}</span><em class="grade ${s.gradeClass}">${s.gradeName}</em></b><p>${s.desc}</p><small>현재 중첩 ${owned}회 · 선택 시 ${owned+1}회</small>`;
    btn.onclick=()=>chooseSkill(s);
    box.appendChild(btn);
  });
  $('choiceModal').classList.add('active');
}
function chooseSkill(skill){
  state.passives.push(skill); pendingChoices=[];
  $('choiceModal').classList.remove('active');
  log(`${skill.gradeName} 패시브 [${skill.name}] 선택. 같은 스킬은 중첩 적용됩니다.`);
  save(); render(); startLoop();
}

function render(){
  if(!state) return;
  const st=calcStats();
  if(!state.monster) state.monster=makeMonster();
  $('charName').textContent=state.name;
  $('charTitle').textContent=`Lv. ${state.level} · ${titleByLevel(state.level)}`;
  $('level').textContent=state.level; $('power').textContent=st.power; $('gold').textContent=state.gold; $('kills').textContent=state.kills;
  $('passiveCount').textContent=passiveStacks().length; $('stackCount').textContent=state.passives.length;
  $('hpText').textContent=`${Math.round(state.hp)} / ${st.maxHp}`; $('hpBar').style.width=`${Math.min(100,state.hp/st.maxHp*100)}%`;
  $('expText').textContent=`${state.exp} / ${needExp()}`; $('expBar').style.width=`${Math.min(100,state.exp/needExp()*100)}%`;
  $('huntBtn').textContent=state.auto?'자동 사냥 중':'자동 사냥 정지';
  $('aura').style.opacity = hasHighGrade() ? .55 : .22;
  $('monsterName').textContent=state.monster.name;
  $('monsterLevelText').textContent=`몬스터 Lv. ${state.monster.level}`;
  $('zoneText').textContent=`${zoneName()} ${Math.max(1,Math.floor(state.monster.level/10)+1}구역`;
  $('monsterHpText').textContent=`HP ${Math.max(0,Math.round(state.monster.hp))} / ${state.monster.maxHp}`;
  $('monsterHpBar').style.width=`${Math.max(0,Math.min(100,state.monster.hp/state.monster.maxHp*100))}%`;
  renderPassives();
}
function renderPassives(){
  const stacks=passiveStacks();
  $('quickPassiveList').innerHTML=stacks.slice(0,4).map(s=>`<div class="passive mini"><b><span class="${s.gradeClass}">${s.name}</span><em>x${s.stack}</em></b><p>${s.gradeName} · ${s.desc}</p></div>`).join('') || '<p class="empty">아직 패시브가 없습니다.</p>';
  $('passiveSummary').innerHTML=`총 보유 ${state.passives.length}개 · 고유 패시브 ${stacks.length}종 · 같은 스킬 중첩 가능`;
  $('passiveList').innerHTML=stacks.map(s=>`<div class="passive"><b><span class="${s.gradeClass}">${s.name}</span><em class="grade ${s.gradeClass}">${s.gradeName} x${s.stack}</em></b><p>${s.desc}</p></div>`).join('');
}
function titleByLevel(lv){ if(lv>=100)return '신화적 존재'; if(lv>=80)return '운명을 찢는 존재'; if(lv>=60)return '초월자'; if(lv>=40)return '군림자'; if(lv>=20)return '각성체'; if(lv>=10)return '성장체'; return '새싹 존재'; }
function zoneName(){ const lv=state.monster.level; if(lv>=80)return '종말'; if(lv>=60)return '마계'; if(lv>=40)return '심연'; if(lv>=20)return '황무지'; return '초원'; }
function hasHighGrade(){ return state.passives.some(s=>['legend','epic','god'].includes(s.grade)); }
function showHit(text){ const f=$('floatingText'); f.textContent=text; f.classList.remove('float'); void f.offsetWidth; f.classList.add('float'); }
function save(){ if(state) localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
function migrate(s){ if(!s.monster) s.monster=makeMonster(); if(!s.lastPassiveTick) s.lastPassiveTick={}; return s; }
function load(){
  const raw=localStorage.getItem(SAVE_KEY) || localStorage.getItem('random_growth_game_v1');
  if(!raw) return false;
  try{ state=JSON.parse(raw); state=migrate(state); $('createModal').classList.remove('active'); render(); startLoop(); log('저장 데이터를 불러왔습니다.'); return true; }catch(e){ return false; }
}
function startLoop(){ clearInterval(loop); clearInterval(passiveTimer); const st=calcStats(); loop=setInterval(hunt, Math.max(280,900-(st.speedBonus*5))); passiveTimer=setInterval(tickPassiveSkills,1000); }

$('createBtn').onclick=createCharacter;
$('newCharBtn').onclick=()=>{ if(confirm('새 캐릭터를 만들면 현재 저장 데이터가 삭제됩니다.')){ localStorage.removeItem(SAVE_KEY); localStorage.removeItem('random_growth_game_v1'); location.reload(); } };
$('saveBtn').onclick=()=>{ save(); log('저장 완료.'); };
$('huntBtn').onclick=()=>{ state.auto=!state.auto; save(); render(); };
$('passiveBtn').onclick=()=>{$('passiveModal').classList.add('active'); renderPassives();};
$('passiveClose').onclick=()=>$('passiveModal').classList.remove('active');
$('exportBtn').onclick=()=>{ dataMode='export'; $('dataTitle').textContent='저장 데이터 내보내기'; $('dataBox').value=btoa(unescape(encodeURIComponent(JSON.stringify(state)))); $('dataApply').style.display='none'; $('dataModal').classList.add('active'); };
$('importBtn').onclick=()=>{ dataMode='import'; $('dataTitle').textContent='저장 데이터 가져오기'; $('dataBox').value=''; $('dataApply').style.display='inline-block'; $('dataModal').classList.add('active'); };
$('dataClose').onclick=()=>$('dataModal').classList.remove('active');
$('dataApply').onclick=()=>{ try{ state=JSON.parse(decodeURIComponent(escape(atob($('dataBox').value.trim())))); state=migrate(state); save(); $('dataModal').classList.remove('active'); render(); startLoop(); log('가져오기 완료.'); }catch(e){ alert('저장 데이터 형식이 올바르지 않습니다.'); } };
if(!load()) $('createModal').classList.add('active');
