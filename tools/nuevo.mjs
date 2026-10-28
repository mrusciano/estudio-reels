// Crea un episodio nuevo a partir de otro (por defecto el demo): copia scene.js y deja un script.json esqueleto.
// Uso: node tools/nuevo.mjs <id-del-episodio> [--desde demo]
import fs from 'node:fs';
import path from 'node:path';
import { perfil } from './_comun.mjs';

const args = process.argv.slice(2), di = args.indexOf('--desde'), FROM = di >= 0 ? args.splice(di, 2)[1] : 'demo';
const id = args[0];
if (!id || !/^[a-z0-9-]+$/.test(id)) { console.error('Uso: node tools/nuevo.mjs <id-en-minusculas-con-guiones> [--desde demo]'); process.exit(1); }
const dst = path.join('episodes', id), src = path.join('episodes', FROM);
if (fs.existsSync(dst)) { console.error(`Ya existe ${dst}`); process.exit(1); }
fs.mkdirSync(dst, { recursive: true });
fs.copyFileSync(path.join(src, 'scene.js'), path.join(dst, 'scene.js'));
const base = JSON.parse(fs.readFileSync(path.join(src, 'script.json'), 'utf8')), P = perfil();
const script = {
  title: id, model: base.model, language: P.idioma || base.language, stability: base.stability, tempo: 1.0, timing: 'take',
  perfil: P.perfilGuion || 'tierno', set: base.set, music: base.music, tail: 2.4, minShot: 1.2,
  ficha: { valor: '', quienAma: '', quienCalcula: '', algoChicoConNombre: '', decision: '', objecion: '', nucleo: '', button: '', coda: '' },
  voices: P.voces || base.voices,
  lines: [{ id: 'l1', who: Object.keys(P.voces || base.voices)[0], tags: '[curious]', text: 'Primera línea.' }],
};
fs.writeFileSync(path.join(dst, 'script.json'), JSON.stringify(script, null, 2) + '\n');
console.log(`ok ${dst} (scene.js copiada de ${FROM}; completá script.json y adaptá la escena)`);
