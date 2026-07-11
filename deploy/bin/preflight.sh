#!/usr/bin/env bash
# deploy/bin/preflight.sh — verify the VPS can actually run the pipeline.
# Safe to run any time. Exits non-zero if a HARD check fails.
#   HARD  : node, claude, git remote + push auth, API key, claude auth/flags
#   SOFT  : WebSearch availability (falls back to WebFetch), node version
set -uo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SELF_DIR/lib.sh"
JOB_NAME="preflight"

fails=0; warns=0
ok()   { printf '  \033[32m[ ok ]\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m[warn]\033[0m %s\n' "$*"; warns=$((warns+1)); }
fail() { printf '  \033[31m[FAIL]\033[0m %s\n' "$*"; fails=$((fails+1)); }

echo "── Gracchus VPS preflight ───────────────────────────────"
echo "repo:   $GRACCHUS_REPO_DIR"
echo "model:  $CLAUDE_MODEL   claude:$CLAUDE_BIN   node:$NODE_BIN"
echo

# 1. node ---------------------------------------------------------------
if command -v "$NODE_BIN" >/dev/null 2>&1; then
  nv="$("$NODE_BIN" -v 2>/dev/null)"; major="${nv#v}"; major="${major%%.*}"
  if [[ "${major:-0}" -ge 20 ]]; then ok "node $nv"; else warn "node $nv (>=20 recommended)"; fi
else
  fail "node not found ('$NODE_BIN')"
fi

# 2. claude CLI ---------------------------------------------------------
if command -v "$CLAUDE_BIN" >/dev/null 2>&1; then
  ok "claude present: $("$CLAUDE_BIN" --version 2>/dev/null | head -1)"
else
  fail "claude CLI not found ('$CLAUDE_BIN') — run bin/setup.sh"
fi

# 3. git + remote + push auth ------------------------------------------
if [[ -d "$GRACCHUS_REPO_DIR/.git" ]]; then
  remote="$(git -C "$GRACCHUS_REPO_DIR" remote get-url origin 2>/dev/null || true)"
  ok "git repo, origin = ${remote:-<none>}"
  case "$remote" in
    git@github.com:*|ssh://git@github.com/*) : ;;
    https://*) warn "origin is HTTPS — SSH deploy key won't apply; run setup.sh to switch to SSH for password-less push" ;;
  esac
  if git -C "$GRACCHUS_REPO_DIR" ls-remote origin -h >/dev/null 2>&1; then
    ok "git can reach origin (read)"
    # Dry-run push proves WRITE auth without changing anything.
    if git -C "$GRACCHUS_REPO_DIR" push --dry-run origin "HEAD:$GIT_BRANCH" >/dev/null 2>&1; then
      ok "git push auth works (dry-run)"
    else
      fail "git push dry-run failed — deploy key missing/read-only. See runbook §4"
    fi
  else
    fail "cannot reach origin — check SSH deploy key / known_hosts"
  fi
else
  fail "no git repo at $GRACCHUS_REPO_DIR"
fi

# 4. API key ------------------------------------------------------------
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then ok "ANTHROPIC_API_KEY is set"; else fail "ANTHROPIC_API_KEY not set (deploy/.env)"; fi

# 5. claude auth + exact flag set --------------------------------------
if command -v "$CLAUDE_BIN" >/dev/null 2>&1 && [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "  … testing 'claude -p' with the pipeline's flags (this makes one small API call)"
  out="$(printf 'Reply with exactly the token PREFLIGHT_OK and nothing else.' \
        | "$CLAUDE_BIN" -p "${CLAUDE_COMMON_FLAGS[@]}" 2>/tmp/gracchus-pf.err)"; rc=$?
  if [[ $rc -eq 0 && "$out" == *PREFLIGHT_OK* ]]; then
    ok "claude -p authenticated and flags accepted"
  else
    fail "claude -p test failed (rc=$rc). stderr:"; sed 's/^/        /' /tmp/gracchus-pf.err | head -8
    warn "if it says an unknown flag (e.g. --max-turns), unset CLAUDE_MAX_TURNS in deploy/.env"
  fi

  # 6. WebSearch probe (SOFT) ------------------------------------------
  echo "  … probing WebSearch availability"
  ws="$(printf 'Use the WebSearch tool to search for "gov.uk". If WebSearch runs, reply WEBSEARCH_OK. If it is unavailable or errors, reply WEBSEARCH_UNAVAILABLE.' \
        | "$CLAUDE_BIN" -p "${CLAUDE_COMMON_FLAGS[@]}" 2>/dev/null)"
  if [[ "$ws" == *WEBSEARCH_OK* ]]; then
    ok "WebSearch works from this server"
  elif [[ "$ws" == *WEBSEARCH_UNAVAILABLE* ]]; then
    warn "WebSearch unavailable here (region-restricted?). Jobs will lean on WebFetch of known URLs."
    warn "Optional fix: add a web-search MCP server — see runbook §7."
  else
    warn "WebSearch probe inconclusive — inspect manually with: claude -p --allowedTools WebSearch 'search gov.uk'"
  fi
else
  warn "skipping claude/WebSearch probes (need claude + API key first)"
fi

# 7. prompts + flock ----------------------------------------------------
for p in projects-contracts research-structural markets-finance; do
  [[ -f "$DEPLOY_DIR/prompts/$p.md" ]] && ok "prompt present: $p.md" || fail "missing prompt: $p.md"
done
command -v flock >/dev/null 2>&1 && ok "flock present" || fail "flock missing (apt-get install -y util-linux)"

echo
echo "── Result: $fails failed, $warns warnings ───────────────"
[[ $fails -eq 0 ]] && echo "Preflight PASSED — safe to enable the timers." || echo "Preflight FAILED — fix the [FAIL] items above first."
exit $(( fails > 0 ? 1 : 0 ))
