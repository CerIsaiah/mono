import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Assuming use of Expo icons
import { useRouter } from 'expo-router'; // Import useRouter
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
};

// Add API base URL constant and Minimum Learning Percentage
const API_BASE_URL = 'https://mono-production-8ef9.up.railway.app'; // Replace with your actual API URL or use env variables
const MIN_LEARNING_PERCENTAGE = 10; // Or import from a shared constants file

// Placeholder for user data - replace with actual data fetching
const userName = 'Isaiah';
const pickupLine = 'Are you French? Because Eiffel for you.';
const weeklyStreak = 2; // Example value
const weeklyStars = 5; // Example value

export default function HomeScreen() {
  const router = useRouter(); // Initialize router
  const { signOut, isLoading: isAuthLoading, user } = useAuth(); // Get signOut function, isLoading state, and user info
  const [matchPercentage, setMatchPercentage] = useState(MIN_LEARNING_PERCENTAGE);
  const [isFetchingPercentage, setIsFetchingPercentage] = useState(true);

  // Fetch Learning Percentage
  useEffect(() => {
    const fetchLearningPercentage = async () => {
      if (!user?.email) {
        console.log("No user email found, skipping percentage fetch.");
        setIsFetchingPercentage(false);
        setMatchPercentage(MIN_LEARNING_PERCENTAGE); // Set default if no user
        return;
      }

      setIsFetchingPercentage(true);
      try {
        const headers: Record<string, string> = {
          'x-user-email': user.email,
        };

        console.log(`Fetching learning percentage for ${user.email}...`);
        const response = await fetch(`${API_BASE_URL}/api/learning-percentage`, { headers });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error fetching learning percentage:', response.status, errorText);
          throw new Error(`Failed to fetch learning percentage: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Learning percentage data received:", data);
        setMatchPercentage(data.percentage || MIN_LEARNING_PERCENTAGE);

      } catch (error) {
        console.error('Error fetching learning percentage:', error);
        setMatchPercentage(MIN_LEARNING_PERCENTAGE); // Set default on error
      } finally {
        setIsFetchingPercentage(false);
      }
    };

    fetchLearningPercentage();
  }, [user?.email]); // Re-run effect if user email changes

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

  // Debug logs before rendering
  console.log('[DEBUG] Rendering HomeScreen...');
  console.log(`[DEBUG] isFetchingPercentage: ${isFetchingPercentage}`);
  console.log(`[DEBUG] matchPercentage: ${matchPercentage}`);
  console.log(`[DEBUG] Progress value: ${matchPercentage / 100}`);

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

        {/* Daily Pickup Line */}
        <View style={styles.pickupLineContainer}>
          <Text style={styles.pickupLineHashtag}>#dailypickuplines</Text>
          <Text style={styles.pickupLineText}>"{pickupLine}"</Text>
        </View>

        {/* Central Circle Element - Simplified Custom Implementation */}
        <View style={styles.progressContainer}>
          {/* Background Track (Light Grey Border) */}
          <View style={styles.progressBackgroundCircle} />

          {/* Progress Fill (using transforms) */}
          <View style={[styles.progressHalfCircleWrapper, { transform: [{ rotate: `${(matchPercentage / 100) * 360}deg` }] }]}>
            <View style={styles.progressHalfCircle} />
          </View>

          {/* Content (Percentage Text or Loader) */}
          <View style={styles.progressContent}> 
            {isFetchingPercentage ? (
              <ActivityIndicator size="large" color={COLORS.primaryPink} />
            ) : (
              <Text style={styles.percentageText}>{`${matchPercentage}%`}</Text>
            )}
          </View>
        </View>

        {/* Weekly SmoothRizz Score */}
        <View style={styles.smoothRizzContainer}>
           <View style={styles.scoreBubble}>
             <Text style={styles.scoreText}>{weeklyStreak}🔥</Text>
           </View>
           <View style={styles.scoreBubble}>
             <Text style={styles.scoreText}>{weeklyStars}⭐</Text>
           </View>
          <Text style={styles.smoothRizzText}>This Week's SmoothRizz</Text>
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
    width: 200, // Should match the size prop of Progress.Circle
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40, // Spacing below the circle
    position: 'relative', // Needed for absolute positioning of content
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  // Background track for the progress circle
  progressBackgroundCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 10, // Same thickness as progress arc
    borderColor: COLORS.lightGrey, // Unfilled color
    position: 'absolute',
    backgroundColor: 'transparent', // Keep center hollow
  },
  // New styles for custom progress circle
  progressHalfCircleWrapper: {
    width: 200,
    height: 200,
    position: 'absolute',
    overflow: 'hidden', // Clip the half circle
  },
  progressHalfCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 10, // Thickness of the progress arc
    borderColor: 'transparent', // Make base border transparent
    borderBottomColor: COLORS.primaryPink, // Show only bottom half (adjust rotation)
    borderRightColor: COLORS.primaryPink,  // Show only right half (adjust rotation)
    backgroundColor: 'transparent', // Ensure no background color
    transform: [{ rotate: '-135deg' }], // Start position (adjust as needed)
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
    zIndex: 2, // Ensure content is on top
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
    marginLeft: 12, // Increased spacing
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
});
