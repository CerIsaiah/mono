import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Button } from '../src/components/Button';

export default function LoginScreen() {
  const { signInWithGoogle, isLoading } = useAuth();
  const router = useRouter();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      router.replace('/profile');
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white p-4">
      <Text className="text-3xl font-bold mb-2">SmoothRizz</Text>
      <Text className="text-lg text-gray-600 mb-8">Your Personal Fitness Journey</Text>
      
      <Button
        onPress={handleSignIn}
        disabled={isLoading}
        className="w-full max-w-xs"
      >
        {isLoading ? 'Signing in...' : 'Sign in with Google'}
      </Button>
    </View>
  );
} 