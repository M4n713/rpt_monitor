# TESTING.md

## Framework
- Custom/Node-based test scripts execution. Evidence is located in `/tests` running via `node --experimental-strip-types tests/soaPdf.regression.ts`.

## Structure
- Dedicated `/tests` directory holds test scripts.
- Looks like manual integration/regression scripts instead of using Jest/Vitest directly at this level.

## Test Coverage
- Not explicitly mapped to a coverage reporter inside `package.json`.
- Testing focuses mainly on regression scenarios (e.g., PDF logic).
