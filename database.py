import clickhouse_connect
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ClickHouse connection configuration from environment variables
# Falls back to localhost for local development
CLICKHOUSE_HOST = os.getenv('CLICKHOUSE_HOST', 'localhost')
CLICKHOUSE_PORT = int(os.getenv('CLICKHOUSE_PORT', '8123'))
CLICKHOUSE_USERNAME = os.getenv('CLICKHOUSE_USERNAME', 'default')
CLICKHOUSE_PASSWORD = os.getenv('CLICKHOUSE_PASSWORD', '')
CLICKHOUSE_SECURE = os.getenv('CLICKHOUSE_SECURE', 'false').lower() == 'true'

# Debug: Print connection details (hide password)
print(f"🔌 Connecting to ClickHouse:")
print(f"   Host: {CLICKHOUSE_HOST}")
print(f"   Port: {CLICKHOUSE_PORT}")
print(f"   Username: {CLICKHOUSE_USERNAME}")
print(f"   Password: {'***' if CLICKHOUSE_PASSWORD else '(empty)'}")

# Initialize ClickHouse client
try:
    client = clickhouse_connect.get_client(
        host=CLICKHOUSE_HOST,
        port=CLICKHOUSE_PORT,
        username=CLICKHOUSE_USERNAME,
        password=CLICKHOUSE_PASSWORD,
        secure=CLICKHOUSE_SECURE
    )
    print(f"✓ ClickHouse connected: {CLICKHOUSE_HOST}:{CLICKHOUSE_PORT}")
except Exception as e:
    print(f"✗ Failed to connect to ClickHouse: {e}")
    print(f"\n💡 Troubleshooting:")
    print(f"   1. Verify password in .env file is correct")
    print(f"   2. Check if username '{CLICKHOUSE_USERNAME}' exists on ClickHouse server")
    print(f"   3. Verify network connectivity to {CLICKHOUSE_HOST}:{CLICKHOUSE_PORT}")
    print(f"   4. Check if ClickHouse server requires password (currently: {'set' if CLICKHOUSE_PASSWORD else 'empty'})")
    raise

def run_query(query: str):
    """Execute a query and return result rows."""
    return client.query(query).result_rows

def test_connection():
    """Test the ClickHouse connection."""
    try:
        result = client.query("SELECT 1")
        return True, "Connection successful"
    except Exception as e:
        return False, str(e)