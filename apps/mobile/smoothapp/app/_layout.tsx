import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ActivityIndicator, View } from 'react-native';

// Component to handle the navigation stack based on auth state
function ProtectedLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments(); // Gets the current navigation segments
  const router = useRouter();

  useEffect(() => {
    // Wait for auth state to load or sign-in/up process to finish
    if (isLoading) return; 

    const isAuthScreen = segments[0] === 'login'; // Check if the current top-level segment is 'login'

    console.log('Auth Check:', { isLoading, isAuthenticated, segments, isAuthScreen });

    if (!isAuthenticated && !isAuthScreen) {
      // Redirect to the login page if not authenticated and not already on the login screen.
      console.log('Redirecting to login...');
      router.replace('/login');
    } else if (isAuthenticated && isAuthScreen) {
      // Redirect to the main app (homepage) if authenticated and currently on the login screen.
      console.log('Redirecting to homepage...');
      router.replace('/homepage');
    }
    // If authenticated and not on login, or not authenticated and on login, do nothing (allow navigation).

  }, [isLoading, isAuthenticated, segments, router]);

  // Show loading indicator ONLY when isLoading is true (covers initial load and sign-in process)
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Render the stack ONLY when not loading
  return (
    <Stack>
      {/* Screens accessible only when authenticated */}
      <Stack.Screen name="homepage" options={{ headerShown: false }} />
      <Stack.Screen name="upload" options={{
          headerShown: true,
          title: 'Upload Screenshot'
      }} />
      <Stack.Screen name="choose-context" options={{
          headerShown: true,
          title: 'Choose Context'
      }} />
      <Stack.Screen name="swipes-page" options={{
          headerShown: true,
          title: 'Your Rizzponses'
      }} />
      {/* Login screen - accessible when not authenticated */}
      <Stack.Screen name="login" options={{ headerShown: false }} />
      {/* Add other potential screens like forgot-password here if needed */}
    </Stack>
  );
}

// Main Root Layout component
export default function RootLayout() {
  return (
    // Wrap the entire app with AuthProvider
    <AuthProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Use the component that handles auth logic and navigation */}
        <ProtectedLayoutNav />
      </GestureHandlerRootView>
    </AuthProvider>
  );
}
