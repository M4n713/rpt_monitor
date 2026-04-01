# PM2 & Nginx Deployment Guide

Complete setup guide for deploying RPT Monitor with PM2 process manager and Nginx web server.

## 🚀 Quick Start

### Windows (Recommended - Simple)

```powershell
# Allow scripts (one-time)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Run the startup script
.\start-server.ps1

# Or with Nginx
.\start-server.ps1 -WithNginx
```

### Windows (Alternative)
```cmd
start-server.bat
```

### Linux/macOS
```bash
npm run build
npm run pm2:start
```

---

## 📋 Prerequisites

- **Node.js** v18+ (check: `node --version`)
- **npm** (check: `npm --version`)
- **PM2** globally installed: `npm install -g pm2`
- **Nginx** (optional, for production): See installation section

---

## Part 1: PM2 Configuration

### About PM2

PM2 is a production process manager that:
- Restarts crashed apps automatically
- Manages multiple processes
- Clusters across CPU cores (Linux)
- Provides monitoring and logging
- Auto-starts on system boot

### Files

- **`ecosystem.config.js`** - PM2 configuration file
- **`logs/`** - Directory for PM2 logs
- **`start-server.ps1`** - PowerShell launcher (Windows)
- **`start-server.bat`** - Batch launcher (Windows)

### PM2 Commands

```bash
# Start app
npm run pm2:start              # Production
npm run pm2:dev                # Development

# Manage app
npm run pm2:status             # Check status
npm run pm2:logs               # View logs
npm run pm2:restart            # Restart app
npm run pm2:stop               # Stop app
npm run pm2:delete             # Remove from PM2

# Monitoring
npm run pm2:monit              # Real-time monitoring
```

### Windows Users - Important Note

**PM2 has permission issues with named pipes on Windows.**

**Solutions:**
1. **Recommended**: Use `start-server.ps1` or `start-server.bat` scripts
2. **Alternative**: Use WSL2 (Windows Subsystem for Linux) for better compatibility
3. **Last resort**: Run PM2 with elevated privileges (Run as Administrator)

### Save for Auto-Boot (Linux/macOS/WSL)

```bash
pm2 save
pm2 startup
# Follow the instructions printed to install as system service
```

---

## Part 2: Nginx Setup

### What is Nginx?

A high-performance web server that:
- Serves static files
- Proxies requests to Node.js backend
- Compresses responses
- Handles SSL/TLS
- Caches assets

### Architecture

```
User Request → Nginx (port 80/443)
                 ↓
           Node.js Server (port 3000)
                 ↓
             Database
```

### Installation

#### Windows with Chocolatey

```powershell
# Install Chocolatey (if needed)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Nginx
choco install nginx
```

#### Windows Manual Installation

1. Download from [nginx.org](http://nginx.org/en/download.html)
2. Extract to `C:\nginx`
3. Add to PATH (optional)

#### Windows WSL2

```bash
wsl
sudo apt update && sudo apt install nginx
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

#### macOS

```bash
brew install nginx
brew services start nginx
```

### Configuration

#### Windows (Chocolatey)

```powershell
# Find Nginx directory
choco list nginx -lo

# Copy configuration file
Copy-Item ".\nginx\rpt-monitor.conf" "C:\ProgramData\chocolatey\lib\nginx\tools\nginx-*/conf\nginx.conf"

# Test config
nginx -t

# Start Nginx
nginx

# Or as service
Start-Service nginx
```

#### Windows (Manual)

```powershell
# Copy config
Copy-Item ".\nginx\rpt-monitor.conf" "C:\nginx\conf\nginx.conf"

# Test
nginx -t

# Start
nginx
```

#### Linux

```bash
# Copy config
sudo cp ./nginx/rpt-monitor.conf /etc/nginx/sites-available/rpt-monitor

# Enable
sudo ln -s /etc/nginx/sites-available/rpt-monitor /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

#### macOS

```bash
# Copy config
sudo cp ./nginx/rpt-monitor.conf /usr/local/etc/nginx/nginx.conf

# Test
nginx -t

# Reload
brew services restart nginx
```

---

## Deployment Checklist

- [ ] `npm run build` - Build application
- [ ] Configure `.env` with production values
- [ ] Start process manager: `npm run pm2:start` or `start-server.ps1`
- [ ] Verify PM2 running: `npm run pm2:status`
- [ ] Install Nginx (if desired)
- [ ] Configure Nginx with `./nginx/rpt-monitor.conf`
- [ ] Test Nginx: `nginx -t`
- [ ] Start Nginx service
- [ ] Test application: Open `http://localhost` in browser
- [ ] Check logs: `npm run pm2:logs`
- [ ] Monitor performance: `npm run pm2:monit`

---

## Troubleshooting

### PM2 Won't Start (Windows)

**Error**: `connect EPERM //./pipe/rpc.sock`

**Solutions**:
```powershell
# Option 1: Use startup script
.\start-server.ps1

# Option 2: Delete PM2 cache and retry
Remove-Item -Path "$env:USERPROFILE\.pm2" -Recurse -Force
npm run pm2:start

# Option 3: Run as Administrator
# Right-click PowerShell → Run as Administrator
# Then try: npm run pm2:start

# Option 4: Use WSL2
wsl npm run pm2:start
```

### Port 80 or 3000 Already in Use

**Windows**:
```powershell
# Find process
netstat -ano | findstr :80
netstat -ano | findstr :3000

# Kill process
taskkill /PID <PID> /F
```

**Linux**:
```bash
# Find process
sudo lsof -i :80
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>
```

### Nginx Can't Connect to Backend

```bash
# Check if app is running
npm run pm2:status

# Verify app listening on 3000
# Windows: netstat -ano | findstr :3000
# Linux: sudo lsof -i :3000

# Test connection manually
curl http://localhost:3000

# Check Nginx logs
# Windows: C:\nginx\logs\error.log
# Linux: sudo tail -f /var/log/nginx/error.log
```

### App Crashes Immediately

```bash
# Check logs for errors
npm run pm2:logs

# Verify build succeeded
npm run build

# Check .env configuration
cat .env

# Test running directly
npm run dev
```

---

## Monitoring

### PM2 Monitor

```bash
# Real-time dashboard
npm run pm2:monit

# Detailed info
pm2 show rpt-monitor

# Watch logs
npm run pm2:logs
npm run pm2:logs --err          # Error logs only
```

### System Monitoring

**Windows**:
```powershell
# Check ports
netstat -ano

# Check processes
Get-Process node, nginx

# Check memory/CPU
Get-Process node | Select-Object Id, ProcessName, CPU, Memory
```

**Linux**:
```bash
# Check ports
sudo netstat -tlnp

# Check processes
ps aux | grep node
ps aux | grep nginx

# Monitor real-time
htop
```

---

## Production Best Practices

1. **Use Production Builds**
   ```bash
   npm run build
   NODE_ENV=production npm run pm2:start
   ```

2. **Configure Environment Variables**
   - Copy `.env.example` to `.env`
   - Update all sensitive values
   - Keep `.env` out of version control

3. **Setup Logging**
   - PM2 logs in `./logs/`
   - Review regularly for errors
   - Archive old logs

4. **Monitor Performance**
   - Use `npm run pm2:monit`
   - Set up email alerts
   - Monitor CPU/Memory regularly

5. **Regular Backups**
   - Backup database regularly
   - Backup configuration files
   - Backup logs

6. **SSL/TLS Setup** (Optional but Recommended)
   - Get certificate (Let's Encrypt, etc.)
   - Update Nginx config with cert paths
   - Uncomment HTTPS section in `nginx/rpt-monitor.conf`
   - Redirect HTTP to HTTPS

---

## Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Express.js Guide](https://expressjs.com/)
- [Vite Documentation](https://vitejs.dev/)
