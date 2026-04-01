# PostgreSQL Tailscale Security - Quick Start Guide

**Goal**: Protect your PostgreSQL database for secure team access via Tailscale VPN

---

## 📋 Security Checklist (In Order)

### Phase 1: Create Secure Database Users (15 minutes)

- [ ] **Step 1**: Open Command Prompt/PowerShell
  ```powershell
  psql -U postgres -h localhost -p 5433
  ```

- [ ] **Step 2**: Run the SQL setup script
  ```powershell
  # Execute the SQL file to create roles and permissions
  psql -U postgres -h localhost -p 5433 -f setup-postgres-security.sql
  ```

- [ ] **Step 3**: Change default passwords
  ```sql
  -- Inside psql, run:
  ALTER USER db_app PASSWORD 'YourStrongPassword_App_2024!';
  ALTER USER db_viewer PASSWORD 'YourStrongPassword_Viewer_2024!';
  ALTER USER db_admin PASSWORD 'YourStrongPassword_Admin_2024!';
  ```

- [ ] **Step 4**: Verify users were created
  ```sql
  \du   -- Shows all database roles
  ```

### Phase 2: Update Application Configuration (5 minutes)

- [ ] **Step 5**: Update `.env` file
  ```env
  DB_USER=db_app
  DB_PASSWORD=YourStrongPassword_App_2024!
  DB_SSL=true
  DB_SSL_REJECT_UNAUTHORIZED=true
  ```

- [ ] **Step 6**: Test backend can connect
  ```powershell
  npm run dev
  # Check console for "Database connected" message
  ```

### Phase 3: Configure PostgreSQL for Encryption (10 minutes)

- [ ] **Step 7**: Generate or verify SSL certificates
  ```powershell
  # Check if they exist (should already have server.crt & server.key)
  ls server.crt, server.key
  ```

- [ ] **Step 8**: Edit `postgresql.conf` (Admin privileges required)
  
  Location: `C:\Program Files\PostgreSQL\15\data\postgresql.conf`
  
  Changes needed:
  ```conf
  # Line ~59: Allow all interfaces
  listen_addresses = '*'
  
  # Line ~76: Enable SSL
  ssl = on
  
  # Lines ~78-79: Set certificate paths
  ssl_cert_file = 'C:/Program Files/PostgreSQL/15/data/server.crt'
  ssl_key_file = 'C:/Program Files/PostgreSQL/15/data/server.key'
  ```

- [ ] **Step 9**: Enable audit logging
  ```conf
  # Line ~282: Enable logging
  logging_collector = on
  
  # Line ~325: Log connections
  log_connections = on
  
  # Line ~329: Log disconnections
  log_disconnections = on
  
  # Line ~444: Log all statements
  log_statement = 'all'
  ```

- [ ] **Step 10**: Restart PostgreSQL
  ```powershell
  net stop postgresql-x64-15
  net start postgresql-x64-15
  # Or restart via Services app
  ```

### Phase 4: Restrict Access to Tailscale IPs (10 minutes)

- [ ] **Step 11**: Get your Tailscale IP
  ```powershell
  tailscale ip -4
  # Example output: 100.65.168.30
  ```

- [ ] **Step 12**: Edit `pg_hba.conf` (Admin privileges required)
  
  Location: `C:\Program Files\PostgreSQL\15\data\pg_hba.conf`
  
  Replace everything with:
  ```conf
  # LOCAL CONNECTIONS
  local   all             all                         trust
  host    all             all         127.0.0.1/32    md5
  host    all             all         ::1/128         md5
  
  # TAILSCALE TEAM ACCESS (SECURE + CONVENIENT)
  host    rpt_monitor_data  db_app      100.0.0.0/8   md5
  host    rpt_monitor_data  db_viewer   100.0.0.0/8   md5
  
  # DENY EVERYTHING ELSE
  host    all             all         0.0.0.0/0       reject
  host    all             all         ::/0            reject
  ```

- [ ] **Step 13**: Reload PostgreSQL
  ```powershell
  # Option A: Reload without restart (preferred)
  psql -U postgres -h localhost -p 5433 -c "SELECT pg_reload_conf();"
  
  # Option B: Full restart
  net stop postgresql-x64-15
  net start postgresql-x64-15
  ```

### Phase 5: Verify Everything Works (10 minutes)

- [ ] **Step 14**: Test local connection
  ```powershell
  psql -U db_app -h localhost -p 5433 -d rpt_monitor_data
  # You should get a prompt without errors
  \q   # Exit
  ```

- [ ] **Step 15**: Check PostgreSQL is listening
  ```powershell
  netstat -ano | findstr :5433
  # Should show tcp listening on port 5433
  ```

- [ ] **Step 16**: Backup important data
  ```powershell
  pg_dump -U db_app -h localhost -p 5433 -d rpt_monitor_data > backup.sql
  ```

### Phase 6: Team Access Setup (5 minutes per team member)

- [ ] **Step 17**: Share credentials securely
  - [ ] Share `db_app` username and password via secure method (password manager, encrypted email)
  - [ ] Share Tailscale setup instructions
  - [ ] Share database connection details:
    ```
    Host: YOUR_TAILSCALE_IP (from Step 11)
    Port: 5433
    Database: rpt_monitor_data
    User: db_app
    Password: (from Step 3)
    SSL: Required
    ```

- [ ] **Step 18**: Team member connects from their Tailscale device
  ```bash
  # On team member's machine (after connecting to Tailscale)
  psql -U db_app -h 100.65.168.30 -p 5433 -d rpt_monitor_data
  # Replace 100.65.168.30 with your Tailscale IP from Step 11
  ```

---

## 🧪 Testing Checklist

Before considering setup complete:

- [ ] `db_app` can connect from localhost ✓
- [ ] `db_viewer` can connect from localhost ✓
- [ ] `db_admin` can connect from localhost ✓
- [ ] Backend (npm run dev) connects successfully with new credentials ✓
- [ ] Frontend loads and shows data ✓
- [ ] SSL certificates work (no warnings) ✓
- [ ] PostgreSQL logs connections (check logs directory) ✓
- [ ] Team member can connect via Tailscale IP ✓
- [ ] Team member can only read data (if using db_viewer) ✓

---

## 📁 Reference Files Created

| File | Purpose |
|------|---------|
| `setup-postgres-security.sql` | SQL script to create roles and permissions |
| `POSTGRESQL_SECURITY.md` | Detailed security guide (read before setup) |
| `POSTGRESQL_CONF_SETTINGS.md` | postgresql.conf configuration reference |
| `POSTGRESQL_PG_HBA_CONF.md` | pg_hba.conf access control reference |
| `SETUP_POSTGRES_SECURITY.bat` | Automated setup script (Windows) |
| `postgresql-tailscale-quickstart.md` | This file |

---

## ⚠️ Important Security Notes

1. **Change all default passwords** before considering setup complete
   - Use strong passwords: 16+ characters, mixed case, numbers, symbols
   - Store securely in password manager

2. **Never commit `.env` to git** (already excluded if you have .gitignore)
   ```
   # Verify in .gitignore:
   echo .env >> .gitignore
   ```

3. **Only expose database to Tailscale**
   - Never open port 5433 to the public internet
   - Never use `0.0.0.0/0` in pg_hba.conf
   - Always require SSL/TLS for network connections

4. **Monitor access logs regularly**
   ```powershell
   # Check failed login attempts
   Select-String "FATAL" "C:\Program Files\PostgreSQL\15\data\log\*.log"
   ```

5. **Backup regularly**
   ```powershell
   # Daily backup to file
   pg_dump -U db_app -h localhost -p 5433 -d rpt_monitor_data > "backup-$(Get-Date -Format 'yyyy-MM-dd').sql"
   ```

---

## 🆘 Troubleshooting

### Error: "FATAL: no pg_hba.conf entry for host"
- Rule not in pg_hba.conf
- Rule placed AFTER a reject rule (move before reject)
- IP address typo or doesn't match

### Error: "password authentication failed"
- Wrong password
- User doesn't exist (run `\du` to check)
- Wrong authentication method in pg_hba.conf

### Error: "connection refused"
- PostgreSQL not running: `net start postgresql-x64-15`
- Wrong port: Should be 5433, not 5432
- Check: `netstat -ano | findstr :5433`

### Error: "SSL error"
- Certificates not found or bad path
- Wrong permissions on .key file
- Check postgresql logs for details

### Error: "Could not connect to Tailscale IP"
- Team member not connected to Tailscale: `tailscale up`
- Wrong IP address used
- Firewall blocking port 5433
- Rule missing in pg_hba.conf

---

## 📞 Quick Commands

```powershell
# Check if PostgreSQL is running
netstat -ano | findstr :5433

# Connect as app user
psql -U db_app -h localhost -p 5433 -d rpt_monitor_data

# Check all database roles
psql -U postgres -h localhost -p 5433 -c "\du"

# View database size
psql -U postgres -h localhost -p 5433 -c "SELECT datname, size FROM pg_database_size('rpt_monitor_data');"

# Backup database
pg_dump -U db_app -h localhost -p 5433 -d rpt_monitor_data > backup.sql

# View PostgreSQL logs
Get-Content "C:\Program Files\PostgreSQL\15\data\log\*.log" -Tail 50

# Restart PostgreSQL
net stop postgresql-x64-15
net start postgresql-x64-15

# Check SSL status
psql -U postgres -h localhost -p 5433 -c "SHOW ssl;"

# View active connections
psql -U postgres -h localhost -p 5433 -c "SELECT datname, usename, application_name, state FROM pg_stat_activity;"
```

---

## ✅ You're Secure When

- ✓ Using dedicated `db_app` user (not postgres)
- ✓ Strong passwords on all roles
- ✓ SSL enabled and verified
- ✓ pg_hba.conf restricts to Tailscale IPs only
- ✓ Database not exposed to internet
- ✓ Access logs being monitored
- ✓ Regular backups in place
- ✓ Team members can access via Tailscale only

---

## 📚 Learn More

- [PostgreSQL Security Documentation]<https://www.postgresql.org/docs/current/auth-methods.html>
- [Tailscale Security](https://tailscale.com/kb/1080/cli/)
- [SSL Certificates Guide](https://www.postgresql.org/docs/current/ssl-tcp.html)
- [Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
