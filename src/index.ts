#!/usr/bin/env bun

import { DEFAULT_PORT } from "./lib/constants.js";
import { VERSION } from "./lib/constants.js";
import { parseArgs } from "./utils/cli.js";

const HELP = `
cftunnel v${VERSION} — Cloudflare Tunnel CLI

Commands:
  setup                                 Set up Cloudflare API credentials
  create | new  <name> [--port 3000]    Create a tunnel for a dev
  delete | rm   <name> [flags]          Delete tunnel and/or DNS record
  list   | ls                           List all tunnels
  token         <name>                  Print the tunnel token for a dev
  start  | run  [--token TOKEN] [-d]    Run the tunnel (dev command)
  stop                                  Stop a background tunnel
  help   | -h                           Show this help message

Start flags:
  -d, --background   Run tunnel in background (logs to ~/.local/share/cftunnel/)
  --token TOKEN      Use a specific tunnel token

Delete flags:
  --dns-only         Only remove the DNS record (keep tunnel)
  --tunnel-only      Only remove the tunnel (keep DNS)
  (default)          Remove both tunnel and DNS

Examples:
  cftunnel new stark                    Create tunnel → local-dev-stark.tl.new
  cftunnel new wolverine --port 8080    Create tunnel on custom port
  cftunnel token thor                   Print token for thor to run locally
  cftunnel run                          Run tunnel in foreground
  cftunnel run -d                       Run tunnel in background
  cftunnel stop                         Stop background tunnel
  cftunnel rm rogue                     Delete tunnel + DNS for rogue
  cftunnel rm rogue --dns-only          Only remove DNS record
  cftunnel ls                           List all active tunnels
`;

const ALIASES: Record<string, string> = {
	new: "create",
	rm: "delete",
	ls: "list",
	run: "start",
};

const { command: rawCommand, positional, flags } = parseArgs(process.argv);
const command = rawCommand ? (ALIASES[rawCommand] ?? rawCommand) : rawCommand;

if (!command || command === "help" || command === "--help" || command === "-h") {
	console.log(HELP);
	process.exit(0);
}

if (command === "--version" || command === "-v") {
	console.log(VERSION);
	process.exit(0);
}

function requireName(): string {
	const name = positional[0];
	if (!name) {
		console.error(`Usage: cftunnel ${rawCommand} <name>\n`);
		console.error("Name is required. This is the dev's identifier (e.g. stark, wolverine).");
		process.exit(1);
	}
	return name;
}

function getPort(): number {
	const raw = flags.port;
	if (raw === true || raw === undefined) return DEFAULT_PORT;
	const num = Number(raw);
	if (Number.isNaN(num) || num < 1 || num > 65535) {
		console.error("--port must be a number between 1 and 65535");
		process.exit(1);
	}
	return num;
}

function hasFlag(name: string): boolean {
	return flags[name] === true;
}

async function run(): Promise<void> {
	switch (command) {
		case "setup": {
			const { setup } = await import("./commands/setup.js");
			return setup();
		}
		case "create": {
			const { create } = await import("./commands/create.js");
			return create(requireName(), getPort());
		}
		case "delete": {
			const dnsOnly = hasFlag("dns-only");
			const tunnelOnly = hasFlag("tunnel-only");
			if (dnsOnly && tunnelOnly) {
				console.error(
					"Cannot use --dns-only and --tunnel-only together. Use neither for full delete.",
				);
				process.exit(1);
			}
			const { del } = await import("./commands/delete.js");
			return del(requireName(), { dnsOnly, tunnelOnly });
		}
		case "list": {
			const { list } = await import("./commands/list.js");
			return list();
		}
		case "token": {
			const { token } = await import("./commands/token.js");
			return token(requireName());
		}
		case "start": {
			const { start } = await import("./commands/start.js");
			const tokenFlag = flags.token;
			return start(typeof tokenFlag === "string" ? tokenFlag : undefined, hasFlag("background"));
		}
		case "stop": {
			const { stop } = await import("./commands/stop.js");
			return stop();
		}
		default:
			console.error(`Unknown command: "${rawCommand}"\n`);
			console.log(HELP);
			process.exit(1);
	}
}

run().catch((err: unknown) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
