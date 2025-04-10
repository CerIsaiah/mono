// @ts-check

/**
 * @param {import('expo/config').ConfigContext} configContext
 * @returns {import('expo/config').ExpoConfig}
 */
module.exports = ({ config }) => {
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
    IOS_GOOGLE_SIGN_IN_CLIENT_ID: process.env.IOS_GOOGLE_SIGN_IN_CLIENT_ID,
    IOS_GOOGLE_APP_ID: process.env.IOS_GOOGLE_APP_ID,
    IOS_GCK_DEFAULT_CHANNEL_ID: process.env.IOS_GCK_DEFAULT_CHANNEL_ID,
    IOS_GOOGLE_SIGN_IN_REVERSED_CLIENT_ID: process.env.IOS_GOOGLE_SIGN_IN_REVERSED_CLIENT_ID,
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

  // Construct the Google Reversed Client ID scheme, handling potential undefined values
  const googleReversedClientIdScheme = ENV.IOS_GOOGLE_SIGN_IN_REVERSED_CLIENT_ID
    ? `com.googleusercontent.apps.${ENV.IOS_GOOGLE_SIGN_IN_REVERSED_CLIENT_ID.split(".").pop()}`
    : undefined; // Explicitly set to undefined if missing

  /** @type {import('expo/config').ExpoConfig} */
  const expoConfig = {
    ...config,
    name: 'SmoothRizz',
    slug: 'smoothrizz',
    version: '1.0.0',
    orientation: 'portrait', // Explicitly set as allowed value
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
      ...(config.ios ?? {}), // Merge with existing ios config or default to empty obj
      infoPlist: {
        ...(config.ios?.infoPlist ?? {}), // Merge with existing infoPlist
        GOOGLE_SIGN_IN_CLIENT_ID: ENV.IOS_GOOGLE_SIGN_IN_CLIENT_ID,
        SKAdNetworkItems: [{ SKAdNetworkIdentifier: "cstr6suwn9.skadnetwork" }],
        GOOGLE_APP_ID: ENV.IOS_GOOGLE_APP_ID,
        GCKDefaultChannelID: ENV.IOS_GCK_DEFAULT_CHANNEL_ID,
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              googleReversedClientIdScheme,
              'com.smoothrizz.app',
              ENV.IOS_GOOGLE_SIGN_IN_REVERSED_CLIENT_ID
            ].filter(/** @returns {scheme is string} */ (scheme) => !!scheme), // Use filter(Boolean) with type predicate
          },
          // Add other existing URL types from config if necessary
          ...(config.ios?.infoPlist?.CFBundleURLTypes?.filter(t => t !== undefined) ?? []),
        ],
      },
      entitlements: {
        ...(config.ios?.entitlements ?? {}),
        "com.apple.developer.applesignin": ["Default"],
      },
      config: {
        ...(config.ios?.config ?? {}),
        usesNonExemptEncryption: false,
      },
      bundleIdentifier: "com.smoothrizz.app",
      googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST_PATH || './GoogleService-Info.plist', // Allow overriding path via env
      supportsTablet: true,
    },
    android: {
      ...(config.android ?? {}),
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff'
      },
      package: 'com.smoothrizz.app',
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON_PATH || './google-services.json'
    },
    web: {
      ...(config.web ?? {}),
      favicon: './assets/images/favicon.png'
    },
    plugins: [
      'expo-router',
      // '@react-native-firebase/app',
      // '@react-native-google-signin/google-signin',
      // 'expo-in-app-purchases',
      [
        'expo-build-properties',
        {
          ios: {
            useFrameworks: 'static',
            deploymentTarget: "15.1"
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
      ],
      ...(config.plugins ?? []).filter(p => p !== undefined) // Merge existing plugins
    ],
    scheme: 'com.smoothrizz.app',
    extra: {
      ...(config.extra ?? {}),
      ...ENV,
      eas: {
        ...(config.extra?.eas ?? {}),
        projectId: "516e82d4-ffbd-44b6-8673-653a5d453620",
      }
    },
    experiments: {
      ...(config.experiments ?? {}),
      typedRoutes: true
    },
  };

  return expoConfig;
}; 