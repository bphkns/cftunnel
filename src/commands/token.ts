import * as p from "@clack/prompts";
import color from "picocolors";
import { createApiClient } from "../lib/api.js";
import { requireConfig } from "../lib/config.js";

export async function token(name: string): Promise<void> {
	const config = requireConfig();
	const api = createApiClient(config.apiToken);
	const tunnelName = `${config.prefix}-${name}`;

	const s = p.spinner();
	s.start("Looking up tunnel...");

	const lookupResult = await api.getTunnelByName(config.accountId, tunnelName);
	if (lookupResult.isErr()) {
		s.stop("Failed");
		p.log.error(lookupResult.error.message);
		process.exit(1);
	}

	const tunnel = lookupResult.value;
	if (!tunnel) {
		s.stop("Not found");
		p.log.error(`Tunnel "${tunnelName}" not found.`);
		process.exit(1);
	}

	s.start("Fetching token...");
	const tokenResult = await api.getTunnelToken(config.accountId, tunnel.id);
	if (tokenResult.isErr()) {
		s.stop("Failed");
		p.log.error(tokenResult.error.message);
		process.exit(1);
	}

	s.stop("Token retrieved");

	console.log();
	console.log(`  ${color.bold("Dev command:")}`);
	console.log(`  cloudflared tunnel run --token ${tokenResult.value}`);
	console.log();
}
