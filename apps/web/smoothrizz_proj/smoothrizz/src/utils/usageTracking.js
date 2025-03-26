/**
 * Usage Tracking Utilities
 * 
 * This file provides centralized usage tracking and management functions.
 * 
 * Main Features:
 * - Usage status checking
 * - Premium/trial status verification
 * - Usage limit enforcement
 * 
 * Dependencies:
 * - @supabase/supabase-js: For database operations
 * - @/app/constants: For usage limits
 * 
 * Side Effects:
 * - Updates usage records in database
 * - Manages daily usage resets
 * 
 * Connected Files:
 * - src/app/api/usage/route.js: Uses these utilities
 * - src/app/api/swipes/route.js: Tracks swipe usage
 * - src/utils/dbOperations.js: Database operations
 */

import { createClient } from '@supabase/supabase-js';
import { 
  ANONYMOUS_USAGE_LIMIT, 
  FREE_USER_DAILY_LIMIT,
  PREMIUM_INCREMENT_PER_RESPONSE,
  FREE_INCREMENT_PER_RESPONSE,
  PREMIUM_MAX_PERCENTAGE,
  FREE_MAX_PERCENTAGE,
  MIN_LEARNING_PERCENTAGE
} from '@/app/constants';
import { getUserData, getIPUsage, findOrCreateUser } from './dbOperations';

let supabaseClient = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        db: {
          schema: 'public',
          connectionTimeout: 10000, // 10 seconds
          queryTimeout: 15000 // 15 seconds
        }
      }
    );
  }
  return supabaseClient;
}

export async function checkUsageStatus(identifier, isEmail, name = null, picture = null) {
  try {
    console.log('Checking usage for:', { identifier, isEmail });
    
    // Validate isEmail parameter matches identifier format
    if (isEmail && !identifier.includes('@')) {
      console.error('Invalid email format:', identifier);
      throw new Error('Invalid email format');
    }
    
    if (!isEmail && identifier.includes('@')) {
      console.error('IP address contains @:', identifier);
      throw new Error('Invalid IP address format');
    }
    
    if (isEmail) {
      // Use findOrCreateUser instead of direct database operations
      const userData = await findOrCreateUser(identifier, name, picture);
      
      const now = new Date();
      const isTrialActive = userData?.is_trial && 
        userData?.trial_end_date && 
        new Date(userData.trial_end_date) > now;

      return { 
        isPremium: userData?.subscription_status === 'active',
        isTrial: isTrialActive,
        limitReached: false,
        dailySwipes: userData?.daily_usage || 0,
        ...(isTrialActive && {
          trialEndsAt: userData.trial_end_date
        })
      };
    }
    
    // Handle IP-based usage check
    const ipData = await getIPUsage(identifier);
    return {
      isPremium: false,
      isTrial: false,
      limitReached: false,
      dailySwipes: ipData?.daily_usage || 0
    };
  } catch (error) {
    console.error('Error in checkUsageStatus:', error);
    throw error;
  }
}

export const RESET_TIMEZONE = 'America/Los_Angeles';

export function getNextResetTime() {
  const now = new Date();
  const pstDate = new Date(now.toLocaleString('en-US', { timeZone: RESET_TIMEZONE }));
  const tomorrow = new Date(pstDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

export function getFormattedTimeUntilReset() {
  const now = new Date();
  const nextReset = getNextResetTime();
  const diffMs = nextReset - now;
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${hours}h ${minutes}m`;
}

/**
 * Converts a File object to a base64 string
 * @param {File} file - The file to convert
 * @returns {Promise<string>} A promise that resolves with the base64 string
 */
export function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

/**
 * Gets user's learning percentage and related data
 * @param {string} email - User's email
 * @returns {Promise<Object>} Learning percentage data
 */
export async function getLearningPercentage(email) {
  if (!email) {
    return { percentage: MIN_LEARNING_PERCENTAGE };
  }

  const supabase = getSupabaseClient();

  try {
    // Single query to get all needed user data
    const { data: userData, error } = await supabase
      .from('users')
      .select('subscription_status, is_trial, trial_end_date, saved_responses')
      .eq('email', email)
      .single();

    if (error) {
      console.error('Error fetching user data:', error);
      return { percentage: MIN_LEARNING_PERCENTAGE };
    }

    const savedResponsesCount = userData?.saved_responses?.length ?? 0;
    const now = new Date();
    const hasActiveSubscription = 
      userData?.subscription_status === 'active' || 
      (userData?.is_trial && userData?.trial_end_date && new Date(userData.trial_end_date) > now);

    const incrementPerResponse = hasActiveSubscription ? PREMIUM_INCREMENT_PER_RESPONSE : FREE_INCREMENT_PER_RESPONSE;
    const maxPercentage = hasActiveSubscription ? PREMIUM_MAX_PERCENTAGE : FREE_MAX_PERCENTAGE;
    
    const percentage = Math.min(
      savedResponsesCount * incrementPerResponse,
      maxPercentage
    );

    return {
      percentage: Math.max(percentage, MIN_LEARNING_PERCENTAGE),
      savedResponsesCount,
      debug: {
        increment: incrementPerResponse,
        max: maxPercentage,
        calculated: savedResponsesCount * incrementPerResponse,
        final: percentage
      }
    };
  } catch (error) {
    console.error('Error in getLearningPercentage:', error);
    return { percentage: MIN_LEARNING_PERCENTAGE };
  }
} 