// data.js (owner: ui) — read-only game data + tiny pure helpers. Pictures are Fluent 3D image names in img/<name>.webp.
export const RAINBOW = ['#ff4f64','#ff9330','#f5b800','#2fc27a','#3a86ff','#9a63ff','#ff5fae'];
export const PASTEL = ['#ff8fa3','#ffb36b','#ffe066','#7fe0a8','#7cb8ff','#b79bff','#ff9fd2'];
export const TAU = Math.PI * 2;

/* ================= words ================= */
// [english, picture, korean] — picture is an img/ name; colours use a hex instead (two hexes = metallic shine)
export const WORLDS = [
  { id:'unicorn', ko:'유니콘 공주 성', en:'Princess Castle', icon:'unicorn',
    tile:{face:'#ffe2f2', edge:'#ff9fd0', shade:'#e47db5'},
    words:[['fairy','fairy','요정'],['mermaid','mermaid','인어'],['prince','prince','왕자'],['dragon','dragon','용'],['swan','swan','백조'],
           ['diamond','diamond','다이아몬드'],['ribbon','ribbon','리본'],['bouquet','bouquet','꽃다발'],['carousel','carousel','회전목마'],['magic wand','magic-wand','요술봉']] },
  { id:'sweets', ko:'달콤 생일 파티', en:'Birthday Party', icon:'cake',
    tile:{face:'#fff0dc', edge:'#ffb98a', shade:'#e9966a'},
    words:[['candle','candle','촛불'],['present','present','선물'],['balloon','balloon','풍선'],['pancake','pancake','팬케이크'],['waffle','waffle','와플'],
           ['pudding','pudding','푸딩'],['honey','honey','꿀'],['popcorn','popcorn','팝콘'],['cherry','cherry','체리'],['watermelon','watermelon','수박']] },
  { id:'colors', ko:'알록달록 색깔', en:'Color Land', icon:'palette', color:true,
    tile:{face:'#fffbe6', edge:'#ffd23f', shade:'#b89cf5'},
    words:[['brown','#9a5f2e','갈색'],['black','#2a2733','검정'],['white','#ffffff','하양'],['gray','#9aa1ab','회색'],
           ['gold','#ffe9a0,#d29a00','금색'],['silver','#f7f8fa,#9ea6b2','은색'],['sky blue','#8fd3ff','하늘색'],['navy','#24387f','남색']] },
  { id:'cars', ko:'출동! 구조대', en:'Rescue Team', icon:'police-car',
    tile:{face:'#e2f3ff', edge:'#7cc0ff', shade:'#5a9fe3'},
    words:[['siren','siren','사이렌'],['traffic light','traffic-light','신호등'],['firefighter','firefighter','소방관'],['police officer','police-officer','경찰관'],
           ['fire extinguisher','fire-extinguisher','소화기'],['school bus','school-bus','스쿨버스'],['tractor','tractor','트랙터'],['motorcycle','motorcycle','오토바이'],
           ['rocket','rocket','로켓'],['sailboat','sailboat','돛단배']] },
  { id:'halloween', ko:'할로윈 파티', en:'Halloween Party', icon:'jack-o-lantern',
    tile:{face:'#3d2468', edge:'#ff9a3c', shade:'#c4661a', ink:'#fff1de', prog:'rgba(255,255,255,.16)'},
    words:[["jack-o'-lantern",'jack-o-lantern','호박 등불'],['vampire','vampire','뱀파이어'],['zombie','zombie','좀비'],['broom','broom','빗자루'],
           ['potion','potion','마법 물약'],['spider web','spider-web','거미줄'],['crystal ball','crystal-ball','수정 구슬'],['full moon','full-moon','보름달'],['skull','skull','해골']] },
];
export const byId = Object.fromEntries(WORLDS.map(W => [W.id, W]));
export const TOTAL = WORLDS.reduce((a, W) => a + W.words.length, 0);

export function wordOf(wid, i){
  const W = byId[wid], [en, pic, ko] = W.words[i], color = !!W.color;
  return { en, pic, ko, color, key: wid + ':' + en, img: color ? null : `img/${pic}.webp` };
}

export const GAMES_META = [
  { id:'worm', ko:'지렁이 냠냠', en:'Worm game', sub:'끌어서 먹어요', icon:'worm', face:'#e9fbef', edge:'#7fe0a8', shade:'#4fbf80' },
  { id:'jump', ko:'점프 점프', en:'Jump game', sub:'콕! 눌러 점프', icon:'unicorn', face:'#fff3dc', edge:'#ffc46b', shade:'#e69a3a' },
  { id:'balloon', ko:'풍선 팡팡', en:'Balloon game', sub:'콕! 터뜨려요', icon:'balloon', face:'#ffe6f3', edge:'#ff9fd0', shade:'#e47db5' },
];
export const PRAISE = ['Great job!', 'Yay!', 'You did it!', 'Wonderful!', 'Super!', 'Hooray!'];
const the = w => w.color ? `the ${w.en} one` : `the ${w.en}`;
export const PROMPTS = {
  worm:    { verb:'Go get', say: w => `Go get ${the(w)}!` },
  jump:    { verb:'Jump for', say: w => `Jump for ${the(w)}!` },
  balloon: { verb:'Pop', say: w => `Pop ${the(w)}!` },
};

/* ================= closet catalog ================= */
// [id, korean, english, price in stars]
export const SHOP = [
  { id:'dress', ko:'옷', icon:'dress', items:[['pink','분홍 드레스','pink dress',0],['candy','사탕 드레스','candy dress',6],['star','별빛 드레스','starry dress',10],
      ['pumpkin','호박 드레스','pumpkin dress',12],['fire','소방관 옷','firefighter suit',12],['rainbow','무지개 드레스','rainbow dress',15],
      ['mermaid','인어 드레스','mermaid dress',18],['gown','공주 드레스','princess gown',20]] },
  { id:'hat', ko:'머리 장식', icon:'crown', items:[['none','없음','nothing',0],['bow','리본','bow',0],['tiara','티아라','tiara',6],['flowers','꽃 왕관','flower crown',8],
      ['cat','고양이 귀','cat ears',8],['police','경찰 모자','police hat',10],['witch','마녀 모자','witch hat',12],['horn','유니콘 뿔','unicorn horn',15],['crown','왕관','crown',20]] },
  { id:'hair', ko:'머리색', icon:'haircut', items:[['brown','갈색 머리','brown hair',0],['black','검정 머리','black hair',0],['gold','금색 머리','blonde hair',4],
      ['pink','분홍 머리','pink hair',6],['purple','보라 머리','purple hair',6],['mint','민트 머리','mint hair',6],['rainbow','무지개 머리','rainbow hair',15]] },
  { id:'wings', ko:'날개', icon:'butterfly', items:[['none','없음','nothing',0],['fairy','요정 날개','fairy wings',10],['butterfly','나비 날개','butterfly wings',12],
      ['bat','박쥐 날개','bat wings',12],['angel','천사 날개','angel wings',15],['rainbow','무지개 날개','rainbow wings',25]] },
  { id:'hand', ko:'손에 들기', icon:'lollipop', items:[['none','없음','nothing',0],['lollipop','막대사탕','lollipop',5],['icecream','아이스크림','ice cream',5],
      ['balloon','풍선','balloon',8],['basket','호박 바구니','pumpkin basket',10],['wand','요술봉','magic wand',12]] },
  { id:'pet', ko:'친구', icon:'puppy', items:[['none','없음','nothing',0],['kitten','고양이','kitten',8],['puppy','강아지','puppy',8],['bunny','토끼','bunny',10],
      ['unicorn','유니콘','unicorn',20],['dragon','아기 용','baby dragon',25]] },
  { id:'bg', ko:'배경', icon:'castle', items:[['sky','무지개 하늘','rainbow sky',0],['candy','사탕 나라','candy land',10],['night','할로윈 밤','spooky night',12],
      ['castle','공주 성','castle',15],['sea','바닷속','under the sea',15]] },
];
export const PET_IMG = { kitten:'kitten', puppy:'puppy', bunny:'bunny', unicorn:'unicorn', dragon:'dragon' };
export const DEF_WEAR = { dress:'pink', hat:'bow', hair:'brown', wings:'none', hand:'none', pet:'none', bg:'sky' };

/* ================= tiny pure helpers ================= */
export const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const range = n => Array.from({ length:n }, (_, i) => i);
export const pickOne = a => a[Math.floor(Math.random() * a.length)];
export function josa(s){ // 을/를
  const c = s.charCodeAt(s.length - 1);
  if (c < 0xAC00 || c > 0xD7A3) return '를';
  return (c - 0xAC00) % 28 ? '을' : '를';
}
export function starD(cx, cy, R, r = R * .45){
  let d = '';
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r : R, a = i * Math.PI / 5 - Math.PI / 2; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1); }
  return d + 'Z';
}
