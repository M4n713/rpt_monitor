import process from 'process';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { randomBytes } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const isProduction = process.env.NODE_ENV === 'production';

export const getJwtSecret = () => {
  const configuredSecret = process.env.JWT_SECRET?.trim();
  if (configuredSecret) return configuredSecret;
  if (isProduction) {
    throw new Error('Missing required environment variable: JWT_SECRET');
  }
  const ephemeralSecret = randomBytes(32).toString('hex');
  console.warn('[SECURITY] JWT_SECRET is not set. Using an ephemeral development secret for this process only.');
  return ephemeralSecret;
};

export const JWT_SECRET = getJwtSecret();

export const generateTemporaryPassword = () => {
  return randomBytes(9).toString('base64url');
};

export const PORT = parseInt(process.env.PORT || '3000');
export const HOST = '0.0.0.0';

export const TAILSCALE_CERT = process.env.TAILSCALE_CERT || path.join(__dirname, '..', 'server.crt');
export const TAILSCALE_KEY = process.env.TAILSCALE_KEY || path.join(__dirname, '..', 'server.key');
export const TAILSCALE_HOST = process.env.TAILSCALE_HOST || '';

export const SEMAPHORE_API_KEY = process.env.SEMAPHORE_API_KEY?.trim() || '';
export const SEMAPHORE_SENDER_NAME = process.env.SEMAPHORE_SENDER_NAME || '';

export const upload = multer({ storage: multer.memoryStorage() });
