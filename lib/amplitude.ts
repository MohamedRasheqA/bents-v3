import * as amplitude from '@amplitude/analytics-browser';

// Ensure API key is available
const AMPLITUDE_API_KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
if (!AMPLITUDE_API_KEY) {
  console.warn('Amplitude API key is not configured');
}

/**
 * Initialize Amplitude analytics
 */
export const initAmplitude = () => {
  if (!AMPLITUDE_API_KEY) return;
  
  amplitude.init(AMPLITUDE_API_KEY, {
    defaultTracking: true,
    logLevel: process.env.NODE_ENV === 'production' ? 0 : 4
  });
};

/**
 * Track an event in Amplitude
 * @param eventName Name of the event to track
 * @param eventProperties Optional properties to include with the event
 */
export const logEvent = (eventName: string, eventProperties?: Record<string, any>) => {
  if (!AMPLITUDE_API_KEY) return;
  
  try {
    amplitude.track(eventName, eventProperties);
  } catch (error) {
    console.error('Failed to track event:', error);
  }
};