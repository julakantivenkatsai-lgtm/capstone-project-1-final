#!/bin/bash
# MaintIQ Project Root Start Script
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/web"
chmod +x run.sh
./run.sh "$@"
