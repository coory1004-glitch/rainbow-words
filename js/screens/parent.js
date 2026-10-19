// screens/parent.js (owner: ui) — grown-up corner behind a simple gate: progress, sound switches,
// backup code (copy / restore), and the only way to erase progress.
import { store } from '../state.js';
import { TOTAL, shuffle } from '../data.js';
import { gotTotal, exportCode, importCode, resetProgress } from '../storage.js';
import { sfx, setMusic, isMusicOn, setSfx, isSfxOn } from '../audio.js';
import { toast } from '../fx.js';
import { registerScreen, registerActions, go, render, app, homeButton } from '../router.js';

let unlocked = false, gate = null, resetAsk = false, msg = '';
function newGate(){
  const a = 3 + Math.floor(Math.random() * 6), b = 4 + Math.floor(Math.random() * 5), ans = a + b;
  return { a, b, ans, choices:shuffle([ans, ans + 1 + Math.floor(Math.random() * 2), ans - 1 - Math.floor(Math.random() * 2)]) };
}
const fmtDate = t => (t ? new Date(t).toLocaleDateString('ko-KR') : '-');

function gateHTML(){
  if (!gate) gate = newGate();
  return `<div class="panel">
      <h2>어른 확인</h2>
      <p>아이 대신 어른이 풀어 주세요. ${gate.a} + ${gate.b} = ?</p>
      <div class="gate">${gate.choices.map(n => `<button class="mini" data-act="gate-pick" data-n="${n}">${n}</button>`).join('')}</div>
    </div>`;
}

function panelsHTML(){
  const P = store.P;
  return `<div class="panel">
      <h2>모은 기록</h2>
      <div class="stats">
        <div>별<b>${P.stars}</b></div>
        <div>스티커<b>${gotTotal()} / ${TOTAL}</b></div>
        <div>옷장 아이템<b>${Object.keys(P.owned).length}</b></div>
        <div>끝낸 게임<b>${P.stats.games || 0}</b></div>
      </div>
      <p>처음 놀이: ${fmtDate(P.stats.firstPlayed)} · 최근 놀이: ${fmtDate(P.stats.lastPlayed)}</p>
      <p>기록은 이 기기의 브라우저에 자동으로 저장돼요. 다시 들어와도 그대로 남아 있어요.</p>
    </div>
    <div class="panel">
      <h2>소리</h2>
      <div class="toggles">
        <button class="mini${isMusicOn() ? ' on' : ''}" data-act="set-music">배경 음악 ${isMusicOn() ? '켜짐' : '꺼짐'}</button>
        <button class="mini${isSfxOn() ? ' on' : ''}" data-act="set-sfx">효과음 ${isSfxOn() ? '켜짐' : '꺼짐'}</button>
      </div>
    </div>
    <div class="panel">
      <h2>기록 옮기기 (백업 코드)</h2>
      <p>다른 기기나 브라우저로 옮길 때 이 코드를 복사해 두었다가 붙여 넣으세요.</p>
      <textarea readonly id="pCode">${exportCode()}</textarea>
      <div class="row"><button class="mini" data-act="export-copy">코드 복사</button></div>
      <textarea id="pImport" placeholder="여기에 백업 코드를 붙여 넣으세요"></textarea>
      <div class="row"><button class="mini" data-act="import-go">코드로 불러오기</button></div>
    </div>
    <div class="panel">
      <h2>기록 지우기</h2>
      ${resetAsk
        ? `<p>별, 스티커, 옷을 모두 지울까요? 되돌릴 수 없어요.</p><div class="row"><button class="mini danger" data-act="reset-yes">모두 지우기</button><button class="mini" data-act="reset-no">아니요</button></div>`
        : `<div class="row"><button class="mini" data-act="reset-ask">기록 지우기</button></div>`}
    </div>`;
}

function parentHTML(){
  return `<section class="screen parent">
    <header class="bar">
      ${homeButton()}
      <h1>어른 메뉴</h1>
      <span></span>
    </header>
    ${msg ? `<p class="msg note">${msg}</p>` : ''}
    ${unlocked ? panelsHTML() : gateHTML()}
  </section>`;
}

registerScreen('parent', { html:parentHTML });
registerActions({
  parent: () => { sfx.pop(); unlocked = false; gate = newGate(); resetAsk = false; msg = ''; go('parent'); },
  'gate-pick': el => {
    if (Number(el.dataset.n) === gate.ans) { unlocked = true; msg = ''; }
    else { gate = newGate(); msg = '다시 풀어 주세요.'; }
    render();
  },
  'set-music': () => { setMusic(!isMusicOn()); render({ keepScroll:true }); },
  'set-sfx': () => { setSfx(!isSfxOn()); render({ keepScroll:true }); },
  'export-copy': () => {
    const t = app.querySelector('#pCode'); if (!t) return;
    const done = () => toast('코드를 복사했어요.');
    try { navigator.clipboard.writeText(t.value).then(done, () => { t.select(); document.execCommand('copy'); done(); }); }
    catch (e) { t.select(); try { document.execCommand('copy'); done(); } catch (e2) {} }
  },
  'import-go': () => {
    const t = app.querySelector('#pImport'); if (!t) return;
    const r = importCode(t.value);
    msg = r.ok ? '기록을 불러왔어요.' : r.error;
    render({ keepScroll:true });
  },
  'reset-ask': () => { resetAsk = true; render({ keepScroll:true }); },
  'reset-no': () => { resetAsk = false; render({ keepScroll:true }); },
  'reset-yes': () => { resetProgress(); resetAsk = false; msg = '기록을 모두 지웠어요.'; render(); },
});
