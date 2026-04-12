import { Router } from 'express';
import { authenticateToken } from '../middleware.js';
import { db } from '../db.js';
import { users, messages, directMessages } from '../schema.js';
import { eq, sql, and, or, desc } from 'drizzle-orm';
import { upload } from '../config.js';

const router = Router();

router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const rows = await db.select().from(messages)
      .where(or(eq(messages.targetRole, 'all'), eq(messages.targetRole, req.user.role)))
      .orderBy(desc(messages.createdAt));
    res.json(rows);
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.get('/public/announcements', async (req, res) => {
  try {
    const rows = await db.select().from(messages)
      .where(or(eq(messages.targetRole, 'all'), eq(messages.targetRole, 'queue_system')))
      .orderBy(desc(messages.createdAt))
      .limit(10);
    res.json(rows);
  } catch (err) {
    console.error('Fetch announcements error:', err);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

router.post('/admin/messages', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { title, body, target_role } = req.body;

  try {
    await db.insert(messages).values({
      title,
      body,
      targetRole: target_role,
      createdAt: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Broadcast error:', err);
    res.status(500).json({ error: 'Failed to broadcast message' });
  }
});

router.get('/admin/messages', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const rows = await db.select().from(messages).orderBy(desc(messages.createdAt));
    res.json(rows);
  } catch (err) {
    console.error('Fetch admin messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/admin/broadcast', authenticateToken, upload.single('audio'), async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { title, body, target_role } = req.body;
  const bodyText = body || '';
  const audioData = req.file ? req.file.buffer.toString('base64') : null;
  const audioMime = req.file ? req.file.mimetype : null;

  try {
    await db.insert(messages).values({
      title: title || (audioData ? 'Audio Announcement' : 'Announcement'),
      body: bodyText,
      targetRole: target_role,
      audioData,
      audioMime,
      createdAt: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Broadcast error:', err);
    res.status(500).json({ error: 'Failed to broadcast message' });
  }
});

router.get('/direct-messages', authenticateToken, async (req: any, res) => {
  const { type } = req.query;
  try {
    if (type === 'sent') {
      const result = await db.execute(sql`
        SELECT dm.*, u.full_name as other_party_name, u.role as other_party_role
        FROM direct_messages dm
        JOIN users u ON dm.recipient_id = u.id
        WHERE dm.sender_id = ${req.user.id}
        ORDER BY dm.created_at DESC
      `);
      res.json(result.rows || result);
    } else {
      const result = await db.execute(sql`
        SELECT dm.*, u.full_name as other_party_name, u.role as other_party_role
        FROM direct_messages dm
        JOIN users u ON dm.sender_id = u.id
        WHERE dm.recipient_id = ${req.user.id}
        ORDER BY dm.created_at DESC
      `);
      res.json(result.rows || result);
    }
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/direct-messages', authenticateToken, async (req: any, res) => {
  const { recipient_id, subject, body } = req.body;
  if (!recipient_id || !body) return res.status(400).json({ error: 'Missing required fields' });

  try {
    await db.insert(directMessages).values({
      senderId: req.user.id,
      recipientId: recipient_id,
      subject,
      body,
      createdAt: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/direct-messages/:id/read', authenticateToken, async (req: any, res) => {
  try {
    await db.update(directMessages).set({ isRead: 1 })
      .where(and(eq(directMessages.id, Number(req.params.id)), eq(directMessages.recipientId, req.user.id)));
    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

router.post('/send', authenticateToken, async (req: any, res) => {
  const { recipient_id, subject, body } = req.body;
  try {
    await db.insert(directMessages).values({
      senderId: req.user.id,
      recipientId: recipient_id,
      subject,
      body,
      createdAt: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/inbox', authenticateToken, async (req: any, res) => {
  try {
    const result = await db.execute(sql`
      SELECT dm.*, u.full_name as sender_name
      FROM direct_messages dm
      JOIN users u ON dm.sender_id = u.id
      WHERE dm.recipient_id = ${req.user.id}
      ORDER BY dm.created_at DESC
    `);
    res.json(result.rows || result);
  } catch (err) {
    console.error('Fetch inbox error:', err);
    res.status(500).json({ error: 'Failed to fetch inbox' });
  }
});

router.get('/sent', authenticateToken, async (req: any, res) => {
  try {
    const result = await db.execute(sql`
      SELECT dm.*, u.full_name as recipient_name
      FROM direct_messages dm
      JOIN users u ON dm.recipient_id = u.id
      WHERE dm.sender_id = ${req.user.id}
      ORDER BY dm.created_at DESC
    `);
    res.json(result.rows || result);
  } catch (err) {
    console.error('Fetch sent messages error:', err);
    res.status(500).json({ error: 'Failed to fetch sent messages' });
  }
});

router.post('/mark-read', authenticateToken, async (req: any, res) => {
  try {
    await db.update(directMessages).set({ isRead: 1 })
      .where(eq(directMessages.recipientId, req.user.id));
    res.json({ success: true });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

export default router;
