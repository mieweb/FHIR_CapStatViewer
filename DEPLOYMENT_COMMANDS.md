# Deployment Commands Reference

## Step 0: Deploy Files to Production Server

```bash
# Create directory on production server (run from your local machine)
# Replace 'user' with your actual username
ssh user@fhircapstatviewer.os.mieweb.org "sudo mkdir -p /var/www/fhircapstatviewer.os.mieweb.org && sudo chown \$USER: /var/www/fhircapstatviewer.os.mieweb.org"

# Copy all files to the server
scp -r * user@fhircapstatviewer.os.mieweb.org:/var/www/fhircapstatviewer.os.mieweb.org/
```

## Step 1: Identify Your Web Server

Run these commands on your production server:

```bash
# Check for nginx
which nginx

# Check for Apache
which apache2 || which httpd

# Check what's actually running
ps aux | grep -E 'nginx|httpd|apache2' | grep -v grep

# Check web server version
nginx -v 2>/dev/null || apache2 -v 2>/dev/null || httpd -v 2>/dev/null
```

## Step 2: Verify Python Proxy Service

Your service should already be running:

```bash
# Check service status
sudo systemctl status fhir-proxy

# Test the proxy locally
curl "http://localhost:3001/?url=https://omg.webchartnow.com/webchart.cgi/fhir/metadata"
```

## Step 3: Configure Web Server

### If Apache (httpd or apache2):

```bash
# Enable required modules
sudo a2enmod proxy proxy_http headers rewrite ssl

# Copy configuration file
sudo cp apache-fhircapstatviewer.conf /etc/apache2/sites-available/

# Edit if needed (SSL paths, etc.)
sudo nano /etc/apache2/sites-available/apache-fhircapstatviewer.conf

# Enable the site
sudo a2ensite apache-fhircapstatviewer

# If you need to disable the default site:
# sudo a2dissite 000-default

# Test configuration
sudo apache2ctl configtest

# Reload Apache
sudo systemctl reload apache2
```

### If Nginx:

```bash
# Copy configuration file
sudo cp nginx.conf /etc/nginx/sites-available/fhircapstatviewer

# Edit to add SSL certificate paths
sudo nano /etc/nginx/sites-available/fhircapstatviewer

# Create symbolic link
sudo ln -s /etc/nginx/sites-available/fhircapstatviewer /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Step 4: Test the Complete Setup

```bash
# Test the proxy endpoint
curl "https://fhircapstatviewer.os.mieweb.org/proxy?url=https://omg.webchartnow.com/webchart.cgi/fhir/metadata"

# Should return FHIR JSON data
```

## Troubleshooting

### Check if proxy is listening:
```bash
sudo netstat -tlnp | grep 3001
# or
sudo ss -tlnp | grep 3001
```

### View proxy logs:
```bash
sudo journalctl -u fhir-proxy -f
```

### Check web server logs:

**Apache:**
```bash
sudo tail -f /var/log/apache2/fhircapstatviewer-error.log
sudo tail -f /var/log/apache2/fhircapstatviewer-access.log
```

**Nginx:**
```bash
sudo tail -f /var/log/nginx/fhircapstatviewer-error.log
sudo tail -f /var/log/nginx/fhircapstatviewer-access.log
```

### Restart services:
```bash
# Restart proxy service
sudo systemctl restart fhir-proxy

# Restart web server
sudo systemctl restart apache2  # or nginx
```
