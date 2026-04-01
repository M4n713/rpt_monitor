# PostgreSQL Configuration for Security on Windows
# This file contains the settings you need to add/modify in postgresql.conf

# ============================================================
# FILE LOCATION:
# C:\Program Files\PostgreSQL\15\data\postgresql.conf
# (adjust version number based on your PostgreSQL version)
# ============================================================

# How to edit:
# 1. Open the file with Administrator privileges
# 2. Find each setting (use Ctrl+F)
# 3. Uncomment (remove #) and change the value
# 4. Save the file
# 5. Restart PostgreSQL:
#    net stop postgresql-x64-15
#    net start postgresql-x64-15

# ============================================================
# NETWORK & SECURITY
# ============================================================

# Listen on all interfaces (required for Tailscale access)
# FIND THIS LINE (around line 59):
# #listen_addresses = 'localhost'
# CHANGE TO:
listen_addresses = '*'

# ============================================================
# SSL/TLS CONFIGURATION
# ============================================================

# Enable SSL (encrypted database connections)
# FIND THIS LINE (around line 76):
# #ssl = off
# CHANGE TO:
ssl = on

# SSL certificate and key files
# FIND THESE LINES (around lines 78-79):
# #ssl_cert_file = 'server.crt'
# #ssl_key_file = 'server.key'
# CHANGE TO (use forward slashes or double backslashes):
ssl_cert_file = 'C:/Program Files/PostgreSQL/15/data/server.crt'
ssl_key_file = 'C:/Program Files/PostgreSQL/15/data/server.key'

# ============================================================
# LOGGING CONFIGURATION
# ============================================================

# Enable log collection
# FIND THIS LINE (around line 282):
# #logging_collector = off
# CHANGE TO:
logging_collector = on

# Log directory
# FIND THIS LINE (around line 285):
# #log_directory = 'log'
# CHANGE TO:
log_directory = 'log'

# Log filename pattern
# FIND THIS LINE (around line 289):
# #log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
# CHANGE TO (logs rotate daily with timestamp):
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'

# Truncate old log on rotation
# FIND THIS LINE (around line 296):
# #log_truncate_on_rotation = off
# CHANGE TO:
log_truncate_on_rotation = on

# Rotate logs daily
# FIND THIS LINE (around line 300):
# #log_rotation_age = '1d'
# CHANGE TO:
log_rotation_age = '1d'

# Rotate logs when size exceeds 100MB
# FIND THIS LINE (around line 304):
# #log_rotation_size = '10MB'
# CHANGE TO:
log_rotation_size = '100MB'

# ============================================================
# AUDIT LOGGING - Log Connections
# ============================================================

# Log connection attempts
# FIND THIS LINE (around line 325):
# #log_connections = off
# CHANGE TO:
log_connections = on

# Log disconnections
# FIND THIS LINE (around line 329):
# #log_disconnections = off
# CHANGE TO:
log_disconnections = on

# ============================================================
# AUDIT LOGGING - Log Statements
# ============================================================

# Log all SQL statements (verbose - use in test/staging first!)
# FIND THIS LINE (around line 444):
# #log_statement = 'none'
# CHANGE TO (options: none, ddl, mod, all):
log_statement = 'all'

# Log query duration (in milliseconds)
# FIND THIS LINE (around line 448):
# #log_duration = off
# CHANGE TO:
log_duration = on

# Only log statements taking longer than 1 second
# FIND THIS LINE (around line 451):
# #log_min_duration_statement = -1
# CHANGE TO (1000ms = 1 second; -1 = disabled):
log_min_duration_statement = 1000

# Statement timeout (max query execution time)
# FIND THIS LINE (around line 583):
# #statement_timeout = 0
# CHANGE TO (60000ms = 60 seconds):
statement_timeout = 60000

# ============================================================
# CONNECTION LIMITS
# ============================================================

# Maximum concurrent connections
# FIND THIS LINE (around line 63):
# max_connections = 100
# VERIFY/CHANGE TO:
max_connections = 100

# Reserve connections for superusers
# FIND THIS LINE (around line 65):
# #superuser_reserved_connections = 3
# CHANGE TO:
superuser_reserved_connections = 3

# Per-role connection limits (set via SQL):
# ALTER ROLE db_app CONNECTION LIMIT 20;
# ALTER ROLE db_viewer CONNECTION LIMIT 10;

# Idle transaction timeout (disconnect after 30 minutes of inactivity)
# FIND THIS LINE (around line 592):
# #idle_in_transaction_session_timeout = 0
# CHANGE TO (milliseconds: 1800000ms = 30min):
idle_in_transaction_session_timeout = 1800000

# ============================================================
# PERFORMANCE & OPTIMIZATION
# ============================================================

# Buffer pool (25% of available RAM, e.g., 4GB RAM = 1GB, 16GB RAM = 4GB)
# FIND THIS LINE (around line 110):
# #shared_buffers = 128MB
# CHANGE TO (example for 16GB system):
shared_buffers = 4GB

# Effective cache size (50-75% of available RAM)
# FIND THIS LINE (around line 131):
# #effective_cache_size = 4GB
# CHANGE TO (example for 16GB system):
effective_cache_size = 12GB

# Maximum worker processes
# FIND THIS LINE (around line 122):
# max_worker_processes = 8
# VERIFY/CHANGE TO (match your CPU count):
max_worker_processes = 8

# ============================================================
# RESTART POSTGRESQL AFTER CHANGES
# ============================================================

# Option 1: Command line
# net stop postgresql-x64-15
# net start postgresql-x64-15

# Option 2: Without restarting (for some settings)
# SELECT pg_reload_conf();

# ============================================================
# VERIFY CONFIGURATION
# ============================================================

# Connect to database and check settings:
# psql -U postgres -h localhost -p 5433

# View current setting:
# SHOW ssl;
# SHOW listen_addresses;
# SHOW logging_collector;
# SHOW log_filename;

# View all settings:
# SELECT name, setting FROM pg_settings WHERE name LIKE 'ssl%';

# ============================================================
# TROUBLESHOOTING
# ============================================================

# Check PostgreSQL error log if it won't start:
# C:\Program Files\PostgreSQL\15\data\log\postgresql-*.log

# Check if port 5433 is in use:
# netstat -ano | findstr :5433

# Force stop PostgreSQL (if it hangs):
# taskkill /F /IM postgres.exe

# ============================================================
