// Chequeo de instalacion: dice que falta y como instalarlo. Uso: npm run check
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const res = [];
const ok = (name, good, hint) => res.push({ name, good, hint });
const run = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); return r.status === 0 ? (r.stdout || r.stderr || '').trim() : null; };

const [maj] = process.versions.node.split('.').map(Number);
ok(`Node ${process.versions.node}`, maj >= 20, 'Instalá Node 20 o más nuevo: https://nodejs.org');
ok('Dependencias (npm install)', fs.existsSync('node_modules/three') && fs.existsSync('node_modules/puppeteer-core'), 'Corré: npm install');
const ff = run('ffmpeg', ['-version']);
ok(`ffmpeg ${ff ? ff.split(' ')[2] : ''}`, !!ff, 'Instalá ffmpeg y que quede en el PATH (Windows: winget install Gyan.FFmpeg · Mac: brew install ffmpeg · Linux: apt install ffmpeg)');
if (ff) {
  const enc = run('ffmpeg', ['-hide_banner', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=256x256:d=0.2', '-c:v', 'h264_nvenc', '-f', 'null', '-']) !== null;
  ok(enc ? 'Encoder de video por GPU (NVENC)' : 'Encoder de video por CPU (x264): anda, pero más lento', true, '');
}
const py = ['python', 'python3', 'py'].find(p => run(p, ['-c', 'print(1)']) === '1');
ok(`Python (${py || 'no encontrado'})`, !!py, 'Instalá Python 3.10+: https://python.org');
if (py) {
  const mods = run(py, ['-c', 'import numpy, scipy, PIL; print("ok")']);
  ok('numpy + scipy + pillow', mods === 'ok', `Corré: ${py} -m pip install -r requirements.txt`);
  if (py !== 'python') ok(`Ojo: tu Python se llama "${py}"`, true, `en los comandos de la guía usá "${py}" en vez de "python"`);
}
const chrome = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'), 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(p => p && fs.existsSync(p));
ok(`Chrome (${chrome || 'no encontrado'})`, !!chrome, 'Instalá Google Chrome, o definí CHROME_PATH con la ruta a Chrome/Edge/Chromium');
const key = process.env.ELEVENLABS_API_KEY || (fs.existsSync('.env') && /ELEVENLABS_API_KEY=\S+/.test(fs.readFileSync('.env', 'utf8')));
ok('API key de ElevenLabs (.env)', !!key, 'Copiá .env.example como .env y pegá tu key (solo hace falta para generar voces nuevas; el demo ya trae las suyas)');
ok('Perfil del estudio (perfil/estudio.md)', fs.existsSync('perfil/estudio.md'), 'Abrí Claude Code en esta carpeta y escribí /configurar');

for (const r of res) console.log(`${r.good ? '✔' : '✘'} ${r.name}${r.good ? '' : `\n    → ${r.hint}`}`);
const bad = res.filter(r => !r.good && !/key|Perfil/.test(r.name));
console.log(bad.length ? `\nFaltan ${bad.length} cosas para renderizar.` : '\nListo para renderizar. Probá: npm run demo  (sale en episodes/demo/out/demo.mp4)');
process.exitCode = bad.length ? 1 : 0;
