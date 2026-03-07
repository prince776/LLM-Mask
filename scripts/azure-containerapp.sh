#!/usr/bin/env bash
set -euo pipefail

# AZ_RG=llmtorprod AZ_LOCATION=westus2 AZ_ACR_NAME=llmtoracr ./scripts/azure-containerapp.sh deploy

# Usage:
#   ./scripts/azure-containerapp.sh deploy
#   ./scripts/azure-containerapp.sh redeploy
#   ./scripts/azure-containerapp.sh env-only
#
# Required env vars:
#   none (expects you already ran `az login`)
#   AZ_ACR_NAME is required
#
# Optional env vars:
#   ENV_FILE=.env (local file to load; set LOAD_ENV_FILE=0 to disable)
#   AZ_RG=llmmask-rg
#   AZ_LOCATION=eastus (used for Container Apps environment)
#   AZ_RG_LOCATION=eastus (only used when creating a new resource group)
#   AZ_ACR_LOCATION=eastus (only used when creating a new ACR)
#   AZ_ACR_NAME=<must be globally unique, lower-case>
#   AZ_CA_ENV_NAME=llmmask-env
#   AZ_CA_APP_NAME=llmmask
#   AZ_IMAGE_REPO=llmmask-server
#   AZ_IMAGE_TAG=v1 (defaults to UTC timestamp)

ACTION="${1:-}"
if [[ "$ACTION" != "deploy" && "$ACTION" != "redeploy" && "$ACTION" != "env-only" ]]; then
  echo "Usage: ./scripts/azure-containerapp.sh <deploy|redeploy|env-only>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

trim_whitespace() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

strip_wrapping_quotes() {
  local s="$1"
  if [[ "${#s}" -ge 2 ]]; then
    if [[ "${s:0:1}" == "\"" && "${s: -1}" == "\"" ]]; then
      printf '%s' "${s:1:${#s}-2}"
      return
    fi
    if [[ "${s:0:1}" == "'" && "${s: -1}" == "'" ]]; then
      printf '%s' "${s:1:${#s}-2}"
      return
    fi
  fi
  printf '%s' "$s"
}

declare -a FILE_ENV_ORDER

load_env_file() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0

  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line//$'\r'/}"
    line="$(trim_whitespace "$line")"
    [[ -z "$line" ]] && continue
    [[ "${line:0:1}" == "#" ]] && continue

    if [[ "$line" == export\ * ]]; then
      line="${line#export }"
      line="$(trim_whitespace "$line")"
    fi

    [[ "$line" == *"="* ]] || continue

    local key="${line%%=*}"
    key="$(trim_whitespace "$key")"

    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

    FILE_ENV_ORDER+=("$key")
  done < "$env_file"
}

env_or_file_or_default() {
  local key="$1"
  local def="${2:-}"
  if [[ -n "${!key:-}" ]]; then
    printf '%s' "${!key}"
    return
  fi
  printf '%s' "$def"
}

is_reserved_env_key() {
  local key="$1"
  case "$key" in
    ENV_FILE|LOAD_ENV_FILE|AZ_*|ACTIVE_SUBSCRIPTION_ID|ACTIVE_SUBSCRIPTION_NAME|IMAGE_REF|ACR_LOGIN_SERVER|ACR_USER|ACR_PASS|PROD_CREDENTIALS_CONFIG|PROD_CREDENTIALS_CONFIG_FILE|BUILD_PLATFORM|BUILD_CACHE_REF|SKIP_IF_EXISTS)
      return 0
      ;;
  esac
  return 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd az
require_cmd docker
az extension add --name containerapp --upgrade >/dev/null

ENV_FILE="${ENV_FILE:-.env}"
LOAD_ENV_FILE="${LOAD_ENV_FILE:-1}"
if [[ "$LOAD_ENV_FILE" == "1" ]]; then
  if [[ ! -f "$ENV_FILE" && -f "$REPO_ROOT/$ENV_FILE" ]]; then
    ENV_FILE="$REPO_ROOT/$ENV_FILE"
  fi
  load_env_file "$ENV_FILE"
  if [[ ${#FILE_ENV_ORDER[@]} -gt 0 ]]; then
    echo "Loaded env file: $ENV_FILE"
    if [[ "${DEBUG_ENV_LOAD:-0}" == "1" ]]; then
      echo "Loaded keys from env file:"
      for key in "${FILE_ENV_ORDER[@]}"; do
        echo "  - $key"
      done
    fi
  fi
fi

ACTIVE_SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
ACTIVE_SUBSCRIPTION_NAME="$(az account show --query name -o tsv)"
echo "Using subscription: $ACTIVE_SUBSCRIPTION_NAME ($ACTIVE_SUBSCRIPTION_ID)"

ensure_provider_registered() {
  local provider="$1"
  local state
  state="$(az provider show -n "$provider" --query registrationState -o tsv 2>/dev/null || true)"
  if [[ "$state" != "Registered" ]]; then
    echo "Registering provider: $provider"
    az provider register -n "$provider" --wait >/dev/null
  fi
}

ensure_provider_registered "Microsoft.App"
ensure_provider_registered "Microsoft.OperationalInsights"
ensure_provider_registered "Microsoft.ContainerRegistry"

AZ_RG="$(env_or_file_or_default AZ_RG llmmask-rg)"
AZ_LOCATION="$(env_or_file_or_default AZ_LOCATION eastus)"
AZ_RG_LOCATION="$(env_or_file_or_default AZ_RG_LOCATION "$AZ_LOCATION")"
AZ_ACR_LOCATION="$(env_or_file_or_default AZ_ACR_LOCATION "$AZ_LOCATION")"
AZ_ACR_NAME="$(env_or_file_or_default AZ_ACR_NAME "")"
AZ_CA_ENV_NAME="$(env_or_file_or_default AZ_CA_ENV_NAME llmmask-env)"
AZ_CA_APP_NAME="$(env_or_file_or_default AZ_CA_APP_NAME llmmask)"
AZ_IMAGE_REPO="$(env_or_file_or_default AZ_IMAGE_REPO llmmask-server)"
AZ_IMAGE_TAG="$(env_or_file_or_default AZ_IMAGE_TAG "$(date -u +%Y%m%d%H%M%S)")"

if [[ -z "${AZ_ACR_NAME}" ]]; then
  echo "AZ_ACR_NAME is required (must be globally unique in Azure)."
  exit 1
fi

PROD_CREDENTIALS_CONFIG="$(env_or_file_or_default PROD_CREDENTIALS_CONFIG "${PROD_CREDENTIALS_CONFIG:-}")"
PROD_CREDENTIALS_CONFIG_FILE="$(env_or_file_or_default PROD_CREDENTIALS_CONFIG_FILE "${PROD_CREDENTIALS_CONFIG_FILE:-}")"

if [[ -z "${PROD_CREDENTIALS_CONFIG:-}" && -n "${PROD_CREDENTIALS_CONFIG_FILE:-}" ]]; then
  if [[ ! -f "$PROD_CREDENTIALS_CONFIG_FILE" ]]; then
    echo "PROD_CREDENTIALS_CONFIG_FILE not found: $PROD_CREDENTIALS_CONFIG_FILE"
    exit 1
  fi
  PROD_CREDENTIALS_CONFIG="$(cat "$PROD_CREDENTIALS_CONFIG_FILE")"
fi

if [[ -n "${PROD_CREDENTIALS_CONFIG:-}" ]]; then
  PROD_CREDENTIALS_CONFIG="$(printf '%s' "$PROD_CREDENTIALS_CONFIG" | tr -d '\n\r')"
fi

echo "Ensuring resource group..."
if az group show -n "$AZ_RG" >/dev/null 2>&1; then
  EXISTING_RG_LOCATION="$(az group show -n "$AZ_RG" --query location -o tsv)"
  echo "Using existing resource group: $AZ_RG ($EXISTING_RG_LOCATION)"
else
  echo "Creating resource group: $AZ_RG ($AZ_RG_LOCATION)"
  az group create -n "$AZ_RG" -l "$AZ_RG_LOCATION" >/dev/null
fi

echo "Ensuring ACR..."
if az acr show -n "$AZ_ACR_NAME" -g "$AZ_RG" >/dev/null 2>&1; then
  EXISTING_ACR_LOCATION="$(az acr show -n "$AZ_ACR_NAME" -g "$AZ_RG" --query location -o tsv)"
  echo "Using existing ACR: $AZ_ACR_NAME ($EXISTING_ACR_LOCATION)"
else
  echo "Creating ACR: $AZ_ACR_NAME ($AZ_ACR_LOCATION)"
  az acr create -n "$AZ_ACR_NAME" -g "$AZ_RG" --sku Basic -l "$AZ_ACR_LOCATION" >/dev/null
fi
az acr update -n "$AZ_ACR_NAME" --admin-enabled true >/dev/null

ACR_LOGIN_SERVER="$(az acr show -n "$AZ_ACR_NAME" --query loginServer -o tsv)"
ACR_USER="$(az acr credential show -n "$AZ_ACR_NAME" --query username -o tsv)"
ACR_PASS="$(az acr credential show -n "$AZ_ACR_NAME" --query 'passwords[0].value' -o tsv)"
IMAGE_REF="$ACR_LOGIN_SERVER/$AZ_IMAGE_REPO:$AZ_IMAGE_TAG"

echo "Logging Docker into ACR..."
if [[ "$ACTION" != "env-only" ]]; then
  if ACR_ACCESS_TOKEN="$(az acr login -n "$AZ_ACR_NAME" --expose-token --query accessToken -o tsv 2>/dev/null)"; then
    if ! printf '%s' "$ACR_ACCESS_TOKEN" | docker login "$ACR_LOGIN_SERVER" \
      --username "00000000-0000-0000-0000-000000000000" \
      --password-stdin >/dev/null; then
      echo "Docker login to ACR failed using access token."
      exit 1
    fi
  else
    echo "Token-based ACR login unavailable; falling back to az acr login."
    az acr login -n "$AZ_ACR_NAME" >/dev/null
  fi
fi

BUILD_PLATFORM="$(env_or_file_or_default BUILD_PLATFORM "${BUILD_PLATFORM:-}")"
BUILD_CACHE_REF="$(env_or_file_or_default BUILD_CACHE_REF "${BUILD_CACHE_REF:-}")"
SKIP_IF_EXISTS="$(env_or_file_or_default SKIP_IF_EXISTS "${SKIP_IF_EXISTS:-}")"
if [[ -n "${BUILD_PLATFORM:-}" ]]; then export BUILD_PLATFORM; fi
if [[ -n "${BUILD_CACHE_REF:-}" ]]; then export BUILD_CACHE_REF; fi
if [[ -n "${SKIP_IF_EXISTS:-}" ]]; then export SKIP_IF_EXISTS; fi
if [[ "$ACTION" != "env-only" ]]; then
  echo "Building and pushing image: $IMAGE_REF"
  ./scripts/build-image.sh prod "$ACR_LOGIN_SERVER/$AZ_IMAGE_REPO" "$AZ_IMAGE_TAG"
fi

declare -a APP_ENV_ARGS
APP_ENV_ARGS=("DEPLOYMENT=PROD")
if [[ -n "${PROD_CREDENTIALS_CONFIG:-}" ]]; then
  APP_ENV_ARGS+=("PROD_CREDENTIALS_CONFIG=$PROD_CREDENTIALS_CONFIG")
fi
for key in "${FILE_ENV_ORDER[@]}"; do
  is_reserved_env_key "$key" && continue
  value="${!key:-}"
  APP_ENV_ARGS+=("$key=$value")
done

if [[ "$ACTION" == "deploy" ]]; then
  echo "Ensuring Container Apps environment..."
  if az containerapp env show -n "$AZ_CA_ENV_NAME" -g "$AZ_RG" >/dev/null 2>&1; then
    EXISTING_CA_ENV_LOCATION="$(az containerapp env show -n "$AZ_CA_ENV_NAME" -g "$AZ_RG" --query location -o tsv)"
    echo "Using existing Container Apps env: $AZ_CA_ENV_NAME ($EXISTING_CA_ENV_LOCATION)"
  else
    echo "Creating Container Apps env: $AZ_CA_ENV_NAME ($AZ_LOCATION)"
    if ! az containerapp env create -n "$AZ_CA_ENV_NAME" -g "$AZ_RG" -l "$AZ_LOCATION" >/dev/null; then
      echo "First environment creation attempt failed; waiting for provider registration propagation and retrying once..."
      sleep 20
      az containerapp env create -n "$AZ_CA_ENV_NAME" -g "$AZ_RG" -l "$AZ_LOCATION" >/dev/null
    fi
  fi

  if az containerapp show -n "$AZ_CA_APP_NAME" -g "$AZ_RG" >/dev/null 2>&1; then
    echo "Container app exists. Updating image..."
    az containerapp update -n "$AZ_CA_APP_NAME" -g "$AZ_RG" --image "$IMAGE_REF" >/dev/null
  else
    echo "Creating container app..."
    az containerapp create \
      -n "$AZ_CA_APP_NAME" \
      -g "$AZ_RG" \
      --environment "$AZ_CA_ENV_NAME" \
      --image "$IMAGE_REF" \
      --target-port 8080 \
      --ingress external \
      --registry-server "$ACR_LOGIN_SERVER" \
      --registry-username "$ACR_USER" \
      --registry-password "$ACR_PASS" \
      --cpu 2 \
      --memory 4Gi \
      --min-replicas 1 \
      --max-replicas 1 \
      --env-vars \
      "${APP_ENV_ARGS[@]}" >/dev/null
  fi
elif [[ "$ACTION" == "redeploy" ]]; then
  echo "Redeploying existing container app..."
  az containerapp update -n "$AZ_CA_APP_NAME" -g "$AZ_RG" --image "$IMAGE_REF" >/dev/null
else
  echo "Updating env vars only for existing container app..."
  if ! az containerapp show -n "$AZ_CA_APP_NAME" -g "$AZ_RG" >/dev/null 2>&1; then
    echo "Container app not found: $AZ_CA_APP_NAME in resource group $AZ_RG"
    exit 1
  fi
fi

echo "Updating runtime env vars and resource settings..."
az containerapp update \
  -n "$AZ_CA_APP_NAME" \
  -g "$AZ_RG" \
  --cpu 1.5 \
  --memory 3Gi \
  --min-replicas 1 \
  --max-replicas 1 \
  --set-env-vars \
  "${APP_ENV_ARGS[@]}" >/dev/null

echo "Done."
