"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initializeButton = async () => {
      try {
        if (!buttonContainerRef.current || !window.google?.accounts?.id) {
          return;
        }

        setIsLoading(true);
        
        // Get client ID from environment variable or API
        const response = await fetch(`${API_BASE_URL}/auth/google-client-id`);
        const { clientId } = await response.json();
          
        if (!clientId) {
          throw new Error('No client ID received from server');
        }

        // Initialize Google Sign-In
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: { credential: string }) => {
            try {
              const token = response.credential;
              const payload = JSON.parse(atob(token.split('.')[1]));
              
              const user = {
                email: payload.email,
                name: payload.name,
                picture: payload.picture
              };
              
              localStorage.setItem('smoothrizz_user', JSON.stringify(user));
              
              if (onSignInSuccess) {
                onSignInSuccess({ user, credential: response.credential } as GoogleAuthResponse);
              }
              
              if (onClose) onClose();
              
              if (!preventReload) {
                window.location.reload();
              }
            } catch (error) {
              console.error('Sign-in error:', error);
              alert('Failed to sign in. Please try again.');
            }
          }
        });

        // Clear any existing content
        buttonContainerRef.current.innerHTML = '';

        // Render the button
        window.google.accounts.id.renderButton(buttonContainerRef.current, {
          theme: "outline",
          size: "large"
        });

        if (mounted) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error initializing Google Sign-In:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    if (googleLoaded) {
      initializeButton();
    }

    return () => {
      mounted = false;
      if (buttonContainerRef.current) {
        buttonContainerRef.current.innerHTML = '';
      }
    };
  }, [googleLoaded, onClose, onSignInSuccess, preventReload]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white p-4 sm:p-8 rounded-xl w-full max-w-sm mx-auto flex flex-col items-center">
        {isLoading || !googleLoaded ? (
          <div className="h-10 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-900 border-t-transparent"></div>
          </div>
        ) : (
          <div 
            ref={buttonContainerRef}
            className="h-10 w-64 flex items-center justify-center"
          />
        )}
        <p className="mt-4 text-center text-sm sm:text-base">
          Please sign in with Google to view your saved responses/generate more.
        </p>
      </div>
    </div>
  );
} 