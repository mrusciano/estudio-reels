// QA rapida de una o varias lineas ya cortadas: transcribe voices/<id>.mp3 con Scribe y muestra lo oido + palabras/s.
// Uso: node tools/stt-line.mjs <episodio> <id> [<id> ...]
import fs from 'node:fs';
import path from 'node:path';
import { apiKey, perfil } from './_comun.mjs';
const [ep, ...ids] = process.argv.slice(2);
const LANG = JSON.parse(fs.readFileSync(path.join('episodes', ep, 'script.json'), 'utf8')).language || 'es';
const KEY = apiKey();
for (const id of ids) {
  const f = path.join('episodes', ep, 'voices', id + '.mp3');
  const fd = new FormData(); fd.append('model_id', 'scribe_v1'); fd.append('language_code', LANG);
  fd.append('file', new Blob([fs.readFileSync(f)]), id + '.mp3');
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': KEY }, body: fd });
  const j = await r.json(); const w = (j.words || []).filter(x => x.type === 'word');
  const dur = w.length ? w.at(-1).end - w[0].start : 0;
  console.log(id.padEnd(4), `${w.length ? (w.length / dur).toFixed(2) : '?'} pal/s |`, j.text ?? JSON.stringify(j).slice(0, 200));
}
