import { Router } from 'express';
import { authenticateToken } from '../middleware.js';
import { db } from '../db.js';
import { users, assessments, taxpayerLogs } from '../schema.js';
import { eq, sql, and, or, isNull } from 'drizzle-orm';
import { sendSMS } from '../utils.js';

const router = Router();

router.get('/taxpayers', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'collector' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    let rows;
    if (req.user.role === 'admin') {
      rows = await db.execute(sql`
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
      `);
    } else {
      rows = await db.execute(sql`
        SELECT DISTINCT u.id, u.username, u.full_name, u.queue_number, u.last_active_at
        FROM users u
        WHERE u.assigned_collector_id = ${req.user.id}
        OR u.id IN (
            SELECT taxpayer_id FROM assessments
            WHERE status = 'pending'
            AND (assigned_collector_id = ${req.user.id} OR assigned_collector_id IS NULL)
        )
      `);
    }

    res.json(rows.rows || rows);
  } catch (err) {
    console.error('Fetch assigned taxpayers error:', err);
    res.status(500).json({ error: 'Failed to fetch taxpayers' });
  }
});

router.post('/view-taxpayer', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'collector' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { taxpayer_id } = req.body;
  if (!taxpayer_id) return res.status(400).json({ error: 'Taxpayer ID required' });

  try {
    const tpRows = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, taxpayer_id));
    if (tpRows.length === 0) return res.status(404).json({ error: 'Taxpayer not found' });
    const taxpayerName = tpRows[0].fullName;

    const openLogs = await db.select({ id: taxpayerLogs.id }).from(taxpayerLogs)
      .where(and(eq(taxpayerLogs.taxpayerId, taxpayer_id), eq(taxpayerLogs.userId, req.user.id), isNull(taxpayerLogs.timeOut)))
      .orderBy(sql`${taxpayerLogs.createdAt} DESC`).limit(1);

    if (openLogs.length === 0) {
      await db.insert(taxpayerLogs).values({
        taxpayerId: taxpayer_id,
        taxpayerName,
        role: req.user.role,
        userId: req.user.id,
        userName: (req.user as any).name,
        pins: '[]',
        timeIn: new Date().toISOString(),
        timeOut: null,
        createdAt: new Date().toISOString(),
      });

      const qRows = await db.select({
        phoneNumber: users.phoneNumber,
        queueNumber: users.queueNumber,
        notified: users.notified,
      }).from(users).where(eq(users.id, taxpayer_id));
      if (qRows.length > 0) {
        const tp = qRows[0];
        if (!tp.notified && tp.phoneNumber && tp.queueNumber) {
          const formattedNum = `RPT-${String(tp.queueNumber).padStart(4, '0')}`;
          const callerFirstName = req.user.name.split(' ')[0];
          await sendSMS(tp.phoneNumber, `Hello ${taxpayerName}! You are NEXT (Number: ${formattedNum}). Please proceed to ${callerFirstName} now. Thank you!`);
          await db.update(users).set({ notified: true, notifiedAt: new Date().toISOString() }).where(eq(users.id, taxpayer_id));
        }
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Collector view taxpayer error:', err);
    res.status(500).json({ error: 'Failed to record tracking' });
  }
});

export default router;
