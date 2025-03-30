import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe only if API key is available
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia' // Use a consistent API version
  });
  console.log('[Stripe] Successfully initialized Stripe client');
} else {
  console.error('[Stripe] STRIPE_SECRET_KEY not found in environment variables for cancellation');
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

console.log('[Supabase] Initialized Supabase client');

const router = Router();

interface CancelSubscriptionBody {
    userEmail?: string;
    userId?: string; // Allow canceling by user ID as well
}


router.post('/', async (req: Request<{}, {}, CancelSubscriptionBody>, res: Response) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[${requestId}] Starting subscription cancellation request`, {
    userEmail: req.body.userEmail,
    userId: req.body.userId
  });

  try {
    if (!stripe) {
      console.error(`[${requestId}] Stripe client not configured for cancellation route`);
      return res.status(500).json({ error: 'Stripe is not configured' });
    }

    const { userEmail, userId } = req.body;
    const normalizedUserEmail = userEmail?.toLowerCase().trim();

    if (!normalizedUserEmail && !userId) {
      console.error(`[${requestId}] Validation failed: No user email or ID provided`);
      return res.status(400).json({ error: 'User email or ID is required' });
    }

    console.log(`[${requestId}] Processing cancellation request`, {
      userEmail: normalizedUserEmail,
      userId,
      timestamp: new Date().toISOString()
    });

     // Determine lookup criteria
     const lookupCriteria = userId
      ? { column: 'id', value: userId, label: `user ID ${userId}` }
      : { column: 'email', value: normalizedUserEmail!, label: `email ${normalizedUserEmail}` };


    // Get user data including stripe_customer_id
    console.log(`[${requestId}] Fetching user data from Supabase`, {
      lookupCriteria: lookupCriteria.label
    });

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, stripe_customer_id, is_trial, trial_end_date') // Select fields needed
      .eq(lookupCriteria.column, lookupCriteria.value)
      .single();

    if (userError || !user) {
      console.error(`[${requestId}] Failed to fetch user data`, {
        error: userError,
        lookupCriteria: lookupCriteria.label
      });
      const status = userError ? 500 : 404;
      const message = userError ? `Database error finding user ${lookupCriteria.label}` : `User not found for ${lookupCriteria.label}`;
      return res.status(status).json({ error: message });
    }

    console.log(`[${requestId}] Successfully retrieved user data`, {
      userId: user.id,
      email: user.email,
      hasStripeCustomerId: !!user.stripe_customer_id,
      isTrial: user.is_trial
    });


    const customerId = user.stripe_customer_id;

    if (!customerId) {
       // If the user is currently in a trial managed solely by DB flags (before Stripe interaction completes)
      if (user.is_trial && user.trial_end_date) {
        console.log(`[${requestId}] Cancelling DB-managed trial`, {
          userId: user.id,
          email: user.email,
          trialEndDate: user.trial_end_date
        });
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({
            is_trial: false,
            trial_end_date: null, // Or set to now if immediate effect needed
            subscription_status: 'inactive',
            subscription_type: 'standard',
            // Mark that cancellation happened during trial if needed
            // canceled_during_trial: true
          })
          .eq('id', user.id)
          .select()
          .single();

        if (updateError) {
            console.error(`[${requestId}] Failed to cancel DB-managed trial`, {
              error: updateError,
              userId: user.id
            });
             return res.status(500).json({ error: 'Failed to cancel trial' });
        }
         console.log(`[${requestId}] Successfully cancelled DB-managed trial`, {
           userId: user.id,
           email: user.email,
           timestamp: new Date().toISOString()
         });
         return res.json({
           status: 'success',
           message: 'Trial cancelled successfully.',
           databaseUpdate: updatedUser
         });
      } else {
        console.warn(`[${requestId}] No subscription found to cancel`, {
          userId: user.id,
          email: user.email,
          reason: 'No Stripe customer ID and not in DB-managed trial'
        });
        // Decide if this is an error or just means nothing to cancel.
        // If they never started checkout, there's nothing to cancel.
        return res.status(404).json({ error: 'No active subscription or trial found to cancel' });
      }
    }


    // Find active or trialing Stripe subscriptions for the customer
    console.log(`[${requestId}] Fetching Stripe subscriptions`, {
      customerId,
      userEmail: user.email
    });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all', // Consider active and trialing subscriptions
      limit: 10, // Get a few in case there are multiple (shouldn't happen with our logic)
    });

     // Filter for potentially cancellable subscriptions (active or trialing)
    const cancellableSubscriptions = subscriptions.data.filter(sub =>
        ['active', 'trialing'].includes(sub.status) && !sub.cancel_at_period_end
    );


    console.log(`[${requestId}] Subscription status`, {
      totalSubscriptions: subscriptions.data.length,
      cancellableSubscriptions: cancellableSubscriptions.length,
      customerId
    });


    if (cancellableSubscriptions.length === 0) {
      console.log(`[${requestId}] No active or trialing subscription found to cancel for customer ${customerId} (User: ${user.email})`);
      // Check if maybe it was *already* set to cancel
       const alreadyCancelingSub = subscriptions.data.find(sub => sub.cancel_at_period_end);
       if (alreadyCancelingSub) {
           console.log(`[${requestId}] Subscription already scheduled for cancellation`, {
             subscriptionId: alreadyCancelingSub.id,
             cancelAt: new Date(alreadyCancelingSub.cancel_at! * 1000).toISOString()
           });
           return res.json({ status: 'success', message: 'Subscription is already set to cancel at period end.' });
       }
      return res.status(404).json({ error: 'No active subscription found to cancel' });
    }

    // Assuming we only want to cancel one subscription (the most recent active/trialing one)
    const subscriptionToCancel = cancellableSubscriptions[0]; // Usually the latest one

     console.log(`[${requestId}] Initiating subscription cancellation`, {
       subscriptionId: subscriptionToCancel.id,
       status: subscriptionToCancel.status,
       currentPeriodEnd: new Date(subscriptionToCancel.current_period_end * 1000).toISOString()
     });


    // Cancel at period end
    const canceledSubscription = await stripe.subscriptions.update(subscriptionToCancel.id, {
      cancel_at_period_end: true,
    });

    console.log(`[${requestId}] Successfully scheduled subscription cancellation`, {
      subscriptionId: canceledSubscription.id,
      cancelAt: new Date(canceledSubscription.current_period_end * 1000).toISOString(),
      status: canceledSubscription.status
    });


    // Update user's status in the database to reflect the pending cancellation
    const subscriptionEndDate = new Date(canceledSubscription.current_period_end * 1000).toISOString();
    const updateData: any = {
        cancel_at_period_end: true,
        subscription_end_date: subscriptionEndDate, // Reflect when access will end
        subscription_updated_at: new Date().toISOString(),
         // Keep status active until it actually ends. Webhook should handle the final transition.
        subscription_status: 'active'
    };

     // If canceling during a trial period, potentially update trial flags
     if (canceledSubscription.status === 'trialing') {
         console.log(`[${requestId}] Subscription cancelled during trial period`, {
           subscriptionId: canceledSubscription.id,
           userId: user.id
         });
         // updateData.canceled_during_trial = true; // Add this column if you need to track this
     }


    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id) // Use user ID for update
      .select()
      .single(); // Make sure to return the updated record

    if (updateError) {
      console.error(`[${requestId}] Failed to update user record`, {
        error: updateError,
        userId: user.id,
        subscriptionId: canceledSubscription.id
      });
      // Note: Stripe cancellation succeeded, but DB update failed. Might need manual reconciliation.
      // Return success but log the DB error prominently.
      return res.status(500).json({
          status: 'error',
          message: 'Subscription marked for cancellation in Stripe, but database update failed.',
          stripeSubscription: canceledSubscription
      });
    }

     console.log(`[${requestId}] Successfully completed cancellation process`, {
       userId: user.id,
       email: user.email,
       subscriptionId: canceledSubscription.id,
       endDate: subscriptionEndDate
     });

    return res.json({
      status: 'success',
      message: 'Subscription will be canceled at the end of the current period.',
      subscriptionEndDate: subscriptionEndDate,
      stripeSubscription: { // Send back minimal useful info
          id: canceledSubscription.id,
          status: canceledSubscription.status,
          cancel_at_period_end: canceledSubscription.cancel_at_period_end,
          current_period_end: canceledSubscription.current_period_end
       },
       databaseUpdate: updatedUser // Send back updated user record
    });

  } catch (error: any) {
    console.error(`[${requestId}] Unhandled error in cancel-subscription`, {
      error: {
        message: error.message,
        code: error.code,
        type: error.type,
        stack: error.stack
      }
    });
    // Handle potential Stripe errors like 'resource_missing' if the subscription doesn't exist
     if (error.code === 'resource_missing') {
         return res.status(404).json({ error: 'Subscription not found in Stripe.' });
     }
    return res.status(500).json({
        error: 'Failed to cancel subscription',
        details: error.message
    });
  }
});

export default router; 