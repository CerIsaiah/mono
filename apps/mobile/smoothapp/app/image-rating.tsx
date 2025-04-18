import React, { useState, useEffect } from 'react';
import { View, Text, Button, Image, StyleSheet, ActivityIndicator, Alert, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// TODO: Replace with your actual backend API URL, possibly from environment variables
const API_URL = 'https://mono-production-8ef9.up.railway.app';

// Define an interface for the expected API response structure for multiple images
interface MultiRatingResponse {
    ratings: string[]; // Expect an array of rating strings
    requestId?: string; // Optional, based on backend code
}

// Interface for storing image data along with its rating and parsed score
interface RatedImage {
    uri: string;
    base64: string; // Keep base64 for potential resubmission or other uses if needed
    rating: string;
    score: number | null; // Parsed score for sorting, null if parsing failed
}

// Interface for storing selected image data before rating
interface SelectedImage {
    uri: string;
    base64: string;
}

// Define Colors (you might want to import these from a central file)
const COLORS = {
    primaryPink: '#E11D74',
    white: '#FFFFFF',
    black: '#000000',
    grey: '#F5F5F5',
    textSecondary: '#666666',
    lightGrey: '#E0E0E0',
};

export default function ImageRatingScreen() {
    const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
    const [ratedImages, setRatedImages] = useState<RatedImage[] | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const router = useRouter();

    useEffect(() => {
        (async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
            }
        })();
    }, []);

    const pickImage = async () => {
        setRatedImages(null); // Clear previous ratings
        setSelectedImages([]); // Clear previous selections

        try {
            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                // allowsEditing: false, // Cannot allow editing with multiple selection
                // aspect: [4, 3], // Aspect ratio editing might not work with multiple
                quality: 0.5, // Lower quality for faster upload/processing
                base64: true, // Request base64 data
                allowsMultipleSelection: true, // Allow multiple images
                selectionLimit: 10, // Limit to 10 images
                orderedSelection: true, // Keep order if needed, though we sort later
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                // Filter out any assets that might lack uri or base64 for robustness
                const newSelectedImages = result.assets
                    .filter(asset => asset.uri && asset.base64)
                    .map(asset => ({
                        uri: asset.uri!, // Assert non-null based on filter
                        base64: asset.base64!, // Assert non-null based on filter
                    }));

                if (newSelectedImages.length > 10) {
                     Alert.alert("Too many images", "Please select a maximum of 10 images.");
                     setSelectedImages(newSelectedImages.slice(0, 10)); // Keep only the first 10
                } else {
                     setSelectedImages(newSelectedImages);
                }
            }
        } catch (error) {
            console.error("Error picking images:", error);
            Alert.alert("Error", "Could not select images.");
        }
    };

    // Extracts numerical score from rating string (e.g., "8/10 Great photo...") -> 8
    const parseScoreFromRating = (rating: string): number | null => {
        const match = rating.match(/^(\d+(\.\d+)?)\s*\/\s*10/); // Match "X/10" or "X.Y/10" at the start
        if (match && match[1]) {
            return parseFloat(match[1]);
        }
        // Fallback: Look for score anywhere if not at the start
        const scoreMatch = rating.match(/(\d+(\.\d+)?)\/10/);
         if (scoreMatch && scoreMatch[1]) {
             return parseFloat(scoreMatch[1]);
         }
        return null; // Return null if no score pattern is found
    };

    const rateImages = async () => {
        if (selectedImages.length === 0) {
            Alert.alert('No Images', 'Please select images first.');
            return;
        }

        // Add confirmation dialog
        Alert.alert(
            "Confirm Rating",
            `Are you sure you want to rate these ${selectedImages.length} image(s)?`,
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Confirm",
                    onPress: async () => { // Make the confirmation action async
                        setIsLoading(true);
                        setRatedImages(null);

                        try {
                            const imagesBase64 = selectedImages.map(img => img.base64);
                            const endpoint = `${API_URL}/api/rate-multiple-images`; // Correct endpoint
                            console.log(`Sending ${imagesBase64.length} images to ${endpoint} using fetch`);

                            const response = await fetch(endpoint, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    // Add other headers like auth if needed, e.g.:
                                    // 'Authorization': `Bearer ${userToken}`,
                                    // 'x-user-email': user.email, // If needed by this endpoint
                                },
                                body: JSON.stringify({ imagesBase64: imagesBase64 }),
                            });

                            const responseData = await response.json(); // Always try to parse JSON

                            if (!response.ok) {
                                // Throw an error with message from response if possible, or default
                                throw new Error(responseData.error || `HTTP error! status: ${response.status}`);
                            }

                            // Check response structure based on MultiRatingResponse interface
                            if (responseData && Array.isArray(responseData.ratings) && responseData.ratings.length === selectedImages.length) {
                                const ratings = responseData.ratings;
                                const newRatedImages = selectedImages.map((img, index) => {
                                    const ratingText = ratings[index] || "Rating unavailable"; // Fallback text
                                    const score = parseScoreFromRating(ratingText);
                                    return {
                                        ...img,
                                        rating: ratingText.substring(0, 100) + (ratingText.length > 100 ? '...' : ''), // Truncate long ratings for display
                                        score: score,
                                    };
                                });

                                // Sort images by score, highest first. Handle null scores (place them lower).
                                newRatedImages.sort((a, b) => {
                                    const scoreA = a.score ?? -1; // Treat null score as lowest
                                    const scoreB = b.score ?? -1;
                                    return scoreB - scoreA; // Descending order
                                });

                                setRatedImages(newRatedImages);
                            } else {
                                throw new Error('Invalid response format or mismatched rating count from server');
                            }
                        } catch (error: any) {
                            console.error('Error getting ratings:', error);
                            let errorMessage = 'Failed to get ratings.';
                            // Use error.message directly as fetch throws Error objects
                            errorMessage += ` ${error.message}`;
                            Alert.alert('Error', errorMessage);
                            setRatedImages(null); // Clear ratings on error
                        } finally {
                            setIsLoading(false);
                        }
                    } // End of onPress async function
                }
            ],
            { cancelable: false } // Prevent dismissing alert by tapping outside
        );
    };

    // Render item for the FlatList
    const renderRatedImage = ({ item }: { item: RatedImage }) => (
        <View style={styles.ratedImageContainer}>
            <Image source={{ uri: item.uri }} style={styles.image} resizeMode="contain" />
            <View style={styles.ratingOverlay}>
                 <Text style={styles.ratingScoreText}>{item.score !== null ? `${item.score}/10` : "N/A"}</Text>
                 <Text style={styles.ratingText} numberOfLines={3}>{item.rating}</Text>
             </View>
        </View>
    );

     // Render selected images before rating
     const renderSelectedImage = ({ item }: { item: SelectedImage }) => (
         <Image source={{ uri: item.uri }} style={styles.selectedImageThumbnail} resizeMode="cover" />
     );

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Stack.Screen options={{ title: 'Rate Top Images' }} />
                
                <TouchableOpacity onPress={() => router.replace('/homepage')} style={styles.backButton}>
                    <Ionicons name="home" size={24} color={COLORS.primaryPink} />
                    <Text style={styles.backButtonText}>Home</Text>
                </TouchableOpacity>

                <Text style={styles.title}>Select Up To 10 Images</Text>

                <Button title="Pick images from camera roll" onPress={pickImage} />

                {isLoading && <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />}

                {/* Display selected images before rating */}
                {selectedImages.length > 0 && !ratedImages && !isLoading && (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.subtitle}>Selected Images:</Text>
                        <FlatList
                            data={selectedImages}
                            renderItem={renderSelectedImage}
                            keyExtractor={(item, index) => index.toString()}
                            numColumns={3} // Adjust number of columns as needed
                            style={styles.thumbnailGrid}
                            columnWrapperStyle={styles.thumbnailRow}
                            ListFooterComponent={() => ( // Add the rate button inside the list as footer
                              <View style={styles.buttonContainer}>
                                <Button title={`Rate ${selectedImages.length} Image(s)`} onPress={rateImages} disabled={isLoading} />
                              </View>
                            )}
                        />
                     </View>
                )}


                {/* Display rated and sorted images */}
                {ratedImages && !isLoading && (
                     <View style={styles.sectionContainer}>
                        <Text style={styles.subtitle}>Rated Images (Best First):</Text>
                        <FlatList
                            data={ratedImages}
                            renderItem={renderRatedImage}
                            keyExtractor={(item) => item.uri} // Use URI as key after rating
                            style={styles.ratedList}
                        />
                     </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.grey, 
    },
    container: {
        flex: 1,
        alignItems: 'center',
        padding: 20,
        backgroundColor: COLORS.grey,
    },
    backButton: {
        position: 'absolute',
        top: 20,
        left: 20,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        zIndex: 1,
    },
    backButtonText: {
        marginLeft: 5,
        fontSize: 16,
        color: COLORS.primaryPink,
        fontWeight: '600',
    },
    sectionContainer: {
        width: '100%',
        alignItems: 'center',
        flex: 1,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 20,
        marginBottom: 10,
        color: '#444',
    },
     thumbnailGrid: {
         width: '100%',
         marginTop: 10,
     },
     thumbnailRow: {
         justifyContent: 'space-around',
         marginBottom: 10,
     },
     selectedImageThumbnail: {
         width: 100,
         height: 100,
         borderRadius: 5,
         borderWidth: 1,
         borderColor: '#ccc',
     },
    image: {
        width: '100%',
        aspectRatio: 4 / 3,
        marginBottom: 5,
        borderRadius: 5,
    },
    ratedImageContainer: {
        width: '95%',
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 10,
        marginBottom: 15,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    ratingOverlay: {
       padding: 8,
       width: '100%',
    },
    ratingScoreText: {
       fontSize: 18,
       fontWeight: 'bold',
       color: '#333',
       textAlign: 'center',
       marginBottom: 5,
    },
    ratingText: {
        fontSize: 14,
        color: '#555',
        textAlign: 'center',
        lineHeight: 18,
    },
    buttonContainer: {
        marginTop: 20,
        marginBottom: 30,
        width: '80%',
        alignSelf: 'center',
    },
    loader: {
        marginTop: 30,
        marginBottom: 20,
    },
    ratedList: {
        width: '100%',
        marginTop: 10,
    },
}); 