// Utilidades del estudio: tiempo puro (sin estado), curvas, film.json, camara por anclas, subtitulos.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const W = 1080, H = 1920, FPS = 30;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smoother = x => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
export const lerp = (a, b, k) => a + (b - a) * k;
export const ramp = (t, a, b) => smoother((t - a) / (b - a));
export const pulse = (t, a, b, fi = 0.25, fo = 0.35) => ramp(t, a - fi, a) * (1 - ramp(t, b, b + fo));
// claves [[t, v], ...] con smootherstep; tiempos estrictamente crecientes
export function key(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return lerp(v0, v1, smoother((t - t0) / (t1 - t0))); }
  }
  return keys[keys.length - 1][1];
}
export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash1 = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// ruido suave determinista (suma de senos) para vida y camara en mano
export const wobble = (t, seed = 0) => Math.sin(t * 0.71 + seed) * 0.6 + Math.sin(t * 1.37 + seed * 2.1) * 0.3 + Math.sin(t * 2.13 + seed * 3.7) * 0.1;

export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...o });
export const glow = (color, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false, fog: false });
export function box(w, h, d, m, x = 0, y = 0, z = 0, parent, shadows = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z); mesh.castShadow = shadows; mesh.receiveShadow = true;
  (parent || box.defaultParent)?.add(mesh);
  return mesh;
}
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Suavizado de personajes: cabezas y cuerpos muy facetados se ven "versión Minecraft" (devolución medida).
// Esferas/icosaedros -> más detalle; cajas >= 2 cm -> cajas redondeadas; cilindros/conos -> más lados.
// Solo mallas con userData.char (las marcan buildTunica/buildPersona) o userData.smooth; userData.noSmooth lo evita.
// Flags de URL: ?flags=facetado lo apaga; ?flags=suave además usa sombreado suave (mezcla estilos con la utilería: no recomendado).
const SMOOTH_SOFT = typeof location !== 'undefined' && /suave/.test(new URLSearchParams(location.search).get('flags') || '');
const SMOOTH_OFF = typeof location !== 'undefined' && /facetado/.test(new URLSearchParams(location.search).get('flags') || '');
export function smoothen(root) {
  if (SMOOTH_OFF) return;
  const mats = new Map();
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !(o.userData.char || o.userData.smooth) || o.userData.noSmooth) return;
    const g = o.geometry, p = g.parameters || {}; let ng = null;
    if (g.type === 'IcosahedronGeometry') ng = new THREE.IcosahedronGeometry(p.radius, Math.max(p.detail ?? 0, 3));
    else if (g.type === 'SphereGeometry') ng = new THREE.SphereGeometry(p.radius, Math.max(p.widthSegments, 18), Math.max(p.heightSegments, 12), p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
    else if (g.type === 'BoxGeometry') { const mn = Math.min(p.width, p.height, p.depth); if (mn >= 0.02) ng = new RoundedBoxGeometry(p.width, p.height, p.depth, 2, mn * 0.16); }
    else if (g.type === 'CylinderGeometry') ng = new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, Math.max(p.radialSegments, 16), p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength);
    else if (g.type === 'ConeGeometry') ng = new THREE.ConeGeometry(p.radius, p.height, Math.max(p.radialSegments, 16), p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength);
    if (!ng) return;
    // la geometría nueva sale de .parameters y pierde los translate()/rotate() previos (los brazos hacen g.translate(0, .5, 0):
    // sin esto quedaban como troncos saliendo del hombro). Misma caja desplazada: se corre; caja distinta (rotada/escalada): no se toca.
    g.computeBoundingBox(); ng.computeBoundingBox();
    { const a = g.boundingBox, b = ng.boundingBox, sa = a.getSize(new THREE.Vector3()), sb = b.getSize(new THREE.Vector3());
      if (sa.distanceTo(sb) > 1e-4 * Math.max(1, sa.length())) { ng.dispose(); return; }
      const d = a.getCenter(new THREE.Vector3()).sub(b.getCenter(new THREE.Vector3()));
      if (d.lengthSq() > 1e-12) ng.translate(d.x, d.y, d.z); }
    // color por vértice (el material comparte vertexColors con la utilería): solo el degradé vertical, sin ruido por cara
    ng.computeBoundingBox(); { const { min, max } = ng.boundingBox, hgt = (max.y - min.y) || 1, pos = ng.attributes.position, col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { const k = 0.84 + 0.2 * (pos.getY(i) - min.y) / hgt; col.set([k, k, k], i * 3); }
      ng.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
    o.geometry = ng; o.userData.noJitter = true;
    // material propio suave (los materiales se comparten con utilería facetada)
    if (!SMOOTH_SOFT) return; // por defecto queda facetado (low-poly pulido): el suave total mezclaba estilos
    const m = o.material; if (!m?.isMeshStandardMaterial || !m.flatShading) return;
    if (!mats.has(m)) { const c = m.clone(); c.flatShading = false; c.needsUpdate = true; mats.set(m, c); }
    o.material = mats.get(m);
  });
}

// T3: jitter de luminosidad/tono por cara y oscurecido hacia abajo de cada objeto (antes suaviza los personajes con smoothen)
export function facetJitter(root, { jitter = 0.1, top = 1.04, bottom = 0.8 } = {}) {
  smoothen(root);
  const done = new Set();
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.material?.isMeshStandardMaterial || o.userData.noJitter || done.has(o.geometry)) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    g.computeBoundingBox();
    const { min, max } = g.boundingBox, hgt = (max.y - min.y) || 1, pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    const seed = hash1(o.id * 1.37);
    for (let f = 0; f < pos.count; f += 3) {
      const r = hash1(f * 0.37 + seed * 91) - 0.5, rh = hash1(f * 0.71 + seed * 13) - 0.5;
      for (let k = 0; k < 3 && f + k < pos.count; k++) {
        const m = (bottom + (top - bottom) * (pos.getY(f + k) - min.y) / hgt) * (1 + r * jitter);
        col.set([m * (1 + rh * jitter * 0.25), m, m * (1 - rh * jitter * 0.25)], (f + k) * 3);
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    o.geometry = g; done.add(g); o.material.vertexColors = true; o.material.needsUpdate = true;
  });
}

// rim fresnel solo del lado de la luna + oscurecido de contacto por altura (tecnica T2 del hallazgo)
export const LOOK = {
  uRimDir: { value: new THREE.Vector3(0, 0, 1) }, uRimCol: { value: new THREE.Color(0x9db4e0).multiplyScalar(2.2) },
  uRimPow: { value: 2.4 }, uGroundY: { value: 0 }, uAOH: { value: 0.22 }, uAOMin: { value: 0.6 },
};
export function cinematic(m) {
  if (m.userData.cinematic || !m.isMeshStandardMaterial) return m;
  m.userData.cinematic = true;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, LOOK);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
          vWY = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;
        #else
          vWY = (modelMatrix * vec4(transformed, 1.0)).y;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWY; uniform vec3 uRimDir, uRimCol; uniform float uRimPow, uGroundY, uAOH, uAOMin;')
      .replace('#include <opaque_fragment>', `
        outgoingLight *= mix(uAOMin, 1.0, smoothstep(0.0, uAOH, vWY - uGroundY));
        float fres = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), uRimPow);
        float side = saturate(dot(normal, uRimDir) * 0.5 + 0.5);
        outgoingLight += uRimCol * fres * side * side * diffuseColor.rgb * 1.6;
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'cinematic';
  return m;
}

// ---------- film.json ----------
export function useFilm(film) {
  const cue = id => film.cues.find(c => c.id === id);
  const env = (who, t) => {
    const e = film.env[who]; if (!e) return 0;
    const f = t * film.efps, i = Math.floor(f);
    if (i < 0 || i >= e.length - 1) return 0;
    return lerp(e[i], e[i + 1], f - i);
  };
  const envAvg = (who, t, w) => { let s = 0; const n = 7; for (let k = 0; k < n; k++) s += env(who, t - w / 2 + (k / (n - 1)) * w); return s / n; };
  const LEAD = 0.04; // la boca se anticipa 40 ms al audio
  const atArr = (arr, t) => { if (!arr) return 0; const x = (t + LEAD) * film.efps, i = Math.floor(x); if (i < 0 || i >= arr.length - 1) return 0; return lerp(arr[i], arr[i + 1], x - i); };
  const mouth = (who, t) => { const m = film.mouth?.[who]; if (!m) return { open: env(who, t), wide: 0 }; const o = atArr(m.open, t); return { open: clamp((o - 0.06) / 0.64), wide: atArr(m.wide, t) * (1 - clamp((o - 0.06) / 0.64) * 0.5) }; };
  const speaking = (who, t, pad = 0.05) => film.cues.some(c => c.who === who && t > c.at - pad && t < c.end + pad);
  const word = (id, w) => cue(id).words.find(x => x.w.toLowerCase().replace(/[^a-záéíóúñü]/g, '') === w);
  return {
    film, cue, env, envAvg, speaking, word, mouth,
    c0: (id, off = 0) => cue(id).at + off,
    c1: (id, off = 0) => cue(id).end + off,
    w0: (id, w, off = 0) => word(id, w).s + off,
    w1: (id, w, off = 0) => word(id, w).e + off,
  };
}

// ---------- camara ----------
// Plano: { t0, t1, from: {p: [ancla, [dx,dy,dz]], l: [ancla, [dx,dy,dz]], fov}, to: {...}, focus: ancla, ap, shift, hand }
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
function resolve(anchors, [name, off]) { const a = anchors[name]; if (!a) throw new Error('ancla ' + name); return _c.copy(a).add(V(...off)); }
export function placeCamera(camera, shots, anchors, t) {
  const sh = shots.find(s => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
  const u = (t - sh.t0) / (sh.t1 - sh.t0);
  const k = sh.ease === 'linear' ? clamp(u) : smoother(clamp(u)) * 0.5 + clamp(u) * 0.5;
  const to = sh.to || sh.from;
  const p = _a.copy(resolve(anchors, sh.from.p)).lerp(resolve(anchors, to.p), k);
  const l = _b.copy(resolve(anchors, sh.from.l)).lerp(resolve(anchors, to.l), k);
  const fov = lerp(sh.from.fov, to.fov ?? sh.from.fov, k);
  // camara en mano: dos senos lentos escalados por la distancia + roll minimo
  const dist = p.distanceTo(l), hand = (sh.hand ?? 1) * dist * 0.012;
  p.x += wobble(t, 1.3) * hand; p.y += wobble(t * 0.8, 4.1) * hand * 0.7;
  camera.position.copy(p); camera.fov = fov; camera.lookAt(l);
  camera.rotateZ(wobble(t * 0.5, 7.7) * 0.004 * (sh.hand ?? 1));
  const shift = sh.shift ?? 0;
  if (shift) camera.setViewOffset(W, H, 0, -shift * H, W, H); else camera.clearViewOffset();
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  // foco medido sobre la direccion de vista
  const fa = anchors[sh.focus] || l;
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const focus = Math.max(0.1, _c.copy(fa).sub(camera.position).dot(dir));
  return { shot: sh, focus, ap: sh.ap ?? 30, u };
}

// ---------- subtitulos ----------
function wrap(ctx, text, maxW) {
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) { const test = cur ? cur + ' ' + w : w; if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test; }
  if (cur) lines.push(cur);
  // balanceo: si la ultima linea queda huerfana, pasa una palabra
  if (lines.length === 2) {
    const a = lines[0].split(' '), b = lines[1].split(' ');
    while (a.length > 1 && ctx.measureText(b.join(' ')).width < ctx.measureText(a.join(' ')).width * 0.55) b.unshift(a.pop());
    return [a.join(' '), b.join(' ')];
  }
  return lines;
}
export function drawSubtitle(ctx, film, t, o = {}) {
  const y0 = o.y ?? 640, size = o.size ?? 54;
  for (const s of film.subs) {
    if (t < s.t0 || t > s.t1 + 0.12) continue;
    const k = ramp(t, s.t0, s.t0 + 0.1) * (1 - ramp(t, s.t1, s.t1 + 0.12));
    if (k <= 0) continue;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.font = `600 ${size}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = wrap(ctx, s.text, 860), lh = size * 1.22;
    const top = y0 - (lines.length - 1) * lh / 2 + (1 - k) * 6;
    // halo oscuro detras para legibilidad sin caja
    const g = ctx.createRadialGradient(540, y0, 20, 540, y0, 520);
    g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y0 - 260, W, 520);
    ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 2;
    ctx.fillStyle = s.who === (o.tintWho ?? '') ? (o.tint ?? '#fff3e6') : '#ffffff';
    lines.forEach((ln, i) => ctx.fillText(ln, 540, top + i * lh));
    ctx.restore();
  }
}


// ---------- gancho en pantalla (hallazgo ganchos: 3-6 palabras con la premisa en el frame 1, ~3 s) ----------
// hook: { text, key? (palabra resaltada en amarillo), until? }  Zona segura: y 300-420 (debajo de la UI superior de Reels/TikTok).
export function drawHook(ctx, t, hook, o = {}) {
  if (!hook?.text) return;
  const until = hook.until ?? 3.2, k = 1 - ramp(t, until - 0.25, until);
  if (k <= 0) return;
  const size = o.size ?? 74, y = o.y ?? 360;
  ctx.save(); ctx.globalAlpha = k; ctx.font = `800 ${size}px Inter`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const words = hook.text.split(' '), lines = []; let cur = [];
  for (const w of words) { const test = [...cur, w].join(' '); if (ctx.measureText(test).width > 900 && cur.length) { lines.push(cur); cur = [w]; } else cur.push(w); }
  lines.push(cur);
  // balanceo: que la segunda linea no quede huerfana
  if (lines.length === 2) while (lines[0].length > 1 && ctx.measureText(lines[1].join(' ')).width < ctx.measureText(lines[0].join(' ')).width * 0.6) lines[1].unshift(lines[0].pop());
  const lh = size * 1.15, pop = 1 + 0.06 * (1 - ramp(t, 0, 0.25));
  lines.forEach((ln, i) => {
    const full = ln.join(' '), wFull = ctx.measureText(full).width; let x = 540 - wFull / 2; const yy = y + (i - (lines.length - 1) / 2) * lh;
    ctx.save(); ctx.translate(540, yy); ctx.scale(pop, pop); ctx.translate(-540, -yy);
    for (const w of ln) {
      const isKey = hook.key && w.toLowerCase().replace(/[^\p{L}\d]/gu, '') === hook.key.toLowerCase();
      ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText(w, x, yy);
      ctx.fillStyle = isKey ? '#ffd84a' : '#ffffff'; ctx.fillText(w, x, yy);
      x += ctx.measureText(w + ' ').width;
    }
    ctx.restore();
  });
  ctx.restore();
}


// ---------- gesto sostenido (aprendizaje: los brazos que se mueven siguiendo las sílabas se ven raros) ----------
// 0..1 mientras 'who' esta en una linea (opcional: filtro por cue), con ataque/caida lentos y SIN seguir las silabas.
// Usar esto para manos y gestos; la envolvente de la voz queda solo para la boca.
export function held(film, who, t, { a = 0.5, r = 0.8, only = null } = {}) {
  let k = 0;
  for (const c of film.cues) if (c.who === who && (!only || only(c))) k = Math.max(k, ramp(t, c.at - 0.15, c.at - 0.15 + a) * (1 - ramp(t, c.end, c.end + r)));
  return k;
}
