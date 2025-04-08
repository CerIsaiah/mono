import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  // Load environment variables
  const ENV = {
    EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    EXPO_CLIENT_ID: process.env.EXPO_CLIENT_ID,
    IOS_CLIENT_ID: process.env.IOS_CLIENT_ID,
    ANDROID_CLIENT_ID: process.env.ANDROID_CLIENT_ID,
  };

  // Log environment variables for debugging
  console.log('=== Environment Variables ===');
  console.log('Firebase Config:', {
    API_KEY: ENV.EXPO_PUBLIC_FIREBASE_API_KEY ? '✓ present' : '✗ missing',
    AUTH_DOMAIN: ENV.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✓ present' : '✗ missing',
    PROJECT_ID: ENV.EXPO_PUBLIC_FIREBASE_PROJECT_ID ? '✓ present' : '✗ missing',
    APP_ID: ENV.EXPO_PUBLIC_FIREBASE_APP_ID ? '✓ present' : '✗ missing'
  });
  console.log('Auth Config:', {
    EXPO_CLIENT_ID: ENV.EXPO_CLIENT_ID ? '✓ present' : '✗ missing',
    IOS_CLIENT_ID: ENV.IOS_CLIENT_ID ? '✓ present' : '✗ missing',
    ANDROID_CLIENT_ID: ENV.ANDROID_CLIENT_ID ? '✓ present' : '✗ missing'
  });

  return {
    ...config,
    name: 'SmoothRizz',
    slug: 'smoothrizz',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.smoothrizz.app'
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff'
      },
      package: 'com.smoothrizz.app'
    },
    web: {
      favicon: './assets/favicon.png'
    },
    plugins: [
      'expo-router'
    ],
    scheme: 'com.smoothrizz.app',
    extra: {
      ...ENV,
      eas: {
        projectId: process.env.EAS_PROJECT_ID
      }
    }
  };
}; 