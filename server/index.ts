import express from 'express';
process.env.TZ = 'UTC';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import https from 'https';

import { isProduction, PORT, HOST, TAILSCALE_CERT, TAILSCALE_KEY, TAILSCALE_HOST } from './config.js';
import { initDb, getPoolConfig, dbInitStatus, mockStore } from './db.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import propertyRoutes from './routes/properties.js';
import paymentRoutes from './routes/payments.js';
import assessmentRoutes from './routes/assessments.js';
import queueRoutes from './routes/queue.js';
import uploadRoutes from './routes/uploads.js';
import collectorRoutes from './routes/collector.js';
import messageRoutes from './routes/messages.js';
import barangayRoutes from './routes/barangays.js';
import computationTypeRoutes from './routes/computationTypes.js';
import logRoutes from './routes/logs.js';
import inquiryRoutes from './routes/inquiries.js';
import reportRoutes from './routes/reports.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REQUIRED_PROD_ENV_VARS = ['JWT_SECRET', 'DB_HOST', 'DB_PASSWORD', 'DB_NAME'];

function validateEnvironment() {
  if (!isProduction) return;

  const missing = REQUIRED_PROD_ENV_VARS.filter(key => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`[FATAL] Missing required environment variables in production: ${missing.join(', ')}`);
    console.error('[FATAL] Server cannot start safely. Set these in .env or PM2 environment.');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    console.error('[FATAL] No database connection configured. Set DATABASE_URL or DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME.');
    process.exit(1);
  }
}

validateEnvironment();

const poolConfig = getPoolConfig();
const hostInfo = poolConfig.connectionString ? 'URL from environment' : `${poolConfig.host}:${poolConfig.port}`;
console.log(`[DB] Attempting to connect to database at: ${hostInfo}`);
console.log(`[DB] User: ${poolConfig.user || 'N/A'}`);
console.log(`[DB] Database: ${poolConfig.database || 'N/A'}`);

async function startServer() {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", ...(TAILSCALE_HOST ? [`https://${TAILSCALE_HOST}`] : [])],
      },
    } : false,
    crossOriginEmbedderPolicy: false,
  }));

  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Host: ${req.get('host')} - From: ${req.ip}`);
    next();
  });

  app.use(express.json());
  app.use(cookieParser());

  const envOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
  const allowedOrigins = [
    'https://ais-dev-r3ui3klxefzvgtuyiay6wk-345072871581.asia-southeast1.run.app',
    'http://localhost:3000',
    `https://localhost:${PORT}`,
    'http://100.65.168.30:3000',
    `https://100.65.168.30:${PORT}`,
    ...(TAILSCALE_HOST ? [`https://${TAILSCALE_HOST}`, `https://${TAILSCALE_HOST}:${PORT}`] : []),
    ...envOrigins
  ];
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.ts.net')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }));

  app.get('/health', (req, res) => res.send('OK'));
  app.get('/favicon.ico', (req, res) => res.status(204).end());

  app.use('/api', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/properties', propertyRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/assessments', assessmentRoutes);
  app.use('/api/queue', queueRoutes);
  app.use('/api', uploadRoutes);
  app.use('/api/collector', collectorRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/barangays', barangayRoutes);
  app.use('/api', computationTypeRoutes);
  app.use('/api', logRoutes);
  app.use('/api', inquiryRoutes);
  app.use('/api', reportRoutes);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, '..', 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
    });
  }

  let useTLS = false;
  try {
    const certFile = fs.readFileSync(TAILSCALE_CERT);
    const keyFile  = fs.readFileSync(TAILSCALE_KEY);
    const httpsServer = https.createServer({ cert: certFile, key: keyFile }, app);
    httpsServer.listen(PORT, HOST, () => {
      console.log(`[Server] Running on https://${HOST}:${PORT} (TLS enabled via Tailscale cert)`);
      if (TAILSCALE_HOST) console.log(`[Server] Accessible at https://${TAILSCALE_HOST}:${PORT}`);
      console.log(`[DB] Using Host: ${poolConfig.host || 'localhost'}`);
      console.log(`[DB] Using Port: ${poolConfig.port || '5433'}`);
      console.log(`[DB] Using SSL: ${process.env.DB_SSL === 'true'}`);
    });
    useTLS = true;
  } catch (tlsErr: any) {
    console.warn(`[Server] Could not load TLS cert/key: ${tlsErr.message}`);
    console.warn(`[Server] Falling back to plain HTTP. To enable HTTPS run: tailscale cert <hostname>`);
    app.listen(PORT, HOST, () => {
      console.log(`[Server] Running on http://${HOST}:${PORT} (no TLS — cert not found)`);
      console.log(`[DB] Using Host: ${poolConfig.host || 'localhost'}`);
      console.log(`[DB] Using Port: ${poolConfig.port || '5433'}`);
      console.log(`[DB] Using SSL: ${process.env.DB_SSL === 'true'}`);
    });
  }
  if (!useTLS) {
    console.log('[Server] TIP: Set TAILSCALE_CERT, TAILSCALE_KEY, and TAILSCALE_HOST env vars to enable HTTPS.');
  }
}

initDb(3).then(startServer);
