#!/bin/bash
# 04-deploy-monitor-indexes.sh: Deploy and monitor Firestore indexes across all databases

set -e

# Unset environment project variables to prevent cross-account config leaks
unset GOOGLE_CLOUD_PROJECT
unset CLOUDSDK_CORE_PROJECT

# Set active gcloud context for querying compilation status
gcloud config set account heidlessemail19@gmail.com
gcloud config set project stillwater-sovereign-02

PROJECTS_DIR="/home/heidless/projects"
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
)

echo "📊 Stillwater Sovereign Firestore Index Deployment & Monitoring Tool"
echo "--------------------------------------------------------"
echo "📤 Target Project: $TGT_PROJECT"
echo ""

# 1. Deploy indexes via workaround script
echo "🚀 Deploying Firestore indexes to target project..."
node "/home/heidless/projects/SuiteUtils/scripts/migration/deploy-indexes-workaround.cjs"

echo ""
echo "🔍 Monitoring index compilation status on target project $TGT_PROJECT..."
echo "⏳ It may take a few minutes for indexes to build. Polling active..."
echo ""

while true; do
    ALL_READY=true
    STILL_CREATING_COUNT=0
    READY_COUNT=0

    echo "--- Index Build Status Check ($(date +"%T")) ---"

    for DB in "${DATABASES[@]}"; do
        # Fetch composite indexes for the database
        INDEXES=$(gcloud firestore indexes composite list --database="$DB" --project="$TGT_PROJECT" --format="value(state)" 2>/dev/null || true)
        
        # If database list fails or has no indexes, continue
        if [ -z "$INDEXES" ]; then
            continue
        fi

        DB_CREATING=$(echo "$INDEXES" | grep -c "CREATING" || true)
        DB_READY=$(echo "$INDEXES" | grep -c "READY" || true)
        DB_FAILED=$(echo "$INDEXES" | grep -c "FAILED" || true)

        if [ "$DB_CREATING" -gt 0 ]; then
            ALL_READY=false
            STILL_CREATING_COUNT=$((STILL_CREATING_COUNT + DB_CREATING))
            echo "   ⚠️  [$DB]: $DB_READY READY, $DB_CREATING CREATING..."
        else
            READY_COUNT=$((READY_COUNT + DB_READY))
            if [ "$DB_FAILED" -gt 0 ]; then
                echo "   ❌ [$DB]: $DB_READY READY, $DB_FAILED FAILED!"
            else
                if [ "$DB_READY" -gt 0 ]; then
                    echo "   ✅ [$DB]: All $DB_READY indexes are READY."
                fi
            fi
        fi
    done

    echo "📊 Total: $READY_COUNT READY, $STILL_CREATING_COUNT compiling."

    if [ "$ALL_READY" = true ]; then
        echo ""
        echo "🎉 SUCCESS: All composite indexes are compilation-complete and READY!"
        break
    fi

    echo "💤 Sleeping 15 seconds before next poll..."
    echo ""
    sleep 15
done

echo "✨ Index deployment and compilation validation complete!"
