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

// Complete subscription response from API
export interface SubscriptionResponse {
  status: SubscriptionStatusType;
  details: SubscriptionDetails;
  usage: {
    daily: number;
    total: number;
  };
  debug?: {
    subscription_status: 'active' | 'inactive';
    subscription_type: 'standard' | 'premium';
    is_trial: boolean;
    cancel_at_period_end: boolean;
  };
}

// Helper function to determine if a status is considered "premium"
export const isPremiumStatus = (status: SubscriptionStatusType): boolean => {
  return status === 'premium' || status === 'trial';
};

// Common function to check subscription status
export const checkSubscriptionStatus = async (
  userEmail: string, 
  apiBaseUrl: string
): Promise<SubscriptionResponse> => {
  const response = await fetch(`${apiBaseUrl}/api/subscription/status?userEmail=${encodeURIComponent(userEmail)}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch subscription status: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data || !data.status || !data.details) {
    throw new Error('Invalid subscription data received');
  }
  
  return data as SubscriptionResponse;
}; 