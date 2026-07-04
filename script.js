const ranks = [
  { title: '떠돌이 주민', cls: 'resident', needLv: 5, needGold: 300 },
  { title: '초급 병사', cls: 'soldier', needLv: 12, needGold: 1500 },
  { title: '무림 장수', cls: 'captain', needLv: 25, needGold: 7000 },
  { title: '강호 장군', cls: 'general', needLv: 45, needGold: 25000 },
  { title: '무림의 왕', cls: 'king', needLv: 70, needGold: 90000 },
  { title: '천하 황제', cls: 'emperor', needLv: 99, needGold: 300000 }
];
const monsters = ['혈교 잡병', '독안귀', '흑풍 자객', '마교 호위', '혈교 장로'];
let state = JSON.parse(localStorage.getItem('murimIdleSave') || 'null') || { level:1, exp:0, gold:0, weapon:0, rank:0, stage:1, heroHp:40, monsterHp:80, last:Date.now() };
const $ = id => document.getElementById(id);
function maxExp(){return 80 + state.level * 20}
function power(){return 10 + state.level * 3 + state.weapon * 9 + state.rank * 35}
function maxHeroHp(){return 40 + state.level * 8 + state.rank * 45}
function maxMonsterHp(){return 65 + state.stage * 18 + state.rank * 35}
function save(){state.last=Date.now();localStorage.setItem('murimIdleSave', JSON.stringify(state))}
function render(){
  const r = ranks[state.rank];
  $('rankText').textContent = r.title;
  $('levelText').textContent = `Lv.${state.level}`;
  $('powerText').textContent = power().toLocaleString();
  $('expText').textContent = `${Math.floor(state.exp)} / ${maxExp()}`;
  $('goldText').textContent = Math.floor(state.gold).toLocaleString();
  $('weaponText').textContent = `+${state.weapon}`;
  $('stageText').textContent = `${state.stage}관문`;
  $('monsterName').textContent = monsters[state.stage % monsters.length];
  $('heroHpBar').style.width = `${Math.max(0,state.heroHp / maxHeroHp() * 100)}%`;
  $('monsterHpBar').style.width = `${Math.max(0,state.monsterHp / maxMonsterHp() * 100)}%`;
  $('hero').className = `sprite hero ${r.cls}`;
}
function log(t){$('battleLog').textContent = t}
function hit(){
  const dmg = Math.round(power() * (0.75 + Math.random()*0.5));
  state.monsterHp -= dmg;
  $('damagePop').textContent = `-${dmg}`;
  $('damagePop').classList.remove('show'); $('slash').classList.remove('show');
  void $('damagePop').offsetWidth;
  $('damagePop').classList.add('show'); $('slash').classList.add('show');
  if(state.monsterHp <= 0){
    const rewardGold = 25 + state.stage * 12 + state.rank * 80;
    const rewardExp = 28 + state.stage * 7;
    state.gold += rewardGold; state.exp += rewardExp; state.stage += 1; state.monsterHp = maxMonsterHp();
    log(`${monsters[state.stage % monsters.length]} 처치. 금화 ${rewardGold} 획득.`);
    while(state.exp >= maxExp()){ state.exp -= maxExp(); state.level += 1; state.heroHp = maxHeroHp(); log(`레벨 상승. Lv.${state.level}`); }
  } else {
    state.heroHp -= Math.max(1, Math.round(state.stage * 1.2));
    if(state.heroHp <= 0){ state.heroHp = maxHeroHp(); log('운기조식 후 전투 복귀.'); }
  }
  render(); save();
}
function upgrade(){ const cost = 120 + state.weapon * state.weapon * 65; if(state.gold < cost){log(`무기 강화에는 ${cost}G가 필요합니다.`); return} state.gold -= cost; state.weapon++; log(`무기 강화 성공. 현재 +${state.weapon}`); render(); save(); }
function evolve(){ const next = ranks[state.rank+1]; if(!next){log('이미 천하 황제입니다.'); return} if(state.level < ranks[state.rank].needLv || state.gold < ranks[state.rank].needGold){log(`승급 조건: Lv.${ranks[state.rank].needLv} / ${ranks[state.rank].needGold}G`); return} state.gold -= ranks[state.rank].needGold; state.rank++; state.heroHp=maxHeroHp(); log(`${ranks[state.rank].title}로 승급했습니다.`); render(); save(); }
function boss(){ const gain = Math.round(power()*2.5); state.gold += gain; state.exp += 50; log(`보스에게 큰 피해를 주고 ${gain}G 획득.`); render(); save(); }
function reward(){ const reward = 500 + state.level*30 + state.stage*12; state.gold += reward; log(`접속 보상 ${reward}G를 받았습니다.`); render(); save(); }
$('saveBtn').onclick=()=>{save();log('저장 완료.');}; $('upgradeBtn').onclick=upgrade; $('evolveBtn').onclick=evolve; $('bossBtn').onclick=boss; $('rewardBtn').onclick=reward;
const offline = Math.min(7200, Math.floor((Date.now()-state.last)/1000)); if(offline>60){ const g = Math.floor(offline*(1+state.stage*.25)); state.gold += g; log(`오프라인 보상 ${g}G 획득.`); }
state.heroHp = state.heroHp || maxHeroHp(); state.monsterHp = state.monsterHp || maxMonsterHp(); render(); setInterval(hit, 1100);
