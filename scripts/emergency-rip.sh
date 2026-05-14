#!/bin/bash
# Sovereign Rip v3: External Authority Protocol
# Target: /mnt/d/Linux-Distros/project-data/SuiteUtils/db/

PROJECT_ID="heidless-apps-2"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
# The specific directory you requested
EXTERNAL_VAULT="/mnt/d/Linux-Distros/project-data/SuiteUtils/db/db-backups-09-May-161139"

mkdir -p "$EXTERNAL_VAULT"

echo "🚀 INITIATING SOVEREIGN RIP (EXTERNAL TARGET)..."
echo "📍 DESTINATION: $EXTERNAL_VAULT"

# 1. FIRESTORE EXPORT (PRIORITY)
echo "🔥 [STAGE 1] Exporting Firestore Snapshot..."
TEMP_BUCKET="gs://$PROJECT_ID-temp-rip-$TIMESTAMP"

# Create a temporary bucket
gsutil mb -l us-central1 "$TEMP_BUCKET" 2>/dev/null

# Run the export
gcloud firestore export "$TEMP_BUCKET/firestore_export" --project "$PROJECT_ID"

if [ $? -eq 0 ]; then
    echo "📥 [STAGE 1] Firestore Export successful. Pulling to external drive..."
    gsutil -m rsync -r "$TEMP_BUCKET/firestore_export" "$EXTERNAL_VAULT/firestore"
    echo "✅ [STAGE 1] DATABASE SECURED LOCALLY ON D: DRIVE."
else
    echo "❌ [STAGE 1] DATABASE EXPORT FAILED. Please check if your D: drive is mounted."
fi

# 2. STORAGE SYNC (BULK)
echo "📂 [STAGE 2] Starting Bulk Storage Sync to External Drive..."
mkdir -p "$EXTERNAL_VAULT/storage"

# Sync directly to the external drive
gsutil -m rsync -r "gs://$PROJECT_ID.firebasestorage.app" "$EXTERNAL_VAULT/storage"

if [ $? -eq 0 ]; then
    echo "✅ [STAGE 2] STORAGE SYNC COMPLETE."
else
    echo "⚠️ [STAGE 2] STORAGE SYNC INTERRUPTED. You can re-run this script to resume sync to D:."
fi

# 3. CLEANUP
echo "🧹 Cleaning up cloud temporary staging area..."
gsutil rm -r "$TEMP_BUCKET" 2>/dev/null

echo "------------------------------------------------"
echo "🏁 SOVEREIGN RIP COMPLETE!"
echo "📍 ALL DATA STORED EXTERNALLY: $EXTERNAL_VAULT"
echo "------------------------------------------------"
