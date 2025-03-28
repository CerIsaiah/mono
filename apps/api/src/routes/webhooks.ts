import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Add basic console log to verify the file is loaded
console.log('Webhook route file loaded');

// Initialize Stripe only if API key is available
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia' // Use a consistent API version
  });
} else {
  console.warn('STRIPE_SECRET_KEY not found in environment variables for webhooks');
}

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Log configuration status
console.log('Stripe Configuration:', {
  hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
  hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});

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

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  // Log every incoming request
  console.log('🔔 Webhook endpoint hit!', {
    method: req.method,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });

  if (!stripe || !endpointSecret) {
    console.error('Stripe or endpointSecret not configured for webhooks');
    return res.status(500).json({ error: 'Webhook handler not configured' });
  }

  const sig = req.headers['stripe-signature'] as string | undefined;
  console.log('🔑 Stripe signature present:', !!sig);

  let event: Stripe.Event;
  // Access the raw body provided by express.raw() middleware
  // Ensure express.raw({type: 'application/json'}) is used *before* express.json()
  // for the /api/webhooks path in index.ts
  const rawBody = req.body;

  if (!rawBody || !(rawBody instanceof Buffer)) {
      console.error('❌ Raw body not available or not a Buffer. Check middleware order/config in index.ts.');
      return res.status(400).json({ error: 'Could not verify webhook signature (missing body)' });
  }
   if (!sig) {
        console.error('❌ Missing stripe-signature header.');
        return res.status(400).json({ error: 'Missing Stripe signature' });
    }


  try {
    console.log('Webhook received, verifying signature...');
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    console.log('Webhook verified successfully. Event:', {
      type: event.type,
      id: event.id
    });
  } catch (err: any) {
    console.error('⚠️ Webhook signature verification failed:', {
      error: err.message,
      signature: sig ? 'Present' : 'Missing',
      endpointSecret: endpointSecret ? 'Present' : 'Missing'
    });
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
      // Handle the event
      switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            const userEmail = (session.metadata?.user_email || session.customer_details?.email || '').toLowerCase().trim();
            const userId = session.metadata?.user_id; // Get user ID from metadata
            const stripeCustomerId = session.customer as string; // Customer ID from session

            console.log('📦 Processing checkout.session.completed:', {
                sessionId: session.id,
                userEmail: userEmail,
                userId: userId, // Log the user ID
                stripeCustomerId: stripeCustomerId,
                metadata: session.metadata
            });

             if (!userId && !userEmail) {
                console.error('❌ No user identifier (ID or email) found in session metadata or customer details');
                return res.status(400).json({ error: 'No user identifier in session' });
            }

            // Prefer user ID for lookup if available
            const lookupCriteria = userId ? { column: 'id', value: userId } : { column: 'email', value: userEmail };

            // Verify the user exists
            const { data: existingUser, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .eq(lookupCriteria.column, lookupCriteria.value)
                .single();

            if (fetchError || !existingUser) {
                console.error(`❌ Failed to fetch user by ${lookupCriteria.column}:`, {
                    value: lookupCriteria.value,
                    error: fetchError,
                    userFound: !!existingUser
                });
                return res.status(404).json({ error: 'User not found' });
            }

             // Calculate trial end date (3 days from now)
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 3);

            // Update user's subscription with trial information
             const { data: updatedUser, error: updateError } = await supabase
                .from('users')
                .update({
                    subscription_type: 'premium',
                    subscription_status: 'active', // Trial is considered active
                    is_trial: true,
                    trial_started_at: new Date().toISOString(),
                    trial_end_date: trialEndDate.toISOString(),
                    subscription_updated_at: new Date().toISOString(),
                    stripe_customer_id: stripeCustomerId, // Store the Stripe Customer ID
                    cancel_at_period_end: false, // Reset cancellation flag if they re-subscribe
                })
                .eq('id', existingUser.id) // Update using the definite user ID
                .select()
                .single();


            if (updateError) {
                console.error('❌ Failed to update subscription:', {
                    error: updateError,
                    userId: existingUser.id,
                    userEmail: existingUser.email,
                    sessionId: session.id
                });
                return res.status(500).json({ error: 'Failed to update subscription' });
            }

            console.log('✅ Successfully updated subscription with trial:', {
                userId: existingUser.id,
                userEmail: existingUser.email,
                trialEndDate: trialEndDate.toISOString(),
                customerId: stripeCustomerId
            });
            break;
          }

        case 'customer.subscription.trial_will_end': {
            const subscription = event.data.object as Stripe.Subscription;
            const stripeCustomerId = subscription.customer as string;
            console.log(`🔔 Trial ending soon for customer: ${stripeCustomerId}`);

            // Find user by Stripe customer ID
            const { data: user, error: userError } = await supabase
              .from('users')
              .select('id') // Only select necessary field
              .eq('stripe_customer_id', stripeCustomerId)
              .maybeSingle(); // Use maybeSingle in case customer ID is not found

            if (userError) {
              console.error(`Error finding user for trial_will_end webhook: ${userError.message}`);
            } else if (user) {
              // Update user record - Maybe add a flag or send a notification
              // Example: Update a flag (ensure 'trial_ending_soon' column exists)
              // await supabase
              //   .from('users')
              //   .update({ trial_ending_soon: true })
              //   .eq('id', user.id);
              console.log(`User ${user.id} notified (or marked) about trial ending soon.`);
            } else {
               console.warn(`User not found for Stripe customer ID ${stripeCustomerId} during trial_will_end event.`);
            }
            break;
        }

        case 'customer.subscription.updated': {
            const subscription = event.data.object as Stripe.Subscription;
            const stripeCustomerId = subscription.customer as string;
            const subscriptionStatus = subscription.status;
            const endsAtTimestamp = subscription.current_period_end;
            const cancelAtPeriodEnd = subscription.cancel_at_period_end;

            console.log(`🔔 Subscription updated for customer: ${stripeCustomerId}`, {
                status: subscriptionStatus,
                endsAt: new Date(endsAtTimestamp * 1000),
                cancelAtPeriodEnd: cancelAtPeriodEnd,
                trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            });


             // Find user by Stripe customer ID
            const { data: user, error: userFindError } = await supabase
                .from('users')
                .select('id, is_trial, email') // Select fields needed for logic/logging
                .eq('stripe_customer_id', stripeCustomerId)
                .single(); // Assuming one user per stripe customer ID

             if (userFindError || !user) {
                 console.error(`❌ User not found for customer.subscription.updated event`, { stripeCustomerId, error: userFindError });
                 // Don't necessarily fail the webhook, just log. Could be a customer without a corresponding user yet.
                 break; // Exit switch case for this event
             }

             let updateData: Partial<{
                subscription_status: string,
                is_trial: boolean,
                trial_end_date: string | null,
                subscription_type: string,
                subscription_end_date: string | null,
                cancel_at_period_end: boolean,
                subscription_updated_at: string
             }> = { subscription_updated_at: new Date().toISOString() };


            // Transitioning from trial to active paid subscription
             if (subscriptionStatus === 'active' && user.is_trial && subscription.trial_end && subscription.trial_end <= Date.now() / 1000) {
                console.log(`Transitioning user ${user.email} from trial to active paid subscription.`);
                updateData.is_trial = false;
                updateData.trial_end_date = null; // Clear trial end date
                updateData.subscription_status = 'active';
                updateData.subscription_type = 'premium'; // Assuming active means premium
                updateData.cancel_at_period_end = cancelAtPeriodEnd;
                updateData.subscription_end_date = new Date(endsAtTimestamp * 1000).toISOString();
            }
             // Handling cancellations (marked to cancel at period end)
            else if (subscriptionStatus === 'active' && cancelAtPeriodEnd) {
                 console.log(`Subscription for user ${user.email} marked to cancel at period end.`);
                 updateData.cancel_at_period_end = true;
                 updateData.subscription_end_date = new Date(endsAtTimestamp * 1000).toISOString(); // Reflect when access ends
                 updateData.subscription_status = 'active'; // Still active until period end
             }
             // Handling subscription becoming active (could be reactivation or initial activation without trial)
             else if (subscriptionStatus === 'active') {
                 console.log(`Subscription for user ${user.email} is active.`);
                 updateData.subscription_status = 'active';
                 updateData.subscription_type = 'premium';
                 updateData.is_trial = false; // Ensure trial flag is off if it somehow wasn't
                 updateData.cancel_at_period_end = cancelAtPeriodEnd;
                 updateData.subscription_end_date = new Date(endsAtTimestamp * 1000).toISOString();
             }
             // Add handling for other statuses like 'past_due', 'canceled', 'unpaid' if needed
             else if (['canceled', 'unpaid', 'past_due'].includes(subscriptionStatus)) {
                 console.log(`Subscription for user ${user.email} is now ${subscriptionStatus}.`);
                 updateData.subscription_status = 'inactive'; // Or map to specific statuses if needed
                 updateData.subscription_type = 'standard'; // Revert to standard on cancellation/failure
                 updateData.is_trial = false;
                 updateData.subscription_end_date = new Date(endsAtTimestamp * 1000).toISOString(); // Record when it ended/failed
             }

             // Only update if there are changes to apply
             if (Object.keys(updateData).length > 1) { // More than just subscription_updated_at
                 const { error: updateError } = await supabase
                    .from('users')
                    .update(updateData)
                    .eq('id', user.id);

                 if (updateError) {
                     console.error(`❌ Failed to update user ${user.email} on subscription update event:`, updateError);
                 } else {
                     console.log(`✅ Successfully updated user ${user.email} based on subscription status: ${subscriptionStatus}`);
                 }
             }
            break;
          }

          // Handle subscription deletion (optional, but good practice)
          case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            const stripeCustomerId = subscription.customer as string;
             console.log(`🔔 Subscription deleted for customer: ${stripeCustomerId}`);

             // Find user and mark subscription as inactive/canceled
            const { data: user, error: userFindError } = await supabase
                .from('users')
                .select('id, email')
                .eq('stripe_customer_id', stripeCustomerId)
                .single();

            if (userFindError || !user) {
                console.warn(`User not found for customer.subscription.deleted event`, { stripeCustomerId, error: userFindError });
                 break;
            }

             const { error: updateError } = await supabase
                 .from('users')
                 .update({
                     subscription_status: 'inactive',
                     subscription_type: 'standard',
                     is_trial: false,
                     trial_end_date: null,
                     subscription_end_date: new Date().toISOString(), // Mark end date as now
                     cancel_at_period_end: false, // Not relevant if deleted immediately
                     subscription_updated_at: new Date().toISOString()
                 })
                 .eq('id', user.id);

            if (updateError) {
                 console.error(`❌ Failed to update user ${user.email} on subscription deletion event:`, updateError);
             } else {
                 console.log(`✅ Successfully marked subscription inactive for user ${user.email} due to deletion.`);
             }
            break;
          }


        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      // Return a 200 response to acknowledge receipt of the event
      res.json({ received: true });

  } catch (error: any) {
    console.error('❌ Webhook processing error:', {
      message: error.message,
      stack: error.stack
    });
    // Send error response but still status 200 if possible, unless it's a client error (4xx)
    // Stripe prefers 200 unless the webhook itself is malformed (handled by signature check)
    // For processing errors, log them but acknowledge receipt to prevent Stripe retries for potentially unfixable issues.
    // If the error is transient, Stripe will retry anyway if it doesn't get a 2xx.
    // Let's return 500 for internal errors during processing.
    res.status(500).json({ error: 'Internal server error during webhook processing' });
  }
});


export default router; 