// audio.js (owner: core) — pre-recorded American English voice clips (audio/<sprite>.mp3 + js/voice-index.js),
// soft synthesized sound effects, gentle generative background music, and the music/sfx switches.
//
// Graph:  voice ─────────────────────────────┐
//         sfx ──┬──────────────────────────── master → soft compressor → speakers
//         music ┴→ duck (dips while speaking) ┘
//         sfx + music also send into a small generated reverb (the "storybook room").
// Nothing makes a sound before the first real tap/key press. Music stops while the page is hidden.
import { VO } from './voice-index.js';
import { store } from './state.js';
import { save } from './storage.js';

export const vkey = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const wait = ms => new Promise(r => setTimeout(r, ms));
const W = typeof window !== 'undefined' ? window : {};

/* =====================================================================================
   context, buses, unlock
   ===================================================================================== */
let ac = null, bus = null, gestured = false, unlockedSilent = false;
const busOf = new WeakMap();

// shared AudioContext (24 kHz preferred: the voice sprites are 24 kHz mono), resumes on gesture
export function audio(){
  if (!ac) {
    const C = W.AudioContext || W.webkitAudioContext; if (!C) return null;
    try { ac = new C({ sampleRate:24000, latencyHint:'interactive' }); }
    catch (e) { try { ac = new C(); } catch (e2) { return null; } }
    bus = graph(ac);
    try { ac.addEventListener('statechange', () => { if (ac.state === 'running') updateMusic(); }); } catch (e) {}
  }
  if (gestured && ac.state !== 'running' && ac.state !== 'closed') resume();
  return ac;
}
function resume(){ try { const pr = ac.resume(); if (pr && pr.then) pr.then(updateMusic, () => {}); } catch (e) {} }

// build the mixing graph for a context (the live one, or an offline one in tests)
function graph(ctx){
  if (busOf.has(ctx)) return busOf.get(ctx);
  const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const master = g(1), comp = ctx.createDynamicsCompressor();
  try { comp.threshold.value = -12; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .22; } catch (e) {}
  master.connect(comp); comp.connect(ctx.destination);
  const voice = g(1), sfxB = g(.8), music = g(0), duck = g(1), verbIn = g(1), verbOut = g(.32);
  voice.connect(master);
  sfxB.connect(master);
  music.connect(duck); duck.connect(master);
  try {
    const cv = ctx.createConvolver(); cv.buffer = impulse(ctx, 2.2);
    verbIn.connect(cv); cv.connect(verbOut); verbOut.connect(master);
  } catch (e) {}
  const sfxSend = g(.22), musicSend = g(.4);
  sfxB.connect(sfxSend); sfxSend.connect(verbIn);
  duck.connect(musicSend); musicSend.connect(verbIn);
  const b = { ctx, master, voice, sfx:sfxB, music, duck, verbIn };
  busOf.set(ctx, b);
  return b;
}
// a soft, bright little room: decaying noise, darker towards the tail, slight stereo spread
function impulse(ctx, secs){
  const sr = ctx.sampleRate, n = Math.floor(sr * secs), buf = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, k = Math.min(.92, .25 + t * .55);         // low-pass gets stronger over time
      lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
      d[i] = (t < .012 ? 0 : lp * 2.2) * Math.pow(1 - i / n, 2.6) * Math.exp(-t * 1.6);
    }
  }
  return buf;
}
const noiseBufs = new WeakMap();
function noise(ctx){
  let b = noiseBufs.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBufs.set(ctx, b);
  }
  return b;
}

// first real gesture: create/resume the context and play one silent sample (iOS unlock)
function unlock(e){
  if (e && e.isTrusted === false) return;
  gestured = true;
  const a = audio(); if (!a) return;
  if (!unlockedSilent) {
    unlockedSilent = true;
    try { const s = a.createBufferSource(); s.buffer = a.createBuffer(1, 1, a.sampleRate); s.connect(a.destination); s.start(0); } catch (err) {}
  }
  if (a.state !== 'running') resume(); else updateMusic();
}
// iPhone/iPad: play game sound even when the ring switch is on silent
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
if (typeof document !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(ev, unlock, { capture:true, passive:true });
}

/* =====================================================================================
   voice sprites
   ===================================================================================== */
const spriteBytes = {}, spriteBufs = {};
const fetchOnce = name => fetch(`audio/${name}.mp3`).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); });
function fetchSprite(name){
  if (!spriteBytes[name]) {
    // one retry after a short pause (flaky mobile networks); a final failure is not cached, so a later call tries again
    spriteBytes[name] = fetchOnce(name)
      .catch(() => wait(700).then(() => fetchOnce(name)))
      .catch(err => { console.warn('[voice] could not load sprite', name, String(err)); spriteBytes[name] = undefined; return null; });
  }
  return spriteBytes[name];
}
let offline = null;
function offlineCtx(rate){
  const O = W.OfflineAudioContext || W.webkitOfflineAudioContext; if (!O) return null;
  try { return new O(1, 1, rate); } catch (e) { return null; }
}
function decodeWith(ctx, ab){
  return new Promise((res, rej) => {
    if (!ctx) return rej(new Error('no context'));
    try {
      const pr = ctx.decodeAudioData(ab, res, rej);
      if (pr && pr.then) pr.then(res, rej);
    } catch (e) { rej(e); }
  });
}
// decode without needing a user gesture: an OfflineAudioContext decodes to the same 24 kHz buffers.
// Fallback chain: live/offline 24 kHz → offline 44.1 kHz → live context.
async function decode(ab){
  const tries = [() => ac || (offline = offline || offlineCtx(24000)), () => offlineCtx(44100), () => (gestured ? audio() : null)];
  for (const t of tries) {
    try { const c = t(); if (c) return await decodeWith(c, ab.slice(0)); } catch (e) {}
  }
  return null;
}
export function loadSprite(name){
  if (!spriteBufs[name]) {
    spriteBufs[name] = fetchSprite(name)
      .then(ab => (ab ? decode(ab) : null))
      .then(b => { if (!b) spriteBufs[name] = undefined; return b; });
  }
  return spriteBufs[name];
}
// fetch + decode ahead of time (decoding needs no gesture, so the first tap speaks instantly)
export const preload = names => (names || []).forEach(n => { loadSprite(n).catch(() => {}); });

// counters so tests (and curious grown-ups) can see that clips come from the sprites
export const voiceStats = { sprite:0, html:0, device:0, missing:0, last:'' };

// fallback 1: an <audio> element seeked into the sprite (when Web Audio decoding fails)
const els = {};
function htmlClip(name, start, len, my){
  return new Promise(res => {
    let el = els[name];
    try { if (!el) { el = els[name] = new Audio(`audio/${name}.mp3`); el.preload = 'auto'; } } catch (e) { return res(false); }
    const go = () => {
      if (my !== voSeq) return res(true);
      try { el.currentTime = start; } catch (e) { return res(false); }
      const pr = el.play();
      const end = () => { clearTimeout(tm); try { el.pause(); } catch (e) {} if (voEl === el) voEl = null; res(true); };
      const tm = setTimeout(end, (len + .1) * 1000);
      voEl = el; voEnd = end;
      if (pr && pr.catch) pr.catch(() => { clearTimeout(tm); res(false); });
    };
    if (el.readyState >= 1) go();
    else {
      const to = setTimeout(() => res(false), 4000);
      el.addEventListener('loadedmetadata', () => { clearTimeout(to); go(); }, { once:true });
      try { el.load(); } catch (e) {}
    }
  });
}
// fallback 2 (last resort): the device voice
const canSpeak = 'speechSynthesis' in W && 'SpeechSynthesisUtterance' in W;
let tvoice = null;
function pickVoice(){
  if (!canSpeak) return;
  const vs = speechSynthesis.getVoices();
  const us = vs.filter(v => /^en[-_]US/i.test(v.lang));
  const en = us.length ? us : vs.filter(v => /^en/i.test(v.lang));
  tvoice = en.find(v => /Natural|Neural|Premium|Enhanced/i.test(v.name))
    || en.find(v => /Google US English|Samantha|Jenny|Aria|Ava|Allison|Susan|Zira/i.test(v.name)) || en[0] || null;
}
if (canSpeak) { try { pickVoice(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) {} }
function ttsSay(text, rate){
  voiceStats.device++;
  return new Promise(res => {
    if (!canSpeak) { setTimeout(res, 600); return; }
    let done = false; const fin = () => { if (!done) { done = true; duckOut(); res(); } };
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; if (tvoice) u.voice = tvoice;
    u.rate = rate; u.pitch = 1.05;
    u.onend = fin; u.onerror = fin;
    setTimeout(fin, 1800 + text.length * 110);
    duckIn();
    try { speechSynthesis.speak(u); } catch (e) { fin(); }
  });
}

// music dips under the voice, then swells back
let speaking = 0;
function duckIn(){
  speaking++;
  if (!ac || !bus) return;
  const g = bus.duck.gain, t = ac.currentTime;
  try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(.2, t, .05); } catch (e) {}
}
function duckOut(){
  speaking = Math.max(0, speaking - 1);
  if (speaking || !ac || !bus) return;
  const g = bus.duck.gain, t = ac.currentTime;
  try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(1, t + .35, .45); } catch (e) {}
}

let voSrc = null, voEl = null, voEnd = null, voSeq = 0, voChain = Promise.resolve();
export function stopVoice(){
  voSeq++;
  if (voSrc) { const s = voSrc; voSrc = null; try { s.stop(); } catch (e) {} }
  if (voEl && voEnd) { const f = voEnd; voEnd = null; f(); }
  if (canSpeak) { try { if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel(); } catch (e) {} }
}
async function playLine(text, my, rate){
  const c = VO[vkey(text)];
  if (!c) { voiceStats.missing++; console.warn('[voice] missing line:', text); }
  if (!gestured) return;                                   // never speak before the first tap
  const buf = c ? await Promise.race([loadSprite(c[0]), wait(5000).then(() => null)]) : null;
  if (my !== voSeq) return;
  const a = audio();
  if (buf && a) {
    voiceStats.sprite++; voiceStats.last = vkey(text);
    await new Promise(res => {
      const s = a.createBufferSource(); s.buffer = buf;
      // tiny fade in/out so clips never click
      const g = a.createGain(), t0 = a.currentTime + .01, len = c[2] + .12;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + .012);
      g.gain.setValueAtTime(1, t0 + len - .04); g.gain.linearRampToValueAtTime(0, t0 + len);
      s.connect(g); g.connect(bus.voice);
      let done = false, tm = 0;
      const fin = () => { if (done) return; done = true; clearTimeout(tm); if (voSrc === s) voSrc = null; duckOut(); res(); };
      s.onended = fin; voSrc = s;
      duckIn();
      try { s.start(t0, Math.max(0, c[1] - .02), len); } catch (e) { fin(); return; }
      tm = setTimeout(fin, (len + .5) * 1000);         // never hang if onended is lost (backgrounded tab)
    });
    return;
  }
  if (c && spriteBytes[c[0]]) {
    duckIn();
    const ok = await htmlClip(c[0], Math.max(0, c[1] - .02), c[2] + .1, my);
    duckOut();
    if (ok) { voiceStats.html++; return; }
    if (my !== voSeq) return;
  }
  if (c) console.warn('[voice] device voice fallback:', text);
  return ttsSay(text, rate);
}
// say one line or several in a row; a new call interrupts unless it asks to queue.
// gap = pause between parts in ms; rate only affects the device-voice fallback.
export function say(parts, { queue = false, gap = 140, rate = .85 } = {}){
  const list = (Array.isArray(parts) ? parts : [parts]).filter(p => p != null && String(p).trim());
  if (!queue) { stopVoice(); voChain = Promise.resolve(); }
  const my = voSeq;
  const run = async () => { for (let i = 0; i < list.length; i++) { if (my !== voSeq) return; if (i) await wait(gap); if (my !== voSeq) return; await playLine(list[i], my, rate); } };
  return (voChain = voChain.then(run, run));
}
export const hasLine = text => !!VO[vkey(text)];

/* =====================================================================================
   instruments (all take a context + destination, so tests can render them offline)
   ===================================================================================== */
const tc = d => d / 4.6;                                     // setTargetAtTime constant: ~-40 dB after d seconds
function partialVoice(ctx, out, t, f, vel, parts, attack = .002){
  const nyq = ctx.sampleRate * .45;
  let end = t;
  for (const [ratio, amp, dec, type] of parts) {
    const fr = f * ratio; if (fr > nyq) continue;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = fr;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * amp, t + attack);
    g.gain.setTargetAtTime(0, t + attack, tc(dec));
    o.connect(g); g.connect(out);
    const stop = t + attack + dec * 1.7 + .01;            // ~-70 dB by then: no click when the oscillator stops
    o.start(t); o.stop(stop);
    end = Math.max(end, stop);
  }
  return end;
}
// music box / glockenspiel: bright tine, slightly inharmonic overtones, long sweet ring
const BELL = [[1, 1, 1.5], [2, .28, .7], [3.01, .1, .35], [5.43, .05, .14]];
const bell = (ctx, out, t, f, vel, dec = 1.5) => partialVoice(ctx, out, t, f, vel, BELL.map(([r, a, d]) => [r, a, d * dec / 1.5]));
// marimba: warm wooden bar, 4th-partial "knock" that dies quickly
const MARIMBA = [[1, 1, .5], [3.98, .22, .08], [9.9, .05, .025]];
const marimba = (ctx, out, t, f, vel, dec = .5) => partialVoice(ctx, out, t, f, vel, MARIMBA.map(([r, a, d]) => [r, a, d * dec / .5]), .003);
// kalimba-ish pluck for the bouncy game tune
const PLUCK = [[1, 1, .7], [2, .18, .25], [5.9, .06, .05]];
const pluck = (ctx, out, t, f, vel, dec = .7) => partialVoice(ctx, out, t, f, vel, PLUCK.map(([r, a, d]) => [r, a, d * dec / .7]), .002);

// filtered noise: pops, whooshes, shakers
function noiseHit(ctx, out, t, { type = 'bandpass', f = 2000, f2, q = 1, dur = .1, vel = .1, attack = .004 } = {}){
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise(ctx);
  fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + attack);
  g.gain.setTargetAtTime(0, t + attack, Math.max(.005, (dur - attack) / 3.5));
  s.connect(fl); fl.connect(g); g.connect(out);
  s.start(t, Math.random() * .5, dur + .2); s.stop(t + dur + .2);
  return t + dur;
}
// pitch-swept sine (bubble pops, boings, thumps)
function sweep(ctx, out, t, f1, f2, dur, vel, { type = 'sine', attack = .003, glide } = {}){
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(f2, t + (glide || dur * .7));
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + attack);
  g.gain.setTargetAtTime(0, t + attack, tc(dur));
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur * 1.7 + .02);
  return t + dur;
}
// warm pad chord: detuned triangles through a soft low-pass, slow swell
function pad(ctx, out, t, freqs, len, vel, { cutoff = 900, attack = 1.2, release = 1.6 } = {}){
  const fl = ctx.createBiquadFilter(), g = ctx.createGain();
  fl.type = 'lowpass'; fl.frequency.value = cutoff; fl.Q.value = .4;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + attack);
  g.gain.setValueAtTime(vel, t + Math.max(attack, len - release));
  g.gain.linearRampToValueAtTime(0, t + len + .05);
  fl.connect(g); g.connect(out);
  for (const f of freqs) for (const det of [-7, 7]) {
    const o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
    o.connect(fl); o.start(t); o.stop(t + len + .1);
  }
}

/* ---------- notes ---------- */
const hz = midi => 440 * Math.pow(2, (midi - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];
const C5 = 72;

/* =====================================================================================
   sound effects — soft, musical, never harsh
   ===================================================================================== */
let coinRun = 0, coinLast = 0;
const SFX = {
  // tiny wooden tick for any button
  tap(c, o, t){ marimba(c, o, t, hz(91), .16, .12); noiseHit(c, o, t, { type:'highpass', f:5000, dur:.018, vel:.03 }); },
  // soap-bubble pop + a little bell
  pop(c, o, t){
    sweep(c, o, t, 420, 1500, .09, .32, { glide:.05 });
    noiseHit(c, o, t, { f:2200, q:1.4, dur:.035, vel:.14, attack:.001 });
    bell(c, o, t + .03, hz(96), .06, .45);
  },
  // correct answer: rising marimba arpeggio + glockenspiel shimmer
  yay(c, o, t){
    [84, 88, 91, 96].forEach((m, i) => marimba(c, o, t + i * .07, hz(m), .26 - i * .02, .45));
    bell(c, o, t + .28, hz(100), .1, 1.2); bell(c, o, t + .3, hz(103), .06, 1.1);
    [108, 105, 103, 100].forEach((m, i) => bell(c, o, t + .36 + i * .05, hz(m), .025, .5));
  },
  // gentle "oops": two soft low wood notes, falling — never a buzzer
  boop(c, o, t){
    marimba(c, o, t, hz(64), .3, .35); marimba(c, o, t + .14, hz(60), .32, .5);
    sweep(c, o, t + .14, 262, 230, .3, .06);
  },
  // springy jump: soft boing up + airy swoosh
  jump(c, o, t){
    sweep(c, o, t, 300, 820, .26, .24, { glide:.16 });
    sweep(c, o, t, 600, 1640, .16, .03, { glide:.14, type:'triangle' });
    noiseHit(c, o, t, { f:700, f2:2600, q:1.6, dur:.2, vel:.09, attack:.03 });
  },
  // soft landing thump
  land(c, o, t){
    sweep(c, o, t, 190, 70, .16, .34, { glide:.1 });
    noiseHit(c, o, t, { type:'lowpass', f:500, dur:.07, vel:.12, attack:.002 });
  },
  // end-of-game celebration: chord stabs, rising bell melody, sparkling run, warm swell
  fanfare(c, o, t){
    pad(c, o, t, [hz(60), hz(64), hz(67), hz(72)], 1.8, .05, { attack:.25, release:1.2, cutoff:1600 });
    [[0, 72], [.14, 76], [.28, 79], [.42, 84]].forEach(([d, m]) => { marimba(c, o, t + d, hz(m), .22, .5); bell(c, o, t + d, hz(m + 12), .05, .6); });
    [72, 76, 79].forEach(m => marimba(c, o, t + .62, hz(m), .14, .9));
    bell(c, o, t + .62, hz(96), .12, 1.8); bell(c, o, t + .64, hz(100), .07, 1.6); bell(c, o, t + .66, hz(103), .05, 1.5);
    [108, 105, 103, 100, 98, 96].forEach((m, i) => bell(c, o, t + .78 + i * .06, hz(m), .028, .6));
    noiseHit(c, o, t + .5, { type:'highpass', f:6000, dur:.5, vel:.018, attack:.15 });
  },
  // magic sparkle: a quick shimmering pentatonic run high up
  sparkle(c, o, t){
    const run = [96, 98, 100, 103, 105, 108, 110].slice(0, 6 + Math.round(Math.random()));
    run.forEach((m, i) => bell(c, o, t + i * .045 + Math.random() * .01, hz(m), .045 - i * .004, .55));
    noiseHit(c, o, t, { type:'highpass', f:7000, dur:.35, vel:.012, attack:.08 });
  },
  // a new sticker: soft pop, then two happy chimes
  sticker(c, o, t){
    sweep(c, o, t, 500, 1400, .07, .22, { glide:.045 });
    noiseHit(c, o, t, { f:2600, q:1.2, dur:.03, vel:.08, attack:.001 });
    bell(c, o, t + .08, hz(88), .13, 1.0); bell(c, o, t + .19, hz(93), .12, 1.2);
    bell(c, o, t + .3, hz(100), .035, .7); bell(c, o, t + .34, hz(105), .025, .6);
  },
  // bought something: coin + bright little arpeggio
  buy(c, o, t){
    bell(c, o, t, hz(95), .12, .5); bell(c, o, t + .07, hz(100), .12, .8);
    [79, 84, 88, 91].forEach((m, i) => marimba(c, o, t + .14 + i * .06, hz(m), .18, .4));
    bell(c, o, t + .4, hz(103), .06, 1.2);
  },
  // swish for page turns / previews
  whoosh(c, o, t){
    noiseHit(c, o, t, { f:350, f2:2800, q:.9, dur:.32, vel:.1, attack:.12 });
    noiseHit(c, o, t + .05, { type:'highpass', f:3000, f2:6000, dur:.22, vel:.025, attack:.08 });
  },
  // star coin; repeated coins climb a pentatonic ladder (counting up feels like a song)
  coin(c, o, t){
    const now = (c.currentTime || 0);
    coinRun = (now - coinLast < .6) ? Math.min(coinRun + 1, 9) : 0; coinLast = now;
    const m = C5 + 12 + PENTA[coinRun % 5] + 12 * Math.floor(coinRun / 5);
    bell(c, o, t, hz(m), .09, .35); bell(c, o, t + .06, hz(m + 5), .1, .6);
  },
};
function playSfx(name){
  if (!isSfxOn() || !gestured) return;
  const a = audio(); if (!a || a.state === 'closed') return;
  try { SFX[name](a, bus.sfx, a.currentTime + .005); } catch (e) {}
}
// callers outside core use pop, yay, boop, jump, fanfare directly; the rest via sfx.name?.()
export const sfx = Object.fromEntries(Object.keys(SFX).map(n => [n, () => playSfx(n)]));

/* =====================================================================================
   generative background music — music box / marimba over a soft pad, pentatonic only
   ===================================================================================== */
// chords as [root midi, chord tones (pitch classes relative to C)]
const CH = { C:[48, [0, 4, 7]], Am:[45, [9, 0, 4]], F:[41, [5, 9, 0]], G:[43, [7, 11, 2]], Dm:[50, [2, 5, 9]], Em:[52, [4, 7, 11]] };
const PROG = {
  day:  [['C', 'Am', 'F', 'G'], ['F', 'C', 'G', 'C'], ['C', 'Em', 'F', 'G'], ['Am', 'F', 'C', 'G']],
  night:[['Am', 'F', 'C', 'G'], ['Am', 'Dm', 'F', 'Em'], ['Am', 'F', 'G', 'Am']],
};
const MOOD = {
  menu: { bpm:74, swing:0, melodyVel:.085, padVel:.032, rhythms:[
    [1,0,0,1, 0,0,1,0, 1,0,0,0, 0,0,0,0], [1,0,1,0, 1,0,0,0, 1,0,0,0, 0,0,0,0],
    [1,0,0,0, 1,0,1,1, 1,0,0,0, 0,0,0,0], [0,0,1,0, 1,0,1,0, 1,0,0,1, 1,0,0,0]] },
  game: { bpm:104, swing:.12, melodyVel:.06, padVel:.022, rhythms:[
    [1,0,1,1, 0,1,1,0, 1,0,0,0, 0,0,0,0], [1,1,0,1, 1,0,1,0, 1,0,0,0, 0,0,0,0],
    [1,0,1,0, 1,1,1,0, 1,0,1,0, 0,0,0,0], [1,0,0,1, 0,0,1,0, 1,0,1,1, 1,0,0,0]] },
};
const LADDER = []; for (let o = 0; o < 3; o++) for (const p of PENTA) LADDER.push(C5 + o * 12 + p);   // C5 … A7
const pick = a => a[Math.floor(Math.random() * a.length)];
const clampI = (i, lo, hi) => Math.max(lo, Math.min(hi, i));

class Tune {
  constructor(ctx, out, kind){ this.ctx = ctx; this.out = out; this.kind = kind; this.step = 0; this.next = 0; this.night = false; }
  get mood(){ return MOOD[this.kind] || MOOD.menu; }
  stepDur(){ return 60 / this.mood.bpm / 2; }
  motif(){
    const r = pick(this.mood.rhythms); let i = 2 + Math.floor(Math.random() * 5), dir = Math.random() < .5 ? 1 : -1;
    return r.map(on => {
      if (!on) return null;
      const n = i;
      if (Math.random() < .3) dir = -dir;
      i = clampI(i + dir * pick([1, 1, 1, 2, 0]), 0, 9);
      return n;
    });
  }
  section(){
    this.night = typeof document !== 'undefined' && document.body && document.body.dataset.world === 'halloween';
    this.prog = pick(PROG[this.night ? 'night' : 'day']);
    const A = this.motif(), B = this.motif();
    const A2 = A.map((n, k) => (k >= 8 && n != null ? clampI(n + pick([-1, 1, 2]), 0, 9) : n));
    this.phrase = [A, A2, B, A];
  }
  snap(idx, pcs){
    for (const d of [0, -1, 1, -2, 2]) { const j = clampI(idx + d, 0, LADDER.length - 1); if (pcs.includes(LADDER[j] % 12)) return j; }
    return idx;
  }
  play(step, t){
    const c = this.ctx, o = this.out, m = this.mood, game = this.kind === 'game';
    const inSec = step % 64, bar = Math.floor(inSec / 8), s8 = inSec % 8, s16 = inSec % 16;
    if (inSec === 0) { this.section(); this.ended = false; }
    const name = this.prog[Math.floor(inSec / 16)], [root, pcs] = CH[name];
    const sd = this.stepDur(), hum = () => (Math.random() - .5) * .012;
    if (s8 % 2 === 1) t += sd * m.swing;
    // pad: one long chord every two bars
    if (s16 === 0) {
      const tones = pcs.map(pc => { let n = 48 + ((pc - 48) % 12 + 12) % 12; if (n < 52) n += 12; return hz(n); });
      pad(c, o, t, [hz(root), ...tones], sd * 16 + .8, m.padVel * (this.night ? 1.15 : 1), { cutoff:this.night ? 650 : 950 });
    }
    // bass: soft round root (menu) or bouncing marimba root/fifth (game)
    if (!game && s8 === 0) sweep(c, o, t, hz(root), hz(root) * .999, 1.6, .12, { attack:.02 });
    if (game && (s8 === 0 || s8 === 4)) marimba(c, o, t + hum(), hz(s8 === 0 ? root : root + 7), .16, .5);
    if (game && s8 === 6 && Math.random() < .5) marimba(c, o, t + hum(), hz(root + 12), .08, .3);
    // broken-chord accompaniment
    if (game) {
      const arp = [0, 1, 2, 1, 0, 2, 1, 2][s8], pc = pcs[arp];
      marimba(c, o, t + hum(), hz(60 + ((pc - 60) % 12 + 12) % 12 + (s8 > 3 ? 12 : 0)), .045 + (s8 % 2 ? 0 : .015), .3);
      if (s8 % 2 === 1) noiseHit(c, o, t, { type:'highpass', f:7000, dur:.035, vel:.012 + Math.random() * .006, attack:.002 });
    } else if (s16 < 8 && s8 % 2 === 0) {
      const pc = pcs[(s8 / 2) % 3];
      bell(c, o, t + hum(), hz(60 + ((pc - 60) % 12 + 12) % 12 + (s8 === 6 ? 12 : 0)), .022, 1.2);
    }
    // melody: phrase AA'BA; strong beats land on chord tones, the last note of the section is the home note
    const ph = this.phrase[Math.floor(bar / 2)], n = ph[s16];
    if (n != null) {
      let j = (s8 === 0 || s8 === 4) ? this.snap(n, pcs) : n;
      if (bar === 7 && s16 >= 8) { if (this.ended) return; this.ended = true; j = this.snap(5, this.night ? [9] : [0]); }
      const v = m.melodyVel * (s8 === 0 ? 1.15 : s8 % 2 ? .8 : 1) * (.9 + Math.random() * .2);
      if (game) pluck(c, o, t + hum(), hz(LADDER[j]), v, .7);
      else bell(c, o, t + hum(), hz(LADDER[j]), v, 1.6);
    }
  }
  // schedule every step that starts before `until`
  run(until){
    if (this.next < this.ctx.currentTime) this.next = this.ctx.currentTime + .06;
    while (this.next < until) { this.play(this.step, this.next); this.next += this.stepDur(); this.step++; }
  }
}

const MUSIC_VOL = { menu:.32, game:.42 };   // well under the voice (about -15 dB), and ducked further while she listens
let scene = 'off', tune = null, musicTimer = null, stopTimer = null;
function wantMusic(){
  return scene !== 'off' && isMusicOn() && gestured && !!ac && ac.state === 'running'
    && !(typeof document !== 'undefined' && document.hidden);
}
function updateMusic(){
  if (!ac || !bus) return;
  const t = ac.currentTime, g = bus.music.gain;
  if (wantMusic()) {
    clearTimeout(stopTimer); stopTimer = null;
    if (!tune) { tune = new Tune(ac, bus.music, scene); tune.next = t + .1; }
    if (tune.kind !== scene) {
      // change mood at the next section so it never jumps mid-phrase... but do not wait too long
      const old = tune; tune = new Tune(ac, bus.music, scene); tune.next = Math.max(t + .15, old.next);
    }
    try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(MUSIC_VOL[scene] || .8, t + 1.6); } catch (e) {}
    if (!musicTimer) { tick(); musicTimer = setInterval(tick, 100); }
  } else if (tune || musicTimer) {
    try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + .5); } catch (e) {}
    clearInterval(musicTimer); musicTimer = null;
    const old = tune; tune = null;
    clearTimeout(stopTimer);
    stopTimer = setTimeout(() => { stopTimer = null; if (!tune && old) old.step = 0; }, 600);
  }
}
function tick(){ if (tune && ac) { try { tune.run(ac.currentTime + .4); } catch (e) {} } }

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopVoice();
      updateMusic();
      // let the fade finish, then let the device sleep its audio hardware
      setTimeout(() => { if (document.hidden && ac && ac.state === 'running') { try { ac.suspend(); } catch (e) {} } }, 700);
    } else if (ac && gestured) { resume(); updateMusic(); }
  });
  W.addEventListener && W.addEventListener('pagehide', () => { stopVoice(); if (ac && ac.state === 'running') { try { ac.suspend(); } catch (e) {} } });
}

/* =====================================================================================
   switches (persisted in P.settings)
   ===================================================================================== */
export function setMusic(on){ if (store.P) { store.P.settings.music = !!on; save(); } updateMusic(); }
export function isMusicOn(){ return !store.P || !store.P.settings || store.P.settings.music !== false; }
export function musicScene(kind){ scene = kind === 'game' || kind === 'menu' ? kind : 'off'; updateMusic(); }   // 'menu' | 'game' | 'off'
export function currentScene(){ return scene; }
export const isMusicPlaying = () => !!tune && !!musicTimer;
export function setSfx(on){ if (store.P) { store.P.settings.sfx = !!on; save(); } }
export function isSfxOn(){ return !store.P || !store.P.settings || store.P.settings.sfx !== false; }

/* =====================================================================================
   test helpers: render a sound effect or some music into an offline buffer and measure it
   ===================================================================================== */
export async function renderOffline(what, secs = 2, rate = 24000){
  const O = W.OfflineAudioContext || W.webkitOfflineAudioContext;
  const ctx = new O(2, Math.ceil(rate * secs), rate), b = graph(ctx);
  if (what.startsWith('music:')) {
    const tn = new Tune(ctx, b.music, what.slice(6)); b.music.gain.value = MUSIC_VOL[tn.kind] || .8;
    tn.next = .05; tn.run(secs);
  } else SFX[what](ctx, b.sfx, .02);
  const buf = await ctx.startRendering();
  let peak = 0, sum = 0, n = 0, last = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; n++; if (v > .003) last = Math.max(last, i); }
  }
  return { peak, rms:Math.sqrt(sum / n), tail:last / rate, buf };
}
