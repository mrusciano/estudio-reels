# Mezcla final: voces (cadena + reverb), musica sintetizada, ambiente nocturno, efectos y loudnorm -14 LUFS.
# Uso: python -I tools/mix.py <episodio>   (necesita frames/video.mp4, frames/bus_*.wav, film.json, sfx.json)
import json, subprocess, sys
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

EP = Path('episodes') / sys.argv[1]
FR = EP / 'frames'
SR = 44100
film = json.loads((EP / 'film.json').read_text(encoding='utf-8'))
sfx = json.loads((EP / 'sfx.json').read_text(encoding='utf-8')) if (EP / 'sfx.json').exists() else []
script = json.loads((EP / 'script.json').read_text(encoding='utf-8'))
# ambiente sonoro: 'piedra' (interior rustico de noche: grillos, fuego) | 'casa-dia' (interior de dia, pajaros) | 'pieza' (cuarto actual de noche,
# ciudad lejana, pajaros al amanecer) | 'lago' (orilla: olas, brisa) | 'campo' (exterior abierto) | 'colonial' (pueblo tranquilo)
SET = script.get('set', 'pieza')
if SET == 'betania': SET = 'casa-dia'
MUS = script.get('music')  # 'piano' (tierno, Fa mayor) | 'oud' (laud, color de Medio Oriente) | 'ninguna'; por defecto sale del set(ej. Marta v2: casa de retiro actual en la casa de piedra)
OUD = MUS == 'oud' if MUS else SET in ('piedra', 'casa-dia'); PIANO = MUS == 'piano' if MUS else SET in ('pieza', 'lago', 'campo', 'colonial')
cue_at = {c['id']: c['at'] for c in film['cues']}
TOTAL = film['total']
N = int(TOTAL * SR) + 1
t = np.arange(N) / SR
rng = np.random.default_rng(7)

def lp(x, f, o=2): return sosfilt(butter(o, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'highpass', fs=SR, output='sos'), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def db(x): return 10 ** (x / 20)
def place(buf, start, sig, gain=1.0):
    i = int(start * SR)
    if i >= len(buf) or i + len(sig) <= 0: return
    a, b = max(0, i), min(len(buf), i + len(sig))
    buf[a:b] += sig[a - i:b - i] * gain

# ---------- voces ----------
def chain(src):
    out = FR / (src.stem + '_fx.wav')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(src), '-af',
                    'highpass=f=85,lowpass=f=10500,acompressor=threshold=0.05:ratio=2.6:attack=8:release=140:makeup=2',
                    '-ar', str(SR), '-ac', '1', '-c:a', 'pcm_f32le', str(out)], check=True)
    sr, x = wavfile.read(out); x = x.astype(np.float64)
    return np.pad(x, (0, max(0, N - len(x))))[:N]
# respuesta al impulso de una habitacion de piedra chica (ruido con caida exponencial + primeras reflexiones)
ir_t = np.arange(int(0.9 * SR)) / SR
ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t / (0.22 if SET == 'piedra' else 0.09))
ir = lp(ir, 5200)
for d, g in ((0.013, 0.5), (0.021, 0.35), (0.034, 0.25)): ir[int(d * SR)] += g * 8
ir /= np.sqrt((ir ** 2).sum())
L = np.zeros(N); R = np.zeros(N)
voice_sum = np.zeros(N)
# paneo y reverb por personaje: script.voices[who].pan (-1..1, def. alterna levemente) y .reverb (def. 1)
PROT = script.get('protegido')
pans = {w: ((1 - v.get('pan', 0)) / 2, (1 + v.get('pan', 0)) / 2) for w, v in script['voices'].items() if 'pan' in v}
for i, w in enumerate(film['speakers']): pans.setdefault(w, (0.53, 0.47) if i % 2 == 0 else (0.47, 0.53))
for who in film['speakers']:
    v = chain(FR / f'bus_{who}.wav')
    wet = fftconvolve(v, ir)[:N] * ((0.16 if who == PROT else 0.11) if SET == 'piedra' else (0.12 if who == PROT else 0.08)) * script['voices'].get(who, {}).get('reverb', 1)
    pl, pr = pans.get(who, (0.5, 0.5))
    L += v * pl * 2 + wet * 0.9; R += v * pr * 2 + wet * 1.1
    voice_sum += np.abs(v)

# mascara de habla para el ducking (ataque rapido, liberacion lenta)
mask = np.zeros(N)
for c in film['cues']: mask[int(c['at'] * SR):int(c['end'] * SR)] = 1
k_att, k_rel = 1 - np.exp(-1 / (0.05 * SR)), 1 - np.exp(-1 / (0.45 * SR))
env = np.zeros(N); e = 0.0
step = 64
for i in range(0, N, step):
    m = mask[i]; k = k_att if m > e else k_rel
    e += (m - e) * (1 - (1 - k) ** step); env[i:i + step] = e
duck = db(-8 * env)

# ---------- musica: pad en Re dorico + laud punteado ----------
def tri(f, ph=0): return 2 * np.abs(2 * ((t * f + ph) % 1) - 1) - 1
chords = [(146.83, 174.61, 220.0), (116.54, 146.83, 174.61), (130.81, 164.81, 196.0), (146.83, 174.61, 220.0)]
seg = TOTAL / len(chords)
def win(a, b):  # slice de muestras [a, b) en segundos, acotado
    return slice(max(0, int(a * SR)), min(N, int(b * SR)))
def triw(f, sl, ph=0):  # tri solo sobre la ventana sl
    tt = t[sl]; return 2 * np.abs(2 * ((tt * f + ph) % 1) - 1) - 1
pad = np.zeros(N)
if OUD:
    for ci, ch in enumerate(chords):
        sl = win(ci * seg - 0.8, (ci + 1) * seg + 0.8); tt = t[sl]
        w = np.clip((tt - ci * seg + 0.8) / 1.6, 0, 1) * np.clip(((ci + 1) * seg + 0.8 - tt) / 1.6, 0, 1)
        for f in ch:
            for det in (-0.35, 0.35): pad[sl] += triw(f + det, sl, rng.random()) * w
    pad += np.sin(2 * np.pi * 73.42 * t) * 1.6 * np.clip(t / 2, 0, 1)
    pad = lp(pad, 900) * (1 + 0.06 * np.sin(2 * np.pi * 0.2 * t))
def pluck(f, dur=1.6):
    n = int(dur * SR); p = int(SR / f); buf = rng.uniform(-1, 1, p); out = np.zeros(n)
    for i in range(n): out[i] = buf[i % p]; buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    return lp(out, 3500) * np.exp(-np.arange(n) / SR / 0.7)
scale = [293.66, 311.13, 369.99, 392.0, 440.0, 466.16, 523.25]  # Re frigio dominante: color de Medio Oriente
motif = [0, 2, 4, 3, 2, 1, 0, 4]
beat = 60 / 76
oud = np.zeros(N)
for i, b in enumerate(np.arange(0.4, TOTAL - 1.2, beat * 2) if OUD else []):
    place(oud, b, pluck(scale[motif[i % len(motif)]] / (2 if i % 3 == 2 else 1)), 0.5)
music = pad * 0.011 + oud * 0.028
if PIANO:
    # piano tierno en Fa mayor (en el lago, una tercera abajo: Re mayor) (I-vi-IV-V) con arpegios lentos + pad tibio; sube un poco hacia el amanecer
    def piano(f, dur=2.6):
        n = int(dur * SR); x = np.arange(n) / SR
        tone = sum(np.sin(2 * np.pi * f * h * x) * a * np.exp(-x / (0.9 / h ** 0.5)) for h, a in ((1, 1), (2, 0.42), (3, 0.18), (4, 0.08)))
        return lp(tone * np.minimum(1, x / 0.004), 4200)
    kf = 0.8409 if SET == 'lago' else 1.0
    prog = [tuple(f * kf for f in ch) for ch in [(174.61, 220.0, 261.63), (146.83, 174.61, 220.0), (116.54, 146.83, 174.61), (130.81, 164.81, 196.0)]]
    beat = 60 / 66; bar = beat * 4
    pno = np.zeros(N); pad2 = np.zeros(N)
    for bi, b0 in enumerate(np.arange(0.3, TOTAL, bar)):
        ch = prog[bi % 4]
        place(pno, b0, piano(ch[0] / 2, 3.5), 0.55)
        for k, f in enumerate((ch[0], ch[1], ch[2], ch[1] * 2)): place(pno, b0 + beat * k, piano(f), 0.32 if k < 3 else 0.2)
        sl = win(b0 - 0.6, b0 + bar + 0.6); tt = t[sl]
        w = np.clip((tt - b0 + 0.6) / 1.2, 0, 1) * np.clip((b0 + bar + 0.6 - tt) / 1.2, 0, 1)
        for f in ch: pad2[sl] += (triw(f, sl) + triw(f * 1.003, sl)) * w
    swell = 0.8 + 0.4 * np.clip((t - TOTAL * 0.45) / (TOTAL * 0.5), 0, 1)
    music = (pno * 0.03 + lp(pad2, 700) * 0.0045) * swell
clim = next((l for l in script['lines'] if l.get('climax') or l.get('visual')), None)
if clim and clim['id'] in cue_at:
    tc = cue_at[clim['id']] - 0.3
    music *= db(4.5 * np.clip((t - tc) / 1.5, 0, 1))
music *= np.clip(t / 1.2, 0, 1)
if MUS == 'ninguna': music *= 0

# ---------- ambiente: tono de habitacion, grillos, chisporroteo ----------
room = lp(rng.standard_normal(N), 180) * 0.007
crick = np.zeros(N)
for ci, (rate, f0, start) in enumerate([(0.82, 4300, 0.1), (1.07, 4700, 0.5), (0.65, 3900, 0.3)]):
    for c0 in np.arange(start, TOTAL, rate):
        for k in range(3):
            n = int(0.018 * SR); x = np.arange(n) / SR
            place(crick, c0 + k * 0.032, np.sin(2 * np.pi * f0 * x) * np.sin(np.pi * x / x[-1]), 0.0028 * (0.7 + 0.3 * ci))
crack = np.zeros(N)
for c0 in np.sort(rng.uniform(0, TOTAL, int(TOTAL * 2.2))):
    n = int(0.004 * SR); place(crack, c0, rng.standard_normal(n) * np.exp(-np.arange(n) / (0.0008 * SR)), 0.012)
crack = bp(crack, 1500, 7000)
amb = room + crick + crack
if SET == 'pieza':
    # ciudad lejana a la madrugada + pajaros que aparecen con el amanecer (sin grillos ni chisporroteo de aceite)
    hum = lp(rng.standard_normal(N), 120) * 0.006 + bp(rng.standard_normal(N), 300, 900) * 0.0012
    birds = np.zeros(N)
    for c0 in np.sort(rng.uniform(TOTAL * 0.55, TOTAL, int(TOTAL * 0.35))):
        n = int(0.09 * SR); x = np.arange(n) / SR; f0 = rng.uniform(2800, 4200)
        chirp = np.sin(2 * np.pi * np.cumsum(f0 + 1400 * np.sin(np.pi * x / x[-1])) / SR) * np.sin(np.pi * x / x[-1]) ** 2
        for k in range(int(rng.integers(1, 4))): place(birds, c0 + k * 0.13, chirp, 0.004 * np.clip((c0 - TOTAL * 0.55) / (TOTAL * 0.3), 0.2, 1))
    amb = room * 0.8 + hum + birds
def chirps(t0, t1, n, amp):
    out = np.zeros(N)
    for c0 in np.sort(rng.uniform(t0, t1, n)):
        k = int(0.09 * SR); x = np.arange(k) / SR; f0 = rng.uniform(2600, 4300)
        ch = np.sin(2 * np.pi * np.cumsum(f0 + 1300 * np.sin(np.pi * x / x[-1])) / SR) * np.sin(np.pi * x / x[-1]) ** 2
        for j in range(int(rng.integers(1, 4))): place(out, c0 + j * 0.12, ch, amp)
    return out
if SET == 'casa-dia':
    # interior de dia: tono de habitacion, pajaros afuera, sin grillos ni chisporroteo
    amb = room + lp(chirps(0, TOTAL, int(TOTAL * 0.5), 0.0035), 7000)
elif SET == 'lago':
    # orilla del lago: olas suaves (ruido filtrado con vaiven), brisa y pajaros
    w = lp(hp(rng.standard_normal(N), 150), 900); swell_w = 0.55 + 0.45 * np.sin(2 * np.pi * t / 5.5) ** 2
    wind = bp(rng.standard_normal(N), 300, 1800) * (0.5 + 0.5 * np.sin(2 * np.pi * t / 9 + 1) ** 2)
    amb = w * swell_w * 0.016 + wind * 0.0016 + room * 0.4 + chirps(0, TOTAL, int(TOTAL * 0.35), 0.003)
if SET == 'campo':
    # campo abierto (vina, pampa, camino): brisa con rafagas, pajaros, insectos lejanos; sin tono de habitacion
    wind = bp(rng.standard_normal(N), 200, 1400) * (0.45 + 0.55 * np.sin(2 * np.pi * t / 8 + 0.7) ** 2) * 0.006
    ins = bp(rng.standard_normal(N), 5200, 7800) * (0.5 + 0.5 * np.sin(2 * np.pi * 11 * t) ** 2) * 0.0012
    amb = wind + ins + lp(chirps(0, TOTAL, int(TOTAL * 0.4), 0.0032), 7000) + room * 0.25
elif SET == 'colonial':
    # pueblo colonial: viento suave, pajaros, algun perro lejano, sin ciudad
    amb = bp(rng.standard_normal(N), 250, 1200) * 0.003 + lp(chirps(0, TOTAL, int(TOTAL * 0.3), 0.003), 7000) + room * 0.4
if script.get('lluvia'):
    # lluvia afuera hasta el corte (si hay "card"), con goteras
    card = next((l for l in script['lines'] if l.get('card')), None)
    t_end = cue_at[card['id']] - 1.4 if card and card['id'] in cue_at else TOTAL + 1
    rain = lp(hp(rng.standard_normal(N), 500), 6500) * 0.012 * (0.85 + 0.15 * np.sin(2 * np.pi * t / 3.7))
    for c0 in rng.uniform(0, TOTAL, int(TOTAL * 3)):
        k = int(0.03 * SR); place(rain, c0, bp(rng.standard_normal(k), 1500, 5000) * np.exp(-np.arange(k) / (0.004 * SR)), 0.02)
    amb = amb + rain * np.clip((t_end - t) / 1.2, 0, 1)
# ventanas de ambiente (flashbacks / exteriores): script.amb = [{"from": id, "to": id, "type": "tormenta"|"campo"|"multitud", "gain": 1, "duck": 0.7}]
# dentro de la ventana el ambiente base y la musica bajan ("duck") y entra la capa propia
cue_end = {c['id']: c['end'] for c in film['cues']}
def rumble(dur=2.2):
    n = int(dur * SR); x = np.arange(n) / SR
    return lp(rng.standard_normal(n), 140) * (np.minimum(1, x / 0.05) * np.exp(-x / 0.7)) * 6
for a in script.get('amb', []):
    t0 = cue_at.get(a['from'], 0) - a.get('pre', 0.25); t1 = cue_end.get(a.get('to'), TOTAL + 1) + a.get('post', 0.5)
    wnd = np.clip((t - t0) / 0.3, 0, 1) * np.clip((t1 - t) / 0.45, 0, 1)
    g, typ = a.get('gain', 1.0), a['type']
    if typ == 'tormenta':  # lluvia fuerte + viento + olas + truenos sincronizados con los rayos de la escena (t % 3.7)
        layer = lp(hp(rng.standard_normal(N), 400), 7000) * 0.018 + bp(rng.standard_normal(N), 150, 900) * (0.5 + 0.5 * np.sin(2 * np.pi * t / 4.3) ** 2) * 0.03
        layer += lp(rng.standard_normal(N), 320) * (0.4 + 0.6 * np.sin(2 * np.pi * t / 2.8) ** 2) * 0.05
        for k in np.arange(0, TOTAL, 3.7):
            if t0 < k < t1: place(layer, k + 0.25, rumble(), 0.05)
    elif typ == 'campo':  # exterior abierto de dia: brisa + pajaros + insectos lejanos
        layer = bp(rng.standard_normal(N), 250, 1600) * (0.5 + 0.5 * np.sin(2 * np.pi * t / 7 + 1) ** 2) * 0.004 + chirps(t0, t1, int((t1 - t0) * 0.6), 0.004)
    elif typ == 'multitud':  # murmullo de multitud lejana 
        layer = sum(bp(rng.standard_normal(N), f, f * 1.8) * (0.6 + 0.4 * np.sin(2 * np.pi * t / (3 + i) + i) ** 2) for i, f in enumerate((180, 320, 560))) * 0.01
    else: continue
    amb = amb * (1 - a.get('duck', 0.7) * wnd) + layer * wnd * g
    music *= 1 - a.get('music_duck', 0.6) * wnd

# ---------- efectos ----------
def pop():
    n = int(0.11 * SR); x = np.arange(n) / SR; f = 260 + 620 * x / x[-1]
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.03)
def tick():
    n = int(0.06 * SR); x = np.arange(n) / SR
    return np.sin(2 * np.pi * 1900 * x) * np.exp(-x / 0.01)
def holo():
    n = int(0.9 * SR); x = np.arange(n) / SR
    sw = bp(rng.standard_normal(n), 1200, 7000) * np.sin(np.pi * x / x[-1]) ** 2
    sh = sum(np.sin(2 * np.pi * f * x) for f in (880, 1320, 1760)) * np.exp(-x / 0.4) * 0.15
    return sw * 0.5 + sh
def ding():
    n = int(1.6 * SR); x = np.arange(n) / SR
    return sum(np.sin(2 * np.pi * f * x) * np.exp(-x / d) for f, d in ((1046.5, 0.7), (1318.5, 0.5), (1568.0, 0.4))) * 0.35
def splash():  # zambullida: golpe de agua + burbujas
    n = int(1.2 * SR); x = np.arange(n) / SR
    hit = bp(rng.standard_normal(n), 250, 3500) * np.exp(-x / 0.12)
    bub = np.zeros(n)
    for c0 in rng.uniform(0.08, 0.9, 14):
        k = int(0.035 * SR); y = np.arange(k) / SR; f = rng.uniform(500, 1100)
        place_i = int(c0 * SR); seg2 = np.sin(2 * np.pi * np.cumsum(f + 900 * y / y[-1]) / SR) * np.exp(-y / 0.012)
        bub[place_i:place_i + k] += seg2[:max(0, min(k, n - place_i))] * 0.25
    return hit + bub
def buzz():  # vibracion de celular sobre la mesa: dos pulsos
    n = int(0.75 * SR); x = np.arange(n) / SR
    env2 = ((x % 0.38) < 0.22).astype(float) * (x < 0.62)
    return (np.sign(np.sin(2 * np.pi * 165 * x)) * 0.5 + np.sin(2 * np.pi * 330 * x) * 0.3) * lp(env2, 60) * 0.6
def whoosh():  # transicion suave para cortes de tiempo/lugar
    n = int(0.8 * SR); x = np.arange(n) / SR
    return bp(rng.standard_normal(n), 400, 4000) * np.sin(np.pi * x / x[-1]) ** 3
fx = np.zeros(N)
gen = {'pop': (pop, 0.22), 'tick': (tick, 0.05), 'holo': (holo, 0.12), 'ding': (ding, 0.12), 'splash': (splash, 0.5), 'whoosh': (whoosh, 0.1), 'buzz': (buzz, 0.12)}
for s in sfx:
    f, g = gen[s['type']]
    place(fx, s['t'], f(), g * s.get('gain', 1))
# efectos generados con ElevenLabs (film.sfx), en estereo-mono al bus de efectos
for s in film.get('sfx', []):
    src = EP / s['file']
    if not src.exists(): print('falta', src); continue
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(src), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    n = len(x); x = x * np.minimum(1, np.minimum(np.arange(n) / (0.02 * SR), (n - np.arange(n)) / (0.25 * SR)))
    place(fx, s['t'], x, s['gain'])

# ---------- suma ----------
bed = (music + amb) * duck
L += bed + fx * 0.95; R += bed * 0.97 + fx
fade = np.clip((TOTAL - t) / 0.08, 0, 1)
st = np.stack([L * fade, R * fade], axis=1).astype(np.float32)
wavfile.write(FR / 'mix.wav', SR, st)

# ---------- loudnorm en dos pasadas + mux ----------
TARGET = 'I=-14:TP=-1.5:LRA=9'
r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(FR / 'mix.wav'), '-af', f'loudnorm={TARGET}:print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
m = json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
af = (f"loudnorm={TARGET}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
      f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,alimiter=limit=0.84:level=disabled")
(EP / 'out').mkdir(exist_ok=True)
out = EP / 'out' / f"{EP.name}.mp4"
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(FR / 'video.mp4'), '-i', str(FR / 'mix.wav'), '-map', '0:v', '-map', '1:a',
                '-c:v', 'copy',
                '-af', af, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', str(out)], check=True)
print('ok', out)
