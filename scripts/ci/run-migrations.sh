#!/usr/bin/env bash
set -euo pipefail

echo "Running database migrations for all services..."

run_one() {
  local filter="$1"
  local label="$2"
  if ! pnpm --filter "$filter" run db:migrate; then
    echo "✗ Migration failed for ${label}" >&2
    exit 1
  fi
  echo "✓ ${label} migrations complete"
}

run_one "@ai-startup-builder/auth-service" "auth-service"
run_one "@ai-startup-builder/user-service" "user-service"
run_one "@ai-startup-builder/project-service" "project-service"
run_one "@ai-startup-builder/ai-service" "ai-service"
run_one "@ai-startup-builder/billing-service" "billing-service"
run_one "@ai-startup-builder/notification-service" "notification-service"
run_one "@ai-startup-builder/analytics-service" "analytics-service"

echo "✓ All migrations complete."
