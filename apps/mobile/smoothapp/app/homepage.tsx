import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, ActivityIndicator, Animated, Platform, Easing, Modal, TextInput, Dimensions, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons'; // Assuming use of Expo icons
import { Svg, Circle } from 'react-native-svg'; // Import SVG components
import { useRouter, useFocusEffect, usePathname } from 'expo-router'; // Import useRouter, useFocusEffect, usePathname
import { useAuth } from '../src/context/AuthContext'; // Import useAuth
import AsyncStorage from '@react-native-async-storage/async-storage';


// Define Colors
const COLORS = {
  primaryPink: '#E11D74', // Darker Pink
  secondaryPink: '#FF69B4', // Medium Pink
  lightPink: '#FFC0CB', // Light Pink (Score Bar)
  lighterPink: '#FFE4E1', // Lighter Pink (Inner Circle BG, Bubbles) - Adjusted
  white: '#FFFFFF',
  black: '#000000',
  grey: '#F5F5F5', // Background if not pure white
  textSecondary: '#666666', // Added for textSecondary color
  darkGray: '#555555', // Added for body text (Matches --dark-gray)
  lightGrey: '#E0E0E0', // Added for lightGrey color
  gold: '#FFD700',
  lightPinkBg: '#fce4ec', // For background orb
  primaryPinkTransparent: 'rgba(225, 29, 116, 0.1)', // For diagonal stripe (E11D74 with alpha)
  blackTransparent80: 'rgba(0, 0, 0, 0.8)', // For glass button
  blackTransparent95: 'rgba(0, 0, 0, 0.95)', // For glass button hover
  whiteTransparent20: 'rgba(255, 255, 255, 0.2)', // For glass button border
};

// Add API base URL constant and Minimum Learning Percentage
const API_BASE_URL = 'https://mono-production-8ef9.up.railway.app'; // Replace with your actual API URL or use env variables
const MIN_LEARNING_PERCENTAGE = 10; // Or import from a shared constants file
const SWIPES_PER_GIFT = 3; // Number of swipes needed to unlock a gift
const MIN_TAP_TARGET_SIZE = 48; // Minimum tap target size for accessibility

// SVG Gauge Constants
const GAUGE_SIZE = 220;
const STROKE_WIDTH = 15; // Was 15 in previous border implementation
const RADIUS = (GAUGE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Constants for new Gift Animation SVG Ring
const GIFT_RING_RADIUS = 90; // Fixed radius for the animation ring
const GIFT_RING_CIRC = 2 * Math.PI * GIFT_RING_RADIUS;
const GIFT_RING_STROKE_WIDTH = 20; // Stroke width for animation ring

// Placeholder for user data - replace with actual data fetching
const userName = 'Isaiah';

// Define Icon type for safety
type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function HomeScreen() {
  const router = useRouter();
  const pathname = usePathname(); // Correctly get pathname
  const { signOut, isLoading: isAuthLoading, user } = useAuth();
  const [matchPercentage, setMatchPercentage] = useState(MIN_LEARNING_PERCENTAGE);
  const [isFetchingPercentage, setIsFetchingPercentage] = useState(true);
  const [boostedConvos, setBoostedConvos] = useState<number>(0); // State for boosted convos
  const [daysActive, setDaysActive] = useState<number>(0); // State for days active
  const [isFetchingStats, setIsFetchingStats] = useState(true); // Loading state for stats
  const [currentSwipes, setCurrentSwipes] = useState(0);
  const [nextGiftThreshold, setNextGiftThreshold] = useState(SWIPES_PER_GIFT);
  const [isGiftUnlocked, setIsGiftUnlocked] = useState(false);
  const [currentPickupLine, setCurrentPickupLine] = useState<string | null>(null);
  const [hasSeenCurrentGift, setHasSeenCurrentGift] = useState(false);
  const [completedGifts, setCompletedGifts] = useState(0);
  const [unclaimedGifts, setUnclaimedGifts] = useState(0);
  const [giftBounce] = useState(new Animated.Value(0)); // Keep bounce for idle
  const [showGiftContent, setShowGiftContent] = useState(false);
  const [isResettingSwipes, setIsResettingSwipes] = useState(false);
  const [currentGiftIndex, setCurrentGiftIndex] = useState(0);
  const [isTextInputModalVisible, setIsTextInputModalVisible] = useState(false);
  const [context, setContext] = useState('');
  const [lastText, setLastText] = useState('');
  const [inputMode, setInputMode] = useState<'screenshot' | 'text'>('screenshot');
  const [selectedMode, setSelectedMode] = useState<string>('first-move');
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [spicyLevel, setSpicyLevel] = useState(50);
  const [isGiftCooldown, setIsGiftCooldown] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [cooldownOpacity] = useState(new Animated.Value(1));
  const [progressAnimation] = useState(new Animated.Value(0)); // For gauge animation

  // Use Animated.Value for strokeDashoffset for smoother transitions
  const animatedStrokeDashoffset = useRef(new Animated.Value(CIRCUMFERENCE)).current;

  // State for Card Hover Animation
  const card1Anim = useRef(new Animated.Value(0)).current;
  const card2Anim = useRef(new Animated.Value(0)).current;

  // State for Gauge Pulse Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // State for Nav Underline Animation
  const navUnderlinePos = useRef(new Animated.Value(0)).current;
  const navUnderlineScale = useRef(new Animated.Value(0)).current;

  // --- ADDED NEW ANIMATION VALUES ---
  // → scale + rotate gift
  const giftAnim = useRef(new Animated.Value(0)).current;
  // → drive strokeDashoffset for animation ring
  const circleAnim = useRef(new Animated.Value(0)).current;
  // --- END ADDED NEW ANIMATION VALUES ---

  // --- ADDED NEW INTERPOLATIONS ---
  // Interpolate gift transforms from giftAnim
  const giftScaleAnim = giftAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.3, 1], // Pop effect
  });
  const giftRotateAnim = giftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'], // Full spin
  });

  // Compute dashoffset for the animation ring from circleAnim
  const ringStrokeDashoffset = circleAnim.interpolate({
    inputRange: [0, 100],
    // Animate from full circumference (hidden) to 0 (fully shown)
    outputRange: [GIFT_RING_CIRC, 0],
  });
  // --- END ADDED NEW INTERPOLATIONS ---

  // Fetch user data - Define before use in useFocusEffect
  const fetchUserData = useCallback(async () => {
    if (!user?.email) {
      console.log("No user email found, skipping data fetch.");
      resetGiftState();
      setCurrentSwipes(0);
      setNextGiftThreshold(SWIPES_PER_GIFT);
      setCompletedGifts(0);
      setUnclaimedGifts(0);
      return;
    }

    setIsFetchingPercentage(true);
    setIsFetchingStats(true);

    try {
      const headers: Record<string, string> = {
        'x-user-email': user.email,
        'X-Client-Type': 'mobile',
      };

      const [percentageResponse, statsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/learning-percentage`, { headers }),
        fetch(`${API_BASE_URL}/api/user-stats`, { headers })
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        console.log('Stats response:', statsData);

        const currentSwipesCount = statsData.dailySwipes || 0; // Use dailySwipes from backend log
        const completedGiftsCount = statsData.completedGifts || 0;
        // Removed reliance on backend's totalAvailableGifts for this calculation

        // Calculate earned gifts based *only* on current swipes
        const earnedGiftsBasedOnSwipes = Math.floor(currentSwipesCount / SWIPES_PER_GIFT);

        // Calculate unclaimed gifts based on earned vs completed
        const unclaimedCount = Math.max(0, earnedGiftsBasedOnSwipes - completedGiftsCount);

        console.log('Gift Debug (Corrected Calculation):', {
          currentSwipes: currentSwipesCount,
          completedGifts: completedGiftsCount,
          earnedBasedOnSwipes: earnedGiftsBasedOnSwipes,
          unclaimedCalculated: unclaimedCount,
          backendNextThreshold: statsData.nextGiftThreshold, // Log backend value
          hasPickupLine: !!statsData.currentPickupLine
        });

        // Always reset state first
        resetGiftState();
        
        setBoostedConvos(statsData.boostedConvos || 0);
        setDaysActive(statsData.daysActive || 0);
        setCurrentSwipes(currentSwipesCount);
        setCompletedGifts(completedGiftsCount);
        setUnclaimedGifts(unclaimedCount);
        
        // Set next threshold based on current swipes
        const nextThreshold = statsData.nextGiftThreshold || ((Math.floor(currentSwipesCount / SWIPES_PER_GIFT) + 1) * SWIPES_PER_GIFT);
        setNextGiftThreshold(nextThreshold);
        
        // Set gift availability based on unclaimed gifts
        const shouldShowGift = unclaimedCount > 0 && completedGiftsCount < currentSwipesCount;
        setIsGiftUnlocked(shouldShowGift);

        // Only show pickup line if we have unclaimed gifts
        if (shouldShowGift && statsData.currentPickupLine) {
          setCurrentPickupLine(statsData.currentPickupLine);
          setShowGiftContent(true);
          setHasSeenCurrentGift(statsData.hasSeenCurrentGift || false);
        }
      } else {
        console.error('Failed to fetch stats:', statsResponse.status);
        resetGiftState();
        setCurrentSwipes(0);
        setNextGiftThreshold(SWIPES_PER_GIFT);
        setCompletedGifts(0);
        setUnclaimedGifts(0);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      resetGiftState();
      setCurrentSwipes(0);
      setNextGiftThreshold(SWIPES_PER_GIFT);
      setCompletedGifts(0);
      setUnclaimedGifts(0);
    } finally {
      setIsFetchingPercentage(false);
      setIsFetchingStats(false);
    }
  }, [user?.email]);

  // Load persisted gift state
  useEffect(() => {
    const loadGiftState = async () => {
      try {
        if (user?.email) {
          const [giftContentState] = await Promise.all([
            AsyncStorage.getItem(`gift_content_${user.email}`)
          ]);
          
          if (giftContentState) {
            const { showGiftContent: savedShowGiftContent } = JSON.parse(giftContentState);
            setShowGiftContent(savedShowGiftContent);
          }
        }
      } catch (error) {
        console.error('Error loading gift state:', error);
      }
    };
    loadGiftState();
  }, [user?.email]);

  // Add focus effect to refresh state & manage animations
  useFocusEffect(
    useCallback(() => {
      console.log('Homepage focused, refreshing state...');
      // Reset states first to avoid flicker
      resetGiftState();
      setCurrentSwipes(0);
      setNextGiftThreshold(SWIPES_PER_GIFT);
      setCompletedGifts(0);
      setUnclaimedGifts(0);
      
      // Then fetch fresh data
      if (user?.email) {
        fetchUserData();
      }

      // Start/Stop bounce based on fetched data (may need slight delay)
      // Use setTimeout to check state after fetchUserData potentially updates it
      setTimeout(() => {
          const { hasGiftAvailable } = calculateGiftProgress();
          if (hasGiftAvailable) {
              startGiftBounce();
              stopPulseAnimation(); // Stop pulse if gift is available
          } else {
              stopGiftBounce();
              startPulseAnimation(); // Start pulse if no gift
          }
      }, 100); // Small delay to allow state update

      // Update Nav Underline
      updateNavUnderline(pathname);

      // Cleanup animations on blur
      return () => {
          stopGiftBounce();
          stopPulseAnimation();
      };
    }, [user?.email, fetchUserData, pathname]) // Add pathname dependency
  );

  // Animate progress on load or when swipes change
  useEffect(() => {
    const progressPercent = calculateProgress(); // Get percentage 0-100
    const targetOffset = CIRCUMFERENCE * (1 - progressPercent / 100);

    // Animate the strokeDashoffset
    Animated.timing(animatedStrokeDashoffset, {
      toValue: targetOffset,
      duration: 800, // Match transition duration from example
      easing: Easing.out(Easing.ease), // Use ease-out easing
      useNativeDriver: true, // strokeDashoffset can be animated natively
    }).start();

    // Also update the simple progress value if needed elsewhere
    progressAnimation.setValue(progressPercent);

  }, [currentSwipes, isFetchingStats]); // Re-run animation when swipes or loading state changes

  const handleUploadPress = () => {
    router.push('/upload'); // Navigate to the upload screen
  };

  const handleLogout = async () => {
    try {
      await signOut();
      // Navigation will be handled by RootLayout
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Logout Failed', 'Could not sign out. Please try again.');
    }
  };

  // Gift bounce animation
  const bounceAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const startGiftBounce = () => {
    // Ensure previous animation is stopped
    stopGiftBounce();
    
    giftBounce.setValue(0); // Reset before starting
    bounceAnimationRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(giftBounce, {
          toValue: -8, // Move up
          duration: 1000,
          easing: Easing.bezier(0.5, 0, 0.5, 1), // Ease in-out
          useNativeDriver: true,
        }),
        Animated.timing(giftBounce, {
          toValue: 0, // Move back down
          duration: 1000,
          easing: Easing.bezier(0.5, 0, 0.5, 1), // Ease in-out
          useNativeDriver: true,
        }),
      ])
    );
    bounceAnimationRef.current.start();
  };

  const stopGiftBounce = () => {
    if (bounceAnimationRef.current) {
      bounceAnimationRef.current.stop();
      bounceAnimationRef.current = null;
    }
    // Optionally reset position smoothly or instantly
    Animated.timing(giftBounce, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };
  
  // Update start/stop logic for bounce
  useEffect(() => {
      const { hasGiftAvailable } = calculateGiftProgress();
      if (hasGiftAvailable && !isAnimating && !isGiftCooldown) {
          startGiftBounce();
      } else {
          stopGiftBounce();
      }
      // Cleanup function to stop animation on unmount or when conditions change
      return () => stopGiftBounce();
  }, [isGiftUnlocked, isAnimating, isGiftCooldown]); // Rerun when gift availability or animation state changes

  // Add debug logging for gift state
  useEffect(() => {
    console.log('Gift State Debug:', {
      showGiftContent,
      currentPickupLine,
      hasSeenCurrentGift,
      isAnimating,
      isGiftCooldown,
      unclaimedGifts,
      completedGifts
    });
  }, [showGiftContent, currentPickupLine, hasSeenCurrentGift, isAnimating, isGiftCooldown, unclaimedGifts, completedGifts]);

  // Add reset mechanism
  const resetGiftState = () => {
    setShowGiftContent(false);
    setHasSeenCurrentGift(false);
    setCurrentPickupLine(null);
    setIsAnimating(false);
    setIsGiftCooldown(false);
    giftAnim.setValue(0); // Reset new animation value
    circleAnim.setValue(0); // Reset new animation value
  };

  // Update the gift reveal animation (Restore Spin)
  const animateNewGiftReveal = async () => {
    if (!user?.email || isAnimating) {
      console.log('Animation already running or no user email.');
      return;
    }

    stopGiftBounce();
    stopPulseAnimation();
    setIsAnimating(true);
    giftAnim.setValue(0); // Reset animation values
    circleAnim.setValue(0);

    // Fetch the data first
    let newPickupLine = null;
    let success = false;
    let fetchedStatsData = null;

    try {
      const headers: Record<string, string> = {
        'x-user-email': user.email,
        'X-Client-Type': 'mobile',
      };
      console.log('Fetching new pickup line...');
      const response = await fetch(`${API_BASE_URL}/api/user-stats`, { headers });

      if (response.ok) {
        fetchedStatsData = await response.json();
        console.log('Stats response:', fetchedStatsData);
        if (fetchedStatsData.currentPickupLine) {
          newPickupLine = fetchedStatsData.currentPickupLine;
          success = true;
          console.log('Got new pickup line:', newPickupLine);
        } else {
          console.log('No pickup line in response');
        }
      } else {
        console.log('Failed to fetch stats:', response.status);
      }
    } catch (error) {
      console.error('Error fetching pickup line:', error);
      // Don't return yet, let animation finish visually
    }

    // Run the animations in parallel
    Animated.parallel([
      Animated.timing(giftAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.back(2)), // Example easing
        useNativeDriver: true, // Scale and Rotate are native
      }),
      Animated.timing(circleAnim, {
        toValue: 100, // Animate ring to full (100%)
        duration: 1000,
        easing: Easing.out(Easing.quad), // Example easing
        useNativeDriver: true, // strokeDashoffset is native
      }),
    ]).start(async ({ finished }) => {
      console.log('Animation finished:', { finished, success, newPickupLine, fetchedStatsData });

      let finalUnclaimedCount = unclaimedGifts; // Start with current state

      // Update counts from fetched data if available
      if (fetchedStatsData) {
        const completedCount = fetchedStatsData.completedGifts || 0;
        const swipesCount = fetchedStatsData.dailySwipes || 0;
        const earnedBasedOnSwipes = Math.floor(swipesCount / SWIPES_PER_GIFT);
        finalUnclaimedCount = Math.max(0, earnedBasedOnSwipes - completedCount);

        console.log('Gift Reveal Callback Update:', {
            swipes: swipesCount, completed: completedCount, earned: earnedBasedOnSwipes, unclaimedCalculated: finalUnclaimedCount
        });

        setCompletedGifts(completedCount);
        setUnclaimedGifts(finalUnclaimedCount);
        setIsGiftUnlocked(finalUnclaimedCount > 0);
      }

      // Handle display logic after animation
      if (finished && success && newPickupLine) {
        setCurrentPickupLine(newPickupLine);
        setShowGiftContent(true); // Let the pickup line component show
        setHasSeenCurrentGift(true);

        if (user?.email) {
          try {
            await AsyncStorage.setItem(`gift_content_${user.email}`, JSON.stringify({
              showGiftContent: true, // Persist that content should be shown
              currentPickupLine: newPickupLine
            }));
          } catch (error) { console.error('Error saving gift state:', error); }
        }

        if (finalUnclaimedCount === 0) {
          console.log('Last gift opened, showing briefly then resetting.');
          setTimeout(() => { resetGiftState(); fetchUserData(); }, 1500);
        } else {
          // Apply cooldown for next gift
          setIsGiftCooldown(true);
          Animated.sequence([
            Animated.timing(cooldownOpacity, { toValue: 0.5, duration: 200, useNativeDriver: true }),
            Animated.timing(cooldownOpacity, { toValue: 1, duration: 200, useNativeDriver: true, delay: 1600 })
          ]).start(() => {
             setIsGiftCooldown(false);
             // Restart bounce if still unlocked after cooldown
             const currentProgress = calculateGiftProgress();
             if (currentProgress.hasGiftAvailable) { startGiftBounce(); }
          });
          // The timeout for setting isGiftCooldown false is now handled by the animation callback
        }
      } else {
        console.log('Failed to show pickup line or animation interrupted, resetting visual state');
        resetGiftState(); // Reset visual elements
        fetchUserData(); // Refetch data to ensure consistency
      }

      setIsAnimating(false); // Animation sequence complete
    });
  };

  // Calculate progress percentage (0-100)
  const calculateProgress = () => {
    if (isFetchingStats || nextGiftThreshold === 0) return 0; // Handle loading/zero threshold

    // Use the state value for hasGiftAvailable
    const hasGiftAvailable = unclaimedGifts > 0;
    if (hasGiftAvailable) {
        return 100; // Show full if a gift is ready
    }

    if (currentSwipes === 0) return 0; // Start at 0 if no swipes

    // Calculate progress towards the *correct* next threshold from state
    const progressTowardsNext = currentSwipes % SWIPES_PER_GIFT;

    // If exactly on threshold, but no gift available, show 0% for next cycle
    // This logic seems sound assuming SWIPES_PER_GIFT determines cycles
    if (progressTowardsNext === 0 && currentSwipes > 0 && !hasGiftAvailable) {
        return 0;
    }

    const progress = (progressTowardsNext / SWIPES_PER_GIFT) * 100;
    return Math.min(progress, 100); // Cap at 100%
  };

  // Calculate gift progress numbers (Corrected Logic)
  const calculateGiftProgress = () => {
    // Calculate current progress towards the *next* gift cycle
    const progressTowardsNext = currentSwipes % SWIPES_PER_GIFT;
    // Calculate remaining swipes for the current cycle
    // If progress is 0 AND swipes > 0, it means a cycle was just completed, so remaining is full cycle.
    const remainingSwipes = (progressTowardsNext === 0 && currentSwipes > 0)
                              ? SWIPES_PER_GIFT
                              : SWIPES_PER_GIFT - progressTowardsNext;

    // Determine if a gift is available based *only* on the unclaimedGifts state from backend
    const hasGiftAvailable = unclaimedGifts > 0;

    console.log('Progress Debug (Corrected):', {
      // Log state values directly where available
      currentSwipes,
      unclaimedGifts, // Authoritative count from backend via state
      progressTowardsNext,
      nextGiftThreshold, // Authoritative threshold from backend via state
      remainingSwipes,
      isGiftUnlocked, // State based on unclaimedGifts
      completedGifts, // Authoritative count from backend via state
      hasGiftAvailable // Derived directly from unclaimedGifts state
      // Removed the locally calculated totalAvailableGifts
    });

    return {
      currentProgress: progressTowardsNext,
      nextThreshold: nextGiftThreshold, // Use the state value
      remainingSwipes,
      completedGifts, // Use state value
      hasGiftAvailable, // Use derived value from state
      // totalAvailableGifts is no longer needed here, state logic relies on unclaimedGifts
    };
  };

  // Handle gift press
  const handleGiftPress = () => {
    const giftProgress = calculateGiftProgress();
    console.log('Gift Press Debug:', {
      unclaimedGifts,
      isGiftUnlocked,
      hasGiftAvailable: giftProgress.hasGiftAvailable,
      isGiftCooldown,
      isAnimating
    });

    if (giftProgress.hasGiftAvailable && !isGiftCooldown && !isAnimating) {
      // Directly trigger the new reveal animation
      animateNewGiftReveal();
    }
  };

  const handleManualTextPress = () => {
    setIsTextInputModalVisible(true);
    setInputMode('text');
  };

  const handleModeSelect = (mode: string) => {
    setSelectedMode(mode);
    setShowModeSelection(false);
  };

  const handleTextSubmit = () => {
    if (!context || !lastText) {
      Alert.alert('Missing Information', 'Please fill in both the conversation context and the last message.');
      return;
    }
    
    // Show mode selection after text input
    setShowModeSelection(true);
  };

  const handleFinalSubmit = () => {
    // Navigate to swipes page with all necessary data
    router.push({
      pathname: '/swipes-page',
      params: {
        context,
        lastText,
        mode: 'text',
        selectedMode,
        spicyLevel
      }
    });
    
    // Reset states
    setIsTextInputModalVisible(false);
    setShowModeSelection(false);
    setContext('');
    setLastText('');
    setSelectedMode('first-move');
    setSpicyLevel(50);
  };

  // Handle resetting daily swipes
  const handleResetSwipes = async () => {
    if (!user?.email || currentSwipes === 0) return;
    
    setIsResettingSwipes(true);
    
    try {
      const headers: Record<string, string> = {
        'x-user-email': user.email,
        'X-Client-Type': 'mobile',
      };
      
      const response = await fetch(`${API_BASE_URL}/api/reset-daily-swipes`, {
        method: 'POST',
        headers
      });
      
      if (response.ok) {
        Alert.alert('Success', 'Daily swipes reset. Let\'s go!');
        fetchUserData();
      } else {
        Alert.alert('Error', 'Failed to reset swipes. Please try again.');
      }
    } catch (error) {
      console.error('Error resetting swipes:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsResettingSwipes(false);
    }
  };

  // Determine current state for styling
  const giftState = calculateGiftProgress().hasGiftAvailable ? 'gift-open' : 'no-gift';
  const gaugeForegroundColor = giftState === 'gift-open' ? COLORS.black : COLORS.primaryPink;

  // --- New Animations --- 

  // Card Press Animation
  const createCardPressHandlers = (animValue: Animated.Value) => ({
    onPressIn: () => {
      Animated.timing(animValue, {
        toValue: 1,
        duration: 150, // Faster press in
        useNativeDriver: true,
      }).start();
    },
    onPressOut: () => {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 300, // Slower press out
        useNativeDriver: true,
      }).start();
    },
  });

  const card1PressHandlers = createCardPressHandlers(card1Anim);
  const card2PressHandlers = createCardPressHandlers(card2Anim);

  const getCardAnimatedStyle = (animValue: Animated.Value) => ({
    transform: [
      { perspective: 600 },
      {
        rotateX: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '3deg'], // Tilt slightly
        }),
      },
      {
        rotateY: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '5deg'], // Tilt slightly more
        }),
      },
    ],
    shadowOpacity: animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.1, 0.08], // Adjust shadow slightly (shadow props non-native)
    }),
    // Note: Animating elevation directly isn't smooth, shadowOpacity is better on iOS
  });

  // Gauge Pulse Animation
  const pulseAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const startPulseAnimation = () => {
      stopPulseAnimation(); // Ensure only one loop runs
      pulseAnim.setValue(1); // Reset before starting
      pulseAnimationRef.current = Animated.loop(
          Animated.sequence([
              Animated.timing(pulseAnim, {
                  toValue: 1.05,
                  duration: 1250, // 2.5s total cycle
                  easing: Easing.inOut(Easing.ease),
                  useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                  toValue: 1,
                  duration: 1250,
                  easing: Easing.inOut(Easing.ease),
                  useNativeDriver: true,
              }),
          ])
      );
      pulseAnimationRef.current.start();
  };
  const stopPulseAnimation = () => {
      if (pulseAnimationRef.current) {
          pulseAnimationRef.current.stop();
          pulseAnimationRef.current = null;
      }
      // Reset scale smoothly
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  // Nav Underline Animation
  const updateNavUnderline = (currentPath: string) => {
    let targetIndex = -1;
    if (currentPath === '/homepage') targetIndex = 0;
    else if (currentPath === '/saved-responses') targetIndex = 1;
    else if (currentPath === '/profile') targetIndex = 2;
    else if (currentPath === '/image-rating') targetIndex = 3;
    
    const screenWidth = Dimensions.get('window').width;
    const navItemWidth = screenWidth / 4; // Assuming 4 items
    const targetPosition = targetIndex * navItemWidth;

    if (targetIndex !== -1) {
        Animated.parallel([
            Animated.timing(navUnderlinePos, {
                toValue: targetPosition,
                duration: 300,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true, // transform translateX is native
            }),
            Animated.timing(navUnderlineScale, {
                toValue: 1,
                duration: 300,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true, // transform scaleX is native
            }),
        ]).start();
    } else {
        // Hide if path doesn't match
        Animated.timing(navUnderlineScale, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
        }).start();
    }
  };

  // --- End New Animations ---

  // Debug logs before rendering
  console.log('[DEBUG] Rendering HomeScreen...');

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Background Shapes */}
      <View style={styles.backgroundShape1} />
      <View style={styles.backgroundShape2} />
      {/* Use LinearGradient if installed and desired */}
      {/* <LinearGradient colors={[COLORS.lightPinkBg, 'transparent']} style={styles.backgroundShape1} /> */}
      {/* <LinearGradient colors={['transparent', COLORS.primaryPinkTransparent, COLORS.primaryPinkTransparent, 'transparent']} style={styles.backgroundShape2} /> */}

      <ScrollView contentContainerStyle={styles.container} scrollIndicatorInsets={{ right: 1 }}>
        {/* Welcome Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>
            <Text style={styles.welcomePrefix}>Welcome </Text>
            <Text style={styles.userName}>{userName}!</Text>
          </Text>
          <TouchableOpacity onPress={handleLogout} disabled={isAuthLoading} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={28} color={COLORS.primaryPink} />
          </TouchableOpacity>
        </View>

        {/* Main Content Wrapper */}
        <View style={styles.centeredContentWrapper}>
          {/* Main Content Area */}
          <View style={styles.mainContentArea}>
            {/* Main Content Container */}
            <View style={styles.mainContent}>
              {/* Daily Pickup Line - Show when we have a line */}
              {currentPickupLine && (
                <View style={[
                  styles.pickupLineContainer,
                  giftState === 'gift-open' && styles.pickupLineContainerGiftOpen // Apply specific style when gift is open
                ]}>
                  <Text style={[
                      styles.pickupLineHashtag,
                      giftState === 'gift-open' && styles.pickupLineHashtagGiftOpen // Style for gift open state
                  ]}>#dailypickuplines</Text>
                  <View style={styles.giftIconContainer}>
                    <Ionicons name="gift" size={24} color={giftState === 'gift-open' ? COLORS.white : COLORS.gold} />
                  </View>
                  <Text style={[
                      styles.pickupLineText,
                      giftState === 'gift-open' && styles.pickupLineTextGiftOpen // Style for gift open state
                  ]}>"{currentPickupLine}"</Text>
                </View>
              )}

              {/* SVG Progress Gauge / Gift - Conditional Rendering */}
              {giftState === 'no-gift' ? (
                // STATE: No Gift - Show SVG Gauge and Progress Text
                <Animated.View style={[
                    styles.progressContainer,
                    { transform: [{ scale: pulseAnim }] } // Apply pulse scale only when no gift
                ]}>
                  <Svg width={GAUGE_SIZE} height={GAUGE_SIZE} viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}>
                    {/* Background Circle */}
                    <Circle
                      cx={GAUGE_SIZE / 2}
                      cy={GAUGE_SIZE / 2}
                      r={RADIUS}
                      stroke={COLORS.grey}
                      strokeWidth={STROKE_WIDTH}
                      fill="none"
                    />
                    {/* Foreground Circle (Animated) - Only for no-gift state */}
                    <AnimatedCircle
                      cx={GAUGE_SIZE / 2}
                      cy={GAUGE_SIZE / 2}
                      r={RADIUS}
                      stroke={gaugeForegroundColor} // Should be COLORS.primaryPink here
                      strokeWidth={STROKE_WIDTH}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={CIRCUMFERENCE}
                      strokeDashoffset={animatedStrokeDashoffset}
                      transform={`rotate(-90 ${GAUGE_SIZE / 2} ${GAUGE_SIZE / 2})`}
                    />
                  </Svg>

                  {/* Content Overlay (Numerical Progress) */}
                  <View style={styles.progressContentTouchable}> { /* Use View, not Touchable */}
                    <View style={styles.progressContentInner}>
                      {isFetchingStats ? (
                          <ActivityIndicator size="large" color={COLORS.primaryPink} />
                      ) : (
                        <View style={styles.progressTextContainer}>
                          <Text style={styles.swipeCountText}>
                            {calculateGiftProgress().currentProgress}
                            <Text style={styles.swipeGoalText}> / {SWIPES_PER_GIFT}</Text>
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Animated.View>
              ) : (
                // STATE: Gift Open - Show Gift Icon and Tap Interaction
                <View style={[ styles.progressContainer, { opacity: cooldownOpacity } ]}>
                    <TouchableOpacity
                      onPress={handleGiftPress}
                      disabled={isFetchingStats || !calculateGiftProgress().hasGiftAvailable || isAnimating || isGiftCooldown}
                      style={styles.progressContentTouchable} // Covers the area
                      accessibilityLabel={isAnimating ? "Opening gift..." : `Gift available (${unclaimedGifts} remaining), tap to open`}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isFetchingStats || isAnimating || isGiftCooldown }}
                    >
                      <View style={styles.progressContentInner}>
                         {/* Animated Wrapper for Gift Icon (Scale, Spin, replaces Glow) */}
                         <Animated.View style={[
                             styles.innerGiftWrapper, // Keep this for centering etc.
                             {
                                 transform: [
                                     // Apply new animations: scale and rotate
                                     { scale: giftScaleAnim },
                                     { rotate: giftRotateAnim }
                                     // Removed old scale and spin
                                 ]
                             },
                          ]}>
                            {/* Bouncing Gift Icon (Still uses giftBounce for idle) */}
                           <Animated.View style={{ alignItems: 'center', transform: [{ translateY: giftBounce }] }}>
                             <Ionicons name="gift" size={52} color={COLORS.gold} style={styles.giftIcon} />
                             {/* Display unclaimed gifts count as a badge */}
                             {!isAnimating && unclaimedGifts > 0 && (
                               <View style={styles.giftCountBadge}>
                                 <Text style={styles.giftCountText}>{unclaimedGifts}</Text>
                               </View>
                             )}
                             {/* Text changes based on state */}
                             <Text style={styles.tapToOpenText}>
                               {isAnimating ? "Opening..." : isGiftCooldown ? "Nice!" : "Tap to Open!"}
                             </Text>
                           </Animated.View>
                         </Animated.View>

                         {/* Conditionally Render SVG Ring Animation Overlay */}
                         {isAnimating && (
                           <View style={styles.giftRingOverlay}>
                              <Svg width={GIFT_RING_RADIUS * 2 + GIFT_RING_STROKE_WIDTH} height={GIFT_RING_RADIUS * 2 + GIFT_RING_STROKE_WIDTH} style={{ transform: [{ rotate: '-90deg' }] }}>
                                {/* grey track */}
                                <Circle
                                  cx={GIFT_RING_RADIUS + GIFT_RING_STROKE_WIDTH / 2}
                                  cy={GIFT_RING_RADIUS + GIFT_RING_STROKE_WIDTH / 2}
                                  r={GIFT_RING_RADIUS}
                                  stroke={COLORS.grey} // Background track color
                                  strokeWidth={GIFT_RING_STROKE_WIDTH}
                                  fill="none"
                                />
                                {/* animated fill */}
                                <AnimatedCircle
                                  cx={GIFT_RING_RADIUS + GIFT_RING_STROKE_WIDTH / 2}
                                  cy={GIFT_RING_RADIUS + GIFT_RING_STROKE_WIDTH / 2}
                                  r={GIFT_RING_RADIUS}
                                  stroke={COLORS.primaryPink} // Fill color
                                  strokeWidth={GIFT_RING_STROKE_WIDTH}
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeDasharray={GIFT_RING_CIRC}
                                  strokeDashoffset={ringStrokeDashoffset} // Driven by circleAnim
                                />
                              </Svg>
                           </View>
                         )}
                       </View>
                    </TouchableOpacity>
                </View>
              )}
              {/* End Conditional Rendering */}

              {/* Helper Text below the circle (State-driven) */}
              {giftState === 'no-gift' && !isFetchingStats && (
                <>
                  <Text style={styles.swipesHelperText}>
                    {calculateGiftProgress().remainingSwipes} daily swipes to next gift
                  </Text>
                  <Text style={styles.swipesResetTextSmall}>
                       Resets at midnight
                  </Text>
                  {/* Tooltip - Use 'tip' style */}
                  {currentSwipes < SWIPES_PER_GIFT && (
                     <Text style={styles.tooltipText}>
                         Tap the gauge to charge your next gift!
                     </Text>
                  )}
                </>
              )}
              {/* Optional: Add text for gift-open state if needed */}


              {/* Stats Container */}
              <View style={styles.statsRow}>
                {isFetchingStats ? (
                  <ActivityIndicator size="small" color={COLORS.black} />
                ) : (
                  <>
                    {/* Convos Boosted Card with 3D Press */}
                    <Pressable {...card1PressHandlers}>
                       <Animated.View style={[styles.statCard, getCardAnimatedStyle(card1Anim)]}>
                          <Ionicons
                            name={boostedConvos > 0 ? "flame" : "flame-outline"}
                            size={24}
                            color={COLORS.primaryPink}
                            style={styles.statIcon}
                          />
                          <Text style={styles.statLabel}>
                            {boostedConvos > 0 ? `🔥 ${boostedConvos} Convos Boosted!` : "Boost a Convo!"}
                          </Text>
                       </Animated.View>
                    </Pressable>

                    {/* Days Active Card with 3D Press */}
                    <Pressable {...card2PressHandlers}>
                       <Animated.View style={[styles.statCard, getCardAnimatedStyle(card2Anim)]}>
                          <Ionicons
                            name={daysActive > 0 ? "calendar" : "calendar-outline"}
                            size={24}
                            color={COLORS.primaryPink}
                            style={styles.statIcon}
                          />
                          <Text style={styles.statLabel}>
                            {daysActive > 0 ? `${daysActive} Days Active` : "Let's get started!"}
                          </Text>
                        </Animated.View>
                    </Pressable>
                  </>
                )}
              </View>

              {/* Action Buttons Container */}
              <View style={styles.ctaContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.uploadButton]} // Updated style for glass effect
                  onPress={handleUploadPress}
                  activeOpacity={0.8}
                >
                  <Text style={styles.uploadButtonText}>Upload your Screenshot</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.manualButton]}
                  onPress={handleManualTextPress}
                  activeOpacity={0.8}
                >
                  <Text style={styles.manualButtonText}>Type Text Manually</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation with Underline */}
      <View style={styles.bottomNav}>
          {/* Nav Items */}  
          {[ 
              { path: '/homepage', label: 'Home', icon: 'home', iconOutline: 'home-outline' },
              { path: '/saved-responses', label: 'Bookmarks', icon: 'bookmark', iconOutline: 'bookmark-outline' },
              { path: '/profile', label: 'Profile', icon: 'person', iconOutline: 'person-outline' },
              { path: '/image-rating', label: 'Favorites', icon: 'star', iconOutline: 'star-outline' },
          ].map((item, index) => {
              const isActive = pathname === item.path;
              const iconName: IconName = isActive ? item.icon as IconName : item.iconOutline as IconName; // Determine icon name and assert type
              return (
                  <TouchableOpacity 
                      key={item.path}
                      style={styles.navItem}
                      onPress={() => isActive ? {} : router.replace(item.path as any)} // Use type assertion for path
                  >
                      <Ionicons 
                          name={iconName} // Use typed icon name
                          size={26} 
                          color={isActive ? COLORS.primaryPink : COLORS.textSecondary} 
                      />
                      <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
                  </TouchableOpacity>
              );
          })}
          {/* Animated Underline */}  
          <Animated.View 
              style={[
                  styles.navUnderline,
                  {
                      transform: [
                          { translateX: navUnderlinePos },
                          { scaleX: navUnderlineScale },
                      ],
                  },
              ]}
          />
      </View>

      {/* Modal */}
      <Modal
        visible={isTextInputModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setIsTextInputModalVisible(false);
          setShowModeSelection(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {showModeSelection ? 'Select Mode' : 'Enter Conversation Details'}
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  setIsTextInputModalVisible(false);
                  setShowModeSelection(false);
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={COLORS.black} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              {!showModeSelection ? (
                // Text Input View
                <>
                  <Text style={styles.inputLabel}>Conversation Context</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Describe things to help context. Inside jokes, where you met, things they like etc..."
                    value={context}
                    onChangeText={setContext}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />

                  <Text style={styles.inputLabel}>Their Last Message</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="What was their last message?"
                    value={lastText}
                    onChangeText={setLastText}
                  />

                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      (!context || !lastText) && styles.submitButtonDisabled
                    ]}
                    onPress={handleTextSubmit}
                    disabled={!context || !lastText}
                  >
                    <Text style={styles.submitButtonText}>Continue</Text>
                  </TouchableOpacity>
                </>
              ) : (
                // Mode Selection View
                <>
                  <View style={styles.modeContainer}>
                    {[
                      { name: 'First Move', emoji: '👋', desc: 'Starting the conversation' },
                      { name: 'Mid Game', emoji: '🎯', desc: 'Keep the chat going' },
                      { name: 'Date Setup', emoji: '📅', desc: 'Time to meet up' },
                      { name: 'Recovery', emoji: '🚑', desc: 'Save a dying chat' },
                    ].map((phase) => (
                      <TouchableOpacity
                        key={phase.name}
                        style={[
                          styles.modeButton,
                          selectedMode === phase.name.toLowerCase().replace(' ', '-') && styles.modeButtonSelected
                        ]}
                        onPress={() => handleModeSelect(phase.name.toLowerCase().replace(' ', '-'))}
                      >
                        <Text style={styles.modeEmoji}>{phase.emoji}</Text>
                        <View style={styles.modeTextContainer}>
                          <Text style={styles.modeName}>{phase.name}</Text>
                          <Text style={styles.modeDesc}>{phase.desc}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.spicyMeterContainer}>
                    <Text style={styles.spicyLabel}>Spicy Level</Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={100}
                      value={spicyLevel}
                      onValueChange={setSpicyLevel}
                      minimumTrackTintColor={COLORS.primaryPink}
                      maximumTrackTintColor={COLORS.lightGrey}
                    />
                    <View style={styles.spicyLevels}>
                      <Text style={styles.spicyLevelText}>Just Friends</Text>
                      <Text style={styles.spicyLevelText}>Lil Smooth</Text>
                      <Text style={styles.spicyLevelText}>Too Spicy</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleFinalSubmit}
                  >
                    <Text style={styles.submitButtonText}>Generate Responses</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Create Animated version of Circle for native animation
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white, // --bg equivalent
    position: 'relative', // Needed for absolute positioned shapes
    overflow: 'hidden', // Contain shapes
  },
  backgroundShape1: { // Pink orb
      position: 'absolute',
      top: '-20%', // Adjust positioning as needed
      left: '-10%',
      width: 300,
      height: 300,
      borderRadius: 150,
      backgroundColor: COLORS.lightPinkBg, // Solid color placeholder
      // Use LinearGradient component for actual gradient
      zIndex: -1,
      opacity: 0.5, // Make it softer
  },
  backgroundShape2: { // Diagonal stripe
      position: 'absolute',
      bottom: -50,
      right: -50,
      width: 400,
      height: 400,
      backgroundColor: COLORS.primaryPinkTransparent, // Solid color placeholder
      // Use LinearGradient component for actual gradient
      transform: [{ rotate: '20deg' }],
      zIndex: -1,
      opacity: 0.7,
  },
  container: {
    flexGrow: 1,
    backgroundColor: 'transparent', // Make container transparent to see shapes
    alignItems: 'center',
    paddingBottom: 100,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between', // Keep space between for alignment
    alignItems: 'center', // Vertically center items
    paddingHorizontal: 20, // Consistent horizontal padding
    paddingTop: Platform.OS === 'android' ? 25 : 20, // Adjust top padding if needed
    paddingBottom: 16, // Consistent bottom padding
  },
  centeredContentWrapper: { // This might be redundant if container centers
    flex: 1,
    width: '100%', // Take full width
    justifyContent: 'flex-start', // Align content to the top
    alignItems: 'center', // Center items horizontally
    paddingHorizontal: 0, // Remove padding here, apply to inner content if needed
  },
  mainContentArea: {
    width: '100%',
    paddingTop: 20, // Space from header
    alignItems: 'center', // Center the main content block
  },
  mainContent: {
    width: '90%', // Constrain content width
    alignItems: 'center', // Center items within this block
    paddingBottom: 32, // Add padding at the bottom of the main content block
    backgroundColor: 'transparent', // Ensure content area doesn't block shapes
  },
  welcomeText: { // Updated for H1 style
    fontSize: 24,
    fontWeight: 'bold', // Make the whole welcome bold for emphasis
    color: COLORS.black,
    flexShrink: 1,
    marginRight: 10,
    // Removed nested Text for simplicity, apply bold/color directly
  },
  welcomePrefix: {
    // Style removed, incorporated into welcomeText
  },
  userName: { // Keep specific styling for username color
    color: COLORS.primaryPink, // Apply pink color directly
    fontWeight: 'bold', // Ensure it remains bold
  },
  logoutButton: {
    padding: 12, // Increased padding for better tap target
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: MIN_TAP_TARGET_SIZE,
    minHeight: MIN_TAP_TARGET_SIZE,
  },
  pickupLineContainer: { // Base style
    width: '100%',
    backgroundColor: COLORS.black, // Default background
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4, },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  pickupLineContainerGiftOpen: { // Style for gift-open state
      backgroundColor: COLORS.primaryPink, // Pink background when gift is open
      shadowColor: COLORS.primaryPink, // Pink shadow
  },
  pickupLineHashtag: { // Base style
    position: 'absolute',
    top: 10,
    right: 16,
    color: COLORS.secondaryPink, // Default color
    fontSize: 12,
    fontWeight: '500',
  },
  pickupLineHashtagGiftOpen: { // Style for gift-open state
      color: COLORS.white,
      opacity: 0.8,
  },
  giftIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 215, 0, 0.25)', // Slightly stronger gold bg
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickupLineText: { // Base style
    color: COLORS.white, // Default color (on black)
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 24,
  },
  pickupLineTextGiftOpen: { // Style for gift-open state
      color: COLORS.white, // Ensure it's white on pink background too
  },
  progressContainer: { // Now wrapped by Animated.View for pulse
    width: GAUGE_SIZE,
    height: GAUGE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
    position: 'relative', // Needed for absolute positioning of overlay
  },
  progressContentTouchable: { // Absolutely positioned overlay for interactions
    ...StyleSheet.absoluteFillObject, // Take up same space as SVG
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: GAUGE_SIZE / 2, // Make touchable area circular
    padding: STROKE_WIDTH, // Ensure content inside doesn't overlap stroke visually
  },
  progressContentInner: { // Inner container within touchable if needed
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  innerGiftWrapper: { // Ensure this style exists for rotation/scale/glow target
      alignItems: 'center',
      justifyContent: 'center',
  },
  statsRow: { // Flexbox is fine for this layout
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%', // Take full width available in mainContent
    marginBottom: 24,
    // Removed paddingHorizontal here, handled by card margin/padding or mainContent padding
  },
  statCard: { // Added transition hints, removed static shadow if animated
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryPink,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '47%',
    elevation: 4, // Keep base elevation for Android
    minHeight: 110,
  },
  statIcon: {
    marginBottom: 8, // Space between icon and text
  },
  statLabel: { // Updated typography
    fontSize: 16, // Consistent body text size
    fontWeight: '500',
    color: COLORS.darkGray, // Use dark gray
    textAlign: 'center',
    lineHeight: 20, // Add line-height
  },
  ctaContainer: { // Consistent spacing
    width: '90%', // Match mainContent width
    alignItems: 'center',
    marginTop: 16, // Space above buttons
  },
  button: { // Base button style
    width: '100%',
    paddingVertical: 16, // var(--gap) ?
    paddingHorizontal: 16,
    borderRadius: 12, // var(--radius)
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16, // var(--gap)
    minHeight: 50,
  },
  uploadButton: { // Primary button style - Glassmorphism adaptation
    backgroundColor: COLORS.blackTransparent80, // Semi-transparent black
    borderWidth: 1,
    borderColor: COLORS.whiteTransparent20, // Subtle white border
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 }, // Adjusted shadow
    shadowOpacity: 0.3, // Adjusted shadow
    shadowRadius: 16, // Adjusted shadow
    elevation: 10, // Higher elevation for glass effect
    // Note: backdrop-filter is not available
  },
  uploadButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  manualButton: { // Secondary button style
    backgroundColor: COLORS.white, // Ensure background is white
    borderWidth: 2,
    borderColor: COLORS.primaryPink,
    // Remove default elevation/shadow if only border is desired
    elevation: 0,
    shadowOpacity: 0,
  },
  manualButtonText: {
    color: COLORS.primaryPink,
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomNav: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: Platform.OS === 'ios' ? 90 : 75,
      paddingBottom: Platform.OS === 'ios' ? 20 : 5,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      backgroundColor: COLORS.white,
      borderTopWidth: 1,
      borderTopColor: COLORS.lightGrey,
  },
  navItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      minHeight: MIN_TAP_TARGET_SIZE + 25,
  },
  navLabel: {
    fontSize: 10,
    color: COLORS.textSecondary, // Default grey color
    marginTop: 4, // Space between icon and label
  },
  navLabelActive: {
    color: COLORS.primaryPink, // Active color
    fontWeight: '600',
  },
  swipeCountText: { // Inside SVG overlay
    fontSize: 42, // Adjust size as needed to fit
    fontWeight: '600',
    color: COLORS.primaryPink,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    includeFontPadding: false, // Try to align text better
    textAlignVertical: 'center', // Try to align text better
    // lineHeight: 48, // May not be needed if centered well
  },
  swipeGoalText: { // Inside SVG overlay
    fontSize: 20, // Adjust size as needed
    color: COLORS.textSecondary,
    fontWeight: '400',
    opacity: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    // lineHeight: 24,
  },
  swipesHelperText: { // Below SVG gauge
    fontSize: 16,
    color: COLORS.darkGray, // --gray-500
    marginTop: 16, // var(--gap)
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 24,
  },
  swipesResetTextSmall: { // Below SVG gauge
    fontSize: 16,
    color: COLORS.darkGray,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 24,
    opacity: 0.8,
  },
  tooltipText: { // Style for the tooltip (State A)
    fontSize: 14,
    color: COLORS.darkGray, // --gray-500
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
    // opacity: 0; // Controlled by conditional rendering, not style fade
  },
  tapToOpenText: { // Inside SVG overlay (State B)
    fontSize: 14,
    color: COLORS.primaryPink,
    marginTop: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: { // Consistent padding/radius
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20, // Consistent padding
    maxHeight: '80%',
  },
  modalHeader: { // Consistent spacing
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { // Consistent typography
    fontSize: 22, // Slightly larger modal title
    fontWeight: 'bold',
    color: COLORS.black,
  },
  closeButton: {
    padding: 8, // Better tap target
  },
  modalScrollView: {
    maxHeight: '100%',
  },
  inputLabel: { // Consistent typography
    fontSize: 16, // Match body text
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  textInput: { // Consistent styling
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
    borderRadius: 12, // Consistent radius
    padding: 16, // Consistent padding
    marginBottom: 16, // Consistent margin
    fontSize: 16, // Consistent font size
    backgroundColor: COLORS.white,
    minHeight: 50, // Min height
    lineHeight: 20, // Added line height for multiline
  },
  submitButton: { // Inherit base button styles? Or keep separate? Keep separate for now.
    backgroundColor: COLORS.primaryPink,
    paddingVertical: 16, // Consistent padding
    borderRadius: 12, // Consistent radius
    alignItems: 'center',
    marginBottom: 30, // Keep larger margin at bottom of modal
    minHeight: 50,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.lightGrey,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modeContainer: {
    marginBottom: 16, // Consistent margin
  },
  modeButton: { // Consistent styling
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16, // Consistent padding
    backgroundColor: COLORS.grey,
    borderRadius: 12, // Consistent radius
    marginBottom: 12, // Consistent margin
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeButtonSelected: { // Consistent styling
    backgroundColor: COLORS.lightPink,
    borderColor: COLORS.primaryPink,
  },
  modeEmoji: {
    fontSize: 24,
    marginRight: 16, // Consistent spacing
  },
  modeTextContainer: {
    flex: 1,
  },
  modeName: { // Consistent typography
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 4,
  },
  modeDesc: { // Consistent typography
    fontSize: 14, // Slightly smaller for description
    color: COLORS.darkGray, // Dark gray
    lineHeight: 18,
  },
  spicyMeterContainer: {
    marginBottom: 24, // Consistent margin
  },
  spicyLabel: { // Consistent typography
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 12, // Consistent margin
  },
  slider: {
    width: '100%',
    height: 40,
  },
  spicyLevels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8, // Consistent margin
  },
  spicyLevelText: { // Consistent typography
    fontSize: 14, // Match mode desc
    color: COLORS.darkGray, // Dark gray
  },
  progressTextContainer: {
    alignItems: 'center',
  },
  giftIcon: { // Added style for gift icon (needed for potential pulse on icon itself)
      marginBottom: 8, // Add some space below icon before text/badge
  },
  giftCountBadge: { // Style for the gift count badge
      position: 'absolute',
      top: -5, // Adjust position as needed
      right: -10,
      backgroundColor: COLORS.primaryPink,
      borderRadius: 12,
      paddingHorizontal: 6,
      paddingVertical: 2,
      minWidth: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1, // Ensure it's above the icon if overlapping
      borderWidth: 1,
      borderColor: COLORS.white,
  },
  giftCountText: { // Style for the text inside the badge
      color: COLORS.white,
      fontSize: 12,
      fontWeight: 'bold',
  },
  giftRingOverlay: { // Style for the SVG ring container
    ...StyleSheet.absoluteFillObject, // Position it over the gift icon area
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent', // Ensure it doesn't block visually
  },
  navUnderline: {
      position: 'absolute',
      bottom: 8, // Position near bottom of nav bar
      left: 0, // Position is controlled by translateX
      width: Dimensions.get('window').width / 4, // Width of one nav item
      height: 3,
      backgroundColor: COLORS.primaryPink,
      borderRadius: 2,
  },
});
