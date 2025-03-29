import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { LearningPercentageResponse } from '../types/api';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const router = Router();

const MIN_LEARNING_PERCENTAGE = 0;
const FREE_INCREMENT_PER_RESPONSE = 5;
const PREMIUM_INCREMENT_PER_RESPONSE = 10;
const FREE_MAX_PERCENTAGE = 50;
const PREMIUM_MAX_PERCENTAGE = 100;

router.get('/', async (req: Request, res: Response<LearningPercentageResponse>) => {
  try {
    const userEmail = req.headers['x-user-email'] as string | undefined;

    if (!userEmail) {
      return res.json({ percentage: MIN_LEARNING_PERCENTAGE });
    }

    const { data: userData, error } = await supabase
      .from('users')
      .select('subscription_status, is_trial, trial_end_date, saved_responses')
      .eq('email', userEmail.toLowerCase().trim())
      .single();

    if (error) {
      console.error('Error fetching user data:', error);
      return res.json({ percentage: MIN_LEARNING_PERCENTAGE });
    }

    const savedResponsesCount = userData?.saved_responses?.length ?? 0;
    const now = new Date();
    const hasActiveSubscription = 
      userData?.subscription_status === 'active' || 
      (userData?.is_trial && userData?.trial_end_date && new Date(userData.trial_end_date) > now);

    const incrementPerResponse = hasActiveSubscription ? PREMIUM_INCREMENT_PER_RESPONSE : FREE_INCREMENT_PER_RESPONSE;
    const maxPercentage = hasActiveSubscription ? PREMIUM_MAX_PERCENTAGE : FREE_MAX_PERCENTAGE;
    
    const percentage = Math.min(
      savedResponsesCount * incrementPerResponse,
      maxPercentage
    );

    res.json({
      percentage: Math.max(percentage, MIN_LEARNING_PERCENTAGE),
      savedResponsesCount,
      debug: {
        increment: incrementPerResponse,
        max: maxPercentage,
        calculated: savedResponsesCount * incrementPerResponse,
        final: percentage
      }
    });
  } catch (error: any) {
    console.error('Error calculating learning percentage:', error);
    return res.json({ percentage: MIN_LEARNING_PERCENTAGE });
  }
});

export default router; 