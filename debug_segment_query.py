"""
Debug script to test segment queries and see what's being returned
"""

from database import run_query
import json

# Test a simple segment query
print("\n" + "="*70)
print("DEBUGGING SEGMENT QUERY")
print("="*70 + "\n")

# First, let's check what a basic funnel query returns
print("1. Basic Funnel Query (No Segments)")
print("-" * 70)

basic_query = """
    SELECT 
        funneled.funnel_level,
        count(DISTINCT re.user_id) AS reached_count
    FROM (
        SELECT 
            re.session_id,
            windowFunnel(86400)(
                toDateTime(timestamp),
                event_type = 'page_view' AND page_category = 'home',
                event_type = 'click' AND element_selector = 'location-card'
            ) AS funnel_level
        FROM raw_events re
        WHERE timestamp >= now() - INTERVAL 30 DAY
        GROUP BY re.session_id
    ) AS funneled
    INNER JOIN raw_events re ON funneled.session_id = re.session_id
    WHERE funneled.funnel_level > 0
    GROUP BY funneled.funnel_level
    ORDER BY funneled.funnel_level
"""

try:
    rows = run_query(basic_query)
    print(f"✓ Query returned {len(rows)} rows")
    for row in rows:
        print(f"  Level {row[0]}: {row[1]:,} users")
except Exception as e:
    print(f"✗ Error: {e}")

# Now test with a segment filter (device_type = mobile)
print("\n2. Funnel Query WITH Segment Filter (device_type = mobile)")
print("-" * 70)

segment_query = """
    SELECT 
        funneled.funnel_level,
        count(DISTINCT re.user_id) AS reached_count
    FROM (
        SELECT 
            re.session_id,
            windowFunnel(86400)(
                toDateTime(timestamp),
                event_type = 'page_view' AND page_category = 'home',
                event_type = 'click' AND element_selector = 'location-card'
            ) AS funnel_level
        FROM raw_events re
        WHERE timestamp >= now() - INTERVAL 30 DAY
          AND re.device_type = 'mobile'
        GROUP BY re.session_id
    ) AS funneled
    INNER JOIN raw_events re ON funneled.session_id = re.session_id
    WHERE funneled.funnel_level > 0
      AND re.device_type = 'mobile'
    GROUP BY funneled.funnel_level
    ORDER BY funneled.funnel_level
"""

try:
    rows = run_query(segment_query)
    print(f"✓ Query returned {len(rows)} rows")
    for row in rows:
        print(f"  Level {row[0]}: {row[1]:,} users")
except Exception as e:
    print(f"✗ Error: {e}")

# Test with guest_segment (needs session join)
print("\n3. Funnel Query WITH Session Property (guest_segment = couples)")
print("-" * 70)

session_segment_query = """
    SELECT 
        funneled.funnel_level,
        count(DISTINCT re.user_id) AS reached_count
    FROM (
        SELECT 
            re.session_id,
            windowFunnel(86400)(
                toDateTime(timestamp),
                event_type = 'page_view' AND page_category = 'home',
                event_type = 'click' AND element_selector = 'location-card'
            ) AS funnel_level
        FROM raw_events re
        INNER JOIN sessions s ON re.session_id = s.session_id
        WHERE timestamp >= now() - INTERVAL 30 DAY
          AND s.guest_segment = 'couples'
        GROUP BY re.session_id
    ) AS funneled
    INNER JOIN raw_events re ON funneled.session_id = re.session_id
    INNER JOIN sessions s ON re.session_id = s.session_id
    WHERE funneled.funnel_level > 0
      AND s.guest_segment = 'couples'
    GROUP BY funneled.funnel_level
    ORDER BY funneled.funnel_level
"""

try:
    rows = run_query(session_segment_query)
    print(f"✓ Query returned {len(rows)} rows")
    for row in rows:
        print(f"  Level {row[0]}: {row[1]:,} users")
except Exception as e:
    print(f"✗ Error: {e}")

print("\n" + "="*70)
print("DIAGNOSIS COMPLETE")
print("="*70 + "\n")
