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
        // Fetch necessary user data
        const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('copy_count, login_timestamps, daily_usage, seen_pickup_lines, daily_gifts_completed') // Include new mock field
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
                earnedGiftsToday: 0, // Changed name
                dailyCompletedGifts: 0 // Changed name
                // Removed pickup line logic from here
            });
        }

        const boostedConvos = userData.copy_count || 0;
        const dailySwipes = userData.daily_usage || 0;
        const dailyCompletedGifts = userData.daily_gifts_completed || 0; // Use new field
        const earnedGiftsToday = Math.floor(dailySwipes / SWIPES_PER_GIFT);

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

        // REMOVED pickup line fetching logic from here

        logger.info('Successfully fetched user stats', {
            email: userEmail,
            boostedConvos,
            daysActive,
            dailySwipes,
            earnedGiftsToday, // Changed name
            dailyCompletedGifts // Changed name
        });

        res.status(200).json({
            boostedConvos,
            daysActive,
            currentSwipes: dailySwipes,
            earnedGiftsToday, // Changed name
            dailyCompletedGifts // Changed name
            // Removed pickup line, hasSeenCurrentGift etc.
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
        // Reset daily usage AND daily completed gifts
        const { error: updateError } = await supabase
            .from('users')
            .update({ daily_usage: 0, daily_gifts_completed: 0 }) // Reset both fields
            .eq('email', userEmail);

        if (updateError) {
            logger.error('Error resetting daily stats', {
                email: userEmail,
                error: updateError.message,
                stack: updateError.stack
            });
             return res.status(500).json({ error: 'Failed to reset daily stats' });
        }

        logger.info('Successfully reset daily swipes and completed gifts', { email: userEmail });
        res.status(200).json({ success: true, message: 'Daily stats reset successfully' });

    } catch (error: any) {
        logger.error('Error resetting daily stats', {
            email: userEmail,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Internal server error while resetting stats' });
    }
});

// POST /api/get-next-pickup-line - Refactored for Daily Logic
router.post('/get-next-pickup-line', authenticateUser, async (req: Request, res: Response) => {
    const userEmail = (req as any).userEmail;
    const supabase = getSupabaseClient();

    try {
        // Get user data: daily usage, daily completed, and lifetime seen lines
        const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('daily_usage, daily_gifts_completed, seen_pickup_lines') // Fetch required fields
            .eq('email', userEmail)
            .single(); // Use single() as user must exist to claim gift

        if (fetchError || !userData) {
            logger.error('Error fetching user data for pickup line or user not found', {
                email: userEmail,
                error: fetchError?.message
            });
            return res.status(fetchError && fetchError.code === 'PGRST116' ? 404 : 500).json({ error: 'Failed to fetch user data or user not found' });
        }

        const dailySwipes = userData.daily_usage || 0;
        const dailyGiftsCompleted = userData.daily_gifts_completed || 0;
        const seenPickupLines = userData.seen_pickup_lines || []; // Lifetime seen
        const earnedToday = Math.floor(dailySwipes / SWIPES_PER_GIFT);

        // Check if a gift is actually available based on TODAY's numbers
        if (earnedToday <= dailyGiftsCompleted) {
            logger.warn('No unclaimed gifts available for today', {
                email: userEmail,
                earnedToday,
                dailyGiftsCompleted
            });
            return res.status(400).json({ error: 'No unclaimed gifts available for today' });
        }

        // Fetch an available pickup line (not seen in lifetime)
        let query = supabase
            .from('pickup_lines')
            .select('id, line')
            .eq('is_active', true);

        if (seenPickupLines.length > 0) {
            query = query.not('id', 'in', `(${seenPickupLines.join(',')})`);
        }

        const { data: availableLines, error: linesError } = await query.order('id'); // Order for consistency if needed

        if (linesError) {
            logger.error('Error fetching pickup lines', { email: userEmail, error: linesError.message });
            return res.status(500).json({ error: 'Failed to fetch pickup lines' });
        }

        if (!availableLines || availableLines.length === 0) {
            // Handle case where user earned a gift but no new lines are left
             logger.warn('No new pickup lines available despite available gift', { email: userEmail });
             // You might want a pool of generic fallback lines here
            const fallbackLine = { id: -1, line: "You've unlocked all our lines... for now! 😉" }; // Example fallback
            
             // Still increment daily count even if showing fallback
             const newDailyCompletedCount = dailyGiftsCompleted + 1;
             const { error: fallbackUpdateError } = await supabase
                 .from('users')
                 .update({ daily_gifts_completed: newDailyCompletedCount })
                 .eq('email', userEmail);

             if (fallbackUpdateError) {
                 logger.error('Error incrementing daily gift count on fallback', { email: userEmail, error: fallbackUpdateError.message });
                 // Decide if you should still return the fallback line or error out
                 return res.status(500).json({ error: 'Failed to update daily gift count' });
             }

             logger.info('Provided fallback pickup line', { email: userEmail, newDailyCompletedCount, earnedToday });
             return res.json({
                 success: true,
                 pickupLine: fallbackLine.line,
                 dailyCompletedGifts: newDailyCompletedCount,
                 earnedGiftsToday: earnedToday
             });
        }

        // Select a random available line
        const selectedLine = availableLines[Math.floor(Math.random() * availableLines.length)];

        // Increment daily completed count and update lifetime seen lines
        const newDailyCompletedCount = dailyGiftsCompleted + 1;
        const updatedSeenLines = [...seenPickupLines, selectedLine.id]; // Add to lifetime seen

        const { error: updateError } = await supabase
            .from('users')
            .update({
                daily_gifts_completed: newDailyCompletedCount,
                seen_pickup_lines: updatedSeenLines
            })
            .eq('email', userEmail);

        if (updateError) {
            logger.error('Error updating daily count and seen lines', { email: userEmail, error: updateError.message });
            // Don't return the line if the update failed, state is inconsistent
            return res.status(500).json({ error: 'Failed to claim gift' });
        }

        logger.info('Successfully provided new pickup line and updated counts', {
            email: userEmail,
            lineId: selectedLine.id,
            newDailyCompletedCount,
            earnedToday
        });

        res.json({
            success: true,
            pickupLine: selectedLine.line,
            dailyCompletedGifts: newDailyCompletedCount, // Return the updated daily count
            earnedGiftsToday: earnedToday // Return today's earned total
        });

    } catch (error: any) {
        logger.error('Error in get-next-pickup-line', { email: userEmail, error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router; 