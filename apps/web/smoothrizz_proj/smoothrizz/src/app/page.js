"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Head from "next/head";
import { Upload } from "lucide-react";
import Script from "next/script";
import { loadStripe } from '@stripe/stripe-js';
import { ANONYMOUS_USAGE_LIMIT, FREE_USER_DAILY_LIMIT } from './constants';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { UpgradePopup } from './components/UpgradePopup';
import { analyzeScreenshot } from './openai';
import { convertFileToBase64 } from '@/utils/usageTracking';

// Make sure to call `loadStripe` outside of a component's render
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// Overlay component for Google Sign-In (unchanged)
function GoogleSignInOverlay({ googleLoaded }) {
  const overlayButtonRef = useRef(null);

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

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOnPreview, setIsOnPreview] = useState(false);
  const [mode, setMode] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [usageCount, setUsageCount] = useState(0);
  const [dailyCount, setDailyCount] = useState(0);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const googleButtonRef = useRef(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [context, setContext] = useState('');
  const [lastText, setLastText] = useState('');
  const [inputMode, setInputMode] = useState('screenshot');
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [lastDirection, setLastDirection] = useState();
  const currentIndexRef = useRef(currentIndex);
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const router = useRouter();

  // Add this state for tracking steps
  const [completedSteps, setCompletedSteps] = useState({
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

  // Single useEffect for initialization and auth state changes
  useEffect(() => {
    // Add version check to force sign out
    /* const CURRENT_VERSION = '2.1'; // Increment this to force sign out
    const storedVersion = localStorage.getItem('app_version');
    
    if (storedVersion !== CURRENT_VERSION) {
      // Clear all auth data
      localStorage.removeItem('smoothrizz_user');
      localStorage.removeItem('anonymous_saved_responses');
      
      // Sign out of Google
      if (window.google?.accounts?.id) {
        window.google.accounts.id.disableAutoSelect();
        window.google.accounts.id.revoke();
      }
      
      // Store new version
      localStorage.setItem('app_version', CURRENT_VERSION);
      // Force refresh to ensure clean state
      window.location.reload();
      return;
    } */

    // Rest of your existing initialization code
    const storedUser = localStorage.getItem('smoothrizz_user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsSignedIn(true);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('smoothrizz_user');
      }
    }

    // Initialize Google Sign-In
    const initializeGoogleSignIn = async () => {
      if (!document.getElementById("google-client-script")) {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.id = "google-client-script";
        script.onload = async () => {
          try {
            const res = await fetch("/api/auth/google-client-id");
            const { clientId } = await res.json();
            window.google.accounts.id.initialize({
              client_id: clientId,
              callback: handleSignIn,
              auto_select: !isSignedIn,
            });
            if (googleButtonRef.current) {
              window.google.accounts.id.renderButton(googleButtonRef.current, {
                theme: "outline",
                size: "large",
              });
            }
            setGoogleLoaded(true);
          } catch (err) {
            console.error("Error initializing Google Sign-In:", err);
          }
        };
        document.body.appendChild(script);
      }
    };

    initializeGoogleSignIn();
  }, []); // Empty dependency array as this should only run once on mount

  // Single useEffect for fetching user data
  useEffect(() => {
    fetchUserData();
  }, [fetchUserData, isSignedIn]); // Only re-run when auth state changes

  // Update the handleSignIn function
  const handleSignIn = async (response) => {
    try {
      const { credential } = response;
      
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential }),
      });

      const data = await res.json();
      
      if (res.ok) {
        setUser(data.user);
        setIsSignedIn(true);
        localStorage.setItem('smoothrizz_user', JSON.stringify(data.user));

        // Migrate anonymous saved responses if any
        const savedResponses = JSON.parse(localStorage.getItem('anonymous_saved_responses') || '[]');
        if (savedResponses.length > 0) {
          await Promise.all(
            savedResponses.map(async (item) => {
              await fetch('/api/saved-responses', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  response: item.response,
                  userEmail: data.user.email,
                  context: item.context,
                  lastMessage: item.lastMessage,
                  created_at: item.created_at,
                }),
              });
            })
          );
          localStorage.removeItem('anonymous_saved_responses');
        }
      } else {
        throw new Error(data.error || 'Failed to sign in');
      }
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  // Update the handleSignOut function
  const handleSignOut = async () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
      window.google.accounts.id.revoke();
    }
    
    setUser(null);
    setIsSignedIn(false);
    setResponses([]);
    
    setUsageCount(0);
    setDailyCount(0);
    
    localStorage.removeItem('smoothrizz_user');

    // Re-initialize Google Sign-In button
    if (googleButtonRef.current) {
      fetch("/api/auth/google-client-id")
        .then((res) => res.json())
        .then(({ clientId }) => {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleSignIn,
            auto_select: false,
          });
          googleButtonRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(googleButtonRef.current, {
            theme: "outline",
            size: "large",
          });
        })
        .catch((err) => console.error("Error reinitializing Google Sign-In:", err));
    }
  };

  // Add this function to handle file upload with feedback
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Reset states first
      setCompletedSteps({
        upload: false,
        stage: false,
        preview: false
      });
      setMode(null);
      setIsOnPreview(false);
      
      // Then set the new file
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setInputMode('screenshot');
      setContext('');
      setLastText('');
      
      // Set upload step as completed after new file is set
      setCompletedSteps(prev => ({ ...prev, upload: true }));
    }
  };

  // Update handlePaste similarly
  const handlePaste = (event) => {
    const items = event.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          setSelectedFile(file);
          setPreviewUrl(URL.createObjectURL(file));
          setInputMode('screenshot');
          setContext('');
          setLastText('');
          setCompletedSteps(prev => ({ ...prev, upload: true }));
          break;
        }
      }
    }
  };

  const handleTextInputChange = (type, value) => {
    if (type === 'context') {
      setContext(value);
    } else {
      setLastText(value);
    }
    
    if (value) {
      setInputMode('text');
      setSelectedFile(null);
      setPreviewUrl(null);
      // Set upload step as completed if either context or lastText has content
      setCompletedSteps(prev => ({
        ...prev,
        upload: !!(type === 'context' ? value || lastText : value || context)
      }));
    } else {
      // If both inputs are empty, mark upload as incomplete
      const otherFieldEmpty = type === 'context' ? !lastText : !context;
      if (otherFieldEmpty) {
        setCompletedSteps(prev => ({
          ...prev,
          upload: false
        }));
      }
    }
  };

  // Update the handleSubmit function
  const handleSubmit = async () => {
    console.log('Starting handleSubmit with:', {
      hasFile: !!selectedFile,
      hasContext: !!context,
      hasLastText: !!lastText,
      mode,
      isSignedIn,
      userEmail: user?.email
    });

    if (!selectedFile && (!context || !lastText)) {
      console.warn('Missing required input');
      alert("Please select a screenshot or provide text input");
      return;
    }

    try {
      setIsGenerating(true);
      console.log('Clearing existing responses from localStorage');
      localStorage.removeItem('current_responses');
      
      // Check usage status before proceeding
      console.log('Checking usage status...');
      const statusResponse = await fetch('/api/usage', {
        headers: {
          'Content-Type': 'application/json',
          ...(isSignedIn && user?.email && { 'x-user-email': user.email }),
        },
      });
      
      const statusData = await statusResponse.json();
      console.log('Usage status:', statusData);
      
      // For anonymous users at limit, show sign in overlay
      if (!isSignedIn && statusData.dailySwipes >= ANONYMOUS_USAGE_LIMIT) {
        console.log('Anonymous user reached limit');
        setUsageCount(ANONYMOUS_USAGE_LIMIT);
        setShowSignInOverlay(true);
        return;
      }
      
      // For signed-in users at limit, show upgrade popup
      if (isSignedIn && !statusData.isPremium && statusData.dailySwipes >= FREE_USER_DAILY_LIMIT) {
        console.log('Free user reached limit');
        setShowUpgradePopup(true);
        return;
      }

      setIsLoading(true);
      
      console.log('Generating responses...');
      // Generate responses using OpenAI
      const responses = await analyzeScreenshot(
        selectedFile,
        mode,
        isSignedIn,
        context,
        lastText
      );

      console.log('Received responses:', {
        responseCount: responses?.length,
        isArray: Array.isArray(responses),
        firstResponse: responses?.[0]?.slice(0, 50) + '...' // First 50 chars of first response
      });

      // Validate responses
      if (!Array.isArray(responses) || responses.length === 0) {
        console.error('Invalid response format:', responses);
        throw new Error('Invalid response format received');
      }

      // Save new responses with error handling
      try {
        console.log('Preparing response data for storage');
        const responseData = {
          responses,
          currentIndex: responses.length - 1,
          mode,
          lastContext: context,
          lastText,
          inputMode: selectedFile ? 'screenshot' : 'text',
          timestamp: Date.now()
        };

        if (selectedFile) {
          console.log('Converting file to base64...');
          const base64File = await convertFileToBase64(selectedFile);
          responseData.lastFile = base64File;
          console.log('File conversion successful');
        }

        console.log('Saving to localStorage:', {
          responseCount: responseData.responses.length,
          mode: responseData.mode,
          hasFile: !!responseData.lastFile,
          timestamp: responseData.timestamp
        });

        localStorage.setItem('current_responses', JSON.stringify(responseData));
        console.log('Successfully saved to localStorage');

        // Verify the save was successful
        const savedData = localStorage.getItem('current_responses');
        if (!savedData) {
          throw new Error('Verification failed: Data not found in localStorage after save');
        }

        console.log('Navigating to responses page...');
        router.push('/responses');

      } catch (storageError) {
        console.error('Storage error details:', {
          error: storageError,
          message: storageError.message,
          stack: storageError.stack
        });
        throw new Error('Failed to save responses. Please try again.');
      }

    } catch (error) {
      console.error('Main error details:', {
        error,
        message: error.message,
        stack: error.stack
      });
      
      // More specific error messages
      if (error.message.includes('usage limit')) {
        alert("You've reached your usage limit. Please try again later.");
      } else if (error.message.includes('Invalid response')) {
        alert("Received invalid response from server. Please try again.");
      } else if (error.message.includes('Failed to save')) {
        alert("Failed to save responses. Please try again.");
      } else {
        alert("Error processing input. Please try again.");
      }
      
    } finally {
      console.log('Cleaning up...');
      setIsGenerating(false);
      setIsLoading(false);
    }
  };

  // Add debugging to convertFileToBase64
  const convertFileToBase64 = (file) => {
    console.log('Starting file conversion:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        console.log('File conversion successful');
        resolve(reader.result);
      };
      
      reader.onerror = (error) => {
        console.error('File conversion error:', error);
        reject(error);
      };
      
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // Update the Google Sign-In initialization useEffect
  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (!document.getElementById("google-client-script")) {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.id = "google-client-script";
        script.onload = () => {
          fetch("/api/auth/google-client-id")
            .then((res) => res.json())
            .then(({ clientId }) => {
              window.google.accounts.id.initialize({
                client_id: clientId,
                callback: handleSignIn,
                auto_select: !isSignedIn,
              });
              if (googleButtonRef.current) {
                window.google.accounts.id.renderButton(googleButtonRef.current, {
                  theme: "outline",
                  size: "large",
                });
              }
              setGoogleLoaded(true);
            })
            .catch((err) =>
              console.error("Error fetching Google client ID:", err)
            );
        };
        document.body.appendChild(script);
      } else if (window.google) {
        fetch("/api/auth/google-client-id")
          .then((res) => res.json())
          .then(({ clientId }) => {
            window.google.accounts.id.initialize({
              client_id: clientId,
              callback: handleSignIn,
              auto_select: !isSignedIn,
            });
            if (googleButtonRef.current) {
              window.google.accounts.id.renderButton(googleButtonRef.current, {
                theme: "outline",
                size: "large",
              });
            }
            setGoogleLoaded(true);
          })
          .catch((err) =>
            console.error("Error reinitializing Google Sign-In:", err)
          );
      }
    };

    initializeGoogleSignIn();
  }, [isSignedIn]);

  // Update the handleCheckout function
  const handleCheckout = async () => {
    try {
      if (!isSignedIn || !user?.email) {
        setUsageCount(ANONYMOUS_USAGE_LIMIT + 1);
        return;
      }

      console.log('Starting checkout process for user:', user.email);

      const response = await fetch('/api/checkout_sessions', {
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
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Error starting checkout. Please try again.');
    }
  };

  // Handle redirect back from Stripe
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    
    if (query.get('success')) {
      console.log('Order placed! You will receive an email confirmation.');
      
      // Add Google Ads conversion tracking
      if (typeof window !== 'undefined' && window.gtag) {
        gtag('event', 'conversion', {
          'send_to': 'AW-16615505567/rdXeCPDjlqsaEJ_98fI9'
        });
      }
    }

    if (query.get('canceled')) {
      console.log('Order canceled -- continue to shop around and checkout when you\'re ready.');
    }
  }, []);

  // Conversation preview section (unchanged)
  const conversationPreview = (
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
  );

  // Text input section
  const textInputSection = (
    <div className="mt-4 transition-all duration-300">
      <button
        onClick={() => setShowTextInput(!showTextInput)}
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

  // Add this style definition near the top where other styles are defined
  const styles = `
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
  `;

  // Update mode selection to track completion
  const handleModeSelection = (selectedMode) => {
    setMode(selectedMode);
    setCompletedSteps(prev => ({ ...prev, stage: true }));
  };

  // Update preview completion
  useEffect(() => {
    if (selectedFile || (context && lastText)) {
      setCompletedSteps(prev => ({ ...prev, preview: true }));
    }
  }, [selectedFile, context, lastText]);

  // Add this helper function to check if a step is accessible
  const canAccessStep = (stepNumber) => {
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

  // Update the DynamicFooterButton component
  const DynamicFooterButton = () => {
    const scrollToSection = (id) => {
      const element = document.querySelector(id);
      if (element) {
        const offset = 80;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        
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
        threshold: 0.3, // Trigger when 30% of the element is visible
        rootMargin: '-100px', // Adjust based on your header height
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
          const response = await fetch(`/api/subscription-status?userEmail=${encodeURIComponent(user.email)}`);
          const data = await response.json();
          
          // Update isPremium based on both premium and trial status
          setIsPremium(data.status === 'premium' || data.status === 'trial');
          
          // If user is premium/trial, reset usage count
          if (data.status === 'premium' || data.status === 'trial') {
            setUsageCount(0);
            setShowUpgradePopup(false); // Ensure upgrade popup is hidden
          }
        } catch (error) {
          console.error('Error checking subscription status:', error);
          setIsPremium(false);
        }
      }
    };

    checkSubscriptionStatus();
  }, [isSignedIn, user]);

  return (
    <>
      <style jsx global>{styles}</style>

      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* Preconnect for performance */}
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" />
        <link rel="preconnect" href="https://accounts.google.com" />
        {/* Alternate/Hreflang */}
        <link rel="alternate" hrefLang="en" href="https://www.smoothrizz.com" />
        {/* Apple Touch Icon */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Updated SEO Meta Tags */}
        <title>SmoothRizz - AI Dating Response Generator | Get More Matches</title>
        <meta
          name="description"
          content="Generate witty, personalized dating app responses with SmoothRizz AI. Improve your match rate and stand out from the crowd with smart conversation starters."
        />
        <meta name="keywords" content="ai rizz, dating app responses, AI dating assistant, conversation starter, digital dating help, dating message generator, smooth talker ai" />
        <meta name="robots" content="index, follow" />
        <link 
          rel="canonical" 
          href={`https://smoothrizz.com${router.asPath}`} 
        />

        <meta property="og:title" content="SmoothRizz - AI-Powered Dating Response Generator | Master Digital Charisma" />
        <meta
          property="og:description"
          content="Transform your dating game with SmoothRizz's AI-powered response generator. Get personalized, witty responses for dating apps and boost your success rate. Try it now!"
        />
        <meta property="og:url" content="https://www.smoothrizz.com" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://www.smoothrizz.com/og-image.jpg" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SmoothRizz - AI-Powered Dating Response Generator | Master Digital Charisma" />
        <meta
          name="twitter:description"
          content="Transform your dating game with SmoothRizz's AI-powered response generator. Get personalized, witty responses for dating apps and boost your success rate. Try it now!"
        />
        <meta name="twitter:image" content="https://www.smoothrizz.com/og-image.jpg" />

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

        {/* Header - Professional & Responsive */}
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
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
                Dashboard
              </Link>
            )}
          </div>
        </div>

        {/* Add this right after the header, before the main content */}
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
          {/* Smaller sparkle effects */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/4 w-0.5 h-0.5 bg-white rounded-full opacity-75 animate-ping"></div>
            <div className="absolute top-1/3 right-1/3 w-0.5 h-0.5 bg-white rounded-full opacity-75 animate-ping delay-300"></div>
            <div className="absolute bottom-1/2 right-1/4 w-0.5 h-0.5 bg-white rounded-full opacity-75 animate-ping delay-700"></div>
          </div>
        </div>

        <main className="px-4 md:px-6 lg:px-8 max-w-7xl mx-auto pb-24">
          {/* Hero Section - Enhanced */}
          <section className="text-center mb-12 sm:mb-16 px-4 sm:px-0 pt-8 sm:pt-12">
            <h1 className="text-5xl sm:text-6xl md:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
              Never Send a <span className="bg-gradient-to-r from-pink-500 to-rose-600 bg-clip-text text-transparent italic">Boring</span> Text Again.
            </h1>
            <p className="text-xl sm:text-1xl text-gray-600 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
              <span className=" bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
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

          {/* Steps Section - Professional Cards */}
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
                      
                      {/* Add new upload button */}
                      <label className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer text-gray-700 text-sm">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            // Handle file upload first
                            if (e.target.files[0]) {
                              setSelectedFile(e.target.files[0]);
                              setPreviewUrl(URL.createObjectURL(e.target.files[0]));
                              setInputMode('screenshot');
                              
                              // Then reset the other states
                              setMode(null);
                              setIsOnPreview(false);
                              setContext('');
                              setLastText('');
                              setCompletedSteps({
                                upload: true, // Keep upload step completed since we have a new file
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
                  ].map((phase) => {
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
                {conversationPreview}
              </div>
            </div>
          </section>
          
          <div className="border-t border-gray-200 my-16"></div>

          {/* SEO Section - Updated with Blog Links */}
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
