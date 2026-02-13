import * as p from "@clack/prompts";
import color from "picocolors";
import { createApiClient } from "../lib/api.js";
import {
	configExists,
	hasDomain,
	isProcessRunning,
	loadConfig,
	loadPid,
	logPath,
} from "../lib/config.js";
import { showTunnels } from "../utils/tunnels.js";

export async function status(): Promise<void> {
	p.intro(color.bgCyan(color.black(" cftunnel status ")));

	// --- Config ---
	if (!configExists()) {
		p.log.warn(`Not configured. Run ${color.bold("cftunnel setup")} first.`);
		p.outro("");
		return;
	}

	const configResult = loadConfig();
	if (configResult.isErr()) {
		p.log.error(configResult.error.message);
		process.exit(1);
	}

	const config = configResult.value;

	const configLines = [`  ${color.bold("Account")}  ${config.accountId}`];
	if (hasDomain(config)) {
		configLines.push(`  ${color.bold("Domain")}   ${config.domain}`);
		configLines.push(`  ${color.bold("Prefix")}   ${config.prefix}`);
		configLines.push(`  ${color.bold("Pattern")}  ${config.prefix}-<name>.${config.domain}`);
	} else {
		configLines.push(`  ${color.bold("Domain")}   ${color.dim("none (quick tunnel mode only)")}`);
	}
	p.log.info(["Config:", ...configLines].join("\n"));

	// --- Process ---
	const pid = loadPid();
	if (pid && isProcessRunning(pid)) {
		p.log.success(
			[
				`cloudflared running (PID ${color.bold(String(pid))})`,
				`  Logs: ${color.dim(logPath())}`,
				`  Stop: ${color.bold("cftunnel stop")}`,
			].join("\n"),
		);
	} else if (pid) {
		p.log.warn(`Stale PID file (${pid}) — process not running.`);
	} else {
		p.log.info(color.dim("No tunnel process running locally."));
	}

	// --- Remote tunnels ---
	const api = createApiClient(config.apiToken);
	await showTunnels(api, config.accountId);

	p.outro("");
}
