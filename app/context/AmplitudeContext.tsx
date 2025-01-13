// app/context/AmplitudeContext.tsx
"use client";

import { createContext, useContext, useEffect } from "react";
import * as amplitude from '@amplitude/analytics-browser';
import { sessionReplayPlugin } from '@amplitude/plugin-session-replay-browser';

const AMPLITUDE_API_KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY || '2ebec7feee191712641de915f259fd72';

interface AmplitudeContextType {
  trackAmplitudeEvent: (eventName: string, eventProperties?: Record<string, any>) => void;
}

export const AmplitudeContext = createContext<AmplitudeContextType | undefined>(undefined);

export function AmplitudeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize Session Replay Plugin
    const sessionReplayTracking = sessionReplayPlugin({
      sampleRate: 1 // Captures 100% of sessions - adjust for production
    });

    // Add plugin to Amplitude instance
    amplitude.add(sessionReplayTracking);

    // Initialize Amplitude with session replay
    amplitude.init(AMPLITUDE_API_KEY, 'session replay user', {
      defaultTracking: {
        sessions: true,
        pageViews: true,
        formInteractions: true,
        fileDownloads: true,
      },
      // Optional tracking config
      // optOut: false, // Set to true if user opts out of tracking
    });

    return () => {
      // Cleanup on unmount
      amplitude.remove(sessionReplayTracking as string);
    };
  }, []);

  const trackAmplitudeEvent = (eventName: string, eventProperties?: Record<string, any>) => {
    amplitude.track(eventName, eventProperties);
  };

  return (
    <AmplitudeContext.Provider value={{ trackAmplitudeEvent }}>
      {children}
    </AmplitudeContext.Provider>
  );
}

export const useAmplitudeContext = () => {
    const context = useContext(AmplitudeContext);
    if (context === undefined) {
      throw new Error("useAmplitudeContext must be used within an AmplitudeProvider");
    }
    return context;
  };