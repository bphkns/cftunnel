import { createApiClient } from "../lib/api.js";
import { requireConfig } from "../lib/config.js";
import { showTunnels } from "../utils/tunnels.js";

export async function list(): Promise<void> {
	const config = requireConfig();
	const api = createApiClient(config.apiToken);
	await showTunnels(api, config.accountId);
}
