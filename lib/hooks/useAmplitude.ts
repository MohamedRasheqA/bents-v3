// app/hooks/useAmplitude.ts
'use client';

import { useCallback } from 'react';
import { useAmplitudeContext } from '@/app/context/AmplitudeContext';

export function useAmplitude() {
  const { isInitialized, trackAmplitudeEvent } = useAmplitudeContext();

  const trackEvent = useCallback((eventName: string, eventProperties?: Record<string, any>) => {
    if (!isInitialized) {
      console.warn('Amplitude not initialized yet');
      return;
    }
    
    trackAmplitudeEvent(eventName, {
      ...eventProperties,
      timestamp: new Date().toISOString(),
    });
  }, [isInitialized, trackAmplitudeEvent]);

  return {
    isInitialized,
    trackEvent
  };
}