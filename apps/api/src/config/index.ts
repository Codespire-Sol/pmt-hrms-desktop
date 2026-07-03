import dotenv from 'dotenv';
import path from 'node:path';

// Load environment variables
dotenv.config();

// Prisma + the pg driver adapter need a single DATABASE_URL connection
// string. Locally it comes straight from .env. In Kubernetes the deploy
// chart injects DATABASE_HOST/PORT/NAME as plain env and DATABASE_USER/
// DATABASE_PASSWORD from a Secret — split creds can't form a URL on their
// own — so compose DATABASE_URL from the parts when it isn't already set.
// Done before `config` is built so every downstream reader (prisma.ts,
// launch-checklist, backup.service, `prisma migrate`) sees a value.
if (!process.env.DATABASE_URL) {
  const host = process.env.DATABASE_HOST || 'localhost';
  const port = process.env.DATABASE_PORT || '5432';
  const name = process.env.DATABASE_NAME || 'projectflow';
  const user = encodeURIComponent(process.env.DATABASE_USER || 'postgres');
  const password = encodeURIComponent(process.env.DATABASE_PASSWORD || 'postgres');
  const sslmode = process.env.DATABASE_SSL === 'true' ? '?sslmode=require' : '';
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${name}${sslmode}`;
}

export const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiVersion: process.env.API_VERSION || 'v1',

  // Database
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    name: process.env.DATABASE_NAME || 'projectflow',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    ssl: process.env.DATABASE_SSL === 'true',
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '15', 10),
    poolIdleTimeout: parseInt(process.env.DATABASE_POOL_IDLE_TIMEOUT || '30000', 10),
    connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '5000', 10),
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4',
    sandboxMode: process.env.OPENAI_SANDBOX_MODE === 'true',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1024', 10),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  },

  // Google Cloud Storage
  gcs: {
    bucketName: process.env.GCS_BUCKET_NAME || 'projectflow-attachments',
    projectId: process.env.GCS_PROJECT_ID || '',
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  },

  // Email (SMTP)
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      password: process.env.SMTP_PASSWORD || '',
    },
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.FROM_EMAIL || 'noreply@projectflow.ai',
    fromName: process.env.SMTP_FROM_NAME || process.env.FROM_NAME || 'PMT Tool',
  },

  // Frontend
  frontend: {
    // PMT app URL - port 3001 locally (used for auth-related email links, OAuth redirects, etc.)
    url: (process.env.FRONTEND_URL || 'http://localhost:3001').trim(),
    // HRMS app URL - port 3000 locally (used for employee onboarding email links)
    hrmsUrl: (process.env.HRMS_FRONTEND_URL || 'http://localhost:3000').trim(),
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(',').map(s => s.trim()).filter(Boolean),
  },

  // Authentication mode
  // 'keycloak' (default) — users authenticate via Keycloak (SSO); the API
  //                        validates Keycloak JWTs against the realm JWKS.
  // 'jwt'                — self-contained email/password login; the API issues
  //                        and validates its own JWTs. No Keycloak required.
  // Lets a self-hoster pick based on requirement without code changes.
  auth: {
    mode: (process.env.AUTH_MODE || 'keycloak').toLowerCase() === 'jwt' ? 'jwt' : 'keycloak',
    // Default admin seeded only in 'jwt' mode (so there is something to log in with).
    adminEmail: (process.env.ADMIN_EMAIL || 'admin@projectflow.ai').toLowerCase(),
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
    // Account lockout after this many consecutive failed logins (jwt mode).
    maxFailedLogins: parseInt(process.env.AUTH_MAX_FAILED_LOGINS || '5', 10),
    lockoutMinutes: parseInt(process.env.AUTH_LOCKOUT_MINUTES || '15', 10),
  },

  // Host-only admin lifecycle token. When set (only the Electron main process
  // knows it), it gates the /auth/local/* endpoints so LAN browsers can't call
  // them. Empty means those endpoints reject every request (403).
  localAdminToken: process.env.LOCAL_ADMIN_TOKEN || '',

  // Keycloak
  keycloak: {
    // Internal URL the API uses to reach Keycloak server-side (JWKS key fetch,
    // admin API). In Docker this is the service name (http://keycloak:8080).
    url: process.env.KEYCLOAK_URL || 'http://localhost:8080',
    // Public URL that appears as the token issuer (`iss`) — i.e. the host the
    // BROWSER used to log in. Defaults to `url` (correct when Keycloak has one
    // shared URL, e.g. production). In local Docker set KEYCLOAK_ISSUER_URL to
    // the browser-facing URL (http://localhost:8080) so issuer validation
    // matches browser-issued tokens while keys are still fetched from `url`.
    issuerUrl: process.env.KEYCLOAK_ISSUER_URL || process.env.KEYCLOAK_URL || 'http://localhost:8080',
    realm: process.env.KEYCLOAK_REALM || 'projectflow',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'projectflow-spa',
    // Admin client — used for server-side user provisioning (create/sync users)
    adminClientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'keycloak-admin-client',
    adminClientSecret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET || '',
  },

  // OAuth
  oauth: {
    google: {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:4000/api/v1/auth/oauth/google/callback',
    },
    github: {
      clientId: process.env.GITHUB_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || '',
      redirectUri: process.env.GITHUB_OAUTH_REDIRECT_URI || 'http://localhost:4000/api/v1/auth/oauth/github/callback',
    },
  },

  // Storage
  storage: {
    uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')),
    storageBaseUrl: process.env.UPLOADS_BASE_URL || '', // Empty means relative URLs
  },


  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // AI Service
  aiService: {
    url: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  },

  // GitLab Integration
  gitlab: {
    apiBaseUrl: 'https://gitlab.com/api/v4',
  },

  // Validate required config
  validate() {
    const required = ['DATABASE_HOST', 'DATABASE_NAME', 'JWT_SECRET'];
    // Keycloak vars are only required when actually using Keycloak auth.
    if (config.auth.mode === 'keycloak') {
      required.push('KEYCLOAK_URL', 'KEYCLOAK_REALM');
    }
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Reject known-insecure JWT secrets in production
    const insecureDefaults = ['change-this-secret', 'secret', 'password'];
    if (config.env === 'production') {
      if (insecureDefaults.includes(config.jwt.secret)) {
        throw new Error('JWT_SECRET is set to an insecure default. Please set a strong, unique secret for production.');
      }
      if (config.jwt.secret.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters in production.');
      }
      // Require explicit AI_SERVICE_URL in production
      if (!process.env.AI_SERVICE_URL) {
        console.warn('[config] AI_SERVICE_URL not set — AI features will connect to localhost:8000 which is likely incorrect in production.');
      }
    }

    // Warn about optional services that are not configured
    const optional: Record<string, string> = {
      OPENAI_API_KEY: 'AI features will be disabled',
      REDIS_HOST: 'Caching will be unavailable',
      SMTP_USER: 'Email sending will be disabled',
    };

    for (const [key, warning] of Object.entries(optional)) {
      if (!process.env[key]) {
        console.warn(`[config] ${key} not set — ${warning}`);
      }
    }
  },
};

// Validate config on import
if (config.env !== 'test') {
  config.validate();

}
