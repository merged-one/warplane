#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Warplane — GCP Infrastructure Setup
#
# One-time script to create the GCP project, Cloud SQL instance,
# Artifact Registry, and Secret Manager secrets.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - A GCP billing account linked
#
# Usage:
#   export GCP_BILLING_ACCOUNT=01XXXX-XXXXXX-XXXXXX
#   export POSTGRES_PASSWORD=<strong-password>
#   bash deploy/gcp-setup.sh
# ---------------------------------------------------------------------------
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
PROJECT=${GCP_PROJECT:-warplane-prod}
REGION=${GCP_REGION:-us-central1}
BILLING=${GCP_BILLING_ACCOUNT:?Set GCP_BILLING_ACCOUNT}
PG_PASS=${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}

INSTANCE=warplane-db
REGISTRY=warplane
DB_NAME=warplane
SERVICE=warplane

echo "==> Creating GCP project: ${PROJECT}"
gcloud projects create "${PROJECT}" --name="Warplane" 2>/dev/null || true
gcloud config set project "${PROJECT}"
gcloud billing projects link "${PROJECT}" --billing-account="${BILLING}"

echo "==> Enabling APIs"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com

echo "==> Creating Artifact Registry repository"
gcloud artifacts repositories create "${REGISTRY}" \
  --repository-format=docker \
  --location="${REGION}" \
  --description="Warplane container images" \
  2>/dev/null || true
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

echo "==> Creating Cloud SQL Postgres instance (db-f1-micro)"
gcloud sql instances create "${INSTANCE}" \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region="${REGION}" \
  --storage-size=10 \
  --storage-type=HDD \
  --no-assign-ip \
  2>/dev/null || echo "  (instance already exists)"

echo "==> Creating database and setting password"
gcloud sql databases create "${DB_NAME}" --instance="${INSTANCE}" 2>/dev/null || true
gcloud sql users set-password postgres --instance="${INSTANCE}" --password="${PG_PASS}"

echo "==> Creating secrets"
CONNECTION_STRING="postgresql://postgres:${PG_PASS}@/${DB_NAME}?host=/cloudsql/${PROJECT}:${REGION}:${INSTANCE}"

echo -n "${CONNECTION_STRING}" | \
  gcloud secrets create database-url --data-file=- 2>/dev/null || \
  echo -n "${CONNECTION_STRING}" | \
  gcloud secrets versions add database-url --data-file=-

# Config secret (from fuji-example.yaml as starting point)
if gcloud secrets describe warplane-config &>/dev/null; then
  echo "  warplane-config secret already exists"
else
  gcloud secrets create warplane-config --data-file=config/fuji-example.yaml
fi

echo ""
echo "==> Infrastructure ready!"
echo ""
echo "  Project:    ${PROJECT}"
echo "  Region:     ${REGION}"
echo "  Instance:   ${INSTANCE}"
echo "  Registry:   ${REGION}-docker.pkg.dev/${PROJECT}/${REGISTRY}"
echo ""
echo "  Next: run deploy/gcp-deploy.sh to build and deploy"
