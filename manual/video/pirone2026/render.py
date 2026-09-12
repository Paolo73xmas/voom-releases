"""Montaggio 1080p a campioni audio/frame esatti, capitoli e sottotitoli da WordBoundary."""
import concurrent.futures
import json
import math
import subprocess
import sys
import textwrap
import wave
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
WORK = Path('/tmp/voom-pirone-render')
FF = imageio_ffmpeg.get_ffmpeg_exe()
FPS = 25
SR = 48000
LEAD = .4
FINAL = ROOT.parent / 'aitour-guida-pirone-2026.mp4'
PENDING = ROOT.parent / 'aitour-guida-pirone-2026.rendering.mp4'
W, H = 1920, 1080
FONT_BASE = Path('/usr/share/fonts/truetype/liberation')


def font(size, bold=False):
    return ImageFont.truetype(str(FONT_BASE / ('LiberationSans-Bold.ttf' if bold else 'LiberationSans-Regular.ttf')), size)


def wrap(draw, text, face, width):
    lines, line = [], ''
    for word in text.split():
        candidate = (line + ' ' + word).strip()
        if line and draw.textlength(candidate, font=face) > width:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def rounded_paste(canvas, image, box, radius=20):
    x, y, width, height = box
    picture = image.resize((width, height), Image.Resampling.LANCZOS)
    mask = Image.new('L', picture.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius, fill=255)
    canvas.paste(picture, (x, y), mask)


def make_slide(scene, shot, position, total):
    frame = Image.new('RGB', (W, H), '#110B1F')
    draw = ImageDraw.Draw(frame)
    for y in range(H):
        f = y / H
        draw.line((0, y, W, y), fill=(int(17 + f * 7), int(11 + f * 5), int(31 + f * 11)))
    draw.rounded_rectangle((46, 35, 81, 70), radius=9, fill='#B799FF')
    draw.text((91, 33), 'VOOM', font=font(37, True), fill='white')
    draw.text((233, 44), 'GUIDA AI TOUR', font=font(22, True), fill='#B5A8CE')
    draw.text((50, 94), 'Salvatore Pirone · sola lettura', font=font(21), fill='#B5A8CE')
    draw.text((510, 47), scene['chapter'].upper(), font=font(26, True), fill='#C0A3FF')
    simulated = scene.get('simulation', False) or shot.get('simulation', False)
    tag = 'SIMULAZIONE · NON SALVATO' if simulated else 'DIMOSTRAZIONE IN SOLA LETTURA'
    tag_face = font(19, True)
    tag_width = math.ceil(draw.textlength(tag, font=tag_face)) + 36
    draw.rounded_rectangle((W - tag_width - 42, 31, W - 42, 79), radius=12, fill='#7C4312' if simulated else '#332044')
    draw.text((W - tag_width - 24, 44), tag, font=tag_face, fill='#FFE4AB' if simulated else '#DBCCFA')
    phone = Image.open(ROOT / shot['file']).convert('RGB')
    if scene.get('zoom') == 'map':
        draw.text((52, 132), scene['title'], font=font(50, True), fill='#F6F1FF')
        y = 248
        for text in scene['bullets']:
            draw.ellipse((55, y + 11, 67, y + 23), fill='#B998FF')
            for line in wrap(draw, text, font(30), 465):
                draw.text((87, y), line, font=font(30), fill='#D8CEE7'); y += 42
            y += 22
        draw.text((55, 776), 'MAPPA REALE DELL’ANTEPRIMA', font=font(22, True), fill='#C0A3FF')
        for i, line in enumerate(wrap(draw, 'I punti sulla mappa non sono ancora l’elenco definitivo delle visite.', font(26), 475)):
            draw.text((55, 816 + i * 34), line, font=font(26), fill='#BDB0D0')
        focus = shot['focus']
        rx, ry, rw, rh = 15, max(0, focus['y'] - 290), 360, 284
        crop = phone.crop((round(rx * phone.width / 390), round(ry * phone.height / 844), round((rx + rw) * phone.width / 390), round((ry + rh) * phone.height / 844)))
        factor = min(1220 / crop.width, 650 / crop.height)
        zw, zh = round(crop.width * factor), round(crop.height * factor)
        draw.rounded_rectangle((588, 227, 1866, 926), radius=22, fill='#2B213A', outline='#655178', width=2)
        rounded_paste(frame, crop, (613 + (1220 - zw) // 2, 238 + (650 - zh) // 2, zw, zh), 14)
        draw.text((1450, 898), '© OpenStreetMap contributors', font=font(18), fill='#D3BEDF')
        draw.rounded_rectangle((43, 946, 1875, 1053), radius=18, fill='#0C0913')
        frame.save(WORK / f"{scene['id']}.png")
        return frame
    draw.rounded_rectangle((43, 128, 443, 933), radius=28, fill='#382A50', outline='#685283', width=2)
    phone_box = (57, 143, 372, 775)
    # Mantieni rapporto senza deformare la schermata originale.
    ph = round(phone_box[2] * phone.height / phone.width)
    if ph > phone_box[3]:
        pw = round(phone_box[3] * phone.width / phone.height)
        phone_box = (57 + (372 - pw) // 2, 143, pw, phone_box[3])
    else:
        phone_box = (57, 143 + (775 - ph) // 2, 372, ph)
    rounded_paste(frame, phone, phone_box, 17)
    focus = shot.get('focus')
    if focus and focus.get('width', 0) > 0:
        sx, sy = phone_box[2] / 390, phone_box[3] / 844
        x1 = max(phone_box[0], phone_box[0] + focus['x'] * sx)
        y1 = max(phone_box[1], phone_box[1] + focus['y'] * sy)
        x2 = min(phone_box[0] + phone_box[2], x1 + focus['width'] * sx)
        y2 = min(phone_box[1] + phone_box[3], y1 + focus['height'] * sy)
        if x2 > x1 and y2 > y1:
            draw.rounded_rectangle((x1, y1, x2, y2), radius=8, outline='#FFD370', width=4)
    title_font = font(53, True)
    title_lines = wrap(draw, scene['title'], title_font, 1300)
    y = 130
    for line in title_lines:
        draw.text((510, y), line, font=title_font, fill='#F6F1FF')
        y += 62
    y += 26
    for text in scene['bullets']:
        lines = wrap(draw, text, font(29), 1235)
        draw.ellipse((512, y + 11, 524, y + 23), fill='#B998FF')
        for line in lines:
            draw.text((545, y), line, font=font(29), fill='#D8CEE7')
            y += 38
        y += 10
    zoom_y = max(443, y + 19)
    zoom_h = 916 - zoom_y
    if zoom_h < 230:
        raise ValueError(f"Testo troppo alto nella scena {scene['id']}")
    draw.rounded_rectangle((507, zoom_y, 1870, 918), radius=22, fill='#2B213A', outline='#655178', width=2)
    draw.text((530, zoom_y + 15), 'DETTAGLIO DELLA SCHERMATA', font=font(17, True), fill='#D3BEDF')
    if focus:
        if scene.get('zoom') == 'map':
            rect = [15, max(0, focus['y'] - 300), 360, 325]
        else:
            height = min(180, max(110, focus['height'] + 56))
            center = focus['y'] + min(focus['height'], 130) / 2
            rect = [max(0, min(12, focus['x'] - 12)), max(0, min(844 - height, center - height / 2)), 366, height]
    else:
        rect = [10, 90, 370, 320]
    rx, ry, rw, rh = rect
    crop = phone.crop((round(rx * phone.width / 390), round(ry * phone.height / 844), round((rx + rw) * phone.width / 390), round((ry + rh) * phone.height / 844)))
    available_w, available_h = 1307, zoom_h - 65
    ratio = min(available_w / crop.width, available_h / crop.height)
    zw, zh = round(crop.width * ratio), round(crop.height * ratio)
    zx, zy = 535 + (available_w - zw) // 2, zoom_y + 50 + (available_h - zh) // 2
    rounded_paste(frame, crop, (zx, zy, zw, zh), 10)
    if focus and scene.get('zoom') != 'map':
        fx1 = zx + (focus['x'] - rx) / rw * zw
        fy1 = zy + (focus['y'] - ry) / rh * zh
        fx2 = fx1 + focus['width'] / rw * zw
        fy2 = fy1 + focus['height'] / rh * zh
        fx1, fy1, fx2, fy2 = max(zx, fx1), max(zy, fy1), min(zx + zw, fx2), min(zy + zh, fy2)
        if fx2 > fx1 and fy2 > fy1:
            draw.rounded_rectangle((fx1, fy1, fx2, fy2), radius=7, outline='#FFD370', width=4)
    draw.rounded_rectangle((43, 946, 1875, 1053), radius=18, fill='#0C0913')
    draw.text((1770, 898), f'{position:02d} / {total:02d}', font=font(17), fill='#B9A8C9')
    frame.save(WORK / f"{scene['id']}.png")
    return frame


def stamp(seconds, ass=False):
    units = round(seconds * (100 if ass else 1000))
    scale = 100 if ass else 1000
    sec, rest = divmod(units, scale)
    hours, sec = divmod(sec, 3600)
    minutes, sec = divmod(sec, 60)
    return f'{hours}:{minutes:02d}:{sec:02d}.{rest:02d}' if ass else f'{hours:02d}:{minutes:02d}:{sec:02d},{rest:03d}'


def captions(words, audio_duration):
    if not words:
        raise ValueError('Metadati voce mancanti: non generare sottotitoli con tempi stimati')
    groups, current = [], []
    for word in words:
        current.append(word)
        phrase = ' '.join(w['text'] for w in current)
        if len(phrase) >= 84 or len(current) >= 13 or (len(current) >= 6 and word['text'].endswith(('.', '?', '!', ';', ':'))):
            groups.append(current)
            current = []
    if current:
        groups.append(current)
    cues = []
    for i, group in enumerate(groups):
        begin = max(0, group[0]['start']) + LEAD
        next_start = groups[i + 1][0]['start'] + LEAD if i + 1 < len(groups) else audio_duration + LEAD
        end = min(next_start, max(begin + .35, group[-1]['end'] + LEAD + .18))
        text = ' '.join(w['text'] for w in group)
        cues.append((begin, max(begin + .01, end), text))
    return cues


def ass_file(path, cues):
    header = '''[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,Liberation Sans,34,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,85,85,40,1
[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
'''
    lines = []
    for start, end, text in cues:
        text = '\\N'.join(textwrap.wrap(text, width=95, break_long_words=False)).replace('{', '').replace('}', '')
        lines.append(f'Dialogue: 0,{stamp(start, True)},{stamp(end, True)},Default,,0,0,0,,{text}')
    path.write_text(header + '\n'.join(lines), encoding='utf-8')


def encode(item):
    sid, duration = item['id'], item['duration']
    target = WORK / f'{sid}.mp4'
    command = [FF, '-y', '-loglevel', 'error', '-loop', '1', '-framerate', str(FPS), '-i', str(WORK / f'{sid}.png')]
    effects = f"subtitles={WORK / (sid + '.ass')},fade=t=in:st=0:d=0.25,fade=t=out:st={duration - .25:.3f}:d=0.25"
    if 'changeAt' in item:
        command += ['-loop', '1', '-framerate', str(FPS), '-i', str(WORK / f'{sid}_after.png'), '-filter_complex', f"[0:v][1:v]overlay=enable='gte(t,{item['changeAt']:.4f})',{effects}[v]", '-map', '[v]']
    else:
        command += ['-vf', effects]
    command += ['-frames:v', str(item['frames']), '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'stillimage', '-threads', '2', '-crf', '21', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', str(target)]
    subprocess.run(command, check=True)
    print('ENCODED', sid, round(duration, 2), flush=True)
    return target


def main():
    WORK.mkdir(exist_ok=True)
    script = json.loads((ROOT / 'script.json').read_text())
    shots = json.loads((ROOT / 'screens.json').read_text())
    scenes = script['scenes']
    missing = [scene['screen'] for scene in scenes if scene['screen'] not in shots]
    if missing:
        raise RuntimeError('Schermate mancanti: ' + ', '.join(missing))
    for number, scene in enumerate(scenes, 1):
        shot = dict(shots[scene['screen']])
        if scene.get('focus_rect'):
            shot['focus'] = scene['focus_rect']
        make_slide(scene, shot, number, len(scenes))
        if scene.get('visual_change'):
            after_shot = dict(shots[scene['visual_change']['screen']])
            if scene['visual_change'].get('focus_rect'):
                after_shot['focus'] = scene['visual_change']['focus_rect']
            make_slide({**scene, 'id': scene['id'] + '_after'}, after_shot, number, len(scenes))
    if '--preview-only' in sys.argv:
        selected = ['s01', 's11', 's17', 's24', 's36', 's45']
        sheet = Image.new('RGB', (1920, 1620), '#110B1F')
        for i, sid in enumerate(selected):
            image = Image.open(WORK / f'{sid}.png').resize((960, 540), Image.Resampling.LANCZOS)
            sheet.paste(image, ((i % 2) * 960, (i // 2) * 540))
        sheet.save(ROOT / 'contact-sheet.jpg', quality=90)
        print('PREVIEW_READY', flush=True)
        return
    timeline, all_cues, chapters = [], [], []
    start = 0
    voice_path = WORK / 'complete-voice.wav'
    with wave.open(str(voice_path), 'wb') as voice:
        voice.setnchannels(1); voice.setsampwidth(2); voice.setframerate(SR)
        for scene in scenes:
            sid = scene['id']
            audio = ROOT / 'audio' / f'{sid}.mp3'
            meta = json.loads((ROOT / 'audio' / f'{sid}.json').read_text())
            raw = subprocess.run([FF, '-v', 'error', '-i', str(audio), '-f', 's16le', '-ar', str(SR), '-ac', '1', 'pipe:1'], check=True, capture_output=True).stdout
            samples = len(raw) // 2
            frames = math.ceil((samples / SR + 1.2) * FPS)
            duration = frames / FPS
            target_samples = frames * (SR // FPS)
            lead_samples = round(LEAD * SR)
            voice.writeframesraw(b'\0\0' * lead_samples + raw + b'\0\0' * (target_samples - samples - lead_samples))
            cues = captions(meta['words'], samples / SR)
            ass_file(WORK / f'{sid}.ass', cues)
            all_cues.extend((start + a, start + b, text) for a, b, text in cues)
            if not chapters or chapters[-1]['title'] != scene['chapter']:
                chapters.append({'title': scene['chapter'], 'start': start})
            entry = {'id': sid, 'start': start, 'duration': duration, 'frames': frames, 'chapter': scene['chapter'], 'screen': scene['screen'], 'narration': scene['narration']}
            if scene.get('visual_change'):
                word = scene['visual_change']['word'].casefold()
                entry['changeAt'] = next(w['start'] for w in meta['words'] if w['text'].casefold().strip('.,:;!?') == word) + LEAD
            timeline.append(entry)
            start += duration
    srt = '\n\n'.join(f'{i}\n{stamp(a)} --> {stamp(b)}\n{text}' for i, (a, b, text) in enumerate(all_cues, 1)) + '\n'
    (ROOT.parent / 'aitour-guida-pirone-2026.srt').write_text(srt, encoding='utf-8')
    (ROOT / 'timeline.json').write_text(json.dumps({'duration': start, 'fps': FPS, 'sampleRate': SR, 'scenes': timeline, 'chapters': chapters}, ensure_ascii=False, indent=2))
    markdown = '# AI Tour — guida con Salvatore Pirone\n\nRegistrazione in sola lettura. Gli esempi di agenda e verifiche sono dimostrativi e non salvati.\n\n## Capitoli\n'
    for chapter in chapters:
        seconds = round(chapter['start']); minutes, seconds = divmod(seconds, 60)
        markdown += f"- **{minutes:02d}:{seconds:02d}** — {chapter['title']}\n"
    markdown += '\n## Copione completo\n'
    for scene in scenes:
        markdown += f"\n### {scene['chapter']} · {scene['title']}\n\n{scene['narration']}\n"
    markdown += '\n## Crediti\n\nMappe: © OpenStreetMap contributors. Voce sintetica italiana: it-IT-DiegoNeural.\n'
    (ROOT.parent / 'aitour-guida-pirone-2026.md').write_text(markdown, encoding='utf-8')
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        selection = next((arg.split('=', 1)[1].split(',') for arg in sys.argv if arg.startswith('--only=')), None)
        list(pool.map(encode, [entry for entry in timeline if selection is None or entry['id'] in selection]))
    concat = WORK / 'segments.txt'
    concat.write_text('\n'.join(f"file '{WORK / (s['id'] + '.mp4')}'" for s in scenes))
    metadata = [';FFMETADATA1', 'title=AI Tour — guida completa con Salvatore Pirone', 'artist=VOOM CRM', 'comment=Esempi non salvati; nessuna modifica ai dati operativi.']
    for i, chapter in enumerate(chapters):
        end = chapters[i + 1]['start'] if i + 1 < len(chapters) else start
        metadata += ['[CHAPTER]', 'TIMEBASE=1/1000', f"START={round(chapter['start'] * 1000)}", f'END={round(end * 1000)}', f"title={chapter['title']}"]
    metadata_path = WORK / 'chapters.ffmeta'
    metadata_path.write_text('\n'.join(metadata), encoding='utf-8')
    subprocess.run([FF, '-y', '-loglevel', 'warning', '-f', 'concat', '-safe', '0', '-i', str(concat), '-i', str(voice_path), '-f', 'ffmetadata', '-i', str(metadata_path), '-map', '0:v:0', '-map', '1:a:0', '-map_metadata', '2', '-map_chapters', '2', '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=7', '-ar', str(SR), '-c:a', 'aac', '-b:a', '128k', '-t', f'{start:.3f}', '-movflags', '+faststart', str(PENDING)], check=True)
    PENDING.replace(FINAL)
    print('FINAL', FINAL, 'SECONDS', round(start, 2), 'MB', round(FINAL.stat().st_size / 1e6, 1), flush=True)


if __name__ == '__main__':
    main()