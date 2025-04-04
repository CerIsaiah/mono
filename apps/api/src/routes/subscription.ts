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
  subscription_type: any;
  subscription_status: any;
  is_trial: any;
  trial_end_date: any;
  subscription_end_date: any;
  email: any;
  cancel_at_period_end: any;
  trial_started_at: any;
  stripe_customer_id: any;
  had_trial: boolean;
}

interface SubscriptionDetails {
  type: 'standard' | 'premium' | null;
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
        had_trial
      `);

    if (userId) {
      query.eq('id', userId);
    } else if (userEmail) {
      query.eq('email', userEmail);
    }
    
    const { data: user, error } = await query.single();

    if (error) {
      console.error('[Subscription Status] Supabase query error:', error);
      return res.status(500).json({ error: 'Failed to fetch subscription status' });
    }

    console.log('[Subscription Status] User data:', {
      email: user?.email,
      subscription_type: user?.subscription_type,
      subscription_status: user?.subscription_status,
      is_trial: user?.is_trial,
      has_stripe_customer: !!user?.stripe_customer_id
    });

    // Check subscription status
    const isPremium = user.subscription_status === 'active' && user.subscription_type === 'premium';
    const isTrialActive = Boolean(user.is_trial && 
      user.trial_end_date && 
      new Date(user.trial_end_date) > new Date());

    console.log('[Subscription Status] Status check:', {
      email: user.email,
      isPremium,
      isTrialActive,
      subscriptionStatus: user.subscription_status,
      subscriptionType: user.subscription_type,
      trialEndDate: user.trial_end_date,
      timestamp: new Date().toISOString()
    });

    // Determine the status
    let status: 'free' | 'trial' | 'premium' | 'trial-canceling' | 'canceling';
    if (isTrialActive) {
      status = user.subscription_status === 'canceled' ? 'trial-canceling' : 'trial';
    } else if (isPremium) {
      status = user.subscription_status === 'canceled' ? 'canceling' : 'premium';
    } else {
      status = 'free';
    }

    const response = {
      status,
      details: {
        type: user.subscription_type,
        isTrialActive,
        trialEndsAt: user.trial_end_date || null,
        subscriptionEndsAt: user.subscription_end_date || null,
        hadTrial: Boolean(user.is_trial || user.trial_started_at),
        isCanceled: user.subscription_status === 'canceled',
        canceledDuringTrial: user.subscription_status === 'canceled' && isTrialActive
      }
    };

    console.log('[Subscription Status] Final response:', { status, response });
    res.json(response);
  } catch (error: any) {
    console.error('[Subscription Status] Unexpected error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router; 