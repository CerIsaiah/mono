import express, { Request, Response, Router, RequestHandler } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { findOrCreateUser, getIPUsage } from '../db/dbOperations';
import { GoogleAuthPayload, GoogleAuthResponse } from '../types/auth';
import path from 'path';

const router: Router = express.Router();

// Initialize OAuth client with validation
function initializeOAuthClient(): OAuth2Client | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  
  if (!clientId) {
    // Try to load from .env file directly as fallback
    try {
      require('dotenv').config({ 
        path: path.resolve(__dirname, '../../.env') 
      });
    } catch (error) {
      console.error('Failed to load .env file:', error);
    }
  }

  // Final check for client ID
  const finalClientId = process.env.GOOGLE_CLIENT_ID;
  if (!finalClientId) {
    console.error('Google Client ID is missing. Authentication will fail.');
    return null;
  }

  return new OAuth2Client(finalClientId);
}

let oauthClient: OAuth2Client | null = initializeOAuthClient();

// Type for request with IP
interface RequestWithIP extends Request {
  ip: string;
}

// Get Google Client ID with enhanced error handling
const getGoogleClientId: RequestHandler = (req: Request, res: Response) => {
  console.log('Received request for Google Client ID:', {
    timestamp: new Date().toISOString(),
    headers: req.headers,
    ip: req.ip,
    nodeEnv: process.env.NODE_ENV
  });

  // Try to reinitialize client if not available
  if (!oauthClient) {
    oauthClient = initializeOAuthClient();
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  
  console.log('Debug - Google Client ID Check:', {
    exists: !!clientId,
    timestamp: new Date().toISOString(),
    envVars: Object.keys(process.env).filter(key => key.includes('GOOGLE')),
    envPath: path.resolve(__dirname, '../../.env')
  });

  if (!clientId || !oauthClient) {
    console.error('Google Client ID missing:', {
      timestamp: new Date().toISOString(),
      envVars: Object.keys(process.env).filter(key => key.includes('GOOGLE')),
      searchPaths: [
        path.resolve(__dirname, '../../.env'),
        path.resolve(process.cwd(), '.env')
      ]
    });
    return res.status(500).json({ 
      error: 'Google Client ID not configured',
      envVars: Object.keys(process.env).filter(key => key.includes('GOOGLE'))
    });
  }
  
  console.log('Successfully returning Google Client ID');
  return res.json({ clientId });
};

// Handle Google Authentication
const handleGoogleAuth: RequestHandler<any, any, any, any, { ip: string }> = async (req, res) => {
  if (!oauthClient) {
    return res.status(500).json({ error: 'OAuth client not initialized' });
  }

  console.log('Received Google auth request:', {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    hasCredential: !!req.body.credential
  });

  try {
    const { credential } = req.body;
    const requestIP = req.ip;

    if (!requestIP) {
      console.error('Missing IP address in request');
      return res.status(400).json({ error: 'IP address not found in request' });
    }

    // Verify the Google token
    console.log('Verifying Google token...');
    const ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload() as GoogleAuthPayload;
    const { email, name, picture } = payload;

    console.log('Token verified successfully:', {
      email,
      hasName: !!name,
      hasPicture: !!picture,
      timestamp: new Date().toISOString()
    });

    // Get anonymous usage first
    console.log('Fetching IP usage...');
    const ipUsage = await getIPUsage(requestIP);
    const anonymousSwipes = ipUsage.daily_usage;

    // Get or create user using centralized function
    console.log('Finding or creating user...');
    const user = await findOrCreateUser(
      email,
      name || null,
      picture || null,
      anonymousSwipes
    );
    
    // Check if user is premium or in trial period
    const isPremium = user.subscription_status === 'active';
    const isTrialActive = Boolean(user.is_trial && 
      user.trial_end_date && 
      new Date(user.trial_end_date) > new Date());
    
    console.log('User status:', {
      email: user.email,
      isPremium,
      isTrialActive,
      timestamp: new Date().toISOString()
    });

    const response: GoogleAuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        avatar_url: user.picture || undefined,
      },
      dailySwipes: user.daily_usage,
      totalSwipes: user.total_usage,
      isPremium,
      isTrial: isTrialActive,
      ...(isTrialActive && user.trial_end_date && {
        trialEndsAt: new Date(user.trial_end_date)
      })
    };

    console.log('Sending successful auth response');
    return res.json(response);

  } catch (error) {
    console.error('Google auth error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    return res.status(401).json({ 
      error: 'Authentication failed: ' + (error as Error).message 
    });
  }
};

router.get('/google-client-id', getGoogleClientId);
router.post('/google', handleGoogleAuth);

export default router;