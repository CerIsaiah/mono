import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
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

// Placeholder for user data - replace with actual data fetching
const userName = 'Isaiah';
const pickupLine = 'Are you French? Because Eiffel for you.';
const weeklyStreak = 2; // Example value
const weeklyStars = 5; // Example value

export default function HomeScreen() {
  const router = useRouter(); // Initialize router
  const { signOut, isLoading, user } = useAuth(); // Get signOut function, isLoading state, and user info

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Welcome Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome <Text style={styles.userName}>{userName}!</Text></Text>
          <TouchableOpacity onPress={handleLogout} disabled={isLoading} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={28} color={COLORS.primaryPink} />
          </TouchableOpacity>
        </View>

        {/* Daily Pickup Line */}
        <View style={styles.pickupLineContainer}>
          <Text style={styles.pickupLineHashtag}>#dailypickuplines</Text>
          <Text style={styles.pickupLineText}>"{pickupLine}"</Text>
        </View>

        {/* Central Circle Element - Re-structured for double ring effect */}
        <View style={styles.outerCircle}>
          <View style={styles.innerCircle}>
            <Ionicons name="flash" size={70} color={COLORS.primaryPink} />
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
  // Styles for nested circle approach
  outerCircle: {
    width: 220, // Outer diameter
    height: 220,
    borderRadius: 110,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primaryPink, // Dark pink thick "border"
    marginBottom: 40, // Increased spacing
    // This simulates the outer thick ring. Progress part needs library.
     padding: 10, // This creates the thickness of the outer ring

  },
  innerCircle: {
     width: 200, // Diameter inside the outer ring
     height: 200,
     borderRadius: 100, // Fully circular
     backgroundColor: COLORS.lighterPink, // Lightest pink background
     justifyContent: 'center',
     alignItems: 'center',
     borderWidth: 8, // Thickness of the inner light pink ring
     borderColor: COLORS.secondaryPink, // Medium pink inner ring color
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
