import { Router } from 'express';
import { authenticateToken } from '../middleware.js';
import { db } from '../db.js';
import { users, adminLogs, taxpayerLogs } from '../schema.js';
import { eq, sql, and, isNull, desc } from 'drizzle-orm';

const router = Router();

router.get('/admin/logs', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await db.execute(sql`
      SELECT l.*, u.full_name as admin_name
      FROM admin_logs l
      JOIN users u ON l.admin_id = u.id
      ORDER BY l.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows || result);
  } catch (err) {
    console.error('Fetch logs error:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

router.get('/taxpayer-logs', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'collector') return res.status(403).json({ error: 'Forbidden' });
  try {
    const rows = await db.select().from(taxpayerLogs)
      .orderBy(desc(taxpayerLogs.createdAt)).limit(200);
    res.json(rows);
  } catch (err) {
    console.error('Fetch taxpayer logs error:', err);
    res.status(500).json({ error: 'Failed to fetch taxpayer logs' });
  }
});

router.post('/taxpayer-logs', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'collector' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { taxpayer_id, taxpayer_name, pins, time_in, time_out, remarks } = req.body;

  try {
    await db.insert(taxpayerLogs).values({
      taxpayerId: taxpayer_id,
      taxpayerName: taxpayer_name,
      role: req.user.role,
      userId: req.user.id,
      userName: req.user.name,
      pins: pins || '[]',
      timeIn: time_in,
      timeOut: time_out,
      remarks: remarks || '',
      createdAt: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Create taxpayer log error:', err);
    res.status(500).json({ error: 'Failed to create log' });
  }
});

router.post('/taxpayer-log/time-out', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'collector' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { taxpayer_id } = req.body;

  if (!taxpayer_id) return res.status(400).json({ error: 'taxpayer_id is required' });

  try {
    const openLogs = await db.select({ id: taxpayerLogs.id }).from(taxpayerLogs)
      .where(and(eq(taxpayerLogs.taxpayerId, taxpayer_id), isNull(taxpayerLogs.timeOut)))
      .orderBy(desc(taxpayerLogs.createdAt)).limit(1);

    if (openLogs.length > 0) {
      await db.update(taxpayerLogs).set({ timeOut: new Date().toISOString() }).where(eq(taxpayerLogs.id, openLogs[0].id));
      res.json({ success: true, message: 'Time out recorded' });
    } else {
      res.json({ success: true, message: 'No open log found' });
    }
  } catch (err) {
    console.error('Record taxpayer time_out error:', err);
    res.status(500).json({ error: 'Failed to record time out' });
  }
});

export default router;
