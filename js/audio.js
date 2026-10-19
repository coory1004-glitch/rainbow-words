// audio.js (owner: core) — pre-recorded American English voice clips (audio/<sprite>.mp3 + js/voice-index.js),
// synthesized sound effects, and the music/sfx switches.
import { VO } from './voice-index.js';
import { store } from './state.js';
import { save } from './storage.js';

export const vkey = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------- shared AudioContext ---------- */
let ac = null;
export function audio(){
  if (!ac) {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    try { ac = new C({ sampleRate:24000 }); } catch (e) { try { ac = new C(); } catch (e2) { return null; } }
  }
  if (ac.state === 'suspended') { const pr = ac.resume(); if (pr && pr.catch) pr.catch(() => {}); }
  return ac;
}
// iPhone/iPad: let game sound play even when the ring switch is on silent
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
document.addEventListener('pointerdown', () => audio(), { capture:true });

/* ---------- voice sprites ---------- */
const spriteBytes = {}, spriteBufs = {};
function fetchSprite(name){
  if (!spriteBytes[name]) spriteBytes[name] = fetch(`audio/${name}.mp3`)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .catch(() => { spriteBytes[name] = null; return null; });
  return spriteBytes[name];
}
export function loadSprite(name){
  if (!spriteBufs[name]) spriteBufs[name] = fetchSprite(name).then(ab => new Promise(res => {
    const a = audio();
    if (!ab || !a) return res(null);
    try { const pr = a.decodeAudioData(ab.slice(0), res, () => res(null)); if (pr && pr.catch) pr.catch(() => res(null)); } catch (e) { res(null); }
  })).then(b => { if (!b) spriteBufs[name] = null; return b; });
  return spriteBufs[name];
}
export const preload = names => names.forEach(n => fetchSprite(n));

// the device voice is only a last-resort fallback when a clip cannot load
const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let voice = null;
function pickVoice(){
  if (!canSpeak) return;
  const vs = speechSynthesis.getVoices();
  const us = vs.filter(v => /^en[-_]US/i.test(v.lang));
  const en = us.length ? us : vs.filter(v => /^en/i.test(v.lang));
  voice = en.find(v => /Natural|Neural|Premium|Enhanced/i.test(v.name))
    || en.find(v => /Google US English|Samantha|Jenny|Aria|Ava|Allison|Susan|Zira/i.test(v.name)) || en[0] || null;
}
if (canSpeak) { pickVoice(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', pickVoice); }
function ttsSay(text, rate){
  return new Promise(res => {
    if (!canSpeak) { setTimeout(res, 600); return; }
    let done = false; const fin = () => { if (!done) { done = true; res(); } };
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; if (voice) u.voice = voice;
    u.rate = rate; u.pitch = 1.05;
    u.onend = fin; u.onerror = fin;
    setTimeout(fin, 1800 + text.length * 110);
    try { speechSynthesis.speak(u); } catch (e) { fin(); }
  });
}

let voSrc = null, voSeq = 0, voChain = Promise.resolve();
export function stopVoice(){
  voSeq++;
  if (voSrc) { const s = voSrc; voSrc = null; try { s.stop(); } catch (e) {} }
  if (canSpeak && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
}
async function playLine(text, my, rate){
  const c = VO[vkey(text)];
  if (!c) console.warn('[voice] missing line:', text);
  const buf = c ? await Promise.race([loadSprite(c[0]), wait(2500)]) : null;
  if (my !== voSeq) return;
  const a = audio();
  if (!buf || !a) return ttsSay(text, rate);
  await new Promise(res => {
    const s = a.createBufferSource(); s.buffer = buf; s.connect(a.destination);
    let done = false; const fin = () => { if (!done) { done = true; if (voSrc === s) voSrc = null; res(); } };
    s.onended = fin; voSrc = s;
    s.start(0, Math.max(0, c[1] - .02), c[2] + .12);
    setTimeout(fin, (c[2] + .6) * 1000);
  });
}
// say one line or several in a row; a new call interrupts unless it asks to queue.
// gap = pause between parts in ms; rate only affects the device-voice fallback.
export function say(parts, { queue = false, gap = 140, rate = .85 } = {}){
  const list = Array.isArray(parts) ? parts : [parts];
  if (!queue) { stopVoice(); voChain = Promise.resolve(); }
  const my = voSeq;
  const run = async () => { for (let i = 0; i < list.length; i++) { if (my !== voSeq) return; if (i) await wait(gap); await playLine(list[i], my, rate); } };
  return (voChain = voChain.then(run, run));
}
export const hasLine = text => !!VO[vkey(text)];
document.addEventListener('visibilitychange', () => { if (document.hidden) stopVoice(); });

/* ---------- sound effects ---------- */
function note(f, t, d, type = 'triangle', v = .15, f2){
  if (!isSfxOn()) return;
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + t;
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d * .7);
  g.gain.setValueAtTime(.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + .015);
  g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
  o.connect(g); g.connect(a.destination);
  o.start(t0); o.stop(t0 + d + .05);
}
export const sfx = {
  pop(){ note(660, 0, .12, 'sine', .12); note(990, .05, .14, 'sine', .1); },
  yay(){ [523, 659, 784, 1047].forEach((f, i) => note(f, i * .085, .34)); note(1568, .36, .5, 'sine', .07); },
  boop(){ note(330, 0, .18, 'sine', .12); note(262, .12, .26, 'sine', .12); },
  jump(){ note(380, 0, .24, 'sine', .12, 900); },
  fanfare(){ [523, 659, 784, 659, 784, 1047].forEach((f, i) => note(f, i * .13, .42, 'triangle', .13)); },
};

/* ---------- switches (persisted in P.settings) ---------- */
let scene = 'off';
export function setMusic(on){ if (store.P) { store.P.settings.music = !!on; save(); } }
export function isMusicOn(){ return !store.P || !store.P.settings || store.P.settings.music !== false; }
export function musicScene(kind){ scene = kind; }       // 'menu' | 'game' | 'off' — background music is added by the core builder
export function currentScene(){ return scene; }
export function setSfx(on){ if (store.P) { store.P.settings.sfx = !!on; save(); } }
export function isSfxOn(){ return !store.P || !store.P.settings || store.P.settings.sfx !== false; }
