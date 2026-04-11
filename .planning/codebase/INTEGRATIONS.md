# INTEGRATIONS.md

## Database
- **PostgreSQL**: Primary data store. Connected via `pg`. Handled manually or via a basic query approach.

## External APIs & Services
- **Google GenAI API**: Included (`@google/genai`) for specific intelligence aspects.

## File & Data Importers
- **Multer**: Used for `multipart/form-data` uploads (e.g., CSV).
- **CSV-Parser**: Parses uploaded CSV files for bulk data operations.
- **PDF Generation/Reading**: `pdfjs-dist` is present in dependencies.

## Authentication
- **JWT (JSON Web Tokens)**: Used for stateless API authentication.
- **Bcrypt**: Password hashing.
