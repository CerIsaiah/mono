"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  PREMIUM_INCREMENT_PER_RESPONSE,
  FREE_INCREMENT_PER_RESPONSE,
  PREMIUM_MAX_PERCENTAGE,
  FREE_MAX_PERCENTAGE,
  MIN_LEARNING_PERCENTAGE,
  MATCH_PERCENTAGE_BASE
} from '../constants';

const DeleteButton = ({ onDelete, isDeleting }) => (
  <button
    onClick={onDelete}
    disabled={isDeleting}
    className="absolute top-2 right-2 p-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
    title="Delete response"
  >
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="20" 
      height="20" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M3 6h18"></path>
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
    </svg>
  </button>
);

export default function SavedResponses() {
  const [activeTab, setActiveTab] = useState('saved');
  const [responses, setResponses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showConfirmCancelModal, setShowConfirmCancelModal] = useState(false);
  const [copyingId, setCopyingId] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [matchPercentage, setMatchPercentage] = useState(MIN_LEARNING_PERCENTAGE);

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('smoothrizz_user');
    setUser(storedUser ? JSON.parse(storedUser) : null);
  }, []);

  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (user?.email) {
        try {
          const response = await fetch(`/api/subscription-status?userEmail=${user.email}`);
          const data = await response.json();
          setSubscriptionStatus(data.status);
          setSubscriptionDetails(data.details);
        } catch (error) {
          console.error('Error fetching subscription status:', error);
        }
      }
      setIsLoading(false);
    };

    fetchSubscriptionStatus();
  }, [user]);

  useEffect(() => {
    const fetchResponses = async () => {
      setIsLoading(true);
      if (user?.email) {
        // Fetch from database for signed-in users
        try {
          const response = await fetch('/api/saved-responses', {
            headers: {
              'x-user-email': user.email,
            },
          });
          const data = await response.json();
          
          if (response.ok) {
            setResponses(data.responses);
          } else {
            throw new Error(data.error);
          }
        } catch (error) {
          console.error('Error fetching saved responses:', error);
        }
      } else {
        // Get from localStorage for anonymous users
        const savedResponses = JSON.parse(localStorage.getItem('anonymous_saved_responses') || '[]');
        setResponses(savedResponses);
      }
      setIsLoading(false);
    };

    fetchResponses();
  }, [user]);

  useEffect(() => {
    const fetchLearningPercentage = async () => {
      try {
        const headers = {};
        if (user?.email) {
          headers['x-user-email'] = user.email;
        }

        const response = await fetch('/api/learning-percentage', { headers });
        const data = await response.json();
        setMatchPercentage(data.percentage);
      } catch (error) {
        console.error('Error fetching learning percentage:', error);
        setMatchPercentage(MIN_LEARNING_PERCENTAGE);
      }
    };

    fetchLearningPercentage();
  }, [user?.email, responses.length]);

  const copyToClipboard = async (text, id) => {
    try {
      setCopyingId(id);
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      
      // Reset success state after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
        setCopyingId(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setCopyingId(null);
    }
  };

  const handleDelete = async (timestamp) => {
    if (!user?.email || deletingIds.has(timestamp)) return;

    try {
      setDeletingIds(prev => new Set([...prev, timestamp]));

      const response = await fetch(
        `/api/saved-responses?email=${encodeURIComponent(user.email)}&timestamp=${encodeURIComponent(timestamp)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete response');
      }

      // Update local state to remove the deleted response
      setResponses(prev => prev.filter(r => r.created_at !== timestamp));
    } catch (error) {
      console.error('Error deleting response:', error);
      alert('Failed to delete response. Please try again.');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(timestamp);
        return newSet;
      });
    }
  };

  const handleSignOut = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
      window.google.accounts.id.revoke();
    }
    localStorage.removeItem('smoothrizz_user');
    setUser(null);
    router.push('/');
  };

  const handleCheckout = async () => {
    try {
      if (!user?.id) {
        console.error('No user ID found');
        return;
      }

      const response = await fetch('/api/checkout_sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Error starting checkout. Please try again.');
    }
  };

  const handleCancelSubscription = async () => {
    setShowConfirmCancelModal(true);
  };

  const confirmCancellation = async () => {
    if (!user?.email) return;
    setShowConfirmCancelModal(false);
    
    try {
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userEmail: user.email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      // Refresh subscription status
      const statusResponse = await fetch(`/api/subscription-status?userEmail=${encodeURIComponent(user.email)}`);
      const statusData = await statusResponse.json();
      setSubscriptionStatus(statusData.status);
      setSubscriptionDetails(statusData.details);

      // Show success message in modal
      setShowCancelModal(true);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      setShowCancelModal(true);
    }
  };

  // Helper function to format remaining time
  const formatTimeRemaining = (endDate) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return days;
  };

  const renderSubscriptionStatus = () => {
    if (!subscriptionDetails) return null;

    const trialDaysLeft = subscriptionDetails.isTrialActive ? 
      formatTimeRemaining(subscriptionDetails.trialEndsAt) : null;
    
    const subscriptionDaysLeft = subscriptionDetails.subscriptionEndsAt ? 
      formatTimeRemaining(subscriptionDetails.subscriptionEndsAt) : null;

    return (
      <div className="bg-[#232939] rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-gray-300 mb-2">Subscription Status</h3>
        <div className="flex items-center justify-between">
          <div>
            {subscriptionStatus === 'trial' ? (
              <>
                <p className="flex items-center gap-2 text-pink-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  Trial Active
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {formatTimeRemaining(subscriptionDetails?.trialEndsAt)} days remaining in trial
                </p>
              </>
            ) : subscriptionStatus === 'trial-canceling' ? (
              <>
                <p className="flex items-center gap-2 text-orange-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  Trial (Canceled)
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Access until {new Date(subscriptionDetails.trialEndsAt).toLocaleDateString()}
                  {trialDaysLeft && ` (${trialDaysLeft} days remaining)`}
                </p>
              </>
            ) : subscriptionStatus === 'premium' ? (
              <>
                <p className="flex items-center gap-2 text-pink-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  Premium Member
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Enjoying unlimited access!
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-300">Free Plan</p>
                <p className="text-sm text-gray-400 mt-1">
                  {subscriptionDetails.hadTrial ? 
                    'Trial period has been used' : 
                    'Start your 3-day free trial'}
                </p>
              </>
            )}
          </div>
          
          {(subscriptionStatus === 'premium' || subscriptionStatus === 'trial') ? (
            <button
              onClick={handleCancelSubscription}
              className="px-4 py-2 rounded-full text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              Cancel Subscription
            </button>
          ) : subscriptionStatus === 'trial-canceling' ? (
            <div className="text-sm text-gray-400">
              Trial ending soon
            </div>
          ) : !subscriptionDetails.hadTrial ? (
            <button
              onClick={handleCheckout}
              className="px-4 py-2 rounded-full text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 transition-colors"
            >
              Start Free Trial
            </button>
          ) : (
            <button
              onClick={handleCheckout}
              className="px-4 py-2 rounded-full text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 transition-colors"
            >
              Upgrade to Premium
            </button>
          )}
        </div>
      </div>
    );
  };

  const ConfirmCancelModal = ({ isOpen, onClose, onConfirm, isTrialActive, trialEndsAt }) => {
    if (!isOpen) return null;

    const endDate = new Date(trialEndsAt).toLocaleDateString();

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Cancel Subscription?</h3>
            {isTrialActive ? (
              <p className="mt-2 text-sm text-gray-500">
                If you cancel now, you will lose access to premium features on {endDate}.
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-500">
                Are you sure you want to cancel your subscription? You will still have access until the end of your current billing period.
              </p>
            )}
            <div className="mt-4 flex space-x-3">
              <button
                onClick={onConfirm}
                className="flex-1 inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:text-sm"
              >
                Yes, Cancel
              </button>
              <button
                onClick={onClose}
                className="flex-1 inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 sm:text-sm"
              >
                Keep Subscription
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const CancelModal = ({ isOpen, onClose, success, isTrialActive, trialEndsAt }) => {
    if (!isOpen) return null;

    const endDate = new Date(trialEndsAt).toLocaleDateString();

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            {success ? (
              <>
                <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">Subscription Cancelled</h3>
                {isTrialActive ? (
                  <p className="mt-2 text-sm text-gray-500">
                    You will lose access to premium features on {endDate}.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">
                    Your subscription will remain active until the end of the current billing period.
                  </p>
                )}
              </>
            ) : (
              <>
                <svg className="mx-auto h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">Error</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Failed to cancel subscription. Please email icisaiahcerven@gmail.com.
                </p>
              </>
            )}
            <button
              onClick={onClose}
              className="mt-4 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-pink-600 text-base font-medium text-white hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 sm:text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#171a29] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  // Check if user has active subscription
  const hasActiveSubscription = subscriptionStatus === 'premium' || subscriptionStatus === 'trial';
  
  return (
    <div className="min-h-screen bg-[#171a29] text-white">
      {/* Header */}
      <div className="bg-[#191e2e] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link 
                href="/"
                className="mr-4 text-gray-400 hover:text-white transition-colors"
                title="Return to homepage"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </Link>
              <Link 
                href="/"
                className="text-xl font-bold bg-gradient-to-r from-pink-500 to-rose-600 bg-clip-text text-transparent"
              >
                SmoothRizz
              </Link>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex space-x-8 -mb-px border-b border-gray-700">
            <button
              onClick={() => setActiveTab('saved')}
              className={`py-4 px-4 font-medium text-lg transition-colors flex items-center gap-2 ${
                activeTab === 'saved'
                  ? 'border-b-2 border-pink-500 text-pink-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              Saved Responses
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-4 px-4 font-medium text-lg transition-colors flex items-center gap-2 ${
                activeTab === 'profile'
                  ? 'border-b-2 border-pink-500 text-pink-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Profile
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === 'saved' ? (
          // Saved Responses Tab
          <div className="space-y-6">
            {/* Rizz Profile Card - Made smaller */}
            <div className="bg-[#191e2e] rounded-xl p-5 border border-gray-700 max-w-2xl mx-auto">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-pink-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                </span>
                <h2 className="text-xl font-bold">Your Rizz Profile</h2>
              </div>
              <p className="text-gray-300 text-sm mb-3">SmoothRizz is learning your unique flirting style with every swipe.</p>
              
              <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden mb-2">
                <div 
                  className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-pink-500 to-purple-500"
                  style={{ width: `${matchPercentage}%` }}
                ></div>
              </div>
              
              <div className="flex justify-between text-xs">
                <span className="text-green-400">{matchPercentage}% Learned</span>
                <span className="text-gray-400 flex items-center">
                  100% with Premium
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
              </div>
            </div>
            
            {/* Premium Banner - Only show if not subscribed */}
            {!hasActiveSubscription && (
              <div className="bg-gradient-to-r from-amber-500 to-amber-700 rounded-xl p-5 text-black max-w-2xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Unlock Your Full Rizz Potential!</h3>
                    <p className="text-sm">Get 3x more personalized responses & unlimited swipes</p>
                  </div>
                  <button 
                    onClick={handleCheckout}
                    className="bg-black text-white px-5 py-2 rounded-full font-bold hover:bg-gray-800 whitespace-nowrap"
                  >
                    Try Free
                  </button>
                </div>
              </div>
            )}
            
            {/* Style Matches */}
            <h3 className="text-xl font-bold text-gray-300 mt-8 mb-4">STYLE MATCHES</h3>
            
            {responses.length === 0 ? (
              <div className="text-center py-12 bg-[#191e2e] rounded-xl border border-gray-700">
                <p className="text-gray-400 text-lg mb-4">No saved responses yet!</p>
                <Link
                  href="/"
                  className="px-6 py-3 rounded-full text-white hover:opacity-90 transition inline-block bg-pink-600"
                >
                  Generate Some Responses
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {responses.map((item) => (
                  <div 
                    key={item.created_at} 
                    className="bg-[#191e2e] rounded-xl p-5 border border-gray-700 relative hover:border-gray-500 transition-colors"
                  >
                    {/* Action buttons - delete and copy */}
                    <div className="absolute top-2 right-2 flex space-x-1">
                      <button
                        onClick={() => copyToClipboard(item.response, item.created_at)}
                        disabled={copyingId === item.created_at}
                        className="p-2 text-gray-400 hover:text-blue-400 transition-colors rounded-full hover:bg-blue-50/10"
                        title="Copy to clipboard"
                      >
                        {copyingId === item.created_at && copySuccess ? (
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="20" 
                            height="20" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            className="text-green-500"
                          >
                            <path d="M20 6L9 17l-5-5"></path>
                          </svg>
                        ) : (
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="20" 
                            height="20" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                          </svg>
                        )}
                      </button>
                      
                      <button
                        onClick={() => handleDelete(item.created_at)}
                        disabled={deletingIds.has(item.created_at)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50/10"
                        title="Delete response"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          width="20" 
                          height="20" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18"></path>
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                    
                    <div className="flex justify-between items-start mb-2 pr-16">
                      <h4 className="text-xl font-bold">{item.response.split(' ').slice(0, 5).join(' ')}...</h4>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <p className="text-gray-400 text-xs">
                        Saved on {new Date(item.created_at).toLocaleDateString()}
                      </p>
                      <span className="bg-black px-3 py-1 rounded-full text-green-400 text-xs flex items-center">
                        <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                        {Math.floor(Math.random() * 40) + 60}% Match
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Profile Tab - Keep existing profile code but with updated styling
          <div className="bg-[#191e2e] rounded-2xl border border-gray-700 overflow-hidden max-w-2xl mx-auto">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-pink-600 to-purple-600 px-6 py-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-black/20 flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-8 h-8 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold">{user?.name || 'Anonymous User'}</h2>
                  <p className="text-pink-200 text-sm">{user?.email || 'Not signed in'}</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Subscription Status - smaller size */}
              <div className="bg-[#232939] rounded-xl p-4 border border-gray-700">
                <h3 className="text-base font-semibold mb-2">Subscription Status</h3>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    {subscriptionStatus === 'trial' ? (
                      <>
                        <p className="flex items-center gap-2 text-pink-400">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                          Trial Active
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTimeRemaining(subscriptionDetails?.trialEndsAt)} days remaining in trial
                        </p>
                      </>
                    ) : subscriptionStatus === 'premium' ? (
                      <>
                        <p className="flex items-center gap-2 text-pink-400">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                          Premium Member
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Enjoying unlimited access!
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-300">Free Plan</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {subscriptionDetails?.hadTrial ? 
                            'Trial period has been used' : 
                            'Start your 3-day free trial'}
                        </p>
                      </>
                    )}
                  </div>
                  
                  {(subscriptionStatus === 'premium' || subscriptionStatus === 'trial') ? (
                    <button
                      onClick={handleCancelSubscription}
                      className="px-4 py-2 rounded-full text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
                    >
                      Cancel Subscription
                    </button>
                  ) : (
                    <button
                      onClick={handleCheckout}
                      className="px-4 py-2 rounded-full text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 transition-colors"
                    >
                      {!subscriptionDetails?.hadTrial ? 'Start Free Trial' : 'Upgrade to Premium'}
                    </button>
                  )}
                </div>
              </div>

              {/* Sign Out Button */}
              <div className="border-t border-gray-700 pt-4">
                <button
                  onClick={handleSignOut}
                  className="w-full sm:w-auto px-5 py-2 rounded-full text-white bg-gray-700 hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmCancelModal 
        isOpen={showConfirmCancelModal}
        onClose={() => setShowConfirmCancelModal(false)}
        onConfirm={confirmCancellation}
        isTrialActive={subscriptionDetails?.isTrialActive}
        trialEndsAt={subscriptionDetails?.trialEndsAt}
      />
      
      <CancelModal 
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        success={true}
        isTrialActive={subscriptionDetails?.isTrialActive}
        trialEndsAt={subscriptionDetails?.trialEndsAt}
      />
    </div>
  );
} 