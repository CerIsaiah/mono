import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { ParsedQs } from 'qs';

// Initialize Stripe only if API key is available
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia' // Use a consistent API version
  });
} else {
  console.warn('STRIPE_SECRET_KEY not found in environment variables for checkout');
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

const router = Router();

interface CheckoutRequestBody {
    userId?: string;
    userEmail?: string;
}

router.post('/', async (req: Request<{}, {}, CheckoutRequestBody>, res: Response) => {
  try {
    // Check if Stripe is properly configured
    if (!stripe) {
      console.error('Stripe configuration error in checkout route');
      return res.status(500).json({ error: 'Stripe is not properly configured' });
    }

    const { userId, userEmail } = req.body;
    const normalizedUserEmail = userEmail?.toLowerCase().trim();

    console.log('Received request body:', req.body);

    // Handle both userId and userEmail
    let userQuery;
    if (userId) {
      userQuery = supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    } else if (normalizedUserEmail) {
      userQuery = supabase
        .from('users')
        .select('*')
        .eq('email', normalizedUserEmail)
        .single();
    } else {
      console.log('No user identifier provided');
      return res.status(401).json({ error: 'Please sign in to continue with checkout' });
    }

    const { data: user, error: dbError } = await userQuery;

    console.log('Supabase query result:', { user, dbError });

    if (dbError || !user) {
      console.error('Database error or user not found:', { dbError, userId, userEmail });
      // Distinguish between DB error and user not found
      const status = dbError ? 500 : 404;
      const message = dbError ? 'Database error fetching user' : 'User not found';
      return res.status(status).json({ error: message });
    }

    // If user has already had a trial, don't allow another one
    // Note: We check trial_started_at which is set when checkout.session.completed webhook is processed
    if (user.trial_started_at) {
       console.log(`User ${user.email} already had a trial, preventing new checkout.`);
       return res.status(400).json({ error: 'Trial period has already been used' });
    }


    console.log('Found user:', { userId: user.id, email: user.email });

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'SmoothRizz Premium',
              description: '3-day free trial, then $5/month for unlimited swipes',
            },
            unit_amount: 499, // $4.99 in cents
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: 3,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
        },
        // Add metadata to the subscription itself if needed later
        // metadata: {
        //   user_id: user.id,
        // }
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?success=true`, // Assuming NEXT_PUBLIC_BASE_URL is accessible or replaced
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?canceled=true`, // Assuming NEXT_PUBLIC_BASE_URL is accessible or replaced
      // Use customer_email OR customer, not both if creating a new customer implicitly
      customer_email: user.email,
       // Link checkout session to user for webhook processing
      metadata: {
        user_id: user.id, // Keep Supabase user ID
        user_email: user.email // Keep email for redundancy/logging if needed
      },
      // Optional: If you manage Stripe Customer objects separately
      // customer: user.stripe_customer_id || undefined, // Use existing customer if available
    });

    console.log('Checkout session created:', session.id);
    res.json({ url: session.url });

  } catch (error: any) {
    console.error('Detailed error in checkout session:', error);
    res.status(500).json({ error: error.message || 'Error creating checkout session. Please try again.' });
  }
});

export default router; 