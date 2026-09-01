"""Assembla il tutorial completo v2 in un unico video sincronizzato.
- scene audio: il segmento video viene RALLENTATO se l'audio sfora la finestra
- mark 'start': scarta il preroll (login/uscita dal live)
- mark 'waitN': segmento ACCELERATO in time-lapse (~5s) — elaborazioni AI
- mark 'cutN': segmento ESCLUSO dal montaggio
- mark 'show1': pausa visiva breve a velocità normale
- blur: nome header dashboard (rec1b) + fullscreen sull'eventuale vista live (live_in/live_out)
Uso: python assemble_v3.py <out.mp4>"""
import json, subprocess, sys, glob, os
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
AUDIO = '/app/manual/video/audio'
LEAD = 0.4
TAIL = 0.7
LAPSE_TARGET = 5.0   # durata a schermo dei segmenti waitN

out = sys.argv[1]
dur = json.load(open(f'{AUDIO}/durations.json'))

RECS = ['rec1b', 'rec2b', 'rec6', 'rec4', 'rec3', 'rec5']

inputs = []
fc = []
seg_labels = []
audio_offsets = []
global_base = 0.0

for rec_idx, rec in enumerate(RECS):
    rd = f'/app/manual/video/{rec}'
    marks = json.load(open(f'{rd}/marks.json'))
    webm = glob.glob(f'{rd}/*.webm')[0]
    inputs.append(webm)
    end_t = [m for m in marks if m['scene'] == 'end'][0]['t']
    start_t = next((m['t'] for m in marks if m['scene'] == 'start'), 0.0)

    bounds = [start_t]
    for m in marks:
        t = m['t']
        if t - bounds[-1] >= 0.05 and start_t < t <= end_t:
            bounds.append(t)
    if end_t - bounds[-1] >= 0.05:
        bounds.append(end_t)

    scene_at = {}
    for m in marks:
        k = m['scene']
        if m['t'] < start_t:
            continue
        if (k.startswith('v') and os.path.exists(f'{AUDIO}/{k}.mp3')) or k.startswith('wait') or k.startswith('cut') or k.startswith('show'):
            b = min(bounds, key=lambda x: abs(x - m['t']))
            scene_at[b] = k

    # blur dinamici (rec1b): nome header dashboard + fullscreen vista live
    blurs = []
    if rec == 'rec1b':
        dash_end = next((m['t'] for m in marks if m['scene'] == 'dash_end'), 18.6)
        blurs.append((20, 40, 400, 125, 0, dash_end))
        li = next((m['t'] for m in marks if m['scene'] == 'live_in'), None)
        lo = next((m['t'] for m in marks if m['scene'] == 'live_out'), None)
        if li is not None and lo is not None:
            blurs.append((0, 130, 780, 1550, max(0, li - 0.4), lo + 0.4))

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
        scene = scene_at.get(a)
        if scene and scene.startswith('cut'):
            continue  # segmento escluso
        factor = 1.0
        if scene and scene.startswith('wait'):
            window = b - a
            if window > LAPSE_TARGET:
                factor = round(LAPSE_TARGET / window, 4)  # accelerazione time-lapse
        elif scene and scene.startswith('v'):
            need = LEAD + dur[scene] + TAIL
            window = b - a
            if need > window:
                factor = round(need / window, 4)  # rallentamento per far entrare l'audio
        segs.append((a, b, factor, scene))

    fc.append(f'[{src}]split={len(segs)}' + ''.join(f'[r{rec_idx}s{j}]' for j in range(len(segs))))
    cursor = global_base
    for j, (a, b, factor, scene) in enumerate(segs):
        lbl = f'r{rec_idx}v{j}'
        f = f'[r{rec_idx}s{j}]trim=start={a}:end={b},setpts=PTS-STARTPTS'
        if factor != 1.0:
            f += f',setpts={factor}*PTS'
        fc.append(f + f'[{lbl}]')
        seg_labels.append(f'[{lbl}]')
        if scene and scene.startswith('v'):
            audio_offsets.append((scene, cursor + LEAD))
            print(f'{rec}/{scene}: finestra {b - a:.1f}s, audio {dur[scene]}s -> x{factor}')
        elif scene:
            print(f'{rec}/{scene}: finestra {b - a:.1f}s -> x{factor}')
        cursor += (b - a) * factor
    global_base = cursor

total = global_base
print(f'Durata totale: {total:.1f}s ({int(total // 60)}:{int(total % 60):02d})')

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
