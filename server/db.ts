import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import { eq, and, sql, asc } from 'drizzle-orm';
import { DEFAULT_COMPUTATION_RULES } from '../src/lib/rptComputation.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { mockStore, MockDb } from './mock-db.js';

export { mockStore } from './mock-db.js';

export interface DbInitStatus {
  initialized: boolean;
  error: string | null;
  timestamp: string | null;
  mode: 'database' | 'mock';
}

export let dbInitStatus: DbInitStatus = {
  initialized: false,
  error: null,
  timestamp: null,
  mode: 'database'
};

export const getPoolConfig = () => {
  const commonConfig = {
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    query_timeout: 20000,
    keepAlive: true,
    max: 20,
  };

  const config: any = process.env.DATABASE_URL
    ? { ...commonConfig, connectionString: process.env.DATABASE_URL }
    : {
        ...commonConfig,
        user: String(process.env.DB_USER || 'postgres'),
        host: String(process.env.DB_HOST || 'localhost'),
        database: String(process.env.DB_NAME || 'rpt_monitor_data'),
        password: String(process.env.DB_PASSWORD || ''),
        port: parseInt(process.env.DB_PORT || '5433'),
      };

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
    user: config.user || (config.connectionString ? 'from URL' : 'missing'),
    host: config.host || (config.connectionString ? 'from URL' : 'missing'),
    database: config.database || (config.connectionString ? 'from URL' : 'missing'),
    port: config.port || (config.connectionString ? 'from URL' : 'missing'),
    ssl: !!config.ssl,
    hasPassword: !!(config.password || (config.connectionString && (config.connectionString.includes(':') && config.connectionString.split('@')[0].includes(':'))))
  });

  return config;
};

export const pool = new Pool(getPoolConfig());

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export let db: any = new MockDb();

export const initDrizzle = () => {
  db = drizzle(pool, { schema });
};

export const dbQuery = async (text: string | { text: string, timeout?: number }, params: any[] = []) => {
  return await pool.query(text, params);
};

export const setDbInitStatus = (status: DbInitStatus) => {
  dbInitStatus = status;
};

export const canAccessProperty = async (user: any, propertyId: number) => {
  if (!user) return false;
  if (user.role === 'admin') return true;

  if (user.role === 'taxpayer') {
    const rows = await db.select().from(schema.propertyOwners)
      .where(and(
        eq(schema.propertyOwners.propertyId, propertyId),
        eq(schema.propertyOwners.userId, user.id)
      ))
      .limit(1);
    return rows.length > 0;
  }

  if (user.role === 'collector') {
    const rows = await db.select().from(schema.propertyOwners)
      .innerJoin(schema.users, eq(schema.users.id, schema.propertyOwners.userId))
      .where(and(
        eq(schema.propertyOwners.propertyId, propertyId),
        eq(schema.users.assignedCollectorId, user.id)
      ))
      .limit(1);
    return rows.length > 0;
  }

  return false;
};

export const getAuthorizedPropertiesByPins = async (user: any, pins: string[]) => {
  if (!user || pins.length === 0) return [];

  if (user.role === 'admin') {
    return await db.select().from(schema.properties)
      .where(sql`${schema.properties.pin} = ANY(${pins})`);
  }

  if (user.role === 'collector') {
    return await db.select({
      id: schema.properties.id,
      ownerId: schema.properties.ownerId,
      registeredOwnerName: schema.properties.registeredOwnerName,
      pin: schema.properties.pin,
      tdNo: schema.properties.tdNo,
      lotNo: schema.properties.lotNo,
      address: schema.properties.address,
      kind: schema.properties.kind,
      assessedValue: schema.properties.assessedValue,
      taxDue: schema.properties.taxDue,
      status: schema.properties.status,
      lastPaymentDate: schema.properties.lastPaymentDate,
      totalArea: schema.properties.totalArea,
      ownershipType: schema.properties.ownershipType,
      claimedArea: schema.properties.claimedArea,
      taxability: schema.properties.taxability,
      classification: schema.properties.classification,
      oldPin: schema.properties.oldPin,
      effectivity: schema.properties.effectivity,
      remarks: schema.properties.remarks,
    }).from(schema.properties)
      .innerJoin(schema.propertyOwners, eq(schema.propertyOwners.propertyId, schema.properties.id))
      .innerJoin(schema.users, eq(schema.users.id, schema.propertyOwners.userId))
      .where(and(
        sql`${schema.properties.pin} = ANY(${pins})`,
        eq(schema.users.assignedCollectorId, user.id)
      ));
  }

  if (user.role === 'taxpayer') {
    return await db.select({
      id: schema.properties.id,
      ownerId: schema.properties.ownerId,
      registeredOwnerName: schema.properties.registeredOwnerName,
      pin: schema.properties.pin,
      tdNo: schema.properties.tdNo,
      lotNo: schema.properties.lotNo,
      address: schema.properties.address,
      kind: schema.properties.kind,
      assessedValue: schema.properties.assessedValue,
      taxDue: schema.properties.taxDue,
      status: schema.properties.status,
      lastPaymentDate: schema.properties.lastPaymentDate,
      totalArea: schema.properties.totalArea,
      ownershipType: schema.properties.ownershipType,
      claimedArea: schema.properties.claimedArea,
      taxability: schema.properties.taxability,
      classification: schema.properties.classification,
      oldPin: schema.properties.oldPin,
      effectivity: schema.properties.effectivity,
      remarks: schema.properties.remarks,
    }).from(schema.properties)
      .innerJoin(schema.propertyOwners, eq(schema.propertyOwners.propertyId, schema.properties.id))
      .where(and(
        sql`${schema.properties.pin} = ANY(${pins})`,
        eq(schema.propertyOwners.userId, user.id)
      ));
  }

  return [];
};

const INITIAL_BARANGAYS = [
  ['0001', 'Batong Buhay'], ['0002', 'Buenavista'], ['0003', 'Burgos'],
  ['0004', 'Claudio Salgado'], ['0005', 'Ligaya'], ['0006', 'Paetan'],
  ['0007', 'Pag-asa'], ['0008', 'Sta. Lucia'], ['0009', 'San Vicente'],
  ['0010', 'Sto. Niño'], ['0011', 'Tagumpay'], ['0012', 'Victoria'],
  ['0013', 'Poblacion'], ['0014', 'San Agustin'], ['0015', 'Gen. Emilio Aguinalde'],
  ['0016', 'Ibud'], ['0017', 'Ilvita'], ['0018', 'Lagnas'],
  ['0019', 'Malisbong'], ['0020', 'San Francisco'], ['0021', 'San Nicolas'],
  ['0022', 'Tuban']
];

export let cachedBarangays: { code: string, name: string }[] = [];

export const updateBarangayCache = async () => {
  try {
    const rows = await db.select({ code: schema.barangays.code, name: schema.barangays.name })
      .from(schema.barangays)
      .orderBy(asc(schema.barangays.code));
    cachedBarangays = rows;
  } catch (err) {
    cachedBarangays = INITIAL_BARANGAYS.map(([code, name]) => ({ code, name }));
  }
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrationFiles(): Promise<void> {
  const migrationsDir = path.resolve(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.warn('[DB] No migrations directory found, skipping migration files.');
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('[DB] No migration files found.');
    return;
  }

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const file of files) {
    const { rows } = await dbQuery('SELECT 1 FROM _migrations WHERE filename = $1', [file]);
    if (rows.length > 0) {
      console.log(`[DB] Migration ${file} already applied, skipping.`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`[DB] Applying migration: ${file}`);
    await dbQuery(sql);
    await dbQuery('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
    console.log(`[DB] Migration ${file} applied successfully.`);
  }
}

export const initDb = async (retries = 5, delay = 2000) => {
  const poolConfig = getPoolConfig();
  const isPrivateIp = poolConfig.host?.startsWith('100.') || poolConfig.host?.startsWith('192.168.') || poolConfig.host?.startsWith('10.') || poolConfig.host?.startsWith('172.');

  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[DB] Connection attempt ${i + 1} of ${retries}...`);
      if (isPrivateIp) {
        console.warn(`[DB] WARNING: You are using a private IP (${poolConfig.host}). The cloud environment may not be able to reach this address without a tunnel (like ngrok).`);
      }

      await dbQuery('BEGIN');

      await runMigrationFiles();

      for (const rule of DEFAULT_COMPUTATION_RULES) {
        await dbQuery(
          `INSERT INTO custom_computation_types
            (label, value, base_type, description, special_case_hook, effective_from, effective_to, config, is_active, is_builtin)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
           ON CONFLICT (value) DO NOTHING`,
          [
            rule.label,
            rule.value,
            rule.base_type,
            rule.description || null,
            rule.special_case_hook,
            rule.effective_from || null,
            rule.effective_to || null,
            JSON.stringify(rule.config || {}),
            rule.is_active !== false,
            true
          ]
        ).catch(e => console.log(`Seed computation rule ${rule.value} failed:`, e.message));
      }

      const { rows: bRows } = await dbQuery('SELECT COUNT(*) FROM barangays');
      if (parseInt(bRows[0].count) === 0) {
        for (const [code, name] of INITIAL_BARANGAYS) {
          await dbQuery('INSERT INTO barangays (code, name) VALUES ($1, $2)', [code, name]);
        }
      }

      await updateBarangayCache();

      console.log('Checking for essential system accounts...');

      const manlieSeedPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
      const { rows: manlieRows } = await dbQuery('SELECT * FROM users WHERE LOWER(username) = $1', ['manlie']);
      if (manlieRows.length === 0) {
        if (manlieSeedPassword) {
          const manliePass = bcrypt.hashSync(manlieSeedPassword, 10);
          await dbQuery('INSERT INTO users (username, password, role, full_name) VALUES ($1, $2, $3, $4)', ['manlie', manliePass, 'admin', 'Manlie C. Ocang']);
        } else {
          console.warn('[SECURITY] Skipping seeded admin account creation because SEED_ADMIN_PASSWORD is not configured.');
        }
      } else {
        await dbQuery('UPDATE users SET role = $1, full_name = $2 WHERE LOWER(username) = $3', ['admin', 'Manlie C. Ocang', 'manlie']);
      }

      const treasSeedPassword = process.env.SEED_QUEUE_PASSWORD?.trim();
      const { rows: treasRows } = await dbQuery('SELECT * FROM users WHERE LOWER(username) = $1', ['treas']);
      if (treasRows.length === 0) {
        if (treasSeedPassword) {
          const treasPass = bcrypt.hashSync(treasSeedPassword, 10);
          await dbQuery('INSERT INTO users (username, password, role, full_name) VALUES ($1, $2, $3, $4)', ['treas', treasPass, 'queue', 'Treasurer Queue Kiosk']);
        } else {
          console.warn('[SECURITY] Skipping seeded queue account creation because SEED_QUEUE_PASSWORD is not configured.');
        }
      } else {
        await dbQuery('UPDATE users SET role = $1, full_name = $2 WHERE LOWER(username) = $3', ['queue', 'Treasurer Queue Kiosk', 'treas']);
      }

      await dbQuery('COMMIT');

      initDrizzle();
      setDbInitStatus({ initialized: true, error: null, timestamp: new Date().toISOString(), mode: 'database' });
      console.log('Database initialized successfully.');
      return;
    } catch (e: any) {
      try { await dbQuery('ROLLBACK'); } catch (rbErr) { }

      console.error(`[DB] Attempt ${i + 1} failed: ${e.message}`);

      if (i === retries - 1) {
        db = new MockDb();
        setDbInitStatus({
          initialized: true,
          error: e.message,
          timestamp: new Date().toISOString(),
          mode: 'mock'
        });
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
