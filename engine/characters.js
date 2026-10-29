// Personajes low-poly con jerarquia de articulaciones y pose por parametros (sin estado).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, glow, box, V, clamp, rng } from './core.js';

const UP = new THREE.Vector3(0, 1, 0);
function limb(r1, r2, m, scene) {
  const g = new THREE.CylinderGeometry(r2, r1, 1, 7); g.translate(0, 0.5, 0);
  const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
}
function place(mesh, a, b) {
  const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
  mesh.position.copy(a); mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(UP, d.normalize());
}
function ik(S, T, a, b, pole) {
  const d = Math.min(S.distanceTo(T), a + b - 1e-4);
  const dir = new THREE.Vector3().subVectors(T, S).normalize();
  const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(a * a - x * x, 0));
  const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  return { elbow: S.clone().add(dir.clone().multiplyScalar(x)).add(p.multiplyScalar(h)), wrist: S.clone().add(dir.multiplyScalar(d)) };
}

// ---------- persona con túnica y manto (personaje histórico, sabio, mago, abuelo…): barba y aureola opcionales ----------
function _buildTunica(scene, o = {}) {
  const C = { skin: '#c48d68', hair: '#3a2316', beard: '#33200f', tunic: '#e6dcc6', mantle: '#8f2b25', sandal: '#5a3a22', ...o.colors };
  const skinM = mat(C.skin), hairM = mat(C.hair, { roughness: 0.95 }), beardM = mat(C.beard, { roughness: 0.95 });
  const tunicM = mat(C.tunic), mantleM = mat(C.mantle, { roughness: 0.9 }), darkM = mat('#140d0a'), whiteM = mat('#f3eee6');
  const root = new THREE.Group(); scene.add(root);
  const pelvis = new THREE.Group(); pelvis.position.y = 0.47; root.add(pelvis);
  // regazo + caida de la tunica (sentado)
  const lap = box(0.36, 0.14, 0.24, tunicM, 0, 0.0, 0.04, pelvis);
  const legs = [];
  for (const s of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.42, 7), tunicM); thigh.rotation.x = Math.PI / 2;
    thigh.position.set(s * 0.095, 0.0, 0.24); thigh.castShadow = thigh.receiveShadow = true; pelvis.add(thigh);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.44, 7), tunicM);
    shin.position.set(s * 0.1, -0.23, 0.44); shin.castShadow = shin.receiveShadow = true; pelvis.add(shin);
    const sandal = box(0.09, 0.05, 0.2, mat(C.sandal), s * 0.1, -0.445, 0.5, pelvis);
    const toes = box(0.08, 0.04, 0.12, skinM, s * 0.1, -0.41, 0.52, pelvis);
    legs.push({ s, thigh, shin, sandal, toes });
  }
  // tunica larga que cae hasta los tobillos cuando esta de pie (y tapa las piernas al caminar)
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.27, 0.84, 10), tunicM); robe.position.y = -0.43; robe.scale.z = 0.8;
  robe.castShadow = robe.receiveShadow = true; robe.visible = false; pelvis.add(robe);
  const torso = new THREE.Group(); pelvis.add(torso);
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.165, 0.52, 7), tunicM);
  chest.scale.z = 0.66; chest.position.y = 0.27; chest.castShadow = chest.receiveShadow = true; torso.add(chest);
  // manto: banda diagonal hombro izq -> cadera der, panel de espalda, hombrera
  const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.205, 0.5, 9, 1, true, Math.PI * 0.35, Math.PI * 1.15), new THREE.MeshStandardMaterial({ color: C.mantle, flatShading: true, roughness: 0.9, side: THREE.DoubleSide }));
  cloak.scale.z = 0.72; cloak.position.y = 0.26; cloak.rotation.y = Math.PI * 0.15; cloak.castShadow = cloak.receiveShadow = true; torso.add(cloak);
  const sash = box(0.075, 0.5, 0.012, mantleM, 0.03, 0.27, 0.112, torso); sash.rotation.z = 0.55;
  const shoulderPiece = box(0.12, 0.045, 0.2, mantleM, 0.13, 0.5, -0.01, torso); shoulderPiece.rotation.z = -0.3;
  const neck = new THREE.Group(); neck.position.set(0, 0.52, 0); torso.add(neck);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.052, 0.1, 6), skinM); neckMesh.position.y = 0.04; neck.add(neckMesh);
  const head = new THREE.Group(); head.position.set(0, 0.06, 0.01); head.scale.setScalar(o.headScale ?? 1.22); neck.add(head);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.115, 1), skinM);
  skull.scale.set(0.84, 1.08, 0.95); skull.position.y = 0.12; skull.castShadow = true; head.add(skull);
  // pelo: casquete con raya al medio, cortina trasera y mechones laterales hasta los hombros
  const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.123, 1), hairM);
  cap.scale.set(0.9, 0.84, 1.0); cap.position.set(0, 0.17, -0.024); cap.castShadow = true; head.add(cap);
  for (const s of [-1, 1]) {
    const part = box(0.075, 0.03, 0.17, hairM, s * 0.04, 0.236, 0.0, head); part.rotation.z = s * -0.35;
    const lock = box(0.032, 0.2, 0.06, hairM, s * 0.094, 0.06, -0.025, head); lock.rotation.z = s * 0.12;
  }
  const back = box(0.16, 0.2, 0.05, hairM, 0, 0.03, -0.088, head); back.rotation.x = 0.2;
  // cara
  box(0.022, 0.045, 0.03, skinM, 0, 0.11, 0.108, head); // nariz
  const eyes = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * 0.037, 0.13, 0.1); head.add(g);
    box(0.03, 0.018, 0.008, whiteM, 0, 0, 0, g, false);
    const pupil = box(0.014, 0.016, 0.008, mat('#24150c'), 0, 0, 0.003, g, false);
    const glint = box(0.004, 0.004, 0.004, glow('#ffffff', 1.1), 0.003, 0.004, 0.008, g, false);
    const lid = box(0.034, 0.02, 0.012, skinM, 0, 0.011, 0.004, g, false); lid.geometry.translate(0, -0.01, 0);
    const brow = box(0.04, 0.01, 0.014, hairM, 0, 0.026, 0.005, g, false);
    eyes.push({ g, pupil, glint, lid, brow, s });
  }
  // barba y bigote; la boca es una caja oscura que se abre con la mandibula
  const beard = new THREE.Group(); beard.position.set(0, 0.06, 0.03); head.add(beard);
  const beardMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 0), beardM);
  beardMesh.scale.set(1.0, 0.95, 0.78); beardMesh.position.set(0, -0.012, 0.0); beardMesh.castShadow = true; beard.add(beardMesh);
  beard.visible = o.beard !== false;
  const mouth = box(0.04, 0.012, 0.01, darkM, 0, 0.075, 0.103, head, false);
  const lip = box(0.036, 0.008, 0.012, mat('#7a3b2c'), 0, 0.066, 0.1, head, false);
  const stache = box(0.075, 0.018, 0.024, beardM, 0, 0.087, 0.098, head, false); stache.visible = o.beard !== false;
  const corners = [-1, 1].map(s => box(0.012, 0.006, 0.01, darkM, s * 0.024, 0.076, 0.101, head, false));
  // aureola: anillo HDR (lo agarra el bloom) + disco tenue
  const halo = new THREE.Group(); halo.position.set(0, 0.16, -0.12); head.add(halo);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.0045, 6, 48), glow('#ffd28a', 2.0)); halo.add(ring);
  const discTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, 'rgba(255,214,150,0.55)'); g.addColorStop(0.7, 'rgba(255,190,110,0.18)'); g.addColorStop(1, 'rgba(255,190,110,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), new THREE.MeshBasicMaterial({ map: discTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: new THREE.Color(1.4, 1.2, 0.9) }));
  disc.position.z = -0.005; halo.add(disc);
  // brazos (IK, mallas sueltas en la escena)
  const arms = [-1, 1].map(s => ({
    s, upper: limb(0.06, 0.055, tunicM, scene), fore: limb(0.07, 0.05, tunicM, scene),
    hand: (() => { const g = new THREE.Group(); scene.add(g);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.03, 7), tunicM); cuff.position.y = -0.005; g.add(cuff);
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.06, 0.026), skinM); palm.position.y = 0.035; palm.castShadow = true; g.add(palm);
      for (let f = 0; f < 4; f++) { // cuatro dedos levemente curvados + pulgar
        const fg = new THREE.Group(); fg.position.set(-0.022 + f * 0.0147, 0.065, 0); fg.rotation.x = 0.35 + (f % 2) * 0.08; g.add(fg);
        const fm = new THREE.Mesh(new THREE.BoxGeometry(0.0125, 0.034 - Math.abs(f - 1.5) * 0.004, 0.017), skinM); fm.position.y = 0.016; fm.castShadow = true; fg.add(fm);
      }
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.036, 0.017), skinM); thumb.position.set(s * 0.036, 0.03, 0.01); thumb.rotation.z = s * 0.6; g.add(thumb);
      return g; })(),
  }));

  const tmp = new THREE.Vector3();
  const anchors = { head: new THREE.Vector3(), eyes: new THREE.Vector3(), chest: new THREE.Vector3(), handR: new THREE.Vector3(), handL: new THREE.Vector3() };
  // p: lean, twist, yaw, pitch, roll, blink, smile, browUp, sad, jaw, lookX, lookY, handL/handR: [x,y,z] en espacio local del root
  //    stand (0|1): de pie con tunica larga; walk: fase de caminata (rad) para el balanceo; palm (0..1): giro continuo de la mano
  function pose(p) {
    const st = p.stand ? 1 : 0, wph = p.walk ?? 0, wk = p.walk ? 1 : 0;
    pelvis.position.y = st ? 0.93 + wk * 0.012 * Math.abs(Math.sin(wph)) : 0.47;
    for (const l of legs) {
      if (st) { l.thigh.rotation.x = 0; l.thigh.position.set(l.s * 0.095, -0.22, 0.02); l.shin.position.set(l.s * 0.1, -0.65, 0.02);
        l.sandal.position.set(l.s * 0.1, -0.905, 0.07 + wk * 0.06 * Math.sin(wph) * l.s); l.toes.position.set(l.s * 0.1, -0.87, 0.1 + wk * 0.06 * Math.sin(wph) * l.s); }
      else { l.thigh.rotation.x = Math.PI / 2; l.thigh.position.set(l.s * 0.095, 0.0, 0.24); l.shin.position.set(l.s * 0.1, -0.23, 0.44); l.sandal.position.set(l.s * 0.1, -0.445, 0.5); l.toes.position.set(l.s * 0.1, -0.41, 0.52); }
      l.thigh.visible = l.shin.visible = !st;
    }
    robe.visible = !!st; robe.rotation.x = wk * 0.05 * Math.sin(wph); robe.rotation.z = wk * 0.03 * Math.sin(wph * 0.5); lap.visible = !st;
    torso.rotation.set(p.lean ?? 0.05, p.twist ?? 0, p.tilt ?? 0);
    neck.rotation.set((p.pitch ?? 0) * 0.4, (p.yaw ?? 0) * 0.4, (p.roll ?? 0) * 0.4);
    head.rotation.set((p.pitch ?? 0) * 0.6, (p.yaw ?? 0) * 0.6, (p.roll ?? 0) * 0.6);
    const smile = p.smile ?? 0, sad = p.sad ?? 0, browUp = p.browUp ?? 0;
    for (const e of eyes) {
      e.lid.scale.y = clamp(Math.max(p.blink ?? 0, (p.lazy ?? 0) + smile * 0.25), 0, 1);
      e.brow.rotation.z = -e.s * sad * 0.35 + e.s * browUp * 0.12;
      e.brow.position.y = 0.026 + browUp * 0.008 + sad * 0.003;
      e.pupil.position.x = (p.lookX ?? 0); e.pupil.position.y = (p.lookY ?? 0);
      e.glint.position.x = 0.003 + (p.lookX ?? 0);
    }
    const jaw = clamp(p.jaw ?? 0);
    const wide = clamp(p.wide ?? 0);
    mouth.scale.set((1 - smile * 0.1 + jaw * 0.05) * (1 + 0.35 * wide), 1 + jaw * 2.6, 1); mouth.position.y = 0.075 - jaw * 0.007;
    lip.position.y = 0.066 - jaw * 0.014;
    beard.position.y = 0.06 - jaw * 0.012;
    corners.forEach((cn, i) => { const s = i ? 1 : -1; cn.rotation.z = s * (smile * 0.6 - sad * 0.3); cn.position.y = 0.076 + smile * 0.005; cn.position.x = s * (0.024 + smile * 0.003); });
    halo.visible = p.halo ?? (o.halo === true);
    ring.material.color.setRGB(1, 0.82, 0.54).multiplyScalar(p.haloK ?? 2.0);

    root.updateMatrixWorld(true);
    for (const a of arms) {
      const S = tmp.set(a.s * 0.205, 0.47, 0); torso.localToWorld(S); const Sw = S.clone();
      const target = root.localToWorld(V(...(a.s < 0 ? p.handR : p.handL)));
      const { elbow, wrist } = ik(Sw, target, 0.28, 0.26, V(a.s * 0.5, -1, -0.3).normalize());
      place(a.upper, Sw, elbow); place(a.fore, elbow, wrist);
      a.hand.position.copy(wrist);
      a.hand.quaternion.setFromUnitVectors(UP, new THREE.Vector3().subVectors(wrist, elbow).normalize());
      a.hand.rotateY(a.s * (0.4 + 1.2 * clamp(p.palm ?? (p.palmUp ? 1 : 0))));
      (a.s < 0 ? anchors.handR : anchors.handL).copy(wrist);
    }
    head.localToWorld(anchors.head.set(0, 0.12, 0.04));
    head.localToWorld(anchors.eyes.set(0, 0.13, 0.1));
    torso.localToWorld(anchors.chest.set(0, 0.3, 0.1));
  }
  return { root, pose, anchors, head };
}

// ---------- Claude: bloque naranja con ojos verticales, brazos y 4 patas ----------
export function buildClawd(parent, o = {}) {
  const color = o.color ?? '#d97757';
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.08, flatShading: true, roughness: 0.62 });
  const eyeM = new THREE.MeshStandardMaterial({ color: '#120d0b', roughness: 0.35 });
  const S = o.size ?? 1;
  const root = new THREE.Group(); root.scale.setScalar(S); parent.add(root);
  const body = new THREE.Group(); root.add(body);
  const shell = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.21, 0.2, 2, 0.018), m);
  shell.position.y = 0.15; shell.castShadow = shell.receiveShadow = true; body.add(shell);
  const eyes = [-1, 1].map(s => box(0.032, 0.07, 0.012, eyeM, s * 0.07, 0.165, 0.101, body, false));
  const arms = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 0.15, 0.13, 0); body.add(g); box(0.05, 0.05, 0.08, m, s * 0.025, 0, 0, g); return g; });
  const legs = [-0.11, -0.04, 0.04, 0.11].map(x => box(0.035, 0.045, 0.07, m, x, 0.0225, 0, body));
  const anchors = { face: new THREE.Vector3(), body: new THREE.Vector3(), top: new THREE.Vector3() };
  // p: yaw, tilt, hop (altura), squash (-1..1), eyeOpen (0..1), lookX, armL, armR (rad), lean
  function pose(p) {
    root.rotation.y = p.yaw ?? 0;
    body.position.y = p.hop ?? 0;
    const sq = p.squash ?? 0;
    body.scale.set(1 + sq * 0.07, 1 - sq * 0.1, 1 + sq * 0.07);
    body.rotation.set(p.lean ?? 0, 0, p.tilt ?? 0);
    const open = clamp(p.eyeOpen ?? 1, 0.06, 1.3);
    eyes.forEach(e => { e.scale.y = open; e.position.x = Math.sign(e.position.x) * 0.07 + (p.lookX ?? 0); e.position.y = 0.165 + (p.lookY ?? 0); });
    arms[0].rotation.z = -(p.armR ?? 0.15); arms[1].rotation.z = (p.armL ?? 0.15);
    arms[0].rotation.x = p.armRx ?? 0; arms[1].rotation.x = p.armLx ?? 0;
    legs.forEach((l, i) => { l.rotation.x = (p.hop ?? 0) * 8 * (i % 2 ? 1 : -1); });
    m.emissiveIntensity = p.emissive ?? 0.14;
    root.updateMatrixWorld(true);
    body.localToWorld(anchors.face.set(0, 0.165, 0.1));
    body.localToWorld(anchors.body.set(0, 0.15, 0));
    body.localToWorld(anchors.top.set(0, 0.27, 0));
  }
  return { root, pose, anchors };
}

// ---------- persona actual (paramétrica): mismo esqueleto y misma API de pose que buildTunica ----------
// o.preset: 'chica' | 'chico' ; o.hair: 'long' | 'ponytail' | 'bun' | 'short' | 'curly' ; o.bangs ; o.glasses (true o color) ;
// o.lashes ; o.beard: 'none' | 'stubble' ; o.top: 'hoodie' | 'tee' ; o.colors: { skin, hair, top, pants, shoes, lips, iris } ;
// o.headScale ; o.shoulders. Para calcar a una persona real desde fotos: medir los colores de la foto (piel, pelo, ropa)
// y elegir el resto (pelo, anteojos, prenda). Los presets propios del usuario se agregan a PERSONA_PRESETS.
export const PERSONA_PRESETS = {
  chica: { hair: 'long', bangs: false, lashes: true, top: 'hoodie', colors: { skin: '#d9a582', hair: '#3b2418', top: '#8fa7c9', pants: '#3d5577', shoes: '#f1ede6', lips: '#b5615a', iris: '#3a2416' } },
  chico: { hair: 'short', lashes: false, beard: 'stubble', top: 'hoodie', shoulders: 0.215, colors: { skin: '#c99272', hair: '#2a1b12', top: '#4c6b52', pants: '#2f3b4f', shoes: '#e9e5de', lips: '#9c5a4c', iris: '#2b1a10' } },
};
function _buildPersona(scene, o = {}) {
  const base = PERSONA_PRESETS[o.preset ?? 'chica'];
  const P = { ...base, ...o, colors: { ...base.colors, ...o.colors } };
  const C = P.colors;
  const skinM = mat(C.skin), hairM = mat(C.hair, { roughness: 0.9 }), topM = mat(C.top, { roughness: 0.92 }), pantsM = mat(C.pants, { roughness: 0.9 });
  const shoeM = mat(C.shoes, { roughness: 0.7 }), soleM = mat('#d8d2c8'), darkM = mat('#140d0a'), whiteM = mat('#f3eee6');
  const SH = P.shoulders ?? 0.195;
  const root = new THREE.Group(); scene.add(root);
  const pelvis = new THREE.Group(); pelvis.position.y = 0.47; root.add(pelvis);
  const hips = box(0.34, 0.13, 0.22, pantsM, 0, 0.0, 0.03, pelvis);
  const legs = [];
  for (const s of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.07, 0.42, 7), pantsM); thigh.rotation.x = Math.PI / 2;
    thigh.position.set(s * 0.09, 0.0, 0.24); thigh.castShadow = thigh.receiveShadow = true; pelvis.add(thigh);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.066, 0.44, 7), pantsM);
    shin.position.set(s * 0.095, -0.23, 0.44); shin.castShadow = shin.receiveShadow = true; pelvis.add(shin);
    const shoe = new THREE.Group(); shoe.position.set(s * 0.095, -0.44, 0.48); pelvis.add(shoe);
    box(0.095, 0.07, 0.2, shoeM, 0, 0, 0, shoe); box(0.1, 0.022, 0.21, soleM, 0, -0.034, 0, shoe); box(0.06, 0.012, 0.05, topM, 0, 0.035, 0.05, shoe, false);
    legs.push({ s, thigh, shin, shoe });
  }
  // vestido/túnica larga (personajes de época): tapa las piernas de pie
  const robe = P.robe ? new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.26, 0.84, 10), mat(P.robe, { roughness: 0.92 })) : null;
  if (robe) { robe.position.y = -0.43; robe.scale.z = 0.8; robe.castShadow = robe.receiveShadow = true; robe.visible = false; pelvis.add(robe); }
  const torso = new THREE.Group(); pelvis.add(torso);
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(SH - 0.02, 0.165, 0.5, 8), topM);
  chest.scale.z = 0.66; chest.position.y = 0.26; chest.castShadow = chest.receiveShadow = true; torso.add(chest);
  if (P.top === 'hoodie') {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.035, 5, 10, Math.PI * 1.3), topM);
    hood.rotation.set(Math.PI / 2 + 0.35, 0, Math.PI * 0.85); hood.position.set(0, 0.5, -0.03); hood.castShadow = true; torso.add(hood);
    box(0.2, 0.09, 0.02, topM, 0, 0.12, 0.112, torso); // bolsillo canguro
    for (const s of [-1, 1]) box(0.008, 0.11, 0.008, whiteM, s * 0.03, 0.4, 0.118, torso, false); // cordones
  } else box(0.1, 0.02, 0.02, skinM, 0, 0.5, 0.09, torso, false); // escote de remera
  const neck = new THREE.Group(); neck.position.set(0, 0.52, 0); torso.add(neck);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.047, 0.1, 6), skinM); neckMesh.position.y = 0.04; neck.add(neckMesh);
  const head = new THREE.Group(); head.position.set(0, 0.06, 0.01); head.scale.setScalar(P.headScale ?? 1.28); neck.add(head);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.112, 2), mat(C.skin, { emissive: C.skin, emissiveIntensity: 0.12 })); // material propio: no comparte vertexColors
  skull.scale.set(0.84, 1.0, 0.95); skull.position.y = 0.122; skull.castShadow = true; head.add(skull);
  skull.userData.noJitter = true; // sin oscurecer el mentón (si no, parece barba)
  // pelo
  const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), hairM);
  cap.scale.set(0.92, 0.82, 1.0); cap.position.set(0, 0.17, -0.022); cap.castShadow = true; head.add(cap);
  const hairParts = [];
  if (P.hair === 'long') {
    const back = box(0.19, 0.3, 0.05, hairM, 0, 0.0, -0.085, head); back.rotation.x = 0.12; hairParts.push(back);
    for (const s of [-1, 1]) { const lock = box(0.03, 0.25, 0.06, hairM, s * 0.09, 0.03, -0.055, head); lock.rotation.z = s * 0.1; hairParts.push(lock); }
  } else if (P.hair === 'ponytail' || P.hair === 'bun') {
    const tie = new THREE.Mesh(new THREE.IcosahedronGeometry(P.hair === 'bun' ? 0.05 : 0.03, 0), hairM); tie.position.set(0, 0.2, -0.12); head.add(tie);
    if (P.hair === 'ponytail') { const tail = box(0.05, 0.2, 0.04, hairM, 0, 0.1, -0.15, head); tail.rotation.x = 0.35; hairParts.push(tail); }
  } else if (P.hair === 'curly') {
    const R = rng(7);
    for (let i = 0; i < 22; i++) {
      const a = R() * Math.PI * 2, b = R() * 1.2, c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035 + R() * 0.012, 0), hairM);
      c.position.set(Math.cos(a) * Math.sin(b) * 0.115, 0.17 + Math.cos(b) * 0.08, Math.sin(a) * Math.sin(b) * 0.11 - 0.03);
      if (c.position.z > 0.06 && c.position.y < 0.2) continue; // no tapar la cara
      head.add(c);
    }
  } else for (const s of [-1, 1]) box(0.012, 0.05, 0.03, hairM, s * 0.094, 0.125, 0.01, head); // patillas
  if (P.bangs) { const fr = box(0.15, 0.04, 0.03, hairM, 0, 0.215, 0.085, head); fr.rotation.x = -0.4; }
  if (P.veil) { // velo/manto sobre la cabeza que cae a los hombros
    const vm = new THREE.MeshStandardMaterial({ color: P.veil, flatShading: true, roughness: 0.95, side: THREE.DoubleSide });
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.36, 12, 1, true, Math.PI * 0.32, Math.PI * 1.36), vm);
    v.position.set(0, 0.07, -0.015); v.castShadow = true; head.add(v);
    const vt = new THREE.Mesh(new THREE.SphereGeometry(0.128, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), vm); vt.position.set(0, 0.2, -0.015); vt.scale.set(0.95, 0.8, 1.05); head.add(vt);
  }
  else if (P.hair !== 'curly') for (const s of [-1, 1]) { const part = box(0.07, 0.028, 0.16, hairM, s * 0.038, 0.232, 0.0, head); part.rotation.z = s * -0.32; }
  // cara
  box(0.02, 0.04, 0.028, skinM, 0, 0.112, 0.104, head); // nariz
  const eyes = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * 0.036, 0.132, 0.097); head.add(g);
    box(0.03, 0.02, 0.008, whiteM, 0, 0, 0, g, false);
    const pupil = box(0.015, 0.017, 0.008, mat(C.iris), 0, 0, 0.003, g, false);
    const glint = box(0.004, 0.004, 0.004, glow('#ffffff', 1.1), 0.003, 0.004, 0.008, g, false);
    const lid = box(0.034, 0.022, 0.012, skinM, 0, 0.012, 0.004, g, false); lid.geometry.translate(0, -0.011, 0);
    const brow = box(0.038, P.lashes ? 0.007 : 0.01, 0.012, hairM, 0, 0.026, 0.005, g, false);
    if (P.lashes) { const lash = box(0.012, 0.004, 0.006, darkM, s * 0.017, 0.011, 0.006, g, false); lash.rotation.z = s * 0.5; }
    eyes.push({ g, pupil, glint, lid, brow, s });
  }
  if (P.glasses) {
    const fm = mat(P.glasses === true ? '#1b1410' : P.glasses, { roughness: 0.4 });
    for (const s of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0035, 4, 4), fm); r.rotation.z = Math.PI / 4; r.scale.set(1.2, 0.95, 1); r.position.set(s * 0.036, 0.132, 0.112); head.add(r);
      box(0.004, 0.004, 0.09, fm, s * 0.068, 0.136, 0.07, head, false); // patillas
    }
    box(0.02, 0.004, 0.004, fm, 0, 0.138, 0.114, head, false); // puente
  }
  if (P.beard === 'stubble') {
    const st = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(C.hair, { roughness: 1, transparent: true, opacity: 0.35 }));
    st.scale.set(1.0, 0.7, 0.8); st.position.set(0, 0.065, 0.035); head.add(st);
  }
  const mouth = box(0.03, 0.008, 0.01, mat('#4a1a1c'), 0, 0.077, 0.1, head, false); // interior de boca, no negro (si no, parece perilla)
  const lip = box(0.03, 0.007, 0.012, mat(C.lips), 0, 0.069, 0.099, head, false);
  const corners = [-1, 1].map(s => box(0.01, 0.006, 0.01, darkM, s * 0.021, 0.078, 0.098, head, false));
  if (P.lashes) for (const s of [-1, 1]) box(0.022, 0.012, 0.004, mat('#e89a8a', { transparent: true, opacity: 0.35 }), s * 0.052, 0.098, 0.094, head, false); // rubor
  const arms = [-1, 1].map(s => ({
    s, upper: limb(0.055, 0.05, topM, scene), fore: limb(0.06, 0.045, topM, scene),
    hand: (() => {
      const g = new THREE.Group(); scene.add(g);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.05, 0.035, 7), topM); cuff.position.y = -0.005; g.add(cuff);
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.055, 0.024), skinM); palm.position.y = 0.032; palm.castShadow = true; g.add(palm);
      for (let f = 0; f < 4; f++) {
        const fg = new THREE.Group(); fg.position.set(-0.02 + f * 0.0133, 0.06, 0); fg.rotation.x = 0.35 + (f % 2) * 0.08; g.add(fg);
        const fmesh = new THREE.Mesh(new THREE.BoxGeometry(0.0115, 0.031 - Math.abs(f - 1.5) * 0.004, 0.016), skinM); fmesh.position.y = 0.015; fmesh.castShadow = true; fg.add(fmesh);
      }
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.033, 0.016), skinM); thumb.position.set(s * 0.033, 0.028, 0.01); thumb.rotation.z = s * 0.6; g.add(thumb);
      return g;
    })(),
  }));
  const tmp = new THREE.Vector3();
  const anchors = { head: new THREE.Vector3(), eyes: new THREE.Vector3(), chest: new THREE.Vector3(), handR: new THREE.Vector3(), handL: new THREE.Vector3() };
  function pose(p) {
    const st = p.stand ? 1 : 0, wph = p.walk ?? 0, wk = p.walk ? 1 : 0;
    pelvis.position.y = st ? 0.92 + wk * 0.012 * Math.abs(Math.sin(wph)) : 0.47;
    for (const l of legs) {
      if (st) { l.thigh.rotation.x = 0; l.thigh.position.set(l.s * 0.09, -0.22, 0.0); l.shin.position.set(l.s * 0.095, -0.65, 0.0); l.shoe.position.set(l.s * 0.095, -0.885, 0.05 + wk * 0.07 * Math.sin(wph) * l.s); }
      else { l.thigh.rotation.x = Math.PI / 2; l.thigh.position.set(l.s * 0.09, 0.0, 0.24); l.shin.position.set(l.s * 0.095, -0.23, 0.44); l.shoe.position.set(l.s * 0.095, -0.44, 0.48); }
      l.thigh.visible = l.shin.visible = !(st && robe);
    }
    if (robe) { robe.visible = !!st; robe.rotation.x = wk * 0.05 * Math.sin(wph); hips.visible = !st; }
    torso.rotation.set(p.lean ?? 0.05, p.twist ?? 0, p.tilt ?? 0);
    neck.rotation.set((p.pitch ?? 0) * 0.4, (p.yaw ?? 0) * 0.4, (p.roll ?? 0) * 0.4);
    head.rotation.set((p.pitch ?? 0) * 0.6, (p.yaw ?? 0) * 0.6, (p.roll ?? 0) * 0.6);
    const smile = p.smile ?? 0, sad = p.sad ?? 0, browUp = p.browUp ?? 0;
    for (const e of eyes) {
      e.lid.scale.y = clamp(Math.max(p.blink ?? 0, (p.lazy ?? 0) + smile * 0.25), 0, 1);
      e.brow.rotation.z = -e.s * sad * 0.35 + e.s * browUp * 0.12;
      e.brow.position.y = 0.026 + browUp * 0.009 + sad * 0.003;
      e.pupil.position.x = (p.lookX ?? 0); e.pupil.position.y = (p.lookY ?? 0);
      e.glint.position.x = 0.003 + (p.lookX ?? 0);
    }
    const jaw = clamp(p.jaw ?? 0), wide = clamp(p.wide ?? 0);
    mouth.scale.set((1 - smile * 0.1 + jaw * 0.05) * (1 + 0.35 * wide), 1 + jaw * 1.5, 1); mouth.position.y = 0.077 - jaw * 0.004;
    lip.position.y = 0.069 - jaw * 0.008;
    corners.forEach((cn, i) => { const s = i ? 1 : -1; cn.rotation.z = s * (smile * 0.6 - sad * 0.3); cn.position.y = 0.078 + smile * 0.005; cn.position.x = s * (0.021 + smile * 0.003); });
    for (const h of hairParts) h.rotation.y = (p.yaw ?? 0) * -0.05; // inercia mínima del pelo
    root.updateMatrixWorld(true);
    for (const a of arms) {
      const S = tmp.set(a.s * (SH + 0.005), 0.47, 0); torso.localToWorld(S); const Sw = S.clone();
      const target = root.localToWorld(V(...(a.s < 0 ? p.handR : p.handL)));
      const { elbow, wrist } = ik(Sw, target, 0.27, 0.25, V(a.s * 0.5, -1, -0.3).normalize());
      place(a.upper, Sw, elbow); place(a.fore, elbow, wrist);
      a.hand.position.copy(wrist);
      a.hand.quaternion.setFromUnitVectors(UP, new THREE.Vector3().subVectors(wrist, elbow).normalize());
      a.hand.rotateY(a.s * (0.4 + 1.2 * clamp(p.palm ?? (p.palmUp ? 1 : 0))));
      (a.s < 0 ? anchors.handR : anchors.handL).copy(wrist);
    }
    head.localToWorld(anchors.head.set(0, 0.12, 0.04));
    head.localToWorld(anchors.eyes.set(0, 0.132, 0.1));
    torso.localToWorld(anchors.chest.set(0, 0.3, 0.1));
  }
  return { root, pose, anchors, head };
}

// marca como 'char' toda malla que crea un constructor de personaje (los brazos son mallas sueltas en la escena, no cuelgan
// del root): así facetJitter -> smoothen las encuentra y las suaviza ("la versión Minecraft", devolución medida).
function tagNew(scene, fn) {
  const before = new Set(); scene.traverse(o => before.add(o));
  const r = fn();
  scene.traverse(o => { if (o.isMesh && !before.has(o)) o.userData.char = true; });
  return r;
}
export const buildTunica = (scene, o = {}) => tagNew(scene, () => _buildTunica(scene, o));
export const buildPersona = (scene, o = {}) => tagNew(scene, () => _buildPersona(scene, o));
