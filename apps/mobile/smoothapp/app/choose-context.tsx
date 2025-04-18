import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

// Define Colors (Consider moving to a shared constants file)
const COLORS = {
  primaryPink: '#E11D74',
  lightPinkBackground: '#FFF0F5', // Background for the header and screen
  selectedBorderPink: '#FF69B4',
  white: '#FFFFFF',
  black: '#000000',
  textPrimary: '#333333',
  textSecondary: '#888888',
};

// Context Options Data
const contextOptions = [
  { id: 'first_move', icon: '👋', title: 'First Move', subtitle: 'Nail that opener' },
  { id: 'mid_game', icon: '☁️', title: 'Mid-Game', subtitle: 'Keep it flowing' },
  { id: 'end_game', icon: '🎯', title: 'End Game', subtitle: 'Bring it home' },
];

export default function ChooseContextScreen() {
  const router = useRouter();
  const [selectedContext, setSelectedContext] = useState<string | null>(null);
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>(); // Get imageUri from params

  const handleNextPress = () => {
    if (selectedContext && imageUri) {
      router.push({
        pathname: '/chat-analysis',
        params: {
          selectedContext: selectedContext,
          imageUri: imageUri
        }
      });
    } else {
      if (!imageUri) {
        console.error("Image URI is missing!");
        router.back();
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Add Back Button Here */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primaryPink} />
          <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollViewContainer}>
        <View style={styles.container}>
          {/* Header Section */}
          <View style={styles.headerContainer}>
            <View style={styles.headerNumberCircle}>
              <Text style={styles.headerNumber}>2</Text>
            </View>
            <Text style={styles.headerText}>Choose Your Context</Text>
          </View>

          {/* Context Options */}
          <View style={styles.optionsContainer}>
            {contextOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionBox,
                  selectedContext === option.id && styles.selectedOptionBox,
                ]}
                onPress={() => setSelectedContext(option.id)}
              >
                <View style={styles.optionContent}>
                   <Text style={styles.optionIcon}>{option.icon}</Text>
                   <View style={styles.optionTextContainer}>
                     <Text style={styles.optionTitle}>{option.title}</Text>
                     <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                   </View>
                </View>
                {selectedContext === option.id && (
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.primaryPink} style={styles.checkmarkIcon} />
                )}
              </TouchableOpacity>
            ))}
          </View>

        </View>
      </ScrollView>
        {/* Next Button - Fixed at the bottom */}
        <View style={styles.footer}>
            <TouchableOpacity
                style={[styles.nextButton, !selectedContext && styles.disabledButton]} // Style differently if disabled
                onPress={handleNextPress}
                disabled={!selectedContext} // Disable if no context selected
            >
                <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
        </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.lightPinkBackground, // Light pink background for the whole screen
    position: 'relative', // Needed for absolute positioning of back button
  },
   scrollViewContainer: {
     flexGrow: 1,
     paddingTop: 60, // Add padding to avoid overlap with back button
   },
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center', // Center items horizontally in the container
  },
  backButton: { // Style for the back button
    position: 'absolute',
    top: 50, // Adjust top spacing (consider safe area insets)
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    zIndex: 10, // Ensure it's above ScrollView content
  },
  backButtonText: { // Style for the button text
    marginLeft: 5,
    fontSize: 16,
    color: COLORS.primaryPink,
    fontWeight: '600',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 15,
    marginBottom: 30,
    width: '100%',
    // Add subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerNumberCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.lightPinkBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primaryPink,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  optionsContainer: {
    width: '100%',
  },
  optionBox: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent', // Default no border
    // Add subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedOptionBox: {
    borderColor: COLORS.selectedBorderPink, // Pink border when selected
    borderWidth: 2, // Make border visible
  },
  optionContent: {
     flexDirection: 'row',
     alignItems: 'center',
     flex: 1, // Allow content to take available space
  },
   optionIcon: {
     fontSize: 24, // Adjust emoji size if needed
     marginRight: 15,
   },
   optionTextContainer: {
     flex: 1, // Allow text to take remaining space
   },
  optionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  checkmarkIcon: {
    marginLeft: 10, // Space between text and checkmark
  },
  footer: {
     padding: 20,
     borderTopWidth: 1,
     borderTopColor: '#eee',
     backgroundColor: COLORS.lightPinkBackground, // Match screen background
  },
  nextButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    width: '100%',
     // Add shadow
     shadowColor: "#000",
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.15,
     shadowRadius: 3.84,
     elevation: 5,
  },
   disabledButton: {
     backgroundColor: '#A9A9A9', // Grey out when disabled
     elevation: 0, // Remove shadow when disabled
     shadowOpacity: 0,
   },
  nextButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
