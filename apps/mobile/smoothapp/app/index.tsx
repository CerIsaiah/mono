import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function Index() {
  const { isAuthenticated } = useAuth();
  
  console.log('Index page state:', { isAuthenticated });

  console.log('Redirecting to:', isAuthenticated ? '/profile' : '/login');
  
  if (isAuthenticated) {
    return <Redirect href="/profile" />;
  }

  return <Redirect href="/login" />;
} 