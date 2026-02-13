#!/usr/bin/env python3
"""
Test script to verify ClickHouse password
"""

import clickhouse_connect
import os
from dotenv import load_dotenv

load_dotenv()

host = os.getenv('CLICKHOUSE_HOST', 'localhost')
port = int(os.getenv('CLICKHOUSE_PORT', '8123'))
username = os.getenv('CLICKHOUSE_USERNAME', 'default')
password = os.getenv('CLICKHOUSE_PASSWORD', '')

print("="*70)
print("Testing ClickHouse Connection")
print("="*70)
print(f"Host: {host}")
print(f"Port: {port}")
print(f"Username: {username}")
print(f"Password: {'***' if password else '(empty)'}")
print("="*70)

# Test 1: Try with password from .env
print("\n1. Testing with password from .env...")
try:
    client = clickhouse_connect.get_client(
        host=host,
        port=port,
        username=username,
        password=password
    )
    result = client.query("SELECT 1")
    print("✅ SUCCESS! Connection works with current password.")
except Exception as e:
    print(f"❌ FAILED: {e}")
    
    # Test 2: Try with empty password
    print("\n2. Testing with empty password...")
    try:
        client = clickhouse_connect.get_client(
            host=host,
            port=port,
            username=username,
            password=''
        )
        result = client.query("SELECT 1")
        print("✅ SUCCESS! Connection works with EMPTY password.")
        print("💡 Your .env password might be wrong. Try setting CLICKHOUSE_PASSWORD=\"\"")
    except Exception as e2:
        print(f"❌ FAILED: {e2}")
        print("\n💡 Troubleshooting:")
        print("   - Password is required for this ClickHouse server")
        print("   - Verify the password on Azure VM:")
        print("     ssh into VM and check: /etc/clickhouse-server/users.xml")
        print("   - Or reset password on Azure VM")

print("\n" + "="*70)
