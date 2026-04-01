import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ 
  user: 'postgres', 
  host: 'localhost', 
  database: 'rpt_monitor_data', 
  password: 'To!nk6125', 
  port: 5433 
});
try {
  const r = await pool.query('SELECT username, id, assigned_collector_id FROM users');
  console.log(JSON.stringify(r.rows, null, 2));
} catch (e) {
  console.error(e);
} finally {
  await pool.end();
}
