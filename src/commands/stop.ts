import * as p from "@clack/prompts";
import color from "picocolors";
import { clearPid, isProcessRunning, loadPid, logPath } from "../lib/config.js";

export async function stop(): Promise<void> {
	const pid = loadPid();

	if (!pid) {
		p.log.warn("No running tunnel found (no PID file).");
		p.log.info(
			`If cloudflared is running manually, kill it with: ${color.bold("pkill cloudflared")}`,
		);
		return;
	}

	if (!isProcessRunning(pid)) {
		p.log.info(`Process ${pid} is not running (stale PID file). Cleaning up.`);
		clearPid();
		return;
	}

	p.log.step(`Stopping cloudflared (PID ${color.bold(String(pid))})...`);

	try {
		process.kill(pid, "SIGTERM");
	} catch {
		p.log.error(`Failed to send SIGTERM to PID ${pid}.`);
		process.exit(1);
	}

	const deadline = Date.now() + 5000;
	while (Date.now() < deadline) {
		if (!isProcessRunning(pid)) break;
		await new Promise((r) => setTimeout(r, 200));
	}

	if (isProcessRunning(pid)) {
		p.log.warn(`Process ${pid} didn't stop gracefully. Sending SIGKILL...`);
		try {
			process.kill(pid, "SIGKILL");
		} catch {}
	}

	clearPid();
	p.log.success("cloudflared stopped.");
	p.log.info(`Logs: ${color.dim(logPath())}`);
}
