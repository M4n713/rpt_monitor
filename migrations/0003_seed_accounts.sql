-- Migration 003: Seed system accounts
-- These accounts are only created if the environment variables are set at runtime.
-- This migration is a template; the actual seeding is done at app startup in db.ts.

-- Placeholder: Admin and Queue accounts are seeded programmatically in initDb()
-- because their passwords come from environment variables (SEED_ADMIN_PASSWORD, SEED_QUEUE_PASSWORD).
-- This file intentionally left minimal.

SELECT 1;
