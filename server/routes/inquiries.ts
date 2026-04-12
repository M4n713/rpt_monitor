import { Router } from 'express';
import { authenticateToken } from '../middleware.js';
import { db } from '../db.js';
import { inquiries } from '../schema.js';
import { eq, desc } from 'drizzle-orm';

const router = Router();

router.post('/', async (req, res) => {
  const { sender_name, email, message } = req.body;
  if (!sender_name || !message) {
    return res.status(400).json({ error: 'Name and message are required' });
  }

  try {
    await db.insert(inquiries).values({
      senderName: sender_name,
      email,
      message,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Submit inquiry error:', err);
    res.status(500).json({ error: 'Failed to submit inquiry' });
  }
});

router.get('/admin/inquiries', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  try {
    const rows = await db.select().from(inquiries).orderBy(desc(inquiries.createdAt));
    res.json(rows);
  } catch (err) {
    console.error('Fetch inquiries error:', err);
    res.status(500).json({ error: 'Failed to fetch inquiries' });
  }
});

router.patch('/admin/inquiries/:id/status', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  const { status } = req.body;

  try {
    await db.update(inquiries).set({ status }).where(eq(inquiries.id, Number(id)));
    res.json({ success: true });
  } catch (err) {
    console.error('Update inquiry status error:', err);
    res.status(500).json({ error: 'Failed to update inquiry status' });
  }
});

export default router;
