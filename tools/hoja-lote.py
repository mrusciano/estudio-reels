# Hoja comparativa de un lote: 4 cuadros por video (inicio, 1/3, 2/3, final) en filas, con titulo y duracion.
# Uso: python -I tools/hoja-lote.py <carpeta_del_lote> [salida.jpg]
import subprocess, sys, json, io
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

lote = Path(sys.argv[1]); out = Path(sys.argv[2]) if len(sys.argv) > 2 else lote / '0-comparacion.jpg'
vids = sorted(p for p in lote.glob('*.mp4'))
TW, TH = 216, 384
font = None
for f in ('C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/arialbd.ttf'):
    if Path(f).exists(): font = ImageFont.truetype(f, 22); small = ImageFont.truetype(f.replace('b.ttf', '.ttf') if Path(f.replace('b.ttf', '.ttf')).exists() else f, 18); break
if font is None: font = small = ImageFont.load_default()
rows = []
for v in vids:
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(v)], capture_output=True, text=True).stdout.strip() or 0)
    frames = []
    for k in (0.04, 0.34, 0.66, 0.97):
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{dur * k:.2f}', '-i', str(v), '-frames:v', '1', '-vf', f'scale={TW}:{TH}', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True).stdout
        frames.append(Image.open(io.BytesIO(raw)).convert('RGB') if raw else Image.new('RGB', (TW, TH)))
    rows.append((v.stem, dur, frames))
W = 300 + 4 * (TW + 8); H = len(rows) * (TH + 12) + 12
sheet = Image.new('RGB', (W, H), '#14161c'); d = ImageDraw.Draw(sheet)
for i, (name, dur, frames) in enumerate(rows):
    y = 12 + i * (TH + 12)
    words, lines, cur = name.replace('-', ' ').split(), [], ''
    for w in words:
        if len(cur) + len(w) + 1 > 20 and cur: lines.append(cur); cur = w
        else: cur = (cur + ' ' + w).strip()
    lines.append(cur)
    y0 = y + TH / 2 - 16 * len(lines) - 12
    for k, ln in enumerate(lines): d.text((16, y0 + k * 28), ln, fill='#f2ede4', font=font)
    d.text((16, y0 + len(lines) * 28 + 6), f'{dur:.0f} s', fill='#9aa3b5', font=small)
    for j, f in enumerate(frames): sheet.paste(f, (300 + j * (TW + 8), y))
sheet.save(out, quality=88); print('ok', out, len(rows), 'videos')
