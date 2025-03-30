export interface GoogleSignInProps {
  onClose?: () => void;
  onSignInSuccess?: (response: GoogleAuthResponse) => void;
  preventReload?: boolean;
}

export interface GoogleAuthResponse {
  credential: string;
  user?: {
    email: string;
    name?: string;
    picture?: string;
  };
} 