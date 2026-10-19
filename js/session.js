// session.js (owner: ui) — one play session: 5 words from a world (new words first), intro, game, result.
import { store } from './state.js';
import { WORLDS, byId, wordOf, shuffle } from './data.js';
import { sfx, say, loadSprite } from './audio.js';
import { save } from './storage.js';
import { go } from './router.js';

export function buildSession(wid, game){
  const P = store.P;
  const pool = wid === 'mix' ? WORLDS.flatMap(W => W.words.map((_, i) => ({ w:W.id, i }))) : byId[wid].words.map((_, i) => ({ w:wid, i }));
  const isGot = p => P.got[wordOf(p.w, p.i).key];
  const words = shuffle(pool.filter(p => !isGot(p))).concat(shuffle(pool.filter(isGot))).slice(0, 5);
  return { id:Date.now(), world:wid, game, words, intro:0, stars:0, bonus:0, newStickers:[] };
}

// word of session index k
export const sw = k => { const p = store.S.ses.words[k]; return wordOf(p.w, p.i); };

export function startSession(wid){
  const S = store.S, P = store.P;
  sfx.pop();
  say(wid === 'mix' ? 'Mix it up!' : byId[wid].en + '!'); // first speech runs inside the tap, which unlocks voice on phones
  S.ses = buildSession(wid, S.game);
  S.ses.words.forEach(p => loadSprite(p.w));
  const now = Date.now();
  if (!P.stats.firstPlayed) P.stats.firstPlayed = now;
  P.stats.lastPlayed = now;
  save();
  go('intro');
}
