import { AuthProvider } from './src/context/AuthContext';
import { Slot } from 'expo-router';

export default function App() {
  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  );
} 