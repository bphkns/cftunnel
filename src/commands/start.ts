import { spawn } from "node:child_process";
import * as p from "@clack/prompts";
import color from "picocolors";
import { loadToken } from "../lib/config.js";

export async function start(tokenFlag: string | undefined): Promise<void> {
	const token = tokenFlag ?? loadToken();

	if (!token) {
		p.log.error(
			[
				"No tunnel token found.",
				"",
				"Get a token from your admin, then run:",
				`  ${color.bold("cftunnel start --token <TOKEN>")}`,
				"",
				"Or ask them to run: cftunnel token <your-name>",
			].join("\n"),
		);
		process.exit(1);
	}

	p.log.info(`Starting tunnel with ${color.bold("cloudflared")}...`);

	const child = spawn("cloudflared", ["tunnel", "run", "--token", token], {
		stdio: "inherit",
	});

	child.on("error", (err) => {
		if ("code" in err && err.code === "ENOENT") {
			p.log.error(
				[
					`${color.bold("cloudflared")} not found.`,
					"Install it: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/",
				].join("\n"),
			);
			process.exit(1);
		}
		p.log.error(err.message);
		process.exit(1);
	});

	child.on("exit", (code) => {
		process.exit(code ?? 0);
	});
}
