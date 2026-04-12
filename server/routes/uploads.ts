import { Router } from 'express';
import { authenticateToken } from '../middleware.js';
import { db, dbQuery, mockStore, dbInitStatus, pool } from '../db.js';
import { properties, payments, assessments, propertyOwners, adminLogs } from '../schema.js';
import { eq, sql, and, or, isNull, desc } from 'drizzle-orm';
import { upload } from '../config.js';
import { Readable } from 'stream';
import csvParser from 'csv-parser';

const router = Router();

router.post('/admin/upload-abstract', authenticateToken, upload.single('file'), async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const results: any[] = [];
  const firstLine = req.file.buffer.toString().split('\n')[0];
  let separator = ',';
  if (firstLine.includes(';')) separator = ';';
  else if (firstLine.includes('\t')) separator = '\t';

  console.log('[DEBUG-ABSTRACT] Auto-detected CSV separator:', { separator });

  const stream = Readable.from(req.file.buffer.toString());

  stream
    .pipe(csvParser({
      separator,
      mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    }))
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        await db.transaction(async (tx) => {
          let successCount = 0;
          let errorCount = 0;
          const errors: string[] = [];

          for (const row of results) {
            try {
              const pin = row.pin || row.propertyindexnumber;
              if (!pin) throw new Error('Missing PIN');

              const propRows = await tx.select({ id: properties.id }).from(properties).where(eq(properties.pin, pin));
              const prop = propRows[0];
              if (!prop) throw new Error(`Property with PIN ${pin} not found`);

              const amount = parseFloat(row.amount || row.totalamount || 0);
              const date = row.date || row.paymentdate || new Date().toISOString();
              const or_no = row.orno || row.officialreceiptnumber || '';
              const year = row.year || '';
              const basic = parseFloat(row.basic || row.basictax || 0);
              const sef = parseFloat(row.sef || row.seftax || 0);
              const interest = parseFloat(row.interest || 0);
              const discount = parseFloat(row.discount || 0);

              await tx.insert(payments).values({
                propertyId: prop.id,
                amount: String(amount),
                paymentDate: date,
                collectorId: req.user.id,
                orNo: or_no,
                year,
                basicTax: String(basic),
                sefTax: String(sef),
                interest: String(interest),
                discount: String(discount),
              });

              successCount++;
            } catch (e: any) {
              errorCount++;
              errors.push(e.message);
            }
          }

          await tx.insert(adminLogs).values({
            actionType: 'system_data',
            details: `Uploaded historical RPT Abstract: ${successCount} records imported`,
            adminId: req.user.id,
            createdAt: new Date().toISOString(),
          });

          res.json({ successCount, errorCount, errors });
        });
      } catch (err: any) {
        console.error('Abstract upload transaction error:', err);
        res.status(500).json({ error: err.message });
      }
    });
});

router.post('/admin/upload-roll', authenticateToken, upload.single('file'), async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (req.body?.confirmReplaceExistingData !== 'true') {
    return res.status(400).json({ error: 'Upload confirmation is required before replacing existing data' });
  }

  const results: any[] = [];
  const firstLine = req.file.buffer.toString().split('\n')[0];
  let separator = ',';
  if (firstLine.includes(';')) separator = ';';
  else if (firstLine.includes('\t')) separator = '\t';

  console.log('[DEBUG] Auto-detected CSV separator:', { separator });

  const stream = Readable.from(req.file.buffer.toString());

  stream
    .pipe(csvParser({ separator }))
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      if (results.length > 0) {
        console.log('[DEBUG] First Row Data Sample:', results[0]);
      }

      const stagedRows: Array<{
        pin: string;
        td_no: string | null;
        registered_owner_name: string | null;
        lot_no: string | null;
        total_area: string | null;
        assessed_value: number;
        kind: string | null;
        classification: string | null;
        old_pin: string | null;
        status: string;
        taxability: string;
        effectivity: string | null;
        remarks: string | null;
        row_number: number;
      }> = [];

      let errorCount = 0;
      const errors: string[] = [];

      for (const [index, row] of results.entries()) {
        const grab = (searchTerm: string) => {
          const cleaned = searchTerm.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          const key = Object.keys(row).find(k => k.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === cleaned);
          return key ? String(row[key] || '').trim() : null;
        };

        const registeredOwner = grab('registeredowner') || grab('registered_owner') || grab('owner') || null;
        const pin = grab('pin') || null;
        const tdNo = grab('tdno') || grab('td_no') || null;
        const lotNo = grab('lotblockno') || grab('lot_no') || grab('lot') || grab('block') || null;
        const kind = grab('kind') || grab('description') || grab('propkind') || grab('propertykind') || grab('landkind') || null;
        const classification = grab('classification') || grab('class') || grab('propclass') || null;
        const assessedValueRaw = String(grab('assessedvalue') || grab('assessed_value') || grab('av') || '0').replace(/,/g, '');
        const assessedVal = parseFloat(assessedValueRaw);
        const oldPin = grab('oldpin') || grab('old_pin') || grab('old_pin_no') || null;
        const area = grab('area') || grab('total_area') || grab('sqm') || null;
        const status = grab('status') || grab('propstatus') || null;
        const taxability = grab('taxability') || grab('taxable') || grab('tax_status') || null;
        const effectivity = grab('effectivity') || grab('effective') || null;
        const remarks = grab('remarks') || grab('comment') || null;

        if (index === 0) {
          console.log('[DEBUG-ROLL] One Row Mapping:', { pin, status, taxability, classification });
        }

        if (!registeredOwner && !pin) continue;

        if (!pin) {
          errorCount++;
          errors.push(`Row ${index + 1}: Missing PIN`);
          continue;
        }

        if (Number.isNaN(assessedVal)) {
          errorCount++;
          errors.push(`Row ${index + 1}: Invalid assessed value for PIN ${pin}`);
          continue;
        }
        stagedRows.push({
          pin,
          td_no: tdNo,
          registered_owner_name: registeredOwner,
          lot_no: lotNo,
          total_area: area,
          assessed_value: assessedVal,
          kind,
          classification,
          old_pin: oldPin,
          status: status || '',
          taxability: taxability || '',
          effectivity,
          remarks,
          row_number: stagedRows.length + 1
        });
      }

      try {
        if (results.length === 0) {
          return res.status(400).json({ error: 'The uploaded roll file is empty' });
        }

        if (stagedRows.length === 0) {
          return res.status(400).json({ error: 'No valid rows were found in the uploaded roll file', errorCount, errors });
        }

        if (dbInitStatus.mode === 'mock') {
          mockStore.assessments = [];
          mockStore.payments = [];
          mockStore.property_owners = [];
          mockStore.properties = stagedRows.map((row, idx) => ({
            id: idx + 1,
            owner_id: null,
            address: null,
            tax_due: 0,
            last_payment_date: null,
            ownership_type: null,
            claimed_area: null,
            ...row
          }));
          mockStore.admin_logs.push({
            id: mockStore.admin_logs.length + 1,
            action_type: 'system_data',
            details: `Uploaded new Tax Roll: ${stagedRows.length} properties imported`,
            admin_id: req.user.id,
            created_at: new Date().toISOString()
          });
          return res.json({ successCount: stagedRows.length, errorCount, errors });
        }

        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(`
            CREATE TEMP TABLE roll_import_stage (
              row_number INTEGER NOT NULL,
              pin TEXT NOT NULL,
              td_no TEXT,
              registered_owner_name TEXT,
              lot_no TEXT,
              total_area TEXT,
              assessed_value NUMERIC,
              kind TEXT,
              classification TEXT,
              old_pin TEXT,
              status TEXT,
              taxability TEXT,
              effectivity TEXT,
              remarks TEXT
            ) ON COMMIT DROP
          `);

          for (const row of stagedRows) {
            await client.query(
              `INSERT INTO roll_import_stage (
                row_number, pin, td_no, registered_owner_name, lot_no, total_area,
                assessed_value, kind, classification, old_pin, status, taxability, effectivity, remarks
              ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11, $12, $13, $14
              )`,
              [
                row.row_number,
                row.pin,
                row.td_no,
                row.registered_owner_name,
                row.lot_no,
                row.total_area,
                row.assessed_value,
                row.kind,
                row.classification,
                row.old_pin,
                row.status,
                row.taxability,
                row.effectivity,
                row.remarks
              ]
            );
          }

          await client.query('TRUNCATE TABLE assessments, payments, property_owners, properties RESTART IDENTITY CASCADE');

          await client.query(`
            INSERT INTO properties (
              pin, td_no, registered_owner_name, lot_no, total_area,
              assessed_value, kind, classification, old_pin, status,
              taxability, effectivity, remarks
            )
            SELECT
              pin, td_no, registered_owner_name, lot_no, total_area,
              assessed_value, kind, classification, old_pin, status,
              taxability, effectivity, remarks
            FROM roll_import_stage
            ORDER BY row_number
          `);

          await client.query(
            'INSERT INTO admin_logs (action_type, details, admin_id, created_at) VALUES ($1, $2, $3, $4)',
            ['system_data', `Uploaded new Tax Roll via staged import: ${stagedRows.length} properties imported`, req.user.id, new Date().toISOString()]
          );

          await client.query('COMMIT');
          res.json({ successCount: stagedRows.length, errorCount, errors });
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } catch (err: any) {
        console.error('Roll upload transaction error:', err);
        res.status(500).json({ error: err.message });
      }
    });
});

export default router;
