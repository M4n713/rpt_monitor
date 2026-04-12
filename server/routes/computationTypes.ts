import { Router } from 'express';
import { authenticateToken } from '../middleware.js';
import { db } from '../db.js';
import { customComputationTypes } from '../schema.js';
import { eq, sql, desc, asc } from 'drizzle-orm';

const router = Router();

router.get('/admin/computation-types', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const rows = await db.select().from(customComputationTypes)
      .orderBy(desc(customComputationTypes.isBuiltin), asc(customComputationTypes.createdAt), asc(customComputationTypes.id));
    res.json(rows);
  } catch (err) {
    console.error('Fetch custom computation types error:', err);
    res.status(500).json({ error: 'Failed to fetch custom computation types' });
  }
});

router.post('/admin/computation-types', authenticateToken, async (req: any, res) => {
  if (req.user.username.toLowerCase() !== 'manlie') return res.status(403).json({ error: 'Forbidden' });

  const { label, base_type, description, special_case_hook, effective_from, effective_to, config, is_active } = req.body || {};
  if (!label || !base_type) return res.status(400).json({ error: 'Missing label or base type' });
  if (!['standard', 'rpvara', 'denr', 'share'].includes(base_type)) {
    return res.status(400).json({ error: 'Invalid base type' });
  }
  if (!['none', 'rpvara_2024_half', 'denr_10_year_window'].includes(special_case_hook || 'none')) {
    return res.status(400).json({ error: 'Invalid special case hook' });
  }

  try {
    const baseValue = String(label)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || `custom-${Date.now()}`;

    let candidateValue = `custom-${baseValue}`;
    let counter = 1;
    while (true) {
      const existing = await db.select({ id: customComputationTypes.id }).from(customComputationTypes)
        .where(eq(customComputationTypes.value, candidateValue));
      if (existing.length === 0) break;
      counter += 1;
      candidateValue = `custom-${baseValue}-${counter}`;
    }

    const rows = await db.insert(customComputationTypes).values({
      label: String(label).trim(),
      value: candidateValue,
      baseType: base_type,
      description: description ? String(description).trim() : null,
      specialCaseHook: special_case_hook || 'none',
      effectiveFrom: effective_from || null,
      effectiveTo: effective_to || null,
      config: config || {},
      isActive: is_active !== false,
      isBuiltin: false,
    }).returning();

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create custom computation type error:', err);
    res.status(500).json({ error: 'Failed to create custom computation type' });
  }
});

router.delete('/admin/computation-types/:id', authenticateToken, async (req: any, res) => {
  if (req.user.username.toLowerCase() !== 'manlie') return res.status(403).json({ error: 'Forbidden' });
  try {
    const existing = await db.select({ isBuiltin: customComputationTypes.isBuiltin }).from(customComputationTypes)
      .where(eq(customComputationTypes.id, Number(req.params.id)));
    if (existing[0]?.isBuiltin) {
      return res.status(400).json({ error: 'Built-in computation rules cannot be deleted. Edit or deactivate them instead.' });
    }
    await db.delete(customComputationTypes).where(eq(customComputationTypes.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    console.error('Delete custom computation type error:', err);
    res.status(500).json({ error: 'Failed to delete custom computation type' });
  }
});

router.put('/admin/computation-types/:id', authenticateToken, async (req: any, res) => {
  if (req.user.username.toLowerCase() !== 'manlie') return res.status(403).json({ error: 'Forbidden' });

  const { label, base_type, description, special_case_hook, effective_from, effective_to, config, is_active } = req.body || {};
  if (!label || !base_type) return res.status(400).json({ error: 'Missing label or base type' });
  if (!['standard', 'rpvara', 'denr', 'share'].includes(base_type)) {
    return res.status(400).json({ error: 'Invalid base type' });
  }
  if (!['none', 'rpvara_2024_half', 'denr_10_year_window'].includes(special_case_hook || 'none')) {
    return res.status(400).json({ error: 'Invalid special case hook' });
  }

  try {
    const rows = await db.update(customComputationTypes).set({
      label: String(label).trim(),
      baseType: base_type,
      description: description ? String(description).trim() : null,
      specialCaseHook: special_case_hook || 'none',
      effectiveFrom: effective_from || null,
      effectiveTo: effective_to || null,
      config: config || {},
      isActive: is_active !== false,
    }).where(eq(customComputationTypes.id, Number(req.params.id))).returning();

    if (!rows[0]) return res.status(404).json({ error: 'Computation type not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Update custom computation type error:', err);
    res.status(500).json({ error: 'Failed to update custom computation type' });
  }
});

export default router;
