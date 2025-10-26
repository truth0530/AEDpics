#!/bin/bash

# Test script for Priority 1 & 2 Implementation
# Priority 1: Assignment-Session Integration
# Priority 2: Soft Timeout Warnings

API_BASE="http://localhost:3000/api/inspections"
CONTENT_TYPE="Content-Type: application/json"

echo "======================================"
echo "Testing Inspection Session Priorities"
echo "======================================"
echo ""

# Test data from database
ASSIGNED_EQUIPMENT="13-0022932"
UNASSIGNED_EQUIPMENT="99-9999999"  # Non-existent equipment
ASSIGNED_USER_ID="5f985a00-f2a1-4ea7-a56c-1b31d4bc95f9"

echo "Test 1: Attempt to start session on UNASSIGNED equipment"
echo "Expected: 403 Forbidden with 'NOT_ASSIGNED' error code"
echo "---"
curl -s -X POST "${API_BASE}/sessions" \
  -H "${CONTENT_TYPE}" \
  -H "Cookie: user_id=${ASSIGNED_USER_ID}" \
  -d "{\"equipmentSerial\":\"${UNASSIGNED_EQUIPMENT}\"}" \
  | python3 -m json.tool
echo ""
echo ""

echo "Test 2: Start session on ASSIGNED equipment (pending status)"
echo "Expected: 200 OK with session created + assignment status updated to 'in_progress'"
echo "---"
RESPONSE=$(curl -s -X POST "${API_BASE}/sessions" \
  -H "${CONTENT_TYPE}" \
  -H "Cookie: user_id=${ASSIGNED_USER_ID}" \
  -d "{\"equipmentSerial\":\"${ASSIGNED_EQUIPMENT}\"}")

echo "$RESPONSE" | python3 -m json.tool
SESSION_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('session', {}).get('id', ''))" 2>/dev/null)
echo ""
echo "Session ID: ${SESSION_ID}"
echo ""

if [ -z "$SESSION_ID" ]; then
  echo "⚠️  Failed to create session. Check logs above."
  exit 1
fi

echo ""
echo "Test 3: Verify assignment status was updated to 'in_progress'"
echo "Expected: Assignment status should be 'in_progress' with started_at timestamp"
echo "---"
curl -s "${API_BASE}/assignments?assignedTo=${ASSIGNED_USER_ID}&equipmentSerial=${ASSIGNED_EQUIPMENT}" \
  | python3 -m json.tool
echo ""
echo ""

echo "Test 4: Load session immediately (no timeout)"
echo "Expected: 200 OK with session data, no warning field"
echo "---"
curl -s "${API_BASE}/sessions?sessionId=${SESSION_ID}" \
  | python3 -m json.tool
echo ""
echo ""

echo "Test 5: Simulate stale session (>24h)"
echo "Note: This requires manually updating last_accessed_at in database"
echo "SQL: UPDATE inspection_sessions SET last_accessed_at = NOW() - INTERVAL '25 hours' WHERE id = '${SESSION_ID}';"
echo ""
read -p "Press Enter after running the SQL command above, or Ctrl+C to skip..."
echo ""
echo "Loading stale session..."
echo "Expected: 200 OK with warning.type='stale_session'"
echo "---"
curl -s "${API_BASE}/sessions?sessionId=${SESSION_ID}" \
  | python3 -m json.tool
echo ""
echo ""

echo "======================================"
echo "✅ Testing Complete"
echo "======================================"
echo ""
echo "Check server logs for:"
echo "  - [Session Start] Assignment check logs"
echo "  - [Session Start] Assignment status update logs"
echo "  - [Session Warning] Stale/inactive session warnings"
