#!/usr/bin/env sh
set -eu

# Generates a self-signed certificate for local/dev use.
# Outputs:
# - infra/nginx/ssl/cert.pem
# - infra/nginx/ssl/key.pem
#
# Usage:
#   ./infra/scripts/generate-self-signed-cert.sh example.com

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
SSL_DIR="$ROOT_DIR/infra/nginx/ssl"
CN="${1:-localhost}"

mkdir -p "$SSL_DIR"

openssl req \
  -x509 \
  -newkey rsa:2048 \
  -sha256 \
  -days 365 \
  -nodes \
  -subj "/CN=$CN" \
  -addext "subjectAltName=DNS:$CN,DNS:localhost,IP:127.0.0.1" \
  -keyout "$SSL_DIR/key.pem" \
  -out "$SSL_DIR/cert.pem"

echo "Wrote:"
echo "  $SSL_DIR/cert.pem"
echo "  $SSL_DIR/key.pem"

