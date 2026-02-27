#!/bin/sh
set -e
cd /app
export PATH="/usr/local/bin:$PATH"
if command -v prisma >/dev/null 2>&1; then
  prisma migrate deploy
fi
exec node server.js
