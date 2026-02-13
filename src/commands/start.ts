import { spawn } from "node:child_process";
import { openSync, writeSync } from "node:fs";
import * as p from "@clack/prompts";
import color from "picocolors";
import { createApiClient } from "../lib/api.js";
import {
	clearPid,
	hasDomain,
	isProcessRunning,
	loadPid,
	loadToken,
	logPath,
	requireConfig,
	savePid,
} from "../lib/config.js";
import { ensureCloudflared } from "../utils/cloudflared.js";
import { showTunnels } from "../utils/tunnels.js";

function resolveToken(tokenFlag: string | undefined): string {
	const token = tokenFlag ?? loadToken();
	if (token) return token;

	p.log.error(
		[
			"No tunnel token found.",
			"",
			"Get a token from your admin, then run:",
			`  ${color.bold("cftunnel start --token <TOKEN>")}`,
			"",
			"Or for a quick public URL without setup:",
			`  ${color.bold("cftunnel start --quick")}`,
		].join("\n"),
	);
	process.exit(1);
}

function checkAlreadyRunning(): void {
	const pid = loadPid();
	if (!pid) return;

	if (isProcessRunning(pid)) {
		p.log.warn(`cloudflared is already running (PID ${color.bold(String(pid))}).`);
		p.log.info(`Run ${color.bold("cftunnel stop")} first, or check logs: ${color.dim(logPath())}`);
		process.exit(1);
	}

	clearPid();
}

function startForeground(binary: string, args: string[]): Promise<never> {
	const child = spawn(binary, args, { stdio: "inherit" });

	return new Promise((_resolve, reject) => {
		child.on("error", (err) => {
			reject(err);
		});

		child.on("exit", (code) => {
			process.exit(code ?? 0);
		});
	});
}

function startBackground(binary: string, args: string[], tunnelUrl?: string): void {
	const log = logPath();
	const fd = openSync(log, "a", 0o600);

	const timestamp = new Date().toISOString();
	writeSync(fd, `\n--- cftunnel start -d at ${timestamp} ---\n`);

	const child = spawn(binary, args, {
		stdio: ["ignore", fd, fd],
		detached: true,
	});

	child.unref();

	const pid = child.pid;
	if (!pid) {
		p.log.error("Failed to start cloudflared in background.");
		process.exit(1);
	}

	savePid(pid);

	const lines = ["cloudflared running in background.", ""];
	if (tunnelUrl) {
		lines.push(`  ${color.bold("URL")}   ${color.cyan(tunnelUrl)}`);
	}
	lines.push(
		`  ${color.bold("PID")}   ${pid}`,
		`  ${color.bold("Logs")}  ${color.dim(log)}`,
		"",
		`  Stop: ${color.bold("cftunnel stop")}`,
		`  Tail: ${color.bold(`tail -f ${log}`)}`,
	);

	p.log.success(lines.join("\n"));
}

async function askMode(): Promise<boolean> {
	const mode = await p.select({
		message: "Run mode",
		options: [
			{ value: "foreground", label: "Foreground", hint: "logs here, Ctrl+C to stop" },
			{ value: "background", label: "Background", hint: "detached, logs to file" },
		],
	});

	if (p.isCancel(mode)) {
		p.cancel("Cancelled.");
		process.exit(0);
	}

	return mode === "background";
}

async function startQuick(background: boolean, port: number): Promise<void> {
	p.log.info(
		[
			`Quick tunnel mode — random ${color.bold("trycloudflare.com")} URL`,
			color.dim("No setup or domain required. URL changes each run."),
		].join("\n"),
	);

	const binary = await ensureCloudflared();
	const args = ["tunnel", "--url", `http://localhost:${port}`];

	p.log.step(`Forwarding: ${color.bold(`localhost:${port}`)} → random public URL`);

	const bg = background || (await askMode());

	if (bg) {
		startBackground(binary, args);
	} else {
		p.log.info(
			`Running ${color.bold("cloudflared")} in foreground. Press Ctrl+C to stop.\nWatch for the public URL in the output below.`,
		);
		await startForeground(binary, args);
	}
}

export async function start(
	tokenFlag: string | undefined,
	background: boolean,
	quick: boolean,
	port: number,
): Promise<void> {
	checkAlreadyRunning();

	if (quick) return startQuick(background, port);

	const token = resolveToken(tokenFlag);
	const config = requireConfig();
	const api = createApiClient(config.apiToken);
	await showTunnels(api, config.accountId);

	const tunnelUrl = hasDomain(config) ? `https://${config.prefix}-*.${config.domain}` : undefined;

	if (tunnelUrl) {
		p.log.step(`Tunnel URL: ${color.bold(tunnelUrl)} → localhost`);
	}

	const binary = await ensureCloudflared();
	const args = ["tunnel", "run", "--token", token];

	const bg = background || (await askMode());

	p.log.info(
		`Running ${color.bold("cloudflared")} in ${bg ? "background" : "foreground"}.${bg ? "" : " Press Ctrl+C to stop."}`,
	);

	if (bg) {
		startBackground(binary, args, tunnelUrl);
	} else {
		await startForeground(binary, args);
	}
}
