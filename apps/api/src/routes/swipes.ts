import { Router, Request, Response } from 'express';
import { checkUsageLimits, incrementUsage } from '../db/dbOperations';
import { getClientIP } from '../utils/ipUtils';
import { logger } from '../utils/logger';
import { FREE_USER_DAILY_LIMIT, ANONYMOUS_USAGE_LIMIT } from '../shared/constants';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const clientType = req.headers['x-client-type'] as string;
    const userEmail = req.headers['x-user-email'] as string;
    const requestIP = getClientIP(req);

    let identifier: string;
    let isEmail: boolean;

    if (clientType === 'mobile') {
      // Mobile client: Require valid email
      if (!userEmail || !userEmail.includes('@')) {
          return res.status(401).json({ error: 'Unauthorized: Mobile clients require a valid user email in x-user-email header.' });
      }
      identifier = userEmail;
      isEmail = true;
    } else {
      // Web client (or unknown): Use email if available, fallback to IP
      identifier = userEmail || requestIP;
      isEmail = Boolean(userEmail && userEmail.includes('@'));
      if (!identifier) { // Should only happen if IP fetch fails and no email
        return res.status(400).json({ error: 'Could not identify client.' });
      }
    }

    const limitCheck = await checkUsageLimits(identifier, isEmail);
    res.json(limitCheck);
  } catch (error: any) {
    console.error('Error in GET /api/swipes:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const clientType = req.headers['x-client-type'] as string;
    const userEmail = req.headers['x-user-email'] as string;
    const requestIP = getClientIP(req);
    // const { direction } = req.body; // Direction doesn't seem to be used here

    let identifier: string;
    let isEmail: boolean;

    if (clientType === 'mobile') {
       // Mobile client: Require valid email
      if (!userEmail || !userEmail.includes('@')) {
          return res.status(401).json({ error: 'Unauthorized: Mobile clients require a valid user email in x-user-email header.' });
      }
      identifier = userEmail;
      isEmail = true;
    } else {
      // Web client (or unknown): Use email if available, fallback to IP
      identifier = userEmail || requestIP;
      isEmail = Boolean(userEmail && userEmail.includes('@'));
       if (!identifier) { // Should only happen if IP fetch fails and no email
        return res.status(400).json({ error: 'Could not identify client.' });
      }
    }
    
    // 1. Check usage limits *once*
    const initialLimits = await checkUsageLimits(identifier, isEmail);
    if (!initialLimits.canSwipe) {
      // If they can't swipe initially, return the limits immediately
      return res.json(initialLimits);
    }
    
    // 2. If they can swipe, attempt atomic increment
    const incrementResult = await incrementUsage(identifier, isEmail);
    
    // 3. Handle increment result
    if (incrementResult.error) {
      // If increment failed (e.g., user not found error during RPC), return 500
      logger.error('Swipe increment failed after check', { 
          identifier, 
          isEmail, 
          error: incrementResult.error 
      });
      // Return the initial limits check, but add the error message
      return res.status(500).json({ 
          ...initialLimits, 
          error: `Swipe count failed: ${incrementResult.error}` 
      }); 
    }

    // 4. Construct response with initial checks and *new* swipe count
    const finalResponse = {
        ...initialLimits, // Use data from the initial check (isPremium, isTrial etc.)
        dailySwipes: incrementResult.dailySwipes, // Use the updated count from increment
        // Recalculate canSwipe based on the *new* count and initial premium/trial status
        canSwipe: initialLimits.isPremium || initialLimits.isTrial || incrementResult.dailySwipes < (isEmail ? FREE_USER_DAILY_LIMIT : ANONYMOUS_USAGE_LIMIT),
        // Optionally recalculate requiresUpgrade/requiresSignIn
        requiresUpgrade: isEmail && !initialLimits.isPremium && !initialLimits.isTrial && incrementResult.dailySwipes >= FREE_USER_DAILY_LIMIT,
        requiresSignIn: !isEmail && incrementResult.dailySwipes >= ANONYMOUS_USAGE_LIMIT
    };
    
    res.json(finalResponse);

  } catch (error: any) {
    // Catch errors from initial checkUsageLimits or unexpected errors
    logger.error('Error in POST /api/swipes:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router; 