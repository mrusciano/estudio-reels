---
name: devolucion
description: Registra lo que el usuario opinó de uno o varios videos del estudio y lo convierte en conocimiento — actualiza perfil/gusto.md (qué le gusta, qué no y por qué), perfil/reglas.json (reglas que el lint hace cumplir) y perfil/aprendizajes.md. Usar después de cada entrega o cuando el usuario comenta un video.
---

# /devolucion — convertir opiniones en reglas

El estudio mejora solo si cada opinión del usuario queda escrita **con su porqué** y se vuelve una regla verificable.

## 1. Juntar la devolución
- Si el usuario ya opinó en el chat, usá eso. Citá sus palabras textuales y no las suavices.
- Si no opinó, preguntá con AskUserQuestion, video por video:
  - **¿Funciona?** Sí / Más o menos / No.
  - **¿Qué es lo mejor?** Guion, personaje, voz, ritmo, imagen, final.
  - **¿Qué es lo peor?** Mismas opciones.
  - **¿Una frase de por qué?** Texto libre, con "Otro".
- Dale tu autocrítica antes de que mire, si te la pide. Después compará tu opinión con la suya: donde no coinciden está lo que más se aprende.
- Si el usuario dice "no me gustó" sin más, ofrecé 3 hipótesis concretas de por qué para que elija. No inventes la causa.

## 2. Separar en tres tipos
| Tipo | Ejemplo | Dónde va |
|---|---|---|
| **Gusto** (preferencia, con porqué) | "el final es abrupto", "me encanta cuando aparece la mascota" | `perfil/gusto.md` |
| **Regla** (algo que nunca o siempre tiene que pasar) | "nunca citar al final", "sin malas palabras", "la voz de X no" | `perfil/reglas.json` (si se puede chequear con regex o con un campo del guion) y además en `gusto.md` |
| **Técnico** (error de producción) | "la cara está oscura", "los brazos se mueven solos" | `perfil/aprendizajes.md` y, si vale para todos, `docs/aprendizajes-tecnicos.md` |

## 3. Actualizar `perfil/gusto.md`
Mantené esta estructura y no la reescribas de cero:
```markdown
# Mapa de gusto — <usuario/proyecto>
## En una línea
<la síntesis vigente de lo que le gusta, que se reescribe cuando cambia>
## Le gusta (validado)
- <qué> — <por qué, con sus palabras> — <video/fecha de la evidencia>
## No le gusta (validado)
- ...
## Hipótesis sin validar
- <qué creemos> — <de dónde sale> — <cómo probarlo en el próximo video>
## Historial de devoluciones
- <fecha> <video>: <sí/no> "<cita textual>"
```
- Una hipótesis que el usuario confirma pasa a "validado". Si la contradice, se borra.
- No acumules reglas contradictorias: si cambió de opinión, gana la última y lo anotás.

## 4. Actualizar `perfil/reglas.json`
- Agregá la regla a `prohibido` con un regex conservador y un `msg` que cite el porqué.
- Usá `"nivel": "error"` solo para lo que el usuario dijo explícitamente "nunca".
- Corré `node tools/lint-script.mjs <ep>` contra el episodio que motivó la regla y confirmá que la detecta.

## 5. Cerrar
- En 3-5 líneas, decile al usuario qué aprendió el estudio y qué va a cambiar en el próximo video.
- Proponé el siguiente paso:
  - mejorar este video (v2);
  - hacer uno nuevo que pruebe una hipótesis pendiente;
  - o un lote chico de 2-3 variaciones para medir algo puntual.
