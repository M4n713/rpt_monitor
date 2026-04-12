import { Router } from 'express';
import { authenticateToken } from '../middleware.js';
import { db, canAccessProperty, getAuthorizedPropertiesByPins } from '../db.js';
import { users, properties, propertyOwners, taxpayerLogs } from '../schema.js';
import { eq, sql, and, or, isNull, isNotNull, desc, asc, ilike, exists } from 'drizzle-orm';

const router = Router();

router.get('/', authenticateToken, async (req: any, res) => {
  try {
    let props: any[] = [];

    if (req.user.role === 'taxpayer') {
      const rows = await db.select({
        id: properties.id,
        ownerId: properties.ownerId,
        registeredOwnerName: properties.registeredOwnerName,
        pin: properties.pin,
        tdNo: properties.tdNo,
        lotNo: properties.lotNo,
        address: properties.address,
        kind: properties.kind,
        assessedValue: properties.assessedValue,
        taxDue: properties.taxDue,
        status: properties.status,
        lastPaymentDate: properties.lastPaymentDate,
        totalArea: properties.totalArea,
        ownershipType: properties.ownershipType,
        claimedArea: properties.claimedArea,
        taxability: properties.taxability,
        classification: properties.classification,
        oldPin: properties.oldPin,
        effectivity: properties.effectivity,
        remarks: properties.remarks,
        po_ownershipType: propertyOwners.ownershipType,
        po_claimedArea: propertyOwners.claimedArea,
      }).from(properties)
        .innerJoin(propertyOwners, eq(properties.id, propertyOwners.propertyId))
        .where(eq(propertyOwners.userId, req.user.id));
      props = rows.map(r => ({
        ...Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('po_'))),
        ownership_type: r.po_ownershipType,
        claimed_area: r.po_claimedArea,
      }));
    } else if (req.user.role === 'collector') {
      const rows = await db.select({
        id: properties.id,
        ownerId: properties.ownerId,
        registeredOwnerName: properties.registeredOwnerName,
        pin: properties.pin,
        tdNo: properties.tdNo,
        lotNo: properties.lotNo,
        address: properties.address,
        kind: properties.kind,
        assessedValue: properties.assessedValue,
        taxDue: properties.taxDue,
        status: properties.status,
        lastPaymentDate: properties.lastPaymentDate,
        totalArea: properties.totalArea,
        ownershipType: properties.ownershipType,
        claimedArea: properties.claimedArea,
        taxability: properties.taxability,
        classification: properties.classification,
        oldPin: properties.oldPin,
        effectivity: properties.effectivity,
        remarks: properties.remarks,
      }).from(properties)
        .innerJoin(propertyOwners, eq(properties.id, propertyOwners.propertyId))
        .innerJoin(users, eq(users.id, propertyOwners.userId))
        .where(eq(users.assignedCollectorId, req.user.id));
      props = rows;
    } else {
      const { search, taxpayer_id, includeTaxpayer } = req.query;

      if (search) {
        const searchTerm = `%${search}%`;
        if (includeTaxpayer === 'true') {
          const rows = await db.execute(sql`
            SELECT p.* FROM properties p
            WHERE (
              p.pin ILIKE ${searchTerm}
              OR p.registered_owner_name ILIKE ${searchTerm}
              OR p.td_no ILIKE ${searchTerm}
              OR EXISTS (
                SELECT 1 FROM property_owners po
                JOIN users u ON po.user_id = u.id
                WHERE po.property_id = p.id AND u.full_name ILIKE ${searchTerm}
              )
            )
          `);
          props = rows.rows || rows;
        } else {
          const rows = await db.execute(sql`
            SELECT p.* FROM properties p
            WHERE (
              p.pin ILIKE ${searchTerm}
              OR p.registered_owner_name ILIKE ${searchTerm}
              OR p.td_no ILIKE ${searchTerm}
            )
          `);
          props = rows.rows || rows;
        }
      } else if (taxpayer_id) {
        const rows = await db.execute(sql`
          SELECT p.* FROM properties p
          WHERE EXISTS (
            SELECT 1 FROM property_owners po
            WHERE po.property_id = p.id AND po.user_id = ${taxpayer_id}
          )
        `);
        props = rows.rows || rows;
      } else {
        const rows = await db.select().from(properties).limit(50);
        props = rows;
      }
    }

    const enrichedProperties = await Promise.all(props.map(async (p: any, index: number) => {
      const owners = await db.select({
        id: users.id,
        fullName: users.fullName,
        ownershipType: propertyOwners.ownershipType,
        claimedArea: propertyOwners.claimedArea,
      }).from(propertyOwners)
        .innerJoin(users, eq(users.id, propertyOwners.userId))
        .where(eq(propertyOwners.propertyId, p.id));

      const finalStatus = (p.status && p.status.toLowerCase().includes('unpaid')) ? null : p.status;

      const ownerNames = owners.map((o: any) => o.full_name || o.fullName).join(', ');

      const primaryOwner = owners[0];

      if (index === 0) {
        console.log('[DEBUG] Sending Property to Frontend:', {
          pin: p.pin,
          status: p.status,
          taxability: p.taxability,
          classification: p.classification,
          remarks: p.remarks
        });
      }

      return {
        ...p,
        status: finalStatus,
        owners: owners.map(o => ({ ...o, full_name: o.fullName, ownership_type: o.ownershipType, claimed_area: o.claimedArea })),
        linked_taxpayer: ownerNames || null,
        owner_id: primaryOwner?.id || null,
        ownership_type: primaryOwner?.ownershipType || primaryOwner?.ownership_type,
        claimed_area: primaryOwner?.claimedArea || primaryOwner?.claimed_area,
        remarks: p.remarks || (owners.length > 1 ? 'with 2 or more claimants' : '')
      };
    }));

    res.json(enrichedProperties);
  } catch (err) {
    console.error('Fetch properties error:', err);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

router.post('/by-pins', authenticateToken, async (req: any, res) => {
  try {
    const { pins } = req.body;
    if (!Array.isArray(pins) || pins.length === 0) {
      return res.json([]);
    }

    const sanitizedPins = pins
      .map((pin: unknown) => typeof pin === 'string' ? pin.trim() : '')
      .filter(Boolean);

    const rows = await getAuthorizedPropertiesByPins(req.user, sanitizedPins);
    res.json(rows);
  } catch (err) {
    console.error('Fetch properties by pins error:', err);
    res.status(500).json({ error: 'Failed to fetch properties by pins' });
  }
});

router.get('/:propertyId/payments', authenticateToken, async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { propertyId } = req.params;
  const propertyIdNum = parseInt(propertyId);

  if (isNaN(propertyIdNum)) {
    return res.status(400).json({ error: 'Invalid property ID' });
  }

  try {
    const hasAccess = await canAccessProperty(req.user, propertyIdNum);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const paymentsResult = await db.execute(sql`
      SELECT
        p.id, p.property_id, p.amount, p.payment_date, p.collector_id, p.or_no, p.year,
        p.basic_tax, p.sef_tax, p.interest, p.discount, p.remarks, p.taxpayer_id, p.td_no,
        pr.pin, pr.registered_owner_name,
        u.full_name as collector_name,
        tp.full_name as taxpayer_name,
        NULL::NUMERIC as assessed_value,
        'payment' as record_type
      FROM payments p
      JOIN properties pr ON p.property_id = pr.id
      LEFT JOIN users u ON p.collector_id = u.id
      LEFT JOIN users tp ON p.taxpayer_id = tp.id
      WHERE p.property_id = ${propertyIdNum}
      ORDER BY p.payment_date DESC
    `);

    const assessmentsResult = await db.execute(sql`
      SELECT
        a.id, a.property_id, a.amount, a.created_at as payment_date, a.assigned_collector_id as collector_id,
        NULL as or_no, a.year,
        a.basic_tax, a.sef_tax, a.interest, a.discount, NULL as remarks, a.taxpayer_id, a.td_no,
        pr.pin, pr.registered_owner_name,
        u.full_name as collector_name,
        tp.full_name as taxpayer_name,
        a.assessed_value,
        'assessment' as record_type
      FROM assessments a
      JOIN properties pr ON a.property_id = pr.id
      LEFT JOIN users u ON a.assigned_collector_id = u.id
      LEFT JOIN users tp ON a.taxpayer_id = tp.id
      WHERE a.property_id = ${propertyIdNum} AND a.status = 'pending'
      ORDER BY a.created_at DESC
    `);

    const paymentRows = paymentsResult.rows || paymentsResult;
    const assessmentRows = assessmentsResult.rows || assessmentsResult;
    const combined = [...paymentRows, ...assessmentRows];

    res.json(combined);
  } catch (err) {
    console.error('Fetch property payments error:', err);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

router.post('/admin/link-property', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });
  const { properties: propsToLinkRaw, taxpayer_id, assigned_collector_id } = req.body;

  const property_ids = req.body.property_ids;
  const ownership_type = req.body.ownership_type;
  const claimed_area = req.body.claimed_area;

  let propsToLink = propsToLinkRaw;
  if (!propsToLink && Array.isArray(property_ids)) {
    propsToLink = property_ids.map((id: any) => ({ id, ownership_type, claimed_area }));
  }

  if (!Array.isArray(propsToLink) || propsToLink.length === 0) {
    return res.status(400).json({ error: 'No properties selected' });
  }

  try {
    await db.transaction(async (tx) => {
      const taxpayerRows = await tx.select({ fullName: users.fullName }).from(users).where(eq(users.id, taxpayer_id));
      const taxpayer = taxpayerRows[0];
      if (!taxpayer) {
        throw new Error('Taxpayer not found');
      }

      if (assigned_collector_id !== undefined) {
        let collectorId: number | null = null;
        if (assigned_collector_id && assigned_collector_id !== 'unassigned') {
          const parsed = Number(assigned_collector_id);
          if (!isNaN(parsed)) collectorId = parsed;
        }

        if (collectorId) {
          const tpRows = await tx.select({ queueNumber: users.queueNumber }).from(users).where(eq(users.id, taxpayer_id));
          let queueNumber = tpRows[0]?.queueNumber;

          if (!queueNumber) {
            const maxRows = await tx.select({ maxQ: sql`MAX(${users.queueNumber})` }).from(users);
            const maxQ = maxRows[0]?.maxQ || 0;
            queueNumber = Number(maxQ) + 1;
          }

          await tx.update(users).set({ assignedCollectorId: collectorId, queueNumber }).where(eq(users.id, taxpayer_id));
        } else {
          await tx.update(users).set({ assignedCollectorId: null, queueNumber: null }).where(eq(users.id, taxpayer_id));
        }
      }

      let warning = '';
      const linkedPins: string[] = [];

      for (const propData of propsToLink) {
        const { id, ownership_type, claimed_area } = propData;

        const existingLinkRows = await tx.select().from(propertyOwners)
          .where(and(eq(propertyOwners.propertyId, id), eq(propertyOwners.userId, taxpayer_id)));
        const existingLink = existingLinkRows[0];

        const anyLinkRows = await tx.select({ count: sql`COUNT(*)` }).from(propertyOwners)
          .where(eq(propertyOwners.propertyId, id));
        const anyLinkCount = parseInt(anyLinkRows[0]?.count || '0');

        if (anyLinkCount > 0 && !existingLink) {
          warning = 'Some properties were already tagged by other taxpayers.';
        }

        if (!existingLink) {
          await tx.insert(propertyOwners).values({
            propertyId: id,
            userId: taxpayer_id,
            ownershipType: ownership_type,
            claimedArea: claimed_area,
          });

          await tx.update(properties).set({
            ownerId: taxpayer_id,
            ownershipType: ownership_type,
            claimedArea: claimed_area,
          }).where(eq(properties.id, id));

          const propRows = await tx.select({ pin: properties.pin }).from(properties).where(eq(properties.id, id));
          if (propRows.length > 0) {
            linkedPins.push(propRows[0].pin);
          }
        }
      }

      if (linkedPins.length > 0) {
        const openLogs = await tx.select().from(taxpayerLogs)
          .where(and(eq(taxpayerLogs.taxpayerId, taxpayer_id), isNull(taxpayerLogs.timeOut)))
          .orderBy(desc(taxpayerLogs.createdAt)).limit(1);

        if (openLogs.length > 0) {
          const log = openLogs[0];
          let currentPins: string[] = [];
          try {
            currentPins = JSON.parse(log.pins);
          } catch (e) {
            currentPins = [];
          }

          const updatedPins = [...currentPins];
          linkedPins.forEach(pin => {
            if (!updatedPins.includes(pin)) {
              updatedPins.push(pin);
            }
          });

          await tx.update(taxpayerLogs).set({ pins: JSON.stringify(updatedPins) }).where(eq(taxpayerLogs.id, log.id));
        } else {
          const tpRows = await tx.select({ fullName: users.fullName }).from(users).where(eq(users.id, taxpayer_id));
          const taxpayerName = tpRows[0]?.fullName || 'Unknown';

          await tx.insert(taxpayerLogs).values({
            taxpayerId: taxpayer_id,
            taxpayerName,
            role: req.user.role,
            userId: req.user.id,
            userName: req.user.name,
            pins: JSON.stringify(linkedPins),
            timeIn: new Date().toISOString(),
            timeOut: null,
            createdAt: new Date().toISOString(),
          });
        }
      }

      res.json({ success: true, warning });
    });
  } catch (err) {
    console.error('[DB ERROR] Link property failed for Taxpayer ID:', taxpayer_id, 'Error:', err);
    res.status(500).json({ error: 'Failed to link properties', details: err instanceof Error ? err.message : String(err) });
  }
});

router.post('/admin/unlink-property', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });
  const { property_ids, taxpayer_id } = req.body;

  if (!Array.isArray(property_ids) || property_ids.length === 0) {
    return res.status(400).json({ error: 'No properties selected' });
  }

  try {
    await db.transaction(async (tx) => {
      if (taxpayer_id) {
        const taxpayerRows = await tx.select({ fullName: users.fullName }).from(users).where(eq(users.id, taxpayer_id));
        const taxpayer = taxpayerRows[0];
        if (!taxpayer) {
          throw new Error('Taxpayer not found');
        }
      }

      for (const id of property_ids) {
        if (taxpayer_id) {
          await tx.delete(propertyOwners).where(and(eq(propertyOwners.propertyId, id), eq(propertyOwners.userId, taxpayer_id)));
          await tx.update(properties).set({ ownerId: null, ownershipType: null, claimedArea: null })
            .where(and(eq(properties.id, id), eq(properties.ownerId, taxpayer_id)));
        } else {
          await tx.delete(propertyOwners).where(eq(propertyOwners.propertyId, id));
          await tx.update(properties).set({ ownerId: null, ownershipType: null, claimedArea: null })
            .where(eq(properties.id, id));
        }
      }

      res.json({ success: true });
    });
  } catch (err) {
    console.error('Unlink property error:', err);
    res.status(500).json({ error: 'Failed to unlink properties' });
  }
});

export default router;
