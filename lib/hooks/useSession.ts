'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Types
export interface Conversation {
  id: string;
  question: string;
  text: string;
  timestamp: string;
  videoLinks?: any;
  related_products?: any[];
}

export interface Session {
  id: string;
  conversations: Conversation[];
}

export function useSession() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load sessions from database
  const loadSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('/api/session');
      const savedSessions = response.data;
      
      if (Array.isArray(savedSessions) && savedSessions.length > 0) {
        setSessions(savedSessions);
        setCurrentSessionId(savedSessions[0].id);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      setError('Failed to load chat history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save sessions to database
  const saveSessions = useCallback(async (updatedSessions: Session[]) => {
    try {
      await axios.post('/api/session', {
        sessionData: updatedSessions
      });
    } catch (error) {
      console.error('Error saving sessions:', error);
      setError('Failed to save chat history');
    }
  }, []);

  // Initialize sessions
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Debounced save effect
  useEffect(() => {
    if (sessions.length > 0) {
      const timeoutId = setTimeout(() => {
        saveSessions(sessions);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [sessions, saveSessions]);

  return {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    isLoading,
    error,
    saveSessions,
    loadSessions
  };
} 