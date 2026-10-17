#!/usr/bin/env bash
# Brain tick: the self-running maintainer of the Quantum Strategies second brain.
#
# Triggers: the Claude Code SessionEnd hook (on-session-end.sh) and a weekly launchd job.
# Works in an isolated git worktree of the PRIVATE brain repo (~/.quantum-brain-auto, branch
# `auto`), never in the user's brain/ checkout and never in the app repo's git.
#
# Stages: journal -> feedback -> research (24h) -> customers (7d) -> lenses (7d) -> bridge -> commit -> snapshot -> ship
# Headless claude only reads/writes files (no Bash). All fetching, git, uploads happen here.
#
# Usage: scripts/brain/tick.sh [--dry-run] [--force-research] [--force-lenses] [--no-upload]
#                              [--only journal|feedback|research|customers|lenses|bridge|graph|snapshot]
# Env: BRAIN_CORPUS_SYNC=1 lets the bridge stage really sync brain -> corpus (still needs today's backup).
#      BRAIN_YOUTUBE_CORPUS=1 lets the research stage really ingest YouTube research (market_signal tier; same guard).
# See scripts/brain/README.md.

set -Eeuo pipefail
export BRAIN_TICK=1

# ---------------------------------------------------------------- paths / config
# realpath: canonical on-disk path, including letter case (macOS is case-insensitive but the
# claude permission rules below are path strings, so they must match the real spelling)
canon() { /bin/realpath "$1" 2>/dev/null || python3 -I -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$1"; }
SCRIPT_DIR="$(canon "$(dirname "${BASH_SOURCE[0]}")")"
APP_ROOT="$(canon "$SCRIPT_DIR/../..")"
# Local, untracked switches (e.g. BRAIN_YOUTUBE_CORPUS=1, BRAIN_MODEL=sonnet). The session-end
# hook and launchd don't share a shell profile, so both read them from here.
if [ -f "$SCRIPT_DIR/tick.env" ]; then
  set -a; . "$SCRIPT_DIR/tick.env"; set +a
fi
BRAIN_SRC="$APP_ROOT/brain"                       # user's checkout (main) — only used to host the worktree
WT="${BRAIN_WORKTREE:-$HOME/.quantum-brain-auto}" # the tick's isolated worktree (branch auto)
BRAIN_REPO="Xuberan-Build/quantum-brain"
BRANCH="auto"

QUEUE_DIR="$SCRIPT_DIR/.queue"
LOCK="$SCRIPT_DIR/.lock"
LOG_DIR="$SCRIPT_DIR/logs"
STATE="$SCRIPT_DIR/.state.json"
PROMPTS="$SCRIPT_DIR/prompts"
RESEARCH_DIR="$APP_ROOT/scripts/research"
CACHE_DIR="$RESEARCH_DIR/.cache/youtube"
SCHEMA_DIR="$APP_ROOT/src/lib/brain"

CLAUDE_BIN="${CLAUDE_BIN:-$HOME/.local/bin/claude}"
BRAIN_MODEL="${BRAIN_MODEL:-opus}"
BRAIN_MAX_TURNS="${BRAIN_MAX_TURNS:-60}"
BRAIN_MAX_BUDGET_USD="${BRAIN_MAX_BUDGET_USD:-5}"
MIN_USER_TURNS="${BRAIN_MIN_USER_TURNS:-5}"
TRANSCRIPT_BUDGET="${BRAIN_TRANSCRIPT_BUDGET:-10}"  # max YouTube transcripts per tick
TOP_PER_CREATOR=3
MAX_CREATORS_PER_TICK=3
RESEARCH_EVERY=$((24 * 3600))
CUSTOMERS_EVERY=$((7 * 24 * 3600))
LENSES_EVERY=$((7 * 24 * 3600))
STALE_LOCK=$((3 * 3600))

# ---------------------------------------------------------------- flags
DRY_RUN=0 FORCE_RESEARCH=0 FORCE_LENSES=0 NO_UPLOAD=0 ONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --force-research) FORCE_RESEARCH=1 ;;
    --force-lenses) FORCE_LENSES=1 ;;
    --no-upload) NO_UPLOAD=1 ;;
    --only) ONLY="${2:-}"; shift ;;
    --only=*) ONLY="${1#--only=}" ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done
case "$ONLY" in ""|journal|feedback|research|customers|lenses|bridge|graph|snapshot) ;; *) echo "--only must be journal|feedback|research|customers|lenses|bridge|graph|snapshot" >&2; exit 2 ;; esac

# ---------------------------------------------------------------- logging
mkdir -p "$LOG_DIR" "$QUEUE_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/tick-$TS.log"
if [ -t 1 ]; then exec > >(tee -a "$LOG") 2>&1; else exec >>"$LOG" 2>&1; fi
# keep the last 30 tick logs
# shellcheck disable=SC2012
{ ls -1t "$LOG_DIR"/tick-*.log 2>/dev/null || true; } | tail -n +31 | while IFS= read -r old; do rm -f "$old"; done

for f in "$LOG_DIR/launcher.log" "$LOG_DIR/launchd.log"; do   # cap the append-only logs at ~1 MB
  if [ -f "$f" ] && [ "$(wc -c <"$f")" -gt 1048576 ]; then tail -n 2000 "$f" >"$f.tmp" && mv "$f.tmp" "$f"; fi
done

log()  { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
warn() { log "WARN: $*"; }
dry()  { [ "$DRY_RUN" = 1 ]; }
now()  { date +%s; }

STEP="setup"
SUMMARY=()   # human-readable lines for the commit / PR

# ---------------------------------------------------------------- failure handling
open_issue() { # $1 = title suffix
  local title="brain tick failed: $1 ($TS)"
  if dry; then log "[dry-run] would open issue: $title"; return 0; fi
  gh label create brain-tick --repo "$BRAIN_REPO" --color B60205 \
    --description "Automated brain tick failures" >/dev/null 2>&1 || true
  gh issue create --repo "$BRAIN_REPO" --label brain-tick --title "$title" \
    --body "$(printf 'Step: `%s`\nHost: %s\nLog: `%s`\n\nLast 50 log lines:\n```\n%s\n```\n' \
      "$1" "$(hostname -s)" "$LOG" "$(tail -n 50 "$LOG")")" >/dev/null 2>&1 \
    || log "could not open GitHub issue (gh failed)"
}

on_error() {
  local code=$? line=${1:-?}
  trap - ERR
  log "FAILED in step '$STEP' (line $line, exit $code)"
  open_issue "$STEP"
  exit "$code"
}
trap 'on_error $LINENO' ERR

# ---------------------------------------------------------------- lock
take_lock() {
  if mkdir "$LOCK" 2>/dev/null; then echo $$ >"$LOCK/pid"; return 0; fi
  local age=$(( $(now) - $(stat -f %m "$LOCK" 2>/dev/null || now) ))
  if [ "$age" -gt "$STALE_LOCK" ]; then
    warn "clearing stale lock (${age}s old)"
    rm -rf "$LOCK"
    mkdir "$LOCK" && echo $$ >"$LOCK/pid" && return 0
  fi
  log "another tick is running (lock ${age}s old) — exiting"
  exit 0
}
release_lock() { if [ -f "$LOCK/pid" ] && [ "$(cat "$LOCK/pid")" = "$$" ]; then rm -rf "$LOCK"; fi; }
take_lock
trap release_lock EXIT

# ---------------------------------------------------------------- state (.state.json)
[ -f "$STATE" ] || echo '{}' >"$STATE"
state_get() { jq -r --arg k "$1" '.[$k] // empty' "$STATE"; }
state_set() { # key value(json)
  if dry; then log "[dry-run] would set state $1=$2"; return 0; fi
  local tmp; tmp="$(mktemp "$STATE.XXXX")"
  jq --arg k "$1" --argjson v "$2" '.[$k] = $v' "$STATE" >"$tmp" && mv "$tmp" "$STATE"
}
due() { # key interval -> 0 if due
  local last; last="$(state_get "$1")"
  [ -z "$last" ] || [ $(( $(now) - last )) -ge "$2" ]
}
want() { [ -z "$ONLY" ] || [ "$ONLY" = "$1" ]; }

log "brain tick start (dry_run=$DRY_RUN only=${ONLY:-all} force_research=$FORCE_RESEARCH force_lenses=$FORCE_LENSES no_upload=$NO_UPLOAD)"
log "app=$APP_ROOT worktree=$WT model=$BRAIN_MODEL"

# ---------------------------------------------------------------- worktree
STEP="worktree"
[ -d "$BRAIN_SRC/.git" ] || { log "brain repo not found at $BRAIN_SRC"; false; }
git -C "$BRAIN_SRC" fetch --quiet origin
if [ ! -e "$WT/.git" ]; then
  log "creating worktree $WT on branch $BRANCH"
  git -C "$BRAIN_SRC" worktree prune
  if git -C "$BRAIN_SRC" show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git -C "$BRAIN_SRC" worktree add "$WT" "$BRANCH"
  elif git -C "$BRAIN_SRC" show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
    git -C "$BRAIN_SRC" worktree add -b "$BRANCH" "$WT" "origin/$BRANCH"
  else
    git -C "$BRAIN_SRC" worktree add -b "$BRANCH" "$WT" origin/main
  fi
fi
[ "$(git -C "$WT" rev-parse --abbrev-ref HEAD)" = "$BRANCH" ] || { log "worktree is not on $BRANCH"; false; }
if [ -n "$(git -C "$WT" status --porcelain)" ]; then
  warn "worktree has uncommitted changes from a previous run — they will be included in this tick"
fi
git -C "$WT" fetch --quiet origin
if git -C "$WT" show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git -C "$WT" merge --quiet --ff-only "origin/$BRANCH" 2>/dev/null || true
fi
if ! git -C "$WT" merge --quiet --no-edit origin/main; then
  git -C "$WT" merge --abort 2>/dev/null || true
  log "merge conflict merging origin/main into $BRANCH — aborting tick"
  false
fi
WORK="$WT/.snapshots/work"    # gitignored scratch inside the worktree (claude can read it)
mkdir -p "$WORK"
find "$WORK" -type f -mtime +7 -delete 2>/dev/null || true
TODAY="$(date +%F)"
export BRAIN_DIR="$WT"        # data scripts (lenses, bridge) read the brain from the worktree

# ---------------------------------------------------------------- headless claude
# Least privilege: cwd = worktree; only Read/Write/Edit/Glob/Grep exist (no Bash/Web);
# extra dirs are readable but writes there are denied; dontAsk = anything not
# pre-approved is refused instead of prompting; --restricted ignores user/project
# settings, hooks and confines file tools to the working dirs.
LAST_RESULT=""
run_claude() { # name prompt_file context [read-only add-dir ...]
  local name="$1" prompt="$2" ctx="$3"; shift 3
  local full="$WORK/prompt-$name.md" out="$WORK/out-$name.json"
  { cat "$PROMPTS/_rules.md"; printf '\n---\n\n'; cat "$prompt"
    printf '\n## Run context\n- Today: %s\n- Working directory (brain repo root): %s\n%s\n' "$TODAY" "$WT" "$ctx"; } >"$full"
  local args=(-p --restricted --strict-mcp-config --no-session-persistence
    --model "$BRAIN_MODEL" --max-turns "$BRAIN_MAX_TURNS" --max-budget-usd "$BRAIN_MAX_BUDGET_USD"
    --permission-mode dontAsk --output-format json
    --tools "Read,Write,Edit,Glob,Grep" --allowedTools "Read,Write,Edit,Glob,Grep")
  local deny=(Bash WebFetch WebSearch) d
  for d in "$@"; do
    args+=(--add-dir "$d")
    deny+=("Write(/$d/**)" "Edit(/$d/**)")   # "//abs/path" = absolute-path rule
  done
  args+=(--disallowedTools "${deny[@]}")
  if dry; then
    log "[dry-run] claude $name: cd $WT && $CLAUDE_BIN ${args[*]} < $full"
    LAST_RESULT="(dry-run)"
    return 0
  fi
  log "claude $name: running"
  ( cd "$WT" && "$CLAUDE_BIN" "${args[@]}" <"$full" ) >"$out"
  local subtype is_error cost
  subtype="$(jq -r '.subtype // "unknown"' "$out")"
  is_error="$(jq -r 'if has("is_error") then (.is_error|tostring) else "true" end' "$out")"
  cost="$(jq -r '.total_cost_usd // 0' "$out")"
  LAST_RESULT="$(jq -r '.result // ""' "$out")"
  log "claude $name: subtype=$subtype is_error=$is_error cost=\$$cost turns=$(jq -r '.num_turns // "?"' "$out")"
  printf '%s\n' "$LAST_RESULT" | head -n 20 | sed 's/^/    /' || true
  [ "$is_error" = "false" ] && [ "$subtype" = "success" ]
}

summarise() { # stage text
  local first; first="$(printf '%s\n' "$2" | awk 'NF' | head -n 8 || true)"
  SUMMARY+=("[$1]" "$first")
}

run_ts() { # script.ts args... (run from app root with .env)
  ( cd "$APP_ROOT" && NODE_PATH="$APP_ROOT/node_modules" node --env-file="$APP_ROOT/.env" --import tsx "$@" )
}

todays_backup() { # prints backups/<today>* with a clean _manifest.json (same rule as the ingest script)
  local d found=""
  shopt -s nullglob
  for d in "$APP_ROOT"/backups/"$(date +%F)"* "$APP_ROOT"/backups/"$(date -u +%F)"*; do
    if [ -f "$d/_manifest.json" ] && [ "$(jq -r '.failed_tables // 1' "$d/_manifest.json" 2>/dev/null || echo 1)" = 0 ]; then found="$d"; fi
  done
  shopt -u nullglob
  if [ -n "$found" ]; then echo "$found"; return 0; fi
  return 1
}

# YouTube research -> corpus (tier market_signal). Stages the latest cache day as JSONL in the
# worktree's gitignored .snapshots/corpus-youtube/, then runs the ingest: a dry run (SELECTs only)
# unless BRAIN_YOUTUBE_CORPUS=1, this is not a --dry-run tick and today's backup exists.
# Failure-isolated: problems are logged and open a brain-tick issue; this never fails the tick.
youtube_corpus() {
  local day jsonl stage_log ingest_log backup mode="dry-run" rc=0
  day="$(find "$CACHE_DIR" -mindepth 1 -maxdepth 1 -type d -name '20??-??-??' -exec basename {} \; 2>/dev/null | sort | tail -n 1 || true)"
  if [ -z "$day" ]; then log "youtube corpus: no cache day yet"; return 0; fi
  jsonl="$WT/.snapshots/corpus-youtube/$day.jsonl"
  stage_log="$WORK/youtube-corpus-stage-$TS.txt"
  ingest_log="$WORK/youtube-corpus-ingest-$TS.txt"
  python3 -I "$RESEARCH_DIR/stage_youtube_corpus.py" --cache-day "$CACHE_DIR/$day" --brain "$WT" --out "$jsonl" >"$stage_log" 2>&1 || rc=$?
  sed 's/^/    /' "$stage_log" || true
  if [ "$rc" != 0 ]; then
    warn "youtube corpus: staging failed (exit $rc) — continuing"
    open_issue "youtube corpus (staging)"
    return 0
  fi
  if ! backup="$(todays_backup)"; then
    if [ "${BRAIN_YOUTUBE_CORPUS:-0}" = 1 ] && ! dry; then
      warn "youtube corpus: BRAIN_YOUTUBE_CORPUS=1 but no successful backup from today — not ingesting (run npm run backup)"
      open_issue "youtube corpus (refused: no backup today)"
    else
      log "youtube corpus: dry run = the staging counts above (no backup from today, and the ingest script needs one even to plan)"
    fi
    return 0
  fi
  local ingest_args=(--file "$jsonl" --replace-by-source)
  if [ "${BRAIN_YOUTUBE_CORPUS:-0}" = 1 ] && ! dry; then mode="execute"; ingest_args+=(--execute); fi
  log "youtube corpus: ingest $day ($mode, backup ${backup##*/})"
  rc=0
  run_ts scripts/brain/ingest-staged-corpus.ts "${ingest_args[@]}" >"$ingest_log" 2>&1 || rc=$?
  sed -n '1,12p' "$ingest_log" | sed 's/^/    /' || true
  if [ "$rc" != 0 ]; then
    tail -n 5 "$ingest_log" | sed 's/^/    /' || true
    warn "youtube corpus: ingest failed (exit $rc) — continuing"
    open_issue "youtube corpus (ingest)"
    return 0
  fi
  if [ "$mode" = execute ]; then SUMMARY+=("[research] YouTube cache $day ingested into the corpus (market_signal tier)"); fi
  return 0
}

# ---------------------------------------------------------------- a) journal
if want journal; then
  STEP="journal"
  INFLIGHT="$QUEUE_DIR/inflight-$TS.txt"
  # gather new + leftover (from crashed ticks) entries atomically
  shopt -s nullglob
  pending=("$QUEUE_DIR"/inflight-*.txt)
  if [ -f "$QUEUE_DIR/sessions.txt" ]; then
    mv "$QUEUE_DIR/sessions.txt" "$QUEUE_DIR/taken-$TS.txt"; pending+=("$QUEUE_DIR/taken-$TS.txt")
  fi
  shopt -u nullglob
  if [ ${#pending[@]} -gt 0 ]; then
    cat "${pending[@]}" | awk 'NF && !seen[$0]++' >"$INFLIGHT.tmp"
    if dry; then
      # dry-run must not consume the queue: put things back the way they were
      if [ -f "$QUEUE_DIR/taken-$TS.txt" ]; then mv "$QUEUE_DIR/taken-$TS.txt" "$QUEUE_DIR/sessions.txt"; fi
    else
      rm -f "${pending[@]}"
    fi
    mv "$INFLIGHT.tmp" "$INFLIGHT"
    # the feedback stage reads the same transcripts; hand it a copy (dry-run left sessions.txt in place)
    if ! dry; then cat "$INFLIGHT" >>"$QUEUE_DIR/feedback.txt"; fi
  fi
  if [ -s "$INFLIGHT" ]; then
    n=0 journaled=0
    while IFS= read -r tr; do
      n=$((n + 1))
      if [ ! -f "$tr" ]; then warn "transcript missing, skipping: $tr"; continue; fi
      stats="$(python3 -I "$SCRIPT_DIR/extract-transcript.py" "$tr" --stats)"
      ut="$(jq -r .user_turns <<<"$stats")"; ed="$(jq -r .edits <<<"$stats")"; sid="$(jq -r '.session_id // "unknown"' <<<"$stats")"
      if [ "$ut" -lt "$MIN_USER_TURNS" ] || { [ "$ed" -eq 0 ] && [ "$ut" -lt $((MIN_USER_TURNS * 2)) ]; }; then
        log "journal: skip trivial session $sid (user_turns=$ut edits=$ed)"
        continue
      fi
      cond="$WORK/session-$sid.md"
      python3 -I "$SCRIPT_DIR/extract-transcript.py" "$tr" --out "$cond"
      log "journal: session $sid user_turns=$ut edits=$ed chars=$(wc -c <"$cond" | tr -d ' ')"
      run_claude "journal-$sid" "$PROMPTS/journal.md" "- Condensed transcript: $cond
- Session id: $sid"
      case "$LAST_RESULT" in NO_CHANGES*) ;; *) journaled=$((journaled + 1)); summarise "journal $sid" "$LAST_RESULT" ;; esac
    done <"$INFLIGHT"
    log "journal: $n queued, $journaled journaled"
    rm -f "$INFLIGHT"   # success: clear the queue (dry-run never removed the originals)
    if dry; then log "[dry-run] queue left intact"; fi
  else
    rm -f "$INFLIGHT"
    log "journal: queue empty"
  fi
fi

# ---------------------------------------------------------------- a2) feedback
# Founder feedback log (feedback/ in the brain). Inputs: the transcripts the journal stage took
# (.queue/feedback.txt; a not-yet-journaled sessions.txt is peeked at, never consumed) reduced to the
# founder's own messages after a per-session watermark (state: feedback_since), plus
# feedback/inbox/*.md (deck presenter comments, appended by pull-feedback.ts when it exists).
# Failure-isolated: on any failure the queue and watermarks stay put and the tick carries on.
if want feedback; then
  STEP="feedback"
  FB_QUEUE="$QUEUE_DIR/feedback.txt"
  if [ -f "$SCRIPT_DIR/pull-feedback.ts" ]; then
    if dry; then log "[dry-run] would run scripts/brain/pull-feedback.ts"
    else
      rc=0; run_ts scripts/brain/pull-feedback.ts >"$WORK/pull-feedback-$TS.txt" 2>&1 || rc=$?
      if [ "$rc" != 0 ]; then warn "feedback: pull-feedback.ts failed (exit $rc), skipping it"; fi
    fi
  fi
  FB_TAKEN="$QUEUE_DIR/feedback-taken-$TS.txt"
  shopt -s nullglob
  fb_lists=("$QUEUE_DIR"/feedback-taken-*.txt)   # leftovers from a failed tick
  shopt -u nullglob
  if [ -f "$FB_QUEUE" ] && ! dry; then mv "$FB_QUEUE" "$FB_TAKEN"; fb_lists+=("$FB_TAKEN"); fi
  if [ -f "$FB_QUEUE" ]; then fb_lists+=("$FB_QUEUE"); fi
  if [ -f "$QUEUE_DIR/sessions.txt" ]; then fb_lists+=("$QUEUE_DIR/sessions.txt"); fi
  fb_in="$WORK/feedback-input-$TS.md"
  : >"$fb_in"
  marks="{}" nmsg=0
  if [ ${#fb_lists[@]} -gt 0 ]; then
    while IFS= read -r tr; do
      [ -f "$tr" ] || { warn "feedback: transcript missing, skipping: $tr"; continue; }
      st="$(python3 -I "$SCRIPT_DIR/extract-feedback.py" "$tr" --stats)"
      sid="$(jq -r '.session_id // "unknown"' <<<"$st")"
      since="$(jq -r --arg s "$sid" '.feedback_since[$s] // empty' "$STATE")"
      args=("$tr"); if [ -n "$since" ]; then args+=(--since "$since"); fi
      st="$(python3 -I "$SCRIPT_DIR/extract-feedback.py" "${args[@]}" --stats)"
      n="$(jq -r .messages <<<"$st")"
      if [ "$n" -gt 0 ]; then
        python3 -I "$SCRIPT_DIR/extract-feedback.py" "${args[@]}" >>"$fb_in"
        printf '\n' >>"$fb_in"
        marks="$(jq -c --arg s "$sid" --arg t "$(jq -r .last_ts <<<"$st")" '.[$s] = $t' <<<"$marks")"
        nmsg=$((nmsg + n))
      fi
      log "feedback: session $sid: $n new founder message(s)${since:+ since $since}"
    done < <(cat "${fb_lists[@]}" | awk 'NF && !seen[$0]++')
  fi
  shopt -s nullglob
  inbox=()
  for f in "$WT"/feedback/inbox/*.md; do [ "$(basename "$f")" = README.md ] || inbox+=("$f"); done
  shopt -u nullglob
  if [ "$nmsg" -eq 0 ] && [ ${#inbox[@]} -eq 0 ]; then
    log "feedback: nothing new"
    rm -f "$fb_in"; if ! dry; then rm -f "$QUEUE_DIR"/feedback-taken-*.txt; fi
  else
    commits="$WORK/app-commits-$TS.txt"
    git -C "$APP_ROOT" log --since=14.days --date=short --format='%h %ad %s' >"$commits" 2>/dev/null || true
    ctx="- Founder messages (new since the last run): $([ "$nmsg" -gt 0 ] && echo "$fb_in" || echo "none")
- Inbox files to process:"
    if [ ${#inbox[@]} -gt 0 ]; then for f in "${inbox[@]}"; do ctx+=$'\n'"  - ${f#"$WT"/}"; done; else ctx+=" none"; fi
    ctx+=$'\n'"- App commits (last 14 days): $commits"
    log "feedback: $nmsg message(s), ${#inbox[@]} inbox file(s)"
    if run_claude feedback "$PROMPTS/feedback.md" "$ctx"; then
      if dry; then
        log "[dry-run] would set feedback_since watermarks: $marks"
        for f in ${inbox[@]+"${inbox[@]}"}; do log "[dry-run] would move ${f#"$WT"/} to feedback/inbox/processed/"; done
      else
        state_set feedback_since "$(jq -c --argjson m "$marks" '(.feedback_since // {}) + $m' "$STATE")"
        mkdir -p "$WT/feedback/inbox/processed"
        for f in ${inbox[@]+"${inbox[@]}"}; do mv "$f" "$WT/feedback/inbox/processed/$(basename "$f" .md)-$TS.md"; done
        rm -f "$QUEUE_DIR"/feedback-taken-*.txt
      fi
      case "$LAST_RESULT" in NO_CHANGES*) ;; *) summarise feedback "$LAST_RESULT" ;; esac
    else
      warn "feedback: claude run failed; queue and inbox kept for the next tick"
      open_issue "feedback"
    fi
  fi
fi

# ---------------------------------------------------------------- b) research
if want research && { [ "$FORCE_RESEARCH" = 1 ] || [ -n "$ONLY" ] || due research_last "$RESEARCH_EVERY"; }; then
  STEP="research"
  PY="$RESEARCH_DIR/.venv/bin/python"
  SWEEP="$RESEARCH_DIR/youtube_sweep.py"
  days=()
  last_day="$(find "$CACHE_DIR" -mindepth 1 -maxdepth 1 -type d -name '20??-??-??' -exec basename {} \; 2>/dev/null | sort | tail -n 1 || true)"
  missing=0
  if [ -n "$last_day" ]; then
    missing="$(jq -s '[.[].picks[]? | select(.transcript.ok != true)] | length' "$CACHE_DIR/$last_day"/*.json 2>/dev/null || echo 0)"
    log "research: last cache day $last_day has $missing missing transcript(s)"
  fi
  budget=$TRANSCRIPT_BUDGET
  if [ -n "$last_day" ] && [ "$missing" -gt 0 ]; then
    if dry; then log "[dry-run] would run: $PY -I $SWEEP --fill-missing $last_day --limit $budget --transcripts auto --max-minutes 10 (900s cap)"
    else perl -e 'alarm shift; exec @ARGV' 900 "$PY" -I "$SWEEP" --fill-missing "$last_day" --limit "$budget" \
           --transcripts auto --max-minutes 10 || warn "fill-missing failed or timed out"; fi
    days+=("$last_day")
    if [ "$missing" -gt "$budget" ]; then budget=0; else budget=$((budget - missing)); fi
  fi
  ncreators=$((budget / TOP_PER_CREATOR))
  if [ "$ncreators" -gt "$MAX_CREATORS_PER_TICK" ]; then ncreators=$MAX_CREATORS_PER_TICK; fi
  if [ "$ncreators" -lt 0 ]; then ncreators=0; fi
  keys=()
  while IFS= read -r k; do keys+=("$k"); done < <(jq -r '.[].key' "$RESEARCH_DIR/creators.json")
  rot="$(state_get research_rotation)"; rot="${rot:-0}"
  picks=()
  for ((i = 0; i < ncreators && i < ${#keys[@]}; i++)); do picks+=("${keys[$(((rot + i) % ${#keys[@]}))]}"); done
  if [ ${#picks[@]} -gt 0 ]; then
    only="$(IFS=,; echo "${picks[*]}")"
    if dry; then log "[dry-run] would run: $PY -I $SWEEP --only $only --top $TOP_PER_CREATOR --transcripts auto --max-transcripts 12 --backfill-outliers 2 --max-minutes 20 (1800s cap)"
    else perl -e 'alarm shift; exec @ARGV' 1800 "$PY" -I "$SWEEP" --only "$only" --top "$TOP_PER_CREATOR" \
           --transcripts auto --max-transcripts 12 --backfill-outliers 2 --max-minutes 20 \
           || warn "sweep failed or timed out"; fi
    days+=("$TODAY")
  else
    log "research: transcript budget used by fill-missing; no new sweep this tick"
  fi
  STEP="research:youtube-corpus"
  youtube_corpus || warn "youtube corpus: unexpected failure (ignored)"
  STEP="research"
  if [ ${#days[@]} -gt 0 ]; then
    ctx="- Research cache days to digest (raw JSON, input only):"
    for d in $(printf '%s\n' "${days[@]}" | sort -u); do ctx+=$'\n'"  - $CACHE_DIR/$d/"; done
    ctx+=$'\n'"- Creators swept this tick: ${picks[*]:-none} (top $TOP_PER_CREATOR outliers each)"
    ctx+=$'\n'"- Briefing to write: briefings/$TODAY.md"
    run_claude research "$PROMPTS/research.md" "$ctx" "$RESEARCH_DIR/.cache"
    summarise research "$LAST_RESULT"
  fi
  state_set research_rotation "$(((rot + ${#picks[@]}) % ${#keys[@]}))"
  state_set research_last "$(now)"
fi

# ---------------------------------------------------------------- c) customer signal
if want customers && { [ -n "$ONLY" ] || due customers_last "$CUSTOMERS_EVERY"; }; then
  STEP="customers"
  cs="$WORK/customer-signal-$TS.json"
  run_ts scripts/brain/customer-signal.ts --out "$cs"
  log "customers: $(jq -c '.counts' "$cs")"
  run_claude customers "$PROMPTS/customers.md" "- Customer-signal JSON: $cs"
  summarise customers "$LAST_RESULT"
  state_set customers_last "$(now)"
fi

# ---------------------------------------------------------------- lenses (pluggable)
if want lenses && { [ "$FORCE_LENSES" = 1 ] || [ -n "$ONLY" ] || due lenses_last "$LENSES_EVERY"; }; then
  STEP="lenses"
  shopt -s nullglob
  lens_files=("$PROMPTS"/lenses/*.md)
  shopt -u nullglob
  ran=0
  for lf in ${lens_files[@]+"${lens_files[@]}"}; do
    lens="$(basename "$lf" .md)"
    if [ "$lens" = "README" ]; then continue; fi
    STEP="lens:$lens"
    ctx="- Lens: $lens"
    data_ts="$SCRIPT_DIR/lenses/$lens.data.ts"
    if [ -f "$data_ts" ]; then
      data_out="$WORK/lens-$lens-$TS.json"
      if dry; then
        log "[dry-run] would run data script scripts/brain/lenses/$lens.data.ts > $data_out"
      elif ! run_ts "scripts/brain/lenses/$lens.data.ts" >"$data_out" || ! jq -e . "$data_out" >/dev/null 2>&1; then
        log "lens $lens: data script failed or emitted invalid JSON — skipping lens"
        open_issue "lens:$lens (data)"
        continue
      fi
      ctx+=$'\n'"- Data file: $data_out"
    fi
    if run_claude "lens-$lens" "$lf" "$ctx"; then
      ran=$((ran + 1))
      case "$LAST_RESULT" in NO_CHANGES*) ;; *) summarise "lens $lens" "$LAST_RESULT" ;; esac
    else
      log "lens $lens: claude failed — continuing with the next lens"
      open_issue "lens:$lens"
    fi
  done
  STEP="lenses"
  log "lenses: ran $ran lens(es)"
  state_set lenses_last "$(now)"
fi

# ---------------------------------------------------------------- bridge (brain -> corpus)
# Always a dry run (counts, changed notes, cost) unless BRAIN_CORPUS_SYNC=1 and this is not a
# --dry-run tick. Even then sync-brain-to-corpus.ts refuses without today's backup, the tier
# column and the ingest script. Staging JSONL goes to the worktree's gitignored .snapshots/.
# Failure-isolated: a failed or refused sync is logged (and an issue opened) but never fails the tick.
if want bridge; then
  STEP="bridge"
  bridge_mode="dry-run"
  sync_args=(--brain "$WT")
  if [ "${BRAIN_CORPUS_SYNC:-0}" = 1 ] && ! dry; then bridge_mode="execute"; sync_args+=(--execute); fi
  bridge_log="$WORK/bridge-$TS.txt"
  log "bridge: brain -> corpus ($bridge_mode)"
  bridge_rc=0
  run_ts scripts/brain/sync-brain-to-corpus.ts ${sync_args[@]+"${sync_args[@]}"} >"$bridge_log" 2>&1 || bridge_rc=$?
  sed 's/^/    /' "$bridge_log" || true
  if [ "$bridge_rc" = 0 ]; then
    if [ "$bridge_mode" = execute ]; then SUMMARY+=("[bridge] brain notes synced to the corpus (internal tier)"); fi
  elif [ "$bridge_rc" = 2 ]; then
    warn "bridge: sync refused by its safety guard (see above)"
    open_issue "bridge (refused)"
  else
    warn "bridge: sync script failed (exit $bridge_rc) — continuing"
    open_issue "bridge"
  fi
fi

# ---------------------------------------------------------------- knowledge graph
# Rebuilds kg_nodes/kg_edges from the worktree brain and the corpus, then writes
# graph/gaps.md and graph/ingestion-proposals.md into the worktree (committed below).
# Failure-isolated: a failed build is logged and an issue opened; the tick carries on.
if want graph; then
  STEP="graph"
  graph_log="$WORK/graph-$TS.txt"
  if dry; then
    log "[dry-run] would run scripts/brain/build-graph.ts --brain-dir $WT --dry-run"
    run_ts scripts/brain/build-graph.ts --brain-dir "$WT" --dry-run --no-embed >"$graph_log" 2>&1 || true
    sed 's/^/    /' "$graph_log" || true
  else
    log "graph: rebuilding the knowledge graph"
    graph_rc=0
    { run_ts scripts/brain/build-graph.ts --brain-dir "$WT" && run_ts scripts/brain/graph-gaps.ts --brain-dir "$WT"; } >"$graph_log" 2>&1 || graph_rc=$?
    tail -n 25 "$graph_log" | sed 's/^/    /' || true
    if [ "$graph_rc" = 0 ]; then SUMMARY+=("[graph] knowledge graph rebuilt; gaps in graph/gaps.md")
    else warn "graph: build failed (exit $graph_rc), continuing"; open_issue "graph"; fi
  fi
fi

# ---------------------------------------------------------------- commit (before snapshot so brainCommit is exact)
STEP="commit"
committed=0
if [ -n "$(git -C "$WT" status --porcelain)" ]; then
  stages="$(printf '%s\n' ${SUMMARY[@]+"${SUMMARY[@]}"} | grep -o '^\[[^]]*\]' | tr -d '[]' | awk '{print $1}' | sort -u | paste -sd, - || true)"
  msg="Brain tick $TODAY: ${stages:-updates}"$'\n\n'"$(printf '%s\n' ${SUMMARY[@]+"${SUMMARY[@]}"})"
  if dry; then
    log "[dry-run] would commit in $WT:"; git -C "$WT" status --short | sed 's/^/    /'
  else
    git -C "$WT" add -A
    git -C "$WT" commit --quiet -m "$msg"
    committed=1
    log "committed $(git -C "$WT" rev-parse --short HEAD)"
  fi
else
  log "no brain changes to commit"
fi
HEAD_SHA="$(git -C "$WT" rev-parse HEAD)"

# ---------------------------------------------------------------- d) snapshot
if want snapshot && { [ "$ONLY" = snapshot ] || [ "$committed" = 1 ] || [ "$(state_get snapshot_commit)" != "$HEAD_SHA" ]; }; then
  STEP="snapshot"
  snap="$WT/.snapshots/latest.json"
  errs="$WORK/snapshot-errors-$TS.txt"
  gen="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  pub_args=("$snap" --commit "$HEAD_SHA" --errors-out "$errs")
  if dry || [ "$NO_UPLOAD" = 1 ]; then pub_args+=(--no-upload); fi
  ctx="- Schema (read it in full): $SCHEMA_DIR/snapshot.ts
- Output file: $snap
- generatedAt: $gen"
  run_claude snapshot "$PROMPTS/snapshot.md" "$ctx" "$SCHEMA_DIR" "$APP_ROOT/documents"
  if dry && [ ! -f "$snap" ]; then
    log "[dry-run] no existing $snap to validate"
  else
    rc=0; run_ts scripts/brain/publish-snapshot.ts "${pub_args[@]}" || rc=$?
    if [ "$rc" = 3 ] && ! dry; then
      log "snapshot invalid — one retry with the Zod errors"
      run_claude snapshot-retry "$PROMPTS/snapshot.md" "$ctx
- Validation errors from the previous attempt (fix exactly these, then rewrite the file):
$(cat "$errs")" "$SCHEMA_DIR" "$APP_ROOT/documents"
      rc=0; run_ts scripts/brain/publish-snapshot.ts "${pub_args[@]}" || rc=$?
    fi
    if [ "$rc" != 0 ]; then
      if dry; then log "[dry-run] existing snapshot failed validation (rc=$rc)"
      else log "snapshot publish failed (rc=$rc)"; false; fi
    else
      state_set snapshot_commit "\"$HEAD_SHA\""
      note=""; if [ "$NO_UPLOAD" = 1 ]; then note=" (not uploaded)"; fi
      SUMMARY+=("[snapshot] built from $(git -C "$WT" rev-parse --short HEAD)$note")
    fi
  fi
fi

# ---------------------------------------------------------------- e) ship
STEP="ship"
[ "$(git -C "$WT" rev-parse --abbrev-ref HEAD)" = "$BRANCH" ] || { log "refusing to push: not on $BRANCH"; false; }
if git -C "$WT" show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  ahead="$(git -C "$WT" rev-list --count "origin/$BRANCH..HEAD")"
else
  ahead="$(git -C "$WT" rev-list --count origin/main..HEAD)"
fi
if [ "$ahead" -gt 0 ]; then
  tick_summary="$(printf '%s\n' ${SUMMARY[@]+"${SUMMARY[@]}"})"
  if dry; then
    log "[dry-run] would push $ahead commit(s): git -C $WT push origin $BRANCH:$BRANCH"
    log "[dry-run] would open/update PR $BRANCH -> main on $BRAIN_REPO"
  else
    git -C "$WT" push --quiet -u origin "$BRANCH:$BRANCH"
    pr="$(gh pr list --repo "$BRAIN_REPO" --head "$BRANCH" --base main --state open --json number -q '.[0].number')"
    if [ -z "$pr" ]; then
      body="$(printf 'Rolling PR from the automated brain tick (branch `%s`). Review and merge (use a merge commit, not squash, so the tick can keep merging cleanly).\n\n## Commits\n%s\n\n## Files\n```\n%s\n```\n\n## This tick\n%s\n' \
        "$BRANCH" "$(git -C "$WT" log --format='- %h %s' origin/main..HEAD)" \
        "$(git -C "$WT" diff --stat origin/main...HEAD | tail -n 40)" "$tick_summary")"
      gh pr create --repo "$BRAIN_REPO" --head "$BRANCH" --base main --title "Brain updates (rolling)" --body "$body"
      log "opened PR"
    else
      gh pr comment "$pr" --repo "$BRAIN_REPO" --body "$(printf '**Brain tick %s** (%s commit(s) pushed)\n\n%s\n' "$TS" "$ahead" "$tick_summary")"
      log "commented on PR #$pr"
    fi
  fi
else
  log "nothing to push"
fi

STEP="done"
log "brain tick done"
