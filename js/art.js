// art.js (owner: art) — the princess (layered SVG), her backdrops, closet thumbnails, and a canvas image of her.
// Style: glossy candy storybook. Soft gradients, darker-hue outlines (never black), white speculars.
// Coordinates: the princess lives in a 200×300 box (feet at the bottom, hats up top); scenes are 400×300.
import { store } from './state.js';
import { RAINBOW, PASTEL, PET_IMG, starD } from './data.js';
import { iconHTML } from './images.js';

let UID = 0;
export const nextUid = () => ++UID;

/* ================= tiny helpers ================= */
const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgb2hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); };
const n1 = v => Math.round(v * 10) / 10;
// stops: ['#a', '#b'] (evenly spaced) or [[offset, colour, opacity?], …]
const stops = s => s.map((x, i) => Array.isArray(x)
  ? `<stop offset="${x[0]}" stop-color="${x[1]}"${x[2] != null ? ` stop-opacity="${x[2]}"` : ''}/>`
  : `<stop offset="${s.length > 1 ? n1(i / (s.length - 1) * 100) / 100 : 0}" stop-color="${x}"/>`).join('');
const lin = (id, s, x1 = 0, y1 = 0, x2 = 0, y2 = 1, us = '') => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${us ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops(s)}</linearGradient>`;
const rad = (id, s, cx = .5, cy = .5, r = .5, fx, fy) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${fx != null ? ` fx="${fx}" fy="${fy}"` : ''}>${stops(s)}</radialGradient>`;
// four-point twinkle
const spark = (x, y, r, fill, op = 1) => `<path d="M${n1(x)} ${n1(y - r)}Q${n1(x + r * .16)} ${n1(y - r * .16)} ${n1(x + r)} ${n1(y)}Q${n1(x + r * .16)} ${n1(y + r * .16)} ${n1(x)} ${n1(y + r)}Q${n1(x - r * .16)} ${n1(y + r * .16)} ${n1(x - r)} ${n1(y)}Q${n1(x - r * .16)} ${n1(y - r * .16)} ${n1(x)} ${n1(y - r)}Z" fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''}/>`;
const mirror = s => s + `<g transform="matrix(-1 0 0 1 200 0)">${s}</g>`;
const heartD = (x, y, s) => `M${n1(x)} ${n1(y + s * .9)}C${n1(x - s * 1.25)} ${n1(y + s * .05)} ${n1(x - s * .95)} ${n1(y - s * 1)} ${n1(x)} ${n1(y - s * .42)}C${n1(x + s * .95)} ${n1(y - s * 1)} ${n1(x + s * 1.25)} ${n1(y + s * .05)} ${n1(x)} ${n1(y + s * .9)}Z`;
// a soft round flower (5 petals) with a glossy centre
function flower(x, y, r, c, ctr = '#ffd23f', rot = 0){
  const line = mix(c, '#7a3d6e', .35);
  let p = `<g transform="translate(${n1(x)} ${n1(y)}) rotate(${rot})">`;
  for (let i = 0; i < 5; i++) p += `<ellipse cx="0" cy="${n1(-r * .62)}" rx="${n1(r * .46)}" ry="${n1(r * .6)}" fill="${c}" stroke="${line}" stroke-width="${n1(Math.max(.6, r * .09))}" stroke-opacity=".55" transform="rotate(${i * 72})"/>`;
  return p + `<circle r="${n1(r * .36)}" fill="${ctr}" stroke="${mix(ctr, '#a0522d', .35)}" stroke-width="${n1(Math.max(.5, r * .07))}"/><circle cx="${n1(-r * .1)}" cy="${n1(-r * .12)}" r="${n1(r * .12)}" fill="#fff" opacity=".8"/></g>`;
}

/* ================= palettes ================= */
const SK = { hi:'#fff3ec', base:'#ffdfcd', lo:'#f7c2a8', line:'#d9937a', blush:'#ff8fae' };
const HAIR = {
  brown:  { hi:'#c48a5c', base:'#94592f', lo:'#6a3a1d', line:'#4f2914', shine:'#f0c49c' },
  black:  { hi:'#6f5d86', base:'#43345a', lo:'#2a1f3b', line:'#1d1529', shine:'#b9a6e0' },
  gold:   { hi:'#fff0a8', base:'#ffd25e', lo:'#e8a52c', line:'#b97a14', shine:'#ffffff' },
  pink:   { hi:'#ffd3ea', base:'#ff96cb', lo:'#e8649f', line:'#bf447f', shine:'#ffffff' },
  purple: { hi:'#e6d4ff', base:'#b78df5', lo:'#8a5fd6', line:'#6440ad', shine:'#ffffff' },
  mint:   { hi:'#d4fff2', base:'#6fdcbf', lo:'#36ad91', line:'#24826c', shine:'#ffffff' },
  rainbow:{ hi:'#ffd6ea', base:'#ff9fcf', lo:'#b48cff', line:'#a35a9c', shine:'#ffffff', rainbow:true },
};
const HAIR_RB = ['#ff8fb4', '#ffb36b', '#ffe066', '#7fe0a8', '#7cb8ff', '#b79bff'];
function hairDefs(id, u){
  const h = HAIR[id] || HAIR.brown;
  if (h.rainbow) return { h, defs: lin(`hr${u}`, [[0, '#ffb3d1'], [.18, HAIR_RB[0]], [.36, HAIR_RB[1]], [.52, HAIR_RB[2]], [.68, HAIR_RB[3]], [.84, HAIR_RB[4]], [1, HAIR_RB[5]]], 0, 50, 0, 225, 1) };
  return { h, defs: lin(`hr${u}`, [[0, h.hi], [.38, h.base], [1, h.lo]], 0, 46, 0, 200, 1) };
}

/* ================= head ================= */
const FACE_D = 'M56 106C56 78 76 62 100 62C124 62 144 78 144 106C144 134 127 155 100 155C73 155 56 134 56 106Z';
const HAIR_BACK = 'M46 106C44 64 70 44 100 44C130 44 156 64 154 106C156 136 162 166 162 192C162 208 156 220 144 222C150 212 146 200 138 196C130 192 124 188 116 182L84 182C76 188 70 192 62 196C54 200 50 212 56 222C44 220 38 208 38 192C38 166 44 136 46 106Z';
const LOCK_L = 'M60 88C48 100 43 126 45 152C46 168 42 180 36 190C49 194 59 186 61 170C63 152 59 128 64 106Z';
const BANGS = 'M48 114C42 66 70 44 100 44C130 44 158 66 152 114C150 102 146 93 140 88C140 93 135 97 128 98C127 90 122 84 113 80C114 87 111 93 105 97C103 88 98 83 91 80C93 87 88 93 80 96C79 90 75 86 68 86C62 92 54 102 48 114Z';

function eye(cx, cy, s, u){
  return `<g class="eye">
    <ellipse cx="${cx}" cy="${cy}" rx="11.4" ry="13.4" fill="url(#ir${u})" stroke="#3a1a4a" stroke-width="1.2"/>
    <ellipse cx="${cx}" cy="${cy - .6}" rx="5.8" ry="7.2" fill="#1e0b29" opacity=".72"/>
    <ellipse cx="${cx}" cy="${cy + 7}" rx="7" ry="3.8" fill="#f4d6ff" opacity=".6"/>
    <ellipse cx="${n1(cx + 3.8)}" cy="${cy - 5.2}" rx="4.4" ry="5.3" fill="#fff"/>
    <circle cx="${cx - 4.4}" cy="${cy + 5.6}" r="2.2" fill="#fff"/>
    <circle cx="${cx + 5}" cy="${cy + 4}" r="1" fill="#fff" opacity=".9"/>
    <path d="M${cx - 11.4 * s} ${cy - 3.5}C${cx - 9 * s} ${cy - 15.6} ${cx + 9 * s} ${cy - 16.2} ${cx + 12.4 * s} ${cy - 3}" fill="none" stroke="#2b1438" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M${cx + 11.6 * s} ${cy - 4.6}l${5 * s} -3.4M${cx + 9 * s} ${cy - 10}l${4 * s} -4.2" stroke="#2b1438" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M${cx + 5 * s} ${cy + 12}Q${cx + 8.6 * s} ${cy + 10} ${cx + 10.4 * s} ${cy + 5.6}" fill="none" stroke="#7a4a6a" stroke-width="1.2" stroke-linecap="round" opacity=".5"/>
  </g>`;
}
const MOUTH = {
  idle: `<path d="M93.5 134Q100 140.5 106.5 134" fill="none" stroke="#b8436a" stroke-width="2.5" stroke-linecap="round"/><path d="M92.2 133.2l1.6 1.4M107.8 133.2l-1.6 1.4" stroke="#b8436a" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>`,
  cheer: `<path d="M90.5 131.5Q100 135 109.5 131.5Q108.5 147.5 100 147.5Q91.5 147.5 90.5 131.5Z" fill="#a8344f" stroke="#8c2541" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M92.3 132.8Q100 135.8 107.7 132.8L107.2 135.4Q100 138 92.8 135.4Z" fill="#fff"/>
    <path d="M94 142Q100 137.8 106 142Q104 147.4 100 147.4Q96 147.4 94 142Z" fill="#ff8a9e"/>`,
  jump: `<path d="M93.5 132.5Q100 134.5 106.5 132.5Q106 143 100 143Q94 143 93.5 132.5Z" fill="#a8344f" stroke="#8c2541" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M95.5 139Q100 136.4 104.5 139Q103 142.8 100 142.8Q97 142.8 95.5 139Z" fill="#ff8a9e"/>`,
};
function headSVG(u, pose){
  return `<path d="M93 140h14v28h-14z" fill="${SK.lo}"/>
    <path d="${FACE_D}" fill="url(#sk${u})" stroke="${SK.line}" stroke-width="2.2"/>
    <path d="M60 116C62 98 70 90 80 86C70 96 66 106 66 118Z" fill="#fff" opacity=".22"/>
    <ellipse cx="71" cy="131" rx="10.5" ry="6.8" fill="url(#bl${u})"/><ellipse cx="129" cy="131" rx="10.5" ry="6.8" fill="url(#bl${u})"/>
    <path d="M67.5 128.5l-2.2 4M71.5 128.5l-2.2 4M75.5 128.5l-2.2 4M124.5 128.5l-2.2 4M128.5 128.5l-2.2 4M132.5 128.5l-2.2 4" stroke="#ff6f96" stroke-width="1.2" stroke-linecap="round" opacity=".45"/>
    ${eye(79, 114, -1, u)}${eye(121, 114, 1, u)}
    <ellipse cx="100" cy="126.2" rx="1.9" ry="1.3" fill="#e99a80"/>
    ${MOUTH[pose] || MOUTH.idle}`;
}
function hairFront(h, u){
  const f = `url(#hr${u})`;
  return `<path d="M52 116Q58 96 68 90Q76 94 80 100Q86 90 91 84Q99 92 105 101Q110 92 113 84Q122 92 128 102Q135 96 140 92Q147 102 150 116L150 80L52 80Z" fill="#f0a98f" opacity=".45"/>
    ${mirror(`<path d="${LOCK_L}" fill="${f}" stroke="${h.line}" stroke-width="2.2" stroke-linejoin="round"/><path d="M60 100C54 118 54 140 55 160" fill="none" stroke="${h.lo}" stroke-width="1.6" stroke-linecap="round" opacity=".45"/><path d="M64 104C60 116 59 126 60 138" fill="none" stroke="${h.shine}" stroke-width="2" stroke-linecap="round" opacity=".35"/>`)}
    <path d="${BANGS}" fill="${f}" stroke="${h.line}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M100 50C99 64 102 80 105 95M98 50C90 60 84 76 81 94M104 50C116 60 124 78 128 96M94 52C80 58 72 70 68 84" fill="none" stroke="${h.lo}" stroke-width="1.5" stroke-linecap="round" opacity=".42"/>
    <path d="M62 74C72 60 86 55 100 55C114 55 128 60 138 74" fill="none" stroke="${h.shine}" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="15 5 9 5 22 5 9 5 15" opacity=".55"/>
    <path d="M70 66C76 60 84 57 90 56" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>`;
}
function hairBack(h, u){
  return `<path d="${HAIR_BACK}" fill="url(#hr${u})" stroke="${h.line}" stroke-width="2.2" stroke-linejoin="round"/>
    <ellipse cx="100" cy="122" rx="52" ry="44" fill="${h.lo}" opacity=".4"/>
    <path d="M50 150C48 172 50 192 56 210M150 150C152 172 150 192 144 210" fill="none" stroke="${h.lo}" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>`;
}

/* ================= dresses ================= */
// c: [light, base, deep] body gradient; line: outline; frill: petticoat lace; shape: skirt silhouette
const DRESS = {
  pink:   { c:['#ffd6ea', '#ff9fcd', '#f070ac'], line:'#c94a87', frill:'#ffffff', sash:'#ff5fae', shoe:'#ff5fae', shape:'bell', pat:'dots', pc:'#ffffff', collar:'lace' },
  candy:  { c:['#dcfff5', '#97ecd5', '#4fcaa9'], line:'#2f9c80', frill:'#ffb8da', sash:'#ff7ab8', shoe:'#ff7ab8', shape:'bell', pat:'sprinkles', brooch:'candy' },
  star:   { c:['#7486ea', '#3f51b5', '#212c78'], line:'#18205a', frill:'#cdd6ff', sash:'#ffd23f', shoe:'#ffd23f', shape:'bell', pat:'stars', brooch:'moon', trim:'#ffd23f' },
  pumpkin:{ c:['#ffcd80', '#ff9c32', '#e46a0c'], line:'#b0510a', frill:'#5b3596', sash:'#3cb371', shoe:'#6b3fa0', shape:'pumpkin', pat:'ribs', collar:'leaves' },
  fire:   { c:['#ff8a7e', '#ec4a42', '#b8282a'], line:'#8a1d22', frill:null, sash:'#2a3a7a', shoe:'#3a2346', shape:'coat', pat:'bands', boots:true, collar:'navy' },
  rainbow:{ c:['#ffffff', '#fff6fb', '#f0e0fb'], line:'#c79ad6', frill:'#ffffff', sash:'#b79bff', shoe:'#9a63ff', shape:'bell', pat:'rainbow', brooch:'heart' },
  mermaid:{ c:['#9ff7e9', '#43c8cf', '#6f63e8'], line:'#3a64a8', frill:null, sash:'#ffd6f0', shoe:'#b79bff', shape:'mermaid', pat:'scales', brooch:'shell', pearls:true },
  gown:   { c:['#f6edff', '#d2b3ff', '#a079ea'], line:'#7b52c4', frill:'#fff4fb', sash:'#ffd23f', shoe:'#ffcf4a', shape:'gown', pat:'gown', brooch:'gem', pearls:true },
};
const scal = (x0, x1, y, n, d) => { const w = (x1 - x0) / n; let s = ''; for (let i = 0; i < n; i++) s += `q${n1(w / 2)} ${d} ${n1(w)} 0`; return s; };
const SKIRT = {
  bell:   `M84 192C80 210 56 226 44 250${scal(44, 156, 250, 7, 7)}C144 226 120 210 116 192Z`,
  pumpkin:`M84 192C58 198 40 218 42 238C44 252 64 256 100 256C136 256 156 252 158 238C160 218 142 198 116 192Z`,
  coat:   `M84 190L70 250Q100 255 130 250L116 190Z`,
  mermaid:`M84 192C80 212 88 226 84 236C74 244 58 250 48 264C62 260 76 264 86 258C92 264 96 266 100 263C104 266 108 264 114 258C124 264 138 260 152 264C142 250 126 244 116 236C112 226 120 212 116 192Z`,
  gown:   `M84 192C74 214 44 236 32 266${scal(32, 168, 266, 8, 7)}C156 236 126 214 116 192Z`,
};
const HEM = { bell:250, pumpkin:256, coat:250, mermaid:262, gown:266 };
const BODICE = 'M84 160C90 156 110 156 116 160L118 196C106 200 94 200 82 196Z';

function dressDefs(d, u){
  return lin(`dg${u}`, [[0, d.c[0]], [.45, d.c[1]], [1, d.c[2]]]) +
    lin(`dv${u}`, [[0, '#ffffff', .38], [.32, '#ffffff', 0], [.7, '#000000', 0], [1, '#2a0f3a', .16]], 0, 0, 1, 0) +
    `<clipPath id="dc${u}"><path d="${SKIRT[d.shape]}"/></clipPath><clipPath id="bc${u}"><path d="${BODICE}"/></clipPath>`;
}
function skirtPattern(d, u){
  const s = d.shape;
  if (d.pat === 'dots') { let p = ''; for (let y = 200, r = 0; y < 268; y += 12, r++) for (let x = 36 + (r % 2) * 7; x < 168; x += 14) p += `<circle cx="${x}" cy="${y}" r="${n1(1.8 + (y - 200) / 40)}" fill="${d.pc}" opacity=".92"/>`; return p; }
  if (d.pat === 'sprinkles') {
    const pts = [[78,208,30],[96,204,-40],[114,210,70],[70,226,-20],[88,222,50],[106,228,-60],[124,222,20],[60,242,60],[80,240,-30],[100,244,10],[120,240,-70],[140,244,40],[92,236,85],[132,232,-10],[66,214,10],[54,252,-50],[146,252,30]];
    return pts.map(([x, y, a], k) => `<rect x="${x - 4.5}" y="${y - 1.6}" width="9" height="3.2" rx="1.6" fill="${PASTEL[k % 7]}" stroke="${mix(PASTEL[k % 7], '#5a2a5a', .25)}" stroke-width=".6" transform="rotate(${a} ${x} ${y})"/>`).join('') +
      [[62,206],[110,216],[134,248],[74,250],[150,236],[86,212]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#fff"/>`).join('');
  }
  if (d.pat === 'stars') return [[74,212,6],[100,206,4.5],[126,214,6.5],[62,236,5],[88,230,7],[114,234,5],[138,238,6],[50,252,4],[76,250,5],[102,254,6],[128,256,4.5],[150,252,5]]
      .map(([x, y, r]) => `<path d="${starD(x, y, r)}" fill="url(#gd${u})" stroke="#e0a400" stroke-width=".8" stroke-linejoin="round"/>`).join('') +
    [[90,216],[66,222],[136,224],[108,242],[60,262],[118,262],[146,262],[84,258]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#fff" opacity=".9"/>`).join('');
  if (d.pat === 'ribs') return ['M100 194C101 220 101 240 100 258', 'M88 194C80 216 76 238 78 258', 'M112 194C120 216 124 238 122 258', 'M76 196C62 214 56 236 60 256', 'M124 196C138 214 144 236 140 256']
    .map(p => `<path d="${p}" fill="none" stroke="#d65f05" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>`).join('') +
    ['M94 196C92 220 92 240 94 256', 'M106 196C108 220 108 240 106 256'].map(p => `<path d="${p}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".28"/>`).join('');
  if (d.pat === 'bands') return `<rect x="40" y="228" width="120" height="9" fill="#ffd23f"/><rect x="40" y="231" width="120" height="3" fill="#e8eef8"/><rect x="40" y="241" width="120" height="9" fill="#ffd23f"/><rect x="40" y="244" width="120" height="3" fill="#e8eef8"/>
    <rect x="96" y="188" width="8" height="70" fill="#2a3a7a"/><circle cx="91" cy="206" r="2.2" fill="#ffd23f"/><circle cx="91" cy="218" r="2.2" fill="#ffd23f"/><circle cx="109" cy="206" r="2.2" fill="#ffd23f"/><circle cx="109" cy="218" r="2.2" fill="#ffd23f"/>`;
  if (d.pat === 'rainbow') {
    const cols = ['#ffa2b9', '#ffc58a', '#ffe680', '#9eecbc', '#9ccbff', '#c6b0ff'];
    let p = '';
    for (let k = cols.length - 1; k >= 0; k--) { const y = 196 + k * 11, b = k === cols.length - 1 ? 275 : y + 11; p += `<path d="M20 ${y}H180V${b}${scal(180, 20, b, 16, 3.4)}Z" fill="${cols[k]}" stroke="#fff" stroke-width="1.6"/>`; }
    return p;
  }
  if (d.pat === 'scales') { let p = ''; for (let y = 200, r = 0; y < 268; y += 8, r++) for (let x = 60 + (r % 2) * 6; x < 144; x += 12) p += `<path d="M${x} ${y}a6 6 0 0 0 12 0" fill="none" stroke="#e2fffb" stroke-width="1.5" opacity=".7"/>`; return p +
    [[86,214],[110,226],[96,244],[120,252]].map(([x, y]) => spark(x, y, 3.4, '#fff', .9)).join(''); }
  if (d.pat === 'gown') return `<path d="M92 196L74 268H126L108 196Z" fill="url(#gu${u})"/>
    <path d="M92 196L74 268M108 196L126 268" stroke="url(#gd${u})" stroke-width="3" stroke-linecap="round"/>
    ${[[96,214],[104,230],[92,246],[110,252],[100,262],[86,262],[116,240]].map(([x, y], k) => spark(x, y, k % 2 ? 3 : 4, '#fff')).join('')}
    <path d="M40 254Q56 266 70 254Q86 268 100 256Q114 268 130 254Q144 266 160 254" fill="none" stroke="url(#gd${u})" stroke-width="3" stroke-linecap="round"/>
    ${[[55,261],[85,262],[115,262],[145,261]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff" stroke="#e7d6f7" stroke-width=".8"/>`).join('')}`;
  return '';
}
function frillSVG(d){
  if (!d.frill) return '';
  const y = HEM[d.shape], x0 = d.shape === 'gown' ? 30 : d.shape === 'pumpkin' ? 54 : 42, x1 = 200 - x0, n = d.shape === 'gown' ? 10 : 8;
  const line = mix(d.frill, '#6a3a7a', .3);
  const top = y - 12;
  return `<path d="M${x0 + 8} ${top}L${x1 - 8} ${top}L${x1 - 1} ${y + 5}${scal(x1 - 1, x0 + 1, y + 5, n, 6)}Z" fill="${d.frill}" stroke="${line}" stroke-width="1.4" stroke-linejoin="round"/>` +
    (d.frill === '#ffffff' || d.frill === '#fff4fb' ? Array.from({ length:n }, (_, i) => `<circle cx="${n1(x0 + 1 + (i + .5) * (x1 - x0 - 2) / n)}" cy="${y + 8.5}" r="1.3" fill="${line}" opacity=".5"/>`).join('') : '');
}
function sashSVG(d){
  const c = d.sash, line = mix(c, '#4a1f4a', .35), hi = mix(c, '#ffffff', .45);
  if (d.shape === 'coat') return `<path d="M82 190C94 194 106 194 118 190L118 198C106 202 94 202 82 198Z" fill="${c}" stroke="${mix(c, '#000', .3)}" stroke-width="1.2"/><rect x="95" y="190" width="10" height="9" rx="2" fill="#ffd23f" stroke="#c08a00" stroke-width="1.2"/>`;
  return `<path d="M82 189C94 193 106 193 118 189L118 198C106 202 94 202 82 198Z" fill="${c}" stroke="${line}" stroke-width="1.3"/>
    <path d="M84 191.5C94 194.5 106 194.5 116 191.5" fill="none" stroke="${hi}" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>
    ${d.brooch ? '' : `<g stroke="${line}" stroke-width="1.3" stroke-linejoin="round"><path d="M100 195C94 186 84 186 85 194C86 201 94 200 100 195Z" fill="${c}"/><path d="M100 195C106 186 116 186 115 194C114 201 106 200 100 195Z" fill="${c}"/><path d="M98 197L93 210L97 208L99 212L101 198Z" fill="${c}"/><path d="M102 197L107 210L103 208L101 212L99 198Z" fill="${c}"/><ellipse cx="100" cy="195" rx="4.2" ry="4.6" fill="${hi}"/></g>`}`;
}
function broochSVG(d, u){
  switch (d.brooch) {
    case 'candy': return `<g transform="translate(100 195)"><path d="M-6 0L-13 -6L-13 6Z" fill="#ff7ab8" stroke="#d14f8a" stroke-width="1"/><path d="M6 0L13 -6L13 6Z" fill="#ff7ab8" stroke="#d14f8a" stroke-width="1"/><circle r="7" fill="#fff" stroke="#d14f8a" stroke-width="1.2"/><path d="M-5 -4.5Q0 0 -4 5M0 -7Q5 0 0 7M5 -4.5Q8 0 4 5" stroke="#ff5fae" stroke-width="2" fill="none"/><circle cx="-2.5" cy="-3" r="1.5" fill="#fff"/></g>`;
    case 'moon': return `<g transform="translate(100 195)"><path d="M3 -8A8.5 8.5 0 1 0 3 8A6.5 6.5 0 1 1 3 -8Z" fill="url(#gd${u})" stroke="#c08a00" stroke-width="1.1"/>${spark(6, -2, 3.5, '#fff')}</g>`;
    case 'heart': return `<path d="${heartD(100, 195, 7)}" fill="#ff7ab8" stroke="#d14f8a" stroke-width="1.3"/><ellipse cx="97" cy="191.5" rx="2" ry="1.4" fill="#fff" opacity=".85"/>`;
    case 'shell': return `<g transform="translate(100 178)"><path d="M0 7L-9 -3C-6 -9 6 -9 9 -3Z" fill="#ffd6f0" stroke="#e58fbf" stroke-width="1.2" stroke-linejoin="round"/><path d="M0 7L-5 -6M0 7L0 -7M0 7L5 -6" stroke="#e58fbf" stroke-width="1"/><circle cx="0" cy="8" r="2.4" fill="#fff" stroke="#e7d6f7" stroke-width=".8"/></g>`;
    case 'gem': return `<g transform="translate(100 195)"><path d="${heartD(0, 0, 7.5)}" fill="#ff5fae" stroke="url(#gd${u})" stroke-width="2.4"/><path d="M-3 -3Q-1 -5 1 -3" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`;
  }
  return '';
}
function collarSVG(d){
  if (d.collar === 'lace') return `<path d="M85 160C92 166 108 166 115 160L114 163C108 170 92 170 86 163Z" fill="#fff" stroke="#f0b8d4" stroke-width="1.1"/>` +
    [88, 94, 100, 106, 112].map(x => `<circle cx="${x}" cy="${x === 100 ? 167.5 : x === 94 || x === 106 ? 166.6 : 164.6}" r="2.6" fill="#fff" stroke="#f0b8d4" stroke-width="1"/>`).join('');
  if (d.collar === 'leaves') return `<g stroke="#2b8a55" stroke-width="1.1" stroke-linejoin="round">${[[89, 162, -35], [100, 165, 0], [111, 162, 35]].map(([x, y, a]) => `<path d="M0 0C-6 -4 -6 -12 0 -16C6 -12 6 -4 0 0Z" fill="#4ccf86" transform="translate(${x} ${y + 9}) rotate(${a + 180})"/>`).join('')}</g><path d="M100 160q4 -6 9 -5" stroke="#2b8a55" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  if (d.collar === 'navy') return `<path d="M86 158L100 172L114 158L116 161L100 178L84 161Z" fill="#2a3a7a" stroke="#1a2458" stroke-width="1"/>`;
  return '';
}
function pearlsSVG(){ return `<path d="M90 163Q100 172 110 163" fill="none" stroke="#e7d6f7" stroke-width=".6"/>` + [[90,163],[94,166.6],[100,168.2],[106,166.6],[110,163]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#fff" stroke="#e2cfee" stroke-width=".7"/>`).join(''); }

function dressBody(d, u){
  const sk = SKIRT[d.shape];
  let s = frillSVG(d);
  s += `<path d="${sk}" fill="url(#dg${u})"/><g clip-path="url(#dc${u})">${skirtPattern(d, u)}
    <path d="M92 196C88 222 84 240 80 270M100 198V272M108 196C112 222 116 240 120 270" fill="none" stroke="${d.c[2]}" stroke-width="2.2" stroke-linecap="round" opacity=".32"/>
    <rect x="20" y="186" width="160" height="90" fill="url(#dv${u})"/></g>
    <path d="${sk}" fill="none" stroke="${d.line}" stroke-width="2" stroke-linejoin="round"/>`;
  if (d.trim) s += `<path d="${sk.replace(/^M84 192C80 210 56 226 44 250/, 'M44 250').replace(/C144 226 120 210 116 192Z$/, '')}" fill="none" stroke="${d.trim}" stroke-width="3" stroke-linecap="round" opacity=".95"/>`;
  s += `<path d="${BODICE}" fill="url(#dg${u})"/><g clip-path="url(#bc${u})"><rect x="78" y="150" width="44" height="52" fill="url(#dv${u})"/>${d.pat === 'rainbow' ? `<path d="${heartD(100, 176, 6)}" fill="#ffa2b9"/>` : ''}${d.pat === 'scales' ? '<path d="M84 186h32" stroke="#e2fffb" stroke-width="1.4" opacity=".6"/>' : ''}</g>
    <path d="${BODICE}" fill="none" stroke="${d.line}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M88 164Q92 162 95 168" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".55"/>`;
  s += collarSVG(d) + sashSVG(d) + broochSVG(d, u) + (d.pearls ? pearlsSVG() : '');
  return s;
}
const goldDefs = u => lin(`gd${u}`, [[0, '#fff6c8'], [.4, '#ffd84a'], [.75, '#f2b300'], [1, '#ffe48a']], 0, 0, 1, 1) + lin(`gu${u}`, [[0, '#ffffff'], [1, '#efe2ff']]);

function sleeve(d, x, y, a, u){
  const sl = d.shape === 'coat' ? `<path d="M-10 -2Q0 -12 10 -2L9 9Q0 13 -9 9Z" fill="url(#dg${u})" stroke="${d.line}" stroke-width="1.8" stroke-linejoin="round"/><rect x="-9.5" y="2" width="19" height="4" fill="#ffd23f"/>`
    : `<path d="M-10.5 5C-14 -4 -7 -12 0 -12C7 -12 14 -4 10.5 5C6 9 -6 9 -10.5 5Z" fill="url(#dg${u})" stroke="${d.line}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M0 -11.5V-5M-5 -10Q-4 -6 -6 -2M5 -10Q4 -6 6 -2" stroke="${d.c[2]}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".55"/>
      <path d="M-7 -6Q-5 -10 -1 -10.5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".65"/>
      <path d="M-10 5.5Q0 10.5 10 5.5" stroke="${d.frill && d.frill !== '#5b3596' ? '#ffffff' : d.c[2]}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
  return `<g transform="translate(${x} ${y}) rotate(${a})">${sl}</g>`;
}

/* ================= arms, legs, hands ================= */
const POSE = {
  idle:  { L:[[85, 168], [76, 186], [69, 203]], R:[[115, 168], [128, 186], [141, 199]], hold:24, sl:[-18, 18],
           legs:[[93, 238, 93, 280], [107, 238, 107, 280]], feet:[[92, 286, -4], [108, 286, 4]] },
  cheer: { L:[[85, 167], [62, 160], [48, 132]], R:[[115, 167], [138, 160], [152, 132]], hold:8, sl:[-48, 48],
           legs:[[93, 238, 92, 280], [107, 238, 108, 280]], feet:[[91, 286, -6], [109, 286, 6]] },
  jump:  { L:[[85, 168], [64, 168], [46, 154]], R:[[115, 168], [136, 168], [154, 154]], hold:12, sl:[-32, 32],
           legs:[[93, 238, 82, 258], [107, 238, 118, 258]], feet:[[78, 263, -28], [122, 263, 28]] },
};
function limb([a, b, c], w = 9.2){
  const d = `M${a[0]} ${a[1]}Q${b[0]} ${b[1]} ${c[0]} ${c[1]}`;
  return `<path d="${d}" fill="none" stroke="${SK.line}" stroke-width="${w + 2.6}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${SK.base}" stroke-width="${w}" stroke-linecap="round"/>`;
}
function hand(x, y, ang, grip){
  return `<g transform="translate(${x} ${y}) rotate(${ang})"><ellipse cx="0" cy="0" rx="6.4" ry="${grip ? 6 : 6.8}" fill="${SK.base}" stroke="${SK.line}" stroke-width="1.6"/>
    ${grip ? `<path d="M-3.6 -2.4q2 1.4 0 3M-.4 -3q2 1.6 0 3.4" stroke="${SK.line}" stroke-width="1" fill="none" opacity=".7"/>` : `<ellipse cx="-4.6" cy="-1.6" rx="2.6" ry="3.2" fill="${SK.base}" stroke="${SK.line}" stroke-width="1.3"/>`}
    <ellipse cx="1.6" cy="-2.2" rx="2.4" ry="1.6" fill="#fff" opacity=".45"/></g>`;
}
function legsSVG(d, pose){
  const P = POSE[pose] || POSE.idle;
  let s = '';
  for (const [x0, y0, x1, y1] of P.legs) s += limb([[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2], [x1, y1]], 8.6);
  // socks with a tiny frill
  if (!d.boots) for (const [x0, y0, x1, y1] of P.legs) {
    const t = .72, sx = x0 + (x1 - x0) * t, sy = y0 + (y1 - y0) * t;
    s += `<path d="M${n1(sx)} ${n1(sy)}L${x1} ${y1}" stroke="#fff" stroke-width="8.6" stroke-linecap="round"/><ellipse cx="${n1(sx)}" cy="${n1(sy)}" rx="6.2" ry="2.4" fill="#fff" stroke="#ecd9ee" stroke-width="1"/>`;
  }
  for (const [x, y, a] of P.feet) {
    const c = d.shoe, line = mix(c, '#2a0f3a', .4), hi = mix(c, '#ffffff', .55);
    s += `<g transform="translate(${x} ${y}) rotate(${a})">${d.boots ? `<path d="M-6 -16H6V-2H-6Z" fill="${c}" stroke="${line}" stroke-width="1.5"/><rect x="-6.5" y="-12" width="13" height="3" fill="#ffd23f"/>` : ''}
      <path d="M-9.5 1.5C-10 -5.5 -2 -7 3 -6C8 -5 11 -2 10.5 2.5C10 6.5 -9 7 -9.5 1.5Z" fill="${c}" stroke="${line}" stroke-width="1.5"/>
      ${d.boots ? '' : `<path d="M-6 -4.5Q0 -2 6 -5.2" stroke="${line}" stroke-width="1.6" fill="none" opacity=".75"/><circle cx="5.4" cy="-4.4" r="1.3" fill="#fff" opacity=".9"/>`}
      <ellipse cx="-3.5" cy="-2.6" rx="3.4" ry="1.5" fill="${hi}" opacity=".85" transform="rotate(-8 -3.5 -2.6)"/>
      <path d="M-9 4Q0 7.5 10 4" stroke="${line}" stroke-width="2" fill="none" opacity=".5"/></g>`;
  }
  return s;
}

/* ================= head items ================= */
const HATS = {
  none: () => '',
  bow: u => `<g transform="translate(66 62) rotate(-18)" stroke="#c42a77" stroke-width="1.8" stroke-linejoin="round">
      <path d="M-2 4L-12 24L-6 21L-3 27L3 6Z" fill="url(#bw${u})"/><path d="M2 4L12 22L6 20L3 26L-2 6Z" fill="url(#bw${u})"/>
      <path d="M0 0C-8 -16 -30 -20 -31 -5C-32 9 -14 12 0 4Z" fill="url(#bw${u})"/><path d="M0 0C8 -16 30 -20 31 -5C32 9 14 12 0 4Z" fill="url(#bw${u})"/>
      <path d="M-6 1C-12 -3 -18 -4 -22 -2M6 1C12 -3 18 -4 22 -2" fill="none" stroke="#d63a87" stroke-width="1.4" opacity=".6"/>
      <path d="M-25 -9C-22 -14 -15 -14 -10 -11M10 -11C15 -14 22 -14 25 -9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".75"/>
      <ellipse cx="0" cy="1.5" rx="6.4" ry="7" fill="url(#bw${u})"/><ellipse cx="-1.6" cy="-1" rx="2.4" ry="1.8" fill="#fff" stroke="none" opacity=".7"/>
      <circle cx="-20" cy="2" r="1.8" fill="#fff" stroke="none"/><circle cx="-14" cy="-6" r="1.5" fill="#fff" stroke="none"/><circle cx="18" cy="2" r="1.8" fill="#fff" stroke="none"/><circle cx="14" cy="-7" r="1.5" fill="#fff" stroke="none"/></g>`,
  tiara: u => `<g stroke="#b88200" stroke-width="1.6" stroke-linejoin="round">
      <path d="M68 66C70 58 78 54 84 52L86 42L92 49L100 32L108 49L114 42L116 52C122 54 130 58 132 66C122 60 112 58 100 58C88 58 78 60 68 66Z" fill="url(#gd${u})"/>
      <path d="M72 62C82 57 118 57 128 62" fill="none" stroke="#fff" stroke-width="1.6" opacity=".7"/></g>
      <path d="${heartD(100, 48, 5.5)}" fill="#ff5fae" stroke="#c42a77" stroke-width="1.2"/><ellipse cx="98" cy="45.5" rx="1.6" ry="1.1" fill="#fff"/>
      <circle cx="86" cy="41.5" r="2.6" fill="#7fd8ff" stroke="#3a9ccf" stroke-width="1"/><circle cx="114" cy="41.5" r="2.6" fill="#7fd8ff" stroke="#3a9ccf" stroke-width="1"/>
      <circle cx="100" cy="31" r="2.6" fill="#fff" stroke="#e2cfee" stroke-width="1"/>${spark(124, 46, 5, '#fff')}`,
  flowers: () => {
    const cols = ['#ffb3d6', '#ffffff', '#c9b0ff', '#ffc58a', '#ff8cc6', '#9eecbc', '#fff0a0'];
    let s = '';
    [206, 236, 266, 296, 326].forEach(deg => { const a = deg * Math.PI / 180, x = 100 + 54 * Math.cos(a), y = 108 + 54 * Math.sin(a); s += `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="7" ry="3.4" fill="#5cc98a" stroke="#2f9a5e" stroke-width="1" transform="rotate(${deg + 70} ${n1(x)} ${n1(y)})"/>`; });
    [192, 214, 236, 258, 282, 304, 326, 348].forEach((deg, k) => { const a = deg * Math.PI / 180; s += flower(100 + 52 * Math.cos(a), 108 + 52 * Math.sin(a), k % 2 ? 7.4 : 8.6, cols[k % 7], k % 3 ? '#ffd23f' : '#ff9ac6', k * 23); });
    return s;
  },
  cat: u => mirror(`<g transform="translate(68 62) rotate(-16)"><path d="M-15 10C-14 -6 -7 -20 0 -27C7 -20 14 -6 15 10Z" fill="url(#ce${u})" stroke="#1f1530" stroke-width="2" stroke-linejoin="round"/>
      <path d="M-8 6C-7 -4 -3 -12 0 -16C3 -12 7 -4 8 6Z" fill="#ffb3d0"/><path d="M-3 -8C-2 -14 -1 -18 0 -20" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".5"/></g>`),
  police: u => `<path d="M58 78C54 46 76 30 100 30C124 30 146 46 142 78Z" fill="url(#pc${u})" stroke="#1a2768" stroke-width="2" stroke-linejoin="round"/>
      <path d="M58 66H142V79H58Z" fill="#1d2d6b" stroke="#141f4d" stroke-width="1.6"/><path d="M58 70H142" stroke="#ffd23f" stroke-width="1.6"/>
      <path d="M60 79C78 94 122 94 140 79C122 86 78 86 60 79Z" fill="#20223a" stroke="#0e0f1f" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M74 84C90 90 110 90 122 86" stroke="#fff" stroke-width="1.6" fill="none" opacity=".35" stroke-linecap="round"/>
      <path d="M100 41L111 45V54C111 60 106 64 100 66C94 64 89 60 89 54V45Z" fill="url(#gd${u})" stroke="#b88200" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="${starD(100, 53.5, 5.2, 2.3)}" fill="#fff" opacity=".9"/><path d="M70 46C78 38 88 35 96 34" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".35"/>`,
  witch: u => `<ellipse cx="100" cy="68" rx="66" ry="13" fill="url(#wb${u})" stroke="#2e1a52" stroke-width="2" transform="rotate(-5 100 68)"/>
      <path d="M68 66C82 50 84 34 92 18C96 10 106 4 122 6C114 10 112 16 114 24C118 40 126 54 134 64C112 72 88 72 68 66Z" fill="url(#wh${u})" stroke="#2e1a52" stroke-width="2" stroke-linejoin="round"/>
      <path d="M71 58C90 64 112 64 131 56L134 64C112 72 88 72 68 66Z" fill="#ff9a2e" stroke="#b85400" stroke-width="1.5" stroke-linejoin="round"/>
      <rect x="94" y="56" width="13" height="12" rx="2.5" fill="none" stroke="url(#gd${u})" stroke-width="3" transform="rotate(-4 100 62)"/>
      <path d="M90 26C88 34 84 44 80 52" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".3"/>
      <path d="${starD(108, 36, 4.4, 1.9)}" fill="#ffd23f"/>${spark(98, 46, 3.4, '#fff', .9)}<circle cx="118" cy="48" r="1.6" fill="#ffd23f"/>`,
  horn: u => mirror(`<g transform="translate(70 62) rotate(-22)"><path d="M-10 8C-10 -4 -5 -14 0 -20C5 -14 10 -4 10 8Z" fill="#fff" stroke="#e7b3d0" stroke-width="1.8" stroke-linejoin="round"/><path d="M-5 5C-5 -3 -2 -9 0 -12C2 -9 5 -3 5 5Z" fill="#ffc2dd"/></g>`) +
      `<path d="M90 60L100 6L110 60Q100 64 90 60Z" fill="url(#hg${u})" stroke="#c99a12" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M91.5 50Q100 47 108.5 44M93.5 39Q100 36 106.5 33M95.6 28Q100 26 104.4 23M97.6 17.5L102.4 14" stroke="#d9a400" stroke-width="2" stroke-linecap="round" fill="none"/>
      <path d="M95 52L99 18" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/>
      ${flower(85, 60, 6.6, '#ff9ac6', '#fff0a0', 10)}${flower(115, 60, 6.6, '#c9b0ff', '#fff0a0', 40)}${flower(100, 64, 5, '#ffffff', '#ffd23f')}`,
  crown: u => `<g stroke="#a87400" stroke-width="1.8" stroke-linejoin="round">
      <path d="M70 62L66 30L82 44L91 24L100 38L109 24L118 44L134 30L130 62Q100 56 70 62Z" fill="url(#gd${u})"/>
      <path d="M69 56Q100 50 131 56L130 66Q100 60 70 66Z" fill="url(#gd${u})"/></g>
      <path d="M72 44L75 58M88 34L90 48" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>
      <circle cx="66" cy="29" r="3.4" fill="#fff" stroke="#e2cfee" stroke-width="1"/><circle cx="91" cy="23" r="3.4" fill="#fff" stroke="#e2cfee" stroke-width="1"/><circle cx="109" cy="23" r="3.4" fill="#fff" stroke="#e2cfee" stroke-width="1"/><circle cx="134" cy="29" r="3.4" fill="#fff" stroke="#e2cfee" stroke-width="1"/>
      <path d="${heartD(100, 49, 6)}" fill="#ff4f7a" stroke="#b8204a" stroke-width="1.2"/><ellipse cx="97.6" cy="46" rx="1.8" ry="1.2" fill="#fff"/>
      <circle cx="80" cy="59" r="3" fill="#4aa8ff" stroke="#1f6ad6" stroke-width="1"/><circle cx="120" cy="59" r="3" fill="#3fd18a" stroke="#1f9a5e" stroke-width="1"/>${spark(136, 44, 5, '#fff')}`,
};
const hatDefs = (id, u) => ({
  bow: rad(`bw${u}`, [[0, '#ffc2e2'], [.55, '#ff6fb5'], [1, '#e23e8c']], .38, .3, .8),
  cat: lin(`ce${u}`, ['#5a476e', '#2e2340']),
  police: lin(`pc${u}`, ['#5876d9', '#2c43a3']),
  witch: lin(`wh${u}`, [[0, '#a57ae0'], [1, '#55308f']], 0, 0, 1, 1) + lin(`wb${u}`, ['#6a43a8', '#3c2270']),
  horn: lin(`hg${u}`, [[0, '#fff8d6'], [.5, '#ffe07a'], [1, '#f5bb2a']], 0, 0, 1, 0),
}[id] || '');

/* ================= wings ================= */
const WINGS = {
  none: () => '',
  fairy: u => mirror(`<path d="M98 176C82 140 46 104 22 116C6 126 12 162 40 174C60 182 84 180 98 178Z" fill="url(#wf${u})" stroke="#9fd8ff" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M98 184C80 188 48 202 42 222C38 238 58 242 72 230C86 218 94 198 98 186Z" fill="url(#wp${u})" stroke="#ffb3dc" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M96 176C80 160 56 138 30 126M96 177C76 172 52 166 32 160M96 186C82 196 68 210 56 226" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>
      <path d="M30 128C24 136 24 150 34 160" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>
      ${spark(40, 140, 5, '#fff')}${spark(62, 214, 3.6, '#fff')}<circle cx="54" cy="132" r="1.6" fill="#fff"/><circle cx="70" cy="154" r="1.2" fill="#fff"/>`),
  butterfly: u => mirror(`<path d="M98 174C80 130 34 96 16 118C2 138 20 168 52 176C70 180 88 178 98 176Z" fill="url(#wb1${u})" stroke="#d24f8e" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M98 184C76 188 42 204 42 226C42 242 66 242 78 228C90 214 96 198 98 186Z" fill="url(#wb2${u})" stroke="#e08a2e" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M90 170C74 150 48 126 30 124C22 132 26 152 46 164C62 172 80 172 90 170Z" fill="#fff" opacity=".22"/>
      <circle cx="30" cy="128" r="6.5" fill="#fff" opacity=".9"/><circle cx="24" cy="146" r="4" fill="#fff" opacity=".85"/><circle cx="44" cy="118" r="3.4" fill="#fff" opacity=".85"/>
      <circle cx="56" cy="226" r="5" fill="#fff" opacity=".85"/><circle cx="68" cy="214" r="3" fill="#fff" opacity=".8"/>
      <path d="M96 176C76 160 52 140 34 132M96 186C84 198 70 212 60 224" fill="none" stroke="#a83a6c" stroke-width="1.2" opacity=".35"/>`),
  bat: u => mirror(`<path d="M98 172C82 148 54 124 20 120C28 132 26 144 14 152C30 154 34 166 28 178C42 176 50 184 50 198C60 190 72 192 78 204C82 190 90 186 98 186Z" fill="url(#wt${u})" stroke="#24123d" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M96 176C80 162 50 140 22 122M96 180C76 172 48 162 16 152M96 183C78 182 50 180 30 178M97 185C82 190 64 194 52 198" fill="none" stroke="#b18ae0" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>
      <path d="M34 128C44 132 58 140 68 148" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".25"/>`),
  angel: u => mirror([[208, 80], [192, 78], [176, 70], [161, 60], [147, 48]].map(([a, L]) => {
      const r = a * Math.PI / 180, cx = n1(96 + Math.cos(r) * (L / 2 + 2)), cy = n1(172 + Math.sin(r) * (L / 2 + 2));
      return `<ellipse cx="${cx}" cy="${cy}" rx="${L / 2}" ry="10" transform="rotate(${a} ${cx} ${cy})" fill="url(#wa${u})" stroke="#9fb0e2" stroke-width="2"/>`;
    }).join('') + `<path d="M98 164C90 140 66 120 40 122C30 124 28 134 36 140C50 152 74 168 98 186Z" fill="#fff" stroke="#9fb0e2" stroke-width="2" stroke-linejoin="round"/>
      <path d="M40 140Q48 146 54 144Q60 154 68 152Q74 162 82 160" fill="none" stroke="#c9d2f0" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M44 128C58 126 74 136 84 150" fill="none" stroke="#eef2ff" stroke-width="3" stroke-linecap="round"/>${spark(30, 168, 4.4, '#fff')}`),
  rainbow: u => {
    const cols = ['#ff9fb4', '#ffc58a', '#ffe680', '#9eecbc', '#9ccbff', '#c6b0ff'];
    const up = 'M98 176C82 134 40 100 18 116C2 128 12 164 44 176C62 182 84 180 98 178Z', lo = 'M98 184C80 188 46 202 42 224C40 240 62 242 74 230C88 216 94 198 98 186Z';
    return mirror(`<clipPath id="wr${u}"><path d="${up}"/><path d="${lo}"/></clipPath>
      <g clip-path="url(#wr${u})">${cols.map((c, k) => `<circle cx="98" cy="180" r="${92 - k * 13}" fill="${c}"/>`).join('')}</g>
      <path d="${up}" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="${lo}" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
      <path d="${up}" fill="none" stroke="#c48ad6" stroke-width="1.2" stroke-linejoin="round" opacity=".7"/><path d="${lo}" fill="none" stroke="#c48ad6" stroke-width="1.2" stroke-linejoin="round" opacity=".7"/>
      ${spark(36, 132, 5.4, '#fff')}${spark(58, 222, 4, '#fff')}<circle cx="28" cy="152" r="1.8" fill="#fff"/>`);
  },
};
const wingDefs = (id, u) => ({
  fairy: lin(`wf${u}`, [[0, '#e6f7ff', .95], [.6, '#b9e6ff', .85], [1, '#e4d4ff', .85]], 0, 0, 1, 1) + lin(`wp${u}`, [[0, '#ffe8f6', .95], [1, '#ffc2e4', .85]], 0, 0, 1, 1),
  butterfly: lin(`wb1${u}`, [[0, '#ff7fb8'], [.6, '#ffa0c8'], [1, '#ffd08a']], 1, 1, 0, 0) + lin(`wb2${u}`, [[0, '#ffe07a'], [1, '#ff9ac0']], 0, 0, 1, 1),
  bat: lin(`wt${u}`, [[0, '#8a5cc4'], [1, '#3a2266']], 1, 0, 0, 1),
  angel: lin(`wa${u}`, [[0, '#ffffff'], [.45, '#f3f6ff'], [1, '#c7d3f7']], 0, 0, 0, 1),
}[id] || '');

/* ================= hand items (grip at 0,0; the item rises along -y) ================= */
const HANDS = {
  none: () => '',
  lollipop: () => `<path d="M0 10V-40" stroke="#dccbe6" stroke-width="6.4" stroke-linecap="round"/><path d="M0 10V-40" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
      <circle cx="0" cy="-55" r="17" fill="url(#lp${''})" stroke="#d14f8a" stroke-width="2"/>
      <path d="M0 -55a3 3 0 0 1 3 3a6 6 0 0 1 -6 6a9 9 0 0 1 -9 -9a12 12 0 0 1 12 -12a14.5 14.5 0 0 1 14.5 14.5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>
      <ellipse cx="-7" cy="-64" rx="5" ry="3" fill="#fff" opacity=".7" transform="rotate(-35 -7 -64)"/>
      <path d="M0 -36C-6 -42 -12 -38 -9 -33C-6 -29 -2 -33 0 -36ZM0 -36C6 -42 12 -38 9 -33C6 -29 2 -33 0 -36Z" fill="#9a63ff" stroke="#6a3fc0" stroke-width="1"/>`,
  icecream: () => `<path d="M-12 -12L0 18L12 -12Z" fill="url(#ic${''})" stroke="#c07a30" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M-8 -6L4 10M-2 -12L8 2M5 -12L10 -6M-9 0L-3 -12M-5 8L8 -12" stroke="#c07a30" stroke-width="1.1" opacity=".7"/>
      <circle cx="-6" cy="-17" r="9.5" fill="#ffb3cf" stroke="#e2789f" stroke-width="1.6"/><circle cx="6.5" cy="-18" r="9.5" fill="#a8f0d8" stroke="#4fbf9a" stroke-width="1.6"/>
      <circle cx="0" cy="-29" r="9.5" fill="#fff6e0" stroke="#e8c88a" stroke-width="1.6"/>
      <path d="M-14 -13Q-12 -8 -10 -12Q-8 -6 -5 -10Q-1 -6 2 -10Q5 -6 8 -10Q11 -7 15 -13" fill="#ffb3cf" stroke="#e2789f" stroke-width="1.3" stroke-linejoin="round"/>
      <circle cx="-9" cy="-20" r="2.2" fill="#fff" opacity=".8"/><circle cx="4" cy="-22" r="2.2" fill="#fff" opacity=".8"/><circle cx="-3" cy="-32" r="2.2" fill="#fff" opacity=".9"/>
      <path d="M1 -38Q3 -44 7 -46" stroke="#3cb371" stroke-width="1.6" fill="none"/><circle cx="1" cy="-39" r="4.2" fill="#ff4f64" stroke="#c0283c" stroke-width="1.2"/><circle cx="-.4" cy="-40.4" r="1.2" fill="#fff"/>
      ${[[-6, -26, '#ff5fae'], [4, -30, '#3a86ff'], [-1, -24, '#ffd23f'], [6, -25, '#2fc27a']].map(([x, y, c], k) => `<rect x="${x - 2}" y="${y - .7}" width="4" height="1.4" rx=".7" fill="${c}" transform="rotate(${k * 50} ${x} ${y})"/>`).join('')}`,
  balloon: () => `<path d="M0 2C-6 -20 12 -42 6 -66" fill="none" stroke="#9a8aa8" stroke-width="1.4"/>
      <path d="M6 -66L2 -61L10 -61Z" fill="#e2468e" stroke="#c42a77" stroke-width="1"/>
      <path d="${heartD(6, -90, 22)}" fill="url(#bl2${''})" stroke="#c42a77" stroke-width="2"/>
      <ellipse cx="-4" cy="-100" rx="5" ry="8" fill="#fff" opacity=".6" transform="rotate(35 -4 -100)"/><circle cx="2" cy="-108" r="2" fill="#fff" opacity=".8"/>`,
  basket: () => `<path d="M-14 26C-15 -4 15 -4 14 26" fill="none" stroke="#4a2d6e" stroke-width="3" stroke-linecap="round"/>
      <path d="M-7 18L-3 8L1 18Z" fill="#ff5fae"/><circle cx="6" cy="14" r="5" fill="#7fd8ff" stroke="#3a9ccf" stroke-width="1"/><rect x="-12" y="12" width="9" height="6" rx="3" fill="#ffd23f" stroke="#c08a00" stroke-width="1"/>
      <ellipse cx="0" cy="33" rx="19" ry="15" fill="url(#pk${''})" stroke="#c45a00" stroke-width="2"/>
      <path d="M-7 19Q-12 33 -7 47M7 19Q12 33 7 47M0 18V48" stroke="#d96a0a" stroke-width="1.6" fill="none" opacity=".6"/>
      <path d="M-11 28L-6 23L-2 29Z M11 28L6 23L2 29Z" fill="#4a2346"/><path d="M-10 36Q0 44 10 36Q6 39 3 37L0 40L-3 37Q-6 39 -10 36Z" fill="#4a2346"/>
      <ellipse cx="-9" cy="24" rx="4" ry="2.4" fill="#fff" opacity=".45" transform="rotate(-30 -9 24)"/>`,
  wand: () => `<path d="M0 10V-44" stroke="#8f63e6" stroke-width="6" stroke-linecap="round"/><path d="M0 10V-44" stroke="#e6d6ff" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="4 4"/>
      <path d="M-1 -48C-10 -46 -16 -40 -18 -32M1 -48C10 -46 16 -40 18 -32" fill="none" stroke="#ff8cc6" stroke-width="2.4" stroke-linecap="round"/>
      <path d="${starD(0, -60, 17, 8)}" fill="url(#ws${''})" stroke="#e8a800" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="${starD(0, -60, 7, 3.2)}" fill="#fff" opacity=".55"/>
      ${spark(18, -76, 5, '#ff8cc6')}${spark(-17, -74, 4, '#7fd8ff')}${spark(14, -44, 3, '#fff')}`,
};
// the item gradients are shared by every item (ids are suffixed per svg)
const handDefs = (id, u) => ({
  lollipop: rad(`lp${u}`, [[0, '#ffc2e2'], [.6, '#ff7ab8'], [1, '#e8459a']], .4, .35, .7),
  icecream: lin(`ic${u}`, ['#ffd99a', '#e3a055']),
  balloon: rad(`bl2${u}`, [[0, '#ffc4e1'], [.55, '#ff6fb5'], [1, '#d93f8c']], .35, .3, .8),
  basket: rad(`pk${u}`, [[0, '#ffc678'], [.6, '#ff9330'], [1, '#e06a00']], .4, .35, .75),
  wand: rad(`ws${u}`, [[0, '#fff7c2'], [.55, '#ffd84a'], [1, '#f5b100']], .45, .4, .7),
}[id] || '');
const handItem = (id, u) => (HANDS[id] || HANDS.none)().replace(/url\(#(lp|ic|bl2|pk|ws)\)/g, `url(#$1${u})`);
const HAND_TILT = { balloon:.4 };

/* ================= the princess ================= */
// pose: 'idle' | 'cheer' | 'jump'
export function avatarSVG(wear, { standalone = false, pose = 'idle' } = {}){
  wear = wear || store.P.wear;
  if (!POSE[pose]) pose = 'idle';
  const u = ++UID, P = POSE[pose], d = DRESS[wear.dress] || DRESS.pink;
  const { h, defs:hd } = hairDefs(wear.hair, u);
  const hat = HATS[wear.hat] ? wear.hat : 'none', wings = WINGS[wear.wings] ? wear.wings : 'none', held = HANDS[wear.hand] ? wear.hand : 'none';
  const defs = `<defs>${hd}${dressDefs(d, u)}${goldDefs(u)}${hatDefs(hat, u)}${wingDefs(wings, u)}${handDefs(held, u)}
    ${rad(`sk${u}`, [[0, SK.hi], [.55, SK.base], [1, SK.lo]], .42, .36, .72)}
    ${rad(`bl${u}`, [[0, SK.blush, .75], [1, SK.blush, 0]])}
    ${lin(`ir${u}`, [[0, '#2c1438'], [.42, '#5b2a7e'], [.8, '#a86de6'], [1, '#ecc8ff']])}
    ${rad(`gl${u}`, [[0, '#ffffff', .9], [1, '#ffffff', 0]])}</defs>`;
  const [Ls, Le, Lh] = P.L, [Rs, Re, Rh] = P.R;
  const armAng = (s, e) => Math.atan2(e[1] - s[1], e[0] - s[0]) * 180 / Math.PI - 90;
  const tilt = P.hold * (HAND_TILT[held] ?? 1);
  const item = held !== 'none' ? `<g transform="translate(${Rh[0]} ${Rh[1]}) rotate(${tilt})">${handItem(held, u)}</g>` : '';
  const arms = limb(P.L) + limb(P.R) + item + hand(Lh[0], Lh[1], armAng(Le, Lh), false) + hand(Rh[0], Rh[1], armAng(Re, Rh), held !== 'none') +
    sleeve(d, 84, 169, P.sl[0], u) + sleeve(d, 116, 169, P.sl[1], u);
  const sparkles = pose === 'cheer' ? `${spark(30, 84, 9, '#ffd23f')}${spark(172, 76, 10, '#ff8cc6')}${spark(20, 112, 5, '#fff')}${spark(182, 108, 6, '#b79bff')}${spark(46, 58, 4.6, '#7fd8ff')}${spark(160, 46, 5, '#ffd23f')}` : '';
  const attrs = standalone ? 'xmlns="http://www.w3.org/2000/svg" width="400" height="600"' : 'class="avatar" aria-hidden="true"';
  return `<svg ${attrs} viewBox="0 0 200 300" data-pose="${pose}">${defs}
    ${standalone ? '' : `<ellipse cx="100" cy="293" rx="${pose === 'jump' ? 26 : 40}" ry="5.5" fill="#4a2b5e" opacity=".16"/>`}
    <g class="wings">${WINGS[wings](u)}</g>
    ${hairBack(h, u)}
    ${legsSVG(d, pose)}
    ${dressBody(d, u)}
    <g class="head">${headSVG(u, pose)}${hairFront(h, u)}${HATS[hat](u)}</g>
    ${arms}
    ${sparkles}
  </svg>`;
}

/* ================= backdrops (400×300, ground at the bottom) ================= */
function cloud(x, y, s, u, op = 1){
  return `<g transform="translate(${x} ${y}) scale(${s})"${op < 1 ? ` opacity="${op}"` : ''}><path d="M-34 10C-46 10 -48 -6 -36 -8C-38 -24 -16 -30 -8 -18C-4 -34 22 -34 26 -16C40 -22 52 -8 42 4C48 10 42 14 36 14H-30C-34 14 -36 12 -34 10Z" fill="url(#cl${u})"/>
    <path d="M-30 -10C-28 -18 -18 -20 -12 -14M2 -26C10 -28 18 -24 20 -16" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/></g>`;
}
const sceneDefs = u => lin(`cl${u}`, [[0, '#ffffff'], [.6, '#ffffff'], [1, '#eadcff']]) + rad(`sun${u}`, [[0, '#ffffff', .95], [.35, '#fff6d6', .55], [1, '#fff6d6', 0]]);
function tinyFlowers(pts, cols){ return pts.map(([x, y], k) => flower(x, y, 3.2, cols[k % cols.length], '#ffd23f', k * 31)).join(''); }
function gumdrop(x, y, c, s = 1){
  const line = mix(c, '#5a1f4a', .35);
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-12 6C-12 -10 -6 -16 0 -16C6 -16 12 -10 12 6Z" fill="${c}" stroke="${line}" stroke-width="1.6"/><path d="M-12 6H12" stroke="${line}" stroke-width="1.6"/>
    <ellipse cx="-5" cy="-8" rx="3" ry="4.6" fill="#fff" opacity=".55" transform="rotate(20 -5 -8)"/>${[[-3, 0], [4, -5], [6, 2], [-7, -2]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r=".9" fill="#fff" opacity=".8"/>`).join('')}</g>`;
}
function lolliTree(x, y, h, c1, c2, r){
  return `<path d="M${x} ${y}V${y - h}" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M${x} ${y}V${y - h}" stroke="${c2}" stroke-width="5" stroke-dasharray="4 5" opacity=".7"/>
    <circle cx="${x}" cy="${y - h - r * .7}" r="${r}" fill="${c1}" stroke="${mix(c1, '#5a1f4a', .3)}" stroke-width="2"/>
    <path d="M${x} ${y - h - r * .7}m0 0a${r * .2} ${r * .2} 0 0 1 ${r * .2} ${r * .2}a${r * .4} ${r * .4} 0 0 1 ${-r * .4} ${r * .4}a${r * .6} ${r * .6} 0 0 1 ${-r * .6} ${-r * .6}a${r * .8} ${r * .8} 0 0 1 ${r * .8} ${-r * .8}" fill="none" stroke="#fff" stroke-width="${n1(r * .2)}" stroke-linecap="round" opacity=".9"/>
    <ellipse cx="${n1(x - r * .45)}" cy="${n1(y - h - r * 1.2)}" rx="${n1(r * .28)}" ry="${n1(r * .16)}" fill="#fff" opacity=".7" transform="rotate(-35 ${n1(x - r * .45)} ${n1(y - h - r * 1.2)})"/>`;
}
function candyHill(cx, base, w, h, grad, line, u, k){
  const dome = `M${cx - w} ${base}C${cx - w} ${base - h * 1.33} ${cx + w} ${base - h * 1.33} ${cx + w} ${base}Z`, cap = base - h * .58;
  let drip = `M${cx - w} ${base - h * 2}V${cap}`;
  const n = 7, step = w * 2 / n;
  for (let i = 0; i < n; i++) { const dd = [10, 4, 14, 6, 12, 3, 9][i] * h / 90; drip += `q${n1(step * .25)} 0 ${n1(step * .3)} ${n1(dd)}q${n1(step * .12)} ${n1(dd * .5)} ${n1(step * .24)} 0q${n1(step * .1)} ${n1(-dd)} ${n1(step * .46)} ${n1(-dd)}`; }
  drip += `V${base - h * 2}Z`;
  const sp = [[-.3, .82], [.2, .9], [.36, .74], [-.1, .7], [0, .95], [-.42, .66]].map(([a, b], i) => `<rect x="${n1(cx + a * w - 3.5)}" y="${n1(base - h * b - 1.3)}" width="7" height="2.6" rx="1.3" fill="${RAINBOW[(i * 2 + k.charCodeAt(0)) % 7]}" transform="rotate(${i * 47} ${n1(cx + a * w)} ${n1(base - h * b)})"/>`).join('');
  return `<clipPath id="hc${k}${u}"><path d="${dome}"/></clipPath><path d="${dome}" fill="url(#${grad})"/>
    <g clip-path="url(#hc${k}${u})"><path d="${drip}" fill="#fffafc"/>${sp}<path d="M${cx - w * .7} ${base - h * .5}C${cx - w * .6} ${base - h * .9} ${cx - w * .2} ${base - h * 1.05} ${cx + w * .1} ${base - h}" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".55"/></g>
    <path d="${dome}" fill="none" stroke="${line}" stroke-width="2"/>`;
}
function cane(x, y, h, r){
  const d = `M${x} ${y}V${y - h}a${Math.abs(r)} ${Math.abs(r)} 0 0 ${r > 0 ? 1 : 0} ${2 * r} 0v6`;
  return `<path d="${d}" fill="none" stroke="#c92a4a" stroke-width="10" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="#ff4f64" stroke-width="7" stroke-dasharray="5 6"/><path d="M${x - 1.6} ${y - 4}V${y - h + 2}" stroke="#fff" stroke-width="1.6" opacity=".6"/>`;
}
function pumpkin(x, y, s, u, glow = true){
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="13" rx="20" ry="4" fill="#120826" opacity=".35"/>
    <path d="M-1 -14C-2 -20 1 -24 5 -25" stroke="#3b8a3e" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <ellipse cx="-9" cy="0" rx="12" ry="13" fill="url(#pm${u})"/><ellipse cx="9" cy="0" rx="12" ry="13" fill="url(#pm${u})"/><ellipse cx="0" cy="0" rx="11" ry="14" fill="url(#pm${u})" stroke="#b84d00" stroke-width="1.2"/>
    <path d="M-20 -2C-20 -10 -14 -14 -8 -13M20 -2C20 -10 14 -14 8 -13" fill="none" stroke="#b84d00" stroke-width="1.2"/>
    ${glow ? `<path d="M-10 -4L-5 -9L-1 -3Z M10 -4L5 -9L1 -3Z" fill="#ffe680"/><path d="M-11 3Q0 12 11 3Q7 6 4 4.5L2 7.5L-1 5L-4 7.5L-6 4.5Q-8 6 -11 3Z" fill="#ffe680"/>` : ''}
    <ellipse cx="-12" cy="-6" rx="3" ry="5" fill="#fff" opacity=".35" transform="rotate(25 -12 -6)"/></g>`;
}
function ghost(x, y, s){
  return `<g transform="translate(${x} ${y}) scale(${s})" opacity=".95"><path d="M-14 14V-2C-14 -12 -8 -18 0 -18C8 -18 14 -12 14 -2V14L9 10L4 15L0 11L-4 15L-9 10Z" fill="#fbf7ff" stroke="#c8b6e8" stroke-width="1.4" stroke-linejoin="round"/>
    <ellipse cx="-5" cy="-4" rx="2" ry="2.8" fill="#3a2346"/><ellipse cx="5" cy="-4" rx="2" ry="2.8" fill="#3a2346"/><ellipse cx="-8" cy="2" rx="2.6" ry="1.5" fill="#ffb3cf"/><ellipse cx="8" cy="2" rx="2.6" ry="1.5" fill="#ffb3cf"/>
    <path d="M-2 2Q0 4 2 2" stroke="#3a2346" stroke-width="1.2" fill="none" stroke-linecap="round"/><circle cx="-4.4" cy="-5.2" r=".8" fill="#fff"/><circle cx="5.6" cy="-5.2" r=".8" fill="#fff"/></g>`;
}
function bat(x, y, s){ return `<path transform="translate(${x} ${y}) scale(${s})" d="M0 0C-6 -8 -16 -10 -26 -4C-20 -2 -18 2 -18 6C-12 2 -6 4 -4 8C-2 4 0 4 0 4C0 4 2 4 4 8C6 4 12 2 18 6C18 2 20 -2 26 -4C16 -10 6 -8 0 0Z" fill="#1a0f30"/>`; }
function fish(x, y, c, dir, s, u){
  const line = mix(c, '#3a1f2a', .4);
  return `<g transform="translate(${x} ${y}) scale(${dir * s} ${s})"><path d="M-14 0L-26 -10Q-23 0 -26 10Z" fill="${c}" stroke="${line}" stroke-width="1.4" stroke-linejoin="round"/>
    <ellipse cx="0" cy="0" rx="17" ry="12" fill="${c}" stroke="${line}" stroke-width="1.6"/><path d="M-2 -11Q4 -18 10 -10" fill="${c}" stroke="${line}" stroke-width="1.3"/>
    <path d="M-4 -10Q-8 0 -4 10" stroke="#fff" stroke-width="2.4" fill="none" opacity=".7"/><circle cx="8" cy="-2" r="3.6" fill="#fff"/><circle cx="9" cy="-2" r="2.2" fill="#2a1438"/><circle cx="9.8" cy="-2.8" r=".8" fill="#fff"/>
    <path d="M12 4Q14 5 15 3" stroke="${line}" stroke-width="1.2" fill="none" stroke-linecap="round"/><ellipse cx="-2" cy="-5" rx="5" ry="2.2" fill="#fff" opacity=".45"/></g>`;
}
function bubbles(pts){ return pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" fill-opacity=".12" stroke="#fff" stroke-width="${n1(Math.max(1, r * .18))}" stroke-opacity=".85"/><circle cx="${n1(x - r * .35)}" cy="${n1(y - r * .35)}" r="${n1(r * .25)}" fill="#fff" opacity=".9"/>`).join(''); }
function seaweed(x, y, h, c, lean){
  return `<path d="M${x - 4} ${y}C${x - 14 + lean} ${y - h * .3} ${x + 10 + lean} ${y - h * .55} ${x - 2 + lean} ${y - h}C${x + 14 + lean} ${y - h * .6} ${x - 6 + lean} ${y - h * .3} ${x + 5} ${y}Z" fill="${c}" stroke="${mix(c, '#0a3a2a', .35)}" stroke-width="1.6" stroke-linejoin="round"/>`;
}
function coral(x, y, s, c){
  const line = mix(c, '#5a1030', .3);
  const br = `M0 0V-24M0 -12L-10 -22V-32M0 -16L9 -26V-34M-10 -22L-16 -28M9 -26L15 -30`;
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="${br}" stroke="${line}" stroke-width="8.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="${br}" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M-2 -6V-20M-11 -26V-30" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".45"/></g>`;
}
function starfish(x, y, s, c, rot){ return `<g transform="translate(${x} ${y}) scale(${s}) rotate(${rot})"><path d="${starD(0, 0, 10, 4.4)}" fill="${c}" stroke="${mix(c, '#5a1030', .3)}" stroke-width="1.4" stroke-linejoin="round"/>${[[0, -5], [4.5, -1.5], [3, 4], [-3, 4], [-4.5, -1.5]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r=".9" fill="#fff" opacity=".8"/>`).join('')}</g>`; }
function shell(x, y, s){ return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 6L-9 -3C-6 -10 6 -10 9 -3Z" fill="#ffd6e8" stroke="#e08fb4" stroke-width="1.2" stroke-linejoin="round"/><path d="M0 6L-5 -7M0 6V-8M0 6L5 -7" stroke="#e08fb4" stroke-width="1"/></g>`; }

const SCENES = {
  sky: u => `<defs>${lin(`sg${u}`, [[0, '#ffc9e6'], [.55, '#efdcff'], [1, '#fff2f8']])}${lin(`h1${u}`, ['#c9f5dc', '#a9e9c4'])}${lin(`h2${u}`, ['#a6ecc3', '#7fdcaa'])}${lin(`h3${u}`, ['#8fe0b4', '#5fcb93'])}</defs>
    <rect width="400" height="300" fill="url(#sg${u})"/>
    <circle cx="70" cy="56" r="120" fill="url(#sun${u})"/>
    <g fill="none" opacity=".9">${['#ff9fb4', '#ffc58a', '#ffe680', '#9eecbc', '#9ccbff', '#c6b0ff'].map((c, i) => `<path d="M${40 + i * 13} 300A${160 - i * 13} ${170 - i * 13} 0 0 1 ${360 - i * 13} 300" stroke="${c}" stroke-width="13.5"/>`).join('')}
      <path d="M33 300A167 177 0 0 1 367 300" stroke="#fff" stroke-width="3" opacity=".7"/></g>
    ${spark(330, 50, 7, '#fff')}${spark(120, 34, 5, '#fff', .9)}${spark(240, 70, 4, '#fff6b0')}${spark(28, 128, 4, '#fff')}${spark(372, 128, 5, '#fff', .9)}<circle cx="190" cy="30" r="2" fill="#fff"/><circle cx="300" cy="104" r="1.6" fill="#fff"/><circle cx="80" cy="150" r="1.6" fill="#fff"/>
    ${cloud(300, 60, 1.05, u)}${cloud(150, 50, .7, u, .95)}
    <path d="M0 236C60 214 120 222 170 234C230 216 320 212 400 232V300H0Z" fill="url(#h1${u})"/>
    ${cloud(52, 232, 1.25, u)}${cloud(352, 228, 1.35, u)}
    <path d="M0 256C70 238 140 246 200 256C270 244 340 240 400 254V300H0Z" fill="url(#h2${u})"/>
    <path d="M0 274C80 262 150 266 200 270C260 264 330 262 400 272V300H0Z" fill="url(#h3${u})"/>
    <path d="M0 256C70 238 140 246 200 256C270 244 340 240 400 254" fill="none" stroke="#fff" stroke-width="2.4" opacity=".55"/>
    ${tinyFlowers([[34, 266], [70, 280], [110, 268], [292, 270], [330, 284], [368, 266], [150, 288], [256, 290], [18, 290], [384, 292]], ['#ffffff', '#ffb3d6', '#fff0a0', '#c9b0ff'])}`,
  candy: u => `<defs>${lin(`sg${u}`, [[0, '#ffd3ea'], [.6, '#ffe6e2'], [1, '#fff4e8']])}${lin(`m1${u}`, ['#ffc8e0', '#ff9cc8'])}${lin(`m2${u}`, ['#c4f5e4', '#8fe0c6'])}${lin(`m3${u}`, ['#e2d4ff', '#c2a8ff'])}${lin(`g1${u}`, ['#ffc4dc', '#ff9cc6'])}${lin(`g2${u}`, ['#fff1f7', '#ffd6e8'])}
      ${rad(`cc${u}`, [[0, '#ffffff'], [.6, '#fff0f8'], [1, '#ffd0e8']], .45, .35, .7)}</defs>
    <rect width="400" height="300" fill="url(#sg${u})"/><circle cx="320" cy="58" r="110" fill="url(#sun${u})"/>
    ${[[70, 54, 1], [290, 40, .75]].map(([x, y, k]) => `<g transform="translate(${x} ${y}) scale(${k})"><circle cx="-24" cy="6" r="16" fill="url(#cc${u})"/><circle cx="0" cy="-6" r="22" fill="url(#cc${u})"/><circle cx="26" cy="4" r="17" fill="url(#cc${u})"/><rect x="-24" y="6" width="50" height="16" rx="8" fill="#ffe6f3"/></g>`).join('')}
    ${spark(190, 36, 6, '#fff')}${spark(370, 116, 5, '#fff')}${spark(28, 120, 4, '#fff')}${spark(150, 96, 3.5, '#fff', .9)}
    ${candyHill(70, 250, 92, 92, `m1${u}`, '#f08cb8', u, 'a')}${candyHill(336, 252, 96, 104, `m2${u}`, '#62c9a8', u, 'b')}${candyHill(200, 254, 80, 62, `m3${u}`, '#a888e8', u, 'c')}
    ${cane(118, 262, 58, 9)}${cane(292, 262, 66, -9)}
    ${lolliTree(26, 268, 64, '#ff7ab8', '#ff7ab8', 21)}${lolliTree(374, 266, 72, '#9a7bff', '#9a7bff', 23)}${lolliTree(336, 274, 38, '#ffb13d', '#ffb13d', 13)}${lolliTree(66, 278, 32, '#3fcf8e', '#3fcf8e', 11)}
    <path d="M0 250C50 240 110 242 160 250C220 238 300 236 400 248V300H0Z" fill="url(#g1${u})"/>
    <path d="M0 250C50 240 110 242 160 250C220 238 300 236 400 248V260C380 260 376 274 368 274C360 274 360 260 340 260C320 260 318 270 308 270C298 270 296 260 270 260C240 260 236 278 226 278C216 278 214 260 180 260C150 260 148 272 138 272C128 272 126 260 100 260C80 260 78 276 68 276C58 276 56 260 30 260C14 260 10 268 0 268Z" fill="url(#g2${u})"/>
    ${[[24, 288, '#ff7ab8'], [112, 292, '#ffb13d'], [292, 292, '#3fcf8e'], [378, 290, '#9a7bff'], [66, 298, '#4aa8ff']].map(([x, y, c]) => gumdrop(x, y, c)).join('')}
    ${[[40, 266, 30], [150, 280, -40], [200, 294, 70], [250, 276, 10], [330, 282, -60], [92, 274, 50], [350, 298, 20], [180, 266, -20], [270, 298, 40]].map(([x, y, a], k) => `<rect x="${x - 5}" y="${y - 1.8}" width="10" height="3.6" rx="1.8" fill="${RAINBOW[k % 7]}" transform="rotate(${a} ${x} ${y})"/>`).join('')}`,
  night: u => `<defs>${lin(`sg${u}`, [[0, '#170b33'], [.55, '#3a2270'], [1, '#6c3fa6']])}${rad(`mg${u}`, [[0, '#fff6d0', .7], [.45, '#ffe6a0', .22], [1, '#ffe6a0', 0]])}${rad(`mn${u}`, [[0, '#fffbe8'], [.7, '#fff0b8'], [1, '#f2d98a']], .4, .4, .7)}
      ${rad(`pm${u}`, [[0, '#ffc070'], [.6, '#ff8a1f'], [1, '#d85a00']], .4, .35, .8)}${lin(`n1${u}`, ['#3a2468', '#2a1850'])}${lin(`n2${u}`, ['#4a2f80', '#2f1c5a'])}</defs>
    <rect width="400" height="300" fill="url(#sg${u})"/>
    ${[[30, 30, 3], [80, 70, 2], [140, 24, 2.6], [190, 80, 1.8], [250, 40, 2.2], [60, 130, 2], [370, 160, 2], [180, 140, 1.6], [24, 180, 1.8], [380, 26, 2.4], [120, 110, 1.4], [230, 120, 1.6]].map(([x, y, r], k) => k % 3 ? `<circle cx="${x}" cy="${y}" r="${r * .7}" fill="#fff6d0" opacity=".85"/>` : spark(x, y, r * 2.4, '#fff6d0')).join('')}
    <circle cx="310" cy="74" r="80" fill="url(#mg${u})"/><circle cx="310" cy="74" r="34" fill="url(#mn${u})"/>
    <circle cx="298" cy="64" r="6" fill="#f2df9c" opacity=".7"/><circle cx="322" cy="88" r="4.5" fill="#f2df9c" opacity=".7"/><circle cx="318" cy="60" r="3" fill="#f2df9c" opacity=".6"/>
    ${bat(110, 60, .9)}${bat(160, 40, .6)}${bat(250, 96, .55)}
    <path d="M-10 240C40 200 90 196 140 220C190 206 240 210 280 226C320 206 380 204 410 226V300H-10Z" fill="url(#n1${u})"/>
    <g fill="#24144a"><path d="M300 222V170L318 150L336 170V222Z"/><path d="M296 172L318 140L340 172Z"/><path d="M336 222V188L350 176L364 188V222Z"/><path d="M332 190L350 166L368 190Z"/></g>
    <rect x="312" y="176" width="10" height="13" rx="5" fill="#ffd96a"/><rect x="344" y="196" width="10" height="11" rx="5" fill="#ffd96a"/><rect x="312" y="200" width="10" height="13" rx="5" fill="#ffb84a"/>
    <path d="M70 232C68 212 72 196 64 182C78 190 80 176 76 166M68 200C58 194 52 198 46 190M70 214C82 206 90 210 96 202" stroke="#24144a" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${ghost(64, 128, 1.1)}${ghost(356, 116, .7)}
    <path d="M-10 258C60 240 130 248 200 258C270 246 340 242 410 256V300H-10Z" fill="url(#n2${u})"/>
    <path d="M-10 258C60 240 130 248 200 258C270 246 340 242 410 256" fill="none" stroke="#8a64c8" stroke-width="2" opacity=".5"/>
    <ellipse cx="200" cy="262" rx="220" ry="14" fill="#fff" opacity=".07"/>
    ${pumpkin(46, 272, 1.25, u)}${pumpkin(352, 270, 1.1, u)}${pumpkin(96, 288, .75, u)}${pumpkin(312, 290, .7, u, false)}
    ${[[20, 290], [150, 282], [260, 286], [390, 288]].map(([x, y]) => `<path d="M${x - 6} ${y}q2 -8 4 0q2 -10 4 0q2 -7 4 0" fill="none" stroke="#6a4aa8" stroke-width="2" stroke-linecap="round"/>`).join('')}`,
  castle: u => `<defs>${lin(`sg${u}`, [[0, '#ffc6e6'], [.6, '#f1ddff'], [1, '#fff3fa']])}${lin(`cw${u}`, ['#fff2f8', '#ffd1e6'], 1, 0, 0, 0)}${lin(`cr${u}`, ['#c9a2ff', '#8f63e6'], 0, 0, 1, 0)}${lin(`cw2${u}`, ['#ffe6f2', '#f7bcd8'], 1, 0, 0, 0)}
      ${lin(`gr${u}`, ['#a6ecc3', '#6fd29d'])}${lin(`bu${u}`, ['#7fdca6', '#3fae74'])}${lin(`pa${u}`, ['#fff5e6', '#f3d9c0'])}</defs>
    <rect width="400" height="300" fill="url(#sg${u})"/><circle cx="200" cy="80" r="150" fill="url(#sun${u})"/>
    ${cloud(60, 50, .8, u)}${cloud(340, 70, .9, u)}${spark(130, 30, 5, '#fff')}${spark(290, 24, 6, '#fff')}${spark(380, 140, 4, '#fff')}
    <path d="M-10 236C60 216 140 222 200 232C270 220 340 216 410 230V300H-10Z" fill="#d7c6ff" opacity=".6"/>
    ${[[110, 128, 26], [264, 128, 26]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${250 - y}" fill="url(#cw2${u})" stroke="#e08fbf" stroke-width="2"/><path d="M${x - 6} ${y + 2}L${x + w / 2} ${y - 46}L${x + w + 6} ${y + 2}Z" fill="url(#cr${u})" stroke="#6a40c0" stroke-width="2" stroke-linejoin="round"/><path d="M${x + w / 2} ${y - 46}V${y - 62}" stroke="#6a40c0" stroke-width="2"/><path d="M${x + w / 2} ${y - 62}l13 4.5l-13 4.5Z" fill="#ff5fae"/><rect x="${x + w / 2 - 5}" y="${y + 24}" width="10" height="16" rx="5" fill="#9a7bff" stroke="#6a40c0" stroke-width="1.4"/>`).join('')}
    <path d="M136 250V140H264V250Z" fill="url(#cw${u})" stroke="#e08fbf" stroke-width="2"/>
    ${Array.from({ length:7 }, (_, k) => `<rect x="${137 + k * 18.6}" y="128" width="11" height="14" rx="2" fill="#ffe6f2" stroke="#e08fbf" stroke-width="2"/>`).join('')}
    ${[[60, 150, 36], [304, 150, 36]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${250 - y}" fill="url(#cw${u})" stroke="#e08fbf" stroke-width="2"/><path d="M${x - 8} ${y + 2}L${x + w / 2} ${y - 56}L${x + w + 8} ${y + 2}Z" fill="url(#cr${u})" stroke="#6a40c0" stroke-width="2" stroke-linejoin="round"/><path d="M${x + 4} ${y - 4}L${x + w / 2} ${y - 50}" stroke="#fff" stroke-width="2.4" opacity=".4" stroke-linecap="round"/><path d="M${x + w / 2} ${y - 56}V${y - 74}" stroke="#6a40c0" stroke-width="2"/><path d="M${x + w / 2} ${y - 74}l15 5l-15 5Z" fill="#ffd23f"/><rect x="${x + w / 2 - 6}" y="${y + 22}" width="12" height="20" rx="6" fill="#9a7bff" stroke="#6a40c0" stroke-width="1.4"/><circle cx="${x + w / 2 - 2}" cy="${y + 28}" r="1.6" fill="#fff" opacity=".8"/>`).join('')}
    <path d="M168 250V196C168 176 232 176 232 196V250Z" fill="#b48cff" stroke="#6a40c0" stroke-width="2"/><path d="M174 250V198C174 184 226 184 226 198V250" fill="none" stroke="#9a6ff0" stroke-width="2"/>
    ${[[150, 160], [236, 160]].map(([x, y]) => `<rect x="${x}" y="${y}" width="14" height="20" rx="7" fill="#9a7bff" stroke="#6a40c0" stroke-width="1.4"/>`).join('')}
    <path d="M140 150Q170 166 200 150Q230 166 260 150" fill="none" stroke="#fff" stroke-width="1.4"/>${[[152, 156, '#ff7ab8'], [170, 162, '#ffd23f'], [188, 156, '#7fd8ff'], [212, 156, '#3fcf8e'], [230, 162, '#ff9330'], [248, 156, '#b79bff']].map(([x, y, c]) => `<path d="M${x - 5} ${y - 3}L${x + 5} ${y - 3}L${x} ${y + 7}Z" fill="${c}"/>`).join('')}
    <path d="M-10 254C70 242 140 246 200 250C270 244 340 240 410 252V300H-10Z" fill="url(#gr${u})"/>
    <path d="M176 250L150 300H250L224 250Z" fill="url(#pa${u})"/><path d="M168 266H232M160 284H240" stroke="#e8c8a8" stroke-width="1.6"/>
    ${[[30, 252, 34], [86, 258, 26], [318, 256, 28], [372, 250, 34]].map(([x, y, r]) => `<path d="M${x - r} ${y + 12}C${x - r} ${y - r * .6} ${x + r} ${y - r * .6} ${x + r} ${y + 12}Z" fill="url(#bu${u})" stroke="#2f9a5e" stroke-width="2"/><path d="M${x - r * .6} ${y - 4}C${x - r * .4} ${y - r * .45} ${x} ${y - r * .55} ${x + r * .2} ${y - r * .5}" stroke="#fff" stroke-width="2.4" fill="none" opacity=".35" stroke-linecap="round"/>`).join('')}
    ${[[18, 250], [40, 244], [76, 252], [96, 256], [308, 252], [330, 250], [362, 244], [384, 252]].map(([x, y], k) => flower(x, y, 4.6, k % 2 ? '#ff7ab8' : '#ffffff', '#ffd23f', k * 20)).join('')}
    ${tinyFlowers([[120, 278], [280, 280], [40, 290], [360, 292]], ['#ffb3d6', '#fff0a0'])}`,
  sea: u => `<defs>${lin(`sg${u}`, [[0, '#b8f0ff'], [.5, '#58c0f0'], [1, '#2f86d8']])}${lin(`ray${u}`, [[0, '#ffffff', .5], [1, '#ffffff', 0]])}${lin(`sd${u}`, ['#ffeab8', '#f5cf86'])}${lin(`rf${u}`, ['#3f9ad8', '#2a74c0'])}</defs>
    <rect width="400" height="300" fill="url(#sg${u})"/>
    ${[[60, 30], [150, 50], [250, 36], [330, 54]].map(([x, w]) => `<path d="M${x} 0H${x + w}L${x + w * 2.2} 300H${x + w * 1.2}Z" fill="url(#ray${u})" opacity=".55"/>`).join('')}
    <path d="M0 14Q25 6 50 14T100 14T150 14T200 14T250 14T300 14T350 14T400 14V0H0Z" fill="#e6fbff" opacity=".7"/>
    <path d="M-10 230C30 200 70 214 100 226C130 196 180 206 210 222C250 198 300 200 330 218C360 204 390 206 410 214V300H-10Z" fill="url(#rf${u})" opacity=".55"/>
    ${seaweed(22, 270, 120, '#3fcf8e', 6)}${seaweed(44, 272, 84, '#7fe0a8', -6)}${seaweed(362, 270, 130, '#3fcf8e', -8)}${seaweed(384, 272, 90, '#7fe0a8', 6)}
    ${fish(80, 120, '#ffb13d', 1, 1, u)}${fish(320, 92, '#ff7ab8', -1, .85, u)}${fish(350, 170, '#ffd23f', -1, .6, u)}
    ${bubbles([[120, 70, 6], [132, 50, 4], [126, 34, 3], [280, 140, 7], [290, 116, 4.4], [40, 160, 5], [370, 40, 4], [200, 20, 3]])}
    <path d="M-10 256C60 242 140 248 200 254C270 246 340 242 410 252V300H-10Z" fill="url(#sd${u})"/>
    <path d="M30 274Q60 268 90 274M150 284Q190 278 230 284M290 276Q320 270 350 276" stroke="#e8b866" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/>
    ${coral(72, 262, 1.2, '#ff7a9a')}${coral(96, 266, .8, '#ffb13d')}${coral(318, 262, 1.1, '#c08aff')}${coral(342, 268, .85, '#ff7a9a')}
    ${starfish(138, 280, 1, '#ff8a7a', 12)}${starfish(286, 288, .8, '#ffb13d', -20)}${shell(40, 288, 1.1)}${shell(240, 292, .9)}${shell(370, 286, 1)}`,
};
export function sceneSVG(bgId, uid = ++UID){
  const u = uid, f = SCENES[bgId] || SCENES.sky;
  return `<svg class="scene" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>${sceneDefs(u)}</defs>${f(u)}</svg>`;
}

/* ================= stage ================= */
// princess on her background + pet
export function stageHTML(extra = '', cls = '', wear = store.P.wear){
  const pet = wear.pet !== 'none' && PET_IMG[wear.pet] ? `<span class="petbox">${iconHTML(PET_IMG[wear.pet], 'pet')}</span>` : '';
  return `<div class="stagebox ${cls}" data-bg="${wear.bg}">${sceneSVG(wear.bg, ++UID)}<div class="stage-av">${avatarSVG(wear)}${pet}</div>${extra}</div>`;
}

/* ================= closet thumbnails ================= */
const NONE_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="30" fill="#fff" stroke="#f3b6d6" stroke-width="6"/><path d="M29 71L71 29" stroke="#f3b6d6" stroke-width="6" stroke-linecap="round"/></svg>`;
const HAT_VB = { bow:'26 22 116 116', tiara:'40 18 120 120', flowers:'38 30 124 124', cat:'36 22 128 128', police:'40 18 120 120', witch:'30 -2 140 140', horn:'38 0 124 124', crown:'40 12 120 120' };
const HAND_VB = { lollipop:'-30 -80 60 92', icecream:'-24 -50 48 70', balloon:'-28 -118 64 122', basket:'-24 -8 48 58', wand:'-30 -84 60 96' };
const HANGER = `<path d="M100 150V144C100 140 104 140 104 136C104 132 96 132 96 136" fill="none" stroke="#b9a6c9" stroke-width="2.4" stroke-linecap="round"/><path d="M70 160L100 150L130 160" fill="none" stroke="#b9a6c9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
export function thumbHTML(cid, id){
  const u = ++UID;
  if (id === 'none') return NONE_SVG;
  if (cid === 'dress') {
    const d = DRESS[id] || DRESS.pink;
    const vb = { bell:'38 133 124 124', coat:'38 133 124 124', pumpkin:'36 133 128 132', mermaid:'36 133 128 132', gown:'26 133 148 142' }[d.shape];
    return `<svg viewBox="${vb}" aria-hidden="true"><defs>${dressDefs(d, u)}${goldDefs(u)}</defs>${HANGER}${dressBody(d, u)}${sleeve(d, 84, 167, -24, u)}${sleeve(d, 116, 167, 24, u)}</svg>`;
  }
  if (cid === 'hat' || cid === 'hair') {
    const hair = cid === 'hair' ? id : store.P.wear.hair, { h, defs } = hairDefs(hair, u);
    const vb = cid === 'hair' ? '34 38 132 132' : HAT_VB[id] || '30 10 140 140';
    return `<svg viewBox="${vb}" aria-hidden="true"><defs>${defs}${goldDefs(u)}${cid === 'hat' ? hatDefs(id, u) : ''}
      ${rad(`sk${u}`, [[0, SK.hi], [.55, SK.base], [1, SK.lo]], .42, .36, .72)}${rad(`bl${u}`, [[0, SK.blush, .75], [1, SK.blush, 0]])}${lin(`ir${u}`, [[0, '#2c1438'], [.42, '#5b2a7e'], [.8, '#a86de6'], [1, '#ecc8ff']])}</defs>
      ${hairBack(h, u)}${headSVG(u, 'idle')}${hairFront(h, u)}${cid === 'hat' ? HATS[id](u) : ''}</svg>`;
  }
  if (cid === 'wings') return `<svg viewBox="2 96 196 148" aria-hidden="true"><defs>${wingDefs(id, u)}</defs>${WINGS[id](u)}</svg>`;
  if (cid === 'hand') return `<svg viewBox="${HAND_VB[id]}" aria-hidden="true"><defs>${handDefs(id, u)}</defs><g transform="rotate(${id === 'balloon' || id === 'basket' ? 0 : 10})">${handItem(id, u)}</g></svg>`;
  if (cid === 'pet') return iconHTML(PET_IMG[id]);
  return sceneSVG(id, u);
}

/* ================= canvas image (cached per wear+pose) ================= */
// Games call avatarImage() every frame, so the lookup allocates nothing unless her outfit changed.
// Once the vector image has loaded it is rasterized once to a PNG bitmap: canvases then blit pixels
// instead of re-rendering gradients every frame (Safari re-renders SVG images on each drawImage).
const AV_W = 560, AV_H = 840;
const avCache = new Map();
let snap = null, snapKey = '';
function wearKey(){
  const w = store.P.wear;
  if (snap) { let same = true; for (const k in w) if (snap[k] !== w[k]) { same = false; break; } if (same) return snapKey; }
  snap = { ...w }; snapKey = JSON.stringify(snap);
  return snapKey;
}
function makeAvatarImage(ent, pose, wear){
  const im = new Image();
  im.decoding = 'async';
  im.addEventListener('load', () => {
    try {
      const cv = document.createElement('canvas'); cv.width = AV_W; cv.height = AV_H;
      cv.getContext('2d').drawImage(im, 0, 0, AV_W, AV_H);
      cv.toBlob(b => {
        if (!b || ent.dead) return;
        const url = URL.createObjectURL(b), png = new Image();
        png.onload = () => { if (ent.dead) { URL.revokeObjectURL(url); return; } ent[pose] = png; (ent.urls || (ent.urls = [])).push(url); };
        png.onerror = () => URL.revokeObjectURL(url);
        png.src = url;
      }, 'image/png');
    } catch (e) { /* tainted or no canvas: keep drawing the vector image */ }
  }, { once:true });
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(avatarSVG(wear, { standalone:true, pose }).replace('width="400" height="600"', `width="${AV_W}" height="${AV_H}"`));
  return im;
}
export function avatarImage(pose = 'idle'){
  if (!POSE[pose]) pose = 'idle';
  const key = wearKey();
  let ent = avCache.get(key);
  if (!ent) {
    if (avCache.size >= 6) for (const [k, e] of avCache) { if (k === key) continue; e.dead = true; (e.urls || []).forEach(u => URL.revokeObjectURL(u)); avCache.delete(k); }
    ent = {}; avCache.set(key, ent);
  }
  return ent[pose] || (ent[pose] = makeAvatarImage(ent, pose, { ...store.P.wear }));
}
// warm the canvas images for the current outfit (e.g. before a game starts)
export function preloadAvatar(poses = ['idle', 'cheer', 'jump']){ poses.forEach(p => avatarImage(p)); }
