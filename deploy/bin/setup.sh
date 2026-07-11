#!/usr/bin/env bash
# deploy/bin/setup.sh — idempotent provisioning for the Gracchus VPS pipeline.
# Run the subcommands in the order shown in the runbook (README §3–§5).
#
#   bin/setup.sh deps         # apt deps + Node 20 (NodeSource) + claude CLI   [needs sudo]
#   bin/setup.sh env          # create deploy/.env, fill in node/claude paths + repo dir
#   bin/setup.sh sshkey       # generate a GitHub deploy key + trust github.com
#   bin/setup.sh remote-ssh   # switch 'origin' to SSH so pushes need no password
#   bin/setup.sh timers       # install + enable systemd timers                [needs sudo]
#   bin/setup.sh all          # deps + env + sshkey  (stops for you to add the key to GitHub)
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SELF_DIR/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
GH_REPO_SSH="git@github.com:riggins646/gracchusv2.git"
DEPLOY_KEY="$HOME/.ssh/gracchus_deploy"

say()  { printf '\n\033[36m▶ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }

upsert_env() { # upsert KEY=VALUE into deploy/.env
  local k="$1" v="$2" f="$DEPLOY_DIR/.env"
  touch "$f"
  if grep -q "^${k}=" "$f"; then
    sed -i "s|^${k}=.*|${k}=${v}|" "$f"
  else
    printf '%s=%s\n' "$k" "$v" >> "$f"
  fi
}

cmd_deps() {
  say "Installing OS packages (git, curl, util-linux for flock)…"
  sudo apt-get update -qq
  sudo apt-get install -y git curl ca-certificates util-linux

  if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//;s/\..*//')" -lt 20 ]]; then
    say "Installing Node.js 20 LTS (NodeSource)…"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
  info "node $(node -v), npm $(npm -v)"

  say "Installing the Claude Code CLI (user-level npm prefix, no sudo)…"
  mkdir -p "$HOME/.npm-global"
  npm config set prefix "$HOME/.npm-global"
  npm install -g @anthropic-ai/claude-code
  info "claude → $HOME/.npm-global/bin/claude"
  info "Done. Next: bin/setup.sh env"
}

cmd_env() {
  say "Creating deploy/.env…"
  [[ -f "$DEPLOY_DIR/.env" ]] || cp "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env"
  chmod 600 "$DEPLOY_DIR/.env"

  # Record absolute binary paths so cron/systemd never depend on PATH.
  local claude_bin node_bin
  claude_bin="$(command -v claude || echo "$HOME/.npm-global/bin/claude")"
  node_bin="$(command -v node || echo /usr/bin/node)"
  upsert_env CLAUDE_BIN "$claude_bin"
  upsert_env NODE_BIN "$node_bin"
  upsert_env GRACCHUS_REPO_DIR "$REPO_DIR"

  # If the repo still has a local .env.local with the key, reuse it.
  if ! grep -q '^ANTHROPIC_API_KEY=..' "$DEPLOY_DIR/.env" 2>/dev/null; then
    if [[ -f "$REPO_DIR/.env.local" ]] && grep -q '^ANTHROPIC_API_KEY=' "$REPO_DIR/.env.local"; then
      local k; k="$(grep '^ANTHROPIC_API_KEY=' "$REPO_DIR/.env.local" | head -1 | cut -d= -f2-)"
      upsert_env ANTHROPIC_API_KEY "$k"
      info "Copied ANTHROPIC_API_KEY from repo .env.local"
    else
      info "!! Add your key:  echo 'ANTHROPIC_API_KEY=sk-ant-...' >> $DEPLOY_DIR/.env"
    fi
  fi
  chmod +x "$SELF_DIR"/*.sh
  info "deploy/.env ready (chmod 600). Next: bin/setup.sh sshkey"
}

cmd_sshkey() {
  say "Generating a GitHub deploy key…"
  mkdir -p "$HOME/.ssh"; chmod 700 "$HOME/.ssh"
  if [[ -f "$DEPLOY_KEY" ]]; then
    info "Key already exists: $DEPLOY_KEY"
  else
    ssh-keygen -t ed25519 -N '' -C "gracchus-vps-deploy" -f "$DEPLOY_KEY"
  fi
  # Trust github.com (idempotent).
  touch "$HOME/.ssh/known_hosts"
  ssh-keygen -F github.com >/dev/null 2>&1 || ssh-keyscan -t ed25519 github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null
  # Make THIS repo use the deploy key (repo-scoped, doesn't affect other repos).
  git -C "$REPO_DIR" config core.sshCommand "ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes"
  cat <<EOF

  ┌─ ACTION REQUIRED ─────────────────────────────────────────────┐
  │ Add this PUBLIC key as a *deploy key WITH WRITE ACCESS*:       │
  │   GitHub → repo riggins646/gracchusv2 → Settings → Deploy keys │
  │   → Add deploy key → tick "Allow write access"                 │
  └───────────────────────────────────────────────────────────────┘

$(cat "$DEPLOY_KEY.pub")

  Then run:  bin/setup.sh remote-ssh  &&  bin/preflight.sh
EOF
}

cmd_remote_ssh() {
  say "Switching origin to SSH…"
  git -C "$REPO_DIR" remote set-url origin "$GH_REPO_SSH"
  info "origin → $(git -C "$REPO_DIR" remote get-url origin)"
  if git -C "$REPO_DIR" ls-remote origin -h >/dev/null 2>&1; then
    info "✓ SSH auth to GitHub works."
  else
    info "✗ SSH auth failed — is the deploy key added to GitHub yet? (bin/setup.sh sshkey)"
  fi
}

cmd_timers() {
  say "Installing systemd service + timers…"
  local run_user="${SUDO_USER:-$USER}"
  local tmpl="$DEPLOY_DIR/systemd"
  # Render the templated service with this install's path + user.
  sudo sed -e "s|__DEPLOY_BIN__|$SELF_DIR/run-job.sh|g" \
           -e "s|__RUN_USER__|$run_user|g" \
           -e "s|__REPO_DIR__|$REPO_DIR|g" \
           "$tmpl/gracchus-job@.service" | sudo tee /etc/systemd/system/gracchus-job@.service >/dev/null
  sudo cp "$tmpl"/gracchus-*.timer /etc/systemd/system/
  sudo systemctl daemon-reload
  for t in "$tmpl"/gracchus-*.timer; do
    local name; name="$(basename "$t")"
    sudo systemctl enable --now "$name"
    info "enabled $name"
  done
  info "Timers active. Inspect with:  systemctl list-timers 'gracchus-*'"
}

case "${1:-}" in
  deps)        cmd_deps ;;
  env)         cmd_env ;;
  sshkey)      cmd_sshkey ;;
  remote-ssh)  cmd_remote_ssh ;;
  timers)      cmd_timers ;;
  all)         cmd_deps; cmd_env; cmd_sshkey ;;
  *) grep '^#   bin/setup.sh' "$0" | sed 's/^#   //'; exit 1 ;;
esac
