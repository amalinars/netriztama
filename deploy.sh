#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_ENV_FILE="${SUPABASE_ENV_FILE:-/home/ubuntu/supabase/supabase-local/.env}"
WEB_ROOT="${WEB_ROOT:-/var/www/netriztama}"

if [[ ! -f "$SUPABASE_ENV_FILE" ]]; then
  echo "Missing Supabase env file: $SUPABASE_ENV_FILE" >&2
  exit 1
fi

read_env() {
  local key="$1"
  python3 - "$SUPABASE_ENV_FILE" "$key" <<'PY'
import re, sys
path, key = sys.argv[1], sys.argv[2]
value = ''
with open(path, 'r', errors='ignore') as f:
    for line in f:
        m = re.match(rf'^{re.escape(key)}=(.*)$', line.rstrip('\n'))
        if m:
            value = m.group(1)
            break
print(value)
PY
}

SUPABASE_PUBLIC_URL="$(read_env SUPABASE_PUBLIC_URL)"
if [[ -z "$SUPABASE_PUBLIC_URL" ]]; then
  SUPABASE_PUBLIC_URL="$(read_env API_EXTERNAL_URL)"
fi
ANON_KEY="$(read_env ANON_KEY)"

if [[ -z "$SUPABASE_PUBLIC_URL" || -z "$ANON_KEY" ]]; then
  echo "Could not derive Vite env from $SUPABASE_ENV_FILE" >&2
  echo "Need SUPABASE_PUBLIC_URL/API_EXTERNAL_URL and ANON_KEY" >&2
  exit 1
fi

cd "$ROOT_DIR"

VITE_SUPABASE_URL="$SUPABASE_PUBLIC_URL" \
VITE_SUPABASE_ANON_KEY="$ANON_KEY" \
npm run build

sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete "$ROOT_DIR/dist/" "$WEB_ROOT/"
sudo nginx -t
sudo systemctl reload nginx

echo "Deployed to https://net.riztama.my.id"
