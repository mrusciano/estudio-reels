// Cadena de postproceso HDR sin EffectComposer:
// escena -> RT lineal half-float (MSAA + depth) -> DOF (bokeh) -> bloom (1/4 + 1/8) -> composite
// (exposicion, ACES, gradacion split-tone, gamma, aberracion, vinieta, grano, fade) -> canvas.
import * as THREE from 'three';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const DOF_FRAG = /* glsl */`
uniform sampler2D tColor, tDepth;
uniform vec2 uRes;
uniform float uNear, uFar, uFocus, uAperture, uMaxCoc;
varying vec2 vUv;
float linDepth(float d) { float z = d * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float coc(float z) { return min(uMaxCoc, uAperture * abs(1. / uFocus - 1. / z)); }
void main() {
  float z0 = linDepth(texture2D(tDepth, vUv).x);
  float c0 = coc(z0);
  float wsum = 1.0 / max(c0 * c0, 1.0);
  vec3 acc = texture2D(tColor, vUv).rgb * wsum;
  const int N = 64;
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(N));
    float a = fi * 2.39996323;
    vec2 off = vec2(cos(a), sin(a)) * r * uMaxCoc;
    float dist = length(off);
    vec2 uv = vUv + off / uRes;
    float zs = linDepth(texture2D(tDepth, uv).x);
    float cs = coc(zs);
    float eff = (zs > z0) ? min(cs, c0) : cs;
    float w = smoothstep(dist - 1.0, dist + 1.0, eff) / max(eff * eff, 1.0);
    vec3 s = texture2D(tColor, uv).rgb;
    w *= 1.0 + 1.8 * clamp(dot(s, vec3(0.3, 0.5, 0.2)) - 0.8, 0.0, 6.0);
    acc += s * w; wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
}`;

// bloom de cadena de mips: bajada de 13 taps (Karis + rodilla suave en la primera) y subida tent 3x3 aditiva
const DOWN_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; uniform int uFirst; uniform float uThreshold, uKnee; varying vec2 vUv;
void main() {
  vec2 O[13]; float K[13];
  O[0]=vec2(-2,2); O[1]=vec2(0,2); O[2]=vec2(2,2); O[3]=vec2(-2,0); O[4]=vec2(0,0); O[5]=vec2(2,0); O[6]=vec2(-2,-2); O[7]=vec2(0,-2); O[8]=vec2(2,-2);
  O[9]=vec2(-1,1); O[10]=vec2(1,1); O[11]=vec2(-1,-1); O[12]=vec2(1,-1);
  K[0]=.03125; K[1]=.0625; K[2]=.03125; K[3]=.0625; K[4]=.125; K[5]=.0625; K[6]=.03125; K[7]=.0625; K[8]=.03125; K[9]=.125; K[10]=.125; K[11]=.125; K[12]=.125;
  vec3 acc = vec3(0.); float ws = 0.;
  for (int i = 0; i < 13; i++) {
    vec3 s = texture2D(tSrc, vUv + O[i] * uTexel).rgb; float w = K[i];
    if (uFirst == 1) w /= 1. + dot(s, vec3(.2126, .7152, .0722));
    acc += s * w; ws += w;
  }
  vec3 c = acc / ws;
  if (uFirst == 1) {
    float br = max(c.r, max(c.g, c.b)), s = clamp(br - uThreshold + uKnee, 0., 2. * uKnee);
    c *= max(s * s / (4. * uKnee + 1e-4), br - uThreshold) / max(br, 1e-4);
  }
  gl_FragColor = vec4(c, 1.);
}`;
const UP_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main() { vec2 d = uTexel; vec3 c =
  texture2D(tSrc, vUv + vec2(-d.x, d.y)).rgb + 2. * texture2D(tSrc, vUv + vec2(0., d.y)).rgb + texture2D(tSrc, vUv + d).rgb +
  2. * texture2D(tSrc, vUv + vec2(-d.x, 0.)).rgb + 4. * texture2D(tSrc, vUv).rgb + 2. * texture2D(tSrc, vUv + vec2(d.x, 0.)).rgb +
  texture2D(tSrc, vUv - d).rgb + 2. * texture2D(tSrc, vUv + vec2(0., -d.y)).rgb + texture2D(tSrc, vUv + vec2(d.x, -d.y)).rgb;
  gl_FragColor = vec4(c / 16., 1.); }`;

// sprites de bokeh: tamanio = CoC del DOF, energia conservada, prueba de profundidad manual contra la escena
const BOKEH_VERT = /* glsl */`
attribute vec3 aCol; attribute float aSeed; attribute float aSize;
uniform float uT, uFocus, uAperture, uMaxCoc, uPx; varying vec3 vCol; varying float vA, vZ;
void main() {
  vec3 p = position;
  p.y += sin(uT * .35 + aSeed * 6.28) * .004; p.x += sin(uT * .23 + aSeed * 17.) * .003;
  vec4 mv = modelViewMatrix * vec4(p, 1.); float z = -mv.z; vZ = z;
  float coc = min(uMaxCoc, uAperture * abs(1. / uFocus - 1. / z));
  float core = max(aSize * uPx / z, 1.5), size = max(core, coc * 2.);
  gl_PointSize = size; vA = max(core * core / (size * size), .03); vCol = aCol;
  gl_Position = projectionMatrix * mv;
}`;
const BOKEH_FRAG = /* glsl */`
uniform sampler2D tDepth; uniform vec2 uRes; uniform float uNear, uFar; varying vec3 vCol; varying float vA, vZ;
float lin(float d) { float z = d * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
void main() {
  float occ = smoothstep(-.02, .06, lin(texture2D(tDepth, gl_FragCoord.xy / uRes).x) - vZ);
  vec2 q = gl_PointCoord * 2. - 1.;
  float r = max(abs(q.x) * .866 + abs(q.y) * .5, abs(q.y));
  float disc = smoothstep(1., .9, r), ring = .78 + .3 * smoothstep(.55, .95, r);
  gl_FragColor = vec4(vCol * disc * ring * vA * occ, 1.);
}`;

const COMPOSITE_FRAG = /* glsl */`
uniform sampler2D tColor, tBloom;
uniform vec2 uRes;
uniform float uExposure, uBloom, uTime, uFade, uGrain, uVignette, uCA, uSat, uContrast;
uniform vec3 uShadowTint, uHighTint, uLift, uWB, uSlope, uOffset, uPower;
uniform int uTonemap;
varying vec2 vUv;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 agxContrast(vec3 x) { vec3 x2 = x * x; vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }
vec3 agx(vec3 c) {
  const mat3 inset = mat3(vec3(0.856627153315983, 0.137318972929847, 0.11189821299995), vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903), vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 outset = mat3(vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826), vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294), vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  c = inset * c; c = max(c, 1e-10); c = log2(c); c = clamp((c + 12.47393) / 16.499999, 0.0, 1.0);
  c = agxContrast(c); c = outset * c; return clamp(pow(max(vec3(0.0), c), vec3(2.2)), 0.0, 1.0);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 sampleHdr(vec2 uv) { vec3 b = texture2D(tBloom, uv).rgb; return texture2D(tColor, uv).rgb + uBloom * b + uBloom * 0.35 * b * vec3(1.0, 0.35, 0.12); }
void main() {
  vec2 d = vUv - 0.5;
  vec2 ca = d * uCA * dot(d, d) * 4.0;
  vec3 col = vec3(sampleHdr(vUv + ca).r, sampleHdr(vUv).g, sampleHdr(vUv - ca).b);
  col *= uExposure;
  col = pow(max(col * uWB * uSlope + uOffset, 0.0), uPower);
  col = uTonemap == 1 ? agx(col) : aces(col);
  // gradacion: sombras frias, altas calidas, lift, saturacion y curva S
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= mix(uShadowTint, uHighTint, smoothstep(0.05, 0.75, l));
  col = col + uLift * (1.0 - col);
  col = mix(vec3(l), col, uSat);
  col = clamp(col, 0.0, 1.0);
  col = mix(col, col * col * (3.0 - 2.0 * col), uContrast);
  col = pow(col, vec3(1.0 / 2.2));
  // vinieta ovalada para 9:16
  vec2 v = d * vec2(1.0, 0.75);
  col *= 1.0 - uVignette * smoothstep(0.18, 0.62, length(v));
  col += (hash(vUv * uRes + floor(uTime * 24.0) * 17.31) - 0.5) * uGrain * (1.0 - abs(l * 2.0 - 1.0) * 0.6);
  gl_FragColor = vec4(col * uFade, 1.0);
}`;

export function createPost(renderer, W, H) {
  const depthTex = new THREE.DepthTexture(W, H); depthTex.type = THREE.UnsignedIntType;
  const lin = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace, depthBuffer: false };
  const rtScene = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace, samples: 4, depthTexture: depthTex });
  const rtDof = new THREE.WebGLRenderTarget(W, H, lin);
  const MIPS = 6, mips = [];
  for (let i = 0, w = W >> 1, h = H >> 1; i < MIPS; i++, w >>= 1, h >>= 1) mips.push(new THREE.WebGLRenderTarget(Math.max(w, 1), Math.max(h, 1), lin));

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false;
  const qScene = new THREE.Scene(); qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const shader = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qScene, qCam); };

  const dof = shader(DOF_FRAG, {
    tColor: { value: rtScene.texture }, tDepth: { value: depthTex }, uRes: { value: new THREE.Vector2(W, H) },
    uNear: { value: 0.05 }, uFar: { value: 120 }, uFocus: { value: 2 }, uAperture: { value: 30 }, uMaxCoc: { value: 22 },
  });
  const down = shader(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 }, uThreshold: { value: 1.15 }, uKnee: { value: 0.5 } });
  const up = shader(UP_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  up.blending = THREE.AdditiveBlending;
  const comp = shader(COMPOSITE_FRAG, {
    tColor: { value: rtDof.texture }, tBloom: { value: mips[0].texture },
    uRes: { value: new THREE.Vector2(W, H) }, uExposure: { value: 1.0 }, uBloom: { value: 0.12 }, uTime: { value: 0 },
    uFade: { value: 1 }, uGrain: { value: 0.035 }, uVignette: { value: 0.55 }, uCA: { value: 0.0025 },
    uSat: { value: 1.08 }, uContrast: { value: 0.18 },
    uShadowTint: { value: new THREE.Vector3(0.9, 0.98, 1.12) }, uHighTint: { value: new THREE.Vector3(1.08, 1.0, 0.88) },
    uLift: { value: new THREE.Vector3(0.012, 0.014, 0.03) },
    uWB: { value: new THREE.Vector3(1, 1, 1) }, uSlope: { value: new THREE.Vector3(1, 1, 1) }, uOffset: { value: new THREE.Vector3(0, 0, 0) }, uPower: { value: new THREE.Vector3(1, 1, 1) }, uTonemap: { value: 0 },
  });
  const bokehScene = new THREE.Scene();
  const bokehMat = new THREE.ShaderMaterial({
    uniforms: { tDepth: { value: depthTex }, uRes: { value: new THREE.Vector2(W, H) }, uNear: { value: 0.05 }, uFar: { value: 120 },
      uFocus: { value: 2 }, uAperture: { value: 30 }, uMaxCoc: { value: 80 }, uPx: { value: 0 }, uT: { value: 0 } },
    vertexShader: BOKEH_VERT, fragmentShader: BOKEH_FRAG, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });

  function bloomMips() {
    let src = rtDof.texture, sw = W, sh = H;
    mips.forEach((m, i) => { down.uniforms.tSrc.value = src; down.uniforms.uTexel.value.set(1 / sw, 1 / sh); down.uniforms.uFirst.value = i === 0 ? 1 : 0; pass(down, m); src = m.texture; sw = m.width; sh = m.height; });
    renderer.autoClear = false;
    for (let i = MIPS - 1; i > 0; i--) { up.uniforms.tSrc.value = mips[i].texture; up.uniforms.uTexel.value.set(1 / mips[i].width, 1 / mips[i].height); pass(up, mips[i - 1]); }
    renderer.autoClear = true;
  }

  const api = {
    dof: dof.uniforms, comp: comp.uniforms, bokeh: bokehMat.uniforms,
    flags: { dof: true, bloom: true },
    bloom: 0.12,
    // puntos de bokeh: [{ pos: [x,y,z] mundo, col: [r,g,b] HDR, size: mundo, seed }]; obj opcional para seguir a un objeto
    addBokeh(points, follow = null) {
      const n = points.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seed = new Float32Array(n), size = new Float32Array(n);
      points.forEach((p, i) => { pos.set(p.pos, i * 3); col.set(p.col, i * 3); seed[i] = p.seed ?? (i * 0.6180339) % 1; size[i] = p.size ?? 0.004; });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      const pts = new THREE.Points(g, bokehMat); pts.frustumCulled = false; bokehScene.add(pts);
      return pts;
    },
    render(scene, camera, t) {
      dof.uniforms.uNear.value = camera.near; dof.uniforms.uFar.value = camera.far;
      renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
      if (api.flags.dof) pass(dof, rtDof);
      else { const a = dof.uniforms.uAperture.value; dof.uniforms.uAperture.value = 0; pass(dof, rtDof); dof.uniforms.uAperture.value = a; }
      const bu = bokehMat.uniforms;
      bu.uNear.value = camera.near; bu.uFar.value = camera.far; bu.uFocus.value = dof.uniforms.uFocus.value;
      bu.uAperture.value = api.flags.dof ? dof.uniforms.uAperture.value : 0;
      bu.uPx.value = H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); bu.uT.value = t;
      renderer.autoClear = false; renderer.setRenderTarget(rtDof); renderer.render(bokehScene, camera); renderer.autoClear = true;
      bloomMips();
      comp.uniforms.uBloom.value = api.flags.bloom ? api.bloom : 0;
      comp.uniforms.uTime.value = t;
      pass(comp, null);
    },
  };
  return api;
}
