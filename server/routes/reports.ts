import { Router } from 'express';
import { authenticateToken } from '../middleware.js';
import { db, dbInitStatus, mockStore, pool } from '../db.js';
import { users, properties, payments } from '../schema.js';
import { eq, sql } from 'drizzle-orm';
import { getLocationFromPin } from '../utils.js';

const router = Router();

router.get('/tables', async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    res.json({ tables: (result.rows || result).map((r: any) => r.table_name) });
  } catch (err) {
    res.status(500).json({ error: (err as any).toString() });
  }
});

router.get('/status', async (req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: 'ok', database: 'connected' });
  } catch (e: any) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: e.message });
  }
});

router.get('/check-db', async (req, res) => {
  console.log('[Server] /api/check-db called');
  console.log('[Server] dbInitStatus:', dbInitStatus);

  if (dbInitStatus.mode === 'mock') {
    const dbConfig = (pool as any).options;
    const dbHost = dbConfig.connectionString ?
      new URL(dbConfig.connectionString).hostname :
      (dbConfig.host || 'localhost');

    return res.json({
      status: 'connected',
      message: 'Connected in Mock Mode.',
      dbHost: dbHost,
      initStatus: dbInitStatus,
      counts: {
        users: mockStore.users.length,
        properties: mockStore.properties.length
      }
    });
  }

  try {
    const userCount = await db.select({ count: sql`COUNT(*)` }).from(users);
    const propertyCount = await db.select({ count: sql`COUNT(*)` }).from(properties);

    const dbConfig = (pool as any).options;
    const dbHost = dbConfig.connectionString ?
      new URL(dbConfig.connectionString).hostname :
      (dbConfig.host || 'localhost');

    const responseData = {
      status: 'connected',
      message: 'Successfully connected to PostgreSQL database.',
      dbHost: dbHost,
      initStatus: dbInitStatus,
      counts: {
        users: parseInt(userCount[0]?.count || '0'),
        properties: parseInt(propertyCount[0]?.count || '0')
      }
    };
    console.log('[Server] /api/check-db response:', responseData);
    res.json(responseData);
  } catch (err: any) {
    console.error('[Server] /api/check-db error:', err);
    res.status(500).json({ status: 'error', message: err.message, stack: err.stack });
  }
});

router.get('/admin/delinquency-report', authenticateToken, async (req: any, res) => {
  if (req.user.username.toLowerCase() !== 'manlie') {
    return res.status(403).json({ error: 'Forbidden: Only Manlie can access delinquency reports' });
  }

  try {
    const { type, barangayCode } = req.query;

    let propsQuery = db.select().from(properties);
    let propsResult: any[];

    console.log('[Delinquency] Request query:', req.query);
    console.log('[Delinquency] barangayCode received:', JSON.stringify(barangayCode));

    if (barangayCode && barangayCode !== 'all') {
      const codeStr = barangayCode as string;
      const result = await db.execute(sql`
        SELECT * FROM properties WHERE (pin LIKE ${`%-%-${codeStr}-%`} OR pin LIKE ${`%.%.${codeStr}.%`})
      `);
      propsResult = result.rows || result as any[];
      console.log('[Delinquency] Filter patterns:', `%-%-${codeStr}-%`, `%.%.${codeStr}.%`);
    } else {
      const result = await db.select().from(properties);
      propsResult = result;
    }

    console.log('[Delinquency] Properties found:', propsResult.length, propsResult.length > 0 ? 'Sample PIN: ' + propsResult[0]?.pin : '');
    const paymentRows = await db.select({ propertyId: payments.propertyId, year: payments.year }).from(payments);

    const currentYear = 2026;
    const currentMonth = 2;
    const isApril1Passed = false;

    const paymentMap = new Map();
    paymentRows.forEach((p: any) => {
      if (!paymentMap.has(p.propertyId)) {
        paymentMap.set(p.propertyId, new Set());
      }
      if (p.year) {
        if (p.year.includes('-')) {
          const [start, end] = p.year.split('-').map((y: string) => parseInt(y.trim()));
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = start; i <= end; i++) {
              paymentMap.get(p.propertyId).add(i.toString());
            }
          }
        } else {
          paymentMap.get(p.propertyId).add(p.year.trim());
        }
      }
    });

    const reportData: any[] = [];
    const startYear = type === '5year' ? currentYear - 5 : 1990;

    for (const prop of propsResult) {
      const propPayments = paymentMap.get(prop.id) || new Set();
      const delinquentYears: number[] = [];
      let totalBasicAmount = 0;
      let totalSEFAmount = 0;
      let totalInterestAmount = 0;
      let totalUnpaidAmountWithInterest = 0;

      for (let y = startYear; y <= currentYear; y++) {
        if (y === currentYear && !isApril1Passed) continue;

        if (!propPayments.has(y.toString())) {
          delinquentYears.push(y);

          const basic = Math.round((parseFloat(prop.assessedValue || prop.assessed_value) * 0.01) * 100) / 100;
          const sef = Math.round((parseFloat(prop.assessedValue || prop.assessed_value) * 0.01) * 100) / 100;
          const taxDue = Math.round((basic + sef) * 100) / 100;

          const monthsDiff = (currentYear - y) * 12 + currentMonth + 1;
          let interestRate = monthsDiff * 0.02;

          if (y <= 1991) {
            interestRate = Math.min(interestRate, 0.24);
          } else {
            interestRate = Math.min(interestRate, 0.72);
          }

          const interestBasic = Math.round((basic * interestRate) * 100) / 100;
          const interestSEF = Math.round((sef * interestRate) * 100) / 100;
          const totalInterest = Math.round((interestBasic + interestSEF) * 100) / 100;

          totalBasicAmount += basic;
          totalSEFAmount += sef;
          totalInterestAmount += totalInterest;
          totalUnpaidAmountWithInterest += (taxDue + totalInterest);
        }
      }

      if (delinquentYears.length > 0) {
        const yearCovered = delinquentYears.length === 1
          ? delinquentYears[0].toString()
          : `${delinquentYears[0]} - ${delinquentYears[delinquentYears.length - 1]}`;

        reportData.push({
          pin: prop.pin,
          registered_owner: prop.registeredOwnerName || prop.registered_owner_name,
          lot_no: prop.lotNo || prop.lot_no,
          area: prop.totalArea || prop.total_area,
          year_covered: yearCovered,
          basic: Math.round(totalBasicAmount * 100) / 100,
          sef: Math.round(totalSEFAmount * 100) / 100,
          interest: Math.round(totalInterestAmount * 100) / 100,
          amount: Math.round(totalUnpaidAmountWithInterest * 100) / 100,
          principal: Math.round((totalBasicAmount + totalSEFAmount) * 100) / 100,
          barangay: getLocationFromPin(prop.pin)
        });
      }
    }

    res.json(reportData);
  } catch (err) {
    console.error('Delinquency report error:', err);
    res.status(500).json({ error: 'Failed to generate delinquency report' });
  }
});

export default router;
