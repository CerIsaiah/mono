import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Initialize Stripe only if API key is available
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia'
  });
} else {
  console.warn('STRIPE_SECRET_KEY not found in environment variables');
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const router = Router();

interface User {
  subscription_type: 'standard' | 'premium';
  subscription_status: 'active' | 'inactive';
  is_trial: boolean;
  trial_end_date: string | null;
  subscription_end_date: string | null;
  email: string;
  cancel_at_period_end: boolean;
  trial_started_at: string | null;
  stripe_customer_id: string | null;
  had_trial: boolean;
  daily_usage: number;
  total_usage: number;
}

interface SubscriptionDetails {
  type: 'standard' | 'premium';
  isTrialActive: boolean;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  hadTrial: boolean;
  isCanceled: boolean;
  canceledDuringTrial: boolean;
}

router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const userEmail = typeof req.query.userEmail === 'string' 
      ? req.query.userEmail.toLowerCase().trim()
      : undefined;

    console.log('[Subscription Status] Request params:', { userId, userEmail });

    if (!userId && !userEmail) {
      console.log('[Subscription Status] Missing userId and userEmail');
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
        trial_started_at,
        stripe_customer_id,
        had_trial,
        daily_usage,
        total_usage
      `);

    if (userId) {
      query.eq('id', userId);
    } else if (userEmail) {
      query.eq('email', userEmail);
    }
    
    const { data: user, error } = await query.single();

    if (error || !user) {
      console.error('[Subscription Status] Supabase query error:', error);
      return res.status(404).json({ 
        error: 'User not found',
        details: error?.message || 'Failed to fetch subscription status'
      });
    }

    console.log('[Subscription Status] User data:', {
      email: user?.email,
      subscription_type: user?.subscription_type || 'standard',
      subscription_status: user?.subscription_status || 'inactive',
      is_trial: Boolean(user?.is_trial),
      has_stripe_customer: Boolean(user?.stripe_customer_id),
      daily_usage: user?.daily_usage || 0,
      total_usage: user?.total_usage || 0
    });

    // Check subscription status with safe defaults
    const isPremium = (user.subscription_status === 'active' && user.subscription_type === 'premium');
    const isTrialActive = Boolean(user.is_trial && 
      user.trial_end_date && 
      new Date(user.trial_end_date) > new Date());

    // Determine the status based on subscription state
    let status: 'free' | 'trial' | 'premium' | 'trial-canceling' | 'canceling';
    
    if (isTrialActive) {
      // Trial status
      status = user.cancel_at_period_end ? 'trial-canceling' : 'trial';
    } else if (isPremium) {
      // Premium status
      status = user.cancel_at_period_end ? 'canceling' : 'premium';
    } else {
      // Free status (inactive subscription or non-premium type)
      status = 'free';
    }

    const response = {
      status,
      details: {
        type: user.subscription_type || 'standard',
        isTrialActive,
        trialEndsAt: user.trial_end_date,
        subscriptionEndsAt: user.subscription_end_date,
        hadTrial: Boolean(user.had_trial),
        isCanceled: Boolean(user.cancel_at_period_end),
        canceledDuringTrial: Boolean(user.cancel_at_period_end && isTrialActive)
      },
      usage: {
        daily: user.daily_usage || 0,
        total: user.total_usage || 0
      },
      // Include raw subscription data for debugging
      debug: {
        subscription_status: user.subscription_status || 'inactive',
        subscription_type: user.subscription_type || 'standard',
        is_trial: Boolean(user.is_trial),
        cancel_at_period_end: Boolean(user.cancel_at_period_end)
      }
    };

    console.log('[Subscription Status] Final response:', response);
    res.json(response);
  } catch (error: any) {
    console.error('[Subscription Status] Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message || 'Failed to process subscription status'
    });
  }
});

export default router; 