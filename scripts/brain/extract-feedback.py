#!/usr/bin/env python3
"""
Pull the founder's own typed messages out of a Claude Code session transcript (.jsonl),
for the brain's feedback log (brain/feedback/).

Keeps only real human-typed text: user-role records that are not meta, not sidechain
(subagents), not tool results, not task notifications. Strips system reminders, command
output, pasted-content blocks and base64 blobs. Each message carries its timestamp and a
short excerpt of the assistant text that came right before it (what he was reacting to).
Also keeps messages typed mid-turn (queued_command attachments from a human) and his
answers to AskUserQuestion prompts (prefixed "[answered a question]").

Usage:
  python3 -I extract-feedback.py <transcript.jsonl> [--since ISO_TS] [--out FILE]
  python3 -I extract-feedback.py <transcript.jsonl> --stats      # JSON stats only

--since: only messages with a timestamp strictly after this ISO time (the tick keeps a
per-session watermark so a resumed session is never processed twice).
Stats JSON: {"session_id", "messages", "last_ts"}
Standard library only.
"""

import argparse
import json
import re
import sys
from pathlib import Path

NOISE = re.compile(
    r"<(system-reminder|command-name|command-message|command-args|local-command-stdout|"
    r"local-command-stderr|local-command-caveat|user-prompt-submit-hook|bash-input|bash-stdout|"
    r"bash-stderr|pasted_content|task-notification|agent-message)\b[^>]*>.*?</\1[^>]*>",
    re.S,
)
SKIP_PREFIXES = ("[Request interrupted", "<task-notification", "<agent-message", "Caveat:", "[Image")
COMPACTION = "This session is being continued from a previous conversation"
CONTEXT_CHARS = 400   # excerpt of the assistant turn he was reacting to
MSG_CHARS = 3000      # clip a single message in the middle beyond this


def clean(text: str) -> str:
    text = re.sub(r"<pasted_content\b[^>]*>.*?</pasted_content[^>]*>", "[pasted]", text, flags=re.S)
    text = re.sub(r"<artifact-content-authored-by-others\s*/>", "", text)
    text = NOISE.sub("", text)
    text = re.sub(r"data:[\w/+.-]+;base64,[A-Za-z0-9+/=]{100,}", "[base64 blob]", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) > MSG_CHARS:
        text = text[: MSG_CHARS // 2] + "\n[... clipped ...]\n" + text[-MSG_CHARS // 2 :]
    return text


def user_text(content) -> str | None:
    """Human-typed text only; None if the record is a tool result or other machinery."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for b in content:
            if not isinstance(b, dict):
                continue
            if b.get("type") == "tool_result":
                return None
            if b.get("type") == "text":
                parts.append(b.get("text", ""))
        return "\n".join(parts) if parts else None
    return None


def assistant_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")
    return ""


def extract(path: Path, since: str | None):
    msgs = []
    seen: set[str] = set()
    asks: set[str] = set()
    sid = None
    last_assistant = ""
    with path.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            kind = rec.get("type")
            if rec.get("isSidechain"):
                continue
            # messages typed while Claude was mid-turn arrive as queued_command attachments
            att = rec.get("attachment") if kind == "attachment" else None
            if att and att.get("type") == "queued_command" and (att.get("origin") or {}).get("kind") == "human":
                sid = sid or rec.get("sessionId")
                add(msgs, seen, rec.get("timestamp") or "", att.get("prompt") or "", last_assistant, since)
                continue
            if kind not in ("user", "assistant") or rec.get("isMeta") or rec.get("isCompactSummary"):
                continue
            sid = sid or rec.get("sessionId")
            content = (rec.get("message") or {}).get("content")
            if kind == "assistant":
                if isinstance(content, list):
                    asks.update(b.get("id") for b in content if isinstance(b, dict)
                                and b.get("type") == "tool_use" and b.get("name") == "AskUserQuestion")
                t = assistant_text(content).strip()
                if t:
                    last_assistant = t
                continue
            if isinstance(content, list):   # answers to AskUserQuestion come back as tool results
                for b in content:
                    if isinstance(b, dict) and b.get("type") == "tool_result" and b.get("tool_use_id") in asks:
                        ans = b.get("content")
                        if isinstance(ans, list):
                            ans = " ".join(x.get("text", "") for x in ans if isinstance(x, dict))
                        ans = re.sub(r"\s*(Read the answers carefully|You can now continue).*$", "", str(ans or ""), flags=re.S)
                        add(msgs, seen, rec.get("timestamp") or "", "[answered a question] " + ans, last_assistant, since)
            raw = user_text(content)
            if raw is None:
                continue
            add(msgs, seen, rec.get("timestamp") or "", raw, last_assistant, since)
    msgs.sort(key=lambda m: m["ts"])
    return msgs, sid


def add(msgs, seen, ts, raw, last_assistant, since):
    if raw.lstrip().startswith(SKIP_PREFIXES) or COMPACTION in raw:
        return
    text = clean(raw)
    if not text or text == "[pasted]" or text in seen:
        return
    if not ts or (since and ts <= since):
        return
    seen.add(text)
    ctx = re.sub(r"\s+", " ", NOISE.sub("", last_assistant)).strip()
    if len(ctx) > CONTEXT_CHARS:
        ctx = "..." + ctx[-CONTEXT_CHARS:]
    msgs.append({"ts": ts, "text": text, "context": ctx})


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("transcript")
    ap.add_argument("--since")
    ap.add_argument("--out")
    ap.add_argument("--stats", action="store_true")
    args = ap.parse_args()
    path = Path(args.transcript)
    if not path.is_file():
        print(f"no such transcript: {path}", file=sys.stderr)
        return 2
    msgs, sid = extract(path, args.since)
    last_ts = msgs[-1]["ts"] if msgs else None
    if args.stats:
        print(json.dumps({"session_id": sid, "messages": len(msgs), "last_ts": last_ts}))
        return 0
    out = [f"<!-- founder messages: session={sid} since={args.since or 'start'} count={len(msgs)} -->\n"]
    for m in msgs:
        out.append(f"## {m['ts']}\n")
        if m["context"]:
            out.append(f"_Reacting to (assistant, excerpt):_ {m['context']}\n")
        out.append("**Founder:**\n")
        out.append(m["text"] + "\n")
    body = "\n".join(out)
    if args.out:
        Path(args.out).write_text(body, encoding="utf-8")
    else:
        sys.stdout.write(body)
    return 0


if __name__ == "__main__":
    sys.exit(main())
