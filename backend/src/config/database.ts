import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../drizzle/schema';
import dotenv from 'dotenv';

// Load environment variables if not already loaded
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Detect serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL_ENV;

// Use shared session pooler connection (works with IPv4/IPv6)
// Format: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-us-west-1.pooler.supabase.com:5432/postgres
let connectionString = process.env.DATABASE_URL;

// Convert direct connection to shared session pooler if needed
// Direct connections often fail with ENOTFOUND, so always use pooler for known Supabase projects
// For serverless, ALWAYS use pooler (avoids connection limits)
if (connectionString.includes('db.qgfutvkhhsjbjthkammv.supabase.co')) {
  // Extract password from original URL if present
  const passwordMatch = connectionString.match(/:\/\/[^:]+:([^@]+)@/);
  const password = passwordMatch ? passwordMatch[1] : 'SynthralOS';
  
  // Use pooler port (6543) for serverless, regular pooler (5432) for non-serverless
  const poolerPort = isServerless ? '6543' : '5432';
  connectionString = `postgresql://postgres.qgfutvkhhsjbjthkammv:${password}@aws-1-us-west-1.pooler.supabase.com:${poolerPort}/postgres${isServerless ? '?pgbouncer=true' : ''}`;
  
  if (isServerless) {
    console.log('✅ Using Supabase pooler (port 6543) for serverless environment');
  }
}

// Configure postgres client
// For serverless: use single connection, shorter timeouts
// For regular: use connection pooling
const client = postgres(connectionString, {
  max: isServerless ? 1 : 10, // Serverless: single connection per function
  idle_timeout: isServerless ? 20 : 20,
  connect_timeout: isServerless ? 10 : 30,
  prepare: isServerless ? false : true, // Disable prepared statements for pooler in serverless
  onnotice: () => {}, // Suppress notices
});

export const db = drizzle(client, { schema });

export * from '../../drizzle/schema';
