"""Assembla un video tutorial adattando il VIDEO al nuovo audio (voce Diego):
dove la narrazione è più lunga della finestra registrata, il segmento video viene
esteso con freeze-frame (tpad clone) così nessun audio si sovrappone.
Uso: python assemble_v2.py <rec_dir> <out.mp4> [--blur=x:y:w:h:t1:t2]  (t1/t2 nel timeline ORIGINALE)"""
import json, subprocess, sys, glob, os
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
AUDIO = '/app/manual/video/audio'
LEAD = 0.4   # attesa prima dell'inizio audio di ogni scena
TAIL = 0.6   # respiro dopo la fine dell'audio

rec_dir = sys.argv[1]
out = sys.argv[2]
blurs = []
for a in sys.argv[3:]:
    if a.startswith('--blur'):
        parts = a.split('=', 1)[1].split(':')
        blurs.append(tuple(float(x) for x in parts))  # x,y,w,h,t1,t2

marks = json.load(open(f'{rec_dir}/marks.json'))
dur = json.load(open(f'{AUDIO}/durations.json'))
webm = glob.glob(f'{rec_dir}/*.webm')[0]
end_t = [m for m in marks if m['scene'] == 'end'][0]['t']

# ── boundaries: 0 + tutti i marks + end (dedupe < 0.05s) ──
bounds = [0.0]
for m in marks:
    t = m['t']
    if t - bounds[-1] >= 0.05 and t <= end_t:
        bounds.append(t)
if end_t - bounds[-1] >= 0.05:
    bounds.append(end_t)

# scena audio che inizia a ogni boundary
scene_at = {}
for m in marks:
    k = m['scene']
    if k.startswith('v') and os.path.exists(f'{AUDIO}/{k}.mp3'):
        # aggancia al boundary più vicino
        b = min(bounds, key=lambda x: abs(x - m['t']))
        scene_at[b] = k

# ── pad per segmento + offset audio nel nuovo timeline ──
segs = []           # (start, end, pad)
audio_offsets = []  # (scene, new_offset)
cum = 0.0
for i in range(len(bounds) - 1):
    a, b = bounds[i], bounds[i + 1]
    pad = 0.0
    if a in scene_at:
        k = scene_at[a]
        need = LEAD + dur[k] + TAIL
        window = b - a
        pad = max(0.0, round(need - window, 2))
        audio_offsets.append((k, a + cum + LEAD))
        print(f'{k}: finestra {window:.1f}s, audio {dur[k]}s -> freeze +{pad:.1f}s')
    segs.append((a, b, pad))
    cum += pad
final_end = end_t + cum
print(f'Durata finale: {final_end:.1f}s (+{cum:.1f}s freeze)')

inputs = ['-i', webm]
for k, _ in audio_offsets:
    inputs += ['-i', f'{AUDIO}/{k}.mp3']

fc = []
# blur (timeline originale, prima dei trim)
src = '0:v'
if blurs:
    n = len(blurs)
    fc.append(f'[0:v]split={n + 1}' + ''.join(f'[b{i}]' for i in range(n + 1)))
    base = 'b0'
    for i, (x, y, w, h, t1, t2) in enumerate(blurs):
        fc.append(f'[b{i + 1}]crop={int(w)}:{int(h)}:{int(x)}:{int(y)},boxblur=luma_radius=22:luma_power=2:chroma_radius=11:chroma_power=2[bl{i}]')
        fc.append(f"[{base}][bl{i}]overlay={int(x)}:{int(y)}:enable='between(t,{t1},{t2})'[ov{i}]")
        base = f'ov{i}'
    src = base

# split in segmenti, trim + freeze pad, concat
n = len(segs)
fc.append(f'[{src}]split={n}' + ''.join(f'[s{j}]' for j in range(n)))
for j, (a, b, pad) in enumerate(segs):
    f = f'[s{j}]trim=start={a}:end={b},setpts=PTS-STARTPTS'
    if pad > 0:
        f += f',tpad=stop_mode=clone:stop_duration={pad}'
    fc.append(f + f'[v{j}]')
fc.append(''.join(f'[v{j}]' for j in range(n)) + f'concat=n={n}:v=1:a=0[vcat]')

alabels = []
for idx, (k, off) in enumerate(audio_offsets):
    d = int(off * 1000)
    fc.append(f'[{idx + 1}:a]adelay={d}|{d}[a{idx}]')
    alabels.append(f'[a{idx}]')
fc.append(''.join(alabels) + f'amix=inputs={len(alabels)}:duration=longest:normalize=0,apad[aout]')

cmd = [FF, '-y'] + inputs + [
    '-filter_complex', ';'.join(fc),
    '-map', '[vcat]', '-map', '[aout]',
    '-t', str(round(final_end, 2)),
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
