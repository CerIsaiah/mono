import express, { Request, Response, Router, RequestHandler } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { findOrCreateUser, getIPUsage, getSupabaseClient } from '../db/dbOperations';
import { GoogleAuthPayload, GoogleAuthResponse } from '../types/auth';
import { getClientIP } from '../utils/ipUtils';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

const router: Router = express.Router();

// Initialize OAuth client with validation
function initializeOAuthClient(): OAuth2Client | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  
  if (!clientId) {
    logger.error('Google Client ID is missing');
    return null;
  }

  return new OAuth2Client(clientId);
}

let oauthClient: OAuth2Client | null = initializeOAuthClient();

// Type for request with IP
interface RequestWithIP extends Request {
  ip: string;
}

// Get Google Client ID
const getGoogleClientId: RequestHandler = (req: Request, res: Response) => {
  

  // Try to reinitialize client if not available
  if (!oauthClient) {
    oauthClient = initializeOAuthClient();
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  
  console.log('Debug - Google Client ID Check:', {
    exists: !!clientId,
    timestamp: new Date().toISOString(),
    envVars: Object.keys(process.env).filter(key => key.includes('GOOGLE'))
  });

  if (!clientId || !oauthClient) {
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
  if (!oauthClient) {
    return res.status(500).json({ error: 'OAuth client not initialized' });
  }

  const clientIP = getClientIP(req);
  console.log('Received Google auth request:', {
    timestamp: new Date().toISOString(),
    ip: clientIP,
    hasCredential: !!req.body.credential
  });

  try {
    const { credential, anonymousData } = req.body;
    const requestIP = clientIP;

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

    // Get anonymous swipes from request or IP usage
    console.log('Getting anonymous swipes...');
    let anonymousSwipes = 0;
    if (anonymousData?.dailySwipes) {
      anonymousSwipes = anonymousData.dailySwipes;
    } else {
      const ipUsage = await getIPUsage(requestIP);
      anonymousSwipes = ipUsage.daily_usage;
    }

    console.log('Anonymous swipes found:', anonymousSwipes);

    // Get or create user using centralized function
    console.log('Finding or creating user...');
    const user = await findOrCreateUser(
      email,
      name || null,
      picture || null,
      anonymousSwipes
    );
    
    // ---- BEGIN LOGIN TIMESTAMP LOGGING ----
    try {
      const supabase = getSupabaseClient();
      const { error: rpcError } = await supabase.rpc('append_login_timestamp', { user_email: email });
      if (rpcError) {
        // Log the error but don't fail the login process
        logger.error('Failed to log login timestamp via RPC', {
           email: email,
           error: rpcError.message,
           stack: rpcError.stack
        });
      } else {
        logger.info('Successfully logged login timestamp', { email: email });
      }
    } catch (err: any) {
        logger.error('Exception during login timestamp logging', {
           email: email,
           error: err.message,
           stack: err.stack
        });
    }
    // ---- END LOGIN TIMESTAMP LOGGING ----

    // Update user's daily usage to include anonymous swipes
    if (anonymousSwipes > 0) {
      const supabase = getSupabaseClient();
      
      console.log('Updating user usage with anonymous swipes:', {
        currentDailyUsage: user.daily_usage,
        anonymousSwipes,
        newTotal: user.daily_usage + anonymousSwipes
      });

      // First update the user's daily usage
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          daily_usage: user.daily_usage + anonymousSwipes,
          total_usage: user.total_usage + anonymousSwipes
        })
        .eq('email', email);

      if (updateError) {
        console.error('Error updating user usage:', updateError);
        // If we failed to update the user, don't clear the IP usage
        throw new Error('Failed to update user usage');
      }
      
      // Then clear IP-based usage - do this only after successful user update
      const { error: ipError } = await supabase
        .from('ip_usage')
        .update({ daily_usage: 0 })
        .eq('ip_address', requestIP);

      if (ipError) {
        console.error('Error clearing IP usage:', ipError);
        // Log error but don't throw - we already updated the user
      }
        
      // Update the user object to reflect new usage
      user.daily_usage += anonymousSwipes;
      user.total_usage += anonymousSwipes;

      console.log('Updated user usage:', {
        email,
        newDailyUsage: user.daily_usage,
        newTotalUsage: user.total_usage,
        clearedIP: requestIP,
        anonymousSwipesTransferred: anonymousSwipes
      });
    }
    
    // Check if user is premium or in trial period
    const isPremium = user.subscription_status === 'active' && user.subscription_type === 'premium';
    const isTrialActive = Boolean(user.is_trial && 
      user.trial_end_date && 
      new Date(user.trial_end_date) > new Date());
    
    console.log('User status:', {
      email: user.email,
      isPremium,
      isTrialActive,
      subscriptionStatus: user.subscription_status,
      subscriptionType: user.subscription_type,
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
      isPremium: isPremium || isTrialActive, // Consider both premium and trial as premium
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

// Handle sign out
router.post('/signout', async (req: Request, res: Response) => {
  try {
    logger.info('User signing out');
    // Since we don't need to check the database state, just return success
    res.json({ success: true, message: 'Signed out successfully' });
  } catch (error) {
    logger.error('Error during sign out:', error);
    // Even if there's an error, return success to ensure the user can sign out
    res.json({ success: true, message: 'Signed out successfully' });
  }
});

// Verify stored session
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log('Verifying session for:', { email });

    // Get user from database
    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !user) {
      console.log('User not found or error:', { error });
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Check if user is premium or in trial period
    const isPremium = user.subscription_status === 'active' && user.subscription_type === 'premium';
    const isTrialActive = Boolean(user.is_trial && 
      user.trial_end_date && 
      new Date(user.trial_end_date) > new Date());
    
    console.log('Session verification - User status:', {
      email: user.email,
      isPremium,
      isTrialActive,
      subscriptionStatus: user.subscription_status,
      subscriptionType: user.subscription_type,
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
      isPremium: isPremium || isTrialActive,
      isTrial: isTrialActive,
      ...(isTrialActive && user.trial_end_date && {
        trialEndsAt: new Date(user.trial_end_date)
      })
    };

    console.log('Session verification successful');
    return res.json(response);

  } catch (error) {
    console.error('Session verification error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ 
      error: 'Session verification failed: ' + (error as Error).message 
    });
  }
});

// New handler for syncing Firebase user data
const handleSyncFirebaseUser: RequestHandler = async (req, res) => {
  const { email, firebaseUid, displayName } = req.body;

  logger.info('Received request to sync Firebase user', { email, firebaseUid, displayName });

  if (!email || !firebaseUid) {
    logger.warn('Missing email or firebaseUid for sync request', { body: req.body });
    return res.status(400).json({ error: 'Email and Firebase UID are required for sync' });
  }

  try {
    // Call findOrCreateUser to ensure the user exists in the database
    // We pass email, displayName (as name), null for picture (can be updated later if needed),
    // and 0 for anonymousSwipes as this isn't relevant here.
    const user = await findOrCreateUser(email, displayName || null, null, 0);

    logger.info('User synced/found successfully via sync endpoint', { email: user.email, userId: user.id });

    // Respond with success and potentially the user object (optional)
    return res.status(200).json({ message: 'User synced successfully', userId: user.id });

  } catch (error) {
    logger.error('Error syncing Firebase user:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      email,
      firebaseUid
    });
    return res.status(500).json({ 
      error: 'Failed to sync user: ' + (error instanceof Error ? error.message : 'Unknown error') 
    });
  }
};

router.get('/google-client-id', getGoogleClientId);
router.post('/google', handleGoogleAuth);
router.post('/signout', async (req: Request, res: Response) => {
  try {
    logger.info('User signing out');
    // Since we don't need to check the database state, just return success
    res.json({ success: true, message: 'Signed out successfully' });
  } catch (error) {
    logger.error('Error during sign out:', error);
    // Even if there's an error, return success to ensure the user can sign out
    res.json({ success: true, message: 'Signed out successfully' });
  }
});

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log('Verifying session for:', { email });

    // Get user from database
    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !user) {
      console.log('User not found or error:', { error });
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Check if user is premium or in trial period
    const isPremium = user.subscription_status === 'active' && user.subscription_type === 'premium';
    const isTrialActive = Boolean(user.is_trial && 
      user.trial_end_date && 
      new Date(user.trial_end_date) > new Date());
    
    console.log('Session verification - User status:', {
      email: user.email,
      isPremium,
      isTrialActive,
      subscriptionStatus: user.subscription_status,
      subscriptionType: user.subscription_type,
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
      isPremium: isPremium || isTrialActive,
      isTrial: isTrialActive,
      ...(isTrialActive && user.trial_end_date && {
        trialEndsAt: new Date(user.trial_end_date)
      })
    };

    console.log('Session verification successful');
    return res.json(response);

  } catch (error) {
    console.error('Session verification error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ 
      error: 'Session verification failed: ' + (error as Error).message 
    });
  }
});

// Add the new route
router.post('/sync-firebase-user', handleSyncFirebaseUser);

export default router;