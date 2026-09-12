"""Controlli finali e pubblicazione solo dopo decodifica e verifica della timeline."""
import hashlib
import json
import re
import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg

ROOT = Path(__file__).parent
VIDEO = ROOT.parent / 'aitour-guida-pirone-2026.mp4'


def seconds(value):
    h, m, rest = value.split(':')
    return int(h) * 3600 + int(m) * 60 + float(rest.replace(',', '.'))


def main():
    timeline = json.loads((ROOT / 'timeline.json').read_text())
    script = json.loads((ROOT / 'script.json').read_text())
    frames = sum(scene['frames'] for scene in timeline['scenes'])
    with wave.open('/tmp/voom-pirone-render/complete-voice.wav') as wavefile:
        sample_count, sample_rate = wavefile.getnframes(), wavefile.getframerate()
    assert abs(frames / 25 - sample_count / sample_rate) < 1e-9
    assert len(timeline['scenes']) == 48 and len(timeline['chapters']) == 8
    for scene in script['scenes']:
        meta = json.loads((ROOT / 'audio' / f"{scene['id']}.json").read_text())
        digest = hashlib.sha256((script['voice'] + script['rate'] + scene['narration']).encode()).hexdigest()
        assert meta['sha256'] == digest, scene['id']
        assert meta['words'] and meta['words'][-1]['end'] <= meta['audioDuration'] + .3
    subtitles = (ROOT.parent / 'aitour-guida-pirone-2026.srt').read_text()
    spans = re.findall(r'(\d\d:\d\d:\d\d,\d{3}) --> (\d\d:\d\d:\d\d,\d{3})', subtitles)
    previous_end = 0
    for start, end in spans:
        start, end = seconds(start), seconds(end)
        assert previous_end <= start + .002 and start < end <= timeline['duration'] + .002
        previous_end = end
    raw = (ROOT.parents[2] / 'memory/test_credentials.md').read_text().split('## Account autorizzato per nuovo tutorial AI Tour')[1]
    email = re.search(r'Email: (.+)', raw)[1].strip()
    password = re.search(r'Password: (.+)', raw)[1].strip()
    text_material = (ROOT / 'script.json').read_text() + subtitles + (ROOT.parent / 'aitour-guida-pirone-2026.md').read_text()
    assert email not in text_material and password not in text_material
    audit = json.loads((ROOT / 'network_audit.json').read_text())
    assert all(entry['result'] in ('AUTH_OR_READ_ALLOWED', 'BLOCKED', 'LOCAL_DEMONSTRATION_RESPONSE') for entry in audit)
    print('PASS 48 scenes; 8 chapters; exact sample/frame timeline; subtitles; credential scan', flush=True)
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-threads', '2', '-i', str(VIDEO), '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'], check=True, timeout=600)
    probe = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-i', str(VIDEO)], capture_output=True, text=True).stderr
    assert '1920x1080' in probe and '25 fps' in probe and 'Audio: aac' in probe and 'Video: h264' in probe
    assert probe.count('Chapter #') == 8
    report = {
        'status': 'pass', 'file': VIDEO.name, 'bytes': VIDEO.stat().st_size,
        'sha256': hashlib.sha256(VIDEO.read_bytes()).hexdigest(),
        'duration_seconds': frames / 25, 'video_frames': frames, 'audio_samples': sample_count,
        'audio_sample_rate': sample_rate, 'resolution': [1920, 1080], 'fps': 25,
        'chapters': timeline['chapters'], 'subtitle_cues': len(spans), 'scenes': 48,
        'full_audio_video_decode': 'pass', 'sample_frame_timeline_difference_seconds': 0,
        'voice_word_boundaries': 'pass', 'caption_timing_order': 'pass',
        'credentials_in_narration_or_downloadable_text': False,
        'recording_mode': 'read_only_with_clearly_labelled_local_demonstrations',
        'operational_mutations_sent_by_recorder': 0,
        'qualitative_qa': 'Intro and zone-confirmation clips inspected for audio/subtitle/readability. The confirmation button in s18 is intentionally not pressed; s19 shows the confirmed state.'
    }
    (ROOT / 'qa_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    (ROOT.parent / 'aitour-guida-pirone-2026.ready.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print('PUBLISHED', VIDEO.name, 'DURATION', report['duration_seconds'], 'SIZE_MB', round(report['bytes'] / 1e6, 1), flush=True)


if __name__ == '__main__':
    main()