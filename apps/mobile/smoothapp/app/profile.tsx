import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Button } from '../src/components/Button';

export default function ProfileScreen() {
  const { signOut, user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white p-4">
      <Text className="text-2xl font-bold mb-4">Profile</Text>
      {user && (
        <View className="items-center mb-8">
          <Text className="text-lg mb-2">Welcome, {user.displayName}</Text>
          <Text className="text-gray-600">{user.email}</Text>
        </View>
      )}
      <Button onPress={handleSignOut} className="w-full max-w-xs">
        Sign Out
      </Button>
    </View>
  );
}
