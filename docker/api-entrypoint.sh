#!/bin/sh
set -e

MAX_RETRIES=5
RETRY_DELAY=3

echo "Running database migrations..."
attempt=1
while [ "$attempt" -le "$MAX_RETRIES" ]; do
  if npx prisma migrate deploy; then
    echo "Migrations applied successfully."
    break
  fi
  if [ "$attempt" -eq "$MAX_RETRIES" ]; then
    echo "Migration failed after $MAX_RETRIES attempts — exiting."
    exit 1
  fi
  echo "Migration attempt $attempt failed — retrying in ${RETRY_DELAY}s..."
  sleep "$RETRY_DELAY"
  RETRY_DELAY=$((RETRY_DELAY * 2))
  attempt=$((attempt + 1))
done

echo "Starting API server..."
exec node server.js
