 #!/usr/bin/env python3
"""
ResortIQ Test Event Generator
Generates realistic test events to populate all 65+ filterable properties
"""

import requests
import random
from datetime import datetime, timedelta
import time

# Configuration
API_URL = "http://localhost:8000/api/track"
NUM_EVENTS = 1000

# Sample data for realistic events
LOCATIONS = ['Kalahari Texas', 'Kalahari Wisconsin', 'Kalahari Pennsylvania', 'Kalahari Ohio']
ROOM_TYPES = ['Standard Room', 'Deluxe Suite', 'Family Villa', 'Presidential Suite', 'Waterpark View']
DEVICES = ['desktop', 'mobile', 'tablet']
BROWSERS = ['chrome', 'safari', 'firefox', 'edge']
OS_LIST = ['windows', 'macos', 'ios', 'android', 'linux']
UTM_SOURCES = ['google', 'facebook', 'instagram', 'email', 'direct', 'bing']
UTM_MEDIUMS = ['cpc', 'organic', 'social', 'email', 'referral']
UTM_CAMPAIGNS = ['summer_sale', 'waterpark_promo', 'family_getaway', 'spring_break', 'winter_special']
GUEST_SEGMENTS = ['Family', 'VIP', 'Corporate', 'Couples', 'Groups', 'Unknown']
PAGE_CATEGORIES = ['landing', 'location', 'dates', 'rooms', 'addons', 'payment', 'confirmation']
EVENT_TYPES = ['page_view', 'click', 'scroll', 'form_interaction', 'form_submit', 'search', 'room_view', 'location_select', 'date_select']

# Form fields
FORM_FIELDS = ['email', 'first_name', 'last_name', 'phone', 'card_number', 'cvv', 'billing_address']
FORM_ERRORS = ['', 'Invalid email format', 'Required field', 'Card declined', 'Invalid phone number', 'Incorrect CVV']

# Search queries
SEARCH_QUERIES = ['waterpark', 'family room', 'spa', 'restaurant', 'kids activities', 'pool', 'suite', 'discount']

# Add-ons
ADDONS = ['Waterpark Passes', 'Spa Package', 'Breakfast Buffet', 'Late Checkout', 'Airport Shuttle']

def generate_user_id():
    """Generate a user ID (reuse some for multi-session users)"""
    return f"user_{random.randint(1, 200)}"

def generate_session_id():
    """Generate a session ID"""
    return f"sess_{int(time.time() * 1000)}_{random.randint(1000, 9999)}"

def generate_timestamp():
    """Generate timestamp within last 30 days"""
    days_ago = random.randint(0, 30)
    hours_ago = random.randint(0, 23)
    minutes_ago = random.randint(0, 59)
    timestamp = datetime.now() - timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)
    return timestamp.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

def generate_event():
    """Generate a realistic event with all properties"""
    event_type = random.choice(EVENT_TYPES)
    device = random.choice(DEVICES)
    
    # Base event
    event = {
        "event_type": event_type,
        "user_id": generate_user_id(),
        "session_id": generate_session_id(),
        "timestamp": generate_timestamp(),
        
        # Page properties
        "page_url": f"https://kalahari.com/{random.choice(PAGE_CATEGORIES)}",
        "page_title": f"{random.choice(['Book Now', 'Explore Rooms', 'Special Offers', 'Waterpark'])} - Kalahari Resorts",
        "page_category": random.choice(PAGE_CATEGORIES),
        "referrer_url": random.choice(['https://google.com', 'https://facebook.com', '', 'https://kalahari.com']),
        
        # Interaction properties (if click event)
        "element_selector": f"#{random.choice(['book-btn', 'room-card', 'search-btn', 'promo-banner'])}" if event_type == 'click' else "",
        "element_text": random.choice(['Book Now', 'View Rooms', 'Check Availability', 'Apply Discount']) if event_type == 'click' else "",
        "element_type": random.choice(['button', 'a', 'div', 'input']) if event_type == 'click' else "",
        "interaction_type": random.choice(['click', 'hover', 'focus', 'navigation']),
        "is_rage_click": random.random() < 0.05,  # 5% rage clicks
        "is_dead_click": random.random() < 0.03,  # 3% dead clicks
        "is_hesitation_click": random.random() < 0.10,  # 10% hesitation
        "hover_duration_ms": random.randint(0, 5000),
        "click_count_on_element": random.randint(1, 3),
        
        # Engagement properties
        "scroll_depth_percent": random.randint(0, 100) if event_type == 'scroll' else random.randint(20, 80),
        "scroll_speed_pixels_per_sec": random.randint(100, 1000),
        "time_on_page_seconds": random.randint(5, 300),
        "video_interaction": random.choice(['', '', '', 'play', 'pause', 'seek']),  # Sparse
        "file_download_name": random.choice(['', '', '', 'resort_map.pdf', 'menu.pdf']),  # Sparse
        
        # Form properties
        "form_field_name": random.choice(['', ''] + FORM_FIELDS) if event_type in ['form_interaction', 'form_submit'] else "",
        "form_field_value_length": random.randint(0, 50) if event_type in ['form_interaction', 'form_submit'] else 0,
        "form_corrections_count": random.randint(0, 3) if event_type == 'form_submit' else 0,
        "form_autofill_detected": random.random() < 0.3,  # 30% use autofill
        "form_validation_error": random.choice(FORM_ERRORS) if event_type == 'form_submit' else "",
        
        # Booking properties
        "funnel_step": random.randint(1, 8),
        "selected_location": random.choice([''] + LOCATIONS),  # Some events don't have location yet
        "selected_checkin_date": (datetime.now() + timedelta(days=random.randint(7, 90))).strftime("%Y-%m-%d"),
        "selected_checkout_date": (datetime.now() + timedelta(days=random.randint(10, 95))).strftime("%Y-%m-%d"),
        "nights_count": random.randint(1, 7),
        "selected_room_type": random.choice([''] + ROOM_TYPES),
        "selected_guests_adults": random.randint(1, 4),
        "selected_guests_children": random.randint(0, 3),
        "price_viewed_amount": round(random.uniform(100, 800), 2),
        "discount_code_attempted": random.choice(['', '', '', 'SUMMER20', 'FAMILY10', 'SAVE15']),
        "discount_code_success": random.random() < 0.7,  # 70% success rate
        "addon_viewed": random.choice([''] + ADDONS),
        "addon_added": random.random() < 0.4,  # 40% add addons
        "currency_code": "USD",
        "guest_segment": random.choice(GUEST_SEGMENTS),
        
        # Search properties
        "search_query": random.choice([''] + SEARCH_QUERIES) if event_type == 'search' else "",
        "search_results_count": random.randint(0, 50) if event_type == 'search' else 0,
        "search_filter_applied": random.choice(['', 'price:100-300', 'guests:4', 'date:2026-03-15']) if event_type == 'search' else "",
        
        # Device properties
        "device_type": device,
        "browser": random.choice(BROWSERS),
        "os": random.choice(OS_LIST),
        "screen_resolution": f"{random.choice([1920, 1366, 1440, 2560, 3840])}x{random.choice([1080, 768, 900, 1440, 2160])}",
        "viewport_width": random.randint(1024, 1920) if device == 'Desktop' else random.randint(375, 768),
        "viewport_height": random.randint(768, 1080) if device == 'Desktop' else random.randint(667, 1024),
        "connection_speed": random.choice(['4g', '3g', 'wifi', 'slow-2g', 'unknown']),
        
        # Marketing properties
        "utm_source": random.choice([''] + UTM_SOURCES),
        "utm_medium": random.choice([''] + UTM_MEDIUMS),
        "utm_campaign": random.choice([''] + UTM_CAMPAIGNS),
        "utm_content": random.choice(['', 'banner_a', 'banner_b', 'email_header', 'cta_1']),
        "is_returning_visitor": random.random() < 0.3,  # 30% returning
        
        # Performance properties
        "page_load_time_ms": random.randint(500, 5000),
        "api_response_time_ms": random.randint(100, 2000)
    }
    
    return event

def main():
    """Generate and send events"""
    print(f"🚀 Generating {NUM_EVENTS} test events...")
    print(f"📡 Sending to: {API_URL}")
    print()
    
    success_count = 0
    error_count = 0
    
    for i in range(NUM_EVENTS):
        event = generate_event()
        
        try:
            response = requests.post(API_URL, json=event, timeout=5)
            
            if response.status_code == 200:
                success_count += 1
                if (i + 1) % 100 == 0:
                    print(f"✅ Sent {i + 1}/{NUM_EVENTS} events (Success: {success_count}, Errors: {error_count})")
            else:
                error_count += 1
                print(f"❌ Event {i + 1} failed: {response.status_code} - {response.text}")
        
        except Exception as e:
            error_count += 1
            print(f"❌ Event {i + 1} error: {str(e)}")
        
        # Small delay to avoid overwhelming the server
        if i % 50 == 0:
            time.sleep(0.1)
    
    print()
    print("=" * 60)
    print(f"✅ Complete! Success: {success_count}/{NUM_EVENTS}")
    print(f"❌ Errors: {error_count}/{NUM_EVENTS}")
    print("=" * 60)
    print()
    print("🔍 Verify in ClickHouse:")
    print("   SELECT COUNT(*) FROM raw_events WHERE timestamp >= now() - INTERVAL 1 HOUR;")
    print()
    print("📊 Check data population:")
    print("   Run: clickhouse-client < ADD_MISSING_COLUMNS.sql")

if __name__ == "__main__":
    main()
