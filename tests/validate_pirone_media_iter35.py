import hashlib
import json
import re
import subprocess
from pathlib import Path

import imageio_ffmpeg


ROOT = Path("/app")
VIDEO = ROOT / "manual/video/aitour-guida-pirone-2026.mp4"
SRT = ROOT / "manual/video/aitour-guida-pirone-2026.srt"
MD = ROOT / "manual/video/aitour-guida-pirone-2026.md"
TIMELINE = ROOT / "manual/video/pirone2026/timeline.json"
QA = ROOT / "manual/video/pirone2026/qa_report.json"
ARTIFACTS = ROOT / "test_reports/artifacts_iter35"
OUT_JSON = ARTIFACTS / "media_validation_iter35.json"


def srt_sec(ts: str) -> float:
    h, m, rest = ts.split(":")
    return int(h) * 3600 + int(m) * 60 + float(rest.replace(",", "."))


def main() -> None:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

    local_bytes = VIDEO.read_bytes()
    local_sha = hashlib.sha256(local_bytes).hexdigest()

    # Full decode (audio+video) without ffprobe
    decode = subprocess.run(
        [
            ffmpeg,
            "-v",
            "error",
            "-threads",
            "2",
            "-i",
            str(VIDEO),
            "-map",
            "0:v:0",
            "-map",
            "0:a:0",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
        timeout=900,
        check=True,
    )

    meta_proc = subprocess.run(
        [ffmpeg, "-i", str(VIDEO)], capture_output=True, text=True, timeout=120
    )
    probe = meta_proc.stderr

    dur_match = re.search(r"Duration:\s*(\d{2}:\d{2}:\d{2}\.\d{2})", probe)
    duration_probe = dur_match.group(1) if dur_match else ""

    srt_text = SRT.read_text(encoding="utf-8")
    cues = re.findall(r"(\d\d:\d\d:\d\d,\d{3}) --> (\d\d:\d\d:\d\d,\d{3})", srt_text)

    prev_end = -1.0
    srt_order_ok = True
    for start, end in cues:
        s, e = srt_sec(start), srt_sec(end)
        if not (s >= prev_end - 0.002 and s < e):
            srt_order_ok = False
            break
        prev_end = e

    timeline = json.loads(TIMELINE.read_text(encoding="utf-8"))
    scenes = timeline["scenes"]
    chapters = timeline["chapters"]

    scenes_ok = len(scenes) == 48
    chapters_ok = len(chapters) == 8
    scene_monotonic = all(
        scenes[i]["start"] <= scenes[i + 1]["start"] + 1e-9 for i in range(len(scenes) - 1)
    )

    # sample frames for readability/coherence spot-check
    sample_times = [2, 366, 650, 1005, 1275, 1500]
    frame_paths = []
    for t in sample_times:
        out = ARTIFACTS / f"frame_{t}s_iter35.jpg"
        subprocess.run(
            [
                ffmpeg,
                "-v",
                "error",
                "-ss",
                str(t),
                "-i",
                str(VIDEO),
                "-frames:v",
                "1",
                "-q:v",
                "4",
                "-y",
                str(out),
            ],
            check=True,
            timeout=120,
        )
        frame_paths.append(str(out))

    qa = json.loads(QA.read_text(encoding="utf-8"))
    report = {
        "video_exists": VIDEO.exists(),
        "bytes": VIDEO.stat().st_size,
        "sha256": local_sha,
        "decode_pass": decode.returncode == 0,
        "probe_duration": duration_probe,
        "has_1920x1080": "1920x1080" in probe,
        "has_25fps": "25 fps" in probe,
        "has_h264": "Video: h264" in probe,
        "has_aac": "Audio: aac" in probe,
        "chapter_count_from_probe": probe.count("Chapter #"),
        "srt_cues": len(cues),
        "srt_order_ok": srt_order_ok,
        "timeline_scenes": len(scenes),
        "timeline_chapters": len(chapters),
        "timeline_scene_monotonic": scene_monotonic,
        "md_exists": MD.exists(),
        "qa_report_reference": {
            "duration_seconds": qa.get("duration_seconds"),
            "voice_word_boundaries": qa.get("voice_word_boundaries"),
            "caption_timing_order": qa.get("caption_timing_order"),
        },
        "sample_frames": frame_paths,
    }

    OUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
