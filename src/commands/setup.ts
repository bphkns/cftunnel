import * as p from "@clack/prompts";
import color from "picocolors";
import { createApiClient } from "../lib/api.js";
import { configExists, loadConfig, saveConfig } from "../lib/config.js";
import { CF_DASHBOARD_TOKENS_URL, DEFAULT_PORT, DEFAULT_PREFIX } from "../lib/constants.js";
import type { AppConfig } from "../lib/types.js";
import { openBrowser } from "../utils/process.js";

export interface SetupFlags {
	token: string | undefined;
	accountId: string | undefined;
	zoneId: string | undefined;
	prefix: string | undefined;
}

function bail<T>(value: T | symbol): T {
	if (p.isCancel(value)) {
		p.cancel("Cancelled.");
		process.exit(0);
	}
	return value;
}

async function selectOrSingle<T extends { id: string; name: string }>(
	items: ReadonlyArray<T>,
	message: string,
): Promise<T> {
	if (items.length === 1) {
		const item = items[0];
		if (!item) {
			p.log.error("No items available.");
			process.exit(1);
		}
		p.log.info(`${message}: ${color.bold(item.name)}`);
		return item;
	}

	const selected = bail(
		await p.select({
			message,
			options: items.map((i) => ({ value: i.id, label: i.name })),
		}),
	);

	const found = items.find((i) => i.id === selected);
	if (!found) {
		p.log.error("Selection not found.");
		process.exit(1);
	}
	return found;
}

export async function setup(flags: SetupFlags): Promise<void> {
	p.intro(color.bgCyan(color.black(" cftunnel setup ")));

	if (configExists()) {
		const existing = loadConfig();
		if (existing.isOk()) {
			const label = existing.value.domain ?? "no domain";
			const overwrite = bail(await p.confirm({ message: `Config exists (${label}). Overwrite?` }));
			if (!overwrite) {
				p.cancel("Keeping existing config.");
				process.exit(0);
			}
		}
	}

	// --- Token ---
	let tokenInput = flags.token;
	if (!tokenInput) {
		p.log.info(
			[
				"You need a Cloudflare API token with:",
				`  ${color.bold("Account")} — Cloudflare Tunnel — Edit`,
				`  ${color.bold("Zone")} — DNS — Edit (optional, for custom domains)`,
			].join("\n"),
		);

		const shouldOpen = bail(
			await p.confirm({ message: "Open Cloudflare dashboard to create a token?" }),
		);
		if (shouldOpen) openBrowser(CF_DASHBOARD_TOKENS_URL);

		tokenInput = bail(
			await p.text({
				message: "Paste your API token:",
				validate: (v = "") => (!v.trim() ? "Token is required" : undefined),
			}),
		);
	}

	const api = createApiClient(tokenInput.trim());
	const s = p.spinner();
	s.start("Verifying token...");

	const verifyResult = await api.verifyToken();
	if (verifyResult.isErr()) {
		s.stop("Verification failed");
		p.log.error(verifyResult.error.message);
		process.exit(1);
	}

	const [accountsResult, zonesResult] = await Promise.all([api.listAccounts(), api.listZones()]);

	if (accountsResult.isErr()) {
		s.stop("Failed");
		p.log.error(accountsResult.error.message);
		process.exit(1);
	}

	const accounts = accountsResult.value;
	if (!accounts.length) {
		s.stop("Failed");
		p.log.error("Token has no account access.");
		process.exit(1);
	}

	const zones = zonesResult.isOk() ? zonesResult.value : [];
	s.stop("Token valid!");

	// --- Account ---
	let accountId = flags.accountId;
	if (!accountId) {
		const account = await selectOrSingle([...accounts], "Account");
		accountId = account.id;
	} else {
		const match = accounts.find((a) => a.id === accountId);
		if (!match) {
			p.log.error(`Account ID "${accountId}" not found for this token.`);
			process.exit(1);
		}
		p.log.info(`Account: ${color.bold(match.name)}`);
	}

	// --- Zone (optional) ---
	let zoneId: string | undefined = flags.zoneId;
	let domain: string | undefined;
	let prefix: string | undefined = flags.prefix;

	const accountZones = zones.filter((z) => z.account.id === accountId);

	if (zoneId) {
		const match = accountZones.find((z) => z.id === zoneId);
		if (!match) {
			p.log.error(`Zone ID "${zoneId}" not found for this account.`);
			process.exit(1);
		}
		domain = match.name;
		p.log.info(`Domain: ${color.bold(domain)}`);
	} else if (accountZones.length > 0) {
		const useDomain = bail(
			await p.confirm({
				message: `${accountZones.length} domain${accountZones.length === 1 ? "" : "s"} found. Use a custom domain?`,
			}),
		);

		if (useDomain) {
			const zone = await selectOrSingle([...accountZones], "Domain");
			zoneId = zone.id;
			domain = zone.name;
		} else {
			p.log.info(
				color.dim("No domain selected. Use cftunnel start --quick for random public URLs."),
			);
		}
	} else {
		p.log.info(
			[
				color.dim("No domains found on this account."),
				color.dim("You can still create tunnels without DNS using: cftunnel start --quick"),
				color.dim("To add a domain later, re-run: cftunnel setup"),
			].join("\n"),
		);
	}

	// --- Prefix (only if domain selected) ---
	if (domain && !prefix) {
		prefix = bail(
			await p.text({
				message: "Subdomain prefix:",
				placeholder: DEFAULT_PREFIX,
				initialValue: DEFAULT_PREFIX,
				validate: (v = "") => {
					if (!v.trim()) return "Required";
					if (!/^[a-z0-9-]+$/.test(v)) return "Lowercase letters, numbers, hyphens only";
					return undefined;
				},
			}),
		);
	} else if (domain && prefix) {
		p.log.info(`Prefix: ${color.bold(prefix)}`);
	}

	const config: AppConfig = {
		apiToken: tokenInput.trim(),
		accountId,
		zoneId,
		domain,
		prefix,
		defaultPort: DEFAULT_PORT,
	};

	// --- Summary ---
	const summary = [
		"",
		`  ${color.bold("Account")}  ${accounts.find((a) => a.id === accountId)?.name ?? accountId}`,
	];
	if (domain) {
		summary.push(`  ${color.bold("Domain")}   ${domain}`);
		summary.push(`  ${color.bold("Prefix")}   ${prefix}`);
		summary.push(`  ${color.bold("Pattern")}  ${prefix}-<name>.${domain}`);
	} else {
		summary.push(`  ${color.bold("Domain")}   ${color.dim("none (quick tunnel mode only)")}`);
	}
	p.log.success(summary.join("\n"));

	const saveResult = saveConfig(config);
	if (saveResult.isErr()) {
		p.log.error(saveResult.error.message);
		process.exit(1);
	}

	if (domain) {
		p.outro(`Run ${color.bold("cftunnel create <name>")} to create a tunnel.`);
	} else {
		p.outro(`Run ${color.bold("cftunnel start --quick")} to get a public URL instantly.`);
	}
}
