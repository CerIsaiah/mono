"use client";
import React, { useEffect, useRef } from 'react';
import { GoogleSignInProps, GoogleAuthResponse } from '../types/auth';

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
          // Fetch client ID from API
          const res = await fetch(`${API_BASE_URL}/auth/google-client-id`);
          const { clientId } = await res.json();
          
          // Initialize with fetched client ID
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: { credential: string }) => {
              try {
                const res = await fetch(`${API_BASE_URL}/auth/google`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ credential: response.credential }),
                });
                
                if (res.ok) {
                  const data: GoogleAuthResponse = await res.json();
                  
                  // Store user data in localStorage
                  localStorage.setItem('smoothrizz_user', JSON.stringify(data.user));
                  
                  // Call onSignInSuccess if provided
                  if (onSignInSuccess) {
                    onSignInSuccess(data);
                  }
                  
                  // Close the overlay after successful sign-in
                  if (onClose) onClose();
                  
                  // Only reload if not prevented
                  if (!preventReload) {
                    window.location.reload();
                  }
                } else {
                  const errorData = await res.json();
                  console.error('Sign-in error:', errorData);
                  alert('Failed to sign in. Please try again.');
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