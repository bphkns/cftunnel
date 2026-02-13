import * as p from "@clack/prompts";
import color from "picocolors";
import type { ApiClient } from "../lib/api.js";
import { createApiClient } from "../lib/api.js";
import { requireConfig } from "../lib/config.js";

export interface DeleteFlags {
	dnsOnly: boolean;
	tunnelOnly: boolean;
}

function scopeLabel(flags: DeleteFlags): string {
	if (flags.dnsOnly) return "DNS record only";
	if (flags.tunnelOnly) return "tunnel only (keeping DNS)";
	return "tunnel + DNS record";
}

async function findTunnel(api: ApiClient, accountId: string, tunnelName: string) {
	const s = p.spinner();
	s.start(`Looking up tunnel "${tunnelName}"...`);

	const result = await api.getTunnelByName(accountId, tunnelName);
	if (result.isErr()) {
		s.stop("Lookup failed");
		p.log.error(`Could not search tunnels: ${result.error.message}`);
		return undefined;
	}

	const tunnel = result.value;
	if (!tunnel) {
		s.stop("Not found");
		p.log.error(`No tunnel named "${tunnelName}" exists.`);
		p.log.info(`Run ${color.bold("cftunnel ls")} to see available tunnels.`);
		return undefined;
	}

	s.stop(
		[
			"Found tunnel:",
			`  ${color.bold("Name")}    ${tunnel.name}`,
			`  ${color.bold("ID")}      ${color.dim(tunnel.id)}`,
			`  ${color.bold("Status")}  ${tunnel.status}`,
			`  ${color.bold("Conns")}   ${tunnel.connections.length}`,
		].join("\n"),
	);
	return tunnel;
}

async function findDns(api: ApiClient, zoneId: string, hostname: string) {
	const s = p.spinner();
	s.start(`Looking up DNS record for ${hostname}...`);

	const result = await api.findDnsRecord(zoneId, hostname);
	if (result.isErr()) {
		s.stop("DNS lookup failed");
		p.log.warn(`Could not search DNS: ${result.error.message}`);
		return undefined;
	}

	const record = result.value;
	if (!record) {
		s.stop(`No DNS record found for ${hostname}`);
		return undefined;
	}

	s.stop(
		[
			"Found DNS record:",
			`  ${color.bold("Name")}     ${record.name}`,
			`  ${color.bold("Target")}   ${color.dim(record.content)}`,
			`  ${color.bold("ID")}       ${color.dim(record.id)}`,
		].join("\n"),
	);
	return record;
}

async function removeDns(api: ApiClient, zoneId: string, recordId: string, hostname: string) {
	const s = p.spinner();
	s.start(`Deleting DNS record ${hostname}...`);

	const result = await api.deleteDnsRecord(zoneId, recordId);
	if (result.isErr()) {
		s.stop("Failed to delete DNS record");
		p.log.error(result.error.message);
		return false;
	}

	s.stop(`DNS record deleted: ${color.bold(hostname)}`);
	return true;
}

async function removeTunnel(
	api: ApiClient,
	accountId: string,
	tunnelId: string,
	tunnelName: string,
) {
	const s = p.spinner();

	s.start("Cleaning up active connections...");
	const cleanupResult = await api.cleanupConnections(accountId, tunnelId);
	if (cleanupResult.isErr()) {
		s.stop("Warning: could not clean connections");
		p.log.warn(`Non-critical: ${cleanupResult.error.message}`);
	} else {
		s.stop("Connections cleaned up");
	}

	s.start(`Deleting tunnel ${tunnelName}...`);
	const deleteResult = await api.deleteTunnel(accountId, tunnelId);
	if (deleteResult.isErr()) {
		s.stop("Failed to delete tunnel");
		p.log.error(deleteResult.error.message);
		return false;
	}

	s.stop(`Tunnel deleted: ${color.bold(tunnelName)}`);
	return true;
}

export async function del(name: string, flags: DeleteFlags): Promise<void> {
	p.intro(color.bgRed(color.white(" cftunnel delete ")));

	const config = requireConfig();
	const api = createApiClient(config.apiToken);
	const tunnelName = `${config.prefix}-${name}`;
	const hostname = `${tunnelName}.${config.domain}`;

	p.log.step(`Target: ${color.bold(hostname)}`);
	p.log.step(`Scope:  ${color.bold(scopeLabel(flags))}`);

	// --- DNS-only mode ---
	if (flags.dnsOnly) {
		const record = await findDns(api, config.zoneId, hostname);
		if (!record) {
			p.outro(color.yellow("Nothing to delete."));
			process.exit(1);
		}

		const confirmed = await p.confirm({
			message: `Delete DNS record ${color.bold(hostname)}?`,
		});
		if (p.isCancel(confirmed) || !confirmed) {
			p.cancel("Cancelled.");
			process.exit(0);
		}

		const ok = await removeDns(api, config.zoneId, record.id, hostname);
		p.outro(ok ? "Done. DNS record removed." : color.red("Failed to remove DNS record."));
		if (!ok) process.exit(1);
		return;
	}

	// --- Tunnel-only mode ---
	if (flags.tunnelOnly) {
		const tunnel = await findTunnel(api, config.accountId, tunnelName);
		if (!tunnel) {
			p.outro(color.yellow("Nothing to delete."));
			process.exit(1);
		}

		const confirmed = await p.confirm({
			message: `Delete tunnel ${color.bold(tunnelName)}? DNS record will be kept.`,
		});
		if (p.isCancel(confirmed) || !confirmed) {
			p.cancel("Cancelled.");
			process.exit(0);
		}

		const ok = await removeTunnel(api, config.accountId, tunnel.id, tunnelName);
		p.outro(ok ? "Done. Tunnel removed." : color.red("Failed to remove tunnel."));
		if (!ok) process.exit(1);
		return;
	}

	// --- Full delete: tunnel + DNS ---
	const tunnel = await findTunnel(api, config.accountId, tunnelName);
	const record = await findDns(api, config.zoneId, hostname);

	if (!tunnel && !record) {
		p.log.warn("No tunnel or DNS record found for this name.");
		p.log.info(`Run ${color.bold("cftunnel ls")} to see available tunnels.`);
		p.outro(color.yellow("Nothing to delete."));
		process.exit(1);
	}

	const parts = [tunnel && `tunnel "${tunnelName}"`, record && `DNS "${hostname}"`].filter(Boolean);
	const confirmed = await p.confirm({
		message: `Delete ${parts.join(" and ")}?`,
	});
	if (p.isCancel(confirmed) || !confirmed) {
		p.cancel("Cancelled.");
		process.exit(0);
	}

	const results: string[] = [];

	if (tunnel) {
		const ok = await removeTunnel(api, config.accountId, tunnel.id, tunnelName);
		results.push(ok ? `tunnel ${color.green("deleted")}` : `tunnel ${color.red("FAILED")}`);
	}

	if (record) {
		const ok = await removeDns(api, config.zoneId, record.id, hostname);
		results.push(ok ? `DNS ${color.green("deleted")}` : `DNS ${color.red("FAILED")}`);
	}

	p.outro(`Results: ${results.join(", ")}`);
}
