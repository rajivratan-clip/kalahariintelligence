#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Deploy frontend + backend (single container) to Azure Container Apps
# Prerequisites: Azure CLI (az), logged in (az login)
# Usage:
#   ./scripts/azure-deploy.sh
#   CLICKHOUSE_HOST=my-db.example.com ./scripts/azure-deploy.sh
# -----------------------------------------------------------------------------
set -e

RESOURCE_GROUP="${RESOURCE_GROUP:-kalahari-rg}"
LOCATION="${LOCATION:-eastus}"
ACR_NAME="${ACR_NAME:-kalahariacr}"
APP_NAME="${APP_NAME:-kalahari-app}"
IMAGE_NAME="${IMAGE_NAME:-kalahari}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

CLICKHOUSE_HOST="${CLICKHOUSE_HOST:-}"
CLICKHOUSE_PORT="${CLICKHOUSE_PORT:-8123}"
CLICKHOUSE_USERNAME="${CLICKHOUSE_USERNAME:-default}"
CLICKHOUSE_PASSWORD="${CLICKHOUSE_PASSWORD:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Project root: $PROJECT_DIR"
echo "Resource group: $RESOURCE_GROUP"
echo "ACR: $ACR_NAME"
echo "App: $APP_NAME"
echo "---"

if ! command -v az &>/dev/null; then
  echo "Azure CLI (az) is required. Install: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
  exit 1
fi

az extension add --name containerapp --upgrade 2>/dev/null || true
az provider register --namespace Microsoft.App --wait 2>/dev/null || true
az provider register --namespace Microsoft.OperationalInsights --wait 2>/dev/null || true

echo "Creating resource group..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

echo "Creating Azure Container Registry..."
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true \
  --output none 2>/dev/null || true

echo "Building and pushing image..."
az acr build \
  --registry "$ACR_NAME" \
  --image "${IMAGE_NAME}:${IMAGE_TAG}" \
  --file "$PROJECT_DIR/Dockerfile" \
  "$PROJECT_DIR"

ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query loginServer -o tsv)
ACR_USER=$(az acr credential show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query username -o tsv)
ACR_PASS=$(az acr credential show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query "passwords[0].value" -o tsv)

WORKSPACE_NAME="${APP_NAME}-log"
echo "Creating Log Analytics workspace..."
az monitor log-analytics workspace create \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$WORKSPACE_NAME" \
  --location "$LOCATION" \
  --output none 2>/dev/null || true

WORKSPACE_ID=$(az monitor log-analytics workspace show --resource-group "$RESOURCE_GROUP" --workspace-name "$WORKSPACE_NAME" --query customerId -o tsv)
WORKSPACE_KEY=$(az monitor log-analytics workspace get-shared-keys --resource-group "$RESOURCE_GROUP" --workspace-name "$WORKSPACE_NAME" --query primarySharedKey -o tsv)

ENV_NAME="${APP_NAME}-env"
echo "Creating Container Apps environment..."
az containerapp env create \
  --name "$ENV_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --logs-workspace-id "$WORKSPACE_ID" \
  --logs-workspace-key "$WORKSPACE_KEY" \
  --output none 2>/dev/null || true

ENV_VARS=""
if [[ -n "$CLICKHOUSE_HOST" ]]; then
  ENV_VARS="CLICKHOUSE_HOST=$CLICKHOUSE_HOST CLICKHOUSE_PORT=$CLICKHOUSE_PORT CLICKHOUSE_USERNAME=$CLICKHOUSE_USERNAME CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD"
fi

FULL_IMAGE="${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}"
echo "Deploying Container App..."
if az containerapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  if [[ -n "$ENV_VARS" ]]; then
    az containerapp update \
      --name "$APP_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --image "$FULL_IMAGE" \
      --set-env-vars $ENV_VARS \
      --output none
  else
    az containerapp update \
      --name "$APP_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --image "$FULL_IMAGE" \
      --output none
  fi
else
  CREATE_OPTS=(
    --name "$APP_NAME"
    --resource-group "$RESOURCE_GROUP"
    --environment "$ENV_NAME"
    --image "$FULL_IMAGE"
    --registry-server "$ACR_LOGIN_SERVER"
    --registry-username "$ACR_USER"
    --registry-password "$ACR_PASS"
    --target-port 8000
    --ingress external
    --min-replicas 0
    --max-replicas 3
    --cpu 0.5
    --memory 1.0Gi
  )
  [[ -n "$ENV_VARS" ]] && CREATE_OPTS+=(--set-env-vars $ENV_VARS)
  az containerapp create "${CREATE_OPTS[@]}" --output none
fi

APP_URL=$(az containerapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)
echo ""
echo "---"
echo "Deployed. App URL: https://${APP_URL}"
echo "Set CLICKHOUSE_* env and re-run to connect to your database."
