-- Migration 001: Initial schema
-- Creates all core tables for the RPT Monitor system

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('taxpayer', 'collector', 'admin', 'queue')),
  full_name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  phone_number TEXT,
  last_active_at TIMESTAMPTZ,
  assigned_collector_id INTEGER REFERENCES users(id),
  queue_number INTEGER,
  queue_date DATE,
  notified BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMPTZ,
  login_level INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id),
  registered_owner_name TEXT,
  pin TEXT,
  td_no TEXT,
  lot_no TEXT,
  address TEXT,
  kind TEXT,
  assessed_value NUMERIC DEFAULT '0',
  tax_due NUMERIC DEFAULT '0',
  status TEXT,
  last_payment_date TIMESTAMPTZ,
  total_area TEXT,
  ownership_type TEXT CHECK(ownership_type IN ('full', 'shared')),
  claimed_area TEXT,
  taxability TEXT,
  classification TEXT,
  old_pin TEXT,
  effectivity TEXT,
  remarks TEXT
);

CREATE TABLE IF NOT EXISTS property_owners (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  ownership_type TEXT CHECK(ownership_type IN ('full', 'shared')),
  claimed_area TEXT,
  UNIQUE(property_id, user_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id),
  taxpayer_id INTEGER REFERENCES users(id),
  amount NUMERIC NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL,
  collector_id INTEGER REFERENCES users(id),
  or_no TEXT,
  year TEXT,
  basic_tax NUMERIC,
  sef_tax NUMERIC,
  interest NUMERIC,
  discount NUMERIC,
  remarks TEXT,
  td_no TEXT
);

CREATE TABLE IF NOT EXISTS assessments (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id),
  taxpayer_id INTEGER REFERENCES users(id),
  assigned_collector_id INTEGER REFERENCES users(id),
  amount NUMERIC NOT NULL,
  year TEXT,
  assessed_value NUMERIC,
  basic_tax NUMERIC,
  sef_tax NUMERIC,
  interest NUMERIC,
  discount NUMERIC,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  td_no TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_role TEXT NOT NULL CHECK(target_role IN ('taxpayer', 'collector', 'all', 'queue_system')),
  created_at TIMESTAMPTZ NOT NULL,
  audio_data TEXT,
  audio_mime TEXT
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  recipient_id INTEGER NOT NULL REFERENCES users(id),
  subject TEXT,
  body TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  action_type TEXT NOT NULL,
  details TEXT NOT NULL,
  admin_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS taxpayer_logs (
  id SERIAL PRIMARY KEY,
  taxpayer_id INTEGER REFERENCES users(id),
  taxpayer_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'collector')),
  user_id INTEGER NOT NULL REFERENCES users(id),
  user_name TEXT NOT NULL,
  pins TEXT NOT NULL,
  time_in TIMESTAMPTZ NOT NULL,
  time_out TIMESTAMPTZ,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS login_patterns (
  id SERIAL PRIMARY KEY,
  word TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inquiries (
  id SERIAL PRIMARY KEY,
  sender_name TEXT NOT NULL,
  email TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'unread',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS barangays (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_computation_types (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  value TEXT UNIQUE NOT NULL,
  base_type TEXT NOT NULL CHECK(base_type IN ('standard', 'rpvara', 'denr', 'share')),
  description TEXT,
  special_case_hook TEXT NOT NULL DEFAULT 'none',
  effective_from DATE,
  effective_to DATE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
