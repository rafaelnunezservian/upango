#!/bin/bash
# Prepara las sesiones de Claude Code en la nube: Node 24 (engines + engine-strict),
# dependencias del monorepo e identidad git del autor del proyecto.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

NODE_MAJOR=24
NODE_DIR="$HOME/.node${NODE_MAJOR}"

if ! "$NODE_DIR/bin/node" -v 2>/dev/null | grep -q "^v${NODE_MAJOR}\."; then
  base="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
  tarball=$(curl -fsSL "$base/SHASUMS256.txt" | grep -o "node-v${NODE_MAJOR}[^ ]*-linux-x64.tar.xz" | head -1)
  rm -rf "$NODE_DIR"
  mkdir -p "$NODE_DIR"
  curl -fsSL "$base/$tarball" | tar -xJ -C "$NODE_DIR" --strip-components=1
fi

export PATH="$NODE_DIR/bin:$PATH"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$NODE_DIR/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

cd "$CLAUDE_PROJECT_DIR"
npm install --no-audit --no-fund

git config user.name "Rafael Nuñez Servián"
git config user.email "184321396+rafaelnunezservian@users.noreply.github.com"
