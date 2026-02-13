import * as p from "@clack/prompts";
import color from "picocolors";
import { createApiClient } from "../lib/api.js";
import { requireConfig } from "../lib/config.js";

const STATUS_COLORS: Record<string, (s: string) => string> = {
	healthy: color.green,
	inactive: color.dim,
	down: color.red,
	degraded: color.yellow,
};

export async function list(): Promise<void> {
	const config = requireConfig();
	const api = createApiClient(config.apiToken);

	const s = p.spinner();
	s.start("Fetching tunnels...");

	const result = await api.listTunnels(config.accountId);
	if (result.isErr()) {
		s.stop("Failed");
		p.log.error(result.error.message);
		process.exit(1);
	}

	const tunnels = result.value;
	s.stop(`Found ${tunnels.length} tunnel${tunnels.length === 1 ? "" : "s"}`);

	if (!tunnels.length) {
		p.log.info("No tunnels found. Create one with: cftunnel create <name>");
		return;
	}

	for (const t of tunnels) {
		const colorFn = STATUS_COLORS[t.status] ?? color.dim;
		const conns = t.connections.length;
		console.log(
			`  ${color.bold(t.name)} ${colorFn(t.status)} ${color.dim(`(${conns} conn${conns === 1 ? "" : "s"})`)}`,
		);
	}
}
