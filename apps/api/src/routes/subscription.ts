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

    // Default to standard type and inactive status
    let details: SubscriptionDetails = {
      type: user?.subscription_type as 'standard' | 'premium' | null || 'standard',
      isTrialActive: false,
      trialEndsAt: null,
      subscriptionEndsAt: null,
      isCanceled: user?.cancel_at_period_end || false,
      hadTrial: false,
      canceledDuringTrial: false
    };

    let status: 'free' | 'trial' | 'trial-canceling' | 'premium' | 'canceling' = 'free';

    if (user) {
      const now = new Date();
      const trialEndDate = user.trial_end_date ? new Date(user.trial_end_date) : null;
      const subscriptionEndDate = user.subscription_end_date ? new Date(user.subscription_end_date) : null;

      // Check if trial is active
      if (user.is_trial && trialEndDate && trialEndDate > now) {
        status = user.cancel_at_period_end ? 'trial-canceling' : 'trial';
        details.type = 'premium'; // Trial users get premium features
        details.isTrialActive = true;
        details.trialEndsAt = trialEndDate.toISOString();
        details.canceledDuringTrial = user.cancel_at_period_end;
      }
      // Only check Stripe if user has a customer ID
      else if (user.stripe_customer_id && stripe) {
        try {
          const customer = await stripe.customers.retrieve(user.stripe_customer_id);
          
          if (customer.deleted) {
            // Customer was deleted in Stripe, reset their data
            await supabase
              .from('users')
              .update({
                stripe_customer_id: null,
                subscription_status: 'inactive',
                subscription_type: 'standard',
                subscription_end_date: null,
                is_trial: false,
                trial_end_date: null
              })
              .eq('email', user.email);
          } else {
            // Check active subscriptions
            const subscriptions = await stripe.subscriptions.list({
              customer: user.stripe_customer_id,
              status: 'active',
              limit: 1
            });

            if (subscriptions.data.length > 0) {
              status = 'premium';
              details.type = 'premium';
              details.subscriptionEndsAt = subscriptionEndDate?.toISOString() || null;
              
              if (subscriptions.data[0].cancel_at) {
                details.isCanceled = true;
                status = 'canceling';
              }
            }
          }
        } catch (stripeError: any) {
          if (stripeError?.code === 'resource_missing') {
            // Customer doesn't exist in Stripe, reset their data
            await supabase
              .from('users')
              .update({
                stripe_customer_id: null,
                subscription_status: 'inactive',
                subscription_type: 'standard',
                subscription_end_date: null,
                is_trial: false,
                trial_end_date: null
              })
              .eq('email', user.email);
          } else {
            console.error('Error fetching Stripe subscription:', stripeError);
          }
        }
      }
      // For users without Stripe customer ID, just use the database status
      else {
        if (user.subscription_status === 'active') {
          status = 'premium';
          details.type = 'premium';
        } else if (user.subscription_status === 'canceling') {
          status = 'canceling';
          details.type = 'premium';
        }
      }

      // Set hadTrial after all status checks
      details.hadTrial = status === 'free' && !!user.trial_started_at;
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