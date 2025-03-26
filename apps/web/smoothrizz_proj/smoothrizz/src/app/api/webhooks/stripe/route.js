import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Add basic console log to verify the file is loaded
console.log('Webhook route file loaded');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Log configuration status
console.log('Stripe Configuration:', {
  hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
  hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});

// Create a Supabase client with the service role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(req) {
  // Log every incoming request
  console.log('🔔 Webhook endpoint hit!', {
    method: req.method,
    headers: Object.fromEntries(req.headers),
    timestamp: new Date().toISOString()
  });

  try {
    const payload = await req.text();
    console.log('📦 Received webhook payload length:', payload.length);
    
    const sig = req.headers.get('stripe-signature');
    console.log('🔑 Stripe signature present:', !!sig);

    let event;

    try {
      console.log('Webhook received, verifying signature...');
      event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
      console.log('Webhook verified successfully. Event:', {
        type: event.type,
        id: event.id
      });
    } catch (err) {
      console.error('⚠️ Webhook signature verification failed:', {
        error: err.message,
        signature: sig ? 'Present' : 'Missing',
        endpointSecret: endpointSecret ? 'Present' : 'Missing'
      });
      return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userEmail = (session.metadata?.user_email || '').toLowerCase().trim();
      
      console.log('📦 Processing checkout.session.completed:', {
        sessionId: session.id,
        userEmail: userEmail,
        customerEmail: session.customer_email,
        metadata: session.metadata
      });

      if (!userEmail) {
        console.error('❌ No user email found in session metadata');
        return NextResponse.json({ error: 'No user email in metadata' }, { status: 400 });
      }

      // First, verify the user exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', userEmail)
        .single();

      if (fetchError || !existingUser) {
        console.error('❌ Failed to fetch user:', {
          userEmail,
          error: fetchError,
          userFound: !!existingUser
        });
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Calculate trial end date (3 days from now)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 3);

      // Update user's subscription with trial information
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          subscription_type: 'premium',
          subscription_status: 'active',
          is_trial: true,
          trial_started_at: new Date().toISOString(),
          trial_end_date: trialEndDate.toISOString(),
          subscription_updated_at: new Date().toISOString(),
          stripe_customer_id: session.customer
        })
        .eq('email', userEmail)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Failed to update subscription:', {
          error: updateError,
          userEmail: userEmail,
          sessionId: session.id
        });
        return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
      }

      console.log('✅ Successfully updated subscription with trial:', {
        userEmail: userEmail,
        trialEndDate: trialEndDate.toISOString(),
        customerId: session.customer
      });
    }

    // Handle trial ending
    if (event.type === 'customer.subscription.trial_will_end') {
      const subscription = event.data.object;
      
      // Find user by Stripe customer ID
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('stripe_customer_id', subscription.customer)
        .single();

      if (!userError && user) {
        // Update user record to reflect trial ending soon
        await supabase
          .from('users')
          .update({
            trial_ending_soon: true
          })
          .eq('id', user.id);
      }
    }

    // Handle subscription becoming active after trial
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      
      if (subscription.status === 'active' && !subscription.trial_end) {
        // Find user by Stripe customer ID
        const { data: user, error: userError } = await supabase
          .from('users')
          .update({
            is_trial: false,
            is_premium: true,
            trial_end_date: null,
            subscription_status: 'active',
            subscription_updated_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', subscription.customer)
          .select()
          .single();
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook processing error:', {
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Add OPTIONS handler for CORS if needed
export async function OPTIONS(req) {
  console.log('OPTIONS request received');
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
    },
  });
} 