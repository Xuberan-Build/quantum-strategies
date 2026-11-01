#!/usr/bin/env bash
# Copy the Search Console service-account credentials from .env.local into Vercel Production
# as Sensitive variables. Values are piped straight to the Vercel CLI and never printed.
#
#   bash scripts/ops/push-gsc-env.sh
#
# Optional: also create READ_LINK_SECRET (needed before the Perception Read quiz launches):
#   bash scripts/ops/push-gsc-env.sh --read-link-secret
# Optional: also copy RESEND_API_KEY (Perception Read emails send through Resend):
#   bash scripts/ops/push-gsc-env.sh --resend
# Optional: set the public sender settings (not secrets):
#   bash scripts/ops/push-gsc-env.sh --sender
set -euo pipefail
cd "$(dirname "$0")/../.."

value_of() {
  python3 - "$1" <<'EOF'
import re, sys
name = sys.argv[1]
for line in open('.env.local'):
    m = re.match(rf'^{re.escape(name)}=(.*)$', line.rstrip('\n'))
    if m:
        v = m.group(1).strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'':
            v = v[1:-1]
        sys.stdout.write(v)
        sys.exit(0)
sys.exit(f'{name} not found in .env.local')
EOF
}

NAMES="GOOGLE_CRM_CLIENT_EMAIL GOOGLE_CRM_PRIVATE_KEY"
[[ " $* " == *" --resend "* ]] && NAMES="$NAMES RESEND_API_KEY"
for name in $NAMES; do
  if vercel env ls production 2>/dev/null | grep -qE "^ +$name "; then
    echo "$name already in Production, skipped"
    continue
  fi
  value_of "$name" | vercel env add "$name" production --sensitive >/dev/null
  echo "$name added to Production (sensitive)"
done

if [[ " $* " == *" --read-link-secret "* ]]; then
  if vercel env ls production 2>/dev/null | grep -qE "^ +READ_LINK_SECRET "; then
    echo "READ_LINK_SECRET already in Production, skipped"
  else
    openssl rand -hex 32 | tr -d '\n' | vercel env add READ_LINK_SECRET production --sensitive >/dev/null
    echo "READ_LINK_SECRET generated and added to Production (sensitive)"
  fi
fi

if [[ " $* " == *" --sender "* ]]; then
  for kv in "SENDER_EMAIL=austin@quantumstrategies.online" "SENDER_NAME=Austin at Quantum Strategies" "READ_EMAIL_TRANSPORT=resend"; do
    n=${kv%%=*}; v=${kv#*=}
    if vercel env ls production 2>/dev/null | grep -qE "^ +$n "; then echo "$n already in Production, skipped"; continue; fi
    printf '%s' "$v" | vercel env add "$n" production >/dev/null
    echo "$n added to Production"
  done
fi

echo "Done. Redeploy (or push) for the new values to take effect."
