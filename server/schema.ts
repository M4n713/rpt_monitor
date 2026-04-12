import {
  pgTable, serial, text, integer, numeric, boolean, date, jsonb,
  timestamp, uniqueIndex, unique, check, timestamp as timestamptz
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').unique().notNull(),
  password: text('password').notNull(),
  role: text('role').notNull(),
  fullName: text('full_name').notNull(),
  age: integer('age'),
  gender: text('gender'),
  phoneNumber: text('phone_number'),
  lastActiveAt: timestamptz('last_active_at', { withTimezone: true }),
  assignedCollectorId: integer('assigned_collector_id').references(() => users.id),
  queueNumber: integer('queue_number'),
  queueDate: date('queue_date'),
  notified: boolean('notified').default(false),
  notifiedAt: timestamptz('notified_at', { withTimezone: true }),
  transactionType: text('transaction_type'),
  loginLevel: integer('login_level').default(1),
}, (table) => [
  check('users_role_check', sql`${table.role} IN ('taxpayer', 'collector', 'admin', 'queue')`),
]);

import { sql } from 'drizzle-orm';

export const properties = pgTable('properties', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id').references(() => users.id),
  registeredOwnerName: text('registered_owner_name'),
  pin: text('pin'),
  tdNo: text('td_no'),
  lotNo: text('lot_no'),
  address: text('address'),
  kind: text('kind'),
  assessedValue: numeric('assessed_value').default('0'),
  taxDue: numeric('tax_due').default('0'),
  status: text('status'),
  lastPaymentDate: timestamptz('last_payment_date', { withTimezone: true }),
  totalArea: text('total_area'),
  ownershipType: text('ownership_type'),
  claimedArea: text('claimed_area'),
  taxability: text('taxability'),
  classification: text('classification'),
  oldPin: text('old_pin'),
  effectivity: text('effectivity'),
  remarks: text('remarks'),
}, (table) => [
  check('properties_ownership_type_check', sql`${table.ownershipType} IN ('full', 'shared')`),
]);

export const propertyOwners = pgTable('property_owners', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id').notNull().references(() => properties.id),
  userId: integer('user_id').notNull().references(() => users.id),
  ownershipType: text('ownership_type'),
  claimedArea: text('claimed_area'),
}, (table) => [
  unique('property_owners_property_id_user_id_key').on(table.propertyId, table.userId),
]);

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id').notNull().references(() => properties.id),
  taxpayerId: integer('taxpayer_id').references(() => users.id),
  amount: numeric('amount').notNull(),
  paymentDate: timestamptz('payment_date', { withTimezone: true }).notNull(),
  collectorId: integer('collector_id').references(() => users.id),
  orNo: text('or_no'),
  year: text('year'),
  basicTax: numeric('basic_tax'),
  sefTax: numeric('sef_tax'),
  interest: numeric('interest'),
  discount: numeric('discount'),
  remarks: text('remarks'),
  tdNo: text('td_no'),
});

export const assessments = pgTable('assessments', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id').notNull().references(() => properties.id),
  taxpayerId: integer('taxpayer_id').references(() => users.id),
  assignedCollectorId: integer('assigned_collector_id').references(() => users.id),
  amount: numeric('amount').notNull(),
  year: text('year'),
  assessedValue: numeric('assessed_value'),
  basicTax: numeric('basic_tax'),
  sefTax: numeric('sef_tax'),
  interest: numeric('interest'),
  discount: numeric('discount'),
  status: text('status').default('pending'),
  createdAt: timestamptz('created_at', { withTimezone: true }),
  tdNo: text('td_no'),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  targetRole: text('target_role').notNull(),
  createdAt: timestamptz('created_at', { withTimezone: true }).notNull(),
  audioData: text('audio_data'),
  audioMime: text('audio_mime'),
}, (table) => [
  check('messages_target_role_check', sql`${table.targetRole} IN ('taxpayer', 'collector', 'all', 'queue_system')`),
]);

export const directMessages = pgTable('direct_messages', {
  id: serial('id').primaryKey(),
  senderId: integer('sender_id').notNull().references(() => users.id),
  recipientId: integer('recipient_id').notNull().references(() => users.id),
  subject: text('subject'),
  body: text('body').notNull(),
  isRead: integer('is_read').default(0),
  createdAt: timestamptz('created_at', { withTimezone: true }).notNull(),
});

export const adminLogs = pgTable('admin_logs', {
  id: serial('id').primaryKey(),
  actionType: text('action_type').notNull(),
  details: text('details').notNull(),
  adminId: integer('admin_id').notNull().references(() => users.id),
  createdAt: timestamptz('created_at', { withTimezone: true }).notNull(),
});

export const taxpayerLogs = pgTable('taxpayer_logs', {
  id: serial('id').primaryKey(),
  taxpayerId: integer('taxpayer_id').references(() => users.id),
  taxpayerName: text('taxpayer_name').notNull(),
  role: text('role').notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  userName: text('user_name').notNull(),
  pins: text('pins').notNull(),
  timeIn: timestamptz('time_in', { withTimezone: true }).notNull(),
  timeOut: timestamptz('time_out', { withTimezone: true }),
  remarks: text('remarks'),
  createdAt: timestamptz('created_at', { withTimezone: true }).notNull(),
}, (table) => [
  check('taxpayer_logs_role_check', sql`${table.role} IN ('admin', 'collector')`),
]);

export const loginPatterns = pgTable('login_patterns', {
  id: serial('id').primaryKey(),
  word: text('word').notNull(),
  createdAt: timestamptz('created_at', { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

export const inquiries = pgTable('inquiries', {
  id: serial('id').primaryKey(),
  senderName: text('sender_name').notNull(),
  email: text('email'),
  message: text('message').notNull(),
  status: text('status').default('unread'),
  createdAt: timestamptz('created_at', { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

export const barangays = pgTable('barangays', {
  id: serial('id').primaryKey(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: false }).default(sql`CURRENT_TIMESTAMP`),
});

export const customComputationTypes = pgTable('custom_computation_types', {
  id: serial('id').primaryKey(),
  label: text('label').notNull(),
  value: text('value').unique().notNull(),
  baseType: text('base_type').notNull(),
  description: text('description'),
  specialCaseHook: text('special_case_hook').notNull().default('none'),
  effectiveFrom: date('effective_from'),
  effectiveTo: date('effective_to'),
  config: jsonb('config').notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  isBuiltin: boolean('is_builtin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: false }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  check('custom_computation_types_base_type_check', sql`${table.baseType} IN ('standard', 'rpvara', 'denr', 'share')`),
]);
