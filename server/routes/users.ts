import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../middleware.js';
import { db, dbQuery } from '../db.js';
import { users, adminLogs, assessments, payments, propertyOwners, taxpayerLogs, directMessages, messages, inquiries, loginPatterns, properties } from '../schema.js';
import { eq, sql, and, or, isNull, desc, asc, ne } from 'drizzle-orm';
import { generateTemporaryPassword } from '../config.js';

const router = Router();

router.get('/', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const rows = await db.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      age: users.age,
      gender: users.gender,
      phoneNumber: users.phoneNumber,
      assignedCollectorId: users.assignedCollectorId,
      queueNumber: users.queueNumber,
      queueDate: users.queueDate,
      notified: users.notified,
      notifiedAt: users.notifiedAt,
      lastActiveAt: users.lastActiveAt,
    }).from(users).orderBy(asc(users.id));
    res.json(rows);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/admin/create-taxpayer', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });

  const { username, full_name } = req.body;
  if (!username || !full_name) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const normalizedUsername = username.trim().replace(/\s+/g, ' ').toLowerCase();
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = bcrypt.hashSync(temporaryPassword, 10);
    const rows = await db.insert(users).values({
      username: normalizedUsername,
      password: hashedPassword,
      role: 'taxpayer',
      fullName: full_name,
    }).returning({ id: users.id });

    await db.insert(adminLogs).values({
      actionType: 'user_management',
      details: `Created taxpayer: ${full_name} (${normalizedUsername})`,
      adminId: req.user.id,
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true, id: rows[0].id, username: normalizedUsername, full_name, temporaryPassword });
  } catch (error: any) {
    if (error.code === '23505') res.status(400).json({ error: 'Username already exists' });
    else res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/create-admin', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });
  if (req.user.username.toLowerCase() !== 'manlie') return res.status(403).json({ error: 'Forbidden: Only Manlie can create admins' });

  const { username, full_name } = req.body;
  if (!username || !full_name) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const normalizedUsername = username.trim().replace(/\s+/g, ' ');
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = bcrypt.hashSync(temporaryPassword, 10);
    const rows = await db.insert(users).values({
      username: normalizedUsername,
      password: hashedPassword,
      role: 'admin',
      fullName: full_name,
    }).returning({ id: users.id });

    await db.insert(adminLogs).values({
      actionType: 'user_management',
      details: `Created admin: ${full_name} (${normalizedUsername})`,
      adminId: req.user.id,
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true, id: rows[0].id, username: normalizedUsername, full_name, temporaryPassword });
  } catch (error: any) {
    if (error.code === '23505') res.status(400).json({ error: 'Username already exists' });
    else res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/create-collector', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });
  if (req.user.username.toLowerCase() !== 'manlie') return res.status(403).json({ error: 'Forbidden: Only Manlie can create collectors' });

  const { username, full_name } = req.body;
  if (!username || !full_name) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const normalizedUsername = username.trim().replace(/\s+/g, ' ').toLowerCase();
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = bcrypt.hashSync(temporaryPassword, 10);
    const rows = await db.insert(users).values({
      username: normalizedUsername,
      password: hashedPassword,
      role: 'collector',
      fullName: full_name,
    }).returning({ id: users.id });

    await db.insert(adminLogs).values({
      actionType: 'user_management',
      details: `Created collector: ${full_name} (${normalizedUsername})`,
      adminId: req.user.id,
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true, id: rows[0].id, username: normalizedUsername, full_name, temporaryPassword });
  } catch (error: any) {
    if (error.code === '23505') res.status(400).json({ error: 'Username already exists' });
    else res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin/taxpayers', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const rows = await db.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      age: users.age,
      gender: users.gender,
      queueNumber: users.queueNumber,
      assignedCollectorId: users.assignedCollectorId,
      lastActiveAt: users.lastActiveAt,
    }).from(users).where(eq(users.role, 'taxpayer'));
    res.json(rows);
  } catch (err) {
    console.error('Fetch taxpayers error:', err);
    res.status(500).json({ error: 'Failed to fetch taxpayers' });
  }
});

router.get('/admin/collectors', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const rows = await db.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      lastActiveAt: users.lastActiveAt,
    }).from(users).where(or(eq(users.role, 'collector'), eq(users.role, 'admin')))
      .orderBy(asc(users.fullName));
    res.json(rows);
  } catch (err) {
    console.error('Fetch collectors error:', err);
    res.status(500).json({ error: 'Failed to fetch collectors' });
  }
});

router.get('/active', authenticateToken, async (req, res) => {
  try {
    const threshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const rows = await db.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      phoneNumber: users.phoneNumber,
      lastActiveAt: users.lastActiveAt,
      queueNumber: users.queueNumber,
      notified: users.notified,
      notifiedAt: users.notifiedAt,
    }).from(users).where(sql`${users.lastActiveAt} > ${threshold}`)
      .orderBy(desc(users.lastActiveAt));

    res.json(rows);
  } catch (err) {
    console.error('Fetch active users error:', err);
    res.status(500).json({ error: 'Failed to fetch active users' });
  }
});

router.get('/recipients', authenticateToken, async (req: any, res) => {
  try {
    const rows = await db.select({
      id: users.id,
      fullName: users.fullName,
      role: users.role,
      lastActiveAt: users.lastActiveAt,
    }).from(users).where(ne(users.id, req.user.id))
      .orderBy(asc(users.fullName));
    res.json(rows);
  } catch (err) {
    console.error('Fetch recipients error:', err);
    res.status(500).json({ error: 'Failed to fetch recipients' });
  }
});

router.get('/admin/debug-users', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const rows = await db.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
    }).from(users);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/admin/temp-delete-users', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const names = ['Fidel', 'Elena', 'Rhea', 'Glaiza'];
    for (const name of names) {
      await db.delete(users).where(eq(users.fullName, name));
    }
    res.json({ success: true, message: 'Users deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete users' });
  }
});

router.post('/admin/reset-data', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Only admins can perform this action' });
  if (req.user.username.toLowerCase() !== 'manlie') return res.status(403).json({ error: 'Forbidden: Only Manlie can perform this action' });

  const { action, account_id } = req.body;
  console.log('[DEBUG] Reset/Delete Request:', { action, account_id, user: req.user, userId: req.user.id });

  try {
    await db.transaction(async (tx) => {
      if (action === 'delete_account') {
        if (!account_id) throw new Error('Account ID required');

        const userRows = await tx.select({ username: users.username }).from(users).where(eq(users.id, account_id));
        if (userRows.length > 0 && userRows[0].username.toLowerCase() === 'manlie') {
          throw new Error('Cannot delete master admin account');
        }

        console.log(`[DELETE] Cleaning up references for user ${account_id}`);
        await tx.update(users).set({ assignedCollectorId: null }).where(eq(users.assignedCollectorId, account_id));
        await tx.update(assessments).set({ assignedCollectorId: null }).where(eq(assessments.assignedCollectorId, account_id));
        await tx.update(payments).set({ collectorId: null }).where(eq(payments.collectorId, account_id));
        await tx.delete(adminLogs).where(eq(adminLogs.adminId, account_id));
        await tx.delete(directMessages).where(or(eq(directMessages.senderId, account_id), eq(directMessages.recipientId, account_id)));
        await tx.delete(assessments).where(eq(assessments.taxpayerId, account_id));
        await tx.delete(payments).where(eq(payments.taxpayerId, account_id));
        await tx.delete(propertyOwners).where(eq(propertyOwners.userId, account_id));
        await tx.update(properties).set({ ownerId: null, ownershipType: null, claimedArea: null }).where(eq(properties.ownerId, account_id));
        await tx.delete(taxpayerLogs).where(or(eq(taxpayerLogs.taxpayerId, account_id), eq(taxpayerLogs.userId, account_id)));

        console.log(`[DELETE] Finally deleting user ${account_id}`);
        await tx.delete(users).where(eq(users.id, account_id));

        await tx.insert(adminLogs).values({
          actionType: 'delete_account',
          details: `Deleted user account ID: ${account_id}`,
          adminId: req.user.id,
          createdAt: new Date().toISOString(),
        });
      } else {
        console.log('[RESET] Initiating full system data reset...');

        await tx.update(users).set({ assignedCollectorId: null });

        await tx.delete(assessments);
        await tx.delete(payments);

        await tx.delete(propertyOwners);
        await tx.delete(properties);

        await tx.delete(taxpayerLogs);
        await tx.delete(adminLogs);
        await tx.delete(directMessages);

        await tx.delete(messages);
        await tx.delete(inquiries);
        await tx.delete(loginPatterns);

        console.log(`[RESET] Deleting all users except ID ${req.user.id}`);
        await tx.delete(users).where(ne(users.id, req.user.id));

        await tx.insert(adminLogs).values({
          actionType: 'system_reset',
          details: 'System-wide factory reset performed',
          adminId: req.user.id,
          createdAt: new Date().toISOString(),
        });

        console.log('[RESET] Factory reset completed successfully');
      }
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Reset/Delete data error:', err);
    res.status(500).json({ error: 'Failed to perform action', details: err.message });
  }
});

export default router;
