import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR_NAME, CONFIG_FILE_NAME, TOKEN_FILE_NAME } from "./constants.js";
import type { AppConfig } from "./types.js";

function dataDir(): string {
	const xdg = process.env.XDG_DATA_HOME;
	const base = xdg || join(homedir(), ".local", "share");
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

export function loadConfig(): AppConfig | undefined {
	const path = configPath();
	if (!existsSync(path)) return undefined;

	const raw = readFileSync(path, "utf-8");
	const parsed: unknown = JSON.parse(raw);
	if (!isValidConfig(parsed)) return undefined;
	return parsed;
}

export function saveConfig(config: AppConfig): void {
	const dir = dataDir();
	ensureDir(dir);
	const path = configPath();
	writeFileSync(path, JSON.stringify(config, null, "\t"), { mode: 0o600 });
}

export function loadToken(): string | undefined {
	const path = tokenPath();
	if (!existsSync(path)) return undefined;
	return readFileSync(path, "utf-8").trim();
}

export function saveToken(token: string): void {
	const dir = dataDir();
	ensureDir(dir);
	writeFileSync(tokenPath(), token, { mode: 0o600 });
}

export function configExists(): boolean {
	return existsSync(configPath());
}

export function getConfigDir(): string {
	return dataDir();
}
