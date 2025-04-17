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
        const totalAvailableGifts = Math.floor(dailySwipes / SWIPES_PER_GIFT);
        const completedGifts = seenPickupLines.length;

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
        
        // Only fetch a new pickup line if there are unclaimed gifts
        let currentLineText = null;
        let hasSeenCurrentGift = false;

        if (totalAvailableGifts > completedGifts) {
            // Get all pickup lines from the database
            let query = supabase
                .from('pickup_lines')
                .select('id, line')
                .eq('is_active', true);
                
            // Only add the not-in condition if there are seen pickup lines
            if (seenPickupLines.length > 0) {
                query = query.not('id', 'in', `(${seenPickupLines.join(',')})`);
            }
            
            const { data: availableLines, error: linesError } = await query;

            if (linesError) {
                logger.error('Error fetching pickup lines', {
                    email: userEmail,
                    error: linesError.message,
                    stack: linesError.stack
                });
            } else if (availableLines && availableLines.length > 0) {
                // Select a random pickup line
                const selectedLine = availableLines[Math.floor(Math.random() * availableLines.length)];
                currentLineText = selectedLine.line;
                
                // Update seen pickup lines
                const updatedSeenLines = [...seenPickupLines, selectedLine.id];
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ seen_pickup_lines: updatedSeenLines })
                    .eq('email', userEmail);

                if (updateError) {
                    logger.error('Error updating seen pickup lines', {
                        email: userEmail,
                        lineId: selectedLine.id,
                        error: updateError.message,
                        stack: updateError.stack
                    });
                }
            } else {
                // If no lines available, create a default one
                currentLineText = "You're looking smooth today! 😎";
            }
        }

        logger.info('Successfully fetched user stats', { 
            email: userEmail, 
            boostedConvos, 
            daysActive,
            dailySwipes,
            nextGiftThreshold,
            hasSeenCurrentGift,
            completedGifts,
            totalAvailableGifts,
            hasPickupLine: !!currentLineText
        });

        res.status(200).json({ 
            boostedConvos, 
            daysActive,
            currentSwipes: dailySwipes,
            nextGiftThreshold,
            currentPickupLine: currentLineText,
            hasSeenCurrentGift,
            completedGifts,
            totalAvailableGifts
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

// POST /api/get-next-pickup-line
router.post('/get-next-pickup-line', authenticateUser, async (req: Request, res: Response) => {
    const userEmail = (req as any).userEmail;
    const supabase = getSupabaseClient();

    try {
        // Get user data including seen pickup lines
        const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('daily_usage, seen_pickup_lines')
            .eq('email', userEmail)
            .single();

        if (fetchError) {
            logger.error('Error fetching user data for pickup line', {
                email: userEmail,
                error: fetchError.message
            });
            return res.status(500).json({ error: 'Failed to fetch user data' });
        }

        if (!userData) {
            logger.warn('User not found for pickup line request', { email: userEmail });
            return res.status(404).json({ error: 'User not found' });
        }

        const seenPickupLines = userData.seen_pickup_lines || [];
        const totalAvailableGifts = Math.floor(userData.daily_usage / SWIPES_PER_GIFT);

        // Only proceed if user has unclaimed gifts
        if (seenPickupLines.length >= totalAvailableGifts) {
            logger.warn('No unclaimed gifts available', {
                email: userEmail,
                seenCount: seenPickupLines.length,
                totalAvailable: totalAvailableGifts
            });
            return res.status(400).json({ error: 'No unclaimed gifts available' });
        }

        // Get all pickup lines
        let query = supabase
            .from('pickup_lines')
            .select('id, line')
            .eq('is_active', true);
        
        // Only add the not-in condition if there are seen pickup lines
        if (seenPickupLines.length > 0) {
            query = query.not('id', 'in', `(${seenPickupLines.join(',')})`);
        }
        
        const { data: availableLines, error: linesError } = await query.order('id');

        if (linesError) {
            logger.error('Error fetching pickup lines', {
                email: userEmail,
                error: linesError.message
            });
            return res.status(500).json({ error: 'Failed to fetch pickup lines' });
        }

        if (!availableLines || availableLines.length === 0) {
            logger.error('No pickup lines available', {
                email: userEmail,
                seenCount: seenPickupLines.length
            });
            return res.status(500).json({ error: 'No pickup lines available' });
        }

        // Select a random pickup line from available ones
        const selectedLine = availableLines[Math.floor(Math.random() * availableLines.length)];

        // Add this line to user's seen pickup lines
        const updatedSeenLines = [...seenPickupLines, selectedLine.id];
        const { error: updateError } = await supabase
            .from('users')
            .update({ seen_pickup_lines: updatedSeenLines })
            .eq('email', userEmail);

        if (updateError) {
            logger.error('Error updating seen pickup lines', {
                email: userEmail,
                error: updateError.message
            });
            return res.status(500).json({ error: 'Failed to update seen pickup lines' });
        }

        logger.info('Successfully provided new pickup line', {
            email: userEmail,
            lineId: selectedLine.id,
            seenCount: updatedSeenLines.length,
            totalAvailable: totalAvailableGifts
        });

        res.json({
            success: true,
            pickupLine: selectedLine.line,
            completedGifts: updatedSeenLines.length,
            totalAvailableGifts
        });

    } catch (error: any) {
        logger.error('Error getting next pickup line', {
            email: userEmail,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Internal server error while getting pickup line' });
    }
});

export default router; 