---
name: configurar
description: Entrevista inicial del estudio de reels. Pregunta para qué lo quiere el usuario, público, tono, idioma, formatos, personajes, voces y líneas rojas, y escribe perfil/. Usar la primera vez (cuando no existe perfil/estudio.md) o cuando el usuario quiere cambiar el rumbo del estudio.
---

# /configurar — entrevista del estudio

Objetivo: entender **para qué** quiere el usuario sus videos, y dejarlo escrito en `perfil/` para que todos los guiones, voces y escenas salgan de ahí.

## Cómo preguntar
- Hacé la entrevista en **rondas cortas** con AskUserQuestion: 2 a 4 preguntas por ronda, cada una con opciones concretas. El usuario siempre puede elegir "Otro".
- No hagas todo de una. Después de cada ronda, resumí en una línea lo que entendiste y seguí.
- Si una respuesta es vaga ("algo lindo", "para redes"), repreguntá con ejemplos concretos. No completes vos lo que el usuario no dijo.
- Si ya existe `perfil/estudio.md`, leelo y preguntá solo lo que cambia.
- Detectá el idioma del usuario en su primer mensaje y hacé toda la entrevista en ese idioma.

## Ronda 1 — Para qué
1. **¿Para qué querés los videos?**
   - Vender o mostrar una marca o producto.
   - Enseñar o divulgar un tema.
   - Entretener o hacer humor.
   - Acompañar o transmitir valores (fe, bienestar, comunidad).
   - Un regalo o algo personal.
   - Otro.
2. **¿Dónde se publican?** Instagram Reels, TikTok, YouTube Shorts, WhatsApp/estados, uso interno o presentaciones. Selección múltiple.
3. **¿Qué tiene que pasar cuando alguien lo ve?** Que se ría, que aprenda algo, que te escriba o compre, que lo comparta, que se sienta acompañado. Esta es la métrica de éxito; anotala.

## Ronda 2 — Público y tono
1. **¿Quién lo mira?** Edad aproximada, qué le importa y qué sabe del tema.
2. **Registro:** tierno, cómico, absurdo, épico, didáctico o íntimo. Pedí uno principal y, como mucho, uno secundario.
3. **Idioma y variante:** por ejemplo español rioplatense con voseo, español neutro, español de España, inglés de EE. UU. El texto y la voz tienen que coincidir: si el guion está en voseo, la voz no puede tener acento neutro.
4. **Líneas rojas:** qué no querés NUNCA. Temas, palabrotas, dobles sentidos, cursilería, sarcasmo en cierto personaje, política… Cada una va a `perfil/reglas.json`.

## Ronda 3 — Formato y personajes
1. **Formato principal:**
   - diálogo entre dos personajes;
   - una voz que narra una historia;
   - sketch cómico rápido;
   - explicador con un personaje y objetos en pantalla.
2. **Personajes recurrentes.** Mostrá lo que el motor ya sabe hacer:
   - una **persona actual** (`buildPersona`: pelo, ropa, colores y anteojos configurables; se puede calcar de una foto);
   - **Claude**, el bloque naranja con ojos que funciona como mascota tierna y graciosa;
   - una **persona de época con túnica** (`buildTunica`: personaje histórico, sabio, abuelo; barba y aureola opcionales);
   - uno nuevo, que hay que modelar en código.
   Preguntá también si alguno es el "protegido", el que nunca queda en ridículo ni es sarcástico (por ejemplo la marca, un maestro o una figura de fe).
3. **Lugares:** cuarto de noche (ya existe), interior rústico, exterior de día o de atardecer, lago, oficina o local (hay que construirlo).
4. **Duración:** 15-30 s (gancho rápido), 30-60 s (historia corta) o 60-90 s (historia con vuelta). Si no sabe, recomendá 30-60 y medir.

## Ronda 4 — Producción
1. **Plan de ElevenLabs:** no tengo cuenta, Free, Starter/Creator o superior. Con Free solo funcionan las voces premade por API. Explicá la diferencia de acento sin vender nada.
2. **Compu:** placa de video NVIDIA, Mac con chip Apple u otra o no sé. Sirve para ajustar los workers del render.
3. **Referencias:** cuentas o videos que le gustan. Si pasa links, mirá qué tienen en común (ritmo, duración, estética, humor) y anotalo como hipótesis en `gusto.md`, no como verdad.
4. **Cuentas que NO quiere parecerse:** opcional, pero sirve mucho.

## Qué escribir al terminar
Todos los archivos van en el idioma del usuario.
1. **`perfil/estudio.md`** (para humanos):
   - para qué es y cuál es la métrica de éxito;
   - público, tono, idioma y variante;
   - formatos, personajes (con el protegido marcado), lugares y duración;
   - plataformas, plan de voces y compu, referencias.
   - Cerrá con "Preguntas abiertas": lo que quedó sin responder.
2. **`perfil/estudio.json`** (para las herramientas):
   ```json
   { "idioma": "es", "variante": "rioplatense", "perfilGuion": "tierno|comico|narrado", "duracion": [30, 60],
     "protegido": "id-del-personaje-o-null", "voces": { "<who>": { "id": "<voiceId>", "name": "<nombre>" } },
     "plataformas": ["instagram", "tiktok"], "gpu": "nvidia|apple|otra" }
   ```
   `voces` queda vacío hasta el casting.
3. **`perfil/reglas.json`**: las líneas rojas como regex que lee `tools/lint-script.mjs`. Usá `"nivel": "error"` para lo que no se negocia y `"aviso"` para lo demás.
   ```json
   { "duracion": [30, 60], "maxCitas": 1, "prohibido": [ { "re": "\\b(palabrota1|palabrota2)\\b", "msg": "sin malas palabras", "nivel": "error" } ] }
   ```
4. **`perfil/gusto.md`**: el mapa de gusto. Arranca con las hipótesis de la entrevista y de las referencias, marcadas como **sin validar**. Lo actualiza `/devolucion`.
5. **`perfil/aprendizajes.md`**: la bitácora. Arranca vacía, con la fecha.

## Después de escribir el perfil
1. **Casting.**
   - Por cada personaje que habla, proponé 3 a 5 voces que encajen con el idioma, la variante y el plan.
   - Generá las muestras con `tools/casting-solo.mjs`, usando solo líneas de ese personaje. Antes, avisá el costo: ~15 créditos por muestra.
   - El usuario elige escuchando y vos guardás la voz en `estudio.json`.
   - Si no tiene key todavía, dejalo como pendiente y explicá cómo sacarla.
2. **Primer video.** Proponé 3 ideas concretas para el primero, cada una en 2 líneas (quién, dónde, qué pasa, cómo termina). Que sean distintas entre sí, para empezar a medir el gusto. Cuando elija, seguí con `/nuevo-reel`.
3. Sugerí correr `npm run check` y `npm run demo` si todavía no vio un video del estudio.
