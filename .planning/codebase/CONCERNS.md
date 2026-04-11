# CONCERNS.md

## Tech Debt
- Backend routes and logic seem potentially centralized in `server.ts` based on its size (140KB). Splitting into individual route modules may be necessary.
- React components and frontend structure might interleave state and UI more heavily, proper custom hook abstraction could be verified.
- Database access relies heavily on bare `pg` library. Missing a query builder or ORM might lead to redundant SQL string concatenations and harder migrations.

## Fragile Areas
- `.env` file logic.
- PM2 configuration may drop specific env constraints. Ensure environment keys check upon server start.
- Single `.ts` file representing the whole server might be difficult to navigate and maintain simultaneously by multiple developers.

## Security
- Make sure role string checking in `PrivateRoute` array exactly matches JWT parsing claims.
- Express is missing explicit security middle-wares like `helmet` inside the visible dependencies.
