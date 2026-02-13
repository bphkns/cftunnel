import * as p from "@clack/prompts";
import color from "picocolors";
import type { ApiClient } from "../lib/api.js";
import type { CfTunnel } from "../lib/types.js";

const STATUS_COLORS: Record<string, (s: string) => string> = {
	healthy: color.green,
	inactive: color.dim,
	down: color.red,
	degraded: color.yellow,
};

function formatIngress(hostname: string | undefined, service: string): string {
	if (!hostname) return "";
	const url = `https://${hostname}`;
	return `${color.cyan(url)} → ${color.bold(service)}`;
}

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

	const configs = await fetchTunnelConfigs(api, accountId, tunnels);

	for (const t of tunnels) {
		const colorFn = STATUS_COLORS[t.status] ?? color.dim;
		const conns = t.connections.length;
		const line = `  ${color.bold(t.name)} ${colorFn(t.status)} ${color.dim(`(${conns} conn${conns === 1 ? "" : "s"})`)}`;
		console.log(line);

		const ingress = configs.get(t.id);
		if (!ingress) continue;
		console.log(`    ${ingress}`);
	}
}

async function fetchTunnelConfigs(
	api: ApiClient,
	accountId: string,
	tunnels: ReadonlyArray<CfTunnel>,
): Promise<Map<string, string>> {
	const active = tunnels.filter((t) => t.status === "healthy" || t.status === "degraded");
	if (!active.length) return new Map();

	const entries = await Promise.all(
		active.map(async (t) => {
			const configResult = await api.getTunnelConfig(accountId, t.id);
			if (configResult.isErr()) return undefined;
			const rules = configResult.value.config.ingress;
			const primary = rules.find((r) => r.hostname);
			if (!primary) return undefined;
			return [t.id, formatIngress(primary.hostname, primary.service)] as const;
		}),
	);

	const map = new Map<string, string>();
	for (const entry of entries) {
		if (entry) map.set(entry[0], entry[1]);
	}
	return map;
}
