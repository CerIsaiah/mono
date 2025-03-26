/**
 * Google Authentication API Route
 * 
 * This file handles Google Sign-In authentication and user creation/updating.
 * 
 * Dependencies:
 * - @/utils/dbOperations: For database operations (findOrCreateUser, getIPUsage)
 * - google-auth-library: For verifying Google tokens
 * 
 * Side Effects:
 * - Creates/updates user records in the users table
 * - Transfers anonymous usage from ip_usage table to user account
 * - Sets user session data
 * 
 * Connected Files:
 * - src/app/responses/page.js: Calls this endpoint during Google Sign-In
 * - src/app/page.js: Calls this endpoint during Google Sign-In
 * - src/utils/dbOperations.js: Used for database operations
 */

import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { findOrCreateUser, getIPUsage } from '@/utils/dbOperations';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function POST(request) {
  try {
    const { credential } = await request.json();
    const requestIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    // Get anonymous usage first
    const ipUsage = await getIPUsage(requestIP);
    const anonymousSwipes = ipUsage.daily_usage;

    // Get or create user using centralized function
    const user = await findOrCreateUser(email, name, picture, anonymousSwipes);
    
    // Check if user is premium or in trial period
    const isPremium = user.subscription_status === 'active';
    const isTrialActive = user.is_trial && 
      user.trial_end_date && 
      new Date(user.trial_end_date) > new Date();
    
    // Return user data along with subscription status
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.picture,
      },
      dailySwipes: user.daily_usage,
      totalSwipes: user.total_usage,
      isPremium: isPremium,
      isTrial: isTrialActive,
      ...(isTrialActive && {
        trialEndsAt: user.trial_end_date
      })
    });

  } catch (error) {
    console.error('Google auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed: ' + error.message },
      { status: 401 }
    );
  }
} 