import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const getPoolConfig = () => {
  const commonConfig = {
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    query_timeout: 10000,
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

  const useSSL = process.env.DB_SSL === 'true' || 
                 (process.env.DATABASE_URL && (
                   process.env.DATABASE_URL.includes('neon.tech') || 
                   process.env.DATABASE_URL.includes('supabase.co') ||
                   process.env.DATABASE_URL.includes('render.com') ||
                   process.env.DATABASE_URL.includes('a0.pg.com')
                 ));

  if (useSSL) {
    config.ssl = { rejectUnauthorized: false };
  }
  return config;
};

async function main() {
  const pool = new Pool(getPoolConfig());
  
  try {
    const { rows } = await pool.query("SELECT id, username, full_name, role FROM users WHERE username IN ('fidel', 'elena', 'rhea', 'glaiza') OR full_name ILIKE '%fidel%' OR full_name ILIKE '%elena%' OR full_name ILIKE '%rhea%' OR full_name ILIKE '%glaiza%'");
    console.log("Found users to delete:", rows);
    
    if (rows.length > 0) {
       const userIds = rows.map(u => u.id);
       
       await pool.query('BEGIN');
       
       console.log('Deleting dependent records...');
       await pool.query('DELETE FROM admin_logs WHERE admin_id = ANY($1::int[])', [userIds]);
       await pool.query('DELETE FROM taxpayer_logs WHERE taxpayer_id = ANY($1::int[]) OR user_id = ANY($1::int[])', [userIds]);
       await pool.query('DELETE FROM direct_messages WHERE sender_id = ANY($1::int[]) OR recipient_id = ANY($1::int[])', [userIds]);
       await pool.query('DELETE FROM payments WHERE taxpayer_id = ANY($1::int[]) OR collector_id = ANY($1::int[])', [userIds]);
       await pool.query('DELETE FROM assessments WHERE taxpayer_id = ANY($1::int[]) OR assigned_collector_id = ANY($1::int[])', [userIds]);
       await pool.query('DELETE FROM property_owners WHERE user_id = ANY($1::int[])', [userIds]);

       // For properties, delete from assessments and payments and property_owners for those properties first
       const { rows: properties } = await pool.query('SELECT id FROM properties WHERE owner_id = ANY($1::int[])', [userIds]);
       const propertyIds = properties.map(p => p.id);
       if (propertyIds.length > 0) {
           await pool.query('DELETE FROM property_owners WHERE property_id = ANY($1::int[])', [propertyIds]);
           await pool.query('DELETE FROM payments WHERE property_id = ANY($1::int[])', [propertyIds]);
           await pool.query('DELETE FROM assessments WHERE property_id = ANY($1::int[])', [propertyIds]);
           await pool.query('DELETE FROM properties WHERE id = ANY($1::int[])', [propertyIds]);
       }
       
       // Update users who have this user as assigned collector
       await pool.query('UPDATE users SET assigned_collector_id = NULL WHERE assigned_collector_id = ANY($1::int[])', [userIds]);
       
       // Finally delete users
       console.log('Deleting users...');
       await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [userIds]);
       
       await pool.query('COMMIT');
       console.log('Successfully deleted the users and their related records.');
    } else {
       console.log("No matching users found in the database.");
    }

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("Database error:", err);
  } finally {
    await pool.end();
  }
}

main();
