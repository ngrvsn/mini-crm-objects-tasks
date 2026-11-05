#!/usr/bin/env bash
set -euo pipefail

app_dir=/opt/mini-crm-objects-tasks
caddyfile=/opt/120nmine/current/services/web/Caddyfile
proxy=nmol-site-proxy-1

test "$app_dir" = /opt/mini-crm-objects-tasks
test -f "$app_dir/compose.yml"

if grep -q 'BEGIN MINI_CRM_ROUTE' "$caddyfile"; then
  cp -p "$caddyfile" "$app_dir/Caddyfile.before-uninstall"
  python3 - "$caddyfile" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
content = path.read_text()
route = (
    '\t# BEGIN MINI_CRM_ROUTE\n'
    '\t@mini_crm path /crm /crm/*\n'
    '\thandle @mini_crm {\n'
    '\t\treverse_proxy crm-app:3000\n'
    '\t}\n'
    '\t# END MINI_CRM_ROUTE\n'
)
assert content.count(route) == 1, 'CRM route differs from installed block'
path.write_text(content.replace(route, '', 1))
PY
  if ! docker exec "$proxy" caddy validate --config /etc/caddy/Caddyfile \
    || ! docker exec "$proxy" caddy reload --config /etc/caddy/Caddyfile; then
    cp -p "$app_dir/Caddyfile.before-uninstall" "$caddyfile"
    docker exec "$proxy" caddy reload --config /etc/caddy/Caddyfile || true
    echo 'Caddy did not accept route removal; CRM left running' >&2
    exit 1
  fi
fi

docker compose --project-directory "$app_dir" --env-file "$app_dir/.env" \
  -f "$app_dir/compose.yml" down --remove-orphans
while IFS= read -r image; do
  if [[ "$image" == mini-crm:* ]]; then
    docker image rm "$image" || true
  fi
done < <(docker image ls mini-crm --format '{{.Repository}}:{{.Tag}}')
cd /
rm -rf -- "$app_dir"
echo 'CRM container, image, Caddy route and app files removed; Minecraft untouched'
