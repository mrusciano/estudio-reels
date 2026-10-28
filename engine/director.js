// Director automatico: arma el plan de rodaje y la "actuacion" a partir de film.json + script.json.
// - un plano por linea, rotando encuadres del que habla (nunca dos iguales seguidos)
// - plano de dos en los silencios largos (beats), inserto si la linea nombra un objeto (keywords)
// - reaccion del que escucha despues de un remate (line.react)
// - expresiones a partir de los audio tags de v3 de cada linea
import { clamp, ramp, pulse } from './core.js';

// shotsBySpeaker: { who: [fn(t0,t1) => shot, ...] }  two/inserts: idem
// minShot (s): ritmo calmo (referencias medidas: ~4 s por plano en reels tiernos vs ~2 s en comedia). Las rafagas de planos cortos
// se resuelven en un plano de dos; un corto aislado se funde con el anterior. Insertos, nombrados, apertura y cierre se respetan.
export function planShots(film, script, { bySpeaker, two, inserts = {}, reaction = {}, named = {}, opening, closing, lead = 0.08, minLen = 0.9, minShot = 0 }) {
  const cues = film.cues, lines = Object.fromEntries(script.lines.map(l => [l.id, l]));
  const plan = []; const used = {};
  const push = (t0, t1, make, tag) => {
    if (t1 - t0 < 0.05) return;
    const prev = plan.at(-1);
    if (prev && prev.t1 > t0) prev.t1 = t0; // sin superposiciones
    if (prev && prev.tag === tag && tag !== 'insert') { prev.t1 = t1; return; } // mismo encuadre: se extiende
    plan.push({ ...make(t0, t1), t0, t1, tag });
  };
  const pick = who => { const list = bySpeaker[who]; used[who] = ((used[who] ?? -1) + 1) % list.length; return [list[used[who]], `${who}:${used[who]}`]; };
  cues.forEach((c, i) => {
    const l = lines[c.id] || {}, next = cues[i + 1], prev = cues[i - 1];
    let t0 = i === 0 ? 0 : c.at - lead;
    const t1 = next ? next.at - lead : film.total + 1;
    // silencio largo antes de esta linea: plano de dos
    if (prev && c.at - prev.end > 1.1) { push(prev.end + 0.15, c.at - lead, two, 'two'); }
    // inserto si la linea nombra un objeto
    const kw = Object.keys(inserts).find(k => new RegExp(`\\b${k}`, 'i').test(l.text || ''));
    if (l.shot && named?.[l.shot]) { push(t0, t1, named[l.shot], 'named:' + l.shot); return; }
    if (i === 0 && opening) { push(t0, t1, opening, 'open'); return; }
    if (!next && closing) { push(t0, t1, closing, 'close'); return; }
    if (kw && l.shot !== 'speaker') {
      const w = c.words.find(x => new RegExp(`^${kw}`, 'i').test(x.w));
      const ti = w ? Math.max(t0 + 0.6, w.s - 0.15) : t0;
      if (ti > t0 + 0.4) { const [mk, tag] = pick(c.who); push(t0, ti, mk, tag); }
      push(ti, Math.min(t1, ti + 2.2), inserts[kw], 'insert');
      if (ti + 2.2 < t1 - 0.3) { const [mk, tag] = pick(c.who); push(ti + 2.2, t1, mk, tag); }
      return;
    }
    // linea muy corta del mismo que hablo antes: se queda en el plano
    if (prev && prev.who === c.who && c.end - c.at < minLen) { plan.at(-1).t1 = t1; return; }
    // remate: plano del que habla y despues reaccion del que escucha
    if (l.react && reaction[otherOf(film, c.who)]) {
      const [mk, tag] = pick(c.who); push(t0, c.end + 0.05, mk, tag);
      push(c.end + 0.05, t1, reaction[otherOf(film, c.who)], 'react');
      return;
    }
    const [mk, tag] = pick(c.who); push(t0, t1, mk, tag);
  });
  // ningun plano de menos de 0.6 s (se funde con el anterior)
  for (let i = plan.length - 1; i > 0; i--) if (plan[i].t1 - plan[i].t0 < 0.6) { plan[i - 1].t1 = plan[i].t1; plan.splice(i, 1); }
  if (!minShot || !two) return plan;
  const fixed = sh => /insert|named|open|close/.test(sh.tag), short = sh => sh.t1 - sh.t0 < minShot && !fixed(sh);
  const out = [];
  for (let i = 0; i < plan.length; i++) {
    const sh = plan[i];
    if (short(sh)) {
      let j = i; while (j + 1 < plan.length && short(plan[j + 1])) j++;
      if (j > i) { const t0 = sh.t0, t1 = plan[j].t1; out.push({ ...two(t0, t1), t0, t1, tag: 'two' }); i = j; continue; }
      if (out.length && !/insert/.test(out.at(-1).tag)) { out.at(-1).t1 = sh.t1; continue; }
    }
    out.push(sh);
  }
  for (let i = out.length - 1; i > 0; i--) if (out[i].tag === 'two' && out[i - 1].tag === 'two') { out[i - 1].t1 = out[i].t1; out.splice(i, 1); }
  return out;
}
const otherOf = (film, who) => film.speakers.find(s => s !== who);

// expresion a partir de tags de v3 de las lineas cercanas: devuelve pesos 0..1 suavizados
const TAGS = {
  smile: /laugh|chuckl|giggl|warm|happy|amused|smil|softly|cracking/i, sad: /sigh|tired|sad|weary|exhaust|sheepish/i,
  surprise: /surpris|gasp|shock|amaz|disbelief|puzzled|appalled/i, deadpan: /deadpan|flat|dry|monoton|sarcas|dismissive/i, excited: /excit|cheer|enthus|jumping/i,
  whisper: /whisper/i,
};
export function expression(film, script, who, t) {
  const lines = Object.fromEntries(script.lines.map(l => [l.id, l]));
  const out = { smile: 0, sad: 0, surprise: 0, deadpan: 0, excited: 0, whisper: 0 };
  for (const c of film.cues) {
    const tags = (lines[c.id]?.tags || '') + ' ' + (lines[c.id]?.mood || '');
    // propio: durante la linea; ajeno: reaccion leve despues
    const own = c.who === who, k = own ? pulse(t, c.at, c.end + 0.4, 0.2, 0.5) : 0.35 * pulse(t, c.end, c.end + 1.2, 0.2, 0.5);
    if (k <= 0) continue;
    for (const [name, re] of Object.entries(TAGS)) if (re.test(tags)) out[name] = Math.max(out[name], k);
  }
  return out;
}
export const lookTarget = (film, who, t) => {
  // mira al que habla; si habla el, mira al otro
  const c = film.cues.find(c => t >= c.at - 0.3 && t <= c.end + 0.5);
  return c && c.who !== who ? 'speaker' : 'partner';
};
export { clamp, ramp };
