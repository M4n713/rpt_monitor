import { Router } from 'express';
import { authenticateToken } from '../middleware.js';
import { db } from '../db.js';
import { users, assessments } from '../schema.js';
import { eq, sql, and, or, isNull, desc, asc } from 'drizzle-orm';

const router = Router();

router.get('/', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'collector' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  try {
    if (req.user.role === 'collector') {
      const result = await db.execute(sql`
        SELECT a.*, p.pin, p.registered_owner_name, p.lot_no, p.td_no as property_td_no, p.assessed_value as property_assessed_value, p.address, p.description, p.total_area
        FROM assessments a
        JOIN properties p ON a.property_id = p.id
        WHERE (a.status = 'pending' OR a.status IS NULL)
        AND (a.assigned_collector_id = ${req.user.id} OR a.assigned_collector_id IS NULL)
        ORDER BY a.created_at ASC
      `);
      console.log('[DEBUG] Fetch Assessments User:', req.user);
      console.log('[DEBUG] Fetch Assessments Result Count:', (result.rows || result).length);
      res.json(result.rows || result);
    } else {
      const result = await db.execute(sql`
        SELECT a.*, p.pin, p.registered_owner_name, p.lot_no, p.td_no as property_td_no, p.assessed_value as property_assessed_value, p.address, p.description, p.total_area
        FROM assessments a
        JOIN properties p ON a.property_id = p.id
        WHERE (a.status = 'pending' OR a.status IS NULL)
        ORDER BY a.created_at ASC
      `);
      console.log('[DEBUG] Fetch Assessments User:', req.user);
      console.log('[DEBUG] Fetch Assessments Result Count:', (result.rows || result).length);
      res.json(result.rows || result);
    }
  } catch (err) {
    console.error('Fetch assessments error:', err);
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
});

router.post('/', authenticateToken, async (req: any, res) => {
  console.log('[DEBUG] POST /api/assessments payload:', JSON.stringify(req.body, null, 2));
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  try {
    const assessmentList = Array.isArray(req.body) ? req.body : [req.body];

    await db.transaction(async (tx) => {
      for (const assessment of assessmentList) {
        const { property_id, taxpayer_id, assigned_collector_id, amount, year, assessed_value, basic_tax, sef_tax, interest, discount, td_no } = assessment;

        let collectorId = assigned_collector_id;
        if (!collectorId && taxpayer_id) {
          const userRes = await tx.select({ assignedCollectorId: users.assignedCollectorId }).from(users).where(eq(users.id, taxpayer_id));
          console.log('[DEBUG] Taxpayer:', taxpayer_id, 'User Query Result:', userRes);
          if (userRes.length > 0) {
            collectorId = userRes[0].assignedCollectorId;
          }
        }
        console.log('[DEBUG] Inserting assessment. Taxpayer:', taxpayer_id, 'Collector:', collectorId, 'Data:', { property_id, amount, year, assessed_value, td_no });

        await tx.insert(assessments).values({
          propertyId: property_id,
          taxpayerId: taxpayer_id || null,
          assignedCollectorId: collectorId || null,
          amount: String(amount),
          year,
          assessedValue: assessed_value ? String(assessed_value) : null,
          basicTax: basic_tax ? String(basic_tax) : '0',
          sefTax: sef_tax ? String(sef_tax) : '0',
          interest: interest ? String(interest) : '0',
          discount: discount ? String(discount) : '0',
          createdAt: new Date().toISOString(),
          status: 'pending',
          tdNo: td_no,
        });
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Create assessment error:', err);
    res.status(500).json({ error: 'Failed to create assessment', details: err instanceof Error ? err.message : String(err) });
  }
});

router.delete('/:id', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'collector' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    const assessmentId = parseInt(req.params.id);
    if (isNaN(assessmentId)) {
      return res.status(400).json({ error: 'Invalid assessment ID format' });
    }

    console.log(`[API DELETE] ID: ${assessmentId}, User: ${req.user.username}`);
    const result = await db.delete(assessments).where(eq(assessments.id, assessmentId));
    console.log(`[API DELETE] Success`);
    res.json({ success: true });
  } catch (err) {
    console.error('[API DELETE] Error:', err);
    res.status(500).json({
      error: 'Database error occurred',
      details: String(err),
      stack: (err as any).stack
    });
  }
});

export default router;
