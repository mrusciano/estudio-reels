// Rehace UNA linea por TTS v4 con continuidad (previous_text/next_text) y la deja como override.
// Uso: node tools/redo-line.mjs <episodio> <lineId> [--tags "[slowly]"] [--text "otro texto"] [--seed 5]
import fs from 'node:fs';
import path from 'node:path';
import { apiKey, perfil } from './_comun.mjs';
import { execFileSync } from 'node:child_process';
const [ep, id] = process.argv.slice(2);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = path.resolve('episodes', ep), VO = path.join(DIR, 'voices');
const script = JSON.parse(fs.readFileSync(path.join(DIR, 'script.json'), 'utf8'));
const KEY = apiKey();
const i = script.lines.findIndex(l => l.id === id), l = script.lines[i];
const tags = arg('--tags', l.tags || ''), text = arg('--text', l.text);
const body = {
  text: [tags, text].filter(Boolean).join(' '), model_id: script.model || 'eleven_v4', language_code: script.language || 'es',
  seed: +arg('--seed', 7), voice_settings: { stability: +arg('--stability', script.stability ?? 0.45), similarity_boost: 0.75 },
  previous_text: script.lines.slice(Math.max(0, i - 3), i).map(x => x.text).join(' '),
  next_text: script.lines.slice(i + 1, i + 3).map(x => x.text).join(' '),
};
const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${script.voices[l.who].id}/with-timestamps?output_format=mp3_44100_128`, {
  method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const j = await r.json();
if (!j.audio_base64) { console.log('ERROR', JSON.stringify(j).slice(0, 300)); process.exit(1); }
const raw = path.join(VO, `${id}.redo.mp3`);
fs.writeFileSync(raw, Buffer.from(j.audio_base64, 'base64'));
// recorte a la voz (sin tags) usando la alineacion de TTS
const al = j.alignment, chars = al.characters;
let k0 = 0, depth = 0; for (; k0 < chars.length; k0++) { if (chars[k0] === '[') depth++; else if (chars[k0] === ']') depth--; else if (!depth && /\S/.test(chars[k0])) break; }
const a = Math.max(0, al.character_start_times_seconds[k0] - 0.06), b = al.character_end_times_seconds.at(-1) + 0.15;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', a.toFixed(3), '-to', b.toFixed(3), '-i', raw, '-c:a', 'libmp3lame', '-q:a', '2', path.join(VO, `${id}.mp3`)]);
const keep = []; depth = 0;
chars.forEach((ch, k) => { if (ch === '[') depth++; else if (ch === ']') depth--; else if (!depth && k >= k0) keep.push(k); });
fs.writeFileSync(path.join(VO, `${id}.json`), JSON.stringify({ text, redo: true, alignment: {
  characters: keep.map(k => chars[k]), character_start_times_seconds: keep.map(k => +(al.character_start_times_seconds[k] - a).toFixed(3)),
  character_end_times_seconds: keep.map(k => +(al.character_end_times_seconds[k] - a).toFixed(3)) } }));
const words = text.split(/\s+/).length, dur = b - a;
console.log(`${id} rehecha: ${dur.toFixed(2)} s, ${(words / dur).toFixed(2)} pal/s (${r.headers.get('character-cost') || '?'} creditos)`);
