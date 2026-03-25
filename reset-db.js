import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ 
  user: 'postgres', 
  host: 'localhost', 
  database: 'rpt_monitor_data', 
  password: 'To!nk6125', 
  port: 5433 
});
async function run() {
  const client = await pool.connect();
  try {
    console.log('Soft-resetting queue data (preserving user accounts)...');
    await client.query('BEGIN');
    
    // Clear all taxpayer logs (transactional history for queue)
    await client.query("DELETE FROM taxpayer_logs;");
    
    // Reset queue status for all taxpayer users without deleting their accounts
    await client.query(`
      UPDATE users 
      SET 
        queue_number = NULL, 
        queue_date = NULL, 
        notified = FALSE, 
        notified_at = NULL 
      WHERE role = 'taxpayer';
    `);
    
    await client.query('COMMIT');
    console.log('SYSTEM RESET COMPLETE: All active queue tickets and logs have been cleared.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('CRITICAL ERROR: Failed to reset queue data.', err);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
