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
const SUFFIX_BY_TYPE = {
  power:['완력','검격','힘줄','분노','투지','타격감각','파괴본능','근력회로'],
  crit:['약점간파','눈동자','급소감각','예리함','집중','사냥감각','명중본능'],
  critDamage:['처형술','급소폭발','치명일격','마무리감각','분쇄본능','일점파괴'],
  speed:['손놀림','발놀림','반사신경','광속본능','질주회로','전투리듬'],
  autoStrike:['마력탄','그림자검','번개구슬','불꽃낙인','서리파편','암흑침'],
  expPulse:['흡수력','성장심장','학습본능','경험회로','진화감각','기록흡수'],
  pierce:['관통력','방어분쇄','갑옷파괴','약점절개','장갑분석','파쇄본능'],
  combo:['연격술','광분연타','전투흐름','연속본능','폭주리듬','누적타격'],
  flatExp:['수련일지','성장의 씨앗','전투기록','경험저장소','각성노트'],
  execute:['처형본능','마무리손길','끝장감각','절명표식','사냥종결자'],
  overdrive:['과부하','전투가열','분노축적','열혈회로','광전사본능']
};

const AUTO_STRIKE_QUOTA = { normal:0, magic:20, rare:12, unique:7, legend:3, epic:2, god:1 };
const GRADE_SCALE = { normal:1, magic:2.4, rare:5, unique:10, legend:22, epic:48, god:120 };
const GRADE_AUTO_SCALE = { normal:0, magic:1.6, rare:3.5, unique:8, legend:20, epic:45, god:140 };
const TYPES = ['power','crit','critDamage','speed','pierce','combo','flatExp','execute','overdrive','expPulse'];

function makeSkillPool(){
  const pool=[];
  GRADES.forEach(g=>{
    const autoQuota=AUTO_STRIKE_QUOTA[g.key] || 0;
    const scale=GRADE_SCALE[g.key] || 1;
    const autoScale=GRADE_AUTO_SCALE[g.key] || scale;
    for(let i=1;i<=g.count;i++){
      const p=PREFIX[g.key][(i-1)%PREFIX[g.key].length];
      const statType = i <= autoQuota ? 'autoStrike' : TYPES[(i-autoQuota-1)%TYPES.length];
      const suffixes=SUFFIX_BY_TYPE[statType] || ['전투감각'];
      const s=suffixes[(i-1)%suffixes.length];
      const rawBase = statType === 'autoStrike'
        ? (8 + i*3) * autoScale
        : (4 + i*1.7 + ((i%7)*3)) * scale;
      let value=Math.max(1,Math.round(rawBase));
      if(statType==='crit') value=Math.max(1,Math.round(rawBase/2));
      if(statType==='speed') value=Math.max(1,Math.round(rawBase/3));
      if(statType==='pierce') value=Math.max(1,Math.round(rawBase/4));
      const interval=Math.max(1.2, +(6.5 - Math.min(4.8, Math.log2(scale+1)) + ((i%3)*0.25)).toFixed(1));
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
    critDamage:`치명타 데미지가 ${Math.max(2,Math.floor(value*1.4))}% 증가합니다.`,
    speed:`공격속도가 빨라집니다. 중첩될수록 공격 간격이 더 짧아집니다.`,
    autoStrike:`${interval}초마다 스킬명으로 발동하며 공격력 기반 추가 피해를 줍니다. 기본 계수 ${value}%가 적용됩니다.`,
    expPulse:`${interval}초마다 추가 경험치를 획득합니다. 고등급일수록 획득량 격차가 크게 벌어집니다.`,
    pierce:`몬스터 방어력을 ${value}% 무시합니다.`,
    combo:`일반 공격 피해량이 ${value}% 증가합니다.`,
    flatExp:`공격할 때마다 추가 경험치를 ${value} 획득합니다.`,
    execute:`남은 HP가 낮은 몬스터에게 추가 피해가 ${value}% 증가합니다.`,
    overdrive:`공격할수록 전투 가열 보정이 누적되어 피해량이 ${Math.max(1,Math.floor(value/2))}% 증가합니다.`
  };
  return `${grade} 등급 패시브. ${map[type]}`;
}

const SKILL_POOL = makeSkillPool();
