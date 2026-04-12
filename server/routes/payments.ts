import { Router } from 'express';
import { authenticateToken } from '../middleware.js';
import { db, dbQuery } from '../db.js';
import { users, properties, payments, assessments, taxpayerLogs } from '../schema.js';
import { eq, sql, and, or, isNull, desc } from 'drizzle-orm';

const router = Router();

router.post('/', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'collector' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { property_id, amount, or_no, year, basic_tax, sef_tax, interest, discount, remarks, td_no } = req.body;
  try {
    console.log(`[API PAYMENT] Start. Body:`, JSON.stringify(req.body));

    await db.transaction(async (tx) => {
      const propRows = await tx.select().from(properties).where(eq(properties.id, property_id));
      const property = propRows[0];
      if (!property) {
        console.error(`[API PAYMENT] Property ${property_id} not found`);
        throw new Error('Property not found');
      }
      console.log(`[API PAYMENT] Found property:`, property.pin, 'Owner:', property.ownerId);

      const cleanNum = (val: any) => {
        if (val === undefined || val === null || val === '') return null;
        const cleaned = String(val).replace(/,/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
      };

      const sanitizedAmount = cleanNum(amount) || 0;
      const sanitizedBasic = cleanNum(basic_tax);
      const sanitizedSef = cleanNum(sef_tax);
      const sanitizedInterest = cleanNum(interest);
      const sanitizedDiscount = cleanNum(discount);

      console.log(`[API PAYMENT] Inserting payment. Sanitized Params:`, { property_id, amount: sanitizedAmount });

      await tx.insert(payments).values({
        propertyId: property_id,
        taxpayerId: property.ownerId,
        amount: String(sanitizedAmount),
        paymentDate: new Date().toISOString(),
        collectorId: req.user.id,
        orNo: or_no,
        year,
        basicTax: sanitizedBasic ? String(sanitizedBasic) : null,
        sefTax: sanitizedSef ? String(sanitizedSef) : null,
        interest: sanitizedInterest ? String(sanitizedInterest) : null,
        discount: sanitizedDiscount ? String(sanitizedDiscount) : null,
        remarks,
        tdNo: td_no,
      });
      console.log(`[API PAYMENT] Payment recorded`);

      const taxpayer_id = property.ownerId;
      if (taxpayer_id) {
        console.log(`[API PAYMENT] Tracking logging for taxpayer ${taxpayer_id}`);
        const openLogs = await tx.select().from(taxpayerLogs)
          .where(and(eq(taxpayerLogs.taxpayerId, taxpayer_id), eq(taxpayerLogs.userId, req.user.id), isNull(taxpayerLogs.timeOut)))
          .orderBy(desc(taxpayerLogs.createdAt)).limit(1);

        if (openLogs.length > 0) {
          console.log(`[API PAYMENT] Closing open log:`, openLogs[0].id);
          await tx.update(taxpayerLogs).set({ timeOut: new Date().toISOString() }).where(eq(taxpayerLogs.id, openLogs[0].id));
        } else {
          console.log(`[API PAYMENT] No open log found. Creating session log.`);
          const tpRows = await tx.select({ fullName: users.fullName }).from(users).where(eq(users.id, taxpayer_id));
          const taxpayerName = tpRows[0]?.fullName || 'Unknown';
          const pins = [property.pin];

          await tx.insert(taxpayerLogs).values({
            taxpayerId: taxpayer_id,
            taxpayerName,
            role: req.user.role,
            userId: req.user.id,
            userName: req.user.name,
            pins: JSON.stringify(pins),
            timeIn: new Date().toISOString(),
            timeOut: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });
        }
      }

      let newStatus = 'partial';
      const parsedTaxDue = parseFloat(property.taxDue || '0');
      if (sanitizedAmount >= parsedTaxDue) {
        newStatus = 'paid';
      }
      console.log(`[API PAYMENT] Updating status to ${newStatus}. Due: ${parsedTaxDue}, Paid: ${sanitizedAmount}`);

      await tx.update(properties).set({ status: newStatus, lastPaymentDate: new Date().toISOString() }).where(eq(properties.id, property_id));

      await tx.update(assessments).set({ status: 'paid' }).where(and(eq(assessments.propertyId, property_id), eq(assessments.status, 'pending')));
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({
      error: 'Payment failed',
      details: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
  }
});

router.get('/admin/all', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await db.execute(sql`
      SELECT p.*, pr.pin, pr.registered_owner_name, u.full_name as collector_name, tp.full_name as taxpayer_name
      FROM payments p
      JOIN properties pr ON p.property_id = pr.id
      LEFT JOIN users u ON p.collector_id = u.id
      LEFT JOIN users tp ON p.taxpayer_id = tp.id
      ORDER BY p.payment_date DESC
    `);
    res.json(result.rows || result);
  } catch (err) {
    console.error('Fetch all payments error:', err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

router.get('/collector/mine', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'collector' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await db.execute(sql`
      SELECT p.*, pr.pin, pr.registered_owner_name, tp.full_name as taxpayer_name
      FROM payments p
      JOIN properties pr ON p.property_id = pr.id
      LEFT JOIN users tp ON p.taxpayer_id = tp.id
      WHERE p.collector_id = ${req.user.id}
      ORDER BY p.payment_date DESC
    `);
    res.json(result.rows || result);
  } catch (err) {
    console.error('Fetch collector payments error:', err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

router.put('/admin/:id/date', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  const { payment_date } = req.body;
  try {
    await db.update(payments).set({ paymentDate: payment_date }).where(eq(payments.id, Number(id)));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update payment date' });
  }
});

export default router;
