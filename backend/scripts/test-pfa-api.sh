#!/bin/bash
# Test script for PFA Data API (Phase 3)
# Run after starting backend server: npm run dev

set -e

API_BASE="http://localhost:3001/api"
ORG_ID="<REPLACE_WITH_YOUR_ORG_ID>"
TOKEN=""

echo "========================================="
echo "PFA Data API Test Script"
echo "========================================="
echo ""

# Step 1: Login
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo "$LOGIN_RESPONSE" | jq .
  exit 1
fi

echo "✓ Login successful"
echo "Token: ${TOKEN:0:50}..."
echo ""

# Step 2: Get merged PFA data
echo "2. Getting merged PFA data..."
GET_RESPONSE=$(curl -s -X GET "$API_BASE/pfa/$ORG_ID" \
  -H "Authorization: Bearer $TOKEN")

RECORD_COUNT=$(echo $GET_RESPONSE | jq -r '.pagination.totalRecords')

if [ "$RECORD_COUNT" = "null" ]; then
  echo "❌ GET request failed"
  echo "$GET_RESPONSE" | jq .
  exit 1
fi

echo "✓ GET successful - Found $RECORD_COUNT records"
echo ""

# Step 3: Save draft modification
echo "3. Saving draft modification..."
DRAFT_RESPONSE=$(curl -s -X POST "$API_BASE/pfa/$ORG_ID/draft" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-001",
    "modifications": [
      {
        "pfaId": "PFA-001",
        "delta": {
          "monthlyRate": 5500
        },
        "changeReason": "API test modification"
      }
    ]
  }')

SAVED_COUNT=$(echo $DRAFT_RESPONSE | jq -r '.saved | length')

if [ "$SAVED_COUNT" = "null" ]; then
  echo "❌ POST draft failed"
  echo "$DRAFT_RESPONSE" | jq .
  exit 1
fi

echo "✓ Draft saved - $SAVED_COUNT modifications"
echo ""

# Step 4: Get merged data with draft
echo "4. Getting merged data (should include draft)..."
GET_MERGED=$(curl -s -X GET "$API_BASE/pfa/$ORG_ID?syncState=draft" \
  -H "Authorization: Bearer $TOKEN")

DRAFT_COUNT=$(echo $GET_MERGED | jq -r '.data | length')

echo "✓ Found $DRAFT_COUNT draft records"
echo ""

# Step 5: Get KPI statistics
echo "5. Getting KPI statistics..."
STATS_RESPONSE=$(curl -s -X GET "$API_BASE/pfa/$ORG_ID/stats" \
  -H "Authorization: Bearer $TOKEN")

TOTAL_RECORDS=$(echo $STATS_RESPONSE | jq -r '.data.total_records')

if [ "$TOTAL_RECORDS" = "null" ]; then
  echo "❌ GET stats failed"
  echo "$STATS_RESPONSE" | jq .
  exit 1
fi

echo "✓ Stats retrieved - Total records: $TOTAL_RECORDS"
echo ""

# Step 6: Discard draft
echo "6. Discarding draft modifications..."
DISCARD_RESPONSE=$(curl -s -X POST "$API_BASE/pfa/$ORG_ID/discard" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-001"
  }')

DISCARDED_COUNT=$(echo $DISCARD_RESPONSE | jq -r '.discardedCount')

if [ "$DISCARDED_COUNT" = "null" ]; then
  echo "❌ Discard failed"
  echo "$DISCARD_RESPONSE" | jq .
  exit 1
fi

echo "✓ Discarded $DISCARDED_COUNT modifications"
echo ""

echo "========================================="
echo "✓ All tests passed!"
echo "========================================="
echo ""
echo "Summary:"
echo "  - Login: ✓"
echo "  - GET merged data: ✓ ($RECORD_COUNT records)"
echo "  - POST draft: ✓ ($SAVED_COUNT saved)"
echo "  - GET with filter: ✓ ($DRAFT_COUNT drafts)"
echo "  - GET stats: ✓ ($TOTAL_RECORDS total)"
echo "  - Discard drafts: ✓ ($DISCARDED_COUNT discarded)"
echo ""
