import React, { useState } from 'react';
import {
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Linking, 
  TextInput, 
  Alert, 
  Platform,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext'; // Adjusted path
import { Button } from '../../src/components/Button'; // Adjusted path
import * as AppleAuthentication from 'expo-apple-authentication';

const OnboardingStep4 = () => {
  const router = useRouter(); // Although router is here, navigation is handled by RootLayout
  const { 
    signInWithGoogle,
    signInWithApple, 
    signInWithEmail, 
    signUpWithEmail, 
    isLoading 
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      // RootLayout handles navigation on auth state change
    } catch (error) {
      console.error('Error signing in with Google:', error);
      Alert.alert('Google Sign In Failed', 'Could not sign in with Google.');
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple();
      // RootLayout handles navigation on auth state change
    } catch (error) {
      console.error('Apple Sign In failed:', error);
      Alert.alert('Apple Sign In Failed', 'Could not sign in with Apple.');
    }
  };

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    try {
      await signInWithEmail(email, password);
      // RootLayout handles navigation on auth state change
    } catch (error: any) {
      console.error('Error signing in with email:', error);
      Alert.alert('Sign In Failed', error.message || 'Could not sign in.');
    }
  };

  const handleEmailSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    try {
      await signUpWithEmail(email, password);
      // RootLayout handles navigation on auth state change
    } catch (error: any) {
      console.error('Error signing up with email:', error);
      Alert.alert('Sign Up Failed', error.message || 'Could not create account.');
    }
  };

  // Optional: Link handling for Terms/Privacy
  const termsUrl = 'https://example.com/terms';
  const privacyUrl = 'https://example.com/privacy';
  const openLink = (url: string) => {
    Linking.openURL(url).catch((err) => console.error('Failed to open URL:', err));
  };

  return (
    <View style={styles.container}>
      {/* Optional: Keep Robot Image? */}
      <Image
        // source={require('../../assets/images/robot.png')}
        style={styles.robot}
      />

      <Text style={styles.title}>Get Started</Text>
      <Text style={styles.description}>Create an account or sign in to continue.</Text>

      {/* Email Input */}
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor="#ccc"
      />

      {/* Password Input */}
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor="#ccc"
      />

      {/* Email Sign In Button */}
      <Button
        onPress={handleEmailSignIn}
        disabled={isLoading}
        style={styles.button}
        textStyle={styles.buttonText}
      >
        {isLoading ? 'Signing in...' : 'Sign In with Email'}
      </Button>

      {/* Email Sign Up Button */}
      <Button
        onPress={handleEmailSignUp}
        disabled={isLoading}
        variant="outline" // Assuming Button supports variants like your login page
        style={[styles.button, styles.outlineButton]}
        textStyle={[styles.buttonText, styles.outlineButtonText]}
      >
        {isLoading ? 'Signing up...' : 'Sign Up with Email'}
      </Button>

      {/* Google Sign In Button */}
      <Button
        onPress={handleGoogleSignIn}
        disabled={isLoading}
        style={styles.button} // Reuse styles or create specific ones
        textStyle={styles.buttonText}
      >
        {isLoading ? 'Signing in...' : 'Sign in with Google'}
      </Button>

      {/* Apple Sign In Button (iOS Only) */}
      {Platform.OS === 'ios' && (
        isLoading ? (
          <ActivityIndicator size="large" color="#fff" style={styles.appleButtonSpacing} />
        ) : (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE} // White style for purple background
            cornerRadius={5}
            style={[styles.button, styles.appleButton, styles.appleButtonSpacing]}
            onPress={handleAppleSignIn}
          />
        )
      )}

      {/* Terms and Privacy Links */}
      <View style={styles.linksContainer}>
        <TouchableOpacity onPress={() => openLink(termsUrl)}>
          <Text style={styles.linkText}>Terms of Service</Text>
        </TouchableOpacity>
        <Text style={styles.linkSeparator}>and</Text>
        <TouchableOpacity onPress={() => openLink(privacyUrl)}>
          <Text style={styles.linkText}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center', // Center content vertically
    backgroundColor: '#6A0DAD', 
    padding: 20,
  },
  robot: { // Optional styling if keeping the robot
    width: 100,
    height: 100,
    resizeMode: 'contain',
    backgroundColor: '#eee', // Placeholder
    marginBottom: 20,
  },
  title: {
    fontSize: 28, // Slightly larger title
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    width: '90%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    width: '90%',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#fff', // Default button background
  },
  buttonText: {
    color: '#6A0DAD', // Default button text color
    fontSize: 16,
    fontWeight: 'bold',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#fff',
  },
  outlineButtonText: {
    color: '#fff',
  },
  appleButton: {
     height: 50, // Match height consistency
     backgroundColor: '#fff', // Ensure background for Apple button style
  },
   appleButtonSpacing: {
    marginTop: 5, // Add slight spacing for Apple button
    marginBottom: 10, // Match bottom margin
  },
  linksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20, // Add space above links
  },
  linkText: {
    color: '#fff',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  linkSeparator: {
    color: '#fff',
    fontSize: 12,
    marginHorizontal: 5,
  },
});

export default OnboardingStep4;
