# ARCHITECTURE.md

## Architecture Pattern
Client-Server application. Single-page application (SPA) on the frontend communicating with a RESTful Express node backend.

## Layers & Components
- **Frontend Layer:** React with Vite. Pages based component structure mapping to routes (`/login`, `/dashboard`, `/collector`, `/admin`, `/queue`). Authentication context manages state (`AuthProvider`).
- **Routing Layer:** `react-router-dom` handles views per role (Taxpayer, Collector, Admin). `PrivateRoute` wrapper performs role-based authorization.
- **API/Server Layer:** Express application `server.ts` handles REST endpoints, middleware, and request validation. `cookie-parser` and `cors` active.
- **Data Layer:** PostgreSQL access with `pg`. 

## Data Flow
1. User interacts with React views (`src/pages/*`).
2. SPA requests backend APIs using relative routes/Fetch calls.
3. Express matches routes in `server.ts` (or separated routers) using JWT token in cookies/headers.
4. Business logic executes and fetches/writes to PostgreSQL database.
5. JSON responses returned.

## Entry Points
- Frontend: `src/main.tsx` into `src/App.tsx`.
- Backend: `server.ts` or `dist-server/server.js` when built.
