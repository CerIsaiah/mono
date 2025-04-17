import express, { Request, Response, Router, NextFunction } from 'express';
import { getSupabaseClient } from '../db/dbOperations';
import { logger } from '../utils/logger';

const router: Router = express.Router();

// Sample pickup lines array (in production, these should be in the database)
const PICKUP_LINES = [
    "Are you French? Because Eiffel for you.",
    "Are you a magician? Because whenever I look at you, everyone else disappears.",
    "Do you have a map? I keep getting lost in your eyes.",
    "Are you a camera? Because every time I look at you, I smile.",
    "Is your name Google? Because you've got everything I've been searching for.",
];

const SWIPES_PER_GIFT = 10;

// Middleware to check for user email in header
const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
    const userEmail = req.headers['x-user-email'] as string;
    if (!userEmail) {
        logger.warn('Missing x-user-email header', { path: req.path });
        return res.status(401).json({ error: 'Unauthorized: User email required' });
    }
    // Attach email to request object for handlers to use
    (req as any).userEmail = userEmail.trim().toLowerCase(); 
    next();
};

// POST /api/increment-copy-count
router.post('/increment-copy-count', authenticateUser, async (req: Request, res: Response) => {
    const userEmail = (req as any).userEmail;
    const supabase = getSupabaseClient();

    try {
        const { data: newCount, error: rpcError } = await supabase.rpc('increment_user_copy_count', { user_email: userEmail });

        if (rpcError) {
            logger.error('RPC increment_user_copy_count failed', {
                email: userEmail,
                error: rpcError.message,
                stack: rpcError.stack
            });
            // Check if the error indicates user not found
            if (rpcError.code === 'PGRST116' || rpcError.message.includes('not found')) {
                 return res.status(404).json({ error: 'User not found' });
            }
            return res.status(500).json({ error: 'Failed to increment copy count' });
        }
        
        if (newCount === 0) {
             // This could happen if the RPC function returns 0 for a non-existent user
             logger.warn('increment_user_copy_count returned 0, potentially user not found', { email: userEmail });
             // Depending on desired behavior, you might return 404 or just the count
             // return res.status(404).json({ error: 'User not found' });
        }

        logger.info('Successfully incremented copy count', { email: userEmail, newCount });
        res.status(200).json({ success: true, newCopyCount: newCount });

    } catch (error: any) {
        logger.error('Error incrementing copy count', {
            email: userEmail,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Internal server error while incrementing count' });
    }
});

// GET /api/user-stats
router.get('/user-stats', authenticateUser, async (req: Request, res: Response) => {
    const userEmail = (req as any).userEmail;
    const supabase = getSupabaseClient();

    try {
        // Get user data including total usage
        const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('copy_count, login_timestamps, daily_usage')
            .eq('email', userEmail)
            .maybeSingle();

        if (fetchError) {
            logger.error('Error fetching user stats', {
                email: userEmail,
                error: fetchError.message,
                stack: fetchError.stack
            });
            return res.status(500).json({ error: 'Failed to fetch user data' });
        }

        if (!userData) {
            logger.warn('User not found for stats request', { email: userEmail });
            // Return default stats if user not found
            return res.status(200).json({ 
                boostedConvos: 0, 
                daysActive: 0,
                currentSwipes: 0,
                nextGiftThreshold: SWIPES_PER_GIFT,
                currentPickupLine: PICKUP_LINES[0]
            });
        }

        const boostedConvos = userData.copy_count || 0;
        const dailySwipes = userData.daily_usage || 0;

        // Calculate unique days active
        let daysActive = 0;
        if (userData.login_timestamps && Array.isArray(userData.login_timestamps)) {
            const uniqueDays = new Set<string>();
            userData.login_timestamps.forEach((timestamp: string | number | Date) => {
                try {
                    const date = new Date(timestamp);
                    if (!isNaN(date.getTime())) {
                        const year = date.getUTCFullYear();
                        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
                        const day = date.getUTCDate().toString().padStart(2, '0');
                        uniqueDays.add(`${year}-${month}-${day}`);
                    }
                } catch (parseError: any) {
                    logger.error('Error parsing timestamp', { email: userEmail, timestamp, error: parseError.message });
                }
            });
            daysActive = uniqueDays.size;
        }

        // Calculate next gift threshold and current pickup line based on daily swipes
        const nextGiftThreshold = Math.ceil(dailySwipes / SWIPES_PER_GIFT) * SWIPES_PER_GIFT;
        const pickupLineIndex = Math.floor(dailySwipes / SWIPES_PER_GIFT) % PICKUP_LINES.length;

        logger.info('Successfully fetched user stats', { 
            email: userEmail, 
            boostedConvos, 
            daysActive,
            dailySwipes,
            nextGiftThreshold,
            pickupLineIndex
        });

        res.status(200).json({ 
            boostedConvos, 
            daysActive,
            currentSwipes: dailySwipes,
            nextGiftThreshold,
            currentPickupLine: PICKUP_LINES[pickupLineIndex]
        });

    } catch (error: any) {
        logger.error('Error fetching user stats', {
            email: userEmail,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Internal server error while fetching stats' });
    }
});

export default router; 