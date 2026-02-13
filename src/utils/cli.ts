export function parseArgs(argv: ReadonlyArray<string>): {
	command: string | undefined;
	positional: ReadonlyArray<string>;
	flags: Record<string, string | true>;
} {
	const args = argv.slice(2);
	const command = args[0];
	const positional: string[] = [];
	const flags: Record<string, string | true> = {};

	for (let i = 1; i < args.length; i++) {
		const arg = args[i];
		if (!arg) continue;

		if (arg.startsWith("--")) {
			const key = arg.slice(2);
			const next = args[i + 1];
			if (next && !next.startsWith("--")) {
				flags[key] = next;
				i++;
			} else {
				flags[key] = true;
			}
			continue;
		}

		positional.push(arg);
	}

	return { command, positional, flags };
}
