import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware.js';
import { db, dbQuery } from '../db.js';
import { users, adminLogs } from '../schema.js';
import { JWT_SECRET, generateTemporaryPassword } from '../config.js';
import { eq, sql } from 'drizzle-orm';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const normalizedUsername = username ? username.trim().replace(/\s+/g, ' ').toLowerCase() : '';

    const rows = await db.select().from(users).where(sql`LOWER(${users.username}) = ${normalizedUsername}`);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password || '', user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, name: user.full_name, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax'
    });
    res.json({ id: user.id, username: user.username, role: user.role, full_name: user.full_name });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax'
  });
  res.json({ message: 'Logged out' });
});

router.get('/me', authenticateToken, (req: any, res) => {
  res.json(req.user);
});

router.post('/change-password', authenticateToken, async (req: any, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old password and new password are required' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters' });
    }

    const rows = await db.select({ password: users.password }).from(users).where(eq(users.id, req.user.id));
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];

    const isPasswordCorrect = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, req.user.id));

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/reset-password', authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin role required' });
    }

    const { userId, role } = req.body;
    if (!userId || !role) {
      return res.status(400).json({ error: 'User ID and role are required' });
    }

    if (!['admin', 'collector', 'taxpayer', 'queue'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const temporaryPassword = generateTemporaryPassword();

    const hashedPassword = bcrypt.hashSync(temporaryPassword, 10);
    const result = await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));

    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.insert(adminLogs).values({
      actionType: 'user_management',
      details: `Reset password for user ID ${userId}`,
      adminId: req.user.id,
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Password reset successfully', temporaryPassword });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/register', async (req, res) => {
  const { username, full_name, password } = req.body;
  try {
    const normalizedUsername = username ? username.trim().replace(/\s+/g, ' ').toLowerCase() : '';
    const normalizedFullName = full_name ? String(full_name).trim() : '';
    const rawPassword = typeof password === 'string' ? password : '';

    if (!normalizedUsername || !normalizedFullName || !rawPassword) {
      return res.status(400).json({ error: 'Username, full name, and password are required' });
    }

    if (rawPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hashedPassword = bcrypt.hashSync(rawPassword, 10);
    const rows = await db.insert(users).values({
      username: normalizedUsername,
      password: hashedPassword,
      role: 'taxpayer',
      fullName: normalizedFullName,
    }).returning({ id: users.id });

    const userId = rows[0].id;
    const token = jwt.sign({ id: userId, role: 'taxpayer', name: normalizedFullName, username: normalizedUsername }, JWT_SECRET, { expiresIn: '24h' });
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax'
    });
    res.json({ id: userId, username: normalizedUsername, role: 'taxpayer', full_name: normalizedFullName });
  } catch (error: any) {
    if (error.code === '23505') res.status(400).json({ error: 'Username already exists' });
    else res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
