#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be reachable..."
node docker/wait-for-postgres.js

echo "Running database migrations (no-op if already applied by the database layer)..."
node dist/database/migrate.js

echo "Starting Wallet Transaction Service..."
exec node dist/main.js
