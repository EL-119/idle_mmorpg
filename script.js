const field = document.getElementById('field');
const entitiesLayer = document.getElementById('entities');
const floatingLayer = document.getElementById('floating');
const $ = id => document.getElementById(id);

const state = {
  level: 1,
  exp: 0,
  gold: 0,
  kills: 0,
  power: 12,
  auto: true,
  target: null,
  hero: { x: 36, y: 58, hp: 88, maxHp: 100, attack: 12, skillCd: 0 },
  enemies: []
};

const enemyTypes = [
  { type:'slime', name:'푸른 슬라임', hp:42, exp:10, gold:4, atk:3 },
  { type:'wolf', name:'그늘 늑대', hp:62, exp:15, gold:7, atk:5 },
  { type:'imp', name:'하급 임프', hp:80, exp:22, gold:10, atk:7 },
  { type:'mush', name:'독버섯 마물', hp:55, exp:14, gold:6, atk:4 }
];

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function rnd(min,max){ return Math.random()*(max-min)+min; }

function makeHero(){
  const el = document.createElement('div');
  el.className = 'entity hero';
  el.innerHTML = '<div class="label">고블린 새끼 Lv.1</div><div class="life"><i></i></div><div class="sprite"><span class="eye"></span></div>';
  entitiesLayer.appendChild(el);
  state.hero.el = el;
  renderEntity(state.hero);
}

function spawnEnemy(){
  const base = enemyTypes[Math.floor(Math.random()*enemyTypes.length)];
  const e = {
    ...base,
    id: Math.random().toString(36).slice(2),
    x: rnd(12, 84),
    y: rnd(22, 76),
    hp: base.hp + state.level * 6,
    maxHp: base.hp + state.level * 6,
    alive: true,
    wanderT: 0
  };
  const el = document.createElement('div');
  el.className = `entity enemy ${e.type}`;
  el.innerHTML = `<div class="label">${e.name}</div><div class="life"><i></i></div><div class="sprite"></div>`;
  entitiesLayer.appendChild(el);
  e.el = el;
  state.enemies.push(e);
  renderEntity(e);
}

function ensureEnemies(){
  while(state.enemies.filter(e=>e.alive).length < 8) spawnEnemy();
}

function renderEntity(e){
  e.el.style.transform = `translate(${e.x}vw, ${e.y}%)`;
  const bar = e.el.querySelector('.life i');
  if(bar) bar.style.width = `${clamp((e.hp/e.maxHp)*100,0,100)}%`;
}

function chooseTarget(){
  const living = state.enemies.filter(e=>e.alive);
  if(!living.length) return null;
  living.sort((a,b)=>dist(state.hero,a)-dist(state.hero,b));
  return living[0];
}

function moveHeroToTarget(){
  if(!state.auto) return;
  if(!state.target || !state.target.alive) state.target = chooseTarget();
  const t = state.target;
  if(!t) return;
  const d = dist(state.hero,t);
  if(d > 8){
    const dx = (t.x - state.hero.x) / d;
    const dy = (t.y - state.hero.y) / d;
    state.hero.x = clamp(state.hero.x + dx*2.2, 6, 88);
    state.hero.y = clamp(state.hero.y + dy*2.2, 15, 83);
    renderEntity(state.hero);
  }
}

function wanderEnemies(){
  state.enemies.forEach(e=>{
    if(!e.alive) return;
    e.wanderT--;
    if(e.wanderT <= 0){
      e.wanderT = Math.floor(rnd(8,22));
      e.tx = clamp(e.x + rnd(-8,8), 8, 88);
      e.ty = clamp(e.y + rnd(-7,7), 16, 82);
    }
    if(e.tx){
      e.x += (e.tx-e.x)*0.04;
      e.y += (e.ty-e.y)*0.04;
      renderEntity(e);
    }
  });
}

function attack(){
  if(!state.auto) return;
  const t = state.target || chooseTarget();
  if(!t || !t.alive) return;
  if(dist(state.hero,t) <= 9){
    const dmg = Math.floor(state.hero.attack + state.level*3 + rnd(0,6));
    damageEnemy(t,dmg,false);
    log(`${t.name}에게 ${dmg} 피해를 입혔습니다.`);
  }
}

function damageEnemy(e,dmg,poison){
  e.hp -= dmg;
  fx(e.x, e.y, dmg, poison);
  if(e.hp <= 0){
    e.alive = false;
    e.el.classList.add('dead');
    state.kills++;
    state.exp += e.exp;
    state.gold += e.gold;
    setTimeout(()=> e.el.remove(), 300);
    state.enemies = state.enemies.filter(x=>x!==e);
    state.target = null;
    gainCheck();
    updateUI();
    setTimeout(ensureEnemies, 600);
  } else {
    renderEntity(e);
  }
}

function gainCheck(){
  while(state.exp >= 100){
    state.exp -= 100;
    state.level++;
    state.power += 5;
    state.hero.attack += 3;
    $('heroRank').textContent = `Lv. ${state.level} · 최하급 마물`;
    document.querySelector('.hero .label').textContent = `고블린 새끼 Lv.${state.level}`;
    log('레벨 업! 몸속 마력핵이 커졌습니다.');
  }
}

function fx(x,y,dmg,poison){
  const hit = document.createElement('div');
  hit.className = poison ? 'poisonFx' : 'hitFx';
  hit.style.left = `calc(${x}vw + 14px)`;
  hit.style.top = `calc(${y}% + 10px)`;
  field.appendChild(hit);
  setTimeout(()=>hit.remove(), 700);

  const f = document.createElement('div');
  f.className = 'float';
  f.textContent = `-${dmg}`;
  f.style.left = `calc(${x}vw + 8px)`;
  f.style.top = `calc(${y}% - 8px)`;
  floatingLayer.appendChild(f);
  setTimeout(()=>f.remove(), 800);
}

function updateUI(){
  $('killText').textContent = state.kills;
  $('stoneText').textContent = state.gold;
  $('goldText').textContent = state.gold;
  $('levelText').textContent = state.level;
  $('powerText').textContent = state.power;
  $('expText').textContent = `${state.exp} / 100`;
  if(state.kills >= 20 && state.gold >= 80){
    $('evolveBtn').innerHTML = '진화 가능<br><small>고블린 전사</small>';
    $('evolveBtn').classList.add('ready');
  }
}

function log(text){ $('log').textContent = text; }

function pressFeedback(btn){
  btn.classList.add('pressed');
  setTimeout(()=>btn.classList.remove('pressed'), 160);
}

document.querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click',()=>pressFeedback(btn));
});

$('autoBtn').onclick = () => {
  state.auto = !state.auto;
  $('autoBtn').innerHTML = state.auto ? 'AUTO<br><small>자동사냥</small>' : 'STOP<br><small>정지</small>';
  log(state.auto ? '자동사냥을 다시 시작합니다.' : '자동사냥을 멈췄습니다.');
};

$('skillBtn').onclick = () => {
  const t = state.target || chooseTarget();
  if(!t){ log('스킬을 사용할 대상이 없습니다.'); return; }
  state.target = t;
  const dmg = Math.floor(32 + state.level*6);
  damageEnemy(t, dmg, true);
  log(`독침 발동! ${t.name}에게 강한 독 피해를 줬습니다.`);
  updateUI();
};

$('evolveBtn').onclick = () => {
  if(state.kills < 20 || state.gold < 80){
    log('아직 진화 조건이 부족합니다. 마물 20마리와 마력석 80개가 필요합니다.');
    return;
  }
  $('heroName').textContent = '고블린 전사';
  $('heroRank').textContent = `Lv. ${state.level} · 1차 진화 마물`;
  document.querySelector('.hero .label').textContent = `고블린 전사 Lv.${state.level}`;
  document.querySelector('.hero .sprite').style.background = '#8fc95c';
  document.querySelector('.hero .sprite').style.boxShadow = '0 0 18px #b6ff77, 0 9px 2px #0006';
  state.power += 50;
  state.hero.attack += 15;
  $('evolveBtn').classList.remove('ready');
  $('evolveBtn').innerHTML = '진화 완료<br><small>전사 각성</small>';
  log('진화 성공! 고블린 전사가 되었습니다. 새 오라가 피어납니다.');
  updateUI();
};

$('bagBtn').onclick = () => { $('bagPanel').style.display = 'block'; log('가방을 열었습니다. 장비 시스템은 다음 단계에서 확장합니다.'); };
$('skillPageBtn').onclick = () => { $('skillPanel').style.display = 'block'; log('스킬 정보를 확인합니다.'); };
document.querySelectorAll('.closePanel').forEach(btn=>btn.onclick=()=>btn.parentElement.style.display='none');

$('moveBtn').onclick = () => {
  state.hero.x = clamp(state.hero.x + rnd(-12,12), 8, 86);
  state.hero.y = clamp(state.hero.y + rnd(-10,10), 16, 82);
  renderEntity(state.hero);
  log('수동 이동: 고블린이 주변을 살핍니다.');
};

$('saveBtn').onclick = () => {
  localStorage.setItem('magye_jinhwarok_v2', JSON.stringify({
    level:state.level, exp:state.exp, gold:state.gold, kills:state.kills, power:state.power
  }));
  log('현재 진행 상황을 브라우저에 저장했습니다.');
};

function load(){
  try{
    const saved = JSON.parse(localStorage.getItem('magye_jinhwarok_v2') || 'null');
    if(saved){
      Object.assign(state, saved);
      state.hero.attack = 12 + state.level*3;
      log('저장된 진행 상황을 불러왔습니다.');
    }
  }catch(e){}
}

load();
makeHero();
ensureEnemies();
updateUI();
setInterval(moveHeroToTarget, 260);
setInterval(wanderEnemies, 120);
setInterval(attack, 900);
