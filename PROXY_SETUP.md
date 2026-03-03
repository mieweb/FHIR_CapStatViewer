# FHIR CapabilityStatement Viewer - Proxy Setup Guide

This guide explains how to deploy a server-side proxy to avoid reliance on third-party CORS proxies.

## Why Use a Server-Side Proxy?

Third-party CORS proxies (`api.allorigins.win`, `corsproxy.io`) may be:
- Blocked by corporate firewalls
- Restricted by ISPs or geographic regions
- Unreliable or slow
- Blocked by browser extensions

A server-side proxy hosted alongside your application solves these issues.

## Deployment Options

Choose the option that matches your server environment:

---

## Option 1: Python Proxy (Recommended - No Dependencies!)

### Requirements
- **Python 3.6+** (usually pre-installed on Linux servers)
- **No additional packages needed** - uses only Python standard library

### Deployment Steps

#### For Development/Testing:

```bash
# Make the script executable
chmod +x proxy-server.py

# Run on port 3001
python3 proxy-server.py 3001

# Or specify a different port
python3 proxy-server.py 8080
```

#### For Production with systemd:

1. **Create directory and copy files to your web server:**
   ```bash
   # SSH into your production server and create the directory
   # Note: Replace 'user' with your actual username
   ssh user@fhircapstatviewer.os.mieweb.org "sudo mkdir -p /var/www/fhircapstatviewer.os.mieweb.org && sudo chown \$USER: /var/www/fhircapstatviewer.os.mieweb.org"
   
   # Copy all files to your web root
   scp -r * user@fhircapstatviewer.os.mieweb.org:/var/www/fhircapstatviewer.os.mieweb.org/
   ```

2. **Install the systemd service:**
   ```bash
   # Copy service file
   sudo cp fhir-proxy.service /etc/systemd/system/
   
   # Edit the service file if needed (change paths, user, port)
   sudo nano /etc/systemd/system/fhir-proxy.service
   
   # Reload systemd
   sudo systemctl daemon-reload
   
   # Enable service to start on boot
   sudo systemctl enable fhir-proxy
   
   # Start the service
   sudo systemctl start fhir-proxy
   
   # Check status
   sudo systemctl status fhir-proxy
   ```

3. **Configure web server reverse proxy:**

   **First, identify your web server:**
   ```bash
   # Check for nginx
   which nginx
   
   # Check for Apache
   which apache2 || which httpd
   
   # Or check running processes
   ps aux | grep -E 'nginx|httpd|apache2' | grep -v grep
   ```

   **For Nginx:**
   ```bash
   # Copy nginx config
   sudo cp nginx.conf /etc/nginx/sites-available/fhircapstatviewer
   
   # Edit to add your SSL certificates
   sudo nano /etc/nginx/sites-available/fhircapstatviewer
   
   # Create symbolic link
   sudo ln -s /etc/nginx/sites-available/fhircapstatviewer /etc/nginx/sites-enabled/
   
   # Test configuration
   sudo nginx -t
   
   # Reload nginx
   sudo systemctl reload nginx
   ```

   **For Apache:**
   ```bash
   # Enable required modules
   sudo a2enmod proxy proxy_http headers rewrite ssl
   
   # Copy Apache config
   sudo cp apache-fhircapstatviewer.conf /etc/apache2/sites-available/
   
   # Edit to configure SSL certificates if needed
   sudo nano /etc/apache2/sites-available/apache-fhircapstatviewer.conf
   
   # Enable the site
   sudo a2ensite apache-fhircapstatviewer
   
   # Test configuration
   sudo apache2ctl configtest
   
   # Reload Apache
   sudo systemctl reload apache2
   ```
   
   **Note:** If SSL is already configured elsewhere (e.g., through a load balancer or existing virtual host), you may only need to add the `/proxy` location to your existing configuration.

4. **Test the proxy:**
   ```bash
   curl "https://fhircapstatviewer.os.mieweb.org/proxy?url=https://omg.webchartnow.com/webchart.cgi/fhir/metadata"
   ```

### Monitoring Python Proxy:

```bash
# Check service status
sudo systemctl status fhir-proxy

# View logs
sudo journalctl -u fhir-proxy -f

# Restart service
sudo systemctl restart fhir-proxy

# Stop service
sudo systemctl stop fhir-proxy
```

---

## Option 2: PHP Proxy (If PHP is available)

### Requirements
- PHP 5.4+ (with cURL extension enabled)
- Any web server (Apache, Nginx, etc.)

### Deployment Steps

1. **Upload the proxy file:**
   ```bash
   # Copy proxy.php to your web root
   cp proxy.php /path/to/fhircapstatviewer.os.mieweb.org/
   ```

2. **Verify PHP and cURL are enabled:**
   ```bash
   php -m | grep curl
   # Should show "curl"
   ```

3. **Test the proxy:**
   ```bash
   curl "https://fhircapstatviewer.os.mieweb.org/proxy.php?url=https://omg.webchartnow.com/webchart.cgi/fhir/metadata"
   ```

4. **Set permissions (if needed):**
   ```bash
   chmod 644 proxy.php
   ```

### Apache Configuration (optional)

If you want cleaner URLs, add to `.htaccess`:
```apache
RewriteEngine On
RewriteRule ^api/proxy$ proxy.php [QSA,L]
```

Then access as: `https://yourdomain.com/api/proxy?url=...`

---

## Option 2: PHP Proxy (If PHP is available)

### Requirements
- PHP 5.4+ (with cURL extension enabled)
- Any web server (Apache, Nginx, etc.)

### Deployment Steps

1. **Upload the proxy file:**
   ```bash
   # Copy proxy.php to your web root
   cp proxy.php /path/to/fhircapstatviewer.os.mieweb.org/
   ```

2. **Verify PHP and cURL are enabled:**
   ```bash
   php -m | grep curl
   # Should show "curl"
   ```

3. **Test the proxy:**
   ```bash
   curl "https://fhircapstatviewer.os.mieweb.org/proxy.php?url=https://omg.webchartnow.com/webchart.cgi/fhir/metadata"
   ```

4. **Configure web server to route /proxy to proxy.php:**
   
   **Nginx:**
   ```nginx
   location /proxy {
       rewrite ^/proxy(.*)$ /proxy.php$1 last;
   }
   ```
   
   **Apache (.htaccess):**
   ```apache
   RewriteEngine On
   RewriteRule ^proxy$ proxy.php [QSA,L]
   ```

---

## Option 3: Node.js Proxy (For dedicated Node.js servers)

### Requirements
- Node.js 14+ and npm
- PM2 or similar process manager (recommended)

### Deployment Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the proxy server:**
   ```bash
   # Development
   npm start

   # Production with PM2
   pm2 start proxy-server.js --name fhir-proxy
   pm2 save
   pm2 startup
   ```

3. **Configure proxy port:**
   Edit `proxy-server.js` or set environment variable:
   ```bash
   export PORT=3001
   npm start
   ```

4. **Set up reverse proxy (recommended):**

   **Nginx configuration:**
   ```nginx
   location /api/proxy {
       proxy_pass http://localhost:3001/proxy;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
   }
   ```

   **Apache configuration:**
   ```apache
   ProxyPass /api/proxy http://localhost:3001/proxy
   ProxyPassReverse /api/proxy http://localhost:3001/proxy
   ```

5. **Test the proxy:**
   ```bash
   curl "https://fhircapstatviewer.os.mieweb.org/api/proxy?url=https://omg.webchartnow.com/webchart.cgi/fhir/metadata"
   ```

---

## Application Configuration

The application (`app.js`) is already configured to:
1. **Try local proxy first:** `/proxy?url=` (works with Python, PHP, or Node.js proxy)
2. **Fall back to third-party proxies** if local proxy fails

### Custom Proxy URL

If your proxy is at a different path, update `app.js` line ~88:

```javascript
// Current default:
let localProxyUrl = window.location.origin + '/proxy?url=';

// For proxy.php directly:
let localProxyUrl = window.location.origin + '/proxy.php?url=';

// Or absolute URL:
let localProxyUrl = 'https://fhircapstatviewer.os.mieweb.org/proxy?url=';
```

---

## Testing

### Test Python proxy directly:
```bash
# Local development
curl "http://localhost:3001/?url=https://omg.webchartnow.com/webchart.cgi/fhir/metadata"

# Production with nginx
curl "https://fhircapstatviewer.os.mieweb.org/proxy?url=https://omg.webchartnow.com/webchart.cgi/fhir/metadata"
```

### Test PHP proxy directly:
```bash
curl "https://fhircapstatviewer.os.mieweb.org/proxy.php?url=https://omg.webchartnow.com/webchart.cgi/fhir/metadata"
```

### Expected response:
- HTTP 200 status
- JSON content type
- FHIR CapabilityStatement JSON data

### Test in the application:
1. Open browser console (F12)
2. Load a FHIR URL
3. Look for console messages:
   - ✅ "Attempting local proxy fetch to: ..."
   - ✅ "Local proxy fetch successful..."
   - ❌ "Local proxy failed, trying third-party proxy..." (if local proxy has issues)

---

## Security Considerations

### Current Security Features:
- ✅ HTTPS-only URLs enforced
- ✅ URL validation
- ✅ CORS headers properly configured
- ✅ 30-second timeout limit

### Optional Enhancements:

1. **Restrict allowed domains:**
   
   Edit `proxy.php` around line 25:
   ```php
   // Add after URL validation
   $allowedDomains = ['webchartnow.com', 'webchart.app', 'fhir.org'];
   $urlHost = parse_url($targetUrl, PHP_URL_HOST);
   $allowed = false;
   foreach ($allowedDomains as $domain) {
       if (strpos($urlHost, $domain) !== false) {
           $allowed = true;
           break;
       }
   }
   if (!$allowed) {
       http_response_code(403);
       echo json_encode(['error' => 'Domain not allowed']);
       exit();
   }
   ```

2. **Add rate limiting:**
   Consider using nginx `limit_req` module or PHP rate limiting libraries.

3. **Add authentication:**
   Require API key for proxy access if needed.

---

## Troubleshooting

### Python Proxy Issues:

**Service won't start:**
```bash
# Check Python 3 is available
python3 --version

# Check if port is already in use
sudo lsof -i :3001

# View detailed logs
sudo journalctl -u fhir-proxy -n 50 --no-pager
```

**Permission denied:**
```bash
# Make script executable
chmod +x proxy-server.py

# Or run directly with python3
python3 proxy-server.py 3001
```

**Cannot connect to proxy:**
```bash
# Check if service is running
sudo systemctl status fhir-proxy

# Check if port is listening
sudo netstat -tlnp | grep 3001

# Test proxy directly
curl "http://localhost:3001/?url=https://omg.webchartnow.com/webchart.cgi/fhir/metadata"
```

**Nginx 502 Bad Gateway:**
```bash
# Check if Python proxy is running
sudo systemctl status fhir-proxy

# Check nginx error log
sudo tail -f /var/log/nginx/error.log

# Verify proxy port in nginx config matches systemd service
grep proxy_pass /etc/nginx/sites-enabled/fhircapstatviewer
```

### PHP Proxy Issues:

**"Failed to fetch from FHIR server"**
- Check if cURL is enabled: `php -m | grep curl`
- Install if missing: `sudo apt-get install php-curl` (Ubuntu/Debian)
- Restart web server after installation

**"Only HTTPS URLs are allowed"**
- Make sure your FHIR URL starts with `https://`

**CORS errors still appearing**
- Verify the proxy file is accessible
- Check web server error logs
- Ensure PHP has internet access (check firewall rules)

### Node.js Proxy Issues:

**Port already in use:**
```bash
# Find process using port 3001
lsof -i :3001
# Kill it
kill -9 <PID>
# Or use different port
PORT=3002 npm start
```

**Dependencies missing:**
```bash
npm install
```

---

## Monitoring

### Check PHP proxy logs:
```bash
# Apache
tail -f /var/log/apache2/error.log

# Nginx
tail -f /var/log/nginx/error.log
```

### Check Node.js proxy logs with PM2:
```bash
pm2 logs fhir-proxy
pm2 monit
```

---

## Performance Tips

1. **Enable caching** (optional):
   Add caching headers to reduce repeated requests to FHIR servers.

2. **Use CDN** (if applicable):
   Route proxy requests through a CDN for better global performance.

3. **Monitor usage**:
   Set up logging to track proxy usage and identify issues.

---

## Support

For issues or questions:
- Check browser console for error messages
- Review proxy logs
- Test proxy endpoint directly with curl
- Verify FHIR server is accessible from your server

---

## Quick Reference

### File Locations:
- **Python Proxy:** `proxy-server.py` ⭐ (Recommended)
- **Systemd Service:** `fhir-proxy.service`
- **Nginx Config:** `nginx.conf`
- **PHP Proxy:** `proxy.php` (Alternative)
- **Node.js Proxy:** `proxy-server.js` (Alternative)
- **Package file:** `package.json` (for Node.js)
- **Application:** `app.js` (line ~88 for proxy URL)

### Test Commands:

**Python Proxy:**
```bash
# Start manually
python3 proxy-server.py 3001

# Check service
sudo systemctl status fhir-proxy

# View logs
sudo journalctl -u fhir-proxy -f

# Test directly
curl "http://localhost:3001/?url=https://fhir-server/metadata"

# Test through nginx
curl "https://yourdomain.com/proxy?url=https://fhir-server/metadata"
```

**PHP Proxy:**
```bash
# Test PHP proxy
curl "https://yourdomain.com/proxy.php?url=https://fhir-server/metadata"

# Check PHP modules
php -m | grep curl
```

**Node.js Proxy:**
```bash
# Test Node.js proxy
curl "http://localhost:3001/proxy?url=https://fhir-server/metadata"

# Check processes
pm2 list
```

### Quick Deploy (Python - Recommended):

```bash
# 1. Copy files to server
scp -r * user@your-server:/var/www/yoursite/

# 2. Install systemd service
sudo cp fhir-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable fhir-proxy
sudo systemctl start fhir-proxy

# 3. Configure nginx
sudo cp nginx.conf /etc/nginx/sites-available/yoursite
sudo ln -s /etc/nginx/sites-available/yoursite /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 4. Test
curl "https://yoursite.com/proxy?url=https://fhir-server/metadata"
```

