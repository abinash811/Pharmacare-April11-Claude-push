#!/bin/bash

# Get the backend URL
BACKEND_URL="${REACT_APP_BACKEND_URL:-http://localhost:8001}"
API="$BACKEND_URL/api"

echo "=== PharmaCare Phase 1 Migration Test ==="
echo "Backend URL: $API"
echo ""

# Step 1: Login as admin
echo "1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pharmacy.com","password":"admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Step 2: Run migration
echo "2. Running migration (medicines -> products + batches)..."
MIGRATION_RESPONSE=$(curl -s -X POST "$API/migrate/medicines-to-products" \
  -H "Authorization: Bearer $TOKEN")

echo "Migration result:"
echo "$MIGRATION_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$MIGRATION_RESPONSE"
echo ""

# Step 3: Check products
echo "3. Checking products..."
PRODUCTS=$(curl -s -X GET "$API/products" \
  -H "Authorization: Bearer $TOKEN")

PRODUCT_COUNT=$(echo $PRODUCTS | grep -o '"id"' | wc -l)
echo "✅ Found $PRODUCT_COUNT products"
echo ""

# Step 4: Check batches
echo "4. Checking stock batches..."
BATCHES=$(curl -s -X GET "$API/stock/batches" \
  -H "Authorization: Bearer $TOKEN")

BATCH_COUNT=$(echo $BATCHES | grep -o '"batch_id"' | wc -l || echo $BATCHES | grep -o '"id"' | wc -l)
echo "✅ Found $BATCH_COUNT batches"
echo ""

# Step 5: Test search with batches (FEFO)
echo "5. Testing product search with batches (FEFO)..."
SEARCH_RESULT=$(curl -s -X GET "$API/products/search-with-batches?q=para" \
  -H "Authorization: Bearer $TOKEN")

echo "Search results:"
echo "$SEARCH_RESULT" | python3 -m json.tool 2>/dev/null || echo "$SEARCH_RESULT"
echo ""

echo "=== Migration Test Complete ==="
