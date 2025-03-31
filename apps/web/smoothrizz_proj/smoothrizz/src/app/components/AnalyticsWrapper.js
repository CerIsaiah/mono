'use client';

import { Analytics } from '@vercel/analytics/react';

export default function AnalyticsWrapper() {
  return (
    <Analytics 
      mode="production"
      beforeSend={async (event) => {
        try {
          // Get the user's IP address
          const userIP = '149.43.113.30';
          
          // Block analytics from your specific IP
          if (userIP || event.url.includes('localhost')) {
            return null;
          }
          
          return event;
        } catch (error) {
          // If we can't get the IP, still send the event
          return event;
        }
      }}
    />
  );
} 