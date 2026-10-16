#!/usr/bin/env bash
# Install the weekly brain-tick LaunchAgent (Sunday 21:00 local).
#   scripts/brain/install-launchd.sh            install / reinstall
#   scripts/brain/install-launchd.sh --uninstall
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.quantumstrategies.brain-tick"
DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
if [ "${1:-}" = "--uninstall" ]; then
  rm -f "$DEST"
  echo "uninstalled $LABEL"
  exit 0
fi

# Bake in the directories of the tools the tick needs (launchd's default PATH is minimal).
path="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
for tool in node git gh jq python3 claude; do
  p="$(command -v "$tool" 2>/dev/null || true)"
  [ -n "$p" ] || { echo "warning: $tool not found on PATH"; continue; }
  d="$(dirname "$p")"
  case ":$path:" in *":$d:"*) ;; *) path="$d:$path" ;; esac
done
case ":$path:" in *":$HOME/.local/bin:"*) ;; *) path="$HOME/.local/bin:$path" ;; esac

mkdir -p "$HOME/Library/LaunchAgents" "$DIR/logs"
sed -e "s#__TICK__#$DIR/tick.sh#" -e "s#__HOME__#$HOME#" -e "s#__PATH__#$path#" -e "s#__LOGDIR__#$DIR/logs#" \
  "$DIR/$LABEL.plist" >"$DEST"
plutil -lint "$DEST" >/dev/null
launchctl bootstrap "$DOMAIN" "$DEST"
echo "installed $DEST"
echo "PATH baked in: $path"
echo "check:   launchctl print $DOMAIN/$LABEL | head"
echo "run now: launchctl kickstart $DOMAIN/$LABEL"
