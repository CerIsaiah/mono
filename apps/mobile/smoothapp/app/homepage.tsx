import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, ActivityIndicator, Animated, Platform, Easing, Modal, TextInput } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons'; // Assuming use of Expo icons
import { useRouter, useFocusEffect } from 'expo-router'; // Import useRouter and useFocusEffect
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
  lightGrey: '#E0E0E0', // Added for lightGrey color
  gold: '#FFD700',
};

// Add API base URL constant and Minimum Learning Percentage
const API_BASE_URL = 'https://mono-production-8ef9.up.railway.app'; // Replace with your actual API URL or use env variables
const MIN_LEARNING_PERCENTAGE = 10; // Or import from a shared constants file
const SWIPES_PER_GIFT = 3; // Number of swipes needed to unlock a gift

// Placeholder for user data - replace with actual data fetching
const userName = 'Isaiah';
const pickupLine = 'Are you French? Because Eiffel for you.';
const weeklyStreak = 2; // Example value
const weeklyStars = 5; // Example value

// Define interface for Confetti component
interface ConfettiViewRef {
  startConfetti: () => void;
  stopConfetti: () => void;
}

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
  const [currentPickupLine, setCurrentPickupLine] = useState<string | null>(null);
  const [giftTaps, setGiftTaps] = useState(0);
  const [giftScale] = useState(new Animated.Value(1));
  const [circleScale] = useState(new Animated.Value(1));
  const [giftRotation] = useState(new Animated.Value(0));
  const [glowOpacity] = useState(new Animated.Value(0.2));
  const [glowRadius] = useState(new Animated.Value(2));
  const [showGiftContent, setShowGiftContent] = useState(false);
  const [currentGiftIndex, setCurrentGiftIndex] = useState(0);
  const [isTextInputModalVisible, setIsTextInputModalVisible] = useState(false);
  const [context, setContext] = useState('');
  const [lastText, setLastText] = useState('');
  const [inputMode, setInputMode] = useState<'screenshot' | 'text'>('screenshot');
  const [selectedMode, setSelectedMode] = useState<string>('first-move');
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [spicyLevel, setSpicyLevel] = useState(50);

  // Load persisted gift state
  useEffect(() => {
    const loadGiftState = async () => {
      try {
        if (user?.email) {
          const [giftState, giftContentState] = await Promise.all([
            AsyncStorage.getItem(`gift_state_${user.email}`),
            AsyncStorage.getItem(`gift_content_${user.email}`)
          ]);
          
          if (giftState) {
            const { currentGiftIndex: savedIndex } = JSON.parse(giftState);
            setCurrentGiftIndex(savedIndex);
          }
          
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

  // Save gift state when it changes
  useEffect(() => {
    const saveGiftState = async () => {
      try {
        if (user?.email) {
          await AsyncStorage.setItem(`gift_state_${user.email}`, JSON.stringify({
            currentGiftIndex
          }));
        }
      } catch (error) {
        console.error('Error saving gift state:', error);
      }
    };
    saveGiftState();
  }, [currentGiftIndex, user?.email]);

  // Remove debug logs
  useEffect(() => {
    if (user?.email) {
      fetchUserData();
    }
  }, [user?.email]); // Only fetch when user email changes

  // Update fetchUserData to handle pickup lines from API
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
      setCurrentPickupLine(null);
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

      const [percentageResponse, statsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/learning-percentage`, { headers }),
        fetch(`${API_BASE_URL}/api/user-stats`, { headers })
      ]);

      if (percentageResponse.ok) {
        const percentageData = await percentageResponse.json();
        setMatchPercentage(percentageData.percentage || MIN_LEARNING_PERCENTAGE);
      } else {
        setMatchPercentage(MIN_LEARNING_PERCENTAGE);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setBoostedConvos(statsData.boostedConvos || 0);
        setDaysActive(statsData.daysActive || 0);
        setCurrentSwipes(statsData.currentSwipes || 0);
        
        const nextThreshold = Math.ceil(statsData.currentSwipes / SWIPES_PER_GIFT) * SWIPES_PER_GIFT;
        setNextGiftThreshold(nextThreshold);
        
        const isUnlocked = statsData.currentSwipes >= nextThreshold;
        setIsGiftUnlocked(isUnlocked);
        
        // Handle pickup line from API response
        setCurrentPickupLine(statsData.currentPickupLine);
      } else {
        setBoostedConvos(0);
        setDaysActive(0);
        setCurrentSwipes(0);
        setNextGiftThreshold(SWIPES_PER_GIFT);
        setIsGiftUnlocked(false);
        setCurrentPickupLine(null);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setMatchPercentage(MIN_LEARNING_PERCENTAGE);
      setBoostedConvos(0);
      setDaysActive(0);
      setCurrentSwipes(0);
      setNextGiftThreshold(SWIPES_PER_GIFT);
      setIsGiftUnlocked(false);
      setCurrentPickupLine(null);
    } finally {
      setIsFetchingPercentage(false);
      setIsFetchingStats(false);
    }
  }, [user?.email]);

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

  // Animation for gift tap
  const animateGiftTap = () => {
    const baseScale = 1.2;
    const tapScale = baseScale + (giftTaps * 0.1);
    const circleScaleValue = 1 + (giftTaps * 0.05);
    
    Animated.parallel([
      // Scale up gift
      Animated.spring(giftScale, {
        toValue: tapScale,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
      // Scale up circle
      Animated.spring(circleScale, {
        toValue: circleScaleValue,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
      // Rotation animation
      Animated.sequence([
        Animated.timing(giftRotation, {
          toValue: (giftTaps % 2 === 0) ? 0.1 : -0.1,
          duration: 200,
          easing: Easing.elastic(1),
          useNativeDriver: true,
        }),
        Animated.timing(giftRotation, {
          toValue: 0,
          duration: 200,
          easing: Easing.elastic(1),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    Animated.parallel([
      Animated.timing(glowOpacity, {
        toValue: 0.3 + (giftTaps * 0.1),
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(glowRadius, {
        toValue: 4 + (giftTaps * 2),
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  };

  // Animation for final gift reveal
  const animateGiftReveal = () => {
    Animated.sequence([
      // Spin and scale up
      Animated.parallel([
        Animated.timing(giftRotation, {
          toValue: 4,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(giftScale, {
          toValue: 2.5,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Scale circle back down
        Animated.timing(circleScale, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Scale back down with bounce
      Animated.spring(giftScale, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      setShowGiftContent(true);
      setGiftTaps(0);
      setCurrentGiftIndex(prev => prev + 1);
      giftRotation.setValue(0);
      giftScale.setValue(1);
      circleScale.setValue(1);
      // Reset glow
      glowOpacity.setValue(0.2);
      glowRadius.setValue(2);
      
      // Save showGiftContent state
      try {
        if (user?.email) {
          await AsyncStorage.setItem(`gift_content_${user.email}`, JSON.stringify({
            showGiftContent: true
          }));
        }
      } catch (error) {
        console.error('Error saving gift content state:', error);
      }
      
      // Check if we have more gifts after this one
      const giftProgress = calculateGiftProgress();
      if (giftProgress.remainingGifts === 0) {
        // If no more gifts, fetch new data to update UI
        fetchUserData();
      }
    });

    // JS driver animations (intense glow during reveal)
    Animated.sequence([
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 0.8,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(glowRadius, {
          toValue: 25,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 0.2,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(glowRadius, {
          toValue: 2,
          duration: 400,
          useNativeDriver: false,
        }),
      ]),
    ]).start();
  };

  // Calculate the rotation interpolation
  const spin = giftRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Calculate the glow interpolation
  const glowStyle = {
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glowOpacity,
    shadowRadius: glowRadius,
  };

  // Debug logs before rendering
  console.log('[DEBUG] Rendering HomeScreen...');
  console.log(`[DEBUG] isFetchingPercentage: ${isFetchingPercentage}`);
  console.log(`[DEBUG] matchPercentage: ${matchPercentage}`);
  console.log(`[DEBUG] Progress value: ${matchPercentage / 100}`);

  // Calculate progress percentage
  const calculateProgress = () => {
    const completedGifts = Math.floor(currentSwipes / SWIPES_PER_GIFT);
    const nextGiftThreshold = (completedGifts + 1) * SWIPES_PER_GIFT;
    const progressTowardsNext = currentSwipes - (completedGifts * SWIPES_PER_GIFT);
    const progress = (progressTowardsNext / SWIPES_PER_GIFT) * 100;
    return Math.min(progress, 100);
  };

  // Calculate gift progress numbers
  const calculateGiftProgress = () => {
    const completedGifts = Math.floor(currentSwipes / SWIPES_PER_GIFT);
    const nextGiftThreshold = (completedGifts + 1) * SWIPES_PER_GIFT;
    const progressTowardsNext = currentSwipes - (completedGifts * SWIPES_PER_GIFT);
    const remainingSwipes = nextGiftThreshold - currentSwipes;
    const remainingGifts = Math.floor(currentSwipes / SWIPES_PER_GIFT) - currentGiftIndex;
    const hasGiftAvailable = remainingGifts > 0;
    
    return {
      currentProgress: progressTowardsNext,
      nextThreshold: nextGiftThreshold,
      remainingSwipes,
      completedGifts,
      hasGiftAvailable,
      remainingGifts
    };
  };

  // Handle gift press
  const handleGiftPress = () => {
    const giftProgress = calculateGiftProgress();
    if (giftProgress.hasGiftAvailable) {
      if (giftTaps < 4) {
        setGiftTaps(prev => prev + 1);
        animateGiftTap();
      } else {
        animateGiftReveal();
      }
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

        {/* Main Content Container */}
        <View style={styles.mainContent}>
          {/* Daily Pickup Line - Show when gift is revealed */}
          {showGiftContent && currentPickupLine && (
            <View style={styles.pickupLineContainer}>
              <Text style={styles.pickupLineHashtag}>#dailypickuplines</Text>
              <View style={styles.giftIconContainer}>
                <Ionicons name="gift" size={24} color={COLORS.gold} />
              </View>
              <Text style={styles.pickupLineText}>"{currentPickupLine}"</Text>
            </View>
          )}

          {/* Progress Circle / Gift */}
          <Animated.View 
            style={[
              styles.progressContainer, 
              showGiftContent && styles.progressContainerWithGift,
              { transform: [{ scale: circleScale }] }
            ]}
          >
            {/* Background Track */}
            <View style={styles.progressBackgroundCircle} />

            {/* Progress Fill */}
            <View style={[
              styles.progressHalfCircleWrapper,
              { transform: [{ rotate: `${(calculateProgress() / 100) * 360}deg` }] }
            ]}>
              <View style={styles.progressHalfCircle} />
            </View>

            {/* Content */}
            <TouchableOpacity 
              onPress={handleGiftPress}
              disabled={isFetchingStats || !calculateGiftProgress().hasGiftAvailable}
              style={StyleSheet.absoluteFill}
            >
              <Animated.View style={[styles.progressContent, {
                transform: [
                  { scale: giftScale },
                  { rotate: spin }
                ]
              }]}>
                <Animated.View style={[styles.giftContainer, glowStyle]}>
                  {isFetchingStats ? (
                    <ActivityIndicator size="large" color={COLORS.primaryPink} />
                  ) : calculateGiftProgress().hasGiftAvailable ? (
                    <>
                      <Ionicons name="gift" size={52} color={COLORS.gold} />
                      <Text style={styles.tapToOpenText}>
                        {giftTaps === 0 ? "Tap to charge your gift!" : "Keep tapping!"}
                      </Text>
                    </>
                  ) : (
                    <View style={styles.progressTextContainer}>
                      <Text style={styles.swipeCountText}>
                        {calculateGiftProgress().currentProgress}
                        <Text style={styles.swipeGoalText}> / {SWIPES_PER_GIFT}</Text>
                      </Text>
                      <Text style={styles.swipesLeftText}>
                        {calculateGiftProgress().remainingSwipes} daily swipes to gift
                      </Text>
                      <Text style={styles.nextGiftText}>
                        Next gift at {calculateGiftProgress().nextThreshold}
                      </Text>
                      <Text style={styles.swipesResetText}>
                        Resets at midnight
                      </Text>
                    </View>
                  )}
                </Animated.View>
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>

          {/* Stats Container */}
          <View style={styles.smoothRizzContainer}>
            {isFetchingStats ? (
              <ActivityIndicator size="small" color={COLORS.black} />
            ) : (
              <>
                <View style={styles.scoreBubble}>
                  <Text style={styles.scoreText}>🔥</Text>
                </View>
                <Text style={styles.smoothRizzText}>{`${boostedConvos} Convos Boosted`}</Text>
                <View style={[styles.scoreBubble, { marginLeft: 15 }]}>
                  <Text style={styles.scoreText}>💡</Text>
                </View>
                <Text style={styles.smoothRizzText}>{`${daysActive} Days Active`}</Text>
              </>
            )}
          </View>

          {/* Action Buttons */}
          <TouchableOpacity 
            style={[styles.button, styles.uploadButton]}
            onPress={handleUploadPress}
          >
            <Text style={styles.uploadButtonText}>Upload your Screenshot</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.manualButton]}
            onPress={handleManualTextPress}
          >
            <Text style={styles.manualButtonText}>Type Text Manually</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/homepage')}> 
          <Ionicons name="home" size={26} color={COLORS.primaryPink} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/saved-responses')}> 
          <Ionicons name="bookmark-outline" size={26} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')}>
          <Ionicons name="person-outline" size={26} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/image-rating')}> 
          <Ionicons name="star-outline" size={26} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Add Modal component before the bottom navigation */}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
  mainContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  pickupLineContainer: {
    width: '100%',
    backgroundColor: COLORS.black,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 25,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  pickupLineHashtag: {
    position: 'absolute',
    top: 8,
    right: 15,
    color: COLORS.secondaryPink,
    fontSize: 12,
    fontWeight: '500',
  },
  giftIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,215,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickupLineLabel: {
    color: COLORS.secondaryPink,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pickupLineText: {
    color: COLORS.white,
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 24,
  },
  progressContainer: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  progressContainerWithGift: {
    marginTop: 0,
  },
  progressBackgroundCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 15,
    borderColor: '#F0F0F0',
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  progressHalfCircleWrapper: {
    width: 220,
    height: 220,
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 110,
    transform: [{ rotate: '-135deg' }],
  },
  progressHalfCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 15,
    borderColor: 'transparent',
    borderRightColor: COLORS.primaryPink,
    borderTopColor: COLORS.primaryPink,
    transform: [{ rotate: '0deg' }],
    backgroundColor: 'transparent',
  },
  progressContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  smoothRizzContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightPink,
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 32,
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
    width: '100%',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 16,
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
  percentageText: {
    fontSize: 48, // Large font size for percentage
    fontWeight: 'bold',
    color: COLORS.primaryPink,
  },
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
    textAlign: 'center',
  },
  nextGiftText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '400',
    opacity: 0.8,
  },
  giftContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  progressTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  remainingGiftsOverlay: {
    position: 'absolute',
    bottom: -45,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  remainingGiftsOverlayText: {
    fontSize: 16,
    color: COLORS.primaryPink,
    fontWeight: '600',
    textAlign: 'center',
  },
  resetsText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  closeButton: {
    padding: 5,
  },
  modalScrollView: {
    maxHeight: '100%',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: COLORS.white,
    minHeight: 48,
  },
  submitButton: {
    backgroundColor: COLORS.primaryPink,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
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
    marginBottom: 20,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: COLORS.grey,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeButtonSelected: {
    backgroundColor: COLORS.lightPink,
    borderColor: COLORS.primaryPink,
  },
  modeEmoji: {
    fontSize: 24,
    marginRight: 15,
  },
  modeTextContainer: {
    flex: 1,
  },
  modeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 4,
  },
  modeDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  spicyMeterContainer: {
    marginBottom: 20,
  },
  spicyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 10,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  spicyLevels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  spicyLevelText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
