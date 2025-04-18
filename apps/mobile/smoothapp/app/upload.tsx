import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Or another icon library
import { useRouter } from 'expo-router'; // Import useRouter for navigation
// Import expo-image-picker
import * as ImagePicker from 'expo-image-picker';

// Define Colors (Consider moving to a shared constants file)
const COLORS = {
  primaryPink: '#E11D74',
  lightPinkBackground: '#FFF0F5', // Background for the header section
  borderColor: '#E0E0E0', // Light grey for dashed border
  textPrimary: '#333333', // Dark grey for main text
  textSecondary: '#888888', // Lighter grey for subtitle
  white: '#FFFFFF',
};

export default function UploadScreen() {
  const router = useRouter(); // Initialize router

  // Make the handler async and implement image picking
  const handleUploadPress = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Sorry, we need camera roll permissions to make this work!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        router.push({
          pathname: '/choose-context',
          params: { imageUri: result.assets[0].uri },
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Add Back Button Here */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={COLORS.primaryPink} />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.container}>
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerNumber}>1</Text>
          <Text style={styles.headerText}>Share Your Conversation</Text>
        </View>

        {/* Upload Area - onPress is now the async handler */}
        <TouchableOpacity style={styles.uploadBox} onPress={handleUploadPress}>
          <Ionicons name="cloud-upload-outline" size={40} color={COLORS.primaryPink} style={styles.uploadIcon} />
          <Text style={styles.uploadTitle}>Upload Conversation Screenshot!</Text>
          <Text style={styles.uploadSubtitle}>Press This or Ctrl+V to paste</Text>
          {/* Note: Ctrl+V paste is not standard RN functionality, requires specific implementation */}
        </TouchableOpacity>

        {/* Optional: Hide Text Input Option - Add later if needed */}
        {/* <TouchableOpacity style={styles.hideOption}>
          <Text style={styles.hideOptionText}>Hide text input option</Text>
          <Ionicons name="chevron-up-outline" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity> */}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
    position: 'relative', // Needed for absolute positioning
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start', // Align content to the top
    padding: 20,
    paddingTop: 80, // Add padding to avoid overlap with back button
  },
  backButton: { // Style for the back button
    position: 'absolute',
    top: 50, // Adjust top spacing (consider safe area insets)
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    zIndex: 10, // Ensure it's above other content
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
    backgroundColor: COLORS.lightPinkBackground,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 30,
    width: '100%',
    alignSelf: 'flex-start',
  },
  headerNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primaryPink,
    marginRight: 10,
    // Add a circle background if needed
    // width: 30, height: 30, borderRadius: 15, backgroundColor: 'pink', textAlign: 'center'
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  uploadBox: {
    width: '100%',
    height: 200, // Adjust height as needed
    borderWidth: 2,
    borderColor: COLORS.borderColor,
    borderStyle: 'dashed',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
  },
  uploadIcon: {
    marginBottom: 15,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 5,
    textAlign: 'center',
  },
  uploadSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  // Optional styles for hide text input
  /*
  hideOption: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hideOptionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginRight: 5,
  },
  */
});
