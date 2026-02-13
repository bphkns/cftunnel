import { spawn } from "node:child_process";
import { openSync, writeSync } from "node:fs";
import * as p from "@clack/prompts";
import color from "picocolors";
import { createApiClient } from "../lib/api.js";
import {
	clearPid,
	configExists,
	hasDomain,
	isProcessRunning,
	loadConfig,
	loadPid,
	loadToken,
	logPath,
	savePid,
	saveToken,
} from "../lib/config.js";
import { TUNNEL_TOKEN_ENV } from "../lib/constants.js";
import { ensureCloudflared } from "../utils/cloudflared.js";
import { showTunnels } from "../utils/tunnels.js";

async function resolveToken(tokenFlag: string | undefined): Promise<string> {
	// 1. Explicit flag (highest priority) — save for future use
	if (tokenFlag) {
		const result = saveToken(tokenFlag);
		if (result.isOk()) {
			p.log.info(color.dim("Token saved locally — next time just run: cftunnel start"));
		}
		return tokenFlag;
	}

	// 2. Environment variable
	const envToken = process.env[TUNNEL_TOKEN_ENV];
	if (envToken) return envToken;

	// 3. Saved token file
	const saved = loadToken();
	if (saved) return saved;

	// 4. No token — if admin, tell them to setup; if dev, prompt for token
	if (configExists()) {
		p.log.warn(
			[
				"No tunnel token found. Create a tunnel first:",
				`  ${color.bold("cftunnel create <name>")}`,
			].join("\n"),
		);
		process.exit(1);
	}

	// Dev without any config — prompt for token
	p.log.info(
		[
			"No setup found — running as a dev.",
			color.dim("Ask your admin for a tunnel token, or use --quick for a public URL."),
		].join("\n"),
	);

	const input = await p.text({
		message: "Paste your tunnel token",
		placeholder: "eyJhIjoiYjAx...",
		validate: (v) => {
			if (!v || !v.trim()) return "Token is required";
			return undefined;
		},
	});

	if (p.isCancel(input)) {
		p.cancel("Cancelled.");
		process.exit(0);
	}

	const token = input.trim();
	const result = saveToken(token);
	if (result.isOk()) {
		p.log.info(color.dim("Token saved — next time just run: cftunnel start"));
	}
	return token;
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

	const token = await resolveToken(tokenFlag);

	// Show tunnel info if admin config is available (optional for devs)
	let tunnelUrl: string | undefined;
	const configResult = loadConfig();
	if (configResult.isOk()) {
		const config = configResult.value;
		const api = createApiClient(config.apiToken);
		await showTunnels(api, config.accountId);
		tunnelUrl = hasDomain(config) ? `https://${config.prefix}-*.${config.domain}` : undefined;
	}

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
