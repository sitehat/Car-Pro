import * as THREE from 'three';
import './style.css';

const $ = id => document.getElementById(id), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[<>&"]/g, '');
const ROAD = 11, L = 12000, TLIM = 300, N = 6, LANES = [-8, -5, -2, 2, 5, 8];
const DEF = ['Rafi', 'Sabbir', 'Tanvir', 'Nabil', 'Imran', 'Arif'];
const MODELS = [
  { n: 'Vortex GT', c: 0xe11d2e, bh: .55, ch: .5, cl: 2.2, sp: 5, spoil: 1 },
  { n: 'Aero X', c: 0x2f7bff, bh: .45, ch: .42, cl: 1.8, sp: 8, spoil: 1 },
  { n: 'Titan SUV', c: 0x2c3e50, bh: .8, ch: .7, cl: 3.0, sp: 0 },
  { n: 'Muscle R', c: 0xf5a300, bh: .6, ch: .5, cl: 2.0, sp: 4, stripe: 1 },
  { n: 'Neon Z', c: 0x19e6a0, bh: .5, ch: .48, cl: 2.0, sp: 6, spoil: 1 },
  { n: 'Falcon S', c: 0xe8e8ee, bh: .55, ch: .55, cl: 2.6, sp: 2 },
];
const COLS = [0xe11d2e, 0x2f7bff, 0xf5a300, 0x19e6a0, 0xb04cff, 0xf2f2f2, 0xff5ea8, 0x00c2ff];

let cfg = { name: 'Player', num: 1, model: 0, names: [...DEF] };
try { Object.assign(cfg, JSON.parse(localStorage.getItem('carpro') || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem('carpro', JSON.stringify(cfg)); } catch (e) {} };

/* ---------- renderer / scenes ---------- */
const R = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
R.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc8ff);
scene.fog = new THREE.Fog(0x8fc8ff, 80, 420);
const cam = new THREE.PerspectiveCamera(62, 1, .5, 800);
const lights = s => { s.add(new THREE.HemisphereLight(0xffffff, 0x556655, .95)); const d = new THREE.DirectionalLight(0xffffff, 1.1); d.position.set(30, 60, 20); s.add(d); };
lights(scene);
const pScene = new THREE.Scene(); pScene.background = new THREE.Color(0x0b1220); lights(pScene);
const pCam = new THREE.PerspectiveCamera(40, 1, .5, 100); pCam.position.set(5.5, 2.4, 7.5); pCam.lookAt(0, .9, 0);
const floor = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, .1, 40), new THREE.MeshStandardMaterial({ color: 0x1b2436, emissive: 0x1a1030 }));
floor.position.y = -.06; pScene.add(floor);
function resize() { R.setSize(innerWidth, innerHeight, false); cam.aspect = pCam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); pCam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

/* ---------- car model ---------- */
function makeCar(m, col) {
  const g = new THREE.Group(), M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .35, metalness: .5, ...o });
  const top = .35 + m.bh;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, m.bh, 4.4), M(col)); body.position.y = .35 + m.bh / 2; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, m.ch, m.cl), M(0x10151c, { metalness: .8, roughness: .1 })); cab.position.set(0, top + m.ch / 2, .3); g.add(cab);
  const wg = new THREE.CylinderGeometry(.45, .45, .4, 14), wm = M(0x111111, { metalness: 0 });
  for (const sx of [-1, 1]) for (const sz of [-1.4, 1.4]) { const w = new THREE.Mesh(wg, wm); w.rotation.z = Math.PI / 2; w.position.set(sx * 1.05, .45, sz); g.add(w); }
  const lm = new THREE.MeshBasicMaterial({ color: 0xfff6c0 }), tm = new THREE.MeshBasicMaterial({ color: 0xff1a1a });
  for (const sx of [-.65, .65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(.5, .15, .1), lm); h.position.set(sx, .35 + m.bh * .6, -2.2); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(.5, .15, .1), tm); t.position.set(sx, .35 + m.bh * .6, 2.2); g.add(t);
  }
  if (m.spoil) { const s = new THREE.Mesh(new THREE.BoxGeometry(2, .1, .5), M(0x111111)); s.position.set(0, top + .5, 2); g.add(s); for (const sx of [-.6, .6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.1, .5, .1), M(0x111111)); p.position.set(sx, top + .25, 2); g.add(p); } }
  if (m.stripe) { const s = new THREE.Mesh(new THREE.BoxGeometry(.5, .02, 4.42), M(0xffffff)); s.position.y = top + .01; g.add(s); }
  return g;
}
function label(txt) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#fff'; x.font = 'bold 44px sans-serif'; x.textAlign = 'center'; x.fillText(txt, 64, 48);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(2.4, 1.2, 1); s.position.y = 3.3; return s;
}

/* ---------- world ---------- */
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
{
  const c = cv(256, 256), x = c.getContext('2d');
  x.fillStyle = '#2b2f36'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .05})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  x.fillStyle = '#fff'; x.fillRect(0, 0, 6, 256); x.fillRect(250, 0, 6, 256);
  x.fillStyle = '#e8e8e8'; for (let k = 1; k < 6; k++) x.fillRect(k * 256 / 6 - 2, 0, 4, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, (L + 600) / 20); t.anisotropy = 4;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(2 * ROAD, L + 600), new THREE.MeshStandardMaterial({ map: t, roughness: .9 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -L / 2 + 100); scene.add(road);
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(1400, L + 1200), new THREE.MeshStandardMaterial({ color: 0x3d7a3a }));
  gr.rotation.x = -Math.PI / 2; gr.position.set(0, -.03, -L / 2 + 100); scene.add(gr);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.PlaneGeometry(1.2, L + 600), new THREE.MeshBasicMaterial({ color: 0xcc2222 })); e.rotation.x = -Math.PI / 2; e.position.set(s * (ROAD + .6), .02, -L / 2 + 100); scene.add(e); }
}
const trees = [];
{
  const tg = new THREE.ConeGeometry(2, 6, 7), tm = new THREE.MeshStandardMaterial({ color: 0x2e7d32, flatShading: true }), tk = new THREE.CylinderGeometry(.3, .4, 2), tkm = new THREE.MeshStandardMaterial({ color: 0x5b3a1e });
  for (let i = 0; i < 80; i++) {
    const g = new THREE.Group(), a = new THREE.Mesh(tg, tm), b = new THREE.Mesh(tk, tkm); a.position.y = 5; b.position.y = 1; g.add(a, b);
    g.position.set((i % 2 ? 1 : -1) * (ROAD + 5 + Math.random() * 10), 0, -(i >> 1) * 25); g.scale.setScalar(.8 + Math.random() * .6); scene.add(g); trees.push(g);
  }
  const mg = new THREE.ConeGeometry(60, 70, 5), mm = new THREE.MeshStandardMaterial({ color: 0x7d8ea6, flatShading: true });
  for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(mg, mm); m.position.set((i % 2 ? 1 : -1) * (200 + Math.random() * 120), 20, -(i >> 1) * 380); m.scale.set(1 + Math.random(), 1 + Math.random(), 1 + Math.random()); scene.add(m); }
}
function arch(z, txt, checker) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x222833 });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.8, 9, .8), mat); p.position.set(s * (ROAD + 1), 4.5, z); scene.add(p); }
  const c = cv(512, 96), x = c.getContext('2d'); x.fillStyle = '#c8102e'; x.fillRect(0, 0, 512, 96); x.fillStyle = '#fff'; x.font = 'bold 70px sans-serif'; x.textAlign = 'center'; x.fillText(txt, 256, 72);
  const b = new THREE.Mesh(new THREE.PlaneGeometry(2 * ROAD + 2, 4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) })); b.position.set(0, 9.5, z); scene.add(b);
  const k = cv(256, 32), y = k.getContext('2d'); for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { y.fillStyle = (i + j) % 2 ? '#fff' : '#000'; y.fillRect(i * 8, j * 8, 8, 8); }
  const f = new THREE.Mesh(new THREE.PlaneGeometry(2 * ROAD, 3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(k) })); f.rotation.x = -Math.PI / 2; f.position.set(0, .03, z); scene.add(f);
}
arch(-5, 'START'); arch(-L, 'FINISH');

/* ---------- state ---------- */
let S = 'home', cars = [], pl = null, t = 0, cd = 0, paused = false, snap = false, hT = 0, pCar = null;
const input = { l: 0, r: 0, g: 0, b: 0, n: 0 };

/* ---------- home UI ---------- */
function rows() {
  const box = $('rows'); box.innerHTML = '';
  for (let i = 0; i < N; i++) {
    const me = i === cfg.num - 1, d = document.createElement('div'); d.className = 'row';
    const inp = document.createElement('input'); inp.maxLength = 12; inp.value = me ? cfg.name : (cfg.names[i] || DEF[i]); inp.disabled = me;
    inp.oninput = () => { cfg.names[i] = inp.value; save(); };
    d.innerHTML = `<b>#${i + 1}</b>`; d.append(inp); box.append(d);
  }
}
$('pname').value = cfg.name;
$('pname').oninput = e => { cfg.name = e.target.value; $('rows').children[cfg.num - 1].querySelector('input').value = cfg.name; save(); };
$('pnum').innerHTML = [...Array(N)].map((_, i) => `<option value="${i + 1}" ${i + 1 === cfg.num ? 'selected' : ''}>${i + 1}</option>`).join('');
$('pnum').onchange = e => { cfg.num = +e.target.value; rows(); save(); };
function setPrev() {
  if (pCar) pScene.remove(pCar);
  const m = MODELS[cfg.model]; pCar = makeCar(m, m.c); pScene.add(pCar); $('mname').textContent = m.n; save();
}
$('prev').onclick = () => { cfg.model = (cfg.model + MODELS.length - 1) % MODELS.length; setPrev(); };
$('next').onclick = () => { cfg.model = (cfg.model + 1) % MODELS.length; setPrev(); };
rows(); setPrev();

/* ---------- sound ---------- */
let au, osc, gn;
function snd() { if (au) return; try { au = new AudioContext(); osc = au.createOscillator(); osc.type = 'sawtooth'; gn = au.createGain(); gn.gain.value = 0; osc.connect(gn).connect(au.destination); osc.start(); } catch (e) {} }

/* ---------- race ---------- */
function show(txt, ms) { const e = $('msg'); e.textContent = txt; e.style.opacity = 1; clearTimeout(show.t); if (ms) show.t = setTimeout(() => e.style.opacity = 0, ms); }
const mmss = s => `${s / 60 | 0}:${String(s % 60 | 0).padStart(2, '0')}`, fmt = s => `${s / 60 | 0}:${(s % 60).toFixed(1).padStart(4, '0')}`;

function startRace() {
  save(); snd();
  cars.forEach(c => scene.remove(c.mesh)); cars = [];
  const pn = cfg.num - 1;
  for (let i = 0; i < N; i++) {
    const me = i === pn, m = me ? MODELS[cfg.model] : MODELS[Math.random() * MODELS.length | 0];
    const mesh = makeCar(m, me ? m.c : COLS[(i + 2) % COLS.length]); mesh.add(label('#' + (i + 1))); scene.add(mesh);
    const base = 52 + Math.random() * 9;
    cars.push({ num: i + 1, me, name: esc((me ? cfg.name : cfg.names[i]) || 'Driver' + (i + 1)), d: -(i / 3 | 0) * 9, x: [-6, 0, 6][i % 3], tx: [-6, 0, 6][i % 3], v: 0, base, vmax: me ? 56 + m.sp : base, fuel: 100, fin: 0, crash: null, mesh, lt: 2 + Math.random() * 4, bT: 0 });
  }
  pl = cars[pn]; t = 0; cd = 3.99; S = 'count'; paused = false; snap = true;
  $('home').classList.remove('on'); $('res').classList.remove('on'); $('pause').classList.remove('on'); $('hud').classList.add('on');
}
function goHome() {
  S = 'home'; paused = false; cars.forEach(c => scene.remove(c.mesh)); cars = [];
  ['hud'].forEach(i => $(i).classList.remove('on')); ['res', 'pause'].forEach(i => $(i).classList.remove('on')); $('home').classList.add('on'); show('', 1);
}
const free = (c, lx) => !cars.some(o => o !== c && o.d - c.d > -6 && o.d - c.d < 34 && Math.abs(o.x - lx) < 2.8);

function ai(c, dt) {
  const k = { gas: 1, brake: 0, steer: 0, boost: 0 };
  if (c.fin) { k.gas = c.v < 22; k.brake = c.v > 26; c.tx = clamp(c.tx, -6, 6); }
  else {
    if (pl && !pl.crash && !pl.fin && !c.me) c.vmax = c.base + clamp((pl.d - c.d) * .012, -3, 4);
    const bl = cars.find(o => o !== c && o.d - c.d > 0 && o.d - c.d < 30 && Math.abs(o.x - c.x) < 2.6 && (o.crash ? o.v < 10 : o.v < c.v + 3));
    if (bl) {
      let best = null;
      for (const lx of LANES) if (Math.abs(lx - c.x) <= 7 && free(c, lx) && (best === null || Math.abs(lx - c.x) < Math.abs(best - c.x))) best = lx;
      if (best !== null) c.tx = best; else { k.gas = 0; k.brake = bl.d - c.d < 14 ? 1 : 0; }
    } else {
      c.lt -= dt; if (c.lt < 0) { c.lt = 3 + Math.random() * 5; const lx = LANES[Math.random() * 6 | 0]; if (free(c, lx)) c.tx = lx; }
      if (Math.random() < dt * .0004) c.tx = (Math.random() < .5 ? -1 : 1) * 13; // rare driver mistake
    }
    if (c.bT > 0) { c.bT -= dt; k.boost = 1; } else if (c.fuel > 80 && Math.random() < dt * .15) c.bT = 2;
  }
  k.steer = clamp((c.tx - c.x) / 1.5, -1, 1); return k;
}
function crashCar(c, type) {
  if (c.crash) return;
  c.crash = { t: 0, type, s: c.x >= 0 ? 1 : -1, spin: (Math.random() < .5 ? -1 : 1) * (2 + Math.random() * 3) };
  c.boosting = false; if (c.me) show('💥 ACCIDENT!', 2500);
}
function drive(c, k, dt) {
  if (c.crash) {
    const q = c.crash; q.t += dt; c.v = Math.max(0, c.v - (q.type === 'flip' ? 18 : 30) * dt); c.d += c.v * dt;
    if (q.type === 'flip') c.x += q.s * Math.min(c.v, 12) * dt * .5; return;
  }
  let vm = c.vmax; const bo = !!k.boost && c.fuel > 0 && c.v > 5;
  if (bo) { vm += 38; c.fuel = Math.max(0, c.fuel - 26 * dt); } else c.fuel = Math.min(100, c.fuel + 5 * dt);
  c.boosting = bo;
  if (k.gas) c.v += (vm - c.v) * (bo ? 1.1 : .55) * dt; else c.v -= 6 * dt;
  if (c.v > vm) c.v += (vm - c.v) * dt * .8;
  if (k.brake) c.v -= 60 * dt;
  c.v = Math.max(0, c.v);
  c.x += k.steer * Math.min(1, c.v / 12) * 13 * dt; c.steer = k.steer;
  c.d += c.v * dt;
  if (!c.fin && c.d >= L) { c.fin = t - (c.d - L) / Math.max(c.v, 1); if (c.me) show('🏁 FINISH!', 2500); }
  if (c.fin && c.d > L + 150) c.v = 0;
  if (!c.fin && Math.abs(c.x) > 10.5) crashCar(c, 'flip');
}
function collide() {
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const a = cars[i], b = cars[j]; if (a.fin || b.fin || (a.crash && b.crash)) continue;
    const dd = a.d - b.d, dx = a.x - b.x; if (Math.abs(dd) >= 4.2 || Math.abs(dx) >= 2) continue;
    const rel = Math.abs(a.v - b.v);
    if (rel > 24) { crashCar(a, 'hit'); crashCar(b, 'hit'); continue; }
    if (Math.abs(dd) / 4.2 > Math.abs(dx) / 2) { const f = dd > 0 ? a : b, r = dd > 0 ? b : a; r.d = f.d - 4.25; r.v = Math.min(r.v, f.v * .95); }
    else { const s = dx >= 0 ? 1 : -1; a.x += s * .15; b.x -= s * .15; a.v *= .985; b.v *= .985; }
  }
}
function sim(dt) {
  t += dt;
  for (const c of cars) {
    let k = null;
    if (!c.crash) k = (c.me && !c.fin) ? { gas: input.g, brake: input.b, steer: input.r - input.l, boost: input.n } : ai(c, dt);
    drive(c, k, dt);
  }
  collide();
}
const ranks = () => [...cars].sort((a, b) => {
  const ga = a.fin ? 0 : a.crash ? 2 : 1, gb = b.fin ? 0 : b.crash ? 2 : 1;
  return ga !== gb ? ga - gb : ga === 0 ? a.fin - b.fin : b.d - a.d;
});
function step(dt) {
  sim(dt);
  if (t >= TLIM || (pl.fin && t - pl.fin > 1.5) || (pl.crash && pl.crash.t > 2.5) || cars.every(c => c.fin || c.crash)) end();
}
function end() {
  if (S === 'end') return; S = 'end';
  let n = 0; while (t < TLIM && n++ < 20000 && !cars.every(c => c.fin || c.crash)) sim(1 / 30);
  const r = ranks(), my = r.indexOf(pl) + 1, md = ['🥇', '🥈', '🥉'];
  $('hud').classList.remove('on');
  $('res').innerHTML = `<h2>${pl.crash ? '💥 দুর্ঘটনা!' : my === 1 ? '🏆 তুমি জিতেছো!' : '🏁 রেস শেষ'}</h2><div>তোমার পজিশন: <b>${pl.crash ? 'DNF' : my}</b></div><ol>` +
    r.map((c, i) => `<li class="${c.me ? 'me' : ''}"><span>${md[i] || i + 1 + '.'} #${c.num} ${c.name}</span><span>${c.fin ? fmt(c.fin) : c.crash ? 'দুর্ঘটনা' : 'Time up'}</span></li>`).join('') +
    `</ol><div class="bt"><button id="again" class="btn">↻ আবার</button><button id="rhome" class="btn s">🏠 হোম</button></div>`;
  $('res').classList.add('on'); $('again').onclick = startRace; $('rhome').onclick = goHome;
}

/* ---------- controls ---------- */
function hold(id, k) {
  const e = $(id), on = v => ev => { ev.preventDefault(); input[k] = v; };
  e.addEventListener('pointerdown', on(1)); ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => e.addEventListener(n, on(0)));
  e.addEventListener('contextmenu', ev => ev.preventDefault());
}
hold('bl', 'l'); hold('br', 'r'); hold('bg', 'g'); hold('bb', 'b'); hold('bn', 'n');
const KM = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'g', KeyW: 'g', ArrowDown: 'b', KeyS: 'b', Space: 'n', ShiftLeft: 'n' };
addEventListener('keydown', e => { if (KM[e.code]) input[KM[e.code]] = 1; });
addEventListener('keyup', e => { if (KM[e.code]) input[KM[e.code]] = 0; });
$('start').onclick = startRace;
$('pb').onclick = () => { if (S === 'race' || S === 'count') { paused = true; $('pause').classList.add('on'); } };
$('resume').onclick = () => { paused = false; $('pause').classList.remove('on'); };
$('phome').onclick = goHome;

/* ---------- loop ---------- */
function hud(dt) {
  $('spd').textContent = Math.round(pl.v * 3); $('fuel').style.width = pl.fuel + '%';
  $('prog').style.width = clamp(pl.d / L, 0, 1) * 100 + '%'; $('tm').textContent = mmss(Math.max(0, TLIM - t));
  hT -= dt; if (hT < 0) {
    hT = .2; const r = ranks();
    $('board').innerHTML = r.map((c, i) => `<div class="${c.me ? 'me' : ''} ${c.crash ? 'out' : ''}"><i>${i + 1}</i>#${c.num} ${c.name}</div>`).join('');
    $('pos').textContent = 'P' + (r.indexOf(pl) + 1) + ' / ' + N;
  }
}
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (S === 'home') { pCar.rotation.y += dt * .6; R.render(pScene, pCam); if (gn) gn.gain.value = 0; return; }
  if (!paused) {
    if (S === 'count') { cd -= dt; show(String(Math.ceil(cd))); if (cd <= 0) { S = 'race'; show('GO!', 800); } }
    else if (S === 'race') step(dt);
  }
  for (const c of cars) {
    const m = c.mesh, q = c.crash;
    if (q) {
      const r = Math.min(1, q.t / .9) * Math.PI;
      m.position.set(c.x, 1.4 * r / Math.PI + Math.sin(Math.min(1, q.t / .9) * Math.PI) * 2.2, -c.d);
      m.rotation.set(0, q.spin * Math.min(1, q.t), (q.type === 'flip' ? q.s : 1) * r);
    } else { m.position.set(c.x, 0, -c.d); m.rotation.set(0, -(c.steer || 0) * .2 * Math.min(1, c.v / 20), 0); }
  }
  if (pl && cars.length) {
    const want = new THREE.Vector3(pl.x * .7, 4.4, -pl.d + 10.5);
    if (snap) { cam.position.copy(want); snap = false; } else cam.position.lerp(want, 1 - Math.pow(.0005, dt));
    if (pl.boosting) cam.position.y += (Math.random() - .5) * .08;
    cam.lookAt(pl.x * .8, 1.3, -pl.d - 18);
    cam.fov += (62 + pl.v * .1 + (pl.boosting ? 12 : 0) - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix();
    for (const tr of trees) if (tr.position.z > cam.position.z + 15) tr.position.z -= 1000;
    hud(dt);
    if (osc) { osc.frequency.value = 50 + pl.v * 3.2 + (pl.boosting ? 40 : 0); gn.gain.value = S === 'race' && !paused && !pl.crash ? .04 : 0; }
  }
  R.render(scene, cam);
}
requestAnimationFrame(loop);
