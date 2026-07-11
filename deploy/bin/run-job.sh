#!/usr/bin/env bash
# deploy/bin/run-job.sh — single entry point for every scheduled job.
# Called by systemd (gracchus-job@<name>) or cron. After any data-producing
# job it runs deploy_push, which commits + pushes ONLY src/data changes so
# Vercel rebuilds. Idempotent: no changes => no commit.
#
# Usage: run-job.sh <projects-contracts|research-structural|markets-finance|mp-register|appgs|deploy>
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SELF_DIR/lib.sh"

JOB_NAME="${1:-}"
[[ -n "$JOB_NAME" ]] || die "usage: run-job.sh <projects-contracts|research-structural|markets-finance|mp-register|appgs|deploy>"

run_node_ingester() {
  local script="$1" day; day="$(date -u +%Y%m%d)"
  cd "$GRACCHUS_REPO_DIR"
  command -v "$NODE_BIN" >/dev/null 2>&1 || die "node not found ('$NODE_BIN')"
  log "running $script"
  if "$NODE_BIN" "$script" >> "$LOG_DIR/$JOB_NAME-$day.log" 2>&1; then
    log "$script finished"
  else
    log "WARN: $script exited non-zero — see $LOG_DIR/$JOB_NAME-$day.log"
  fi
}

log "=== run-job '$JOB_NAME' start ==="
case "$JOB_NAME" in
  projects-contracts|research-structural|markets-finance)
    run_claude_job "$JOB_NAME"
    with_lock deploy deploy_push
    ;;
  mp-register)
    run_node_ingester scripts/ingest-register.mjs
    with_lock deploy deploy_push
    ;;
  appgs)
    run_node_ingester scripts/ingest-appgs.mjs
    with_lock deploy deploy_push
    ;;
  deploy)
    # Safety-net batch push (catches anything an inline push missed).
    with_lock deploy deploy_push
    ;;
  *)
    die "unknown job '$JOB_NAME'"
    ;;
esac
log "=== run-job '$JOB_NAME' done ==="
