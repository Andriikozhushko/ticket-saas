#!/bin/sh
set -e
cd /app
# Project-local Prisma only; migrate deploy is idempotent (no-op if already applied)
if [ -f ./node_modules/prisma/build/index.js ]; then
  node ./node_modules/prisma/build/index.js migrate deploy
fi
exec node server.js
