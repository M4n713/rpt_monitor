# STACK.md

## Overview
Full-stack application using Node.js (Express) backend and React frontend (Vite).

## Runtime & Languages
- **Runtime:** Node.js
- **Language:** TypeScript (`v5.8.2`) everywhere (frontend & backend).

## Backend Stack
- **Framework:** Express.js (`v4.21.2`)
- **Database:** PostgreSQL (`pg`) with raw queries or basic query builders.
- **Utils:** `bcryptjs` for hashing, `jsonwebtoken` for auth, `multer` for file uploads, `csv-parser`.

## Frontend Stack
- **Framework:** React (`v19.0.0`)
- **Build Tool:** Vite (`v6.2.0`)
- **Routing:** React Router DOM (`v7.13.1`)
- **Styling:** TailwindCSS (`v4.1.14`) and `tailwind-merge`, `clsx`.
- **UI Components:** Radix UI primitives (`@radix-ui/react-label`, `@radix-ui/react-slot`) paired with `class-variance-authority`. Shadcn UI pattern.
- **Animations:** Framer Motion (`framer-motion`, `motion`).
- **Validation:** Zod (`v4.3.6`).

## Tooling
- **Deployment/PM:** `ecosystem.config.cjs` (PM2)
- **Execution:** `tsx` for dev server execution.
- **Linting:** `tsc --noEmit`.
