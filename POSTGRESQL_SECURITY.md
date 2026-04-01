# PostgreSQL Security Guide for Tailscale Team Access

## Overview
This guide secures your PostgreSQL database (port 5433) for team access via Tailscale VPN. **Never expose the database directly to the internet.**

---

## 🔒 Security Measures

### 1. **Create Dedicated Database Users (Not using postgres)**

The `postgres` superuser should NEVER be used in production. Create role-based users:

```sql
-- Connect as postgres superuser first
-- psql -U postgres -h localhost -p 5433

-- Create admin user (for backups and maintenance)
CREATE ROLE db_admin LOGIN PASSWORD 'strong-password-here' SUPERUSER;

-- Create app user (limited permissions for your Node.js app)
CREATE ROLE db_app LOGIN PASSWORD 'another-strong-password' CREATEDB;

-- Create read-only user (for team members who only need to view data)
CREATE ROLE db_viewer LOGIN PASSWORD 'viewer-password' NOLOGIN;

-- Grant permissions to app user
GRANT ALL PRIVILEGES ON DATABASE rpt_monitor_data TO db_app;
GRANT ALL PRIVILEGES ON SCHEMA public TO db_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO db_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO db_app;

-- Grant read-only access to viewer
GRANT CONNECT ON DATABASE rpt_monitor_data TO db_viewer;
GRANT USAGE ON SCHEMA public TO db_viewer;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO db_viewer;
```

---

### 2. **Update .env with New Credentials**

```env
# Use db_app user instead of postgres
DB_HOST=localhost
DB_PORT=5433
DB_USER=db_app
DB_PASSWORD=another-strong-password  # Use strong password!
DB_NAME=rpt_monitor_data
DB_SSL=true  # Enable SSL for encrypted connections
DB_SSL_REJECT_UNAUTHORIZED=true  # Verify server certificate
```

---

### 3. **Enable SSL/TLS for Database Connections**

PostgreSQL needs SSL certificates. Use the existing ones or generate new:

```powershell
# Check if certificates exist (you have server.crt and server.key)
ls *.crt, *.key

# If needed, generate self-signed certificates
openssl req -new -x509 -days 365 -nodes -out server.crt -keyout server.key -subj "/CN=localhost"
chmod 600 server.key  # Restrict permissions (important!)
```

**Configure PostgreSQL to use SSL** (Edit `postgresql.conf`):

```conf
# Find postgresql.conf (usually in PostgreSQL data directory)
# C:\Program Files\PostgreSQL\15\data\postgresql.conf

ssl = on
ssl_cert_file = 'C:/Program Files/PostgreSQL/15/data/server.crt'
ssl_key_file = 'C:/Program Files/PostgreSQL/15/data/server.key'
```

---

### 4. **Restrict Access with pg_hba.conf**

Control who can connect. Edit `pg_hba.conf`:

```conf
# Allow only localhost and specific Tailscale IPs

# IPv4 local connections
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5

# Tailscale team members (add your team's Tailscale IPs)
# Format: host database user ip-address/mask auth-method
host    rpt_monitor_data    db_app      100.0.0.0/8             md5

# Read-only viewer (example Tailscale IPs)
host    rpt_monitor_data    db_viewer   100.0.0.0/8             md5

# REJECT everything else
host    all             all             0.0.0.0/0               reject
```

**Restart PostgreSQL** after changes:

```powershell
# Windows
net stop postgresql-x64-15
net start postgresql-x64-15

# Or restart via Services
```

---

### 5. **Connection Pooling & Limits**

Prevent resource exhaustion. Edit `postgresql.conf`:

```conf
# Connection limits
max_connections = 100
superuser_reserved_connections = 3

# Per-role connection limits
ALTER ROLE db_app CONNECTION LIMIT 20;
ALTER ROLE db_viewer CONNECTION LIMIT 10;

# Session timeout (close idle connections after 30 min)
idle_in_transaction_session_timeout = '30 min'
```

---

### 6. **Enable Audit Logging**

Track who accesses the database. Edit `postgresql.conf`:

```conf
# Enable logging
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_truncate_on_rotation = on
log_rotation_age = '1d'
log_rotation_size = '100MB'

# Log connections and disconnections
log_connections = on
log_disconnections = on
log_duration = on  # Log query execution time

# Log all statements (verbose - use with caution)
log_statement = 'all'
log_statement_timeout = '60s'
```

---

### 7. **Row-Level Security (Optional but Recommended)**

Restrict data access based on user roles:

```sql
-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow users to see only their own data
CREATE POLICY user_isolation ON users
    USING (id = current_user_id());

-- Viewer can only read
CREATE POLICY viewer_read_only ON users
    AS PERMISSIVE
    FOR SELECT
    USING (true);
```

---

### 8. **Regular Backups**

Automated daily backups to protect data:

```powershell
# Create backup script: backup-db.ps1
$BackupDir = "C:\PostgreSQL\Backups"
$Date = Get-Date -Format "yyyy-MM-dd_HHmmss"
$BackupFile = "$BackupDir\rpt_monitor_$Date.sql"

pg_dump -U db_app -h localhost -p 5433 -d rpt_monitor_data > $BackupFile

# Compress to save space
Compress-Archive -Path $BackupFile -DestinationPath "$BackupFile.zip"
Remove-Item $BackupFile

Write-Host "Backup created: $BackupFile.zip"
```

**Schedule with Task Scheduler:**
```powershell
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-ExecutionPolicy Bypass -File C:\backup-db.ps1'
Register-ScheduledTask -TaskName "PostgreSQL Daily Backup" -Trigger $trigger -Action $action
```

---

## 🔐 Tailscale-Specific Security

### Get Team Members' Tailscale IPs

```powershell
# On your machine connected to Tailscale
tailscale ip -4
# Output: 100.65.168.30 (example)

# Each team member should run:
tailscale ip -4
# They'll get their own Tailscale IP
```

### Update pg_hba.conf with Team IPs

```conf
# Example with multiple team members
host    rpt_monitor_data    db_app      100.65.168.30/32        md5
host    rpt_monitor_data    db_app      100.72.154.45/32        md5
host    rpt_monitor_data    db_app      100.88.12.15/32         md5

# Or use CIDR range (safer for larger teams)
host    rpt_monitor_data    db_app      100.0.0.0/8             md5
```

---

## ✅ Verification Checklist

- [ ] Created dedicated users (db_app, db_admin, db_viewer)
- [ ] Updated .env with db_app credentials
- [ ] Enabled SSL in postgresql.conf
- [ ] Configured pg_hba.conf to restrict access
- [ ] Set connection limits per role
- [ ] Enabled audit logging
- [ ] Created backup script
- [ ] Tested connection from Tailscale IP
- [ ] Removed postgres from production usage
- [ ] Changed all default passwords

---

## 📋 Quick Setup Commands

```bash
# 1. Test connection from Tailscale device
psql -U db_app -h 100.65.168.30 -p 5433 -d rpt_monitor_data

# 2. Check active connections
SELECT datname, usename, application_name, state FROM pg_stat_activity;

# 3. View logs
cat "C:\Program Files\PostgreSQL\15\data\log\postgresql-*.log"

# 4. Check SSL status
SELECT datname, usename, ssl FROM pg_stat_ssl;
```

---

## ⚠️ Important Notes

1. **Never commit passwords** to git (already in .env)
2. **Use strong passwords**: 16+ chars, mixed case, numbers, symbols
3. **Share credentials securely**: Use password manager or encrypted file
4. **Disable unnecessary extensions** that team doesn't need
5. **Monitor for suspicious activity** in logs regularly
6. **Keep PostgreSQL updated** to latest security patches

---

## Troubleshooting

### "connection refused" from Tailscale IP
- Check if PostgreSQL is listening on all interfaces: `listen_addresses = '*'`
- Verify pg_hba.conf allows the Tailscale IP
- Ensure port 5433 is accessible (no firewall blocking)

### "FATAL: no pg_hba.conf entry"
- Add rule to pg_hba.conf before REJECT rules
- Reload: `SELECT pg_reload_conf();` or restart PostgreSQL

### "SSL error: certificate not found"
- Verify paths in postgresql.conf are correct
- Check file permissions on .crt and .key files
- Use absolute paths, not relative paths

### Performance Issues
- Check connection pool limits
- Monitor query logs for slow queries
- Use `EXPLAIN ANALYZE` to optimize queries

---

## Resources

- [PostgreSQL Security](https://www.postgresql.org/docs/current/sql-createrole.html)
- [SSL Setup](https://www.postgresql.org/docs/current/ssl-tcp.html)
- [Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Tailscale Documentation](https://tailscale.com/kb/)
