import { spawn } from "node:child_process";
import { platform } from "node:os";

export function openBrowser(url: string): void {
	const os = platform();
	const cmd = os === "darwin" ? "open" : os === "win32" ? "start" : "xdg-open";
	spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
}
