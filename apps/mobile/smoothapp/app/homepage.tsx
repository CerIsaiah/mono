import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, ActivityIndicator, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Assuming use of Expo icons
import { useRouter, useFocusEffect } from 'expo-router'; // Import useRouter and useFocusEffect
import { useAuth } from '../src/context/AuthContext'; // Import useAuth

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
  lightGrey: '#E0E0E0', // Added for lightGrey color
  gold: '#FFD700',
};

// Add API base URL constant and Minimum Learning Percentage
const API_BASE_URL = 'https://mono-production-8ef9.up.railway.app'; // Replace with your actual API URL or use env variables
const MIN_LEARNING_PERCENTAGE = 10; // Or import from a shared constants file
const SWIPES_PER_GIFT = 15; // Number of swipes needed to unlock a gift

// Placeholder for user data - replace with actual data fetching
const userName = 'Isaiah';
const pickupLine = 'Are you French? Because Eiffel for you.';
const weeklyStreak = 2; // Example value
const weeklyStars = 5; // Example value

// Sample pickup lines for gifts (you should fetch these from backend in production)
const PICKUP_LINES = [
  "Are you French? Because Eiffel for you.",
  "Are you a magician? Because whenever I look at you, everyone else disappears.",
  "Do you have a map? I keep getting lost in your eyes.",
  "Are you a camera? Because every time I look at you, I smile.",
  "Is your name Google? Because you've got everything I've been searching for.",
];

export default function HomeScreen() {
  const router = useRouter(); // Initialize router
  const { signOut, isLoading: isAuthLoading, user } = useAuth(); // Get signOut function, isLoading state, and user info
  const [matchPercentage, setMatchPercentage] = useState(MIN_LEARNING_PERCENTAGE);
  const [isFetchingPercentage, setIsFetchingPercentage] = useState(true);
  const [boostedConvos, setBoostedConvos] = useState<number>(0); // State for boosted convos
  const [daysActive, setDaysActive] = useState<number>(0); // State for days active
  const [isFetchingStats, setIsFetchingStats] = useState(true); // Loading state for stats
  const [currentSwipes, setCurrentSwipes] = useState(0);
  const [nextGiftThreshold, setNextGiftThreshold] = useState(SWIPES_PER_GIFT);
  const [isGiftUnlocked, setIsGiftUnlocked] = useState(false);
  const [currentPickupLine, setCurrentPickupLine] = useState('');
  const [giftScale] = useState(new Animated.Value(1));
  const [showGiftContent, setShowGiftContent] = useState(false);

  // Memoize the fetch function to prevent unnecessary recreations
  const fetchUserData = useCallback(async () => {
    if (!user?.email) {
      console.log("No user email found, skipping data fetch.");
      setIsFetchingPercentage(false);
      setIsFetchingStats(false);
      setMatchPercentage(MIN_LEARNING_PERCENTAGE);
      setBoostedConvos(0);
      setDaysActive(0);
      setCurrentSwipes(0);
      setNextGiftThreshold(SWIPES_PER_GIFT);
      setIsGiftUnlocked(false);
      setCurrentPickupLine('');
      setShowGiftContent(false);
      return;
    }

    setIsFetchingPercentage(true);
    setIsFetchingStats(true);

    try {
      const headers: Record<string, string> = {
        'x-user-email': user.email,
        'X-Client-Type': 'mobile',
      };

      // Fetch both percentage and stats in parallel
      const [percentageResponse, statsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/learning-percentage`, { headers }),
        fetch(`${API_BASE_URL}/api/user-stats`, { headers })
      ]);

      // Handle percentage response
      if (percentageResponse.ok) {
        const percentageData = await percentageResponse.json();
        setMatchPercentage(percentageData.percentage || MIN_LEARNING_PERCENTAGE);
      } else {
        console.error('Error fetching learning percentage:', percentageResponse.status);
        setMatchPercentage(MIN_LEARNING_PERCENTAGE);
      }

      // Handle stats response
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        console.log("User stats data received:", statsData);
        setBoostedConvos(statsData.boostedConvos || 0);
        setDaysActive(statsData.daysActive || 0);
        setCurrentSwipes(statsData.currentSwipes || 0);
        
        // Calculate next gift threshold
        const nextThreshold = Math.ceil(statsData.currentSwipes / SWIPES_PER_GIFT) * SWIPES_PER_GIFT;
        setNextGiftThreshold(nextThreshold);
        
        // Check if gift is unlocked
        const isUnlocked = statsData.currentSwipes >= nextThreshold;
        setIsGiftUnlocked(isUnlocked);
        
        // Set pickup line
        const giftIndex = Math.floor(statsData.currentSwipes / SWIPES_PER_GIFT) % PICKUP_LINES.length;
        setCurrentPickupLine(PICKUP_LINES[giftIndex]);
      } else {
        console.error('Error fetching user stats:', statsResponse.status);
        setBoostedConvos(0);
        setDaysActive(0);
        setCurrentSwipes(0);
        setNextGiftThreshold(SWIPES_PER_GIFT);
        setIsGiftUnlocked(false);
        setCurrentPickupLine('');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      // Set default values on error
      setMatchPercentage(MIN_LEARNING_PERCENTAGE);
      setBoostedConvos(0);
      setDaysActive(0);
      setCurrentSwipes(0);
      setNextGiftThreshold(SWIPES_PER_GIFT);
      setIsGiftUnlocked(false);
      setCurrentPickupLine('');
    } finally {
      setIsFetchingPercentage(false);
      setIsFetchingStats(false);
    }
  }, [user?.email]);

  // Use useFocusEffect to refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("Screen focused, fetching fresh data...");
      fetchUserData();
      
      // Optional: Reset gift state when screen comes into focus
      setShowGiftContent(false);
    }, [fetchUserData])
  );

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

  // Animation for gift reveal
  const animateGift = () => {
    Animated.sequence([
      Animated.timing(giftScale, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(giftScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowGiftContent(true);
    });
  };

  // Handle gift press
  const handleGiftPress = () => {
    if (isGiftUnlocked && !showGiftContent) {
      animateGift();
    }
  };

  // Debug logs before rendering
  console.log('[DEBUG] Rendering HomeScreen...');
  console.log(`[DEBUG] isFetchingPercentage: ${isFetchingPercentage}`);
  console.log(`[DEBUG] matchPercentage: ${matchPercentage}`);
  console.log(`[DEBUG] Progress value: ${matchPercentage / 100}`);

  // Calculate progress percentage
  const calculateProgress = () => {
    const progress = ((currentSwipes % SWIPES_PER_GIFT) / SWIPES_PER_GIFT) * 100;
    return Math.min(progress, 100);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Welcome Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome <Text style={styles.userName}>{userName}!</Text></Text>
          <TouchableOpacity onPress={handleLogout} disabled={isAuthLoading} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={28} color={COLORS.primaryPink} />
          </TouchableOpacity>
        </View>

        {/* Daily Pickup Line - Only show when gift is revealed */}
        {showGiftContent && (
          <View style={styles.pickupLineContainer}>
            <Text style={styles.pickupLineHashtag}>#dailypickuplines</Text>
            <Text style={styles.pickupLineText}>"{currentPickupLine}"</Text>
          </View>
        )}

        {/* Progress Circle / Gift */}
        <TouchableOpacity 
          onPress={handleGiftPress}
          disabled={!isGiftUnlocked || showGiftContent}
          style={styles.progressContainer}
        >
          {/* Background Track */}
          <View style={styles.progressBackgroundCircle} />

          {/* Progress Fill */}
          <View 
            style={[
              styles.progressHalfCircleWrapper, 
              { transform: [{ rotate: `${(calculateProgress() / 100) * 360}deg` }] }
            ]}
          >
            <View style={styles.progressHalfCircle} />
          </View>

          {/* Content */}
          <Animated.View 
            style={[
              styles.progressContent,
              { transform: [{ scale: giftScale }] }
            ]}
          >
            {isFetchingStats ? (
              <ActivityIndicator size="large" color={COLORS.primaryPink} />
            ) : isGiftUnlocked && !showGiftContent ? (
              <>
                <Ionicons name="gift" size={52} color={COLORS.gold} />
                <Text style={styles.tapToOpenText}>Tap to open!</Text>
              </>
            ) : !showGiftContent ? (
              <>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.swipeCountText}>
                    {currentSwipes % SWIPES_PER_GIFT}
                    <Text style={[styles.swipeGoalText, { fontSize: 32 }]}> / {SWIPES_PER_GIFT}</Text>
                  </Text>
                  <Text style={styles.swipesLeftText}>
                    {SWIPES_PER_GIFT - (currentSwipes % SWIPES_PER_GIFT)} daily swipes to gift
                  </Text>
                  <Text style={styles.swipesResetText}>
                    Resets at midnight
                  </Text>
                </View>
              </>
            ) : null}
          </Animated.View>
        </TouchableOpacity>

        {/* Weekly SmoothRizz Score - UPDATED */}
        <View style={styles.smoothRizzContainer}>
          {isFetchingStats ? (
            <ActivityIndicator size="small" color={COLORS.black} />
          ) : (
            <>
              <View style={styles.scoreBubble}>
                <Text style={styles.scoreText}>🔥</Text>
              </View>
              <Text style={styles.smoothRizzText}>{`${boostedConvos} Convos Boosted`}</Text>
              <View style={[styles.scoreBubble, { marginLeft: 15 }]}> {/* Add margin */}
                <Text style={styles.scoreText}>💡</Text>
              </View>
              <Text style={styles.smoothRizzText}>{`${daysActive} Days Active`}</Text>
            </>
          )}
        </View>

        {/* Action Buttons */}
        <TouchableOpacity 
          style={[styles.button, styles.uploadButton]}
          onPress={handleUploadPress} // Added onPress handler
        >
          <Text style={styles.uploadButtonText}>Upload your Screenshot</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.manualButton]}>
          <Text style={styles.manualButtonText}>Type Text Manually</Text>
        </TouchableOpacity>
        {/* New Button for Image Rating */}
        <TouchableOpacity 
          style={[styles.button, styles.imageRatingButton]} // Use a distinct style or reuse manualButton
          onPress={() => router.push('/image-rating' as any)} // Cast to any to bypass strict type check
        >
          <Text style={styles.imageRatingButtonText}>Rate Image</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Bottom Navigation Mockup */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/homepage')}> 
           <Ionicons name="home-outline" size={26} color={COLORS.primaryPink} />
           {/* Add Text Label if needed */}
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/saved-responses')}> 
           <Ionicons name="bookmark-outline" size={26} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')}>
           <Ionicons name="person-outline" size={26} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}> 
           <Ionicons name="menu-outline" size={28} color={COLORS.textSecondary} /> 
           {/* onPress could open a modal or drawer */}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white, // Use defined white
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 25, // Slightly increased padding
    paddingTop: 30, // Increased top padding
    paddingBottom: 120, // More space at bottom
  },
  header: {
    width: '100%',
    flexDirection: 'row', // Align items horizontally
    justifyContent: 'space-between', // Space out welcome text and button
    alignItems: 'center', // Align items vertically
    marginBottom: 25, // Increased spacing
  },
  welcomeText: {
    fontSize: 28, // Larger font size
    fontWeight: 'bold',
    color: COLORS.black,
  },
  userName: {
    color: COLORS.primaryPink, // Use darker pink
  },
  logoutButton: {
    padding: 5, // Add some padding for easier tapping
  },
  pickupLineContainer: {
    backgroundColor: COLORS.black,
    borderRadius: 20, // More rounded
    paddingVertical: 20, // Increased padding
    paddingHorizontal: 25,
    marginBottom: 40, // Increased spacing
    width: '100%',
    alignItems: 'center',
    position: 'relative',
     // Add shadow for depth (optional)
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pickupLineHashtag: {
    position: 'absolute',
    top: 8, // Adjusted position
    right: 15,
    color: COLORS.secondaryPink, // Use medium pink
    fontSize: 12,
    fontWeight: '500',
  },
  pickupLineText: {
    color: COLORS.white,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500', // Slightly bolder
    paddingHorizontal: 10, // Ensure text doesn't touch edges
  },
  // Container for the Progress Circle and its content
  progressContainer: {
    width: 220, // Slightly larger
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  // Background track for the progress circle
  progressBackgroundCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 12, // Slightly thicker
    borderColor: '#F0F0F0', // Lighter grey for better contrast
    position: 'absolute',
    backgroundColor: COLORS.white,
  },
  // New styles for custom progress circle
  progressHalfCircleWrapper: {
    width: 220,
    height: 220,
    position: 'absolute',
    overflow: 'hidden',
  },
  progressHalfCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 12,
    borderColor: 'transparent',
    borderBottomColor: COLORS.primaryPink,
    borderRightColor: COLORS.primaryPink,
    backgroundColor: 'transparent',
    transform: [{ rotate: '-135deg' }],
  },
  // Absolutely positioned view to center content inside the Progress Circle
  progressContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  smoothRizzContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightPink, // Use light pink
    borderRadius: 30, // Fully rounded ends
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 50, // Increased spacing
     // Add shadow (optional)
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  scoreBubble: {
    width: 40, // Fixed size for circular shape
    height: 40,
    borderRadius: 20, // Half of width/height
    backgroundColor: COLORS.lighterPink, // Use lighter pink
    justifyContent: 'center', // Center content vertically
    alignItems: 'center', // Center content horizontally
    marginHorizontal: 4,
     // Add subtle shadow (optional)
     shadowColor: "#000",
     shadowOffset: {
       width: 0,
       height: 1,
     },
     shadowOpacity: 0.05,
     shadowRadius: 1,
     elevation: 2,
  },
  scoreText: {
    fontSize: 15, // Adjusted size
    fontWeight: 'bold',
    color: COLORS.black,
  },
  smoothRizzText: {
    fontSize: 14,
    fontWeight: '500', // Slightly bolder
    color: COLORS.black,
    marginLeft: 6, // Adjust spacing
    marginRight: 6, // Add spacing if needed between items
  },
  button: {
    width: '100%', // Take full width within padding
    paddingVertical: 18, // Larger buttons
    borderRadius: 30, // More rounded
    alignItems: 'center',
    marginBottom: 18,
     // Add shadow (optional)
     shadowColor: "#000",
     shadowOffset: {
       width: 0,
       height: 2,
     },
     shadowOpacity: 0.15,
     shadowRadius: 3.84,
     elevation: 5,
  },
  uploadButton: {
    backgroundColor: COLORS.black,
  },
  uploadButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  manualButton: {
    backgroundColor: COLORS.white,
    borderWidth: 2, // Thicker border
    borderColor: COLORS.black,
    elevation: 2, // Lower elevation for outlined button
    shadowOpacity: 0.05, // Less shadow
  },
  manualButtonText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Style for the new button (can be same as manualButton or different)
  imageRatingButton: {
    backgroundColor: COLORS.white,
    borderWidth: 2, 
    borderColor: COLORS.secondaryPink, // Use a different color like secondaryPink
    elevation: 2,
    shadowOpacity: 0.05,
  },
  imageRatingButtonText: {
    color: COLORS.secondaryPink, // Match border color
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Add style for the percentage text
  percentageText: {
    fontSize: 48, // Large font size for percentage
    fontWeight: 'bold',
    color: COLORS.primaryPink,
  },
  // Add styles for Bottom Tab Navigator icons if needed (usually handled by the navigator)
  bottomNav: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 70, // Adjust height as needed
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      backgroundColor: COLORS.white,
      borderTopWidth: 1,
      borderTopColor: COLORS.lightGrey,
       // Add shadow for elevation
      shadowColor: "#000",
      shadowOffset: {
          width: 0,
          height: -2, // Shadow upward
      },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 5,
  },
  navItem: {
      alignItems: 'center',
      padding: 10,
  },
  swipeCountText: {
    fontSize: 56,
    fontWeight: '600',
    color: COLORS.primaryPink,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    includeFontPadding: false,
    marginBottom: -5,
  },
  swipeGoalText: {
    fontSize: 28,
    color: COLORS.textSecondary,
    fontWeight: '400',
    opacity: 0.8,
    marginTop: -8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  swipesLeftText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
    opacity: 0.9,
    letterSpacing: 0.3,
  },
  swipesResetText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '400',
    opacity: 0.7,
    fontStyle: 'italic',
  },
  tapToOpenText: {
    fontSize: 18,
    color: COLORS.primaryPink,
    marginTop: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
