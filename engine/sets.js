// Sets reutilizables. outdoorSet: exterior low-poly parametrizable (cielo en gradiente, sol con halo HDR, colinas en capas,
// suelo, agua opcional con camino de sol, piedras, juncos, pajaros). Varios exteriores pueden convivir en la misma escena
// en distintos origenes (o.origin), como "escenarios" a los que la camara salta por plano.
import * as THREE from 'three';
import { mat, glow, box, V, rng, hash1 } from './core.js';

const skyTex = cols => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256); cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col));
  x.fillStyle = g; x.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const radial = (inner, outer) => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 6, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
};

export function outdoorSet(scene, BOKEH, o = {}) {
  const P = {
    origin: V(0, 0, 0), sky: ['#34407c', '#a8708c', '#f59a6a', '#ffd08c', '#ffe6b0'],
    sun: { at: [-3, 2.2, -80], color: '#ffe7b0', k: 7, r: 4.2, halo: 'rgba(255,214,150,0.75)' },
    hills: [[-75, 9, '#a8708a'], [-62, 6, '#8a5a78'], [-50, 3.5, '#6a4466']],
    ground: { color: '#c9a27a', w: 60, d: 40, z: 0, bump: 0.08 }, water: null, rocks: 14, reeds: 0, birds: 6, stars: 0, ...o,
  };
  const g = new THREE.Group(); g.position.copy(P.origin); scene.add(g);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(320, 110), new THREE.MeshBasicMaterial({ map: skyTex(P.sky), fog: false }));
  sky.position.set(0, 30, -95); g.add(sky);
  if (P.stars) {
    const n = P.stars, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), r = rng(3);
    for (let i = 0; i < n; i++) { pos.set([(r() - 0.5) * 220, 6 + r() * 70, -93], i * 3); const b = r() < 0.08 ? 3 : 0.6 + r(); col.set([b, b, b * 1.1], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, toneMapped: false })));
  }
  let sun = null;
  if (P.sun) {
    sun = new THREE.Mesh(new THREE.CircleGeometry(P.sun.r, 32), glow(P.sun.color, P.sun.k)); sun.position.set(...P.sun.at); g.add(sun);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(P.sun.r * 12, P.sun.r * 12), new THREE.MeshBasicMaterial({ map: radial(P.sun.halo, 'rgba(255,170,110,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
    halo.position.set(P.sun.at[0], P.sun.at[1], P.sun.at[2] + 0.5); g.add(halo);
  }
  P.hills.forEach(([z, h, color], k) => {
    const hr = rng(k + 1), s = new THREE.Shape(); s.moveTo(-160, -10);
    for (let x = -160; x <= 160; x += 4 + hr() * 6) s.lineTo(x, h * (0.35 + hr() * 0.65) + Math.sin(x * 0.04 + k) * h * 0.5);
    s.lineTo(160, -10);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color, fog: false })); m.position.set(0, -0.2, z); g.add(m);
  });
  // suelo
  const gr = P.ground, gg = new THREE.PlaneGeometry(gr.w, gr.d, Math.round(gr.w / 2), Math.round(gr.d / 2));
  { const p = gg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, (hash1(i * 1.3 + 7) - 0.5) * gr.bump); gg.computeVertexNormals(); }
  const ground = new THREE.Mesh(gg, mat(gr.color, { roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, gr.z); ground.receiveShadow = true; g.add(ground);
  // agua (lago o rio) con camino de sol
  let water = null, waterBase = null; const glints = [];
  if (P.water) {
    const W2 = P.water, wg = new THREE.PlaneGeometry(W2.w ?? 160, W2.d ?? 70, 70, 35); wg.rotateX(-Math.PI / 2);
    waterBase = wg.attributes.position.array.slice();
    water = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: W2.color ?? '#6a6f9a', roughness: 0.22, metalness: 0.15, flatShading: true }));
    water.position.set(W2.x ?? 0, W2.y ?? -0.04, W2.z ?? -36); water.receiveShadow = true; water.userData.noJitter = true; g.add(water);
    if (W2.glints !== false && P.sun) for (let i = 0; i < 60; i++) {
      const z = (W2.z ?? -36) + (W2.d ?? 70) / 2 - 2 - i * 1.0, w = 0.25 + (1 - i / 60) * 0.8 + hash1(i * 3) * 0.6;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.05 + hash1(i * 5) * 0.06), glow(W2.glint ?? '#ffe2a8', 3.5));
      m.rotation.x = -Math.PI / 2; m.position.set(P.sun.at[0] * (-z / 80) + (hash1(i * 7) - 0.5) * (1.2 + (-z) * 0.06), (W2.y ?? -0.04) + 0.06, z);
      m.material.transparent = true; m.userData.noJitter = true; g.add(m); glints.push({ m, seed: hash1(i * 11) * 10 });
    }
  }
  const R = rng(P.seed ?? 9);
  const rockM = mat('#8a7a72', { roughness: 0.95 }), rockM2 = mat('#76665e', { roughness: 0.95 });
  for (let i = 0; i < P.rocks; i++) {
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 + R() * 0.35, 0), R() < 0.5 ? rockM : rockM2);
    const a = R() * Math.PI * 2, d = 1.4 + R() * 5;
    r.position.set(Math.cos(a) * d * 1.4, 0.04, -0.6 + Math.sin(a) * d * 0.5); r.scale.y = 0.55; r.rotation.y = R() * 3; r.castShadow = r.receiveShadow = true; g.add(r);
  }
  const reedM = mat('#6f7a42'), reedTop = mat('#7a5a32');
  for (let i = 0; i < P.reeds; i++) {
    const x = (R() < 0.5 ? -1 : 1) * (1.6 + R() * 3.5), z = -1.2 - R() * 1.6, h = 0.6 + R() * 0.8;
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, h, 4), reedM); r.position.set(x, h / 2, z); r.rotation.z = (R() - 0.5) * 0.25; g.add(r);
    if (i % 3 === 0) { const tp = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 5), reedTop); tp.position.set(x, h + 0.02, z); g.add(tp); }
  }
  const birds = [];
  for (let i = 0; i < P.birds; i++) {
    const bg = new THREE.Group(); g.add(bg);
    const wm = new THREE.MeshBasicMaterial({ color: '#3a2a3a', fog: false, side: THREE.DoubleSide });
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.1).translate(-0.25, 0, 0), wm), wr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.1).translate(0.25, 0, 0), wm);
    bg.add(wl, wr); birds.push({ bg, wl, wr, s: hash1(i * 4.1), y: 5 + hash1(i * 2.2) * 5, z: -30 - hash1(i) * 15 });
  }
  function update(t) {
    if (water) {
      const p = water.geometry.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) { const x = waterBase[i], z = waterBase[i + 2]; p[i + 1] = 0.06 * Math.sin(x * 0.5 + t * 0.9) + 0.05 * Math.sin(z * 0.7 - t * 0.7); }
      water.geometry.attributes.position.needsUpdate = true; water.geometry.computeVertexNormals();
    }
    for (const gl of glints) gl.m.material.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.3 + gl.seed * 6.3));
    for (const b of birds) {
      const x = -22 + ((t * 1.6 + b.s * 40) % 44);
      b.bg.position.set(x, b.y + Math.sin(t * 0.7 + b.s * 9) * 0.4, b.z);
      const f = Math.sin(t * 7 + b.s * 20) * 0.6; b.wl.rotation.z = f; b.wr.rotation.z = -f;
    }
  }
  return { group: g, update, sun, sunAt: V(...(P.sun?.at ?? [0, 10, -80])).add(P.origin), water };
}

// Figuras de multitud baratas (instanciadas): cuerpo + cabeza, con color por instancia. pos: [[x,z,yaw,scale],...]
export function crowd(scene, pos, { body = '#3a3a48', head = '#c8946c', y = 0, flags = 0 } = {}) {
  const n = pos.length, bodyG = new THREE.CylinderGeometry(0.13, 0.18, 1.1, 7); bodyG.translate(0, 0.55, 0);
  const headG = new THREE.IcosahedronGeometry(0.12, 0); headG.translate(0, 1.25, 0);
  const bm = new THREE.InstancedMesh(bodyG, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), n);
  const hm = new THREE.InstancedMesh(headG, new THREE.MeshStandardMaterial({ color: head, flatShading: true, roughness: 0.9 }), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), cc = new THREE.Color(), pal = Array.isArray(body) ? body : [body];
  pos.forEach(([x, z, yaw = 0, s = 1], i) => {
    q.setFromAxisAngle(V(0, 1, 0), yaw); sc.setScalar(s); m4.compose(V(x, y, z), q, sc); bm.setMatrixAt(i, m4); hm.setMatrixAt(i, m4);
    bm.setColorAt(i, cc.set(pal[i % pal.length]).offsetHSL(0, 0, (hash1(i) - 0.5) * 0.12));
  });
  bm.castShadow = hm.castShadow = true; scene.add(bm, hm);
  const flagMeshes = [];
  for (let i = 0; i < flags; i++) {
    const [x, z] = pos[Math.floor(hash1(i * 3.7) * n)];
    const pole = box(0.02, 1.0, 0.02, mat('#d8d0c0'), x + 0.15, 1.3 + y, z, scene, false);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.28), new THREE.MeshStandardMaterial({ color: i % 2 ? '#7fb3e6' : '#f2f2ee', side: THREE.DoubleSide, flatShading: true }));
    f.position.set(x + 0.38, 1.66 + y, z); scene.add(f); flagMeshes.push({ f, s: hash1(i) });
  }
  return { bodies: bm, heads: hm, update: t => flagMeshes.forEach(({ f, s }) => { f.rotation.y = 0.25 * Math.sin(t * 2.5 + s * 9); }) };
}
