"""
Test script to call the funnel API with segments and see what happens
"""

import requests
import json

API_URL = "http://localhost:8000/api/funnel"

# Create a simple funnel with 2 steps and 1 segment
funnel_config = {
    "steps": [
        {
            "id": "1",
            "label": "Landed",
            "event_type": "Landed",
            "event_category": "hospitality",
            "filters": []
        },
        {
            "id": "2",
            "label": "Location Select",
            "event_type": "Location Select",
            "event_category": "hospitality",
            "filters": []
        }
    ],
    "view_type": "conversion",
    "completed_within": 1,
    "counting_by": "unique_users",
    "order": "strict",
    "segments": [
        {
            "id": "seg1",
            "name": "Mobile Users",
            "filters": [
                {
                    "property": "device_type",
                    "operator": "equals",
                    "value": "mobile"
                }
            ]
        }
    ]
}

print("\n" + "="*70)
print("TESTING FUNNEL API WITH SEGMENT")
print("="*70 + "\n")

print("1. Funnel Configuration:")
print(json.dumps(funnel_config, indent=2))

print("\n2. Sending request to API...")
try:
    response = requests.post(API_URL, json=funnel_config)
    
    print(f"\n3. Response Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("\n4. Response Data:")
        print(json.dumps(data, indent=2))
        
        if data.get("data"):
            print("\n5. Analysis:")
            for step in data["data"]:
                print(f"\n   Step: {step['step_name']}")
                print(f"   Visitors: {step.get('visitors', 0)}")
                if step.get('segments'):
                    print(f"   Segments: {step['segments']}")
                else:
                    print("   No segment data!")
        else:
            print("\n   ⚠️  No data returned!")
    else:
        print(f"\n   ✗ Error: {response.text}")
        
except Exception as e:
    print(f"\n   ✗ Exception: {e}")

print("\n" + "="*70)
print("TEST COMPLETE")
print("="*70 + "\n")
