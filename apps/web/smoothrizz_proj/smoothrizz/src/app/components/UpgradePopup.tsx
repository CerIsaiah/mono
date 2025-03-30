"use client";
import React, { useState, useEffect } from 'react';
import { getFormattedTimeUntilReset } from '../utils/timeUtils';

// Constants
const API_BASE_URL = process.env.NEXT_PUBLIC_RAILWAY_URL || 'https://mono-production-8ef9.up.railway.app';

// Interfaces for better type safety and dependency inversion
interface SubscriptionPlan {
  name: string;
  price: string;
  features: string[];
  trialDays?: number;
}

interface UpgradePopupProps {
  onClose: () => void;
  handleCheckout: () => void;
  currentUsage?: {
    dailySwipes: number;
    totalSwipes: number;
    isPremium: boolean;
    isTrial: boolean;
    trialEndsAt?: Date;
  };
}

interface BenefitProps {
  text: string;
  highlight: string;
}

// Reusable Benefit component
const Benefit: React.FC<BenefitProps> = ({ text, highlight }) => (
  <div className="flex items-start gap-2.5 text-gray-700 hover:bg-gray-50 p-1.5 rounded-lg transition-colors">
    <svg className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
    <span className="text-sm sm:text-base text-gray-800">
      <strong>{highlight}</strong> - {text}
    </span>
  </div>
);

export const UpgradePopup: React.FC<UpgradePopupProps> = ({ 
  onClose, 
  handleCheckout,
  currentUsage 
}) => {
  const [timeUntilReset, setTimeUntilReset] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    const updateTimeUntilReset = () => {
      setTimeUntilReset(getFormattedTimeUntilReset());
    };

    updateTimeUntilReset();
    const interval = setInterval(updateTimeUntilReset, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  const handleFreePlan = () => {
    onClose();
    window.location.href = '/';
  };

  const benefits: BenefitProps[] = [
    {
      highlight: "Unlimited Suggestions",
      text: "Always know exactly what to say, no matter how tricky the conversation."
    },
    {
      highlight: "3x Faster AI Learning",
      text: "Text like the best version of you"
    },
    {
      highlight: "Priority Support",
      text: "Instant answers to ensure you're never stuck overthinking again."
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[60] p-3">
      <div className="bg-white p-6 sm:p-7 rounded-xl w-full max-w-sm mx-auto relative shadow-xl">
        <h2 className="text-2xl sm:text-2xl font-bold mb-4 bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
          Never Lose a Moment to Impress
        </h2>
        
        {/* Benefits section */}
        <div className="mb-6 space-y-3">
          {benefits.map((benefit, index) => (
            <Benefit key={index} {...benefit} />
          ))}
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={handleCheckout}
            disabled={isProcessing}
            className={`w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-lg font-semibold 
              ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 transform hover:scale-[1.01]'} 
              transition-all duration-200 shadow-md text-sm sm:text-base`}
          >
            {isProcessing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              'Free 3 Day Trial - $4.99/mo after'
            )}
          </button>
          
          <button
            onClick={handleFreePlan}
            disabled={isProcessing}
            className={`w-full bg-gray-50 text-gray-700 py-2.5 rounded-lg 
              ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'} 
              transition-all duration-200 text-sm sm:text-base`}
          >
            Stay on Free Plan
            <div className="text-xs sm:text-sm text-gray-500 mt-0.5 font-medium">
              Next reset in {timeUntilReset}
              {currentUsage && ` • ${currentUsage.dailySwipes} swipes used today`}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}; 