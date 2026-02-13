# cftunnel

Cloudflare Tunnel CLI for team dev environments. Like ngrok, but on your own domain — free.

```
https://local-dev-stark.yourdomain.dev → localhost:3000
```

Admin creates tunnels via API. Devs run them with a single token.

## Install

```bash
# npm (includes platform binary)
npm install -g @thewebkernel/cftunnel

# or curl
curl -fsSL https://github.com/bphkns/cftunnel/releases/latest/download/install.sh | bash
```

## Quick Start

**Admin** — set up once, create tunnels for your team:

```bash
cftunnel setup                       # interactive API token wizard
cftunnel create stark                # → https://local-dev-stark.example.dev
cftunnel create wolverine -p 8080    # custom port
cftunnel token stark                 # print token to share with dev
```

**Dev** — run with token from admin:

```bash
cftunnel start --token <TOKEN>       # first time (saves token)
cftunnel start                       # after that
cftunnel start -d                    # background mode
cftunnel stop                        # stop background tunnel
```

**No token?** Get a quick random URL instantly:

```bash
cftunnel start --quick
```

## Admin Setup

You need a Cloudflare API token with **Tunnel Edit** + **DNS Edit** permissions.
Create one at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens).

```bash
cftunnel setup

# or non-interactive
cftunnel setup --token TOKEN --account-id ID --zone-id ID --prefix local-dev
```

## Commands

| Command | Alias | What it does |
|---------|-------|--------------|
| `setup` | | Configure API credentials |
| `create` | `new` | Create tunnel + DNS + ingress for a dev |
| `delete` | `rm` | Delete tunnel and/or DNS record |
| `list` | `ls` | List all tunnels with status |
| `token` | | Print tunnel token for a dev |
| `start` | `run` | Run a tunnel (foreground, `-d` background, `--quick`) |
| `stop` | | Stop background tunnel |
| `status` | | Show config, process, and tunnel info |
| `domain` | | Add, change, or remove domain |
| `completions` | | Shell completions (bash/zsh/fish) |

## Dev Server Config

Vite and Webpack block unknown hostnames by default. Add your domain:

```ts
// vite.config.ts
export default defineConfig({
  server: { allowedHosts: ['.example.dev'] },  // your domain
})
```

```js
// webpack.config.js
module.exports = {
  devServer: { allowedHosts: ['.example.dev'] },
}
```

## Security

- All files stored in `~/.local/share/cftunnel/` with `0600` permissions
- Tokens masked in output (first 8 + last 4 chars)
- No secrets in source — everything from config at runtime
- `cloudflared` auto-installed from official GitHub releases

## Development

```bash
bun install
bun run dev -- setup     # run commands
bun run lint             # biome check
bun run check            # tsc --noEmit
bun run build            # compile standalone binary
```

## License

MIT
