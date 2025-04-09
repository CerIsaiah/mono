import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  Button,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Swiper, type SwiperCardRefType } from 'rn-swiper-list';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';

// Define API Base URL (Hardcoded for clarity based on .env and railway)
const API_BASE_URL = 'https://mono-production-8ef9.up.railway.app';

// Import shared constants if available, or define locally/fetch from backend
// For now, defining a placeholder
const FREE_USER_DAILY_LIMIT = 10; // Example: Replace with actual value/logic
const MIN_LEARNING_PERCENTAGE = 10; // Example

// Define Colors (Consider moving to a shared constants file)
const COLORS = {
  primaryPink: '#E11D74',
  lightPinkBackground: '#FFF0F5',
  white: '#FFFFFF',
  black: '#000000',
  textPrimary: '#333333',
  textSecondary: '#888888',
  errorRed: '#D32F2F',
  lightGray: '#E8E8E8',
  mediumGray: '#CCCCCC',
  darkGray: '#666666',
  premiumGradientStart: '#E11D74', // Pink
  premiumGradientEnd: '#AE2EFF', // Purple (Approximation)
  green: '#4CAF50',
};

// Card Component (Styling adapted from web version)
const ResponseCard = ({ cardText }: { cardText: string }) => (
  <View style={styles.card}>
    <Text style={styles.cardText}>{cardText}</Text>
    {/* Removed swipe indicators, rn-swiper-list uses overlay labels */}
  </View>
);

// Overlay Label Components (Example)
const OverlayLabelLeft = () => (
    <View style={[styles.overlayLabelContainer, styles.overlayLabelLeft]}>
        <Text style={styles.overlayLabelText}>NOPE</Text>
    </View>
);
const OverlayLabelRight = () => (
    <View style={[styles.overlayLabelContainer, styles.overlayLabelRight]}>
        <Text style={styles.overlayLabelText}>SAVE</Text>
    </View>
);

// Simple Loading Modal Component
const LoadingModal = ({ visible }: { visible: boolean }) => (
  <Modal transparent={true} animationType="fade" visible={visible}>
    <View style={styles.loadingModalContainer}>
      <View style={styles.loadingModalContent}>
        <ActivityIndicator size="large" color={COLORS.primaryPink} />
        <Text style={styles.loadingText}>Generating new responses...</Text>
      </View>
    </View>
  </Modal>
);

// Regenerate Popup Component (similar to web)
const RegeneratePopup = (
    { visible, onRegenerate, onClose }: 
    { visible: boolean, onRegenerate: () => void, onClose: () => void }
) => (
  <Modal
    transparent={true}
    animationType="fade"
    visible={visible}
    onRequestClose={onClose} // Allow closing with back button on Android
  >
    <View style={styles.popupOverlay}>
      <View style={styles.popupContainer}>
        <TouchableOpacity style={styles.popupCloseButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.popupTitle}>Generate New Responses</Text>
        <Text style={styles.popupMessage}>
          Would you like to generate fresh responses based on the same input?
        </Text>
        <TouchableOpacity style={styles.popupActionButton} onPress={onRegenerate}>
          <Text style={styles.popupActionButtonText}>Generate Fresh Responses</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const retryOperation = async <T>(
    operation: () => Promise<T>,
    shouldRetry: (error: any) => boolean,
    retries = 3,
    delayMs = 1500 // Increased delay slightly
): Promise<T> => {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Performing operation (Attempt ${i + 1}/${retries})...`);
            return await operation();
        } catch (error) {
            lastError = error;
            if (shouldRetry(error) && i < retries - 1) {
                console.log(`Operation failed with retryable error, retrying in ${delayMs}ms...`, error);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
                console.log(`Operation failed permanently or retries exhausted.`, error);
                throw lastError; // Throw last error if not retryable or retries exhausted
            }
        }
    }
    throw lastError; // Should be unreachable
};

// Helper function to verify user record on the backend
const verifyUserRecord = async (firebaseUser: User): Promise<boolean> => {
    if (!firebaseUser) {
        console.error("Verification attempted without a user.");
        return false;
    }
    console.log(`Verifying backend record for user: ${firebaseUser.email}`);
    try {
      const idToken = await firebaseUser.getIdToken(true); // Force refresh token

      const verifyCall = async () => {
        const response = await fetch(`${API_BASE_URL}/auth/verify`, { // Use your verification endpoint
          method: 'POST', // Or GET, adjust as needed
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
           // body: JSON.stringify({ email: firebaseUser.email }) // Add if needed
        });

        console.log(`Backend verification response status: ${response.status} for ${firebaseUser.email}`);
        if (!response.ok) {
          if (response.status === 404 || response.status >= 500) { // Treat 5xx as potentially temporary
             throw new Error(`User record not ready (Status ${response.status})`);
          }
          const errorData = await response.text();
          throw new Error(`Verification failed: ${response.status} - ${errorData}`);
        }
        return true;
      };

      const shouldRetryVerification = (error: any): boolean => {
          return error instanceof Error && (error.message.includes('User record not ready') || error.message.includes('404') || error.message.includes('500'));
      };

      await retryOperation(verifyCall, shouldRetryVerification, 5, 2000); // Increased retries/delay

      console.log(`Backend record verified for user: ${firebaseUser.email}`);
      return true;

    } catch (error) {
      console.error(`Backend verification failed for user ${firebaseUser.email} after retries:`, error);
      // Maybe alert user or log critical error
       Alert.alert("Account Sync Issue", "There was a problem syncing your account. Please try restarting the app or contact support if the issue persists.");
      return false;
    }
  };

export default function SwipesPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ imageUri: string; context: string }>();
  const { imageUri, context: initialContext } = params;

  const [responses, setResponses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Initial loading
  const [isGenerating, setIsGenerating] = useState<boolean>(false); // Regeneration loading
  const [error, setError] = useState<string | null>(null);
  const swiperRef = useRef<SwiperCardRefType>(null);
  const { user, signOut, isLoading: isAuthLoading } = useAuth(); // Get user from context
  const [isPremium, setIsPremium] = useState<boolean>(false); // Manage premium status locally
  const [learningPercentage, setLearningPercentage] = useState<number>(MIN_LEARNING_PERCENTAGE);
  const [canSwipe, setCanSwipe] = useState<boolean>(true);
  const [usageCount, setUsageCount] = useState<number>(0);
  const [currentIndex, setCurrentIndex] = useState<number>(0); // Track current card index for swiper
  const [initialBase64Data, setInitialBase64Data] = useState<string | null>(null); // Store initial base64
  const [swiperKey, setSwiperKey] = useState<number>(0); // Key for forcing swiper remount
  const [showRegeneratePopup, setShowRegeneratePopup] = useState<boolean>(false); // State for popup visibility
  const [isVerified, setIsVerified] = useState(false); // New state for verification status
  const [initialLoading, setInitialLoading] = useState(true); // Tracks initial load + verification

  // Moved fetchLearningPercentage definition before its usage
  const fetchLearningPercentage = useCallback(async () => {
    if (!user?.email) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/learning-percentage`, {
        headers: {
          'x-user-email': user.email,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setLearningPercentage(data.percentage);
      } else {
        console.warn('Failed to fetch learning percentage:', response.status);
         setLearningPercentage(MIN_LEARNING_PERCENTAGE); // Reset on failure
      }
    } catch (error) {
      console.error('Error fetching learning percentage:', error);
      setLearningPercentage(MIN_LEARNING_PERCENTAGE); // Reset on error
    }
  }, [user?.email]);

  // Fetch initial user data (usage, premium status) and learning percentage
  const fetchInitialData = useCallback(async () => {
    if (!user?.email) {
        // Handle case where user is somehow not logged in (shouldn't happen in mobile)
        console.warn("User not logged in, cannot fetch initial data.");
        setIsPremium(false);
        setUsageCount(0);
        setCanSwipe(false); // Cannot swipe if not logged in
        setLearningPercentage(MIN_LEARNING_PERCENTAGE);
        return;
    }
    try {
       // Fetch user status (including premium and usage) from a dedicated endpoint or auth verify
       // Example using a hypothetical /api/user-status endpoint
       const statusResponse = await fetch(`${API_BASE_URL}/api/user-status`, { // Adjust endpoint as needed
           headers: { 'x-user-email': user.email }
       });
       if (statusResponse.ok) {
           const statusData = await statusResponse.json();
           setIsPremium(statusData.isPremium || false);
           setUsageCount(statusData.dailySwipes || 0);
           // Determine initial canSwipe state based on limits
           setCanSwipe(statusData.isPremium || (statusData.dailySwipes || 0) < FREE_USER_DAILY_LIMIT);
           console.log('Initial user status:', { isPremium: statusData.isPremium, usage: statusData.dailySwipes });
       } else {
          console.warn('Failed to fetch initial user status, assuming free user limits.');
          setIsPremium(false);
          setUsageCount(0); // Default to 0 if fetch fails?
          setCanSwipe(true); // Assume can swipe until first swipe fails?
       }
    } catch(err) {
        console.error("Error fetching initial user data:", err);
        setIsPremium(false); // Assume not premium on error
        setUsageCount(0);
        setCanSwipe(true);
    }
    fetchLearningPercentage(); // Fetch learning percentage after getting user info
  }, [user?.email, fetchLearningPercentage]);

  // Function to fetch responses (used initially and for regeneration)
  const fetchResponses = useCallback(async (base64Data: string, mode: string) => {
      setIsGenerating(true); // Use isGenerating for regeneration loading state
      setError(null);
      try {
        console.log('Fetching/Regenerating responses for mode:', mode);
        const response = await fetch(`${API_BASE_URL}/api/openai`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Type': 'mobile', // Identify client
            ...(user?.email && { 'x-user-email': user.email }), // Add user email if available
          },
          body: JSON.stringify({ imageBase64: base64Data, mode }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('API Error:', response.status, errorData);
          throw new Error(
            `API request failed: ${errorData.error || response.statusText}`
          );
        }

        const data = await response.json();
        if (!data.responses || !Array.isArray(data.responses) || data.responses.length === 0) {
           console.error('Invalid response format or empty responses:', data);
           throw new Error('Received invalid or empty responses from server.');
        }

        console.log('Received responses:', data.responses.length);
        setResponses(data.responses);
        setCurrentIndex(data.responses.length > 0 ? data.responses.length - 1 : 0); // Reset index for Swiper
        setCanSwipe(true); // Allow swiping new cards
        setError(null); // Clear previous errors

      } catch (err: any) {
        console.error('Error fetching/regenerating responses:', err);
        setError(err.message || 'An unexpected error occurred.');
        setResponses([]); // Clear responses on error
      } finally {
        setIsGenerating(false);
        setIsLoading(false); // Also set initial loading to false
      }
  }, [user?.email]);

  // Initial load effect
  useEffect(() => {
    const prepareAndFetch = async () => {
        if (!imageUri || !initialContext) {
            setError('Missing image URI or context.');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const fileContent = await FileSystem.readAsStringAsync(imageUri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            const base64 = fileContent.includes(',') ? fileContent.split(',')[1] : fileContent;
            setInitialBase64Data(base64); // Store for regeneration
            await fetchResponses(base64, initialContext);
        } catch (err: any) {
             console.error('Error reading image file:', err);
             setError('Failed to load image data.');
             setIsLoading(false);
        }
    }

    prepareAndFetch();
    fetchInitialData(); // Fetch usage, premium status, and learning percentage
  }, [imageUri, initialContext, fetchInitialData, fetchResponses]); // Add fetchResponses dependency

  // Modified useEffect for initial data loading
  useEffect(() => {
    const loadInitialData = async () => {
      if (user && !isVerified) { // Only run if user exists but verification hasn't succeeded yet
        setInitialLoading(true); // Start initial loading indicator
        console.log("User authenticated, starting backend verification...");
        const verified = await verifyUserRecord(user);
        setIsVerified(verified); // Store verification result

        if (verified) {
          console.log("Verification successful, fetching user data...");
          // Now fetch subscription status and other data
          try {
            // --- Fetch Subscription Status (Example) ---
            // Replace with your actual fetch logic
            const token = await user.getIdToken();
            const statusResponse = await fetch(`${API_BASE_URL}/api/subscription/status`, { // Replace with your endpoint
                 headers: {
                    'Authorization': `Bearer ${token}`
                 }
            });
             if (!statusResponse.ok) {
                 throw new Error(`Failed to fetch subscription status (${statusResponse.status})`);
             }
             const statusData = await statusResponse.json();
             setIsPremium(statusData.status === 'premium' || statusData.status === 'trial');
             console.log('Subscription status fetched:', statusData.status);

            // --- Fetch Usage Count (Example) ---
            // Replace with your actual fetch logic
             const usageResponse = await fetch(`${API_BASE_URL}/api/usage`, { // Replace with your endpoint
                 headers: {
                    'Authorization': `Bearer ${token}`
                 }
             });
             if (!usageResponse.ok) {
                 throw new Error(`Failed to fetch usage count (${usageResponse.status})`);
             }
             const usageData = await usageResponse.json();
             setUsageCount(usageData.dailySwipes || 0); // Adjust based on your API response
             console.log('Usage count fetched:', usageData.dailySwipes);

             setError(null); // Clear any previous errors
          } catch (fetchError: any) {
              console.error("Error fetching user data after verification:", fetchError);
              setError(`Failed to load user data: ${fetchError.message}`);
              // Consider how to handle this failure - maybe allow limited functionality?
          } finally {
              setInitialLoading(false); // Stop loading indicator once verified & data fetched (or failed)
          }
        } else {
            // Verification failed after retries
            setError("Failed to verify account with backend. Please restart the app.");
            setInitialLoading(false); // Stop loading indicator
        }
      } else if (!user) {
         console.log("No user found, skipping verification and data fetch.");
         setInitialLoading(false); // No user, so loading is done
         setIsVerified(false); // Reset verification status if user logs out
      } else {
         // User exists and is already verified, no need to reload data unless triggered otherwise
         setInitialLoading(false);
      }
    };

    loadInitialData();
    // Depend on `user` to re-run when auth state changes.
    // `isVerified` dependency prevents re-running verification if it already succeeded.
  }, [user, isVerified]);

  const trackSwipe = async (direction: 'left' | 'right'): Promise<boolean> => {
    if (!user?.email) {
      console.error('User email missing, cannot track swipe.');
      Alert.alert('Authentication Error', 'Please log in again.');
      router.replace('/login');
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/swipes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
          'X-Client-Type': 'mobile',
        },
        body: JSON.stringify({ direction }),
      });

      // Check for 401 Unauthorized specifically
      if (response.status === 401) {
          console.error('Swipe tracking failed: Unauthorized (401)');
          Alert.alert('Authentication Error', 'Your session might have expired. Please log in again.');
          router.replace('/login');
          return false;
      }

      const data = await response.json();

      if (!response.ok) {
        console.error('Swipe tracking failed:', response.status, data);
        Alert.alert('Error', 'Could not record swipe. Please try again later.');
        return false;
      }

      // Update usage count and canSwipe state from response
      const currentUsage = data.dailySwipes || 0;
      setUsageCount(currentUsage);
      // Use the isPremium state variable fetched initially
      const swipesLimit = isPremium ? Infinity : FREE_USER_DAILY_LIMIT;
      const stillCanSwipe = data.canSwipe && (isPremium || currentUsage < swipesLimit);
      setCanSwipe(stillCanSwipe);

      if (!data.canSwipe || !stillCanSwipe) {
          if (data.requiresUpgrade && !isPremium) {
              Alert.alert('Limit Reached', 'You have reached your daily swipe limit. Upgrade for unlimited swipes!');
              // Maybe navigate to upgrade screen?
              // router.push('/profile');
          } else if (!isPremium) {
              Alert.alert('Limit Reached', 'You have reached your swipe limit for today.');
          } else {
             // Should not happen for premium users unless API returns canSwipe: false for other reasons
             console.warn('Cannot swipe despite being premium or within limits. API response:', data);
             Alert.alert('Error', 'Could not process swipe. Please try again.');
          }
          return false; // Return false, don't change currentIndex
      }

      console.log('Swipe tracked. Usage:', currentUsage);
      return true; // Swipe was successful and tracked

    } catch (error) {
      console.error('Error tracking swipe:', error);
      Alert.alert('Error', 'An network error occurred while tracking swipe.');
      return false;
    }
  };

  const handleSwipe = async (index: number, direction: 'left' | 'right') => {
      if (!canSwipe) {
          console.log("Cannot swipe, limit reached or generation in progress.");
          // Optionally add visual feedback or reset the card position
          return;
      }

      const allowed = await trackSwipe(direction);
      if (!allowed) {
          // If tracking fails (e.g., limit reached), prevent the UI change
          // The Swiper component might need manual reset or prevention logic here
          // For now, we just log it. The `canSwipe` state should prevent further swipes.
          console.log(`Swipe ${direction} blocked by trackSwipe.`);
          // Attempt to restore card? (Might be complex with rn-swiper-list)
          // swiperRef.current?.goBack(); // Check if such a method exists
          return;
      }

      // Update current index locally for UI consistency before swiper animation finishes
      const newIndex = index - 1;
      setCurrentIndex(newIndex); // Decrement index

      // Perform direction-specific actions (save response) only if tracking was allowed
      if (direction === 'right') {
          const responseText = responses[index];
          console.log('Attempting Save:', responseText);
          if (user?.email) {
              try {
                  const saveResponse = await fetch(`${API_BASE_URL}/api/saved-responses`, {
                      method: 'POST',
                      headers: {
                          'Content-Type': 'application/json',
                          'x-user-email': user.email,
                          'X-Client-Type': 'mobile',
                      },
                      body: JSON.stringify({
                          userEmail: user.email,
                          response: responseText,
                          context: initialContext || 'unknown', // Use initial context
                          created_at: new Date().toISOString(),
                      }),
                  });
                  if (!saveResponse.ok) {
                      const errorData = await saveResponse.json().catch(() => ({}));
                      console.error('Failed to save response:', saveResponse.status, errorData);
                      // Non-critical error, maybe show a toast?
                  } else {
                      console.log('Response saved successfully.');
                      await fetchLearningPercentage(); // Update learning bar
                  }
              } catch (error) {
                  console.error('Error saving response:', error);
              }
          } else {
              console.warn('Cannot save response, user not logged in.');
          }
      } else {
          console.log('Skipped:', responses[index]);
      }

      // Check if it was the last card
      if (newIndex < 0) {
          handleSwipedAll();
      }
  };

  // Use the index from rn-swiper-list callback
  const handleSwipeLeft = (index: number) => {
      handleSwipe(index, 'left');
  };

  const handleSwipeRight = (index: number) => {
      handleSwipe(index, 'right');
  };

  const handleSwipedAll = () => {
    console.log('Swiped all cards!');
    // Don't set error, show the regenerate popup instead
    // setError("You've seen all responses for this image. Regenerate or go back.");
    setCanSwipe(false); // Stop further swiping
    setShowRegeneratePopup(true); // Show the popup
  };

  // Regenerate function
  const handleRegenerate = async () => {
      setShowRegeneratePopup(false); // Close popup first
      if (!initialBase64Data || !initialContext) {
          Alert.alert('Error', 'Cannot regenerate without initial image and context.');
          return;
      }
      if (isGenerating || isLoading) {
          return; // Prevent multiple calls
      }
      const canRegenerate = isPremium || usageCount < FREE_USER_DAILY_LIMIT;
      if (!canRegenerate) {
          Alert.alert(
              'Limit Reached',
              isPremium
                  ? 'An error occurred. Please try again later.'
                  : 'You have reached your daily limit and cannot regenerate more responses today. Upgrade for unlimited generations!'
           );
          return;
      }

      console.log('Regenerating responses...');
      await fetchResponses(initialBase64Data, initialContext);
      setSwiperKey(prevKey => prevKey + 1);
      setCurrentIndex(responses.length > 0 ? responses.length - 1 : 0);
      setError(null);
  };

  const renderCard = useCallback((cardData: string, cardIndex: number) => {
      return <ResponseCard key={`card-${cardIndex}`} cardText={cardData} />;
  }, []);

  // Loading state for initial fetch
  if (isAuthLoading || initialLoading) {
     return (
         <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
             <ActivityIndicator size="large" color="#db2777" />
             <Text style={{ marginTop: 10, color: '#6b7280' }}>
                 {isAuthLoading ? "Authenticating..." : "Syncing account..."}
             </Text>
         </View>
     );
  }

  // Error state (now handles initial load error and swiped all)
  if (error && responses.length === 0 && !isLoading) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <Ionicons name="warning-outline" size={50} color={COLORS.errorRed} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const swipesLeftText = isPremium
    ? 'Unlimited Swipes'
    : `${Math.max(0, FREE_USER_DAILY_LIMIT - usageCount)} Daily Free Swipes Left`;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <LoadingModal visible={isGenerating} />

        {/* Regenerate Popup Modal */}
        <RegeneratePopup
            visible={showRegeneratePopup}
            onRegenerate={handleRegenerate}
            onClose={() => setShowRegeneratePopup(false)}
        />

        {/* Header Area */}
        <View style={styles.headerContainer}>
           {/* Close Button */}
           <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
                <Ionicons name="close" size={28} color={COLORS.darkGray} />
           </TouchableOpacity>

            {/* Optional: Add Saved Button - Ensure route exists */}
            <TouchableOpacity style={styles.savedButton} onPress={() => router.push('/saved' as any)}> // Cast as any to bypass type check temporarily
                 <Ionicons name="heart-outline" size={24} color={COLORS.darkGray} />
                 <Text style={styles.savedButtonText}>Saved</Text>
            </TouchableOpacity>
        </View>

        {/* AI Learning Bar */}
        <View style={styles.learningBarContainer}>
            <View style={styles.learningBarLabelContainer}>
                <View style={styles.learningBarLabel}>
                   <Ionicons name="star" size={12} color={COLORS.primaryPink} />
                   <Text style={styles.learningBarText}>AI Learning</Text>
                </View>
                {!isPremium && (
                    <TouchableOpacity onPress={() => router.push('/profile' as any)}> // Cast as any
                        <Text style={styles.upgradeText}>Upgrade →</Text>
                    </TouchableOpacity>
                )}
            </View>
            <View style={styles.progressBarBackground}>
                 <View style={[
                    styles.progressBarForeground,
                    { width: `${learningPercentage}%` },
                    isPremium && styles.premiumProgressBar // Apply gradient/different color if premium
                 ]} />
            </View>
            <View style={styles.learningBarLabelContainer}>
                 <Text style={[styles.learningPercentageText, isPremium && styles.premiumPercentageText]}>
                    {learningPercentage}% Learned
                 </Text>
                 {!isPremium && (
                     <Text style={styles.learningHintText}>Upgrade for better matches</Text>
                 )}
            </View>
        </View>

        {/* Swiper Area */}
        {responses.length > 0 ? (
          <View style={styles.swiperContainer}>
            <Swiper
              ref={swiperRef}
              key={swiperKey} // Add key for regeneration reset
              data={responses}
              renderCard={renderCard}
              onSwipeLeft={handleSwipeLeft}    // Pass index
              onSwipeRight={handleSwipeRight}  // Pass index
              onSwipedAll={handleSwipedAll}
              cardStyle={styles.swiperCardStyle}
              OverlayLabelLeft={OverlayLabelLeft}
              OverlayLabelRight={OverlayLabelRight}
              // animateCardOpacity // Removed invalid prop
              // Removed invalid props: stackSize, stackSeparation, stackScale, disableLeftSwipe, disableRightSwipe, infinite, cardIndex
              // Swipe disabling is handled in handleSwipe
              onSwipeEnd={() => console.log('Swipe animation ended')} // Corrected signature for onSwipeEnd
            />
          </View>
        ) : (
           // Show message if no responses and not loading/generating
           !isLoading && !isGenerating && (
                <View style={styles.centeredContainer}>
                    {/* Display error only if it's a real error, not the 'swiped all' message */}
                    {error && <Text style={styles.infoText}>{error}</Text>}
                    {!error && <Text style={styles.infoText}>No responses generated.</Text>}
                     {/* Regenerate button might be less necessary here if popup handles it */}
                     {initialBase64Data && initialContext && (
                         <TouchableOpacity style={styles.actionButton} onPress={handleRegenerate} disabled={isGenerating}>
                             <Ionicons name="refresh" size={18} color={COLORS.white} />
                             <Text style={styles.actionButtonText}>Regenerate</Text>
                         </TouchableOpacity>
                     )}
                    <TouchableOpacity style={styles.outlineButton} onPress={() => router.back()}>
                         <Ionicons name="camera-outline" size={18} color={COLORS.primaryPink} />
                        <Text style={styles.outlineButtonText}>New Screenshot</Text>
                    </TouchableOpacity>
                </View>
            )
        )}

        {/* Footer Area (Swipe Counter and Buttons) */}
        {responses.length > 0 && !isLoading && !isGenerating && (
            <View style={styles.footerContainer}>
                {/* Swipe Counter */}
                <Text style={styles.swipeCounterText}>{swipesLeftText}</Text>

                 {/* Action Buttons */}
                 <View style={styles.footerButtonsContainer}>
                     <TouchableOpacity style={styles.outlineButton} onPress={() => router.back()}>
                         <Ionicons name="camera-outline" size={20} color={COLORS.primaryPink} />
                         <Text style={styles.outlineButtonText}>New Screenshot</Text>
                     </TouchableOpacity>
                     {/* Show regenerate button only if applicable */}
                     {initialBase64Data && initialContext && (
                         <TouchableOpacity style={styles.actionButton} onPress={handleRegenerate} disabled={isGenerating}>
                             <Ionicons name="refresh" size={20} color={COLORS.white} />
                             <Text style={styles.actionButtonText}>Regenerate</Text>
                         </TouchableOpacity>
                      )}
                 </View>

                 {/* Manual Swipe Buttons */}
                 <View style={styles.manualSwipeContainer}>
                     {/* Disable buttons based on canSwipe state and if cards exist (currentIndex >= 0) */}
                     <TouchableOpacity style={styles.swipeButton} onPress={() => swiperRef.current?.swipeLeft()} disabled={!canSwipe || currentIndex < 0}>
                         <Ionicons name="close-circle" size={60} color={!canSwipe || currentIndex < 0 ? COLORS.mediumGray : COLORS.errorRed} />
                     </TouchableOpacity>
                     <TouchableOpacity style={styles.swipeButton} onPress={() => swiperRef.current?.swipeRight()} disabled={!canSwipe || currentIndex < 0}>
                         <Ionicons name="heart-circle" size={60} color={!canSwipe || currentIndex < 0 ? COLORS.mediumGray : COLORS.green} />
                     </TouchableOpacity>
                 </View>
            </View>
        )}

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white, // Use white background like web
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 20,
  },
  // Loading Modal Styles
  loadingModalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.4)', // Semi-transparent background
  },
  loadingModalContent: {
      backgroundColor: COLORS.white,
      padding: 30,
      borderRadius: 10,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: COLORS.textPrimary, // Darker text
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.errorRed,
    textAlign: 'center',
    marginBottom: 20,
  },
   infoText: { // Generic text for messages like 'No responses'
      fontSize: 16,
      color: COLORS.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
  },
  headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 15,
      paddingTop: 10, // Adjust as needed for status bar height
      paddingBottom: 5,
      // backgroundColor: 'lightblue', // For layout debugging
  },
  closeButton: {
      padding: 5, // Increase tappable area
  },
  savedButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.lightGray,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 15,
  },
  savedButtonText: {
      marginLeft: 5,
      fontSize: 12,
      color: COLORS.darkGray,
      fontWeight: '500',
  },
  learningBarContainer: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      marginBottom: 10, // Space before swiper
      backgroundColor: COLORS.white, // Match background
      // Add subtle border/shadow if needed
      borderBottomWidth: 1,
      borderBottomColor: COLORS.lightGray,
  },
  learningBarLabelContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 5,
  },
  learningBarLabel: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  learningBarText: {
      marginLeft: 5,
      fontSize: 11,
      fontWeight: '600',
      color: COLORS.textPrimary,
  },
  upgradeText: {
      fontSize: 11,
      fontWeight: '600',
      color: COLORS.primaryPink,
  },
  progressBarBackground: {
      height: 6,
      backgroundColor: COLORS.lightGray,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 5,
  },
  progressBarForeground: {
      height: '100%',
      backgroundColor: COLORS.mediumGray, // Default for non-premium
      borderRadius: 3,
  },
  premiumProgressBar: {
       // TODO: Implement gradient if possible, otherwise solid color
      backgroundColor: COLORS.primaryPink, // Or use a premium color
  },
  learningPercentageText: {
      fontSize: 10,
      color: COLORS.darkGray,
      fontWeight: '500',
  },
   premiumPercentageText: {
      color: COLORS.green, // Use green for premium learned text
   },
  learningHintText: {
      fontSize: 10,
      color: COLORS.textSecondary,
  },
  card: { // Keep card styling simple
    flex: 1,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 20, // Reduced padding slightly
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardText: {
    textAlign: 'center',
    fontSize: 18, // Slightly smaller text
    lineHeight: 26,
    color: COLORS.textPrimary,
    fontWeight: '500', // Medium weight
  },
  swiperCardStyle: {
      width: '85%', // Adjust width
      height: '90%', // Adjust height relative to container
      // Removed fixed height/width from here, handled by container
  },
   swiperContainer: {
        flex: 1, // Take up remaining space
        alignItems: 'center',
        justifyContent: 'center',
        // backgroundColor: 'lightcoral', // For layout debugging
        paddingBottom: 180, // Ensure space for footer elements
        marginTop: -20, // Pull swiper up slightly
    },
  overlayLabelContainer: {
      // ... existing styles ...
      borderRadius: 15,
  },
  overlayLabelLeft: {
      backgroundColor: 'rgba(211, 47, 47, 0.6)', // Slightly less opaque red
  },
  overlayLabelRight: {
      backgroundColor: 'rgba(76, 175, 80, 0.6)', // Slightly less opaque green
  },
  overlayLabelText: {
      // ... existing styles ...
      fontSize: 28,
      padding: 10,
  },
  footerContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: 20, // SafeAreaView might handle bottom padding
      paddingHorizontal: 20,
      alignItems: 'center',
      backgroundColor: COLORS.white, // Match background
      // borderTopWidth: 1,
      // borderTopColor: COLORS.lightGray,
  },
  swipeCounterText: {
      fontSize: 12,
      color: COLORS.textSecondary,
      fontWeight: '500',
      marginBottom: 10,
  },
  footerButtonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
      marginBottom: 15,
  },
  manualSwipeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      width: '80%', // Limit width of swipe buttons
  },
  swipeButton: {
     // Make sure tappable area is large enough
     padding: 5,
  },
  actionButton: { // For Regenerate
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primaryPink,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 25,
      minWidth: 140, // Ensure decent width
      marginHorizontal: 5, // Add some spacing
  },
  actionButtonText: {
      color: COLORS.white,
      fontSize: 14,
      fontWeight: 'bold',
      marginLeft: 8,
  },
  outlineButton: { // For New Screenshot and Go Back
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.white,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 25,
      borderWidth: 1.5,
      borderColor: COLORS.primaryPink,
      minWidth: 140, // Ensure decent width
      marginHorizontal: 5, // Add some spacing
   },
   outlineButtonText: {
      color: COLORS.primaryPink,
      fontSize: 14,
      fontWeight: 'bold',
      marginLeft: 8,
   },
   // Keep backButton styles for error screen compatibility
   backButton: {
        marginTop: 20,
        backgroundColor: COLORS.primaryPink,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
     },
     backButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: 'bold',
     },
  // Popup Styles (similar to web version)
  popupOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20, // Padding around the popup content
  },
  popupContainer: {
      backgroundColor: COLORS.white,
      borderRadius: 12,
      padding: 25,
      paddingTop: 40, // Extra padding at the top for close button positioning
      width: '100%',
      maxWidth: 350, // Limit maximum width
      alignItems: 'center',
      position: 'relative',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 5,
  },
  popupCloseButton: {
      position: 'absolute',
      top: 10,
      right: 10,
      padding: 5, // Tappable area
  },
  popupTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: COLORS.textPrimary,
      marginBottom: 15,
      textAlign: 'center',
  },
  popupMessage: {
      fontSize: 16,
      color: COLORS.textSecondary,
      textAlign: 'center',
      marginBottom: 25,
      lineHeight: 22, // Improve readability
  },
  popupActionButton: {
      backgroundColor: COLORS.primaryPink,
      paddingVertical: 12,
      paddingHorizontal: 30,
      borderRadius: 25,
      width: '100%', // Make button full width of popup container
      alignItems: 'center',
  },
  popupActionButtonText: {
      color: COLORS.white,
      fontSize: 16,
      fontWeight: 'bold',
  },
});
