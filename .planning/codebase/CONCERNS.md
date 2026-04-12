# Codebase Concerns

**Analysis Date:** 2026-04-12

## Security Concerns

### SEC-01: Hardcoded Super-Admin Username for Authorization
- **Severity:** Critical
- **Location:** `server/routes/users.ts` (lines 69, 101, 237, 248), `server/routes/barangays.ts` (lines 20, 36), `server/routes/computationTypes.ts` (lines 22, 72, 88), `server/routes/reports.ts` (line 82), `src/pages/AdminPanel.tsx` (lines 596, 632, 641, 647-655, 3187, 3223, 3295, 3410, 3610, 3679)
- **Description:** Authorization checks compare `req.user.username.toLowerCase() === 'manlie'` to gate critical operations like creating admins/collectors, resetting passwords, managing computation types, barangays, and data. This is a hardcoded identity check rather than a role-based or permission-based system.
- **Impact:** Any user renamed to "manlie" or any username collision would bypass authorization. The check is also scattered across 20+ locations in both frontend and backend, making it impossible to audit or change the super-admin identity consistently.
- **Recommendation:** Introduce a `permissions` or `isSuperAdmin` field on the user model. Replace all username checks with a proper permission check. At minimum, centralize the check into a middleware function.

### SEC-02: No Rate Limiting on Authentication Endpoints
- **Severity:** Critical
- **Location:** `server/routes/auth.ts` (lines 12-41 login, 129-165 register), `server/routes/queue.ts` (line 12 register)
- **Description:** No rate limiting middleware is applied to login, register, or queue registration endpoints. Attackers can brute-force passwords or spam account creation without restriction.
- **Impact:** Credential stuffing and brute-force attacks are trivially possible. Account spam can fill the database.
- **Recommendation:** Add `express-rate-limit` middleware. Apply strict limits (e.g., 5 attempts/minute) to `/api/login`, moderate limits (e.g., 10/minute) to `/api/register` and `/api/queue/register`.

### SEC-03: Weak Password Policy (4-character minimum for change-password)
- **Severity:** High
- **Location:** `server/routes/auth.ts` (line 66)
- **Description:** The `/api/change-password` endpoint only requires passwords to be at least 4 characters. The register endpoint requires 8 characters (line 141), but the change-password endpoint has a much weaker requirement.
- **Impact:** Users can weaken their passwords to trivially guessable values after registration.
- **Recommendation:** Enforce a consistent minimum password length of 8 characters across all password-setting endpoints. Consider adding complexity requirements.

### SEC-04: JWT Token Contains Sensitive User Info Without Rotation
- **Severity:** High
- **Location:** `server/routes/auth.ts` (line 29)
- **Description:** The JWT payload includes `{ id, role, name, username }`. The token has a 24h expiry but there's no token revocation mechanism. If a user's role is changed or account is disabled, the old token remains valid for up to 24 hours.
- **Impact:** Compromised tokens or role changes are not immediately enforceable. A demoted admin could retain admin access for up to 24 hours.
- **Recommendation:** Implement a token blacklist or version field on the user record that can be checked on each request. Shorten token expiry and use refresh tokens.

### SEC-05: Swallowed Error in Authentication Middleware
- **Severity:** High
- **Location:** `server/middleware.ts` (lines 19-22)
- **Description:** The `authenticateToken` middleware catches errors from the `lastActiveAt` update and silently swallows them with an empty catch block:
  ```typescript
  try {
    await db.update(users).set({ lastActiveAt: new Date().toISOString() }).where(eq(users.id, user.id));
  } catch (e) {
  }
  ```
- **Impact:** If the database becomes unreachable mid-session, authentication continues without any logging or alerting. This could mask connectivity issues and make debugging difficult.
- **Recommendation:** Log the error at minimum: `console.warn('[AUTH] Failed to update lastActiveAt:', e)`. Consider whether this failure should affect the request outcome.

### SEC-06: SSL Certificate Validation Disabled
- **Severity:** High
- **Location:** `server/db.ts` (lines 57-59)
- **Description:** When SSL is enabled for database connections, `rejectUnauthorized: false` is set, which disables certificate verification.
- **Impact:** Man-in-the-middle attacks on the database connection are possible. An attacker could intercept database traffic, especially concerning for cloud-hosted databases (Neon, Supabase, Render).
- **Recommendation:** Set `rejectUnauthorized: true` in production. Provide the CA certificate via an environment variable for cloud database providers.

### SEC-07: Debug Logging Leaks Information
- **Severity:** Medium
- **Location:** `server/middleware.ts` (line 10), `server/routes/assessments.ts` (lines 22-23, 44, 57-58, 62, 100-102), `server/routes/properties.ts` (lines 135-141), `server/routes/payments.ts` (line 13), `server/db.ts` (lines 53-56, 62-69)
- **Description:** Numerous `[DEBUG]` log statements print request details, user objects, property data, and database configuration (including partial connection info) to the console.
- **Impact:** In production logs, sensitive data like token presence, user IDs, database hosts, and property details could be exposed. The DB config logging at `server/db.ts` line 68 partially parses connection strings to detect password presence.
- **Recommendation:** Remove or guard all `[DEBUG]` logs behind `if (!isProduction)`. Use a proper logging library with log levels (debug, info, warn, error) and configure production to only output info/warn/error.

### SEC-08: Unauthenticated Endpoints Expose Data
- **Severity:** Medium
- **Location:** `server/routes/queue.ts` (lines 89-109 active queue, 111-136 now-serving, 138-155 stats), `server/routes/messages.ts` (lines 22-33 public announcements), `server/routes/inquiries.ts` (lines 9-26 submit inquiry), `server/routes/reports.ts` (lines 10-21 tables, 23-30 status, 32-79 check-db)
- **Description:** Several endpoints require no authentication: the queue system's active list, now-serving, and stats; public announcements; inquiry submissions; and database status/schema endpoints. The `/api/tables` endpoint reveals the entire database schema.
- **Impact:** The `/api/tables` endpoint leaks database table names to unauthenticated users. Queue endpoints expose taxpayer names and phone numbers to anyone. `/api/check-db` exposes database host and error stack traces.
- **Recommendation:** Add authentication to `/api/tables` and `/api/check-db` (admin-only). Sanitize queue endpoints to not expose phone numbers without authentication. Rate-limit the inquiry submission endpoint.

### SEC-09: CORS Wildcard for Tailscale Domains
- **Severity:** Medium
- **Location:** `server/index.ts` (lines 82-101)
- **Description:** The CORS configuration allows any origin ending in `.ts.net` via `origin.endsWith('.ts.net')`. Combined with `credentials: true`, this means any Tailscale service can make authenticated cross-origin requests.
- **Impact:** Any Tailscale-enabled device or service in the network could make authenticated requests to the API with user cookies.
- **Recommendation:** Restrict the Tailscale origin check to only the specific `TAILSCALE_HOST` domain. Remove the blanket `.ts.net` wildcard.

### SEC-10: Hardcoded IP Addresses in CORS Origins
- **Severity:** Low
- **Location:** `server/index.ts` (lines 87-88)
- **Description:** Hardcoded private IP addresses `http://100.65.168.30:3000` and `https://100.65.168.30:${PORT}` are included in the allowed CORS origins.
- **Impact:** If the Tailscale IP changes (which it can), these become stale entries. They also expose internal network topology.
- **Recommendation:** Remove hardcoded IPs. Use environment variables for all allowed origins, or rely solely on the `ALLOWED_ORIGINS` env var and `TAILSCALE_HOST`.

---

## Performance Concerns

### PERF-01: N+1 Query in Properties Listing
- **Severity:** High
- **Location:** `server/routes/properties.ts` (lines 118-154)
- **Description:** After fetching properties, the code iterates over each property and makes an individual query to fetch its owners:
  ```typescript
  const enrichedProperties = await Promise.all(props.map(async (p: any, index: number) => {
    const owners = await db.select({...}).from(propertyOwners)
      .innerJoin(users, eq(users.id, propertyOwners.userId))
      .where(eq(propertyOwners.propertyId, p.id));
    // ...
  }));
  ```
- **Impact:** For 50 properties, this creates 50 additional database queries. With high traffic, this could overwhelm the database and cause slow response times.
- **Recommendation:** Batch-fetch all owners for the returned property IDs in a single query, then group them in application code.

### PERF-02: Synchronous bcrypt Hashing Blocks Event Loop
- **Severity:** High
- **Location:** `server/routes/auth.ts` (lines 81, 108, 144), `server/routes/users.ts` (lines 45, 77, 109), `server/routes/queue.ts` (line 52), `server/db.ts` (lines 310, 323)
- **Description:** `bcrypt.hashSync()` is used in all password hashing operations. bcrypt is computationally expensive by design (~100ms per hash), and the synchronous variant blocks the Node.js event loop.
- **Impact:** Under concurrent registration or password reset operations, the server becomes unresponsive for all other requests. With 10 simultaneous registrations, the event loop could be blocked for ~1 second.
- **Recommendation:** Replace all `bcrypt.hashSync()` with `await bcrypt.hash()` (async version). This applies to 8 call sites across the codebase.

### PERF-03: Giant Monolithic React Components
- **Severity:** High
- **Location:** `src/pages/AdminPanel.tsx` (5267 lines), `src/pages/CollectorPanel.tsx` (3478 lines)
- **Description:** The AdminPanel and CollectorPanel are extremely large single-file components containing all state, API calls, and UI for their respective pages. They define dozens of state variables and handler functions.
- **Impact:** These files are extremely difficult to maintain, navigate, and test. Changes to any feature require understanding the entire file. React must re-render the entire component tree for any state change, causing potential UI lag. Bundle size is unnecessarily large because code-splitting is impossible within these monoliths.
- **Recommendation:** Break into smaller components and custom hooks. Extract API calls into service modules. Use React.lazy() for sub-panels. Target under 500 lines per component file.

### PERF-04: No Pagination on Several List Endpoints
- **Severity:** Medium
- **Location:** `server/routes/properties.ts` (line 113 - `limit(50)` for admin default but no offset/pagination), `server/routes/payments.ts` (lines 109-125 - all payments, no limit), `server/routes/messages.ts` (lines 10-19 - all messages, no limit), `server/routes/logs.ts` (lines 12-18 - logs limited to 100, but no pagination)
- **Description:** Many list endpoints return all records without pagination support. The admin payments endpoint returns every payment in the database with no limit.
- **Impact:** As data grows, these endpoints will return increasingly large responses, causing high memory usage and slow response times. A database with 10,000+ payments could cause multi-second API responses.
- **Recommendation:** Add pagination (limit/offset or cursor-based) to all list endpoints. Return total count in response headers for client-side pagination UI.

### PERF-05: Delinquency Report Loads All Properties Into Memory
- **Severity:** Medium
- **Location:** `server/routes/reports.ts` (lines 81-199)
- **Description:** The delinquency report endpoint loads all properties and all payments into memory, then performs computation in a JavaScript loop. The payment data is loaded in a single query with no filtering.
- **Impact:** With thousands of properties and years of payment history, this endpoint will consume significant memory and CPU. The computation runs synchronously in the request handler.
- **Recommendation:** Move computation to database-level queries using SQL aggregation. At minimum, add streaming/pagination and consider making this an async job that generates a downloadable report.

### PERF-06: Hardcoded Date Values in Delinquency Report
- **Severity:** Medium
- **Location:** `server/routes/reports.ts` (lines 110-112)
- **Description:** The delinquency report hardcodes `currentYear = 2026`, `currentMonth = 2`, and `isApril1Passed = false` instead of computing these dynamically.
- **Impact:** The delinquency report will produce incorrect results as time passes. After April 1, 2026, the report will still behave as if April 1 hasn't passed. After 2026, the year will be wrong.
- **Recommendation:** Replace with dynamic date calculation using `new Date()` and Philippine timezone handling.

---

## Maintainability Concerns

### MNT-01: Duplicated Barangay Mapping in Frontend and Backend
- **Severity:** High
- **Location:** `src/pages/Dashboard.tsx` (lines 38-73 switch statement), `server/db.ts` (lines 194-203 `INITIAL_BARANGAYS` array), `server/utils.ts` (lines 5-14 `getLocationFromPin` using `cachedBarangays`)
- **Description:** The barangay-to-location mapping is hardcoded in the frontend Dashboard as a switch statement and separately maintained in the backend as an array. The frontend version doesn't use the API to fetch barangays.
- **Impact:** When barangays are added/modified via the admin panel (which updates the database and backend cache), the Dashboard's hardcoded switch statement will not reflect the changes. This creates data inconsistency.
- **Recommendation:** Remove the hardcoded switch statement from `Dashboard.tsx`. Use the `/api/barangays` endpoint or derive the location from the property data returned by the API.

### MNT-02: Inconsistent API Request/Response Naming Conventions
- **Severity:** High
- **Location:** Throughout `server/routes/*.ts` and `src/pages/*.tsx`
- **Description:** The API uses a mix of `camelCase` and `snake_case` for both request parameters and response properties. Examples:
  - Request: `full_name` (snake_case) vs `fullName` (camelCase) in different endpoints
  - Response: properties API returns `registeredOwnerName` (camelCase from Drizzle) and `registered_owner_name` (snake_case from raw SQL)
  - The code at `server/routes/properties.ts` line 147 manually maps between the two: `owners.map(o => ({ ...o, full_name: o.fullName, ownership_type: o.ownershipType }))`
- **Impact:** Frontend code must handle both naming conventions for the same conceptual fields. This leads to bugs where `prop.registeredOwnerName` is sometimes `undefined` because the data came from a raw SQL query that returns `registered_owner_name`.
- **Recommendation:** Standardize on one convention for the API layer. Add a response serialization layer that transforms Drizzle camelCase results to a consistent API format. Use Zod schemas for request validation.

### MNT-03: Excessive Use of `any` Type
- **Severity:** Medium
- **Location:** `server/middleware.ts` (line 8: `req: any, res: any, next: any`), `server/db.ts` (line 80: `export let db: any`), all route handlers use `(req: any, res)`, throughout `server/routes/*.ts`
- **Description:** Nearly every Express handler uses `any` for the request object. The `db` export is typed as `any`. The mock database (`server/mock-db.ts`) is entirely untyped.
- **Impact:** No TypeScript safety on request bodies, user objects, or database operations. Refactoring is dangerous because the compiler cannot catch type errors. Runtime errors from incorrect property access are likely.
- **Recommendation:** Define Express request type extensions (e.g., `interface AuthenticatedRequest extends Request { user: JwtPayload }`). Type the `db` variable properly using Drizzle's inferred types.

### MNT-04: Debug/Test Route Left in Production Code
- **Severity:** Medium
- **Location:** `server/routes/users.ts` (lines 222-233 `temp-delete-users` route)
- **Description:** A route `/api/users/admin/temp-delete-users` exists that deletes users by hardcoded names `['Fidel', 'Elena', 'Rhea', 'Glaiza']`. This appears to be a test/debug endpoint.
- **Impact:** This endpoint is accessible to any admin user and deletes data based on hardcoded names. It serves no legitimate purpose in production.
- **Recommendation:** Remove this endpoint entirely. If user deletion is needed, use the existing `reset-data` endpoint with proper parameters.

### MNT-05: Property Enrichment Logic Duplicated Between Roles
- **Severity:** Medium
- **Location:** `server/db.ts` (lines 122-192 `getAuthorizedPropertiesByPins`), `server/routes/properties.ts` (lines 9-161)
- **Description:** The property query with owner enrichment is implemented differently for each role (taxpayer, collector, admin) in both `db.ts` and `properties.ts`. The column selection lists are nearly identical but repeated 4+ times with minor variations.
- **Impact:** Any schema change requires updating the same column list in 4+ places. The risk of missing a column in one path is high.
- **Recommendation:** Extract a shared query builder function that takes a role and returns the appropriate query with consistent column selection.

### MNT-06: Error Stack Traces Leaked in API Responses
- **Severity:** Medium
- **Location:** `server/routes/payments.ts` (lines 103-105), `server/routes/assessments.ts` (lines 107-110), `server/routes/reports.ts` (line 77)
- **Description:** Several error responses include `stack` or `details` fields with internal error information:
  ```typescript
  res.status(500).json({
    error: 'Payment failed',
    details: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined
  });
  ```
- **Impact:** Internal code paths, file locations, and variable names are exposed to clients. This aids attackers in understanding the application structure.
- **Recommendation:** Never include `stack` in API responses. Only return user-friendly error messages. Log full errors server-side only.

### MNT-07: Mock Database Falls Silently into In-Memory Mode
- **Severity:** Medium
- **Location:** `server/db.ts` (lines 343-355)
- **Description:** When all database connection retries fail, the application silently switches to a `MockDb` in-memory mode. The only indication is console output. The `dbInitStatus.mode` is set to `'mock'` but no endpoints reject requests or indicate data loss risk.
- **Impact:** Users can continue using the application, creating data that will be lost on restart. Queue numbers, payments, and other critical data could be entered and then lost. The UI only shows a small badge in the corner.
- **Recommendation:** In mock mode, either: (1) refuse write operations and return 503 errors, or (2) display a prominent full-screen warning that data will not be persisted. At minimum, add a banner that cannot be dismissed.

---

## Data Integrity Concerns

### DATA-01: Race Condition on Queue Number Assignment
- **Severity:** High
- **Location:** `server/routes/queue.ts` (lines 33-35), `server/routes/properties.ts` (lines 281-283)
- **Description:** Queue numbers are assigned by reading `MAX(queue_number)` and adding 1, without any locking or unique constraint:
  ```typescript
  const maxRows = await db.select({ maxNum: sql`MAX(${users.queueNumber})` }).from(users)
    .where(eq(users.queueDate, currentDay));
  const nextNum = (Number(maxRows[0]?.maxNum) || 0) + 1;
  ```
- **Impact:** Concurrent queue registrations can receive the same queue number. Two taxpayers could both get "RPT-005" if they register simultaneously.
- **Recommendation:** Use a database sequence, advisory lock, or `INSERT ... RETURNING` with a serial column dedicated to daily queue numbers. Add a unique constraint on `(queue_date, queue_number)`.

### DATA-02: No Input Validation on Most Endpoints
- **Severity:** High
- **Location:** All `server/routes/*.ts` files
- **Description:** Input validation is minimal throughout the API. Most endpoints trust `req.body` fields without validation. Examples:
  - `server/routes/inquiries.ts` line 46: `status` from `req.body` is directly used in an update without validating it's a valid status
  - `server/routes/messages.ts` line 37: `title`, `body`, `target_role` are not validated
  - `server/routes/payments.ts` line 11: payment amount, OR number are not validated
  - `server/routes/assessments.ts` line 48: assessment data arrays are not validated
- **Impact:** Invalid, empty, or malicious data can be inserted into the database. Zod is listed as a dependency but is not used anywhere in the server code.
- **Recommendation:** Implement Zod validation schemas for all request bodies. Apply them as middleware before route handlers. At minimum, validate types, required fields, and enumerated values.

### DATA-03: Payment Status Logic Vulnerable to Edge Cases
- **Severity:** Medium
- **Location:** `server/routes/payments.ts` (lines 86-94)
- **Description:** The payment status logic sets `newStatus = 'partial'` unless `sanitizedAmount >= parsedTaxDue`. This means a payment of 0.01 on a 10000 tax due results in "partial" status, but the property's `taxDue` field is never updated to reflect the remaining balance.
- **Impact:** The tax_due field on properties never decreases after partial payments. Taxpayers seeing their property will still see the full amount due even after making partial payments. The "partial" status provides no information about how much remains.
- **Recommendation:** Track cumulative payments and compare against tax due. Update `taxDue` to reflect remaining balance after each payment. Consider a `totalPaid` field on the property or compute it dynamically.

### DATA-04: Taxpayer Logs Can Have Multiple Open Sessions
- **Severity:** Medium
- **Location:** `server/routes/collector.ts` (lines 57-88), `server/routes/payments.ts` (lines 59-83)
- **Description:** When a collector views a taxpayer, a new `taxpayerLog` entry is created if no open log exists. However, the check only looks for logs matching the specific `userId` (collector). If a different collector views the same taxpayer, a second open log is created.
- **Impact:** Duplicate open sessions for the same taxpayer. Time-out calculations and reporting will be inaccurate.
- **Recommendation:** Check for any open log for the taxpayer (not filtered by collector userId). Use a unique constraint or upsert pattern.

---

## Technical Debt

### TD-01: No Test Coverage for Server Routes
- **Severity:** High
- **Location:** `tests/` directory contains only `soaPdf.regression.ts`
- **Description:** The only test file is for SOA PDF extraction. None of the server routes, authentication logic, payment processing, queue management, or property operations have any automated tests.
- **Impact:** Changes to any route handler could introduce regressions without detection. The complex business logic in delinquency reports and tax computation is especially vulnerable.
- **Recommendation:** Add integration tests for critical routes using a test database. Prioritize: auth, payment processing, queue management, and tax computation. Use Vitest with a test PostgreSQL instance.

### TD-02: ESM/CJS Mixed Configuration
- **Severity:** Medium
- **Location:** `ecosystem.config.cjs` (CJS format), `package.json` (type: "module"), `tsconfig.json` and `tsconfig.server.json`
- **Description:** The project is configured as ESM (`"type": "module"`) but PM2 config uses CJS (`.cjs` extension). The build output goes to `dist-server/` for the server but the dev command uses `tsx` to run TypeScript directly. There's also `test_db_connection.js` and `test_db_connection.mjs` files in the root.
- **Impact:** Confusion about module system. Import path extensions (`.js`) are required in TypeScript files for ESM but could break CJS consumers. Build and deployment can be error-prone.
- **Recommendation:** Standardize on ESM. Convert `ecosystem.config.cjs` to `ecosystem.config.js` with ESM syntax. Remove leftover test files from root.

### TD-03: Database Schema Import Order Issue
- **Severity:** Low
- **Location:** `server/schema.ts` (line 26: `import { sql } from 'drizzle-orm'` is placed after table definitions)
- **Description:** The `sql` import from `drizzle-orm` is used in the `check` constraints (e.g., line 23) but is imported on line 26, after its first usage. This works due to JavaScript hoisting of `import` statements but is unconventional and confusing.
- **Impact:** Code readability issue. Could confuse linters or future maintainers.
- **Recommendation:** Move the `import { sql } from 'drizzle-orm'` to the top of the file with other imports.

---

## Configuration & Deployment Concerns

### CFG-01: `.env` File Present in Repository Root
- **Severity:** High
- **Location:** `.env` file exists at project root (noted from directory listing)
- **Description:** An `.env` file exists in the project root. While `.gitignore` should exclude it, the file's presence alongside `.env.example` suggests it may have been committed or could be committed accidentally.
- **Impact:** If committed, database credentials, JWT secrets, and API keys would be exposed in git history.
- **Recommendation:** Verify `.env` is in `.gitignore`. Run `git log --all --full-history -- .env` to check for accidental commits. Consider using `.env.local` pattern.

### CFG-02: No Health Check for Database Connectivity
- **Severity:** Medium
- **Location:** `server/index.ts` (line 103)
- **Description:** The `/health` endpoint returns "OK" without checking database connectivity. It's a simple string response that doesn't verify any subsystem is functional.
- **Impact:** Load balancers or orchestrators relying on `/health` will consider the server healthy even when the database is unreachable and the app is operating in mock mode.
- **Recommendation:** Enhance `/health` to verify database connectivity. Return 503 if the database is in mock mode or unreachable. Include subsystem status (DB, SMS) in the response.

### CFG-03: PM2 Configuration Contains Hardcoded Local Path
- **Severity:** Medium
- **Location:** `ecosystem.config.cjs` (line 6)
- **Description:** The PM2 script path is hardcoded to `c:\\Users\\manli\\Desktop\\rpt_monitor\\rpt_monitor\\node_modules\\.bin\\tsx.cmd`, which is a Windows-specific absolute path to the developer's machine.
- **Impact:** This PM2 configuration will not work on any other machine or deployment environment. It's essentially non-portable.
- **Recommendation:** Use a relative path like `node_modules/.bin/tsx` or just `tsx` (if globally available). Consider using npm scripts instead of PM2 for development.

---

## Dependency Concerns

### DEP-01: jsonwebtoken Package Has Known Vulnerabilities
- **Severity:** Medium
- **Location:** `package.json` (line 34: `"jsonwebtoken": "^9.0.3"`)
- **Description:** The `jsonwebtoken` library is in maintenance mode and has had security advisories. The npm team recommends using `jose` as a modern alternative.
- **Impact:** Future vulnerabilities may not be patched quickly. The library's API design leads to insecure patterns (e.g., synchronous verify).
- **Recommendation:** Evaluate migration to `jose` which supports modern JWT features, is actively maintained, and has better TypeScript support.

### DEP-02: Vite Listed in Both Dependencies and DevDependencies
- **Severity:** Low
- **Location:** `package.json` (lines 45 and 64: `"vite": "^6.2.0"` appears in both)
- **Description:** Vite is listed in both `dependencies` and `devDependencies`. It should only be in `devDependencies` since it's a build tool.
- **Impact:** Production deployments install Vite unnecessarily, increasing bundle size and attack surface.
- **Recommendation:** Remove Vite from `dependencies`. Keep only in `devDependencies`.

### DEP-03: bcryptjs Instead of Native bcrypt
- **Severity:** Low
- **Location:** `package.json` (line 22: `"bcryptjs": "^3.0.3"`)
- **Description:** The project uses `bcryptjs` (pure JavaScript implementation) rather than `bcrypt` (native C++ binding). While `bcryptjs` is more portable, it's significantly slower.
- **Impact:** Password hashing is slower than necessary, compounding the PERF-02 issue with `hashSync`. The async operations take roughly 3x longer than native bcrypt.
- **Recommendation:** If deployment targets support native compilation, consider switching to `bcrypt` for better performance. Otherwise, this is acceptable but should be paired with async hashing.

---

## Accessibility Concerns

### A11Y-01: No ARIA Labels on Interactive Custom Components
- **Severity:** Medium
- **Location:** `src/components/ui/PatternLock.tsx` (entire component), `src/components/ui/games/*.tsx` (game components)
- **Description:** The PatternLock component and game components use custom mouse/touch interactions without ARIA labels, keyboard navigation, or screen reader support. The pattern lock relies entirely on mouse/touch position with no keyboard alternative.
- **Impact:** Users with motor disabilities cannot use the pattern lock. Screen reader users cannot understand or interact with these components.
- **Recommendation:** Add ARIA labels to the PatternLock nodes. Implement keyboard navigation (arrow keys + enter). Consider an alternative input method for accessibility.

### A11Y-02: No Form Validation Error Announcements
- **Severity:** Low
- **Location:** `src/pages/Login.tsx`, `src/pages/Register.tsx`, `src/pages/AdminPanel.tsx`
- **Description:** Form validation errors are displayed as text but not announced to screen readers. Error messages lack `role="alert"` or `aria-live` attributes.
- **Impact:** Screen reader users won't be notified when form validation fails.
- **Recommendation:** Add `role="alert"` or `aria-live="polite"` to error message containers.

---

*Concerns audit: 2026-04-12*
