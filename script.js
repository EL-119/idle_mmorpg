const ranks = [
  { name: '주민', title: '떠돌이 주민', mark: '民', reqLv: 1, reqGold: 0, power: 10 },
  { name: '병사', title: '신입 병사', mark: '兵', reqLv: 5, reqGold: 300, power: 26 },
  { name: '장수', title: '전장의 장수', mark: '將', reqLv: 12, reqGold: 1800, power: 70 },
  { name: '장군', title: '왕국의 장군', mark: '軍', reqLv: 22, reqGold: 7600, power: 180 },
  { name: '왕', title: '통일의 왕', mark: '王', reqLv: 36, reqGold: 22000, power: 420 },
  { name: '황제', title: '태양의 황제', mark: '帝', reqLv: 55, reqGold: 70000, power: 1000 }
];
const monsters = ['들판 슬라임','고블린 정찰병','암흑 늑대','해골 기사','화염 골렘','마왕의 파수꾼'];
const state = JSON.parse(localStorage.getItem('emperorRoadV2') || 'null') || { level:1, exp:0, gold:0, weapon:0, rank:0, stage:1, monsterHp:40, monsterMaxHp:40, last:Date.now() };
const $ = id => document.getElementById(id);
function expNeed(){return 100 + (state.level-1)*38}
function power(){return ranks[state.rank].power + state.level*4 + state.weapon*18}
function monsterMax(){return 35 + state.stage*18 + state.rank*60}
function save(){state.last=Date.now();localStorage.setItem('emperorRoadV2',JSON.stringify(state));toast('저장되었습니다')}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1400)}
function render(){
 const rank=ranks[state.rank];
 $('heroName').textContent=rank.title; $('heroRank').textContent=rank.name; $('heroPortrait').textContent=rank.mark;
 $('levelText').textContent=state.level; $('goldText').textContent=Math.floor(state.gold).toLocaleString(); $('powerText').textContent=power().toLocaleString(); $('weaponText').textContent='+'+state.weapon;
 $('stageText').textContent=state.stage; $('expText').textContent=`${Math.floor(state.exp)} / ${expNeed()}`; $('expBar').style.width=Math.min(100,state.exp/expNeed()*100)+'%';
 const mi=Math.min(monsters.length-1,Math.floor((state.stage-1)/5)); $('monsterName').textContent=monsters[mi];
 $('monsterHpText').textContent=`HP ${Math.max(0,Math.floor(state.monsterHp))} / ${state.monsterMaxHp}`; $('monsterHpBar').style.width=Math.max(0,state.monsterHp/state.monsterMaxHp*100)+'%';
 $('evolutionLine').innerHTML=ranks.map((r,i)=>`<span class="evo ${i===state.rank?'active':''}">${r.name}</span>`).join('');
}
function levelUp(){while(state.exp>=expNeed()){state.exp-=expNeed();state.level++;toast('레벨 업!')}}
function newMonster(){state.monsterMaxHp=monsterMax();state.monsterHp=state.monsterMaxHp;state.stage++}
function hit(){
 const dmg=Math.max(3,Math.floor(power()*(0.65+Math.random()*0.35))); state.monsterHp-=dmg; state.exp+=8+state.stage*2; state.gold+=8+state.stage*5;
 $('damagePop').textContent='-'+dmg; $('damagePop').classList.remove('active'); $('slashEffect').classList.remove('active'); void $('damagePop').offsetWidth; $('damagePop').classList.add('active'); $('slashEffect').classList.add('active');
 if(state.monsterHp<=0){state.exp+=28+state.stage*4;state.gold+=35+state.stage*14;newMonster();toast('몬스터 처치!')}
 levelUp(); render(); localStorage.setItem('emperorRoadV2',JSON.stringify(state));
}
function rankUp(){const next=ranks[state.rank+1]; if(!next){toast('최고 단계입니다');return} if(state.level>=next.reqLv&&state.gold>=next.reqGold){state.gold-=next.reqGold;state.rank++;toast(`${next.name} 승급 성공`);render();save()} else toast(`조건 부족: Lv.${next.reqLv} / ${next.reqGold}G`)}
function upgrade(){const cost=120+state.weapon*95; if(state.gold<cost){toast(`강화 비용 ${cost}G 필요`);return} state.gold-=cost; state.weapon++; toast('무기 강화 성공'); render(); save()}
function boss(){const reward=state.stage*180; if(power()>state.stage*38){state.gold+=reward;state.exp+=reward/3;state.stage+=2;newMonster();toast('보스 승리')} else toast('전투력이 부족합니다'); levelUp();render();save()}
function reward(){const gain=500+state.level*60+state.stage*35;state.gold+=gain;toast(`${gain}G 획득`);render();save()}
$('saveBtn').onclick=save; $('rankUpBtn').onclick=rankUp; $('upgradeBtn').onclick=upgrade; $('bossBtn').onclick=boss; $('rewardBtn').onclick=reward;
if(!state.monsterMaxHp) {state.monsterMaxHp=monsterMax(); state.monsterHp=state.monsterMaxHp}
const offline=Math.min(3600,Math.floor((Date.now()-state.last)/1000)); if(offline>30){const g=offline*(2+state.stage);state.gold+=g;toast(`오프라인 보상 ${Math.floor(g)}G`)}
render(); setInterval(hit,1350);
