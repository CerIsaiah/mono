import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';

// Reuse colors from choose-context or define globally
const COLORS = {
  primaryPink: '#E11D74',
  lightPinkBackground: '#FFF0F5',
  white: '#FFFFFF',
  black: '#000000',
  textPrimary: '#333333',
  textSecondary: '#888888',
  grey: '#D3D3D3',
  lightGrey: '#F5F5F5',
  errorRed: '#D9534F',
};

// Add API base URL constant
const API_BASE_URL = 'https://mono-production-8ef9.up.railway.app'; // Replace if needed

interface AnalysisResult {
  message: string;
  rating: string;
}

export default function ChatAnalysisScreen() {
  const router = useRouter();
  const { imageUri, selectedContext } = useLocalSearchParams<{ imageUri: string; selectedContext: string }>();

  const [analysis, setAnalysis] = useState<AnalysisResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    if (!imageUri || !selectedContext) {
      setError('Missing image or context information.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Read image file and convert to base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 2. Call the backend API
      const response = await fetch(`${API_BASE_URL}/api/analyze-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add authentication headers if required, e.g., 'x-user-email': user.email
        },
        body: JSON.stringify({
          imageBase64: base64,
          context: selectedContext,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (!data.analysis || !Array.isArray(data.analysis)) {
           throw new Error('Invalid analysis data received from server.');
      }

      setAnalysis(data.analysis);

    } catch (err: any) {
      console.error('Error fetching chat analysis:', err);
      setError(err.message || 'Failed to fetch analysis. Please try again.');
      setAnalysis([]); // Clear any previous analysis on error
    } finally {
      setIsLoading(false);
    }
  }, [imageUri, selectedContext]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const handleNextPress = () => {
     if (imageUri && selectedContext) {
        router.push({
            pathname: '/swipes-page', // Navigate to swipes page
            params: {
                mode: 'image',
                selectedMode: selectedContext,
                imageUri: imageUri
            }
        });
     } else {
        console.error("Missing imageUri or selectedContext for navigation");
        Alert.alert("Error", "Could not proceed. Missing required information.");
     }
  };

  const renderAnalysisItem = (item: AnalysisResult, index: number) => (
    <View key={index} style={styles.analysisItem}>
       <View style={styles.messageBubble}>
           <Text style={styles.messageText}>{item.message}</Text>
       </View>
      <Text style={styles.ratingText}>{item.rating}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Back Button */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={COLORS.primaryPink} />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollViewContainer}>
        {/* Header Section */}
        <View style={styles.headerContainer}>
            <View style={styles.headerNumberCircle}>
                <Text style={styles.headerNumber}>3</Text>
            </View>
            <Text style={styles.headerText}>Chat Analysis</Text>
            <Text style={styles.headerSubtitle}>(Context: {selectedContext.replace('_', ' ')})</Text>
        </View>

        {/* Screenshot Display */}
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.screenshotImage} resizeMode="contain" />
        )}

        {/* Analysis Section */}
        <View style={styles.analysisContainer}>
          <Text style={styles.analysisTitle}>Your Message Performance</Text>
          {isLoading ? (
            <ActivityIndicator size="large" color={COLORS.primaryPink} style={styles.loadingIndicator} />
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={24} color={COLORS.errorRed} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={fetchAnalysis} style={styles.retryButton}>
                 <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : analysis.length === 0 ? (
             <Text style={styles.noMessagesText}>No messages found for analysis on your side.</Text>
          ) : (
            <View style={styles.analysisList}>
              {analysis.map(renderAnalysisItem)}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Next Button - Fixed at the bottom */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNextPress}
          disabled={isLoading} // Disable while loading analysis initially
        >
          <Text style={styles.nextButtonText}>Get New Responses</Text>
           <Ionicons name="arrow-forward" size={20} color={COLORS.white} style={styles.nextIcon} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.lightPinkBackground,
    position: 'relative',
  },
  scrollViewContainer: {
    flexGrow: 1,
    paddingTop: 60, // Space for back button
    paddingBottom: 100, // Space for fixed footer
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    zIndex: 10,
  },
  backButtonText: {
    marginLeft: 5,
    fontSize: 16,
    color: COLORS.primaryPink,
    fontWeight: '600',
  },
   headerContainer: {
    flexDirection: 'column', // Stack elements vertically
    alignItems: 'center', // Center items horizontally
    backgroundColor: COLORS.white,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 15,
    marginBottom: 20, // Space before image
    width: '100%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerContent: { // Group number and text
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 5, // Space between title and subtitle
  },
  headerNumberCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.lightPinkBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 8, // Space below circle when vertical
  },
  headerNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primaryPink,
  },
  headerText: {
    fontSize: 20, // Larger title
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4, // Space below title
  },
  headerSubtitle: {
      fontSize: 14,
      color: COLORS.textSecondary,
      textTransform: 'capitalize', // Nicer formatting for context
  },
  screenshotImage: {
    width: '100%',
    aspectRatio: 9 / 16, // Adjust aspect ratio as needed, common for screenshots
    borderRadius: 15,
    marginBottom: 20,
    backgroundColor: COLORS.lightGrey, // Placeholder bg
  },
  analysisContainer: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
   analysisList: {
     // flex: 1, // REMOVED: No longer needed as container height is not fixed
     // If you want the container itself to scroll with the page, remove maxHeight from analysisContainer
     // and let scrollViewContainer handle scrolling.
   },
  analysisTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 15,
    textAlign: 'center',
  },
  loadingIndicator: {
    marginTop: 20,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    color: COLORS.errorRed,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 15,
  },
  retryButton: {
     backgroundColor: COLORS.primaryPink,
     paddingVertical: 10,
     paddingHorizontal: 20,
     borderRadius: 20,
  },
   retryButtonText: {
     color: COLORS.white,
     fontSize: 16,
     fontWeight: '600',
   },
   noMessagesText: {
     fontSize: 16,
     color: COLORS.textSecondary,
     textAlign: 'center',
     paddingVertical: 20,
   },
  analysisItem: {
    marginBottom: 15,
    alignItems: 'flex-end', // Align bubble and rating to the right
  },
   messageBubble: {
     backgroundColor: COLORS.primaryPink,
     paddingHorizontal: 15,
     paddingVertical: 10,
     borderRadius: 20,
     borderBottomRightRadius: 5, // Typical chat bubble style
     maxWidth: '80%', // Prevent bubble from being too wide
     marginBottom: 5, // Space between bubble and rating
   },
  messageText: {
    fontSize: 15,
    color: COLORS.white,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryPink, // Use pink for emphasis
    fontStyle: 'italic',
     marginRight: 5, // Align rating slightly indented from bubble edge
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
    justifyContent: 'center', // Center text and icon
    flexDirection: 'row', // Align icon and text horizontally
    width: '100%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
  },
  nextButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
   nextIcon: {
     marginLeft: 8, // Space between text and icon
   },
});
