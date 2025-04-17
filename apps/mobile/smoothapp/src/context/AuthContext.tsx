import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { GoogleSignin, statusCodes, type User as GoogleUser } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

// Configure Google Sign In using the direct import
GoogleSignin.configure({
  iosClientId: "776336590279-oe5g4kldq8hkc0bn052rs9k8f6eet900.apps.googleusercontent.com", // iOS client ID from Firebase
  webClientId: "776336590279-smtdk7kivb7igahtl03e5tpnvj8f1oap.apps.googleusercontent.com", // Web client ID from Firebase
  offlineAccess: true,
});

// Define API Base URL (Make sure this matches your backend URL)
const API_BASE_URL = 'https://mono-production-8ef9.up.railway.app';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Function to synchronize Firebase user with the backend database
  const syncUserWithBackend = async (firebaseUser: User | null) => {
    if (!firebaseUser?.email || !firebaseUser?.uid) {
      console.warn('Cannot sync user with backend: missing email or UID.');
      return;
    }

    console.log(`Syncing user ${firebaseUser.email} with backend...`);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/sync-firebase-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add Authorization header if your backend requires it, e.g., using Firebase ID token
          // 'Authorization': `Bearer ${await firebaseUser.getIdToken()}`
        },
        body: JSON.stringify({
          email: firebaseUser.email,
          firebaseUid: firebaseUser.uid,
          // Add any other relevant user info, e.g., displayName
          displayName: firebaseUser.displayName,
        }),
      });

      if (!response.ok) {
        // Handle common errors like user already exists (which might be okay)
        if (response.status === 409) { // Conflict / Already Exists
            console.log(`User ${firebaseUser.email} already exists in backend or sync conflict.`);
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('Backend sync failed:', response.status, errorData);
            // Decide if this should be a critical error. Maybe alert the user?
            // For now, just log it.
        }
      } else {
        console.log(`User ${firebaseUser.email} synced successfully with backend.`);
      }
    } catch (error) {
      console.error('Error syncing user with backend:', error);
      // Handle network errors, etc.
    }
  };

  useEffect(() => {
    console.log('Setting up Firebase auth listener');
    const unsubscribe = auth.onAuthStateChanged(async (user) => { // Make async
      console.log('Auth state changed:', { user: user?.email, isUser: !!user });
      setUser(user);
       // Sync user on initial load if logged in (optional but good practice)
      // if (user) {
      //    await syncUserWithBackend(user);
      // }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      console.log('Starting Google Sign In...');
      
      // Check if Play Services are available (Android only)
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      // Sign in with Google
      console.log('Initiating Google Sign In...');
      const userInfo = await GoogleSignin.signIn();
      console.log('Google Sign In successful:', userInfo);

      // Get tokens immediately after successful sign in
      console.log('Getting tokens...');
      const { accessToken, idToken } = await GoogleSignin.getTokens();
      
      if (!idToken) {
        throw new Error('Failed to get idToken from Google Sign In');
      }

      console.log('Got idToken, creating credential...');
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      console.log('Successfully signed in with Firebase');
      await syncUserWithBackend(userCredential.user);

    } catch (error: any) {
      console.error('Error signing in with Google:', error);
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('User cancelled the sign-in flow');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('Sign-in operation already in progress');
      } else {
        // Clean up any partial sign-in state
        try {
          await GoogleSignin.signOut();
          await auth.signOut();
        } catch (cleanupError) {
          console.error('Cleanup after error failed:', cleanupError);
        }
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithApple = async () => {
    if (Platform.OS !== 'ios') {
        console.warn("Apple Sign In is only available on iOS");
        return;
    }
    setIsLoading(true);
    try {
      console.log('Starting Apple Sign In...');
      
      // Generate a nonce for security
      const nonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );

      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      console.log('Apple credential received:', { fullName: appleCredential.fullName, email: appleCredential.email });

      const { identityToken } = appleCredential;
      if (identityToken) {
        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({
          idToken: identityToken,
          rawNonce: nonce,
        });
        const userCredential = await signInWithCredential(auth, credential); // Get userCredential
        console.log('Successfully signed in with Apple');
        await syncUserWithBackend(userCredential.user); // Sync after successful sign-in
      } else {
        throw new Error('Failed to get identityToken from Apple Sign In');
      }
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
        console.log('Apple Sign In cancelled by user.');
      } else {
        console.error('Error signing in with Apple:', e);
        throw e;
      }
    } finally {
        setIsLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      console.log('Attempting email sign in...');
      await signInWithEmailAndPassword(auth, email, password);
      console.log('Successfully signed in with email');
    } catch (error: any) {
      console.error('Error signing in with email:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      console.log('Attempting email sign up...');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password); // Get userCredential
      console.log('Successfully signed up with email');
      await syncUserWithBackend(userCredential.user); // Sync after successful sign-up
    } catch (error: any) {
      console.error('Error signing up with email:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      // First sign out from Google Sign In
      try {
        const currentUser = await GoogleSignin.getCurrentUser();
        if (currentUser) {
          await GoogleSignin.signOut();
          console.log('Signed out from Google');
        }
      } catch (error) {
        console.error('Error signing out from Google:', error);
      }
      
      // Then sign out from Firebase
      await auth.signOut();
      console.log('Signed out from Firebase');
      
      // Clear any local state
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 