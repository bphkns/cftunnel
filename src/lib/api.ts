import { Result } from "better-result";
import { CF_API_BASE } from "./constants.js";
import {
	type CfAccount,
	CfApiError,
	type CfApiResponse,
	type CfDnsRecord,
	CfNetworkError,
	type CfTokenVerification,
	type CfTunnel,
	type CfTunnelConfig,
	type CfZone,
} from "./types.js";

type Method = "GET" | "POST" | "PUT" | "DELETE";

type ApiResult<T> = Promise<Result<T, CfApiError | CfNetworkError>>;

async function cfetch<T>(
	token: string,
	path: string,
	method: Method = "GET",
	body?: unknown,
): ApiResult<T> {
	return Result.tryPromise({
		try: async () => {
			const init: RequestInit = {
				method,
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
			};
			if (body) init.body = JSON.stringify(body);
			const res = await fetch(`${CF_API_BASE}${path}`, init);

			const json: CfApiResponse<T> = await res.json();
			if (!json.success) {
				const first = json.errors[0];
				throw new CfApiError({
					code: first?.code ?? 0,
					detail: first?.message ?? "Unknown Cloudflare API error",
				});
			}
			return json.result;
		},
		catch: (cause) => {
			if (cause instanceof CfApiError) return cause;
			return new CfNetworkError({ cause });
		},
	});
}

export function createApiClient(token: string) {
	const get = <T>(path: string) => cfetch<T>(token, path);
	const post = <T>(path: string, body: unknown) => cfetch<T>(token, path, "POST", body);
	const put = <T>(path: string, body: unknown) => cfetch<T>(token, path, "PUT", body);
	const del = <T>(path: string) => cfetch<T>(token, path, "DELETE");

	const account = (id: string) => `/accounts/${id}`;
	const tunnel = (accountId: string, tunnelId: string) =>
		`${account(accountId)}/cfd_tunnel/${tunnelId}`;

	return {
		verifyToken: () => get<CfTokenVerification>("/user/tokens/verify"),
		listAccounts: () => get<ReadonlyArray<CfAccount>>("/accounts"),
		listZones: () => get<ReadonlyArray<CfZone>>("/zones"),

		createTunnel: (accountId: string, name: string) =>
			post<CfTunnel>(`${account(accountId)}/cfd_tunnel`, { name, config_src: "cloudflare" }),

		deleteTunnel: (accountId: string, tunnelId: string) =>
			del<null>(tunnel(accountId, tunnelId)).then((r) => r.map(() => undefined)),

		cleanupConnections: (accountId: string, tunnelId: string) =>
			del<null>(`${tunnel(accountId, tunnelId)}/connections`).then((r) => r.map(() => undefined)),

		getTunnelByName: async (accountId: string, name: string) => {
			const result = await get<ReadonlyArray<CfTunnel>>(
				`${account(accountId)}/cfd_tunnel?name=${encodeURIComponent(name)}&is_deleted=false`,
			);
			return result.map((tunnels) => tunnels.find((t) => t.name === name));
		},

		listTunnels: (accountId: string) =>
			get<ReadonlyArray<CfTunnel>>(`${account(accountId)}/cfd_tunnel?is_deleted=false`),

		setTunnelIngress: (accountId: string, tunnelId: string, hostname: string, port: number) =>
			put<CfTunnelConfig>(`${tunnel(accountId, tunnelId)}/configurations`, {
				config: {
					ingress: [
						{ hostname, service: `http://localhost:${port}` },
						{ service: "http_status:404" },
					],
				},
			}).then((r) => r.map(() => undefined)),

		getTunnelConfig: (accountId: string, tunnelId: string) =>
			get<CfTunnelConfig>(`${tunnel(accountId, tunnelId)}/configurations`),

		getTunnelToken: (accountId: string, tunnelId: string) =>
			get<string>(`${tunnel(accountId, tunnelId)}/token`),

		createDnsRecord: (zoneId: string, name: string, tunnelId: string) =>
			post<CfDnsRecord>(`/zones/${zoneId}/dns_records`, {
				type: "CNAME",
				name,
				content: `${tunnelId}.cfargotunnel.com`,
				proxied: true,
			}),

		deleteDnsRecord: (zoneId: string, recordId: string) =>
			del<null>(`/zones/${zoneId}/dns_records/${recordId}`).then((r) => r.map(() => undefined)),

		findDnsRecord: async (zoneId: string, name: string) => {
			const result = await get<ReadonlyArray<CfDnsRecord>>(
				`/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(name)}`,
			);
			return result.map((records) => records[0]);
		},
	};
}

export type ApiClient = ReturnType<typeof createApiClient>;
