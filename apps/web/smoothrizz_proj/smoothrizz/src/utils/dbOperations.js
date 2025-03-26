/**
 * Database Operations Utility
 * 
 * This file centralizes all database operations for user management and usage tracking.
 * 
 * Main Functions:
 * - User management (find/create/update)
 * - IP usage tracking
 * - Daily usage tracking
 * - Trial/Premium status management
 * 
 * Dependencies:
 * - @supabase/supabase-js: For database operations
 * 
 * Side Effects:
 * - Creates and updates records in users table
 * - Creates and updates records in ip_usage table
 * - Manages usage limits and trial periods
 * 
 * Connected Files:
 * - src/app/api/auth/google/route.js: User authentication
 * - src/app/api/swipes/route.js: Usage tracking
 * - src/app/api/usage/route.js: Usage status checks
 * - src/utils/usageTracking.js: Usage tracking utilities
 */

import { createClient } from '@supabase/supabase-js';
import { RESET_TIMEZONE } from './usageTracking';
import { 
  ANONYMOUS_USAGE_LIMIT, 
  FREE_USER_DAILY_LIMIT,
  SIGNED_IN_USAGE_LIMIT 
} from '@/app/constants';

// Modify the getSupabaseClient function to cache the client
let supabaseClient = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabaseClient;
}

// Helper function to get current PST/PDT time
function getCurrentPSTTime() {
  return new Date().toLocaleString("en-US", { timeZone: RESET_TIMEZONE });
}

// New helper function to get PST/PDT timestamp for comparison
function getPSTTimestamp(date) {
  return new Date(new Date(date).toLocaleString("en-US", { timeZone: RESET_TIMEZONE })).getTime();
}

// Modified function to check if it's past reset time
function isPastResetTime(lastResetTime) {
  const now = new Date(getCurrentPSTTime());
  const lastReset = new Date(lastResetTime);
  
  // Get previous midnight PST
  const resetTime = new Date(now);
  resetTime.setHours(0, 0, 0, 0);
  
  return lastReset < resetTime;
}

export async function getUserData(email) {
  console.time('getUserData');
  try {
    if (!email) {
      console.error('No email provided to getUserData');
      throw new Error('Email is required');
    }
    
    console.log('Querying user with email:', email);
    
    const supabase = getSupabaseClient();
    const now = new Date(getCurrentPSTTime());
    const today = now.toISOString(); // Store full ISO string instead of just date portion
    
    // Calculate next reset time properly
    const nextResetDate = new Date();
    nextResetDate.setDate(nextResetDate.getDate() + 1);
    nextResetDate.setHours(0, 0, 0, 0);
    const nextReset = nextResetDate.toISOString(); // Convert to ISO string
    
    // First, try to get the user
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase()) // Normalize email
      .maybeSingle();
      
    if (error) {
      console.error('Database error in getUserData:', error);
      throw error;
    }
    
    if (!data) {
      console.log('No user found, creating new user record for:', email);
      // Create new user with all required fields
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: email.trim().toLowerCase(),
          created_at: now,
          daily_usage: 0,
          saved_responses: [],
          total_usage: 0,
          last_used: now,
          last_reset: now,
          subscription_type: 'standard',
          subscription_status: 'inactive',
          subscription_updated_at: now,
          is_trial: false,
          trial_end_date: null,
          trial_started_at: null,
          subscription_end_date: null,
          trial_ending_soon: false,
          stripe_customer_id: null,
          cancel_at_period_end: false
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating new user:', createError);
        throw createError;
      }
      
      console.log('New user created:', newUser);
      return newUser;
    }
    
    console.log('Found existing user:', data);
    return data;
    
  } catch (error) {
    console.error('getUserData failed:', error);
    throw error;
  } finally {
    console.timeEnd('getUserData');
  }
}

export async function getIPUsage(ip) {
  console.time('getIPUsage');
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database operation timed out')), 5000);
    });

    const dbPromise = getSupabaseClient()
      .from('ip_usage')
      .select('*')
      .eq('ip_address', ip)
      .single();

    const { data, error } = await Promise.race([
      dbPromise,
      timeoutPromise
    ]);

    console.timeEnd('getIPUsage');

    if (error && error.code !== 'PGRST116') {
      console.error('Supabase getIPUsage error:', error);
      throw error;
    }
    
    return data || { ip_address: ip, daily_usage: 0, total_usage: 0 };
  } catch (error) {
    console.error('getIPUsage failed:', error);
    throw error;
  }
}

export async function updateIPUsage(ip, updateData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ip_usage')
    .update(updateData)
    .eq('ip_address', ip)
    .select();

  return { data, error };
}

export async function createIPUsage(data) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ip_usage')
    .insert([data]);

  if (error) throw error;
}

export async function findOrCreateUser(email, name, picture, anonymousSwipes = 0) {
  const supabase = getSupabaseClient();
  try {
    // First try to find the existing user
    let { data: existingUser } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        picture,
        daily_usage,
        total_usage,
        subscription_status,
        is_trial,
        trial_end_date
      `)
      .eq('email', email)
      .single();

    if (existingUser) {
      // If user exists, add anonymous swipes to their daily usage
      const newDailyUsage = (existingUser.daily_usage || 0) + anonymousSwipes;
      const newTotalUsage = (existingUser.total_usage || 0) + anonymousSwipes;

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          daily_usage: newDailyUsage,
          total_usage: newTotalUsage,
          last_used: new Date().toISOString()
        })
        .eq('email', email)
        .select()
        .single();

      if (updateError) throw updateError;
      return updatedUser;
    }

    // If user doesn't exist, create new user with anonymous swipes
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([
        {
          email,
          name,
          picture,
          daily_usage: anonymousSwipes,
          total_usage: anonymousSwipes,
          last_used: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return newUser;

  } catch (error) {
    console.error('Error in findOrCreateUser:', error);
    throw error;
  }
}

export async function getDailyUsage(email) {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('ip_usage')
    .select('total_usage')
    .eq('user_email', email)
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data.total_usage;
}

export async function resetDailyUsage(supabase, email) {
  const now = new Date(getCurrentPSTTime());
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const today = now.toISOString();

  try {
    // Get current user data to preserve history
    const { data: currentUser } = await supabase
      .from('users')
      .select('daily_usage, daily_usage_history')
      .eq('email', email)
      .single();

    // Add yesterday's final count to history before resetting
    const updatedHistory = currentUser?.daily_usage_history || {};
    if (currentUser?.daily_usage > 0) {
      updatedHistory[yesterdayStr] = currentUser.daily_usage;
    }

    const { error } = await supabase
      .from('users')
      .update({
        daily_usage: 0,
        last_reset: today,
        daily_usage_history: updatedHistory
      })
      .eq('email', email);

    if (error) throw error;
  } catch (error) {
    console.error(`Error resetting daily usage for email:${email}:`, error);
    throw error;
  }
}

export async function checkAndResetUsage(identifier, isEmail) {
  console.log('Reset Check:', {
    identifier,
    isEmail,
    currentTime: getCurrentPSTTime(),
    timeZone: RESET_TIMEZONE
  });

  console.log(`Checking reset for ${isEmail ? 'email' : 'IP'}: ${identifier}`);
  const supabase = getSupabaseClient();
  const now = new Date(getCurrentPSTTime());
  const today = now.toISOString();
  
  try {
    // Get the most current record
    if (isEmail) {
      const { data: record, error: getError } = await supabase
        .from('users')
        .select('last_reset, daily_usage, total_usage')
        .eq('email', identifier)
        .single();
      
      if (getError) throw getError;
      
      // Check if reset is needed
      const shouldReset = !record?.last_reset || isPastResetTime(record.last_reset);
      
      if (shouldReset) {
        await resetDailyUsage(supabase, identifier);
        console.log('Reset Result:', {
          identifier,
          wasReset: shouldReset,
          newLastReset: today
        });
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error in checkAndResetUsage:', error);
    throw error;
  }
}

// Update checkUsageLimits to handle the identifier correctly
export async function checkUsageLimits(identifier, isEmail = false) {
  const supabase = getSupabaseClient();
  
  try {
    console.log('Checking usage limits for:', { identifier, isEmail });
    
    // For signed-in users, check premium/trial status first
    if (isEmail) {
      const { data: userData } = await supabase
        .from('users')
        .select('daily_usage, subscription_status, is_trial, trial_end_date')
        .eq('email', identifier)
        .single();

      if (!userData) return { error: 'User not found' };

      const now = new Date();
      const isTrialActive = userData?.is_trial && 
        userData?.trial_end_date && 
        new Date(userData.trial_end_date) > now;

      // Premium/trial users have unlimited usage
      if (userData.subscription_status === 'active' || isTrialActive) {
        return {
          canSwipe: true,
          isPremium: userData.subscription_status === 'active',
          isTrial: isTrialActive,
          dailySwipes: userData.daily_usage || 0,
          ...(isTrialActive && { trialEndsAt: userData.trial_end_date })
        };
      }

      // Regular signed-in users
      return {
        canSwipe: (userData.daily_usage || 0) < FREE_USER_DAILY_LIMIT,
        isPremium: false,
        isTrial: false,
        dailySwipes: userData.daily_usage || 0,
        requiresUpgrade: (userData.daily_usage || 0) >= FREE_USER_DAILY_LIMIT
      };
    }

    // For anonymous users, use IP tracking
    const { data: ipData } = await supabase
      .from('ip_usage')
      .select('daily_usage')
      .eq('ip_address', identifier)
      .single();

    return {
      canSwipe: !ipData || (ipData.daily_usage || 0) < ANONYMOUS_USAGE_LIMIT,
      isPremium: false,
      isTrial: false,
      dailySwipes: ipData?.daily_usage || 0,
      requiresSignIn: (ipData?.daily_usage || 0) >= ANONYMOUS_USAGE_LIMIT
    };

  } catch (error) {
    console.error('Error checking usage limits:', error);
    throw error;
  }
}

// Update incrementUsage to handle race conditions better
export async function incrementUsage(identifier, isEmail = false) {
  const supabase = getSupabaseClient();
  
  try {
    // Check and reset usage first
    await checkAndResetUsage(identifier, isEmail);
    
    // Then check limits
    const limitCheck = await checkUsageLimits(identifier, isEmail);
    if (!limitCheck.canSwipe) {
      return limitCheck;
    }
    
    const now = new Date().toISOString();
    const today = new Date(getCurrentPSTTime()).toISOString().split('T')[0];
    
    if (isEmail) {
      // First fetch current values including daily_usage_history
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('daily_usage, total_usage, daily_usage_history')
        .eq('email', identifier)
        .single();

      if (fetchError) throw fetchError;

      // Add logging to debug history updates
      console.log('Current history before update:', currentUser?.daily_usage_history);

      // Update or initialize daily_usage_history
      const currentHistory = currentUser?.daily_usage_history || {};
      currentHistory[today] = (currentHistory[today] || 0) + 1;

      console.log('Updated history:', currentHistory);

      // Then update with new values
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          daily_usage: (currentUser?.daily_usage || 0) + 1,
          total_usage: (currentUser?.total_usage || 0) + 1,
          daily_usage_history: currentHistory,
          last_used: now
        })
        .eq('email', identifier)
        .select()
        .single();
        
      if (updateError) {
        console.error('Error updating usage:', updateError);
        throw updateError;
      }

      console.log('Final updated user:', updatedUser);
      return { ...limitCheck, dailySwipes: updatedUser.daily_usage };
    } else {
      // For IP addresses, use RLS-safe update - get, then update approach
      let currentData;
      
      // First, get the latest data
      const { data: ipData, error: getError } = await supabase
        .from('ip_usage')
        .select('daily_usage, total_usage')
        .eq('ip_address', identifier)
        .single();
        
      if (getError) {
        if (getError.code === 'PGRST116') {
          // Record doesn't exist, create it with upsert
          const { data, error } = await supabase
            .from('ip_usage')
            .upsert({
              ip_address: identifier,
              daily_usage: 1,
              total_usage: 1,
              last_used: now,
              last_reset: new Date(getCurrentPSTTime()).toISOString().split('T')[0]
            })
            .select();
            
          if (error) throw error;
          return { ...limitCheck, dailySwipes: 1 };
        }
        throw getError;
      }
      
      // Record exists, update it
      const newDailyUsage = (ipData.daily_usage || 0) + 1;
      const newTotalUsage = (ipData.total_usage || 0) + 1;
      
      const { error: updateError } = await supabase
        .from('ip_usage')
        .update({
          daily_usage: newDailyUsage,
          total_usage: newTotalUsage,
          last_used: now
        })
        .eq('ip_address', identifier);
        
      if (updateError) throw updateError;
      return { ...limitCheck, dailySwipes: newDailyUsage };
    }
  } catch (error) {
    console.error('Error incrementing usage:', error);
    throw error;
  }
} 