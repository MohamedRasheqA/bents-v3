'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, PlusCircle } from 'lucide-react';
import { useChat } from 'ai/react';
import { Button } from "@/components/ui/button";
import { v4 as uuidv4 } from 'uuid';
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import Header from '@/components/Header';
import YouTube from 'react-youtube';
import ChatHistory from '@/components/ChatHistory';
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
    <div ref={conversationRef} className="w-full max-w-full bg-white rounded-lg shadow-sm p-6 mb-4 overflow-hidden" style={{ fontFamily: systemFontFamily }}>
      {/* Question Section */}
      <div className="mb-4 pb-4 border-b">
        <div className="flex items-center gap-2">
          <p className="text-gray-800 break-words font-bold" style={{ fontFamily: systemFontFamily }}>{conv.question}</p>
        </div>
      </div>

      {/* Answer Section - Updated for consistent containment */}
      <div className="prose prose-sm max-w-none">
        <div className="relative w-full overflow-hidden">
          <div 
            className="text-gray-800 font-normal"
            style={{ 
              fontFamily: systemFontFamily,
              maxWidth: '100%',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'pre-wrap'
            }}
          >
            <ReactMarkdown
              className="markdown-content"
              components={{
                root: ({ children, ...props }) => (
                  <div className="w-full overflow-hidden" {...props}>{children}</div>
                ),
                pre: ({ children, ...props }) => (
                  <pre 
                    className="w-full p-2 rounded-lg my-1 whitespace-pre-wrap break-words overflow-x-auto"
                    style={{
                      maxWidth: '100%',
                      wordBreak: 'break-word'
                    }}
                    {...props}
                  >
                    {children}
                  </pre>
                ),
                code: ({ children, inline, ...props }) => (
                  inline ? 
                    <code 
                      className="rounded px-1 whitespace-normal break-words" 
                      style={{ wordBreak: 'break-word' }}
                      {...props}
                    >
                      {children}
                    </code> :
                    <code 
                      className="block w-full whitespace-pre-wrap break-words overflow-x-auto"
                      style={{
                        maxWidth: '100%',
                        wordBreak: 'break-word'
                      }}
                      {...props}
                    >
                      {children}
                    </code>
                ),
                p: ({ children, ...props }) => (
                  <p 
                    className="text-lg leading-relaxed w-full whitespace-pre-wrap break-words"
                    style={{
                      maxWidth: '100%',
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                      fontFamily: systemFontFamily,
                      fontWeight: 'normal',
                      lineHeight: '1.5'
                    }}
                    {...props}
                  >
                    {children}
                  </p>
                ),
                h1: ({ children, ...props }) => (
                  <h1 className="text-lg font-medium w-full break-words" style={{ fontFamily: systemFontFamily, lineHeight: '1.5' }} {...props}>{children}</h1>
                ),
                h2: ({ children, ...props }) => (
                  <h2 className="text-lg font-medium w-full break-words" style={{ fontFamily: systemFontFamily, lineHeight: '1.5' }} {...props}>{children}</h2>
                ),
                h3: ({ children, ...props }) => (
                  <h3 className="text-lg font-medium w-full break-words" style={{ fontFamily: systemFontFamily, lineHeight: '1.5' }} {...props}>{children}</h3>
                ),
                ul: ({ children, ...props }) => (
                  <ul className="text-lg list-disc pl-6 w-full break-words" style={{ fontFamily: systemFontFamily, lineHeight: '1.5' }} {...props}>{children}</ul>
                ),
                ol: ({ children, ...props }) => (
                  <ol className="text-lg list-decimal pl-6 w-full break-words" style={{ fontFamily: systemFontFamily, lineHeight: '1.5' }} {...props}>{children}</ol>
                ),
                li: ({ children, ...props }) => (
                  <li className="text-lg w-full break-words" style={{ fontFamily: systemFontFamily, lineHeight: '1.5' }} {...props}>{children}</li>
                )
              }}
            >
              {conv.text}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Videos Section */}
      {conv.videoLinks && Object.keys(conv.videoLinks).length > 0 && (
        <div className="mt-4 overflow-hidden">
          <h3 className="text-base font-semibold mb-3" style={{ fontFamily: systemFontFamily }}>Related Videos</h3>
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
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2 break-words" style={{ fontFamily: systemFontFamily }}>
                      {info.video_title}
                    </h4>
                    {info.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2 break-words" style={{ fontFamily: systemFontFamily }}>
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
        <div className="mt-4 overflow-hidden">
          <h3 className="text-base font-semibold mb-3" style={{ fontFamily: systemFontFamily }}>Related Products</h3>
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

// Main Chat Page Component
export default function ChatPage() {
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

  const { messages, append, isLoading } = useChat({
    api: '/api/chat',
    initialMessages: [],
    onResponse: (response) => {
      console.log('First API Response:', response);
      setIsStreaming(true);
      setLoadingProgress(3);
      setError(null);
      setWsError(null);
    },
    onFinish: async (message) => {
      console.log('First API Finished:', message);
      const currentQuestion = currentQuestionRef.current;
      console.log('Current question from ref:', currentQuestion);
      
      setIsStreaming(false);
      
      if (!currentQuestion?.trim()) {
        console.log('No question available in ref');
        return;
      }
  
      // Start second API call
      setIsSecondResponseLoading(true);
      try {
        console.log('Starting second API call with question:', currentQuestion);

        const requestPayload = {
          messages: [{
              role: 'user', 
            content: currentQuestion,
          }, {
            role: 'assistant',
            content: message.content
          }]
        };

        const linksResponse = await axios.post('/api/links', requestPayload);
        console.log('Links API Response:', linksResponse.data);
        
          if (linksResponse.data.status === 'not_relevant') {
            console.log('Query marked as not relevant');
          setIsSecondResponseLoading(false);
            return;
        }

        // Update conversation history with complete response
        const newConversation = {
          id: uuidv4(),
          question: currentQuestion,
          text: message.content,
          timestamp: new Date().toISOString(),
          videoLinks: linksResponse.data.videoReferences || {},
          related_products: linksResponse.data.relatedProducts || []
        };
        
        setCurrentConversation(prev => [...prev, newConversation]);
        setSessions(prev =>
          prev.map(session =>
            session.id === currentSessionId
              ? { ...session, conversations: [...session.conversations, newConversation] }
              : session
          )
        );

      } catch (error) {
        console.error('Error in second API:', error);
        if (axios.isAxiosError(error)) {
          console.error('Axios Error Details:', {
            response: error.response?.data,
            status: error.response?.status,
            message: error.message
          });
          setError(`Error: ${error.response?.data?.message || error.message}`);
        } else {
          console.error('Non-Axios Error:', error);
          setError('Error fetching related links and products');
        }
      } finally {
        setIsSecondResponseLoading(false);
        setProcessingQuery("");
      }
    }
  });

  // Update handleSearch
  const handleSearch = async (e: React.FormEvent | null, index?: number) => {
    if (e) e.preventDefault();
    const query = index !== undefined ? randomQuestions[index] : searchQuery;
    
    if (!query.trim() || isLoading) return;
    
    setProcessingQuery(query);
    currentQuestionRef.current = query;
    setShowInitialQuestions(false);
    
    try {
      await append({
        role: 'user',
        content: query,
        createdAt: new Date()
      });

      setSearchQuery("");
    } catch (error) {
      console.error('Search Error:', error);
      setError('Error processing your request');
    }
  };

  // Handle new conversation creation
  const handleNewConversation = () => {
    const newSessionId = uuidv4();
    const newSession = { id: newSessionId, conversations: [] };
    
    setSessions(prev => [...prev, newSession]);
    setCurrentSessionId(newSessionId);
    setCurrentConversation([]);
    setShowInitialQuestions(true);
    currentQuestionRef.current = "";
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

  // Render all conversations including history
  const renderConversations = () => (
    <div className="w-full">
      {currentConversation.map((conv, index) => (
        <ConversationItem 
          key={conv.id}
          conv={conv}
          index={index}
          isLatest={index === currentConversation.length - 1}
        />
      ))}
      {isLoading && !isStreaming && (
        <ProcessingCard 
          query={processingQuery} 
          loadingProgress={loadingProgress}
          setLoadingProgress={setLoadingProgress}
        />
      )}
      {(isStreaming || isSecondResponseLoading) && processingQuery && messages.length > 0 && (
        <div className="w-full bg-white rounded-lg shadow-sm p-6 mb-4 overflow-hidden">
          {isStreaming && (
            <div className="mb-4 pb-4 border-b">
              <div className="flex items-center gap-2">
                <p className="text-gray-800 break-words font-bold" style={{ fontFamily: systemFontFamily }}>{processingQuery}</p>
              </div>
            </div>
          )}
          {/* Answer Section */}
          <div className="prose prose-sm max-w-none overflow-hidden">
            <div className="w-full overflow-hidden">
              <ReactMarkdown
                className="markdown-content break-words whitespace-pre-wrap overflow-hidden"
                components={{
                  root: ({ children, ...props }) => (
                    <div className="w-full overflow-hidden" {...props}>{children}</div>
                  ),
                  pre: ({ children, ...props }) => (
                    <pre 
                      className="w-full p-2 rounded-lg my-1 whitespace-pre-wrap break-words overflow-x-auto"
                      style={{
                        maxWidth: '100%',
                        wordBreak: 'break-word'
                      }}
                      {...props}
                    >
                      {children}
                    </pre>
                  ),
                  code: ({ children, inline, ...props }) => (
                    inline ? 
                      <code 
                        className="rounded px-1 whitespace-normal break-words" 
                        style={{ wordBreak: 'break-word' }}
                        {...props}
                      >
                        {children}
                      </code> :
                      <code 
                        className="block w-full whitespace-pre-wrap break-words overflow-x-auto"
                        style={{
                          maxWidth: '100%',
                          wordBreak: 'break-word'
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                  ),
                  p: ({ children, ...props }) => (
                    <p 
                      className="text-lg leading-relaxed w-full whitespace-pre-wrap break-words"
                      style={{
                        maxWidth: '100%',
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                        fontFamily: systemFontFamily,
                        fontWeight: 'normal',
                        lineHeight: '1.5'
                      }}
                      {...props}
                    >
                      {children}
                    </p>
                  ),
                  h1: ({ children, ...props }) => (
                    <h1 className="text-lg font-medium w-full break-words" style={{ fontFamily: systemFontFamily, lineHeight: '1.5' }} {...props}>{children}</h1>
                  ),
                  h2: ({ children, ...props }) => (
                    <h2 className="text-lg font-medium w-full break-words" style={{ fontFamily: systemFontFamily, lineHeight: '1.5' }} {...props}>{children}</h2>
                  ),
                  h3: ({ children, ...props }) => (
                    <h3 className="text-lg font-medium w-full break-words" style={{ fontFamily: systemFontFamily, lineHeight: '1.5' }} {...props}>{children}</h3>
                  ),
                  ul: ({ children, ...props }) => (
                    <ul className="text-lg list-disc pl-6 w-full break-words" style={{ fontFamily: systemFontFamily, lineHeight: '1.5' }} {...props}>{children}</ul>
                  ),
                  ol: ({ children, ...props }) => (
                    <ol className="text-lg list-decimal pl-6 w-full break-words" style={{ fontFamily: systemFontFamily, lineHeight: '1.5' }} {...props}>{children}</ol>
                  ),
                  li: ({ children, ...props }) => (
                    <li className="text-lg w-full break-words" style={{ fontFamily: systemFontFamily, lineHeight: '1.5' }} {...props}>{children}</li>
                  )
                }}
              >
                {messages[messages.length - 1].content}
              </ReactMarkdown>
            </div>
          </div>

          {/* Show skeleton loaders during second API call */}
          {isSecondResponseLoading && (
            <div className="mt-4 border-t pt-4">
              {/* Videos skeleton */}
              <div className="mb-4">
                <h3 className="text-base font-semibold mb-3">Related Videos</h3>
                <div className="flex overflow-x-auto space-x-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex-none w-[280px] bg-white border rounded-lg overflow-hidden">
                      <div className="aspect-video w-full bg-gray-200 animate-pulse" />
                      <div className="p-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
                        <div className="mt-2 h-3 bg-gray-200 rounded animate-pulse w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Products skeleton */}
              <div>
                <h3 className="text-base font-semibold mb-3">Related Products</h3>
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
          )}
        </div>
      )}
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
    
    // Create a div to show the processing UI
    const processingDiv = (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white rounded-lg p-6 mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">A question creates knowledge</h2>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <div className="flex-grow">
                <p className="text-gray-800 break-words font-bold">{question}</p>
              </div>
            </div>
          </div>
        </div>
        <ProcessingCard 
          query={question} 
          loadingProgress={loadingProgress}
          setLoadingProgress={setLoadingProgress}
        />
      </div>
    );

    // Show processing UI first
    setCurrentConversation([]);
    setTimeout(() => {
      handleSearch(null, index);
    }, 500);
  };

  const handleSessionSelect = (sessionId: string) => {
    const selectedSession = sessions.find(session => session.id === sessionId);
    if (selectedSession) {
      setCurrentSessionId(sessionId);
      setCurrentConversation(selectedSession.conversations);
      setShowInitialQuestions(selectedSession.conversations.length === 0);
    }
  };

  // Main render
  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA]">
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto">
          <div className="min-h-screen">
            <Header 
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSessionSelect={handleSessionSelect}
              onNewConversation={handleNewConversation}
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
              currentConversation.length > 0 ? "pb-[80px]" : "min-h-[calc(100vh-64px)]",
            )}>
              <div className="w-full max-w-5xl mx-auto">
                {showInitialQuestions ? (
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

                    <div className="w-full max-w-4xl grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 px-4">
                      {randomQuestions.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => handleQuestionSelect(question, index)}
                          disabled={isLoading && loadingQuestionIndex === index}
                          className={cn(
                            "flex items-center bg-background",
                            "border rounded-xl shadow-sm hover:bg-gray-50",
                            "ring-offset-background transition-colors",
                            "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                            "w-full p-4 text-left",
                            isLoading && loadingQuestionIndex === index ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex-shrink-0">
                              <PlusCircle className="h-5 w-5 text-gray-400" />
                            </div>
                            <span className="text-sm text-gray-900">{question}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="w-full overflow-hidden">
                    {renderConversations()}
                    <div ref={messageEndRef} />
                  </div>
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
  isLarge = false
}: {
  loading: boolean;
  searchQuery: string;
  processingQuery: string;
  onSearch: (e: React.FormEvent) => void;
  onNewConversation: () => void;
  setSearchQuery: (query: string) => void;
  className?: string;
  isLarge?: boolean;
}) => (
  <div className="flex flex-col items-center w-full">
    <div className={cn(
      "w-full border rounded-[8px] flex items-center",
      isLarge && "border-2"
    )}>
      <form onSubmit={onSearch} className={cn(
        "flex w-full items-center gap-2 px-2",
        isLarge && "py-2"
      )}>
        <Button
          onClick={onNewConversation}
          variant="ghost"
          size="icon"
          className={cn(
            "flex items-center justify-center flex-shrink-0",
            isLarge ? "h-[48px] w-[48px]" : "h-[42px] w-[42px]"
          )}
        >
          <PlusCircle className={cn(
            isLarge ? "h-6 w-6" : "h-5 w-5"
          )} />
        </Button>

        <Textarea
          value={loading ? processingQuery : searchQuery}
          onChange={(e) => !loading && setSearchQuery(e.target.value)}
          placeholder="Ask your question..."
          className={cn(
            "flex-grow",
            "py-2 px-4",
            isLarge ? "text-lg" : "text-base",
            "transition-all duration-200 ease-out",
            "placeholder:text-gray-500",
            "focus:placeholder:opacity-0",
            "resize-none",
            "question-textarea",
            "hide-scrollbar",
            "border-none",
            "focus:outline-none",
            loading && "opacity-50",
            !searchQuery && "flex items-center"
          )}
          style={{
            minHeight: isLarge ? '48px' : '42px',
            height: searchQuery ? 'auto' : isLarge ? '48px' : '42px',
            resize: 'none',
            lineHeight: '1.5',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSearch(e as any);
            }
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
          disabled={loading}
        >
          {loading ? (
            <span className="animate-spin">⌛</span>
          ) : (
            <ArrowRight className={cn(
              isLarge ? "h-6 w-6" : "h-5 w-5"
            )} />
          )}
        </Button>
      </form>
    </div>
  </div>
);

// ProcessingCard Component
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
    <div className="w-full bg-white rounded-lg p-6">
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
