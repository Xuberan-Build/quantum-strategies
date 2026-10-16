#!/usr/bin/env bash
# Claude Code SessionEnd hook -> queue the transcript and kick off a detached brain tick.
# Reads hook JSON on stdin: {"session_id","transcript_path","cwd","reason",...}
# Must return immediately and never fail the session exit.

# Recursion guard: headless claude runs launched by the tick fire SessionEnd too.
[ "${BRAIN_TICK:-}" = "1" ] && exit 0

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$DIR/.queue" "$DIR/logs" 2>/dev/null || exit 0

input="$(cat 2>/dev/null || true)"
tp="$(printf '%s' "$input" | /usr/bin/jq -r '.transcript_path // empty' 2>/dev/null || true)"
if [ -n "$tp" ]; then
  printf '%s\n' "$tp" >>"$DIR/.queue/sessions.txt"
fi

# Fully detached: new session, no stdin, output to the launcher log; the tick logs itself.
nohup /bin/bash "$DIR/tick.sh" </dev/null >>"$DIR/logs/launcher.log" 2>&1 &
disown 2>/dev/null || true
exit 0
