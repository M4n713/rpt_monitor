# Deploy: PM2 Backend + Nginx Frontend + Tailscale

Complete step-by-step guide to deploy RPT Monitor with:
- **PM2**: Process manager for Node.js backend (port 3000)
- **Nginx**: Web server for static frontend files (port 80)
- **Tailscale**: Secure remote access to your private network

---

## 🚀 Quick Start (10 minutes)

### Prerequisites
```powershell
# Verify requirements
node --version              # Should be 18.0+
npm --version              # Should be 9.0+
pm2 --version              # Should be 6.0+
nginx -v                   # Optional - for reverse proxy
tailscale --version        # Optional - for remote access
```

### One-Command Deployment (Windows)

```powershell
# Complete setup in one command
.\start-server.ps1 -WithNginx
```

This will:
1. ✅ Build frontend (npm run build)
2. ✅ Start backend with PM2 (port 3000)
3. ✅ Start Nginx (port 80)
4. ✅ Display access URLs

### Or Step-by-Step Deployment

```powershell
# Step 1: Build frontend
npm run build

# Step 2: Start backend with PM2
npm run pm2:start

# Step 3: Start Nginx
nginx

# Step 4: Verify running
npm run pm2:status
```

Then open browser:
- **Frontend via Nginx**: http://localhost
- **Backend direct**: http://localhost:3000

---

## 📋 Detailed Deployment Guide

### Step 1: Build Frontend for Production

```bash
cd c:\Users\USER\Desktop\rpt_monitor\rpt_monitor
npm run build
```

**Output:**
```
✓ 1798 modules transformed
✓ built in 6.88s

dist/index.html                         0.73 kB
dist/css/index-CSrYH67c.css            62.04 kB │ gzip: 11.39 kB
dist/js/vendor-B6eFNcWE.js             47.20 kB │ gzip: 16.39 kB
dist/js/utils-CYInp8Xx.js              27.62 kB │ gzip:  8.23 kB
dist/js/ui-Clxv_Kb6.js                  3.14 kB │ gzip:  1.44 kB
dist/js/index-DDaXihBc.js             956.69 kB │ gzip: 262.10 kB
```

**What was created:**
- `dist/` folder with optimized static files
- Gzip (`.gz`) and Brotli (`.br`) pre-compressed versions
- Service worker for PWA offline support
- Code split into: vendor, ui, utils, main chunks

### Step 2: Configure Environment Variables

**Edit `.env` file:**
```env
# Server Configuration
PORT=3000
HOST=0.0.0.0

# CORS - Allow localhost + Tailscale
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Database
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=To!nk6125
DB_NAME=rpt_monitor_data
DB_SSL=false

# Security
JWT_SECRET=your-secret-key-change-in-prod
```

**Important:** Keep `.env` secure - don't commit to git!

### Step 3: Start Backend with PM2

**Option A: Windows (Most Reliable)**

```powershell
# Use startup script (handles PM2 daemon issues)
.\start-server.ps1
```

**Option B: Direct PM2 Command**

```bash
# Start backend in production
npm run pm2:start

# Or in development with auto-reload
npm run pm2:dev

# Or directly
pm2 start ecosystem.config.cjs --env production
```

**What PM2 does:**
- Starts Node.js server on port 3000
- Monitors process (auto-restart on crash)
- Logs to `./logs/pm2-out.log` and `./logs/pm2-error.log`
- On Windows: fork mode (single process)
- On Linux: cluster mode (multi-core load balancing)

**Verify backend started:**
```bash
npm run pm2:status

# Output should show:
# ┌─────────────┬──────┬──────┬────┬──────┬────────┐
# │ App name    │ id   │ mode │ pid │ stat │ uptime │
# ├─────────────┼──────┼──────┼────┼──────┼────────┤
# │ rpt-monitor │ 0    │ fork │ 12345 │ online   │ 0s   │
# └─────────────┴──────┴──────┴────┴──────┴────────┘
```

**Test backend:**
```powershell
curl http://localhost:3000

# Should return HTML from dist/index.html
```

### Step 4: Start Nginx (Frontend Server)

#### **Windows with Chocolatey**

```powershell
# Start Nginx service
Start-Service nginx

# Or run directly
nginx

# Test configuration
nginx -t

# Output: nginx: the configuration file ... syntax is ok
```

#### **Windows Manual Installation**

```powershell
# If nginx.exe is in PATH
nginx

# Or from nginx directory
cd C:\nginx
nginx.exe

# Verify
netstat -ano | findstr :80
```

#### **Linux**

```bash
sudo systemctl start nginx
sudo systemctl enable nginx    # Auto-start on boot
sudo systemctl status nginx
```

#### **macOS**

```bash
brew services start nginx
brew services status nginx
```

**Verify Nginx started:**
```powershell
# Check port 80 is listening
netstat -ano | findstr :80

# Should show nginx.exe listening on 0.0.0.0:80
```

### Step 5: Verify Full Deployment

**Check all services running:**

```bash
# Backend status
npm run pm2:status

# Nginx status
netstat -ano | findstr :80
netstat -ano | findstr :3000

# Check logs
npm run pm2:logs
```

**Test all endpoints:**

```powershell
# Frontend via Nginx (port 80)
curl http://localhost

# Frontend via direct backend (port 3000)
curl http://localhost:3000

# API endpoint through backend
curl http://localhost:3000/health

# API through Nginx proxy
curl http://localhost/health
```

**Access in browser:**
- Frontend: http://localhost ✅
- Direct backend: http://localhost:3000 ✅

---

## 🌐 Enable Tailscale Remote Access

### Install & Setup Tailscale

```bash
# Windows: Download from tailscale.com or use Chocolatey
choco install tailscale

# macOS
brew install tailscale

# Linux
curl -fsSL https://tailscale.com/install.sh | sh
```

### Connect to Tailscale Network

```bash
# Start Tailscale
tailscale up

# This will open browser for authentication
# Follow the steps to connect to your Tailscale account
```

### Get Your Tailscale IP

```bash
# Display your IP in the Tailscale network
tailscale ip -4

# Example output:
# 100.65.168.30
```

### Update `.env` for Tailscale Access

**Add your Tailscale IP:**

```env
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://100.65.168.30:3000
```

**Save and verify CORS:**
```bash
# Check the value
cat .env | findstr ALLOWED_ORIGINS
```

### Restart Backend to Apply Changes

```bash
# Restart PM2 with new environment
npm run pm2:restart

# Or delete and restart
npm run pm2:delete
npm run pm2:start
```

### Test Tailscale Access (From Another Device)

**Connect another device to Tailscale:**

On another machine/phone connected to your Tailscale network:

```bash
# Test backend
curl http://100.65.168.30:3000

# Test Nginx proxy
curl http://100.65.168.30

# Or open in browser:
# http://100.65.168.30         (via Nginx)
# http://100.65.168.30:3000    (direct)
```

---

## 🏗️ Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────┐
│         Your Local Network (192.168.x.x)               │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │          Server Machine (Windows/Linux)          │   │
│  │                                                  │   │
│  │  ┌──────────┐      ┌──────────┐                │   │
│  │  │  Nginx   │      │   PM2    │                │   │
│  │  │  :80     │─────▶│ :3000    │                │   │
│  │  └──────────┘      └──────────┘                │   │
│  │       ▲                   │                     │   │
│  │  Port 80            Node.js Server             │   │
│  │  (Static files,     (APIs, Business Logic)     │   │
│  │   Compression,                                 │   │
│  │   Security)                 │                  │   │
│  │                             ▼                  │   │
│  │                      PostgreSQL DB             │   │
│  └──────────────────────────────────────────────────┘   │
│       ▲                                                  │
└───────┼──────────────────────────────────────────────────┘
        │
   ┌────────────────────────────────┐
   │   Tailscale VPN Network        │
   │   (100.65.x.x - Encrypted)     │
   │                                │
   │   100.65.168.30                │
   │   └─ :80  (Nginx)              │
   │   └─ :3000 (Backend)           │
   │        ▲                        │
   └────────┼────────────────────────┘
            │
     ┌──────────────┐
     │  Other Users │
     │  (Remote     │
     │   Devices)   │
     └──────────────┘
```

### Request Flow

**Client Request → Nginx → PM2/Node.js → Database:**

```
1. Browser: GET http://localhost/           (via Nginx)
   ↓
2. Nginx: Receive request on :80
   - Serve static files from dist/
   - Apply gzip compression
   - Add security headers
   ↓
3. If API request (starts with /api or /health):
   - Proxy to http://localhost:3000
   ↓
4. PM2/Node.js Backend:
   - Handle business logic
   - Query database
   - Return JSON response
   ↓
5. Nginx: Return response to client
   - Compress with gzip/brotli
   - Add caching headers
   ↓
6. Browser: Display UI or handle API response
```

---

## 📊 Service Management

### PM2 Commands

```bash
# Check status
npm run pm2:status

# View logs
npm run pm2:logs                # All logs
npm run pm2:logs --err          # Errors only
npm run pm2:logs --lines 100    # Last 100 lines

# Monitor in real-time
npm run pm2:monit

# Restart backend
npm run pm2:restart

# Stop backend
npm run pm2:stop

# Remove from PM2
npm run pm2:delete
```

### Nginx Commands

```powershell
# Start Nginx
nginx

# Reload config (after changes)
nginx -s reload

# Stop Nginx
nginx -s stop

# Test config
nginx -t

# Check if running
netstat -ano | findstr :80
```

### Check All Services

**Windows:**
```powershell
# List all listening ports
netstat -ano

# Check specific ports
netstat -ano | findstr :80
netstat -ano | findstr :3000

# Check processes
Get-Process node, nginx, postgres
```

**Linux:**
```bash
# Check ports
sudo lsof -i :80
sudo lsof -i :3000

# Check services
sudo systemctl status nginx
sudo systemctl status postgresql
```

---

## 🔀 Routing & Proxy Configuration

### Nginx Routes (From `nginx/rpt-monitor.conf`)

```nginx
# Static files (from dist/)
location ~* \.(js|css|png|jpg|gif|ico|svg|woff|woff2|ttf|eot)$ {
  root C:/nginx/html/dist;
  expires 30d;              # Cache for 30 days
  add_header Cache-Control "public, immutable";
}

# PWA manifest, robots.txt
location ~ ^/(manifest.webmanifest|robots.txt|sitemap.xml)$ {
  root C:/nginx/html/dist;
  add_header Cache-Control "public, max-age=604800";
}

# Service worker - no cache
location /sw.js {
  root C:/nginx/html/dist;
  add_header Cache-Control "no-store, no-cache";
  add_header Service-Worker-Allowed "/";
}

# API & backend requests - proxy to PM2
location / {
  proxy_pass http://localhost:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

### What This Means

| URL | Served By | Cached | Compression |
|-----|-----------|--------|-------------|
| `http://localhost/` | Nginx (dist/index.html) | No | Yes (gzip) |
| `http://localhost/js/vendor-*.js` | Nginx (from dist/) | 30 days | Yes |
| `http://localhost/css/index-*.css` | Nginx (from dist/) | 30 days | Yes |
| `http://localhost/api/*` | PM2 (proxied) | No | Yes |
| `http://localhost:3000/*` | PM2 (direct) | No | Yes |

---

## 🧪 Testing & Verification

### Test Build Output

```bash
# Check dist folder created
dir dist\

# Should show:
# - index.html
# - manifest.webmanifest
# - sw.js (service worker)
# - css/ folder          (with .gz and .br files)
# - js/ folder           (with vendor, utils, ui, index chunks)
```

### Test Backend Connection

```powershell
# Direct connection
curl http://localhost:3000
curl http://localhost:3000/health

# Via Nginx
curl http://localhost
curl http://localhost/health
```

### Test Frontend Serving

```powershell
# Check Nginx config loads correctly
nginx -t

# Output: nginx: the configuration file ... syntax is ok

# Test static file serving
curl http://localhost/index.html
curl http://localhost/manifest.webmanifest
```

### Test Tailscale (Remote)

From another Tailscale device:

```bash
# Get your server's Tailscale IP first
# On server: tailscale ip -4
# Example: 100.65.168.30

# From remote device:
ping 100.65.168.30
curl http://100.65.168.30
curl http://100.65.168.30:3000/api/health
```

---

## 🚀 Complete Deployment Checklist

- [ ] Database configured and running
- [ ] Run `npm run build` successfully
- [ ] Check `.env` has correct values
- [ ] Start PM2: `npm run pm2:start`
- [ ] Verify PM2: `npm run pm2:status`
- [ ] Test backend: `curl http://localhost:3000`
- [ ] Start Nginx: `nginx`
- [ ] Verify Nginx: `netstat -ano | findstr :80`
- [ ] Test frontend: http://localhost in browser
- [ ] Test Nginx proxy: `curl http://localhost/health`
- [ ] Enable Tailscale: `tailscale up`
- [ ] Get Tailscale IP: `tailscale ip -4`
- [ ] Update `.env`: Add Tailscale IP to ALLOWED_ORIGINS
- [ ] Restart PM2: `npm run pm2:restart`
- [ ] Test Tailscale: http://100.65.168.30 (from remote device)
- [ ] Monitor logs: `npm run pm2:logs`
- [ ] Check for errors
- [ ] Test all API endpoints
- [ ] Verify database connectivity
- [ ] Configure SSL/TLS (production)

---

## 🔒 Security Best Practices

### Network Security

```env
# .env - Only add trusted origins
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://100.65.168.30:3000

# Don't expose port 3000 to internet
# Firewall rules: Only allow Tailscale traffic
# Keep Tailscale VPN enabled on production
```

### Nginx Security Headers (Already Configured)

```nginx
# Prevent clickjacking
add_header X-Frame-Options "SAMEORIGIN";

# Prevent MIME sniffing
add_header X-Content-Type-Options "nosniff";

# XSS protection
add_header X-XSS-Protection "1; mode=block";

# Referrer policy
add_header Referrer-Policy "strict-origin-when-cross-origin";
```

### SSL/TLS (For Production)

Update Nginx config to enable HTTPS:

```nginx
# Uncomment in nginx/rpt-monitor.conf

server {
  listen 443 ssl http2;
  ssl_certificate /path/to/certificate.crt;
  ssl_certificate_key /path/to/private.key;
}

# Redirect HTTP to HTTPS
server {
  listen 80;
  return 301 https://$server_name$request_uri;
}
```

---

## 📈 Monitoring & Logs

### Real-Time Monitoring

```bash
# PM2 dashboard
npm run pm2:monit

# Shows:
# - CPU usage per process
# - Memory usage
# - Process uptime
# - Restart count
# - Event log
```

### Log Locations

```
PM2 Logs:
  - ./logs/pm2-out.log     (standard output)
  - ./logs/pm2-error.log   (error output)

Nginx Logs:
  - Windows: C:\nginx\logs\error.log
  - Linux:   /var/log/nginx/error.log
  - macOS:   /usr/local/var/log/nginx/error.log
```

### View Logs

```bash
# Latest PM2 logs
npm run pm2:logs

# Last 50 lines
npm run pm2:logs --lines 50

# Errors only
npm run pm2:logs --err

# Follow log (real-time)
npm run pm2:logs --lines 0 --nostream  # Doesn't work in PowerShell
# Better: tail -f ./logs/pm2-out.log
```

---

## 🐛 Troubleshooting

### PM2 Won't Start

```powershell
# Use startup script (recommended for Windows)
.\start-server.ps1

# Or reset PM2
Remove-Item -Path "$env:USERPROFILE\.pm2" -Recurse -Force
npm run pm2:start

# Or run as Administrator (Right-click PowerShell)
# Then: npm run pm2:start
```

### Nginx Can't Connect to Backend

```bash
# Verify backend running on 3000
npm run pm2:status
netstat -ano | findstr :3000

# Test connection manually
curl http://localhost:3000

# Check Nginx error log
# Windows: Get-Content C:\nginx\logs\error.log -Tail 20
```

### Port Already in Use

```powershell
# Find what's using port 80
netstat -ano | findstr :80

# Kill the process
taskkill /PID <PID> /F

# For port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Can't Access from Tailscale

```bash
# Verify Tailscale running
tailscale status

# Check your IP
tailscale ip -4

# Verify in .env
cat .env | findstr ALLOWED_ORIGINS

# Should include your Tailscale IP

# Restart backend to apply .env changes
npm run pm2:restart

# Test from remote device
ping 100.65.168.30
curl http://100.65.168.30:3000
```

---

## 📚 Commands Reference

```bash
# === BUILDING ===
npm run build               # Build frontend for production

# === PM2 (Backend) ===
npm run pm2:start          # Start backend (production)
npm run pm2:dev            # Start backend (development)
npm run pm2:stop           # Stop backend
npm run pm2:restart        # Restart backend
npm run pm2:delete         # Remove from PM2
npm run pm2:logs           # View logs
npm run pm2:status         # Check status
npm run pm2:monit          # Real-time monitoring

# === NGINX (Frontend) ===
nginx                      # Start Nginx
nginx -s reload           # Reload config
nginx -s stop             # Stop Nginx
nginx -t                  # Test config

# === TAILSCALE ===
tailscale up              # Connect to network
tailscale down            # Disconnect
tailscale status          # Check status
tailscale ip -4           # Show your IP

# === UTILITIES ===
npm run dev               # Dev server (hot reload)
npm run lint              # Type check
```

---

## 🎯 Summary

| Layer | Technology | Port | Purpose |
|-------|-----------|------|---------|
| Frontend | Nginx | 80 | Serve static files, reverse proxy |
| Backend | PM2 + Node.js | 3000 | API, business logic |
| Remote | Tailscale | 100.x.x.x | Secure VPN access |
| Database | PostgreSQL | 5433 | Store data |

**Deployment:**
1. Build frontend: `npm run build`
2. Start backend: `npm run pm2:start`
3. Start Nginx: `nginx`
4. Enable Tailscale: `tailscale up`
5. Access: http://localhost (or Tailscale IP)

That's it! Your RPT Monitor is now deployed with PM2, Nginx, and Tailscale. 🎉
