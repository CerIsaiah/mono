import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { ParsedQs } from 'qs';

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
        trial_started_at,
        stripe_customer_id
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

        // Check Stripe subscription if available
        if (stripe && user.stripe_customer_id) {
          try {
            // First check if customer exists
            try {
              await stripe.customers.retrieve(user.stripe_customer_id);
            } catch (customerError: any) {
              if (customerError?.code === 'resource_missing') {
                // Customer doesn't exist in Stripe, update user record
                await supabase
                  .from('users')
                  .update({
                    stripe_customer_id: null,
                    subscription_status: 'free',
                    subscription_type: null,
                    subscription_end_date: null
                  })
                  .eq('email', user.email);
                
                status = 'free';
                details = {
                  type: null,
                  isTrialActive: false,
                  trialEndsAt: null,
                  subscriptionEndsAt: null,
                  isCanceled: false,
                  hadTrial: details.hadTrial,
                  canceledDuringTrial: false
                };
                return res.json({ status, details });
              }
              throw customerError;
            }

            // If customer exists, check subscriptions
            const subscriptions = await stripe.subscriptions.list({
              customer: user.stripe_customer_id,
              status: 'active',
              limit: 1
            });
            
            if (subscriptions.data[0]?.cancel_at) {
              status = 'canceling';
              details.isCanceled = true;
            }
          } catch (stripeError) {
            console.error('Error fetching Stripe subscription:', stripeError);
            // Continue without Stripe data
          }
        }
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