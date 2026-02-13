# cftunnel

CLI tool for managing Cloudflare Tunnels for team dev environments. Like ngrok, but on your own domain — free, with zero config for developers.

**Pattern:** `https://local-dev-{name}.yourdomain.dev` &rarr; `localhost:3000`

Admin creates tunnels via API. Devs run them with a single token. No `cloudflared` config files needed.

## Features

- **Remotely-managed tunnels** — devs only need `cloudflared` + a token string
- **Zero config for devs** — `cftunnel start --token TOKEN` and done
- **Auto-installs cloudflared** — downloads from GitHub releases if missing
- **Free** — Cloudflare Tunnels have no usage charges
- **Quick tunnels** — `cftunnel start --quick` for instant random public URLs
- **Shell completions** — bash, zsh, fish with auto-detection
- **Background mode** — run detached with `cftunnel start -d`

## Install

```bash
# From npm (requires Bun runtime)
npm install -g cftunnel

# Or build from source
git clone https://github.com/bphkns/cftunnel.git
cd cftunnel
bun install
bun run build          # produces standalone binary at dist/cftunnel
```

## Quick Start

### For Admins (team leads)

```bash
# 1. Set up API credentials
cftunnel setup

# 2. Create a tunnel for a team member
cftunnel create stark                # → https://local-dev-stark.example.dev
cftunnel create wolverine -p 8080   # custom port

# 3. Get the token to share with the dev
cftunnel token stark
```

### For Devs

```bash
# First time — paste the token your admin gave you
cftunnel start --token <TOKEN>

# After that — token is saved locally
cftunnel start          # foreground (Ctrl+C to stop)
cftunnel start -d       # background mode

# Stop a background tunnel
cftunnel stop

# No token? Use a quick random URL
cftunnel start --quick
```

## Usage Guide

### 1. Admin Setup

Before creating tunnels, the admin needs a Cloudflare API token with these permissions:

| Scope   | Resource          | Permission |
|---------|-------------------|------------|
| Account | Cloudflare Tunnel | Edit       |
| Zone    | DNS               | Edit       |

Create one at [Cloudflare Dashboard > API Tokens](https://dash.cloudflare.com/profile/api-tokens).

```bash
cftunnel setup
```

The interactive wizard will:
1. Prompt for (or open the browser to create) an API token
2. Verify the token and list available accounts
3. Let you pick a domain (optional — you can use quick tunnels without one)
4. Set a subdomain prefix (default: `local-dev`)

**Non-interactive setup** (CI/scripting):

```bash
cftunnel setup --token TOKEN --account-id ID --zone-id ID --prefix local-dev
```

Config is saved to `~/.local/share/cftunnel/config.json` with `0600` permissions.

### 2. Creating Tunnels

```bash
cftunnel create <name> [-p PORT]
```

This does four things via the Cloudflare API:
1. Creates a named tunnel (`local-dev-<name>`)
2. Configures ingress rules (hostname &rarr; `localhost:PORT`)
3. Creates a DNS CNAME record
4. Fetches and saves the tunnel token

The token is printed (masked) and saved locally. Share it with the dev via a secure channel.

**Examples:**

```bash
cftunnel new stark              # local-dev-stark.example.dev → localhost:3000
cftunnel new wolverine -p 8080  # local-dev-wolverine.example.dev → localhost:8080
cftunnel new thor -p 5173       # local-dev-thor.example.dev → localhost:5173
```

### 3. Running Tunnels (Dev Workflow)

Token resolution order:
1. `--token` flag (highest priority, saved for future use)
2. `CFTUNNEL_TOKEN` environment variable
3. Saved token file (`~/.local/share/cftunnel/tunnel-token`)
4. Interactive prompt (first-time devs)

```bash
# First time
cftunnel start --token eyJhIjoi...

# Subsequent runs
cftunnel start           # uses saved token
cftunnel start -d        # background mode

# Using env var
export CFTUNNEL_TOKEN=eyJhIjoi...
cftunnel start
```

**Run modes:**

| Flag | Mode | Description |
|------|------|-------------|
| *(none)* | Interactive | Prompts for foreground/background |
| `-d`, `--background` | Background | Detached, logs to file |
| `-q`, `--quick` | Quick | Random trycloudflare.com URL, no token needed |

### 4. Managing Tunnels

```bash
# List all tunnels with status and URLs
cftunnel ls

# Show full status (config, process, tunnels)
cftunnel status

# Delete a tunnel (tunnel + DNS)
cftunnel rm rogue

# Delete with options
cftunnel rm rogue --dns-only        # keep tunnel, remove DNS
cftunnel rm rogue --tunnel-only     # keep DNS, remove tunnel
cftunnel rm rogue -f                # skip confirmation
```

### 5. Domain Management

```bash
# Add or change domain after setup
cftunnel domain

# Non-interactive
cftunnel domain --zone-id ID --prefix local-dev

# Remove domain (switch to quick-tunnel-only mode)
cftunnel domain --clear
```

### 6. Shell Completions

```bash
# Auto-detect shell and show install instructions
cftunnel completions

# Generate for a specific shell
cftunnel completions --shell zsh
cftunnel completions --shell bash
cftunnel completions --shell fish

# Pipe to install (bash example)
cftunnel completions --shell bash > ~/.local/share/bash-completion/completions/cftunnel
```

## Vite / Webpack Dev Servers

Cloudflare Tunnels forward requests with the tunnel hostname. Dev servers like Vite block unknown hosts by default. Add your domain to `allowedHosts`:

**Vite** (`vite.config.ts`):

```ts
export default defineConfig({
  server: {
    allowedHosts: ['.example.dev'],  // replace with your domain
  },
})
```

**Webpack** (`webpack.config.js`):

```js
module.exports = {
  devServer: {
    allowedHosts: ['.example.dev'],
  },
}
```

> `cftunnel` configures `httpHostHeader: "localhost"` on the tunnel ingress, which handles most frameworks. But Vite's host check also inspects the HTTP/2 `:authority` pseudo-header, so the `allowedHosts` config is the reliable fix.

## Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `setup` | | Set up API credentials |
| `status` | | Show config, process, and tunnels |
| `domain` | | Add, change, or remove domain |
| `create` | `new` | Create a tunnel for a dev |
| `delete` | `rm` | Delete tunnel and/or DNS |
| `list` | `ls` | List all tunnels |
| `token` | | Print tunnel token for a dev |
| `start` | `run` | Run the tunnel |
| `stop` | | Stop a background tunnel |
| `completions` | | Print shell completions |
| `help` | `-h` | Show help |
| `version` | `-v` | Print version |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CFTUNNEL_TOKEN` | Tunnel token (alternative to `--token` flag) |

## Data Storage

All data is stored in `~/.local/share/cftunnel/` (XDG-compliant):

| File | Permissions | Contents |
|------|-------------|----------|
| `config.json` | `0600` | API token, account/zone IDs, domain, prefix |
| `tunnel-token` | `0600` | Tunnel run token |
| `cloudflared.pid` | `0600` | PID of background cloudflared process |
| `cloudflared.log` | `0600` | Logs from background cloudflared |

## Security

- All config/token files use `0600` permissions (owner read/write only)
- Config directory uses `0700` permissions
- Tokens are masked in CLI output (first 8 + last 4 chars)
- No secrets in source code — all values come from config at runtime
- `cloudflared` is auto-downloaded from official GitHub releases
- Token is visible in `ps aux` when running — this is inherent to cloudflared's design

## Requirements

- **Bun** (for running from source) or use the compiled binary
- **cloudflared** (auto-installed if missing)
- Cloudflare account with a domain (optional — quick tunnels work without one)

## Development

```bash
bun install
bun run dev -- setup          # run any command
bun run lint                  # biome check
bun run check                 # tsc --noEmit
bun run build                 # compile standalone binary
```

## License

MIT
