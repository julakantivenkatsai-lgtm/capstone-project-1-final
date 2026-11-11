#!/bin/bash
# MaintIQ - Start script
# Usage: ./run.sh           → production mode (build + serve)
#        ./run.sh dev       → dev mode (hot-reload frontend + backend)

set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Require explicit credentials instead of installing insecure defaults.
if [ ! -f .env ]; then
  echo "Missing .env. Copy .env.example to .env and set the required credentials."
  exit 1
fi

# Install deps if needed
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

MODE="${1:-production}"

if [ "$MODE" = "dev" ]; then
  echo "Starting in DEV mode..."
  echo "  Frontend : http://localhost:3000  (Vite, hot-reload)"
  echo "  Backend  : http://localhost:3001  (Express API)"
  # Start backend in background
  node server/index.js &
  BACKEND_PID=$!
  # Start Vite dev server (proxies /api → backend)
  npm run dev
  kill $BACKEND_PID 2>/dev/null || true
else
  echo "Building frontend..."
  npm run build
  echo "Starting production server on http://localhost:3001"
  node server/index.js
fi
