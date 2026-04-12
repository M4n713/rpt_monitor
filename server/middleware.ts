import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config.js';
import { db } from './db.js';
import { users } from './schema.js';
import { eq } from 'drizzle-orm';

export const authenticateToken = (req: any, res: any, next: any) => {
  const token = req.cookies?.token;
  console.log('[DEBUG] authenticateToken - Token:', token ? 'Present' : 'Missing', 'URL:', req.url);
  if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

  jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
    if (err) {
      console.log('[DEBUG] authenticateToken - JWT Verify Error:', err.message);
      return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }

    try {
      await db.update(users).set({ lastActiveAt: new Date().toISOString() }).where(eq(users.id, user.id));
    } catch (e) {
    }

    req.user = user;
    next();
  });
};
