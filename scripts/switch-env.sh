#!/bin/bash
# switch-env.sh: Toggle between stillwater-sovereign-01 and stillwater-sovereign-02

set -e

ENV=$1
if [ "$ENV" != "sovereign-01" ] && [ "$ENV" != "sovereign-02" ]; then
    echo "❌ Error: Invalid environment. Usage: ./switch-env.sh <sovereign-01|sovereign-02>"
    exit 1
fi

PROJECTS_DIR="/home/heidless/projects"
SUITE_UTILS_DIR="$PROJECTS_DIR/SuiteUtils"

echo "🔮 Switching Stillwater Sovereign App Suite environment to: $ENV"
echo "--------------------------------------------------------"

# 1. Resolve Admin Service Accounts in SuiteUtils
SRC_SA_KEY="$SUITE_UTILS_DIR/suite-admin-sovereign-01.json"
# Fallback if the user hasn't renamed suite-admin-sovereign.json yet
if [ ! -f "$SRC_SA_KEY" ] && [ -f "$SUITE_UTILS_DIR/suite-admin-sovereign.json" ]; then
    cp "$SUITE_UTILS_DIR/suite-admin-sovereign.json" "$SRC_SA_KEY"
    echo "💾 Backed up existing suite-admin-sovereign.json to suite-admin-sovereign-01.json"
fi

TGT_SA_KEY="$SUITE_UTILS_DIR/suite-admin-sovereign-02.json"
if [ "$ENV" == "sovereign-02" ] && [ ! -f "$TGT_SA_KEY" ]; then
    echo "⚠️  Warning: Target service account key not found at $TGT_SA_KEY"
    echo "👉 Please place your stillwater-sovereign-02 service account JSON file at that path."
fi

# Swapping the root suite-admin-sovereign.json file so legacy scripts resolve to correct project
if [ "$ENV" == "sovereign-01" ] && [ -f "$SRC_SA_KEY" ]; then
    cp "$SRC_SA_KEY" "$SUITE_UTILS_DIR/suite-admin-sovereign.json"
    echo "🔑 Aligned root suite-admin-sovereign.json to sovereign-01."
elif [ "$ENV" == "sovereign-02" ] && [ -f "$TGT_SA_KEY" ]; then
    cp "$TGT_SA_KEY" "$SUITE_UTILS_DIR/suite-admin-sovereign.json"
    echo "🔑 Aligned root suite-admin-sovereign.json to sovereign-02."
fi

# Define our 10 applications, their active env filename, and if they use service-account.json
# format: "AppName:EnvFilename:UsesServiceAccount:CustomSAPath"
APPS=(
    "ag-video-system:.env.local:true:service-account.json"
    "PromptTool:.env.local:true:service-account.json"
    "PromptResources:.env.local:true:service-account.json"
    "PromptMasterSPA:.env.local:false:"
    "PromptAccreditation:.env.local:false:"
    "PlanTune:.env.local:false:"
    "SuiteUtils:.env:true:server/config/service-account.json"
    "Persona:.env.local:false:"
    "URLShortener:.env.local:false:"
    "TokenMarket:.env:false:"
)

for APP_INFO in "${APPS[@]}"; do
    IFS=":" read -r APP_NAME ENV_FILE USES_SA SA_PATH <<< "$APP_INFO"
    APP_DIR="$PROJECTS_DIR/$APP_NAME"

    if [ ! -d "$APP_DIR" ]; then
        echo "⚠️  App folder $APP_NAME not found, skipping..."
        continue
    fi

    echo "⚙️  Processing app: $APP_NAME..."

    # --- A. Setup .env file switching ---
    ACTIVE_ENV="$APP_DIR/$ENV_FILE"
    SOV_01_ENV="$APP_DIR/${ENV_FILE}.sovereign-01"
    SOV_02_ENV="$APP_DIR/${ENV_FILE}.sovereign-02"

    # Ensure sovereign-01 environment file exists (initialized from current env file if missing)
    if [ ! -f "$SOV_01_ENV" ]; then
        if [ -f "$ACTIVE_ENV" ]; then
            cp "$ACTIVE_ENV" "$SOV_01_ENV"
            echo "   💾 Created backup ${ENV_FILE}.sovereign-01 from active config."
        else
            echo "   ⚠️  No active config found to initialize ${ENV_FILE}.sovereign-01"
        fi
    fi

    # Ensure sovereign-02 environment file exists (templated from sovereign-01 if missing)
    if [ ! -f "$SOV_02_ENV" ]; then
        if [ -f "$SOV_01_ENV" ]; then
            # Copy and replace project string
            sed 's/stillwater-sovereign-01/stillwater-sovereign-02/g' "$SOV_01_ENV" > "$SOV_02_ENV"
            # Replace sensitive secrets/IDs with placeholders for configuration safety
            sed -i 's/NEXT_PUBLIC_FIREBASE_API_KEY=.*/NEXT_PUBLIC_FIREBASE_API_KEY=PLACEHOLDER_INSERT_TARGET_API_KEY/g' "$SOV_02_ENV"
            sed -i 's/NEXT_PUBLIC_FIREBASE_APP_ID=.*/NEXT_PUBLIC_FIREBASE_APP_ID=PLACEHOLDER_INSERT_TARGET_APP_ID/g' "$SOV_02_ENV"
            sed -i 's/VITE_FIREBASE_API_KEY=.*/VITE_FIREBASE_API_KEY=PLACEHOLDER_INSERT_TARGET_API_KEY/g' "$SOV_02_ENV"
            sed -i 's/VITE_FIREBASE_APP_ID=.*/VITE_FIREBASE_APP_ID=PLACEHOLDER_INSERT_TARGET_APP_ID/g' "$SOV_02_ENV"
            echo "   🆕 Generated template ${ENV_FILE}.sovereign-02 (Please edit to populate target API credentials)."
        fi
    fi

    # Switch active config file
    TARGET_CONFIG="$APP_DIR/${ENV_FILE}.$ENV"
    if [ -f "$TARGET_CONFIG" ]; then
        cp "$TARGET_CONFIG" "$ACTIVE_ENV"
        echo "   🔄 Swapped active config: $ENV_FILE -> ${ENV_FILE}.$ENV"
    else
        echo "   ❌ Error: Target config file $TARGET_CONFIG not found."
    fi

    # --- B. Setup Service Account switching (if required) ---
    if [ "$USES_SA" == "true" ]; then
        APP_SA_DEST="$APP_DIR/$SA_PATH"
        APP_SA_DIR=$(dirname "$APP_SA_DEST")
        mkdir -p "$APP_SA_DIR"

        if [ "$ENV" == "sovereign-01" ] && [ -f "$SRC_SA_KEY" ]; then
            cp "$SRC_SA_KEY" "$APP_SA_DEST"
            echo "   🔐 Installed sovereign-01 service account."
        elif [ "$ENV" == "sovereign-02" ] && [ -f "$TGT_SA_KEY" ]; then
            cp "$TGT_SA_KEY" "$APP_SA_DEST"
            echo "   🔐 Installed sovereign-02 service account."
        else
            echo "   ⚠️  Skipped service account installation (source/target key file missing)."
        fi
    fi

    # --- C. Setup .firebaserc and firebase CLI project use ---
    FIREBASE_JSON="$APP_DIR/firebase.json"
    FIREBASE_RC="$APP_DIR/.firebaserc"
    if [ -f "$FIREBASE_JSON" ] || [ -f "$FIREBASE_RC" ]; then
        # Create standard .firebaserc with both project aliases and multisite targets
        cat <<EOF > "$FIREBASE_RC"
{
  "projects": {
    "sovereign-01": "heidless-apps-2",
    "sovereign-02": "stillwater-sovereign-02"
  },
  "targets": {
    "heidless-apps-2": {
      "hosting": {
        "stillwater-suite-utils": [
          "suite-utils"
        ],
        "stillwater-prompt-tool": [
          "heidless-prompt-tool"
        ],
        "stillwater-prompt-resources": [
          "heidless-prompt-resources"
        ],
        "stillwater-prompt-master": [
          "heidless-prompt-master"
        ],
        "stillwater-prompt-accreditation": [
          "heidless-prompt-accreditation"
        ],
        "stillwater-video-system": [
          "heidless-video-system"
        ],
        "stillwater-persona": [
          "persona-v0"
        ],
        "stillwater-plan-tune": [
          "heidless-plan-tune"
        ],
        "stillwater-token-market": [
          "stillwater-token-market"
        ]
      }
    },
    "stillwater-sovereign-02": {
      "hosting": {
        "stillwater-suite-utils": [
          "stillwater-sovereign-02"
        ],
        "stillwater-prompt-tool": [
          "stillwater-prompt-tool-02"
        ],
        "stillwater-prompt-resources": [
          "stillwater-prompt-resources-02"
        ],
        "stillwater-prompt-master": [
          "stillwater-prompt-master-02"
        ],
        "stillwater-prompt-accreditation": [
          "stillwater-prompt-accreditation-02"
        ],
        "stillwater-video-system": [
          "stillwater-video-system-02"
        ],
        "stillwater-persona": [
          "stillwater-persona-02"
        ],
        "stillwater-plan-tune": [
          "stillwater-plan-tune-02"
        ],
        "stillwater-token-market": [
          "stillwater-token-market-02"
        ]
      }
    }
  }
}
EOF
        echo "   📝 Configured standard .firebaserc with sovereign-01 and sovereign-02 aliases."

        # Trigger project alias change
        (cd "$APP_DIR" && firebase use "$ENV" || echo "   ⚠️  Failed to set firebase project alias. Make sure firebase CLI is logged in.")
    fi
done

echo "--------------------------------------------------------"
echo "🎉 Environment switch to $ENV complete!"
