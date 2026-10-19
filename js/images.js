// images.js (owner: engine) — Fluent 3D pictures for HTML and canvases, plus glossy 3D hearts for colour words.
// Never render a system emoji glyph: every picture comes from img/<name>.webp.
//
// Exports
//   imgSrc(name)                 'img/<name>.webp'
//   picHTML(w, cls='')           <img class="pic …"> for a word, or the glossy heart for a colour word
//   iconHTML(name, cls='')       <img class="ico …"> for any img/ name
//   getImage(name)               cached HTMLImageElement for canvas use
//   preloadImages(names)
//   drawPic(ctx, w, x, y, size)  canvas: Fluent image or glossy heart, centred at x,y
//   heartURL(pic)                data: URL of the heart SVG for a colour pic ('#hex' or '#hi,#lo')
//   picReady(w)                  true once the word's picture can be drawn on a canvas
//   preloadWords(words)          warm the canvas cache for word objects (images and heart bitmaps)

export const imgSrc = name => `img/${name}.webp`;

const IMG_ATTR = 'alt="" aria-hidden="true" draggable="false" decoding="async"';

/* ---------- glossy heart (colour words) ---------- */
// a plump, toy-like heart in a 100×100 box (lobes slightly fuller than a textbook heart)
const HEART_D = 'M50 89C30 77 6 60 6 35 6 19 18 8 31.5 8 40 8 46.5 13 50 20.5 53.5 13 60 8 68.5 8 82 8 94 19 94 35 94 60 70 77 50 89Z';
const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgb2hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); };
const lum = h => { const [r, g, b] = hex2rgb(h); return (r * .299 + g * .587 + b * .114) / 255; };

// four-point twinkle centred at cx,cy
const twinkle = (cx, cy, r, op = 1) =>
  `<path d="M${cx} ${cy - r}Q${cx + r * .16} ${cy - r * .16} ${cx + r} ${cy}Q${cx + r * .16} ${cy + r * .16} ${cx} ${cy + r}Q${cx - r * .16} ${cy + r * .16} ${cx - r} ${cy}Q${cx - r * .16} ${cy - r * .16} ${cx} ${cy - r}Z" fill="#fff" opacity="${op}"/>`;

// pic = '#hex' or '#hi,#lo' (metallic)
function heartMarkup(pic){
  const [c1, c2] = pic.split(',');
  let body, outline, rim, shadeOp, extra = '';
  if (c2) {
    // metallic: bright banded reflections, warm/cool dark edge, extra twinkles
    const d1 = mix(c2, '#000000', .18), d2 = mix(c2, '#000000', .38);
    body = `<linearGradient id="b" x1=".05" y1="0" x2=".85" y2="1">
      <stop offset="0" stop-color="${mix(c1, '#ffffff', .65)}"/><stop offset=".18" stop-color="${c1}"/>
      <stop offset=".36" stop-color="${c2}"/><stop offset=".47" stop-color="${d1}"/>
      <stop offset=".56" stop-color="${mix(c1, '#ffffff', .35)}"/><stop offset=".68" stop-color="${c1}"/>
      <stop offset=".84" stop-color="${c2}"/><stop offset="1" stop-color="${d2}"/></linearGradient>`;
    outline = mix(c2, '#000000', .45); rim = mix(c1, '#ffffff', .4); shadeOp = .2;
    extra = twinkle(73, 27, 7, .95) + twinkle(28, 62, 4, .8);
  } else {
    const L = lum(c1), white = L > .93, dark = L < .25;
    const hi = white ? '#ffffff' : mix(c1, '#ffffff', dark ? .38 : .5);
    const lo = white ? '#cfc9e6' : mix(c1, '#000000', dark ? .45 : .32);
    const mid = white ? '#f6f4fc' : c1;
    body = `<radialGradient id="b" cx=".34" cy=".28" r=".9"><stop offset="0" stop-color="${hi}"/><stop offset=".42" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></radialGradient>`;
    outline = white ? '#a99fcb' : mix(c1, '#000000', dark ? .2 : .42);
    rim = white ? '#ffffff' : mix(c1, '#ffffff', dark ? .3 : .55);
    shadeOp = white ? .16 : dark ? .4 : .26;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${body}
    <clipPath id="c"><path d="${HEART_D}"/></clipPath>
    <radialGradient id="s" cx=".78" cy=".9" r=".75"><stop offset="0" stop-color="#1c0f2e" stop-opacity="${shadeOp}"/><stop offset="1" stop-color="#1c0f2e" stop-opacity="0"/></radialGradient>
    <linearGradient id="r" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="${rim}" stop-opacity="0"/><stop offset="1" stop-color="${rim}" stop-opacity=".85"/></linearGradient>
    <radialGradient id="h" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".98"/><stop offset=".6" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <path d="${HEART_D}" fill="url(#b)"/>
    <g clip-path="url(#c)">
      <path d="${HEART_D}" fill="url(#s)"/>
      <path d="${HEART_D}" fill="none" stroke="url(#r)" stroke-width="9" transform="translate(0 -2.5)"/>
    </g>
    <ellipse cx="29" cy="28" rx="14.5" ry="8.5" fill="url(#h)" transform="rotate(-38 29 28)"/>
    <ellipse cx="22.5" cy="41" rx="3.2" ry="5.5" fill="#fff" opacity=".55" transform="rotate(12 22.5 41)"/>
    <ellipse cx="72" cy="20" rx="6.5" ry="3" fill="#fff" opacity=".6" transform="rotate(24 72 20)"/>
    <circle cx="44" cy="21" r="2.6" fill="#fff" opacity=".95"/>
    ${extra}
    <path d="${HEART_D}" fill="none" stroke="${outline}" stroke-width="2.4" stroke-opacity=".7" stroke-linejoin="round"/></svg>`;
}
const heartURLs = new Map();
export function heartURL(pic){
  let u = heartURLs.get(pic);
  if (!u) { u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(heartMarkup(pic)); heartURLs.set(pic, u); }
  return u;
}

/* ---------- HTML ---------- */
// <img class="pic …"> for a word, or the glossy heart for a colour word
export function picHTML(w, cls = ''){
  const src = w.color ? heartURL(w.pic) : (w.img || imgSrc(w.pic));
  return `<img class="pic${w.color ? ' heart' : ''} ${cls}" src="${src}" ${IMG_ATTR}>`;
}
// <img> for any img/ name (UI icons, pets, game icons)
export function iconHTML(name, cls = ''){
  return `<img class="ico ${cls}" src="${imgSrc(name)}" ${IMG_ATTR}>`;
}

/* ---------- canvas ---------- */
const imgCache = new Map();
function loadImg(key, src){
  let im = imgCache.get(key);
  if (!im) { im = new Image(); im.decoding = 'async'; im.src = src; imgCache.set(key, im); }
  return im;
}
// cached HTMLImageElement for canvas use
export const getImage = name => loadImg(name, imgSrc(name));
export function preloadImages(names){ names.forEach(n => getImage(n)); }

// hearts are rasterized once per colour from the same SVG as the HTML version, so both match exactly
const HEART_PX = 384;
const heartBitmaps = new Map();
function heartBitmap(pic){
  let b = heartBitmaps.get(pic);
  if (b) return b.ready ? b.cv : null;
  b = { ready:false, cv:null };
  heartBitmaps.set(pic, b);
  const im = new Image();
  im.onload = () => {
    const cv = document.createElement('canvas'); cv.width = cv.height = HEART_PX;
    try { cv.getContext('2d').drawImage(im, 0, 0, HEART_PX, HEART_PX); b.cv = cv; b.ready = true; } catch (e) {}
  };
  im.src = heartURL(pic);
  return null;
}
const ready = im => im && im.complete && im.naturalWidth > 0;

export function picReady(w){ return w.color ? !!heartBitmap(w.pic) : ready(getImage(w.pic)); }
export function preloadWords(words){ words.forEach(w => { if (w.color) heartBitmap(w.pic); else getImage(w.pic); }); }

// canvas: Fluent image or glossy heart, centred at x,y
export function drawPic(ctx, w, x, y, size){
  const src = w.color ? heartBitmap(w.pic) : getImage(w.pic);
  if (!src || (!w.color && !ready(src))) return;
  ctx.drawImage(src, x - size / 2, y - size / 2, size, size);
}
