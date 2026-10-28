# perfil/

Lo propio de cada estudio. Lo escribe Claude con `/configurar` y lo actualiza con `/devolucion`:

| Archivo | Qué guarda |
|---|---|
| `estudio.md` | Para qué es el estudio, público, tono, idioma, personajes, voces, referencias (para leer) |
| `estudio.json` | Lo mismo en formato que leen las herramientas (idioma, voces, duración, protegido) |
| `reglas.json` | Líneas rojas que `tools/lint-script.mjs` hace cumplir |
| `gusto.md` | Mapa de gusto: qué te gusta y qué no, con el porqué y la evidencia |
| `aprendizajes.md` | Bitácora de producción: errores, parámetros, créditos gastados |

Si querés empezar de cero, borrá estos archivos (menos este) y corré `/configurar`.
