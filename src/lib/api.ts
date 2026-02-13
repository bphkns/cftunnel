import { CF_API_BASE } from "./constants.js";
import type {
	CfAccount,
	CfApiResponse,
	CfDnsRecord,
	CfTokenVerification,
	CfTunnel,
	CfTunnelConfig,
	CfZone,
} from "./types.js";

interface FetchOptions {
	method?: string;
	body?: unknown;
}

export interface ApiClient {
	verifyToken(): Promise<CfTokenVerification>;
	listAccounts(): Promise<ReadonlyArray<CfAccount>>;
	listZones(): Promise<ReadonlyArray<CfZone>>;
	createTunnel(accountId: string, name: string): Promise<CfTunnel>;
	deleteTunnel(accountId: string, tunnelId: string): Promise<void>;
	cleanupConnections(accountId: string, tunnelId: string): Promise<void>;
	getTunnelByName(accountId: string, name: string): Promise<CfTunnel | undefined>;
	listTunnels(accountId: string): Promise<ReadonlyArray<CfTunnel>>;
	setTunnelIngress(
		accountId: string,
		tunnelId: string,
		hostname: string,
		port: number,
	): Promise<void>;
	getTunnelToken(accountId: string, tunnelId: string): Promise<string>;
	createDnsRecord(zoneId: string, name: string, tunnelId: string): Promise<CfDnsRecord>;
	deleteDnsRecord(zoneId: string, recordId: string): Promise<void>;
	findDnsRecord(zoneId: string, name: string): Promise<CfDnsRecord | undefined>;
}

async function cfetch<T>(
	token: string,
	path: string,
	options?: FetchOptions,
): Promise<CfApiResponse<T>> {
	const url = `${CF_API_BASE}${path}`;
	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
	};

	const init: RequestInit = {
		method: options?.method ?? "GET",
		headers,
	};

	if (options?.body) {
		init.body = JSON.stringify(options.body);
	}

	const res = await fetch(url, init);
	const json: CfApiResponse<T> = await res.json();
	return json;
}

export function createApiClient(token: string): ApiClient {
	return {
		async verifyToken() {
			const res = await cfetch<CfTokenVerification>(token, "/user/tokens/verify");
			if (!res.success) throw new Error(formatError(res));
			return res.result;
		},

		async listAccounts() {
			const res = await cfetch<ReadonlyArray<CfAccount>>(token, "/accounts");
			if (!res.success) throw new Error(formatError(res));
			return res.result;
		},

		async listZones() {
			const res = await cfetch<ReadonlyArray<CfZone>>(token, "/zones");
			if (!res.success) throw new Error(formatError(res));
			return res.result;
		},

		async createTunnel(accountId, name) {
			const res = await cfetch<CfTunnel>(token, `/accounts/${accountId}/cfd_tunnel`, {
				method: "POST",
				body: { name, config_src: "cloudflare" },
			});
			if (!res.success) throw new Error(formatError(res));
			return res.result;
		},

		async deleteTunnel(accountId, tunnelId) {
			const res = await cfetch<null>(token, `/accounts/${accountId}/cfd_tunnel/${tunnelId}`, {
				method: "DELETE",
			});
			if (!res.success) throw new Error(formatError(res));
		},

		async cleanupConnections(accountId, tunnelId) {
			await cfetch<null>(token, `/accounts/${accountId}/cfd_tunnel/${tunnelId}/connections`, {
				method: "DELETE",
			});
		},

		async getTunnelByName(accountId, name) {
			const res = await cfetch<ReadonlyArray<CfTunnel>>(
				token,
				`/accounts/${accountId}/cfd_tunnel?name=${encodeURIComponent(name)}&is_deleted=false`,
			);
			if (!res.success) throw new Error(formatError(res));
			return res.result.find((t) => t.name === name);
		},

		async listTunnels(accountId) {
			const res = await cfetch<ReadonlyArray<CfTunnel>>(
				token,
				`/accounts/${accountId}/cfd_tunnel?is_deleted=false`,
			);
			if (!res.success) throw new Error(formatError(res));
			return res.result;
		},

		async setTunnelIngress(accountId, tunnelId, hostname, port) {
			const res = await cfetch<CfTunnelConfig>(
				token,
				`/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
				{
					method: "PUT",
					body: {
						config: {
							ingress: [
								{ hostname, service: `http://localhost:${port}` },
								{ service: "http_status:404" },
							],
						},
					},
				},
			);
			if (!res.success) throw new Error(formatError(res));
		},

		async getTunnelToken(accountId, tunnelId) {
			const res = await cfetch<string>(
				token,
				`/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`,
			);
			if (!res.success) throw new Error(formatError(res));
			return res.result;
		},

		async createDnsRecord(zoneId, name, tunnelId) {
			const res = await cfetch<CfDnsRecord>(token, `/zones/${zoneId}/dns_records`, {
				method: "POST",
				body: {
					type: "CNAME",
					name,
					content: `${tunnelId}.cfargotunnel.com`,
					proxied: true,
				},
			});
			if (!res.success) throw new Error(formatError(res));
			return res.result;
		},

		async deleteDnsRecord(zoneId, recordId) {
			const res = await cfetch<null>(token, `/zones/${zoneId}/dns_records/${recordId}`, {
				method: "DELETE",
			});
			if (!res.success) throw new Error(formatError(res));
		},

		async findDnsRecord(zoneId, name) {
			const res = await cfetch<ReadonlyArray<CfDnsRecord>>(
				token,
				`/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(name)}`,
			);
			if (!res.success) throw new Error(formatError(res));
			return res.result[0];
		},
	};
}

function formatError(res: CfApiResponse<unknown>): string {
	const first = res.errors[0];
	if (!first) return "Unknown Cloudflare API error";
	return `CF API error ${first.code}: ${first.message}`;
}
