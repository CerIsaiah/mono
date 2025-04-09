import { Router, Request, Response } from 'express';
import { checkUsageLimits, incrementUsage } from '../db/dbOperations';
import { getClientIP } from '../utils/ipUtils';

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
    const { direction } = req.body;

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
    
    // First check if they can swipe
    const limitCheck = await checkUsageLimits(identifier, isEmail);
    if (!limitCheck.canSwipe) {
      return res.json(limitCheck);
    }
    
    // If they can swipe, increment their usage
    await incrementUsage(identifier, isEmail);
    
    // Return updated limits
    const updatedLimits = await checkUsageLimits(identifier, isEmail);
    res.json(updatedLimits);
  } catch (error: any) {
    console.error('Error in POST /api/swipes:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router; 