import * as p from "@clack/prompts";
import color from "picocolors";
import { createApiClient } from "../lib/api.js";
import { requireConfig, saveToken } from "../lib/config.js";

export async function create(name: string, port: number): Promise<void> {
	p.intro(color.bgCyan(color.black(" cftunnel create ")));

	const config = requireConfig();
	const api = createApiClient(config.apiToken);
	const hostname = `${config.prefix}-${name}.${config.domain}`;

	p.log.info(color.dim("Cloudflare Tunnels are free — no usage charges for tunnels or DNS."));

	const existingResult = await api.getTunnelByName(config.accountId, `${config.prefix}-${name}`);
	if (existingResult.isOk() && existingResult.value) {
		p.log.error(`Tunnel "${config.prefix}-${name}" already exists.`);
		process.exit(1);
	}

	const s = p.spinner();

	s.start("Creating tunnel...");
	const tunnelResult = await api.createTunnel(config.accountId, `${config.prefix}-${name}`);
	if (tunnelResult.isErr()) {
		s.stop("Failed");
		p.log.error(tunnelResult.error.message);
		process.exit(1);
	}
	const tunnel = tunnelResult.value;
	s.stop(`Tunnel created: ${color.bold(tunnel.id)}`);

	s.start("Configuring ingress...");
	const ingressResult = await api.setTunnelIngress(config.accountId, tunnel.id, hostname, port);
	if (ingressResult.isErr()) {
		s.stop("Failed");
		p.log.error(ingressResult.error.message);
		process.exit(1);
	}
	s.stop("Ingress configured");

	s.start("Creating DNS record...");
	const dnsResult = await api.createDnsRecord(config.zoneId, hostname, tunnel.id);
	if (dnsResult.isErr()) {
		s.stop("Failed");
		p.log.error(dnsResult.error.message);
		process.exit(1);
	}
	s.stop("DNS record created");

	s.start("Fetching tunnel token...");
	const tokenResult = await api.getTunnelToken(config.accountId, tunnel.id);
	if (tokenResult.isErr()) {
		s.stop("Failed");
		p.log.error(tokenResult.error.message);
		process.exit(1);
	}
	const token = tokenResult.value;
	s.stop("Token retrieved");

	const saveResult = saveToken(token);
	if (saveResult.isErr()) {
		p.log.warn(`Could not save token locally: ${saveResult.error.message}`);
	}

	p.log.success(
		[
			"",
			`  ${color.bold("Name")}     ${tunnel.name}`,
			`  ${color.bold("URL")}      https://${hostname}`,
			`  ${color.bold("Target")}   localhost:${port}`,
			"",
			`  ${color.bold("Dev command:")}`,
			`  cloudflared tunnel run --token ${token}`,
			"",
			`  Or: ${color.bold("cftunnel start")} (token saved locally)`,
		].join("\n"),
	);

	p.outro(
		`Tunnel ready! Run ${color.bold("cftunnel run")} or ${color.bold("cftunnel run -d")} for background mode.`,
	);
}
