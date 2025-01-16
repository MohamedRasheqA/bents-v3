'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowRight, PlusCircle, ArrowDown } from 'lucide-react';
import { useChat } from 'ai/react';
import { Button } from "@/components/ui/button";
import { v4 as uuidv4 } from 'uuid';
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import Header from '@/components/Header';
import YouTube from 'react-youtube';
import { useAuth } from '@clerk/nextjs';
import { useSession } from '@/lib/hooks/useSession';

// Types
interface Conversation {
  id: string;
  question: string;
  text: string;
  initial_answer?: string;
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
  [key: string]: {
    urls: string[];
    timestamp: string;
    video_title: string;
    description: string;
  };
}

interface Product {
  id: string;
  title: string;
  link: string;
  tags: string[];
  description?: string;
  price?: string;
  category?: string;
  image_data?: string;
}

interface FAQQuestion {
  id: string;
  question_text: string;
  category?: string;
}

// Add new interface for active query
interface ActiveQuery {
  question: string;
  messageId?: string;
  timestamp?: string;
}

// Constants
const LOCAL_STORAGE_KEY = 'chat_sessions';
const processingSteps = [
  "Understanding query",
  "Searching knowledge base",
  "Processing data",
  "Generating answer"
];

// Font family constant
const systemFontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Helper functions
const getYoutubeVideoId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const getStartTime = (timestamp: string): number => {
  const [minutes, seconds] = timestamp.split(':').map(Number);
  return (minutes * 60) + seconds;
};

// Helper function to load saved data
const loadSavedData = async () => {
  try {
    const response = await axios.get('/api/session');
    const savedSessions = response.data;
    
    if (Array.isArray(savedSessions) && savedSessions.length > 0) {
      return {
        sessions: savedSessions,
        currentId: savedSessions[0].id,
        conversations: savedSessions[0].conversations || []
      };
    }
  } catch (error) {
    console.error('Error loading saved data:', error);
  }
  
  const defaultSession = { id: uuidv4(), conversations: [] };
  return {
    sessions: [defaultSession],
    currentId: defaultSession.id,
    conversations: []
  };
};

// Add function to save sessions to database
const saveSessionsToDatabase = async (sessions: Session[]) => {
  try {
    await axios.post('/api/session', {
      sessionData: sessions
    });
  } catch (error) {
    console.error('Error saving sessions to database:', error);
  }
};

const ProductCard = ({ product }: { product: Product }) => {
  return (
    <a
      href={product.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-none bg-white rounded-lg border min-w-[180px] px-4 py-3 hover:bg-gray-50 transition-colors"
    >
      <p className="text-sm font-medium text-gray-900">
        {product.title}
      </p>
      {product.tags && (
        <div className="mt-2 flex flex-wrap gap-1">
          {product.tags.slice(0, 2).map((tag, index) => (
            <span key={index} className="text-xs bg-gray-100 rounded px-2 py-1">
              {tag}
            </span>
          ))}
        </div>
      )}
    </a>
  );
};

// Updated FixedMarkdownRenderer component
const FixedMarkdownRenderer = ({ content }: { content: string }) => (
  <ReactMarkdown
    className="markdown-content"
    components={{
      root: ({ children, ...props }) => (
        <div className="w-full text-gray-800" {...props}>{children}</div>
      ),
      p: ({ children, ...props }) => (
        <p 
          className="text-base leading-relaxed mb-3"
          style={{ fontFamily: systemFontFamily }}
          {...props}
        >
          {children}
        </p>
      ),
      pre: ({ children, ...props }) => (
        <pre className="w-full p-4 rounded bg-gray-50 my-4 overflow-x-auto" {...props}>
          {children}
        </pre>
      ),
      code: ({ children, inline, ...props }) => (
        inline ? 
          <code className="px-1.5 py-0.5 rounded bg-gray-100 text-sm font-mono" {...props}>{children}</code> :
          <code className="block w-full font-mono text-sm" {...props}>{children}</code>
      ),
      ul: ({ children, ...props }) => (
        <ul className="list-disc pl-4 mb-3 space-y-1" {...props}>{children}</ul>
      ),
      ol: ({ children, ...props }) => (
        <ol className="list-decimal pl-4 mb-3 space-y-1" {...props}>{children}</ol>
      ),
      li: ({ children, ...props }) => (
        <li className="mb-1" {...props}>{children}</li>
      ),
      h1: ({ children, ...props }) => (
        <h1 className="text-xl font-medium mb-3" {...props}>{children}</h1>
      ),
      h2: ({ children, ...props }) => (
        <h2 className="text-lg font-medium mb-3" {...props}>{children}</h2>
      ),
      h3: ({ children, ...props }) => (
        <h3 className="text-base font-medium mb-2" {...props}>{children}</h3>
      ),
      blockquote: ({ children, ...props }) => (
        <blockquote 
          className="border-l-4 border-gray-200 pl-4 my-4 italic"
          {...props}
        >
          {children}
        </blockquote>
      ),
      a: ({ children, href, ...props }) => (
        <a 
          href={href}
          className="text-blue-600 hover:text-blue-800 underline"
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      )
    }}
  >
    {content}
  </ReactMarkdown>
);

// Updated ConversationItem component
const ConversationItem = ({ conv, index, isLatest }: { 
  conv: Conversation; 
  index: number; 
  isLatest: boolean;
}) => {
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLatest) {
      conversationRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isLatest]);

  return (
    <div ref={conversationRef} className="w-full bg-white rounded-lg shadow-sm p-6 mb-4">
      {/* Question Section */}
      <div className="mb-4 pb-4 border-b">
        <div className="flex items-center gap-2">
          <p className="text-gray-800 break-words font-bold" style={{ fontFamily: systemFontFamily }}>
            {conv.question}
          </p>
        </div>
      </div>

      {/* Answer Section - Simplified to match streaming format */}
      <div className="prose prose-sm max-w-none mb-4">
        <FixedMarkdownRenderer content={conv.text} />
      </div>

      {/* Videos Section */}
      {conv.videoLinks && Object.keys(conv.videoLinks).length > 0 && (
        <div className="mt-6">
          <h3 className="text-base font-semibold mb-3" style={{ fontFamily: systemFontFamily }}>
            Related Videos
          </h3>
          <div className="flex overflow-x-auto space-x-4 pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            {Object.entries(conv.videoLinks).map(([key, info]) => {
              const videoId = getYoutubeVideoId(info.urls[0]);
              if (!videoId) return null;
              
              return (
                <div key={key} className="flex-none w-[280px] bg-white border rounded-lg overflow-hidden">
                  <div className="relative aspect-video w-full">
                    <YouTube
                      videoId={videoId}
                      opts={{
                        width: '100%',
                        height: '100%',
                        playerVars: {
                          autoplay: 0,
                          start: getStartTime(info.timestamp || '0:0')
                        },
                      }}
                    />
                  </div>
                  <div className="p-3">
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2" style={{ fontFamily: systemFontFamily }}>
                      {info.video_title}
                    </h4>
                    {info.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2" style={{ fontFamily: systemFontFamily }}>
                        {info.description}
                      </p>
                    )}
                    <div className="flex items-center text-xs text-gray-500">
                      <span style={{ fontFamily: systemFontFamily }}>Starts at {info.timestamp}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Products Section */}
      {conv.related_products && conv.related_products.length > 0 && (
        <div className="mt-6">
          <h3 className="text-base font-semibold mb-3" style={{ fontFamily: systemFontFamily }}>
            Related Products
          </h3>
          <div className="flex overflow-x-auto space-x-4 pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            {conv.related_products.map((product, idx) => (
              <ProductCard key={idx} product={product} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Add ProcessingCard component near other component definitions
const ProcessingCard = ({ 
  query, 
  loadingProgress, 
  setLoadingProgress 
}: { 
  query: string, 
  loadingProgress: number,
  setLoadingProgress: React.Dispatch<React.SetStateAction<number>>
}) => {
  const loadingCardRef = useRef<HTMLDivElement>(null);
  const currentStep = Math.min(Math.floor(loadingProgress / 25), 3);

  useEffect(() => {
    if (loadingCardRef.current) {
      setTimeout(() => {
        loadingCardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    }
  }, []);

  useEffect(() => {
    if (loadingProgress < 100) {
      const timer = setTimeout(() => {
        setLoadingProgress(prev => Math.min(prev + 1, 100));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loadingProgress, setLoadingProgress]);

  return (
    <div ref={loadingCardRef} className="w-full bg-white rounded-lg p-6 mb-4">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Processing Your Query</h2>
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[rgba(23,155,215,255)] border-t-transparent"></div>
        </div>
        
        <div className="space-y-4">
          {processingSteps.map((step, index) => {
            const isComplete = index < currentStep;
            const isCurrent = index === currentStep;
            
            return (
              <div key={step} className="flex items-center gap-3">
                <div 
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    isComplete || isCurrent ? "bg-[rgba(23,155,215,255)]" : "bg-gray-200"
                  )}
                >
                  {isComplete ? (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  ) : (
                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  )}
                </div>
                <span className={cn(
                  "text-base",
                  isComplete || isCurrent ? "text-black font-medium" : "text-gray-400"
                )}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Main Chat Page Component
export default function ChatPage() {
  const { userId = null } = useAuth();
  const {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    isLoading: sessionsLoading,
    error: sessionsError
  } = useSession();

  // Initialize with empty values
  const [currentConversation, setCurrentConversation] = useState<Conversation[]>([]);
  
  // Error states
  const [error, setError] = useState<string | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);

  // Add recovery mechanism
  const recoverState = useCallback(async () => {
    if (!userId) return;
    
    try {
      const response = await axios.get('/api/get-session', {
        headers: {
          'x-user-id': userId
        }
      });

      if (Array.isArray(response.data) && response.data.length > 0) {
        setSessions(response.data);
        const lastSession = response.data[response.data.length - 1];
        setCurrentSessionId(lastSession.id);
        setCurrentConversation(lastSession.conversations || []);
        setShowInitialQuestions(!(lastSession.conversations?.length > 0));
      }
    } catch (error) {
      console.error('Failed to recover state:', error);
      setError('Failed to load chat history');
    }
  }, [userId, setSessions, setCurrentSessionId]);

  // Add effect to create new session on page load/refresh
  useEffect(() => {
    if (userId) {
      // Clear any existing session data first
      setCurrentConversation([]);
      setShowInitialQuestions(true);
      setProcessingQuery("");
      setSearchQuery("");
      setLoadingProgress(0);
      setIsStreaming(false);
      
      // Create a new session
      const initializeNewSession = async () => {
        try {
          const newSessionId = uuidv4();
          const newSession: Session = {
            id: newSessionId,
            conversations: []
          };

          if (userId) {
            const response = await axios.post('/api/set-session', {
              sessions: [newSession]
            }, {
              headers: {
                'x-user-id': userId
              }
            });

            if (response.data.success) {
              setSessions([newSession]);
              setCurrentSessionId(newSessionId);
              setShowInitialQuestions(true);
              currentQuestionRef.current = "";
            } else {
              throw new Error('Failed to create new session');
            }
          }
        } catch (error) {
          console.error('Error initializing new session:', error);
          setError('Failed to create new session');
          
          // Try to recover state
          await recoverState();
        }
      };

      initializeNewSession();
    }
  }, [userId]); // Only depend on userId

  // Update manageSession
  const manageSession = useCallback(async () => {
    try {
      // Clear existing state
      setCurrentConversation([]);
      setShowInitialQuestions(true);
      setProcessingQuery("");
      setSearchQuery("");
      
      const newSessionId = uuidv4();
      const newSession: Session = {
        id: newSessionId,
        conversations: []
      };

      if (userId) {
        const response = await axios.post('/api/set-session', {
          sessions: [newSession]
        }, {
          headers: {
            'x-user-id': userId
          }
        });

        if (response.data.success) {
          setSessions(prevSessions => [...prevSessions, newSession]);
          setCurrentSessionId(newSessionId);
          setShowInitialQuestions(true);
          currentQuestionRef.current = "";
        } else {
          throw new Error('Failed to save new session');
        }
      } else {
        setSessions(prevSessions => [...prevSessions, newSession]);
        setCurrentSessionId(newSessionId);
        setShowInitialQuestions(true);
        currentQuestionRef.current = "";
      }
    } catch (error) {
      console.error('Error in manageSession:', error);
      setError('Failed to create new session');
      
      // Try to recover state
      await recoverState();
    }
  }, [userId, setSessions, setCurrentSessionId, recoverState]);

  // Update handleNewConversation to use manageSession
  const handleNewConversation = useCallback(() => {
    manageSession();
  }, [manageSession]);

  // Add effect to create new session on page load/refresh
  useEffect(() => {
    if (userId) {
      manageSession();
    }
  }, [userId, manageSession]);

  // Other states
  const [showInitialQuestions, setShowInitialQuestions] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loadingQuestionIndex, setLoadingQuestionIndex] = useState<number | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [processingQuery, setProcessingQuery] = useState<string>("");
  const [randomQuestions, setRandomQuestions] = useState<string[]>([]);

  // Response states
  const [firstResponse, setFirstResponse] = useState<{ question: string; content: string } | null>(null);
  const [secondResponse, setSecondResponse] = useState<{ videoLinks: VideoLinks; relatedProducts: Product[] } | null>(null);
  const [isSecondResponseLoading, setIsSecondResponseLoading] = useState(false);

  // Refs
  const messageEndRef = useRef<HTMLDivElement>(null);
  const currentQuestionRef = useRef<string>("");

  // Add new refs and state for scrolling
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const lastScrollPosition = useRef(0);

  const { messages, append, isLoading } = useChat({
    api: '/api/chat',
    initialMessages: [],
    onResponse: (response) => {
      setIsStreaming(true);
      setLoadingProgress(3);
      setError(null);
      setWsError(null);
    },
    onFinish: async (message) => {
      setIsStreaming(false);
      
      const currentQuestion = currentQuestionRef.current;
      if (!currentQuestion?.trim() || !currentSessionId) {
        return;
      }
      
      setIsSecondResponseLoading(true);
      try {
        const linksResponse = await axios.post('/api/links', {
          answer: message.content
        });
        
        if (linksResponse.data.status === 'not_relevant') {
          setIsSecondResponseLoading(false);
          return;
        }
        
        // Create new conversation
        const newConversation = {
          id: uuidv4(),
          question: currentQuestion,
          text: message.content,
          timestamp: new Date().toISOString(),
          videoLinks: linksResponse.data.videoReferences || {},
          related_products: linksResponse.data.relatedProducts || []
        };

        // Find and update the current session
        const currentSession = sessions.find(s => s.id === currentSessionId);
        if (currentSession) {
          const updatedSession = {
            ...currentSession,
            conversations: [...(currentSession.conversations || []), newConversation]
          };
          
          try {
            // Save to database first
            if (userId) {
              await saveSessionsToDB([updatedSession]);
            }
            
            // Only update local state if save was successful
            setSessions(prevSessions => 
              prevSessions.map(s => 
                s.id === currentSessionId ? updatedSession : s
              )
            );
            setCurrentConversation(updatedSession.conversations);
          } catch (error) {
            console.error('Failed to save session:', error);
            // Try to recover state
            await recoverState();
          }
        }
      } catch (error) {
        console.error('Error in onFinish:', error);
        setError('Error updating chat history');
        // Try to recover state
        await recoverState();
      } finally {
        setIsSecondResponseLoading(false);
        setProcessingQuery("");
      }
    }
  });

  // Add check if near bottom function
  const checkIfNearBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;
    
    const threshold = 100; // pixels from bottom
    const position = container.scrollHeight - container.scrollTop - container.clientHeight;
    return position < threshold;
  }, []);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect if user is scrolling up
    if (container.scrollTop < lastScrollPosition.current) {
      setUserHasScrolled(true);
      setIsAutoScrollEnabled(false);
    }

    // Show/hide scroll button based on position
    setShowScrollButton(!checkIfNearBottom());
    lastScrollPosition.current = container.scrollTop;
  }, [checkIfNearBottom]);

  const scrollToBottom = () => {
    const container = containerRef.current;
    if (!container) return;

    setIsAutoScrollEnabled(true);
    setUserHasScrolled(false);
    
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  };

  // Add these useEffects:
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isStreaming || !isAutoScrollEnabled) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  }, [isStreaming, isAutoScrollEnabled]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (isStreaming) {
      setIsAutoScrollEnabled(!userHasScrolled);
    } else {
      setUserHasScrolled(false);
      setIsAutoScrollEnabled(true);
    }
  }, [isStreaming]);

  // Update handleSearch
  const handleSearch = async (e: React.FormEvent | null, index?: number) => {
    if (e) e.preventDefault();
    const query = index !== undefined ? randomQuestions[index] : searchQuery;
    
    if (!query.trim() || isLoading) return;
    
    setProcessingQuery(query);
    currentQuestionRef.current = query;
    setShowInitialQuestions(false);
    
    try {
      // If there's no current session, create one
      if (!currentSessionId) {
        await manageSession();
      }
      
      await append({
        role: 'user',
        content: query,
        createdAt: new Date()
      });

      setSearchQuery("");
      
      setTimeout(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Search Error:', error);
      setError('Error processing your request');
    }
  };

  // Loading State Component
  const LoadingState = () => (
    <div className="w-full">
      <div className="mt-4">
        <div className="bg-white rounded-lg p-4 mb-4">
          <div className="space-y-4">
            {/* Video skeleton loader */}
            <div>
              <h3 className="text-base font-semibold mb-2">Related Videos</h3>
              <div className="flex overflow-x-auto space-x-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex-none w-[280px] bg-white border rounded-lg overflow-hidden">
                    <div className="aspect-video w-full bg-gray-200 animate-pulse" />
                    <div className="p-3">
                      <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Products skeleton loader */}
            <div>
              <h3 className="text-base font-semibold mb-2">Related Products</h3>
              <div className="flex overflow-x-auto space-x-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex-none min-w-[180px] bg-white border rounded-lg px-4 py-3">
                    <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Replace the existing renderConversations function
  const renderConversations = () => (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full overflow-y-auto scrollbar-none"
        style={{ 
          height: 'calc(100vh - 200px)',
          paddingBottom: '80px',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none'
        }}
      >
        <style jsx global>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* Existing conversation items */}
        {currentConversation.map((conv, index) => (
          <ConversationItem 
            key={conv.id}
            conv={conv}
            index={index}
            isLatest={false}
          />
        ))}

        {/* Show ProcessingCard during initial loading */}
        {isLoading && !isStreaming && (
          <ProcessingCard 
            query={processingQuery}
            loadingProgress={loadingProgress}
            setLoadingProgress={setLoadingProgress}
          />
        )}

        {/* Streaming response */}
        {(isStreaming || isSecondResponseLoading) && messages.length > 0 && (
          <div className="w-full bg-white rounded-lg shadow-sm p-6 mb-4">
            {/* Question Section */}
            <div className="mb-4 pb-4 border-b">
              <div className="flex items-center gap-2">
                <p className="text-gray-800 break-words font-bold" style={{ fontFamily: systemFontFamily }}>
                  {processingQuery}
                </p>
              </div>
            </div>

            {/* Streaming Answer Section */}
            <div className="prose prose-sm max-w-none mb-4">
              <div className="text-base leading-relaxed" style={{ fontFamily: systemFontFamily }}>
                <FixedMarkdownRenderer content={messages[messages.length - 1].content} />
              </div>
            </div>

            {/* Loading state for additional content */}
            {isSecondResponseLoading && (
              <div className="mt-6">
                <LoadingState />
              </div>
            )}
          </div>
        )}

        {/* Floating scroll button */}
        {showScrollButton && (isStreaming || isSecondResponseLoading) && (
          <button
            onClick={scrollToBottom}
            className="fixed bottom-24 right-8 bg-gray-800 text-white rounded-full p-3 shadow-lg hover:bg-gray-700 transition-colors z-50 flex items-center gap-2"
          >
            <ArrowDown className="w-5 h-5" />
            <span className="text-sm font-medium pr-2">New content</span>
          </button>
        )}
      </div>
    </div>
  );

  // Effects
  useEffect(() => {
    const handleWebSocketError = (event: Event) => {
      const customError = {
        type: 'WebSocketError',
        originalMessage: event instanceof ErrorEvent ? event.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      
      console.error('WebSocket error:', customError);
      setWsError(customError.originalMessage);
      setIsStreaming(false);
      setLoadingProgress(0);
    };

    window.addEventListener('websocketerror', handleWebSocketError);
    return () => window.removeEventListener('websocketerror', handleWebSocketError);
  }, []);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const selectedSession = sessions.find(session => session.id === currentSessionId);
    if (selectedSession) {
      setCurrentConversation(selectedSession.conversations);
      setShowInitialQuestions(selectedSession.conversations.length === 0);
    }
  }, [sessions, currentSessionId]);

  useEffect(() => {
    if (isLoading && loadingProgress < 3) {
      const timer = setTimeout(() => {
        setLoadingProgress(prev => Math.min(prev + 1, 3));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading, loadingProgress]);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await axios.get('/api/random');
        setRandomQuestions(response.data.map((q: any) => q.question_text));
      } catch (error) {
        console.error('Error fetching questions:', error);
      }
    };

    fetchQuestions();
  }, []);

  // Handlers
  const handleQuestionSelect = (question: string, index: number) => {
    setLoadingQuestionIndex(index);
    setProcessingQuery(question);
    setShowInitialQuestions(false);
    setLoadingProgress(0);
    setCurrentConversation([]); // Clear existing conversations
    
    // Delay the search to allow UI to update
    setTimeout(() => {
      handleSearch(null, index);
    }, 100);
  };

  const handleSessionSelect = (sessionId: string) => {
    const selectedSession = sessions.find(session => session.id === sessionId);
    if (selectedSession) {
      setCurrentSessionId(sessionId);
      setCurrentConversation(selectedSession.conversations);
      setShowInitialQuestions(selectedSession.conversations.length === 0);
    }
  };

  const saveSessionsToDB = async (updatedSessions: Session[]) => {
    if (!userId) {
      console.log('No user ID available, skipping session save');
      return;
    }

    // Validate and clean sessions data
    const validSessions = updatedSessions.filter(session => 
      session && 
      session.id && 
      Array.isArray(session.conversations) &&
      session.conversations.every(conv => 
        conv.question && 
        conv.text && 
        conv.timestamp
      )
    );

    if (validSessions.length === 0) {
      console.error('No valid sessions to save');
      return;
    }

    try {
      const currentSession = validSessions.find(s => s.id === currentSessionId);
      if (!currentSession) {
        console.error('Current session not found in valid sessions');
        return;
      }

      const response = await axios.post('/api/set-session', { 
        sessions: [currentSession] // Only save the current session
      }, {
        headers: {
          'x-user-id': userId
        }
      });
      
      if (!response.data.success) {
        throw new Error('Failed to save session');
      }

      // Update local state to match database
      setSessions(validSessions);
      
    } catch (error) {
      console.error('Failed to save sessions to database:', error);
      setError('Failed to save chat history');
    }
  };

  // Add recovery effect
  useEffect(() => {
    if (userId && (!sessions.length || !currentSessionId)) {
      recoverState();
    }
  }, [userId, sessions.length, currentSessionId, recoverState]);

  // Main render
  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA]">
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0">
          <div className="min-h-screen">
            <Header 
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSessionSelect={handleSessionSelect}
              onNewConversation={handleNewConversation}
              userId={userId}
            />
            
            {(error || wsError) && (
              <div className="w-full max-w-4xl mx-auto px-4 mt-20 mb-4">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
                  <strong className="font-bold">Error: </strong>
                  <span className="block sm:inline">{error || wsError}</span>
                  <button
                    className="absolute top-0 right-0 px-4 py-3"
                    onClick={() => {
                      setError(null);
                      setWsError(null);
                    }}
                  >
                    <span className="sr-only">Dismiss</span>
                    <span className="text-red-500">&times;</span>
                  </button>
                </div>
              </div>
            )}
            
            <main className={cn(
              "relative",
              "flex-grow w-full",
              "flex flex-col items-center",
              "pt-32 px-4",
            )}>
              <div className="w-full max-w-5xl mx-auto">
                {currentConversation.length === 0 && showInitialQuestions && !isStreaming && !isLoading ? (
                  // Initial questions view (only show if no conversations exist)
                  <div className="w-full min-h-[calc(100vh-200px)] flex flex-col items-center justify-center">
                    <div className="text-center mb-8">
                      <h1 className="text-2xl font-semibold text-gray-900">
                        A question creates knowledge
                      </h1>
                    </div>
                    
                    <div className="w-full max-w-2xl mx-auto mb-12">
                      <SearchBar 
                        loading={isLoading}
                        searchQuery={searchQuery}
                        processingQuery={processingQuery}
                        onSearch={handleSearch}
                        onNewConversation={handleNewConversation}
                        setSearchQuery={setSearchQuery}
                      />
                    </div>

                    <div className="w-full max-w-2xl grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 mx-auto px-2">
                      {randomQuestions.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => handleQuestionSelect(question, index)}
                          disabled={isLoading && loadingQuestionIndex === index}
                          className={cn(
                            "flex items-center",
                            "border rounded-xl shadow-sm hover:bg-[#F9FAFB]",
                            "ring-offset-background transition-colors",
                            "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                            "w-full p-4 text-left",
                            "bg-transparent",
                            isLoading && loadingQuestionIndex === index ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
                          )}
                        >
                          <span className="text-sm text-gray-900">{question}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Updated conversations view with enhanced scrolling
                  renderConversations()
                )}
              </div>
            </main>

            {!showInitialQuestions && (
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
                <div className="w-full max-w-4xl mx-auto px-4">
                  <SearchBar 
                    loading={isLoading}
                    searchQuery={searchQuery}
                    processingQuery={processingQuery}
                    onSearch={handleSearch}
                    onNewConversation={handleNewConversation}
                    setSearchQuery={setSearchQuery}
                    className="py-6"
                    isLarge={true}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
// SearchBar Component
const SearchBar = ({ 
  loading, 
  searchQuery, 
  processingQuery, 
  onSearch, 
  onNewConversation, 
  setSearchQuery,
  className,
  isLarge = false,
  disabled = false
}: {
  loading: boolean;
  searchQuery: string;
  processingQuery: string;
  onSearch: (e: React.FormEvent) => void;
  onNewConversation: () => void;
  setSearchQuery: (query: string) => void;
  className?: string;
  isLarge?: boolean;
  disabled?: boolean;
}) => {
  // Add handler for key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && searchQuery.trim()) {
        onSearch(e);
      }
    }
  };

  // Add button click handler
  const handleButtonClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await onNewConversation();
    } catch (error) {
      console.error('Error creating new conversation:', error);
    }
  };

  return (
    <div className="flex flex-col p-2 items-center w-full">
      <div className={cn(
        "w-full border rounded-[8px] flex items-center overflow-hidden",
        isLarge && "border-2",
        disabled && "bg-gray-50"
      )}>
        <form onSubmit={onSearch} className={cn(
          "flex w-full items-center gap-2 px-2",
          isLarge && "py-2"
        )}>
          <Button
            onClick={handleButtonClick}
            variant="ghost"
            size="icon"
            className={cn(
              "flex items-center justify-center flex-shrink-0",
              isLarge ? "h-[48px] w-[48px]" : "h-[42px] w-[42px]"
            )}
            disabled={disabled}
          >
            <PlusCircle className={cn(
              isLarge ? "h-6 w-6" : "h-5 w-5",
              disabled && "text-gray-400"
            )} />
          </Button>

          <Textarea
            value={loading ? processingQuery : searchQuery}
            onChange={(e) => !loading && setSearchQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask your question..."
            disabled={disabled}
            className={cn(
              "flex-grow",
              isLarge ? "text-lg" : "text-base",
              "transition-all duration-200 ease-out",
              "placeholder:text-gray-500",
              "focus:placeholder:opacity-0",
              "resize-none",
              "question-textarea",
              "hide-scrollbar",
              "border-none",
              "focus:outline-none",
              "focus:ring-0",
              "focus-visible:ring-0",
              "focus-visible:outline-none",
              "focus:border-0",
              "active:outline-none",
              "active:ring-0",
              "touch-none",
              "outline-none",
              "flex items-center",
              "py-0",
              "scrollbar-none",
              "overflow-hidden",
              loading && "opacity-50",
              disabled && "bg-transparent cursor-default"
            )}
            style={{
              minHeight: isLarge ? '48px' : '42px',
              height: searchQuery ? 'auto' : isLarge ? '48px' : '42px',
              resize: 'none',
              lineHeight: '1.5',
              outline: 'none',
              boxShadow: 'none',
              paddingTop: isLarge ? '12px' : '10px',
              paddingBottom: isLarge ? '12px' : '10px',
              overflow: 'hidden',
              msOverflowStyle: 'none',
              scrollbarWidth: 'none'
            }}
          />

          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className={cn(
              "flex items-center justify-center flex-shrink-0",
              isLarge ? "h-[48px] w-[48px]" : "h-[42px] w-[42px]"
            )}
            disabled={loading || disabled}
          >
            {loading ? (
              <span className="animate-spin">⌛</span>
            ) : (
              <ArrowRight className={cn(
                isLarge ? "h-6 w-6" : "h-5 w-5",
                disabled && "text-gray-400"
              )} />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

