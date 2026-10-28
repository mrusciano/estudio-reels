// Episodio de ejemplo "Rulo": de madrugada, ella le habla a su planta moribunda; Claude (bloque naranja) la mira desde la cama.
// Sirve de plantilla: pieza actual de noche que amanece, dos personajes, plan de camara automatico, inserto nombrado en la coda.
// window.renderAt(t) es funcion pura del tiempo.
import * as THREE from 'three';
import { W, H, clamp, lerp, ramp, pulse, rng, hash1, wobble, mat, glow, box, V, useFilm, placeCamera, drawSubtitle, drawHook, held, LOOK, cinematic, facetJitter } from '../../engine/core.js';
import { createPost } from '../../engine/post.js';
import { planShots, expression } from '../../engine/director.js';
import { buildPersona, buildClawd } from '../../engine/characters.js';

const EP = new URLSearchParams(location.search).get('ep');
const film = await (await fetch(`./episodes/${EP}/film.json`, { cache: 'no-store' })).json();
const script = await (await fetch(`./episodes/${EP}/script.json`, { cache: 'no-store' })).json();
const F = useFilm(film);
const { envAvg, speaking, mouth } = F;
const FLAGS = new URLSearchParams(location.search).get('flags') || '';
const BOKEH = [];
const T = film.total;
const DAWN = t => ramp(t, T * 0.45, T + 0.5); // 0 = noche, 1 = amanecer

// ---------- render ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const post = createPost(renderer, W, H);
post.flags.dof = !FLAGS.includes('nodof'); post.flags.bloom = !FLAGS.includes('nobloom');
post.bloom = 0.2;
post.comp.uExposure.value = 1.55;
// preset "Madrugada tibia": luminoso y poco contrastado (registro tierno)
post.comp.uTonemap.value = FLAGS.includes('agx') ? 1 : 0; post.comp.uWB.value.set(1.0, 0.98, 0.97); post.comp.uSlope.value.set(1.04, 1.0, 0.98); post.comp.uOffset.value.set(0.004, 0.003, 0.006); post.comp.uPower.value.set(1.08, 1.08, 1.06);
post.comp.uSat.value = 1.12; post.comp.uContrast.value = 0.3; post.comp.uLift.value.set(0.004, 0.004, 0.01); post.comp.uVignette.value = 0.5;
post.comp.uShadowTint.value.set(0.9, 0.97, 1.12); post.comp.uHighTint.value.set(1.05, 1.0, 0.94);
const out = document.createElement('canvas'); out.width = W; out.height = H; out.style.width = '270px';
document.body.appendChild(out);
const octx = out.getContext('2d');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#06070d');
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 120);
box.defaultParent = scene;

// ---------- pieza ----------
const BACK = -1.7, LEFT = -1.9, RIGHT = 1.9, CEIL = 2.6;
const wallM = mat('#c9b6a2', { roughness: 0.95 }), wallM2 = mat('#b9a48f', { roughness: 0.95 }), floorM = mat('#8a6446', { roughness: 0.8 });
const WIN = { x0: -0.35, x1: 0.75, y0: 1.0, y1: 2.05 };
// pared del fondo con hueco de ventana
box(WIN.x0 - LEFT, CEIL, 0.1, wallM, (LEFT + WIN.x0) / 2, CEIL / 2, BACK);
box(RIGHT - WIN.x1, CEIL, 0.1, wallM, (WIN.x1 + RIGHT) / 2, CEIL / 2, BACK);
box(WIN.x1 - WIN.x0, WIN.y0, 0.1, wallM, (WIN.x0 + WIN.x1) / 2, WIN.y0 / 2, BACK);
box(WIN.x1 - WIN.x0, CEIL - WIN.y1, 0.1, wallM, (WIN.x0 + WIN.x1) / 2, (CEIL + WIN.y1) / 2, BACK);
box(0.1, CEIL, 4.2, wallM2, LEFT, CEIL / 2, 0.4); box(0.1, CEIL, 4.2, wallM2, RIGHT, CEIL / 2, 0.4);
box(4, 0.04, 4.4, floorM, 0, -0.02, 0.4); box(4, 0.04, 4.4, mat('#d8cbbb'), 0, CEIL, 0.4);
for (let i = 0; i < 14; i++) box(0.012, 0.004, 4.3, mat('#6e4e36'), -1.85 + i * 0.28, 0.002, 0.4, scene, false); // juntas del parquet
// marco y alfeizar de la ventana, cortina
const frameM = mat('#efe8de');
box(WIN.x1 - WIN.x0 + 0.1, 0.05, 0.2, frameM, (WIN.x0 + WIN.x1) / 2, WIN.y0, BACK + 0.06);
box(0.04, WIN.y1 - WIN.y0, 0.05, frameM, (WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, BACK + 0.02);
box(WIN.x1 - WIN.x0, 0.035, 0.05, frameM, (WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, BACK + 0.02);
const curtainM = mat('#d98c6a', { roughness: 0.95 });
for (let i = 0; i < 4; i++) box(0.09, WIN.y1 - WIN.y0 + 0.35, 0.04, curtainM, WIN.x1 + 0.08 + i * 0.075, (WIN.y0 + WIN.y1) / 2 + 0.1, BACK + 0.1 + (i % 2) * 0.03);
// cielo: gradiente que amanece (se redibuja por cuadro) + edificios con ventanas encendidas
const skyCanvas = document.createElement('canvas'); skyCanvas.width = 64; skyCanvas.height = 256;
const sctx = skyCanvas.getContext('2d');
const skyTex = new THREE.CanvasTexture(skyCanvas); skyTex.colorSpace = THREE.SRGBColorSpace;
const skyM = new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false, fog: false });
const sky = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), skyM); sky.position.set(0.2, 2.2, -9); scene.add(sky);
const mixC = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
function drawSky(k) {
  const top = mixC([10, 16, 44], [70, 104, 168], k), mid = mixC([22, 34, 82], [238, 160, 132], k), low = mixC([40, 52, 108], [255, 196, 140], k);
  const g = sctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, `rgb(${top})`); g.addColorStop(0.55, `rgb(${mid})`); g.addColorStop(1, `rgb(${low})`);
  sctx.fillStyle = g; sctx.fillRect(0, 0, 64, 256); skyTex.needsUpdate = true;
  skyM.color.setScalar(1.15 + 0.5 * k);
}
const city = new THREE.Group(); scene.add(city);
const cr = rng(41), bldM = mat('#151a2c', { roughness: 1 });
for (let i = 0; i < 16; i++) {
  const w = 0.6 + cr() * 0.9, h = 1.0 + cr() * 3.2, x = -5 + i * 0.68 + cr() * 0.3, z = -6 - cr() * 2.5;
  box(w, h, 0.6, bldM, x, h / 2 - 0.3, z, city, false);
  for (let k = 0; k < 6; k++) if (cr() > 0.45) {
    const wx = x + (cr() - 0.5) * w * 0.8, wy = 0.1 + cr() * (h - 0.4) - 0.3;
    const b = 1.5 + cr() * 2.5;
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.1), glow(cr() > 0.3 ? '#ffc070' : '#bcd4ff', b)); wm.position.set(wx, wy, z + 0.31); city.add(wm);
    if (k % 2 === 0) BOKEH.push({ pos: [wx, wy, z + 0.32], col: [b * 0.5, b * 0.36, b * 0.2], size: 0.05, seed: cr() });
  }
}
// cama a la izquierda (Claude esta sentado arriba, en el borde)
const bedM = mat('#7d5a40'), duvetM = mat('#8fb3c9', { roughness: 0.95 }), sheetM = mat('#f1ece4');
const BED = { x: -1.2, z: -0.55, w: 1.0, d: 2.0 };
box(BED.w, 0.28, BED.d, bedM, BED.x, 0.14, BED.z);
box(BED.w - 0.04, 0.14, BED.d - 0.06, sheetM, BED.x, 0.35, BED.z);
const duvet = box(BED.w + 0.04, 0.07, BED.d * 0.62, duvetM, BED.x, 0.44, BED.z + 0.32); duvet.rotation.z = 0.02;
for (const dz of [-0.62, -0.36]) { const p = box(0.42, 0.12, 0.26, sheetM, BED.x - 0.1 + (dz > -0.5 ? 0.18 : 0), 0.48, BED.z + dz - 0.2); p.rotation.y = 0.15; }
box(BED.w + 0.06, 0.75, 0.06, bedM, BED.x, 0.37, BED.z - BED.d / 2 - 0.03); // respaldo
{ // peluche (detalle de pieza joven)
  const pm = mat('#c99a6e'); const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), pm); b.position.set(BED.x - 0.3, 0.55, BED.z - 0.62); b.castShadow = true; scene.add(b);
  const h = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), pm); h.position.set(BED.x - 0.3, 0.68, BED.z - 0.62); scene.add(h);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025, 0), pm); e.position.set(BED.x - 0.3 + s * 0.05, 0.74, BED.z - 0.62); scene.add(e); }
}
// escritorio a la derecha, contra la pared del fondo/derecha
const deskM = mat('#e6dccd'), deskLeg = mat('#3b3b40');
const DESK = { x: 1.3, z: -0.75, y: 0.74, w: 1.1, d: 0.6 };
box(DESK.w, 0.035, DESK.d, deskM, DESK.x, DESK.y, DESK.z);
for (const [dx, dz] of [[-0.5, -0.26], [0.5, -0.26], [-0.5, 0.26], [0.5, 0.26]]) box(0.03, DESK.y, 0.03, deskLeg, DESK.x + dx, DESK.y / 2, DESK.z + dz);
// silla (ella sentada, girada hacia la cama)
const chairM = mat('#5d6b7a');
box(0.46, 0.05, 0.44, chairM, 0.55, 0.45, -0.3); box(0.05, 0.5, 0.44, chairM, 0.8, 0.72, -0.3);
box(0.05, 0.44, 0.05, deskLeg, 0.55, 0.22, -0.3);
// apuntes, libros, resaltadores, laptop, celular, mate y termo
const R = rng(23);
const paperM = mat('#f7f3ea'), bookCols = ['#b0473b', '#3e6a8a', '#d1a23c', '#4f7a5a', '#7a4f8a'];
for (let i = 0; i < 9; i++) { const p = box(0.21, 0.004, 0.29, paperM, DESK.x - 0.35 + R() * 0.5, DESK.y + 0.02 + i * 0.004, DESK.z + 0.05 + (R() - 0.5) * 0.25); p.rotation.y = (R() - 0.5) * 0.9; }
for (let i = 0; i < 4; i++) box(0.24, 0.04, 0.17, mat(bookCols[i]), DESK.x + 0.4, DESK.y + 0.04 + i * 0.042, DESK.z - 0.12).rotation.y = (R() - 0.5) * 0.3;
for (let i = 0; i < 3; i++) { const hl = box(0.012, 0.012, 0.11, glow(['#f4ff5a', '#ff7ac8', '#7affb0'][i], 0.9), DESK.x - 0.05 + i * 0.03, DESK.y + 0.05, DESK.z + 0.22); hl.rotation.y = 0.4 + i * 0.3; }
const laptop = new THREE.Group(); laptop.position.set(DESK.x - 0.05, DESK.y + 0.02, DESK.z - 0.12); laptop.rotation.y = -0.25; scene.add(laptop);
box(0.34, 0.015, 0.23, mat('#9aa0a8', { roughness: 0.4 }), 0, 0, 0, laptop);
const lid = new THREE.Group(); lid.position.set(0, 0.008, -0.11); lid.rotation.x = -0.25; laptop.add(lid);
box(0.34, 0.22, 0.01, mat('#9aa0a8', { roughness: 0.4 }), 0, 0.11, 0, lid);
const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.19), glow('#cfe0ff', 1.4)); screen.position.set(0, 0.11, 0.006); lid.add(screen);
const screenLight = new THREE.PointLight('#bcd2ff', 0.8, 2.2, 2); screenLight.position.set(DESK.x - 0.12, DESK.y + 0.25, DESK.z + 0.05); scene.add(screenLight);
const phone = box(0.075, 0.008, 0.15, mat('#1c1c22'), DESK.x - 0.42, DESK.y + 0.022, DESK.z + 0.2); phone.rotation.y = 0.5;
// mate con bombilla y termo (Argentina)
const MATE = V(DESK.x + 0.12, DESK.y + 0.02, DESK.z + 0.2);
const mateM = mat('#6b4a2e');
const mate = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.07, 8), mateM); mate.position.copy(MATE).add(V(0, 0.035, 0)); mate.castShadow = true; scene.add(mate);
const yerba = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.006, 8), mat('#7d8a3c')); yerba.position.copy(MATE).add(V(0, 0.07, 0)); scene.add(yerba);
const bomb = box(0.006, 0.12, 0.006, mat('#d8d8dc', { metalness: 0.6, roughness: 0.3 }), MATE.x + 0.01, MATE.y + 0.1, MATE.z); bomb.rotation.z = -0.25;
const termo = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 10), mat('#2f5e4e', { roughness: 0.5 })); termo.position.set(DESK.x + 0.26, DESK.y + 0.15, DESK.z + 0.12); termo.castShadow = true; scene.add(termo);
// velador (key calida sobre ella)
const LAMP = V(DESK.x + 0.38, DESK.y, DESK.z + 0.14);
box(0.12, 0.02, 0.12, deskLeg, LAMP.x, LAMP.y + 0.01, LAMP.z);
box(0.015, 0.34, 0.015, deskLeg, LAMP.x, LAMP.y + 0.18, LAMP.z);
const shade = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.13, 10, 1, true), new THREE.MeshStandardMaterial({ color: '#f2d9b0', emissive: '#ffcf8a', emissiveIntensity: 0.9, side: THREE.DoubleSide, flatShading: true }));
shade.position.set(LAMP.x, LAMP.y + 0.38, LAMP.z); scene.add(shade);
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), glow('#fff0d0', 8)); bulb.position.set(LAMP.x, LAMP.y + 0.34, LAMP.z); scene.add(bulb);
BOKEH.push({ pos: [LAMP.x, LAMP.y + 0.34, LAMP.z], col: [5, 3.6, 2], size: 0.02, seed: 0.4 });
const lampLight = new THREE.SpotLight('#ffcf96', 7, 4, 1.0, 0.7, 2); lampLight.position.set(LAMP.x - 0.05, LAMP.y + 0.42, LAMP.z + 0.1); lampLight.target.position.set(0.4, 0.95, -0.2);
lampLight.castShadow = true; lampLight.shadow.mapSize.set(2048, 2048); lampLight.shadow.bias = -0.0008; lampLight.shadow.normalBias = 0.02; scene.add(lampLight, lampLight.target);
// Rulo, la planta: maceta en el escritorio; en la coda levanta las hojas (flor que se abre apenas)
const FLOR = V(DESK.x - 0.42, DESK.y + 0.02, DESK.z - 0.18);
const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.038, 0.08, 8), mat('#b8613e')); pot.position.copy(FLOR).add(V(0, 0.04, 0)); pot.castShadow = true; scene.add(pot);
const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.006, 8), mat('#3a2a1e')); soil.position.copy(FLOR).add(V(0, 0.078, 0)); scene.add(soil);
const stem = box(0.006, 0.16, 0.006, mat('#4f8a46'), FLOR.x, FLOR.y + 0.16, FLOR.z);
for (const s of [-1, 1]) { const lf = box(0.04, 0.004, 0.018, mat('#5a9a4e'), FLOR.x + s * 0.022, FLOR.y + 0.13 + (s > 0 ? 0.03 : 0), FLOR.z); lf.rotation.z = s * 0.4; }
const bloom = new THREE.Group(); bloom.position.copy(FLOR).add(V(0, 0.245, 0)); scene.add(bloom);
const petalM = mat('#e9b9cb');
const petals = [];
for (let i = 0; i < 6; i++) { const g = new THREE.Group(); g.rotation.y = (i / 6) * Math.PI * 2; bloom.add(g);
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.004, 0.05), petalM); p.geometry.translate(0, 0, 0.025); p.castShadow = true; g.add(p); petals.push(g); }
const pistil = new THREE.Mesh(new THREE.IcosahedronGeometry(0.012, 0), glow('#ffd36a', 1.5)); bloom.add(pistil);
const florLight = new THREE.PointLight('#ffe6b0', 0, 0.8, 2); florLight.position.copy(bloom.position).add(V(0, 0.08, 0.05)); scene.add(florLight);
// corcho con papelitos, lucecitas en guirnalda sobre la cama
box(0.6, 0.45, 0.02, mat('#b88a5a'), DESK.x, 1.4, BACK + 0.06);
for (let i = 0; i < 6; i++) { const p = box(0.08 + R() * 0.05, 0.1, 0.004, mat(['#ffe98a', '#ffb3c7', '#bfe3ff', '#f7f3ea'][i % 4]), DESK.x - 0.22 + (i % 3) * 0.2, 1.48 - Math.floor(i / 3) * 0.17, BACK + 0.075); p.rotation.z = (R() - 0.5) * 0.3; }
const lightsM = [];
for (let i = 0; i < 12; i++) {
  const x = LEFT + 0.1, z = BED.z - 0.9 + i * 0.16, y = 1.75 - Math.sin((i / 11) * Math.PI) * 0.12;
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), glow(i % 2 ? '#ffd28a' : '#ffb070', 5)); b.position.set(x, y, z); scene.add(b); lightsM.push(b);
  BOKEH.push({ pos: [x, y, z], col: [3.5, 2.3, 1.2], size: 0.012, seed: i * 0.17 });
}
const fairyLight = new THREE.PointLight('#ffbf80', 0.6, 2.5, 2); fairyLight.position.set(LEFT + 0.3, 1.6, BED.z); scene.add(fairyLight);

// ---------- luz ambiente ----------
const hemi = new THREE.HemisphereLight('#6a78a8', '#3a2a1e', 0.9); scene.add(hemi);
const windowLight = new THREE.DirectionalLight('#7f9cff', 1.6);
const WIN_DIR = V(0.2, 2.6, -5).sub(V(0, 0.9, -0.3)).normalize();
windowLight.position.set(0.2, 2.6, -5); windowLight.target.position.set(0, 0.9, -0.3);
windowLight.castShadow = true; windowLight.shadow.mapSize.set(2048, 2048);
Object.assign(windowLight.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -1.5, near: 1, far: 12 }); windowLight.shadow.bias = -0.0006; windowLight.shadow.normalBias = 0.02;
scene.add(windowLight, windowLight.target);

// ---------- personajes ----------
const clawdHolder = new THREE.Group(); clawdHolder.position.set(-0.85, 0.42, -0.3); clawdHolder.rotation.y = Math.PI / 2 - 0.2; scene.add(clawdHolder); // sobre la cama, mirando hacia ella
const clawd = buildClawd(clawdHolder, { size: 1.5, color: '#e2622e' });
const ella = buildPersona(scene, { preset: 'chica' });
ella.root.position.set(0.55, 0.0, -0.3); ella.root.rotation.y = -Math.PI / 2 + 0.25;
// luz naranja tenue que "tira" Claude sobre ella
const clawdGlow = new THREE.PointLight('#ffe2b0', 0.0, 1.6, 2); scene.add(clawdGlow);

facetJitter(scene);
scene.traverse(o => { if (o.isMesh && !o.userData.noLook && o.material?.isMeshStandardMaterial) cinematic(o.material); });
post.addBokeh(BOKEH);

// ---------- actuacion derivada del guion ----------
const L = Object.fromEntries(script.lines.map(l => [l.id, l]));
const blinks = seed => { const out = []; for (let k = 0, tb = 0.8 + hash1(seed) * 1.5; tb < T; tb += 2.2 + hash1(seed + ++k) * 2.8) out.push(tb); return out; };
const BL_C = blinks(3), BL_E = blinks(29);
const blinkAt = (t, list) => list.reduce((m, b) => Math.max(m, 1 - Math.abs(t - b) / 0.075), 0);
// la planta: ella la mira cuando la nombra; en la coda se abre un poco
const florWin = [];
for (const c of film.cues) if (c.who === 'ella') for (const w of c.words) if (/^rulo/i.test(w.w)) florWin.push({ t0: w.s - 0.25, t1: w.e + 1.2 });
const florLook = t => florWin.reduce((m, o) => Math.max(m, pulse(t, o.t0, o.t1, 0.3, 0.5)), 0);
const CODA = film.cues.find(c => L[c.id]?.coda);
const florOpen = t => CODA ? 0.25 + 0.75 * ramp(t, CODA.end + 0.1, CODA.end + 1.8) : 0.25;
const lineAt = (id, t, pad = 0.2) => { const c = film.cues.find(c => c.id === id); return c ? pulse(t, c.at - pad, c.end + pad, 0.2, 0.4) : 0; };
// mirada al piso en lineas avergonzadas / tristes, fidget de manos en las rapidas
const tagAt = (who, re, t) => film.cues.filter(c => c.who === who && re.test(L[c.id]?.tags || '')).reduce((m, c) => Math.max(m, pulse(t, c.at - 0.1, c.end + 0.3, 0.2, 0.5)), 0);

function act(t) {
  const EC = expression(film, script, 'claude', t), EE = expression(film, script, 'ella', t);
  const fl = florLook(t), dawn = DAWN(t);
  // Claude: cuerpo que "habla" con squash, saltito en lo excitado, ojos que se achican en lo deadpan
  const talkC = speaking('claude', t) ? envAvg('claude', t, 0.25) : 0;
  const hop = 0.03 * EC.excited * Math.abs(Math.sin(t * 7));
  clawd.pose({
    yaw: wobble(t * 0.4, 9) * 0.05 - 0.5 * ramp(t, (CODA?.at ?? 1e9) - 0.6, CODA?.at ?? 1e9), // en la coda mira la planta
    hop, squash: talkC * 0.3 - hop * 4, tilt: EE.surprise * 0.1 + wobble(t * 0.5, 3) * 0.03,
    eyeOpen: (1 + EC.surprise * 0.25) * (1 - EC.deadpan * 0.6) * (1 - blinkAt(t, BL_C) * 0.92),
    lookX: -0.004 * EC.deadpan, armL: 0.15 + 0.8 * EC.excited, armR: 0.15 + 0.8 * EC.excited + 0.3 * talkC,
  });
  // ella
  const talkE = speaking('ella', t) ? envAvg('ella', t, 0.3) : 0;
  const nerv = tagAt('ella', /nervous|rushed/i, t) * (1 - dawn * 0.6), shy = tagAt('ella', /sheepish/i, t), play = tagAt('ella', /playful/i, t);
  const calm = ramp(t, T * 0.6, T - 1.5); // se va aflojando
  const gestE = held(film, 'ella', t, { only: c => /sincere|thoughtful|playful/i.test(L[c.id]?.tags || '') }) * 0.8;
  ella.pose({
    lean: 0.12 + nerv * 0.08 - calm * 0.06 + talkE * 0.03 + 0.008 * Math.sin(t * 1.9), tilt: play * 0.08 + shy * -0.05,
    yaw: lerp(0.0, -0.75, fl) + wobble(t * 0.7, 11) * 0.04, pitch: lerp(0.05, 0.3, fl) + shy * 0.3 + nerv * 0.05 - calm * 0.04, roll: play * 0.1,
    blink: blinkAt(t, BL_E), smile: clamp(0.1 + 0.7 * EE.smile + 0.5 * play + 0.35 * calm - 0.25 * nerv), sad: clamp(EE.sad * 0.5 + nerv * 0.5),
    browUp: Math.max(EE.surprise, nerv * 0.7, play * 0.5), jaw: mouth('ella', t).open, wide: mouth('ella', t).wide,
    lookX: shy * 0.003, lookY: -shy * 0.004,
    // gesto sostenido por linea (held), NO la envolvente de la voz: si las manos siguen las silabas, se ven raras
    handR: V(-0.12, 0.6 + nerv * 0.08, 0.3 + nerv * 0.06).toArray(),
    handL: V(0.13, 0.6 + nerv * 0.08, 0.3 + nerv * 0.06).lerp(V(0.2, 0.74, 0.42), gestE).toArray(), palm: gestE * (1 - shy),
  });
  return { fl, dawn };
}

// ---------- anclas ----------
const A = { Cf: new THREE.Vector3(), Eh: new THREE.Vector3(), Ee: new THREE.Vector3(), Pair: new THREE.Vector3(),
  Flor: bloom.position.clone(), Desk: V(DESK.x, DESK.y, DESK.z), Win: V((WIN.x0 + WIN.x1) / 2, 1.5, BACK) };
function updateAnchors() {
  A.Cf.copy(clawd.anchors.face);
  A.Eh.copy(ella.anchors.head); A.Ee.copy(ella.anchors.eyes);
  A.Pair.copy(A.Cf).lerp(A.Eh, 0.5);
}

// ---------- plan de rodaje (director) ----------
// ejes: Claude en x<0 mirando a +x, ella en x>0 mirando a -x; la camara se queda del lado +z (regla de 180 grados)
const shot = (from, to, focus, ap, extra = {}) => () => ({ from, to, focus, ap, ...extra });
const TPL = {
  E_mcu: shot({ p: ['Eh', [-1.5, 0.0, 1.6]], l: ['Eh', [0.0, -0.16, 0]], fov: 30 }, { p: ['Eh', [-1.38, -0.01, 1.45]], l: ['Eh', [0.0, -0.16, 0]], fov: 30 }, 'Eh', 32, { shift: 0.06 }),
  E_cu: shot({ p: ['Eh', [-1.0, -0.04, 0.95]], l: ['Eh', [0.0, -0.03, 0]], fov: 28 }, { p: ['Eh', [-0.9, -0.04, 0.85]], l: ['Eh', [0.0, -0.03, 0]], fov: 28 }, 'Eh', 40, { shift: 0.08 }),
  E_ots: shot({ p: ['Cf', [-0.3, 0.3, 0.55]], l: ['Eh', [0, -0.06, 0]], fov: 29 }, { p: ['Cf', [-0.28, 0.28, 0.5]], l: ['Eh', [0, -0.06, 0]], fov: 29 }, 'Eh', 34, { shift: 0.05 }),
  C_mcu: shot({ p: ['Cf', [1.3, 0.4, 1.8]], l: ['Cf', [0.0, -0.08, 0]], fov: 36 }, { p: ['Cf', [1.2, 0.38, 1.65]], l: ['Cf', [0.0, -0.08, 0]], fov: 36 }, 'Cf', 32, { shift: 0.04 }),
  C_cu: shot({ p: ['Cf', [1.0, 0.22, 1.3]], l: ['Cf', [0.0, -0.04, 0]], fov: 34 }, { p: ['Cf', [0.92, 0.2, 1.2]], l: ['Cf', [0.0, -0.04, 0]], fov: 34 }, 'Cf', 40, { shift: 0.04 }),
  C_ots: shot({ p: ['Eh', [0.45, 0.08, 0.7]], l: ['Cf', [0.1, 0, 0]], fov: 40 }, { p: ['Eh', [0.42, 0.07, 0.64]], l: ['Cf', [0.1, 0, 0]], fov: 40 }, 'Cf', 34, { shift: 0.03 }),
  // plano de dos en diagonal: en 9:16 el horizontal es angosto, asi que los dos se 'apilan' en profundidad en vez de ir lado a lado lejos
  two: shot({ p: ['Pair', [1.5, 0.38, 1.25]], l: ['Pair', [0.15, -0.12, 0]], fov: 46 }, { p: ['Pair', [1.4, 0.35, 1.15]], l: ['Pair', [0.15, -0.12, 0]], fov: 46 }, 'Pair', 8, { hand: 0.5 }),
  flor: shot({ p: ['Flor', [0.16, 0.06, 0.6]], l: ['Flor', [0, -0.03, 0]], fov: 30 }, { p: ['Flor', [0.12, 0.05, 0.48]], l: ['Flor', [0, -0.02, 0]], fov: 30 }, 'Flor', 55, { subY: 1450 }),
  open: shot({ p: ['Eh', [-1.1, 0.02, 1.05]], l: ['Eh', [0.0, -0.05, 0]], fov: 30 }, { p: ['Eh', [-0.9, 0.0, 0.85]], l: ['Eh', [0.0, -0.04, 0]], fov: 29 }, 'Eh', 38, { shift: 0.07 }),
  close: shot({ p: ['Pair', [0.0, 0.35, 3.1]], l: ['Pair', [0.0, -0.05, -0.6]], fov: 42 }, { p: ['Pair', [0.0, 0.3, 2.75]], l: ['Pair', [0.0, -0.02, -0.6]], fov: 42 }, 'Pair', 8, { hand: 0.4 }),
};
const SHOTS = planShots(film, script, {
  bySpeaker: { ella: [TPL.E_mcu, TPL.E_ots, TPL.E_cu], claude: [TPL.C_mcu, TPL.C_ots, TPL.C_cu] },
  two: TPL.two, inserts: {}, named: TPL, minShot: script.minShot ?? 0,
  reaction: { ella: TPL.E_cu, claude: TPL.C_cu }, opening: TPL.two,
});
console.log('plan', SHOTS.map(s => `${s.t0.toFixed(1)}:${s.tag}`).join(' '));

// ---------- cuadro ----------
function frame(t) {
  const st = act(t);
  scene.updateMatrixWorld(true);
  updateAnchors();
  let cam = placeCamera(camera, SHOTS, A, t);
  const dawn = st.dawn;
  drawSky(dawn);
  city.children.forEach(m => { if (m.material?.isMeshBasicMaterial) m.visible = dawn < 0.85 || hash1(m.id) > dawn - 0.5; });
  windowLight.color.setRGB(lerp(0.5, 1.0, dawn), lerp(0.62, 0.78, dawn), lerp(1.0, 0.6, dawn)); windowLight.intensity = lerp(1.4, 3.2, dawn);
  hemi.intensity = lerp(0.9, 1.3, dawn);
  LOOK.uRimDir.value.copy(WIN_DIR).transformDirection(camera.matrixWorldInverse);
  LOOK.uRimCol.value.setRGB(lerp(0.62, 1.0, dawn), lerp(0.7, 0.75, dawn), lerp(0.88, 0.55, dawn)).multiplyScalar(2.2);
  // flor que florece + su luz
  const open = florOpen(t);
  petals.forEach((g, i) => { g.rotation.x = lerp(-1.25, -0.25, open) + 0.04 * Math.sin(t * 2 + i); });
  bloom.scale.setScalar(lerp(0.55, 1.0, open));
  pistil.material.color.setRGB(1.0, 0.83, 0.42).multiplyScalar(lerp(0.5, 1.6, open));
  florLight.intensity = 0.15 * open * (0.4 + st.fl);
  // luz de Claude sobre ella
  clawdGlow.color.set('#ffa070'); clawdGlow.position.copy(ella.anchors.head).add(V(-0.35, 0.05, 0.25)); clawdGlow.intensity = 0.35 * (1 + 0.04 * wobble(t * 3, 5));
  screenLight.intensity = 0.8 * (1 - 0.5 * dawn);
  for (const b of lightsM) b.material.color.setScalar(4.5 * (0.85 + 0.15 * Math.sin(t * 1.3 + b.id)));
  const dbg = FLAGS.match(/cam:([-\d._]+)/);
  if (dbg) { const v = dbg[1].split('_').map(Number); camera.clearViewOffset(); camera.position.set(v[0], v[1], v[2]); camera.lookAt(v[3], v[4], v[5]); camera.fov = v[6] || 40; camera.updateProjectionMatrix(); camera.updateMatrixWorld(); cam = { focus: camera.position.distanceTo(V(v[3], v[4], v[5])), ap: 0 }; }
  post.dof.uFocus.value = cam.focus; post.dof.uAperture.value = cam.ap;
  post.comp.uFade.value = clamp((T - t) / 0.5); // sin fundido de entrada: el frame 1 es el gancho
  post.render(scene, camera, t);
  octx.drawImage(renderer.domElement, 0, 0);
  drawSubtitle(octx, film, t, { y: cam.shot?.subY ?? 1380, size: 56 });
  // texto gancho opcional (script.hooks; --flags hookB prueba el segundo): probar y medir, no es la norma
  const HK = script.hooks?.[FLAGS.includes('hookB') ? 1 : 0]; drawHook(octx, t, HK);
}

// ---------- API para el renderizador ----------
const fUrl = '/node_modules/@fontsource/inter/files/';
for (const w of [500, 600]) document.fonts.add(await new FontFace('Inter', `url(${fUrl}inter-latin-${w}-normal.woff2)`, { weight: String(w) }).load());
await document.fonts.ready;
window.renderAt = (t, q = 0.95) => { frame(t); return out.toDataURL('image/jpeg', q).split(',')[1]; };
window.TOTAL = T;
window.__sfx = [];
const gl = renderer.getContext(); const dbgx = gl.getExtension('WEBGL_debug_renderer_info');
window.__gpu = dbgx ? gl.getParameter(dbgx.UNMASKED_RENDERER_WEBGL) : 'desconocido';
frame(0);
window.__ready = true;
