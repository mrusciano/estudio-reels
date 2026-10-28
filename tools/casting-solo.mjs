// Muestras SOLO de un personaje (sus propias lineas) con varias voces candidatas, para que el usuario elija escuchando.
// Uso: node tools/casting-solo.mjs <outDir> "<texto con tags>" Nombre:voiceId [Nombre:voiceId ...] [--lang es]
import fs from 'node:fs';
import path from 'node:path';
import { apiKey, perfil } from './_comun.mjs';
const args = process.argv.slice(2), li = args.indexOf('--lang'), LANG = li >= 0 ? args.splice(li, 2)[1] : (perfil().idioma || 'es');
const [outDir, text, ...cands] = args;
const KEY = apiKey();
fs.mkdirSync(outDir, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function one(c) {
  const [name, id] = c.split(':');
  for (let k = 0; k < 6; k++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_v4', language_code: LANG, seed: 7, voice_settings: { stability: 0.45, similarity_boost: 0.75 } }) });
    if (r.status === 429) { await sleep(2500 * (k + 1)); continue; }
    if (!r.ok) { console.log(name, 'ERROR', r.status, (await r.text()).slice(0, 200)); return; }
    fs.writeFileSync(path.join(outDir, `${name}.mp3`), Buffer.from(await r.arrayBuffer())); console.log('ok', name, r.headers.get('character-cost') || ''); return;
  }
}
let i = 0; await Promise.all([0, 1].map(async () => { while (i < cands.length) await one(cands[i++]); }));
