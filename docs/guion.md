# Oficio de guion para reels cortos con personajes

Guía para escribir diálogos de 30 a 90 s entre personajes 3D, sobre cualquier tema: marca, humor, educación, divulgación, fe, lo que sea. Lo que importa es la **relación entre los personajes**, no el tema.

**De dónde sale.** El método se armó en un proyecto anterior donde se produjo un video por vez y se registró qué le gustaba y qué no a un usuario concreto, con sus palabras, video por video. Esas devoluciones se cruzaron con técnica de guion (McKee, Goldman, Pixar, Stanton, sketch de UCB) y con mediciones de reels y escenas de referencia. Lo que sigue es la versión genérica. Donde un dato es "gusto de ese usuario" y no regla general, está marcado.

**Idea madre:** casi todo lo que no funcionó fue un **atajo**: le *decía* al espectador qué sentir en vez de *mostrárselo*. Lo que funcionó fue una decisión chiquita, ganada contra una objeción razonable, con un final que aterriza.

---

## 1. La plantilla que mejor funcionó: tres roles

### Roles
- **El que quiere** (ama, cuida, apuesta): status alto y pocas palabras. Pregunta, decide y **actúa**. Nunca se defiende con argumentos: si discute, pierde.
- **El que calcula** (objeta, mide, optimiza): habla más. Tiene datos, una métrica y una objeción razonable. Es gracioso por literal. Al final cambia, **y lo dice con su propio idioma**.
- **Algo pequeño con nombre**: una planta, un cliente, un alumno, una mascota, un objeto. Concreto, visible en pantalla y con nombre propio. El nombre es lo que lo hace "uno" y no "uno de muchos".

Principio: el que quiere **se adelanta** (busca, va, se sienta al lado) y el otro responde con una decisión. Ni coach que da consejos ni mago que resuelve todo.

### Beats (calibrados con el episodio que mejor funcionó; orientativos, no ley)
| # | Beat | % del video | 60 s | 80 s | Qué pasa |
|---|---|---|---|---|---|
| 1 | Informe | 0-8 | 0-5 | 0-6 | El que calcula da una "buena noticia" con un número que esconde una pérdida |
| 2 | Pregunta e insistencia | 8-33 | 5-20 | 6-26 | El que quiere pregunta por lo pequeño. El que calcula insiste: tres obstáculos y una recomendación |
| 3 | **Decisión** | 33-36 | 20-22 | 26-29 | Silencio de ~1 s y decisión en **≤ 2 palabras o un gesto**. Siempre **antes del 40 %** |
| 4 | Objeción honesta | 36-44 | 22-26 | 29-35 | "Eso no cierra": la objeción que tendría el público, dicha con respeto y un dato |
| 5 | Respuesta-pregunta | 44-68 | 26-41 | 35-54 | Una pregunta que devuelve la objeción, o "una vez alguien…" con flashback. El que calcula contesta al pie de la letra (risa) |
| 6 | **Núcleo** | 68-85 | 41-51 | 54-68 | Una línea personal de **≤ 8 palabras**, concreta, citable |
| 7 | Elipsis y pago visual | 85-92 | 51-55 | 68-74 | Corte de tiempo ("tres meses después"): vemos el resultado de la acción |
| 8 | **Button** | 92-96 | 55-57 | 74-77 | Callback de algo del primer 40 %, **dicho por el que cambió** |
| 9 | **Coda** | 96-100 | 57-60 | 77-80 | 3-5 s de gesto o imagen espejo del primer plano, con luz nueva. **Sin texto nuevo** |

### Ficha (completarla antes de escribir una sola línea)
```
VALOR: empieza en ________ (−) → termina en ________ (+)
MÉTRICA DEL QUE CALCULA (beat 1): ________   ← vuelve en el button
LO PEQUEÑO CON NOMBRE: ________
TRES OBSTÁCULOS: ________ / ________ / ________
DECISIÓN (≤ 2 palabras o un gesto, antes del 40 %): ________
OBJECIÓN "NO CIERRA": ________
REFERENCIA/CITA/DATO (uso 1-5 o ninguna): ________
NÚCLEO (≤ 8 palabras): ________
ELIPSIS: ________   PAGO VISUAL: ________
BUTTON (callback de: ________, lo dice: ________): ________
CODA (gesto o espejo del plano 1, 3-5 s): ________
```
En el kit, la ficha va en `script.ficha` (el lint la ignora, pero queda registrada para rotar fórmulas entre videos).

### Ejemplo disecado: "Rulo" (el demo del kit, `episodes/demo`)
| Línea | Texto | Función |
|---|---|---|
| c1 | "Tres de la mañana. Le estás hablando a un potus." | Entrar tarde: el conflicto ya empezó, con dato concreto (hora, objeto) |
| e1 | "Se llama Rulo. Y se está muriendo." | Lo pequeño **con nombre**, en la segunda línea |
| c2 | "Le quedan dos hojas. Comprate otro: sale menos que un café." | El que calcula: dato + recomendación |
| e2 | "No quiero otro." (gap 0,8) | **Decisión** en 3 palabras, temprana |
| c3 | "¿Y si no vuelve?" (`obj`) | Objeción honesta, corta |
| e3 | "Lo riego igual." (gap 1,2, `climax`) | **Núcleo**: la acción contesta la objeción |
| c4 | "Eso no es botánica." (`react`) | Remate literal del que calcula |
| e4 | "No. Es Rulo." | Callback del nombre |
| c5 | "Buenas noches, Rulo." (gap 1,5, `coda`) | **Button**: el que calculaba usa el nombre que antes no usaba |

### Versión larga (~60 s) del mismo molde: "La planta de la abuela"
Roles: calcula un asistente (bloque-mascota); quiere ella; lo pequeño es el potus "Ramón".
1. ASISTENTE: "Informe del balcón: once plantas vivas de doce. Noventa y dos por ciento."
2. ELLA: "¿Y la que falta?"
3. ASISTENTE: "El potus. Tres hojas, amarillas. Recomiendo tirarlo y comprar uno nuevo."
4. ELLA: "¿Ramón?"
5. ASISTENTE: "No le pongas nombre. Así cuesta más tirarlo."
6. *(silencio 1 s)* ELLA: "Lo trasplanto." ← decisión (~35 %)
7. ASISTENTE (`obj`): "Tarda meses, ocupa la mesa y puede no prender. Uno nuevo sale más barato."
8. ELLA: "¿A vos te tiraron la primera vez que te colgaste?"
9. ASISTENTE (`react`): "…Me reiniciaron. No es lo mismo."
10. ELLA (`climax`): "Este lo compró mi abuela." ← núcleo (revela por qué importa, sin explicarlo)
11. *Elipsis "Tres meses después": un brote verde en primer plano.*
12. ASISTENTE (`coda`): "Informe del balcón: doce de doce." / "…Ramón incluido." ← button: callback del informe, dicho por el que cambió
13. *Coda: ella riega; el asistente le acerca la regadera. Mismo encuadre que el plano 1, luz de mañana.*

---

## 2. Variantes (mismo molde, otros temas)

| Tema | Quiere | Calcula | Lo pequeño | Decisión | Objeción | Núcleo | Button / coda |
|---|---|---|---|---|---|---|---|
| **El cumpleaños** | La hermana | Él mismo: "no conozco a nadie, es lejos, tengo que levantarme temprano" | Nico, el amigo que cumple y que siempre fue a los suyos | Ella le tira la campera: "Vamos." (gesto) | "Si no voy, nadie se da cuenta." | "Nico se da cuenta." | Él, a la vuelta: "Me quedé hasta el final." / ella: "¿Nadie se dio cuenta?" / él: "Nico sí." · Coda: la foto del grupo, él en la punta |
| **La pyme** | La dueña de la panadería | El contador, con la planilla: "Don Raúl debe tres semanas. Cortale el fiado." | Don Raúl, el jubilado que compra pan todos los días a las siete | "Fiale." | "Si fiás a uno, te fían todos. Así cierran las panaderías." | "Me compró el primer pan." | Contador, días después: "Don Raúl pagó." / "…Y trajo a la hija." / dueña: "¿Y la planilla?" / "Le agregué una columna." · Coda: el pan de las siete |
| **El profe** | El profe | El sistema de notas: "Joaquín: tres coma cinco. Desaprueba." | Joaquín, que no entrega nada desde marzo | "Esperá." | "Si le das otra chance, es injusto con los que entregaron." | "Una vez un pibe tampoco entregaba…" + flashback; revelación tardía: el pibe era el profe | Sistema: "Entrega recibida. Nota: siete." / profe: "Poné nueve. Lo hizo él." · Coda: el aula vacía, el banco de Joaquín con la carpeta |
| **Fe** (un ejemplo más) | Un personaje sabio o sagrado | Un asistente literal | Una oveja que falta, contada en número (99 de 100) | "Voy." | "¿Dejar noventa y nueve por una? Eso no cierra." | "Esa una tiene nombre." | "Actualizo la planilla: cien de cien." · Coda junto al fuego |
| **Divulgación** | Una investigadora | El jefe de presupuesto | Un experimento "inútil" con nombre | "Lo sigo." | "No publica, no financia." | "Los inútiles también descubren cosas." (+ un dato histórico verificado, a mitad del video, nunca al final) | "Partida aprobada. Rubro: inútil." · Coda en el laboratorio |

Lo que se repite es la **relación** (una lógica que mide frente a un afecto que se adelanta y actúa). Las frases, los rubros y los objetos cambian siempre.

---

## 3. Checklist (15 reglas verificables)

1. **El primer cuadro ya está adentro de la escena.** Primera línea: un personaje hablándole a otro, con un dato concreto (número, objeto, lugar). Nada de "¿Sabías que…?", saludos ni contexto.
2. **El valor gira.** Está escrito "empieza en ___ → termina en ___" (opuestos) y la decisión cae **antes del 40 %**.
3. **Hay una objeción honesta.** Alguien dice la objeción que tendría el público, con un argumento razonable (dato, costo o riesgo). Nadie la ridiculiza. En el kit: `obj: true`.
4. **El que quiere se adelanta y no discute.** Toma la iniciativa; al menos la mitad de sus líneas son preguntas o decisiones de ≤ 3 palabras; ninguna pasa de 12 palabras (salvo un relato con flashback); ≤ ~20 palabras propias por minuto.
5. **Resuelve una acción.** Lo que resuelve se ve: ir, levantarse, tender la mano, abrir la puerta. Test: tapá la cita o la frase linda; si la historia ya no se resuelve, esa frase está haciendo de *deus ex machina*.
6. **La referencia tiene un rol** (ver § 7): máximo una por video, nunca en la última línea, y uno de cada tres videos sin ninguna.
7. **Lo que se cuenta, se ve.** Si alguien relata, hay flashback o pago visual. El protagonista del relato se revela tarde ("una vez alguien…").
8. **Hay un intento que falla.** Antes de la resolución hay al menos un "sí, pero" o "no, y además".
9. **Hay una línea núcleo citable.** ≤ 8 palabras, concreta y personal, que alguien copiaría en un comentario. Nadie dice la moraleja.
10. **El humor apunta bien.** Cae en el que calcula, en el protagonista o en la situación. Nunca en el personaje `protegido`. Sin dobles sentidos (revisarlos en la variante del idioma).
11. **Hay dos velocidades.** Ida y vuelta con gaps de 0,2-0,4 s; silencio de 0,9-1,5 s antes de la decisión y antes del button.
12. **Hay una elipsis con consecuencia.** Un salto de tiempo o un corte muestra el resultado de la acción.
13. **El button es un callback del que cambió.** Retoma una palabra, un número o un objeto del primer 40 % y lo dice el personaje que cambió.
14. **Hay una coda de 3-5 s.** Gesto o imagen espejo del primer plano, con luz nueva. Sin texto nuevo, sin cartel, sin moraleja. La música cierra en una cadencia, no en un corte.
15. **El cierre apunta a una relación o a un cambio concreto**, no a una frase de autoayuda ("sé vos mismo", "creé en vos"). El final se gana con lo que pasó, no con lo que alguien dice.

---

## 4. Antipatrones (medidos en devoluciones reales)

| Antipatrón | Qué se vio | Qué lo reemplaza |
|---|---|---|
| **Resolver fácil y rápido con una frase sentenciosa** | "Resuelve muy fácil y rápido, es raro." La frase (cita, consejo, moraleja) cerraba el conflicto sola | Objeción honesta + decisión + acción visible. La frase, si está, es una pregunta |
| **Citar en todos los videos** | "Son todos iguales, siempre citan una frase… es muy previsible." | Máximo una referencia por video, uno de cada tres sin ninguna, y rotar cómo aparece |
| **Aperturas infantiles** ("¿Sabías que…?") | "Muy para niños", con público de 18-30 | Arrancar adentro de la escena: "Milán. Un chico pasa horas en la compu armando una página web." |
| **Texto gancho arriba** | A ese usuario no le gustó ("no me gusta el mensaje gancho de arriba"). Los referentes medidos tampoco lo usan (0 de 17 videos) | No es regla universal: **probar y medir** con A/B (§ 6). Por defecto, sin texto gancho; el kit lo soporta con `script.hooks` y `--flags hookB` |
| **Finales abruptos** | "Termina muy abrupto": cortar en el chiste o en una orden seca | Button (callback) + coda de 3-5 s |
| **Cursilería** | Un piropo o una cita literal ampulosa ("sos precioso a mis ojos") "es como mucho" | El cariño va en gestos y en humor. Si hay que decir algo tierno, en habla sobria y concreta |
| **Moraleja dicha** | "Ser uno mismo del todo" como cierre: suena a autoayuda y además contradice el tema | Cerrar con una acción documentada o una imagen |
| **Personaje-coach** | El que quiere hablaba como amigo canchero o coach ("respirá conmigo") y trivializaba | Sobrio, pocas palabras, pregunta y actúa |
| **Chistes que achican la escena** | El chiste le quitaba peso al tema | Humor que sale de la voz real del personaje y no rebaja lo importante |
| **Dobles sentidos** | Una línea graciosa tenía doble sentido en rioplatense y "queda raro" | Revisar cada verbo en la variante local (soplar, acabar, etc.) |
| **Personajes que mueven los brazos sin motivo** | "Mueven los brazos mientras están quietos, es raro." Las manos seguían la voz sílaba por sílaba | Gestos sostenidos solo en líneas largas (`held()`); quietos el resto. Ver `aprendizajes-tecnicos.md` |
| **Monólogo a cámara con frase pura** | El formato "POV: te habla a vos" con una cita sola "no me gustó nada" | Siempre dos personajes con conflicto |
| **Episodios centrados en un personaje invitado** | En los referentes rindieron ×0,84 contra ×1,16 de sus vecinos | Primero que el núcleo funcione |

---

## 5. Ritmo

- **Palabras por segundo** (dentro del tramo narrativo):
  - sketch / comedia rápida: 2,2-3,3 pal/s dentro de la línea; **~1,8 pal/s en total** contando silencios;
  - tierno / acompañamiento: 2,3-2,5 pal/s;
  - drama puro: 0,7-1,1 pal/s (en un reel, solo **un** tramo así: el tierno).
- **Presupuesto de palabras** (con silencios): 20 s ≈ 35 · 30 s ≈ 55 · 45 s ≈ 80 · 60 s ≈ 110-140.
- **Palabras por línea:** 4-9 en general (una línea de 9 palabras ya son ~4 s). El que quiere: 1-7, máximo 12. El que calcula puede hablar más: la verborragia frente a la brevedad **es** el contraste de status.
- **Una línea, un chiste.** El cambio de hablante es el respiro donde se procesa.
- **Gaps** (`gap` en el script, en segundos, antes de la línea):
  - ping-pong: 0,2-0,4;
  - beat antes del remate, la decisión o el button: 0,9-1,5;
  - interrupción: la línea anterior termina en `—` y la siguiente arranca con `[jumping in]` (gap chico o negativo).
  - Con `timing: "take"` se usan las pausas reales de la toma; el `gap` explícito queda solo para los silencios emocionales.
- **Duración:** la que pida la historia. En Instagram el alcance es apenas mejor en 30-60 s y cae arriba de 90 s (−20 a −35 %). Sketch: 20-45 s. Historia con flashback: 50-85 s. En YouTube Shorts no se encontró relación entre duración y vistas.
- **Planos:** ~4 s por plano en lo tierno (13-15 planos por minuto en los referentes que mejor rindieron); ~2 s en comedia rápida. En el kit: `minShot`.

---

## 6. Ganchos (lo que dicen los datos)

- **Los primeros 3 s deciden.** Instagram mide el *skip rate* (los que se van antes de los 3 s). En 9,8 M de reels de marcas (ene-jun 2026) la mediana fue **60,5-65,5 %**: el reel típico pierde casi 2 de cada 3 reproducciones antes del segundo 3. En YouTube, los Shorts con menos de 60 % de "stayed to watch" casi nunca funcionaron (dato correlacional).
- **Qué premian:** Instagram, tiempo de visualización + likes por alcance + **envíos por alcance** (los envíos pesan más para llegar a no seguidores). TikTok: ver el video completo.
- **Frame 1:** la cara de un personaje **ya hablándole a otro**, adentro del conflicto, con un dato concreto. Imagen y audio juntos en el segundo 0-2. Nada de logo, intro ni plano vacío.
- **Gancho auditivo antes que texto:** los referentes que mejor rindieron no usan texto gancho (0 de 17). Abren con el nombre del otro personaje + una confesión o un problema en menos de 4 s.
- **Vocativo + crisis concreta con un detalle raro** funciona en comedia: "Che. El login solo falla los martes."
- **Loop:** si la última línea o el último plano empalman con el primero, las repeticiones suman tiempo de visualización.
- **Envíos:** se comparte lo que identifica ("esto es mi vieja", "esto es mi equipo") o lo muy tierno. Un "mandáselo a…" explícito no tiene evidencia orgánica: probarlo como variable.
- **Cómo probar (sin opinar):**
  - Trial Reels de Instagram: dos aperturas del mismo cuerpo, solo cambian los primeros 3-5 s.
  - Ganadora solo si saca **≥ 5 puntos** de skip rate con **≥ 1.000 reproducciones** cada una; si no, es empate.
  - Para generalizar un tipo de gancho, que gane en **8 de 10 pares** como mínimo.
  - Comparar medianas, no promedios (las vistas tienen cola pesada).
- **No publicar el mismo reel en varias cuentas**: Instagram penaliza el contenido no original (refuerzo de abril 2026).

---

## 7. Cómo usar una referencia, cita o dato

**Regla:** máximo **una** por video, **nunca en la última línea**, y uno de cada tres videos sin ninguna. Si la referencia resuelve el conflicto, es trampa.

Cinco usos que no la convierten en "respuesta mágica":
| Uso | Cómo | Por qué no resuelve fácil |
|---|---|---|
| 1. **Pregunta** que devuelve la objeción | La referencia se formula como pregunta y el que objeta tiene que contestar | La respuesta (cómica o seria) es del otro |
| 2. **Eco de algo plantado** | Se siembra en los primeros 15 s y vuelve al final | El público reconoce, no aprende: emociona porque vuelve |
| 3. **Invitación a una acción** | La frase abre una decisión | Lo que resuelve es el paso, no la frase |
| 4. **Imagen** | La referencia se ve en pantalla (inserto con `visual`) | Se muestra, no se explica |
| 5. **Ninguna: actuarla** | La historia tiene la estructura de la referencia, sin que nadie la diga | Es el uso que menos se siente como sermón |

- **Parafrasear** en habla natural y sobria; nada de citas literales ampulosas.
- **Verificar todo dato** contra fuentes primarias. Distinguir historia de tradición o leyenda en el texto ("cuenta la tradición…", "se dice que…"). Una frase atribuida no es una frase documentada.
- En el kit, la línea con referencia lleva `cita: "<fuente>"`; el lint marca más de una, una en el cierre y las citas entre « » sin fuente.

---

## 8. Humor

- **Cae en el que calcula**, en el protagonista o en la situación. **Nunca en el personaje `protegido`** (el que no puede quedar en ridículo: una marca, una figura respetada, un personaje sagrado, el cliente). El protegido puede tener humor (seguir el juego, ironía suave sobre sí mismo), pero nunca sarcasmo ni ser el blanco. El lint marca como error tags sarcásticos o impacientes en el protegido.
- **Por qué:** el humor es una "violación benigna". La misma broma le parece graciosa al que no está comprometido con lo que se toca y ofensiva al que sí. Si la violación cae sobre la lógica fría, la tecnología o la vida moderna, es benigna para todos.
- **Motores que funcionan:**
  - contraste de status: uno apurado o emocional frente a uno plano y seguro;
  - malentendido literal: el que calcula ejecuta una figura al pie de la letra;
  - el "serio" como motor: nunca hace chistes, responde en serio y el absurdo sale del choque;
  - regla de tres: dos ítems arman el patrón y el tercero lo rompe, **sin pausa** antes del tercero;
  - intentos que fallan en serie: cada intento es un chiste y una objeción a la vez.
- **El remate termina en la palabra clave.** "Soy el dueño" y no "El dueño soy yo".
- **Un solo gag tierno** en el tramo medio funciona mejor que chistes en todas las líneas, y **nunca** durante el momento clave.
- **Revisar dobles sentidos** en la variante local del idioma.
- **Lo que hace querible al que calcula:** termina sirviendo con su propio idioma (actualiza la planilla, recalcula, usa el nombre). Si se lo humilla, se pierde.

---

## 9. Flashbacks mientras alguien cuenta

- Si un personaje relata algo, **se ve** mientras lo cuenta: flashback en otra locación (o en otro sector del set), con grado de color propio (frío, sepia o lavado).
- **Revelación tardía:** "un amigo una vez…", "conocí a alguien que…". La identidad del protagonista del relato llega al final ("¿ese eras vos?" / "El mismo."). La historia se escucha como nueva, sin etiquetas encima.
- El flashback es el lugar donde se permiten líneas más largas del que quiere.
- Volver del flashback con un corte o un `whoosh`, no con un fundido largo.
- Técnica: fases por corte (`shot.phase`), ver `motor.md`.

---

## 10. Mostrar en vez de decir

- **2 + 2:** no le des el 4 al público. Los comentarios escriben la moraleja; si el video la dice, no queda nada para comentar.
- **Subtexto:** que la verdad la descubra el personaje con sus palabras ("estoy haciendo todo esto por vos… y no estoy con vos") en lugar de que otro se la explique.
- **Plantar y pagar:** todo lo que paga al final aparece en los primeros 15 s.
- **Pago visual:** los números se ven (un holograma que se llena, una planilla, un contador); el cambio se ve (la luz que amanece, la planta que brota).
- **Imagen final espejo** del primer plano, con luz nueva. Pensar el último cuadro como algo que alguien usaría de fondo de pantalla.
- **La esperanza se cuenta con luz**, no con frases.
- Detalles del lugar (objetos cotidianos, del país, del rubro) **sin subrayarlos**.

---

## 11. Rotar fórmulas para no volverse previsible

La plantilla también se gasta si se copian sus frases. Entre videos seguidos, rotá **tres variables**:
1. **Quién calcula:** un asistente, el propio protagonista (su ansiedad), un tercero, "el mundo" (las métricas, el grupo, el jefe).
2. **Cómo aparece la referencia:** usos 1-5, y uno de cada tres sin ninguna.
3. **Tipo de button:**

| # | Mecanismo | Ejemplo genérico |
|---|---|---|
| 1 | **Eco transformado** | "¿Y si mañana se vuelve a secar?" / "La vuelvo a regar." / "…Entonces no cierro el informe." |
| 2 | **Una acción contesta una línea anterior** | Callback de "sentate un rato": al final el que no tenía tiempo se sienta, sin decirlo |
| 3 | **Revelación demorada** | "¿Y qué fue de ese pibe?" / "Ahora es profe." |
| 4 | **El que calcula recalcula** | "Recalculando… la ruta más corta pasaba por ahí." |
| 5 | **La ironía del que quiere** | "Clientes perdidos: cero." / "Por ahora." |
| 6 | **Final abierto** | "Uno de dos." / "La puerta sigue abierta." · Corte antes de que el otro decida |

- **Nunca dos videos seguidos con la misma palabra-gancho** del button ("voy", "actualizo", "planilla").
- Variar escenarios, planos y estructura: una plantilla idéntica con distinto texto puede caer en "contenido no auténtico" en YouTube.

---

## 12. Proceso

- **Un video por vez.** No se arranca el siguiente hasta tener devolución del anterior.
- **Opciones de guion escritas antes de gastar** voces y render: 2-3 versiones en texto, se elige una.
- Después de cada video: pedir devolución concreta (qué gustó, qué no, qué cambiaría) y anotarla en la bitácora del perfil, con fecha y qué se probó. Si cambia una regla, actualizar el lint.
- Escribir para TTS (números en letras, ¿¡, tags, mayúsculas): ver `aprendizajes-tecnicos.md` › Voces.
