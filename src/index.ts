#!/usr/bin/env bun

const VERSION = "0.1.0";

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

const [command] = process.argv.slice(2);

if (!command || command === "help" || command === "--help" || command === "-h") {
	console.log(HELP);
	process.exit(0);
}

if (command === "--version" || command === "-v") {
	console.log(VERSION);
	process.exit(0);
}

console.log(`Unknown command: ${command}`);
console.log(HELP);
process.exit(1);
