// main.js (owner: ui) — boot: load saved progress, register screens and games, first render.
import { load, onRestored, requestPersist } from './storage.js';
import { preload } from './audio.js';
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

load();
onRestored(() => render({ keepScroll:true }));
// ask the browser to keep our storage (after a real tap, which some browsers require)
document.addEventListener('pointerdown', requestPersist, { capture:true, passive:true });
preload(['common']);
render();
