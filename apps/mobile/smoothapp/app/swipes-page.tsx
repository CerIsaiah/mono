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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Swiper, type SwiperCardRefType } from 'rn-swiper-list';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated';

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false, // Reanimated runs in strict mode by default
});

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

// Update interface to extend Record<string, string | string[]>
interface SwipesPageParams {
  mode: string;
  context?: string;
  lastText?: string;
  imageUri?: string;
  selectedMode?: string;
  spicyLevel?: string;
}

// Main component starts here
export default function SwipesPage() {
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const { user } = useAuth(); // Get user from context
  
  // Convert params to the correct type and ensure single string values
  const params: SwipesPageParams = {
    mode: Array.isArray(rawParams.mode) ? rawParams.mode[0] : String(rawParams.mode),
    ...(rawParams.context && { context: Array.isArray(rawParams.context) ? rawParams.context[0] : String(rawParams.context) }),
    ...(rawParams.lastText && { lastText: Array.isArray(rawParams.lastText) ? rawParams.lastText[0] : String(rawParams.lastText) }),
    ...(rawParams.imageUri && { imageUri: Array.isArray(rawParams.imageUri) ? rawParams.imageUri[0] : String(rawParams.imageUri) }),
    ...(rawParams.selectedMode && { selectedMode: Array.isArray(rawParams.selectedMode) ? rawParams.selectedMode[0] : String(rawParams.selectedMode) }),
    ...(rawParams.spicyLevel && { spicyLevel: Array.isArray(rawParams.spicyLevel) ? rawParams.spicyLevel[0] : String(rawParams.spicyLevel) }),
  };

  // State declarations
  const [responses, setResponses] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [base64Data, setBase64Data] = useState<string | null>(null);
  const [initialBase64Data, setInitialBase64Data] = useState<string | null>(null);
  const [textContext, setTextContext] = useState<string | null>(null);
  const [textLastMessage, setTextLastMessage] = useState<string | null>(null);
  const [swiperKey, setSwiperKey] = useState<number>(0);
  const [canSwipe, setCanSwipe] = useState<boolean>(true);
  const [usageCount, setUsageCount] = useState<number>(0);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [learningPercentage, setLearningPercentage] = useState<number>(0);
  const swiperRef = useRef<SwiperCardRefType>(null);

  // Add dependency tracking for params with proper typing
  const {
    mode,
    context: initialContext = '',
    lastText: initialLastText = '',
    imageUri: initialImageUri = '',
    selectedMode = 'first-move',
    spicyLevel: initialSpicyLevel = '50'
  } = params;

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
       // Fetch user status using the /auth/verify endpoint via POST
       const statusResponse = await fetch(`${API_BASE_URL}/auth/verify`, {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             // Consider adding Authorization header with Firebase token if needed by backend
             // 'Authorization': `Bearer ${await user.getIdToken()}`
           },
           body: JSON.stringify({ email: user.email }),
       });

       if (statusResponse.ok) {
           const statusData = await statusResponse.json();
           setIsPremium(statusData.isPremium || false);
           setUsageCount(statusData.dailySwipes || 0);
           // Determine initial canSwipe state based on limits
           const initialCanSwipe = statusData.isPremium || (statusData.dailySwipes || 0) < FREE_USER_DAILY_LIMIT;
           console.log('[DEBUG] fetchInitialData: Received status:', statusData, 'Setting initial canSwipe to:', initialCanSwipe);
           setCanSwipe(initialCanSwipe);
           console.log('Initial user status:', { isPremium: statusData.isPremium, usage: statusData.dailySwipes });
       } else {
          console.warn('Failed to fetch initial user status, assuming free user limits.');
          setIsPremium(false);
          setUsageCount(0); // Default to 0 if fetch fails?
          console.log('[DEBUG] fetchInitialData: Failed to fetch status. Setting canSwipe to true (assuming free user).');
          setCanSwipe(true); // Assume can swipe until first swipe fails?
       }
    } catch(err) {
        console.error("[DEBUG] fetchInitialData: Error fetching initial data:", err);
        setIsPremium(false); // Assume not premium on error
        setUsageCount(0);
        console.log('[DEBUG] fetchInitialData: Error occurred. Setting canSwipe to true (assuming free user).');
        setCanSwipe(true);
    }
    fetchLearningPercentage(); // Fetch learning percentage after getting user info
  }, [user?.email, fetchLearningPercentage]);

  // Helper function to convert image URI to base64
  const convertImageToBase64 = async (imageUri: string): Promise<string> => {
    try {
      const fileContent = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return fileContent.includes(',') ? fileContent.split(',')[1] : fileContent;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw new Error('Failed to convert image to base64');
    }
  };

  // Memoize the generateResponses function
  const generateResponses = useCallback(async (base64?: string | null, context?: string | null, lastMessage?: string | null) => {
    setIsGenerating(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Client-Type': 'mobile',
      };
      
      if (user?.email) {
        headers['x-user-email'] = user.email;
      }

      const requestBody: any = {
        mode: selectedMode,
        spicyLevel: parseInt(initialSpicyLevel) || 50,
      };

      if (base64) {
        requestBody.imageBase64 = base64;
      } else if (context && lastMessage) {
        requestBody.context = context;
        requestBody.lastText = lastMessage;
      } else {
        throw new Error('No valid input provided');
      }

      const response = await fetch(`${API_BASE_URL}/api/openai`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate responses');
      }

      const data = await response.json();
      if (!data.responses || !Array.isArray(data.responses)) {
        throw new Error('Invalid response format');
      }

      setResponses(data.responses);
      setCurrentIndex(data.responses.length - 1);
      setSwiperKey(prev => prev + 1);
      setError(null);
      setCanSwipe(true);

    } catch (error) {
      console.error('Error generating responses:', error);
      setError('Failed to generate responses. Please try again.');
      setResponses([]);
      setCanSwipe(false);
    } finally {
      setIsGenerating(false);
    }
  }, [user?.email, selectedMode, initialSpicyLevel]);

  // Memoize the initialization function with proper typing
  const initializePage = useCallback(async () => {
    try {
      setIsLoading(true);
      // First ensure we have user data
      await fetchInitialData();
      
      if (mode === 'text' && initialContext && initialLastText) {
        setTextContext(initialContext);
        setTextLastMessage(initialLastText);
        await generateResponses(null, initialContext, initialLastText);
      } else if (initialImageUri) {
        const base64 = await convertImageToBase64(initialImageUri);
        setBase64Data(base64);
        setInitialBase64Data(base64);
        await generateResponses(base64);
      } else {
        throw new Error('Invalid input parameters');
      }
    } catch (error) {
      console.error('Error initializing page:', error);
      setError('Failed to load conversation. Please try again.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [mode, initialContext, initialLastText, initialImageUri, generateResponses, fetchInitialData]);

  // Single initialization effect
  useEffect(() => {
    initializePage();
  }, [initializePage]);

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

      if (!response.ok) {
        if (response.status === 401) {
          Alert.alert('Authentication Error', 'Your session might have expired. Please log in again.');
          router.replace('/login');
          return false;
        }
        
        const data = await response.json();
        Alert.alert('Error', 'Could not record swipe. Please try again later.');
        return false;
      }

      const data = await response.json();
      
      // Update usage count and canSwipe state from response
      setUsageCount(data.dailySwipes || 0);
      const stillCanSwipe = data.canSwipe && (isPremium || (data.dailySwipes || 0) < FREE_USER_DAILY_LIMIT);
      setCanSwipe(stillCanSwipe);

      if (!stillCanSwipe) {
        if (!isPremium) {
          Alert.alert('Limit Reached', 'You have reached your daily swipe limit. Upgrade for unlimited swipes!');
        } else {
          Alert.alert('Error', 'Could not process swipe. Please try again.');
        }
        return false;
      }

      return true;

    } catch (error) {
      console.error('Error tracking swipe:', error);
      Alert.alert('Error', 'A network error occurred while tracking swipe.');
      return false;
    }
  };

  const handleSwipe = async (index: number, direction: 'left' | 'right') => {
    if (!canSwipe) {
      return;
    }

    const allowed = await trackSwipe(direction);
    if (!allowed) {
      return;
    }

    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);

    if (direction === 'right' && user?.email) {
      try {
        const responseText = responses[currentIndex];
        await fetch(`${API_BASE_URL}/api/saved-responses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': user.email,
            'X-Client-Type': 'mobile',
          },
          body: JSON.stringify({
            userEmail: user.email,
            response: responseText,
            context: textContext || 'unknown',
            created_at: new Date().toISOString(),
          }),
        });
        await fetchLearningPercentage();
      } catch (error) {
        console.error('Error saving response:', error);
      }
    }

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
    console.log('[DEBUG] handleSwipedAll: Queueing state updates.');
    // Delay state updates slightly to allow animation to finish
    // setTimeout(() => {
        setError("You've seen all responses for this image. Regenerate or go back."); // Inform user
        console.log('[DEBUG] handleSwipedAll: Setting canSwipe to false (reverted).');
        // Ensure swiping stops if not already stopped
        setCanSwipe(false);
    // }, 100); // 100ms delay, adjust if needed
  };

  // Handle regenerate
  const handleRegenerate = async () => {
    if (isGenerating) return;
    
    try {
      if (textContext && textLastMessage) {
        await generateResponses(null, textContext, textLastMessage);
      } else if (base64Data) {
        await generateResponses(base64Data);
      }
    } catch (error) {
      console.error('Error regenerating responses:', error);
      Alert.alert('Error', 'Failed to regenerate responses. Please try again.');
    }
  };

  const renderCard = useCallback((cardData: string, cardIndex: number) => {
      return <ResponseCard key={`card-${cardIndex}`} cardText={cardData} />;
  }, []);

  // Loading state for initial fetch
  if (isLoading) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={COLORS.primaryPink} />
        <Text style={styles.loadingText}>Generating your Rizzponses...</Text>
      </SafeAreaView>
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

        {/* Header Area */}
        <View style={styles.headerContainer}>
           {/* Close Button */}
           <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
                <Ionicons name="close" size={28} color={COLORS.darkGray} />
           </TouchableOpacity>

            {/* Optional: Add Saved Button - Ensure route exists */}
            <TouchableOpacity style={styles.savedButton} onPress={() => router.push('/saved' as any)}>
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
            />
          </View>
        ) : (
           // Show message if no responses and not loading/generating
           !isLoading && !isGenerating && (
                <View style={styles.centeredContainer}>
                    <Text style={styles.infoText}>{error || 'No responses generated.'}</Text>
                     {/* Show regenerate button here too if applicable */}
                     {initialBase64Data && textContext && (
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
                     {initialBase64Data && textContext && (
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
});
