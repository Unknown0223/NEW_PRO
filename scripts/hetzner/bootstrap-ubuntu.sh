#!/usr/bin/env bash
# Yangi Hetzner Ubuntu 24.04 — Docker + Coolify.
# Root yoki sudo bilan: bash bootstrap-ubuntu.sh
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Root bilan ishga tushiring: sudo bash $0" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y
apt-get install -y ca-certificates curl git ufw

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8000/tcp
yes | ufw enable || true

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

systemctl enable --now docker

if [[ ! -d /data/coolify ]]; then
  curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
fi

echo
echo "Coolify: http://SERVER_IP:8000  (birinchi ochilganda admin yarating)"
echo "Keyin chatga yozing: Coolify ochildi"
