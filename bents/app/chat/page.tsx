'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowRight, PlusCircle, HelpCircle, ChevronRight, BookOpen, X, History } from 'lucide-react';
import Image from 'next/image';
import axios from 'axios';
import YouTube from 'react-youtube';
import { Button } from "@/components/ui/button";
import { v4 as uuidv4 } from 'uuid';
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from 'react-markdown';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

// Types
interface Conversation {
  id: string;
  question: string;
  text: string;
  initial_answer?: string;
  video?: string[];
  video_titles?: string[];
  video_timestamps?: Record<string, string>;
  videoLinks?: VideoLinks;
  related_products?: Product[];
  timestamp: string;
}

interface Session {
  id: string;
  conversations: Conversation[];
}

interface VideoInfo {
  urls: string[];
  video_title?: string;
  description?: string;
  timestamp?: string;
}

interface VideoLinks {
  [key: string]: VideoInfo;
}

interface Product {
  id: string;
  title: string;
  description?: string;
  price?: string;
  category?: string;
  link: string;
  image_data?: string;
}

// Constants
const LOCAL_STORAGE_KEY = 'chat_sessions';
const processingSteps = [
  "Understanding query",
  "Searching knowledge base",
  "Processing data",
  "Generating answer"
];

// Styles
const styles = `
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

.watermark-background {
  position: relative;
  background: linear-gradient(
    135deg,
    #f8fafc 0%,
    #f1f5f9 100%
  );
  min-height: 100vh;
}
`;

// Apply styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

// Helper Functions
const getYoutubeVideoIds = (urls: string[] = []) => {
  if (!urls || !Array.isArray(urls)) return [];
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  return urls.map(url => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }).filter((id): id is string => id !== null);
};

// Components
function ProductCard({ product }: { product: Product }) {
  const imageUrl = product.image_data
    ? `data:image/jpeg;base64,${product.image_data}`
    : '/default-product-image.jpg';

  return (
    <div className="relative group hover:shadow-lg transition-shadow duration-300 rounded-lg overflow-hidden">
      <div className="relative w-full h-48">
        <Image
          src={imageUrl}
          alt={product.title}
          fill
          className="object-contain"
          priority={false}
        />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-2">{product.title}</h3>
        {product.description && (
          <p className="text-sm text-gray-600 mb-4">{product.description}</p>
        )}
        <a
          href={product.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 inline-flex items-center"
        >
          View Product
          <ArrowRight className="ml-1 h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

// Main Page Component
export default function ChatPage() {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [sessions, setSessions] = useState<Session[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedSessions = localStorage.getItem(LOCAL_STORAGE_KEY);
        return savedSessions ? JSON.parse(savedSessions) : [{
          id: uuidv4(),
          conversations: []
        }];
      } catch (error) {
        console.error('Error loading sessions:', error);
        return [{ id: uuidv4(), conversations: [] }];
      }
    }
    return [{ id: uuidv4(), conversations: [] }];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('current_session_id') || sessions[0]?.id || '';
    }
    return '';
  });
  const [currentConversation, setCurrentConversation] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [fastStepsComplete, setFastStepsComplete] = useState(false);
  const [showInitialQuestions, setShowInitialQuestions] = useState(true);
  const [randomQuestions, setRandomQuestions] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [processingQuery, setProcessingQuery] = useState("");
  const [loadingQuestionIndex, setLoadingQuestionIndex] = useState<number | null>(null);

  // Refs
  const latestConversationRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const loadingCardRef = useRef<HTMLDivElement>(null);

  // Effects
  useEffect(() => {
    const fetchRandomQuestions = async () => {
      try {
        const response = await axios.get('/api/random');
        setRandomQuestions(response.data.map((q: any) => q.question_text));
      } catch (error) {
        console.error('Error fetching random questions:', error);
      }
    };

    fetchRandomQuestions();
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    if (currentSessionId) {
      const currentSession = sessions.find(session => session.id === currentSessionId);
      if (currentSession) {
        setCurrentConversation(currentSession.conversations);
        setShowInitialQuestions(currentSession.conversations.length === 0);
        localStorage.setItem('current_session_id', currentSessionId);
      }
    }
  }, [currentSessionId, sessions]);

  useEffect(() => {
    if (loading && !fastStepsComplete) {
      // Fast progress for first 3 steps
      let step = 0;
      const fastInterval = setInterval(() => {
        if (step < 3) { // Only progress up to the third step
          setLoadingProgress(step);
          step++;
        } else {
          setFastStepsComplete(true);
          clearInterval(fastInterval);
        }
      }, 500); // Faster interval for initial steps

      return () => clearInterval(fastInterval);
    }
  }, [loading, fastStepsComplete]);

  useEffect(() => {
    if (!loading) {
      setLoadingProgress(0);
      setFastStepsComplete(false);
    }
  }, [loading]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Save current state to localStorage before refresh
      if (sessions.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions));
      }
      if (currentSessionId) {
        localStorage.setItem('current_session_id', currentSessionId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessions, currentSessionId]);

  // Modify this useEffect to properly handle page refresh
  useEffect(() => {
    const loadInitialState = () => {
      // Create new session
      const newSessionId = uuidv4();
      const newSession = {
        id: newSessionId,
        conversations: []
      };

      // Reset states
      setSessions([newSession]);
      setCurrentSessionId(newSessionId);
      setCurrentConversation([]);
      setShowInitialQuestions(true);
      setSearchQuery('');
      setLoading(false);
      setProcessingQuery('');
      setLoadingQuestionIndex(null);

      // Update localStorage with new state
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([newSession]));
      localStorage.setItem('current_session_id', newSessionId);
    };

    // Load initial state on mount and refresh
    if (typeof window !== 'undefined') {
      // Add event listener for page load/refresh
      window.addEventListener('load', loadInitialState);
      
      // Handle refresh specifically
      const handleRefresh = (e: BeforeUnloadEvent) => {
        // Clear existing storage
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem('current_session_id');
      };

      window.addEventListener('beforeunload', handleRefresh);

      // Initial load
      loadInitialState();

      return () => {
        window.removeEventListener('load', loadInitialState);
        window.removeEventListener('beforeunload', handleRefresh);
      };
    }
  }, []);

  // Add a separate useEffect to handle initial data loading
  useEffect(() => {
    const loadSavedSessions = () => {
      try {
        const savedSessions = localStorage.getItem(LOCAL_STORAGE_KEY);
        const savedCurrentSessionId = localStorage.getItem('current_session_id');

        if (savedSessions) {
          const parsedSessions = JSON.parse(savedSessions);
          setSessions(parsedSessions);

          if (savedCurrentSessionId) {
            const currentSession = parsedSessions.find(
              (session: Session) => session.id === savedCurrentSessionId
            );
            if (currentSession) {
              setCurrentSessionId(savedCurrentSessionId);
              setCurrentConversation(currentSession.conversations);
              setShowInitialQuestions(currentSession.conversations.length === 0);
            }
          }
        }
      } catch (error) {
        console.error('Error loading saved sessions:', error);
        // If there's an error, create a new session
        const newSessionId = uuidv4();
        const newSession = { id: newSessionId, conversations: [] };
        setSessions([newSession]);
        setCurrentSessionId(newSessionId);
        setShowInitialQuestions(true);
      }
    };

    loadSavedSessions();
  }, []);

  // Add a function to handle manual refresh
  const handleManualRefresh = () => {
    // Save current state
    if (sessions.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions));
    }
    if (currentSessionId) {
      localStorage.setItem('current_session_id', currentSessionId);
    }
    
    // Force reload the page
    window.location.reload();
  };

  // Handlers
  const handleSearch = async (e: React.FormEvent, index?: number) => {
    e.preventDefault();
    const query = index !== undefined ? randomQuestions[index] : searchQuery;
    if (!query.trim() || loading) return;
    
    setLoading(true);
    setShowInitialQuestions(false);
    setProcessingQuery(query);
    setFastStepsComplete(false);
    
    if (index !== undefined) {
      setLoadingQuestionIndex(index);
      setSearchQuery(randomQuestions[index]);
    }

    try {
      const response = await axios.post('/api/chat', {
        message: query,
        chat_history: currentConversation.map(conv => ({
          question: conv.question,
          answer: conv.initial_answer || conv.text
        }))
      });

      // Set final progress step when response is received
      setLoadingProgress(3);

      const newConversation: Conversation = {
        id: uuidv4(),
        question: query,
        text: response.data.response,
        initial_answer: response.data.initial_answer,
        videoLinks: response.data.video_links,
        related_products: response.data.related_products,
        timestamp: new Date().toISOString()
      };

      setCurrentConversation(prev => [...prev, newConversation]);
      setSessions(prev =>
        prev.map(session =>
          session.id === currentSessionId
            ? { ...session, conversations: [...session.conversations, newConversation] }
            : session
        )
      );

      setSearchQuery("");
      setProcessingQuery("");
    } catch (error) {
      console.error("Error in handleSearch:", error);
      setSearchQuery(query);
      setProcessingQuery("");
    } finally {
      setLoading(false);
    }
  };

  const handleNewConversation = () => {
    const newSessionId = uuidv4();
    setSessions(prev => [...prev, { id: newSessionId, conversations: [] }]);
    setCurrentSessionId(newSessionId);
    setCurrentConversation([]);
    setShowInitialQuestions(true);
  };

  const handleSessionSelect = (sessionId: string) => {
    const selectedSession = sessions.find(session => session.id === sessionId);
    if (selectedSession) {
      setCurrentSessionId(sessionId);
      setCurrentConversation(selectedSession.conversations);
      setShowInitialQuestions(selectedSession.conversations.length === 0);
    }
  };

  // Render functions
  const renderSearchBar = () => (
    <div className={cn(
      "w-full max-w-3xl mx-auto",
      currentConversation.length > 0 ? "fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50" : ""
    )}>
      <form onSubmit={handleSearch} className="flex items-center gap-2 w-full max-w-2xl mx-auto">
        <div className="relative flex-grow flex items-center bg-white rounded-lg border">
          <button
            type="button"
            onClick={handleNewConversation}
            className="p-2 hover:text-gray-600 transition-colors"
          >
            <PlusCircle className="h-5 w-5" />
          </button>

          <Textarea
            value={loading ? processingQuery : searchQuery}
            onChange={(e) => !loading && setSearchQuery(e.target.value)}
            placeholder="Ask your question..."
            disabled={loading}
            className={cn(
              "flex-grow min-h-[50px] py-3 px-2",
              "resize-none border-0 focus:ring-0",
              "bg-transparent placeholder:text-gray-500",
              loading ? "text-gray-500" : "text-gray-900"
            )}
            style={{
              height: '50px',
              overflowY: 'hidden'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSearch(e as any, undefined);
              }
            }}
          />

          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="p-2"
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin">⌛</div>
            ) : (
              <ArrowRight className="h-5 w-5" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );

  const renderConversation = (conv: Conversation, index: number) => (
    <div
      key={conv.id}
      ref={index === currentConversation.length - 1 ? latestConversationRef : null}
      className="bg-white rounded-lg shadow-sm p-6 mb-4"
    >
      <h2 className="font-bold mb-4">{conv.question}</h2>
      <div className="prose max-w-none">
        <ReactMarkdown>{conv.text}</ReactMarkdown>
      </div>
      {conv.videoLinks && Object.keys(conv.videoLinks).length > 0 && (
        <div className="mt-4">
          {/* Render videos here */}
        </div>
      )}
      {conv.related_products && conv.related_products.length > 0 && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {conv.related_products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );

  const renderLoadingCard = () => (
    <div className="bg-white rounded-xl shadow-sm p-8 mb-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-2">Processing question:</p>
        <p className="text-lg font-medium text-gray-900">{processingQuery}</p>
      </div>

      <h2 className="text-xl font-semibold mb-6">Processing Your Query</h2>
      <div className="space-y-6">
        {processingSteps.map((step, index) => {
          const isComplete = loadingProgress > index;
          const isCurrent = loadingProgress === index;
          const isLastStep = index === processingSteps.length - 1;
          
          return (
            <div key={step} className="flex items-center gap-3">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center",
                isComplete ? "bg-blue-500" : 
                isCurrent ? "bg-blue-500" : 
                "bg-gray-200"
              )}>
                {isComplete ? (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    isCurrent ? "bg-white animate-pulse" : "bg-gray-400",
                    // Add continuous animation for the last step while waiting for response
                    isLastStep && fastStepsComplete ? "animate-pulse" : ""
                  )} />
                )}
              </div>
              <span className={cn(
                "text-base",
                isComplete || isCurrent ? "text-gray-900" : "text-gray-400"
              )}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderInitialQuestions = () => (
    <div className="max-w-3xl w-full mx-auto text-center">
      <h1 className="text-3xl font-semibold mb-12 text-[#1E1E1E]">
        A question creates knowledge
      </h1>
      
      {/* Search Bar for Initial Screen */}
      <div className="mb-12">
        <form onSubmit={handleSearch} className="flex items-center gap-2 max-w-2xl mx-auto">
          <div className="relative flex-grow flex items-center bg-white rounded-lg border shadow-sm">
            <button
              type="button"
              onClick={handleNewConversation}
              className="p-2 hover:bg-gray-50 rounded-full transition-colors ml-2"
            >
              <PlusCircle className="h-5 w-5 text-gray-600" />
            </button>

            <Textarea
              value={loading ? processingQuery : searchQuery}
              onChange={(e) => !loading && setSearchQuery(e.target.value)}
              placeholder="Type your question here..."
              className={cn(
                "flex-grow min-h-[50px] py-3 px-4",
                "resize-none border-0 focus:ring-0",
                "bg-transparent placeholder:text-gray-500"
              )}
              style={{
                height: '50px',
                overflowY: 'hidden'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSearch(e as any);
                }
              }}
            />

            <Button
              type="submit"
              className="p-3 mr-2 text-gray-600 hover:bg-gray-50 rounded-full"
              disabled={loading}
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </form>
      </div>

      {/* Example Questions Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 max-w-2xl mx-auto">
        {randomQuestions.map((question, index) => (
          <button
            key={index}
            onClick={(e) => handleSearch(e as any, index)}
            disabled={loading && loadingQuestionIndex === index}
            className={cn(
              "p-6 text-left rounded-xl",
              "bg-white hover:bg-gray-50",
              "border border-gray-100",
              "text-sm text-gray-800",
              "shadow-sm transition-all duration-200",
              "hover:shadow-md"
            )}
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );

  // Main render
  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA]">
      <Header />
      
      {/* History Button */}
      <button
        onClick={() => setShowHistory(true)}
        className="fixed left-4 top-24 z-40 p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 border border-gray-200"
      >
        <History size={24} className="text-gray-600" />
      </button>

      {/* History Sidebar Overlay */}
      {showHistory && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowHistory(false)}
          />
          <div className="fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 p-4 z-50 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Chat History</h2>
              <button 
                onClick={() => setShowHistory(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <button
              onClick={handleNewConversation}
              className="flex items-center justify-center gap-2 mb-4 w-full py-2 px-4 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <PlusCircle className="h-5 w-5" />
              New Chat
            </button>
            <div className="overflow-y-auto h-full">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    handleSessionSelect(session.id);
                    setShowHistory(false);
                  }}
                  className={cn(
                    "w-full text-left p-3 rounded-lg mb-2 hover:bg-gray-50",
                    session.id === currentSessionId ? "bg-gray-100" : ""
                  )}
                >
                  {session.conversations[0]?.question || "New Conversation"}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className={cn(
        "flex-grow container mx-auto px-4",
        "flex items-center justify-center",
        "mt-16",
        currentConversation.length > 0 ? "pb-[80px]" : ""
      )}>
        {showInitialQuestions ? (
          renderInitialQuestions()
        ) : (
          <div className="w-full max-w-3xl">
            {currentConversation.map((conv, index) => renderConversation(conv, index))}
            {loading && renderLoadingCard()}
          </div>
        )}
      </main>
      
      {currentConversation.length > 0 && renderSearchBar()}
    </div>
  );
}
