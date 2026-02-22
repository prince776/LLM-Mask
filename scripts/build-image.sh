#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/build-image.sh local
#   ./scripts/build-image.sh prod ghcr.io/acme/llmmask-server v1.2.3
#
# Optional env vars (prod):
#   BUILD_PLATFORM=linux/amd64
#   BUILD_CACHE_REF=<repo/image>:buildcache
#   SKIP_IF_EXISTS=1

MODE="${1:-local}"

if [[ ! -d resources ]]; then
  echo "Creating empty resources/ directory for image build context."
  mkdir -p resources
fi

if [[ "$MODE" == "local" ]]; then
  IMAGE="${IMAGE:-llmmask-server:local}"
  echo "Building local image: $IMAGE"
  docker build -t "$IMAGE" .
  exit 0
fi

if [[ "$MODE" == "prod" ]]; then
  REPO="${2:-}"
  TAG="${3:-}"
  if [[ -z "$REPO" || -z "$TAG" ]]; then
    echo "Usage: ./scripts/build-image.sh prod <repo/image> <tag>"
    echo "Example: ./scripts/build-image.sh prod ghcr.io/acme/llmmask-server v1.2.3"
    exit 1
  fi

  IMAGE="$REPO:$TAG"
  BUILD_PLATFORM="${BUILD_PLATFORM:-linux/amd64}"
  BUILD_CACHE_REF="${BUILD_CACHE_REF:-$REPO:buildcache}"
  ACTIVE_BUILDER="${BUILDX_BUILDER:-}"

  if [[ -n "$ACTIVE_BUILDER" ]]; then
    BUILDER_DRIVER="$(docker buildx inspect "$ACTIVE_BUILDER" 2>/dev/null | awk '/Driver:/ {print $2; exit}' || true)"
  else
    BUILDER_DRIVER="$(docker buildx inspect 2>/dev/null | awk '/Driver:/ {print $2; exit}' || true)"
  fi

  if [[ "${SKIP_IF_EXISTS:-1}" == "1" ]] && docker buildx imagetools inspect "$IMAGE" >/dev/null 2>&1; then
    echo "Image already exists, skipping build: $IMAGE"
    exit 0
  fi

  echo "Building and pushing prod image: $IMAGE"
  declare -a BUILD_ARGS
  BUILD_ARGS=(--platform "$BUILD_PLATFORM" -t "$IMAGE" --push .)

  if [[ -z "$BUILDER_DRIVER" || "$BUILDER_DRIVER" == "docker" ]]; then
    echo "Buildx driver is 'docker'; skipping registry cache export/import."
  else
    BUILD_ARGS=(
      --platform "$BUILD_PLATFORM"
      --cache-from "type=registry,ref=$BUILD_CACHE_REF"
      --cache-to "type=registry,ref=$BUILD_CACHE_REF,mode=max"
      -t "$IMAGE"
      --push
      .
    )
  fi

  if [[ -n "$ACTIVE_BUILDER" ]]; then
    docker buildx build --builder "$ACTIVE_BUILDER" "${BUILD_ARGS[@]}"
  else
    docker buildx build "${BUILD_ARGS[@]}"
  fi
  exit 0
fi

echo "Unknown mode: $MODE"
echo "Usage:"
echo "  ./scripts/build-image.sh local"
echo "  ./scripts/build-image.sh prod <repo/image> <tag>"
exit 1
