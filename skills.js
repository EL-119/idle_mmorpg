const GRADES = [
  { key:'normal', name:'일반', count:100, weight:720000, cls:'g-normal' },
  { key:'magic', name:'매직', count:80, weight:200000, cls:'g-magic' },
  { key:'rare', name:'레어', count:50, weight:65000, cls:'g-rare' },
  { key:'unique', name:'유니크', count:30, weight:12000, cls:'g-unique' },
  { key:'legend', name:'전설', count:10, weight:2500, cls:'g-legend' },
  { key:'epic', name:'에픽', count:5, weight:450, cls:'g-epic' },
  { key:'god', name:'신', count:2, weight:50, cls:'g-god' },
];

const PREFIX = {
  normal:['단단한','민첩한','끈질긴','예리한','작은','거친','튼튼한','빠른','차분한','야생의'],
  magic:['푸른','붉은','번뜩이는','저주받은','축복받은','달빛의','그림자의','은은한'],
  rare:['폭풍의','심연의','불멸의','광기의','서리의','맹독의','강철의'],
  unique:['왕성한','균열의','흡혈의','무한한','거인의','암흑의'],
  legend:['태초의','용살자의','마왕의','천공의','절대자의'],
  epic:['운명을 비트는','세계수의','별을 삼킨','시간을 접는','차원을 찢는'],
  god:['창조신의','종말신의']
};
const SUFFIX = ['피부','손놀림','심장','눈동자','야성','투지','재생력','행운','분노','집중','마력회로','생존본능','흡수력','전투감각','약점간파'];
const TYPES = ['power','crit','speed','autoStrike','expPulse','pierce','combo'];

function makeSkillPool(){
  const pool=[];
  GRADES.forEach(g=>{
    for(let i=1;i<=g.count;i++){
      const p=PREFIX[g.key][(i-1)%PREFIX[g.key].length];
      const s=SUFFIX[(i-1)%SUFFIX.length];
      const scale={normal:1,magic:1.6,rare:2.4,unique:3.6,legend:5.5,epic:8,god:13}[g.key];
      const statType=TYPES[(i-1)%TYPES.length];
      const value=Math.max(1,Math.round((2+(i%9))*scale));
      const interval=Math.max(2, Math.round(9 - Math.min(6, scale/1.6)));
      pool.push({
        id:`${g.key}_${i}`,
        name:`${p} ${s}`,
        grade:g.key,
        gradeName:g.name,
        gradeClass:g.cls,
        statType,
        value,
        interval,
        desc:describeSkill(statType,value,g.name,interval),
      });
    }
  });
  return pool;
}

function describeSkill(type,value,grade,interval){
  const map={
    power:`공격력이 ${value} 증가합니다. 중첩될수록 그대로 합산됩니다.`,
    crit:`치명타 확률이 ${Math.max(1,Math.floor(value/2))}% 증가합니다.`,
    speed:`공격속도가 빨라집니다. 중첩될수록 공격 간격이 더 짧아집니다.`,
    autoStrike:`${interval}초마다 몬스터에게 공격력 기반 추가 피해를 줍니다.`,
    expPulse:`${interval}초마다 추가 경험치를 획득합니다.`,
    pierce:`몬스터 방어력을 ${value}% 무시합니다.`,
    combo:`일반 공격 피해량이 ${value}% 증가합니다.`
  };
  return `${grade} 등급 패시브. ${map[type]}`;
}

const SKILL_POOL = makeSkillPool();
