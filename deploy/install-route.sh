#!/usr/bin/env bash
set -euo pipefail

caddyfile=/opt/120nmine/current/services/web/Caddyfile
app_dir=/opt/mini-crm-objects-tasks
proxy=nmol-site-proxy-1
backup="$app_dir/Caddyfile.before-crm"

test -f "$caddyfile"
test -d "$app_dir"
if grep -q 'BEGIN MINI_CRM_ROUTE' "$caddyfile"; then
  echo 'CRM route already installed'
  exit 0
fi

cp -p "$caddyfile" "$backup"
python3 - "$caddyfile" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
content = path.read_text()
needle = '\thandle {\n\t\treverse_proxy web:3000 {'
assert content.count(needle) == 1, 'Expected one main-site catchall route'
route = (
    '\t# BEGIN MINI_CRM_ROUTE\n'
    '\t@mini_crm path /crm /crm/*\n'
    '\thandle @mini_crm {\n'
    '\t\treverse_proxy crm-app:3000\n'
    '\t}\n'
    '\t# END MINI_CRM_ROUTE\n'
)
path.write_text(content.replace(needle, route + needle, 1))
PY

if ! docker exec "$proxy" caddy validate --config /etc/caddy/Caddyfile \
  || ! docker exec "$proxy" caddy reload --config /etc/caddy/Caddyfile; then
  cp -p "$backup" "$caddyfile"
  docker exec "$proxy" caddy reload --config /etc/caddy/Caddyfile || true
  echo 'Caddy rejected the CRM route; original config restored' >&2
  exit 1
fi
echo 'CRM route installed'
