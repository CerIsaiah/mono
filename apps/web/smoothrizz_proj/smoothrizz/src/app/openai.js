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

// Add API_BASE_URL constant
const API_BASE_URL = process.env.NEXT_PUBLIC_RAILWAY_URL || 'https://mono-production-8ef9.up.railway.app';

// Helper function to validate base64
function isValidBase64(str) {
  try {
    return /^[A-Za-z0-9+/=]+$/.test(str);
  } catch (e) {
    return false;
  }
}

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
      const base64 = await convertFileToBase64(compressedFile);
      if (!base64) {
        throw new Error('Failed to convert image to base64');
      }
      
      // Validate base64 format
      if (!isValidBase64(base64)) {
        throw new Error('Invalid base64 format');
      }
      
      requestBody.imageBase64 = base64;
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error('Error processing image. Please try again.');
    }
  } else if (context || lastText) {
    requestBody.context = context;
    requestBody.lastText = lastText;
  } else {
    throw new Error('No input provided. Please provide an image or text.');
  }

  // Add timeout to fetch
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    console.log('Making request to OpenAI API:', {
      endpoint: `${API_BASE_URL}/api/openai`,
      hasImage: !!requestBody.imageBase64,
      hasContext: !!requestBody.context,
      hasLastText: !!requestBody.lastText,
      mode: requestBody.mode
    });

    const response = await fetch(`${API_BASE_URL}/api/openai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userEmail && { 'x-user-email': userEmail }),
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Handle specific error cases
      switch (response.status) {
        case 403:
          throw new Error(errorData.error || 'Usage limit reached. Please try again later.');
        case 429:
          throw new Error('Rate limit exceeded. Please try again later.');
        case 413:
          throw new Error('Image file too large. Please use a smaller image.');
        case 405:
          throw new Error('Method not allowed. Please try again.');
        default:
          throw new Error(errorData.error || 'An error occurred. Please try again.');
      }
    }

    const data = await response.json();
    
    // Validate response format
    if (!data.responses || !Array.isArray(data.responses)) {
      throw new Error('Invalid response format from server');
    }

    return data.responses;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    console.error('API request failed:', error);
    throw error;
  }
}

// Helper function to convert File to base64
export function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Always return just the base64 data without the data URL prefix
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
}

// Add this helper function to extract base64 data from data URL
export function extractBase64FromDataUrl(dataUrl) {
  if (!dataUrl) return null;
  try {
    // Check if it's already just base64 data
    if (!dataUrl.includes('data:')) {
      return dataUrl;
    }
    // Extract base64 data from data URL
    return dataUrl.split(',')[1];
  } catch (error) {
    console.error('Error extracting base64 from data URL:', error);
    return null;
  }
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