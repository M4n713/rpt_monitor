# PM2 & Nginx Setup - Summary

## ✅ What Was Configured

### 1. PM2 Configuration
- **File**: `ecosystem.config.js`
- **Features**:
  - Auto-detects Windows vs Linux/macOS for optimal config
  - Windows: Fork mode (single process) 
  - Linux/macOS: Cluster mode (multi-core load balancing)
  - Auto-restart on crashes (max 5 restarts)
  - Memory limit: 500MB per instance
  - Logging to `./logs/` directory
  - Environment variables for production/development

### 2. Nginx Configuration
- **File**: `nginx/rpt-monitor.conf`
- **Features**:
  - Reverse proxy to Node.js backend (port 3000)
  - Upstream load balancing (ready for multiple instances)
  - Static file serving with 30-day cache
  - Gzip compression (level 6)
  - Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
  - WebSocket support (Upgrade/Connection headers)
  - PWA service worker (no-cache headers)
  - File upload support (100MB max)
  - Health check endpoint (/health)

### 3. Startup Scripts
- **Windows PowerShell**: `start-server.ps1`
  - Auto-builds application
  - Starts Node.js server
  - Optional: Starts Nginx if installed
  
- **Windows Batch**: `start-server.bat`
  - Simpler alternative to PowerShell
  
- **Linux/macOS**: Use npm scripts directly

### 4. Package.json Scripts
Added 8 new npm commands:
```bash
npm run pm2:start       # Start PM2 in production
npm run pm2:dev         # Start PM2 in development
npm run pm2:stop        # Stop the app
npm run pm2:restart     # Restart the app
npm run pm2:delete      # Remove from PM2
npm run pm2:logs        # View logs
npm run pm2:monit       # Real-time monitoring
npm run pm2:status      # Check status
```

### 5. Documentation
- **QUICKSTART.md**: 30-second quick reference
- **PM2_NGINX_SETUP.md**: Comprehensive setup and troubleshooting guide

### 6. Logs Directory
- **logs/**: Created for PM2 output and error logs
  - `pm2-out.log`: Application output
  - `pm2-error.log`: Application errors

---

## 🚀 How to Start

### Windows (Easiest)
```powershell
.\start-server.ps1
```

### Linux/macOS
```bash
npm run build
npm run pm2:start
```

---

## 📊 Architecture

```
                    User Browser
                         ↓
       ┌────────────────────────────────┐
       │      Nginx (Port 80/443)       │
       │  - Static file serving         │
       │  - Reverse proxy               │
       │  - Gzip compression            │
       │  - Security headers            │
       └────────────────────────────────┘
                         ↓
       ┌────────────────────────────────┐
       │   PM2 Manager Node.js          │
       │  (Port 3000)                   │
       │  - Business logic              │
       │  - API endpoints               │
       │  - Database queries            │
       │  - Auto-restart on crash       │
       └────────────────────────────────┘
                         ↓
       ┌────────────────────────────────┐
       │  PostgreSQL Database           │
       │  (Configured in .env)          │
       └────────────────────────────────┘
```

---

## 🔧 Configuration Files

### ecosystem.config.js
PM2 configuration with:
- Process name: `rpt-monitor`
- Script: `./server.ts`
- Interpreter: `tsx` (TypeScript support)
- Environment variables for both modes
- Logging configuration
- Memory and restart policies

### nginx/rpt-monitor.conf
Nginx configuration with:
- Upstream: `rpt_monitor_backend` (localhost:3000)
- Server listening on port 80
- Static files from `dist/` directory
- Proxy rules for API requests
- Security and caching headers

### .env
Environment variables:
- `PORT`: 3000
- `HOST`: 0.0.0.0 (listening on all interfaces)
- `ALLOWED_ORIGINS`: localhost:3000, 127.0.0.1:3000
- Database credentials
- JWT secret
- Optional Semaphore SMS API key

---

## 💾 Logs Location

### PM2 Logs
- Error log: `./logs/pm2-error.log`
- Output log: `./logs/pm2-out.log`
- Viewable via: `npm run pm2:logs`

### Nginx Logs
- **Windows**: `C:\nginx\logs\`
- **Linux**: `/var/log/nginx/`
- **macOS**: `/usr/local/var/log/nginx/`

---

## 🐛 Troubleshooting Quick Links

**PM2 won't start on Windows?**
→ Use `start-server.ps1` or `start-server.bat` instead

**Port 80 already in use?**
→ See PM2_NGINX_SETUP.md "Port already in use" section

**App crashes immediately?**
→ Check `npm run pm2:logs` for error details

**Nginx can't connect to backend?**
→ Verify app is running: `npm run pm2:status`

---

## 📈 Performance Features

### Enabled by Default
- ✅ Code splitting (separate vendor/ui/utils chunks)
- ✅ Tree-shaking (unused code removed)
- ✅ Gzip compression (for all text files)
- ✅ Brotli compression (better compression ratio)
- ✅ PWA support (service worker)
- ✅ Image optimization tools (vite-imagetools)
- ✅ Browser caching (30 days for static assets)
- ✅ Cluster mode (on Linux/macOS)
- ✅ Auto-restart on crashes
- ✅ Memory limits

---

## 🔒 Security Features

### Built-in
- ✅ X-Frame-Options (clickjacking prevention)
- ✅ X-Content-Type-Options (MIME sniffing prevention)
- ✅ X-XSS-Protection (XSS prevention)
- ✅ Referrer-Policy
- ✅ CORS via backend
- ✅ JWT authentication
- ✅ Password hashing (bcryptjs)

### Optional
- [ ] SSL/TLS certificates (uncomment in nginx config)
- [ ] Rate limiting (configure in nginx)
- [ ] IP whitelist (configure in nginx)
- [ ] DDoS protection

---

## 📚 Next Steps

1. **Review**: Read `PM2_NGINX_SETUP.md` for detailed information
2. **Install Nginx** (optional): Follow the installation guide
3. **Start Server**: Use appropriate command for your OS
4. **Monitor**: Check `npm run pm2:logs` and `npm run pm2:monit`
5. **Configure**: Update `.env` with production values
6. **Deploy**: Follow production deployment checklist

---

## 📞 Support Resources

- **PM2 Docs**: https://pm2.keymetrics.io/
- **Nginx Docs**: https://nginx.org/en/docs/
- **Vite Docs**: https://vitejs.dev/
- **Node.js Docs**: https://nodejs.org/docs/

---

## Version Info

- PM2: 6.0.14+
- Vite: 6.2.0+
- Node.js: 18.0.0+ (recommended: 20+)
- Nginx: 1.20+ (if using)

Generated: March 30, 2026
