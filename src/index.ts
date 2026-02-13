#!/usr/bin/env bun

import { VERSION } from "./lib/constants.js";
import { parse } from "./utils/cli.js";

const B = "\x1b[1m"; // bold
const D = "\x1b[2m"; // dim
const R = "\x1b[0m"; // reset

const HELP = `
${B}cftunnel${R} v${VERSION} — Cloudflare Tunnel CLI

${B}COMMANDS${R}
  ${B}Command${R}              ${B}Usage${R}                              ${B}Description${R}
  ${"─".repeat(90)}
  setup                [flags]                            Set up API credentials
  status                                                  Show config, process, and tunnels
  domain               [flags]                            Add, change, or remove domain
  create ${D}|${R} new         <name> [-p PORT]                    Create a tunnel for a dev
  delete ${D}|${R} rm          <name> [flags]                      Delete tunnel and/or DNS
  list   ${D}|${R} ls                                              List all tunnels
  token                <name>                              Print tunnel token for a dev
  start  ${D}|${R} run         [flags]                             Run the tunnel
  stop                                                    Stop a background tunnel
  help   ${D}|${R} -h                                              Show this help

${B}FLAGS${R}
  ${B}Command${R}    ${B}Flag${R}                  ${B}Description${R}
  ${"─".repeat(70)}
  setup      --token TOKEN         API token ${D}(skip prompt)${R}
  setup      --account-id ID       Account ID ${D}(skip selection)${R}
  setup      --zone-id ID          Zone ID ${D}(skip selection)${R}
  setup      --prefix PREFIX       Subdomain prefix ${D}(skip prompt)${R}
  ${"─".repeat(70)}
  domain     --zone-id ID          Zone ID to set
  domain     --prefix PREFIX       Subdomain prefix
  domain     --clear               Remove domain ${D}(domain-less mode)${R}
  ${"─".repeat(70)}
  create     -p, --port PORT       Target port ${D}(default: 3000)${R}
  ${"─".repeat(70)}
  delete     --dns-only            Only remove DNS ${D}(keep tunnel)${R}
  delete     --tunnel-only         Only remove tunnel ${D}(keep DNS)${R}
  delete     -f, --force           Skip confirmation
  ${"─".repeat(70)}
  start      -d, --background      Run in background
  start      -q, --quick           Quick tunnel ${D}(random trycloudflare.com URL)${R}
  start      -p, --port PORT       Port for quick tunnel ${D}(default: 3000)${R}
  start      --token TOKEN         Use a specific token

${B}EXAMPLES${R}
  ${D}# Setup & config${R}
  cftunnel setup                          Interactive setup wizard
  cftunnel setup --token abc123           Non-interactive with token
  cftunnel domain                         Add or change domain
  cftunnel domain --clear                 Remove domain

  ${D}# Create & manage tunnels${R}
  cftunnel new stark                      Create → local-dev-stark.example.dev
  cftunnel new wolverine -p 8080          Custom port
  cftunnel token thor                     Print token for thor
  cftunnel rm rogue                       Delete tunnel + DNS
  cftunnel rm rogue -f                    Delete without confirmation
  cftunnel ls                             List all tunnels

  ${D}# Run tunnels${R}
  cftunnel start                          Run tunnel ${D}(prompts for mode)${R}
  cftunnel start -d                       Run in background
  cftunnel start --quick                  Quick public URL, no domain needed
  cftunnel start --quick -p 8080          Quick tunnel on port 8080
  cftunnel stop                           Stop background tunnel
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
			return setup({
				token: args.token,
				accountId: args.accountId,
				zoneId: args.zoneId,
				prefix: args.prefix,
			});
		}
		case "create": {
			const { create } = await import("./commands/create.js");
			return create(args.name, args.port);
		}
		case "delete": {
			const { del } = await import("./commands/delete.js");
			return del(args.name, {
				dnsOnly: args.dnsOnly,
				tunnelOnly: args.tunnelOnly,
				force: args.force,
			});
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
			return start(args.token, args.background, args.quick, args.port);
		}
		case "stop": {
			const { stop } = await import("./commands/stop.js");
			return stop();
		}
		case "status": {
			const { status } = await import("./commands/status.js");
			return status();
		}
		case "domain": {
			const { domain } = await import("./commands/domain.js");
			return domain({ zoneId: args.zoneId, prefix: args.prefix, clear: args.clear });
		}
		case "unknown":
			console.error(`Unknown command: "${args.raw}"\n`);
			console.log(HELP);
			process.exit(1);
	}
}

run()
	.then(() => process.exit(0))
	.catch((err: unknown) => {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	});
