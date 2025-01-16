// app/context/AmplitudeContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import * as amplitude from '@amplitude/analytics-browser';

interface AmplitudeContextType {
  isInitialized: boolean;
  trackAmplitudeEvent: (eventName: string, eventProperties?: Record<string, any>) => void;
}

const AmplitudeContext = createContext<AmplitudeContextType | undefined>(undefined);

interface AmplitudeProviderProps {
  children: React.ReactNode;
  apiKey?: string;
}

export function AmplitudeProvider({ children, apiKey }: AmplitudeProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const AMPLITUDE_API_KEY = apiKey || process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

  useEffect(() => {
    if (!AMPLITUDE_API_KEY) {
      console.warn('Amplitude API key is not set');
      return;
    }

    try {
      amplitude.init(AMPLITUDE_API_KEY, undefined, {
        defaultTracking: {
          pageViews: true,
          sessions: true,
          formInteractions: true,
        }
      });
      setIsInitialized(true);
      console.log('Amplitude initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Amplitude:', error);
    }
  }, [AMPLITUDE_API_KEY]);

  const trackAmplitudeEvent = (eventName: string, eventProperties?: Record<string, any>) => {
    if (!isInitialized) {
      console.warn('Amplitude not initialized');
      return;
    }

    try {
      amplitude.track(eventName, eventProperties);
      console.log('Event tracked:', eventName, eventProperties);
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  };

  return (
    <AmplitudeContext.Provider value={{ isInitialized, trackAmplitudeEvent }}>
      {children}
    </AmplitudeContext.Provider>
  );
}

export function useAmplitudeContext() {
  const context = useContext(AmplitudeContext);
  if (context === undefined) {
    throw new Error('useAmplitudeContext must be used within an AmplitudeProvider');
  }
  return context;
}