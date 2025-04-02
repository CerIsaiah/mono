// Define common subscription types for consistent usage across the application

// Define valid subscription status types
export type SubscriptionStatusType = 'free' | 'trial' | 'premium' | 'trial-canceling' | 'canceling';

// Subscription details object
export interface SubscriptionDetails {
  type: 'standard' | 'premium';
  isTrialActive: boolean;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  hadTrial: boolean;
  isCanceled: boolean;
  canceledDuringTrial: boolean;
}

// Subscription debug info
export interface SubscriptionDebugInfo {
  subscription_status: 'active' | 'inactive';
  subscription_type: 'standard' | 'premium';
  is_trial: boolean;
  cancel_at_period_end: boolean;
  error?: string;
  userEmail?: string;
  userId?: string;
  stack?: string;
}

// Complete subscription response from API
export interface SubscriptionResponse {
  status: SubscriptionStatusType;
  details: SubscriptionDetails;
  usage: {
    daily: number;
    total: number;
  };
  debug?: SubscriptionDebugInfo;
}

// Default free subscription response for error fallback
export const DEFAULT_FREE_SUBSCRIPTION: SubscriptionResponse = {
  status: 'free',
  details: {
    type: 'standard',
    isTrialActive: false,
    trialEndsAt: null,
    subscriptionEndsAt: null,
    hadTrial: false,
    isCanceled: false,
    canceledDuringTrial: false
  },
  usage: {
    daily: 0,
    total: 0
  },
  debug: {
    subscription_status: 'inactive',
    subscription_type: 'standard',
    is_trial: false,
    cancel_at_period_end: false,
    error: 'Using default free subscription due to error'
  }
};

// Helper function to determine if a status is considered "premium"
export const isPremiumStatus = (status: SubscriptionStatusType): boolean => {
  return status === 'premium' || status === 'trial';
};

// Common function to check subscription status
export const checkSubscriptionStatus = async (
  userEmail: string, 
  apiBaseUrl: string
): Promise<SubscriptionResponse> => {
  try {
    console.log(`Checking subscription status for ${userEmail}`);
    
    if (!userEmail) {
      console.error('No userEmail provided to check subscription status');
      return {
        ...DEFAULT_FREE_SUBSCRIPTION,
        debug: {
          ...DEFAULT_FREE_SUBSCRIPTION.debug!,
          error: 'No userEmail provided'
        }
      };
    }
    
    const response = await fetch(`${apiBaseUrl}/api/subscription/status?userEmail=${encodeURIComponent(userEmail)}`);
    
    if (!response.ok) {
      console.error(`Subscription status API error: ${response.status} ${response.statusText}`);
      return {
        ...DEFAULT_FREE_SUBSCRIPTION,
        debug: {
          ...DEFAULT_FREE_SUBSCRIPTION.debug!,
          error: `API error: ${response.status}`,
          userEmail
        }
      };
    }
    
    const data = await response.json();
    
    if (!data || !data.status || !data.details) {
      console.error('Invalid subscription data received', data);
      return {
        ...DEFAULT_FREE_SUBSCRIPTION,
        debug: {
          ...DEFAULT_FREE_SUBSCRIPTION.debug!,
          error: 'Invalid data structure',
          userEmail
        }
      };
    }
    
    console.log(`Subscription status for ${userEmail}: ${data.status}`);
    return data as SubscriptionResponse;
  } catch (error: any) {
    console.error('Error checking subscription status:', error);
    return {
      ...DEFAULT_FREE_SUBSCRIPTION,
      debug: {
        ...DEFAULT_FREE_SUBSCRIPTION.debug!,
        error: error.message || 'Unknown error',
        userEmail,
        stack: error.stack
      }
    };
  }
}; 