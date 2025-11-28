// Database configuration for serverless environments (Vercel)
// Uses connection pooling for better performance

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../drizzle/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

let connectionString = process.env.DATABASE_URL;

// Convert direct connection to pooler for serverless (Supabase)
// Serverless functions benefit from connection pooling
if (connectionString.includes('supabase.co')) {
  // Use Supabase pooler for serverless
  // Format: postgresql://user:password@host:6543/database (pooler port)
  // Or: postgresql://user:password@host.pooler.supabase.com:6543/database
  
  // Extract connection details
  const urlMatch = connectionString.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  
  if (urlMatch) {
    const [, user, password, host, port, database] = urlMatch;
    
    // Convert to pooler URL
    if (host.includes('db.') && !host.includes('pooler')) {
      // Extract project ref from host (e.g., db.xxxxx.supabase.co -> xxxxx)
      const projectRef = host.match(/db\.([^.]+)\.supabase\.co/)?.[1];
      
      if (projectRef) {
        connectionString = `postgresql://${user}:${password}@aws-0-us-west-1.pooler.supabase.com:6543/${database}?pgbouncer=true`;
      }
    }
  }
}

// Create connection with pooling settings for serverless
const client = postgres(connectionString, {
  max: 1, // Serverless: use single connection per function
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false, // Disable prepared statements for pooler compatibility
});

export const db = drizzle(client, { schema });

// Export client for direct access if needed
export { client };

