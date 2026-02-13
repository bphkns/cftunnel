import { parseArgs } from "node:util";
import { DEFAULT_PORT } from "../lib/constants.js";

const ALIASES: Record<string, string> = {
	new: "create",
	rm: "delete",
	ls: "list",
	run: "start",
	"-h": "help",
	"--help": "help",
	"-v": "version",
	"--version": "version",
};

interface SetupArgs {
	command: "setup";
	token: string | undefined;
	accountId: string | undefined;
	zoneId: string | undefined;
	prefix: string | undefined;
}

interface CreateArgs {
	command: "create";
	name: string;
	port: number | undefined;
}

interface DeleteArgs {
	command: "delete";
	name: string;
	dnsOnly: boolean;
	tunnelOnly: boolean;
	force: boolean;
}

interface ListArgs {
	command: "list";
}

interface TokenArgs {
	command: "token";
	name: string;
}

interface StartArgs {
	command: "start";
	token: string | undefined;
	background: boolean;
	quick: boolean;
	port: number;
}

interface StopArgs {
	command: "stop";
}

interface HelpArgs {
	command: "help";
}

interface VersionArgs {
	command: "version";
}

interface StatusArgs {
	command: "status";
}

interface DomainArgs {
	command: "domain";
	zoneId: string | undefined;
	prefix: string | undefined;
	clear: boolean;
}

interface UnknownArgs {
	command: "unknown";
	raw: string;
}

export type CliArgs =
	| SetupArgs
	| CreateArgs
	| DeleteArgs
	| ListArgs
	| TokenArgs
	| StartArgs
	| StatusArgs
	| DomainArgs
	| StopArgs
	| HelpArgs
	| VersionArgs
	| UnknownArgs;

const SAFE_REGEX = /^[a-z0-9][a-z0-9-]*$/;

function validatePrefix(prefix: string | undefined): string | undefined {
	if (!prefix) return undefined;
	if (!SAFE_REGEX.test(prefix)) {
		console.error(`Invalid prefix: "${prefix}"\n`);
		console.error("Prefix must be lowercase letters, numbers, and hyphens only.");
		process.exit(1);
	}
	return prefix;
}

function requireName(positionals: ReadonlyArray<string>, command: string): string {
	const name = positionals[0];
	if (!name) {
		console.error(`Usage: cftunnel ${command} <name>\n`);
		console.error("Name is required. This is the dev's identifier (e.g. stark, wolverine).");
		process.exit(1);
	}
	if (!SAFE_REGEX.test(name)) {
		console.error(`Invalid name: "${name}"\n`);
		console.error("Name must be lowercase letters, numbers, and hyphens only (e.g. stark, dev-1).");
		process.exit(1);
	}
	return name;
}

function parsePort(raw: string | undefined, fallback: number): number {
	if (!raw) return fallback;
	const num = Number(raw);
	if (Number.isNaN(num) || num < 1 || num > 65535) {
		console.error("--port must be a number between 1 and 65535.");
		process.exit(1);
	}
	return num;
}

function parseOptionalPort(raw: string | undefined): number | undefined {
	if (!raw) return undefined;
	const num = Number(raw);
	if (Number.isNaN(num) || num < 1 || num > 65535) {
		console.error("--port must be a number between 1 and 65535.");
		process.exit(1);
	}
	return num;
}

function parseCommand(argv: ReadonlyArray<string>): { command: string; rest: string[] } {
	const args = argv.slice(2);
	const raw = args[0] ?? "help";
	const command = ALIASES[raw] ?? raw;
	return { command, rest: args.slice(1) };
}

type ParseOptions = Record<string, { type: "boolean" | "string"; short?: string }>;

function str(val: string | boolean | undefined): string | undefined {
	return typeof val === "string" ? val : undefined;
}

function tryParse(rest: string[], options: ParseOptions) {
	try {
		return parseArgs({ args: rest, options, allowPositionals: true, strict: true });
	} catch (err) {
		console.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
}

export function parse(argv: ReadonlyArray<string>): CliArgs {
	const { command, rest } = parseCommand(argv);

	switch (command) {
		case "help":
			return { command: "help" };

		case "version":
			return { command: "version" };

		case "setup": {
			const { values } = tryParse(rest, {
				token: { type: "string" },
				"account-id": { type: "string" },
				"zone-id": { type: "string" },
				prefix: { type: "string" },
			});
			return {
				command: "setup",
				token: str(values.token),
				accountId: str(values["account-id"]),
				zoneId: str(values["zone-id"]),
				prefix: validatePrefix(str(values.prefix)),
			};
		}

		case "create": {
			const { values, positionals } = tryParse(rest, {
				port: { type: "string", short: "p" },
			});
			return {
				command: "create",
				name: requireName(positionals, "create"),
				port: parseOptionalPort(str(values.port)),
			};
		}

		case "delete": {
			const { values, positionals } = tryParse(rest, {
				"dns-only": { type: "boolean" },
				"tunnel-only": { type: "boolean" },
				force: { type: "boolean", short: "f" },
			});
			const dnsOnly = values["dns-only"] === true;
			const tunnelOnly = values["tunnel-only"] === true;
			if (dnsOnly && tunnelOnly) {
				console.error(
					"Cannot use --dns-only and --tunnel-only together. Omit both for full delete.",
				);
				process.exit(1);
			}
			return {
				command: "delete",
				name: requireName(positionals, "delete"),
				dnsOnly,
				tunnelOnly,
				force: values.force === true,
			};
		}

		case "list": {
			tryParse(rest, {});
			return { command: "list" };
		}

		case "token": {
			const { positionals } = tryParse(rest, {});
			return { command: "token", name: requireName(positionals, "token") };
		}

		case "start": {
			const { values } = tryParse(rest, {
				token: { type: "string" },
				background: { type: "boolean", short: "d" },
				quick: { type: "boolean", short: "q" },
				port: { type: "string", short: "p" },
			});
			return {
				command: "start",
				token: str(values.token),
				background: values.background === true,
				quick: values.quick === true,
				port: parsePort(str(values.port), DEFAULT_PORT),
			};
		}

		case "stop": {
			tryParse(rest, {});
			return { command: "stop" };
		}

		case "status": {
			tryParse(rest, {});
			return { command: "status" };
		}

		case "domain": {
			const { values } = tryParse(rest, {
				"zone-id": { type: "string" },
				prefix: { type: "string" },
				clear: { type: "boolean" },
			});
			return {
				command: "domain",
				zoneId: str(values["zone-id"]),
				prefix: validatePrefix(str(values.prefix)),
				clear: values.clear === true,
			};
		}

		default:
			return { command: "unknown", raw: command };
	}
}
