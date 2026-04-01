# Run RPT Monitor Build with PM2, Nginx & Tailscale

Complete guide to deploy with PM2 process manager, Nginx reverse proxy, and Tailscale network access.

---

## 🚀 Quick Start (5 minutes)

### Step 1: Build Application
```bash
npm run build
```

Output should show:
```
✓ 1798 modules transformed
✓ built in 6.88s
dist/index.html                0.73 kB
dist/js/vendor-B6eFNcWE.js    47.20 kB
dist/js/utils-CYInp8Xx.js     27.62 kB
```

### Step 2: Start with PM2
```bash
npm run pm2:start
```

### Step 3: Verify Running
```bash
npm run pm2:status
```

Should show:
```
status     ✓ online
↺ restarts 0
↻ uptime   10s
```

### Step 4: Access Application
- **Local**: http://localhost:3000
- **With Nginx**: http://localhost (port 80)
- **On Tailscale**: http://<tailscale-ip>:3000
- **Tailscale + Nginx**: http://<tailscale-ip> (port 80)

---

## 📋 Step-by-Step Guide

### Prerequisites Check

```bash
# Verify Node.js installed
node --version          # Should be 18.0+

# Verify npm installed
npm --version          # Should be 9.0+

# Verify PM2 installed globally
pm2 --version          # Should be 6.0+

# Verify Tailscale (optional but recommended)
tailscale --version    # If installed
```

### 1️⃣ Build for Production

```bash
cd c:\Users\USER\Desktop\rpt_monitor\rpt_monitor

# Build the application
npm run build
```

**What happens:**
- Vite bundles React code
- Code splitting: vendor, ui, utils chunks
- Tree-shaking removes unused code
- Gzip & Brotli compression created
- PWA files generated
- Output: `dist/` directory with optimized files

**Output files:**
- `dist/index.html` - Main HTML file
- `dist/js/` - JavaScript bundles (vendor, utils, ui, main)
- `dist/css/` - Compiled CSS
- `dist/manifest.webmanifest` - PWA manifest
- `dist/sw.js` - Service worker
- `.gz` and `.br` files - Pre-compressed versions

### 2️⃣ Configure Environment

Check `.env` file:
```bash
cat .env
```

Should contain:
```env
PORT=3000
HOST=0.0.0.0
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=To!nk6125
DB_NAME=rpt_monitor_data
JWT_SECRET=your-secret-key-change-in-prod
```

**For Tailscale access**, add your Tailscale IP:
```bash
# Example: if your Tailscale IP is 100.65.168.30
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://100.65.168.30:3000
```

Get your Tailscale IP:
```bash
tailscale ip -4    # Shows your Tailscale IPv4 address
```

### 3️⃣ Start with PM2

#### **Windows (Recommended)**

```powershell
# Option A: Use PowerShell script (handles everything)
.\start-server.ps1

# Option B: Direct PM2 command (may have permission issues)
npm run pm2:start

# Option C: Batch script
start-server.bat
```

#### **Linux/macOS**

```bash
npm run pm2:start
```

**What PM2 does:**
- Starts Node.js server on port 3000
- Monitors for crashes (auto-restart)
- Forks on Windows, clusters on Linux
- Logs to `./logs/pm2-*.log`
- Keeps running in background

### 4️⃣ Verify PM2 Status

```bash
# Check if running
npm run pm2:status

# View logs
npm run pm2:logs

# Real-time monitoring
npm run pm2:monit
```

### 5️⃣ Start Nginx (Optional)

#### **Windows**

```powershell
# If using Chocolatey
Start-Service nginx

# Or run directly
nginx

# Or use PowerShell script (includes Nginx)
.\start-server.ps1 -WithNginx
```

#### **Linux**

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### **macOS**

```bash
brew services start nginx
```

**Nginx config is at:**
- `./nginx/rpt-monitor.conf` (provided)
- Listens on port 80
- Proxies to localhost:3000
- Serves static files
- Adds security headers

### 6️⃣ Verify Access

```bash
# Test backend directly
curl http://localhost:3000

# Test Nginx (if running)
curl http://localhost

# Test Tailscale (replace with your IP)
curl http://100.65.168.30:3000
curl http://100.65.168.30        # With Nginx
```

---

## 🌐 Tailscale Configuration

### Enable Tailscale IP Access

1. **Start Tailscale**
```bash
tailscale up
```

2. **Get Your IP**
```bash
tailscale ip -4
# Example output: 100.65.168.30
```

3. **Add to `.env`**
```bash
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://100.65.168.30:3000
```

4. **Access from Tailscale Network**
- On another Tailscale-connected device:
  ```bash
  http://100.65.168.30:3000
  http://100.65.168.30       # With Nginx
  ```

### Test Tailscale Access

```bash
# On the RPT Monitor machine
tailscale status

# On another Tailscale machine
ping 100.65.168.30           # Should respond
curl http://100.65.168.30:3000   # Should return HTML
```

---

## 📊 Service Status & Logs

### PM2 Status
```bash
npm run pm2:status

# Detailed status
pm2 show rpt-monitor

# Real-time monitoring
npm run pm2:monit

# View logs
npm run pm2:logs --lines 50
npm run pm2:logs --err       # Errors only
```

### Nginx Status

**Windows:**
```powershell
# Check if running
netstat -ano | findstr :80
netstat -ano | findstr :443

# View error logs
Get-Content "C:\nginx\logs\error.log" -Tail 20
```

**Linux:**
```bash
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

**macOS:**
```bash
brew services list
tail -f /usr/local/var/log/nginx/error.log
```

---

## 🔄 Common Operations

### Restart Services
```bash
# Restart PM2 app
npm run pm2:restart

# Restart Nginx
Windows: nginx -s reload
Linux:   sudo systemctl reload nginx
macOS:   brew services restart nginx
```

### Stop Services
```bash
# Stop PM2
npm run pm2:stop

# Stop Nginx
Windows: nginx -s stop
Linux:   sudo systemctl stop nginx
macOS:   brew services stop nginx
```

### View Application
```bash
# In browser
http://localhost                 # Nginx (if running)
http://localhost:3000            # Direct to Node.js
http://100.65.168.30            # Tailscale + Nginx
http://100.65.168.30:3000       # Tailscale direct
```

---

## 🏗️ Architecture Flowchart

```
┌──────────────────────────────────────────────────────┐
│                  Your Local Network                   │
│  ┌────────────────────────────────────────────────┐  │
│  │         RPT Monitor Server (Windows)           │  │
│  │                                                 │  │
│  │  ┌──────────────┐      ┌──────────────┐       │  │
│  │  │  Nginx       │      │  PM2         │       │  │
│  │  │ (Port 80)    │─────▶│ (Port 3000)  │       │  │
│  │  └──────────────┘      └──────────────┘       │  │
│  │         ▲                     │                │  │
│  │         │                     ▼                │  │
│  │   localhost:80         PostgreSQL DB          │  │
│  └────────────────────────────────────────────────┘  │
│         ▲                                             │
└─────────┼─────────────────────────────────────────────┘
          │
┌─────────┼───────────────────────────────────┐
│  Tailscale Network                          │
│  (100.65.x.x)                              │
│         │                                   │
│    100.65.168.30:80 (Nginx)                │
│    100.65.168.30:3000 (Direct Node.js)     │
│         ▲                                   │
└─────────┼───────────────────────────────────┘
          │
   Other Tailscale Devices
   (phone, laptop, etc.)
```

---

## 🔒 Security for Tailscale

### CORS Configuration
Tailscale IPs are automatically allowed in `server.ts`:
```typescript
const isAllowed = allowedOrigins.some(ao => origin.startsWith(ao.trim())) || 
                  origin.includes('localhost') || 
                  origin.includes('100.');  // Tailscale support
```

### Firewall Rules
- **Don't** expose port 3000 to internet (use Nginx + Tailscale)
- **Keep** Tailscale VPN enabled
- **Use** HTTPS for production (see PM2_NGINX_SETUP.md)

### Environment Variables
Keep sensitive data in `.env`:
- Database credentials
- JWT secret
- API keys
- Do NOT commit to git

---

## 🐛 Troubleshooting

### "Build failed" error
```bash
# Check npm packages
npm install

# Try building again
npm run build

# Check for errors
npm run lint
```

### "PM2 not starting" (Windows)
```powershell
# Use startup script instead
.\start-server.ps1

# Or reset PM2
Remove-Item -Path "$env:USERPROFILE\.pm2" -Recurse -Force
npm run pm2:start
```

### "Port 3000 already in use"
```powershell
# Windows: Find process
netstat -ano | findstr :3000

# Kill it
taskkill /PID <PID> /F
```

### "Can't access from Tailscale"
```bash
# Check Tailscale IP
tailscale ip -4

# Verify app running
npm run pm2:status

# Check if port 3000 is listening
netstat -ano | findstr :3000

# Update .env with IP
ALLOWED_ORIGINS=...http://100.65.168.30:3000
```

### "Nginx can't connect to backend"
```bash
# Verify app on port 3000
curl http://localhost:3000

# Check Nginx config
nginx -t

# Review Nginx error log
# Windows: C:\nginx\logs\error.log
# Linux: /var/log/nginx/error.log
```

---

## 📈 Performance Monitoring

### Real-Time Dashboard
```bash
npm run pm2:monit
```

Shows:
- CPU usage
- Memory usage
- Process status
- Event log

### Check Memory Usage
```bash
npm run pm2:logs

# Or detailed info
pm2 show rpt-monitor
```

### Monitor Nginx
**Windows:**
```powershell
# Check connections
netstat -ano | findstr :80

# Check requests (if logging enabled)
Get-Content "C:\nginx\logs\access.log" -Wait
```

**Linux:**
```bash
tail -f /var/log/nginx/access.log
```

---

## 🚀 Deployment Checklist

Before going live:

- [ ] Run `npm run build` successfully
- [ ] Configure `.env` with production values
- [ ] Start PM2: `npm run pm2:start`
- [ ] Verify status: `npm run pm2:status`
- [ ] Test local access: http://localhost:3000
- [ ] (Optional) Start Nginx
- [ ] Test Nginx: http://localhost
- [ ] Enable Tailscale: `tailscale up`
- [ ] Get Tailscale IP: `tailscale ip -4`
- [ ] Update `.env` with Tailscale IP
- [ ] Test Tailscale access: http://100.65.168.30:3000
- [ ] Monitor logs: `npm run pm2:logs`
- [ ] Check for errors in console
- [ ] Test database connection
- [ ] Test API endpoints
- [ ] Configure SSL/TLS (production)
- [ ] Set up monitoring

---

## 📚 Complete Commands Reference

```bash
# Build
npm run build

# PM2 Management
npm run pm2:start           # Start (production)
npm run pm2:dev             # Start (development)
npm run pm2:stop            # Stop
npm run pm2:restart         # Restart
npm run pm2:delete          # Remove
npm run pm2:logs            # View logs
npm run pm2:status          # Check status
npm run pm2:monit           # Monitor

# Startup Scripts
.\start-server.ps1          # Windows (PowerShell)
.\start-server.ps1 -WithNginx  # With Nginx
start-server.bat            # Windows (Batch)

# Direct commands
npm run dev                 # Development server
npm run build               # Build for production
npm run lint                # Type checking
```

---

## ✅ What Happens on Build

1. **Vite Build**
   - Bundles React code
   - Optimizes assets
   - Creates code chunks (vendor, ui, utils, main)
   - Generates sourcemaps

2. **Compression**
   - Creates `.gz` files (gzip)
   - Creates `.br` files (brotli)
   - Server automatically uses best compression

3. **PWA**
   - Generates service worker (sw.js)
   - Creates manifest.webmanifest
   - Enables offline support

4. **Output Structure**
   ```
   dist/
   ├── index.html
   ├── manifest.webmanifest
   ├── sw.js (service worker)
   ├── registerSW.js
   ├── css/
   │   └── index-CSrYH67c.css (+ .gz, .br)
   ├── js/
   │   ├── vendor-B6eFNcWE.js (+ .gz, .br)
   │   ├── utils-CYInp8Xx.js (+ .gz, .br)
   │   ├── ui-Clxv_Kb6.js (+ .gz, .br)
   │   └── index-DDaXihBc.js (+ .gz, .br)
   └── pdf.worker.min.mjs (+ .gz, .br)
   ```

---

## 🎯 Summary

| Step | Command | Output |
|------|---------|--------|
| 1. Build | `npm run build` | `dist/` folder created |
| 2. Start PM2 | `npm run pm2:start` | App running on :3000 |
| 3. Check Status | `npm run pm2:status` | Shows running state |
| 4. Start Nginx | `nginx` or service command | Listening on :80 |
| 5. Access App | `http://localhost:3000` | RPT Monitor loads |
| 6. Check Logs | `npm run pm2:logs` | Shows any errors |

That's it! Your application is now running with PM2, Nginx, and ready for Tailscale access. 🎉
