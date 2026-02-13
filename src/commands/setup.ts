import * as p from "@clack/prompts";
import color from "picocolors";
import { createApiClient } from "../lib/api.js";
import { configExists, loadConfig, saveConfig } from "../lib/config.js";
import { CF_DASHBOARD_TOKENS_URL, DEFAULT_PORT, DEFAULT_PREFIX } from "../lib/constants.js";
import type { AppConfig } from "../lib/types.js";
import { openBrowser } from "../utils/process.js";

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

export async function setup(): Promise<void> {
	p.intro(color.bgCyan(color.black(" cftunnel setup ")));

	if (configExists()) {
		const existing = loadConfig();
		if (existing.isOk()) {
			const overwrite = bail(
				await p.confirm({ message: `Config exists (${existing.value.domain}). Overwrite?` }),
			);
			if (!overwrite) {
				p.cancel("Keeping existing config.");
				process.exit(0);
			}
		}
	}

	p.log.info(
		[
			"You need a Cloudflare API token with:",
			`  ${color.bold("Account")} — Cloudflare Tunnel — Edit`,
			`  ${color.bold("Zone")} — DNS — Edit`,
		].join("\n"),
	);

	const shouldOpen = bail(
		await p.confirm({ message: "Open Cloudflare dashboard to create a token?" }),
	);
	if (shouldOpen) openBrowser(CF_DASHBOARD_TOKENS_URL);

	const tokenInput = bail(
		await p.text({
			message: "Paste your API token:",
			validate: (v = "") => (!v.trim() ? "Token is required" : undefined),
		}),
	);

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
	if (zonesResult.isErr()) {
		s.stop("Failed");
		p.log.error(zonesResult.error.message);
		process.exit(1);
	}

	const accounts = accountsResult.value;
	const zones = zonesResult.value;

	if (!accounts.length) {
		s.stop("Failed");
		p.log.error("Token has no account access.");
		process.exit(1);
	}
	if (!zones.length) {
		s.stop("Failed");
		p.log.error("Token has no zone access.");
		process.exit(1);
	}

	s.stop("Token valid!");

	const account = await selectOrSingle([...accounts], "Account");
	const accountZones = zones.filter((z) => z.account.id === account.id);

	if (!accountZones.length) {
		p.log.error("No zones found for this account.");
		process.exit(1);
	}

	const zone = await selectOrSingle([...accountZones], "Domain");

	const prefix = bail(
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

	const config: AppConfig = {
		apiToken: tokenInput.trim(),
		accountId: account.id,
		zoneId: zone.id,
		domain: zone.name,
		prefix,
		defaultPort: DEFAULT_PORT,
	};

	const saveResult = saveConfig(config);
	if (saveResult.isErr()) {
		p.log.error(saveResult.error.message);
		process.exit(1);
	}

	p.log.success("Config saved!");
	p.outro(`Run ${color.bold("cftunnel create <name>")} to create a tunnel.`);
}
