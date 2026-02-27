#!/bin/sh
set -e
cd /app
# Project-local Prisma only; migrate deploy is idempotent (no-op if already applied)
npx prisma migrate deploy
exec node server.js
