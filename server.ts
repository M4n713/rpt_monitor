import express from 'express';
process.env.TZ = 'UTC';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cachedBarangays: { code: string, name: string }[] = [];

const updateBarangayCache = async () => {
  try {
    const { rows } = await dbQuery('SELECT code, name FROM barangays ORDER BY code ASC');
    cachedBarangays = rows;
  } catch (err) {
    // If table doesn't exist yet, use initial hardcoded list
    cachedBarangays = [
      { code: '0001', name: 'Batong Buhay' },
      { code: '0002', name: 'Buenavista' },
      { code: '0003', name: 'Burgos' },
      { code: '0004', name: 'Claudio Salgado' },
      { code: '0005', name: 'Ligaya' },
      { code: '0006', name: 'Paetan' },
      { code: '0007', name: 'Pag-asa' },
      { code: '0008', name: 'Sta. Lucia' },
      { code: '0009', name: 'San Vicente' },
      { code: '0010', name: 'Sto. Niño' },
      { code: '0011', name: 'Tagumpay' },
      { code: '0012', name: 'Victoria' },
      { code: '0013', name: 'Poblacion' },
      { code: '0014', name: 'San Agustin' },
      { code: '0015', name: 'Gen. Emilio Aguinaldo' },
      { code: '0016', name: 'Ibud' },
      { code: '0017', name: 'Ilvita' },
      { code: '0018', name: 'Lagnas' },
      { code: '0019', name: 'Malisbong' },
      { code: '0020', name: 'San Francisco' },
      { code: '0021', name: 'San Nicolas' },
      { code: '0022', name: 'Tuban' }
    ];
  }
};

const getLocationFromPin = (pin: string) => {
  if (!pin) return 'Unknown Location';
  // Standardize separator
  const sanitized = pin.replace(/\./g, '-');
  const parts = sanitized.split('-');
  if (parts.length < 3) return 'Unknown Location';

  const locationCode = parts[2];
  const b = cachedBarangays.find(br => br.code === locationCode);
  return b ? b.name : 'Unknown Location';
};

// --- SEMAPHORE SMS API CONFIGURATION ---
// Using API Key: 4c1082647be5c07e8019fbce60d45d2b
const SEMAPHORE_API_KEY = process.env.SEMAPHORE_API_KEY || '4c1082647be5c07e8019fbce60d45d2b'; 
const SEMAPHORE_SENDER_NAME = process.env.SEMAPHORE_SENDER_NAME || ''; // Optional: set if you have an approved sender name

const TELCO_PREFIXES = {
  'Smart/TNT/Sun': ['0907','0908','0909','0910','0912','0918','0919','0920','0921','0928','0929','0930','0931','0932','0933','0934','0938','0939','0940','0941','0942','0943','0946','0947','0948','0949','0950','0951','0960','0961','0963','0964','0968','0969','0970','0981','0989','0998','0999','0922','0923','0925'],
  'Globe/TM': ['0905','0906','0915','0916','0917','0926','0927','0935','0936','0937','0945','0953','0954','0955','0956','0965','0966','0967','0973','0975','0976','0977','0978','0979','0980','0994','0995','0996','0997'],
  'DITO': ['0991','0992','0993'],
  'GOMO': ['0976']
};

const getTelco = (phone: string) => {
  if (!phone) return 'Unknown';
  const clean = phone.replace(/[^0-9]/g, '');
  const prefix = clean.startsWith('63') ? '0' + clean.substring(2, 5) : clean.substring(0, 4);
  
  for (const [name, prefixes] of Object.entries(TELCO_PREFIXES)) {
    if (prefixes.includes(prefix)) return name;
  }
  return 'Local/Other';
};
// --------------------------------------------

const sendSMS = async (to: string, message: string) => {
  if (!to || !message) return;
  
  const formattedPhone = to.startsWith('09') ? to : (to.startsWith('63') ? '0' + to.substring(2) : to);
  const telco = getTelco(formattedPhone);

  console.log('--- SENT SMS (SEMAPHORE) ---');
  console.log(`TO: ${formattedPhone} (${telco})`);
  console.log(`MSG: ${message}`);
  console.log('----------------------------');

  try {
    const params = new URLSearchParams();
    params.append('apikey', SEMAPHORE_API_KEY);
    params.append('number', formattedPhone);
    params.append('message', message);
    if (SEMAPHORE_SENDER_NAME) params.append('sendername', SEMAPHORE_SENDER_NAME);

    const response = await fetch(`https://api.semaphore.co/api/v4/messages`, {
      method: 'POST',
      body: params
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[SEMAPHORE SUCCESS]', data);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`[SEMAPHORE ERROR] Status: ${response.status}`, errorText);
      return false;
    }
  } catch (err: any) {
    console.warn(`[SEMAPHORE FAILED] Network error connecting to Semaphore. ${err.message}`);
    return false;
  }
};
dotenv.config({ path: path.resolve(__dirname, '.env') });
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

// Initialize PostgreSQL Pool
const getPoolConfig = () => {
  const commonConfig = {
    connectionTimeoutMillis: 5000, // 5 seconds timeout
    idleTimeoutMillis: 10000,
    query_timeout: 10000, // 10 seconds query timeout
    keepAlive: true, // Keep connection alive
    max: 20, // Max clients in pool
  };

  const config: any = process.env.DATABASE_URL 
    ? { ...commonConfig, connectionString: process.env.DATABASE_URL }
    : {
        ...commonConfig,
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'rpt_monitor_data',
        password: process.env.DB_PASSWORD || 'To!nk6125',
        port: parseInt(process.env.DB_PORT || '5433'),
      };

  // Add SSL if requested or if using a cloud database URL (common for Neon/Supabase)
  const useSSL = process.env.DB_SSL === 'true' || 
                 (process.env.DATABASE_URL && (
                   process.env.DATABASE_URL.includes('neon.tech') || 
                   process.env.DATABASE_URL.includes('supabase.co') ||
                   process.env.DATABASE_URL.includes('render.com') ||
                   process.env.DATABASE_URL.includes('a0.pg.com')
                 ));

  if (useSSL) {
    config.ssl = {
      rejectUnauthorized: false
    };
  }

  console.log('[DB] Final Config (sanitized):', {
    user: config.user || 'from URL',
    host: config.host || 'from URL',
    database: config.database || 'from URL',
    port: config.port || 'from URL',
    ssl: !!config.ssl
  });

  return config;
};

const pool = new Pool(getPoolConfig());

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// DB Query Helper with Mock Fallback
const dbQuery = async (text: string | { text: string, timeout?: number }, params: any[] = []) => {
  if (dbInitStatus.mode === 'mock') {
    const queryText = (typeof text === 'string' ? text : text.text).trim();
    const lowerText = queryText.toLowerCase();
    
    // Helper to extract table name
    const getTable = (sql: string) => {
      const match = sql.match(/from\s+(\w+)|insert\s+into\s+(\w+)|update\s+(\w+)|delete\s+from\s+(\w+)/i);
      return match ? (match[1] || match[2] || match[3] || match[4]) : null;
    };

    const tableName = getTable(queryText);
    
    // SELECT logic
    if (lowerText.startsWith('select')) {
      if (lowerText.includes('count(*)')) {
        const table = tableName as keyof typeof mockStore;
        return { rows: [{ count: (mockStore[table] || []).length.toString() }] };
      }
      
      if (tableName && mockStore[tableName as keyof typeof mockStore]) {
        let rows = [...(mockStore[tableName as keyof typeof mockStore] as any[])];
        
        // Simple filtering for common cases
        if (lowerText.includes('where username =') || lowerText.includes('where lower(username) =')) {
          const username = params[0];
          rows = rows.filter(r => r.username.toLowerCase() === username.toLowerCase());
        }
        if (lowerText.includes('where last_active_at >')) {
          const threshold = params[0];
          rows = rows.filter(r => r.last_active_at > threshold);
        }
        if (lowerText.includes('where role =')) {
          const role = params[0];
          rows = rows.filter(r => r.role === role);
        }
        if (lowerText.includes('where id =')) {
          const id = params[0];
          rows = rows.filter(r => r.id === id);
        }
        if (lowerText.includes('where owner_id =')) {
          const ownerId = params[0];
          rows = rows.filter(r => r.owner_id === ownerId);
        }
        if (lowerText.includes('where assigned_collector_id =')) {
          const collectorId = params[0];
          rows = rows.filter(r => r.assigned_collector_id === collectorId);
        }
        
        return { rows };
      }
    }
    
    // INSERT logic
    if (lowerText.startsWith('insert into')) {
      const table = tableName as keyof typeof mockStore;
      if (table && mockStore[table]) {
        const newId = (mockStore[table] as any[]).length + 1;
        const newItem: any = { id: newId };
        
        // Extract column names from INSERT statement
        const colMatch = queryText.match(/\((.*?)\)/);
        if (colMatch) {
          const cols = colMatch[1].split(',').map(c => c.trim());
          cols.forEach((col, i) => {
            newItem[col] = params[i];
          });
        }
        
        (mockStore[table] as any[]).push(newItem);
        return { rows: [newItem], rowCount: 1 };
      }
    }
    
    // UPDATE logic
    if (lowerText.startsWith('update')) {
      const table = tableName as keyof typeof mockStore;
      if (table && mockStore[table]) {
        const idMatch = queryText.match(/where id = \$(\d+)/i);
        if (idMatch) {
          const idParamIndex = parseInt(idMatch[1]) - 1;
          const id = params[idParamIndex];
          const items = (mockStore[table] as any[]).filter(i => i.id === id);
          
          items.forEach(item => {
            const setMatch = queryText.match(/set\s+(.*?)\s+where/i);
            if (setMatch) {
              const sets = setMatch[1].split(',').map(s => s.trim());
              sets.forEach(s => {
                const parts = s.split('=');
                if (parts.length === 2) {
                  const col = parts[0].trim();
                  const valPlaceholder = parts[1].trim();
                  const valMatch = valPlaceholder.match(/\$(\d+)/);
                  if (valMatch) {
                    const valIndex = parseInt(valMatch[1]) - 1;
                    item[col] = params[valIndex];
                  } else if (valPlaceholder.toLowerCase() === 'null') {
                    item[col] = null;
                  }
                }
              });
            }
          });
          return { rowCount: items.length };
        }
      }
    }

    // DELETE logic
    if (lowerText.startsWith('delete')) {
      const table = tableName as keyof typeof mockStore;
      if (table && mockStore[table]) {
        const idMatch = queryText.match(/where id = \$(\d+)/i);
        if (idMatch) {
          const idParamIndex = parseInt(idMatch[1]) - 1;
          const id = params[idParamIndex];
          const initialLength = (mockStore[table] as any[]).length;
          mockStore[table] = (mockStore[table] as any[]).filter(i => i.id !== id);
          return { rowCount: initialLength - (mockStore[table] as any[]).length };
        }
      }
    }

    // Transaction commands (ignore in mock mode)
    if (['begin', 'commit', 'rollback'].includes(lowerText)) {
      return { rows: [], rowCount: 0 };
    }

    console.warn(`[Mock] Unhandled query: ${queryText}`);
    return { rows: [], rowCount: 0 };
  }
  
  return await pool.query(text, params);
};

// Log connection attempt with more detail
const poolConfig = getPoolConfig();
const hostInfo = poolConfig.connectionString ? 'URL from environment' : `${poolConfig.host}:${poolConfig.port}`;
console.log(`[DB] Attempting to connect to database at: ${hostInfo}`);
console.log(`[DB] User: ${poolConfig.user || 'N/A'}`);
console.log(`[DB] Database: ${poolConfig.database || 'N/A'}`);

// Ensure the server listens on all interfaces
const PORT = 3000;
const HOST = '0.0.0.0'; 



let dbInitStatus = {
  initialized: false,
  error: null as string | null,
  timestamp: null as string | null,
  mode: 'database' as 'database' | 'mock'
};

// Mock Data Store
const mockStore = {
  users: [] as any[],
  properties: [] as any[],
  property_owners: [] as any[],
  payments: [] as any[],
  assessments: [] as any[],
  messages: [] as any[],
  direct_messages: [] as any[],
  admin_logs: [] as any[],
  taxpayer_logs: [] as any[],
  login_patterns: [
    { id: 1, word: 'WELCOME' },
    { id: 2, word: 'ADMIN' },
    { id: 3, word: 'SECURE' }
  ]
};

// Initialize Database Schema with retries
const initDb = async (retries = 1, delay = 1000) => {
  let client;
  const isPrivateIp = poolConfig.host?.startsWith('100.') || poolConfig.host?.startsWith('192.168.') || poolConfig.host?.startsWith('10.') || poolConfig.host?.startsWith('172.');
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[DB] Connection attempt ${i + 1} of ${retries}...`);
      if (isPrivateIp) {
        console.warn(`[DB] WARNING: You are using a private IP (${poolConfig.host}). The cloud environment may not be able to reach this address without a tunnel (like ngrok).`);
      }
      
      await dbQuery('BEGIN');
      
      // Create Tables
      await dbQuery(`
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
          assessed_value NUMERIC NOT NULL,
          tax_due NUMERIC DEFAULT 0,
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

        -- Add columns if they missed the boat during initial creation
        ALTER TABLE properties ADD COLUMN IF NOT EXISTS kind TEXT;
        ALTER TABLE properties ADD COLUMN IF NOT EXISTS old_pin TEXT;
        ALTER TABLE properties ADD COLUMN IF NOT EXISTS effectivity TEXT;
        ALTER TABLE properties ADD COLUMN IF NOT EXISTS td_no TEXT;
        ALTER TABLE properties ADD COLUMN IF NOT EXISTS lot_no TEXT;
        ALTER TABLE properties ALTER COLUMN tax_due SET DEFAULT 0;
        ALTER TABLE properties ALTER COLUMN assessed_value DROP NOT NULL;
        ALTER TABLE properties ALTER COLUMN assessed_value SET DEFAULT 0;
        ALTER TABLE properties ALTER COLUMN tax_due DROP NOT NULL;


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
          collector_id INTEGER NOT NULL REFERENCES users(id),
          or_no TEXT,
          year TEXT,
          basic_tax NUMERIC,
          sef_tax NUMERIC,
          interest NUMERIC,
          discount NUMERIC,
          remarks TEXT
        );

        CREATE TABLE IF NOT EXISTS assessments (
          id SERIAL PRIMARY KEY,
          property_id INTEGER NOT NULL REFERENCES properties(id),
          taxpayer_id INTEGER NOT NULL REFERENCES users(id),
          assigned_collector_id INTEGER REFERENCES users(id),
          amount NUMERIC NOT NULL,
          year TEXT,
          basic_tax NUMERIC,
          sef_tax NUMERIC,
          interest NUMERIC,
          discount NUMERIC,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          target_role TEXT NOT NULL CHECK(target_role IN ('taxpayer', 'collector', 'all')),
          created_at TIMESTAMPTZ NOT NULL
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
          taxpayer_id INTEGER NOT NULL REFERENCES users(id),
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

        -- Apply migrations to existing tables
        DO $$ 
        BEGIN 
            ALTER TABLE users ALTER COLUMN last_active_at TYPE TIMESTAMPTZ USING last_active_at AT TIME ZONE 'UTC';
            ALTER TABLE properties ALTER COLUMN last_payment_date TYPE TIMESTAMPTZ USING last_payment_date AT TIME ZONE 'UTC';
            ALTER TABLE payments ALTER COLUMN payment_date TYPE TIMESTAMPTZ USING payment_date AT TIME ZONE 'UTC';
            ALTER TABLE assessments ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
            ALTER TABLE messages ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
            ALTER TABLE direct_messages ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
            ALTER TABLE admin_logs ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
            ALTER TABLE taxpayer_logs ALTER COLUMN time_in TYPE TIMESTAMPTZ USING time_in AT TIME ZONE 'UTC';
            ALTER TABLE taxpayer_logs ALTER COLUMN time_out TYPE TIMESTAMPTZ USING time_out AT TIME ZONE 'UTC';
            ALTER TABLE taxpayer_logs ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
            ALTER TABLE login_patterns ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
            ALTER TABLE inquiries ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS notified BOOLEAN DEFAULT FALSE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS queue_date DATE;
            ALTER TABLE taxpayer_logs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
            ALTER TABLE taxpayer_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
            ALTER TABLE taxpayer_logs ADD COLUMN IF NOT EXISTS role TEXT;
            ALTER TABLE taxpayer_logs ADD COLUMN IF NOT EXISTS pins TEXT;
            ALTER TABLE taxpayer_logs ADD COLUMN IF NOT EXISTS remarks TEXT;
            -- Update role constraint if needed
            BEGIN
              ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
              ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('taxpayer', 'collector', 'admin', 'queue'));
            EXCEPTION WHEN OTHERS THEN 
              -- Might already be updated or not supported
            END;
            ALTER TABLE properties ADD COLUMN IF NOT EXISTS taxability TEXT;
            ALTER TABLE properties ADD COLUMN IF NOT EXISTS classification TEXT;
            ALTER TABLE properties ADD COLUMN IF NOT EXISTS remarks TEXT;
            BEGIN
              ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_status_check;
            EXCEPTION WHEN OTHERS THEN END;
        EXCEPTION WHEN OTHERS THEN 
            -- Tables might not exist yet or columns already have types, ignore errors in script
        END $$;

        CREATE TABLE IF NOT EXISTS barangays (
          id SERIAL PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Alter taxpayer_logs to allow NULL time_out
      await dbQuery(`
        ALTER TABLE taxpayer_logs ALTER COLUMN time_out DROP NOT NULL;
      `).catch(e => console.log('Alter table time_out failed (might already be nullable):', e.message));

      await dbQuery(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS login_level INTEGER DEFAULT 1;
      `).catch(e => console.log('Alter table users login_level failed:', e.message));

      // Alter payments to allow NULL collector_id
      await dbQuery(`
        ALTER TABLE payments ALTER COLUMN collector_id DROP NOT NULL;
      `).catch(e => console.log('Alter table collector_id failed:', e.message));

      // Robust Property Migrations
      await dbQuery('ALTER TABLE properties ADD COLUMN IF NOT EXISTS taxability TEXT').catch(() => {});
      await dbQuery('ALTER TABLE properties ADD COLUMN IF NOT EXISTS classification TEXT').catch(() => {});
      await dbQuery('ALTER TABLE properties ADD COLUMN IF NOT EXISTS remarks TEXT').catch(() => {});
      await dbQuery('ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_status_check').catch(() => {});

      // Seed Barangays
      const { rows: bRows } = await dbQuery('SELECT COUNT(*) FROM barangays');
      if (parseInt(bRows[0].count) === 0) {
        const initialB = [
          ['0001', 'Batong Buhay'], ['0002', 'Buenavista'], ['0003', 'Burgos'],
          ['0004', 'Claudio Salgado'], ['0005', 'Ligaya'], ['0006', 'Paetan'],
          ['0007', 'Pag-asa'], ['0008', 'Sta. Lucia'], ['0009', 'San Vicente'],
          ['0010', 'Sto. Niño'], ['0011', 'Tagumpay'], ['0012', 'Victoria'],
          ['0013', 'Poblacion'], ['0014', 'San Agustin'], ['0015', 'Gen. Emilio Aguinaldo'],
          ['0016', 'Ibud'], ['0017', 'Ilvita'], ['0018', 'Lagnas'],
          ['0019', 'Malisbong'], ['0020', 'San Francisco'], ['0021', 'San Nicolas'],
          ['0022', 'Tuban']
        ];
        for (const [code, name] of initialB) {
          await dbQuery('INSERT INTO barangays (code, name) VALUES ($1, $2)', [code, name]);
        }
      }
      await updateBarangayCache();

      // Seed Manlie
      console.log('Checking for essential system accounts...');

      const manliePass = bcrypt.hashSync('admin123', 10);
      const { rows: manlieRows } = await dbQuery('SELECT * FROM users WHERE LOWER(username) = $1', ['manlie']);
      if (manlieRows.length === 0) {
        await dbQuery('INSERT INTO users (username, password, role, full_name) VALUES ($1, $2, $3, $4)', ['manlie', manliePass, 'admin', 'Manlie (Admin/Collector)']);
      } else {
        await dbQuery('UPDATE users SET password = $1, role = $2, full_name = $3 WHERE LOWER(username) = $4', [manliePass, 'admin', 'Manlie (Admin/Collector)', 'manlie']);
      }

      // Seed Treas
      const treasPass = bcrypt.hashSync('Treas123', 10);
      const { rows: treasRows } = await dbQuery('SELECT * FROM users WHERE LOWER(username) = $1', ['treas']);
      if (treasRows.length === 0) {
        await dbQuery('INSERT INTO users (username, password, role, full_name) VALUES ($1, $2, $3, $4)', ['treas', treasPass, 'queue', 'Treasurer Queue Kiosk']);
      } else {
        await dbQuery('UPDATE users SET password = $1, role = $2, full_name = $3 WHERE LOWER(username) = $4', [treasPass, 'queue', 'Treasurer Queue Kiosk', 'treas']);
      }



      await dbQuery('COMMIT');
      dbInitStatus = { initialized: true, error: null, timestamp: new Date().toISOString(), mode: 'database' };
      console.log('Database initialized successfully.');
      return; // Success!
    } catch (e: any) {
      try { await dbQuery('ROLLBACK'); } catch (rbErr) { /* ignore */ }
      
      console.error(`[DB] Attempt ${i + 1} failed: ${e.message}`);
      
      if (i === retries - 1) {
        dbInitStatus = { 
          initialized: true, // Mark as initialized so the app can start in mock mode
          error: e.message, 
          timestamp: new Date().toISOString(),
          mode: 'mock'
        };
        console.error('****************************************************************');
        console.error('DATABASE CONNECTION FAILED AFTER ALL RETRIES');
        console.error('SWITCHING TO MOCK MODE (IN-MEMORY STORAGE)');
        console.error('Data will NOT be saved to PostgreSQL and will be lost on restart.');
        console.error('****************************************************************');
        
        if (isPrivateIp) {
          console.error('TROUBLESHOOTING:');
          console.error(`1. You are using a private IP: ${poolConfig.host}`);
          console.error('2. The AI Studio cloud environment CANNOT reach private IPs directly.');
          console.error('3. SOLUTION: Use a tunnel like ngrok or Cloudflare Tunnel.');
          console.error('   Example: ngrok tcp 5433');
          console.error('   Then use the provided public address (e.g. 0.tcp.ngrok.io) as DB_HOST.');
        }
      } else {
        console.log(`[DB] Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
};

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  
  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Host: ${req.get('host')} - From: ${req.ip}`);
    next();
  });

  app.use(express.json());
  app.use(cookieParser());
  app.use(cors({
    origin: ['https://ais-dev-r3ui3klxefzvgtuyiay6wk-345072871581.asia-southeast1.run.app', 'http://localhost:3000', 'http://100.65.168.30:3000'],
    credentials: true
  }));

  const authenticateToken = (req: any, res: any, next: any) => {
    const token = req.cookies?.token;
    console.log('[DEBUG] authenticateToken - Token:', token ? 'Present' : 'Missing', 'URL:', req.url);
    if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

    jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
      if (err) {
        console.log('[DEBUG] authenticateToken - JWT Verify Error:', err.message);
        return res.status(403).json({ error: 'Forbidden: Invalid token' });
      }
      
      // Update last_active_at
      try {
        await dbQuery('UPDATE users SET last_active_at = $1 WHERE id = $2', [new Date().toISOString(), user.id]);
      } catch (e) {
        // Ignore update errors
      }

      req.user = user;
      next();
    });
  };

  app.get('/health', (req, res) => res.send('OK'));
  app.get('/favicon.ico', (req, res) => res.status(204).end());

  app.delete('/api/assessments/:id', authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'collector' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      }
      
      const assessmentId = parseInt(req.params.id);
      if (isNaN(assessmentId)) {
        return res.status(400).json({ error: 'Invalid assessment ID format' });
      }

      console.log(`[API DELETE] ID: ${assessmentId}, User: ${req.user.username}`);
      const result = await dbQuery('DELETE FROM assessments WHERE id = $1', [assessmentId]);
      console.log(`[API DELETE] Success, Rows: ${result.rowCount}`);
      res.json({ success: true, rowCount: result.rowCount });
    } catch (err) {
      console.error('[API DELETE] Error:', err);
      res.status(500).json({ 
        error: 'Database error occurred',
        details: String(err),
        stack: (err as any).stack
      });
    }
  });

  app.get('/api/status', async (req, res) => {
    try {
      await dbQuery('SELECT 1');
      res.json({ status: 'ok', database: 'connected' });
    } catch (e: any) {
      res.status(500).json({ status: 'error', database: 'disconnected', error: e.message });
    }
  });


  // Auth Routes
  app.post('/api/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const normalizedUsername = username ? username.trim().replace(/\s+/g, ' ').toLowerCase() : '';

      const { rows } = await dbQuery('SELECT * FROM users WHERE LOWER(username) = $1', [normalizedUsername]);
      const user = rows[0];
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password || '', user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: user.id, role: user.role, name: user.full_name, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: isProd, 
        sameSite: isProd ? 'none' : 'lax' 
      });
      res.json({ id: user.id, username: user.username, role: user.role, full_name: user.full_name });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/logout', (req, res) => {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax'
    });
    res.json({ message: 'Logged out' });
  });

  app.get('/api/me', authenticateToken, (req: any, res) => {
    res.json(req.user);
  });

  app.post('/api/change-password', authenticateToken, async (req: any, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Old password and new password are required' });
      }

      if (newPassword.length < 4) {
        return res.status(400).json({ error: 'New password must be at least 4 characters' });
      }

      // Get current user's password from database
      const { rows } = await dbQuery('SELECT password FROM users WHERE id = $1', [req.user.id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = rows[0];

      // Verify old password
      const isPasswordCorrect = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordCorrect) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password and update
      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      await dbQuery('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
      console.error('Change password error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/admin/reset-password', authenticateToken, async (req: any, res) => {
    try {
      // Only Manlie can reset passwords
      if (req.user.username.toLowerCase() !== 'manlie') {
        return res.status(403).json({ error: 'Forbidden: Only Manlie can reset passwords' });
      }

      const { userId, role } = req.body;
      if (!userId || !role) {
        return res.status(400).json({ error: 'User ID and role are required' });
      }

      // Determine default password based on role
      let defaultPassword: string;
      switch (role) {
        case 'admin':
          defaultPassword = 'admin123';
          break;
        case 'collector':
          defaultPassword = 'collector123';
          break;
        case 'taxpayer':
          defaultPassword = 'taxpayer123';
          break;
        default:
          return res.status(400).json({ error: 'Invalid role' });
      }

      // Hash and update the password
      const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
      const result = await dbQuery('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      await dbQuery('INSERT INTO admin_logs (action_type, details, admin_id, created_at) VALUES ($1, $2, $3, $4)',
        ['user_management', `Reset password for user ID ${userId} to default`, req.user.id, new Date().toISOString()]);

      res.json({ success: true, message: `Password reset to default ${defaultPassword}` });
    } catch (err) {
      console.error('Reset password error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/register', async (req, res) => {
    const { username, full_name } = req.body;
    try {
      const normalizedUsername = username ? username.trim().replace(/\s+/g, ' ').toLowerCase() : '';
      const hashedPassword = bcrypt.hashSync('taxpayer123', 10);
      const { rows } = await dbQuery(
        'INSERT INTO users (username, password, role, full_name) VALUES ($1, $2, $3, $4) RETURNING id',
        [normalizedUsername, hashedPassword, 'taxpayer', full_name]
      );
      
      const userId = rows[0].id;
      const token = jwt.sign({ id: userId, role: 'taxpayer', name: full_name, username: normalizedUsername }, JWT_SECRET, { expiresIn: '24h' });
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: isProd, 
        sameSite: isProd ? 'none' : 'lax' 
      });
      res.json({ id: userId, username, role: 'taxpayer', full_name });
    } catch (error: any) {
      if (error.code === '23505') res.status(400).json({ error: 'Username already exists' });
      else res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/admin/create-taxpayer', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });
    
    const { username, full_name } = req.body;
    if (!username || !full_name) return res.status(400).json({ error: 'Missing required fields' });

    try {
      const normalizedUsername = username.trim().replace(/\s+/g, ' ').toLowerCase();
      const hashedPassword = bcrypt.hashSync('taxpayer123', 10);
      const { rows } = await dbQuery(
        'INSERT INTO users (username, password, role, full_name) VALUES ($1, $2, $3, $4) RETURNING id',
        [normalizedUsername, hashedPassword, 'taxpayer', full_name]
      );
      
      await dbQuery('INSERT INTO admin_logs (action_type, details, admin_id, created_at) VALUES ($1, $2, $3, $4)',
        ['user_management', `Created taxpayer: ${full_name} (${normalizedUsername})`, req.user.id, new Date().toISOString()]);

      res.json({ success: true, id: rows[0].id, username: normalizedUsername, full_name });
    } catch (error: any) {
      if (error.code === '23505') res.status(400).json({ error: 'Username already exists' });
      else res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/admin/create-admin', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });
    if (req.user.username.toLowerCase() !== 'manlie') return res.status(403).json({ error: 'Forbidden: Only Manlie can create admins' });
    
    const { username, full_name } = req.body;
    if (!username || !full_name) return res.status(400).json({ error: 'Missing required fields' });

    try {
      const normalizedUsername = username.trim().replace(/\s+/g, ' ');
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      const { rows } = await dbQuery(
        'INSERT INTO users (username, password, role, full_name) VALUES ($1, $2, $3, $4) RETURNING id',
        [normalizedUsername, hashedPassword, 'admin', full_name]
      );
      
      await dbQuery('INSERT INTO admin_logs (action_type, details, admin_id, created_at) VALUES ($1, $2, $3, $4)',
        ['user_management', `Created admin: ${full_name} (${normalizedUsername})`, req.user.id, new Date().toISOString()]);

      res.json({ success: true, id: rows[0].id, username: normalizedUsername, full_name });
    } catch (error: any) {
      if (error.code === '23505') res.status(400).json({ error: 'Username already exists' });
      else res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/admin/create-collector', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });
    if (req.user.username.toLowerCase() !== 'manlie') return res.status(403).json({ error: 'Forbidden: Only Manlie can create collectors' });
    
    const { username, full_name } = req.body;
    if (!username || !full_name) return res.status(400).json({ error: 'Missing required fields' });

    try {
      const normalizedUsername = username.trim().replace(/\s+/g, ' ').toLowerCase();
      const hashedPassword = bcrypt.hashSync('collector123', 10);
      const { rows } = await dbQuery(
        'INSERT INTO users (username, password, role, full_name) VALUES ($1, $2, $3, $4) RETURNING id',
        [normalizedUsername, hashedPassword, 'collector', full_name]
      );
      
      await dbQuery('INSERT INTO admin_logs (action_type, details, admin_id, created_at) VALUES ($1, $2, $3, $4)',
        ['user_management', `Created collector: ${full_name} (${normalizedUsername})`, req.user.id, new Date().toISOString()]);

      res.json({ success: true, id: rows[0].id, username: normalizedUsername, full_name });
    } catch (error: any) {
      if (error.code === '23505') res.status(400).json({ error: 'Username already exists' });
      else res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Properties Routes
  app.get('/api/properties', authenticateToken, async (req: any, res) => {
    try {
      let properties: any[] = [];
      
      if (req.user.role === 'taxpayer') {
        // Get properties linked to this taxpayer via property_owners table
        const { rows } = await dbQuery(`
          SELECT p.*, po.ownership_type, po.claimed_area 
          FROM properties p
          JOIN property_owners po ON p.id = po.property_id
          WHERE po.user_id = $1
        `, [req.user.id]);
        properties = rows;
      } else if (req.user.role === 'collector') {
        // Collectors only see properties of taxpayers assigned to them
        const { rows } = await dbQuery(`
          SELECT DISTINCT p.* 
          FROM properties p 
          JOIN property_owners po ON p.id = po.property_id
          JOIN users u ON po.user_id = u.id 
          WHERE u.assigned_collector_id = $1
        `, [req.user.id]);
        properties = rows;
      } else {
        // Admin sees all properties with search/filter
        const { search, taxpayer_id, includeTaxpayer } = req.query;
        let query = 'SELECT p.* FROM properties p';
        const params: any[] = [];
        const conditions: string[] = [];
        
        if (search) {
          // Search logic needs to be aware of multiple owners if searching by owner name
          if (includeTaxpayer === 'true') {
             // This is tricky with multiple owners. Let's search property fields OR if any owner matches
             conditions.push(`(
               p.pin ILIKE $${params.length + 1} OR p.registered_owner_name ILIKE $${params.length + 2} OR p.td_no ILIKE $${params.length + 3} OR 
               EXISTS (
                 SELECT 1 FROM property_owners po 
                 JOIN users u ON po.user_id = u.id 
                 WHERE po.property_id = p.id AND u.full_name ILIKE $${params.length + 4}
               )
             )`);
             params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
          } else {
            conditions.push(`(p.pin ILIKE $${params.length + 1} OR p.registered_owner_name ILIKE $${params.length + 2} OR p.td_no ILIKE $${params.length + 3})`);
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
          }
        }
        
        if (taxpayer_id) {
          conditions.push(`EXISTS (SELECT 1 FROM property_owners po WHERE po.property_id = p.id AND po.user_id = $${params.length + 1})`);
          params.push(taxpayer_id);
        }

        if (conditions.length > 0) {
          const whereClause = conditions.join(' AND ');
          query += ` WHERE ${whereClause}`;
          const { rows } = await dbQuery(query, params);
          properties = rows;
        } else {
          // Limit to 50 records if no search/filter to prevent crashing
          query += ' LIMIT 50';
          const { rows } = await dbQuery(query, params);
          properties = rows;
        }
      }

      // Enrich properties with owner info
      const enrichedProperties = await Promise.all(properties.map(async (p, index) => {
        const { rows: owners } = await dbQuery(`
          SELECT u.id, u.full_name, po.ownership_type, po.claimed_area 
          FROM property_owners po
          JOIN users u ON po.user_id = u.id
          WHERE po.property_id = $1
        `, [p.id]);

        // STRIKE TEAM: Forcefully wipe 'unpaid' from the result
        const finalStatus = (p.status && p.status.toLowerCase().includes('unpaid')) ? null : p.status;

        const ownerNames = owners.map((o: any) => o.full_name).join(', ');
        const remarks = owners.length > 1 ? 'with 2 or more claimants' : '';
        
        // For backward compatibility or primary display
        const primaryOwner = owners[0];

        if (index === 0) {
          console.log('[DEBUG] Sending Property to Frontend:', { 
            pin: p.pin, 
            status: p.status, 
            taxability: p.taxability, 
            classification: p.classification, 
            remarks: p.remarks
          });
        }

        return {
          ...p,
          status: finalStatus,
          owners,
          linked_taxpayer: ownerNames || null,
          owner_id: primaryOwner?.id || null, 
          ownership_type: primaryOwner?.ownership_type,
          claimed_area: primaryOwner?.claimed_area,
          remarks: p.remarks || (owners.length > 1 ? 'with 2 or more claimants' : '')
        };
      }));

      res.json(enrichedProperties);
    } catch (err) {
      console.error('Fetch properties error:', err);
      res.status(500).json({ error: 'Failed to fetch properties' });
    }
  });

  app.post('/api/properties/by-pins', authenticateToken, async (req: any, res) => {
    try {
      const { pins } = req.body;
      if (!Array.isArray(pins) || pins.length === 0) {
        return res.json([]);
      }
      const { rows } = await dbQuery(`SELECT * FROM properties WHERE pin = ANY($1)`, [pins]);
      res.json(rows);
    } catch (err) {
      console.error('Fetch properties by pins error:', err);
      res.status(500).json({ error: 'Failed to fetch properties by pins' });
    }
  });

  app.get('/api/admin/payments', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const { rows } = await dbQuery(`
        SELECT p.*, pr.pin, pr.registered_owner_name, u.full_name as collector_name, tp.full_name as taxpayer_name
        FROM payments p
        JOIN properties pr ON p.property_id = pr.id
        LEFT JOIN users u ON p.collector_id = u.id
        LEFT JOIN users tp ON p.taxpayer_id = tp.id
        ORDER BY p.payment_date DESC
      `);
      res.json(rows);
    } catch (err) {
      console.error('Fetch all payments error:', err);
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  });

  app.get('/api/collector/payments', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'collector' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const { rows } = await dbQuery(`
        SELECT p.*, pr.pin, pr.registered_owner_name, tp.full_name as taxpayer_name
        FROM payments p
        JOIN properties pr ON p.property_id = pr.id
        LEFT JOIN users tp ON p.taxpayer_id = tp.id
        WHERE p.collector_id = $1
        ORDER BY p.payment_date DESC
      `, [req.user.id]);
      res.json(rows);
    } catch (err) {
      console.error('Fetch collector payments error:', err);
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  });

  app.put('/api/admin/payments/:id/date', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params;
    const { payment_date } = req.body;
    try {
      await dbQuery('UPDATE payments SET payment_date = $1 WHERE id = $2', [payment_date, id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update payment date' });
    }
  });

  app.post('/api/admin/link-property', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });
    const { properties, taxpayer_id, assigned_collector_id } = req.body;
    
    // For backwards compatibility, if property_ids is sent instead of properties
    const property_ids = req.body.property_ids;
    const ownership_type = req.body.ownership_type;
    const claimed_area = req.body.claimed_area;

    let propsToLink = properties;
    if (!propsToLink && Array.isArray(property_ids)) {
      propsToLink = property_ids.map((id: any) => ({ id, ownership_type, claimed_area }));
    }

    if (!Array.isArray(propsToLink) || propsToLink.length === 0) {
      return res.status(400).json({ error: 'No properties selected' });
    }

    try {
      await dbQuery('BEGIN');

      const { rows: taxpayerRows } = await dbQuery('SELECT full_name FROM users WHERE id = $1', [taxpayer_id]);
      const taxpayer = taxpayerRows[0];
      if (!taxpayer) {
        await dbQuery('ROLLBACK');
        return res.status(404).json({ error: 'Taxpayer not found' });
      }

      // Update taxpayer's assigned collector if provided
      if (assigned_collector_id !== undefined) {
        let collectorId = null;
        if (assigned_collector_id && assigned_collector_id !== 'unassigned') {
          const parsed = Number(assigned_collector_id);
          if (!isNaN(parsed)) collectorId = parsed;
        }

        if (collectorId) {
           // Check existing queue number
           const { rows: tpRows } = await dbQuery('SELECT queue_number FROM users WHERE id = $1', [taxpayer_id]);
           let queueNumber = tpRows[0]?.queue_number;
           
           if (!queueNumber) {
               const { rows: maxRows } = await dbQuery('SELECT MAX(queue_number) as max_q FROM users');
               const maxQ = maxRows[0]?.max_q || 0;
               queueNumber = maxQ + 1;
           }
           
           await dbQuery('UPDATE users SET assigned_collector_id = $1, queue_number = $2 WHERE id = $3', [collectorId, queueNumber, taxpayer_id]);
        } else {
           // Unassigning
           await dbQuery('UPDATE users SET assigned_collector_id = NULL, queue_number = NULL WHERE id = $1', [taxpayer_id]);
        }
      }
      
      let warning = '';
      const linkedPins: string[] = [];

      for (const propData of propsToLink) {
        const { id, ownership_type, claimed_area } = propData;
        
        // Check if already linked to THIS taxpayer
        const { rows: existingLinkRows } = await dbQuery('SELECT 1 FROM property_owners WHERE property_id = $1 AND user_id = $2', [id, taxpayer_id]);
        const existingLink = existingLinkRows[0];
        
        // Check if linked to ANY taxpayer (for warning)
        const { rows: anyLinkRows } = await dbQuery('SELECT COUNT(*) as count FROM property_owners WHERE property_id = $1', [id]);
        const anyLinkCount = parseInt(anyLinkRows[0].count);
        
        if (anyLinkCount > 0 && !existingLink) {
          warning = 'Some properties were already tagged by other taxpayers.';
        }
 
        if (!existingLink) {
          await dbQuery(
            'INSERT INTO property_owners (property_id, user_id, ownership_type, claimed_area) VALUES ($1, $2, $3, $4)',
            [id, taxpayer_id, ownership_type, claimed_area]
          );
          
          // Update legacy fields
          await dbQuery(
            'UPDATE properties SET owner_id = $1, ownership_type = $2, claimed_area = $3 WHERE id = $4',
            [taxpayer_id, ownership_type, claimed_area, id]
          );

          // Get PIN for logging
          const { rows: propRows } = await dbQuery('SELECT pin FROM properties WHERE id = $1', [id]);
          if (propRows.length > 0) {
            linkedPins.push(propRows[0].pin);
          }
        }
      }

      // TAXPAYER LOGGING: Time In (Tagging)
      if (linkedPins.length > 0) {
        // Check for open log
        const { rows: openLogs } = await dbQuery(
          'SELECT id, pins FROM taxpayer_logs WHERE taxpayer_id = $1 AND time_out IS NULL ORDER BY created_at DESC LIMIT 1',
          [taxpayer_id]
        );

        if (openLogs.length > 0) {
          // Update existing log
          const log = openLogs[0];
          let currentPins: string[] = [];
          try {
            currentPins = JSON.parse(log.pins);
          } catch (e) {
            currentPins = [];
          }
          
          // Add new PINs if not already present
          const updatedPins = [...currentPins];
          linkedPins.forEach(pin => {
            if (!updatedPins.includes(pin)) {
              updatedPins.push(pin);
            }
          });

          await dbQuery('UPDATE taxpayer_logs SET pins = $1 WHERE id = $2', [JSON.stringify(updatedPins), log.id]);
        } else {
          // Create new log
          const { rows: tpRows } = await dbQuery('SELECT full_name FROM users WHERE id = $1', [taxpayer_id]);
          const taxpayerName = tpRows[0]?.full_name || 'Unknown';

          await dbQuery(`
            INSERT INTO taxpayer_logs (taxpayer_id, taxpayer_name, role, user_id, user_name, pins, time_in, time_out, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)
          `, [taxpayer_id, taxpayerName, req.user.role, req.user.id, req.user.name, JSON.stringify(linkedPins), new Date().toISOString(), new Date().toISOString()]);
        }
      }
 
      await dbQuery('COMMIT');
      res.json({ success: true, warning });
    } catch (err) {
      await dbQuery('ROLLBACK');
      console.error('[DB ERROR] Link property failed for Taxpayer ID:', taxpayer_id, 'Error:', err);
      res.status(500).json({ error: 'Failed to link properties', details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/admin/unlink-property', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });
    const { property_ids, taxpayer_id } = req.body;
    
    if (!Array.isArray(property_ids) || property_ids.length === 0) {
      return res.status(400).json({ error: 'No properties selected' });
    }
 
    try {
      await dbQuery('BEGIN');
 
      if (taxpayer_id) {
        const { rows: taxpayerRows } = await dbQuery('SELECT full_name FROM users WHERE id = $1', [taxpayer_id]);
        const taxpayer = taxpayerRows[0];
        if (!taxpayer) {
          await dbQuery('ROLLBACK');
          return res.status(404).json({ error: 'Taxpayer not found' });
        }
      }
 
      for (const id of property_ids) {
        if (taxpayer_id) {
          await dbQuery('DELETE FROM property_owners WHERE property_id = $1 AND user_id = $2', [id, taxpayer_id]);
          await dbQuery('UPDATE properties SET owner_id = NULL, ownership_type = NULL, claimed_area = NULL WHERE id = $1 AND owner_id = $2', [id, taxpayer_id]);
        } else {
          await dbQuery('DELETE FROM property_owners WHERE property_id = $1', [id]);
          await dbQuery('UPDATE properties SET owner_id = NULL, ownership_type = NULL, claimed_area = NULL WHERE id = $1', [id]);
        }
      }
 
      await dbQuery('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await dbQuery('ROLLBACK');
      console.error('Unlink property error:', err);
      res.status(500).json({ error: 'Failed to unlink properties' });
    }
  });

  app.post('/api/admin/upload-abstract', authenticateToken, upload.single('file'), async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const results: any[] = [];
    const stream = Readable.from(req.file.buffer.toString());

    stream
      .pipe(csvParser({
        mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
      }))
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          await dbQuery('BEGIN');
          
          let successCount = 0;
          let errorCount = 0;
          const errors: string[] = [];
 
          for (const row of results) {
            try {
              const pin = row.pin || row.propertyindexnumber;
              if (!pin) throw new Error('Missing PIN');
 
              const { rows: propRows } = await dbQuery('SELECT id FROM properties WHERE pin = $1', [pin]);
              const prop = propRows[0];
              if (!prop) throw new Error(`Property with PIN ${pin} not found`);
 
              const amount = parseFloat(row.amount || row.totalamount || 0);
              const date = row.date || row.paymentdate || new Date().toISOString();
              const or_no = row.orno || row.officialreceiptnumber || '';
              const year = row.year || '';
              const basic = parseFloat(row.basic || row.basictax || 0);
              const sef = parseFloat(row.sef || row.seftax || 0);
              const interest = parseFloat(row.interest || 0);
              const discount = parseFloat(row.discount || 0);
 
              await dbQuery(`
                INSERT INTO payments (
                  property_id, amount, payment_date, collector_id, or_no, year, basic_tax, sef_tax, interest, discount
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              `, [prop.id, amount, date, req.user.id, or_no, year, basic, sef, interest, discount]);
              
              successCount++;
            } catch (e: any) {
              errorCount++;
              errors.push(e.message);
            }
          }
 
          await dbQuery('INSERT INTO admin_logs (action_type, details, admin_id, created_at) VALUES ($1, $2, $3, $4)',
            ['system_data', `Uploaded historical RPT Abstract: ${successCount} records imported`, req.user.id, new Date().toISOString()]);
 
          await dbQuery('COMMIT');
          res.json({ successCount, errorCount, errors });
        } catch (err: any) {
          await dbQuery('ROLLBACK');
          console.error('Abstract upload transaction error:', err);
          res.status(500).json({ error: err.message });
        }
      });
  });

  app.post('/api/admin/upload-roll', authenticateToken, upload.single('file'), async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const results: any[] = [];
    // First, detect potential separator in first line
    const firstLine = req.file.buffer.toString().split('\n')[0];
    let separator = ',';
    if (firstLine.includes(';')) separator = ';';
    else if (firstLine.includes('\t')) separator = '\t';
    
    console.log('[DEBUG] Auto-detected CSV separator:', { separator });

    const stream = Readable.from(req.file.buffer.toString());

    stream
      .pipe(csvParser({ separator }))
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        if (results.length > 0) {
          console.log('[DEBUG] First Row Data Sample:', results[0]);
        }

        try {
          // NUCLEAR OPTION: Drop and Re-format the entire property database
          await dbQuery(`
            DROP TABLE IF EXISTS assessments CASCADE;
            DROP TABLE IF EXISTS payments CASCADE;
            DROP TABLE IF EXISTS property_owners CASCADE;
            DROP TABLE IF EXISTS properties CASCADE;

            CREATE TABLE properties (
              id SERIAL PRIMARY KEY,
              registered_owner_name TEXT,
              pin TEXT,
              td_no TEXT,
              lot_no TEXT,
              address TEXT,
              description TEXT,
              assessed_value NUMERIC,
              tax_due NUMERIC,
              status TEXT,
              total_area TEXT,
              taxability TEXT,
              classification TEXT,
              remarks TEXT
            );

            CREATE TABLE property_owners (
              id SERIAL PRIMARY KEY,
              property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
              user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
              ownership_type TEXT,
              claimed_area TEXT
            );

            CREATE TABLE payments (
              id SERIAL PRIMARY KEY,
              property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
              amount NUMERIC,
              payment_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              collector_id INTEGER REFERENCES users(id),
              taxpayer_id INTEGER REFERENCES users(id),
              or_no TEXT,
              year TEXT
            );

            CREATE TABLE assessments (
              id SERIAL PRIMARY KEY,
              property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
              user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
              amount NUMERIC,
              year TEXT,
              status TEXT DEFAULT 'pending'
            );
          `);
          
          await dbQuery('BEGIN');
          
          let successCount = 0;
          let errorCount = 0;
          const errors: string[] = [];
          for (const [index, row] of results.entries()) {
            const grab = (searchTerm: string) => {
              const cleaned = searchTerm.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
              const key = Object.keys(row).find(k => k.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === cleaned);
              return key ? String(row[key] || '').trim() : null;
            };

            // STRIKE FORCE: ROBUST HEADER CAPTURE
            const registeredOwner = grab('registeredowner') || grab('registered_owner') || grab('owner') || null;
            const pin = grab('pin') || null;
            const tdNo = grab('tdno') || grab('td_no') || null;
            const lotNo = grab('lotblockno') || grab('lot_no') || grab('lot') || grab('block') || null;
            const kind = grab('kind') || grab('description') || grab('propkind') || grab('propertykind') || grab('landkind') || null;
            const classification = grab('classification') || grab('class') || grab('propclass') || null;
            const assessedVal = parseFloat(String(grab('assessedvalue') || grab('assessed_value') || grab('av') || '0').replace(/,/g, ''));
            const oldPin = grab('oldpin') || grab('old_pin') || grab('old_pin_no') || null;
            const area = grab('area') || grab('total_area') || grab('sqm') || null;
            const status = grab('status') || grab('propstatus') || null;
            const taxability = grab('taxability') || grab('taxable') || grab('tax_status') || null;
            const effectivity = grab('effectivity') || grab('effective') || null;
            const remarks = grab('remarks') || grab('comment') || null;

            if (index === 0) {
              console.log('[DEBUG-ROLL] One Row Mapping:', { pin, status, taxability, classification });
            }

            if (!registeredOwner && !pin) continue;

            try {
              // Database insert - using UPSERT logic (replace if PIN exists)
              await dbQuery(`
                INSERT INTO properties (
                  pin, td_no, registered_owner_name, lot_no, total_area, 
                  assessed_value, kind, classification, old_pin, status, 
                  taxability, effectivity, remarks
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (pin) DO UPDATE SET
                  td_no = EXCLUDED.td_no,
                  registered_owner_name = EXCLUDED.registered_owner_name,
                  lot_no = EXCLUDED.lot_no,
                  total_area = EXCLUDED.total_area,
                  assessed_value = EXCLUDED.assessed_value,
                  kind = EXCLUDED.kind,
                  classification = EXCLUDED.classification,
                  old_pin = EXCLUDED.old_pin,
                  status = EXCLUDED.status,
                  taxability = EXCLUDED.taxability,
                  effectivity = EXCLUDED.effectivity,
                  remarks = EXCLUDED.remarks
              `, [
                pin, tdNo, registeredOwner, lotNo, area,
                assessedVal, kind, classification, oldPin, status || '',
                taxability || '', effectivity, remarks
              ]);
              successCount++;
            } catch (e: any) {
              errorCount++;
              errors.push(`Failed to insert row. Owner: ${registeredOwner}, PIN: ${pin}. Error: ${e.message}`);
            }
          }

          await dbQuery('INSERT INTO admin_logs (action_type, details, admin_id, created_at) VALUES ($1, $2, $3, $4)',
            ['system_data', `Uploaded new Tax Roll: ${successCount} properties imported`, req.user.id, new Date().toISOString()]);

          await dbQuery('COMMIT');
          res.json({ successCount, errorCount, errors });
        } catch (err: any) {
          await dbQuery('ROLLBACK');
          console.error('Roll upload transaction error:', err);
          res.status(500).json({ error: err.message });
        }
      });
  });
  app.get('/api/users', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const { rows } = await dbQuery('SELECT id, username, full_name, role, age, gender, phone_number, assigned_collector_id, queue_number, queue_date, notified, notified_at, last_active_at FROM users ORDER BY id ASC');
      res.json(rows);
    } catch (err) {
      console.error('Fetch users error:', err);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.post('/api/collector/view-taxpayer', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'collector' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { taxpayer_id } = req.body;
    if (!taxpayer_id) return res.status(400).json({ error: 'Taxpayer ID required' });

    try {
      const { rows: tpRows } = await dbQuery('SELECT full_name FROM users WHERE id = $1', [taxpayer_id]);
      if (tpRows.length === 0) return res.status(404).json({ error: 'Taxpayer not found' });
      const taxpayerName = tpRows[0].full_name;

      // Check for open log
      const { rows: openLogs } = await dbQuery(
        'SELECT id FROM taxpayer_logs WHERE taxpayer_id = $1 AND user_id = $2 AND time_out IS NULL ORDER BY created_at DESC LIMIT 1',
        [taxpayer_id, req.user.id]
      );

      if (openLogs.length === 0) {
        // Create new log with time_in
        await dbQuery(`
          INSERT INTO taxpayer_logs (taxpayer_id, taxpayer_name, role, user_id, user_name, pins, time_in, time_out, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)
        `, [taxpayer_id, taxpayerName, req.user.role, req.user.id, (req.user as any).name, '[]', new Date().toISOString(), new Date().toISOString()]);

        // AUTO-CALL: Send SMS if they are in the queue and not yet notified
        const { rows: qRows } = await dbQuery('SELECT phone_number, queue_number, notified FROM users WHERE id = $1', [taxpayer_id]);
        if (qRows.length > 0) {
          const tp = qRows[0];
          if (!tp.notified && tp.phone_number && tp.queue_number) {
            const formattedNum = `RPT-${String(tp.queue_number).padStart(4, '0')}`;
            const callerFirstName = req.user.name.split(' ')[0];
            await sendSMS(tp.phone_number, `Hello ${taxpayerName}! You are NEXT (Number: ${formattedNum}). Please proceed to ${callerFirstName} now. Thank you!`);
            await dbQuery('UPDATE users SET notified = TRUE, notified_at = $1 WHERE id = $2', [new Date().toISOString(), taxpayer_id]);
          }
        }
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Collector view taxpayer error:', err);
      res.status(500).json({ error: 'Failed to record tracking' });
    }
  });

  app.get('/api/admin/taxpayers', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const { rows } = await dbQuery('SELECT id, username, full_name, age, gender, queue_number, assigned_collector_id, last_active_at FROM users WHERE role = $1', ['taxpayer']);
      res.json(rows);
    } catch (err) {
      console.error('Fetch taxpayers error:', err);
      res.status(500).json({ error: 'Failed to fetch taxpayers' });
    }
  });

  app.post('/api/queue/register', async (req, res) => {
    try {
      const { first_name, mi, last_name, age, gender, phone_number } = req.body;
      if (!first_name || !last_name) return res.status(400).json({ error: 'First name and last name are required' });

      const full_name = mi ? `${first_name} ${mi} ${last_name}` : `${first_name} ${last_name}`;
      const currentDay = new Date().toISOString().split('T')[0];

      // CHECK IF TAXPAYER ALREADY EXISTS (Re-queueing)
      // Only match against existing TAXPAYERS to avoid collisions with admin/collector roles
      let taxpayer;
      const { rows: existingRows } = await dbQuery(
        'SELECT id, username, full_name, role FROM users WHERE (phone_number = $1 OR full_name = $2) AND role = $3 LIMIT 1',
        [phone_number, full_name, 'taxpayer']
      );

      // Latest daily queue number
      const { rows: maxRows } = await dbQuery('SELECT MAX(queue_number) as max_num FROM users WHERE queue_date = $1', [currentDay]);
      const nextNum = (maxRows[0].max_num || 0) + 1;
      const formattedNum = `RPT-${String(nextNum).padStart(4, '0')}`;

      if (existingRows.length > 0) {
        // Re-queue existing user
        taxpayer = existingRows[0];
        await dbQuery(
          'UPDATE users SET queue_number = $1, queue_date = $2, notified = FALSE, notified_at = NULL WHERE id = $3',
          [nextNum, currentDay, taxpayer.id]
        );
      } else {
        // Create new user (Generate username logic preserved)
        let username = first_name.toLowerCase().replace(/\s+/g, '');
        const { rows: collisionRows } = await dbQuery('SELECT id FROM users WHERE username = $1', [username]);
        if (collisionRows.length > 0) {
          username = `${username}${Math.floor(Math.random() * 9999)}`;
        }
        const hashedPassword = bcrypt.hashSync('taxpayer123', 10);
        
        const { rows: insertRows } = await dbQuery(
          'INSERT INTO users (username, password, role, full_name, age, gender, phone_number, queue_number, queue_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, username, full_name, queue_number, phone_number',
          [username, hashedPassword, 'taxpayer', full_name, age, gender, phone_number, nextNum, currentDay]
        );
        taxpayer = insertRows[0];
      }

      // Send Initial SMS
      if (phone_number) {
        sendSMS(phone_number, `Welcome ${full_name}! Your Queue Number is ${formattedNum}. Please wait for your turn. Thank you!`);
      }

      res.status(201).json({
        message: existingRows.length > 0 ? 'Welcome back! You are re-queued' : 'Successfully queued',
        user: taxpayer,
        queue_label: formattedNum
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Failed to join queue' });
    }
  });

  app.post('/api/admin/notify-taxpayer', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { taxpayer_id } = req.body;

    try {
      const { rows } = await dbQuery('SELECT id, full_name, phone_number, queue_number, notified FROM users WHERE id = $1', [taxpayer_id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Taxpayer not found' });
      
      const tp = rows[0];
      if (tp.notified) return res.json({ message: 'Already notified', success: true });
      if (!tp.phone_number) return res.status(400).json({ error: 'No phone number linked' });

      const formattedNum = `RPT-${String(tp.queue_number).padStart(4, '0')}`;
      const callerFirstName = req.user.name.split(' ')[0];
      await sendSMS(tp.phone_number, `Hello ${tp.full_name}! You are NEXT (Number: ${formattedNum}). Please proceed to ${callerFirstName} now. Thank you!`);
      
      const now = new Date().toISOString();
      await dbQuery('UPDATE users SET notified = TRUE, notified_at = $1 WHERE id = $2', [now, taxpayer_id]);
      res.json({ success: true, message: 'Notification sent', notified_at: now });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to notify' });
    }
  });

  app.post('/api/admin/cancel-queue', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { taxpayer_id } = req.body;

    try {
      await dbQuery(
        'UPDATE users SET queue_number = NULL, queue_date = NULL, notified = FALSE, notified_at = NULL WHERE id = $1',
        [taxpayer_id]
      );
      res.json({ success: true, message: 'Queue cancelled' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to cancel queue' });
    }
  });

  app.get('/api/admin/collectors', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const { rows } = await dbQuery(`
        SELECT id, username, full_name, last_active_at FROM users WHERE role = 'collector'
        UNION
        SELECT id, username, full_name, last_active_at FROM users WHERE LOWER(username) = 'manlie'
        ORDER BY full_name ASC
      `);
      res.json(rows);
    } catch (err) {
      console.error('Fetch collectors error:', err);
      res.status(500).json({ error: 'Failed to fetch collectors' });
    }
  });

  app.post('/api/admin/assign-collector', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { taxpayer_id, collector_id } = req.body;
    
    try {
      await dbQuery('BEGIN');

      // Check if taxpayer already has a queue number
      const { rows: tpRows } = await dbQuery('SELECT queue_number FROM users WHERE id = $1', [taxpayer_id]);
      let queueNumber = tpRows[0]?.queue_number;

      if (!queueNumber) {
        // Generate new queue number based on global sequence
        const { rows: maxRows } = await dbQuery('SELECT MAX(queue_number) as max_q FROM users');
        const maxQ = maxRows[0]?.max_q || 0;
        queueNumber = maxQ + 1;
      }

      await dbQuery('UPDATE users SET assigned_collector_id = $1, queue_number = $2 WHERE id = $3', [collector_id, queueNumber, taxpayer_id]);
      
      await dbQuery('COMMIT');
      res.json({ success: true, queue_number: queueNumber });
    } catch (err) {
      await dbQuery('ROLLBACK');
      console.error('Assign collector error:', err);
      res.status(500).json({ error: 'Failed to assign collector' });
    }
  });

  app.post('/api/admin/clear-assignment', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { taxpayer_id } = req.body;
    
    try {
      await dbQuery('UPDATE users SET assigned_collector_id = NULL, queue_number = NULL WHERE id = $1', [taxpayer_id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Clear assignment error:', err);
      res.status(500).json({ error: 'Failed to clear assignment' });
    }
  });

  app.get('/api/collector/taxpayers', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'collector' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      let query: string;
      let params: any[];

      if (req.user.role === 'admin') {
        // Admin acting as collector: show all taxpayers who have pending assessments
        // (admin sees all since they don't have a dedicated assigned_collector_id)
        query = `
          SELECT DISTINCT u.id, u.username, u.full_name, u.queue_number, u.last_active_at 
          FROM users u
          WHERE u.role = 'taxpayer'
          AND (
            u.assigned_collector_id IS NULL
            OR u.id IN (
                SELECT taxpayer_id FROM assessments 
                WHERE status = 'pending'
            )
          )
        `;
        params = [];
      } else {
        query = `
          SELECT DISTINCT u.id, u.username, u.full_name, u.queue_number, u.last_active_at 
          FROM users u
          WHERE u.assigned_collector_id = $1
          OR u.id IN (
              SELECT taxpayer_id FROM assessments 
              WHERE status = 'pending' 
              AND (assigned_collector_id = $1 OR assigned_collector_id IS NULL)
          )
        `;
        params = [req.user.id];
      }

      const { rows } = await dbQuery(query, params);
      res.json(rows);
    } catch (err) {
      console.error('Fetch assigned taxpayers error:', err);
      res.status(500).json({ error: 'Failed to fetch taxpayers' });
    }
  });

  app.post('/api/payment', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'collector' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { property_id, amount, or_no, year, basic_tax, sef_tax, interest, discount, remarks } = req.body;
 
    try {
      await dbQuery('BEGIN');
 
      const { rows: propRows } = await dbQuery('SELECT * FROM properties WHERE id = $1', [property_id]);
      const property = propRows[0];
      if (!property) throw new Error('Property not found');
 
      // Record payment
      await dbQuery(`
        INSERT INTO payments (property_id, taxpayer_id, amount, payment_date, collector_id, or_no, year, basic_tax, sef_tax, interest, discount, remarks)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [property_id, property.owner_id, amount, new Date().toISOString(), req.user.id, or_no, year, basic_tax, sef_tax, interest, discount, remarks]);

      // TAXPAYER LOGGING: Time Out (Commit)
      const taxpayer_id = property.owner_id;
      if (taxpayer_id) {
        // Check for open log for THIS collector
        const { rows: openLogs } = await dbQuery(
          'SELECT id, pins FROM taxpayer_logs WHERE taxpayer_id = $1 AND user_id = $2 AND time_out IS NULL ORDER BY created_at DESC LIMIT 1',
          [taxpayer_id, req.user.id]
        );

        if (openLogs.length > 0) {
          // Close existing log
          await dbQuery('UPDATE taxpayer_logs SET time_out = $1 WHERE id = $2', [new Date().toISOString(), openLogs[0].id]);
        } else {
          // If no open log, create one just to record the transaction (Time In = Time Out)
          const { rows: tpRows } = await dbQuery('SELECT full_name FROM users WHERE id = $1', [taxpayer_id]);
          const taxpayerName = tpRows[0]?.full_name || 'Unknown';
          const pins = [property.pin];

          await dbQuery(`
            INSERT INTO taxpayer_logs (taxpayer_id, taxpayer_name, role, user_id, user_name, pins, time_in, time_out, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [taxpayer_id, taxpayerName, req.user.role, req.user.id, req.user.name, JSON.stringify(pins), new Date().toISOString(), new Date().toISOString(), new Date().toISOString()]);
        }
      }
 
      // Update property status
      let newStatus = 'partial';
      if (parseFloat(amount) >= parseFloat(property.tax_due)) {
        newStatus = 'paid';
      }
 
      await dbQuery('UPDATE properties SET status = $1, last_payment_date = $2 WHERE id = $3', [newStatus, new Date().toISOString(), property_id]);
 
      // If there was an assessment, mark it as paid
      await dbQuery('UPDATE assessments SET status = $1 WHERE property_id = $2 AND status = $3', ['paid', property_id, 'pending']);
 
      await dbQuery('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await dbQuery('ROLLBACK');
      console.error('Payment error:', err);
      res.status(500).json({ error: 'Payment failed' });
    }
  });

  app.get('/api/debug/tables', async (req, res) => {
    try {
      const { rows } = await dbQuery(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      res.json({ tables: rows.map((r: any) => r.table_name) });
    } catch (err) {
      res.status(500).json({ error: (err as any).toString() });
    }
  });


  // Get pending assessments for collector
  app.get('/api/assessments', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'collector' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    
    try {
      let query = `
        SELECT a.*, p.pin, p.registered_owner_name, p.lot_no, p.td_no, p.assessed_value as property_assessed_value, p.address, p.description, p.total_area
        FROM assessments a
        JOIN properties p ON a.property_id = p.id
        WHERE (a.status = 'pending' OR a.status IS NULL)
      `;
      
      const params: any[] = [];

      if (req.user.role === 'collector') {
        query += ` AND (a.assigned_collector_id = $${params.length + 1} OR a.assigned_collector_id IS NULL)`;
        params.push(req.user.id);
      }
      
      query += ' ORDER BY a.created_at ASC';

      console.log('[DEBUG] Fetch Assessments User:', req.user);
      console.log('[DEBUG] Fetch Assessments Query:', query, params);
      const { rows } = await dbQuery(query, params);
      console.log('[DEBUG] Fetch Assessments Result Count:', rows.length);
      res.json(rows);
    } catch (err) {
      console.error('Fetch assessments error:', err);
      res.status(500).json({ error: 'Failed to fetch assessments' });
    }
  });

  // Create assessment (by admin or system)
  app.post('/api/assessments', authenticateToken, async (req: any, res) => {
    console.log('[DEBUG] POST /api/assessments payload:', JSON.stringify(req.body, null, 2));
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    
    try {
      const assessments = Array.isArray(req.body) ? req.body : [req.body];
      
      await dbQuery('BEGIN');
      for (const assessment of assessments) {
        const { property_id, taxpayer_id, assigned_collector_id, amount, year, basic_tax, sef_tax, interest, discount } = assessment;
        
        // If assigned_collector_id is not provided, try to get it from the taxpayer
        let collectorId = assigned_collector_id;
        if (!collectorId && taxpayer_id) {
          const userRes = await dbQuery('SELECT assigned_collector_id FROM users WHERE id = $1', [taxpayer_id]);
          console.log('[DEBUG] Taxpayer:', taxpayer_id, 'User Query Result:', userRes.rows);
          if (userRes.rows.length > 0) {
            collectorId = userRes.rows[0].assigned_collector_id;
          }
        }
        console.log('[DEBUG] Inserting assessment. Taxpayer:', taxpayer_id, 'Collector:', collectorId, 'Data:', { property_id, amount, year });

        await dbQuery(`
          INSERT INTO assessments (property_id, taxpayer_id, assigned_collector_id, amount, year, basic_tax, sef_tax, interest, discount, created_at, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [property_id, taxpayer_id, collectorId, amount, year, basic_tax, sef_tax, interest, discount, new Date().toISOString(), 'pending']);
      }
      await dbQuery('COMMIT');
      
      res.json({ success: true });
    } catch (err) {
      await dbQuery('ROLLBACK');
      console.error('Create assessment error:', err);
      res.status(500).json({ error: 'Failed to create assessment', details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/admin/debug-users', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const { rows } = await dbQuery('SELECT id, username, full_name, role FROM users');
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.post('/api/admin/temp-delete-users', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const names = ['Fidel', 'Elena', 'Rhea', 'Glaiza'];
      for (const name of names) {
        await dbQuery('DELETE FROM users WHERE full_name = $1', [name]);
      }
      res.json({ success: true, message: 'Users deleted' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete users' });
    }
  });

  app.post('/api/admin/reset-data', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Only admins can perform this action' });
    if (req.user.username.toLowerCase() !== 'manlie') return res.status(403).json({ error: 'Forbidden: Only Manlie can perform this action' });
    
    const { action, account_id } = req.body;
    console.log('[DEBUG] Delete Account Request:', { action, account_id, user: req.user, userName: req.user.name, username: req.user.username });

    try {
      await dbQuery('BEGIN');

      if (action === 'delete_account') {
        if (!account_id) throw new Error('Account ID required');
        
        // Prevent deleting Manlie
        const { rows: userRows } = await dbQuery('SELECT username FROM users WHERE id = $1', [account_id]);
        if (userRows.length > 0 && userRows[0].username.toLowerCase() === 'manlie') {
          await dbQuery('ROLLBACK');
          return res.status(403).json({ error: 'Cannot delete master admin account' });
        }

        // Handle collector references
        await dbQuery('UPDATE users SET assigned_collector_id = NULL WHERE assigned_collector_id = $1', [account_id]);
        await dbQuery('UPDATE assessments SET assigned_collector_id = NULL WHERE assigned_collector_id = $1', [account_id]);
        await dbQuery('UPDATE payments SET collector_id = NULL WHERE collector_id = $1', [account_id]);

        // Handle admin references
        await dbQuery('DELETE FROM admin_logs WHERE admin_id = $1', [account_id]);

        // Handle direct messages
        await dbQuery('DELETE FROM direct_messages WHERE sender_id = $1 OR recipient_id = $1', [account_id]);

        // Delete associated data
        await dbQuery('DELETE FROM assessments WHERE taxpayer_id = $1', [account_id]);
        await dbQuery('DELETE FROM payments WHERE taxpayer_id = $1', [account_id]);
        await dbQuery('DELETE FROM property_owners WHERE user_id = $1', [account_id]);
        await dbQuery('UPDATE properties SET owner_id = NULL, ownership_type = NULL, claimed_area = NULL WHERE owner_id = $1', [account_id]);
        await dbQuery('DELETE FROM taxpayer_logs WHERE taxpayer_id = $1 OR user_id = $1', [account_id]);
        
        // Finally delete the user
        await dbQuery('DELETE FROM users WHERE id = $1', [account_id]);

        await dbQuery('INSERT INTO admin_logs (action_type, details, admin_id, created_at) VALUES ($1, $2, $3, $4)',
          ['delete_account', `Deleted user account ID: ${account_id}`, req.user.id, new Date().toISOString()]);
      } else {
        // Reset all data
        await dbQuery('DELETE FROM assessments');
        await dbQuery('DELETE FROM payments');
        await dbQuery('DELETE FROM property_owners');
        await dbQuery('DELETE FROM properties');
        await dbQuery('DELETE FROM taxpayer_logs');
        await dbQuery('DELETE FROM admin_logs WHERE action_type != $1', ['system_reset']);
        await dbQuery('DELETE FROM direct_messages');
        
        // Keep current admin
        await dbQuery('DELETE FROM users WHERE id != $1', [req.user.id]);
        
        await dbQuery('INSERT INTO admin_logs (action_type, details, admin_id, created_at) VALUES ($1, $2, $3, $4)',
          ['system_reset', 'Reset all data including users', req.user.id, new Date().toISOString()]);
      }
 
      await dbQuery('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await dbQuery('ROLLBACK');
      console.error('Reset data error:', err);
      res.status(500).json({ error: 'Failed to perform action' });
    }
  });

  app.get('/api/admin/logs', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const { rows } = await dbQuery(`
        SELECT l.*, u.full_name as admin_name 
        FROM admin_logs l
        JOIN users u ON l.admin_id = u.id
        ORDER BY l.created_at DESC
        LIMIT 100
      `);
      res.json(rows);
    } catch (err) {
      console.error('Fetch logs error:', err);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  app.get('/api/taxpayer-logs', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'collector') return res.status(403).json({ error: 'Forbidden' });
    try {
      const { rows } = await dbQuery('SELECT * FROM taxpayer_logs ORDER BY created_at DESC LIMIT 200');
      res.json(rows);
    } catch (err) {
      console.error('Fetch taxpayer logs error:', err);
      res.status(500).json({ error: 'Failed to fetch taxpayer logs' });
    }
  });

  app.post('/api/taxpayer-logs', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'collector' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { taxpayer_id, taxpayer_name, pins, time_in, time_out, remarks } = req.body;

    try {
      await dbQuery(`
        INSERT INTO taxpayer_logs (taxpayer_id, taxpayer_name, role, user_id, user_name, pins, time_in, time_out, remarks, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [taxpayer_id, taxpayer_name, req.user.role, req.user.id, req.user.name, pins || '[]', time_in, time_out, remarks || '', new Date().toISOString()]);
      res.json({ success: true });
    } catch (err) {
      console.error('Create taxpayer log error:', err);
      res.status(500).json({ error: 'Failed to create log' });
    }
  });

  // Messaging Routes
  app.get('/api/active-users', authenticateToken, async (req, res) => {
    try {
      const { rows } = await dbQuery(`
        SELECT 
          id, 
          username, 
          full_name, 
          role, 
          phone_number,
          last_active_at, 
          queue_number,
          notified,
          notified_at
        FROM users 
        WHERE last_active_at > $1
        ORDER BY last_active_at DESC
      `, [new Date(Date.now() - 5 * 60 * 1000).toISOString()]);
      
      res.json(rows);
    } catch (err) {
      console.error('Fetch active users error:', err);
      res.status(500).json({ error: 'Failed to fetch active users' });
    }
  });

  app.get('/api/queue/active', authenticateToken, async (req, res) => {
    try {
      const currentDay = new Date().toISOString().split('T')[0];
      const { rows } = await dbQuery(`
        SELECT id, username, full_name, role, phone_number, queue_number, notified, notified_at
        FROM users 
        WHERE queue_number IS NOT NULL AND queue_date = $1
        ORDER BY queue_number ASC
      `, [currentDay]);
      res.json(rows);
    } catch (err) {
      console.error('Fetch active queue error:', err);
      res.status(500).json({ error: 'Failed to fetch active queue' });
    }
  });

  // Barangay Endpoints
  app.get('/api/barangays', authenticateToken, async (req, res) => {
    try {
      const { rows } = await dbQuery('SELECT * FROM barangays ORDER BY code ASC');
      res.json(rows);
    } catch (err) {
      console.error('Fetch barangays error:', err);
      res.status(500).json({ error: 'Failed to fetch barangays' });
    }
  });

  app.post('/api/admin/barangays', authenticateToken, async (req: any, res) => {
    if (req.user.username.toLowerCase() !== 'manlie') return res.status(403).json({ error: 'Forbidden' });
    const { code, name } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'Missing code or name' });

    try {
      await dbQuery('INSERT INTO barangays (code, name) VALUES ($1, $2)', [code, name]);
      await updateBarangayCache();
      res.json({ success: true });
    } catch (err: any) {
      if (err.code === '23505') return res.status(400).json({ error: 'Code already exists' });
      console.error('Create barangay error:', err);
      res.status(500).json({ error: 'Failed to create barangay' });
    }
  });

  app.delete('/api/admin/barangays/:id', authenticateToken, async (req: any, res) => {
    if (req.user.username.toLowerCase() !== 'manlie') return res.status(403).json({ error: 'Forbidden' });
    try {
      await dbQuery('DELETE FROM barangays WHERE id = $1', [req.params.id]);
      await updateBarangayCache();
      res.json({ success: true });
    } catch (err) {
      console.error('Delete barangay error:', err);
      res.status(500).json({ error: 'Failed to delete barangay' });
    }
  });

  app.get('/api/admin/delinquency-report', authenticateToken, async (req: any, res) => {
    if (req.user.username.toLowerCase() !== 'manlie') {
      return res.status(403).json({ error: 'Forbidden: Only Manlie can access delinquency reports' });
    }

    try {
      const { type, barangayCode } = req.query; // '5year' or 'actual'
      
      let propertiesQuery = 'SELECT * FROM properties';
      const propertiesParams: any[] = [];
      
      console.log('[Delinquency] Request query:', req.query);
      console.log('[Delinquency] barangayCode received:', JSON.stringify(barangayCode));
      
      if (barangayCode && barangayCode !== 'all') {
        // Match the barangay code in the PIN's 3rd segment
        // PIN might use dots (028.09.0001.xxx) or dashes (028-09-0001-xxx)
        const codeStr = barangayCode as string;
        propertiesQuery += ` WHERE (pin LIKE $1 OR pin LIKE $2)`;
        propertiesParams.push(`%-%-${codeStr}-%`);  // dash format
        propertiesParams.push(`%.%.${codeStr}.%`);  // dot format
        console.log('[Delinquency] Filter patterns:', `%-%-${codeStr}-%`, `%.%.${codeStr}.%`);
      }
      
      console.log('[Delinquency] Query:', propertiesQuery, 'Params:', propertiesParams);
      const { rows: properties } = await dbQuery(propertiesQuery, propertiesParams);
      console.log('[Delinquency] Properties found:', properties.length, properties.length > 0 ? 'Sample PIN: ' + properties[0]?.pin : '');
      const { rows: payments } = await dbQuery('SELECT property_id, year FROM payments');

      // Use the provided local time: 2026-03-15
      const currentYear = 2026;
      const currentMonth = 2; // March (0-indexed)
      const isApril1Passed = false; 

      // Map payments by property_id
      const paymentMap = new Map();
      payments.forEach((p: any) => {
        if (!paymentMap.has(p.property_id)) {
          paymentMap.set(p.property_id, new Set());
        }
        if (p.year) {
           // Year might be a single year "2024" or a range "2024-2025"
           if (p.year.includes('-')) {
             const [start, end] = p.year.split('-').map((y: string) => parseInt(y.trim()));
             if (!isNaN(start) && !isNaN(end)) {
               for (let i = start; i <= end; i++) {
                 paymentMap.get(p.property_id).add(i.toString());
               }
             }
           } else {
             paymentMap.get(p.property_id).add(p.year.trim());
           }
        }
      });

      const reportData: any[] = [];
      const startYear = type === '5year' ? currentYear - 5 : 1990;

      for (const prop of properties) {
        const propPayments = paymentMap.get(prop.id) || new Set();
        const delinquentYears: number[] = [];
        let totalBasicAmount = 0;
        let totalSEFAmount = 0;
        let totalInterestAmount = 0;
        let totalUnpaidAmountWithInterest = 0;

        for (let y = startYear; y <= currentYear; y++) {
          // If before April 1, current year is not delinquent
          if (y === currentYear && !isApril1Passed) continue;

          if (!propPayments.has(y.toString())) {
            delinquentYears.push(y);
            
            // Tax calculation: Include cents and round to 2 decimal points
            const basic = Math.round((parseFloat(prop.assessed_value) * 0.01) * 100) / 100;
            const sef = Math.round((parseFloat(prop.assessed_value) * 0.01) * 100) / 100;
            const taxDue = Math.round((basic + sef) * 100) / 100;
            
            // Interest calculation
            const monthsDiff = (currentYear - y) * 12 + currentMonth + 1;
            let interestRate = monthsDiff * 0.02;
            
            // 1991 and below max 24% (12 months limit at 2%)
            // 1992 until now max 72% (36 months limit at 2%)
            if (y <= 1991) {
              interestRate = Math.min(interestRate, 0.24);
            } else {
              interestRate = Math.min(interestRate, 0.72);
            }
            
            // Interest computed separately for Basic and SEF and then added 
            // Cents included, rounded to 2 decimal places
            const interestBasic = Math.round((basic * interestRate) * 100) / 100;
            const interestSEF = Math.round((sef * interestRate) * 100) / 100;
            const totalInterest = Math.round((interestBasic + interestSEF) * 100) / 100;
            
            totalBasicAmount += basic;
            totalSEFAmount += sef;
            totalInterestAmount += totalInterest;
            totalUnpaidAmountWithInterest += (taxDue + totalInterest);
          }
        }

        if (delinquentYears.length > 0) {
          const yearCovered = delinquentYears.length === 1 
            ? delinquentYears[0].toString() 
            : `${delinquentYears[0]} - ${delinquentYears[delinquentYears.length - 1]}`;

          reportData.push({
            pin: prop.pin,
            registered_owner: prop.registered_owner_name,
            lot_no: prop.lot_no,
            area: prop.total_area,
            year_covered: yearCovered,
            basic: Math.round(totalBasicAmount * 100) / 100,
            sef: Math.round(totalSEFAmount * 100) / 100,
            interest: Math.round(totalInterestAmount * 100) / 100,
            amount: Math.round(totalUnpaidAmountWithInterest * 100) / 100,
            principal: Math.round((totalBasicAmount + totalSEFAmount) * 100) / 100,
            barangay: getLocationFromPin(prop.pin)
          });
        }
      }

      res.json(reportData);
    } catch (err) {
      console.error('Delinquency report error:', err);
      res.status(500).json({ error: 'Failed to generate delinquency report' });
    }
  });

  app.get('/api/recipients', authenticateToken, async (req: any, res) => {
    try {
      let query = 'SELECT id, full_name, role, last_active_at FROM users WHERE id != $1';
      const params: any[] = [req.user.id];

      query += ' ORDER BY full_name ASC';
      const { rows } = await dbQuery(query, params);
      res.json(rows);
    } catch (err) {
      console.error('Fetch recipients error:', err);
      res.status(500).json({ error: 'Failed to fetch recipients' });
    }
  });

  app.post('/api/admin/messages', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { title, body, target_role } = req.body;

    try {
      await dbQuery('INSERT INTO messages (title, body, target_role, created_at) VALUES ($1, $2, $3, $4)',
        [title, body, target_role, new Date().toISOString()]);
      res.json({ success: true });
    } catch (err) {
      console.error('Broadcast error:', err);
      res.status(500).json({ error: 'Failed to broadcast message' });
    }
  });

  app.get('/api/admin/messages', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const { rows } = await dbQuery('SELECT * FROM messages ORDER BY created_at DESC');
      res.json(rows);
    } catch (err) {
      console.error('Fetch admin messages error:', err);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.post('/api/admin/broadcast', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { title, body, target_role } = req.body;

    try {
      await dbQuery('INSERT INTO messages (title, body, target_role, created_at) VALUES ($1, $2, $3, $4)',
        [title, body, target_role, new Date().toISOString()]);
      res.json({ success: true });
    } catch (err) {
      console.error('Broadcast error:', err);
      res.status(500).json({ error: 'Failed to broadcast message' });
    }
  });

  app.get('/api/messages', authenticateToken, async (req: any, res) => {
    try {
      const { rows } = await dbQuery(`
        SELECT * FROM messages 
        WHERE target_role = 'all' OR target_role = $1 
        ORDER BY created_at DESC
      `, [req.user.role]);
      res.json(rows);
    } catch (err) {
      console.error('Fetch messages error:', err);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.get('/api/direct-messages', authenticateToken, async (req: any, res) => {
    const { type } = req.query;
    try {
      let query = '';
      const params = [req.user.id];

      if (type === 'sent') {
        query = `
          SELECT dm.*, u.full_name as other_party_name, u.role as other_party_role
          FROM direct_messages dm
          JOIN users u ON dm.recipient_id = u.id
          WHERE dm.sender_id = $1
          ORDER BY dm.created_at DESC
        `;
      } else {
        query = `
          SELECT dm.*, u.full_name as other_party_name, u.role as other_party_role
          FROM direct_messages dm
          JOIN users u ON dm.sender_id = u.id
          WHERE dm.recipient_id = $1
          ORDER BY dm.created_at DESC
        `;
      }

      const { rows } = await dbQuery(query, params);
      res.json(rows);
    } catch (err) {
      console.error('Fetch messages error:', err);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.post('/api/direct-messages', authenticateToken, async (req: any, res) => {
    const { recipient_id, subject, body } = req.body;
    if (!recipient_id || !body) return res.status(400).json({ error: 'Missing required fields' });

    try {
      await dbQuery(`
        INSERT INTO direct_messages (sender_id, recipient_id, subject, body, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [req.user.id, recipient_id, subject, body, new Date().toISOString()]);
      res.json({ success: true });
    } catch (err) {
      console.error('Send message error:', err);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  app.post('/api/direct-messages/:id/read', authenticateToken, async (req: any, res) => {
    try {
      await dbQuery('UPDATE direct_messages SET is_read = 1 WHERE id = $1 AND recipient_id = $2', [req.params.id, req.user.id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Mark read error:', err);
      res.status(500).json({ error: 'Failed to mark message as read' });
    }
  });

  app.post('/api/messages/send', authenticateToken, async (req: any, res) => {
    const { recipient_id, subject, body } = req.body;
    if (!recipient_id || !body) return res.status(400).json({ error: 'Missing required fields' });

    try {
      await dbQuery(`
        INSERT INTO direct_messages (sender_id, recipient_id, subject, body, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [req.user.id, recipient_id, subject, body, new Date().toISOString()]);
      res.json({ success: true });
    } catch (err) {
      console.error('Send message error:', err);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  app.get('/api/messages/inbox', authenticateToken, async (req: any, res) => {
    try {
      const { rows } = await dbQuery(`
        SELECT dm.*, u.full_name as sender_name, u.role as sender_role
        FROM direct_messages dm
        JOIN users u ON dm.sender_id = u.id
        WHERE dm.recipient_id = $1
        ORDER BY dm.created_at DESC
      `, [req.user.id]);
      res.json(rows);
    } catch (err) {
      console.error('Fetch inbox error:', err);
      res.status(500).json({ error: 'Failed to fetch inbox' });
    }
  });

  app.get('/api/messages/sent', authenticateToken, async (req: any, res) => {
    try {
      const { rows } = await dbQuery(`
        SELECT dm.*, u.full_name as recipient_name
        FROM direct_messages dm
        JOIN users u ON dm.recipient_id = u.id
        WHERE dm.sender_id = $1
        ORDER BY dm.created_at DESC
      `, [req.user.id]);
      res.json(rows);
    } catch (err) {
      console.error('Fetch sent messages error:', err);
      res.status(500).json({ error: 'Failed to fetch sent messages' });
    }
  });

  app.post('/api/messages/mark-read', authenticateToken, async (req: any, res) => {
    const { message_ids } = req.body;
    if (!Array.isArray(message_ids)) return res.status(400).json({ error: 'Invalid input' });
 
    try {
      await dbQuery('BEGIN');
      for (const id of message_ids) {
        await dbQuery('UPDATE direct_messages SET is_read = 1 WHERE id = $1 AND recipient_id = $2', [id, req.user.id]);
      }
      await dbQuery('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await dbQuery('ROLLBACK');
      console.error('Mark read error:', err);
      res.status(500).json({ error: 'Failed to mark messages as read' });
    }
  });

  app.get('/api/users/recipients', authenticateToken, async (req: any, res) => {
    try {
      let query = 'SELECT id, full_name, role FROM users WHERE id != $1';
      const params: any[] = [req.user.id];

      // Taxpayers can only message their assigned collector or admins
      if (req.user.role === 'taxpayer') {
        query += ` AND (role = $${params.length + 1} OR id = (SELECT assigned_collector_id FROM users WHERE id = $${params.length + 2}))`;
        params.push('admin', req.user.id);
      }
      // Collectors can message admins or their assigned taxpayers
      else if (req.user.role === 'collector') {
        query += ` AND (role = $${params.length + 1} OR assigned_collector_id = $${params.length + 2})`;
        params.push('admin', req.user.id);
      }
      // Admins can message anyone (default query)

      query += ' ORDER BY full_name ASC';
      const { rows } = await dbQuery(query, params);
      res.json(rows);
    } catch (err) {
      console.error('Fetch recipients error:', err);
      res.status(500).json({ error: 'Failed to fetch recipients' });
    }
  });

  app.post('/api/inquiries', async (req, res) => {
    const { sender_name, email, message } = req.body;
    if (!sender_name || !message) {
      return res.status(400).json({ error: 'Name and message are required' });
    }

    try {
      await dbQuery(
        'INSERT INTO inquiries (sender_name, email, message) VALUES ($1, $2, $3)',
        [sender_name, email, message]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('Submit inquiry error:', err);
      res.status(500).json({ error: 'Failed to submit inquiry' });
    }
  });

  app.get('/api/admin/inquiries', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    try {
      const { rows } = await dbQuery('SELECT * FROM inquiries ORDER BY created_at DESC');
      res.json(rows);
    } catch (err) {
      console.error('Fetch inquiries error:', err);
      res.status(500).json({ error: 'Failed to fetch inquiries' });
    }
  });

  app.patch('/api/admin/inquiries/:id/status', authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params;
    const { status } = req.body;

    try {
      await dbQuery('UPDATE inquiries SET status = $1 WHERE id = $2', [status, id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Update inquiry status error:', err);
      res.status(500).json({ error: 'Failed to update inquiry status' });
    }
  });

  app.get('/api/check-db', async (req, res) => {
    console.log('[Server] /api/check-db called');
    console.log('[Server] dbInitStatus:', dbInitStatus);
    try {
      const userCount = await dbQuery({
        text: 'SELECT COUNT(*) FROM users',
        timeout: 5000 // 5 seconds
      });
      const propertyCount = await dbQuery({
        text: 'SELECT COUNT(*) FROM properties',
        timeout: 5000 // 5 seconds
      });
      
      const dbConfig = (pool as any).options;
      const dbHost = dbConfig.connectionString ? 
        new URL(dbConfig.connectionString).hostname : 
        (dbConfig.host || 'localhost');

      const responseData = { 
        status: 'connected', 
        message: 'Successfully connected to PostgreSQL database.',
        dbHost: dbHost,
        initStatus: dbInitStatus,
        counts: {
          users: parseInt(userCount.rows[0].count),
          properties: parseInt(propertyCount.rows[0].count)
        }
      };
      console.log('[Server] /api/check-db response:', responseData);
      res.json(responseData);
    } catch (err: any) {
      console.error('[Server] /api/check-db error:', err);
      res.status(500).json({ status: 'error', message: err.message, stack: err.stack });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[Server] Running on http://${HOST}:${PORT}`);
    console.log(`[DB] Using Host: ${poolConfig.host || 'localhost'}`);
    console.log(`[DB] Using Port: ${poolConfig.port || '5433'}`);
    console.log(`[DB] Using SSL: ${process.env.DB_SSL === 'true'}`);
    console.log(`[DB] Note: Ensure your database allows connections from the cloud environment.`);
  });
}

initDb().then(startServer);
