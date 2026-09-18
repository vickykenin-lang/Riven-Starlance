#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${RIVEN_REPO_DIR:-/home/ubuntu/Riven-Starlance}"
COMPOSE_FILE="${RIVEN_COMPOSE_FILE:-infra/docker-compose.prod.yml}"

cd "$REPO_DIR"

echo "[deploy] syncing main"
git fetch origin main
git checkout main
git reset --hard origin/main

if [[ ! -f infra/.env ]]; then
  echo "[deploy] ERROR: infra/.env is missing; refusing to deploy without production configuration" >&2
  exit 1
fi

echo "[deploy] building containers"
docker compose -f "$COMPOSE_FILE" build

echo "[deploy] recreating services"
docker compose -f "$COMPOSE_FILE" up -d --force-recreate

echo "[deploy] restarting gateway"
docker compose -f "$COMPOSE_FILE" restart gateway

echo "[deploy] waiting for API health"
for attempt in $(seq 1 30); do
  if curl -fsS http://localhost/health >/tmp/riven-health.json; then
    cat /tmp/riven-health.json
    echo
    break
  fi
  if [[ "$attempt" -eq 30 ]]; then
    echo "[deploy] ERROR: health check did not become ready" >&2
    docker compose -f "$COMPOSE_FILE" ps
    exit 1
  fi
  sleep 2
done

echo "[deploy] system status"
curl -fsS http://localhost/api/system/status
printf '\n'

echo "[deploy] service state"
docker compose -f "$COMPOSE_FILE" ps

echo "[deploy] production deployment verified"
