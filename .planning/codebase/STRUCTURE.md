# STRUCTURE.md

## Root Directory
- `/src`: Frontend React app source code.
- `/tests`: Integration/regression tests (e.g., `soaPdf.regression.ts`).
- `/scripts`: Utility scripts.
- `/public`: Static assets.
- `/dist`, `/dist-server`: Build outputs.
- `package.json`, `vite.config.ts`, `tsconfig.json`: Project configuration.
- `server.ts`, `server.js`: Backend entry points.

## Inside `/src`
- `/pages`: Top-level route components (`Login.tsx`, `Dashboard.tsx`, `CollectorPanel.tsx`, `AdminPanel.tsx`, `QueueSystem.tsx`).
- `/components`: Reusable UI elements, likely split into UI components (Shadcn pattern under `/components/ui`) and complex components.
  - `/components/ui/context`: Stores context providers like `AuthContext.tsx` and `ConnectionStatus.tsx`.
- `/hooks`: Custom React hooks.
- `/lib`: Helper/utility functions (e.g., Tailwind class merger `utils.ts`).
- `main.tsx`: React rendering entry.
- `index.css`: Global styles including Tailwind imports.

## Naming Conventions
- React components use PascalCase (`App.tsx`, `Dashboard.tsx`).
- Utility hooks and functions use camelCase (`useAuth`).
- Backend routes/services tend to be within `server.ts` or relative module files using kebab-case or camelCase.
