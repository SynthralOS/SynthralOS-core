// Vercel Serverless Function - Catch-all route handler
// This handles all API routes dynamically

import app from './index';

// Vercel serverless function handler
export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Use Express app to handle the request
  return app(req, res);
}
