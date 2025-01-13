"use client";

import React, { useEffect, useState } from 'react';
import { useAmplitudeContext } from '@/app/hooks/useAmplitudeContext';

const AmplitudeDebug = () => {
  const { trackAmplitudeEvent } = useAmplitudeContext();
  const [status, setStatus] = useState<{
    scriptLoaded: boolean;
    sessionReplayActive: boolean;
    lastEvent: string | null;
    error: string | null;
  }>({
    scriptLoaded: false,
    sessionReplayActive: false,
    lastEvent: null,
    error: null
  });

  useEffect(() => {
    const checkStatus = () => {
      const win = window as any;
      const scriptLoaded = !!win.amplitude;
      const sessionReplayActive = !!(win.amplitude?.plugins?.find((p: any) => 
        p.name === 'session-replay'
      ));

      setStatus(prev => ({
        ...prev,
        scriptLoaded,
        sessionReplayActive
      }));
    };

    checkStatus();
    const timeout = setTimeout(checkStatus, 2000);
    
    return () => clearTimeout(timeout);
  }, []);

  const testEvent = () => {
    try {
      const timestamp = new Date().toISOString();
      trackAmplitudeEvent('debug_test_event', { 
        timestamp,
        environment: process.env.NODE_ENV 
      });
      
      setStatus(prev => ({
        ...prev,
        lastEvent: timestamp,
        error: null
      }));
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-white shadow-lg rounded-lg border max-w-sm z-50">
      <h3 className="text-lg font-semibold mb-4">Amplitude Debug Panel</h3>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${status.scriptLoaded ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>Amplitude Loaded: {status.scriptLoaded ? 'Yes' : 'No'}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${status.sessionReplayActive ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>Session Replay Active: {status.sessionReplayActive ? 'Yes' : 'No'}</span>
        </div>

        {status.lastEvent && (
          <div className="text-sm text-gray-600">
            Last event sent: {status.lastEvent}
          </div>
        )}

        {status.error && (
          <div className="text-sm text-red-600">
            Error: {status.error}
          </div>
        )}
      </div>

      <button
        onClick={testEvent}
        className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        Send Test Event
      </button>

      <div className="mt-4 text-xs text-gray-500">
        Verification steps:
        1. Check green indicators above
        2. Open DevTools (F12)
        3. Network tab → Filter "amplitude"
        4. Click button to test events
      </div>
    </div>
  );
};

export default AmplitudeDebug;