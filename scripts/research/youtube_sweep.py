"""
YouTube social-listening sweep for the brain.

For each creator in creators.json:
  1. list recent long-form uploads (yt-dlp, flat — one request per channel)
  2. score outliers: views / median views of the channel's recent uploads
  3. for the top N outliers, get the transcript and the most-liked comments

Raw output goes to scripts/research/.cache/youtube/<YYYY-MM-DD>/ (gitignored).
Full transcripts stay in the cache; brain/ only ever gets summaries + short quotes.

Prudent by design: small N, randomised pauses between every network call, and it
skips anything already cached for the day so re-runs don't re-hit YouTube. A video
already transcribed in an earlier cache day is reused, not fetched again.
Run locally — YouTube blocks most cloud/datacenter IPs for transcripts and comments.

Transcripts: two backends (--transcripts).
  api      YouTube's transcript endpoint (youtube_transcript_api). Fast, but it is the
           rate-limited part: a home IP got blocked after ~15 in an hour (2026-10-16), and
           the block lasts hours. Stops at the first block.
  whisper  Local transcription. yt-dlp downloads the audio only (seconds), mlx_whisper
           (whisper-large-v3-turbo, Apple Silicon) transcribes it (~45s per 27 min of
           audio), the audio is deleted right away. Only text + timestamped segments are
           kept, with transcript_source "whisper-large-v3-turbo". Paced 20-60s between
           downloads. Stops at the first yt-dlp error (HTTP 429, "Sign in to confirm",
           anything else) or whisper failure. No cookies, proxies or logins.
  auto     (default) API first; on the first block, or if a video has no captions, or if
           the API module isn't installed, use whisper for the rest of the run.

Caps: --max-transcripts (default 20) per run across backends; --max-minutes stops
starting new transcripts (and new creators) after that many minutes, so a headless
tick can't run long. Each whisper subprocess also has its own timeout.

--backfill-outliers N: after the sweep, for each selected creator, transcribe the next N
highest-outlier videos that have no transcript yet (from recent_uploads in that creator's
latest cache file). They are added to that file's picks with "backfill": true, without
comments. This deepens coverage a little every week.

Usage:
  scripts/research/.venv/bin/python -I scripts/research/youtube_sweep.py \
      [--only david-bayer,dan-koe] [--top 4] [--recent 150] [--comments 60] \
      [--transcripts auto|api|whisper] [--max-transcripts 20] [--max-minutes M] \
      [--backfill-outliers N]
  scripts/research/.venv/bin/python -I scripts/research/youtube_sweep.py --fill-missing 2026-10-16 \
      [--limit 10] [--transcripts auto|api|whisper] [--max-minutes M]
"""

import argparse
import datetime as dt
import itertools
import json
import os
import random
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import yt_dlp
from youtube_comment_downloader import SORT_BY_POPULAR, YoutubeCommentDownloader

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except Exception:  # module missing or broken: auto mode falls back to whisper
    YouTubeTranscriptApi = None

HERE = Path(__file__).resolve().parent
CACHE_ROOT = HERE / ".cache" / "youtube"

WHISPER_MODEL = "mlx-community/whisper-large-v3-turbo"
WHISPER_SOURCE = "whisper-large-v3-turbo"
API_SOURCE = "youtube-captions"
# yt-dlp messages that mean "this IP is being throttled", not "this video is broken".
BLOCK_PATTERNS = re.compile(r"\b429\b|too many requests|sign in to confirm|confirm you.re not a bot", re.I)


def pause(lo: float = 4.0, hi: float = 8.0) -> None:
    time.sleep(random.uniform(lo, hi))


def list_uploads(channel_url: str, recent: int) -> dict:
    opts = {"quiet": True, "no_warnings": True, "extract_flat": True, "playlistend": recent}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(channel_url.rstrip("/") + "/videos", download=False)
    videos = [
        {"id": e["id"], "title": e.get("title"), "views": e.get("view_count") or 0,
         "duration": e.get("duration")}
        for e in info.get("entries") or [] if e and e.get("id")
    ]
    return {"channel_id": info.get("channel_id"), "channel": info.get("channel"),
            "followers": info.get("channel_follower_count"), "videos": videos}


def score_outliers(videos: list[dict]) -> list[dict]:
    views = [v["views"] for v in videos if v["views"]]
    median = statistics.median(views) if views else 0
    for v in videos:
        v["outlier"] = round(v["views"] / median, 2) if median else 0
    return sorted(videos, key=lambda v: v["outlier"], reverse=True)


# ---------------------------------------------------------------- cache helpers
def creator_cache_files(key: str) -> list[Path]:
    """This creator's per-day cache files, oldest first (top-level day folders only)."""
    return sorted(CACHE_ROOT.glob(f"20??-??-??/{key}.json"))


def known_transcripts(key: str) -> dict[str, dict]:
    """Successful transcripts for this creator across all cache days, by video id."""
    out: dict[str, dict] = {}
    for path in creator_cache_files(key):
        try:
            data = json.loads(path.read_text())
        except Exception:
            continue
        for p in data.get("picks", []):
            if (p.get("transcript") or {}).get("ok"):
                out[p["id"]] = p["transcript"]
    return out


def write_json(path: Path, data: dict) -> None:
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False))
    tmp.replace(path)


# ---------------------------------------------------------------- transcript backends
class Blocked(Exception):
    """YouTube is rate-limiting this IP — stop asking for transcripts this run."""


class WhisperStop(Exception):
    """Stop the whisper path for the rest of the run. `unavailable` = the video itself failed."""

    def __init__(self, reason: str, unavailable: bool = False):
        super().__init__(reason)
        self.reason = reason
        self.unavailable = unavailable


def fetch_transcript(video_id: str) -> dict:
    try:
        t = YouTubeTranscriptApi().fetch(video_id)
        return {"ok": True, "transcript_source": API_SOURCE,
                "segments": [{"t": round(s.start, 1), "text": s.text} for s in t]}
    except Exception as e:  # missing captions etc. — record and move on
        if type(e).__name__ in ("IpBlocked", "RequestBlocked"):
            raise Blocked() from e
        return {"ok": False, "error": f"{type(e).__name__}: {str(e)[:200]}"}


def find_mlx_whisper() -> str | None:
    cands = [os.environ.get("MLX_WHISPER_BIN"), shutil.which("mlx_whisper")]
    cands += sorted(str(p) for p in Path.home().glob(".pyenv/versions/*/bin/mlx_whisper"))
    cands.append(str(Path.home() / ".pyenv" / "shims" / "mlx_whisper"))
    return next((c for c in cands if c and Path(c).exists()), None)


def subprocess_env() -> dict:
    """launchd's PATH is minimal; mlx_whisper needs ffmpeg."""
    env = dict(os.environ)
    parts = env.get("PATH", "").split(":")
    for extra in ("/opt/homebrew/bin", "/usr/local/bin"):
        if extra not in parts:
            parts.append(extra)
    env["PATH"] = ":".join(p for p in parts if p)
    return env


class _YdlLogger:
    """Collect yt-dlp messages instead of printing them; the caller reports the error."""

    def __init__(self):
        self.errors: list[str] = []

    def debug(self, msg):
        pass

    def info(self, msg):
        pass

    def warning(self, msg):
        pass

    def error(self, msg):
        self.errors.append(str(msg))


def whisper_transcribe(video_id: str, binary: str, timeout_cap: float | None) -> dict:
    """Download audio to a temp dir, transcribe with mlx_whisper, delete the audio.
    Raises WhisperStop on any failure."""
    tmp = Path(tempfile.mkdtemp(prefix="qs-whisper-"))
    try:
        t0 = time.time()
        log = _YdlLogger()
        opts = {"quiet": True, "no_warnings": True, "noprogress": True, "noplaylist": True,
                "format": "bestaudio[ext=m4a]/bestaudio", "outtmpl": str(tmp / "%(id)s.%(ext)s"),
                "socket_timeout": 30, "retries": 1, "fragment_retries": 1, "logger": log}
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=True)
        except Exception as e:
            msg = " | ".join(log.errors) or f"{type(e).__name__}: {e}"
            blocked = bool(BLOCK_PATTERNS.search(msg))
            raise WhisperStop(f"yt-dlp: {msg[:300]}", unavailable=not blocked) from e
        audio = next((p for p in tmp.iterdir() if p.stem == video_id and p.suffix != ".json"), None)
        if audio is None:
            raise WhisperStop("yt-dlp: no audio file written", unavailable=True)
        dl_s = time.time() - t0
        duration = float(info.get("duration") or 0)

        timeout = 180 + 0.5 * duration  # measured ~0.03x realtime; this is generous
        if timeout_cap is not None:
            timeout = max(60.0, min(timeout, timeout_cap))
        t1 = time.time()
        cmd = [binary, str(audio), "--model", WHISPER_MODEL, "--output-format", "json",
               "--output-dir", str(tmp), "--output-name", video_id, "--language", "en",
               "--verbose", "False",
               # Stops Whisper looping on one line (seen on 2 of 18 videos, 2026-10-17).
               "--condition-on-previous-text", "False"]
        try:
            subprocess.run(cmd, check=True, timeout=timeout, capture_output=True, text=True,
                           env=subprocess_env())
        except subprocess.TimeoutExpired as e:
            raise WhisperStop(f"mlx_whisper timed out after {int(timeout)}s") from e
        except subprocess.CalledProcessError as e:
            tail = (e.stderr or e.stdout or "").strip().splitlines()[-3:]
            raise WhisperStop(f"mlx_whisper exit {e.returncode}: {' / '.join(tail)[:300]}") from e
        finally:
            audio.unlink(missing_ok=True)  # audio never outlives the transcription
        wh_s = time.time() - t1

        out = json.loads((tmp / f"{video_id}.json").read_text())
        segments = [{"t": round(float(s["start"]), 1), "end": round(float(s["end"]), 1),
                     "text": s["text"].strip()}
                    for s in out.get("segments", []) if (s.get("text") or "").strip()]
        if not segments:
            raise WhisperStop("mlx_whisper returned no segments", unavailable=True)
        return {"ok": True, "transcript_source": WHISPER_SOURCE, "language": "en",
                "transcribed_at": dt.datetime.now().isoformat(timespec="seconds"),
                "audio_seconds": round(duration), "download_seconds": round(dl_s, 1),
                "whisper_seconds": round(wh_s, 1), "segments": segments}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


class Transcriber:
    """One per run: picks the backend, enforces the cap, the deadline and the pacing."""

    def __init__(self, mode: str, cap: int, max_minutes: float | None):
        self.mode = mode
        self.cap = cap
        self.deadline = time.time() + max_minutes * 60 if max_minutes else None
        self.used = 0
        self.api_off = mode == "whisper" or YouTubeTranscriptApi is None
        self.api_reason = "module not installed" if YouTubeTranscriptApi is None and mode != "whisper" else None
        self.whisper_bin = find_mlx_whisper() if mode != "api" else None
        self.whisper_stop = None if self.whisper_bin or mode == "api" else "mlx_whisper not found"
        self.downloads = 0
        self.stats = {"api": 0, "whisper": 0, "reused": 0, "failed": 0,
                      "audio_s": 0.0, "whisper_s": 0.0}
        self.t0 = time.time()
        if mode == "api" and YouTubeTranscriptApi is None:
            print("  ! youtube_transcript_api is not installed; --transcripts api can't fetch anything")

    def exhausted(self) -> str | None:
        """Why no more transcripts can be fetched this run, or None."""
        if self.used >= self.cap:
            return f"--max-transcripts {self.cap} reached"
        if self.deadline and time.time() >= self.deadline:
            return "--max-minutes reached"
        api_dead = self.api_off or self.mode == "whisper"
        whisper_dead = self.mode == "api" or self.whisper_stop is not None
        if api_dead and whisper_dead:
            return f"no backend left (api: {self.api_reason or 'off'}; whisper: {self.whisper_stop or 'off'})"
        return None

    def get(self, video_id: str) -> dict:
        why = self.exhausted()
        if why:
            return {"ok": False, "error": f"skipped: {why}"}
        self.used += 1
        res = None
        if not self.api_off:
            try:
                res = fetch_transcript(video_id)
            except Blocked:
                self.api_off, self.api_reason = True, "IpBlocked"
                if self.mode == "api":
                    print("  ! YouTube is blocking transcript requests from this IP — skipping the rest. "
                          "Re-run later with --fill-missing, or use --transcripts whisper.")
                    self.stats["failed"] += 1
                    return {"ok": False, "error": "IpBlocked"}
                print("  ! transcript API blocked — switching to local whisper for the rest of this run")
            if res and res["ok"]:
                self.stats["api"] += 1
                return res
            if res and self.mode == "api":
                self.stats["failed"] += 1
                return res
        if self.mode == "api":
            self.stats["failed"] += 1
            return {"ok": False, "error": "skipped: API unavailable"}
        return self._whisper(video_id, api_error=(res or {}).get("error"))

    def _whisper(self, video_id: str, api_error: str | None = None) -> dict:
        if self.whisper_stop:
            self.stats["failed"] += 1
            return {"ok": False, "error": f"skipped: whisper stopped earlier ({self.whisper_stop})"}
        if self.downloads:
            pause(20, 60)
        self.downloads += 1
        cap = None
        if self.deadline:
            cap = self.deadline - time.time() + 120  # finish the current one, but not forever
        try:
            res = whisper_transcribe(video_id, self.whisper_bin, cap)
        except WhisperStop as e:
            self.whisper_stop = e.reason
            self.stats["failed"] += 1
            print(f"  ! whisper path stopped: {e.reason}")
            out = {"ok": False, "error": f"whisper: {e.reason}"}
            if e.unavailable:
                out["unavailable"] = True
            return out
        self.stats["whisper"] += 1
        self.stats["audio_s"] += res["audio_seconds"]
        self.stats["whisper_s"] += res["whisper_seconds"]
        if api_error:
            res["api_error"] = api_error[:200]
        print(f"    whisper: {res['audio_seconds'] / 60:.1f} min audio, download {res['download_seconds']}s, "
              f"transcribe {res['whisper_seconds']}s, {len(res['segments'])} segments")
        return res

    def summary(self) -> str:
        s = self.stats
        parts = [f"api {s['api']}", f"whisper {s['whisper']}", f"reused {s['reused']}", f"failed {s['failed']}"]
        if s["whisper"]:
            parts.append(f"{s['audio_s'] / 60:.1f} min audio in {s['whisper_s']:.0f}s of whisper")
        parts.append(f"run {time.time() - self.t0:.0f}s")
        if self.api_reason and self.mode != "whisper":
            parts.append(f"api off: {self.api_reason}")
        if self.whisper_stop and self.mode != "api":
            parts.append(f"whisper stopped: {self.whisper_stop}")
        return "[transcripts] " + ", ".join(parts)


# ---------------------------------------------------------------- modes
def fill_missing(day_dir: Path, tr: Transcriber) -> int:
    """Retry failed transcripts in an existing cache day (reusing earlier days' transcripts
    where they exist), within the run's cap and deadline."""
    if not day_dir.is_dir():
        print(f"! no cache day {day_dir}")
        return 1
    for path in sorted(day_dir.glob("*.json")):
        data = json.loads(path.read_text())
        missing = [v for v in data.get("picks", [])
                   if not v["transcript"].get("ok") and not v["transcript"].get("unavailable")]
        if not missing:
            continue
        known = known_transcripts(data["key"])
        for v in missing:
            if v["id"] in known:
                v["transcript"] = known[v["id"]]
                tr.stats["reused"] += 1
                print(f"[fill] {data['key']} {v['id']} reused from an earlier cache day")
                write_json(path, data)
                continue
            why = tr.exhausted()
            if why:
                print(f"[fill] stopping: {why}")
                return 0
            pause()
            v["transcript"] = tr.get(v["id"])
            print(f"[fill] {data['key']} {v['id']} {'ok' if v['transcript']['ok'] else 'FAIL'}")
            if v["transcript"]["ok"] or v["transcript"].get("unavailable"):
                write_json(path, data)
    return 0


def backfill_outliers(creators: list[dict], n: int, tr: Transcriber) -> None:
    """For each creator, transcribe the next n highest-outlier uploads without a transcript."""
    for c in creators:
        files = creator_cache_files(c["key"])
        if not files:
            print(f"[backfill] {c['key']}: no cache yet")
            continue
        path = files[-1]
        data = json.loads(path.read_text())
        known = known_transcripts(c["key"])
        skip = data.setdefault("transcript_skip", {})
        picks = {p["id"]: p for p in data.get("picks", [])}
        todo = [u for u in sorted(data.get("recent_uploads", []), key=lambda u: u.get("outlier") or 0, reverse=True)
                if u["id"] not in known and u["id"] not in skip
                and not (picks.get(u["id"], {}).get("transcript") or {}).get("unavailable")][:n]
        print(f"[backfill] {c['key']} ({path.parent.name}): {len(todo)} to do")
        for u in todo:
            why = tr.exhausted()
            if why:
                print(f"[backfill] stopping: {why}")
                return
            pause()
            print(f"  [transcript] {u['id']} x{u.get('outlier')} {u.get('title')}")
            t = tr.get(u["id"])
            if u["id"] in picks:
                picks[u["id"]]["transcript"] = t
            elif t["ok"]:
                data["picks"].append({**{k: u.get(k) for k in ("id", "title", "views")},
                                      "duration": t.get("audio_seconds"), "outlier": u.get("outlier"),
                                      "transcript": t, "comments": {"ok": True, "comments": []},
                                      "backfill": True})
            elif t.get("unavailable"):
                skip[u["id"]] = t["error"][:200]
            if t["ok"] or t.get("unavailable"):
                write_json(path, data)
            print(f"    transcript={'ok' if t['ok'] else 'FAIL'}")


def fetch_comments(video_id: str, limit: int) -> dict:
    try:
        it = YoutubeCommentDownloader().get_comments(video_id, sort_by=SORT_BY_POPULAR)
        out = [{"votes": c.get("votes"), "text": c.get("text"), "reply": c.get("reply", False)}
               for c in itertools.islice(it, limit)]
        return {"ok": True, "comments": out}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {str(e)[:200]}"}


def sweep(creators: list[dict], args, tr: Transcriber) -> None:
    out_dir = CACHE_ROOT / dt.date.today().isoformat()
    out_dir.mkdir(parents=True, exist_ok=True)
    for c in creators:
        path = out_dir / f"{c['key']}.json"
        if path.exists():
            print(f"[skip] {c['key']} already cached today")
            continue
        if tr.deadline and time.time() >= tr.deadline:
            print("[sweep] --max-minutes reached; no more creators this run")
            return
        print(f"[list] {c['key']}")
        try:
            chan = list_uploads(c["url"], args.recent)
        except Exception as e:
            print(f"  ! listing failed: {e}")
            continue
        ranked = score_outliers(chan["videos"])
        known = known_transcripts(c["key"])
        picks = []
        for v in ranked[: args.top]:
            print(f"  [transcript] {v['id']} x{v['outlier']} {v['title']}")
            if v["id"] in known:
                v["transcript"] = known[v["id"]]
                tr.stats["reused"] += 1
                print("    reused from an earlier cache day")
            else:
                if not tr.exhausted():
                    pause()
                v["transcript"] = tr.get(v["id"])
            pause()
            v["comments"] = fetch_comments(v["id"], args.comments)
            print(f"    transcript={'ok' if v['transcript']['ok'] else 'FAIL'} "
                  f"comments={len(v['comments'].get('comments', []))}")
            picks.append(v)
        write_json(path, {
            **{k: c[k] for k in ("key", "name", "url")},
            "fetched_at": dt.datetime.now().isoformat(timespec="seconds"),
            "channel": {k: chan[k] for k in ("channel_id", "channel", "followers")},
            "median_views": statistics.median([v["views"] for v in ranked if v["views"]] or [0]),
            "recent_uploads": [{k: v[k] for k in ("id", "title", "views", "outlier")} for v in ranked],
            "picks": picks,
        })
        print(f"  -> {path.relative_to(HERE.parent.parent)}")
        pause(6, 12)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="comma-separated creator keys from creators.json")
    ap.add_argument("--top", type=int, default=4)
    ap.add_argument("--recent", type=int, default=150)
    ap.add_argument("--comments", type=int, default=60)
    ap.add_argument("--fill-missing", metavar="YYYY-MM-DD",
                    help="retry failed transcripts in that day's cache instead of sweeping")
    ap.add_argument("--limit", type=int, help="with --fill-missing: max transcripts to attempt")
    ap.add_argument("--transcripts", choices=("auto", "api", "whisper"), default="auto",
                    help="transcript backend (default auto: API until the first block, then whisper)")
    ap.add_argument("--max-transcripts", type=int, default=20, help="per-run cap on fetched transcripts")
    ap.add_argument("--max-minutes", type=float,
                    help="stop starting new transcripts/creators after this many minutes")
    ap.add_argument("--backfill-outliers", type=int, default=0, metavar="N",
                    help="after the sweep, transcribe each creator's next N untranscribed outliers")
    args = ap.parse_args()

    cap = args.max_transcripts
    if args.fill_missing and args.limit is not None:
        cap = min(cap, args.limit)
    tr = Transcriber(args.transcripts, cap, args.max_minutes)

    try:
        if args.fill_missing:
            return fill_missing(CACHE_ROOT / args.fill_missing, tr)

        creators = json.loads((HERE / "creators.json").read_text())
        if args.only:
            keep = set(args.only.split(","))
            creators = [c for c in creators if c["key"] in keep]
        sweep(creators, args, tr)
        if args.backfill_outliers > 0:
            backfill_outliers(creators, args.backfill_outliers, tr)
        return 0
    finally:
        print(tr.summary())


if __name__ == "__main__":
    sys.exit(main())
