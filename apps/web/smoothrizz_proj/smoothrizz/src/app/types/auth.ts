export interface GoogleSignInProps {
  googleLoaded: boolean;
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

export interface GoogleAccount {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }) => void;
      renderButton: (element: HTMLElement, options: {
        theme: string;
        size: string;
      }) => void;
      disableAutoSelect: () => void;
      revoke: (email: string, callback: () => void) => void;
    };
  };
} 