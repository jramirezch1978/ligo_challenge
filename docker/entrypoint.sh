#!/bin/sh
set -e

echo "Running database migrations..."
node dist/database/migrate.js

echo "Starting Wallet Transaction Service..."
exec node dist/main.js
