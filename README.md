# Estudio de reels

Hacé reels verticales con personajes 3D animados **conversando con Claude**: le contás qué querés y él escribe el guion, arma la escena, genera las voces, renderiza y te entrega el MP4.

- Todo es código: three.js + voces de ElevenLabs + música sintetizada. No hay modelo de video ni pago por render.
- Se configura para **lo que vos quieras**:
  - una marca;
  - humor;
  - enseñar algo;
  - acompañar o transmitir valores;
  - un regalo.
- Aprende tu gusto video a video.

## Qué necesitás
- **Claude Code** ([instalación](https://docs.claude.com/en/docs/claude-code)).
- **Node 20+**, **Python 3.10+**, **ffmpeg** y **Google Chrome**.
- **Una placa de video** es recomendable. Con una NVIDIA, un reel de 45 s se renderiza en ~1 minuto. Sin GPU anda, pero lento.
- **Cuenta de ElevenLabs** para las voces.
  - Con el plan Free solo hay voces "premade".
  - Para acentos regionales (rioplatense, mexicano, etc.) hace falta el plan Creator o superior.

## Instalación (5 minutos)
```bash
git clone <este-repo> estudio-reels && cd estudio-reels
npm install
python -m pip install -r requirements.txt
cp .env.example .env        # y pegá tu ELEVENLABS_API_KEY
npm run check               # te dice si falta algo
npm run demo                # renderiza el ejemplo → episodes/demo/out/demo.mp4
```
Para el demo no hace falta la key: ya trae sus voces.

## Uso
Abrí Claude Code en la carpeta (`claude`) y escribí:

1. **`/configurar`**: Claude te entrevista para entender para qué querés los videos. Te pregunta por:
   - el público y el tono;
   - el idioma y el acento;
   - los personajes y las voces;
   - lo que nunca querés ver.

   Con eso arma tu perfil en `perfil/`.
2. **`/nuevo-reel <tu idea>`**: te propone 2 o 3 guiones, vos elegís, y produce el video. Te pide permiso antes de gastar créditos de voz.
3. **`/devolucion`**: le decís qué te gustó y qué no. Lo convierte en reglas para los próximos videos.

También le podés hablar normal: "hacé uno sobre X", "el final es abrupto, arreglalo", "cambiá la voz de ella".

## Qué trae
| Carpeta | Qué hay |
|---|---|
| `engine/` | Motor 3D. Tiene tres personajes: una **persona actual** configurable, **Claude** (el bloque naranja) y una **persona con túnica**. Incluye cámara automática, profundidad de campo, bloom y gradación de color |
| `tools/` | Voces con control de calidad automático, render en paralelo por GPU, mezcla con música y ambiente a −14 LUFS y lint de guiones |
| `docs/` | Lo aprendido haciendo decenas de reels: oficio de guion, API del motor y errores técnicos ya resueltos |
| `episodes/demo/` | Ejemplo "Rulo" (25 s): una chica, su planta moribunda y Claude |

## Límites
- **Estética low-poly estilizada.** No es fotorrealista ni usa modelos 3D importados.
- **Lugares nuevos cuestan.** Cada lugar nuevo es código que Claude escribe. Reusar escenas es mucho más rápido.
- **Las voces IA tienen límites.** A veces acentúan mal una palabra. Claude lo detecta transcribiendo y rehace la línea, pero conviene escuchar.

## Privacidad
- Tu key queda en `.env`, que no se sube a git.
- Tu perfil (`perfil/`) es tuyo. Si compartís tu fork, revisá qué contiene.
