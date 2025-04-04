"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Head from "next/head";
import { Upload } from "lucide-react";
import Script from "next/script";
import { ANONYMOUS_USAGE_LIMIT, FREE_USER_DAILY_LIMIT } from './shared/constants';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { UpgradePopup } from './components/UpgradePopup';
import { convertFileToBase64 } from './openai';
import { Analytics } from "@vercel/analytics/react"

// Types
interface User {
  email: string;
  name?: string;
  picture?: string;
}

interface CompletedSteps {
  upload: boolean;
  stage: boolean;
  preview: boolean;
}

interface Phase {
  name: string;
  desc: string;
  emoji: string;
}

interface ResponseData {
  responses: string[];
  currentIndex: number;
  mode: string | null;
  lastContext: string;
  lastText: string;
  inputMode: 'screenshot' | 'text';
  timestamp: number;
  lastFile?: string;
}

// Add this near the top of the file, after imports
const API_BASE_URL = process.env.NEXT_PUBLIC_RAILWAY_URL || 'https://mono-production-8ef9.up.railway.app';

// Add connection logging with error handling
const logConnection = async (endpoint: string, options: RequestInit = {}) => {
  try {
    console.log(`Attempting to connect to ${API_BASE_URL}${endpoint}...`, {
      baseUrl: API_BASE_URL,
      endpoint,
      timestamp: new Date().toISOString()
    });

    const startTime = Date.now();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });
    
    const endTime = Date.now();
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || 'Unknown error'}`);
    }

    console.log(`Connection to ${endpoint} successful:`, {
      status: response.status,
      time: `${endTime - startTime}ms`,
      timestamp: new Date().toISOString()
    });

    return response;
  } catch (error) {
    console.error(`Connection to ${endpoint} failed:`, {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      baseUrl: API_BASE_URL,
      endpoint,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

// Overlay component for Google Sign-In
interface GoogleSignInOverlayProps {
  googleLoaded: boolean;
}

function GoogleSignInOverlay({ googleLoaded }: GoogleSignInOverlayProps) {
  const overlayButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (googleLoaded && window.google && overlayButtonRef.current) {
      overlayButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(overlayButtonRef.current, {
        theme: "outline",
        size: "large",
      });
    }
  }, [googleLoaded]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white p-4 sm:p-8 rounded-xl w-full max-w-sm mx-auto flex flex-col items-center">
        <div ref={overlayButtonRef}></div>
        <p className="mt-4 text-center text-sm sm:text-base">
          Please sign in with Google to view your saved responses/generate more.
        </p>
      </div>
    </div>
  );
}

// Add this near the top of the file, after imports
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement, options: {
            theme: string;
            size: string;
          }) => void;
          prompt: (callback: (notification: { 
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
          }) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

// Add logEvent function
const logEvent = async (event: string, data: any) => {
  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event,
        data,
        timestamp: new Date().toISOString()
      }),
    });
  } catch (error) {
    console.error('Failed to log event:', error);
  }
};

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOnPreview, setIsOnPreview] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  const [dailyCount, setDailyCount] = useState(0);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [context, setContext] = useState('');
  const [lastText, setLastText] = useState('');
  const [inputMode, setInputMode] = useState<'screenshot' | 'text'>('screenshot');
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [lastDirection, setLastDirection] = useState<string>();
  const currentIndexRef = useRef(currentIndex);
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const router = useRouter();
  const [showSignInOverlay, setShowSignInOverlay] = useState(false);
  const pathname = usePathname();

  // Add this state for tracking steps
  const [completedSteps, setCompletedSteps] = useState<CompletedSteps>({
    upload: false,
    stage: false,
    preview: false
  });

  // Add this near the top of the component
  const fetchingRef = useRef(false);

  // Consolidate fetch operations into a single memoized function
  const fetchUserData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const response = await fetch('/api/usage', {
        headers: {
          'Content-Type': 'application/json',
          ...(isSignedIn && user?.email && { 'x-user-email': user.email })
        }
      });
      
      const data = await response.json();
      if (response.ok) {
        setUsageCount(data.dailySwipes || 0);
        setIsPremium(data.isPremium || data.isTrial);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      fetchingRef.current = false;
    }
  }, [isSignedIn, user]);

  // Update the useEffect that handles auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Use hardcoded Google client ID directly
        const clientId = "776336590279-s1ucslerlcfcictp8kbhn6jq45s2v2fr.apps.googleusercontent.com";
        
        // Check if user object exists in localStorage
        const savedUserData = localStorage.getItem('smoothrizz_user');
        if (savedUserData) {
          const userData = JSON.parse(savedUserData);
          console.log('Found saved user:', userData.email);
          setUser(userData);
          setIsSignedIn(true);
          
          // Verify saved session with backend
          const verifyResponse = await fetch(`${API_BASE_URL}/auth/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: userData.email })
          });
          
          if (verifyResponse.ok) {
            const data = await verifyResponse.json();
            setUsageCount(data.dailySwipes || 0);
            setIsPremium(data.isPremium || false);
            return; // Exit if session verification succeeded
          } else {
            console.log('Session expired, clearing local storage');
            localStorage.removeItem('smoothrizz_user');
            setUser(null);
            setIsSignedIn(false);
          }
        }
        
        // Only try to fetch client ID if no stored user exists
        // Look for Google Sign-In feature
        if (!window.google?.accounts?.id) {
          console.log('Google Sign-In not available');
          return;
        }
        
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleSignIn,
        });
        
        // Trigger Google One Tap UI
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.log('Google One Tap not displayed');
          }
        });
      } catch (error) {
        console.error('Auth check error:', error);
      }
    };
    
    checkAuth();
  }, []);

  // Update the useEffect that handles Google Sign-In initialization
  useEffect(() => {
    const storedUser = localStorage.getItem('smoothrizz_user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsSignedIn(true);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('smoothrizz_user');
        setIsSignedIn(false);
      }
    } else {
      setIsSignedIn(false);
    }

    // Move Google button rendering to a separate function
    const renderGoogleButton = () => {
      if (googleButtonRef.current && window.google) {
        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
        });
      }
    };

    // Initialize Google Sign-In
    const initializeGoogleSignIn = async () => {
      try {
        // Use hardcoded Google client ID
        const clientId = "776336590279-s1ucslerlcfcictp8kbhn6jq45s2v2fr.apps.googleusercontent.com";
        
        if (window.google?.accounts?.id) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleSignIn,
          });
          
          if (googleButtonRef.current) {
            window.google.accounts.id.renderButton(googleButtonRef.current, {
              theme: "outline",
              size: "large"
            });
          }
        }
      } catch (error) {
        console.error('Error initializing Google Sign-In:', error);
      }
    };

    initializeGoogleSignIn();
  }, [isSignedIn]);

  // Update the handleSignIn function
  const handleSignIn = async (response: any) => {
    try {
      const { credential } = response;
      
      await logEvent('sign_in_attempt', {
        timestamp: new Date().toISOString()
      });
      
      const res = await logConnection('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        await logEvent('sign_in_success', { 
          user: data.user.email,
        });

        localStorage.setItem('smoothrizz_user', JSON.stringify(data.user));
        setUser(data.user);
        setIsSignedIn(true);

        if (window.google?.accounts?.id) {
          window.google.accounts.id.cancel();
        }

        const savedResponses = JSON.parse(localStorage.getItem('anonymous_saved_responses') || '[]');
        if (savedResponses.length > 0) {
          await logEvent('migrate_anonymous_responses', { 
            count: savedResponses.length
          });
          
          await Promise.all(
            savedResponses.map(async (item: any) => {
              await logConnection('/api/saved-responses');
            })
          );
          localStorage.removeItem('anonymous_saved_responses');
        }

        window.location.reload();
        
      } else {
        await logEvent('sign_in_error', { 
          error: data.error
        });
        throw new Error(data.error || 'Failed to sign in');
      }
    } catch (error) {
      await logEvent('sign_in_exception', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error('Error signing in:', error);
      alert('Failed to sign in. Please try again.');
    }
  };

  // Update the handleSubmit function
  const handleSubmit = async () => {
    await logEvent('submit_attempt', {
      hasFile: !!selectedFile,
      hasContext: !!context,
      hasLastText: !!lastText,
      mode,
      isSignedIn,
      userEmail: user?.email
    });

    if (!selectedFile && (!context || !lastText)) {
      await logEvent('submit_validation_error', {
        reason: 'missing_input'
      });
      alert("Please select a screenshot or provide text input");
      return;
    }

    try {
      setIsGenerating(true);
      localStorage.removeItem('current_responses');
      
      const statusResponse = await fetch(`${API_BASE_URL}/api/usage`, {
        headers: {
          'Content-Type': 'application/json',
          ...(isSignedIn && user?.email && { 'x-user-email': user.email }),
        },
      });
      
      const statusData = await statusResponse.json();
      await logEvent('usage_check', {
        dailySwipes: statusData.dailySwipes,
        isPremium: statusData.isPremium,
        isAnonymous: !isSignedIn
      });
      
      if (!isSignedIn && statusData.dailySwipes >= ANONYMOUS_USAGE_LIMIT) {
        await logEvent('anonymous_limit_reached', {
          swipes: statusData.dailySwipes
        });
        setUsageCount(ANONYMOUS_USAGE_LIMIT);
        setShowSignInOverlay(true);
        return;
      }
      
      if (isSignedIn && !statusData.isPremium && statusData.dailySwipes >= FREE_USER_DAILY_LIMIT) {
        await logEvent('free_user_limit_reached', {
          swipes: statusData.dailySwipes
        });
        setShowUpgradePopup(true);
        return;
      }

      setIsLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/openai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isSignedIn && user?.email && { 'x-user-email': user.email }),
        },
        body: JSON.stringify({
          imageBase64: selectedFile ? await convertFileToBase64(selectedFile) : undefined,
          mode: mode || 'first-move',
          context: context || undefined,
          lastText: lastText || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        await logEvent('openai_api_error', errorData);
        throw new Error(errorData.error || 'Failed to generate responses');
      }

      const data = await response.json();
      await logEvent('responses_generated', {
        responseCount: data.responses?.length,
        mode: mode
      });

      // Store the responses in localStorage before navigation
      localStorage.setItem('current_responses', JSON.stringify(data));
      
      // Use router.push for client-side navigation
      router.push('/responses');

    } catch (error) {
      await logEvent('submit_error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      if (error instanceof Error) {
        if (error.message.includes('usage limit')) {
          alert("You've reached your usage limit. Please try again later.");
        } else if (error.message.includes('Invalid response')) {
          alert("Received invalid response from server. Please try again.");
        } else if (error.message.includes('Failed to save')) {
          alert("Failed to save responses. Please try again.");
        } else {
          alert("Error processing input. Please try again.");
        }
      }
    } finally {
      setIsGenerating(false);
      setIsLoading(false);
    }
  };

  // Add this helper function to check if a step is accessible
  const canAccessStep = (stepNumber: number): boolean => {
    switch (stepNumber) {
      case 1: // Upload
        return true; // Always accessible
      case 2: // Stage
        return completedSteps.upload;
      case 3: // Preview
        return completedSteps.upload && completedSteps.stage;
      default:
        return false;
    }
  };

  // Update mode selection to track completion
  const handleModeSelection = (selectedMode: string) => {
    logEvent('mode_selection', {
      mode: selectedMode,
      previousMode: mode,
      completedSteps
    });
    
    setMode(selectedMode);
    setCompletedSteps(prev => ({ ...prev, stage: true }));
  };

  // Update preview completion
  useEffect(() => {
    if (selectedFile || (context && lastText)) {
      setCompletedSteps(prev => ({ ...prev, preview: true }));
    }
  }, [selectedFile, context, lastText]);

  // Add this useEffect to detect when user scrolls to preview section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsOnPreview(true);
          }
        });
      },
      {
        threshold: 0.3,
        rootMargin: '-100px',
      }
    );

    const previewSection = document.querySelector('#step-3');
    if (previewSection) {
      observer.observe(previewSection);
    }

    return () => {
      if (previewSection) {
        observer.unobserve(previewSection);
      }
    };
  }, []);

  // Add this useEffect near the other useEffects
  useEffect(() => {
    const updateOnlineUsers = () => {
      const randomUsers = Math.floor(Math.random() * (32 - 14 + 1)) + 14;
      const element = document.getElementById('online-users');
      if (element) {
        element.textContent = `${randomUsers} users swiping`;
      }
    };

    // Update initially
    updateOnlineUsers();

    // Update every 20-39 seconds
    const interval = setInterval(() => {
      const randomDelay = Math.floor(Math.random() * (39000 - 20000 + 1)) + 20000;
      setTimeout(updateOnlineUsers, randomDelay);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Update the useEffect that checks subscription status
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (isSignedIn && user?.email) {
        try {
          await logEvent('subscription_check_start', {
            userEmail: user.email,
            timestamp: new Date().toISOString()
          });

          console.log('Checking subscription status for', user.email);
          const response = await fetch(`${API_BASE_URL}/api/subscription/status?userEmail=${encodeURIComponent(user.email)}`);
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            await logEvent('subscription_check_error', {
              error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
            });
            throw new Error(errorData.error || 'Failed to check subscription status');
          }
          
          const data = await response.json();
          console.log('Subscription status response:', data);

          // Update isPremium based on both premium and trial status
          const newPremiumStatus = data.status === 'premium' || data.status === 'trial';
          setIsPremium(newPremiumStatus);
          
          await logEvent('subscription_check_success', {
            userEmail: user.email,
            status: data.status,
            isPremium: newPremiumStatus,
            dailySwipes: usageCount
          });
          
          // If user is premium/trial, reset usage count
          if (data.status === 'premium' || data.status === 'trial') {
            setUsageCount(0);
            setShowUpgradePopup(false); // Ensure upgrade popup is hidden
          }
        } catch (error) {
          await logEvent('subscription_check_error', {
            userEmail: user.email,
            error: error instanceof Error ? error.message : 'Unknown error',
            currentStatus: {
              isPremium,
              usageCount
            }
          });
          console.error('Error checking subscription status:', error);
          // Don't change isPremium status on error - keep the current state
        }
      } else {
        await logEvent('subscription_check_skip', {
          reason: !isSignedIn ? 'not_signed_in' : 'no_email',
          timestamp: new Date().toISOString()
        });
      }
    };

    checkSubscriptionStatus();
  }, [isSignedIn, user, usageCount, isPremium]);

  // Add handleCheckout function
  const handleCheckout = async () => {
    try {
      await logEvent('checkout_attempt', {
        userEmail: user?.email,
        isSignedIn
      });

      if (!isSignedIn || !user?.email) {
        setUsageCount(ANONYMOUS_USAGE_LIMIT + 1);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userEmail: user.email.toLowerCase().trim()
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 400 && data.error?.includes('Trial period')) {
          await logEvent('checkout_trial_error', {
            error: data.error
          });
          alert('You have already used your trial period.');
          return;
        }
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        await logEvent('checkout_redirect', {
          url: data.url
        });
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      await logEvent('checkout_error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error('Checkout error:', error);
      alert('Error starting checkout. Please try again.');
    }
  };

  // Add handleFileUpload function
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      logEvent('file_upload', {
        fileSize: file.size,
        fileType: file.type
      });
      
      setCompletedSteps({
        upload: false,
        stage: false,
        preview: false
      });
      setMode(null);
      setIsOnPreview(false);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setInputMode('screenshot');
      setContext('');
      setLastText('');
      setCompletedSteps(prev => ({ ...prev, upload: true }));
    }
  };

  // Update text input toggle
  const handleTextInputToggle = () => {
    const newState = !showTextInput;
    logEvent('text_input_toggle', {
      showTextInput: newState,
      hasContext: !!context,
      hasLastText: !!lastText
    });
    setShowTextInput(newState);
  };

  // Update handleTextInputChange
  const handleTextInputChange = (field: 'context' | 'lastText', value: string) => {
    if (field === 'context') {
      setContext(value);
      if (value && lastText) {
        logEvent('text_input_complete', {
          field,
          hasContext: true,
          hasLastText: true
        });
      }
    } else if (field === 'lastText') {
      setLastText(value);
      if (context && value) {
        logEvent('text_input_complete', {
          field,
          hasContext: true,
          hasLastText: true
        });
      }
    }
  };

  // Add textInputSection component
  const textInputSection = (
    <div className="mt-4 transition-all duration-300">
      <button
        onClick={handleTextInputToggle}
        className="w-full text-gray-600 py-2 flex items-center justify-center gap-2 hover:text-gray-900"
      >
        <span>{showTextInput ? "Hide" : "Use"} text input option</span>
        <svg
          className={`w-4 h-4 transform transition-transform ${showTextInput ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {showTextInput && (
        <div className="space-y-4 mt-4 p-4 border-2 border-dashed border-gray-300 rounded-xl">
          <div className="bg-yellow-50 p-3 rounded-lg mb-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Both fields below are required when using text input.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Conversation Context <span className="text-red-500">*</span>
            </label>
            <textarea
              value={context}
              onChange={(e) => handleTextInputChange('context', e.target.value)}
              className={`w-full p-2 border rounded-md transition-colors ${
                showTextInput && !context ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Describe things to help context. Inside jokes, where you met, things they like etc..."
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Their Last Message <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={lastText}
              onChange={(e) => handleTextInputChange('lastText', e.target.value)}
              className={`w-full p-2 border rounded-md transition-colors ${
                showTextInput && !lastText ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="What was their last message?"
            />
          </div>

          {showTextInput && (!context || !lastText) && (
            <p className="text-sm text-gray-500 italic">
              Fill out both fields above to proceed
            </p>
          )}
        </div>
      )}
    </div>
  );

  // Move DynamicFooterButton inside Home component
  const DynamicFooterButton = () => {
    const scrollToSection = (id: string) => {
      const element = document.querySelector(id);
      if (element) {
        const offset = 80;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        
        logEvent('section_scroll', {
          targetSection: id,
          currentStep: Object.entries(completedSteps)
            .filter(([_, completed]) => completed)
            .length
        });
        
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
        
        if (id === "#step-3") {
          setIsOnPreview(true);
        }
      }
    };

    // If OpenAI is generating, show loading state regardless of current step
    if (isGenerating) {
      return (
        <button
          disabled
          className="w-full px-6 py-3.5 rounded-full text-white font-medium shadow-lg bg-gray-400 opacity-50 cursor-not-allowed"
        >
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Generating Responses...</span>
          </div>
        </button>
      );
    }

    // Show generate responses button when on preview section
    if (completedSteps.upload && completedSteps.stage && completedSteps.preview && isOnPreview) {
      return (
        <button
          onClick={handleSubmit}
          disabled={isLoading || (!selectedFile && (!context || !lastText))}
          className={`w-full px-6 py-3.5 rounded-full text-white font-medium shadow-lg transition-all 
            ${isLoading 
              ? 'bg-gray-400' 
              : 'hover:scale-[1.02] bg-gradient-to-r from-pink-500 to-rose-500 animate-pulse-scale'} 
            disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Generating Responses...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span>Generate Responses</span>
              <span className="text-lg">✨</span>
            </div>
          )}
        </button>
      );
    }

    // All steps completed but not on preview, show preview button
    if (completedSteps.upload && completedSteps.stage && completedSteps.preview) {
      return (
        <button
          onClick={() => scrollToSection("#step-3")}
          className="w-full px-6 py-3.5 rounded-full text-white font-medium shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-r from-pink-500 to-rose-500 animate-pulse-scale"
        >
          See Preview →
        </button>
      );
    }

    if (!completedSteps.upload) {
      const textInputActive = showTextInput && (context || lastText);
      return (
        <button
          onClick={() => scrollToSection("#step-1")}
          className="w-full px-6 py-3.5 rounded-full text-white font-medium shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-r from-pink-500 to-rose-500 animate-pulse-scale"
        >
          {textInputActive ? "Add More Context →" : "Upload Your Screenshot →"}
        </button>
      );
    }
    
    if (!completedSteps.stage) {
      return (
        <button
          onClick={() => scrollToSection("#step-2")}
          disabled={!canAccessStep(2)}
          className={`w-full px-6 py-3.5 rounded-full text-white font-medium shadow-lg transition-all hover:scale-[1.02] 
            ${canAccessStep(2) 
              ? "bg-gradient-to-r from-pink-500 to-rose-500 animate-pulse-scale" 
              : "bg-gradient-to-r from-gray-400 to-gray-500 opacity-50 cursor-not-allowed hover:scale-100"}`}
        >
          Choose Your Context →
        </button>
      );
    }
    
    if (!completedSteps.preview) {
      return (
        <button
          onClick={() => scrollToSection("#step-3")}
          disabled={!canAccessStep(3)}
          className={`w-full px-6 py-3.5 rounded-full text-white font-medium shadow-lg transition-all hover:scale-[1.02] 
            ${canAccessStep(3)
              ? "bg-gradient-to-r from-pink-500 to-rose-500 animate-pulse-scale"
              : "bg-gradient-to-r from-gray-400 to-gray-500 opacity-50 cursor-not-allowed hover:scale-100"}`}
        >
          Preview Your Message →
        </button>
      );
    }
  };

  // Add this near the other useEffect hooks
  useEffect(() => {
    // Check if this is the first load
    const isFirstLoad = sessionStorage.getItem('hasLoadedBefore') !== 'true';
    
    if (isFirstLoad) {
      console.log('First page load detected, refreshing page...', {
        timestamp: new Date().toISOString(),
        pathname: window.location.pathname,
        userAgent: window.navigator.userAgent
      });
      
      // Mark that we've loaded before
      sessionStorage.setItem('hasLoadedBefore', 'true');
      
      // Refresh the page
      window.location.reload();
    }
  }, []); // Empty dependency array means this runs once on mount

  return (
    <>
      <Script id="global-styles" strategy="beforeInteractive">
        {`
          .swipe {
            position: absolute;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .card {
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            transition: transform 0.2s ease;
            cursor: grab;
          }

          .card:active {
            cursor: grabbing;
          }

          .card-content {
            font-size: 1rem;
            line-height: 1.5;
            text-align: center;
            font-weight: 500;
            color: #1a1a1a;
            padding: 1rem 1.25rem;
            margin: 0 auto;
            width: 90%;
          }

          @media (min-width: 640px) {
            .card-content {
              font-size: 1.125rem;
              padding: 1.25rem 1.5rem;
            }
          }

          @media (min-width: 768px) {
            .card-content {
              font-size: 1.25rem;
              padding: 1.5rem 1.75rem;
            }
          }

          .swipe-indicator {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            padding: 0.5rem;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 0.75rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
          }

          .swipe-indicator.left {
            left: 0.75rem;
          }

          .swipe-indicator.right {
            right: 0.75rem;
          }

          .swipe-indicator .icon {
            font-size: 1rem;
            margin-bottom: 0.25rem;
          }

          .swipe-indicator .text {
            font-size: 0.75rem;
            font-weight: 500;
            color: #666;
          }

          .card:hover .swipe-indicator {
            opacity: 0.9;
          }

          .card-number {
            position: absolute;
            bottom: 0.5rem;
            right: 0.5rem;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            color: #666;
          }

          @keyframes pulse-scale {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.03);
            }
          }

          .animate-pulse-scale {
            animation: pulse-scale 3s ease-in-out infinite;
          }

          @keyframes pulse-fade {
            0%, 100% {
              opacity: 1;
              transform: scale(1.2);
            }
            50% {
              opacity: 0.4;
              transform: scale(1);
            }
          }

          .animate-pulse-fade {
            animation: pulse-fade 1.2s ease-in-out infinite;
            text-shadow: 0 0 20px rgba(254, 60, 114, 0.7),
                         0 0 40px rgba(254, 60, 114, 0.4);
          }
        `}
      </Script>

      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" />
        <link rel="preconnect" href="https://accounts.google.com" />
        <link rel="alternate" hrefLang="en" href="https://www.smoothrizz.com" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        <title>SmoothRizz - AI Dating Response Generator | Get More Matches</title>
        <meta
          name="description"
          content="Generate witty, personalized dating app responses with SmoothRizz AI. Improve your match rate and stand out from the crowd with smart conversation starters."
        />
        <meta name="keywords" content="ai rizz, dating app responses, AI dating assistant, conversation starter, digital dating help, dating message generator, smooth talker ai" />
        <meta name="robots" content="index, follow" />
        <link 
          rel="canonical" 
          href={`https://smoothrizz.com${pathname}`} 
        />

        <meta property="og:title" content="SmoothRizz - AI-Powered Dating Response Generator | Master Digital Charisma" />
        <meta
          property="og:description"
          content="Transform your dating game with SmoothRizz's AI-powered response generator. Get personalized, witty responses for dating apps and boost your success rate. Try it now!"
        />
        <meta property="og:url" content="https://smoothrizz.com" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://smoothrizz.com/og-image.jpg" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SmoothRizz - AI-Powered Dating Response Generator | Master Digital Charisma" />
        <meta
          name="twitter:description"
          content="Transform your dating game with SmoothRizz's AI-powered response generator. Get personalized, witty responses for dating apps and boost your success rate. Try it now!"
        />
        <meta name="twitter:image" content="https://smoothrizz.com/og-image.jpg" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "SmoothRizz",
              "url": "https://www.smoothrizz.com",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://www.smoothrizz.com/search?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "What is AI Rizz?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "AI Rizz is our innovative artificial intelligence solution designed to enhance digital communication by providing smart suggestions and insights."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How does the AI Rizz App work?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "The AI Rizz App uses advanced algorithms to analyze conversations and provide tailored suggestions that help improve your interaction style."
                  }
                }
              ]
            }),
          }}
        />
      </Head>

      <Script
        id="google-tag-manager"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-KMCKVJ4H');
          `
        }}
      />

      <div className="min-h-screen bg-[#fbfbfb]">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-KMCKVJ4H"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>

        {/* Header */}
        <div className="flex justify-between items-center p-3 sm:p-4 bg-white/95 backdrop-blur-sm border-b border-pink-100">
          <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-500 to-rose-600 bg-clip-text text-transparent">
            SmoothRizz
          </div>
          <div className="scale-78 origin-right sm:scale-100">
            {!isSignedIn && <div ref={googleButtonRef} className="!min-w-[120px]"></div>}
            {isSignedIn && (
              <Link
                href="/saved"
                className="px-4 py-2 rounded-full text-white text-sm font-medium bg-gray-900 hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2"
                onClick={async (e) => {
                  try {
                    // Log the navigation attempt
                    await logEvent('dashboard_navigation_attempt', {
                      timestamp: new Date().toISOString(),
                      userEmail: user?.email,
                      pathname: window.location.pathname,
                      isPremium: isPremium,
                      dailySwipes: usageCount,
                      currentStep: Object.entries(completedSteps)
                        .filter(([_, completed]) => completed)
                        .length,
                      completedSteps,
                      mode,
                      hasFile: !!selectedFile,
                      hasTextInput: showTextInput,
                      hasContext: !!context,
                      hasLastText: !!lastText,
                      userAgent: window.navigator.userAgent
                    });
                    
                    // Let the navigation proceed normally
                  } catch (error) {
                    // Log the error
                    await logEvent('dashboard_navigation_error', {
                      error: error instanceof Error ? error.message : 'Unknown error',
                      userEmail: user?.email,
                      pathname: window.location.pathname,
                      timestamp: new Date().toISOString()
                    });
                    
                    // Prevent default navigation if logging fails
                    e.preventDefault();
                    console.error('Error during dashboard navigation:', error);
                    alert('There was an error navigating to the dashboard. Please try again.');
                  }
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
                Dashboard
              </Link>
            )}
          </div>
        </div>

        {/* Promo Banner */}
        <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 text-white py-1.5 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center justify-center gap-1.5">
                <span className="bg-yellow-400 text-yellow-800 text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full">NEW</span>
                <p className="text-xs sm:text-sm font-medium">
                  3x faster learning and unlimited swipes with free 3 day trial!
                </p>
              </div>
              <button
                onClick={handleCheckout}
                className="text-[10px] sm:text-xs bg-white text-pink-600 px-2.5 py-0.5 rounded-full font-medium hover:bg-pink-50 transition-colors whitespace-nowrap"
              >
                Try Free
              </button>
            </div>
          </div>
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/4 w-0.5 h-0.5 bg-white rounded-full opacity-75 animate-ping"></div>
            <div className="absolute top-1/3 right-1/3 w-0.5 h-0.5 bg-white rounded-full opacity-75 animate-ping delay-300"></div>
            <div className="absolute bottom-1/2 right-1/4 w-0.5 h-0.5 bg-white rounded-full opacity-75 animate-ping delay-700"></div>
          </div>
        </div>

        <main className="px-4 md:px-6 lg:px-8 max-w-7xl mx-auto pb-24">
          {/* Hero Section */}
          <section className="text-center mb-12 sm:mb-16 px-4 sm:px-0 pt-8 sm:pt-12">
            <h1 className="text-5xl sm:text-6xl md:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
              Never Send a <span className="bg-gradient-to-r from-pink-500 to-rose-600 bg-clip-text text-transparent italic">Boring</span> Text Again.
            </h1>
            <p className="text-xl sm:text-1xl text-gray-600 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
              <span className="bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Know Exactly What to Say, When It Matters Most.
              </span>
            </p>
            <div className="relative max-w-[100%] sm:max-w-lg md:max-w-md mx-auto">
              <img
                src="/bigmainpic.png"
                alt="App demonstration"
                className="w-full rounded-2xl"
                loading="lazy"
              />
              <div className="w-full h-px bg-gradient-to-r from-transparent via-pink-200 to-transparent my-8 sm:my-10" />
              <img
                src="/creds.png"
                alt="Trust indicators and credentials"
                className="w-full max-w-[95%] mx-auto"
                loading="lazy"
              />
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/90 text-white/90 text-sm shadow-lg">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span id="online-users">12 users online</span>
              </div>
            </div>
          </section>

          {/* Steps Section */}
          <section className="space-y-12 sm:space-y-16 px-4 sm:px-0 max-w-3xl mx-auto">
            {/* Step 1 - Upload */}
            <div id="step-1" className="bg-white rounded-xl shadow-lg border border-gray-100 transform transition-all hover:scale-[1.01] hover:shadow-xl">
              <div className="p-4 sm:p-5 border-b border-gray-100 bg-gradient-to-r from-pink-50 to-rose-50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-pink-100 flex items-center justify-center">
                    <span className="text-xl font-semibold text-pink-500">1</span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Share Your Conversation</h2>
                </div>
              </div>
              
              <div className="p-4 sm:p-6">
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 bg-gray-50/50 relative hover:border-pink-200 transition-colors">
                  {completedSteps.upload ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex items-center justify-center gap-3">
                        <div className="bg-green-50 p-2 rounded-full">
                          <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-green-600 font-medium">Upload Complete!</p>
                      </div>
                      
                      <label className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer text-gray-700 text-sm">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setSelectedFile(e.target.files[0]);
                              setPreviewUrl(URL.createObjectURL(e.target.files[0]));
                              setInputMode('screenshot');
                              setMode(null);
                              setIsOnPreview(false);
                              setContext('');
                              setLastText('');
                              setCompletedSteps({
                                upload: true,
                                stage: false,
                                preview: false
                              });
                            }
                          }} 
                          className="hidden" 
                        />
                        <Upload size={16} />
                        Upload New Screenshot
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-3 cursor-pointer">
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                      <Upload className="text-pink-500" size={28} />
                      <div className="text-center">
                        <p className="text-gray-700 font-medium mb-1">
                          Upload Conversation Screenshot!
                        </p>
                        <p className="text-gray-500 text-sm">
                          Press This or Ctrl+V to paste
                        </p>
                      </div>
                    </label>
                  )}
                </div>
                {textInputSection}
              </div>
            </div>

            {/* Step 2 - Stage Selection */}
            <div id="step-2" className="bg-white rounded-xl shadow-lg border border-gray-100 transform transition-all hover:scale-[1.01] hover:shadow-xl">
              <div className="p-4 sm:p-5 border-b border-gray-100 bg-gradient-to-r from-pink-50 to-rose-50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-pink-100 flex items-center justify-center">
                    <span className="text-xl font-semibold text-pink-500">2</span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Choose Your Context</h2>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { name: "First Move", desc: "Nail that opener", emoji: "👋" },
                    { name: "Mid-Game", desc: "Keep it flowing", emoji: "💭" },
                    { name: "End Game", desc: "Bring it home", emoji: "🎯" },
                  ].map((phase: Phase) => {
                    const isSelected = mode === phase.name.toLowerCase().replace(" ", "-");
                    return (
                      <button
                        key={phase.name}
                        className={`flex items-center gap-3 p-4 rounded-xl transition-all ${
                          isSelected 
                            ? "bg-pink-50 border-2 border-pink-200" 
                            : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                        }`}
                        onClick={() => handleModeSelection(phase.name.toLowerCase().replace(" ", "-"))}
                      >
                        <span className="text-2xl">{phase.emoji}</span>
                        <div className="text-left">
                          <div className="font-medium">{phase.name}</div>
                          <div className="text-sm text-gray-500">{phase.desc}</div>
                        </div>
                        {isSelected && (
                          <div className="ml-auto">
                            <svg className="w-6 h-6 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Step 3 - Preview */}
            <div id="step-3" className="bg-white rounded-xl shadow-lg border border-gray-100 transform transition-all hover:scale-[1.01] hover:shadow-xl">
              <div className="p-4 sm:p-5 border-b border-gray-100 bg-gradient-to-r from-pink-50 to-rose-50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-pink-100 flex items-center justify-center">
                    <span className="text-xl font-semibold text-pink-500">3</span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Preview</h2>
                </div>
              </div>

              <div className="p-4">
                <div className="w-full max-w-lg mx-auto min-h-[200px] sm:min-h-[300px] bg-gray-100 rounded-xl p-4">
                  {inputMode === 'screenshot' && previewUrl ? (
                    <img 
                      src={previewUrl} 
                      alt="Preview of uploaded conversation" 
                      className="w-full max-h-[400px] object-contain rounded-xl" 
                      loading="lazy" 
                    />
                  ) : inputMode === 'text' && (context || lastText) ? (
                    <div className="space-y-4">
                      {context && (
                        <div className="text-sm text-gray-500 italic mb-4">
                          Context: {context}
                        </div>
                      )}
                      {lastText && (
                        <div className="flex justify-start">
                          <div 
                            className="bg-gray-200 rounded-2xl p-4 text-gray-800 max-w-[85%] relative"
                          >
                            {lastText}
                            <div 
                              className="absolute -left-2 bottom-[45%] w-4 h-4 transform rotate-45 bg-gray-200"
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">
                      Your conversation will appear here
                    </div> 
                  )}
                </div>
              </div>
            </div>
          </section>
          
          <div className="border-t border-gray-200 my-16"></div>

          {/* SEO Section */}
          <section className="mt-16 sm:mt-24 px-4 sm:px-0 mb-24 sm:mb-16">
            <div className="max-w-4xl mx-auto">
              <div className="bg-gradient-to-br from-pink-50/80 via-white to-rose-50/80 rounded-xl shadow-sm overflow-hidden border border-pink-100">
                <div className="p-6 sm:p-8">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                    Learn From Our Experts
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-8">
                    <Link 
                      href="/blog/how-to-rizz-techniques-that-actually-work"
                      className="group block overflow-hidden rounded-xl hover:shadow-lg transition-shadow bg-white"
                    >
                      <div className="relative w-full h-48">
                        <Image
                          src="/pics/thumbs-up.png"
                          alt="Modern messaging techniques guide"
                          fill
                          className="object-cover transform group-hover:scale-105 transition-transform duration-300"
                          priority
                        />
                      </div>
                      <div className="p-4 bg-gradient-to-r from-pink-50/50 to-rose-50/50">
                        <h3 className="font-semibold text-lg group-hover:text-pink-500 transition-colors">
                          How to Rizz: Techniques That You Can Use in 2025
                        </h3>
                        <p className="text-gray-600 mt-2 text-sm">
                          Learn proven techniques to improve your messaging game and build better connections.
                        </p>
                      </div>
                    </Link>

                    <Link 
                      href="/blog/best-rizz-lines-100-plus-examples-that-actually-work"
                      className="group block overflow-hidden rounded-xl hover:shadow-lg transition-shadow bg-white"
                    >
                      <div className="relative w-full h-48">
                        <Image
                          src="/pics/percent100.png"
                          alt="Best rizz lines guide"
                          fill
                          className="object-cover transform group-hover:scale-105 transition-transform duration-300"
                          priority
                        />
                      </div>
                      <div className="p-4 bg-gradient-to-r from-pink-50/50 to-rose-50/50">
                        <h3 className="font-semibold text-lg group-hover:text-pink-500 transition-colors">
                          Best Rizz Lines: 100+ Examples That Work
                        </h3>
                        <p className="text-gray-600 mt-2 text-sm">
                          Rizz Pick up Lines That Work in 2025
                        </p>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <footer className="text-center pb-8">
            <div className="max-w-4xl mx-auto px-4">
              <a href="/privacy-policy" className="px-4 py-2 rounded-full text-gray-600 hover:text-gray-900 transition text-sm md:text-base">
                Privacy Policy
              </a>
              <p className="text-gray-500 text-sm">
                © 2025 Smooth Rizz. All rights reserved.
              </p>
            </div>
          </footer>

          {/* Dynamic Footer */}
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-pink-100 p-4 z-40">
            <div className="max-w-3xl mx-auto">
              <DynamicFooterButton />
            </div>
          </div>

          {/* Add the upgrade popup */}
          {showUpgradePopup && !isPremium && (
            <UpgradePopup 
              onClose={() => setShowUpgradePopup(false)} 
              handleCheckout={handleCheckout}
            />
          )}

          {/* Google Sign-In Overlay */}
          {!isSignedIn && usageCount >= ANONYMOUS_USAGE_LIMIT && (
            <GoogleSignInOverlay googleLoaded={googleLoaded} />
          )}
        </main>
      </div>
    </>
  );
} 