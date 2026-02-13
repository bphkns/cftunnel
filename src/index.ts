#!/usr/bin/env bun

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
`;

const { command } = parseArgs(process.argv);

if (!command || command === "help" || command === "--help" || command === "-h") {
	console.log(HELP);
	process.exit(0);
}

if (command === "--version" || command === "-v") {
	console.log(VERSION);
	process.exit(0);
}

const commands: Record<string, () => Promise<{ [k: string]: () => Promise<void> }>> = {
	setup: () => import("./commands/setup.js"),
};

const loader = commands[command];
if (!loader) {
	console.error(`Unknown command: ${command}\n`);
	console.log(HELP);
	process.exit(1);
}

loader()
	.then((mod) => {
		const fn = mod[command];
		if (!fn) throw new Error(`Command "${command}" not exported`);
		return fn();
	})
	.catch((err: unknown) => {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	});
