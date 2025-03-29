export interface UsageStatus {
  dailySwipes: number;
  totalSwipes: number;
  isPremium: boolean;
  isTrial: boolean;
  wasReset?: boolean;
}

export interface SwipeResponse extends UsageStatus {
  canSwipe: boolean;
  requiresSignIn: boolean;
  requiresUpgrade: boolean;
}

export interface SavedResponse {
  response: string;
  context?: string;
  lastMessage?: string;
  created_at: string;
}

export interface SubscriptionDetails {
  type: string | null;
  isTrialActive: boolean;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  hadTrial: boolean;
  isCanceled: boolean;
  canceledDuringTrial: boolean;
}

export interface SubscriptionStatus {
  status: 'free' | 'trial' | 'trial-canceling' | 'premium' | 'canceling';
  details: SubscriptionDetails;
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