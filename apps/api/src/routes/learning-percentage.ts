import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { LearningPercentageResponse } from '../types/api';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const router = Router();

const MAX_LEARNING_PERCENTAGE = 100;
const LEARNING_INCREMENT = 5;

router.get('/', async (req: Request, res: Response<LearningPercentageResponse>) => {
  try {
    const userEmail = req.headers['x-user-email'] as string | undefined;

    // For anonymous users, return 0 percentage
    if (!userEmail) {
      return res.json({ percentage: 0 });
    }

    // Get user's total usage
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('total_usage')
      .eq('email', userEmail.toLowerCase().trim())
      .single();

    if (userError) {
      console.error('Error fetching user data:', userError);
      return res.json({ percentage: 0 });
    }

    // Calculate percentage based on total usage
    const totalUsage = user?.total_usage || 0;
    let percentage = totalUsage * LEARNING_INCREMENT;
    
    // Cap at maximum percentage
    percentage = Math.min(percentage, MAX_LEARNING_PERCENTAGE);

    res.json({ percentage });
  } catch (error: any) {
    console.error('Error calculating learning percentage:', error);
    // Return 0 percentage instead of error status for better UX
    res.json({ percentage: 2 });
  }
});

export default router; 