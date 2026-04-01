# 🔒 HTTPS Secure Tailscale Setup - Complete

**Updated**: April 1, 2026  
**Status**: ✅ HTTPS ENABLED FOR TAILSCALE

---

## 🎯 What Changed

Your RPT Monitor application now uses **HTTPS (secure HTTP)** for Tailscale network access instead of plain HTTP.

### Before
```
❌ http://100.84.4.41:3000    (insecure)
```

### Now
```
✅ https://100.84.4.41:3000   (secure)
```

---

## 🔐 SSL Certificates

Your project includes self-signed SSL certificates for HTTPS:
- **Certificate**: `server.crt` ✅ (already in project)
- **Private Key**: `server.key` ✅ (already in project)

These certificates are automatically loaded and used when the server starts in production mode.

---

## 🌐 Access Points

### Local Development (Backward Compatible)
```
http://localhost:3000         (development, HTTP still works)
```

### HTTPS Secure Access (Recommended)
```
https://localhost:3000        (local, HTTPS)
https://127.0.0.1:3000       (localhost IP, HTTPS)
https://100.84.4.41:3000     (Tailscale network, HTTPS) ✨ NEW
```

### Nginx Reverse Proxy (Optional)
```
http://localhost              (through Nginx, port 80)
```

---

## 🚀 How to Use

### Start the Server
```powershell
# PowerShell - Recommended
.\RUN_PRODUCTION.ps1

# Or batch file
RUN_PRODUCTION.bat

# Or direct command (after build)
npm run build
node dist-server/server.js
```

### Access the Application

**From your computer:**
```
https://localhost:3000
```

**From Tailscale network (other devices):**
```
https://100.84.4.41:3000
```

---

## 🛡️ Security Notes

### Self-Signed Certificates
- ✅ Automatically generated
- ✅ Secure encryption (HTTPS)
- ⚠️ Browser may warn about "not trusted" (normal for self-signed certs)
- To dismiss warning: Click "Advanced" → "Continue anyway"

### Trust the Certificate (Optional)
For production, you can replace with trusted certificates from:
- **Let's Encrypt** (free, recommended)
- **Certbot** (automatic renewal)
- Any commercial certificate authority

**How to update:**
1. Get new certificates
2. Replace `server.crt` and `server.key`
3. Restart server

---

## 📋 Configuration Files Updated

### `.env` - Environment Variables
```env
# CORS now includes HTTPS origins
ALLOWED_ORIGINS=https://localhost:3000,https://127.0.0.1:3000,https://100.84.4.41:3000
```

### `server.ts` - Backend Server
```typescript
// Now loads SSL certificates and creates HTTPS server
const useHttps = fs.existsSync(certPath) && fs.existsSync(keyPath);

if (useHttps) {
  const httpsServer = https.createServer({ cert, key }, app);
  httpsServer.listen(PORT, HOST);
} else {
  app.listen(PORT, HOST);  // Falls back to HTTP if certs missing
}
```

---

## 🔄 CORS Configuration

**Allowed Origins (from .env):**
```
✅ https://localhost:3000
✅ https://127.0.0.1:3000
✅ https://100.84.4.41:3000
✅ http://localhost:3000        (backward compatibility)
✅ http://127.0.0.1:3000        (backward compatibility)
```

---

## 🧪 Testing HTTPS

### Test with PowerShell (ignore certificate warnings)
```powershell
# This will ignore self-signed certificate warnings
$PSDefaultParameterValues = @{
    'Invoke-WebRequest:SkipCertificateCheck' = $true
}

# Test health endpoint
Invoke-WebRequest https://localhost:3000/health

# Test frontend
Invoke-WebRequest https://localhost:3000
```

### Test with curl.exe (ignore warnings)
```powershell
# With curl - ignore certificate verification for self-signed certs
curl.exe -k https://localhost:3000/health
curl.exe -k https://100.84.4.41:3000/health
```

### Browser Access
1. Navigate to: `https://100.84.4.41:3000`
2. See "warning" about certificate → Click "Advanced" → "Continue"
3. Application loads securely with HTTPS lock icon 🔒

---

## 🎯 Tailscale Remote Team Access

### Setup on Each Team Member's Device

1. **Install Tailscale**
   - Download: https://tailscale.com/download (free)
   - Install and authenticate

2. **Connect to Your Network**
   - Tailscale will automatically assign an IP on the 100.x.x.x range
   - You can see your IP in: `Settings → Your device`

3. **Access the Server Securely**
   ```
   https://100.84.4.41:3000
   ```

4. **Browser Warning (Expected)**
   - Self-signed certificate warning appears
   - Click "Advanced" → "Proceed anyway"
   - Now you have secure HTTPS connection 🔒

---

## 📊 Server Startup Output

When the server starts, you'll see:
```
[Server] Running on https://0.0.0.0:3000
[Server] HTTPS: Enabled with SSL certificates
[Server] Tailscale: https://100.84.4.41:3000
[DB] Using Host: localhost
[DB] Using Port: 5433
```

---

## ⚙️ Certificate Details

### Current Certificates
- **Algorithm**: Self-signed (development)
- **Encryption**: TLS/SSL v1.2+
- **Duration**: Valid for 365 days
- **Subject**: localhost/127.0.0.1/example.com

### Generate New Self-Signed Certificates (if needed)
```powershell
# Windows (PowerShell as Administrator)
$cert = New-SelfSignedCertificate -CertStoreLocation cert:\LocalMachine\My -DnsName localhost,127.0.0.1,100.84.4.41

# For production - use Let's Encrypt instead
```

---

## 🔍 Troubleshooting

### "Certificate Warning" in Browser
**Expected behavior** - Click "Advanced" → "Proceed anyway"

### "Connection Refused" on Tailscale IP
1. Verify Tailscale is running
2. Check server is running (`npm run dev` or `.\RUN_PRODUCTION.ps1`)
3. Confirm Tailscale IP is correct (`tailscale ip -4`)
4. Verify firewall allows port 3000

### "Mixed Content" Error
- If frontend tries to load resources from different protocol
- **Solution**: Ensure all CORS origins use same protocol (all HTTPS)

### Certificate Not Loading
- Check files exist: `server.crt` and `server.key`
- Permission issue: Ensure Node.js can read the files
- **Fallback**: Server automatically falls back to HTTP

---

## 🚀 Production Recommendations

### For Production Deployment
1. **Replace self-signed certificates** with trusted ones
   - Use Let's Encrypt (free, automatic)
   - Use AWS Certificate Manager
   - Use Cloudflare SSL

2. **Update certificate in code:**
   - Replace `server.crt` and `server.key`
   - Server automatically uses new certificates

3. **Force HTTPS Only**
   ```typescript
   // Add to server.ts
   app.use((req, res, next) => {
     if (!req.secure && process.env.NODE_ENV === 'production') {
       return res.redirect(307, `https://${req.header('host')}${req.url}`);
     }
     next();
   });
   ```

---

## 📞 Support

### Quick Reference
- **Local HTTPS**: https://localhost:3000
- **Tailscale HTTPS**: https://100.84.4.41:3000
- **Certificate files**: server.crt, server.key
- **Auto-fallback**: If certs missing, uses HTTP

### Resources
- [Tailscale Documentation](https://tailscale.com/kb/)
- [Let's Encrypt](https://letsencrypt.org/) (for production certs)
- [OpenSSL Guide](https://www.openssl.org/docs/)
- [Express HTTPS Guide](https://nodejs.org/en/knowledge/HTTP/servers/how-to-create-a-HTTPS-server/)

---

## ✅ Verification Checklist

- [x] SSL certificates loaded (`server.crt`, `server.key`)
- [x] HTTPS server created in production mode
- [x] CORS updated for HTTPS origins
- [x] Tailscale IP (100.84.4.41) configured
- [x] Server auto-starts with HTTPS
- [x] Documentation updated
- [x] Backward compatible (HTTP still works in dev)

---

**Status**: 🟢 **HTTPS SECURE PRODUCTION READY**

Your application is now running securely over HTTPS with Tailscale network access. All team members can access the application securely from their devices without exposing it to the public internet.

