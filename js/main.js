// main.js (owner: ui) — boot: load saved progress, register screens and games, first render.
import { store } from './state.js';
import { load, onRestored, requestPersist } from './storage.js';
import { preload } from './audio.js';
import { preloadImages } from './images.js';
import { render } from './router.js';

// screens and games register themselves on import
import './screens/home.js';
import './screens/pick.js';
import './screens/intro.js';
import './screens/play.js';
import './screens/result.js';
import './screens/closet.js';
import './screens/book.js';
import './screens/parent.js';
import './games/worm.js';
import './games/jump.js';
import './games/balloon.js';

// saved stars, stickers and outfits come back before anything is drawn
load();

// a newer copy came back from the IndexedDB mirror: redraw, but never restart a running game
let pendingRedraw = false;
onRestored(() => {
  if (store.S.screen === 'play') { pendingRedraw = true; return; }
  render({ keepScroll:true });
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && pendingRedraw && store.S.screen !== 'play') { pendingRedraw = false; render({ keepScroll:true }); }
});

// ask the browser to keep our storage, after a real tap (some browsers require a gesture)
const askPersist = () => { try { requestPersist(); } catch (e) {} };
document.addEventListener('pointerdown', askPersist, { capture:true, passive:true, once:true });
document.addEventListener('keydown', askPersist, { capture:true, once:true });

// common voice lines + the pictures every visit shows
preload(['common']);
preloadImages(['star', 'notebook', 'worm', 'unicorn', 'balloon', 'dress', 'rainbow', 'music', 'muted', 'sparkles']);

render();
