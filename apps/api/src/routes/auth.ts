import express, { Request, Response, Router, RequestHandler } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { findOrCreateUser, getIPUsage } from '@packages/db/dbOperations';
import { GoogleAuthPayload, GoogleAuthResponse } from '../types/auth';

const router: Router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Type for request with IP
interface RequestWithIP extends Request {
  ip: string;
}

// Get Google Client ID
const getGoogleClientId: RequestHandler = (req: Request, res: Response) => {
  console.log('Received request for Google Client ID:', {
    timestamp: new Date().toISOString(),
    headers: req.headers,
    ip: req.ip
  });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  
  console.log('Debug - Google Client ID Check:', {
    exists: !!clientId,
    timestamp: new Date().toISOString(),
    envVars: Object.keys(process.env).filter(key => key.includes('GOOGLE'))
  });

  if (!clientId) {
    console.error('Google Client ID missing:', {
      timestamp: new Date().toISOString(),
      envVars: Object.keys(process.env).filter(key => key.includes('GOOGLE'))
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
    const ticket = await client.verifyIdToken({
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