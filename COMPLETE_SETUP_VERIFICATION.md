# RPT Monitor - Complete Production Setup & Verification

## ✅ Current Status

### Build: ✓ SUCCESSFUL
- Frontend built with Vite
- Backend compiled with TypeScript
- All assets optimized and ready

### Database: ✓ CONNECTED
- PostgreSQL on localhost:5433
- Database: rpt_monitor_data
- Connection pooling configured
- Tables initialized and ready

### Server: ✓ RUNNING
- Node.js server running on port 3000  
- Listening on all interfaces (0.0.0.0)
- Health check endpoint responding with 200 OK
- CORS headers configured
- Ready for Tailscale and Nginx

---

## 🚀 Quick Start Guide

### Option 1: Production Server (Recommended)
```powershell
# Without Nginx (direct server access on port 3000)
.\RUN_PRODUCTION.ps1

# With Nginx (reverse proxy on port 80)
.\RUN_PRODUCTION.ps1 -WithNginx
```

### Option 2: Development Server
```powershell
npm run dev
```

---

## 📊 Access Points

### Direct Server Access (Always Available)
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3000/api/**
- **Health Check**: http://localhost:3000/health

### Via Nginx (After Setup)
- **Frontend**: http://localhost
- **API**: http://localhost/api/**
- **Health Check**: http://localhost/health

### Via Tailscale (Cross-Device Access)
- **Frontend**: https://<tailscale-ip>:3000
- **API**: https://<tailscale-ip>:3000/api/**
- **From .env**: Already configured with Tailscale IPs (100.84.4.41)

---

## 🔧 Nginx Setup (Optional)

### Installation

#### Windows with Chocolatey
```powershell
# Install Chocolatey (if not already installed)
Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Nginx
choco install nginx
```

#### Windows Manual
1. Download: https://nginx.org/en/download.html
2. Extract to: C:\nginx
3. Add C:\nginx to PATH (optional)

#### Linux/WSL
```bash
sudo apt update && sudo apt install nginx
sudo systemctl enable nginx
```

### Configuration

#### Windows
```powershell
# Find Nginx installed location
Get-Command nginx

# Copy configuration
Copy-Item ".\nginx\rpt-monitor.conf" "C:\nginx\conf\nginx.conf"

# Test configuration
nginx -t

# Start Nginx
nginx

# Or as Windows service
Start-Service nginx
```

#### Linux
```bash
sudo cp ./nginx/rpt-monitor.conf /etc/nginx/sites-available/rpt-monitor
sudo ln -s /etc/nginx/sites-available/rpt-monitor /etc/nginx/sites-enabled/rpt-monitor
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Verify Nginx is Working
```powershell
# Test connection
curl http://localhost

# Should return the frontend HTML from your React app
```

---

## 🌍 Tailscale Network Setup

### Prerequisites
- Install Tailscale: https://tailscale.com/download
- All team members on the same Tailscale network

### Configuration

#### 1. Get Your Tailscale IP
```powershell
tailscale ip -4
# Output example: 100.84.4.41
```

#### 2. Update .env File
Edit `.env` and add your Tailscale IP to `ALLOWED_ORIGINS`:
```env
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://<your-tailscale-ip>:3000
```

#### 3. Access from Other Devices
From any device on your Tailscale network:
```
http://<server-tailscale-ip>:3000
```

#### 4. Enable DNS (Optional)
In Tailscale settings, enable "MagicDNS" for convenient DNS names if your server is named.

### Tailscale + Nginx
If both Tailscale and Nginx are running:
```
http://<server-tailscale-ip>   (port 80)
```

---

## 🧪 Verification Checklist

### System Health
- [x] Build successful (npm run build)
- [x] Database connected (localhost:5433)
- [x] Server running (port 3000)
- [x] Health endpoint responding (200 OK)
- [ ] Nginx installed (if using)
- [ ] Nginx configured correctly (if using)
- [ ] Tailscale connected (if needed)

### Test Commands
```powershell
# Test server is running
curl http://localhost:3000/health

# Test database connection
curl http://localhost:3000/api/users

# Test Nginx (if installed)
curl http://localhost

# Check running processes
Get-Process node
Get-Process nginx
```

### Port Usage
```powershell
# Verify ports are in use
netstat -ano | findstr ":3000"      # Node.js server
netstat -ano | findstr ":80"        # Nginx (if installed)
```

---

## 📋 Configuration Files

### Key Files
- **ecosystem.config.cjs** - PM2 configuration (Windows has named pipe issues)
- **nginx/rpt-monitor.conf** - Nginx reverse proxy configuration  
- **.env** - Environment variables and secrets
- **server.ts** - Node.js/Express backend
- **src/** - React frontend
- **dist/** - Built frontend assets
- **dist-server/server.js** - Compiled TypeScript server

### Environment Variables
```env
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Database
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=To!nk6125
DB_NAME=rpt_monitor_data
DB_SSL=false

# CORS
ALLOWED_ORIGINS=http://localhost:3000,...

# Security
JWT_SECRET=your-secret-key-change-in-prod

# Optional - Semaphore SMS API
SEMAPHORE_API_KEY=
SEMAPHORE_SENDER_NAME=
```

---

## ⚡ Performance Tuning

### Database Connection Pool
- Max connections: 20
- Connection timeout: 5 seconds
- Idle timeout: 10 seconds
- Keep-alive enabled

### Nginx Optimizations (if installed)
- Gzip compression enabled
- Static asset caching (30 days)
- Service worker no-cache
- Security headers configured
- Max upload size: 100MB

### Node.js Process
- Production build optimized
- No watch mode (faster startup)
- Auto-restart on crash (if using PM2)
- Memory limit: 500MB (if using PM2)

---

## 🔒 Security Notes

### Before Production
- [ ] Change `JWT_SECRET` in .env
- [ ] Update database password if needed
- [ ] Configure SSL/TLS for HTTPS
- [ ] Set up proper firewall rules
- [ ] Configure rate limiting
- [ ] Review security headers in Nginx config
- [ ] Enable database backups

### Headers Configured
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

---

## 🆘 Troubleshooting

### Port Already in Use
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <PID> /F
```

### Server Won't Start
```powershell
# Check build
npm run build

# Check logs
Get-Content ./logs/pm2-out.log
Get-Content ./logs/pm2-error.log

# Test directly
npm run dev
```

### Database Connection Failed
```powershell
# Check PostgreSQL is running
Get-Service postgresql-x64-*

# Verify connection
npm run dev   # Look for connection logs
```

### Nginx Issues
```powershell
# Test configuration
nginx -t

# Check error log
Get-Content "C:\nginx\logs\error.log" -Tail 20

# Check running
netstat -ano | findstr :80
```

---

## 📚 Next Steps

1. **Immediate**: Server is ready to use at http://localhost:3000
2. **Short-term**: Install and configure Nginx if needed for production
3. **Medium-term**: Set up Tailscale for remote team access
4. **Production**: Configure SSL/TLS and set up monitoring

---

## 📞 Support Resources

- **Vite Docs**: https://vitejs.dev/
- **Express Docs**: https://expressjs.com/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Nginx Docs**: https://nginx.org/en/docs/
- **Tailscale Docs**: https://tailscale.com/kb/
- **PM2 Docs**: https://pm2.keymetrics.io/docs/

