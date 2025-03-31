"use client";
import React, { useEffect, useRef } from 'react';
import { GoogleSignInProps, GoogleAuthResponse } from '../types/auth';
import { ANONYMOUS_USAGE_LIMIT } from '../shared/constants';
// Add this near the top of the file
const API_BASE_URL = process.env.NEXT_PUBLIC_RAILWAY_URL || 'https://mono-production-8ef9.up.railway.app';

// Declare the Google Sign-In API types
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
        };
      };
    };
  }
}

/**
 * Google Sign-In Overlay Component
 * 
 * This file provides the Google Sign-In button and overlay UI.
 * 
 * Main Features:
 * - Renders Google Sign-In button
 * - Handles sign-in flow
 * - Manages overlay state
 * 
 * Dependencies:
 * - google-auth-library: For Google Sign-In
 * 
 * Side Effects:
 * - Initializes Google Sign-In
 * - Makes API calls to API_BASE_URL/auth/google
 * 
 * Connected Files:
 * - src/app/responses/page.js: Uses this component
 * - src/app/page.js: Uses this component
 * - src/app/api/auth/google/route.js: Authentication endpoint
 */

export function GoogleSignInOverlay({ googleLoaded, onClose, onSignInSuccess, preventReload = false }: GoogleSignInProps) {
  const overlayButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initializeButton = async () => {
      if (googleLoaded && window.google && overlayButtonRef.current) {
        try {
          // Get client ID from environment variable
          const clientId = process.env.GOOGLE_CLIENT_ID || "776336590279-s1ucslerlcfcictp8kbhn6jq45s2v2fr.apps.googleusercontent.com";
          
          if (!clientId) {
            throw new Error('Google Client ID not found in environment variables');
          }
          
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: { credential: string }) => {
              try {
                console.log('Google sign-in callback triggered');
                
                // Check if this was triggered by anonymous limit
                const savedUsage = JSON.parse(localStorage.getItem('smoothrizz_usage') || '{}');
                const isAnonLimitTriggered = sessionStorage.getItem('anon_limit_triggered');
                console.log('Current usage before sign-in:', savedUsage, 'Anon limit triggered:', isAnonLimitTriggered);

                // Process sign-in
                const token = response.credential;
                const payload = JSON.parse(atob(token.split('.')[1]));
                const user = {
                  email: payload.email,
                  name: payload.name,
                  picture: payload.picture
                };
                
                localStorage.setItem('smoothrizz_user', JSON.stringify(user));
                
                // Check if we should redirect based on anonymous limit
                if (savedUsage.dailySwipes >= ANONYMOUS_USAGE_LIMIT && isAnonLimitTriggered === 'true') {
                  console.log('Anonymous user over limit - redirecting after sign-in');
                  sessionStorage.removeItem('anon_limit_triggered'); // Clear the flag
                  if (onClose) onClose();
                  console.log('Redirecting to homepage');
                  window.location.href = '/';
                  return;
                }
                
                // Normal sign-in flow
                console.log('Proceeding with normal sign-in flow');
                
                if (onSignInSuccess) {
                  console.log('Calling onSignInSuccess');
                  onSignInSuccess({ user, credential: response.credential } as GoogleAuthResponse);
                }
                
                if (onClose) {
                  console.log('Closing overlay');
                  onClose();
                }
                
                if (!preventReload) {
                  console.log('Reloading page');
                  window.location.reload();
                }
              } catch (error) {
                console.error('Sign-in error:', error);
                alert('Failed to sign in. Please try again.');
              }
            }
          });

          // Render the button
          overlayButtonRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(overlayButtonRef.current, {
            theme: "outline",
            size: "large",
          });
        } catch (error) {
          console.error('Error initializing Google Sign-In:', error);
        }
      }
    };

    initializeButton();
  }, [googleLoaded, onClose, onSignInSuccess, preventReload]);

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