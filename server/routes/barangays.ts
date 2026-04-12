import { Router } from 'express';
import { authenticateToken } from '../middleware.js';
import { db, updateBarangayCache } from '../db.js';
import { barangays } from '../schema.js';
import { eq, asc } from 'drizzle-orm';

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = await db.select().from(barangays).orderBy(asc(barangays.code));
    res.json(rows);
  } catch (err) {
    console.error('Fetch barangays error:', err);
    res.status(500).json({ error: 'Failed to fetch barangays' });
  }
});

router.post('/admin/barangays', authenticateToken, async (req: any, res) => {
  if (req.user.username.toLowerCase() !== 'manlie') return res.status(403).json({ error: 'Forbidden' });
  const { code, name } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'Missing code or name' });

  try {
    await db.insert(barangays).values({ code, name });
    await updateBarangayCache();
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === '23505') return res.status(400).json({ error: 'Code already exists' });
    console.error('Create barangay error:', err);
    res.status(500).json({ error: 'Failed to create barangay' });
  }
});

router.delete('/admin/barangays/:id', authenticateToken, async (req: any, res) => {
  if (req.user.username.toLowerCase() !== 'manlie') return res.status(403).json({ error: 'Forbidden' });
  try {
    await db.delete(barangays).where(eq(barangays.id, Number(req.params.id)));
    await updateBarangayCache();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete barangay error:', err);
    res.status(500).json({ error: 'Failed to delete barangay' });
  }
});

export default router;
