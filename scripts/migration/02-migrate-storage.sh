#!/bin/bash
# 02-migrate-storage.sh: Mirror assets from source bucket to target bucket

set -e

# Unset environment project variables to prevent cross-account config leaks
unset GOOGLE_CLOUD_PROJECT
unset CLOUDSDK_CORE_PROJECT

SRC_BUCKET="stillwater-sovereign-01.firebasestorage.app"
TGT_BUCKET="stillwater-sovereign-02.firebasestorage.app"

echo "📦 Stillwater Sovereign Cloud Storage Migration Tool"
echo "--------------------------------------------------------"
echo "📥 Source Bucket: gs://$SRC_BUCKET"
echo "📤 Target Bucket: gs://$TGT_BUCKET"
echo ""

# Confirm user is authenticated in gcloud
echo "🔍 Checking gcloud authentication..."
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || true)
if [ -z "$ACTIVE_ACCOUNT" ]; then
    echo "❌ Error: No active gcloud account. Please run 'gcloud auth login' first."
    exit 1
fi
echo "✅ Logged in as: $ACTIVE_ACCOUNT"
echo ""

read -p "⚠️  Are you ready to sync all assets? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[yY]$ ]]; then
    echo "❌ Migration cancelled."
    exit 0
fi

echo "🚀 Starting Local-Buffered Storage Sync (Bypassing IAM Sharing)..."

# Step 1: Pull from Source Bucket
echo "👤 Switching active gcloud account to: heidlessemail21@gmail.com (Source)..."
gcloud config set account heidlessemail21@gmail.com
gcloud config set project stillwater-sovereign-01

echo "📥 Pulling files from source bucket to local buffer..."
mkdir -p ./temp_storage_sync
gcloud storage rsync -r "gs://$SRC_BUCKET" ./temp_storage_sync

# Step 2: Push to Target Bucket
echo "👤 Switching active gcloud account to: heidlessemail19@gmail.com (Target)..."
gcloud config set account heidlessemail19@gmail.com
gcloud config set project stillwater-sovereign-02

echo "📤 Pushing files from local buffer to target bucket..."
gcloud storage rsync -r ./temp_storage_sync "gs://$TGT_BUCKET"

# Clean up
echo "🧹 Cleaning up local buffer..."
rm -rf ./temp_storage_sync

echo ""
echo "🎉 Cloud Storage assets mirrored successfully!"
echo "✨ Complete!"
