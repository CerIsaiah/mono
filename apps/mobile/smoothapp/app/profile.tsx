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
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as InAppPurchases from 'expo-in-app-purchases';
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

const IAP_PRODUCT_ID_IOS = 'smoothrizz_unlimited_subscription'; // From your screenshot

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
  const [isIapConnected, setIsIapConnected] = useState(false);
  const [products, setProducts] = useState<InAppPurchases.IAPItemDetails[]>([]);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

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

  const renderSubscriptionCard = () => {
    // Find the product details (assuming only one subscription product)
    const subscriptionProduct = products.find(p => p.productId === IAP_PRODUCT_ID_IOS);

    return (
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
        {subscriptionStatus === 'free' && Platform.OS === 'ios' && isIapConnected && subscriptionProduct && (
          <TouchableOpacity
            style={[styles.button, styles.upgradeButton]}
            onPress={() => handlePurchase(IAP_PRODUCT_ID_IOS)}
            disabled={isPurchasing || isRestoring}
          >
            {isPurchasing ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>
                {subscriptionDetails?.hadTrial ? 'Upgrade to Premium' : 'Start Free Trial'} ({subscriptionProduct.price})
              </Text>
            )}
          </TouchableOpacity>
        )}
        {subscriptionStatus === 'free' && Platform.OS === 'ios' && !subscriptionProduct && isIapConnected && (
            <Text style={styles.loadingText}>Loading subscription options...</Text>
        )}
        {subscriptionStatus === 'free' && Platform.OS === 'ios' && !isIapConnected && (
             <Text style={styles.errorText}>Cannot load subscription. Check App Store connection.</Text>
        )}
      </View>
    );
  };

  // --- IAP Effects ---

  // Connect and disconnect from the App Store
  useEffect(() => {
    const connectAndFetch = async () => {
      try {
        console.log('[IAP] Connecting to App Store...');
        await InAppPurchases.connectAsync();
        setIsIapConnected(true);
        console.log('[IAP] Connected.');
      } catch (e) {
        console.error('[IAP] Connection Error:', e);
        Alert.alert('App Store Error', 'Could not connect to the App Store. Please check your connection and try again.');
      }
    };

    connectAndFetch();

    return () => {
      console.log('[IAP] Disconnecting...');
      InAppPurchases.disconnectAsync();
      setIsIapConnected(false);
      console.log('[IAP] Disconnected.');
    };
  }, []);

  // Fetch products when connected
  useEffect(() => {
    if (isIapConnected) {
      const fetchProducts = async () => {
        console.log('[IAP] Fetching products...');
        const itemSkus = Platform.select({
          ios: [IAP_PRODUCT_ID_IOS],
          // android: [IAP_PRODUCT_ID_ANDROID] // Add Android ID if needed
        });

        if (!itemSkus) {
           console.warn('[IAP] No product SKUs defined for this platform.');
           return;
        }

        try {
          const { responseCode, results } = await InAppPurchases.getProductsAsync(itemSkus);
          if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
            console.log('[IAP] Products fetched:', results);
            setProducts(results);
          } else {
            console.error('[IAP] Error fetching products, response code:', responseCode);
            Alert.alert('App Store Error', 'Could not fetch subscription details.');
          }
        } catch (e) {
          console.error('[IAP] Error fetching products:', e);
          Alert.alert('App Store Error', 'An error occurred while fetching subscription details.');
        }
      };
      fetchProducts();
    }
  }, [isIapConnected]);

  // Listen for purchase updates
  useEffect(() => {
    // No need to store the result, setPurchaseListener returns void
    InAppPurchases.setPurchaseListener(
      ({ responseCode, results, errorCode }) => {
        console.log('[IAP] Purchase Update:', { responseCode, results, errorCode });
        setIsPurchasing(false); // Stop loading indicator on any response
        setIsRestoring(false); // Stop restore indicator

        if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
          results.forEach(async (purchase) => {
            if (!purchase.acknowledged) {
              console.log(`[IAP] Finishing transaction for ${purchase.productId}...`);
              // TODO: IMPORTANT - Verify purchase receipt with your backend FIRST
              // Only finish transaction after backend confirms validity
              try {
                  // --- Backend Verification Step (Pseudo-code) ---
                  // const verificationResponse = await fetch(`${API_BASE_URL}/api/verify-iap`, {
                  //   method: 'POST',
                  //   headers: { 'Content-Type': 'application/json', 'x-user-email': user?.email },
                  //   body: JSON.stringify({ receipt: purchase.transactionReceipt, platform: Platform.OS })
                  // });
                  // if (!verificationResponse.ok) throw new Error('Backend verification failed');
                  // const verificationData = await verificationResponse.json();
                  // if (!verificationData.isValid) throw new Error('Invalid receipt');
                  // --- End Backend Verification ---

                  // If verification is successful:
                  await InAppPurchases.finishTransactionAsync(purchase, false);
                  console.log(`[IAP] Transaction finished for ${purchase.productId}`);
                  Alert.alert('Purchase Successful', 'Your subscription is now active!');
                  fetchSubscriptionStatus(); // Refresh user status from backend

              } catch (verificationError) {
                  console.error('[IAP] Receipt verification or transaction finish error:', verificationError);
                  Alert.alert('Verification Error', 'Could not verify your purchase. Please contact support.');
                  // Do NOT finish transaction if verification fails
              }
            }
          });
        } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
          console.log('[IAP] User cancelled the purchase flow.');
          Alert.alert('Purchase Cancelled', 'The purchase was cancelled.');
        } else if (responseCode === InAppPurchases.IAPResponseCode.DEFERRED) {
           console.log('[IAP] Purchase deferred (requires parent approval).');
           Alert.alert('Purchase Pending', 'Your purchase requires approval.');
        } else {
          console.error(`[IAP] Purchase Error: Code ${responseCode}, ErrorCode: ${errorCode}`);
          Alert.alert('Purchase Failed', `An error occurred during the purchase. Code: ${errorCode || responseCode}`);
        }
      }
    );

    // Remove the return function that tried to call .remove()
    // Cleanup is handled by disconnectAsync in the connection useEffect
  }, [fetchSubscriptionStatus]); // Add fetchSubscriptionStatus as dependency

  // --- End IAP Effects ---

  // --- IAP Handlers ---

  const handlePurchase = async (productId: string) => {
    if (!isIapConnected) {
      Alert.alert('App Store Error', 'Not connected to the App Store.');
      return;
    }
    if (isPurchasing) {
      console.log('[IAP] Purchase already in progress.');
      return;
    }

    console.log(`[IAP] Attempting to purchase ${productId}...`);
    setIsPurchasing(true);
    try {
      await InAppPurchases.purchaseItemAsync(productId);
      // The purchase listener will handle success/failure/cancellation
    } catch (error: any) {
      console.error('[IAP] Error initiating purchase:', error);
      Alert.alert('Purchase Error', 'An error occurred while starting the purchase process.');
      setIsPurchasing(false);
    }
  };

  const handleRestorePurchases = async () => {
     if (!isIapConnected) {
       Alert.alert('App Store Error', 'Not connected to the App Store.');
       return;
     }
     if (isRestoring) {
       console.log('[IAP] Restore already in progress.');
       return;
     }

     console.log('[IAP] Attempting to restore purchases...');
     setIsRestoring(true);
     try {
       if (Platform.OS === 'ios') {
         // Call with no arguments, listener should handle results
         await InAppPurchases.getPurchaseHistoryAsync();
         // The purchase listener should pick up any restored purchases needing finishing.
         // We might not get immediate feedback here, listener handles it.
         Alert.alert('Restore Initiated', 'If you have an active subscription, it should be restored shortly.');
       } else {
         // On Android, connectAsync often triggers restoration checks
         // No explicit restore function needed via expo-in-app-purchases usually.
         // We might want to re-fetch status from our backend instead.
         Alert.alert('Restore', 'Checking for existing subscriptions...');
         fetchSubscriptionStatus(); // Re-check backend status as primary method on Android
       }
     } catch (error: any) {
       console.error('[IAP] Error restoring purchases:', error);
       Alert.alert('Restore Error', 'An error occurred while trying to restore purchases.');
     } finally {
        // Listener handles setting isRestoring back to false upon completion/error
        // We might set it false here after a timeout if listener doesn't respond?
        // For now, rely on listener.
        // setIsRestoring(false); // Or let the listener handle this
     }
  };

  // --- End IAP Handlers ---

  return (
    <SafeAreaView style={styles.safeArea}>
         <View style={styles.header}>
            <TouchableOpacity onPress={() => router.push('/homepage')} style={styles.backButton}>
                <Ionicons name="home" size={24} color={COLORS.black} />
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

                {renderSubscriptionCard()}

                {/* Restore Purchases Button (iOS only) */} 
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[styles.button, styles.restoreButton]}
                    onPress={handleRestorePurchases}
                    disabled={isRestoring || isPurchasing || !isIapConnected}
                  >
                    {isRestoring ? (
                      <ActivityIndicator color={COLORS.primaryPink} />
                    ) : (
                      <Text style={styles.restoreButtonText}>Restore Purchases</Text>
                    )}
                  </TouchableOpacity>
                )}

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
  restoreButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primaryPink,
    marginTop: 10, // Add some space above sign out
    marginBottom: 20,
  },
  restoreButtonText: {
    color: COLORS.primaryPink,
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    marginTop: 10,
    textAlign: 'center',
    color: COLORS.textSecondary,
  },
  errorText: {
    marginTop: 10,
    textAlign: 'center',
    color: COLORS.errorRed,
  },
});
