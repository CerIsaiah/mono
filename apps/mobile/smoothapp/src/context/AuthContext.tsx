import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithCredential, User } from 'firebase/auth';
import { auth } from '../config/firebase';
import * as Google from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

// Configure Google Sign In with correct Firebase iOS credentials
Google.GoogleSignin.configure({
  iosClientId: "776336590279-oe5g4kldq8hkc0bn052rs9k8f6eet900.apps.googleusercontent.com", // iOS client ID from Firebase
  webClientId: "776336590279-smtdk7kivb7igahtl03e5tpnvj8f1oap.apps.googleusercontent.com", // Web client ID from Firebase
  offlineAccess: true,
});

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('Setting up Firebase auth listener');
    const unsubscribe = auth.onAuthStateChanged((user) => {
      console.log('Auth state changed:', { user: user?.email, isUser: !!user });
      setUser(user);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      console.log('Starting Google Sign In...');
      
      // Check if Play Services are available (Android only)
      if (Platform.OS === 'android') {
        await Google.GoogleSignin.hasPlayServices();
      }
      
      // Sign in with Google
      await Google.GoogleSignin.signIn();
      const { accessToken, idToken } = await Google.GoogleSignin.getTokens();
      
      if (idToken && accessToken) {
        console.log('Got tokens, creating credential...');
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        await signInWithCredential(auth, credential);
      } else {
        throw new Error('Failed to get necessary tokens from Google Sign In');
      }
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await Google.GoogleSignin.signOut();
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    signInWithGoogle,
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