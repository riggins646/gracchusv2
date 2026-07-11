#!/usr/bin/env bash
# deploy/bin/lib.sh — shared helpers for the Gracchus VPS data pipeline.
# Sourced by run-job.sh, preflight.sh and setup.sh. Do not execute directly.

set -euo pipefail

# ── Resolve paths ─────────────────────────────────────────────────────
BIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$BIN_DIR/.." && pwd)"
REPO_DIR_DEFAULT="$(cd "$DEPLOY_DIR/.." && pwd)"

# ── Load env (deploy/.env overrides the defaults below) ───────────────
if [[ -f "$DEPLOY_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$DEPLOY_DIR/.env"
  set +a
fi

: "${GRACCHUS_REPO_DIR:=$REPO_DIR_DEFAULT}"   # repo root on the VPS
: "${CLAUDE_MODEL:=sonnet}"                    # model for judgment jobs
: "${CLAUDE_MAX_TURNS:=40}"                    # unattended cost/turn cap ("" to disable)
: "${GIT_BRANCH:=main}"
: "${GIT_AUTHOR_NAME:=Gracchus Bot}"
: "${GIT_AUTHOR_EMAIL:=bot@gracchus.ai}"
: "${LOG_DIR:=$DEPLOY_DIR/logs}"
: "${LOCK_DIR:=$DEPLOY_DIR/.locks}"
: "${DATA_GLOB:=src/data}"                     # ONLY this path is ever committed/pushed
: "${CLAUDE_CONFIG_DIR:=$DEPLOY_DIR/.claude-config}"  # isolate Claude config from any user setup
: "${CLAUDE_BIN:=claude}"                      # abs path allowed (setup.sh fills this in)
: "${NODE_BIN:=node}"                          # abs path allowed (setup.sh fills this in)
export CLAUDE_CONFIG_DIR

mkdir -p "$LOG_DIR" "$LOCK_DIR" "$CLAUDE_CONFIG_DIR"

# Flags shared by every Claude judgment run. Edit here once; preflight tests this
# exact set. --permission-mode bypassPermissions => never blocks on a prompt.
CLAUDE_COMMON_FLAGS=(
  --model "$CLAUDE_MODEL"
  --permission-mode bypassPermissions
  --allowedTools "Read,Edit,Write,WebSearch,WebFetch,Bash"
  --output-format json
)
if [[ -n "${CLAUDE_MAX_TURNS:-}" ]]; then
  CLAUDE_COMMON_FLAGS+=(--max-turns "$CLAUDE_MAX_TURNS")
fi

# ── Logging ───────────────────────────────────────────────────────────
log() { printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${JOB_NAME:-lib}" "$*"; }
die() { log "ERROR: $*"; exit 1; }

# ── Locking — serialize git ops and any concurrent jobs (e.g. the two
#    Monday-09:00 jobs). Usage: with_lock <name> <command...> ──────────
with_lock() {
  local name="$1"; shift
  local lf="$LOCK_DIR/$name.lock"
  local rc=0
  {
    flock -w 600 9 || die "could not acquire lock '$name' within 600s"
    "$@" || rc=$?
  } 9>"$lf"
  return "$rc"
}

require_api_key() {
  [[ -n "${ANTHROPIC_API_KEY:-}" ]] || die "ANTHROPIC_API_KEY not set — add it to $DEPLOY_DIR/.env"
}

# ── Run one Claude judgment job: prompts/<job>.md, repo as cwd ─────────
run_claude_job() {
  local job="$1"
  local prompt_file="$DEPLOY_DIR/prompts/$job.md"
  local day; day="$(date -u +%Y%m%d)"
  [[ -f "$prompt_file" ]] || die "prompt not found: $prompt_file"
  require_api_key
  command -v "$CLAUDE_BIN" >/dev/null 2>&1 || die "claude CLI not found ('$CLAUDE_BIN') — run bin/setup.sh"

  cd "$GRACCHUS_REPO_DIR"
  log "starting Claude job '$job' (model=$CLAUDE_MODEL, cwd=$PWD)"

  # Prompt on stdin; repo stays cwd so every edit lands under src/data/.
  # Soft-fail: a bad Claude run must not wedge the pipeline — deploy_push
  # simply finds nothing staged and no-ops.
  set +e
  "$CLAUDE_BIN" -p "${CLAUDE_COMMON_FLAGS[@]}" \
    < "$prompt_file" \
    > "$LOG_DIR/$job-$day.json" \
    2>> "$LOG_DIR/$job-$day.err"
  local rc=$?
  set -e
  if [[ $rc -ne 0 ]]; then
    log "WARN: claude exited $rc — see $LOG_DIR/$job-$day.err"
  else
    log "Claude job '$job' finished"
  fi
  return 0
}

# ── Commit + push ONLY data changes; Vercel auto-builds on push ────────
deploy_push() {
  cd "$GRACCHUS_REPO_DIR"

  # Stage only data. Never code — hard guardrail against the autonomous jobs.
  git add -- "$DATA_GLOB" 2>/dev/null || true

  # Surface (but never push) anything the jobs touched outside src/data/.
  local other
  other="$(git status --porcelain -- . ":(exclude)${DATA_GLOB}" | grep -v '^??' || true)"
  if [[ -n "$other" ]]; then
    log "WARN: non-data changes present and deliberately NOT staged:"
    printf '%s\n' "$other" | while IFS= read -r l; do log "    $l"; done
  fi

  if git diff --cached --quiet; then
    log "no data changes to deploy"
    return 0
  fi

  local stat; stat="$(git diff --cached --shortstat || true)"
  log "committing data changes:$stat"
  GIT_AUTHOR_NAME="$GIT_AUTHOR_NAME"   GIT_AUTHOR_EMAIL="$GIT_AUTHOR_EMAIL" \
  GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME" GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL" \
    git commit -q \
      -m "Automated data refresh $(date -u +%Y-%m-%d)" \
      -m "Committed by the Gracchus VPS pipeline (job: ${JOB_NAME:-deploy})." \
    || { log "ERROR: git commit failed"; return 1; }

  log "pushing to origin/$GIT_BRANCH"
  if git push -q origin "HEAD:$GIT_BRANCH"; then
    log "push OK — Vercel deploy will trigger from the GitHub integration"
  else
    log "ERROR: git push failed — changes are committed locally but NOT live"
    log "       check the SSH deploy key (bin/preflight.sh) and 'git remote -v'"
    return 1
  fi
}
