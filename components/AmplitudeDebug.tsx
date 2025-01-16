'use client';

import React, { useState } from 'react';
import { useAmplitude } from '@/lib/hooks/useAmplitude';

const AmplitudeDebug = () => {
  const { trackEvent, isInitialized } = useAmplitude();
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testEvent = () => {
    try {
      const timestamp = new Date().toISOString();
      trackEvent('debug_test_event', {
        timestamp,
        environment: process.env.NODE_ENV,
      });
      setLastEvent(timestamp);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-white shadow-lg rounded-lg border max-w-sm z-50">
      <h3 className="text-lg font-semibold mb-4">Amplitude Debug Panel</h3>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${isInitialized ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>Amplitude Initialized: {isInitialized ? 'Yes' : 'No'}</span>
        </div>

        {lastEvent && (
          <div className="text-sm text-gray-600">
            Last event sent: {lastEvent}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600">
            Error: {error}
          </div>
        )}
      </div>

      <button
        onClick={testEvent}
        disabled={!isInitialized}
        className={`w-full px-4 py-2 text-white rounded transition-colors ${
          isInitialized 
            ? 'bg-blue-500 hover:bg-blue-600' 
            : 'bg-gray-400 cursor-not-allowed'
        }`}
      >
        Send Test Event
      </button>

      <div className="mt-4 text-xs text-gray-500">
        {`Environment: ${process.env.NODE_ENV}`}<br />
        Verification steps:<br />
        1. Check green indicator above<br />
        2. Open DevTools (F12)<br />
        3. Network tab → Filter "amplitude"<br />
        4. Click button to test events
      </div>
    </div>
  );
};

export default AmplitudeDebug;