#!/bin/bash
set -e

cd "$(dirname "$0")/desktop-client"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

mkdir -p release-artifacts

build_target() {
  local PLATFORM="$1"
  local ARCH="$2"
  local EXT="$3"
  local DST_NAME="$4"

  echo -e "\n${BLUE}==> Building $DST_NAME (${PLATFORM}/${ARCH})...${NC}"

  # Clear dist so glob finds only the new artifact
  rm -rf dist

  ./dist.sh "$PLATFORM" "$ARCH"

  ARTIFACT=$(find dist -maxdepth 2 -name "*.$EXT" | head -1)
  if [ -z "$ARTIFACT" ]; then
    echo -e "${RED}Error: no .$EXT artifact found in dist/ after build${NC}"
    exit 1
  fi

  cp "$ARTIFACT" "release-artifacts/$DST_NAME"
  echo -e "${GREEN}Saved: release-artifacts/$DST_NAME${NC}"
}

build_target mac  arm  dmg "llmtor-mac-arm.dmg"
build_target mac  x64  dmg "llmtor-mac-x64.dmg"
build_target win  x64  exe "llmtor-setup-win-x64.exe"
build_target win  ia32 exe "llmtor-setup-win-ia32.exe"

echo -e "\n${GREEN}All artifacts built:${NC}"
ls -lh release-artifacts/
