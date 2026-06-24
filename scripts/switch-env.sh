#!/bin/bash
# switch-env.sh: Toggle between heidless-apps-2 and stillwater-sovereign-02

set -e

ENV=$1
if [ "$ENV" != "heidless-apps-2" ] && [ "$ENV" != "stillwater-sovereign-02" ]; then
    echo "❌ Error: Invalid environment. Usage: ./switch-env.sh <heidless-apps-2|stillwater-sovereign-02>"
    exit 1
fi

PROJECTS_DIR="/home/heidless/projects"
SUITE_UTILS_DIR="$PROJECTS_DIR/SuiteUtils"

echo "🔮 Switching Stillwater Sovereign App Suite environment to: $ENV"
echo "--------------------------------------------------------"

# 0. Align gcloud project context
echo "👤 Switching active gcloud project to: $ENV..."
gcloud config set project "$ENV"

# 1. Resolve Admin Service Accounts in SuiteUtils
SRC_SA_KEY="$SUITE_UTILS_DIR/secrets/heidless-apps-2-firebase-adminsdk-fbsvc-fea3de0c63.json"
TGT_SA_KEY="$SUITE_UTILS_DIR/suite-admin-sovereign-02.json"

# Swapping the root suite-admin-sovereign.json file so legacy scripts resolve to correct project
if [ "$ENV" == "heidless-apps-2" ] && [ -f "$SRC_SA_KEY" ]; then
    cp "$SRC_SA_KEY" "$SUITE_UTILS_DIR/suite-admin-sovereign.json"
    echo "🔑 Aligned root suite-admin-sovereign.json to heidless-apps-2."
elif [ "$ENV" == "stillwater-sovereign-02" ] && [ -f "$TGT_SA_KEY" ]; then
    cp "$TGT_SA_KEY" "$SUITE_UTILS_DIR/suite-admin-sovereign.json"
    echo "🔑 Aligned root suite-admin-sovereign.json to stillwater-sovereign-02."
fi

# Define our 11 applications, their active env filename, and if they use service-account.json
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
    "InferenceGateway:.env:false:"
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
    SRC_ENV="$APP_DIR/${ENV_FILE}.heidless-apps-2"
    TGT_ENV="$APP_DIR/${ENV_FILE}.stillwater-sovereign-02"

    # Ensure source environment file exists (initialized from active env file if missing)
    if [ ! -f "$SRC_ENV" ]; then
        if [ -f "$ACTIVE_ENV" ]; then
            cp "$ACTIVE_ENV" "$SRC_ENV"
            echo "   💾 Created backup ${ENV_FILE}.heidless-apps-2 from active config."
        fi
    fi

    # Ensure target environment file exists (templated from source if missing)
    if [ ! -f "$TGT_ENV" ]; then
        if [ -f "$SRC_ENV" ]; then
            # Copy and replace project string
            sed 's/heidless-apps-2/stillwater-sovereign-02/g' "$SRC_ENV" > "$TGT_ENV"
            # Replace sensitive secrets/IDs with placeholders for configuration safety
            sed -i 's/NEXT_PUBLIC_FIREBASE_API_KEY=.*/NEXT_PUBLIC_FIREBASE_API_KEY=PLACEHOLDER_INSERT_TARGET_API_KEY/g' "$TGT_ENV"
            sed -i 's/NEXT_PUBLIC_FIREBASE_APP_ID=.*/NEXT_PUBLIC_FIREBASE_APP_ID=PLACEHOLDER_INSERT_TARGET_APP_ID/g' "$TGT_ENV"
            sed -i 's/VITE_FIREBASE_API_KEY=.*/VITE_FIREBASE_API_KEY=PLACEHOLDER_INSERT_TARGET_API_KEY/g' "$TGT_ENV"
            sed -i 's/VITE_FIREBASE_APP_ID=.*/VITE_FIREBASE_APP_ID=PLACEHOLDER_INSERT_TARGET_APP_ID/g' "$TGT_ENV"
            echo "   🆕 Generated template ${ENV_FILE}.stillwater-sovereign-02."
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

        if [ "$ENV" == "heidless-apps-2" ] && [ -f "$SRC_SA_KEY" ]; then
            cp "$SRC_SA_KEY" "$APP_SA_DEST"
            echo "   🔐 Installed heidless-apps-2 service account."
        elif [ "$ENV" == "stillwater-sovereign-02" ] && [ -f "$TGT_SA_KEY" ]; then
            cp "$TGT_SA_KEY" "$APP_SA_DEST"
            echo "   🔐 Installed stillwater-sovereign-02 service account."
        fi
    fi

    # --- C. Setup .firebaserc and firebase CLI project use ---
    FIREBASE_JSON="$APP_DIR/firebase.json"
    FIREBASE_RC="$APP_DIR/.firebaserc"
    if [ -f "$FIREBASE_JSON" ] || [ -f "$FIREBASE_RC" ]; then
        # Create standard .firebaserc with both project mappings
        cat <<EOF > "$FIREBASE_RC"
{
  "projects": {
    "heidless-apps-2": "heidless-apps-2",
    "stillwater-sovereign-02": "stillwater-sovereign-02"
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
        echo "   📝 Configured standard .firebaserc."

        # Trigger project use
        (cd "$APP_DIR" && firebase use "$ENV" || echo "   ⚠️  Failed to set firebase project. Make sure firebase CLI is logged in.")
    fi
done

echo "--------------------------------------------------------"
echo "🎉 Environment switch to $ENV complete!"
