"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from 'next/navigation';
import TinderCard from 'react-tinder-card';
import Script from 'next/script';
import {
  ANONYMOUS_USAGE_LIMIT,
  FREE_USER_DAILY_LIMIT,
  FREE_INCREMENT_PER_RESPONSE,
  FREE_MAX_PERCENTAGE,
  MIN_LEARNING_PERCENTAGE
} from '../shared/constants';
import { GoogleSignInOverlay } from '../components/GoogleSignInOverlay';
import { UpgradePopup } from '../components/UpgradePopup';
import { analyzeScreenshot, extractBase64FromDataUrl } from '../openai';

// Add this near the top of the file, after imports
const API_BASE_URL = process.env.NEXT_PUBLIC_RAILWAY_URL || 'https://mono-production-8ef9.up.railway.app';

// Types
interface User {
  email: string;
  name?: string;
  picture?: string;
}

interface LoadingScreenProps {}

interface RegeneratePopupProps {
  onRegenerate: () => void;
  onClose: () => void;
}

interface PhotoPreviewProps {
  imageUrl: string;
  onClose: () => void;
}

interface SwipeDirection {
  direction: 'left' | 'right';
}

interface CardRef {
  current: {
    swipe: (dir: 'left' | 'right') => Promise<void>;
    restoreCard: () => Promise<void>;
  } | null;
}

// Add Direction type for TinderCard
type Direction = 'left' | 'right' | 'up' | 'down';

// Loading screen component
function LoadingScreen({}: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-pink-500/10 via-black/50 to-gray-900/50 backdrop-blur-sm z-[70] flex items-center justify-center">
      <div className="text-white text-center space-y-4">
        <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto"/>
        <p className="text-xl">Generating new responses...</p>
      </div>
    </div>
  );
}

// Update RegeneratePopup to match premium styling
function RegeneratePopup({ onRegenerate, onClose }: RegeneratePopupProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60] p-4">
      <div className="bg-white p-6 rounded-xl w-full max-w-md mx-auto relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl"
        >
          ×
        </button>
        
        <h2 className="text-2xl font-bold mb-4">Generate New Responses</h2>
        <p className="mb-6">
          Would you like to generate new responses?
        </p>
        
        <button
          onClick={onRegenerate}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-lg hover:opacity-90 transition-opacity"
        >
          Generate New Responses
        </button>
      </div>
    </div>
  );
}

// Update PhotoPreview component to handle outside clicks
function PhotoPreview({ imageUrl, onClose }: PhotoPreviewProps) {
  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative bg-white rounded-xl overflow-hidden max-w-md w-full max-h-[80vh]">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-white bg-black/50 rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70 z-10"
        >
          ×
        </button>
        <img 
          src={imageUrl} 
          alt="Uploaded screenshot"
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}

export default function ResponsesPage() {
  const [responses, setResponses] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [mode, setMode] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<string | null>(null);
  const [lastContext, setLastContext] = useState<string>('');
  const [lastText, setLastText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [usageCount, setUsageCount] = useState<number>(0);
  const [showUpgradePopup, setShowUpgradePopup] = useState<boolean>(false);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [googleLoaded, setGoogleLoaded] = useState<boolean>(false);
  const [showRegeneratePopup, setShowRegeneratePopup] = useState<boolean>(false);
  const [lastDirection, setLastDirection] = useState<string>();
  const router = useRouter();

  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const [showSignInOverlay, setShowSignInOverlay] = useState<boolean>(false);

  const [key, setKey] = useState<number>(0);

  // Add new state for premium features
  const [matchPercentage, setMatchPercentage] = useState<number>(0);

  // Add new state for tracking if user can swipe
  const [canInteract, setCanInteract] = useState<boolean>(true);

  const childRefs = useRef<CardRef[]>(
    Array(responses.length)
      .fill(0)
      .map(() => React.createRef())
  );

  // Update initialization effect
  useEffect(() => {
    console.log('Initializing responses page...');
    const savedData = JSON.parse(localStorage.getItem('current_responses') || '{}');
    console.log('Saved data from localStorage:', savedData);
    
    if (savedData.responses?.length > 0) {
      console.log('Found saved responses:', {
        responseCount: savedData.responses.length,
        savedIndex: savedData.currentIndex,
        defaultIndex: savedData.responses.length - 1,
        inputMode: savedData.inputMode
      });
      
      setResponses(savedData.responses);
      const savedIndex = savedData.currentIndex !== undefined ? savedData.currentIndex : savedData.responses.length - 1;
      setCurrentIndex(savedIndex);
      setMode(savedData.mode);
      setLastFile(savedData.lastFile);
      setLastContext(savedData.lastContext);
      setLastText(savedData.lastText);
      
      // Update childRefs to match the number of responses
      childRefs.current = Array(savedData.responses.length)
        .fill(0)
        .map(() => React.createRef());
    } else {
      console.log('No saved responses found, redirecting to home');
      router.push('/');
    }
  }, [router]);

  // Auth status check effect
  useEffect(() => {
    const checkAuth = async () => {
      const savedUser = localStorage.getItem('smoothrizz_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setIsSignedIn(true);
        
        // Check for anonymous saved responses to migrate
        const anonymousResponses = JSON.parse(localStorage.getItem('anonymous_saved_responses') || '[]');
        if (anonymousResponses.length > 0) {
          try {
            // Migrate anonymous responses to user account
            await fetch(`${API_BASE_URL}/api/saved-responses`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                userEmail: parsedUser.email,
                responses: anonymousResponses // Send as bulk migration
              })
            });
            
            // Clear anonymous responses after successful migration
            localStorage.removeItem('anonymous_saved_responses');
          } catch (error) {
            console.error('Error migrating anonymous responses:', error);
          }
        }
      }
    };
    checkAuth();
  }, []); 

  // Usage check effect
  useEffect(() => {
    const checkInitialUsage = async () => {
      try {
        const savedUser = localStorage.getItem('smoothrizz_user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          setIsSignedIn(true);
        }

        const headers = {
          'Content-Type': 'application/json',
          ...(savedUser && { 'x-user-email': JSON.parse(savedUser).email })
        };

        const response = await fetch(`${API_BASE_URL}/api/usage`, { headers });
        const data = await response.json();
        
        setUsageCount(data.dailySwipes || 0);
        setIsPremium(data.isPremium || data.isTrial);
        
        localStorage.setItem('smoothrizz_usage', JSON.stringify({
          dailySwipes: data.dailySwipes,
          isPremium: data.isPremium || data.isTrial
        }));
      } catch (error) {
        console.error('Error checking initial usage:', error);
      }
    };

    checkInitialUsage();
  }, []);

  // Update swiped function to handle local storage and API calls
  const swiped = async (direction: Direction, responseToDelete: string, index: number) => {
    if (!canInteract) return;
    
    // Only handle left/right swipes
    if (direction !== 'left' && direction !== 'right') return;
    
    try {
      // Track swipe first
      const headers = {
        'Content-Type': 'application/json',
        ...(user?.email && { 'x-user-email': user.email })
      };
      
      const response = await fetch(`${API_BASE_URL}/api/swipes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ direction })
      });

      const data = await response.json();
      
      // Handle usage limits
      if (!data.canSwipe) {
        if (data.requiresSignIn) {
          setShowSignInOverlay(true);
          return;
        } else if (data.requiresUpgrade) {
          setShowUpgradePopup(true);
          return;
        }
      }

      // Update usage count from response
      setUsageCount(data.dailySwipes || 0);
      
      // Save response to localStorage if right swipe
      if (direction === 'right') {
        const newResponse = {
          response: responseToDelete,
          context: lastContext,
          lastMessage: lastText,
          created_at: new Date().toISOString()
        };

        // Always save to localStorage for potential migration later
        const savedResponses = JSON.parse(localStorage.getItem('anonymous_saved_responses') || '[]');
        savedResponses.unshift(newResponse);
        localStorage.setItem('anonymous_saved_responses', JSON.stringify(savedResponses));
        
        // If user is signed in, also save to their account
        if (user?.email) {
          try {
            await fetch(`${API_BASE_URL}/api/saved-responses`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-email': user.email
              },
              body: JSON.stringify({
                userEmail: user.email,
                ...newResponse
              })
            });
          } catch (error) {
            console.error('Error saving response to account:', error);
          }
        }
      }

      // Update current index
      const newIndex = index - 1;
      setCurrentIndex(newIndex);
      
      // Update localStorage for current responses state
      const savedData = JSON.parse(localStorage.getItem('current_responses') || '{}');
      if (savedData.responses) {
        savedData.currentIndex = newIndex;
        localStorage.setItem('current_responses', JSON.stringify(savedData));
      }

      // Show regenerate popup if we've reached the end
      if (newIndex === -1) {
        setShowRegeneratePopup(true);
      }

    } catch (error) {
      console.error('Error tracking swipe:', error);
      setCurrentIndex(index - 1);
    }
  };
  
  const outOfFrame = (index: number) => {
    console.log(`Card ${index} left the screen`);
  };

  const swipe = async (dir: Direction) => {
    if (!canInteract || currentIndex < 0) return;
    
    // Only handle left/right swipes
    if (dir !== 'left' && dir !== 'right') return;
    
    try {
      const currentRef = childRefs.current[currentIndex];
      if (currentRef && currentRef.current) {
        await currentRef.current.swipe(dir);
      }
    } catch (error) {
      console.error("Error in manual swipe:", error);
      swiped(dir, responses[currentIndex], currentIndex);
    }
  };

  // Helper function to convert base64 to File
  const base64ToFile = async (base64String: string, filename: string): Promise<File> => {
    try {
      // Extract base64 data if it's a data URL
      const base64Data = extractBase64FromDataUrl(base64String);
      if (!base64Data) {
        throw new Error('Invalid base64 data');
      }
      
      // Convert base64 to blob
      const byteCharacters = atob(base64Data);
      const byteArrays = [];
      
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      
      const blob = new Blob(byteArrays, { type: 'image/png' });
      return new File([blob], filename, { type: 'image/png' });
    } catch (error) {
      console.error('Error converting base64 to file:', error);
      throw new Error('Failed to process the image. Please try uploading again.');
    }
  };

  // Update handleRegenerate function
  const handleRegenerate = async () => {
    try {
      setIsGenerating(true);
      
      // Check if we're using text input or file input
      if (lastContext && lastText) {
        // Text input path
        const newResponses = await analyzeScreenshot(
          null, // no file
          mode,
          isSignedIn,
          lastContext,
          lastText
        );
        
        // Update responses state and localStorage
        setResponses(newResponses);
        setCurrentIndex(newResponses.length - 1);
        setKey(prevKey => prevKey + 1); // Force re-render of cards
        
        // Update localStorage with new responses
        const savedData = {
          responses: newResponses,
          currentIndex: newResponses.length - 1,
          mode,
          lastFile: null, // ensure this is null for text input
          lastContext,
          lastText,
          inputMode: 'text' as const // Add this to track input mode
        };
        localStorage.setItem('current_responses', JSON.stringify(savedData));
        
      } else if (lastFile) {
        // Existing file input path
        const file = await base64ToFile(lastFile, 'screenshot.png');
        
        if (!file) {
          console.error('No screenshot available for regeneration');
          router.push('/');
          return;
        }

        const newResponses = await analyzeScreenshot(file, mode, isSignedIn, lastContext, lastText);
        
        // Update responses state and localStorage
        setResponses(newResponses);
        setCurrentIndex(newResponses.length - 1);
        setKey(prevKey => prevKey + 1);
        
        const savedData = {
          responses: newResponses,
          currentIndex: newResponses.length - 1,
          mode,
          lastFile,
          lastContext,
          lastText,
          inputMode: 'screenshot' as const
        };
        localStorage.setItem('current_responses', JSON.stringify(savedData));
      } else {
        console.error('No input available for regeneration');
        router.push('/');
        return;
      }
      
      // Update childRefs for new responses
      childRefs.current = Array(responses.length)
        .fill(0)
        .map(() => React.createRef());
        
    } catch (error) {
      console.error('Error regenerating responses:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Update keyboard handler to prevent rapid firing
  useEffect(() => {
    let isProcessing = false;
    
    const handleKeyPress = async (event: KeyboardEvent) => {
      if (isProcessing) return;
      
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        isProcessing = true;
        const direction = event.key === 'ArrowLeft' ? 'left' as const : 'right' as const;
        await swipe(direction);
        setTimeout(() => {
          isProcessing = false;
        }, 300); // Debounce time
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex]);

  const handleClose = () => {
    router.push('/');
  };

  const handleCheckout = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: user?.email,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
    }
  };

  // Update the useEffect to fetch the learning percentage
  useEffect(() => {
    const fetchLearningPercentage = async () => {
      if (user?.email) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/learning-percentage`, {
            headers: {
              'x-user-email': user.email
            }
          });
          const data = await response.json();
          setMatchPercentage(data.percentage);
        } catch (error) {
          console.error('Error fetching learning percentage:', error);
          setMatchPercentage(MIN_LEARNING_PERCENTAGE);
        }
      } else {
        // For anonymous users, calculate directly from localStorage
        const savedResponses = JSON.parse(localStorage.getItem('anonymous_saved_responses') || '[]');
        const percentage = Math.min(
          savedResponses.length * FREE_INCREMENT_PER_RESPONSE,
          FREE_MAX_PERCENTAGE
        );
        setMatchPercentage(Math.max(percentage, MIN_LEARNING_PERCENTAGE));
      }
    };

    fetchLearningPercentage();
  }, [user?.email, responses.length]);

  // Add this new function for handling Google Sign-In
  const handleSignIn = async (response: { credential: string }) => {
    try {
      const token = response.credential;
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      const user = {
        email: payload.email,
        name: payload.name,
        picture: payload.picture
      };
      
      localStorage.setItem('smoothrizz_user', JSON.stringify(user));
      setUser(user);
      setIsSignedIn(true);
      setShowSignInOverlay(false);
    } catch (error) {
      console.error('Sign-in error:', error);
      alert('Failed to sign in. Please try again.');
    }
  };

  // Add Google initialization effect
  useEffect(() => {
    const initializeGoogleSignIn = async () => {
      if (!document.getElementById("google-client-script")) {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.id = "google-client-script";
        script.onload = async () => {
          try {
            console.log('Initializing Google Sign-In...');
            const res = await fetch(`${API_BASE_URL}/auth/google-client-id`);
            const { clientId } = await res.json();
            
            if (!clientId) {
              throw new Error('No client ID received from server');
            }

            window.google.accounts.id.initialize({
              client_id: clientId,
              callback: handleSignIn,
            });
            
            setGoogleLoaded(true);
          } catch (err) {
            console.error("Error initializing Google Sign-In:", err);
          }
        };
        document.body.appendChild(script);
      }
    };

    initializeGoogleSignIn();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="fixed inset-0 bg-gradient-to-br from-pink-500/5 via-white/50 to-gray-100/50 backdrop-blur-sm z-50 flex flex-col">
        {/* Close button - smaller and higher */}
        <button
          onClick={() => router.push('/')}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 z-50 text-xl"
        >
          ×
        </button>

        {/* Top section with fixed height */}
        <div className="flex flex-col space-y-4 pt-3 pb-2">
          {/* Top buttons container */}
          <div className="flex justify-center gap-1.5 z-20">
            <button
              onClick={() => setShowPreview(true)}
              className="text-gray-600 hover:text-gray-800 px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm text-[11px] shadow-sm font-medium"
            >
              Review Photo
            </button>
            
            {/* Show Saved button for everyone, but prompt sign in if not authenticated */}
            <button
              onClick={() => isSignedIn ? router.push('/saved') : setShowSignInOverlay(true)}
              className="text-gray-600 hover:text-gray-800 px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm text-[11px] shadow-sm font-medium flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Saved
            </button>
          </div>

          {/* AI Learning Bar */}
          <div className="mx-auto w-full max-w-md px-4">
            <div className="bg-white/90 backdrop-blur-sm rounded-lg p-1.5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-pink-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </span>
                  <span className="text-[10px] font-medium text-gray-700">AI Learning</span>
                </div>
                {!isPremium && (
                  <button
                    onClick={() => router.push('/saved?tab=profile')}
                    className="text-[10px] text-pink-600 hover:text-pink-700 font-medium whitespace-nowrap"
                  >
                    Upgrade →
                  </button>
                )}
              </div>
              
              <div className="relative h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${
                    isPremium ? 'bg-gradient-to-r from-pink-500 to-purple-500' : 'bg-gray-400'
                  }`}
                  style={{ width: `${matchPercentage}%` }}
                />
              </div>
              
              <div className="flex justify-between text-[10px] mt-1">
                <span className={isPremium ? 'text-green-600' : 'text-gray-600'}>
                  {matchPercentage}% Learned
                </span>
                {!isPremium && (
                  <span className="text-gray-500">
                    Upgrade for better matches
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cards container */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full max-w-[280px] h-[380px] relative" key={key}>
            {responses.map((response, index) => {
              if (index > currentIndex) return null;
              
              return (
                <TinderCard
                  ref={childRefs.current[index]}
                  key={`card-${index}-${key}`}
                  onSwipe={(dir: Direction) => canInteract && swiped(dir, response, index)}
                  onCardLeftScreen={() => outOfFrame(index)}
                  preventSwipe={canInteract ? ['up', 'down'] : ['up', 'down', 'left', 'right']}
                  className="absolute w-full h-full cursor-grab active:cursor-grabbing"
                >
                  <div className="bg-white rounded-xl p-5 w-full h-full flex flex-col transform transition-all duration-200 
                    hover:scale-[1.02] relative border border-gray-200 shadow-lg">
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="px-2 py-1 bg-white rounded-full text-[15px] font-medium text-gray-500 shadow-sm border border-gray-200">
                        SWIPE
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 flex items-center justify-center">
                      <div className="prose prose-sm max-w-full text-center px-3">
                        <p className="text-gray-800 whitespace-pre-wrap text-base leading-relaxed font-medium">
                          {response}
                        </p>
                      </div>
                    </div>

                    <div className="absolute bottom-4 left-0 right-0 flex justify-between px-6">
                      <span className="text-red-400 text-sm">← Skip card</span>
                      <span className="text-green-500 text-sm">Save style →</span>
                    </div>
                  </div>
                </TinderCard>
              );
            })}
          </div>

          {/* Swipe Counter */}
          <div className="text-center mt-4">
            <span className="text-xs font-medium text-gray-600">
              {isPremium ? (
                'Unlimited Swipes Available'
              ) : (
                `${isSignedIn ? FREE_USER_DAILY_LIMIT - usageCount : ANONYMOUS_USAGE_LIMIT - usageCount} Daily Free Swipes Left`
              )}
            </span>
          </div>

          {/* Bottom buttons */}
          <div className="w-full max-w-[280px] space-y-1.5 mt-4">
            <button
              onClick={() => router.push('/')}
              className="w-full bg-black/5 hover:bg-black/10 px-4 py-2 rounded-full inline-flex items-center justify-center space-x-1.5 transition-all duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              <span className="text-xs font-medium">New Screenshot</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overlays */}
      {isGenerating && <LoadingScreen />}
      
      {showSignInOverlay && !isSignedIn && (
        <GoogleSignInOverlay 
          googleLoaded={googleLoaded}
          onClose={() => setShowSignInOverlay(false)}
          onSignInSuccess={() => {
            setShowSignInOverlay(false);
          }}
          preventReload={true}
        />
      )}

      {showUpgradePopup && isSignedIn && !isPremium && (
        <UpgradePopup 
          onClose={() => setShowUpgradePopup(false)} 
          handleCheckout={handleCheckout}
        />
      )}

      {showRegeneratePopup && (
        <RegeneratePopup 
          onRegenerate={() => {
            handleRegenerate();
            setShowRegeneratePopup(false);
          }}
          onClose={() => router.push('/')}
        />
      )}

      {showPreview && lastFile && (
        <PhotoPreview 
          imageUrl={lastFile}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
} 