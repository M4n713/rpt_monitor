# PostgreSQL pg_hba.conf - Access Control Configuration Guide
# This controls WHO can connect to PostgreSQL and HOW

# ============================================================
# FILE LOCATION:
# C:\Program Files\PostgreSQL\15\data\pg_hba.conf
# (adjust version number based on your PostgreSQL version)
# ============================================================

# IMPORTANT: Rules are matched top-to-bottom - FIRST MATCH WINS!
# More specific rules should come BEFORE general ones
# Always end with a REJECT rule to deny everything else

# ============================================================
# FORMAT:
# type   database   user     address         method
# ============================================================
# type:     local, host, hostssl, hostnossl
# database: all, specific database name, list
# user:     all, specific user, list
# address:  IP/netmask (CIDR), 0.0.0.0/0 = all IPv4
# method:   trust, reject, md5, scram-sha-256, ident, peer

# ============================================================
# DEFAULT SAFE CONFIGURATION FOR RPT MONITOR
# ============================================================

# TYPE   DATABASE             USER       ADDRESS         METHOD
# ======================================================================

# LOCAL CONNECTIONS (Unix socket - localhost only)
local   all                  all                         trust

# IPv4 LOCAL CONNECTIONS (localhost - 127.0.0.1)
host    all                  all         127.0.0.1/32    md5

# IPv6 LOCAL CONNECTIONS (localhost only)
host    all                  all         ::1/128         md5

# ======================================================================
# TAILSCALE TEAM ACCESS (RECOMMENDED)
# ======================================================================

# Allow db_app user from ANY Tailscale IP (100.x.x.x)
# This is convenient if team members change IPs frequently
host    rpt_monitor_data     db_app      100.0.0.0/8     md5

# Allow db_viewer user from ANY Tailscale IP
host    rpt_monitor_data     db_viewer   100.0.0.0/8     md5

# ======================================================================
# ALTERNATIVE: SPECIFIC TAILSCALE IPs (MORE RESTRICTIVE)
# ======================================================================
# Use this if you want to allow only specific team members
# Replace with actual Tailscale IPs from: tailscale ip -4

# Admin access from specific IP
# host    rpt_monitor_data     db_admin    100.65.168.30/32   md5

# App from multiple team member IPs
# host    rpt_monitor_data     db_app      100.65.168.30/32   md5
# host    rpt_monitor_data     db_app      100.72.154.45/32   md5
# host    rpt_monitor_data     db_app      100.88.12.15/32    md5

# Viewer access (read-only)
# host    rpt_monitor_data     db_viewer   100.65.168.30/32   md5

# ======================================================================
# DENY EVERYTHING ELSE (MUST BE LAST)
# ======================================================================

# Reject all connections not matched above
host    all                  all         0.0.0.0/0       reject
host    all                  all         ::/0            reject

# ============================================================
# AUTHENTICATION METHODS EXPLAINED
# ============================================================
#
# trust       - No password needed (ONLY for localhost)
# md5         - MD5 password encryption (legacy, still common)
# scram-sha-256
#             - SCRAM-SHA-256 password (most secure, requires PG 10+)
# reject      - Always reject connection
# ident       - Use operating system user identity (Unix only)
# peer        - Use peer authentication (Unix sockets only)
#
# For Tailscale access: Always use "md5" or "scram-sha-256"

# ============================================================
# COMMON IP RANGES
# ============================================================
#
# Tailscale IPs:         100.0.0.0/8      (100.0.0.0 to 100.255.255.255)
# Localhost IPv4:        127.0.0.1/32     (single IP)
# Localhost IPv6:        ::1/128          (single IP)
# All IPv4:              0.0.0.0/0        (any address)
# All IPv6:              ::/0             (any address)
# Private Network (RFC1918):  192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12

# ============================================================
# EXAMPLES FOR DIFFERENT SCENARIOS
# ============================================================

# --- Example 1: Only Local Access (Most Restrictive) ---
# local   all             all                         trust
# host    all             all         127.0.0.1/32    md5
# host    all             all         ::1/128         md5
# host    all             all         0.0.0.0/0       reject

# --- Example 2: Local + Tailscale (RECOMMENDED) ---
# local   all             all                         trust
# host    all             all         127.0.0.1/32    md5
# host    all             all         ::1/128         md5
# host    rpt_monitor_data db_app     100.0.0.0/8     md5
# host    rpt_monitor_data db_viewer  100.0.0.0/8     md5
# host    all             all         0.0.0.0/0       reject

# --- Example 3: Local + Specific Tailscale IPs (Most Restrictive) ---
# local   all             all                         trust
# host    all             all         127.0.0.1/32    md5
# host    all             all         ::1/128         md5
# host    rpt_monitor_data db_app     100.65.168.30/32 md5
# host    rpt_monitor_data db_app     100.72.154.45/32 md5
# host    all             all         0.0.0.0/0       reject

# --- Example 4: With Backup/Replication Server ---
# local   all             all                         trust
# host    all             all         127.0.0.1/32    md5
# host    all             all         ::1/128         md5
# # Backup server on Tailscale
# host    replication     db_admin    100.99.88.77/32 md5
# # Team access
# host    rpt_monitor_data db_app     100.0.0.0/8     md5
# host    rpt_monitor_data db_viewer  100.0.0.0/8     md5
# host    all             all         0.0.0.0/0       reject

# ============================================================
# SETUP STEPS
# ============================================================
#
# 1. Open C:\Program Files\PostgreSQL\15\data\pg_hba.conf
#    (or your PostgreSQL data directory)
#
# 2. Replace the existing rules with the RECOMMENDED configuration above
#
# 3. Save the file
#
# 4. Reload PostgreSQL configuration WITHOUT restarting:
#    psql -U postgres -h localhost -p 5433 -c "SELECT pg_reload_conf();"
#
#    OR restart PostgreSQL:
#    net stop postgresql-x64-15
#    net start postgresql-x64-15
#
# 5. Test connections:
#    psql -U db_app -h localhost -p 5433 -d rpt_monitor_data
#
# 6. From Tailscale device (replace 100.65.168.30 with your Tailscale IP):
#    psql -U db_app -h 100.65.168.30 -p 5433 -d rpt_monitor_data

# ============================================================
# TROUBLESHOOTING
# ============================================================
#
# "FATAL: no pg_hba.conf entry for host..."
# → Rule not found. Check name/IP in pg_hba.conf
# → Verify rule appears BEFORE reject rule
# → Check for typos in IP addresses
#
# "FATAL: password authentication failed for user..."
# → Password incorrect OR authentication method wrong
# → Verify user exists: psql -U postgres -c "\du"
# → Force password reset: ALTER USER db_app PASSWORD 'newpass';
#
# "connection refused"
# → PostgreSQL not running or listening on wrong address
# → Check: netstat -ano | findstr :5433
# → Verify: listen_addresses = '*' in postgresql.conf
#
# "SSL/TLS not available"
# → SSL not enabled in postgresql.conf
# → Certificate files not found or bad permissions
# → Check log: C:\Program Files\PostgreSQL\15\data\log\

# ============================================================
# SECURITY BEST PRACTICES
# ============================================================
#
# ✓ Use "scram-sha-256" for modern systems
# ✓ Always end with "host all all 0.0.0.0/0 reject"
# ✓ Be specific with IP ranges when possible
# ✓ Use "hostssl" for encrypted-only connections
# ✓ Monitor pg_stat_activity for suspicious connections
# ✓ Review logs regularly for failed auth attempts
# ✓ Change default passwords immediately
# ✓ Use strong passwords (16+ chars, mixed case, numbers, symbols)
#
# ✗ Never use "trust" for network connections
# ✗ Never expose postgres superuser on network
# ✗ Don't use default postgres password
# ✗ Don't allow 0.0.0.0/0 for sensitive databases

# ============================================================
