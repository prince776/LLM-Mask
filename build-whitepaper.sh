#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v tectonic &>/dev/null; then
  echo "tectonic not found — install with: brew install tectonic"
  exit 1
fi

tectonic whitepaper.tex
echo "Done: whitepaper.pdf"
