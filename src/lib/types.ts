import { TaggedError } from "better-result";

export class CfApiError extends TaggedError("CfApiError")<{
	code: number;
	message: string;
}>() {
	constructor(args: { code: number; detail: string }) {
		super({ code: args.code, message: `CF API ${args.code}: ${args.detail}` });
	}
}

export class CfNetworkError extends TaggedError("CfNetworkError")<{
	message: string;
	cause: unknown;
}>() {
	constructor(args: { cause: unknown }) {
		const msg = args.cause instanceof Error ? args.cause.message : "Network request failed";
		super({ message: msg, cause: args.cause });
	}
}

export class ConfigError extends TaggedError("ConfigError")<{
	message: string;
}>() {}

export type AppError = CfApiError | CfNetworkError | ConfigError;

export interface CfApiResponse<T> {
	success: boolean;
	errors: ReadonlyArray<{ code: number; message: string }>;
	messages: ReadonlyArray<{ code: number; message: string }>;
	result: T;
	result_info?: {
		page: number;
		per_page: number;
		count: number;
		total_count: number;
	};
}

export interface CfTunnel {
	id: string;
	name: string;
	status: "healthy" | "down" | "inactive" | "degraded";
	created_at: string;
	deleted_at: string | null;
	connections: ReadonlyArray<CfTunnelConnection>;
	remote_config: boolean;
	config_src: "cloudflare" | "local";
	account_tag: string;
	tun_type: string;
}

export interface CfTunnelConnection {
	colo_name: string;
	uuid: string;
	id: string;
	is_pending_reconnect: boolean;
	origin_ip: string;
	opened_at: string;
	client_id: string;
	client_version: string;
}

export interface CfTunnelConfig {
	tunnel_id: string;
	version: number;
	config: {
		ingress: ReadonlyArray<CfIngressRule>;
		"warp-routing"?: { enabled: boolean };
	};
	source: string;
	created_at: string;
}

export interface CfIngressRule {
	hostname?: string;
	service: string;
	path?: string;
	originRequest?: Record<string, unknown>;
}

export interface CfDnsRecord {
	id: string;
	name: string;
	type: string;
	content: string;
	proxied: boolean;
	ttl: number;
	created_on: string;
	modified_on: string;
}

export interface CfZone {
	id: string;
	name: string;
	status: string;
	account: { id: string; name: string };
}

export interface CfTokenVerification {
	id: string;
	status: string;
}

export interface CfAccount {
	id: string;
	name: string;
	type: string;
}

export interface AppConfig {
	apiToken: string;
	accountId: string;
	zoneId: string | undefined;
	domain: string | undefined;
	prefix: string | undefined;
	defaultPort: number;
}
