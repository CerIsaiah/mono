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
  textPrimary: '#212121', // Darker for better contrast
  textSecondary: '#757575', // Slightly adjusted gray
  errorRed: '#D32F2F',
  lightGray: '#F5F5F5', // Lighter gray for backgrounds/borders
  mediumGray: '#BDBDBD', // Adjusted medium gray
  darkGray: '#616161',  // Adjusted dark gray
  premiumGradientStart: '#E11D74', // Pink
  premiumGradientEnd: '#AE2EFF', // Purple (Approximation)
  green: '#4CAF50',
  blue: '#2196F3', // Added a blue for accents if needed
  lightBlueBackground: '#E3F2FD', // Example light blue
};

// Card Component (Styling adapted from web version)
const ResponseCard = ({ cardText }: { cardText: string }) => (
  <View style={styles.card}>
    <ScrollView contentContainerStyle={styles.cardScrollContent}>
       <Text style={styles.cardText}>{cardText}</Text>
    </ScrollView>
    {/* Removed swipe indicators, rn-swiper-list uses overlay labels */}
  </View>
);

// Overlay Label Components (Example)
const OverlayLabelLeft = () => (
    <View style={[styles.overlayLabelContainer, styles.overlayLabelLeft]}>
        <Ionicons name="close-circle-outline" size={48} color={COLORS.white} />
        {/* <Text style={styles.overlayLabelText}>NOPE</Text> */}
    </View>
);
const OverlayLabelRight = () => (
    <View style={[styles.overlayLabelContainer, styles.overlayLabelRight]}>
         <Ionicons name="heart-circle-outline" size={48} color={COLORS.white} />
        {/* <Text style={styles.overlayLabelText}>SAVE</Text> */}
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
  const [swipedAll, setSwipedAll] = useState<boolean>(false); // State to track if all cards are swiped
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
      setSwipedAll(false); // Reset swipedAll state on successful generation

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
      // Check if the swipe should actually happen (e.g., based on canSwipe)
      // The library might call this even if the swipe is visually prevented
      if (!canSwipe) return;
      handleSwipe(index, 'left');
  };

  const handleSwipeRight = (index: number) => {
      // Check if the swipe should actually happen (e.g., based on canSwipe)
      if (!canSwipe) return;
      handleSwipe(index, 'right');
  };

  const handleSwipedAll = () => {
    console.log('Swiped all cards!');
    setSwipedAll(true); // Set swipedAll to true
    // Ensure swiping stops if not already stopped
    setCanSwipe(false);
  };

  // Handle regenerate
  const handleRegenerate = async () => {
    if (isGenerating) return;
    
    // Ensure we use the initial data for regeneration
    try {
      if (textContext && textLastMessage) {
        console.log('[DEBUG] Regenerating with text:', { context: textContext, lastText: textLastMessage });
        await generateResponses(null, textContext, textLastMessage);
      } else if (initialBase64Data) { // Use initialBase64Data here
        console.log('[DEBUG] Regenerating with initial image.');
        await generateResponses(initialBase64Data); // Pass initialBase64Data
      } else {
         // This case should ideally not happen if the button is shown correctly
         console.warn('[DEBUG] handleRegenerate called without valid initial data.');
         Alert.alert('Error', 'Cannot regenerate without initial context or image.');
      }
    } catch (error) {
      console.error('Error regenerating responses:', error);
      Alert.alert('Error', 'Failed to regenerate responses. Please try again.');
    }
  };

  const renderCard = useCallback((cardData: string, cardIndex: number) => {
      // Use a unique key involving both swiperKey and cardIndex if needed
      return <ResponseCard key={`card-${swiperKey}-${cardIndex}`} cardText={cardData} />;
  }, [swiperKey]); // Add swiperKey dependency

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
           <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
                <Ionicons name="close" size={28} color={COLORS.darkGray} />
           </TouchableOpacity>

            {/* Optional: Add Saved Button - Ensure route exists */}
            <TouchableOpacity style={styles.savedButton} onPress={() => router.push('/saved-responses' as any)}>
                 <Ionicons name="heart-outline" size={20} color={COLORS.primaryPink} />
                 <Text style={styles.savedButtonText}>Saved</Text>
            </TouchableOpacity>
        </View>

        {/* AI Learning Bar */}
        <View style={styles.learningBarContainer}>
            <View style={styles.learningBarLabelContainer}>
                <View style={styles.learningBarLabel}>
                   <Ionicons name="sparkles-outline" size={14} color={COLORS.primaryPink} />
                   <Text style={styles.learningBarText}>AI Learning Progress</Text>
                </View>
                {!isPremium && (
                    <TouchableOpacity onPress={() => router.push('/profile' as any)}>
                        <Text style={styles.upgradeText}>Upgrade →</Text>
                    </TouchableOpacity>
                )}
            </View>
            <View style={styles.progressBarBackground}>
                 {/* TODO: Implement gradient or use premium color */}
                 <View style={[
                    styles.progressBarForeground,
                    { width: `${Math.max(5, learningPercentage)}%` }, // Ensure minimum width for visibility
                    isPremium && styles.premiumProgressBar
                 ]} />
            </View>
            <View style={styles.learningBarLabelContainer}>
                 <Text style={[styles.learningPercentageText, isPremium && styles.premiumPercentageText]}>
                    {learningPercentage}% Learned
                 </Text>
                 {/* Removed hint text - implied by upgrade button */}
            </View>
        </View>

        {/* Swiper Area - Takes up remaining space */}
        <View style={styles.swiperContainer}>
          {/* Render Swiper or "Swiped All/No Responses" state */}
          {!swipedAll && responses.length > 0 ? (
            <Swiper
              ref={swiperRef}
              key={swiperKey}
              data={responses}
              renderCard={renderCard}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              onSwipedAll={handleSwipedAll}
              cardStyle={styles.swiperCardStyle} // Adjust card style within Swiper
              OverlayLabelLeft={OverlayLabelLeft}
              OverlayLabelRight={OverlayLabelRight}
              // Ensure swipe is disabled visually/logically via `canSwipe` state
              // The library itself doesn't have direct disable props based on state easily
              // We handle this logic in `handleSwipe` and disabling buttons below
            />
          ) : (
            // Show message if no responses and not loading/generating, OR if swiped all
            !isLoading && !isGenerating && (
              <View style={styles.centeredMessageContainer}>
                <Ionicons
                   name={swipedAll ? "checkmark-done-circle-outline" : "information-circle-outline"}
                   size={60}
                   color={swipedAll ? COLORS.green : COLORS.mediumGray}
                   style={{ marginBottom: 15 }}
                 />
                <Text style={styles.infoText}>
                  {swipedAll
                      ? "You've reviewed all responses!"
                      : error || 'No responses available right now.'
                  }
                </Text>
                {/* Show regenerate/new screenshot buttons */}
                <View style={styles.centeredActionButtons}>
                  {(swipedAll || responses.length === 0) && (initialBase64Data || (textContext && textLastMessage)) && (
                    <TouchableOpacity style={[styles.actionButton, styles.regenerateButton]} onPress={handleRegenerate} disabled={isGenerating}>
                      <Ionicons name="refresh" size={18} color={COLORS.white} />
                      <Text style={styles.actionButtonText}>Regenerate</Text>
                    </TouchableOpacity>
                  )}
                   <TouchableOpacity style={[styles.outlineButton, styles.newScreenshotButton]} onPress={() => router.back()}>
                       <Ionicons name="camera-outline" size={18} color={COLORS.primaryPink} />
                       <Text style={styles.outlineButtonText}>New Screenshot</Text>
                   </TouchableOpacity>
                </View>
              </View>
            )
          )}
        </View>

        {/* Footer Area (Manual Swipe Buttons & Counter) - Render conditionally */}
        {!swipedAll && responses.length > 0 && !isLoading && !isGenerating && (
            <View style={styles.footerContainer}>
                 {/* Manual Swipe Buttons */}
                 <View style={styles.manualSwipeContainer}>
                     <TouchableOpacity
                       style={[styles.swipeButtonWrapper, (!canSwipe || currentIndex < 0) && styles.disabledButton]}
                       onPress={() => swiperRef.current?.swipeLeft()}
                       disabled={!canSwipe || currentIndex < 0}
                      >
                         <Ionicons name="close-circle" size={64} color={!canSwipe || currentIndex < 0 ? COLORS.mediumGray : COLORS.errorRed} />
                     </TouchableOpacity>
                     <TouchableOpacity
                        style={[styles.swipeButtonWrapper, (!canSwipe || currentIndex < 0) && styles.disabledButton]}
                        onPress={() => swiperRef.current?.swipeRight()}
                        disabled={!canSwipe || currentIndex < 0}
                      >
                         <Ionicons name="heart-circle" size={64} color={!canSwipe || currentIndex < 0 ? COLORS.mediumGray : COLORS.green} />
                     </TouchableOpacity>
                 </View>

                 {/* Swipe Counter */}
                 <Text style={styles.swipeCounterText}>{swipesLeftText}</Text>

                 {/* Action Buttons (Regenerate / New Screenshot) - MOVED TO CENTERED MESSAGE AREA when swiped all */}
                 {/* Kept simplified footer actions if needed */}
                 {/* <View style={styles.footerButtonsContainer}> ... </View> */}

            </View>
        )}

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white, // Main background
    justifyContent: 'space-between', // Push footer down
  },
  centeredContainer: { // Only for full-screen loading/error initially
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 20,
  },
  // Loading Modal Styles (Keep as is)
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
    color: COLORS.textPrimary,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.errorRed,
    textAlign: 'center',
    marginBottom: 20,
  },
   infoText: { // Generic text for messages like 'No responses', 'Swiped All'
      fontSize: 18,
      color: COLORS.textSecondary,
      textAlign: 'center',
      marginBottom: 25,
      fontWeight: '500',
  },
  // Header
  headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 15,
      paddingTop: 10,
      paddingBottom: 5,
      // backgroundColor: 'lightblue', // Debug
  },
  iconButton: { // Generic style for icon-only buttons
      padding: 8, // Increase tappable area
  },
  savedButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.lightPinkBackground, // Use light pink
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20, // Pill shape
  },
  savedButtonText: {
      marginLeft: 6,
      fontSize: 13,
      color: COLORS.primaryPink, // Match icon
      fontWeight: '600',
  },
  // Learning Bar
  learningBarContainer: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      // marginBottom: 10, // Removed margin, handled by flex space
      backgroundColor: COLORS.white, // Match background
      borderBottomWidth: 1,
      borderBottomColor: COLORS.lightGray,
  },
  learningBarLabelContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
  },
  learningBarLabel: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  learningBarText: {
      marginLeft: 6,
      fontSize: 12, // Slightly larger
      fontWeight: '600',
      color: COLORS.textPrimary,
  },
  upgradeText: {
      fontSize: 12, // Match
      fontWeight: '700', // Bolder
      color: COLORS.primaryPink,
  },
  progressBarBackground: {
      height: 8, // Thicker bar
      backgroundColor: COLORS.lightGray,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 6,
  },
  progressBarForeground: {
      height: '100%',
      backgroundColor: COLORS.mediumGray, // Default for non-premium
      borderRadius: 4,
      // Add transition if desired (React Native Animated)
  },
  premiumProgressBar: {
      backgroundColor: COLORS.primaryPink, // Use primary pink for premium
      // TODO: Add gradient using LinearGradient if needed
  },
  learningPercentageText: {
      fontSize: 11, // Slightly larger
      color: COLORS.darkGray,
      fontWeight: '500',
  },
   premiumPercentageText: {
      color: COLORS.primaryPink, // Match premium color
      fontWeight: '600',
   },
  // Swiper Area (Takes remaining space)
  swiperContainer: {
      flex: 1, // Allow swiper to take up available vertical space
      alignItems: 'center', // Center Swiper horizontally
      justifyContent: 'center', // Center Swiper vertically
      // backgroundColor: 'lightcoral', // Debug
      paddingHorizontal: 10, // Prevent card hitting edges
      paddingVertical: 10, // Add some vertical padding
      // Remove fixed paddingBottom, flex handles space
  },
  swiperCardStyle: {
      width: '95%', // Card takes most of the swiper width
      height: '95%', // Card takes most of the swiper height
      // Styles moved to .card
  },
  // Centered Message Area (When swiped all or no cards)
  centeredMessageContainer: {
      flex: 1, // Take up swiper's space
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
  },
  centeredActionButtons: {
      marginTop: 15,
      alignItems: 'center',
      width: '100%',
  },
  // Card Styling
  card: {
    flex: 1, // Fill the swiper card slot
    borderRadius: 20, // More rounded corners
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    padding: 25, // Increase padding
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, // Slightly larger shadow
    shadowOpacity: 0.1, // Softer shadow
    shadowRadius: 8,
    elevation: 5, // Android shadow
    alignItems: 'center', // Center content horizontally
    justifyContent: 'center', // Center content vertically
  },
  cardScrollContent: {
    flexGrow: 1, // Ensure ScrollView content can grow
    justifyContent: 'center', // Center text vertically within scroll
    alignItems: 'center', // Center text horizontally
  },
  cardText: {
    textAlign: 'center',
    fontSize: 20, // Larger text
    lineHeight: 30, // Increased line height
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  // Overlay Label Styles
  overlayLabelContainer: {
      width: 100,
      height: 100,
      borderRadius: 50, // Make it circular
      justifyContent: 'center',
      alignItems: 'center',
      opacity: 0.8, // Slightly more transparent
  },
  overlayLabelLeft: {
      backgroundColor: COLORS.errorRed,
      // Removed border
  },
  overlayLabelRight: {
      backgroundColor: COLORS.green,
       // Removed border
  },
  overlayLabelText: { // Kept if you want text instead of icons
      color: COLORS.white,
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
  },
  // Footer
  footerContainer: {
      paddingTop: 10, // Add space above buttons
      paddingBottom: 15, // Space from bottom edge (adjust if needed with SafeAreaView)
      paddingHorizontal: 20,
      alignItems: 'center',
      backgroundColor: COLORS.white, // Match background
      borderTopWidth: 1, // Add subtle separator
      borderTopColor: COLORS.lightGray,
  },
  swipeCounterText: {
      fontSize: 13,
      color: COLORS.textSecondary,
      fontWeight: '500',
      marginBottom: 10, // Space below counter, above buttons
      marginTop: 5,
  },
  manualSwipeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around', // Space out buttons
      alignItems: 'center', // Align vertically
      width: '70%', // Limit width to keep buttons closer
      marginBottom: 5, // Space below swipe buttons before counter
  },
  swipeButtonWrapper: { // Wrapper for opacity/styling disabled state
     // Add padding if icons feel too small to tap
     padding: 8, // Increase tappable area
  },
  disabledButton: {
     opacity: 0.4, // Make disabled buttons look faded
  },
  // Action Buttons (General styles)
  actionButton: { // Base style for solid buttons (Regenerate)
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12, // Standard padding
      paddingHorizontal: 25,
      borderRadius: 30, // Fully rounded ends
      minWidth: 160, // Ensure minimum width
      marginVertical: 5, // Space between buttons if stacked
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
  },
  regenerateButton: { // Specific styling for regenerate
      backgroundColor: COLORS.primaryPink,
  },
  actionButtonText: {
      color: COLORS.white,
      fontSize: 15, // Slightly larger text
      fontWeight: 'bold',
      marginLeft: 10, // More space next to icon
  },
  outlineButton: { // Base style for outline buttons (New Screenshot, Back)
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.white,
      paddingVertical: 12, // Match actionButton
      paddingHorizontal: 25, // Match actionButton
      borderRadius: 30, // Match actionButton
      borderWidth: 1.5, // Keep border
      borderColor: COLORS.primaryPink,
      minWidth: 160, // Match actionButton
      marginVertical: 5, // Match actionButton
   },
   newScreenshotButton: { // Specific styling if needed
      // Inherits from outlineButton
   },
   outlineButtonText: {
      color: COLORS.primaryPink,
      fontSize: 15, // Match actionButtonText
      fontWeight: 'bold',
      marginLeft: 10, // Match actionButtonText
   },
   // Keep backButton styles for error screen compatibility (though outlineButton could replace it)
   backButton: {
        marginTop: 20,
        backgroundColor: COLORS.primaryPink, // Or use outline style
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 30,
     },
     backButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: 'bold',
     },
});
