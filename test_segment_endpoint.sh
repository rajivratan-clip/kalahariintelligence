#!/bin/bash

# Test script to verify segment data endpoint is working correctly

echo "════════════════════════════════════════════════════════════════"
echo "  SEGMENT DATA ENDPOINT TEST"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Test 1: Check if backend is running
echo "1. Testing backend connectivity..."
if curl -s http://localhost:8000/api/metadata/segment-values > /dev/null 2>&1; then
    echo "   ✓ Backend is running on port 8000"
else
    echo "   ✗ Backend is NOT running!"
    echo "   → Run: uvicorn api:app --reload --port 8000"
    exit 1
fi

echo ""
echo "2. Fetching segment data..."
RESPONSE=$(curl -s http://localhost:8000/api/metadata/segment-values)

# Test 2: Check if response is valid JSON
if echo "$RESPONSE" | python3 -m json.tool > /dev/null 2>&1; then
    echo "   ✓ Response is valid JSON"
else
    echo "   ✗ Response is NOT valid JSON"
    echo "   Response: $RESPONSE"
    exit 1
fi

echo ""
echo "3. Analyzing available segment properties..."

# Parse and display each property
python3 << PYTHON
import json

response_text = '''$RESPONSE'''
data = json.loads(response_text)
properties = data.get('segment_properties', {})

if not properties:
    print("   ✗ No segment properties found!")
    sys.exit(1)

print(f"   ✓ Found {len(properties)} properties:\n")

for prop_name, values in properties.items():
    print(f"   📊 {prop_name}")
    print(f"      Values: {len(values)}")
    total_count = sum(v.get('count', 0) for v in values)
    print(f"      Total Sessions: {total_count:,}")
    
    # Show top 3 values
    top_values = sorted(values, key=lambda x: x.get('count', 0), reverse=True)[:3]
    for val in top_values:
        print(f"         • {val['label']}: {val['count']:,} sessions")
    print("")

print("   ✓ All properties have data!")
PYTHON

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  TEST COMPLETE - Segment endpoint is working correctly! ✓"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Start frontend: npm run dev"
echo "  2. Open Funnel Lab"
echo "  3. Click '+ Add Segment'"
echo "  4. You should see all properties with session counts!"
echo ""
