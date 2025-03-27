import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { LearningPercentageResponse } from '../types/api';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const router = Router();

const MIN_LEARNING_PERCENTAGE = 20;
const MAX_LEARNING_PERCENTAGE = 100;
const LEARNING_INCREMENT = 5;

router.get('/', async (req: Request, res: Response<LearningPercentageResponse>) => {
  try {
    const userEmail = req.headers['x-user-email'] as string | undefined;

    // For anonymous users, return minimum percentage
    if (!userEmail) {
      return res.json({ percentage: MIN_LEARNING_PERCENTAGE });
    }

    // Get user's swipe history
    const { data: swipes, error: swipesError } = await supabase
      .from('swipes')
      .select('created_at')
      .eq('user_email', userEmail.toLowerCase().trim())
      .order('created_at', { ascending: false });

    if (swipesError) {
      console.error('Error fetching swipes:', swipesError);
      return res.status(500).json({ percentage: MIN_LEARNING_PERCENTAGE });
    }

    // Calculate percentage based on number of swipes
    const totalSwipes = swipes?.length || 0;
    let percentage = MIN_LEARNING_PERCENTAGE + (totalSwipes * LEARNING_INCREMENT);
    
    // Cap at maximum percentage
    percentage = Math.min(percentage, MAX_LEARNING_PERCENTAGE);

    res.json({ percentage });
  } catch (error: any) {
    console.error('Error calculating learning percentage:', error);
    res.status(500).json({ percentage: MIN_LEARNING_PERCENTAGE });
  }
});

export default router; 