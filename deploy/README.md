# Gracchus VPS pipeline — hands-off data refresh & auto-deploy

This turns the Gracchus data pipeline into something that runs itself on your
Ubuntu VPS. The server fetches new data on a schedule, commits **only** the data
files, and pushes to GitHub — which triggers your existing Vercel build. **No
more manual `git push` from your Mac.**

You keep Vercel for hosting. The VPS just replaces *you* as the thing that runs
the jobs and pushes.

---

## What changes

```
BEFORE                                   AFTER
──────                                   ─────
Cowork scheduled tasks (in a sandbox)    Ubuntu VPS (systemd timers)
   ├─ fetch data ────────────┐              ├─ fetch data ─────────────┐
   └─ git commit             │              ├─ git commit              │
                             │              └─ git push  ✅ automatic  │
YOU: git push from Mac  ◄────┘                                         │
                                                                       ▼
Vercel builds on push  ◄─────────────────────  Vercel builds on push (unchanged)
```

The **Vercel cron jobs** (`/api/refresh-data`, `/api/generate-ai`,
`/api/ingest-spending` in `vercel.json`) are serverless and stay on Vercel —
this migration doesn't touch them.

### The six jobs the VPS will run

| Job (systemd instance)        | Schedule (UTC)        | Type            | What it does |
|-------------------------------|-----------------------|-----------------|--------------|
| `projects-contracts`          | daily 04:15           | Claude judgment | NAO/IPA projects, MOD contracts, planning, crony contracts |
| `markets-finance`             | Mon 09:00             | Claude judgment | Electoral Commission donations, ORCL lobbying |
| `research-structural`         | Mon 09:05             | Claude judgment | ONS/NHS/energy/defence/aid structural series |
| `mp-register`                 | Tue 09:00             | script          | `node scripts/ingest-register.mjs` |
| `appgs`                       | 15th 10:00            | script          | `node scripts/ingest-appgs.mjs` |
| `deploy`                      | daily 05:00           | git             | safety-net commit + push (each job also self-deploys) |

The three **judgment** jobs run **headless Claude** (`claude -p`) with your
`ANTHROPIC_API_KEY` — they web-search and edit JSON exactly like the current
Cowork tasks. They bill per token via the Anthropic API (rough order: a few
cents to low-tens-of-cents per run; the daily one dominates).

---

## Prerequisites

- An Ubuntu 22.04/24.04 VPS with a non-root **sudo** user and SSH access.
- Your Anthropic API key.
- Write access to `github.com/riggins646/gracchusv2` (to add a deploy key).

---

## Step 0 — get this `deploy/` folder onto the VPS

The scripts live in the repo, so first push them, then clone on the box.

**On your Mac**, in the repo (this is your *last* manual push):

```bash
git add deploy && git commit -m "Add VPS auto-deploy pipeline" && git push origin main
```

**On the VPS:**

```bash
sudo mkdir -p /opt/gracchus && sudo chown "$USER" /opt/gracchus
git clone https://github.com/riggins646/gracchusv2.git /opt/gracchus
cd /opt/gracchus
```

> Everything below is run **on the VPS**, from `/opt/gracchus`. All scripts are
> invoked with `bash`, so they don't need the executable bit.

---

## Step 1 — set the clock to UTC

Schedules are written in UTC. Make the box agree:

```bash
sudo timedatectl set-timezone UTC
```

## Step 2 — install dependencies

```bash
bash deploy/bin/setup.sh deps
```

Installs `git`, `curl`, `util-linux` (for `flock`), Node.js 20 LTS, and the
Claude Code CLI (`@anthropic-ai/claude-code`) into a user-level npm prefix.

## Step 3 — create the environment file

```bash
bash deploy/bin/setup.sh env
# then add your key (if it wasn't copied from an existing .env.local):
nano deploy/.env      # set ANTHROPIC_API_KEY=sk-ant-...
```

`setup.sh env` writes absolute `CLAUDE_BIN` / `NODE_BIN` / `GRACCHUS_REPO_DIR`
into `deploy/.env` (so cron/systemd never depend on `PATH`) and `chmod 600`s it.

## Step 4 — password-less GitHub push (SSH deploy key)

```bash
bash deploy/bin/setup.sh sshkey
```

This prints a **public key**. Add it to GitHub:

> repo **riggins646/gracchusv2** → **Settings → Deploy keys → Add deploy key** →
> paste the key → **tick "Allow write access"** → Add.

Then switch the remote to SSH and verify:

```bash
bash deploy/bin/setup.sh remote-ssh
```

A deploy key is scoped to this one repo and never expires — cleaner than a PAT.

## Step 5 — preflight (must pass)

```bash
bash deploy/bin/preflight.sh
```

Checks Node, the Claude CLI, API-key auth, that **`git push` actually works**
(dry-run), and probes **WebSearch** (see §7 if it warns). Fix any `[FAIL]`
before continuing.

## Step 6 — smoke-test one job by hand

```bash
bash deploy/bin/run-job.sh mp-register      # cheap, deterministic — good first test
tail -n 40 deploy/logs/*.log
```

If it finds a new register edition it will commit + push and you'll see the
build appear in Vercel. If nothing's new, it logs "no data changes to deploy"
(correct — idempotent). To test a judgment job (spends a little API credit):

```bash
bash deploy/bin/run-job.sh markets-finance
```

## Step 7 — schedule it

**Recommended: systemd timers** (survive reboots, run missed jobs on boot, log
to journald):

```bash
bash deploy/bin/setup.sh timers
systemctl list-timers 'gracchus-*'      # confirm next run times
```

*Or* use cron instead (simpler, no catch-up):

```bash
sed "s|__REPO__|/opt/gracchus|g" deploy/crontab.example | crontab -
```

## Step 8 — cutover: turn off the old Cowork tasks

Once the VPS timers are live, the old Cowork scheduled tasks must be **disabled**
so they don't double-commit. These are: `gracchus-daily-projects-contracts`,
`gracchus-daily-markets-finance`, `gracchus-daily-research-structural`,
`gracchus-fortnightly-mp-register`, `gracchus-monthly-appgs`, and
`gracchus-daily-deploy`.

> Tell me "disable the old Cowork tasks" and I'll switch them off for you — or
> do it yourself from the Scheduled sidebar. Do this **after** you've seen the
> VPS push at least one successful build.

---

## Day-to-day: what you do

**Nothing.** Check occasionally:

```bash
systemctl list-timers 'gracchus-*'                 # when each job runs next
journalctl -u 'gracchus-job@*' --since today       # what ran today
tail -n 100 /opt/gracchus/deploy/logs/*.log        # per-job detail
```

Pause / resume a single job:

```bash
sudo systemctl disable --now gracchus-projects-contracts.timer   # pause
sudo systemctl enable  --now gracchus-projects-contracts.timer   # resume
```

Run any job right now:

```bash
sudo systemctl start gracchus-job@research-structural.service
# or, to see output live:
bash deploy/bin/run-job.sh research-structural
```

---

## §7 — if WebSearch is unavailable on your VPS

The Claude WebSearch tool can be region-restricted. If preflight warns, the
judgment jobs still work but lean on `WebFetch` of known source URLs (they're
written to degrade gracefully). To restore full search, add a web-search MCP
server and allow it:

1. Get a key from a search provider (e.g. Brave Search API or Tavily).
2. Register the MCP server for the CLI, e.g.
   `claude mcp add brave-search -- npx -y @modelcontextprotocol/server-brave-search`
   (set the provider key in `deploy/.env`).
3. Add its tool to `CLAUDE_COMMON_FLAGS` `--allowedTools` in `deploy/bin/lib.sh`.

Ping me and I'll wire this in specifically.

---

## Safety model

- **Data-only commits.** `deploy_push` stages **only `src/data/`**. Even though
  the judgment jobs run with `--permission-mode bypassPermissions`, any stray
  edit to code is never staged, never pushed — it's logged as a warning instead.
- **Secrets.** `deploy/.env` is `chmod 600` and gitignored. The deploy key is
  repo-scoped (`core.sshCommand`) and write-only to this one repo.
- **Cost cap.** `CLAUDE_MAX_TURNS` (default 40) bounds each judgment run. Lower
  it, or switch `CLAUDE_MODEL` to `haiku` for the cheap jobs, in `deploy/.env`.
- **Concurrency.** Git operations are serialized with `flock`, so the two
  Monday jobs can't clash.

## Troubleshooting

| Symptom | Fix |
|---|---|
| preflight: `git push dry-run failed` | Deploy key not added, or "Allow write access" unticked. Redo Step 4. |
| preflight: `unknown flag --max-turns` | `CLAUDE_MAX_TURNS=` (empty) in `deploy/.env`. |
| preflight: WebSearch unavailable | See §7. Jobs still run via WebFetch. |
| Job ran but no Vercel build | `journalctl -u gracchus-job@<name>` — look for "no data changes" (nothing new) vs a push error. |
| `node`/`claude` not found under systemd | Re-run `bash deploy/bin/setup.sh env` to refresh absolute paths in `.env`. |

## Files in this folder

```
deploy/
├── README.md                 ← you are here
├── .env.example              → copy to .env (bin/setup.sh env does this)
├── bin/
│   ├── lib.sh                shared: env, logging, flock, run_claude_job, deploy_push
│   ├── run-job.sh            single entry point for all six jobs
│   ├── preflight.sh          health check (run before enabling timers)
│   └── setup.sh              deps | env | sshkey | remote-ssh | timers
├── prompts/                  the three judgment-job briefs (adapted from the Cowork SKILLs)
├── systemd/                  templated service + six timers
└── crontab.example           cron alternative to systemd
```
