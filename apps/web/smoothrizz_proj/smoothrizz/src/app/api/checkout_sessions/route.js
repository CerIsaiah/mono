import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
  try {
    // Check if Stripe is properly configured
    if (!process.env.STRIPE_SECRET_KEY || !stripe) {
      console.error('Stripe configuration error:', { 
        hasKey: !!process.env.STRIPE_SECRET_KEY,
        hasStripe: !!stripe 
      });
      return NextResponse.json(
        { error: 'Stripe is not properly configured' },
        { status: 500 }
      );
    }

    const body = await req.json();
    console.log('Received request body:', body);

    // Handle both userId and userEmail
    let userQuery;
    if (body.userId) {
      userQuery = supabase
        .from('users')
        .select('*')
        .eq('id', body.userId)
        .single();
    } else if (body.userEmail) {
      userQuery = supabase
        .from('users')
        .select('*')
        .eq('email', body.userEmail.toLowerCase().trim())
        .single();
    } else {
      console.log('No user identifier provided');
      return NextResponse.json(
        { error: 'Please sign in to continue with checkout' }, 
        { status: 401 }
      );
    }

    const { data: user, error: dbError } = await userQuery;
    
    console.log('Supabase query result:', { user, dbError });

    if (dbError || !user) {
      console.error('Database error or user not found:', { dbError, userId: body.userId });
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // If user has already had a trial, don't allow another one
    if (user.trial_started_at) {
      return NextResponse.json(
        { error: 'Trial period has already been used' },
        { status: 400 }
      );
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
            unit_amount: 499, // $5.00 in cents
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
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?canceled=true`,
      customer_email: user.email,
      metadata: {
        user_id: user.id,
        user_email: user.email
      }
    });

    console.log('Checkout session created:', session.id);
    return NextResponse.json({ url: session.url });
    
  } catch (error) {
    console.error('Detailed error in checkout session:', error);
    return NextResponse.json(
      { error: 'Error creating checkout session. Please try again.' },
      { status: 500 }
    );
  }
}

// Add OPTIONS handler for CORS if needed
export async function OPTIONS(req) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-User-Email',
    },
  });
} 