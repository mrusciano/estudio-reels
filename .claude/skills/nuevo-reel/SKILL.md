---
name: nuevo-reel
description: Flujo completo para hacer un reel del estudio, de la idea al MP4 entregado — guiones en opciones, lint, escena 3D, voces, stills, render, mezcla, QA y pedido de devolución. Usar cuando el usuario pide un video nuevo o mejorar uno existente.
---

# /nuevo-reel — de la idea al video

Antes de arrancar, leé `perfil/estudio.md`, `perfil/gusto.md` y `perfil/aprendizajes.md`.
- Si no existe el perfil, corré `/configurar`.
- Leé también `docs/guion.md`. Para la escena, `docs/motor.md` y `docs/aprendizajes-tecnicos.md`.

Hay **4 checkpoints** donde el usuario decide (C1-C4). Fuera de esos, avanzá solo.

## 1. Idea → guiones (checkpoint C1)
1. Armá la **ficha** de la dinámica (`docs/guion.md`):
   - valor de fondo;
   - quién ama/quiere y quién calcula/objeta;
   - algo chiquito con nombre;
   - la decisión (≤ 2 palabras, antes del 40 %);
   - la objeción honesta;
   - el núcleo (≤ 8 palabras);
   - el button (un callback dicho por el que cambió);
   - la coda (3-5 s).
2. Escribí **2 o 3 guiones distintos** y mostralos como texto, con una línea por intervención y la duración estimada. Que difieran en algo real:
   - el registro;
   - quién calcula;
   - el lugar;
   - si usa cita o dato.
3. Rotá respecto de los videos anteriores (ver `aprendizajes.md`): no repitas la fórmula, el tipo de button ni la forma de usar la referencia.
4. **C1:** el usuario elige y corrige. Si dice "ninguno", preguntá qué no le cerró antes de reescribir.

## 2. Episodio
1. `node tools/nuevo.mjs <id>` (o `--desde <otro-episodio>` si se reusa un lugar).
2. Pasá el guion elegido a `script.json`:
   - completá `ficha`, `voices` (del perfil) y `protegido`;
   - marcá `obj`, `coda` y `climax`;
   - poné `gap` antes de los remates y `shot` en las líneas que necesitan un plano fijo.
3. Corré `node tools/lint-script.mjs <id>` hasta que tenga **0 errores**. Los avisos se leen y se decide cada uno.
4. Escribí o adaptá `scene.js`:
   - lugar, personajes y utilería con nombre;
   - `act(t)` con gestos sostenidos (`held`), no con la envolvente de la voz;
   - plantillas de plano por personaje y plano de dos.
   - Partí siempre de una escena que ya funciona.

## 3. Voces (checkpoint C2)
1. **C2:** avisá el costo antes de generar: ~140 créditos por toma de 30 s de diálogo y 2 tomas por defecto.
2. `node tools/voices.mjs <id> --takes 2`, y leé `voices/qa.txt`.
3. Rehacé con `redo-line.mjs` cada línea que tenga:
   - WER > 0,2;
   - un tag leído en voz alta;
   - más de 3,6 palabras/s en una línea emotiva;
   - una palabra mal acentuada.
   Para la palabra mal acentuada, reescribí el texto: cambiá la palabra o el orden.
4. Verificá con `stt-line.mjs` y escuchá el ritmo de las líneas clave: el núcleo y el button van lentos.

## 4. Stills (revisión tuya)
1. `node tools/build.mjs <id>` y después `node tools/render.mjs <id> stills <8-12 tiempos repartidos>`.
2. **Mirá `stills/sheet.jpg` con Read** y corregí antes de seguir:
   - caras tapadas o cortadas;
   - planos que no muestran al que habla;
   - plano de dos con los personajes fuera de cuadro (en 9:16 el horizontal es angosto);
   - luz que quema o deja la cara oscura;
   - subtítulo encima de la cara;
   - el mismo encuadre muchas veces seguidas.
3. Repetí hasta que el sheet esté bien. El log `plan ...` muestra el plan de planos: confirmá que las líneas importantes tengan su plano.

## 5. Render + mezcla + QA
1. `node tools/render.mjs <id> video` y después `python -I tools/mix.py <id>`.
2. Para el QA medí:
   - la duración (`ffprobe`);
   - el loudness (`ffmpeg -i out/<id>.mp4 -af ebur128 -f null -`, que tiene que dar ≈ −14 LUFS);
   - 4 cuadros con `hoja-lote.py`, para ver el arco completo.
3. Copiá el MP4 a `entregas/<fecha>/` con un nombre legible, por ejemplo `entregas/2026-11-02/rulo-v1.mp4`.

## 6. Entrega (checkpoint C3) y devolución (C4)
1. **C3:** dale al usuario la ruta del video, con 3 líneas sobre qué prueba este video y tu propia autocrítica: qué te gusta y qué no.
2. **C4:** pedí la devolución con `/devolucion`. Que diga, sin vueltas, sí o no y por qué.
3. Mientras el usuario mira, escribí en `perfil/aprendizajes.md` lo técnico que aprendiste en este video:
   - errores;
   - parámetros que funcionaron;
   - créditos gastados;
   - tiempos.

## Mejorar un video existente
1. Guardá un backup (`script.v1.json`, `scene.v1.js`) antes de tocar nada.
2. Cambiá solo lo pedido.
3. Entregá como `-v2` sin pisar el anterior, para que se pueda comparar.
