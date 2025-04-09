import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking, // For opening checkout/management URLs
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';

// Define API Base URL
const API_BASE_URL = 'https://mono-production-8ef9.up.railway.app';

// Define Colors
const COLORS = {
  primaryPink: '#E11D74',
  secondaryPink: '#FF69B4',
  lightPinkBackground: '#FFF0F5',
  white: '#FFFFFF',
  black: '#000000',
  textPrimary: '#333333',
  textSecondary: '#888888',
  errorRed: '#D32F2F',
  grey: '#F5F5F5',
  lightGrey: '#E0E0E0',
  green: '#4CAF50',
  blue: '#2196F3',
};

interface SubscriptionDetails {
  type: string | null;
  isTrialActive: boolean;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  hadTrial: boolean;
  isCanceled: boolean;
  canceledDuringTrial: boolean;
}

type SubscriptionStatus = 'free' | 'trial' | 'premium' | 'trial-canceling' | 'canceling';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('free');
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isProcessingSubscription, setIsProcessingSubscription] = useState(false);

  const fetchSubscriptionStatus = useCallback(async () => {
    if (!user?.email) {
      Alert.alert('Authentication Error', 'Please log in to view profile.');
      router.replace('/login');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/subscription/status?userEmail=${encodeURIComponent(user.email)}`,
        {
           headers: {
             'X-Client-Type': 'mobile', // Add client type if needed by this route
           }
        }
      );

      if (!response.ok) {
         if (response.status === 401) {
            throw new Error('Unauthorized. Please log in again.');
        }
        throw new Error(`Failed to fetch subscription status (${response.status})`);
      }

      const data = await response.json();
      setSubscriptionStatus(data.status);
      setSubscriptionDetails(data.details);
    } catch (error: any) {
      console.error('Error fetching subscription status:', error);
      Alert.alert('Error', error.message || 'Could not fetch subscription status.');
        if (error.message.includes('Unauthorized')) {
            router.replace('/login');
        }
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, router]);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, [fetchSubscriptionStatus]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      // Navigation handled by RootLayout
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Logout Failed', 'Could not sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleCheckout = async () => {
    if (!user?.email) return;
    setIsProcessingSubscription(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Type': 'mobile', // Add client type
        },
        body: JSON.stringify({ userEmail: user.email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        // Open the checkout URL in the browser
        const supported = await Linking.canOpenURL(data.url);
        if (supported) {
          await Linking.openURL(data.url);
        } else {
          Alert.alert('Error', `Could not open the checkout page. Please visit the website.`);
        }
        // Optionally refresh status after a delay or user interaction
        // setTimeout(fetchSubscriptionStatus, 10000); 
      } else {
           Alert.alert('Error', 'Checkout URL not received from server.');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      Alert.alert('Error', error.message || 'Error starting checkout. Please try again.');
    } finally {
       setIsProcessingSubscription(false);
    }
  };

 const handleCancelSubscription = () => {
    if (!user?.email) return;

    Alert.alert(
        'Confirm Cancellation',
        'Are you sure you want to cancel? Your access will continue until the end of the current period.',
        [
            { text: 'Keep Subscription', style: 'cancel' },
            {
                text: 'Confirm Cancel',
                style: 'destructive',
                onPress: async () => {
                    setIsProcessingSubscription(true);
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/cancelSubscription`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Client-Type': 'mobile',
                            },
                            body: JSON.stringify({ userEmail: user.email }),
                        });

                        const data = await response.json();

                        if (!response.ok) {
                            throw new Error(data.error || 'Failed to cancel subscription');
                        }

                        Alert.alert('Success', 'Subscription cancelled. Access continues until the period ends.');
                        await fetchSubscriptionStatus(); // Refresh status

                    } catch (error: any) {
                        console.error('Error canceling subscription:', error);
                        Alert.alert('Error', error.message || 'Failed to cancel subscription. Please try again.');
                    } finally {
                        setIsProcessingSubscription(false);
                    }
                },
            },
        ]
    );
};

  const formatTimeRemaining = (endDate: string | null): string => {
    if (!endDate) return 'N/A';
    const end = new Date(endDate);
    const now = new Date();
    const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Expired';
    if (days === 0) return 'Ends today';
    if (days === 1) return '1 day remaining';
    return `${days} days remaining`;
  };

  const formatDate = (dateString: string | null): string => {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleDateString();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
         <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={COLORS.black} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile & Subscription</Text>
            <View style={{ width: 24 }} />{/* Spacer */}
        </View>

        <ScrollView contentContainerStyle={styles.container}>
            {isLoading ? (
                <View style={styles.centeredContainer}>
                    <ActivityIndicator size="large" color={COLORS.primaryPink} />
                </View>
            ) : user ? (
            <>
                {/* User Info Card */}
                <View style={styles.card}>
                     <Ionicons name="person-circle-outline" size={40} color={COLORS.primaryPink} style={styles.cardIcon} />
                    <Text style={styles.cardTitle}>User Information</Text>
                    <Text style={styles.infoText}><Text style={styles.infoLabel}>Email:</Text> {user.email}</Text>
                    {/* Add other user info if available from context */}
                </View>

                {/* Subscription Card */}
                <View style={styles.card}>
                    <Ionicons name="card-outline" size={30} color={COLORS.primaryPink} style={styles.cardIcon} />
                    <Text style={styles.cardTitle}>Subscription Status</Text>
                    {subscriptionStatus === 'trial' ? (
                        <View style={styles.statusContainer}>
                            <Ionicons name="star" size={18} color={COLORS.secondaryPink} />
                            <Text style={styles.statusText}>Trial Active</Text>
                        </View>
                    ) : subscriptionStatus === 'premium' ? (
                         <View style={styles.statusContainer}>
                            <Ionicons name="star" size={18} color={COLORS.secondaryPink} />
                            <Text style={styles.statusText}>{subscriptionDetails?.isCanceled ? 'Premium (Canceling)' : 'Premium Member'}</Text>
                        </View>
                    ) : subscriptionStatus === 'trial-canceling' || subscriptionStatus === 'canceling' ? (
                        <View style={styles.statusContainer}>
                            <Ionicons name="star-outline" size={18} color={COLORS.textSecondary} />
                            <Text style={[styles.statusText, styles.statusCanceling]}>Access Ending Soon</Text>
                        </View>
                    ) : (
                        <View style={styles.statusContainer}>
                            <Ionicons name="star-outline" size={18} color={COLORS.textSecondary} />
                            <Text style={styles.statusText}>Free Plan</Text>
                        </View>
                    )}

                    {subscriptionDetails && (
                        <View style={styles.detailsContainer}>
                            {(subscriptionStatus === 'trial' || subscriptionStatus === 'trial-canceling') && subscriptionDetails.trialEndsAt && (
                                <Text style={styles.detailText}>Trial Ends: {formatDate(subscriptionDetails.trialEndsAt)} ({formatTimeRemaining(subscriptionDetails.trialEndsAt)})</Text>
                            )}
                            {(subscriptionStatus === 'premium' || subscriptionStatus === 'canceling') && subscriptionDetails.subscriptionEndsAt && (
                                <Text style={styles.detailText}>
                                    {subscriptionDetails.isCanceled ? 'Access Ends:' : 'Renews:'} {formatDate(subscriptionDetails.subscriptionEndsAt)} ({formatTimeRemaining(subscriptionDetails.subscriptionEndsAt)})
                                </Text>
                            )}
                            {subscriptionStatus === 'free' && (
                                <Text style={styles.detailText}>{subscriptionDetails.hadTrial ? 'Trial period used.' : '3-day free trial available.'}</Text>
                            )}
                        </View>
                    )}

                    {/* Action Buttons */}                    
                    {(subscriptionStatus === 'premium' || subscriptionStatus === 'trial') && !subscriptionDetails?.isCanceled ? (
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={handleCancelSubscription}
                            disabled={isProcessingSubscription}
                        >
                            {isProcessingSubscription ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Cancel Subscription</Text>}
                        </TouchableOpacity>
                    ) : subscriptionStatus === 'free' && (
                        <TouchableOpacity
                            style={[styles.button, styles.upgradeButton]}
                            onPress={handleCheckout}
                            disabled={isProcessingSubscription}
                        >
                             {isProcessingSubscription ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>{!subscriptionDetails?.hadTrial ? 'Start Free Trial' : 'Upgrade to Premium'}</Text>}
                        </TouchableOpacity>
                    )}
                     {/* Add Manage Subscription button if needed - requires a portal URL from backend */} 
                     {/* { (subscriptionStatus === 'premium' || subscriptionStatus === 'trial') && 
                        <TouchableOpacity style={[styles.button, styles.manageButton]} onPress={handleManageSubscription}> 
                            <Text style={styles.buttonText}>Manage Subscription</Text>
                        </TouchableOpacity>
                     } */} 
                </View>

                 {/* Sign Out Button */}
                 <TouchableOpacity
                    style={[styles.button, styles.signOutButton]}
                    onPress={handleSignOut}
                    disabled={isSigningOut}
                >
                    {isSigningOut ? <ActivityIndicator color={COLORS.primaryPink} /> : <Text style={styles.signOutButtonText}>Sign Out</Text>}
                </TouchableOpacity>

            </>
             ) : (
                <View style={styles.centeredContainer}>
                     <Text>Could not load user data.</Text>
                </View>
            )}
        </ScrollView>
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
  container: {
    flexGrow: 1,
    padding: 20,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    position: 'relative',
  },
  cardIcon: {
    position: 'absolute',
    top: 15,
    right: 15,
    opacity: 0.1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 15,
  },
  infoText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 5,
  },
  infoLabel: {
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    color: COLORS.textPrimary,
  },
  statusCanceling: {
      color: COLORS.textSecondary,
  },
  detailsContainer: {
      marginTop: 5,
      marginLeft: 26, // Align with status text
      paddingLeft: 10,
      borderLeftWidth: 2,
      borderLeftColor: COLORS.lightGrey,
  },
  detailText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
    lineHeight: 20,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 15,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8, // Space for potential icon
  },
  upgradeButton: {
    backgroundColor: COLORS.primaryPink,
  },
  cancelButton: {
    backgroundColor: COLORS.errorRed,
  },
  manageButton: {
      backgroundColor: COLORS.blue,
  },
  signOutButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primaryPink,
    marginTop: 30,
  },
  signOutButtonText: {
    color: COLORS.primaryPink,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
