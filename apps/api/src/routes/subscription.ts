import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { ParsedQs } from 'qs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia'
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const router = Router();

interface SubscriptionDetails {
  type: string | null;
  isTrialActive: boolean;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  hadTrial: boolean;
  isCanceled: boolean;
  canceledDuringTrial: boolean;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const userEmail = typeof req.query.userEmail === 'string' 
      ? req.query.userEmail.toLowerCase().trim()
      : undefined;

    if (!userId && !userEmail) {
      return res.status(400).json({ error: 'User ID or email is required' });
    }

    // Query using either userId or email
    const query = supabase
      .from('users')
      .select(`
        subscription_type,
        subscription_status,
        is_trial,
        trial_end_date,
        subscription_end_date,
        email,
        cancel_at_period_end,
        trial_started_at
      `);

    if (userId) {
      query.eq('id', userId);
    } else if (userEmail) {
      query.eq('email', userEmail);
    }
    
    const { data: user, error } = await query.single();

    if (error) {
      console.error('Error fetching subscription:', error);
      return res.status(500).json({ error: 'Failed to fetch subscription status' });
    }

    // Determine the current subscription state
    let status = 'free';
    let details: SubscriptionDetails = {
      type: user?.subscription_type || null,
      isTrialActive: false,
      trialEndsAt: null,
      subscriptionEndsAt: null,
      isCanceled: user?.cancel_at_period_end || false,
      hadTrial: !!user?.trial_started_at,
      canceledDuringTrial: user?.is_trial && user?.cancel_at_period_end
    };

    if (user) {
      const now = new Date();
      const trialEndDate = user.trial_end_date ? new Date(user.trial_end_date) : null;
      const subscriptionEndDate = user.subscription_end_date ? new Date(user.subscription_end_date) : null;

      // Check if trial is active
      if (user.is_trial && trialEndDate && trialEndDate > now) {
        status = user.cancel_at_period_end ? 'trial-canceling' : 'trial';
        details.isTrialActive = true;
        details.trialEndsAt = trialEndDate.toISOString();
      }
      // Check if subscription is active
      else if (user.subscription_status === 'active') {
        status = 'premium';
        details.subscriptionEndsAt = subscriptionEndDate?.toISOString() || null;
      }
      // Check if subscription is canceling
      else if (user.subscription_status === 'canceling') {
        status = 'canceling';
        details.subscriptionEndsAt = subscriptionEndDate?.toISOString() || null;
      }
    }

    res.json({
      status,
      details
    });
  } catch (error: any) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router; 