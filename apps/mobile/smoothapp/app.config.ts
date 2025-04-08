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
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.smoothrizz.app',
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff'
      },
      package: 'com.smoothrizz.app',
      googleServicesFile: './google-services.json'
    },
    web: {
      favicon: './assets/images/favicon.png'
    },
    plugins: [
      'expo-router',
      '@react-native-firebase/app',
      '@react-native-google-signin/google-signin',
      [
        'expo-build-properties',
        {
          ios: {
            useFrameworks: 'static'
          }
        }
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff'
        }
      ]
    ],
    scheme: 'com.smoothrizz.app',
    extra: {
      ...ENV,
      eas: {
        projectId: "516e82d4-ffbd-44b6-8673-653a5d453620",
      }
    },
    experiments: {
      typedRoutes: true
    },
  };
}; 