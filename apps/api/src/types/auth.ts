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
  
  export interface GoogleSignInProps {
    googleLoaded: boolean;
    onClose?: () => void;
    onSignInSuccess?: () => void;
    preventReload?: boolean;
  }
  
  export interface GoogleAuthPayload {
    email: string;
    name?: string;
    picture?: string;
    sub: string;
  }