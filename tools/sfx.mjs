// Genera los efectos del guion con /v1/sound-generation (cacheados en episodes/<ep>/sfx/).
// Uso: node tools/sfx.mjs <episodio>
import fs from 'node:fs';
import path from 'node:path';
import { apiKey, perfil } from './_comun.mjs';
const ep = process.argv[2], DIR = path.resolve('episodes', ep);
const script = JSON.parse(fs.readFileSync(path.join(DIR, 'script.json'), 'utf8'));
const KEY = apiKey();
fs.mkdirSync(path.join(DIR, 'sfx'), { recursive: true });
for (const x of script.sfx || []) {
  const f = path.join(DIR, 'sfx', `${x.id}.mp3`);
  if (fs.existsSync(f)) { console.log(x.id, 'cache'); continue; }
  const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', { method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text: x.prompt, duration_seconds: x.duration, prompt_influence: x.influence ?? 0.5 }) });
  if (!r.ok) { console.log(x.id, 'ERROR', r.status, (await r.text()).slice(0, 200)); continue; }
  fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  console.log(x.id, 'ok', r.headers.get('character-cost') ? `(${r.headers.get('character-cost')} creditos)` : '');
}
