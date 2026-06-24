#!/bin/bash
# 03-migrate-firestore.sh: Migrate all 10 Firestore databases from source to target project

set -e

# Unset environment project variables to prevent cross-account config leaks
unset GOOGLE_CLOUD_PROJECT
unset CLOUDSDK_CORE_PROJECT

# Normalize Firestore location IDs to compatible GCS bucket locations
normalize_gcs_location() {
    local LOC=$1
    LOC=$(echo "$LOC" | tr '[:upper:]' '[:lower:]')
    if [ "$LOC" == "nam5" ]; then
        echo "us"
    elif [ "$LOC" == "eur3" ]; then
        echo "eu"
    elif [ "$LOC" == "asia1" ]; then
        echo "asia"
    else
        echo "$LOC"
    fi
}

SRC_PROJECT="heidless-apps-2"
TGT_PROJECT="stillwater-sovereign-02"

DATABASES=(
    "autovideo-db-0"
    "prompttool-db-0"
    "promptresources-db-0"
    "promptmaster-spa-db-0"
    "promptaccreditation-db-0"
    "plantune-db-0"
    "suiteutils-db-0"
    "persona-db-0"
    "urlshortener-db-0"
    "tokenmarket-db-0"
    "inferencegateway-db-0"
)

echo "🔥 Stillwater Sovereign Firestore Databases Migration Tool"
echo "--------------------------------------------------------"
echo "📥 Source Project: $SRC_PROJECT"
echo "📤 Target Project: $TGT_PROJECT"
echo ""

# Verify gcloud credentials
echo "🔍 Checking gcloud authentication..."
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || true)
if [ -z "$ACTIVE_ACCOUNT" ]; then
    echo "❌ Error: No active gcloud account. Run 'gcloud auth login' first."
    exit 1
fi
echo "✅ Active account: $ACTIVE_ACCOUNT"
echo ""

# 1. Ensure target databases exist (Needs to run under Target account context)
echo "👤 Switching active gcloud account to: heidlessemail19@gmail.com (Target)..."
gcloud config set account heidlessemail19@gmail.com
gcloud config set project "$TGT_PROJECT"

echo "🛠️  Checking/Creating named databases in target project $TGT_PROJECT..."
EXISTING_DBS=$(gcloud firestore databases list --project="$TGT_PROJECT" --format="value(name)" 2>/dev/null || true)

for DB in "${DATABASES[@]}"; do
    if echo "$EXISTING_DBS" | grep -q "$DB"; then
        echo "   ✅ Target database '$DB' already exists."
    else
        echo "   🆕 Database '$DB' does not exist in target. Creating..."
        gcloud firestore databases create \
            --database="$DB" \
            --location="us-central1" \
            --type="firestore-native" \
            --project="$TGT_PROJECT"
        echo "   ✅ Created database '$DB'"
    fi
done
echo ""

# 2. Iterate and migrate databases
for DB in "${DATABASES[@]}"; do
    echo "========================================================"
    echo "🚀 Migrating database: $DB"
    echo "========================================================"

    TIMESTAMP=$(date +%s)
    # Staging bucket names must be lowercase, numbers, and hyphens only (no underscores)
    TEMP_SRC_BUCKET="sovereign-mig-src-${DB//_/-}-${TIMESTAMP}"
    TEMP_TGT_BUCKET="sovereign-mig-tgt-${DB//_/-}-${TIMESTAMP}"
    
    LOCAL_BUFFER="./temp_firestore_sync/$DB"
    SRC_EXPORT_PATH="gs://$TEMP_SRC_BUCKET/export"
    TGT_IMPORT_PATH="gs://$TEMP_TGT_BUCKET/export"

    # A. Export from Source Project (Needs Source account context)
    echo "👤 Switching active gcloud account to: heidlessemail19@gmail.com (Source)..."
    gcloud config set account heidlessemail19@gmail.com
    gcloud config set project "$SRC_PROJECT"

    # Dynamically resolve source database location and create matching staging bucket
    SRC_LOC=$(gcloud firestore databases describe --database="$DB" --project="$SRC_PROJECT" --format="value(locationId)")
    echo "📍 Source database '$DB' is located in: $SRC_LOC"
    SRC_BUCKET_LOC=$(normalize_gcs_location "$SRC_LOC")
    echo "🛠️  Creating source staging bucket gs://$TEMP_SRC_BUCKET in $SRC_BUCKET_LOC..."
    gcloud storage buckets create "gs://$TEMP_SRC_BUCKET" --location="$SRC_BUCKET_LOC" --project="$SRC_PROJECT"

    echo "📥 Exporting '$DB' to source bucket temporary directory..."
    gcloud firestore export "$SRC_EXPORT_PATH" \
        --database="$DB" \
        --project="$SRC_PROJECT"

    echo "📥 Downloading export folder to local buffer..."
    mkdir -p "$LOCAL_BUFFER"
    gcloud storage rsync -r "$SRC_EXPORT_PATH" "$LOCAL_BUFFER"

    echo "🧹 Cleaning up staging bucket in source project..."
    gcloud storage rm --recursive "gs://$TEMP_SRC_BUCKET/**" --quiet 2>/dev/null || true
    gcloud storage buckets delete "gs://$TEMP_SRC_BUCKET" --quiet

    # B. Import to Target Project (Needs Target account context)
    echo "👤 Switching active gcloud account to: heidlessemail19@gmail.com (Target)..."
    gcloud config set account heidlessemail19@gmail.com
    gcloud config set project "$TGT_PROJECT"

    # Dynamically resolve target database location and create matching staging bucket
    TGT_LOC=$(gcloud firestore databases describe --database="$DB" --project="$TGT_PROJECT" --format="value(locationId)")
    echo "📍 Target database '$DB' is located in: $TGT_LOC"
    TGT_BUCKET_LOC=$(normalize_gcs_location "$TGT_LOC")
    echo "🛠️  Creating target staging bucket gs://$TEMP_TGT_BUCKET in $TGT_BUCKET_LOC..."
    gcloud storage buckets create "gs://$TEMP_TGT_BUCKET" --location="$TGT_BUCKET_LOC" --project="$TGT_PROJECT"

    echo "📤 Uploading export folder from local buffer to target bucket..."
    gcloud storage rsync -r "$LOCAL_BUFFER" "$TGT_IMPORT_PATH"

    echo "📤 Importing data into '$DB'..."
    gcloud firestore import "$TGT_IMPORT_PATH" \
        --database="$DB" \
        --project="$TGT_PROJECT"

    echo "🧹 Cleaning up staging bucket in target project & local buffer..."
    gcloud storage rm --recursive "gs://$TEMP_TGT_BUCKET/**" --quiet 2>/dev/null || true
    gcloud storage buckets delete "gs://$TEMP_TGT_BUCKET" --quiet
    rm -rf "$LOCAL_BUFFER"
    echo "✅ Migration completed for '$DB'."
    echo ""
done

# Clean up top-level local directory
rm -rf ./temp_firestore_sync

echo "🎉 All 10 Firestore databases migrated successfully!"
echo "✨ Complete!"
