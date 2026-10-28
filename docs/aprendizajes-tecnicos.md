# Aprendizajes técnicos (gotchas medidos)

Lo que se rompió, se midió y se arregló produciendo reels 3D con three.js + ElevenLabs en un proyecto anterior. Todo es genérico: "el protegido" es el personaje que nunca queda en ridículo; "personaje de túnica" es el que se arma con `buildTunica`.

---

## 1. Voces (ElevenLabs)

### Modelo y endpoint
- Usar **`eleven_v4` + Text-to-Dialogue** (`/v1/text-to-dialogue/with-timestamps`): una sola request con toda la escena, cada réplica reacciona a la anterior.
- **El `model_id` por defecto de Dialogue es `eleven_v3`**: pasar siempre `model: "eleven_v4"` en el script.
- `stability` es **global para toda la escena** (0,45 es un buen punto de partida). El contraste entre personajes se logra con tags, no con settings.
- Límite práctico: **≤ 2.000 caracteres** sumando todas las líneas (alcanza para 30-60 s).
- v4 **no tiene `speed`** ni `<break>`: el tempo se ajusta después con `atempo` (`script.tempo`, conserva el tono) y las pausas con `gap`.
- v4 "cambia con el tiempo": **cachear el audio aprobado**, no confiar en el seed.

### Una toma base, no la mejor línea de cada toma
- Armar el audio con **la mejor línea de cada toma** rompe la continuidad de energía entre réplicas: "las respuestas no se sienten naturales".
- Regla: elegir **una toma base** (la de menor error) y reemplazar solo las líneas claramente rotas (`voices.mjs --swap=0.6`).
- `timing: "take"` usa las pausas reales de esa toma (acotadas a 0,12-1,4 s) en lugar de un gap fijo de 0,5 s, que no es el ritmo de una charla real.
- Para una línea mala: `redo-line.mjs <ep> <id> --tags "[slowly]"` la rehace por TTS v4 con `previous_text`/`next_text` (~20 créditos) en lugar de regenerar todo.

### Tags
- **En inglés**, **uno por cláusula**, 1-2 por línea como máximo, **pegados** al texto que modifican. Apilar tags es la causa principal de sobreactuación.
- No son un enum: valen tags libres (`[nervous, trying to sound confident]`).
- Si un tag **se lee en voz alta**, la voz no puede ejecutarlo: cambiar el tag o la voz.
- La emoción se arrastra hasta el próximo tag.

### Timestamps: la verdad es Scribe
- Los timestamps de Text-to-Dialogue se **desfasan hasta 2,5 s**. Para cortar, subtitular y sincronizar boca, transcribir con **Scribe** (`scribe_v2`) y usar sus tiempos por palabra.
- Scribe **normaliza regionalismos** ("sánguches" → "sándwiches"): eso no se puede verificar por STT, hay que escucharlo.

### Escribir para el TTS
- **Números siempre en letras** ("cuarenta y tres"), sin símbolos (%, $), siglas deletreadas o evitadas.
- **¿ y ¡ siempre**: ayudan a que la entonación arranque bien.
- **Tildes del voseo** bien puestas ("tenés", "sabés"): sin tilde, el modelo acentúa como tuteo.
- MAYÚSCULA en **una** palabra para enfatizar (en el subtítulo sale en minúscula); `…` para dudas; `—` al final + `[jumping in]` en la siguiente para interrumpir.
- **Palabras que el TTS acentúa mal:**
  - imperativo de voseo con enclítico ("pagale", "decile") → lo lee como tuteo ("PÁgale") y mezcla acentos. Usar verbos sin ese riesgo ("dale") o verificar de oído;
  - "capaz salgo" → se come la s. Reescribir: "capaz que salí";
  - nombres propios en inglés → probar; si suena mal, escribirlo fonético para el TTS y dejar el original en el subtítulo (diccionario de alias).
- Líneas apuradas (> 4,5 pal/s medido por Scribe) → rehacer con `[slowly]`.

### Acento y voces
- **El acento lo pone la voz, no el tag.** Medido: con voces premade (anglófonas), con o sin `[strong Argentine accent]`, la energía de "sh" en ll/y da 0,04-0,08 contra 0,27-0,47 de una /s/: no hay rehilamiento. El texto aporta léxico; el acento sale de la voz.
- **No mezclar texto en voseo con voz neutra** (o al revés): "no me gusta que mezcle argentino con neutro". O todo local (voces del acento real) o todo neutro (guion sin voseo).
- **Plan Free no puede usar voces de la Voice Library por API** (402 `paid_plan_required`; el mensaje ofrece Creator o una recarga de USD 5). Las voces default/premade vencían el 31-dic-2026 al momento de escribir esto: verificar el estado actual.
- `mp3_44100_192` da 403 en Free: usar `mp3_44100_128`.
- Concurrencia: el plan rechaza más de ~2 pedidos simultáneos (429): las herramientas reintentan solas.
- Créditos de referencia: una toma de ~100 palabras con 2 voces ≈ 250-600 créditos; una muestra de voz ≈ 290; una línea rehecha ≈ 20.

### Casting
- **Evitar voces sensuales o susurrantes para protagonistas.** Monocorde + suave = "parece sensual". Medir antes de proponer: CPP alto (voz clara), F0sd ≥ 2,5 (viva, no monocorde).
- En sus tags, nada de `[softly]`, `[quietly]`, `[whispers]`, `[tenderly]` (empujan al susurro). Usar `[warmly]`, `[sincere]`, `[relieved]`, `[tired]`, `[thoughtful]`.
- Una voz que "parece alguien cuya lengua nativa es el inglés" delata a la máquina: descartarla.
- **Muestras solo con las líneas del personaje** (`casting-solo.mjs`), sin el otro: si no, el usuario evalúa la escena y no la voz.
- Dar **3-4 opciones** y que elija el usuario; no cambiar una voz por cuenta propia. Las voces premade suenan parecidas entre sí para un oído no entrenado.
- Para voces con mucho uso, considerar voces humanas acreditadas (actores) o un clon con consentimiento escrito.
- Meta exige declarar "audio realista creado digitalmente": activar la etiqueta de IA al publicar.

---

## 2. Cámara y puesta en escena

- **Regla de 180°:** la cámara se queda de un solo lado del eje entre los personajes; cada uno siempre del mismo lado del cuadro. Anotarlo como comentario arriba del `TPL`.
- **Planos medios y medios cortos** que muestren cuerpo y lugar. Los **primerísimos primeros planos repetidos cansan** ("caras gigantes"): reservarlos para reacciones.
- **Plano de dos en 9:16:** el cuadro es angosto (±11° horizontales con fov 40). Los personajes tienen que estar **lado a lado y cerca (< 0,7 m)** o la cámara a **más de 2 m**. Alternativa: escalonarlos en profundidad (over-the-shoulder con el hombro desenfocado en el tercio inferior).
- **Over-the-shoulder detrás de un personaje con aureola:** ≥ 0,45 m de costado, si no la aureola entra como un arco gigante.
- **Lente:** en three `fov` es vertical; en 9:16 el horizontal es mucho más cerrado. Primer plano 22-26°, plano medio 28-34°, general 38-50°.
- **Subtítulos:** definir una banda (`subY` por plano) y encuadrar las caras fuera de ella. Zonas seguras aproximadas: arriba ~250 px, abajo ~450 px, derecha ~140 px.
- **Texto en el mundo** (pantallas de celular, carteles, planillas) **sale chico** en 9:16: dibujarlo grande en el canvas o mostrarlo en un inserto cercano.
- **Ojos que brillan:** el `glint` del ojo es HDR (×3) y el bloom lo agarra; si un plano cerrado se ve "endemoniado", bajar el bloom o el brillo del glint.
- **El punto más brillante del cuadro es donde se mira.** Si una lámpara le gana a la cara del que habla, bajarla o sacarla de foco.
- **POV a cámara:** la mano que se tiende va de costado (con la palma arriba hacia cámara parece un pulgar).
- **Objetos que tapan personajes:** un plano emisivo (puerta brillante, ventana) es opaco y tapa; partículas pegadas a la cámara (lluvia a < 0,9 m) parecen palos blancos: ocultarlas.
- **La cámara adentro de una pared o detrás de una cabeza** solo se ve en stills: mirar SIEMPRE el contact sheet.
- **Insertos por palabra clave** se disparan en cualquier línea que nombre el objeto (y el personaje se da vuelta de espaldas). Inserto solo en la línea con `visual`; en las demás, `shot: "speaker"`.
- **Ritmo:** `minShot` ~3-4 s para lo tierno; las ráfagas de planos cortos se resuelven en un plano de dos. Push-in leve por plano y cámara en mano mínima (`hand`).
- **Cierre:** plano de dos amplio con la luz nueva, espejo del primer plano.

## 3. Luz y color

- **La esperanza se cuenta con luz:** una ventana que amanece a medida que el conflicto se resuelve. Preset luminoso que funcionó: exposición 1,55, contraste 0,3.
- **"Acogedor", no necesariamente luminoso:** uno de los referentes más vistos es nocturno (luma 55) pero con fogón y luces cálidas. La diferencia es el clima, no el brillo.
- **Monocromo naranja:** si todas las fuentes son cálidas, el cuadro queda todo naranja y plano. Contraponer una luz fría (luna, ventana) como rim y relleno; sombras azul noche; el ámbar en menos del ~15 % del cuadro.
- **No poner luces puntuales cerca de la cara**: el bloom la quema. La "luz del protegido" va tenue sobre el otro personaje.
- **Luces que se filtran entre locaciones:** las `DirectionalLight` iluminan **todos** los lugares de la escena (un lago lejano se veía como una sábana blanca). **Apagar las luces por fase** y darle a cada locación su propia luz (por ejemplo, una luna lateral).
- Superficies grandes (agua, piso extenso) llevan `userData.noLook`: el rim de `cinematic()` las quema.
- Flashbacks con grado propio por plano (`uSat`, `uWB`, `uVignette`).
- Escenas nocturnas: H.264 hace banding en azules oscuros; grano ≥ 1,5 % y CRF 16-18.

## 4. Personajes y animación

- **Gestos sostenidos, no envolvente de voz.** Las manos que siguen la envolvente suben y bajan con cada sílaba: "mueven los brazos mientras están quietos". Usar `held(film, who, t, { only: línea larga })`: ataque y caída lentos, solo en líneas de más de ~7 palabras.
- **`palm` continuo (0..1), no `palmUp` booleano:** el booleano hace girar la mano de golpe cuando la envolvente cruza el umbral.
- **Nada de temblores con `sin()`** (nervios, tipeo) en las manos.
- **La boca sí usa la envolvente** (`film.mouth`: `open` con ataque 30 ms / caída 90 ms, `wide` para sibilantes, adelanto de 40 ms).
- Parpadeos deterministas cada 2,2-5 s (`hash1`), nunca con `Math.random`.
- **Personajes "fuera de escena":** `root.position.y = -60` **y** llamar a `pose()`. Los brazos son mallas sueltas en la escena (no hijos del root) y solo siguen al root cuando se recalcula la pose.
- **Personajes de otra locación** (flashback, recuerdo) se ubican **allá** al crearlos y se posan una vez. Si no, quedan sentados en el origen tapando los planos (se vio recién en la tira final).
- **Los personajes cambian de lugar solo en los cortes** (fases por plano, ver `motor.md`).
- `buildPersona`:
  - pelo largo: los mechones laterales van **detrás** de las orejas (adelante parecen barba en 3/4);
  - interior de boca bordó y apertura máxima ×1,5 (negra y más abierta parece perilla);
  - el cráneo tiene material propio y `noJitter`: si comparte material con mallas que tienen `vertexColors` sale negro, y el oscurecido de `facetJitter` le ensucia el mentón.
- Lo que no escribe profundidad sale desenfocado por el DOF: hologramas y carteles con `depthWrite: true`.

## 5. Render

- `renderAt(t)` es **función pura del tiempo**: nada de `Math.random`, `Date`, `performance.now` ni estado acumulado entre cuadros. Ruido con `rng(seed)`, `hash1`, `wobble`. Eso permite renderizar tramos en paralelo y repetir cualquier cuadro.
- **GPU:** Chrome headless-shell usa la GPU integrada. Renderizar con el **Chrome de escritorio** (`CHROME_PATH`) para usar la placa dedicada; `window.__gpu` reporta cuál se usó.
- **Workers:** cada worker es un Chrome propio (proceso de GPU propio). Medido en una RTX 4060: 1 → 14 fps, 2 → 29, 3 → 31, 4 → 20 (se satura). Por defecto 3; `--workers N` lo fuerza.
- **NVENC** codifica cada tramo y se concatenan con `-c copy`. Resultado: ~40 fps contra 9,7 del render secuencial; build + render + mezcla de un reel de 45 s en ~52 s.
- Calibrar el grado contra una referencia con `signalstats`:
  `ffmpeg -i out.mp4 -vf "scale=270:480,fps=2,signalstats,metadata=print:file=-" -f null -`

## 6. Mezcla

- **−14 LUFS** con loudnorm en dos pasadas; el limitador necesita `alimiter=...:level=disabled`.
  - Dato: los referentes medidos masterizan entre −27 y −20 LUFS y llegan igual a millones (las plataformas normalizan). −14 es una elección, no un requisito.
- Voces normalizadas a −21 dBFS RMS por bus, con fades cortos.
- **Ducking:** la cama (música + ambiente) baja ~8 dB bajo la voz (máscara con ataque rápido y liberación lenta).
- **La música entra o sube en el clímax** (línea con `climax` o `visual`), no en el segundo 0. Cerrar en una cadencia, no con un corte.
- Ventanas de ambiente (`script.amb`) para flashbacks y exteriores: bajan el ambiente base y la música.
- Efectos sintéticos por código (`whoosh`, `splash`, `buzz`) vía `window.__sfx`; efectos generados por prompt vía `script.sfx`.
- Música de películas con copyright: la gente la reconoce y hay riesgo de silenciado. Usar música propia, sintetizada o con licencia.

## 7. QA

- **Contact sheet de stills antes del video:** `render.mjs <ep> stills 0.5 3 8 …`. Revisa cámara adentro de paredes, cabezas que tapan, personajes en el lugar equivocado, subtítulos sobre caras.
- **Tira final** de todo el video: hay errores que solo aparecen ahí (el personaje de otra locación sentado en el origen).
- **`stt-line.mjs <ep> <id>…`:** transcribe líneas sueltas con Scribe y da palabras por segundo.
- **QA de toma** (`voices.mjs`): WER por línea, tags leídos en voz alta, ritmo. Objetivo: WER 0.
- **Hoja comparativa** (`hoja-lote.py`): una lámina con todos los videos de un lote, para que el usuario marque sí / no / por qué.
- Métricas del video final para comparar con referencias: palabras/s, LUFS, duración, planos por minuto.
- Subtítulos: líneas de ≤ 28 caracteres van en una sola placa aunque haya pausa.

## 8. Producción en paralelo

- Varios agentes pueden construir episodios a la vez sin pisarse si cada uno toca **solo** `episodes/<id>/`. La GPU y la API de voces se comparten (los 429 se reintentan).
