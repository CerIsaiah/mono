import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const userEmail = searchParams.get('userEmail')?.toLowerCase().trim();

    if (!userId && !userEmail) {
      return NextResponse.json({ error: 'User ID or email is required' }, { status: 400 });
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
    } else {
      query.eq('email', userEmail);
    }
    
    const { data: user, error } = await query.single();

    if (error) {
      console.error('Error fetching subscription:', error);
      return NextResponse.json({ error: 'Failed to fetch subscription status' }, { status: 500 });
    }

    // Determine the current subscription state
    let status = 'free';
    let details = {
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
        details.subscriptionEndsAt = subscriptionEndDate?.toISOString();
      }
      // Check if subscription is canceling
      else if (user.subscription_status === 'canceling') {
        status = 'canceling';
        details.subscriptionEndsAt = subscriptionEndDate?.toISOString();
      }
    }

    return NextResponse.json({
      status,
      details
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 