// Voces de un episodio con Eleven v3 en modo DIALOGO (la entonacion conecta entre lineas).
// 1) genera N tomas del dialogo completo (seeds distintas, cacheadas)
// 2) transcribe cada toma con Scribe y puntua cada linea: claridad (WER), tags leidos en voz alta, ritmo
// 3) elige la mejor toma POR LINEA y corta voices/<id>.mp3 + <id>.json (alineacion de esa linea)
// Uso: node tools/voices.mjs <episodio> [--takes 3] [--force]
// script.json: { model, language, voices: {who: {id, stability}}, lines: [{id, who, text, tags?, gap?}] }
//   tags: audio tags de v3 en ingles, ej. "[deadpan]" o "[sighs] [tired]"; van antes del texto.
import fs from 'node:fs';
import path from 'node:path';
import { apiKey, perfil } from './_comun.mjs';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

const ep = process.argv[2];
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TAKES = +arg('--takes', 3), FORCE = process.argv.includes('--force');
const DIR = path.resolve('episodes', ep), VO = path.join(DIR, 'voices'), TK = path.join(VO, 'takes');
const script = JSON.parse(fs.readFileSync(path.join(DIR, 'script.json'), 'utf8'));
const KEY = apiKey();
fs.mkdirSync(TK, { recursive: true });
const SEEDS = [11, 23, 37, 41, 53, 67].slice(0, TAKES);
const lineText = l => [l.tags, l.text].filter(Boolean).join(' ');
// cache por contenido: cambia el modelo, una voz, la stability o una linea => tomas nuevas
const HASH = crypto.createHash('sha1').update(JSON.stringify([script.model, script.language, script.stability, script.voices, script.lines.map(lineText)])).digest('hex').slice(0, 8);

// ---------- 1. tomas del dialogo completo (en paralelo) ----------
const CONC = +arg('--conc', 2); // el plan actual rechaza mas de ~2 pedidos simultaneos (429 concurrent_limit_exceeded)
async function pool(items, n, fn) {
  let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}
// reintento ante 429 (limite de pedidos concurrentes del plan); init() rearma el body en cada intento
async function post(url, init, label) {
  for (let a = 0; a < 6; a++) {
    const r = await fetch(url, init());
    if (r.status !== 429) return r;
    await new Promise(res => setTimeout(res, 1500 * (a + 1)));
  }
  throw new Error('429 persistente en ' + label);
}
let fatal = null;
await pool(SEEDS, CONC, async seed => {
  const base = path.join(TK, `${HASH}_take_${seed}`);
  if (fs.existsSync(base + '.json') && !FORCE) return;
  if (fs.existsSync(base + '.stt.json')) fs.unlinkSync(base + '.stt.json'); // toma nueva => transcripcion nueva
  const body = {
    model_id: script.model || 'eleven_v3', language_code: script.language || 'es', seed,
    settings: { stability: script.stability ?? 0.5 },
    inputs: script.lines.map(l => ({ text: lineText(l), voice_id: script.voices[l.who].id })),
  };
  const r = await post('https://api.elevenlabs.io/v1/text-to-dialogue/with-timestamps?output_format=mp3_44100_128', () => ({
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) }), 'toma ' + seed);
  const j = await r.json();
  if (!j.audio_base64) { console.log('toma', seed, 'ERROR', JSON.stringify(j).slice(0, 300)); fatal = true; return; }
  fs.writeFileSync(base + '.mp3', Buffer.from(j.audio_base64, 'base64'));
  const { audio_base64, ...meta } = j;
  fs.writeFileSync(base + '.json', JSON.stringify(meta));
  console.log('toma', seed, 'ok', r.headers.get('character-cost') ? `(${r.headers.get('character-cost')} creditos)` : '');
});
if (fatal) process.exit(1);

// ---------- 2. transcripcion y puntaje por linea ----------
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\[[^\]]*\]/g, ' ').replace(/[^a-zñ0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
const NUM = { cero: 0, uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, veinte: 20, cincuenta: 50, cien: 100, doscientas: 200, doscientos: 200, mil: 1000 };
const canon = ws => ws.map(w => (w in NUM ? '#' : /^\d/.test(w) ? '#' : w)).filter((w, i, a) => !(w === '#' && a[i - 1] === '#'));
function wer(ref, hyp) {
  const r = canon(norm(ref)), h = canon(norm(hyp));
  if (!r.length) return 0;
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) for (let j = 1; j <= h.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  return d[r.length][h.length] / r.length;
}
const LEAK = /\b(risa|risas|suspira|suspiro|deadpan|sigh|sighs|laughs|whisper|sarcastic|tired|pausa|exhale)/i;
// transcripciones en paralelo
await pool(SEEDS, CONC, async seed => {
  const base = path.join(TK, `${HASH}_take_${seed}`);
  if (fs.existsSync(base + '.stt.json')) return;
  const r = await post('https://api.elevenlabs.io/v1/speech-to-text', () => {
    const fd = new FormData(); fd.append('model_id', 'scribe_v1'); fd.append('tag_audio_events', 'true'); fd.append('language_code', script.language || 'es');
    fd.append('file', new Blob([fs.readFileSync(base + '.mp3')]), `take_${seed}.mp3`);
    return { method: 'POST', headers: { 'xi-api-key': KEY }, body: fd };
  }, 'stt ' + seed);
  fs.writeFileSync(base + '.stt.json', JSON.stringify(await r.json()));
});
const takes = [];
for (const seed of SEEDS) {
  const base = path.join(TK, `${HASH}_take_${seed}`);
  const meta = JSON.parse(fs.readFileSync(base + '.json', 'utf8'));
  const stt = JSON.parse(fs.readFileSync(base + '.stt.json', 'utf8'));
  // Los timestamps del dialogo se desfasan (hasta ~2.5 s medido): la verdad es Scribe.
  // Alineacion global (Needleman-Wunsch) entre las palabras del guion y las palabras oidas.
  const ref = [];
  script.lines.forEach((l, li) => l.text.split(/\s+/).filter(Boolean).forEach(ow => {
    const c = canon(norm(ow)); if (!c.length) { if (ref.length && ref.at(-1).li === li) ref.at(-1).ow.push(ow); return; }
    const prev = ref.at(-1);
    if (c[0] === '#' && prev && prev.li === li && prev.w === '#') { prev.ow.push(ow); return; }
    ref.push({ w: c[0], li, ow: [ow] });
  }));
  const sw = (stt.words || []).filter(w => w.type === 'word').map(w => ({ ...w, c: canon(norm(w.text))[0] ?? '' }));
  for (let k = sw.length - 1; k > 0; k--) if (sw[k].c === '#' && sw[k - 1].c === '#') { sw[k - 1].end = sw[k].end; sw[k - 1].text += ' ' + sw[k].text; sw.splice(k, 1); }
  const n = ref.length, m = sw.length, D = Array.from({ length: n + 1 }, () => new Float32Array(m + 1)), B = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  for (let i = 1; i <= n; i++) { D[i][0] = i; B[i][0] = 1; } for (let j = 1; j <= m; j++) { D[0][j] = j; B[0][j] = 2; }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const sub = D[i - 1][j - 1] + (ref[i - 1].w === sw[j - 1].c ? 0 : 1), del = D[i - 1][j] + 1, ins = D[i][j - 1] + 1;
    if (sub <= del && sub <= ins) { D[i][j] = sub; B[i][j] = 0; } else if (del <= ins) { D[i][j] = del; B[i][j] = 1; } else { D[i][j] = ins; B[i][j] = 2; }
  }
  const match = new Array(n).fill(-1), errs = new Array(script.lines.length).fill(0), extra = new Array(script.lines.length).fill(0);
  for (let i = n, j = m; i > 0 || j > 0;) {
    const b = B[i][j];
    if (i > 0 && j > 0 && b === 0) { match[i - 1] = j - 1; if (ref[i - 1].w !== sw[j - 1].c) errs[ref[i - 1].li]++; i--; j--; }
    else if (i > 0 && (b === 1 || j === 0)) { errs[ref[i - 1].li]++; i--; }
    else { const li = ref[Math.min(i, n - 1)]?.li ?? 0; extra[li]++; j--; }
  }
  const events = (stt.words || []).filter(w => w.type === 'audio_event');
  const lines = script.lines.map((l, li) => {
    const idx = ref.map((r, k) => (r.li === li ? match[k] : -1)).filter(k => k >= 0);
    const nw = ref.filter(r => r.li === li).length;
    if (!idx.length) return { i: li, t0: 0, t1: 0, words: [], heardText: '', events: '', wps: 0, wer: 1, score: 9 };
    const toks = ref.map((r, k) => ({ r, k })).filter(x => x.r.li === li);
    const ws = [];
    toks.forEach(({ r, k }, q) => {
      let s0, e0;
      if (match[k] >= 0) { s0 = sw[match[k]].start; e0 = sw[match[k]].end; }
      else { // interpolar entre vecinos con match
        const pv = toks.slice(0, q).reverse().find(x => match[x.k] >= 0), nx = toks.slice(q + 1).find(x => match[x.k] >= 0);
        s0 = pv ? sw[match[pv.k]].end : (nx ? sw[match[nx.k]].start - 0.3 : 0); e0 = nx ? sw[match[nx.k]].start : s0 + 0.3;
      }
      const d = (e0 - s0) / r.ow.length;
      r.ow.forEach((ow, m) => ws.push({ w: ow, s: s0 + m * d, e: s0 + (m + 1) * d }));
    });
    const heardWs = idx.map(k => sw[k].text);
    const lineWer = Math.min(1, (errs[li] + extra[li]) / nw);
    const ev = events.filter(e => e.start >= ws[0].s - 0.3 && e.start <= ws.at(-1).e + 0.6).map(e => e.text).join(' ');
    const speech = ws.at(-1).e - ws[0].s, wps = nw / Math.max(speech, 0.25);
    const heardText = heardWs.join(' ');
    const score = lineWer * 3 + (LEAK.test(heardText) ? 2 : 0) + Math.max(0, wps - 3.6) * 0.5 + Math.max(0, 1.3 - wps) * 0.5;
    return { i: li, t0: ws[0].s, t1: ws.at(-1).e, words: ws, heardText, events: ev, wps: +wps.toFixed(2), wer: +lineWer.toFixed(2), score: +score.toFixed(2) };
  });
  // fin de cada linea: incluye una risa/suspiro pegado, sin pisar la siguiente
  lines.forEach((ln, li) => { const nx = lines[li + 1]; const ev = events.find(e => e.start >= ln.t1 - 0.05 && e.start < ln.t1 + 0.6); ln.tail = Math.min(ev ? ev.end : ln.t1 + 0.14, nx?.t0 ? nx.t0 - 0.03 : 1e9); });
  takes.push({ seed, base, lines });
}

// ---------- 3. toma base (continuidad) + corte ----------
// Aprendizaje: mezclar la mejor toma POR LINEA suena poco natural (cambia la energia entre replicas).
// Ahora: se elige UNA toma base (menor score total) y solo se reemplaza una linea si en la base esta claramente mal.
const SWAP = +(process.argv.find(a => a.startsWith('--swap='))?.slice(7) ?? 0.6);
const baseTake = takes.map(t => ({ t, tot: t.lines.reduce((s, x) => s + x.score, 0) })).sort((a, b) => a.tot - b.tot)[0].t;
console.log('toma base', baseTake.seed);
const chosen = [];
const report = [];
for (const [i, l] of script.lines.entries()) {
  const ov = path.join(VO, `${l.id}.json`);
  if (!FORCE && fs.existsSync(ov) && JSON.parse(fs.readFileSync(ov, 'utf8')).redo) { report.push(`${l.id.padEnd(4)} (rehecha a mano, se conserva)`); continue; }
  const opts = takes.map(t => ({ seed: t.seed, base: t.base, ...t.lines[i] })).sort((a, b) => a.score - b.score);
  const inBase = opts.find(o => o.seed === baseTake.seed);
  const best = inBase.score - opts[0].score > SWAP ? opts[0] : inBase;
  // pausa natural antes de esta linea en su toma (solo si la anterior salio de la misma toma)
  const prevC = chosen[i - 1], natGap = prevC && prevC.seed === best.seed ? +(best.t0 - prevC.t1).toFixed(3) : null;
  chosen[i] = best;
  const a = Math.max(0, best.words[0].s - 0.06), b = Math.max(best.words.at(-1).e + 0.06, best.tail);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', a.toFixed(3), '-to', b.toFixed(3), '-i', best.base + '.mp3', '-c:a', 'libmp3lame', '-q:a', '2', path.join(VO, `${l.id}.mp3`)]);
  // alineacion rebasada a la linea: build.mjs la lee como antes (characters + start/end)
  const chars = [], st = [], en = [];
  best.words.forEach((w, k) => {
    [...w.w].forEach((ch, m) => { chars.push(ch); const d = (w.e - w.s) / w.w.length; st.push(+(w.s - a + m * d).toFixed(3)); en.push(+(w.s - a + (m + 1) * d).toFixed(3)); });
    if (k < best.words.length - 1) { chars.push(' '); st.push(+(w.e - a).toFixed(3)); en.push(+(best.words[k + 1].s - a).toFixed(3)); }
  });
  fs.writeFileSync(path.join(VO, `${l.id}.json`), JSON.stringify({ text: l.text, take: best.seed, natGap, alignment: { characters: chars, character_start_times_seconds: st, character_end_times_seconds: en } }));
  report.push(`${l.id.padEnd(4)} toma ${best.seed}  WER ${best.wer.toFixed(2)}  ${best.wps} pal/s  score ${best.score}  | oido: "${best.heardText}"${best.events ? '  eventos: ' + best.events : ''}${best.wer > 0.2 ? '   <-- REVISAR' : ''}`);
}
console.log(report.join('\n'));
fs.writeFileSync(path.join(VO, 'qa.txt'), report.join('\n'));
