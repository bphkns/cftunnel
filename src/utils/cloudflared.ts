import { chmodSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import * as p from "@clack/prompts";
import { Result } from "better-result";
import color from "picocolors";
import { ConfigError } from "../lib/types.js";

const RELEASE_BASE = "https://github.com/cloudflare/cloudflared/releases/latest/download";

const INSTALL_DIR = join(homedir(), ".local", "bin");
const BINARY_PATH = join(INSTALL_DIR, "cloudflared");

interface Platform {
	asset: string;
	extract: boolean;
}

function getPlatform(): Platform | undefined {
	const os = process.platform;
	const cpu = process.arch;

	if (os === "linux" && cpu === "x64") return { asset: "cloudflared-linux-amd64", extract: false };
	if (os === "linux" && cpu === "arm64")
		return { asset: "cloudflared-linux-arm64", extract: false };
	if (os === "darwin" && cpu === "x64")
		return { asset: "cloudflared-darwin-amd64.tgz", extract: true };
	if (os === "darwin" && cpu === "arm64")
		return { asset: "cloudflared-darwin-arm64.tgz", extract: true };
	return undefined;
}

export function findCloudflared(): string | undefined {
	try {
		const result = Bun.spawnSync(["which", "cloudflared"]);
		const path = result.stdout.toString().trim();
		if (path && existsSync(path)) return path;
	} catch {}

	if (existsSync(BINARY_PATH)) return BINARY_PATH;
	return undefined;
}

async function download(url: string): Promise<Result<ArrayBuffer, ConfigError>> {
	return Result.tryPromise({
		try: async () => {
			const res = await fetch(url, { redirect: "follow" });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.arrayBuffer();
		},
		catch: (e) =>
			new ConfigError({
				message: `Download failed: ${e instanceof Error ? e.message : "unknown error"}`,
			}),
	});
}

export async function installCloudflared(): Promise<Result<string, ConfigError>> {
	const platform = getPlatform();
	if (!platform) {
		return Result.err(
			new ConfigError({ message: `Unsupported platform: ${process.platform}/${process.arch}` }),
		);
	}

	const url = `${RELEASE_BASE}/${platform.asset}`;

	const s = p.spinner();
	s.start(`Downloading cloudflared (${platform.asset})...`);

	const data = await download(url);
	if (data.isErr()) {
		s.stop("Download failed");
		return Result.err(data.error);
	}

	return Result.try({
		try: () => {
			mkdirSync(INSTALL_DIR, { recursive: true });

			if (platform.extract) {
				const tmpPath = join(tmpdir(), platform.asset);
				writeFileSync(tmpPath, Buffer.from(data.value));
				Bun.spawnSync(["tar", "xzf", tmpPath, "-C", INSTALL_DIR]);
				unlinkSync(tmpPath);
			} else {
				writeFileSync(BINARY_PATH, Buffer.from(data.value));
			}

			chmodSync(BINARY_PATH, 0o755);
			s.stop(`Installed to ${color.bold(BINARY_PATH)}`);
			return BINARY_PATH;
		},
		catch: (e) => {
			s.stop("Install failed");
			return new ConfigError({
				message: `Install failed: ${e instanceof Error ? e.message : "unknown error"}`,
			});
		},
	});
}

export async function ensureCloudflared(): Promise<string> {
	const existing = findCloudflared();
	if (existing) return existing;

	p.log.warn(`${color.bold("cloudflared")} not found.`);

	const shouldInstall = await p.confirm({
		message: "Download and install cloudflared?",
	});

	if (p.isCancel(shouldInstall) || !shouldInstall) {
		p.log.info(
			[
				"Install manually:",
				`  ${color.dim("brew install cloudflared")}          ${color.dim("# macOS")}`,
				`  ${color.dim("curl -fsSL https://pkg.cloudflare.com/cloudflared-linux-amd64 -o ~/.local/bin/cloudflared && chmod +x ~/.local/bin/cloudflared")}`,
			].join("\n"),
		);
		process.exit(1);
	}

	const result = await installCloudflared();
	if (result.isErr()) {
		p.log.error(result.error.message);
		process.exit(1);
	}

	return result.value;
}
