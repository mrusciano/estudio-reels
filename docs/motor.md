# Motor: referencia para escribir escenas

Referencia exacta de `engine/*.js` (three.js) y de `script.json`, para escribir `episodes/<id>/scene.js`. Ejemplo completo y vivo: `episodes/demo/`.

**Contrato central:** `window.renderAt(t)` es una **función pura del tiempo**. Nada de `Math.random`, `Date`, `performance.now` ni estado que se acumule entre cuadros. Así cualquier cuadro se puede renderizar en cualquier orden y en paralelo.

**Unidades:** metros, radianes, segundos. Cuadro 1080 × 1920 a 30 fps (`W`, `H`, `FPS` en `core.js`).

---

## 1. Flujo de un episodio

```
script.json ──voices.mjs──▶ voices/<id>.mp3 + .json ──build.mjs──▶ film.json + frames/bus_*.wav
                                                                    │
scene.js (lee film.json + script.json) ──render.mjs──▶ frames/video.mp4 + sfx.json ──mix.py──▶ out/<ep>.mp4
```

```
node tools/lint-script.mjs <ep>
node tools/sfx.mjs <ep>                       # opcional (script.sfx)
node tools/voices.mjs <ep> --takes 3
node tools/redo-line.mjs <ep> <id> --tags "[slowly]"   # si una línea falla
node tools/build.mjs <ep>
node tools/render.mjs <ep> stills 0.5 3 8      # contact sheet ANTES del video
node tools/render.mjs <ep> video [--flags …] [--workers N]
python -I tools/mix.py <ep>
```

---

## 2. `script.json`

### Campos del episodio
| Campo | Tipo / valores | Qué hace · quién lo lee |
|---|---|---|
| `title` | texto | Título (va a `film.title`) |
| `model` | `"eleven_v4"` | Modelo de voz. **Ponerlo siempre**: si falta, `voices.mjs` usa `eleven_v3` · voices |
| `language` | `"es"` | `language_code` del TTS · voices, lint |
| `stability` | 0..1 (0,45) | Global para toda la escena · voices |
| `tempo` | número (1,0) | Acelera las voces con `atempo` sin cambiar el tono (v4 no tiene `speed`) · build |
| `timing` | `"take"` \| ausente | `"take"`: usa la pausa natural de la toma entre líneas (acotada a 0,12-1,4 s). Si no, gap 0,5 s · build |
| `protegido` | id de personaje | Personaje que nunca queda en ridículo ni es sarcástico (antes `saint`). El lint marca como error tags sarcásticos/impacientes en sus líneas; la mezcla le da un poco más de reverb · lint, mix |
| `set` | `pieza` \| `piedra` \| `casa-dia` \| `lago` \| `campo` \| `colonial` | Preset de mezcla: música por defecto, ambiente y reverb (default `pieza`) · mix |
| `music` | `piano` \| `oud` \| `ninguna` | Pisa la música del set · mix |
| `lluvia` | bool | Capa de lluvia en el ambiente · mix |
| `tail` | segundos (0,7) | Aire después de la última palabra antes del corte · build, lint (< 1,8 s sin `coda` = aviso) |
| `minShot` | segundos | Duración mínima de plano para el director (3-4 tierno, ~2 comedia). Lo pasa la escena a `planShots` |
| `perfil` | texto | Perfil de reglas del lint |
| `voices` | `{ who: { id, name, reverb? } }` | Voz de ElevenLabs por personaje; `reverb` multiplica la reverb de ese personaje · voices, mix |
| `lines` | array | Ver abajo |
| `sfx` | array | Efectos generados por prompt (ver abajo) · sfx, build |
| `amb` | array | Ventanas de ambiente (ver abajo) · mix |
| `hooks` | `[{ text, key?, until? }]` | Texto gancho opcional (solo para A/B: `--flags hookB` usa el segundo). El lint avisa · escena (`drawHook`) |
| `ficha` | objeto | Ficha de guion (valor, decisión, núcleo, button…). Documentación, no se procesa |

### Campos de cada línea (`lines[]`)
| Campo | Tipo | Qué hace |
|---|---|---|
| `id` | texto | Identificador único (`e1`, `c3`…). Lo usan cues, planos y fases |
| `who` | clave de `voices` | Quién habla |
| `text` | texto | Lo que se dice. Números en letras, ¿¡, una MAYÚSCULA de énfasis (sale en minúscula en el subtítulo), `…` dudas, `—` interrupción |
| `tags` | `"[warmly]"` | Audio tags en inglés, uno por cláusula. También alimentan `expression()` |
| `gap` | segundos | Silencio antes de la línea (pisa `timing`). Negativo = solapa |
| `react` | bool | Remate: el director corta a la reacción del que escucha después de la línea |
| `shot` | nombre de plano | Fuerza un plano con nombre de `TPL` (vía `named`). `"speaker"` desactiva el inserto por palabra clave |
| `cita` | texto (fuente) | Marca la línea con referencia/cita. El lint avisa si hay más de una o si está en el cierre |
| `obj` | bool | Objeción honesta (el lint avisa si no hay ninguna) |
| `climax` | bool | Clímax: la música sube acá |
| `visual` | texto | La metáfora que se ve en pantalla (inserto). También sube la música |
| `coda` | bool | Línea de coda (el lint la busca para no avisar "final abrupto") |
| `mood` | texto | Tags extra solo para `expression()` (no se mandan al TTS) |

Campos propios de una escena (`card`, `holo`, etc.) se pueden agregar libremente: los lee el `scene.js` que los usa.

### `sfx[]` (efectos por prompt, ElevenLabs)
`{ id, prompt, duration?, influence? (0,5), after: "<lineId>" | at: "<lineId>", word?, offset?, gain? (0,5) }`
- `after`: fin de esa línea + `offset`. `at` + `word`: inicio de esa palabra + `offset`.
- `sfx.mjs` los genera en `sfx/<id>.mp3` (cacheados); `build.mjs` los ubica en `film.sfx`.

### `amb[]` (ventanas de ambiente)
`{ from: "<lineId>", to: "<lineId>", type: "tormenta" | "campo" | "multitud", gain: 1, duck: 0.7, music_duck: 0.6, pre: 0.25, post: 0.5 }`
Dentro de la ventana bajan el ambiente base (`duck`) y la música (`music_duck`) y entra la capa propia.

---

## 3. `film.json` (lo genera `build.mjs`)

```
{ title, total, efps: 60, speakers: [who…],
  cues:  [{ id, who, at, end, src0, src1, words: [{ w, s, e }] }],   // tiempos absolutos del video
  subs:  [{ who, t0, t1, text }],
  env:   { who: [0..1 a 60/s] },                                    // envolvente de voz
  mouth: { who: { open: [], wide: [] } },                           // boca con ataque/caída + sibilantes
  sfx:   [{ id, t, file, gain }] }
```
- La primera voz arranca en t = 0,25 s; el primer subtítulo ya está en t = 0.
- Subtítulos: se cortan por puntuación + pausa > 0,3 s, pausa > 0,5 s o > 50 caracteres; líneas de ≤ 28 caracteres van en una sola placa.

---

## 4. `engine/core.js`

### Tiempo y curvas (puras)
| Función | Firma | Nota |
|---|---|---|
| `clamp` | `(x, a=0, b=1)` | |
| `smoother` | `(x)` | smootherstep 0..1 |
| `lerp` | `(a, b, k)` | |
| `ramp` | `(t, a, b)` | 0 → 1 suave entre `a` y `b` |
| `pulse` | `(t, a, b, fi=0.25, fo=0.35)` | Sube antes de `a` (en `fi` s), baja después de `b` (en `fo` s) |
| `key` | `(t, [[t, v], …])` | Claves con smootherstep; tiempos estrictamente crecientes |
| `rng` | `(seed) → () => 0..1` | Generador determinista (usar en vez de `Math.random`) |
| `hash1` | `(i) → 0..1` | Hash determinista |
| `wobble` | `(t, seed=0) → ~-1..1` | Suma de senos lentos: vida, respiración, cámara en mano |

### Construcción
| Función | Firma | Nota |
|---|---|---|
| `mat` | `(color, opts)` | `MeshStandardMaterial` con `flatShading`, roughness 0,85 |
| `glow` | `(color, k)` | `MeshBasicMaterial` × `k`, `toneMapped: false` (HDR: lo agarra el bloom) |
| `box` | `(w, h, d, m, x, y, z, parent?, shadows=true)` | Caja con sombras. Sin `parent` usa `box.defaultParent` (setearlo a `scene`) |
| `V` | `(x, y, z)` | `new THREE.Vector3` |
| `facetJitter` | `(root, { jitter=0.1, top=1.04, bottom=0.8 })` | Variación de luminosidad por cara + oscurecido hacia abajo (low-poly "con alma"). Saltea mallas con `userData.noJitter` e instanciadas. Llamar **una vez**, después de armar todo |
| `LOOK` | uniforms `{ uRimDir, uRimCol, uRimPow, uGroundY, uAOH, uAOMin }` | Compartidos por todos los materiales `cinematic` |
| `cinematic` | `(material)` | Rim fresnel del lado de la luz fría + oscurecido de contacto por altura. Aplicar a todo `MeshStandardMaterial` salvo `userData.noLook` |

En cada cuadro, después de ubicar la cámara: `LOOK.uRimDir.value.copy(dirLuzMundo).transformDirection(camera.matrixWorldInverse)`.

### Película
`useFilm(film)` devuelve:
- `cue(id)`, `c0(id, off)` / `c1(id, off)`: inicio / fin de la línea;
- `word(id, w)`, `w0(id, w, off)` / `w1(…)`: inicio / fin de una palabra (normalizada en minúsculas, sin puntuación);
- `env(who, t)`, `envAvg(who, t, ventana)`: envolvente de voz;
- `speaking(who, t, pad=0.05)`: bool;
- `mouth(who, t) → { open, wide }`: boca con adelanto de 40 ms (usar para `jaw` y `wide`).

### Cámara
`placeCamera(camera, shots, anchors, t) → { shot, focus, ap, u }`

Plano:
```js
{ t0, t1,
  from: { p: ['ancla', [dx, dy, dz]], l: ['ancla', [dx, dy, dz]], fov },   // posición, punto de mira, fov vertical
  to:   { … },          // opcional: movimiento dentro del plano (push-in)
  focus: 'ancla',       // distancia de foco (DOF)
  ap: 30,               // apertura del DOF (0 = sin desenfoque)
  shift: 0.06,          // corre el encuadre en vertical (setViewOffset) para alejar caras de los subtítulos
  hand: 1,              // cámara en mano (0 = fija)
  ease: 'linear',       // opcional
  subY: 1500,           // libre: alto del subtítulo para ese plano (lo lee la escena)
  phase: 'fb' }         // libre: fase del plano (ver § 9)
```
Lanza error si un ancla no existe en `anchors`.

### Texto y gestos
| Función | Firma | Nota |
|---|---|---|
| `drawSubtitle` | `(ctx2d, film, t, { y=640, size=54, tintWho?, tint? })` | Subtítulos balanceados con halo, sin caja |
| `drawHook` | `(ctx2d, t, { text, key?, until=3.2 }, { size=74, y=360 })` | Texto gancho (palabra `key` en amarillo). Solo para pruebas A/B |
| `held` | `(film, who, t, { a=0.5, r=0.8, only? })` | 0..1 mientras `who` habla, con ataque `a` y caída `r` lentos, **sin seguir sílabas**. `only(cue)` filtra (por ejemplo, líneas de más de 7 palabras). Usar para manos y gestos |

---

## 5. `engine/characters.js`

### `buildPersona(scene, opts)` (persona actual)
| Opción | Valores |
|---|---|
| `preset` | `'chica'` (default) \| `'chico'` (o uno propio agregado a `PERSONA_PRESETS`) |
| `hair` | `'long'` \| `'ponytail'` \| `'bun'` \| `'short'` \| `'curly'` |
| `bangs` | bool (flequillo) |
| `glasses` | `true` o color |
| `lashes` | bool (pestañas + rubor) |
| `top` | `'hoodie'` \| `'tee'` |
| `beard` | `'none'` \| `'stubble'` |
| `robe` | color: vestido/túnica larga que tapa las piernas de pie |
| `veil` | color: velo o manto sobre la cabeza |
| `colors` | `{ skin, hair, top, pants, shoes, lips, iris }` (se mezclan con el preset) |
| `headScale` | default 1,28 |
| `shoulders` | ancho de hombros (default 0,195; `chico` 0,215) |

Para calcar a una persona real: medir colores de una foto y elegir el resto. Con consentimiento escrito de la persona.

### `buildTunica(scene, opts)` (persona con túnica y manto: personaje histórico, sabio, mago, abuelo)
| Opción | Valores |
|---|---|
| `beard` | `false` la saca (default: con barba y bigote) |
| `halo` | `true` crea la aureola visible (default `false`) |
| `colors` | `{ skin, hair, beard, tunic, mantle, sandal }` |
| `headScale` | default 1,22 |

### API de pose (igual para `buildPersona` y `buildTunica`)
Los dos devuelven `{ root, pose, anchors, head }`. `pose(p)` se llama **una vez por cuadro**; todo es opcional.

| Parámetro | Rango típico | Efecto |
|---|---|---|
| `lean` | -0,7..0,3 (default 0,05) | Inclinación del torso adelante (+) / atrás (−) |
| `twist` | rad | Giro del torso |
| `tilt` | rad | Ladeo del torso |
| `yaw`, `pitch`, `roll` | rad | Cabeza (el cuello toma 0,4 y la cabeza 0,6 del valor) |
| `blink` | 0..1 | Párpado |
| `lazy` | 0..1 | Párpado caído (sueño) |
| `smile`, `sad`, `browUp` | 0..1 | Expresión |
| `jaw` | 0..1 | Apertura de boca (usar `mouth(who, t).open`) |
| `wide` | 0..1 | Boca ancha para sibilantes (`mouth(who, t).wide`) |
| `lookX`, `lookY` | ~±0,004 | Desplazamiento de pupilas |
| `handR`, `handL` | `[x, y, z]` en espacio local del `root` | Objetivo de la mano por IK. `handR` es el lado −x. Sentado, reposo ≈ `[∓0.15, 0.58, 0.3]` |
| `palm` | 0..1 continuo | Giro de la mano (palma hacia arriba). Preferirlo a `palmUp` (booleano, gira de golpe) |
| `stand` | 0 \| 1 | De pie (0 = sentado) |
| `walk` | fase en rad (0 = quieto) | Balanceo de caminata (con `stand: 1`) |
| `halo` | bool | Muestra u oculta la aureola en ese cuadro (solo `buildTunica`) |
| `haloK` | default 2,0 | Intensidad HDR de la aureola |

`anchors` (mundo, actualizadas por `pose`): `head`, `eyes`, `chest`, `handR`, `handL`.

**Ojo:** los brazos y las manos son mallas sueltas en la escena, no hijos del `root`. Mover u ocultar el `root` no los mueve hasta la próxima `pose()`. Para sacar a alguien de cuadro: `root.position.y = -60` y `pose(…)`.

### `buildClawd(parent, { color='#d97757', size=1 })` (bloque-mascota)
Se agrega a `parent` (puede ser un `Group` para ubicarlo y girarlo). Devuelve `{ root, pose, anchors }`.

| Parámetro de pose | Rango | Efecto |
|---|---|---|
| `yaw` | rad | Giro del cuerpo |
| `lean`, `tilt` | rad | Inclinación / ladeo |
| `hop` | altura (m) | Saltito (también mueve las patas) |
| `squash` | -1..1 | Aplastar / estirar (hablar, caer) |
| `eyeOpen` | 0,06..1,3 (default 1) | Ojos (bajo = deadpan o parpadeo) |
| `lookX`, `lookY` | pequeño | Mirada |
| `armL`, `armR` | rad (default 0,15) | Brazos hacia arriba |
| `armLx`, `armRx` | rad | Brazos hacia adelante |
| `emissive` | default 0,14 | Brillo propio |

`anchors`: `face`, `body`, `top`.

---

## 6. `engine/director.js`

### `planShots(film, script, opts) → shots[]`
Arma un plano por línea a partir de `film.cues`.

| Opción | Tipo | Qué hace |
|---|---|---|
| `bySpeaker` | `{ who: [fnPlano, …] }` | Planos del que habla; rota la lista (nunca dos iguales seguidos) |
| `two` | `fnPlano` | Plano de dos: en silencios > 1,1 s y para resolver ráfagas cortas (`minShot`) |
| `inserts` | `{ palabraClave: fnPlano }` | Inserto de ~2,2 s cuando la línea nombra el objeto (salvo `shot: "speaker"`) |
| `reaction` | `{ who: fnPlano }` | Reacción del que escucha después de una línea con `react` |
| `named` | `{ nombre: fnPlano }` | Planos que se piden por `line.shot` (normalmente el `TPL` entero) |
| `opening` / `closing` | `fnPlano` | Primera / última línea |
| `lead` | 0,08 | El corte entra 80 ms antes que la voz |
| `minLen` | 0,9 | Una línea muy corta del mismo hablante se queda en el plano anterior |
| `minShot` | 0 | Ráfagas de planos más cortos que esto se funden en un plano de dos; un corto aislado se pega al anterior. Insertos, nombrados, apertura y cierre se respetan |

`fnPlano` es `(t0, t1) => ({ from, to, focus, ap, … })`. Cada plano devuelto lleva `t0`, `t1` y `tag` (`'who:i'`, `'two'`, `'insert'`, `'react'`, `'named:<nombre>'`, `'open'`, `'close'`). Ningún plano dura menos de 0,6 s.

### `expression(film, script, who, t) → { smile, sad, surprise, deadpan, excited, whisper }`
Pesos 0..1 sacados de los `tags` (+ `mood`) de las líneas: los propios durante la línea; los ajenos, 0,35 como reacción después. Ejemplos: `laugh|warm|amused` → `smile`; `sigh|tired|sad` → `sad`; `deadpan|flat|sarcastic` → `deadpan`.

### `lookTarget(film, who, t) → 'speaker' | 'partner'`
A quién mira el personaje.

---

## 7. `engine/post.js`

`createPost(renderer, W, H)` arma la cadena HDR sin EffectComposer:
escena → RT half-float (MSAA ×4 + depth) → **DOF** (64 taps, consciente de la profundidad) → **sprites de bokeh** → **bloom** (cadena de 6 mips, Karis + rodilla suave) → **composite** (exposición, WB + CDL, ACES o AgX, split-tone, lift, saturación, contraste, gamma, aberración, viñeta, grano, fade) → canvas.

Configurar el renderer así: `toneMapping = THREE.NoToneMapping` (el tone mapping lo hace el composite), `preserveDrawingBuffer: true`, `setPixelRatio(1)`, `shadowMap.type = THREE.PCFShadowMap` (`PCFSoftShadowMap` ya no existe).

| Miembro | Qué es |
|---|---|
| `post.flags` | `{ dof: true, bloom: true }` |
| `post.bloom` | Intensidad del bloom (default 0,12) |
| `post.dof` | Uniforms: `uFocus` (m), `uAperture` (0 = sin DOF), `uMaxCoc` (22 px), `uNear`, `uFar` |
| `post.comp` | Uniforms del composite (abajo) |
| `post.bokeh` | Uniforms de los sprites (`uMaxCoc` 80) |
| `post.addBokeh(points)` | `points: [{ pos: [x,y,z], col: [r,g,b] HDR, size?: 0.004, seed? }]` → bolas de bokeh que crecen fuera de foco (lámparas, ventanas, luces de ciudad) |
| `post.render(scene, camera, t)` | Renderiza todo al canvas |

Uniforms de `post.comp` (defaults):
| Uniform | Default | Uso |
|---|---|---|
| `uExposure` | 1,0 | Exposición (1,55 = preset luminoso) |
| `uTonemap` | 0 | 0 = ACES, 1 = AgX |
| `uWB`, `uSlope`, `uOffset`, `uPower` | (1,1,1) / (1,1,1) / (0,0,0) / (1,1,1) | Balance de blancos + CDL, en lineal antes del tone mapping |
| `uShadowTint`, `uHighTint` | (0,9, 0,98, 1,12) / (1,08, 1,0, 0,88) | Split-tone (multiplicadores) |
| `uLift` | (0,012, 0,014, 0,03) | Levanta negros |
| `uSat` | 1,08 | Saturación |
| `uContrast` | 0,18 | Curva S |
| `uVignette` | 0,55 | Viñeta ovalada para 9:16 |
| `uGrain` | 0,035 | Grano (a 24 Hz, más en medios) |
| `uCA` | 0,0025 | Aberración cromática |
| `uFade` | 1 | Fundido (0 = negro); típico: `clamp((T - t) / 0.5)` |

Por cuadro: `post.dof.uFocus.value = cam.focus; post.dof.uAperture.value = cam.ap;`.

---

## 8. `engine/sets.js`

### `outdoorSet(scene, BOKEH, opts) → { group, update(t), sun, sunAt, water }`
Exterior low-poly en cualquier `origin` (pueden convivir varios en la misma escena, como locaciones). Llamar `update(t)` en cada cuadro (agua, destellos, pájaros).

| Opción | Default |
|---|---|
| `origin` | `V(0,0,0)` |
| `sky` | 5 colores de gradiente (atardecer) |
| `sun` | `{ at: [-3, 2.2, -80], color, k: 7, r: 4.2, halo }` o `null` |
| `hills` | `[[z, alto, color], …]` (3 capas) |
| `ground` | `{ color, w: 60, d: 40, z: 0, bump: 0.08 }` |
| `water` | `null` o `{ w, d, x, y, z, color, glints, glint }` (camino de sol si hay `sun`) |
| `rocks` / `reeds` / `birds` / `stars` | 14 / 0 / 6 / 0 |
| `seed` | 9 |

### `crowd(scene, pos, { body, head, y=0, flags=0 }) → { bodies, heads, update(t) }`
Multitud instanciada barata. `pos: [[x, z, yaw, escala], …]`; `body` puede ser un color o una paleta; `flags` agrega banderas que flamean en `update(t)`.

---

## 9. Anatomía de un `scene.js`

Orden recomendado (ver `episodes/demo/scene.js`):

```js
import * as THREE from 'three';
import { W, H, clamp, lerp, ramp, pulse, rng, hash1, wobble, mat, glow, box, V,
         useFilm, placeCamera, drawSubtitle, LOOK, cinematic, facetJitter, held } from '../../engine/core.js';
import { createPost } from '../../engine/post.js';
import { planShots, expression } from '../../engine/director.js';
import { buildPersona, buildTunica, buildClawd } from '../../engine/characters.js';

// 1. datos
const EP = new URLSearchParams(location.search).get('ep');
const film   = await (await fetch(`./episodes/${EP}/film.json`,   { cache: 'no-store' })).json();
const script = await (await fetch(`./episodes/${EP}/script.json`, { cache: 'no-store' })).json();
const { mouth, speaking, envAvg } = useFilm(film);
const FLAGS = new URLSearchParams(location.search).get('flags') || '';
const T = film.total, BOKEH = [];

// 2. renderer + post + canvas de salida (subtítulos en 2D encima)
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const post = createPost(renderer, W, H);
post.flags.dof = !FLAGS.includes('nodof'); post.flags.bloom = !FLAGS.includes('nobloom');
post.comp.uTonemap.value = FLAGS.includes('agx') ? 1 : 0;
const out = document.createElement('canvas'); out.width = W; out.height = H; document.body.appendChild(out);
const octx = out.getContext('2d');
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 120);
box.defaultParent = scene;

// 3. set (paredes, utilería, luces; push a BOKEH de cada fuente de luz chica)
// 4. personajes (los de otra locación, ubicados ALLÁ al crearlos)
const ella = buildPersona(scene, { preset: 'chica' });
ella.root.position.set(0.55, 0, -0.3); ella.root.rotation.y = -Math.PI / 2 + 0.25;

// 5. acabado: una sola vez, después de armar todo
facetJitter(scene);
scene.traverse(o => { if (o.isMesh && !o.userData.noLook && o.material?.isMeshStandardMaterial) cinematic(o.material); });
post.addBokeh(BOKEH);

// 6. actuación: act(t[, phase]) llama pose() de todos (pura en t)
function act(t, phase) {
  const E = expression(film, script, 'ella', t);
  const g = held(film, 'ella', t, { only: c => c.words.length > 7 });
  ella.pose({ smile: E.smile, jaw: mouth('ella', t).open, wide: mouth('ella', t).wide,
              handR: V(-0.12, 0.6 + 0.08 * g, 0.3).toArray(), handL: V(0.13, 0.6, 0.3).toArray(), palm: g });
  return { /* estado derivado para frame() */ };
}

// 7. anclas: puntos que siguen a los personajes; se actualizan después de act()
const A = { Eh: new THREE.Vector3(), Pair: new THREE.Vector3() };
function updateAnchors() { A.Eh.copy(ella.anchors.head); /* … */ }

// 8. planos con nombre (TPL) + director
//    ejes: anotar acá de qué lado queda la cámara (regla de 180°)
const shot = (from, to, focus, ap, extra = {}) => () => ({ from, to, focus, ap, ...extra });
const TPL = {
  E_mcu: shot({ p: ['Eh', [-1.5, 0, 1.6]], l: ['Eh', [0, -0.16, 0]], fov: 30 },
              { p: ['Eh', [-1.38, -0.01, 1.45]], l: ['Eh', [0, -0.16, 0]], fov: 30 }, 'Eh', 32, { shift: 0.06 }),
  two:   shot(/* … */),
};
const SHOTNAME = { e3: 'flor' };                       // opcional: id de línea → plano
for (const l of script.lines) if (SHOTNAME[l.id] && !l.shot) l.shot = SHOTNAME[l.id];
const SHOTS = planShots(film, script, {
  bySpeaker: { ella: [TPL.E_mcu /* … */] }, two: TPL.two, named: TPL,
  reaction: { /* … */ }, opening: TPL.E_mcu, minShot: script.minShot ?? 0,
});

// 9. cuadro
function frame(t) {
  const sh = SHOTS.find(s => t >= s.t0 && t < s.t1) || SHOTS.at(-1);
  const st = act(t, sh.phase);
  scene.updateMatrixWorld(true);
  updateAnchors();
  const cam = placeCamera(camera, SHOTS, A, t);
  LOOK.uRimDir.value.copy(DIR_LUZ_FRIA).transformDirection(camera.matrixWorldInverse);
  // luces y visibilidad por fase, objetos animados, grado por plano…
  post.dof.uFocus.value = cam.focus; post.dof.uAperture.value = cam.ap;
  post.comp.uFade.value = clamp((T - t) / 0.5);          // sin fundido de entrada: el frame 1 es el gancho
  post.render(scene, camera, t);
  octx.drawImage(renderer.domElement, 0, 0);
  drawSubtitle(octx, film, t, { y: cam.shot?.subY ?? 1380, size: 56 });
}

// 10. API para el renderizador (después de cargar fuentes)
const fUrl = '/node_modules/@fontsource/inter/files/';
for (const w of [500, 600]) document.fonts.add(await new FontFace('Inter', `url(${fUrl}inter-latin-${w}-normal.woff2)`, { weight: String(w) }).load());
await document.fonts.ready;
window.renderAt = (t, q = 0.95) => { frame(t); return out.toDataURL('image/jpeg', q).split(',')[1]; };
window.TOTAL = T;
window.__sfx = [];        // efectos sintéticos: { type: 'whoosh' | 'splash' | 'buzz', t, gain }
const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
window.__gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'desconocido';
frame(0);
window.__ready = true;
```

### API que espera `render.mjs`
| Global | Qué es |
|---|---|
| `window.renderAt(t, q)` | Dibuja el cuadro `t` y devuelve el JPEG en base64 |
| `window.TOTAL` | Duración en segundos |
| `window.__sfx` | Efectos sintéticos para `mix.py` (se guardan en `sfx.json`). Se pueden calcular a partir de `film.cues` |
| `window.__gpu` | GPU usada (para verificar que no sea la integrada) |
| `window.__ready` | `true` cuando terminó de cargar |

### Flags de URL (`--flags a,b`)
`nodof`, `nobloom`, `agx` (tone mapping AgX), `hookB` (segundo gancho), y `cam:x_y_z_lx_ly_lz_fov` para una cámara de debug fija (la escena la implementa: ver `frame()` del demo).

---

## 10. Fases por corte (`shot.phase`)

Para escenas con varias locaciones o estados (de pie → recuerdo → sentados → coda), los personajes cambian de lugar **solo en los cortes**, nunca a mitad de plano.

1. Definir la fase de cada línea: `const PHASE = { j0: 'pie', c3: 'mesa', c12: 'coda' };`
2. Después de `planShots`, asignar fase a cada plano: la del primer cue que empieza después de su `t0`; los planos de flashback se marcan por `tag`:
   ```js
   for (const s of SHOTS) {
     if (/named:fb/.test(s.tag)) { s.phase = 'fb'; continue; }
     const c = film.cues.find(c => c.at >= s.t0 - 0.15) || film.cues.at(-1);
     s.phase = PHASE[c.id] ?? 'mesa';
   }
   ```
3. En `frame(t)`: buscar el plano actual, pasar `sh.phase` a `act(t, phase)` y, según la fase:
   - posiciones y poses de los personajes;
   - visibilidad de utilería por locación;
   - **luces por locación** (las direccionales iluminan todos los lugares: apagar las que no corresponden);
   - grado de color propio (flashback más frío o lavado: `uSat`, `uWB`, `uVignette`).
4. Los personajes que no están en la locación actual: `root.position.y = -60` + `pose()`.
5. Se pueden partir o agregar planos a mano después del director (`SHOTS.splice`, `SHOTS.push`), por ejemplo, para cortar un flashback en dos o sumar un plano final hasta `T + 1`.
