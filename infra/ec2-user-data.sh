#!/bin/bash
set -euxo pipefail

exec > >(tee /var/log/riven-starlance-bootstrap.log | logger -t user-data -s 2>/dev/console) 2>&1

# Amazon Linux 2023 / yum-compatible bootstrap for the first single-host MVP.
yum update -y
yum install -y git docker
systemctl enable --now docker

# Docker Compose v2 plugin may already be present. Install standalone plugin if missing.
if ! docker compose version >/dev/null 2>&1; then
  mkdir -p /usr/local/lib/docker/cli-plugins
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64) COMPOSE_ARCH=x86_64 ;;
    aarch64|arm64) COMPOSE_ARCH=aarch64 ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
  esac
  curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${COMPOSE_ARCH}" -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

mkdir -p /opt/riven-starlance
cd /opt/riven-starlance

git clone --depth 1 https://github.com/vickykenin-lang/Riven-Starlance.git app
cd app
cp infra/.env.example infra/.env

# The stack is intentionally NOT started automatically because the five Bedrock model IDs
# must first be verified and entered into infra/.env. After that, run:
#   cd /opt/riven-starlance/app
#   docker compose --env-file infra/.env -f infra/docker-compose.prod.yml up -d --build

cat >/etc/motd.d/riven-starlance <<'EOF'
Riven-Starlance bootstrap completed.
Repository: /opt/riven-starlance/app
Next: verify Bedrock model IDs, edit infra/.env, then start docker compose.
Bootstrap log: /var/log/riven-starlance-bootstrap.log
EOF
