#!/usr/bin/env bun

import { DEFAULT_PORT } from "./lib/constants.js";
import { VERSION } from "./lib/constants.js";
import { parseArgs } from "./utils/cli.js";

const HELP = `
cftunnel v${VERSION} — Cloudflare Tunnel CLI

Usage:
  cftunnel setup                        Set up Cloudflare API credentials
  cftunnel create <name> [--port 3000]  Create a tunnel for a dev
  cftunnel delete <name>                Delete a tunnel and its DNS record
  cftunnel list                         List all tunnels
  cftunnel token <name>                 Print the tunnel token for a dev
  cftunnel start [--token TOKEN]        Run the tunnel (dev command)
  cftunnel help                         Show this help message

Examples:
  cftunnel create stark                 Create tunnel for stark → local-dev-stark.tl.new
  cftunnel create wolverine --port 8080 Create tunnel on custom port
  cftunnel token thor                   Print token for thor to run locally
`;

const { command, positional, flags } = parseArgs(process.argv);

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
		console.error(`Usage: cftunnel ${command} <name>`);
		process.exit(1);
	}
	return name;
}

function getPort(): number {
	const raw = flags.port;
	if (raw === true || raw === undefined) return DEFAULT_PORT;
	const num = Number(raw);
	if (Number.isNaN(num) || num < 1 || num > 65535) {
		console.error("Port must be a number between 1 and 65535");
		process.exit(1);
	}
	return num;
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
			const { del } = await import("./commands/delete.js");
			return del(requireName());
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
			return start(typeof tokenFlag === "string" ? tokenFlag : undefined);
		}
		default:
			console.error(`Unknown command: ${command}\n`);
			console.log(HELP);
			process.exit(1);
	}
}

run().catch((err: unknown) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
