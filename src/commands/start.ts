import { spawn } from "node:child_process";
import { openSync, writeSync } from "node:fs";
import * as p from "@clack/prompts";
import color from "picocolors";
import { clearPid, isProcessRunning, loadPid, loadToken, logPath, savePid } from "../lib/config.js";
import { ensureCloudflared } from "../utils/cloudflared.js";

function resolveToken(tokenFlag: string | undefined): string {
	const token = tokenFlag ?? loadToken();
	if (token) return token;

	p.log.error(
		[
			"No tunnel token found.",
			"",
			"Get a token from your admin, then run:",
			`  ${color.bold("cftunnel run --token <TOKEN>")}`,
			"",
			"Or ask them to run: cftunnel token <your-name>",
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

function startForeground(binary: string, token: string): Promise<never> {
	p.log.info(`Running ${color.bold("cloudflared")} in foreground. Press Ctrl+C to stop.`);

	const child = spawn(binary, ["tunnel", "run", "--token", token], {
		stdio: "inherit",
	});

	return new Promise((_resolve, reject) => {
		child.on("error", (err) => {
			reject(err);
		});

		child.on("exit", (code) => {
			process.exit(code ?? 0);
		});
	});
}

function startBackground(binary: string, token: string): void {
	const log = logPath();
	const fd = openSync(log, "a");

	const timestamp = new Date().toISOString();
	writeSync(fd, `\n--- cftunnel start -d at ${timestamp} ---\n`);

	const child = spawn(binary, ["tunnel", "run", "--token", token], {
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

	p.log.success(
		[
			"cloudflared running in background.",
			"",
			`  ${color.bold("PID")}   ${pid}`,
			`  ${color.bold("Logs")}  ${color.dim(log)}`,
			"",
			`  Stop: ${color.bold("cftunnel stop")}`,
			`  Tail: ${color.bold(`tail -f ${log}`)}`,
		].join("\n"),
	);
}

export async function start(tokenFlag: string | undefined, background: boolean): Promise<void> {
	const token = resolveToken(tokenFlag);

	checkAlreadyRunning();

	const binary = await ensureCloudflared();

	if (background) {
		startBackground(binary, token);
	} else {
		await startForeground(binary, token);
	}
}
