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
    
    // Check usage limits
    const initialLimits = await checkUsageLimits(identifier, isEmail);
    if (!initialLimits.canSwipe) {
      return res.json(initialLimits);
    }
    
    // Increment usage (this also updates total_usage)
    const incrementResult = await incrementUsage(identifier, isEmail);
    
    if (incrementResult.error) {
      logger.error('Swipe increment failed after check', { 
          identifier, 
          isEmail, 
          error: incrementResult.error 
      });
      return res.status(500).json({ 
          ...initialLimits, 
          error: `Swipe count failed: ${incrementResult.error}` 
      }); 
    }

    const finalResponse = {
        ...initialLimits,
        dailySwipes: incrementResult.dailySwipes,
        canSwipe: initialLimits.isPremium || initialLimits.isTrial || incrementResult.dailySwipes < (isEmail ? FREE_USER_DAILY_LIMIT : ANONYMOUS_USAGE_LIMIT),
        requiresUpgrade: isEmail && !initialLimits.isPremium && !initialLimits.isTrial && incrementResult.dailySwipes >= FREE_USER_DAILY_LIMIT,
        requiresSignIn: !isEmail && incrementResult.dailySwipes >= ANONYMOUS_USAGE_LIMIT
    };
    
    res.json(finalResponse);

  } catch (error: any) {
    logger.error('Error in POST /api/swipes:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router; 