import asyncio
import hashlib
import json
import math
import subprocess
from pathlib import Path

import edge_tts
import imageio_ffmpeg

ROOT = Path(__file__).parent
AUDIO = ROOT / 'audio'
SCRIPT = json.loads((ROOT / 'script.json').read_text())


async def generate(scene, semaphore):
    async with semaphore:
        target = AUDIO / f"{scene['id']}.mp3"
        meta_path = AUDIO / f"{scene['id']}.json"
        digest = hashlib.sha256((SCRIPT['voice'] + SCRIPT['rate'] + scene['narration']).encode()).hexdigest()
        if target.exists() and meta_path.exists() and json.loads(meta_path.read_text()).get('sha256') == digest:
            return json.loads(meta_path.read_text())
        for attempt in range(3):
            try:
                events = []
                communication = edge_tts.Communicate(scene['narration'], SCRIPT['voice'], rate=SCRIPT['rate'], boundary='WordBoundary')
                with target.open('wb') as media:
                    async for event in communication.stream():
                        if event['type'] == 'audio':
                            media.write(event['data'])
                        elif event['type'] in ('WordBoundary', 'SentenceBoundary'):
                            events.append({'text': event['text'], 'start': event['offset'] / 10_000_000, 'end': (event['offset'] + event['duration']) / 10_000_000})
                pcm = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-i', str(target), '-f', 's16le', '-ar', '48000', '-ac', '1', 'pipe:1'], check=True, capture_output=True).stdout
                duration = len(pcm) / (48000 * 2)
                metadata = {'id': scene['id'], 'sha256': digest, 'audioDuration': duration, 'duration': math.ceil((duration + 1.2) * 25) / 25, 'words': events}
                meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
                print('VOICE', scene['id'], round(duration, 2), 'seconds', flush=True)
                return metadata
            except Exception:
                if attempt == 2:
                    raise
                await asyncio.sleep(5 * (attempt + 1))


async def main():
    AUDIO.mkdir(exist_ok=True)
    semaphore = asyncio.Semaphore(2)
    results = await asyncio.gather(*(generate(scene, semaphore) for scene in SCRIPT['scenes']))
    (ROOT / 'audio_manifest.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
    total = sum(item['duration'] for item in results)
    print('TOTAL_SECONDS', total, 'MINUTES', round(total / 60, 2), flush=True)


if __name__ == '__main__':
    asyncio.run(main())