import * as p from "@clack/prompts";
import color from "picocolors";
import { createApiClient } from "../lib/api.js";
import { hasDomain, requireConfig } from "../lib/config.js";
import { showTunnels } from "../utils/tunnels.js";

export async function token(name: string): Promise<void> {
	const config = requireConfig();
	if (!hasDomain(config)) {
		p.log.error("No domain configured. Token command requires a named tunnel with a domain.");
		process.exit(1);
	}

	const api = createApiClient(config.apiToken);
	const tunnelName = `${config.prefix}-${name}`;

	await showTunnels(api, config.accountId);

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
		p.log.error(`Tunnel "${tunnelName}" not found. Check the name above and try again.`);
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

	p.log.warn(color.dim("Token is sensitive — treat it like a password. Do not commit to git."));

	console.log();
	console.log(`  ${color.bold("Dev command:")}`);
	console.log(`  cloudflared tunnel run --token ${tokenResult.value}`);
	console.log();
}
