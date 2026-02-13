import * as p from "@clack/prompts";
import color from "picocolors";
import { createApiClient } from "../lib/api.js";
import { hasDomain, loadConfig, requireConfig, saveConfig } from "../lib/config.js";
import { DEFAULT_PREFIX } from "../lib/constants.js";

export interface DomainFlags {
	zoneId: string | undefined;
	prefix: string | undefined;
	clear: boolean;
}

function bail<T>(value: T | symbol): T {
	if (p.isCancel(value)) {
		p.cancel("Cancelled.");
		process.exit(0);
	}
	return value;
}

export async function domain(flags: DomainFlags): Promise<void> {
	p.intro(color.bgCyan(color.black(" cftunnel domain ")));

	const config = requireConfig();

	// Show current state
	if (hasDomain(config)) {
		p.log.info(
			[
				"Current domain config:",
				`  ${color.bold("Domain")}   ${config.domain}`,
				`  ${color.bold("Prefix")}   ${config.prefix}`,
				`  ${color.bold("Pattern")}  ${config.prefix}-<name>.${config.domain}`,
			].join("\n"),
		);
	} else {
		p.log.info(color.dim("No domain configured."));
	}

	// --- Clear mode ---
	if (flags.clear) {
		if (!hasDomain(config)) {
			p.log.warn("No domain to clear.");
			process.exit(0);
		}

		const confirmed = bail(
			await p.confirm({ message: "Remove domain config? Existing tunnels won't be affected." }),
		);
		if (!confirmed) {
			p.cancel("Keeping current config.");
			process.exit(0);
		}

		const updated = { ...config, zoneId: undefined, domain: undefined, prefix: undefined };
		const result = saveConfig(updated);
		if (result.isErr()) {
			p.log.error(result.error.message);
			process.exit(1);
		}

		p.outro("Domain removed. Use cftunnel start --quick for public URLs.");
		return;
	}

	// --- Set domain ---
	const api = createApiClient(config.apiToken);
	const s = p.spinner();
	s.start("Fetching zones...");

	const zonesResult = await api.listZones();
	if (zonesResult.isErr()) {
		s.stop("Failed");
		p.log.error(zonesResult.error.message);
		process.exit(1);
	}

	const allZones = zonesResult.value;
	const zones = allZones.filter((z) => z.account.id === config.accountId);

	if (!zones.length) {
		s.stop("No domains found");
		p.log.error(
			[
				"No domains found on this account.",
				"",
				"Add a domain to Cloudflare first, then re-run this command.",
				`Dashboard: ${color.dim("https://dash.cloudflare.com")}`,
			].join("\n"),
		);
		process.exit(1);
	}

	s.stop(`Found ${zones.length} domain${zones.length === 1 ? "" : "s"}`);

	// Zone selection
	let zoneId = flags.zoneId;
	let domainName: string;

	if (zoneId) {
		const match = zones.find((z) => z.id === zoneId);
		if (!match) {
			p.log.error(`Zone ID "${zoneId}" not found.`);
			process.exit(1);
		}
		domainName = match.name;
		p.log.info(`Domain: ${color.bold(domainName)}`);
	} else if (zones.length === 1) {
		const zone = zones[0];
		if (!zone) {
			p.log.error("Unexpected error reading zones.");
			process.exit(1);
		}
		p.log.info(`Domain: ${color.bold(zone.name)}`);
		zoneId = zone.id;
		domainName = zone.name;
	} else {
		const selected = bail(
			await p.select({
				message: "Domain",
				options: zones.map((z) => ({ value: z.id, label: z.name })),
			}),
		);
		const zone = zones.find((z) => z.id === selected);
		if (!zone) {
			p.log.error("Selection not found.");
			process.exit(1);
		}
		zoneId = zone.id;
		domainName = zone.name;
	}

	// Prefix
	let prefix = flags.prefix;
	if (!prefix) {
		prefix = bail(
			await p.text({
				message: "Subdomain prefix:",
				placeholder: DEFAULT_PREFIX,
				initialValue: config.prefix ?? DEFAULT_PREFIX,
				validate: (v = "") => {
					if (!v.trim()) return "Required";
					if (!/^[a-z0-9-]+$/.test(v)) return "Lowercase letters, numbers, hyphens only";
					return undefined;
				},
			}),
		);
	} else {
		p.log.info(`Prefix: ${color.bold(prefix)}`);
	}

	// Summary + save
	p.log.success(
		[
			"",
			`  ${color.bold("Domain")}   ${domainName}`,
			`  ${color.bold("Prefix")}   ${prefix}`,
			`  ${color.bold("Pattern")}  ${prefix}-<name>.${domainName}`,
		].join("\n"),
	);

	const updated = { ...config, zoneId, domain: domainName, prefix };
	const result = saveConfig(updated);
	if (result.isErr()) {
		p.log.error(result.error.message);
		process.exit(1);
	}

	p.outro(`Run ${color.bold("cftunnel create <name>")} to create a tunnel.`);
}
