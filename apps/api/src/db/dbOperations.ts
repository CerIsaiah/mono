/**
 * Database Operations Utility
 * 
 * This file centralizes all database operations for user management and usage tracking.
 * Compatible with Express.js, Next.js, and React Native.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RESET_TIMEZONE } from './usageTracking';
import { ANONYMOUS_USAGE_LIMIT, FREE_USER_DAILY_LIMIT} from '../shared/constants';
import { logger } from '../utils/logger';


// Types
export interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  daily_usage: number;
  total_usage: number;
  saved_responses: any[];
  last_used: Date;
  last_reset: Date;
  subscription_type: 'standard' | 'premium';
  subscription_status: 'active' | 'inactive';
  subscription_updated_at: Date;
  is_trial: boolean;
  trial_end_date: Date | null;
  trial_started_at: Date | null;
  subscription_end_date: Date | null;
  trial_ending_soon: boolean;
  stripe_customer_id: string | null;
  cancel_at_period_end: boolean;
  daily_usage_history: Record<string, number>;
}

export interface IPUsage {
  ip_address: string;
  daily_usage: number;
  total_usage: number;
  last_used?: Date;
  last_reset?: string;
}

export interface UsageLimitsResponse {
  canSwipe: boolean;
  isPremium: boolean;
  isTrial: boolean;
  dailySwipes: number;
  requiresUpgrade?: boolean;
  requiresSignIn?: boolean;
  trialEndsAt?: Date;
  error?: string;
}

// Supabase client configuration
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true
        },
        db: {
          schema: 'public'
        }
      }
    );
  }
  return supabaseClient;
}

// Time utilities
function getCurrentPSTTime(): string {
  return new Date().toLocaleString("en-US", { timeZone: RESET_TIMEZONE });
}

function getPSTTimestamp(date: Date | string): number {
  return new Date(new Date(date).toLocaleString("en-US", { timeZone: RESET_TIMEZONE })).getTime();
}

function isPastResetTime(lastResetTime: Date | string): boolean {
  const now = new Date(getCurrentPSTTime());
  const lastReset = new Date(lastResetTime);
  
  const resetTime = new Date(now);
  resetTime.setHours(0, 0, 0, 0);
  
  return lastReset < resetTime;
}

// User operations
export async function getUserData(email: string): Promise<User> {
  try {
    if (!email) {
      throw new Error('Email is required');
    }
    
    const supabase = getSupabaseClient();
    const now = new Date(getCurrentPSTTime());
    const today = now.toISOString();
    
    const nextResetDate = new Date();
    nextResetDate.setDate(nextResetDate.getDate() + 1);
    nextResetDate.setHours(0, 0, 0, 0);
    const nextReset = nextResetDate.toISOString();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();
      
    if (error) {
      logger.error('getUserData failed', {
        error: error.message,
        stack: error.stack,
        email
      });
      throw error;
    }
    
    if (!data) {
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
          cancel_at_period_end: false,
          daily_usage_history: {}
        })
        .select()
        .single();

      if (createError) throw createError;
      return newUser as User;
    }
    
    return data as User;
    
  } catch (error: any) {
    logger.error('getUserData failed', {
      error: error.message,
      stack: error.stack,
      email
    });
    throw error;
  }
}

// IP Usage operations
export async function getIPUsage(ip: string): Promise<IPUsage> {
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
    ]) as { data: IPUsage | null; error: any };

    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return data || { 
      ip_address: ip, 
      daily_usage: 0, 
      total_usage: 0 
    };
  } catch (error: any) {
    logger.error('getIPUsage failed', {
      error: error.message,
      stack: error.stack,
      ip
    });
    throw error;
  }
}

export async function updateIPUsage(
  ip: string, 
  updateData: Partial<IPUsage>
): Promise<{ data: IPUsage | null; error: any }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ip_usage')
    .update(updateData)
    .eq('ip_address', ip)
    .select();

  return { data: data?.[0] || null, error };
}

export async function createIPUsage(data: IPUsage): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ip_usage')
    .insert([data]);

  if (error) throw error;
}

export async function findOrCreateUser(
  email: string, 
  name?: string | null, 
  picture?: string | null, 
  anonymousSwipes: number = 0
): Promise<User> {
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
      return updatedUser as User;
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
          last_used: new Date().toISOString(),
          daily_usage_history: {},
          subscription_type: 'standard',
          subscription_status: 'inactive',
          is_trial: false
        }
      ])
      .select()
      .single();

    if (error) {
      logger.error('Error in findOrCreateUser', {
        error: error.message,
        stack: error.stack,
        email,
        name
      });
      throw error;
    }
    return newUser as User;

  } catch (error: any) {
    logger.error('Error in findOrCreateUser', {
      error: error.message,
      stack: error.stack,
      email,
      name
    });
    throw error;
  }
}

export async function getDailyUsage(email: string): Promise<number> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('users')
    .select('daily_usage')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data?.daily_usage || 0;
}

export async function resetDailyUsage(email: string): Promise<void> {
  const supabase = getSupabaseClient();
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
    if (currentUser && currentUser.daily_usage > 0) {
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

export async function checkAndResetUsage(
  identifier: string, 
  isEmail: boolean
): Promise<boolean> {
  console.log('Reset Check:', {
    identifier,
    isEmail,
    currentTime: getCurrentPSTTime(),
    timeZone: RESET_TIMEZONE
  });

  const supabase = getSupabaseClient();
  const now = new Date(getCurrentPSTTime());
  const today = now.toISOString();
  
  try {
    if (isEmail) {
      const { data: record, error: getError } = await supabase
        .from('users')
        .select('last_reset, daily_usage, total_usage')
        .eq('email', identifier)
        .single();
      
      if (getError) throw getError;
      
      const shouldReset = !record?.last_reset || isPastResetTime(record.last_reset);
      
      if (shouldReset) {
        await resetDailyUsage(identifier);
        return true;
      }
    } else {
      // Handle IP-based reset
      const { data: record, error: getError } = await supabase
        .from('ip_usage')
        .select('last_reset')
        .eq('ip_address', identifier)
        .single();

      if (getError && getError.code !== 'PGRST116') throw getError;

      const shouldReset = !record?.last_reset || isPastResetTime(record.last_reset);

      if (shouldReset) {
        const { error: updateError } = await supabase
          .from('ip_usage')
          .update({
            daily_usage: 0,
            last_reset: today
          })
          .eq('ip_address', identifier);

        if (updateError) throw updateError;
        return true;
      }
    }
    
    return false;
  } catch (error: any) {
    logger.error('Error in checkAndResetUsage', {
      error: error.message,
      stack: error.stack,
      identifier,
      isEmail
    });
    throw error;
  }
}

export async function incrementUsage(
  identifier: string, 
  isEmail: boolean = false
): Promise<UsageLimitsResponse> {
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
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('daily_usage, total_usage, daily_usage_history')
        .eq('email', identifier)
        .single();

      if (fetchError) throw fetchError;

      const currentHistory = currentUser?.daily_usage_history || {};
      currentHistory[today] = (currentHistory[today] || 0) + 1;

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
        
      if (updateError) throw updateError;

      return { ...limitCheck, dailySwipes: updatedUser.daily_usage };
    } else {
      // Handle IP-based increment
      const { data: ipData, error: getError } = await supabase
        .from('ip_usage')
        .select('daily_usage, total_usage')
        .eq('ip_address', identifier)
        .single();
        
      if (getError) {
        if (getError.code === 'PGRST116') {
          const { data, error } = await supabase
            .from('ip_usage')
            .upsert({
              ip_address: identifier,
              daily_usage: 1,
              total_usage: 1,
              last_used: now,
              last_reset: today
            })
            .select();
            
          if (error) throw error;
          return { ...limitCheck, dailySwipes: 1 };
        }
        throw getError;
      }
      
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
  } catch (error: any) {
    logger.error('Error incrementing usage', {
      error: error.message,
      stack: error.stack,
      identifier,
      isEmail
    });
    throw error;
  }
}

export async function checkUsageLimits(
  identifier: string, 
  isEmail: boolean = false
): Promise<UsageLimitsResponse> {
  const supabase = getSupabaseClient();
  
  try {
    if (isEmail) {
      const { data: userData } = await supabase
        .from('users')
        .select('daily_usage, subscription_status, is_trial, trial_end_date')
        .eq('email', identifier)
        .single();

      if (!userData) return { error: 'User not found' } as UsageLimitsResponse;

      const now = new Date();
      const isTrialActive = userData?.is_trial && 
        userData?.trial_end_date && 
        new Date(userData.trial_end_date) > now;

      if (userData.subscription_status === 'active' || isTrialActive) {
        return {
          canSwipe: true,
          isPremium: userData.subscription_status === 'active',
          isTrial: isTrialActive,
          dailySwipes: userData.daily_usage || 0,
          ...(isTrialActive && { trialEndsAt: userData.trial_end_date })
        };
      }

      return {
        canSwipe: (userData.daily_usage || 0) < FREE_USER_DAILY_LIMIT,
        isPremium: false,
        isTrial: false,
        dailySwipes: userData.daily_usage || 0,
        requiresUpgrade: (userData.daily_usage || 0) >= FREE_USER_DAILY_LIMIT
      };
    }

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

  } catch (error: any) {
    logger.error('Error checking usage limits', {
      error: error.message,
      stack: error.stack,
      identifier,
      isEmail
    });
    throw error;
  }
}