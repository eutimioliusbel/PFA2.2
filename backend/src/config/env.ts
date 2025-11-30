import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

interface EnvConfig {
  // Server
  PORT: number;
  NODE_ENV: string;
  CORS_ORIGIN: string;

  // Database
  DATABASE_URL: string;

  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  // Encryption
  ENCRYPTION_KEY: string;

  // PEMS API (Read)
  PEMS_READ_ENDPOINT: string;
  PEMS_READ_USERNAME: string;
  PEMS_READ_PASSWORD: string;
  PEMS_READ_TENANT: string;

  // PEMS API Write Config - stored in database (api_servers + api_endpoints tables)

  // AI Providers (Optional)
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  AZURE_OPENAI_KEY?: string;
  AZURE_OPENAI_ENDPOINT?: string;

  // Redis (Optional)
  REDIS_URL?: string;

  // AWS (Optional)
  AWS_REGION?: string;

  // Logging
  LOG_LEVEL: string;
  LOG_FILE: string;

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env: EnvConfig = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',

  DATABASE_URL: getEnvVar('DATABASE_URL'),

  JWT_SECRET: getEnvVar('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',

  ENCRYPTION_KEY: getEnvVar('ENCRYPTION_KEY'),

  PEMS_READ_ENDPOINT: getEnvVar('PEMS_READ_ENDPOINT'),
  PEMS_READ_USERNAME: getEnvVar('PEMS_READ_USERNAME'),
  PEMS_READ_PASSWORD: getEnvVar('PEMS_READ_PASSWORD'),
  PEMS_READ_TENANT: getEnvVar('PEMS_READ_TENANT'),

  // NOTE: PEMS Write configuration is stored in the database (api_servers + api_endpoints tables)
  // See: backend/prisma/seed.ts for initial configuration

  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY,
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,

  REDIS_URL: process.env.REDIS_URL,

  AWS_REGION: process.env.AWS_REGION,

  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || 'logs/app.log',

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10),
};

export default env;
