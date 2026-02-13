#!/usr/bin/env bun

import { VERSION } from "./lib/constants.js";
import { parse } from "./utils/cli.js";

const HELP = `
cftunnel v${VERSION} — Cloudflare Tunnel CLI

Commands:
  setup                                 Set up Cloudflare API credentials
  create | new  <name> [-p 3000]        Create a tunnel for a dev
  delete | rm   <name> [flags]          Delete tunnel and/or DNS record
  list   | ls                           List all tunnels
  token         <name>                  Print the tunnel token for a dev
  start  | run  [--token TOKEN] [-d]    Run the tunnel (dev command)
  stop                                  Stop a background tunnel
  help   | -h                           Show this help message

Start flags:
  -d, --background   Run tunnel in background (logs to ~/.local/share/cftunnel/)
  --token TOKEN      Use a specific tunnel token

Create flags:
  -p, --port PORT    Target port on localhost (default: 3000)

Delete flags:
  --dns-only         Only remove the DNS record (keep tunnel)
  --tunnel-only      Only remove the tunnel (keep DNS)
  (default)          Remove both tunnel and DNS

Examples:
  cftunnel new stark                    Create tunnel → local-dev-stark.tl.new
  cftunnel new wolverine -p 8080        Create tunnel on custom port
  cftunnel token thor                   Print token for thor to run locally
  cftunnel run                          Run tunnel in foreground
  cftunnel run -d                       Run tunnel in background
  cftunnel stop                         Stop background tunnel
  cftunnel rm rogue                     Delete tunnel + DNS for rogue
  cftunnel rm rogue --dns-only          Only remove DNS record
  cftunnel ls                           List all active tunnels
`;

const args = parse(process.argv);

async function run(): Promise<void> {
	switch (args.command) {
		case "help":
			console.log(HELP);
			return;
		case "version":
			console.log(VERSION);
			return;
		case "setup": {
			const { setup } = await import("./commands/setup.js");
			return setup();
		}
		case "create": {
			const { create } = await import("./commands/create.js");
			return create(args.name, args.port);
		}
		case "delete": {
			const { del } = await import("./commands/delete.js");
			return del(args.name, { dnsOnly: args.dnsOnly, tunnelOnly: args.tunnelOnly });
		}
		case "list": {
			const { list } = await import("./commands/list.js");
			return list();
		}
		case "token": {
			const { token } = await import("./commands/token.js");
			return token(args.name);
		}
		case "start": {
			const { start } = await import("./commands/start.js");
			return start(args.token, args.background);
		}
		case "stop": {
			const { stop } = await import("./commands/stop.js");
			return stop();
		}
		case "unknown":
			console.error(`Unknown command: "${args.raw}"\n`);
			console.log(HELP);
			process.exit(1);
	}
}

run().catch((err: unknown) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
