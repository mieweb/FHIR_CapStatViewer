# Quick Start: Python Proxy Deployment

## Prerequisites
- Python 3.6+ (check: `python3 --version`)
- Nginx or Apache web server
- Root/sudo access to server

## 5-Minute Setup

### 1. Copy Files
```bash
# Create directory on production server (run from your local machine)
# Replace 'user' with your actual username (e.g., dcarlson)
ssh user@fhircapstatviewer.os.mieweb.org "sudo mkdir -p /var/www/fhircapstatviewer.os.mieweb.org && sudo chown \$USER: /var/www/fhircapstatviewer.os.mieweb.org"

# Upload all files to your web server
scp -r * user@fhircapstatviewer.os.mieweb.org:/var/www/fhircapstatviewer.os.mieweb.org/
```

### 2. Test Proxy Locally
```bash
# SSH to your server
ssh user@fhircapstatviewer.os.mieweb.org

# Navigate to directory
cd /var/www/fhircapstatviewer.os.mieweb.org

# Test the proxy
python3 proxy-server.py 3001

# In another terminal, test it works:
curl "http://localhost:3001/?url=https://omg.webchartnow.com/webchart.cgi/fhir/metadata"

# If you see FHIR JSON data, it's working! Press Ctrl+C to stop.
```

### 3. Install as System Service
```bash
# Update paths in service file if needed
sudo nano fhir-proxy.service

# Install service
sudo cp fhir-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable fhir-proxy
sudo systemctl start fhir-proxy

# Verify it's running
sudo systemctl status fhir-proxy
```

### 4. Configure Nginx
```bash
# Update nginx.conf with your SSL certificate paths
sudo nano nginx.conf

# Copy to nginx sites
sudo cp nginx.conf /etc/nginx/sites-available/fhircapstatviewer
sudo ln -s /etc/nginx/sites-available/fhircapstatviewer /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# If OK, reload nginx
sudo systemctl reload nginx
```

### 5. Test Full Setup
```bash
# Test the proxy through nginx
curl "https://fhircapstatviewer.os.mieweb.org/proxy?url=https://omg.webchartnow.com/webchart.cgi/fhir/metadata"

# Should return FHIR CapabilityStatement JSON
```

### 6. Test Application
Open in browser:
```
https://fhircapstatviewer.os.mieweb.org/?url=https://omg.webchartnow.com/webchart.cgi/fhir/metadata
```

Check browser console (F12) for:
```
✓ Attempting local proxy fetch to: https://fhircapstatviewer.os.mieweb.org/proxy?url=...
✓ Local proxy fetch successful, parsing JSON...
```

## Done! 🎉

Your users should now be able to access the application without proxy issues.

## Common Issues

**502 Bad Gateway:**
- Check if Python proxy is running: `sudo systemctl status fhir-proxy`
- Check logs: `sudo journalctl -u fhir-proxy -f`

**Connection Refused:**
- Verify port in nginx matches service (default: 3001)
- Check firewall allows connections from nginx to local port

**Still using third-party proxies:**
- Check browser console for proxy URL
- Verify `/proxy` path is accessible
- Test proxy directly with curl

## Monitoring

```bash
# Watch logs
sudo journalctl -u fhir-proxy -f

# Restart service
sudo systemctl restart fhir-proxy

# Check nginx logs
sudo tail -f /var/log/nginx/fhircapstatviewer-error.log
```

For detailed documentation, see PROXY_SETUP.md
