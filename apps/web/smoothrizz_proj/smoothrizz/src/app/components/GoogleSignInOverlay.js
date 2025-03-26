"use client";
import React, { useEffect, useRef } from 'react';

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
 * - Makes API calls to /api/auth/google
 * 
 * Connected Files:
 * - src/app/responses/page.js: Uses this component
 * - src/app/page.js: Uses this component
 * - src/app/api/auth/google/route.js: Authentication endpoint
 */

export function GoogleSignInOverlay({ googleLoaded, onClose, onSignInSuccess, preventReload = false }) {
  const overlayButtonRef = useRef(null);

  useEffect(() => {
    const initializeButton = async () => {
      if (googleLoaded && window.google && overlayButtonRef.current) {
        try {
          // Fetch client ID from API
          const res = await fetch("/api/auth/google-client-id");
          const { clientId } = await res.json();
          
          // Initialize with fetched client ID
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response) => {
              try {
                const res = await fetch('/api/auth/google', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ credential: response.credential }),
                });
                
                if (res.ok) {
                  const data = await res.json();
                  // Store user data in localStorage
                  localStorage.setItem('smoothrizz_user', JSON.stringify(data.user));
                  
                  // Call onSignInSuccess if provided
                  if (onSignInSuccess) {
                    onSignInSuccess();
                  }
                  
                  // Close the overlay after successful sign-in
                  if (onClose) onClose();
                  
                  // Only reload if not prevented. This is used to allow a redirect to the saved page after sign-in.
                  if (!preventReload) {
                    window.location.reload();
                  }
                }
              } catch (error) {
                console.error('Sign-in error:', error);
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