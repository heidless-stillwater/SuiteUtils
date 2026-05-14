#!/bin/bash
# Sovereign Rip v5: Location-Compliant Protocol
# Targets us-central1 to satisfy Firestore export constraints.

PROJECT_ID="heidless-apps-2"
TARGET_DIR="/mnt/d/Linux-Distros/project-data/SuiteUtils/db"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SNAPSHOT_NAME="suite-snapshot-$TIMESTAMP"
EXPORT_DIR="$TARGET_DIR/$SNAPSHOT_NAME"

# Location-Compliant Bucket (No dots, no underscores, in us-central1)
TEMP_BUCKET_NAME="heidless-rip-central-$TIMESTAMP"
TEMP_BUCKET="gs://$TEMP_BUCKET_NAME"

mkdir -p "$EXPORT_DIR"

echo "🚀 INITIATING LOCATION-COMPLIANT DB EXPORT..."
echo "📍 DESTINATION: $EXPORT_DIR"
echo "☁️ STAGING BUCKET (us-central1): $TEMP_BUCKET"

# 1. Create the compliant bucket
echo "🛠️ Creating temporary staging bucket in us-central1..."
gsutil mb -l us-central1 "$TEMP_BUCKET"

if [ $? -ne 0 ]; then
    echo "❌ FAILED to create bucket. Trying alternative name..."
    TEMP_BUCKET_NAME="sovereign-rip-$(date +%s)"
    TEMP_BUCKET="gs://$TEMP_BUCKET_NAME"
    gsutil mb -l us-central1 "$TEMP_BUCKET"
fi

# 2. Get the list of active databases
DBS=$(gcloud firestore databases list --project "$PROJECT_ID" --format="value(name)" | awk -F/ '{print $NF}')

for DB in $DBS; do
    echo "🔥 Exporting database: $DB..."
    SAFE_DB_NAME=$(echo "$DB" | sed 's/(default)/default/')
    
    # Run the export
    gcloud firestore export "$TEMP_BUCKET/$SAFE_DB_NAME" --project "$PROJECT_ID" --database "$DB"
    
    if [ $? -eq 0 ]; then
        echo "📥 Pulling $DB export to external drive..."
        gsutil -m rsync -r "$TEMP_BUCKET/$SAFE_DB_NAME" "$EXPORT_DIR/$SAFE_DB_NAME"
        echo "✅ $DB Secured."
    else
        echo "⚠️ WARNING: Export failed for $DB."
    fi
done

# 3. Cleanup Staging
echo "🧹 Cleaning up temporary staging bucket..."
gsutil rm -r "$TEMP_BUCKET"

echo "------------------------------------------------"
echo "🏁 SOVEREIGN DB SNAPSHOT COMPLETE!"
echo "📍 LOCATION: $EXPORT_DIR"
echo "------------------------------------------------"
