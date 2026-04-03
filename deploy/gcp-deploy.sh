#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Warplane — Build, Push & Deploy to GCP Cloud Run
#
# Builds the Docker image, pushes to Artifact Registry, and deploys
# to Cloud Run with Cloud SQL sidecar.
#
# Usage:
#   bash deploy/gcp-deploy.sh              # deploy HEAD
#   bash deploy/gcp-deploy.sh v1.2.3       # deploy with explicit tag
# ---------------------------------------------------------------------------
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
PROJECT=${GCP_PROJECT:-warplane-prod}
REGION=${GCP_REGION:-us-central1}
REGISTRY=warplane
SERVICE=warplane
INSTANCE=warplane-db

TAG=${1:-$(git rev-parse --short HEAD)}
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REGISTRY}/api:${TAG}"

echo "==> Building Docker image: ${IMAGE}"
docker build -t "${IMAGE}" .

echo "==> Pushing to Artifact Registry"
docker push "${IMAGE}"

echo "==> Deploying to Cloud Run"
gcloud run deploy "${SERVICE}" \
  --project="${PROJECT}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --platform=managed \
  --execution-environment=gen2 \
  --cpu=1 \
  --memory=512Mi \
  --min-instances=0 \
  --max-instances=3 \
  --port=3000 \
  --set-env-vars="NODE_ENV=production,WARPLANE_LOG_LEVEL=info,DEMO_MODE=false,HOST=0.0.0.0,WARPLANE_CONFIG=/secrets/config/warplane.yaml" \
  --set-secrets="DATABASE_URL=database-url:latest" \
  --set-secrets="/secrets/config/warplane.yaml=warplane-config:latest" \
  --add-cloudsql-instances="${PROJECT}:${REGION}:${INSTANCE}" \
  --allow-unauthenticated

URL=$(gcloud run services describe "${SERVICE}" \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --format='value(status.url)')

echo ""
echo "==> Deployed!"
echo "  Image:   ${IMAGE}"
echo "  URL:     ${URL}"
echo "  Health:  ${URL}/healthz"
