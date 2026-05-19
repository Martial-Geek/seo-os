#!/usr/bin/env bash
set -euo pipefail

# =========================================
# Google OAuth refresh token helper
# Search Console + Google Analytics Data API
# =========================================
#
# Usage: export GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (e.g. from .env), then:
#   bash g_token.sh
#
# Optional: load from repo .env (do not commit real secrets)
#   set -a && [ -f .env ] && . ./.env && set +a && bash g_token.sh

: "${GOOGLE_CLIENT_ID:?Set GOOGLE_CLIENT_ID (OAuth client ID)}"
: "${GOOGLE_CLIENT_SECRET:?Set GOOGLE_CLIENT_SECRET}"

CLIENT_ID="$GOOGLE_CLIENT_ID"
CLIENT_SECRET="$GOOGLE_CLIENT_SECRET"
REDIRECT_URI="${OAUTH_REDIRECT_URI:-http://localhost:3000/api/auth/callback}"

SCOPES="https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly"

AUTH_URL="https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${SCOPES// /%20}&access_type=offline&prompt=consent"

echo ""
echo "========================================="
echo "Open this URL in your browser:"
echo "========================================="
echo ""
echo "$AUTH_URL"
echo ""
echo "After login, Google will redirect you to:"
echo ""
echo "  ${REDIRECT_URI}?code=XXXX"
echo ""
echo "Paste ONLY the code below."
echo ""

read -r -p "Authorization Code: " AUTH_CODE

echo ""
echo "Requesting refresh token..."
echo ""

RESPONSE=$(curl --silent --request POST \
  --url https://oauth2.googleapis.com/token \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data client_id="$CLIENT_ID" \
  --data client_secret="$CLIENT_SECRET" \
  --data code="$AUTH_CODE" \
  --data grant_type=authorization_code \
  --data redirect_uri="$REDIRECT_URI")

echo ""
echo "========================================="
echo "Google Response:"
echo "========================================="
echo ""

echo "$RESPONSE"

echo ""
echo "========================================="
echo "Done"
echo "========================================="
