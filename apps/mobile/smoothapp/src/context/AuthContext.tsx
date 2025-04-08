import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithCredential, User } from 'firebase/auth';
import { auth } from '../config/firebase';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

// Register for native authentication - only in non-web environments
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

// Get client IDs from Expo config
const EXPO_CLIENT_ID = Constants.expoConfig?.extra?.EXPO_CLIENT_ID;
const IOS_CLIENT_ID = Constants.expoConfig?.extra?.IOS_CLIENT_ID;
const ANDROID_CLIENT_ID = Constants.expoConfig?.extra?.ANDROID_CLIENT_ID;

// Create redirect URI
const redirectUri = makeRedirectUri({
  scheme: 'com.smoothrizz.app'
});

// Add detailed debug logging
console.log('=== Google Auth Debug Info ===');
console.log('Redirect URI:', redirectUri);
console.log('Platform:', Platform.OS);
console.log('Client IDs:', {
  ios: IOS_CLIENT_ID,
  android: ANDROID_CLIENT_ID,
  expo: EXPO_CLIENT_ID
});

console.log('Google Auth Configuration:', { 
  EXPO_CLIENT_ID, 
  IOS_CLIENT_ID, 
  ANDROID_CLIENT_ID,
  redirectUri 
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

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: EXPO_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID || "776336590279-oe5g4kldq8hkc0bn052rs9k8f6eet900.apps.googleusercontent.com",
    androidClientId: ANDROID_CLIENT_ID,
    webClientId: EXPO_CLIENT_ID,
    redirectUri,
  });

  useEffect(() => {
    console.log('Setting up Firebase auth listener');
    const unsubscribe = auth.onAuthStateChanged((user) => {
      console.log('Auth state changed:', { user: user?.email, isUser: !!user });
      setUser(user);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      console.log('Auth successful, getting credentials...');
      const { id_token } = response.params;
      
      if (id_token) {
        console.log('Creating credential from id_token...');
        const credential = GoogleAuthProvider.credential(id_token);
        signInWithCredential(auth, credential).catch((error) => {
          console.error('Error signing in with credential:', error);
        });
      } else {
        console.error('No id_token in response');
      }
    } else if (response) {
      console.error('Auth response not successful:', response);
    }
  }, [response]);

  const signInWithGoogle = async () => {
    try {
      console.log('Starting Google Sign In...');
      const result = await promptAsync();
      console.log('Sign in result:', result);
      if (result.type !== 'success') {
        throw new Error('Google Sign-In was not successful');
      }
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
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