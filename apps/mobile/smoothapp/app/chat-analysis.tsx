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
  lightGrey: '#F0F0F0', // Slightly darker grey for left bubble
  errorRed: '#D9534F',
  darkGreyText: '#333333', // Darker text for left bubble
};

// Add API base URL constant
const API_BASE_URL = 'https://mono-production-8ef9.up.railway.app'; // Replace if needed

// Interface updated to expect myMessage and theirResponse
interface AnalysisResult {
  myMessage: string;
  theirResponse: string;
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

      // Check for the new expected structure
      if (!data.analysis || !Array.isArray(data.analysis)) {
           throw new Error('Invalid analysis data received from server.');
      }
      // Add more specific validation for the items if needed
      const isValidData = data.analysis.every((item: any) =>
         item && typeof item.myMessage === 'string' && typeof item.theirResponse === 'string' && typeof item.rating === 'string'
      );
      if (!isValidData) {
          console.error('Invalid item structure in analysis data:', data.analysis.find((item: any) => !item || typeof item.myMessage !== 'string' || typeof item.theirResponse !== 'string' || typeof item.rating !== 'string'));
          throw new Error('Received analysis items with incorrect structure.');
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
            pathname: '/swipes-page',
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

  // Updated to render both messages and the rating
  const renderAnalysisItem = (item: AnalysisResult, index: number) => (
    <View key={index} style={styles.analysisPairContainer}>
      {/* My Message (Right Bubble) */}
      <View style={styles.myMessageContainer}>
        <View style={styles.myMessageBubble}>
            <Text style={styles.myMessageText}>{item.myMessage}</Text>
        </View>
      </View>

      {/* Their Response (Left Bubble) + Rating */}
      <View style={styles.theirResponseContainer}>
         <View style={styles.theirResponseBubble}>
            <Text style={styles.theirResponseText}>{item.theirResponse}</Text>
         </View>
         <Text style={styles.ratingText}>{item.rating}</Text>
      </View>
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
            <Text style={styles.headerText}>Response Analysis</Text>
            <Text style={styles.headerSubtitle}>(Context: {selectedContext.replace('_', ' ')})</Text>
        </View>

        {/* Analysis Section - MOVED BEFORE IMAGE */}
        <View style={styles.analysisContainer}>
          <Text style={styles.analysisTitle}>Their Response Performance</Text>
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
             <Text style={styles.noMessagesText}>No response pairs found for analysis.</Text>
          ) : (
            <View style={styles.analysisList}>
              {analysis.map(renderAnalysisItem)}
            </View>
          )}
        </View>

        {/* Screenshot Display - MOVED AFTER ANALYSIS */}
        {imageUri && (
          <View style={styles.screenshotContainer}>
             <Text style={styles.screenshotLabel}>Your Chat Screenshot</Text>
             <Image source={{ uri: imageUri }} style={styles.screenshotImage} resizeMode="contain" />
          </View>
        )}

      </ScrollView>

      {/* Next Button - Fixed at the bottom */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNextPress}
          disabled={isLoading}
        >
          <Text style={styles.nextButtonText}>Get Response Ideas</Text>
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
    paddingTop: 80,
    paddingBottom: 100,
    alignItems: 'center',
    paddingHorizontal: 15, // Slightly reduced horizontal padding
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 15, // Adjusted to match padding
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
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 15,
    marginBottom: 25,
    width: '100%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 5,
  },
  headerNumberCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.lightPinkBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primaryPink,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
      fontSize: 14,
      color: COLORS.textSecondary,
      textTransform: 'capitalize',
  },
  analysisContainer: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 10, // Reduced padding for more space inside
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  analysisList: {},
  analysisTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingIndicator: {
    marginTop: 20,
    paddingBottom: 20, // Ensure space when loading
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 10,
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
  // Styles for the pair of messages
  analysisPairContainer: {
    marginBottom: 20, // Space between pairs
    width: '100%',
  },
  myMessageContainer: {
    alignItems: 'flex-end', // Align bubble to the right
    marginBottom: 8, // Space between my message and their response
  },
  myMessageBubble: {
    backgroundColor: COLORS.primaryPink,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomRightRadius: 5,
    maxWidth: '85%',
  },
  myMessageText: {
    fontSize: 15,
    color: COLORS.white,
  },
  theirResponseContainer: {
     alignItems: 'flex-start', // Align bubble and rating to the left
  },
  theirResponseBubble: {
    backgroundColor: COLORS.lightGrey,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomLeftRadius: 5,
    maxWidth: '85%',
    marginBottom: 5, // Space between bubble and rating
  },
  theirResponseText: {
    fontSize: 15,
    color: COLORS.darkGreyText,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryPink,
    fontStyle: 'italic',
    marginLeft: 10, // Indent rating slightly from the left bubble
    maxWidth: '85%', // Prevent rating text from overflowing strangely
  },
  screenshotContainer: {
     width: '100%',
     alignItems: 'center',
     marginBottom: 20,
     marginTop: 10, // Add some space above screenshot
  },
  screenshotLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.textSecondary,
      marginBottom: 10,
  },
  screenshotImage: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 15,
    backgroundColor: COLORS.lightGrey,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 15, // Reduced padding
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: COLORS.lightPinkBackground,
  },
  nextButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16, // Slightly reduced padding
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
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
     marginLeft: 8,
   },
});
