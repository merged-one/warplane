#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Warplane — Map custom domain (warplane.io) to Cloud Run
#
# Prerequisites:
#   - Cloud Run service already deployed (run gcp-deploy.sh first)
#   - Domain ownership verified in Google Search Console
#
# Usage:
#   bash deploy/gcp-domain.sh                    # map warplane.io
#   DOMAIN=staging.warplane.io bash deploy/gcp-domain.sh
# ---------------------------------------------------------------------------
set -euo pipefail

PROJECT=${GCP_PROJECT:-warplane-prod}
REGION=${GCP_REGION:-us-central1}
SERVICE=warplane
DOMAIN=${DOMAIN:-warplane.io}

echo "==> Creating domain mapping: ${DOMAIN} -> ${SERVICE}"
gcloud run domain-mappings create \
  --project="${PROJECT}" \
  --service="${SERVICE}" \
  --domain="${DOMAIN}" \
  --region="${REGION}" \
  2>/dev/null || echo "  (mapping already exists)"

echo ""
echo "==> DNS records required:"
gcloud run domain-mappings describe \
  --project="${PROJECT}" \
  --domain="${DOMAIN}" \
  --region="${REGION}" \
  --format='table(resourceRecords.type, resourceRecords.rrdata)'

echo ""
echo "Add the above records to your DNS provider."
echo "SSL certificate will be provisioned automatically once DNS propagates."
