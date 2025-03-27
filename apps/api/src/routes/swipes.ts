import { Router, Request, Response } from 'express';
import { checkUsageLimits, incrementUsage } from '../db/dbOperations';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const requestIP = req.ip || 'unknown';
    const userEmail = req.headers['x-user-email'] as string;
    
    // Check if we have a valid email, otherwise use IP
    const identifier = userEmail || requestIP;
    const isEmail = Boolean(userEmail && userEmail.includes('@'));
    
    const limitCheck = await checkUsageLimits(identifier, isEmail);
    res.json(limitCheck);
  } catch (error: any) {
    console.error('Error in GET /api/swipes:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const requestIP = req.ip || 'unknown';
    const userEmail = req.headers['x-user-email'] as string;
    const { direction } = req.body;
    
    // Check if we have a valid email, otherwise use IP
    const identifier = userEmail || requestIP;
    const isEmail = Boolean(userEmail && userEmail.includes('@'));
    
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