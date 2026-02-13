#!/usr/bin/env bash
set -euo pipefail

REPO="bphkns/cftunnel"
INSTALL_DIR="${CFTUNNEL_INSTALL_DIR:-/usr/local/bin}"

get_platform() {
	local os arch
	os="$(uname -s | tr '[:upper:]' '[:lower:]')"
	arch="$(uname -m)"

	case "$os" in
		linux) os="linux" ;;
		darwin) os="darwin" ;;
		*) echo "Unsupported OS: $os" >&2; exit 1 ;;
	esac

	case "$arch" in
		x86_64|amd64) arch="x64" ;;
		aarch64|arm64) arch="arm64" ;;
		*) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
	esac

	echo "${os}-${arch}"
}

get_latest_version() {
	curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
		| grep '"tag_name"' \
		| sed -E 's/.*"tag_name": *"([^"]+)".*/\1/'
}

main() {
	local platform version url tmp

	platform="$(get_platform)"
	version="${1:-$(get_latest_version)}"

	echo "Installing cftunnel ${version} for ${platform}..."

	url="https://github.com/${REPO}/releases/download/${version}/cftunnel-${platform}"
	tmp="$(mktemp)"

	curl -fsSL -o "$tmp" "$url"
	chmod +x "$tmp"

	if [ -w "$INSTALL_DIR" ]; then
		mv -f "$tmp" "${INSTALL_DIR}/cftunnel"
	else
		echo "Need sudo to install to ${INSTALL_DIR}"
		sudo mv -f "$tmp" "${INSTALL_DIR}/cftunnel"
	fi

	echo "Installed cftunnel to ${INSTALL_DIR}/cftunnel"
	"${INSTALL_DIR}/cftunnel" --version 2>/dev/null || true
}

main "$@"
