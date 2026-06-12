#!/bin/bash
# 01-migrate-auth.sh: Export authentication users and import into target Firebase project

set -e

SRC_PROJECT="stillwater-sovereign-01"
TGT_PROJECT="stillwater-sovereign-02"

echo "🔐 Stillwater Sovereign Authentication Migration Tool"
echo "--------------------------------------------------------"
echo "📥 Source Project: $SRC_PROJECT"
echo "📤 Target Project: $TGT_PROJECT"
echo ""

# 1. Export authentication database to a temporary JSON file
echo "👤 Switching active Firebase CLI account to: heidlessemail21@gmail.com (Source)..."
firebase login:use heidlessemail21@gmail.com

echo "📦 Exporting users from $SRC_PROJECT..."
firebase auth:export auth_backup.json --format=JSON --project "$SRC_PROJECT"
echo "✅ Exported users to auth_backup.json"
echo ""

# 2. Query user for password hash params (vital for SCRYPT migrations)
echo "🔑 To migrate password hashes correctly so users can log in, we need the SCRYPT keys from your source project."
echo "👉 Go to: Firebase Console -> Authentication -> Users -> Click three dots (top right) -> 'Password hash parameters'"
echo ""
read -p "Enter base64_signer_key: " SIGNER_KEY
read -p "Enter base64_salt_separator: " SALT_SEPARATOR
read -p "Enter rounds (default 8): " ROUNDS
ROUNDS=${ROUNDS:-8}
read -p "Enter mem_cost (default 14): " MEM_COST
MEM_COST=${MEM_COST:-14}

if [ -z "$SIGNER_KEY" ] || [ -z "$SALT_SEPARATOR" ]; then
    echo "❌ Error: Signer Key and Salt Separator are required for SCRYPT import."
    exit 1
fi

echo ""
echo "👤 Switching active Firebase CLI account to: heidlessemail19@gmail.com (Target)..."
firebase login:use heidlessemail19@gmail.com

echo "📤 Importing users into $TGT_PROJECT..."
firebase auth:import auth_backup.json \
    --hash-algo=SCRYPT \
    --hash-key="$SIGNER_KEY" \
    --salt-separator="$SALT_SEPARATOR" \
    --rounds="$ROUNDS" \
    --mem-cost="$MEM_COST" \
    --project "$TGT_PROJECT"

echo ""
echo "🎉 User authentication database migrated successfully!"
echo "🧹 Cleaning up temp files..."
rm -f auth_backup.json
echo "✨ Complete!"
