import express, { Request, Response, Router, NextFunction } from 'express';
import { getSupabaseClient } from '../db/dbOperations';
import { logger } from '../utils/logger';

const router: Router = express.Router();

const SWIPES_PER_GIFT = 3;

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
            .select('copy_count, login_timestamps, daily_usage, seen_pickup_lines')
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
                currentPickupLine: null,
                hasSeenCurrentGift: false
            });
        }

        const boostedConvos = userData.copy_count || 0;
        const dailySwipes = userData.daily_usage || 0;
        const seenPickupLines = userData.seen_pickup_lines || [];

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

        // Calculate next gift threshold based on daily swipes
        const nextGiftThreshold = Math.ceil(dailySwipes / SWIPES_PER_GIFT) * SWIPES_PER_GIFT;
        const completedGifts = Math.floor(dailySwipes / SWIPES_PER_GIFT);
        
        // Get all pickup lines from the database
        const { data: allPickupLines, error: allLinesError } = await supabase
            .from('pickup_lines')
            .select('id, line, times_used')
            .eq('is_active', true)
            .order('id');
            
        if (allLinesError) {
            logger.error('Error fetching pickup lines', {
                email: userEmail,
                error: allLinesError.message,
                stack: allLinesError.stack
            });
            return res.status(500).json({ error: 'Failed to fetch pickup lines' });
        }
        
        // Select a pickup line based on completed gifts and tracking
        let currentLineId = null;
        let currentLineText = null;
        let hasSeenCurrentGift = false;
        
        if (allPickupLines && allPickupLines.length > 0 && completedGifts > 0) {
            // Calculate which pickup line to show based on completed gifts
            const lineIndex = (completedGifts - 1) % allPickupLines.length;
            const selectedLine = allPickupLines[lineIndex];
            
            if (selectedLine) {
                currentLineId = selectedLine.id;
                currentLineText = selectedLine.line;
                hasSeenCurrentGift = seenPickupLines.includes(currentLineId);
                
                // Update seen pickup lines if not already seen
                if (!hasSeenCurrentGift) {
                    // Mark this pickup line as seen by adding it to the user's seen_pickup_lines array
                    const updatedSeenLines = [...seenPickupLines, currentLineId];
                    
                    const { error: updateError } = await supabase
                        .from('users')
                        .update({ seen_pickup_lines: updatedSeenLines })
                        .eq('email', userEmail);

                    if (updateError) {
                        logger.error('Error updating seen pickup lines', {
                            email: userEmail,
                            lineId: currentLineId,
                            error: updateError.message,
                            stack: updateError.stack
                        });
                    } else {
                        // Also increment the times_used counter for this pickup line
                        const { error: incrementError } = await supabase
                            .from('pickup_lines')
                            .update({ times_used: selectedLine.times_used + 1 })
                            .eq('id', currentLineId);

                        if (incrementError) {
                            logger.error('Error incrementing pickup line usage', {
                                lineId: currentLineId,
                                error: incrementError.message,
                                stack: incrementError.stack
                            });
                        }
                    }
                }
            }
        }

        logger.info('Successfully fetched user stats', { 
            email: userEmail, 
            boostedConvos, 
            daysActive,
            dailySwipes,
            nextGiftThreshold,
            currentLineId,
            hasSeenCurrentGift
        });

        res.status(200).json({ 
            boostedConvos, 
            daysActive,
            currentSwipes: dailySwipes,
            nextGiftThreshold,
            currentPickupLine: currentLineText,
            hasSeenCurrentGift,
            completedGifts
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

// POST /api/reset-daily-swipes
router.post('/reset-daily-swipes', authenticateUser, async (req: Request, res: Response) => {
    const userEmail = (req as any).userEmail;
    const supabase = getSupabaseClient();

    try {
        // Reset the daily usage for the user
        const { error: updateError } = await supabase
            .from('users')
            .update({ daily_usage: 0 })
            .eq('email', userEmail);

        if (updateError) {
            logger.error('Error resetting daily swipes', {
                email: userEmail,
                error: updateError.message,
                stack: updateError.stack
            });
            return res.status(500).json({ error: 'Failed to reset daily swipes' });
        }

        logger.info('Successfully reset daily swipes', { email: userEmail });
        res.status(200).json({ success: true, message: 'Daily swipes reset successfully' });

    } catch (error: any) {
        logger.error('Error resetting daily swipes', {
            email: userEmail,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Internal server error while resetting swipes' });
    }
});

export default router; 