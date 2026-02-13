import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Result } from "better-result";
import { CONFIG_DIR_NAME, CONFIG_FILE_NAME, TOKEN_FILE_NAME } from "./constants.js";
import { type AppConfig, ConfigError } from "./types.js";

function dataDir(): string {
	const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
	return join(base, CONFIG_DIR_NAME);
}

function ensureDir(dir: string): void {
	if (existsSync(dir)) return;
	mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function configPath(): string {
	return join(dataDir(), CONFIG_FILE_NAME);
}

function tokenPath(): string {
	return join(dataDir(), TOKEN_FILE_NAME);
}

function hasKey<K extends string>(obj: object, key: K): obj is Record<K, unknown> {
	return key in obj;
}

function isValidConfig(data: unknown): data is AppConfig {
	if (typeof data !== "object" || data === null) return false;
	if (!hasKey(data, "apiToken") || typeof data.apiToken !== "string") return false;
	if (!hasKey(data, "accountId") || typeof data.accountId !== "string") return false;
	if (!hasKey(data, "zoneId") || typeof data.zoneId !== "string") return false;
	if (!hasKey(data, "domain") || typeof data.domain !== "string") return false;
	if (!hasKey(data, "prefix") || typeof data.prefix !== "string") return false;
	if (!hasKey(data, "defaultPort") || typeof data.defaultPort !== "number") return false;
	return true;
}

export function loadConfig(): Result<AppConfig, ConfigError> {
	const path = configPath();
	if (!existsSync(path)) return Result.err(new ConfigError({ message: "No config found" }));

	return Result.try({
		try: () => {
			const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
			if (!isValidConfig(parsed)) throw new Error("Invalid config format");
			return parsed;
		},
		catch: () => new ConfigError({ message: "Failed to read config" }),
	});
}

export function requireConfig(): AppConfig {
	const result = loadConfig();
	if (result.isOk()) return result.value;
	console.error(`${result.error.message}. Run \`cftunnel setup\` first.`);
	process.exit(1);
}

export function saveConfig(config: AppConfig): Result<void, ConfigError> {
	return Result.try({
		try: () => {
			ensureDir(dataDir());
			writeFileSync(configPath(), JSON.stringify(config, null, "\t"), { mode: 0o600 });
		},
		catch: () => new ConfigError({ message: "Failed to save config" }),
	});
}

export function loadToken(): string | undefined {
	const path = tokenPath();
	if (!existsSync(path)) return undefined;

	try {
		const val = readFileSync(path, "utf-8").trim();
		return val || undefined;
	} catch {
		return undefined;
	}
}

export function saveToken(token: string): Result<void, ConfigError> {
	return Result.try({
		try: () => {
			ensureDir(dataDir());
			writeFileSync(tokenPath(), token, { mode: 0o600 });
		},
		catch: () => new ConfigError({ message: "Failed to save token" }),
	});
}

export function configExists(): boolean {
	return existsSync(configPath());
}
