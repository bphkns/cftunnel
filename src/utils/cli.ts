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
}

interface CreateArgs {
	command: "create";
	name: string;
	port: number;
}

interface DeleteArgs {
	command: "delete";
	name: string;
	dnsOnly: boolean;
	tunnelOnly: boolean;
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
	| StopArgs
	| HelpArgs
	| VersionArgs
	| UnknownArgs;

function requireName(positionals: ReadonlyArray<string>, command: string): string {
	const name = positionals[0];
	if (!name) {
		console.error(`Usage: cftunnel ${command} <name>\n`);
		console.error("Name is required. This is the dev's identifier (e.g. stark, wolverine).");
		process.exit(1);
	}
	return name;
}

function parsePort(raw: string | undefined): number {
	if (!raw) return DEFAULT_PORT;
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
			tryParse(rest, {});
			return { command: "setup" };
		}

		case "create": {
			const { values, positionals } = tryParse(rest, {
				port: { type: "string", short: "p" },
			});
			return {
				command: "create",
				name: requireName(positionals, "create"),
				port: parsePort(str(values.port)),
			};
		}

		case "delete": {
			const { values, positionals } = tryParse(rest, {
				"dns-only": { type: "boolean" },
				"tunnel-only": { type: "boolean" },
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
			});
			return {
				command: "start",
				token: str(values.token),
				background: values.background === true,
			};
		}

		case "stop": {
			tryParse(rest, {});
			return { command: "stop" };
		}

		default:
			return { command: "unknown", raw: command };
	}
}
