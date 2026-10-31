// script.json + voces -> film.json (cues, subtitulos, envolventes) + buses de voz por personaje (wav float32).
// Uso: node tools/build.mjs <episodio>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ep = process.argv[2];
const DIR = path.resolve('episodes', ep);
const script = JSON.parse(fs.readFileSync(path.join(DIR, 'script.json'), 'utf8'));
const SR = 44100, EFPS = 60;
const START = 0.25;          // la primera voz arranca acá; el subtitulo ya esta en pantalla en t = 0
const TAIL = script.tail ?? 0.7;            // aire despues de la ultima palabra antes del corte seco

// tempo: v4 no tiene 'speed'; se acelera con atempo (conserva el tono). La referencia habla ~3.3 pal/s dentro de la linea.
const TEMPO = script.tempo ?? 1;
const decode = f => {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', f, ...(TEMPO !== 1 ? ['-af', `atempo=${TEMPO}`] : []), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
};
function words(al) {
  const out = []; let cur = null;
  al.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) { if (cur) out.push(cur); cur = null; return; }
    if (!cur) cur = { w: '', s: al.character_start_times_seconds[i] };
    cur.w += ch; cur.e = al.character_end_times_seconds[i];
  });
  if (cur) out.push(cur);
  return out;
}

// 1. cues
let cursor = START;
const cues = script.lines.map((l, i) => {
  const vj = JSON.parse(fs.readFileSync(path.join(DIR, 'voices', l.id + '.json'), 'utf8')), al = vj.alignment;
  const pcm = decode(path.join(DIR, 'voices', l.id + '.mp3'));
  const ws = words(al).map(w => ({ ...w, s: w.s / TEMPO, e: w.e / TEMPO }));
  const src0 = Math.max(0, ws[0].s - 0.03), src1 = Math.min(pcm.length / SR, ws.at(-1).e + 0.12);
  // pausa: la del guion si esta; si no, la natural de la toma (script.timing === 'take'), acotada; si no, 0.5
  const nat = script.timing === 'take' && vj.natGap != null ? Math.min(1.4, Math.max(0.12, vj.natGap / TEMPO)) : null;
  const at = i === 0 ? START : cursor + (l.gap ?? nat ?? 0.5);
  cursor = at + (src1 - src0);
  return { id: l.id, who: l.who, at, end: cursor, src0, src1, pcm, words: ws.map(w => ({ w: w.w, s: +(at + w.s - src0).toFixed(3), e: +(at + w.e - src0).toFixed(3) })) };
});
const TOTAL = +(cursor + TAIL).toFixed(3);
const N = Math.ceil(TOTAL * SR);

// 2. buses de voz (nivel medido a -21 dBFS RMS, fades cortos)
const speakers = [...new Set(cues.map(c => c.who))];
const bus = Object.fromEntries(speakers.map(s => [s, new Float32Array(N)]));
for (const c of cues) {
  const seg = c.pcm.subarray(Math.floor(c.src0 * SR), Math.floor(c.src1 * SR));
  let sum = 0, n = 0; for (const x of seg) if (Math.abs(x) > 0.02) { sum += x * x; n++; }
  const gain = Math.pow(10, -21 / 20) / Math.sqrt(sum / Math.max(n, 1));
  const fi = Math.floor(0.008 * SR), fo = Math.floor(0.03 * SR), off = Math.floor(c.at * SR);
  for (let i = 0; i < seg.length && off + i < N; i++) {
    const f = Math.min(1, i / fi, (seg.length - i) / fo);
    bus[c.who][off + i] += seg[i] * gain * f;
  }
}
function writeWav(file, data) {
  const b = Buffer.alloc(44 + data.length * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + data.length * 4, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(3, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(32, 34); b.write('data', 36); b.writeUInt32LE(data.length * 4, 40);
  Buffer.from(data.buffer, data.byteOffset, data.length * 4).copy(b, 44);
  fs.writeFileSync(file, b);
}
fs.mkdirSync(path.join(DIR, 'frames'), { recursive: true });
for (const s of speakers) writeWav(path.join(DIR, 'frames', `bus_${s}.wav`), bus[s]);

// 3. envolventes de habla (60/s, RMS 30 ms, p95 = 1, curva 0.8)
const env = {};
for (const s of speakers) {
  const n = Math.ceil(TOTAL * EFPS), e = new Array(n).fill(0), w = Math.floor(0.03 * SR);
  for (let k = 0; k < n; k++) {
    const c0 = Math.floor(k / EFPS * SR); let acc = 0;
    for (let i = c0 - (w >> 1); i < c0 + (w >> 1); i++) { const x = bus[s][i] || 0; acc += x * x; }
    e[k] = Math.sqrt(acc / w);
  }
  const p95 = [...e].filter(v => v > 1e-4).sort((a, b) => a - b)[Math.floor(e.filter(v => v > 1e-4).length * 0.95)] || 1;
  env[s] = e.map(v => +Math.min(1, Math.pow(v / p95, 0.8)).toFixed(3));
}

// 4. subtitulos
const subs = [];
const MAXC = 50;
const txt = ws => ws.map(x => x.w).join(' ');
// placas huérfanas ("No me / dan las cuentas.", "por / Dios."): si la placa que sigue es muy corta y la anterior no terminó la frase,
// se reparten las palabras de las dos; se prefiere cortar después de un signo y nunca después de "de", "por", "y"…
const DEBIL = /^(de|del|por|para|y|e|o|u|ni|en|a|al|con|sin|que|la|el|los|las|lo|un|una|unos|unas|su|sus|mi|mis|tu|tus|se|me|te|le|les|nos|no|muy|más|tan|como|hasta|desde)$/i;
function rebalancear(groups) {
  for (let pasada = 0; pasada < 4; pasada++) { let cambio = false; // arreglar una huérfana puede crear otra antes ("Buenos / Aires.")
  for (let i = 1; i < groups.length; i++) {
    const A = groups[i - 1], B = groups[i];
    // también si la placa termina en una palabra débil ("…gente para su / viña.")
    if (/[.?!…]$/.test(A.at(-1).w) || !(txt(B).length <= 16 || B.length <= 2 || DEBIL.test(A.at(-1).w.replace(/[¿¡,;:]/g, '')))) continue;
    const W = [...A, ...B]; let best = null;
    for (let k = 1; k < W.length; k++) {
      const a = W.slice(0, k), b = W.slice(k), la = txt(a).length, lb = txt(b).length;
      if (la > MAXC || lb > MAXC) continue;
      const fin = a.at(-1).w, score = Math.abs(la - lb) - (/[.?!…]$/.test(fin) ? 40 : /[,;:]$/.test(fin) ? 25 : 0) + (DEBIL.test(fin.replace(/[¿¡]/g, '')) ? 30 : 0);
      if (!best || score < best.score) best = { k, score };
    }
    if (best && best.k !== A.length) { groups[i - 1] = W.slice(0, best.k); groups[i] = W.slice(best.k); cambio = true; }
  }
  if (!cambio) break; }
  return groups;
}
for (const c of cues) {
  let chunk = [], groups = [];
  const flush = () => { if (chunk.length) groups.push(chunk); chunk = []; };
  const short = c.words.map(x => x.w).join(' ').length <= 28; // frase corta (ej. «Esta vez no.»): una sola placa aunque haya pausa
  c.words.forEach(w => {
    const prev = chunk.at(-1), len = chunk.map(x => x.w).join(' ').length;
    if (prev && !short) {
      const gap = w.s - prev.e;
      // corta en fin de frase (también si la placa ya es larga), en coma si pasa de 34 caracteres, en pausas y por largo
      if ((/[.?!…]$/.test(prev.w) && (gap > 0.3 || len > 24)) || (/[,:;]$/.test(prev.w) && len > 34) || gap > 0.5 || len + w.w.length + 1 > MAXC) flush();
    }
    chunk.push(w);
  });
  flush();
  rebalancear(groups).forEach((g, gi, all) => {
    const last = gi === all.length - 1;
    subs.push({ who: c.who, t0: g[0].s - 0.03, t1: g.at(-1).e + (last ? 0.42 : 0.32), text: g.map(w => (/^[A-ZÁÉÍÓÚÑÜ]{2,}[.,!?…]*$/.test(w.w) ? w.w.toLowerCase() : w.w)).join(' ') });
  });
}
subs[0].t0 = 0;
for (let i = 0; i < subs.length; i++) {
  if (subs[i + 1]) subs[i].t1 = Math.min(subs[i].t1, subs[i + 1].t0 - 0.03);
  if (subs[i].t1 - subs[i].t0 < 0.7) subs[i].t1 = subs[i].t0 + 0.7;
  if (subs[i + 1] && subs[i].t1 > subs[i + 1].t0 - 0.03) subs[i + 1].t0 = subs[i].t1 + 0.03;
}
subs.at(-1).t1 = Math.min(subs.at(-1).t1, TOTAL);

// T10: boca = RMS con ataque 30 ms / caida 90 ms; "wide" = proporcion de agudos (>3 kHz) para sibilantes
function attackRelease(x, atk = 0.03, rel = 0.09) {
  const a = Math.exp(-1 / (EFPS * atk)), r = Math.exp(-1 / (EFPS * rel)); let y = 0;
  return x.map(v => { const k = v > y ? a : r; y = k * y + (1 - k) * v; return +y.toFixed(3); });
}
function bandRms(file, af) {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-af', af, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  const x = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4), n = Math.ceil(TOTAL * EFPS), out = new Array(n).fill(0), w = Math.floor(0.03 * SR);
  for (let k = 0; k < n; k++) { const c0 = Math.floor(k / EFPS * SR); let acc = 0; for (let i = c0 - (w >> 1); i < c0 + (w >> 1); i++) { const v = x[i] || 0; acc += v * v; } out[k] = Math.sqrt(acc / w); }
  return out;
}
const mouth = {};
for (const s of speakers) {
  const f = path.join(DIR, 'frames', `bus_${s}.wav`);
  const lo = bandRms(f, 'lowpass=f=900'), hi = bandRms(f, 'highpass=f=3000');
  mouth[s] = { open: attackRelease(env[s]), wide: attackRelease(hi.map((h, i) => Math.min(1, 1.6 * h / (h + lo[i] + 1e-6))), 0.02, 0.06) };
}

// efectos del guion: "after" = fin de la linea + offset; "at"+"word" = inicio de esa palabra + offset
const sfx = (script.sfx || []).map(x => {
  const c = cues.find(c => c.id === (x.after || x.at));
  let t = x.after ? c.end + (x.offset ?? 0) : (x.word ? (c.words.find(w => w.w.toLowerCase().startsWith(x.word)) || c.words[0]).s : c.at) + (x.offset ?? 0);
  return { id: x.id, t: +Math.max(0, t).toFixed(3), file: `sfx/${x.id}.mp3`, gain: x.gain ?? 0.5 };
});

const film = { title: script.title, total: TOTAL, efps: EFPS, speakers, mouth, sfx,
  cues: cues.map(({ pcm, ...c }) => c), subs: subs.map(s => ({ ...s, t0: +s.t0.toFixed(3), t1: +s.t1.toFixed(3) })), env };
fs.writeFileSync(path.join(DIR, 'film.json'), JSON.stringify(film));
console.log('TOTAL', TOTAL);
for (const c of film.cues) console.log(c.id.padEnd(4), c.who.padEnd(7), c.at.toFixed(2), '->', c.end.toFixed(2), '|', c.words.map(w => `${w.w}@${w.s.toFixed(2)}`).join(' '));
for (const s of film.subs) console.log('sub', s.t0.toFixed(2), s.t1.toFixed(2), s.text);
