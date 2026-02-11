"""
Diagnostic script to check what segment data is available in the database.
This helps us understand what values exist for segment filtering.
"""

from database import run_query

def check_table_data():
    print("\n" + "="*70)
    print("SEGMENT DATA DIAGNOSTIC REPORT")
    print("="*70 + "\n")
    
    # 1. Check sessions table - device_type
    print("1. DEVICE TYPE (from sessions table)")
    print("-" * 70)
    try:
        query = """
            SELECT device_type, count() as cnt
            FROM sessions
            WHERE device_type != ''
            GROUP BY device_type
            ORDER BY cnt DESC
            LIMIT 10
        """
        rows = run_query(query)
        if rows:
            for row in rows:
                print(f"   {row[0]:<20} → {row[1]:>10,} sessions")
        else:
            print("   ❌ No device_type data found")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # 2. Check raw_events - device_type
    print("\n2. DEVICE TYPE (from raw_events table)")
    print("-" * 70)
    try:
        query = """
            SELECT device_type, count() as cnt
            FROM raw_events
            WHERE device_type != ''
            GROUP BY device_type
            ORDER BY cnt DESC
            LIMIT 10
        """
        rows = run_query(query)
        if rows:
            for row in rows:
                print(f"   {row[0]:<20} → {row[1]:>10,} events")
        else:
            print("   ❌ No device_type data found")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # 3. Check guest_segment
    print("\n3. GUEST SEGMENT (from sessions table)")
    print("-" * 70)
    try:
        query = """
            SELECT guest_segment, count() as cnt
            FROM sessions
            WHERE guest_segment != '' AND guest_segment != 'Unknown'
            GROUP BY guest_segment
            ORDER BY cnt DESC
            LIMIT 10
        """
        rows = run_query(query)
        if rows:
            for row in rows:
                print(f"   {row[0]:<20} → {row[1]:>10,} sessions")
        else:
            print("   ❌ No guest_segment data found")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # 4. Check selected_location
    print("\n4. SELECTED LOCATION (from raw_events table)")
    print("-" * 70)
    try:
        query = """
            SELECT selected_location, count() as cnt
            FROM raw_events
            WHERE selected_location != ''
            GROUP BY selected_location
            ORDER BY cnt DESC
            LIMIT 10
        """
        rows = run_query(query)
        if rows:
            for row in rows:
                print(f"   {row[0]:<20} → {row[1]:>10,} events")
        else:
            print("   ❌ No selected_location data found")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # 5. Check utm_source
    print("\n5. UTM SOURCE / TRAFFIC SOURCE (from sessions table)")
    print("-" * 70)
    try:
        query = """
            SELECT traffic_source, count() as cnt
            FROM sessions
            WHERE traffic_source != ''
            GROUP BY traffic_source
            ORDER BY cnt DESC
            LIMIT 10
        """
        rows = run_query(query)
        if rows:
            for row in rows:
                print(f"   {row[0]:<20} → {row[1]:>10,} sessions")
        else:
            print("   ⚠️  No traffic_source, trying utm_source...")
            query2 = """
                SELECT utm_source, count() as cnt
                FROM sessions
                WHERE utm_source != ''
                GROUP BY utm_source
                ORDER BY cnt DESC
                LIMIT 10
            """
            rows2 = run_query(query2)
            if rows2:
                for row in rows2:
                    print(f"   {row[0]:<20} → {row[1]:>10,} sessions")
            else:
                print("   ❌ No utm_source data found")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # 6. Check browser
    print("\n6. BROWSER (from sessions table)")
    print("-" * 70)
    try:
        query = """
            SELECT browser, count() as cnt
            FROM sessions
            WHERE browser != ''
            GROUP BY browser
            ORDER BY cnt DESC
            LIMIT 10
        """
        rows = run_query(query)
        if rows:
            for row in rows:
                print(f"   {row[0]:<20} → {row[1]:>10,} sessions")
        else:
            print("   ❌ No browser data found")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # 7. Check OS
    print("\n7. OPERATING SYSTEM (from raw_events table)")
    print("-" * 70)
    try:
        query = """
            SELECT os, count() as cnt
            FROM raw_events
            WHERE os != '' AND os != 'Unknown'
            GROUP BY os
            ORDER BY cnt DESC
            LIMIT 10
        """
        rows = run_query(query)
        if rows:
            for row in rows:
                print(f"   {row[0]:<20} → {row[1]:>10,} events")
        else:
            print("   ❌ No os data found")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # 8. Check is_returning_visitor
    print("\n8. VISITOR TYPE (from sessions table)")
    print("-" * 70)
    try:
        query = """
            SELECT 
                CASE 
                    WHEN is_returning_visitor = 1 OR is_returning_visitor = true THEN 'Returning'
                    WHEN is_returning_visitor = 0 OR is_returning_visitor = false THEN 'New'
                    ELSE 'Unknown'
                END as visitor_type,
                count() as cnt
            FROM sessions
            GROUP BY visitor_type
            ORDER BY cnt DESC
        """
        rows = run_query(query)
        if rows:
            for row in rows:
                print(f"   {row[0]:<20} → {row[1]:>10,} sessions")
        else:
            print("   ❌ No is_returning_visitor data found")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print("\n✅ Properties with data can be used for segments")
    print("❌ Properties without data need to be excluded or data needs to be populated")
    print("\nRecommendation: Update /api/metadata/segment-values endpoint to only")
    print("return properties that actually have data in your database.\n")

if __name__ == "__main__":
    check_table_data()
