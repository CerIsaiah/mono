/**
 * Usage Tracking Utilities
 * TypeScript version compatible with Express.js, Next.js, and React Native
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  ANONYMOUS_USAGE_LIMIT, 
  FREE_USER_DAILY_LIMIT,
  PREMIUM_INCREMENT_PER_RESPONSE,
  FREE_INCREMENT_PER_RESPONSE,
  PREMIUM_MAX_PERCENTAGE,
  FREE_MAX_PERCENTAGE,
  MIN_LEARNING_PERCENTAGE
} from '../shared/constants';
import { getUserData, getIPUsage, findOrCreateUser } from './dbOperations';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getClientIP } from '../utils/ipUtils';

// Types
export interface UsageStatus {
  dailySwipes: number;
  totalSwipes: number;
  isPremium: boolean;
  isTrial: boolean;
  wasReset?: boolean;
  trialEndsAt?: Date;
}

export interface LearningPercentageResponse {
  percentage: number;
  savedResponsesCount?: number;
  debug?: {
    increment: number;
    max: number;
    calculated: number;
    final: number;
  };
}

// Supabase client configuration
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
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
          schema: 'public',
        }
      }
    );
  }
  return supabaseClient;
}

export const RESET_TIMEZONE = 'America/Los_Angeles';

export async function checkUsageStatus(
  identifier: string, 
  isEmail: boolean, 
  name?: string | null, 
  picture?: string | null
): Promise<UsageStatus> {
  try {
    if (isEmail && !identifier.includes('@')) {
      throw new Error('Invalid email format');
    }
    
    if (!isEmail && identifier.includes('@')) {
      throw new Error('Invalid IP address format');
    }
    
    if (isEmail) {
      const userData = await findOrCreateUser(identifier, name || null, picture || null);
      
      const now = new Date();
      const isTrialActive = userData?.is_trial && 
        userData?.trial_end_date && 
        new Date(userData.trial_end_date) > now;

      return { 
        isPremium: userData?.subscription_status === 'active',
        isTrial: isTrialActive ?? false,
        dailySwipes: userData?.daily_usage || 0,
        totalSwipes: userData?.total_usage || 0,
        ...(isTrialActive && userData?.trial_end_date && {
          trialEndsAt: userData.trial_end_date
        })
      };
    }
    
    const ipData = await getIPUsage(identifier);
    return {
      isPremium: false,
      isTrial: false,
      dailySwipes: ipData?.daily_usage || 0,
      totalSwipes: ipData?.total_usage || 0
    };
  } catch (error) {
    console.error('Error in checkUsageStatus:', error);
    throw error;
  }
}

export function getNextResetTime(): Date {
  const now = new Date();
  const pstDate = new Date(now.toLocaleString('en-US', { timeZone: RESET_TIMEZONE }));
  const tomorrow = new Date(pstDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

export function getFormattedTimeUntilReset(): string {
  const now = new Date();
  const nextReset = getNextResetTime();
  const diffMs = nextReset.getTime() - now.getTime();
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${hours}h ${minutes}m`;
}

export function convertFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

export async function getLearningPercentage(email?: string): Promise<LearningPercentageResponse> {
  if (!email) {
    return { percentage: MIN_LEARNING_PERCENTAGE };
  }

  const supabase = getSupabaseClient();

  try {
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

// Express middleware for usage tracking
interface CustomRequest extends Request {
  user?: {
    email?: string;
    name?: string;
    picture?: string;
  };
  ip: string;
  usageData?: {
    status: UsageStatus;
    identifier: string;
    isEmail: boolean;
  };
}

export const trackUsageMiddleware = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const identifier = req.user?.email || getClientIP(req) || 'anonymous';
    const isEmail = !!req.user?.email;

    const status = await checkUsageStatus(
      identifier,
      isEmail,
      req.user?.name,
      req.user?.picture
    );

    req.usageData = {
      status,
      identifier,
      isEmail
    };

    next();
  } catch (error) {
    console.error('Usage tracking middleware error:', error);
    next(error);
  }
};

// Error handling middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
};