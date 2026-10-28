// Uso:
//   node tools/render.mjs <ep> stills 0.5 3 7.2 [--flags nodof,nobloom]   -> episodes/<ep>/stills/t_X.jpg + sheet.jpg
//   node tools/render.mjs <ep> video [--flags ...] [--workers N] [--frames A:B]
//        -> episodes/<ep>/frames/video.mp4 (sin sonido)
// Velocidad (usar la placa de video y la compu al maximo):
//   - N workers en paralelo, cada uno con su PROPIO Chrome (proceso de GPU propio => la RTX recibe trabajo en paralelo).
//     renderAt(t) es funcion pura del tiempo, asi que cada worker hace un tramo contiguo de cuadros.
//   - cada tramo se codifica con NVENC (encoder de la RTX) y los tramos se concatenan sin recodificar.
//   - N por defecto sale de la RAM libre (cada worker ~0.6 GB), con tope 3: medido 27/10/2026 en la RTX 4060,
//     1 worker 14 fps, 2 -> 29, 3 -> 31, 4 -> 20 (GPU al 97 %, se traba). --workers lo fuerza (en una GPU mas chica, probar 1-2).
// Chrome: CHROME_PATH o se busca solo (Windows, macOS, Linux). Encoder: NVENC (NVIDIA) > VideoToolbox (Mac) > x264 (CPU).
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve('.');
const [ep, mode, ...rest] = process.argv.slice(2);
const opt = name => { const i = rest.indexOf(name); return i >= 0 ? rest.splice(i, 2)[1] : null; };
const flags = opt('--flags') || '';
const workersOpt = opt('--workers');
const framesOpt = opt('--frames');
const DIR = path.join(ROOT, 'episodes', ep);
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'), 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(p => p && fs.existsSync(p));
if (!CHROME) { console.error('No encontre Chrome. Instalalo o defini CHROME_PATH con la ruta al ejecutable.'); process.exit(1); }
const GPU_ARGS = process.platform === 'win32' ? ['--use-angle=d3d11'] : process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-angle=vulkan', '--enable-features=Vulkan'];
const FPS = 30;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const URL_ = `http://127.0.0.1:${port}/film.html?ep=${ep}&flags=${flags}`;

const browsers = [];
async function openWorker(k, log = false) {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'reel-')),
    args: [...GPU_ARGS, '--enable-gpu', '--ignore-gpu-blocklist', '--force_high_performance_gpu', '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--mute-audio'],
    protocolTimeout: 600000,
  });
  browsers.push(browser);
  const page = await browser.newPage();
  page.on('console', m => { if (log || /error|plan/i.test(m.text())) console.log(`[w${k}]`, m.text()); });
  page.on('pageerror', e => console.log(`[w${k} error]`, e.message));
  await page.goto(URL_);
  await page.waitForFunction('window.__ready === true', { timeout: 120000 });
  const gpu = await page.evaluate('window.__gpu');
  if (/swiftshader|software|basic render|llvmpipe/i.test(gpu)) {
    if (!process.env.PERMITIR_CPU) { console.log('ABORTO: WebGL por software en worker', k, gpu, '(sin GPU el render es MUY lento; PERMITIR_CPU=1 para forzarlo)'); process.exit(2); }
    if (k === 0) console.log('AVISO: render por software (CPU):', gpu);
  }
  return { browser, page, gpu };
}
const cleanup = async () => { for (const b of browsers) await b.close().catch(() => {}); server.close(); };
process.on('SIGINT', async () => { await cleanup(); process.exit(130); });

// encoder: NVENC (NVIDIA) > VideoToolbox (Mac) > x264 (CPU)
function pickEncoder() {
  const ok = c => spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=256x256:d=0.2', '-c:v', c, '-f', 'null', '-']).status === 0;
  if (ok('h264_nvenc')) return { name: 'h264_nvenc (GPU NVIDIA)', args: ['-c:v', 'h264_nvenc', '-preset', 'p6', '-tune', 'hq', '-rc', 'vbr', '-cq', '16', '-b:v', '0', '-profile:v', 'high', '-pix_fmt', 'yuv420p'] };
  if (process.platform === 'darwin' && ok('h264_videotoolbox')) return { name: 'h264_videotoolbox (Mac)', args: ['-c:v', 'h264_videotoolbox', '-b:v', '20M', '-profile:v', 'high', '-pix_fmt', 'yuv420p'] };
  return { name: 'libx264 (CPU)', args: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p'] };
}

if (mode === 'stills') {
  const { page, gpu } = await openWorker(0, true);
  console.log('GPU:', gpu);
  const out = path.join(DIR, 'stills'); fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) fs.unlinkSync(path.join(out, f));
  const files = [];
  for (const t of rest.map(Number)) {
    const b64 = await page.evaluate(t => window.renderAt(t, 0.9), t);
    const f = path.join(out, `t_${t.toFixed(2).padStart(6, '0')}.jpg`); fs.writeFileSync(f, Buffer.from(b64, 'base64')); files.push(f);
  }
  const cols = Math.min(6, files.length);
  const inputs = files.flatMap(f => ['-i', f]);
  const fc = files.map((_, i) => `[${i}:v]scale=270:480,drawtext=text='${rest[i]}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.5[v${i}]`).join(';') + ';' +
    files.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${files.length}:fill=black:layout=` + files.map((_, i) => `${(i % cols) * 270}_${Math.floor(i / cols) * 480}`).join('|');
  if (files.length > 1) execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', fc, '-frames:v', '1', path.join(out, 'sheet.jpg')]);
  else fs.copyFileSync(files[0], path.join(out, 'sheet.jpg'));
  console.log('ok', path.join(out, 'sheet.jpg'));
} else if (mode === 'video') {
  const t0 = Date.now();
  const freeGB = os.freemem() / 2 ** 30;
  const W = Math.max(1, workersOpt ? +workersOpt : Math.min(3, Math.floor((freeGB - 1.0) / 0.6)));
  const enc = pickEncoder();
  console.log(`workers ${W} (RAM libre ${freeGB.toFixed(1)} GB) · encoder ${enc.name} · ${os.cpus().length} hilos de CPU`);
  const workers = await Promise.all(Array.from({ length: W }, (_, k) => openWorker(k)));
  console.log('GPU:', workers[0].gpu, `· listos en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const page0 = workers[0].page;
  const total = await page0.evaluate('window.TOTAL');
  fs.writeFileSync(path.join(DIR, 'sfx.json'), JSON.stringify(await page0.evaluate('window.__sfx || []')));
  let [f0, f1] = framesOpt ? framesOpt.split(':').map(Number) : [0, Math.round(total * FPS)];
  const n = f1 - f0, chunk = Math.ceil(n / W);
  const FR = path.join(DIR, 'frames'); fs.mkdirSync(FR, { recursive: true });
  let done = 0; const tr = Date.now();
  const tick = setInterval(() => console.log(`cuadro ${done}/${n}  ${((Date.now() - tr) / 1000).toFixed(0)} s  ${(done / ((Date.now() - tr) / 1000)).toFixed(1)} fps`), 10000);
  const segs = await Promise.all(workers.map(async ({ page }, k) => {
    const a = f0 + k * chunk, b = Math.min(f1, a + chunk); if (a >= b) return null;
    const seg = path.join(FR, `seg_${k}.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', ...enc.args, '-r', String(FPS), seg], { stdio: ['pipe', 'ignore', 'inherit'] });
    for (let i = a; i < b; i++) {
      const b64 = await page.evaluate(t => window.renderAt(t, 0.95), i / FPS);
      if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
      done++;
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    return seg;
  }));
  clearInterval(tick);
  const list = path.join(FR, 'segs.txt');
  fs.writeFileSync(list, segs.filter(Boolean).map(s => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
  const outFile = path.join(FR, 'video.mp4');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', outFile]);
  for (const s of segs.filter(Boolean)) fs.unlinkSync(s);
  const secs = (Date.now() - t0) / 1000;
  console.log('ok', outFile, `${secs.toFixed(0)}s`, `(${(n / ((Date.now() - tr) / 1000)).toFixed(1)} fps de render)`);
}
await cleanup();
