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
const loadSavedData = () => {
  const defaultSession = { id: uuidv4(), conversations: [] };
  return {
    sessions: [defaultSession],
    currentId: defaultSession.id,
    conversations: []
  };
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
    <div ref={conversationRef} className="w-full bg-white rounded-lg shadow-sm p-6 mb-4">
      {/* Question Section */}
      <div className="mb-4 pb-4 border-b">
        <div className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-gray-400" />
          <p className="text-gray-800">{conv.question}</p>
        </div>
      </div>

      {/* Answer Section - Updated styling */}
      <div className="prose prose-sm max-w-none">
        <div className="text-gray-800 font-normal break-words [&>p]:mb-4 [&>p]:leading-relaxed [&>h1]:text-xl [&>h1]:font-medium [&>h1]:mb-4 [&>h2]:text-lg [&>h2]:font-medium [&>h2]:mb-3 [&>h3]:text-base [&>h3]:font-medium [&>h3]:mb-2">
          <ReactMarkdown>{conv.text}</ReactMarkdown>
        </div>
      </div>

      {/* Videos Section */}
      {conv.videoLinks && Object.keys(conv.videoLinks).length > 0 && (
        <div className="mt-4">
          <h3 className="text-base font-semibold mb-3">Related Videos</h3>
          <div className="flex overflow-x-auto space-x-4">
            {Object.entries(conv.videoLinks).map(([key, info]) => {
              const videoId = getYoutubeVideoId(info.urls[0]);
              if (!videoId) return null;
              
              return (
                <div key={key} className="flex-none w-[280px] bg-white border rounded-lg overflow-hidden flex flex-col">
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
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
                      {info.video_title}
                    </h4>
                    {info.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {info.description}
                      </p>
                    )}
                    <div className="flex items-center text-xs text-gray-500">
                      <span>Starts at {info.timestamp}</span>
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
        <div className="mt-4">
          <h3 className="text-base font-semibold mb-3">Related Products</h3>
          <div className="flex overflow-x-auto space-x-4 pb-2">
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
  // Load saved data on initial render
  const { sessions: initialSessions, currentId: initialCurrentId, conversations: initialConversations } = loadSavedData();

  // Error states
  const [error, setError] = useState<string | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);

  // Initialize with saved session
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [currentSessionId, setCurrentSessionId] = useState<string>(initialCurrentId);
  const [currentConversation, setCurrentConversation] = useState<Conversation[]>(initialConversations);
  
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

  // Update handleSearch to use ref
  const handleSearch = async (e: React.FormEvent | null, index?: number) => {
    if (e) e.preventDefault();
    const query = index !== undefined ? randomQuestions[index] : searchQuery;
    
    if (!query.trim() || isLoading) return;
    
    setProcessingQuery(query);
    currentQuestionRef.current = query; // Update ref instead of state
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
    }
  };

  // Update handleNewConversation to reset ref
  const handleNewConversation = () => {
    const newSessionId = uuidv4();
    setSessions(prev => [...prev, { id: newSessionId, conversations: [] }]);
    setCurrentSessionId(newSessionId);
    setShowInitialQuestions(true);
    currentQuestionRef.current = ""; // Reset ref
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
        <div className="w-full bg-white rounded-lg shadow-sm p-6 mb-4">
          {/* Question Section */}
          <div className="mb-4 pb-4 border-b">
            <div className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-gray-400" />
              <p className="text-gray-800">{processingQuery}</p>
            </div>
          </div>

          {/* Answer Section - Updated styling */}
          <div className="prose prose-sm max-w-none">
            <div className="text-gray-800 font-normal break-words [&>p]:mb-4 [&>p]:leading-relaxed [&>h1]:text-xl [&>h1]:font-medium [&>h1]:mb-4 [&>h2]:text-lg [&>h2]:font-medium [&>h2]:mb-3 [&>h3]:text-base [&>h3]:font-medium [&>h3]:mb-2">
              <ReactMarkdown>{messages[messages.length - 1].content}</ReactMarkdown>
            </div>
          </div>

          {/* Show skeleton loaders during second API call */}
          {isSecondResponseLoading && (
            <div className="mt-8">
              {/* Videos skeleton */}
              <div className="mb-8">
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
                      <div className="mt-2 flex gap-1">
                        <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
                        <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
                      </div>
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
    }
  }, [currentSessionId, sessions]);

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

  // Effect to save sessions and current ID
  useEffect(() => {
    try {
      const updatedSessions = sessions.map(session => {
        if (session.id === currentSessionId) {
          return { ...session, conversations: currentConversation };
        }
        return session;
      });
      localStorage.setItem('chatSessions', JSON.stringify(updatedSessions));
      localStorage.setItem('currentSessionId', currentSessionId);
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }, [currentConversation, currentSessionId, sessions]);

  // Handlers
  const handleQuestionSelect = (question: string, index: number) => {
    setLoadingQuestionIndex(index);
    handleSearch(null, index);
  };

  const handleSessionSelect = (sessionId: string) => {
    const selectedSession = sessions.find(session => session.id === sessionId);
    if (selectedSession) {
      setCurrentSessionId(sessionId);
      setCurrentConversation(selectedSession.conversations);
      setShowInitialQuestions(selectedSession.conversations.length === 0);
    }
  };

  // Add effect to clear localStorage before page refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.clear();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Main render
  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA] overflow-x-hidden">
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
        "flex-grow w-full",
        "flex flex-col items-center",
        "pt-20",
        currentConversation.length > 0 ? "pb-[80px]" : "h-[calc(100vh-64px)]",
      )}>
        {showInitialQuestions ? (
          <div className="w-full h-full flex flex-col items-center justify-center px-4">
            <div className="text-center mb-16">
              <h1 className="text-4xl font-semibold text-[#1E1E1E]">
                A question creates knowledge
              </h1>
            </div>
            
            <div className="w-full max-w-3xl mx-auto mb-16">
              <SearchBar 
                loading={isLoading}
                searchQuery={searchQuery}
                processingQuery={processingQuery}
                onSearch={handleSearch}
                onNewConversation={handleNewConversation}
                setSearchQuery={setSearchQuery}
              />
            </div>

            <div className="w-full grid gap-4 grid-cols-1 sm:grid-cols-3 max-w-7xl mx-auto">
              {randomQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={(e) => handleSearch(e as any, index)}
                  disabled={isLoading && loadingQuestionIndex === index}
                  className={cn(
                    "min-h-[50px]",
                    "p-4",
                    "text-left rounded-lg",
                    "bg-white hover:bg-gray-50",
                    "border border-gray-200",
                    "text-sm text-gray-800",
                    "shadow-sm transition-all duration-200",
                    "hover:shadow-md",
                    "flex items-center",
                    "w-full",
                    isLoading && loadingQuestionIndex === index ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
                  )}
                >
                  <span className="line-clamp-2">{question}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full max-w-4xl px-4">
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
                <div className="w-full bg-white rounded-lg shadow-sm p-6 mb-4">
                  {/* Question Section */}
                  <div className="mb-4 pb-4 border-b">
                    <div className="flex items-center gap-2">
                      <PlusCircle className="h-5 w-5 text-gray-400" />
                      <p className="text-gray-800">{processingQuery}</p>
                    </div>
                  </div>

                  {/* Answer Section - Updated styling */}
                  <div className="prose prose-sm max-w-none">
                    <div className="text-gray-800 font-normal break-words [&>p]:mb-4 [&>p]:leading-relaxed [&>h1]:text-xl [&>h1]:font-medium [&>h1]:mb-4 [&>h2]:text-lg [&>h2]:font-medium [&>h2]:mb-3 [&>h3]:text-base [&>h3]:font-medium [&>h3]:mb-2">
                      <ReactMarkdown>{messages[messages.length - 1].content}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Show skeleton loaders during second API call */}
                  {isSecondResponseLoading && (
                    <div className="mt-8">
                      {/* Videos skeleton */}
                      <div className="mb-8">
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
                              <div className="mt-2 flex gap-1">
                                <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
                                <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
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
              className="p-4"
            />
          </div>
        </div>
      )}
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
  className 
}: {
  loading: boolean;
  searchQuery: string;
  processingQuery: string;
  onSearch: (e: React.FormEvent) => void;
  onNewConversation: () => void;
  setSearchQuery: (query: string) => void;
  className?: string;
}) => (
  <form onSubmit={onSearch} className={cn("flex items-center gap-2", className)}>
    <div className="relative flex-grow">
      <div className="absolute left-2 top-1/2 -translate-y-1/2">
        <Button
          type="button"
          onClick={onNewConversation}
          variant="ghost"
          size="sm"
          className="p-1 hover:bg-transparent"
        >
          <PlusCircle className="h-5 w-5 text-gray-400" />
        </Button>
      </div>
      <Textarea
        value={loading ? processingQuery : searchQuery}
        onChange={(e) => !loading && setSearchQuery(e.target.value)}
        placeholder="Ask your question..."
        disabled={loading}
        className="flex-grow resize-none min-h-[50px] py-3 pl-12 pr-12 border rounded-lg"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSearch(e as any);
          }
        }}
      />
      <Button 
        type="submit" 
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2" 
        disabled={loading}
      >
        {loading ? <div className="animate-spin">⌛</div> : <ArrowRight className="h-5 w-5" />}
      </Button>
    </div>
  </form>
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
  const processingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollToCard = () => {
      processingRef.current?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'center'
      });
    };
    scrollToCard();
  }, []);

  useEffect(() => {
    if (loadingProgress < 3) {
      const timer = setTimeout(() => {
        setLoadingProgress(prev => Math.min(prev + 1, 3));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loadingProgress, setLoadingProgress]);

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4 w-full">
        <div className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-gray-400" />
          <p className="text-gray-800">{query}</p>
        </div>
      </div>
      <div ref={processingRef} className="bg-white rounded-lg shadow-sm p-6 mb-4 w-full">
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
                  ) : isCurrent && isLastStep ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      isCurrent ? "bg-white" : "bg-gray-300"
                    )} />
                  )}
                </div>
                <span className={cn(
                  "text-sm",
                  isComplete || isCurrent ? "text-gray-900" : "text-gray-400"
                )}>
                  {step}
                  {isCurrent && isLastStep && "..."}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
