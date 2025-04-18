import React, { useEffect, useState } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

// Component to handle the navigation stack based ONLY on auth state
function ProtectedLayoutNav() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Check the full path directly
    const isOnboardingLoginScreen = pathname === '/onboarding/step4';
    const isInAuthFlow = pathname === '/login'; // Check if on the old login screen

    console.log('Layout Check:', { isAuthLoading, isAuthenticated, pathname, isOnboardingLoginScreen });

    // Wait only for auth status to load
    if (isAuthLoading) {
      console.log('Waiting for auth loading state...');
      return;
    }

    // If authenticated and on the onboarding login screen, redirect to homepage
    if (isAuthenticated && isOnboardingLoginScreen) {
      console.log('Authenticated on onboarding login, redirecting to homepage...');
      router.replace('/homepage');
      return;
    }
    
    // If not authenticated and NOT on the onboarding login screen, redirect there.
    if (!isAuthenticated && !isOnboardingLoginScreen) {
      console.log('Not authenticated and not on onboarding login, redirecting...');
      router.replace('/onboarding/step4' as any); // Go to the onboarding login screen
      return;
    }
    
    // If authenticated and on the old login screen, redirect to homepage
    if (isAuthenticated && isInAuthFlow) {
        console.log('Authenticated on old login screen, redirecting to homepage...');
        router.replace('/homepage');
        return;
    }
    
    // If not authenticated and on the onboarding login screen, allow them to stay.
    // If authenticated and not on the onboarding login screen (e.g., homepage), allow them to stay.
    console.log('Navigation state checks passed, allowing current route.');

  }, [isAuthLoading, isAuthenticated, pathname, router]);

  // Show loading indicator only for auth check
  if (isAuthLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A0DAD"/>
      </View>
    );
  }

  // Render the stack - always include onboarding now
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Onboarding stack is always present */}
      <Stack.Screen name="onboarding" /> 
      
      {/* Main App Screens (Access controlled by redirect logic above) */}
      <Stack.Screen name="homepage" />
      <Stack.Screen name="upload" options={{
          title: 'Upload Screenshot'
      }} />
      <Stack.Screen name="choose-context" options={{
          title: 'Choose Context'
      }} />
      <Stack.Screen name="swipes-page" options={{
          title: 'Your Rizzponses'
      }} />
      {/* Keep the old login screen definition but logic redirects away if authenticated */}
      <Stack.Screen name="login" /> 

      {/* Index route might be needed if landing page isn't onboarding/login */}
       {/* <Stack.Screen name="index" /> */}
    </Stack>
  );
}

// Main Root Layout component
export default function RootLayout() {
  return (
    <AuthProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ProtectedLayoutNav />
      </GestureHandlerRootView>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff', // Optional: set a background color
  }
});
