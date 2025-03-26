import { NextResponse } from 'next/server';
import { 
  ANONYMOUS_USAGE_LIMIT,
  FREE_USER_DAILY_LIMIT 
} from '@/app/constants';
import { 
  checkUsageStatus, 
  getNextResetTime 
} from '@/utils/usageTracking';
import { incrementUsage } from '@/utils/dbOperations';
import { checkUsageLimits } from '@/utils/dbOperations';

/**
 * Swipes API Route
 * 
 * This file handles tracking user swipes and managing usage limits.
 * 
 * Main Features:
 * - Tracks daily and total usage
 * - Manages anonymous vs authenticated usage
 * - Enforces usage limits
 * 
 * Dependencies:
 * - @supabase/supabase-js: For database operations
 * - @/utils/usageTracking: For usage management
 * - @/utils/dbOperations: For usage management
 * 
 * Side Effects:
 * - Updates ip_usage and users tables
 * - Creates usage records for new users/IPs
 * 
 * Connected Files:
 * - src/app/responses/page.js: Calls this endpoint for swipe actions
 * - src/utils/dbOperations.js: Database operations
 * - src/utils/usageTracking.js: Usage tracking logic
 */

export async function GET(request) {
  try {
    const requestIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const userEmail = request.headers.get('x-user-email');
    
    // Check if we have a valid email, otherwise use IP
    const identifier = userEmail || requestIP;
    const isEmail = Boolean(userEmail && userEmail.includes('@'));
    
    const limitCheck = await checkUsageLimits(identifier, isEmail);

    return NextResponse.json(limitCheck);

  } catch (error) {
    console.error('Error in GET /api/swipes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch (error) {
      console.warn('Invalid or empty JSON body received:', error);
    }

    const userEmail = request.headers.get('x-user-email');
    const requestIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    
    console.log('Processing swipe for:', { userEmail, requestIP });
    
    // Check usage first
    const identifier = userEmail || requestIP;
    const isEmail = Boolean(userEmail);
    
    const currentUsage = await checkUsageLimits(identifier, isEmail);
    
    console.log('Current usage:', currentUsage);
    
    // Determine if user can swipe
    const canSwipe = isEmail 
      ? (currentUsage.isPremium || currentUsage.isTrial || currentUsage.dailySwipes < FREE_USER_DAILY_LIMIT)
      : (currentUsage.dailySwipes < ANONYMOUS_USAGE_LIMIT);
      
    // Only increment usage if under limit or premium/trial
    let usageResult = currentUsage;
    if (canSwipe) {
      try {
        console.log('Incrementing usage for:', identifier);
        
        // First ensure the user exists in the database
        await checkUsageStatus(identifier, isEmail);
        usageResult = await incrementUsage(identifier, isEmail);
        
        console.log('Usage incremented:', usageResult);
      } catch (error) {
        console.error('Error incrementing usage:', error);
        // Return the current usage instead of throwing if increment fails
        usageResult = currentUsage;
      }
    }
    
    // Return detailed response
    const response = {
      ...usageResult,
      canSwipe,
      requiresSignIn: !isEmail && usageResult.dailySwipes >= ANONYMOUS_USAGE_LIMIT,
      requiresUpgrade: isEmail && !usageResult.isPremium && !usageResult.isTrial && usageResult.dailySwipes >= FREE_USER_DAILY_LIMIT
    };
    
    console.log('Returning response:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in POST /api/swipes:', error);
    return NextResponse.json({ 
      error: error.message,
      canSwipe: false,
      dailySwipes: 0,
      isPremium: false,
      isTrial: false,
      requiresSignIn: !request.headers.get('x-user-email'),
      requiresUpgrade: Boolean(request.headers.get('x-user-email'))
    }, { status: 500 });
  }
}

