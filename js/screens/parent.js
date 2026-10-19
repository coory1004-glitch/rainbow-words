// screens/parent.js (owner: ui) — grown-up corner behind an easy-sum gate: progress, music/sound switches,
// backup code (copy / restore), where progress is kept, and the only way to erase progress (two-step confirm).
import { store } from '../state.js';
import { TOTAL, shuffle } from '../data.js';
import { gotTotal, exportCode, importCode, resetProgress } from '../storage.js';
import { sfx, setMusic, isMusicOn, setSfx, isSfxOn, musicScene } from '../audio.js';
import { iconHTML } from '../images.js';
import { toast, shake } from '../fx.js';
import { registerScreen, registerActions, go, render, app, homeButton, ICON } from '../router.js';

let unlocked = false, gate = null, resetStep = 0, msg = null;   // msg = { ok:bool, text }
function newGate(){
  const a = 3 + Math.floor(Math.random() * 6), b = 4 + Math.floor(Math.random() * 5), ans = a + b;
  const wrong = new Set();
  while (wrong.size < 2) { const d = (1 + Math.floor(Math.random() * 3)) * (Math.random() < .5 ? -1 : 1); if (ans + d > 0) wrong.add(ans + d); }
  return { a, b, ans, choices:shuffle([ans, ...wrong]) };
}
const fmtDate = t => (t ? new Date(t).toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric' }) : '-');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

function gateHTML(){
  if (!gate) gate = newGate();
  return `<div class="gate-card card-soft">
      <span class="plate gate-plate">${iconHTML('lock')}</span>
      <h2>어른 확인</h2>
      <p>아이 대신 어른이 문제를 풀어 주세요.</p>
      <p class="gate-q" aria-label="${gate.a} 더하기 ${gate.b}는?">${gate.a} + ${gate.b} = ?</p>
      <div class="gate-choices">${gate.choices.map(n => `<button class="gate-btn toy" data-act="gate-pick" data-n="${n}">${n}</button>`).join('')}</div>
    </div>`;
}

const sw = (act, on, label, icon) => `<button class="switch-row" data-act="${act}" role="switch" aria-checked="${on}">
    ${iconHTML(icon)}<span class="sw-l">${label}</span><span class="sw${on ? ' on' : ''}" aria-hidden="true"><i></i></span></button>`;

function panelsHTML(){
  const P = store.P;
  const stat = (icon, label, val) => `<div class="stat">${iconHTML(icon)}<span>${label}</span><b>${val}</b></div>`;
  return `<section class="panel card-soft">
      <h2>모은 기록</h2>
      <div class="stats">
        ${stat('star', '별', P.stars)}
        ${stat('notebook', '스티커', `${gotTotal()}<small>/${TOTAL}</small>`)}
        ${stat('dress', '옷장', Object.keys(P.owned).length)}
        ${stat('trophy', '끝낸 게임', P.stats.games || 0)}
      </div>
      <p class="dates">처음 놀이 ${fmtDate(P.stats.firstPlayed)} · 최근 놀이 ${fmtDate(P.stats.lastPlayed)}</p>
    </section>
    <section class="panel card-soft">
      <h2>소리</h2>
      <div class="switches">
        ${sw('set-music', isMusicOn(), '배경 음악', isMusicOn() ? 'music' : 'muted')}
        ${sw('set-sfx', isSfxOn(), '효과음', 'speaker')}
      </div>
      <p>영어 음성은 미국식 발음으로 미리 녹음해 두었어요. 기기 소리를 켜 주세요.</p>
    </section>
    <section class="panel card-soft">
      <h2>기록은 어디에 저장되나요?</h2>
      <ul class="info">
        <li>별, 스티커, 옷은 <b>이 기기의 이 브라우저</b>에 자동으로 저장돼요. 창을 닫았다 다시 와도 그대로예요.</li>
        <li>iPhone·iPad에서는 <b>홈 화면에 추가한 앱</b>과 <b>Safari</b>가 기록을 따로 보관해요. 늘 같은 곳에서 열어 주세요.</li>
        <li>기기나 브라우저를 바꿀 때는 아래 <b>백업 코드</b>를 복사해 두었다가 새 곳에서 붙여 넣으세요.</li>
      </ul>
    </section>
    <section class="panel card-soft">
      <h2>백업 코드</h2>
      <p>이 코드에 지금까지의 별, 스티커, 옷이 모두 들어 있어요.</p>
      <textarea readonly id="pCode" class="code" spellcheck="false" aria-label="백업 코드">${esc(exportCode())}</textarea>
      <div class="row left"><button class="btn toy lilac sm-btn" data-act="export-copy"><span class="btn-svg">${ICON.copy}</span>코드 복사</button></div>
    </section>
    <section class="panel card-soft">
      <h2>백업 코드로 불러오기</h2>
      <p>다른 기기에서 복사한 코드를 붙여 넣으면 그 기록으로 바뀌어요.</p>
      <textarea id="pImport" class="code" spellcheck="false" placeholder="RW1-로 시작하는 코드를 여기에 붙여 넣으세요" aria-label="불러올 백업 코드"></textarea>
      <div class="row left"><button class="btn toy sm-btn" data-act="import-go">불러오기</button></div>
    </section>
    <section class="panel card-soft danger-zone">
      <h2>기록 지우기</h2>
      ${resetStep === 0 ? `<p>별, 스티커, 옷을 모두 처음 상태로 되돌려요.</p><div class="row left"><button class="mini" data-act="reset-ask">기록 지우기…</button></div>`
        : resetStep === 1 ? `<p class="warn">정말 지울까요? 지운 기록은 되돌릴 수 없어요. 먼저 백업 코드를 복사해 두면 안전해요.</p>
          <div class="row left"><button class="mini" data-act="reset-no">아니요, 그대로 둘래요</button><button class="mini warnbtn" data-act="reset-next">네, 지울게요</button></div>`
        : `<p class="warn">마지막 확인이에요. 별 ${P.stars}개, 스티커 ${gotTotal()}개가 모두 사라져요.</p>
          <div class="row left"><button class="mini" data-act="reset-no">취소</button><button class="mini danger" data-act="reset-yes">모두 지우기</button></div>`}
    </section>`;
}

function parentHTML(){
  return `<section class="screen parent">
    <header class="bar">
      ${homeButton()}
      <h1>어른 메뉴</h1>
      <span class="bar-space"></span>
    </header>
    ${msg ? `<p class="msg${msg.ok ? ' ok' : ''}" role="status">${msg.text}</p>` : ''}
    ${unlocked ? panelsHTML() : gateHTML()}
  </section>`;
}

registerScreen('parent', { html:parentHTML });
registerActions({
  parent: () => { sfx.pop(); unlocked = false; gate = newGate(); resetStep = 0; msg = null; go('parent'); },
  'gate-pick': el => {
    if (Number(el.dataset.n) === gate.ans) { unlocked = true; msg = null; sfx.pop(); render(); return; }
    sfx.boop(); shake(app.querySelector('.gate-card'));
    gate = newGate(); msg = { ok:false, text:'앗, 다시 풀어 주세요.' };
    setTimeout(() => { if (store.S.screen === 'parent' && !unlocked) render({ keepScroll:true }); }, 420);
  },
  'set-music': () => { setMusic(!isMusicOn()); try { musicScene('menu'); } catch (e) {} render({ keepScroll:true }); },
  'set-sfx': () => { setSfx(!isSfxOn()); sfx.pop(); render({ keepScroll:true }); },
  'export-copy': () => {
    const t = app.querySelector('#pCode'); if (!t) return;
    const done = () => toast('백업 코드를 복사했어요.');
    const fallback = () => { t.focus(); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('코드를 길게 눌러 복사해 주세요.'); } };
    try { navigator.clipboard.writeText(t.value).then(done, fallback); } catch (e) { fallback(); }
  },
  'import-go': () => {
    const t = app.querySelector('#pImport'); if (!t) return;
    if (!t.value.trim()) { msg = { ok:false, text:'먼저 백업 코드를 붙여 넣어 주세요.' }; render({ keepScroll:true }); return; }
    const r = importCode(t.value);
    msg = r.ok ? { ok:true, text:'기록을 불러왔어요.' } : { ok:false, text:r.error };
    render();
  },
  'reset-ask': () => { resetStep = 1; render({ keepScroll:true }); },
  'reset-next': () => { resetStep = 2; render({ keepScroll:true }); },
  'reset-no': () => { resetStep = 0; render({ keepScroll:true }); },
  'reset-yes': () => { resetProgress(); resetStep = 0; msg = { ok:true, text:'기록을 모두 지웠어요.' }; render(); },
});
