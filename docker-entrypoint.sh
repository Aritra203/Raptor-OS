#!/bin/sh
set -e

echo "[RaptorOS] Starting container initialization..."

# Resilient migration execution with retry
max_retries=15
count=0
until prisma migrate deploy --schema=./prisma/schema.prisma || [ $count -eq $max_retries ]; do
  echo "[RaptorOS] Database not yet ready for migration. Waiting 2s... ($((count+1))/$max_retries)"
  sleep 2
  count=$((count+1))
done

if [ $count -eq $max_retries ]; then
  echo "[RaptorOS] ERROR: Database migration failed after $max_retries attempts."
  exit 1
fi

echo "[RaptorOS] Database migrations applied successfully."

# Execute deterministic database seed
echo "[RaptorOS] Seeding initial infrastructure data..."
tsx ./prisma/seed.ts

echo "[RaptorOS] Initialization complete. Launching application server..."
exec "$@"
