import { initializeApp } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';
import { getReactNativePersistence } from 'firebase/auth/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDdCX_FkVINtXe_fHReoZ4FPgDoez3gaU4",
  authDomain: "smooth-450006.firebaseapp.com",
  projectId: "smooth-450006",
  storageBucket: "smooth-450006.firebasestorage.app",
  messagingSenderId: "776336590279",
  appId: "1:776336590279:ios:ce5a62ea3bf08d0adf85e2",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

console.log('Initializing Firebase...');
console.log('Firebase app initialized:', !!app);


