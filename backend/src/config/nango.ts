import { Nango } from '@nangohq/node';
import dotenv from 'dotenv';

// Load environment variables if not already loaded
dotenv.config();

// Nango configuration
const NANGO_SECRET_KEY = process.env.NANGO_SECRET_KEY;
const NANGO_HOST = process.env.NANGO_HOST || 'https://api.nango.dev';

// Create Nango client (only if secret key is provided)
let nangoClient: Nango | null = null;

if (NANGO_SECRET_KEY) {
  try {
    nangoClient = new Nango({
      secretKey: NANGO_SECRET_KEY,
      host: NANGO_HOST,
    });
    console.log('✅ Nango client initialized');
  } catch (error) {
    console.warn('⚠️ Failed to initialize Nango client:', error);
  }
} else {
  console.warn('⚠️ NANGO_SECRET_KEY not set, Nango OAuth will be disabled');
}

export { nangoClient, NANGO_HOST };
export default nangoClient;

