import { Router } from 'express';
import crypto from 'crypto';
import { authenticate, AuthRequest } from '../middleware/auth';
import { setOrganization } from '../middleware/organization';
import { auditLogMiddleware } from '../middleware/auditLog';
import { oauthTokenStorage } from '../services/oauthTokenStorage';
import axios from 'axios';

const router = Router();

// Apply authentication and audit logging
router.use(authenticate);
router.use(setOrganization);
router.use(auditLogMiddleware);

/**
 * Initiate Gmail OAuth flow
 * GET /api/v1/email-oauth/gmail/authorize
 */
router.get('/gmail/authorize', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const clientId = process.env.GMAIL_CLIENT_ID;
    const redirectUri = process.env.GMAIL_REDIRECT_URI || `${process.env.API_URL || 'http://localhost:4000'}/api/v1/email-oauth/gmail/callback`;
    const scope = 'https://www.googleapis.com/auth/gmail.readonly';

    if (!clientId) {
      res.status(500).json({ error: 'Gmail OAuth not configured. Set GMAIL_CLIENT_ID environment variable.' });
      return;
    }

    // Generate a secure state token (just for OAuth flow, not for storing credentials)
    const state = crypto.randomBytes(16).toString('hex');
    const stateData = Buffer.from(JSON.stringify({ userId: req.user.id, organizationId: req.organizationId })).toString('base64');
    
    // Store state data temporarily (will be used in callback)
    oauthTokenStorage.store({ state: stateData }, '', req.user.id, req.organizationId);
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${state}`;

    res.json({ authUrl, state });
  } catch (error) {
    console.error('Error initiating Gmail OAuth:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Gmail OAuth callback
 * GET /api/v1/email-oauth/gmail/callback
 */
router.get('/gmail/callback', async (req: AuthRequest, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?error=missing_parameters`);
    }

    // Retrieve state data from secure storage
    const storedState = oauthTokenStorage.retrieve(state as string);
    if (!storedState) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?error=invalid_or_expired_state`);
    }

    const stateData = JSON.parse(Buffer.from(storedState.credentials.state as string, 'base64').toString());
    const { userId, organizationId } = stateData;

    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI || `${process.env.API_URL || 'http://localhost:4000'}/api/v1/email-oauth/gmail/callback`;

    if (!clientId || !clientSecret) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?error=oauth_not_configured`);
    }

    // Exchange code for tokens
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const { access_token, refresh_token } = tokenResponse.data;

    // Get user's email address
    const profileResponse = await axios.get('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const email = profileResponse.data.emailAddress;

    // Store credentials securely and generate a one-time token
    const credentials = {
      accessToken: access_token,
      refreshToken: refresh_token,
    };

    const secureToken = oauthTokenStorage.store(credentials, email, userId, organizationId);

    // Redirect to frontend with secure token (not credentials)
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?gmail_oauth_success=true&token=${secureToken}`);
  } catch (error: any) {
    console.error('Error in Gmail OAuth callback:', error);
    const errorMessage = error.response?.data?.error || error.message || 'oauth_error';
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?error=${encodeURIComponent(errorMessage)}`);
  }
});

/**
 * Retrieve OAuth credentials using secure token
 * GET /api/v1/email-oauth/retrieve/:token
 */
router.get('/retrieve/:token', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { token } = req.params;
    const stored = oauthTokenStorage.retrieve(token);

    if (!stored) {
      res.status(404).json({ error: 'Token not found or expired' });
      return;
    }

    // Verify user matches
    if (stored.userId !== req.user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Return credentials and email (token is one-time use, already deleted)
    res.json({
      credentials: stored.credentials,
      email: stored.email,
    });
  } catch (error) {
    console.error('Error retrieving OAuth credentials:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Initiate Outlook OAuth flow
 * GET /api/v1/email-oauth/outlook/authorize
 */
router.get('/outlook/authorize', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const redirectUri = process.env.OUTLOOK_REDIRECT_URI || `${process.env.API_URL || 'http://localhost:4000'}/api/v1/email-oauth/outlook/callback`;
    const scope = 'https://graph.microsoft.com/Mail.Read offline_access';

    if (!clientId) {
      res.status(500).json({ error: 'Outlook OAuth not configured. Set OUTLOOK_CLIENT_ID environment variable.' });
      return;
    }

    // Generate a secure state token
    const state = crypto.randomBytes(16).toString('hex');
    const stateData = Buffer.from(JSON.stringify({ userId: req.user.id, organizationId: req.organizationId })).toString('base64');
    
    // Store state data temporarily
    oauthTokenStorage.store({ state: stateData }, '', req.user.id, req.organizationId);
    
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${encodeURIComponent(scope)}&state=${state}`;

    res.json({ authUrl, state });
  } catch (error) {
    console.error('Error initiating Outlook OAuth:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Outlook OAuth callback
 * GET /api/v1/email-oauth/outlook/callback
 */
router.get('/outlook/callback', async (req: AuthRequest, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?error=missing_parameters`);
    }

    // Retrieve state data from secure storage
    const storedState = oauthTokenStorage.retrieve(state as string);
    if (!storedState) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?error=invalid_or_expired_state`);
    }

    const stateData = JSON.parse(Buffer.from(storedState.credentials.state as string, 'base64').toString());
    const { userId, organizationId } = stateData;

    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
    const redirectUri = process.env.OUTLOOK_REDIRECT_URI || `${process.env.API_URL || 'http://localhost:4000'}/api/v1/email-oauth/outlook/callback`;

    if (!clientId || !clientSecret) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?error=oauth_not_configured`);
    }

    // Exchange code for tokens
    const tokenResponse = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', new URLSearchParams({
      code: code as string,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, refresh_token } = tokenResponse.data;

    // Get user's email address
    const profileResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const email = profileResponse.data.mail || profileResponse.data.userPrincipalName;

    // Store credentials securely and generate a one-time token
    const credentials = {
      accessToken: access_token,
      refreshToken: refresh_token,
    };

    const secureToken = oauthTokenStorage.store(credentials, email, userId, organizationId);

    // Redirect to frontend with secure token (not credentials)
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?outlook_oauth_success=true&token=${secureToken}`);
  } catch (error: any) {
    console.error('Error in Outlook OAuth callback:', error);
    const errorMessage = error.response?.data?.error || error.message || 'oauth_error';
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?error=${encodeURIComponent(errorMessage)}`);
  }
});

export default router;
