# CONVENTIONS.md

## Code Style
- Written primarily in TypeScript.
- Strong typing usage in both Express and React.
- Prettier/ESLint typically expected but checking `.eslintrc` is deferred (relying on `tsc` for validation).
- Tailwind classes managed through Radix UI and Shadcn patterns (`clsx`, `twMerge` utility).

## Naming Conventions
- React context providers are placed in `/components/ui/context`.
- Custom Hooks use `use*` prefix.
- API endpoints follow RESTful patterns.

## Error Handling
- React: Context `isLoading` states for suspending view before auth resolves. Redirects users effectively on unauthorized access.
- Express backend: Uses try-catch blocks and returns appropriate HTTP status codes.

## Patterns
- **Role-based Authentication:** App utilizes a `PrivateRoute` component to wrap protected paths with role verification (`roles={['taxpayer']}`).
- **Environment variables:** Configured through `dotenv` and loaded early. `cross-env` used in `package.json` scripts for cross-platform env injection.
