import * as p from "@clack/prompts";
import color from "picocolors";
import { createApiClient } from "../lib/api.js";
import { requireConfig } from "../lib/config.js";

export async function del(name: string): Promise<void> {
	p.intro(color.bgRed(color.white(" cftunnel delete ")));

	const config = requireConfig();
	const api = createApiClient(config.apiToken);
	const tunnelName = `${config.prefix}-${name}`;
	const hostname = `${tunnelName}.${config.domain}`;

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
	s.stop(`Found tunnel: ${color.bold(tunnel.name)} (${tunnel.id})`);

	const confirmed = await p.confirm({
		message: `Delete tunnel "${tunnelName}" and DNS for ${hostname}?`,
	});
	if (p.isCancel(confirmed) || !confirmed) {
		p.cancel("Cancelled.");
		process.exit(0);
	}

	s.start("Cleaning up connections...");
	const cleanupResult = await api.cleanupConnections(config.accountId, tunnel.id);
	if (cleanupResult.isErr()) {
		s.stop("Warning: could not clean connections");
		p.log.warn(cleanupResult.error.message);
	} else {
		s.stop("Connections cleaned up");
	}

	s.start("Removing DNS record...");
	const dnsResult = await api.findDnsRecord(config.zoneId, hostname);
	if (dnsResult.isOk() && dnsResult.value) {
		const deleteResult = await api.deleteDnsRecord(config.zoneId, dnsResult.value.id);
		if (deleteResult.isErr()) {
			s.stop("Warning: could not remove DNS");
			p.log.warn(deleteResult.error.message);
		} else {
			s.stop("DNS record removed");
		}
	} else {
		s.stop("No DNS record found (skipped)");
	}

	s.start("Deleting tunnel...");
	const deleteResult = await api.deleteTunnel(config.accountId, tunnel.id);
	if (deleteResult.isErr()) {
		s.stop("Failed");
		p.log.error(deleteResult.error.message);
		process.exit(1);
	}
	s.stop("Tunnel deleted");

	p.outro(`Removed ${color.bold(tunnelName)} and ${color.bold(hostname)}`);
}
