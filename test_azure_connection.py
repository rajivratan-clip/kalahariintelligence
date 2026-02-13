#!/usr/bin/env python3
"""
Test script to verify Azure ClickHouse connection and data availability.
Run this before switching your app to Azure to ensure everything works.
"""

from database import test_connection, run_query
import sys

def print_section(title):
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70)

def test_basic_connection():
    """Test 1: Basic connectivity"""
    print_section("TEST 1: Basic Connection")
    success, message = test_connection()
    if success:
        print("✓ Connection successful!")
        return True
    else:
        print(f"✗ Connection failed: {message}")
        return False

def test_table_existence():
    """Test 2: Verify all required tables exist"""
    print_section("TEST 2: Table Existence")
    required_tables = ['raw_events', 'sessions', 'mv_funnel_performance']
    all_exist = True
    
    for table in required_tables:
        try:
            result = run_query(f"SELECT count() FROM {table} LIMIT 1")
            print(f"✓ Table '{table}' exists")
        except Exception as e:
            print(f"✗ Table '{table}' not found or error: {e}")
            all_exist = False
    
    return all_exist

def test_data_volume():
    """Test 3: Check data volume"""
    print_section("TEST 3: Data Volume")
    try:
        # Check raw_events
        events_result = run_query("SELECT count(*) FROM raw_events")
        events_count = events_result[0][0] if events_result else 0
        print(f"✓ raw_events: {events_count:,} rows")
        
        # Check sessions
        sessions_result = run_query("SELECT count(*) FROM sessions")
        sessions_count = sessions_result[0][0] if sessions_result else 0
        print(f"✓ sessions: {sessions_count:,} rows")
        
        # Check time range
        time_result = run_query("""
            SELECT 
                min(timestamp) as min_date,
                max(timestamp) as max_date,
                count(DISTINCT toDate(timestamp)) as days_with_data
            FROM raw_events
        """)
        if time_result:
            min_date, max_date, days = time_result[0]
            print(f"✓ Date range: {min_date} to {max_date} ({days} days)")
        
        return events_count > 0 and sessions_count > 0
    except Exception as e:
        print(f"✗ Error checking data volume: {e}")
        return False

def test_locations():
    """Test 4: Verify locations data"""
    print_section("TEST 4: Locations Data")
    try:
        locations = run_query("""
            SELECT DISTINCT final_location 
            FROM sessions 
            WHERE final_location != '' 
            ORDER BY final_location
        """)
        if locations:
            print(f"✓ Found {len(locations)} locations:")
            for loc in locations:
                print(f"  - {loc[0]}")
            return True
        else:
            print("✗ No locations found")
            return False
    except Exception as e:
        print(f"✗ Error checking locations: {e}")
        return False

def test_segmentation_data():
    """Test 5: Verify segmentation data"""
    print_section("TEST 5: Segmentation Data")
    try:
        # Device types
        devices = run_query("""
            SELECT DISTINCT device_type, count() as cnt
            FROM sessions
            WHERE device_type != '' AND device_type != 'Unknown'
            GROUP BY device_type
            ORDER BY cnt DESC
            LIMIT 5
        """)
        if devices:
            print(f"✓ Device types found: {len(devices)}")
            for device, count in devices:
                print(f"  - {device}: {count:,}")
        
        # Guest segments
        segments = run_query("""
            SELECT DISTINCT guest_segment, count() as cnt
            FROM sessions
            WHERE guest_segment != '' AND guest_segment != 'Unknown'
            GROUP BY guest_segment
            ORDER BY cnt DESC
            LIMIT 5
        """)
        if segments:
            print(f"✓ Guest segments found: {len(segments)}")
            for segment, count in segments:
                print(f"  - {segment}: {count:,}")
        
        return len(devices) > 0 or len(segments) > 0
    except Exception as e:
        print(f"✗ Error checking segmentation data: {e}")
        return False

def test_funnel_data():
    """Test 6: Verify funnel step data"""
    print_section("TEST 6: Funnel Data")
    try:
        funnel_steps = run_query("""
            SELECT 
                funnel_step,
                count(DISTINCT user_id) as unique_users,
                count(DISTINCT session_id) as sessions
            FROM raw_events
            WHERE funnel_step > 0
            GROUP BY funnel_step
            ORDER BY funnel_step
        """)
        if funnel_steps:
            print(f"✓ Found funnel steps:")
            for step, users, sessions in funnel_steps:
                print(f"  Step {step}: {users:,} users, {sessions:,} sessions")
            return True
        else:
            print("⚠ No funnel step data found (this might be okay)")
            return True  # Not critical
    except Exception as e:
        print(f"✗ Error checking funnel data: {e}")
        return False

def test_complex_query():
    """Test 7: Test a complex query (windowFunnel simulation)"""
    print_section("TEST 7: Complex Query Test")
    try:
        # Test a simple aggregation query similar to what the app uses
        result = run_query("""
            SELECT 
                count(DISTINCT session_id) as sessions,
                count(DISTINCT user_id) as users,
                avg(time_on_page_seconds) as avg_time_on_page
            FROM raw_events
            WHERE timestamp >= now() - INTERVAL 30 DAY
        """)
        if result:
            sessions, users, avg_time = result[0]
            print(f"✓ Complex query successful:")
            print(f"  - Sessions (last 30 days): {sessions:,}")
            print(f"  - Users (last 30 days): {users:,}")
            print(f"  - Avg time on page: {avg_time:.2f}s")
            return True
    except Exception as e:
        print(f"✗ Error in complex query: {e}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*70)
    print("  AZURE CLICKHOUSE CONNECTION VERIFICATION")
    print("="*70)
    
    tests = [
        ("Basic Connection", test_basic_connection),
        ("Table Existence", test_table_existence),
        ("Data Volume", test_data_volume),
        ("Locations", test_locations),
        ("Segmentation", test_segmentation_data),
        ("Funnel Data", test_funnel_data),
        ("Complex Queries", test_complex_query),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"✗ Test '{name}' crashed: {e}")
            results.append((name, False))
    
    # Summary
    print_section("TEST SUMMARY")
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Your Azure ClickHouse is ready to use.")
        return 0
    elif passed >= total - 1:  # Allow 1 non-critical test to fail
        print("\n⚠ Most tests passed. Review failures above.")
        return 0
    else:
        print("\n❌ Multiple tests failed. Please check your connection settings.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
