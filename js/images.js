// images.js (owner: engine) — Fluent 3D pictures for HTML and canvases, plus glossy hearts for colour words.
// Never render a system emoji glyph: every picture comes from img/<name>.webp.

export const imgSrc = name => `img/${name}.webp`;

const IMG_ATTR = 'alt="" aria-hidden="true" draggable="false" decoding="async"';

/* ---------- glossy heart (colour words) ---------- */
const HEART_D = 'M50 91C22 71 6 55 6 36 6 22 17 11 31 11c8 0 15 4 19 11 4-7 11-11 19-11 14 0 25 11 25 25 0 19-16 35-44 55z';
const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgb2hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); };

// pic = '#hex' or '#hi,#lo' (metallic)
function heartMarkup(pic){
  const [c1, c2] = pic.split(',');
  let body, outline;
  if (c2) {          // metallic: banded linear gradient
    body = `<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${mix(c1, '#ffffff', .5)}"/><stop offset=".28" stop-color="${c1}"/><stop offset=".5" stop-color="${c2}"/>
      <stop offset=".66" stop-color="${c1}"/><stop offset=".86" stop-color="${c2}"/><stop offset="1" stop-color="${mix(c2, '#000000', .25)}"/></linearGradient>`;
    outline = mix(c2, '#000000', .35);
  } else {
    const light = c1.toLowerCase() === '#ffffff';
    const hi = mix(c1, '#ffffff', light ? 0 : .45), lo = light ? '#d9deea' : mix(c1, '#000000', .3);
    body = `<radialGradient id="b" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="${hi}"/><stop offset=".5" stop-color="${c1}"/><stop offset="1" stop-color="${lo}"/></radialGradient>`;
    outline = light ? '#c7cede' : mix(c1, '#000000', .45);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${body}
    <radialGradient id="s" cx=".72" cy=".86" r=".6"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="h" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <path d="${HEART_D}" fill="url(#b)"/><path d="${HEART_D}" fill="url(#s)"/>
    <ellipse cx="30" cy="31" rx="13" ry="8" fill="url(#h)" transform="rotate(-35 30 31)"/><circle cx="44" cy="24" r="3" fill="#fff" opacity=".85"/>
    <path d="${HEART_D}" fill="none" stroke="${outline}" stroke-width="2.6" stroke-opacity=".75"/></svg>`;
}
const heartURLs = new Map();
function heartURL(pic){
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

// hearts are rasterized once per colour to an offscreen canvas, then drawn as a bitmap
const heartBitmaps = new Map();
function heartBitmap(pic){
  let b = heartBitmaps.get(pic);
  if (b) return b.ready ? b.cv : null;
  b = { ready:false, cv:null };
  heartBitmaps.set(pic, b);
  const im = new Image();
  im.onload = () => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    try { cv.getContext('2d').drawImage(im, 0, 0, 256, 256); b.cv = cv; b.ready = true; } catch (e) {}
  };
  im.src = heartURL(pic);
  return null;
}
const ready = im => im && im.complete && im.naturalWidth > 0;

// canvas: Fluent image or glossy heart, centred at x,y
export function drawPic(ctx, w, x, y, size){
  const src = w.color ? heartBitmap(w.pic) : getImage(w.pic);
  if (!src || (!w.color && !ready(src))) return;
  ctx.drawImage(src, x - size / 2, y - size / 2, size, size);
}
