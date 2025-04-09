import { View, Text, Platform, TextInput, Alert } from 'react-native';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Button } from '../src/components/Button';
import * as AppleAuthentication from 'expo-apple-authentication';
import { StyleSheet, ActivityIndicator } from 'react-native';

export default function LoginScreen() {
  const { 
    signInWithGoogle,
    signInWithApple, 
    signInWithEmail, 
    signUpWithEmail, 
    isLoading 
  } = useAuth();
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      // Navigation will be handled by RootLayout
      // router.replace('/profile'); // Keep commented out
    } catch (error) {
      console.error('Error signing in with Google:', error);
      // Optionally show an error message to the user here
      // Alert.alert('Google Sign In Failed', 'Could not sign in with Google.');
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple();
      // Navigation to 'homepage' will be handled by the RootLayout based on isAuthenticated changing
    } catch (error) {
      console.error('Login failed:', error);
      // Optionally show an error message to the user
    }
  };

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    try {
      await signInWithEmail(email, password);
      // router.replace('/profile'); // Removed navigation call
    } catch (error: any) {
      console.error('Error signing in with email:', error);
      Alert.alert('Sign In Failed', error.message || 'Could not sign in with email and password.');
    }
  };

  const handleEmailSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    try {
      await signUpWithEmail(email, password);
      // router.replace('/profile'); // Removed navigation call
    } catch (error: any) {
      console.error('Error signing up with email:', error);
      Alert.alert('Sign Up Failed', error.message || 'Could not create account with email and password.');
    }
  };

  // Only show Apple Sign-In button on iOS
  if (Platform.OS !== 'ios') {
    return (
      <View style={styles.container}>
        <Text>Apple Sign-In is only available on iOS.</Text>
        {/* Add other login methods here if needed */}
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-white p-4">
      <Text className="text-3xl font-bold mb-2">SmoothRizz</Text>
      <Text className="text-lg text-gray-600 mb-8">Your Personal Fitness Journey</Text>
      
      <TextInput
        className="w-full max-w-xs border border-gray-300 rounded p-2 mb-3"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        className="w-full max-w-xs border border-gray-300 rounded p-2 mb-4"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button
        onPress={handleEmailSignIn}
        disabled={isLoading}
        className="w-full max-w-xs mb-2"
      >
        {isLoading ? 'Signing in...' : 'Sign In with Email'}
      </Button>

      <Button
        onPress={handleEmailSignUp}
        disabled={isLoading}
        variant="outline"
        className="w-full max-w-xs mb-4"
      >
        {isLoading ? 'Signing up...' : 'Sign Up with Email'}
      </Button>

      <Button
        onPress={handleGoogleSignIn}
        disabled={isLoading}
        className="w-full max-w-xs mb-4"
      >
        {isLoading ? 'Signing in...' : 'Sign in with Google'}
      </Button>

      {isLoading && Platform.OS === 'ios' ? (
        <ActivityIndicator size="large" />
      ) : (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={5}
          style={styles.appleButton}
          onPress={handleAppleSignIn}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  appleButton: {
    width: 200,
    height: 44,
  },
}); 