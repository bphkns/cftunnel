import * as p from "@clack/prompts";
import color from "picocolors";
import { createApiClient } from "../lib/api.js";
import { hasDomain, requireConfig, saveToken } from "../lib/config.js";
import { showTunnels } from "../utils/tunnels.js";

async function askPort(portFlag: number | undefined): Promise<number> {
	if (portFlag) return portFlag;

	const value = await p.text({
		message: "Local port to forward to",
		placeholder: "3000",
		defaultValue: "3000",
		validate: (v) => {
			const n = Number(v);
			if (!Number.isInteger(n) || n < 1 || n > 65535) return "Enter a valid port (1-65535)";
			return undefined;
		},
	});

	if (p.isCancel(value)) {
		p.cancel("Cancelled.");
		process.exit(0);
	}

	return Number(value);
}

export async function create(name: string, portFlag: number | undefined): Promise<void> {
	p.intro(color.bgCyan(color.black(" cftunnel create ")));

	const config = requireConfig();
	if (!hasDomain(config)) {
		p.log.error(
			[
				"No domain configured. Cannot create a named tunnel without a domain.",
				"",
				`  To add a domain: ${color.bold("cftunnel setup")}`,
				`  For a quick public URL: ${color.bold("cftunnel start --quick")}`,
			].join("\n"),
		);
		process.exit(1);
	}

	const api = createApiClient(config.apiToken);

	p.log.info(color.dim("Cloudflare Tunnels are free — no usage charges for tunnels or DNS."));

	await showTunnels(api, config.accountId);

	const port = await askPort(portFlag);
	const tunnelName = `${config.prefix}-${name}`;
	const hostname = `${tunnelName}.${config.domain}`;

	// Preview
	p.log.step(
		[
			"Will create:",
			`  ${color.bold("Tunnel")}  ${tunnelName}`,
			`  ${color.bold("URL")}     https://${hostname}`,
			`  ${color.bold("Target")}  localhost:${port}`,
		].join("\n"),
	);

	const confirmed = await p.confirm({ message: "Proceed?" });
	if (p.isCancel(confirmed) || !confirmed) {
		p.cancel("Cancelled.");
		process.exit(0);
	}

	const existingResult = await api.getTunnelByName(config.accountId, tunnelName);
	if (existingResult.isOk() && existingResult.value) {
		p.log.error(`Tunnel "${tunnelName}" already exists.`);
		process.exit(1);
	}

	const s = p.spinner();

	s.start("Creating tunnel...");
	const tunnelResult = await api.createTunnel(config.accountId, tunnelName);
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

	const masked = `${token.slice(0, 8)}...${token.slice(-4)}`;

	p.log.success(
		[
			"",
			`  ${color.bold("Name")}     ${tunnel.name}`,
			`  ${color.bold("URL")}      https://${hostname}`,
			`  ${color.bold("Target")}   localhost:${port}`,
			`  ${color.bold("Token")}    ${color.dim(masked)} (saved locally)`,
			"",
			`  Run: ${color.bold("cftunnel start")}`,
			`  Or give the dev: ${color.bold(`cftunnel token ${name}`)}`,
		].join("\n"),
	);

	p.outro(`Tunnel ready! Run ${color.bold("cftunnel start")} to connect.`);
}
