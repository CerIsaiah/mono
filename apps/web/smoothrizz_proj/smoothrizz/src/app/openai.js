/**
 * OpenAI Client Utilities
 * 
 * This file provides client-side utilities for interacting with OpenAI services.
 * 
 * Main Features:
 * - Image to base64 conversion
 * - API request handling
 * - Error handling and formatting
 * - Response processing
 * 
 * Dependencies:
 * - None (uses built-in fetch API)
 * 
 * Side Effects:
 * - Converts files to base64
 * - Makes API calls to /api/openai endpoint
 * 
 * Connected Files:
 * - src/app/api/openai/route.js: Server endpoint
 * - src/app/responses/page.js: Uses these utilities
 * - src/app/page.js: Uses for initial response generation
 */

export async function analyzeScreenshot(file, mode, isSignedIn, context = '', lastText = '') {
  let requestBody = {
    mode,
    isSignedIn
  };

  // Get user email from localStorage
  const storedUser = localStorage.getItem('smoothrizz_user');
  const userEmail = storedUser ? JSON.parse(storedUser).email : null;

  if (file) {
    try {
      // Compress and resize image before converting to base64
      const compressedFile = await compressImage(file, 800); // Max width 800px
      
      // Convert file to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(compressedFile);
      });
      requestBody.imageBase64 = base64;
    } catch (error) {
      throw new Error('Error processing image. Please try again.');
    }
  } else if (context || lastText) {
    requestBody.context = context;
    requestBody.lastText = lastText;
  } else {
    throw new Error('No input provided. Please provide an image or text.');
  }

  // Add a loading state UI indicator to ResponsesPage
  
  // Add timeout to fetch
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userEmail && { 'x-user-email': userEmail }),
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const data = await response.json();
    
    if (!response.ok) {
      // Handle specific error cases
      switch (response.status) {
        case 403:
          throw new Error(data.error || 'Usage limit reached. Please try again later.');
        case 429:
          throw new Error('Rate limit exceeded. Please try again later.');
        case 413:
          throw new Error('Image file too large. Please use a smaller image.');
        default:
          throw new Error(data.error || 'An error occurred. Please try again.');
      }
    }

    // The response is now guaranteed to be an array of exactly 10 strings
    return data.responses;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  }
}

// Helper function to convert File to base64
function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// Add this helper function to compress images
async function compressImage(file, maxWidth = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      // Calculate new dimensions
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      // Get compressed image as Blob
      canvas.toBlob(
        (blob) => {
          resolve(new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          }));
        },
        'image/jpeg',
        0.7 // quality
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}