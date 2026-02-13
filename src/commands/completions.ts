const COMMANDS = [
	"setup",
	"status",
	"domain",
	"create",
	"delete",
	"list",
	"token",
	"start",
	"stop",
	"completions",
	"help",
	"version",
];

const ALIASES: Record<string, string> = {
	create: "new",
	delete: "rm",
	list: "ls",
	start: "run",
};

const FLAGS: Record<string, ReadonlyArray<string>> = {
	setup: ["--token", "--account-id", "--zone-id", "--prefix"],
	domain: ["--zone-id", "--prefix", "--clear"],
	create: ["--port", "-p"],
	delete: ["--dns-only", "--tunnel-only", "--force", "-f"],
	start: ["--token", "--background", "-d", "--quick", "-q", "--port", "-p"],
	completions: ["--shell"],
};

function bash(): string {
	const cmds = COMMANDS.map((c) => {
		const alias = ALIASES[c];
		return alias ? `${c} ${alias}` : c;
	}).join(" ");

	const cases = Object.entries(FLAGS)
		.map(([cmd, flags]) => {
			const alias = ALIASES[cmd];
			const pattern = alias ? `${cmd}|${alias}` : cmd;
			return `        ${pattern}) COMPREPLY=($(compgen -W "${flags.join(" ")}" -- "$cur")) ;;`;
		})
		.join("\n");

	return `_cftunnel() {
    local cur prev words cword
    _init_completion || return

    if [[ $cword -eq 1 ]]; then
        COMPREPLY=($(compgen -W "${cmds}" -- "$cur"))
        return
    fi

    local cmd="\${words[1]}"
    case "$cmd" in
${cases}
    esac
}

complete -F _cftunnel cftunnel`;
}

function zsh(): string {
	const cmdLines = COMMANDS.map((c) => {
		const alias = ALIASES[c];
		const desc = commandDescription(c);
		const lines = [`        '${c}:${desc}'`];
		if (alias) {
			lines.push(`        '${alias}:${desc}'`);
		}
		return lines.join("\n");
	}).join("\n");

	const cases = Object.entries(FLAGS)
		.map(([cmd, flags]) => {
			const alias = ALIASES[cmd];
			const pattern = alias ? `${cmd}|${alias}` : cmd;
			const opts = flags.filter((f) => f.startsWith("--")).map((f) => `'${f}'`);
			return `        ${pattern}) _arguments ${opts.join(" ")} ;;`;
		})
		.join("\n");

	return `#compdef cftunnel

_cftunnel() {
    local -a commands
    commands=(
${cmdLines}
    )

    if (( CURRENT == 2 )); then
        _describe 'command' commands
        return
    fi

    local cmd="\${words[2]}"
    case "$cmd" in
${cases}
    esac
}

_cftunnel "$@"`;
}

function fish(): string {
	const noFileFlag = "--no-files";
	const lines: string[] = [];

	for (const cmd of COMMANDS) {
		const desc = commandDescription(cmd);
		lines.push(
			`complete -c cftunnel ${noFileFlag} -n "__fish_use_subcommand" -a "${cmd}" -d "${desc}"`,
		);
		const alias = ALIASES[cmd];
		if (alias) {
			lines.push(
				`complete -c cftunnel ${noFileFlag} -n "__fish_use_subcommand" -a "${alias}" -d "${desc}"`,
			);
		}
	}

	for (const [cmd, flags] of Object.entries(FLAGS)) {
		const alias = ALIASES[cmd];
		const condition = alias
			? `__fish_seen_subcommand_from ${cmd} ${alias}`
			: `__fish_seen_subcommand_from ${cmd}`;
		for (const flag of flags) {
			if (!flag.startsWith("--")) continue;
			const name = flag.replace(/^--/, "");
			lines.push(`complete -c cftunnel ${noFileFlag} -n "${condition}" -l "${name}"`);
		}
	}

	return lines.join("\n");
}

function commandDescription(cmd: string): string {
	const descriptions: Record<string, string> = {
		setup: "Set up API credentials",
		status: "Show config, process, and tunnels",
		domain: "Add, change, or remove domain",
		create: "Create a tunnel for a dev",
		delete: "Delete tunnel and/or DNS",
		list: "List all tunnels",
		token: "Print tunnel token for a dev",
		start: "Run the tunnel",
		stop: "Stop a background tunnel",
		completions: "Print shell completions",
		help: "Show help",
		version: "Show version",
	};
	return descriptions[cmd] ?? cmd;
}

const SHELLS = ["bash", "zsh", "fish"] as const;
type Shell = (typeof SHELLS)[number];

function isShell(s: string): s is Shell {
	return SHELLS.includes(s as Shell);
}

function generate(shell: Shell): string {
	switch (shell) {
		case "bash":
			return bash();
		case "zsh":
			return zsh();
		case "fish":
			return fish();
	}
}

export function completions(shell: string | undefined): void {
	if (!shell) {
		const detected = detectShell();
		if (!detected) {
			console.error("Could not detect shell. Use: cftunnel completions --shell <bash|zsh|fish>");
			process.exit(1);
		}
		console.log(generate(detected));
		return;
	}

	if (!isShell(shell)) {
		console.error(`Unsupported shell: "${shell}". Supported: bash, zsh, fish`);
		process.exit(1);
	}

	console.log(generate(shell));
}

function detectShell(): Shell | undefined {
	const env = process.env.SHELL ?? "";
	if (env.endsWith("/zsh")) return "zsh";
	if (env.endsWith("/bash")) return "bash";
	if (env.endsWith("/fish")) return "fish";
	return undefined;
}
