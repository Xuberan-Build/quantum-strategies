"""
YouTube social-listening sweep for the brain.

For each creator in creators.json:
  1. list recent long-form uploads (yt-dlp, flat — one request per channel)
  2. score outliers: views / median views of the channel's recent uploads
  3. for the top N outliers, fetch the transcript and the most-liked comments

Raw output goes to scripts/research/.cache/youtube/<YYYY-MM-DD>/ (gitignored).
Full transcripts stay in the cache; brain/ only ever gets summaries + short quotes.

Prudent by design: small N, randomised pauses between every network call, and it
skips anything already cached for the day so re-runs don't re-hit YouTube.
Run locally — YouTube blocks most cloud/datacenter IPs for transcripts and comments.

Transcripts are the rate-limited part: a home IP got blocked after ~15 in an hour
(2026-10-16). The sweep stops requesting transcripts at the first block; fill the gaps
later with --fill-missing. Keep runs to ~10 transcripts.

Usage:
  scripts/research/.venv/bin/python -I scripts/research/youtube_sweep.py \
      [--only david-bayer,dan-koe] [--top 4] [--recent 150] [--comments 60]
  scripts/research/.venv/bin/python -I scripts/research/youtube_sweep.py --fill-missing 2026-10-16 [--limit 10]
"""

import argparse
import datetime as dt
import itertools
import json
import random
import statistics
import sys
import time
from pathlib import Path

import yt_dlp
from youtube_comment_downloader import SORT_BY_POPULAR, YoutubeCommentDownloader
from youtube_transcript_api import YouTubeTranscriptApi

HERE = Path(__file__).resolve().parent
CACHE_ROOT = HERE / ".cache" / "youtube"


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


class Blocked(Exception):
    """YouTube is rate-limiting this IP — stop asking for transcripts this run."""


def fetch_transcript(video_id: str) -> dict:
    try:
        t = YouTubeTranscriptApi().fetch(video_id)
        return {"ok": True, "segments": [{"t": round(s.start, 1), "text": s.text} for s in t]}
    except Exception as e:  # missing captions etc. — record and move on
        if type(e).__name__ in ("IpBlocked", "RequestBlocked"):
            raise Blocked() from e
        return {"ok": False, "error": f"{type(e).__name__}: {str(e)[:200]}"}


def get_transcript(video_id: str, state: dict) -> dict:
    if state["blocked"]:
        return {"ok": False, "error": "skipped: IP blocked earlier this run"}
    try:
        return fetch_transcript(video_id)
    except Blocked:
        state["blocked"] = True
        print("  ! YouTube is blocking transcript requests from this IP — skipping the rest. "
              "Re-run later with --fill-missing.")
        return {"ok": False, "error": "IpBlocked"}


def fill_missing(day_dir: Path, limit: int | None = None) -> int:
    """Retry failed transcripts in an existing cache day, stopping at the first block
    (or after `limit` attempts)."""
    state = {"blocked": False}
    attempts = 0
    for path in sorted(day_dir.glob("*.json")):
        data = json.loads(path.read_text())
        changed = False
        for v in data["picks"]:
            if v["transcript"].get("ok") or state["blocked"]:
                continue
            if limit is not None and attempts >= limit:
                break
            attempts += 1
            pause()
            v["transcript"] = get_transcript(v["id"], state)
            print(f"[fill] {data['key']} {v['id']} {'ok' if v['transcript']['ok'] else 'FAIL'}")
            changed = changed or v["transcript"]["ok"]
        if changed:
            path.write_text(json.dumps(data, indent=1, ensure_ascii=False))
    return 0


def fetch_comments(video_id: str, limit: int) -> dict:
    try:
        it = YoutubeCommentDownloader().get_comments(video_id, sort_by=SORT_BY_POPULAR)
        out = [{"votes": c.get("votes"), "text": c.get("text"), "reply": c.get("reply", False)}
               for c in itertools.islice(it, limit)]
        return {"ok": True, "comments": out}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {str(e)[:200]}"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="comma-separated creator keys from creators.json")
    ap.add_argument("--top", type=int, default=4)
    ap.add_argument("--recent", type=int, default=150)
    ap.add_argument("--comments", type=int, default=60)
    ap.add_argument("--fill-missing", metavar="YYYY-MM-DD",
                    help="retry failed transcripts in that day's cache instead of sweeping")
    ap.add_argument("--limit", type=int, help="with --fill-missing: max transcripts to attempt")
    args = ap.parse_args()

    if args.fill_missing:
        return fill_missing(CACHE_ROOT / args.fill_missing, args.limit)

    creators = json.loads((HERE / "creators.json").read_text())
    if args.only:
        keep = set(args.only.split(","))
        creators = [c for c in creators if c["key"] in keep]

    out_dir = CACHE_ROOT / dt.date.today().isoformat()
    out_dir.mkdir(parents=True, exist_ok=True)
    state = {"blocked": False}

    for c in creators:
        path = out_dir / f"{c['key']}.json"
        if path.exists():
            print(f"[skip] {c['key']} already cached today")
            continue
        print(f"[list] {c['key']}")
        try:
            chan = list_uploads(c["url"], args.recent)
        except Exception as e:
            print(f"  ! listing failed: {e}")
            continue
        ranked = score_outliers(chan["videos"])
        picks = []
        for v in ranked[: args.top]:
            pause()
            print(f"  [transcript] {v['id']} x{v['outlier']} {v['title']}")
            v["transcript"] = get_transcript(v["id"], state)
            pause()
            v["comments"] = fetch_comments(v["id"], args.comments)
            print(f"    transcript={'ok' if v['transcript']['ok'] else 'FAIL'} "
                  f"comments={len(v['comments'].get('comments', []))}")
            picks.append(v)
        path.write_text(json.dumps({
            **{k: c[k] for k in ("key", "name", "url")},
            "fetched_at": dt.datetime.now().isoformat(timespec="seconds"),
            "channel": {k: chan[k] for k in ("channel_id", "channel", "followers")},
            "median_views": statistics.median([v["views"] for v in ranked if v["views"]] or [0]),
            "recent_uploads": [{k: v[k] for k in ("id", "title", "views", "outlier")} for v in ranked],
            "picks": picks,
        }, indent=1, ensure_ascii=False))
        print(f"  -> {path.relative_to(HERE.parent.parent)}")
        pause(6, 12)
    return 0


if __name__ == "__main__":
    sys.exit(main())
