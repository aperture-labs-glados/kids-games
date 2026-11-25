#!/usr/bin/env python3
"""Record every word once with a neural voice and ship the clips as static mp3.

Run at build time, not in the browser: the site stays free, offline-capable and
has no API key in it. Anything without a clip falls back to the device voice.

    /opt/data/.venv-tts/bin/python dev/make-audio.py --voice en-US-AriaNeural
    /opt/data/.venv-tts/bin/python dev/make-audio.py --force

Needs `edge-tts` (pip) and `ffmpeg` on PATH. Files land in shared/audio/words/.
"""
import argparse
import asyncio
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORDS_JS = ROOT / "shared" / "words.js"
OUT = ROOT / "shared" / "audio" / "words"

# A single isolated word needs a natural voice, not an exaggerated one.
DEFAULT_VOICE = "en-US-AriaNeural"
RATE = "-10%"

# trim both ends, keep a beat of lead-in so the first phoneme is not clipped
FILTER = (
    "silenceremove=start_periods=1:start_silence=0.03:start_threshold=-45dB,"
    "areverse,"
    "silenceremove=start_periods=1:start_silence=0.03:start_threshold=-45dB,"
    "areverse,"
    "adelay=140,"
    "apad=pad_dur=0.15,"
    "loudnorm=I=-16:TP=-1.5:LRA=11"
)


def words_from_js(path):
    """Pull every word straight out of words.js so the clips cannot drift."""
    src = path.read_text()
    found = []

    for block in re.findall(r"words:\s*\[(.*?)\]", src, re.S):
        found += re.findall(r"'([a-z]+)'", block)

    for block in re.findall(r"(?:primer|first):\s*\[(.*?)\]", src, re.S):
        found += re.findall(r"'([a-z]+)'", block)

    seen, out = set(), []
    for w in found:
        if w not in seen:
            seen.add(w)
            out.append(w)
    return out


async def synth(word, voice, tmpdir, sem):
    import edge_tts
    raw = Path(tmpdir) / f"{word}.raw.mp3"
    final = OUT / f"{word}.mp3"
    async with sem:
        comm = edge_tts.Communicate(word, voice, rate=RATE)
        await comm.save(str(raw))
    proc = subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-af", FILTER,
         "-codec:a", "libmp3lame", "-b:a", "32k", "-ar", "24000", "-ac", "1",
         str(final)],
        capture_output=True, text=True,
    )
    raw.unlink(missing_ok=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed for {word}: {proc.stderr.strip()[:200]}")
    return final.stat().st_size


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default=DEFAULT_VOICE)
    ap.add_argument("--force", action="store_true", help="re-record clips that exist")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found on PATH")

    OUT.mkdir(parents=True, exist_ok=True)
    words = words_from_js(WORDS_JS)
    if args.limit:
        words = words[: args.limit]
    todo = [w for w in words if args.force or not (OUT / f"{w}.mp3").exists()]
    print(f"{len(words)} words, {len(todo)} to record with {args.voice}")

    sem = asyncio.Semaphore(6)
    sizes, failed = [], []
    with tempfile.TemporaryDirectory() as td:
        async def one(w):
            try:
                sizes.append(await synth(w, args.voice, td, sem))
            except Exception as e:  # noqa: BLE001 - report and carry on
                failed.append((w, str(e)[:120]))

        await asyncio.gather(*(one(w) for w in todo))

    meta = {
        "voice": args.voice,
        "rate": RATE,
        "count": len(list(OUT.glob("*.mp3"))),
        "generated": len(sizes),
        "failed": failed,
    }
    (OUT.parent / "voice.json").write_text(json.dumps(meta, indent=2) + "\n")

    total = sum(p.stat().st_size for p in OUT.glob("*.mp3"))
    print(f"recorded {len(sizes)}, failed {len(failed)}, "
          f"{meta['count']} files, {total/1024:.0f} KB total")
    if sizes:
        print(f"average {sum(sizes)/len(sizes)/1024:.1f} KB per clip")
    for w, err in failed[:10]:
        print(f"  FAILED {w}: {err}")


if __name__ == "__main__":
    asyncio.run(main())
