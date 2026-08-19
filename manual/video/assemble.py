"""Assembla un video tutorial: webm + audio scene (agli offset dei marks) + blur opzionale.
Uso: python assemble.py <rec_dir> <out.mp4> [--blur x:y:w:h:t1:t2]"""
import json, subprocess, sys, glob, os
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
AUDIO = '/app/manual/video/audio'

rec_dir = sys.argv[1]
out = sys.argv[2]
blurs = []
for a in sys.argv[3:]:
    if a.startswith('--blur'):
        parts = a.split('=', 1)[1].split(':')
        blurs.append(tuple(float(x) for x in parts))  # x,y,w,h,t1,t2

marks = json.load(open(f'{rec_dir}/marks.json'))
webm = glob.glob(f'{rec_dir}/*.webm')[0]
scene_marks = [m for m in marks if m['scene'].startswith('v') and os.path.exists(f"{AUDIO}/{m['scene']}.mp3")]
end_t = [m for m in marks if m['scene'] == 'end'][0]['t']

inputs = ['-i', webm]
for m in scene_marks:
    inputs += ['-i', f"{AUDIO}/{m['scene']}.mp3"]

fc = []
vout = '0:v'
if blurs:
    n = len(blurs)
    fc.append(f"[0:v]split={n + 1}" + ''.join(f'[b{i}]' for i in range(n + 1)))
    base = 'b0'
    for i, (x, y, w, h, t1, t2) in enumerate(blurs):
        fc.append(f"[b{i + 1}]crop={int(w)}:{int(h)}:{int(x)}:{int(y)},boxblur=luma_radius=22:luma_power=2:chroma_radius=11:chroma_power=2[bl{i}]")
        fc.append(f"[{base}][bl{i}]overlay={int(x)}:{int(y)}:enable='between(t,{t1},{t2})'[ov{i}]")
        base = f'ov{i}'
    vout = base

alabels = []
for idx, m in enumerate(scene_marks):
    delay = int((m['t'] + 0.4) * 1000)
    fc.append(f"[{idx + 1}:a]adelay={delay}|{delay}[a{idx}]")
    alabels.append(f'[a{idx}]')
fc.append(''.join(alabels) + f"amix=inputs={len(alabels)}:duration=longest:normalize=0,apad[aout]")

cmd = [FF, '-y'] + inputs + [
    '-filter_complex', ';'.join(fc),
    '-map', f'[{vout}]' if blurs else '0:v',
    '-map', '[aout]',
    '-t', str(end_t),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '25',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    out,
]
print(' '.join(cmd)[:400])
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode != 0:
    print(r.stderr[-3000:])
    sys.exit(1)
print('OK:', out, os.path.getsize(out) // 1024, 'KB')
