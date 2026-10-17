#!/usr/bin/env python3
"""Stage one YouTube research cache day as corpus JSONL (tier market_signal).

Reads scripts/research/.cache/youtube/<date>/*.json (one file per creator, written by
youtube_sweep.py) and writes <brain>/.snapshots/corpus-youtube/<date>.jsonl in the
staging format that scripts/brain/ingest-staged-corpus.ts ingests. The output folder is
gitignored in the brain repo; nothing here touches the database or any network.

  Transcripts: chunked at ~300-400 words on caption-segment boundaries, start/end kept.
               YouTube captions or local Whisper (transcript_source in the cache); the
               label and citation say which.
  Comments:    per video, ~25 top comments per chunk (by likes), short/spam/link comments
               dropped, @handles stripped. The cache stores no author names.

Every row is tier market_signal with metadata.not_evidence = true: it shows what the market
says and responds to, never that a mechanism works.

Usage (python3 -I, stdlib only):
  python3 -I scripts/research/stage_youtube_corpus.py [--date YYYY-MM-DD | --cache-day DIR]
         [--brain DIR] [--out FILE] [--quiet]
Defaults: the latest cache day; --brain = $BRAIN_DIR or <app>/brain.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[2]
CACHE_ROOT = APP_ROOT / "scripts" / "research" / ".cache" / "youtube"

TARGET_MIN_WORDS = 300
TARGET_MAX_WORDS = 400
CLOSE_AT_WORDS = 350
TAIL_MIN_WORDS = 150
COMMENTS_PER_CHUNK = 25
MIN_COMMENT_CHARS = 30
MAX_COMMENT_WORDS = 120
PRICE_PER_MILLION_TOKENS = 0.02  # text-embedding-3-small, same figure as the ingest script
COPYRIGHT = "third_party_internal_research_only"

THEMES: dict[str, re.Pattern[str]] = {
    "self_image": re.compile(r"\bself[- ]?(image|concept|perception)\b", re.I),
    "manifestation": re.compile(r"\bmanifest\w*", re.I),
    "identity": re.compile(r"\bidentit(y|ies)\b|\bwho you are\b", re.I),
    "willpower": re.compile(r"\bwill ?power\b|\bdiscipline\w*|\bself[- ]control\b", re.I),
    "habit": re.compile(r"\bhabit\w*", re.I),
    "subconscious": re.compile(r"\b(sub|un)conscious\w*", re.I),
    "nlp": re.compile(r"\bnlp\b|\bneuro[- ]?linguistic\b|\breframe\w*|\bsubmodalit\w*", re.I),
    "frequency": re.compile(r"\bfrequenc\w*|\bvibration\w*|\bvibrational\b", re.I),
    "values": re.compile(r"\bvalues\b|\bimportant to (me|you)\b", re.I),
}

# Spam: seeded book plugs and quiz plants (see brain/research/conversation/youtube-comments.md),
# promo codes, links. Over-inclusive on purpose; a lost real comment costs little.
SPAM_NAMES = re.compile(
    r"taren veyra|dr\.? sautra|universe frequencies|law of the signal|zael veynor|mael vorran|"
    r"eric riven|hidden codex",
    re.I,
)
SPAM_PATTERNS = [
    re.compile(r"\bquiz\b", re.I),
    re.compile(r"https?://|www\.|\b\w+\.(com|net|org|io|co|ly)/", re.I),
    re.compile(r"\bbook (titled|called|named)\b", re.I),
    re.compile(r"\bwhoever finds\b|\byou.ll thank me later\b", re.I),
    re.compile(r"\bthere(.s| is) this (author|guy|book|woman|man)\b", re.I),
    re.compile(r"\b(recommend|reading|read|came across|heard of|check out)\b.{0,80}\bby [A-Z][a-z]+ [A-Z][a-z]+"),
    re.compile(r"\b[A-Z]{4,}\d{2,}\b"),  # seeded promo/gang codes like ABCDEF123
    re.compile(r"\b(whats ?app|telegram)\b", re.I),
]
HANDLE = re.compile(r"[​‌‍⁠﻿]*@[\w.\-]+")
CAPTION_TAG = re.compile(r"\[(music|applause|laughter|__)\]", re.I)


def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def nwords(s: str) -> int:
    return len(s.split())


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def mmss(sec: float) -> str:
    sec = int(sec)
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def fmt_views(v: int | None) -> str:
    if not v:
        return "? views"
    if v >= 1_000_000:
        return f"{v / 1_000_000:.1f}M views"
    if v >= 1_000:
        return f"{v / 1_000:.0f}k views"
    return f"{v} views"


def parse_votes(v) -> int:
    if isinstance(v, (int, float)):
        return int(v)
    s = str(v or "0").strip().replace(",", "").upper()
    mult = 1
    if s.endswith("K"):
        mult, s = 1_000, s[:-1]
    elif s.endswith("M"):
        mult, s = 1_000_000, s[:-1]
    try:
        return int(float(s) * mult)
    except ValueError:
        return 0


def themes_for(text: str) -> list[str]:
    return [k for k, rx in THEMES.items() if rx.search(text)]


def is_spam(text: str) -> bool:
    return bool(SPAM_NAMES.search(text)) or any(rx.search(text) for rx in SPAM_PATTERNS)


# ---------------------------------------------------------------- transcripts
def chunk_segments(segs: list[dict], duration: float | None) -> list[dict]:
    """Group caption segments into ~300-400 word chunks. Returns [{start, end, text}]."""
    items = []
    for i, s in enumerate(segs):
        text = clean(CAPTION_TAG.sub(" ", s.get("text") or ""))
        if not text:
            continue
        t = float(s.get("t") or 0)
        nxt = float(segs[i + 1].get("t") or t) if i + 1 < len(segs) else float(duration or t)
        items.append((t, max(nxt, t), text, nwords(text)))

    groups: list[list[tuple]] = []
    cur: list[tuple] = []
    cur_w = 0
    for it in items:
        if cur and cur_w + it[3] > TARGET_MAX_WORDS:
            groups.append(cur)
            cur, cur_w = [], 0
        cur.append(it)
        cur_w += it[3]
        if cur_w >= CLOSE_AT_WORDS:
            groups.append(cur)
            cur, cur_w = [], 0
    if cur:
        groups.append(cur)

    # A short tail: merge with the previous chunk and split the pair in half on a segment boundary.
    if len(groups) >= 2 and sum(i[3] for i in groups[-1]) < TAIL_MIN_WORDS:
        pair = groups.pop(-2) + groups.pop(-1)
        total, acc, cut = sum(i[3] for i in pair), 0, len(pair)
        for k, it in enumerate(pair):
            acc += it[3]
            if acc >= total / 2:
                cut = k + 1
                break
        groups += [g for g in (pair[:cut], pair[cut:]) if g]

    return [{"start": g[0][0], "end": g[-1][1], "text": " ".join(i[2] for i in g)} for g in groups]


# ---------------------------------------------------------------- comments
def usable_comments(raw: list[dict]) -> tuple[list[tuple[int, str]], dict]:
    stats = {"total": 0, "short": 0, "spam": 0, "dupe": 0}
    seen: set[str] = set()
    out: list[tuple[int, str]] = []
    for c in raw:
        stats["total"] += 1
        text = clean(HANDLE.sub(" ", c.get("text") or ""))
        if len(text) < MIN_COMMENT_CHARS:
            stats["short"] += 1
            continue
        if is_spam(text):
            stats["spam"] += 1
            continue
        key = text.lower()
        if key in seen:
            stats["dupe"] += 1
            continue
        seen.add(key)
        w = text.split()
        if len(w) > MAX_COMMENT_WORDS:
            text = " ".join(w[:MAX_COMMENT_WORDS]) + " …"
        out.append((parse_votes(c.get("votes")), text))
    out.sort(key=lambda x: -x[0])
    return out, stats


def chunk_comments(comments: list[tuple[int, str]], header_words: int) -> list[list[tuple[int, str]]]:
    chunks, cur, cur_w = [], [], header_words
    for votes, text in comments:
        w = nwords(text) + 3  # "- (N likes)" prefix
        if cur and (len(cur) >= COMMENTS_PER_CHUNK or cur_w + w > TARGET_MAX_WORDS):
            chunks.append(cur)
            cur, cur_w = [], header_words
        cur.append((votes, text))
        cur_w += w
    if cur:
        chunks.append(cur)
    return chunks


# ---------------------------------------------------------------- build
def base_record(creator: dict, pick: dict, swept_on: str) -> tuple[dict, dict]:
    vid = pick["id"]
    meta = {
        "tier": "market_signal",
        "evidence_grade": "MS",
        "video_id": vid,
        "video_title": pick.get("title") or "",
        "creator_key": creator["key"],
        "views": pick.get("views"),
        "outlier": pick.get("outlier"),
        "swept_on": swept_on,
        "not_evidence": True,
        "verify": False,
        "copyright": COPYRIGHT,
        "note": "Market signal: what the market says and responds to. Never cite as evidence for a mechanism.",
    }
    rec = {
        "tradition": "creator_research",
        "content_type": "market_signal",
        "author": creator["name"],
        "date_composed": f"{swept_on} snapshot",
        "priority": 2,
    }
    return rec, meta


def stage_day(day_dir: Path) -> tuple[list[dict], dict]:
    swept_on = day_dir.name
    rows: list[dict] = []
    report: dict = {"creators": {}, "comment_filter": {"total": 0, "short": 0, "spam": 0, "dupe": 0},
                    "videos": 0, "videos_without_transcript": 0}
    for path in sorted(day_dir.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        creator = {"key": data.get("key") or path.stem, "name": data.get("name") or path.stem}
        tally = report["creators"].setdefault(creator["key"], {"youtube_transcript": 0, "youtube_comments": 0})
        for pick in data.get("picks") or []:
            vid = pick.get("id")
            if not vid:
                continue
            report["videos"] += 1
            title = pick.get("title") or ""
            outlier = pick.get("outlier")
            label = f'{creator["name"]}, "{title}" · {fmt_views(pick.get("views"))}'
            if outlier:
                label += f" · {outlier}x channel median"
            watch = f"https://www.youtube.com/watch?v={vid}"

            tr = pick.get("transcript") or {}
            segs = (tr.get("segments") or []) if tr.get("ok") else []
            if not segs:
                report["videos_without_transcript"] += 1
            source = tr.get("transcript_source") or "youtube-captions"
            whisper = source.startswith("whisper")
            kind, cite_kind = ("local Whisper", "Local Whisper transcript") if whisper else ("auto-captions", "Auto-captions")
            for idx, ch in enumerate(chunk_segments(segs, pick.get("duration"))):
                start, end = int(ch["start"]), int(-(-ch["end"] // 1))
                content = f"Creator transcript ({kind}) · {label} · {mmss(start)}–{mmss(end)}\n\n{ch['text']}"
                rec, meta = base_record(creator, pick, swept_on)
                meta.update({
                    "source_path": f"youtube/{vid}#{idx}",
                    "content_hash": sha256(content),
                    "origin": "youtube_transcript",
                    "start_s": start,
                    "end_s": end,
                    "transcript_source": source,
                    "citation": f'{creator["name"]}, "{title}" (YouTube), {mmss(start)}–{mmss(end)}. '
                                f"{cite_kind}, swept {swept_on}.",
                })
                rows.append({**rec, "content": content, "text_name": f'yt_{creator["key"]}',
                             "source_url": f"{watch}&t={start}s", "themes": themes_for(ch["text"]),
                             "metadata": meta})
                tally["youtube_transcript"] += 1

            cm = pick.get("comments") or {}
            raw = (cm.get("comments") or []) if cm.get("ok", True) else []
            usable, stats = usable_comments(raw)
            for k, v in stats.items():
                report["comment_filter"][k] += v
            header = f"Audience comments · {label}"
            groups = chunk_comments(usable, nwords(header) + 6)  # + " · top comments a–b by likes"
            rank = 0
            for n, grp in enumerate(groups):
                first, last = rank + 1, rank + len(grp)
                rank = last
                body = "\n".join(f"- ({v} likes) {t}" for v, t in grp)
                content = f"{header} · top comments {first}–{last} by likes\n\n{body}"
                rec, meta = base_record(creator, pick, swept_on)
                meta.update({
                    "source_path": f"youtube/{vid}/comments#{n}",
                    "content_hash": sha256(content),
                    "origin": "youtube_comments",
                    "comment_count": len(grp),
                    "comment_rank_from": first,
                    "comment_rank_to": last,
                    "citation": f'YouTube audience comments on {creator["name"]}, "{title}", '
                                f"top {first}–{last} by likes, swept {swept_on}. No usernames kept.",
                })
                rows.append({**rec, "content": content, "text_name": f'yt_comments_{creator["key"]}',
                             "source_url": watch, "themes": themes_for(body), "metadata": meta})
                tally["youtube_comments"] += 1
    return rows, report


def latest_day(root: Path) -> Path | None:
    days = sorted(p for p in root.glob("20??-??-??") if p.is_dir())
    return days[-1] if days else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--date", help="cache day YYYY-MM-DD (default: latest)")
    ap.add_argument("--cache-day", help="explicit cache day directory")
    ap.add_argument("--brain", default=os.environ.get("BRAIN_DIR") or str(APP_ROOT / "brain"))
    ap.add_argument("--out", help="output JSONL (default <brain>/.snapshots/corpus-youtube/<date>.jsonl)")
    ap.add_argument("--quiet", action="store_true", help="only print the output path")
    args = ap.parse_args()

    if args.cache_day:
        day = Path(args.cache_day)
    elif args.date:
        day = CACHE_ROOT / args.date
    else:
        day = latest_day(CACHE_ROOT)
    if not day or not day.is_dir():
        print(f"no cache day found ({day or CACHE_ROOT})", file=sys.stderr)
        return 1

    rows, report = stage_day(day)
    out = Path(args.out) if args.out else Path(args.brain) / ".snapshots" / "corpus-youtube" / f"{day.name}.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(out.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    tmp.replace(out)

    if args.quiet:
        print(out)
        return 0
    chars = sum(len(r["content"]) for r in rows)
    tokens = -(-chars // 4)
    words = [nwords(r["content"]) for r in rows]
    by_origin: dict[str, int] = {}
    for r in rows:
        by_origin[r["metadata"]["origin"]] = by_origin.get(r["metadata"]["origin"], 0) + 1
    print(f"cache day: {day}")
    print(f"videos: {report['videos']} ({report['videos_without_transcript']} without a transcript)")
    print(f"chunks: {len(rows)}  by origin: {json.dumps(by_origin)}")
    print("by creator (transcript / comments):")
    for k, t in sorted(report["creators"].items()):
        print(f"  {k:<20} {t['youtube_transcript']:>4} / {t['youtube_comments']:>3}")
    cf = report["comment_filter"]
    kept = cf["total"] - cf["short"] - cf["spam"] - cf["dupe"]
    print(f"comments: {cf['total']} seen, {kept} kept (dropped: {cf['short']} short, {cf['spam']} spam/link, {cf['dupe']} duplicate)")
    if words:
        print(f"words per chunk: min {min(words)}, max {max(words)}, mean {sum(words) // len(words)}")
    print(f"embedding estimate: ~{tokens:,} tokens ≈ ${tokens / 1e6 * PRICE_PER_MILLION_TOKENS:.4f} (text-embedding-3-small)")
    print(f"wrote: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
