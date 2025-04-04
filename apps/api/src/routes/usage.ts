import { Router, Request, Response } from 'express';
import { checkUsageStatus, UsageStatus } from '../db/usageTracking';
import { checkAndResetUsage } from '../db/dbOperations';
import { getClientIP } from '../utils/ipUtils';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const requestIP = getClientIP(req);
    const userEmail = req.headers['x-user-email'] as string;
    const userName = req.headers['x-user-name'] as string;
    const userPicture = req.headers['x-user-picture'] as string;
    
    // Check if we have a valid email, otherwise use IP
    const identifier = userEmail || requestIP;
    const isEmail = Boolean(userEmail && userEmail.includes('@'));
    
    // First check if we need to reset
    const wasReset = await checkAndResetUsage(identifier, isEmail);
    logger.info('Usage check reset status', { identifier, wasReset });
    
    // Then get the current usage status (which will now reflect any reset)
    const usageStatus = await checkUsageStatus(identifier, isEmail, userName, userPicture);
    
    const response: UsageStatus = {
      ...usageStatus,
      wasReset
    };
    
    res.json(response);
  } catch (error: any) {
    logger.error('Error checking usage status', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router; 