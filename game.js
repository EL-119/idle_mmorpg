const $ = id => document.getElementById(id);
const SAVE_KEY='random_growth_game_v1';
let state = null;
let loop = null;
let pendingChoices = [];
let dataMode = 'export';

const base = { hp:100, power:10, expNeed:100 };

function rand(max){ return Math.floor(Math.random()*max); }
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
  return list[rand(list.length)] || SKILL_POOL[rand(SKILL_POOL.length)];
}
function rollChoices(){
  const picked=[];
  while(picked.length<3){
    const skill=rollSkill(picked.map(s=>s.id).concat(state.passives.map(s=>s.id)));
    if(!picked.find(s=>s.id===skill.id)) picked.push(skill);
  }
  return picked;
}

function createCharacter(){
  const name=$('nameInput').value.trim() || '랜덤러';
  const first=rollSkill([]);
  state={ name, level:1, exp:0, hp:100, gold:0, kills:0, passives:[first], claimedMilestones:[], auto:true, createdAt:Date.now() };
  $('createModal').classList.remove('active');
  log(`${name} 생성 완료. 시작 패시브 ${first.gradeName} [${first.name}] 획득.`);
  save(); render(); startLoop();
}

function calcStats(){
  const stats={ maxHp:base.hp, power:base.power+state.level*2, expBonus:0, goldBonus:0, crit:3, speedBonus:0 };
  state.passives.forEach(s=>{
    if(s.statType==='power') stats.power+=s.value;
    if(s.statType==='hp') stats.maxHp+=s.value*4;
    if(s.statType==='exp') stats.expBonus+=s.value;
    if(s.statType==='gold') stats.goldBonus+=s.value;
    if(s.statType==='crit') stats.crit+=Math.max(1,Math.floor(s.value/2));
    if(s.statType==='speed') stats.speedBonus+=Math.max(1,Math.floor(s.value/3));
  });
  stats.power=Math.round(stats.power);
  return stats;
}

function hunt(){
  if(!state || !state.auto || pendingChoices.length) return;
  const st=calcStats();
  const crit=Math.random()*100 < st.crit;
  const dmg=Math.round(st.power*(crit?1.8:1)*(0.85+Math.random()*0.3));
  const expGain=Math.round((18+state.level*3)*(1+st.expBonus/100));
  const goldGain=Math.round((5+state.level)*(1+st.goldBonus/100));
  state.exp+=expGain; state.gold+=goldGain; state.kills++;
  showHit(crit?`CRIT ${dmg}`:`-${dmg}`);
  $('enemySprite').classList.add('shake'); setTimeout(()=>$('enemySprite').classList.remove('shake'),260);
  while(state.exp>=needExp()){
    state.exp-=needExp(); state.level++; state.hp=calcStats().maxHp;
    log(`레벨 ${state.level} 달성.`);
    if(state.level%10===0 && !state.claimedMilestones.includes(state.level)) openChoice();
  }
  save(); render();
}
function needExp(){ return Math.round(base.expNeed*Math.pow(1.18,state.level-1)); }
function showHit(text){ const f=$('floatingText'); f.textContent=text; f.classList.remove('float'); void f.offsetWidth; f.classList.add('float'); }

function openChoice(){
  state.claimedMilestones.push(state.level);
  pendingChoices=rollChoices();
  const box=$('choiceList'); box.innerHTML='';
  pendingChoices.forEach(s=>{
    const btn=document.createElement('button'); btn.className='choice-card';
    btn.innerHTML=`<b><span class="${s.gradeClass}">${s.name}</span><em class="grade ${s.gradeClass}">${s.gradeName}</em></b><p>${s.desc}</p>`;
    btn.onclick=()=>chooseSkill(s);
    box.appendChild(btn);
  });
  $('choiceModal').classList.add('active');
}
function chooseSkill(skill){
  state.passives.push(skill); pendingChoices=[];
  $('choiceModal').classList.remove('active');
  log(`${skill.gradeName} 패시브 [${skill.name}] 선택.`);
  save(); render();
}

function render(){
  if(!state) return;
  const st=calcStats();
  $('charName').textContent=state.name;
  $('charTitle').textContent=`Lv. ${state.level} · ${titleByLevel(state.level)}`;
  $('level').textContent=state.level; $('power').textContent=st.power; $('gold').textContent=state.gold; $('kills').textContent=state.kills;
  $('hpText').textContent=`${Math.round(state.hp)} / ${st.maxHp}`; $('hpBar').style.width=`${Math.min(100,state.hp/st.maxHp*100)}%`;
  $('expText').textContent=`${state.exp} / ${needExp()}`; $('expBar').style.width=`${Math.min(100,state.exp/needExp()*100)}%`;
  $('huntBtn').textContent=state.auto?'자동 사냥 중':'자동 사냥 정지';
  $('aura').style.opacity = hasHighGrade() ? .55 : .22;
  $('passiveList').innerHTML = state.passives.map(s=>`<div class="passive"><b><span class="${s.gradeClass}">${s.name}</span><em class="grade ${s.gradeClass}">${s.gradeName}</em></b><p>${s.desc}</p></div>`).join('');
}
function titleByLevel(lv){ if(lv>=80)return '운명을 찢는 존재'; if(lv>=60)return '초월자'; if(lv>=40)return '군림자'; if(lv>=20)return '각성체'; if(lv>=10)return '성장체'; return '새싹 존재'; }
function hasHighGrade(){ return state.passives.some(s=>['legend','epic','god'].includes(s.grade)); }

function save(){ if(state) localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
function load(){
  const raw=localStorage.getItem(SAVE_KEY);
  if(!raw) return false;
  try{ state=JSON.parse(raw); $('createModal').classList.remove('active'); render(); startLoop(); log('저장 데이터를 불러왔습니다.'); return true; }catch(e){ return false; }
}
function startLoop(){ clearInterval(loop); loop=setInterval(hunt, Math.max(350,900-(calcStats().speedBonus*4))); }

$('createBtn').onclick=createCharacter;
$('newCharBtn').onclick=()=>{ if(confirm('새 캐릭터를 만들면 현재 저장 데이터가 삭제됩니다.')){ localStorage.removeItem(SAVE_KEY); location.reload(); } };
$('saveBtn').onclick=()=>{ save(); log('저장 완료.'); };
$('huntBtn').onclick=()=>{ state.auto=!state.auto; save(); render(); };
$('passiveBtn').onclick=()=>document.querySelector('.passive-panel').scrollIntoView({behavior:'smooth'});
$('exportBtn').onclick=()=>{ dataMode='export'; $('dataTitle').textContent='저장 데이터 내보내기'; $('dataBox').value=btoa(unescape(encodeURIComponent(JSON.stringify(state)))); $('dataApply').style.display='none'; $('dataModal').classList.add('active'); };
$('importBtn').onclick=()=>{ dataMode='import'; $('dataTitle').textContent='저장 데이터 가져오기'; $('dataBox').value=''; $('dataApply').style.display='inline-block'; $('dataModal').classList.add('active'); };
$('dataClose').onclick=()=>$('dataModal').classList.remove('active');
$('dataApply').onclick=()=>{ try{ state=JSON.parse(decodeURIComponent(escape(atob($('dataBox').value.trim())))); save(); $('dataModal').classList.remove('active'); render(); startLoop(); log('가져오기 완료.'); }catch(e){ alert('저장 데이터 형식이 올바르지 않습니다.'); } };

if(!load()) $('createModal').classList.add('active');
