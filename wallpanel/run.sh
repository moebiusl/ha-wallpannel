#!/usr/bin/env bash
set -e

export PORT="${PORT:-3000}"
export HA_URL="${HA_URL:-http://supervisor/core}"
export HA_TOKEN="${HA_TOKEN:-${SUPERVISOR_TOKEN}}"

cd /app
exec node dist/server.js
