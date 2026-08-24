"""Assembla i 3 tutorial in UN UNICO video, sincronizzando narrazione e immagini:
dove l'audio è più lungo della finestra registrata il segmento video viene RALLENTATO
(setpts) in modo fluido, così ciò che si vede resta allineato a ciò che si dice.
Uso: python assemble_single.py <out.mp4>"""
import json, subprocess, sys, glob, os
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
AUDIO = '/app/manual/video/audio'
LEAD = 0.4   # attesa prima dell'inizio audio di ogni scena
TAIL = 0.7   # respiro dopo la fine dell'audio

out = sys.argv[1]
dur = json.load(open(f'{AUDIO}/durations.json'))

RECS = [
    ('rec1', [(20, 40, 400, 125, 0, 18.6)]),  # blur nome header dashboard
    ('rec2', []),
    ('rec4', []),  # fascia oraria preferita + Agg. Massivo
    ('rec3', []),
    ('rec5', []),  # operazioni live: Ordine / Ripasso / Tappa / Pausa Pranzo
]

inputs = []
fc = []
seg_labels = []      # etichette video in ordine finale
audio_offsets = []   # (scene, offset nel timeline finale)
global_base = 0.0

for rec_idx, (rec, blurs) in enumerate(RECS):
    rd = f'/app/manual/video/{rec}'
    marks = json.load(open(f'{rd}/marks.json'))
    webm = glob.glob(f'{rd}/*.webm')[0]
    inputs.append(webm)
    end_t = [m for m in marks if m['scene'] == 'end'][0]['t']

    bounds = [0.0]
    for m in marks:
        t = m['t']
        if t - bounds[-1] >= 0.05 and t <= end_t:
            bounds.append(t)
    if end_t - bounds[-1] >= 0.05:
        bounds.append(end_t)

    scene_at = {}
    for m in marks:
        k = m['scene']
        if k.startswith('v') and os.path.exists(f'{AUDIO}/{k}.mp3'):
            b = min(bounds, key=lambda x: abs(x - m['t']))
            scene_at[b] = k

    # blur sul timeline originale, prima dei trim
    src = f'{rec_idx}:v'
    if blurs:
        n = len(blurs)
        fc.append(f'[{rec_idx}:v]split={n + 1}' + ''.join(f'[r{rec_idx}b{i}]' for i in range(n + 1)))
        base = f'r{rec_idx}b0'
        for i, (x, y, w, h, t1, t2) in enumerate(blurs):
            fc.append(f'[r{rec_idx}b{i + 1}]crop={int(w)}:{int(h)}:{int(x)}:{int(y)},boxblur=luma_radius=22:luma_power=2:chroma_radius=11:chroma_power=2[r{rec_idx}bl{i}]')
            fc.append(f"[{base}][r{rec_idx}bl{i}]overlay={int(x)}:{int(y)}:enable='between(t,{t1},{t2})'[r{rec_idx}ov{i}]")
            base = f'r{rec_idx}ov{i}'
        src = base

    segs = []
    for i in range(len(bounds) - 1):
        a, b = bounds[i], bounds[i + 1]
        factor = 1.0
        scene = scene_at.get(a)
        if scene:
            need = LEAD + dur[scene] + TAIL
            window = b - a
            if need > window:
                factor = round(need / window, 4)
        segs.append((a, b, factor, scene))

    fc.append(f'[{src}]split={len(segs)}' + ''.join(f'[r{rec_idx}s{j}]' for j in range(len(segs))))
    cursor = global_base
    for j, (a, b, factor, scene) in enumerate(segs):
        lbl = f'r{rec_idx}v{j}'
        f = f'[r{rec_idx}s{j}]trim=start={a}:end={b},setpts=PTS-STARTPTS'
        if factor > 1.0:
            f += f',setpts={factor}*PTS'
        fc.append(f + f'[{lbl}]')
        seg_labels.append(f'[{lbl}]')
        if scene:
            audio_offsets.append((scene, cursor + LEAD))
            print(f'{scene}: finestra {b - a:.1f}s, audio {dur[scene]}s -> rallenta x{factor}')
        cursor += (b - a) * factor
    global_base = cursor

total = global_base
print(f'Durata totale unico video: {total:.1f}s ({int(total // 60)}:{int(total % 60):02d})')

cmd_inputs = []
for w in inputs:
    cmd_inputs += ['-i', w]
for k, _ in audio_offsets:
    cmd_inputs += ['-i', f'{AUDIO}/{k}.mp3']

fc.append(''.join(seg_labels) + f'concat=n={len(seg_labels)}:v=1:a=0[vcat]')

alabels = []
for idx, (k, off) in enumerate(audio_offsets):
    d = int(off * 1000)
    fc.append(f'[{len(inputs) + idx}:a]adelay={d}|{d}[a{idx}]')
    alabels.append(f'[a{idx}]')
fc.append(''.join(alabels) + f'amix=inputs={len(alabels)}:duration=longest:normalize=0,apad[aout]')

cmd = [FF, '-y'] + cmd_inputs + [
    '-filter_complex', ';'.join(fc),
    '-map', '[vcat]', '-map', '[aout]',
    '-t', str(round(total, 2)),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '25',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    out,
]
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode != 0:
    print(r.stderr[-3000:])
    sys.exit(1)
print('OK:', out, os.path.getsize(out) // 1024, 'KB')
