#!/usr/bin/env bash
set -euo pipefail

if [[ "${#}" -ne 2 ]]; then
  echo "Usage: $0 <ENVIRONMENT> <IMAGE_TAG>" >&2
  echo "ENVIRONMENT must be: dev | staging | prod" >&2
  exit 1
fi

ENVIRONMENT="$1"
IMAGE_TAG="$2"

if [[ "${ENVIRONMENT}" != "dev" && "${ENVIRONMENT}" != "staging" && "${ENVIRONMENT}" != "prod" ]]; then
  echo "Invalid ENVIRONMENT: ${ENVIRONMENT} (expected dev, staging, or prod)" >&2
  exit 1
fi

if [[ "${ENVIRONMENT}" == "prod" && "${CONFIRM_PROD_DEPLOY:-}" != "yes" ]]; then
  echo "Refusing prod deploy: set CONFIRM_PROD_DEPLOY=yes to continue." >&2
  exit 1
fi

if [[ -z "${API_GATEWAY_URL:-}" ]]; then
  echo "API_GATEWAY_URL must be set for post-deploy health checks (e.g. https://api.example.com)." >&2
  exit 1
fi

SERVICES=(
  api-gateway
  auth-service
  user-service
  project-service
  ai-service
  rag-service
  billing-service
  notification-service
  analytics-service
)

NS="user-services"

for svc in "${SERVICES[@]}"; do
  chart="./infra/helm/charts/${svc}"
  if [[ ! -d "${chart}" ]]; then
    echo "✗ Helm chart not found: ${chart}" >&2
    exit 1
  fi

  values_files=(--values "${chart}/values.yaml")
  env_values="${chart}/values.${ENVIRONMENT}.yaml"
  if [[ -f "${env_values}" ]]; then
    values_files+=(--values "${env_values}")
  fi

  echo "→ helm upgrade --install ${svc} (${ENVIRONMENT})…"
  if ! helm upgrade --install "${svc}" "${chart}" \
    --namespace "${NS}" \
    --set "image.tag=${IMAGE_TAG}" \
    --set "global.env=${ENVIRONMENT}" \
    "${values_files[@]}" \
    --wait \
    --timeout 5m0s \
    --atomic; then
    echo "✗ Helm deploy failed for ${svc}" >&2
    exit 1
  fi
  echo "✓ ${svc} deployed"
done

echo "Waiting 30s for workloads to settle before health check…"
sleep 30

# api-gateway mounts the sub-app at /health with route GET /health → /health/health
health_url="${API_GATEWAY_URL%/}/health/health"
echo "→ curl --fail ${health_url}"
if ! curl --fail --silent --show-error "${health_url}"; then
  echo "" >&2
  echo "✗ Post-deploy health check failed for ${health_url}" >&2
  echo "  Run: helm history ${SERVICES[0]} --namespace ${NS}" >&2
  echo "  Rollback example: helm rollback ${SERVICES[0]} --namespace ${NS}" >&2
  exit 1
fi

echo ""
echo "✓ All services deployed successfully to ${ENVIRONMENT}."
