#!/bin/bash
set -e

# Usage: ./dist.sh <platform> <arch>
# Example: ./dist.sh mac arm64 # The arguments are the same as electron-builder, without the --

PLATFORM="$1"
ARCH="$2"

if [ -z "$PLATFORM" ] || [ -z "$ARCH" ]; then
  echo "Usage: $0 <platform> <arch>"
  echo "Example: $0 mac arm64"
  exit 1
fi

# Map electron-builder platform/arch to tor-dist naming
case "$PLATFORM" in
  mac|darwin)
    TOR_PLATFORM="mac"
    ;;
  win|win32|windows)
    TOR_PLATFORM="windows"
    ;;
  linux)
    TOR_PLATFORM="linux"
    ;;
  *)
    echo "Unknown platform: $PLATFORM"
    exit 1
    ;;
esac

case "$ARCH" in
  arm|arm64)
    TOR_ARCH="arm"
    ;;
  x64|x86_64)
    TOR_ARCH="x86"
    ;;
  ia32|i686)
    TOR_ARCH="i686"
    ;;
  *)
    echo "Unknown arch: $ARCH"
    exit 1
    ;;
esac

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Clean prod-deps/tor-dist
echo -e "${BLUE}Cleaning prod-deps/tor-dist...${NC}"
rm -rf prod-deps/tor-dist

TOR_FOLDER_NAME="${TOR_PLATFORM}-${TOR_ARCH}"

# 2. Copy relevant tor dist folder from prod-deps-all
SRC="prod-deps-all/tor-dist/${TOR_FOLDER_NAME}"

DST="prod-deps/tor-dist"
mkdir -p $DST

echo -e "${YELLOW}Copying $SRC to $DST ...${NC}"
if [ ! -d "$SRC" ]; then
  echo -e "${RED}Error: Source tor dist not found: $SRC${NC}"
  exit 1
fi
cp -r "$SRC" "$DST"
echo -e "${GREEN}Copied tor dist folder.${NC}"

# Copy icon.png to prod-deps
echo -e "${YELLOW}Copying icon.png to prod-deps...${NC}"
cp build/icon.png prod-deps/icon.png
echo -e "${GREEN}Copied icon.png.${NC}"

# 3. Run npm run build
echo -e "${BLUE}Running npm run build...${NC}"
npm run build
echo -e "${GREEN}Build complete.${NC}"

# 4. Run electron-builder with platform and arch
echo -e "${BLUE}Running electron-builder for platform: $PLATFORM, arch: $ARCH ...${NC}"
npx electron-builder --${PLATFORM} --${ARCH}
echo -e "${GREEN}electron-builder finished.${NC}"
