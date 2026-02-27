#!/bin/sh
set -e
cd /app
# Upload dirs (bind mount /srv/lizard/uploads -> /app/public/uploads): create if missing
mkdir -p /app/public/uploads/posters /app/public/uploads/organizers /app/public/uploads/org-photos
# Project-local Prisma only; migrate deploy is idempotent (no-op if already applied)
npx prisma migrate deploy
exec node server.js
