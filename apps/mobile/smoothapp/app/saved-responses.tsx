import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../src/context/AuthContext';

// Define API Base URL
const API_BASE_URL = 'https://mono-production-8ef9.up.railway.app';

// Define Colors (reuse from other screens or define centrally)
const COLORS = {
  primaryPink: '#E11D74',
  lightPinkBackground: '#FFF0F5',
  white: '#FFFFFF',
  black: '#000000',
  textPrimary: '#333333',
  textSecondary: '#888888',
  errorRed: '#D32F2F',
  grey: '#F5F5F5',
  lightGrey: '#E0E0E0',
  blue: '#2196F3', // For copy icon
};

interface SavedResponse {
  id: string; // Assuming timestamp is the unique ID from web
  response: string;
  created_at: string;
}

export default function SavedResponsesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [responses, setResponses] = useState<SavedResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const fetchSavedResponses = useCallback(async () => {
    if (!user?.email) {
      Alert.alert('Authentication Error', 'Please log in to view saved responses.');
      router.replace('/login'); // Redirect to login if no user
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/saved-responses`,
       {
        headers: {
          'x-user-email': user.email,
          'X-Client-Type': 'mobile',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Unauthorized. Please log in again.');
        }
        throw new Error(`Failed to fetch saved responses (${response.status})`);
      }

      const data = await response.json();
      setResponses(data.responses || []);
    } catch (error: any) {
      console.error('Error fetching saved responses:', error);
      Alert.alert('Error', error.message || 'Could not fetch saved responses.');
      if (error.message.includes('Unauthorized')) {
        router.replace('/login');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, router]);

  useEffect(() => {
    fetchSavedResponses();
  }, [fetchSavedResponses]);

  const handleDelete = async (item: SavedResponse) => {
    if (!user?.email || deletingId === item.created_at) return;

    setDeletingId(item.created_at);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/saved-responses?email=${encodeURIComponent(user.email)}&timestamp=${encodeURIComponent(item.created_at)}`,
        {
          method: 'DELETE',
          headers: {
            'x-user-email': user.email,
            'X-Client-Type': 'mobile',
          },
        }
      );

      if (!response.ok) {
         if (response.status === 401) {
            throw new Error('Unauthorized. Please log in again.');
        }
        throw new Error(`Failed to delete response (${response.status})`);
      }

      setResponses((prev) => prev.filter((r) => r.created_at !== item.created_at));
       Alert.alert('Success', 'Response deleted.'); // Optional success message
    } catch (error: any) {
      console.error('Error deleting response:', error);
      Alert.alert('Error', error.message || 'Could not delete response.');
        if (error.message.includes('Unauthorized')) {
            router.replace('/login');
        }
    } finally {
      setDeletingId(null);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    if (!user?.email) {
        Alert.alert('Error', 'Cannot track copy action without user email.');
        return;
    }
    setCopyingId(id);

    try {
        // Actual copy to clipboard
        await Clipboard.setStringAsync(text);

        // --- Notify backend ---
        // Assuming a new endpoint: POST /api/increment-copy-count
        // This endpoint needs to be created on your backend.
        const trackResponse = await fetch(`${API_BASE_URL}/api/increment-copy-count`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json', // Optional, depends on backend
                'x-user-email': user.email,
                'X-Client-Type': 'mobile',
            },
            // You might send the response ID or text if needed by the backend
            // body: JSON.stringify({ responseId: id })
        });

        if (!trackResponse.ok) {
            // Don't block the user, but log the error
            console.warn(`Failed to track copy action: ${trackResponse.status}`);
             // Optionally, check for 401 Unauthorized and redirect
            if (trackResponse.status === 401) {
               throw new Error('Unauthorized. Please log in again.');
            }
        }
        // --- End backend notification ---


        Alert.alert('Copied!', 'Response copied to clipboard.');
        setTimeout(() => setCopyingId(null), 1500); // Reset icon after a short delay

    } catch (error: any) {
         console.error('Error during copy or tracking:', error);
         Alert.alert('Error', error.message || 'Could not copy or track the action.');
         if (error.message.includes('Unauthorized')) {
            router.replace('/login');
        }
         // Still reset the icon even if tracking fails
         setTimeout(() => setCopyingId(null), 1500);
    }
  };

  const renderItem = ({ item }: { item: SavedResponse }) => (
    <View style={styles.responseCard}>
      <Text style={styles.responseText}>{item.response}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.dateText}>
          Saved: {new Date(item.created_at).toLocaleDateString()}
        </Text>
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => copyToClipboard(item.response, item.created_at)}
          >
            <Ionicons
                name={copyingId === item.created_at ? "checkmark-circle" : "copy-outline"}
                size={22}
                color={copyingId === item.created_at ? 'green' : COLORS.blue}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDelete(item)}
            disabled={deletingId === item.created_at}
          >
            {deletingId === item.created_at ? (
              <ActivityIndicator size="small" color={COLORS.errorRed} />
            ) : (
              <Ionicons name="trash-outline" size={22} color={COLORS.errorRed} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Responses</Text>
        <View style={{ width: 24 }} />{/* Spacer to balance header */}
      </View>

      {isLoading ? (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={COLORS.primaryPink} />
          <Text style={styles.loadingText}>Loading Saved Responses...</Text>
        </View>
      ) : responses.length === 0 ? (
        <View style={styles.centeredContainer}>
            <Ionicons name="bookmark-outline" size={50} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>No saved responses yet.</Text>
          <Text style={styles.emptySubText}>Swipe right on responses you like!</Text>
        </View>
      ) : (
        <FlatList
          data={responses}
          renderItem={renderItem}
          keyExtractor={(item) => item.created_at}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.grey,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGrey,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
   emptySubText: {
    marginTop: 5,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  listContainer: {
    padding: 15,
  },
  responseCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  responseText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 10,
    lineHeight: 22, // Improve readability
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGrey,
    paddingTop: 10,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  actionsContainer: {
    flexDirection: 'row',
  },
  actionButton: {
    marginLeft: 15, // Spacing between icons
    padding: 5, // Make touch target larger
  },
});
