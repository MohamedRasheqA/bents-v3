'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowRight, PlusCircle, HelpCircle, ChevronRight, BookOpen, X } from 'lucide-react';
import Image from 'next/image';
import axios from 'axios';
import YouTube from 'react-youtube';
import { Button } from "@/components/ui/button";
import { v4 as uuidv4 } from 'uuid';
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from 'react-markdown';
import Sidebar from '@/components/Sidebar';

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
  const [showInitialQuestions, setShowInitialQuestions] = useState(true);
  const [randomQuestions, setRandomQuestions] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
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

  // Handlers
  const handleSearch = async (e: React.FormEvent<HTMLFormElement>, questionIndex?: number) => {
    e.preventDefault();
    const query = questionIndex !== undefined ? randomQuestions[questionIndex] : searchQuery;
    if (!query.trim() || loading) return;

    setLoading(true);
    setShowInitialQuestions(false);
    
    try {
      const response = await axios.post('/api/chat', {
        message: query,
        chat_history: currentConversation.map(conv => ({
          question: conv.question,
          answer: conv.initial_answer || conv.text
        }))
      });

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
    } catch (error) {
      console.error('Error in chat:', error);
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
    <form onSubmit={handleSearch} className="flex items-center gap-2">
      <Button
        type="button"
        onClick={handleNewConversation}
        variant="ghost"
        size="icon"
        className="flex-shrink-0"
      >
        <PlusCircle className="h-5 w-5" />
      </Button>

      <Textarea
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Ask your question..."
        className={cn(
          "flex-grow resize-none min-h-[42px]",
          "py-2 px-4 border-none",
          "focus:ring-2 focus:ring-blue-500"
        )}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSearch(e as any);
          }
        }}
      />

      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="flex-shrink-0"
        disabled={loading}
      >
        {loading ? (
          <div className="animate-spin">⌛</div>
        ) : (
          <ArrowRight className="h-5 w-5" />
        )}
      </Button>
    </form>
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

  // Main render
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSessionSelect={handleSessionSelect}
      />
      <div className="sticky top-0 bg-white border-b p-4 flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarOpen(true)}
          className="mr-4"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Chat Assistant</h1>
      </div>
      <main className="flex-grow container mx-auto px-4 py-8">
        {showInitialQuestions ? (
          <div className="max-w-2xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold text-center">
              Welcome to Chat Assistant
            </h1>
            <div className="space-y-4">
              {renderSearchBar()}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                {randomQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={(e) => handleSearch(e as any, index)}
                    className="p-4 text-left border rounded-lg hover:bg-gray-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {currentConversation.map((conv, index) =>
              renderConversation(conv, index)
            )}
            <div className="sticky bottom-0 bg-white p-4 border-t">
              {renderSearchBar()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}