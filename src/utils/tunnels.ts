import * as p from "@clack/prompts";
import color from "picocolors";
import type { ApiClient } from "../lib/api.js";

const STATUS_COLORS: Record<string, (s: string) => string> = {
	healthy: color.green,
	inactive: color.dim,
	down: color.red,
	degraded: color.yellow,
};

export async function showTunnels(api: ApiClient, accountId: string): Promise<void> {
	const s = p.spinner();
	s.start("Fetching tunnels...");

	const result = await api.listTunnels(accountId);
	if (result.isErr()) {
		s.stop("Could not fetch tunnels");
		return;
	}

	const tunnels = result.value;
	if (!tunnels.length) {
		s.stop("No existing tunnels");
		return;
	}

	s.stop(`${tunnels.length} existing tunnel${tunnels.length === 1 ? "" : "s"}`);
	for (const t of tunnels) {
		const colorFn = STATUS_COLORS[t.status] ?? color.dim;
		const conns = t.connections.length;
		console.log(
			`  ${color.bold(t.name)} ${colorFn(t.status)} ${color.dim(`(${conns} conn${conns === 1 ? "" : "s"})`)}`,
		);
	}
}
