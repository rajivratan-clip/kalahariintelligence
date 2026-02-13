# Azure ClickHouse Connection Setup

## ✅ Configuration Complete

Your app is now configured to connect to Azure ClickHouse VM securely using environment variables.

## 📋 What Was Changed

1. **`database.py`** - Updated to use environment variables for connection
2. **`.env`** - Added Azure ClickHouse connection settings
3. **`requirements.txt`** - Added `python-dotenv` package
4. **`test_azure_connection.py`** - Created verification script

## 🔧 Configuration Details

### Connection Settings (in `.env`):
```env
CLICKHOUSE_HOST="cliperactclickhouseevents.fy1m1o2zewperbtrve0ofguxba.gx.internal.cloudapp.net"
CLICKHOUSE_PORT="8123"
CLICKHOUSE_USERNAME="default"
CLICKHOUSE_PASSWORD=""  # Add your password here if needed
CLICKHOUSE_SECURE="false"
```

## 🚀 How to Use

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Update Password (if needed)
Edit `.env` and add your ClickHouse password:
```env
CLICKHOUSE_PASSWORD="your_password_here"
```

### 3. Test Connection
Run the verification script:
```bash
python test_azure_connection.py
```

This will test:
- ✓ Basic connectivity
- ✓ Table existence
- ✓ Data volume
- ✓ Locations data
- ✓ Segmentation data
- ✓ Funnel data
- ✓ Complex queries

### 4. Start Your App
```bash
# Start the FastAPI backend
uvicorn api:app --reload

# Your app will now connect to Azure ClickHouse automatically!
```

## 🔄 Switching Between Local and Azure

### Use Azure (Production):
Keep `.env` with Azure settings (current state)

### Use Local (Development):
Temporarily change `.env`:
```env
CLICKHOUSE_HOST="localhost"
CLICKHOUSE_PORT="8123"
CLICKHOUSE_USERNAME="default"
CLICKHOUSE_PASSWORD=""
```

Or comment out the Azure settings and the app will default to localhost.

## 🔒 Security Notes

- ✅ `.env` file is in `.gitignore` - credentials won't be committed
- ✅ Connection uses environment variables - no hardcoded credentials
- ✅ Supports secure connections (set `CLICKHOUSE_SECURE="true"` if using HTTPS)

## 🌐 Network Access

Since your Azure VM hostname ends with `.internal.cloudapp.net`, you may need:

1. **Direct Access** - If you're on Azure network/VPN
2. **SSH Tunnel** - If accessing from outside:
   ```bash
   ssh -L 8123:localhost:8123 <username>@<azure-vm-ip>
   ```
   Then set `CLICKHOUSE_HOST="localhost"` in `.env`

## 🧪 Verify It's Working

After starting your app, check:
1. API health endpoint: `http://localhost:8000/health`
2. Should return: `{"status": "ok"}`
3. Check console output - should show: `✓ ClickHouse connected: ...`

## 📝 Troubleshooting

### Connection Refused
- Check if Azure VM firewall allows port 8123
- Verify you're on the correct network/VPN
- Try using SSH tunnel if external access

### Authentication Failed
- Verify username/password in `.env`
- Check ClickHouse user permissions

### Hostname Not Resolved
- If `.internal.cloudapp.net` doesn't resolve externally, use SSH tunnel
- Or use the VM's public IP address

## ✅ Next Steps

1. ✅ Run `test_azure_connection.py` to verify everything works
2. ✅ Start your app and test the `/health` endpoint
3. ✅ Test a few API endpoints that query ClickHouse
4. ✅ Once confident, you're ready to use Azure ClickHouse!
