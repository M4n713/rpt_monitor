import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../middleware.js';
import { db } from '../db.js';
import { users, taxpayerLogs } from '../schema.js';
import { eq, sql, and, or, isNull, isNotNull, desc, asc } from 'drizzle-orm';
import { generateTemporaryPassword } from '../config.js';
import { sendSMS } from '../utils.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { first_name, mi, last_name, age, gender, phone_number, transaction_type } = req.body;
    if (!first_name || !last_name) return res.status(400).json({ error: 'First name and last name are required' });

    const full_name = mi ? `${first_name} ${mi} ${last_name}` : `${first_name} ${last_name}`;
    const currentDay = new Date().toISOString().split('T')[0];

    const result = await db.transaction(async (tx) => {
      const lockResult = await tx.execute(sql`SELECT MAX(queue_number) AS max_q FROM users WHERE queue_date = ${currentDay} FOR UPDATE`);
      const lockRows = lockResult.rows || lockResult;
      const nextNum = (Number(lockRows[0]?.max_q) || 0) + 1;
      const formattedNum = `RPT-${String(nextNum).padStart(3, '0')}`;

      const existingRows = await tx.select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
      }).from(users).where(
        and(
          sql`(${users.phoneNumber} = ${phone_number} OR ${users.fullName} = ${full_name})`,
          eq(users.role, 'taxpayer')
        )
      ).limit(1);

      let taxpayer;

      if (existingRows.length > 0) {
        taxpayer = existingRows[0];
        await tx.update(users).set({
          queueNumber: nextNum,
          queueDate: currentDay,
          notified: false,
          notifiedAt: null,
          transactionType: transaction_type || null,
        }).where(eq(users.id, taxpayer.id));
      } else {
        let username = first_name.toLowerCase().replace(/\s+/g, '');
        const collisionRows = await tx.select({ id: users.id }).from(users).where(eq(users.username, username));
        if (collisionRows.length > 0) {
          username = `${username}${Math.floor(Math.random() * 9999)}`;
        }
        const hashedPassword = bcrypt.hashSync(generateTemporaryPassword(), 10);

        const insertRows = await tx.insert(users).values({
          username,
          password: hashedPassword,
          role: 'taxpayer',
          fullName: full_name,
          age,
          gender,
          phoneNumber: phone_number,
          queueNumber: nextNum,
          queueDate: currentDay,
          transactionType: transaction_type || null,
        }).returning({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          queueNumber: users.queueNumber,
          phoneNumber: users.phoneNumber,
        });
        taxpayer = insertRows[0];
      }

      return { taxpayer, formattedNum, isRequeue: existingRows.length > 0 };
    });

    if (phone_number) {
      sendSMS(phone_number, `Welcome ${full_name}! Your Queue Number is ${result.formattedNum}. Please wait for your turn. Thank you!`);
    }

    res.status(201).json({
      message: result.isRequeue ? 'Welcome back! You are re-queued' : 'Successfully queued',
      user: result.taxpayer,
      queue_label: result.formattedNum
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to join queue' });
  }
});

router.get('/active', async (req, res) => {
  try {
    const currentDay = new Date().toISOString().split('T')[0];
    const rows = await db.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      phoneNumber: users.phoneNumber,
      queueNumber: users.queueNumber,
      notified: users.notified,
      notifiedAt: users.notifiedAt,
    }).from(users).where(
      and(isNotNull(users.queueNumber), eq(users.queueDate, currentDay))
    ).orderBy(asc(users.queueNumber));
    res.json(rows);
  } catch (err) {
    console.error('Fetch active queue error:', err);
    res.status(500).json({ error: 'Failed to fetch active queue' });
  }
});

router.get('/now-serving', async (req, res) => {
  try {
    const currentDay = new Date().toISOString().split('T')[0];
    const rows = await db.execute(sql`
      SELECT u.queue_number
      FROM taxpayer_logs tl
      JOIN users u ON tl.taxpayer_id = u.id
      WHERE tl.time_out IS NULL AND u.queue_number IS NOT NULL AND u.queue_date = ${currentDay}
      ORDER BY tl.time_in DESC
      LIMIT 1
    `);

    const resultRows = rows.rows || rows;
    if (resultRows.length > 0) {
      res.json({ queue_number: resultRows[0].queue_number });
    } else {
      const backupResult = await db.select({ queueNumber: users.queueNumber }).from(users)
        .where(and(eq(users.notified, true), isNotNull(users.queueNumber), eq(users.queueDate, currentDay)))
        .orderBy(desc(users.notifiedAt)).limit(1);
      res.json({ queue_number: backupResult[0]?.queueNumber || null });
    }
  } catch (err) {
    console.error('Fetch now serving error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const threshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const result = await db.select({
      activeCollectors: sql`COUNT(*)`,
    }).from(users).where(
      and(
        or(eq(users.role, 'collector'), eq(users.role, 'admin')),
        sql`${users.lastActiveAt} > ${threshold}`
      )
    );

    res.json({ active_collectors: parseInt(result[0]?.activeCollectors || '0') || 0 });
  } catch (err) {
    console.error('Fetch queue stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/notify-taxpayer', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { taxpayer_id } = req.body;

  try {
    const rows = await db.select({
      id: users.id,
      fullName: users.fullName,
      phoneNumber: users.phoneNumber,
      queueNumber: users.queueNumber,
      notified: users.notified,
    }).from(users).where(eq(users.id, taxpayer_id));
    if (rows.length === 0) return res.status(404).json({ error: 'Taxpayer not found' });

    const tp = rows[0];
    if (tp.notified) return res.json({ message: 'Already notified', success: true });
    if (!tp.phoneNumber) return res.status(400).json({ error: 'No phone number linked' });

    const formattedNum = `RPT-${String(tp.queueNumber).padStart(4, '0')}`;
    const callerFirstName = req.user.name.split(' ')[0];
    await sendSMS(tp.phoneNumber, `Hello ${tp.fullName}! You are NEXT (Number: ${formattedNum}). Please proceed to ${callerFirstName} now. Thank you!`);

    const now = new Date().toISOString();
    await db.update(users).set({ notified: true, notifiedAt: now }).where(eq(users.id, taxpayer_id));
    res.json({ success: true, message: 'Notification sent', notified_at: now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to notify' });
  }
});

router.post('/admin/cancel-queue', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { taxpayer_id } = req.body;

  try {
    await db.update(users).set({
      queueNumber: null,
      queueDate: null,
      notified: false,
      notifiedAt: null,
    }).where(eq(users.id, taxpayer_id));
    res.json({ success: true, message: 'Queue cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel queue' });
  }
});

router.post('/admin/assign-collector', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { taxpayer_id, collector_id } = req.body;

  try {
    await db.transaction(async (tx) => {
      const tpRows = await tx.select({ queueNumber: users.queueNumber }).from(users).where(eq(users.id, taxpayer_id));
      let queueNumber = tpRows[0]?.queueNumber;

      if (!queueNumber) {
        const maxRows = await tx.select({ maxQ: sql`MAX(${users.queueNumber})` }).from(users);
        const maxQ = maxRows[0]?.maxQ || 0;
        queueNumber = Number(maxQ) + 1;
      }

      await tx.update(users).set({ assignedCollectorId: collector_id, queueNumber }).where(eq(users.id, taxpayer_id));

      res.json({ success: true, queue_number: queueNumber });
    });
  } catch (err) {
    console.error('Assign collector error:', err);
    res.status(500).json({ error: 'Failed to assign collector' });
  }
});

router.post('/admin/clear-assignment', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { taxpayer_id } = req.body;

  try {
    await db.update(users).set({ assignedCollectorId: null, queueNumber: null }).where(eq(users.id, taxpayer_id));
    res.json({ success: true });
  } catch (err) {
    console.error('Clear assignment error:', err);
    res.status(500).json({ error: 'Failed to clear assignment' });
  }
});

export default router;
