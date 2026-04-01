# RPT Monitor - Quick Deployment Guide

## 🚀 Start Application (30 seconds)

### Windows
```powershell
# Set execution policy (one-time only)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Run startup script
.\start-server.ps1
```

### Linux/macOS
```bash
npm run build
npm run pm2:start
```

---

## 📊 Check Status

```bash
npm run pm2:status      # Status
npm run pm2:logs        # View logs
npm run pm2:monit       # Real-time monitor
```

---

## 🌐 Access Application

- **Frontend**: `http://localhost:3000`
- **With Nginx**: `http://localhost` (port 80)

---

## 🛑 Stop Application

```bash
npm run pm2:stop        # Stop app
npm run pm2:delete      # Remove from PM2
```

---

## 📚 Full Setup Guide

See [PM2_NGINX_SETUP.md](./PM2_NGINX_SETUP.md) for:
- PM2 configuration details
- Nginx installation & setup
- Troubleshooting guide
- Production best practices
- Performance monitoring

---

## 🔧 Common Commands

```bash
npm run pm2:restart     # Restart
npm run pm2:logs        # View logs
npm run pm2:status      # Check status
npm run pm2:monit       # Monitor
npm run build           # Build for production
```

---

## ⚠️ Windows PM2 Note

If you encounter PM2 errors, use the provided scripts:
- `.\start-server.ps1`  (PowerShell - recommended)
- `start-server.bat`    (Batch file)

These scripts will auto-build and start the server.
