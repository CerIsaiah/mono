export interface GoogleUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

export interface GoogleAuthResponse {
  user: GoogleUser;
  dailySwipes: number;
  totalSwipes: number;
  isPremium: boolean;
  isTrial: boolean;
  trialEndsAt?: Date;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: GoogleUser | null;
  dailySwipes: number;
  totalSwipes: number;
  isPremium: boolean;
  isTrial: boolean;
  trialEndsAt?: Date;
  isLoading: boolean;
}

export interface AuthContextType extends AuthState {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
} 