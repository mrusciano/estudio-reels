// Linter de guiones: chequea episodes/<ep>/script.json contra reglas de escritura para TTS, el oficio de guion
// (docs/guion.md) y las reglas propias del usuario (perfil/reglas.json, las escribe /configurar y /devolucion).
// Perfiles de guion (script.perfil):
//   'comico'  ping-pong rapido: ~4 palabras por linea, 14-30 lineas, remates con beat y reaccion
//   'tierno'  dialogo calmo: 6-28 intervenciones, ~2,4 palabras/s, objecion honesta, coda
//   'narrado' una voz que cuenta (historia, biografia, explicador) con personajes que aparecen poco
// Uso: node tools/lint-script.mjs <episodio>
import fs from 'node:fs';
import path from 'node:path';

const ep = process.argv[2];
const s = JSON.parse(fs.readFileSync(path.join('episodes', ep, 'script.json'), 'utf8'));
const R = fs.existsSync('perfil/reglas.json') ? JSON.parse(fs.readFileSync('perfil/reglas.json', 'utf8')) : {};
const P = fs.existsSync('perfil/estudio.json') ? JSON.parse(fs.readFileSync('perfil/estudio.json', 'utf8')) : {};
const out = { err: [], warn: [], ok: [] };
const words = t => t.replace(/\[[^\]]*\]/g, ' ').split(/\s+/).filter(w => /[\p{L}\d]/u.test(w));
const L = s.lines, W = L.map(l => words(l.text).length), total = W.reduce((a, b) => a + b, 0);
const gaps = L.slice(1).map(l => l.gap ?? 0.55);
const PERFIL = s.perfil || P.perfilGuion || 'tierno';
const WPS = R.palabrasPorSegundo ?? (PERFIL === 'comico' ? 3.0 : 2.4);
const est = total / WPS + gaps.reduce((a, b) => a + b, 0) + 0.25 + (s.tail ?? 0.7);
const PROT = s.protegido ?? P.protegido; // personaje que nunca queda en ridiculo (opcional)
const LANG = (s.language || 'es').slice(0, 2);
const TAGS_OK = /^(laughs?|laughing|chuckles?|giggles?|sighs?|exhales?|inhales?|gasps?|whispers?|whispering|clears throat|sarcastic|deadpan|curious|excited|tired|sad|happy|angry|annoyed|calm|confused|surprised|awed|amazed|hesitant|nervous|warmly|warm|sincere|amused|serious|thoughtful|dramatically|dramatic|softly|quietly|loudly|shouting|crying|resigned|matter-of-fact|flatly|flat|dry|playful|mischievously|cheerfully|reassuring|impatient|frustrated|relieved|proud|short pause|long pause|pause|interrupting|overlapping|jumping in|puzzled|sheepishly|disbelief|dismissive|smug|appalled|nervously|rushed|snappy|slowly|stifling laughter|cracking up|muttering|under his breath)$/i;

// ---------- escritura para TTS (valen siempre) ----------
L.forEach((l, i) => {
  if (/\d/.test(l.text)) out.err.push(`${l.id}: numeros con digitos; escribirlos en letras (el TTS los lee mal).`);
  if (LANG === 'es' && /\?/.test(l.text) && !/¿/.test(l.text)) out.err.push(`${l.id}: falta el "¿" de apertura (cambia la entonacion).`);
  if (LANG === 'es' && /!/.test(l.text) && !/¡/.test(l.text)) out.err.push(`${l.id}: falta el "¡" de apertura.`);
  if (/\[[^\]]+\]/.test(l.text)) out.err.push(`${l.id}: audio tags dentro de "text"; van en "tags".`);
  if (/«/.test(l.text) && !l.cita) out.err.push(`${l.id}: texto entre «» sin campo "cita" con la fuente.`);
  if (/<break|\.\.\.\.|\[pause\]/i.test(l.text)) out.warn.push(`${l.id}: pausas dentro del texto; usar "gap" (los <break> desestabilizan el modelo).`);
  for (const tg of (l.tags || '').match(/\[[^\]]+\]/g) || []) if (!TAGS_OK.test(tg.slice(1, -1).trim())) out.warn.push(`${l.id}: tag ${tg} no conocido (puede leerse en voz alta).`);
  if (i > 0 && L[i - 1].who === l.who && l.gap == null) out.warn.push(`${l.id}: mismo personaje dos lineas seguidas sin "gap"; fusionar o separar.`);
  if (!s.voices?.[l.who]) out.err.push(`${l.id}: "${l.who}" no tiene voz en "voices".`);
});

// ---------- oficio (docs/guion.md) ----------
if (PROT) L.filter(l => l.who === PROT).forEach(l => { if (/sarcastic|smug|dismissive|mischiev|annoyed|impatient|frustrated/i.test(l.tags || '')) out.err.push(`${l.id}: tono ${l.tags} en "${PROT}" (protegido: nunca sarcastico ni impaciente; el humor cae en el otro).`); });
if (s.hooks?.length) out.warn.push('"hooks": texto gancho arriba. Hay publicos a los que les molesta; si lo usas, que sea una prueba A/B y no la norma.');
const nCitas = L.filter(l => l.cita).length;
if (nCitas > (R.maxCitas ?? 1)) out.warn.push(`${nCitas} lineas con "cita": citar siempre se vuelve previsible. Maximo ${R.maxCitas ?? 1}.`);
const iCita = L.findIndex(l => l.cita);
if (iCita >= 0 && iCita >= L.length - 3) out.warn.push(`${L[iCita].id}: la cita cae en el cierre: "la frase resuelve todo facil". Que resuelva una accion o una idea ganada.`);
if ((s.tail ?? 0.7) < 1.8 && !L.some(l => l.coda)) out.warn.push('Sin coda (tail < 1,8 s y ninguna linea "coda"): el final se siente abrupto; agregar algo chiquito despues del remate.');
if (/^¿sab[ií]as/i.test(L[0].text)) out.warn.push('Apertura "¿Sabías que…?": suena infantil. Entrar tarde, adentro de la escena, con un dato concreto.');
if (W[0] > 12) out.warn.push(`Apertura de ${W[0]} palabras: apuntar a 4-10.`);
if (PERFIL !== 'comico' && PERFIL !== 'narrado' && !L.some(l => l.obj)) out.warn.push('Ninguna linea "obj": falta la objecion honesta (alguien duda en serio antes de la resolucion).');
const maxW = R.maxPalabrasLinea ?? (PERFIL === 'comico' ? 10 : PERFIL === 'narrado' ? 22 : 14);
L.forEach((l, i) => { if (W[i] > maxW && !l.visual && !/^fb/.test(l.shot || '')) out.warn.push(`${l.id}: ${W[i]} palabras (max ${maxW} en perfil ${PERFIL}; mas largo solo si hay algo pasando en pantalla).`); });
const beats = gaps.filter(g => g >= 1.1).length;
if (PERFIL === 'comico') {
  if (L.length < 14) out.warn.push(`Pocas lineas (${L.length}); el ping-pong comico promedia ~25 en ~50 s.`);
  if (!beats) out.warn.push('Sin silencios largos (gap >= 1,1 s): el remate necesita un beat antes.');
  if (!L.some(l => l.react)) out.warn.push('Ningun "react": marcar 1-3 remates para cortar a la reaccion del que escucha.');
}
if (beats > 5) out.warn.push(`${beats} silencios largos: el ritmo se cae.`);
// ritmo (devolucion medida: "todo muy lento"): silencios muy largos y planos largos
{ const slow = gaps.filter(g => g >= 1.3).length; if (slow > 2) out.warn.push(`${slow} silencios >= 1,3 s: se siente lento. Dejar los largos solo antes de la decision o del button.`); }
if (s.minShot != null && s.minShot > 2.4) out.warn.push(`minShot ${s.minShot}: con 3 s o mas los planos se sienten lentos. Usar 1,8-2,2 (salvo un video lento a proposito).`);
// "ficha que cae": la vuelta de tuerca que sorprende se escribe ANTES del guion (docs/guion.md)
if (s.ficha && !s.ficha.vuelta) out.warn.push('ficha sin "vuelta": falta la ficha que cae (la vuelta de tuerca que sorprende). Se escribe antes del guion.');
// variante del perfil: con voseo, el tuteo o el neutro suenan a mezcla de acentos (sobre todo con voces locales)
if (/rioplat|voseo|argentin|urugua/i.test(P.variante || '')) L.forEach(l => {
  const m = l.text.match(/(?<!\p{L})(sálvame|ayúdame|mírame|escúchame|perdóname|dime|tú|vosotros|habéis|tenéis|sois|estáis|os\s+(?:digo|doy|pido))(?!\p{L})/iu);
  if (m) out.err.push(`${l.id}: "${m[1]}" es tuteo/neutro y el perfil es ${P.variante}: va en voseo ("salvame", "decime", "vos"), si no mezcla acentos.`);
});
const [dMin, dMax] = R.duracion ?? P.duracion ?? [20, 90];
if (est < dMin || est > dMax) out.warn.push(`Duracion estimada ${est.toFixed(0)} s, fuera del rango del perfil (${dMin}-${dMax} s).`);

// ---------- reglas propias del usuario (perfil/reglas.json) ----------
// { "prohibido": [{ "re": "regex", "msg": "por que", "nivel": "error"|"aviso", "who": "opcional" }] }
for (const r of R.prohibido || []) {
  const re = new RegExp(r.re, 'iu');
  L.forEach(l => { if ((!r.who || r.who === l.who) && re.test(l.text)) (r.nivel === 'error' ? out.err : out.warn).push(`${l.id}: ${r.msg}`); });
}

out.ok.push(`perfil ${PERFIL} · ${L.length} lineas · ${total} palabras · ${(total / L.length).toFixed(1)} pal/linea · ${beats} beats · ~${est.toFixed(0)} s`);
for (const k of ['err', 'warn', 'ok']) for (const m of out[k]) console.log({ err: 'ERROR ', warn: 'aviso ', ok: 'ok    ' }[k] + m);
process.exitCode = out.err.length ? 1 : 0;
