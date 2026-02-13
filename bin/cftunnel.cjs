#!/usr/bin/env node

"use strict";

const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const PLATFORMS = {
	"linux-x64": "@thewebkernel/cftunnel-linux-x64",
	"linux-arm64": "@thewebkernel/cftunnel-linux-arm64",
	"darwin-x64": "@thewebkernel/cftunnel-darwin-x64",
	"darwin-arm64": "@thewebkernel/cftunnel-darwin-arm64",
};

const platform = `${process.platform}-${process.arch}`;
const pkg = PLATFORMS[platform];

if (!pkg) {
	console.error(
		`cftunnel: unsupported platform ${platform}\n` +
			`Supported: ${Object.keys(PLATFORMS).join(", ")}`,
	);
	process.exit(1);
}

// Try platform-specific binary package
try {
	const binDir = path.dirname(require.resolve(`${pkg}/package.json`));
	const bin = path.join(binDir, "bin", "cftunnel");

	if (fs.existsSync(bin)) {
		const result = require("child_process").spawnSync(bin, process.argv.slice(2), {
			stdio: "inherit",
		});
		process.exit(result.status ?? 1);
	}
} catch {}

// Fallback: try running with bun (dev/source install)
try {
	const src = path.join(__dirname, "..", "src", "index.ts");
	if (fs.existsSync(src)) {
		const result = require("child_process").spawnSync("bun", ["run", src, ...process.argv.slice(2)], {
			stdio: "inherit",
		});
		process.exit(result.status ?? 1);
	}
} catch {}

console.error(
	`cftunnel: could not find binary for ${platform}\n` +
		`Try reinstalling: npm install -g @thewebkernel/cftunnel`,
);
process.exit(1);
