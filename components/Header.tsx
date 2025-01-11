'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ShoppingBag, MessageCircle, Home, Menu, X, BookOpen, PlusCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

interface HeaderProps {
  sessions?: Session[];
  currentSessionId?: string;
  onSessionSelect?: (sessionId: string) => void;
  onNewConversation?: () => void;
}

interface Session {
  id: string;
  conversations: {
    question: string;
    timestamp: string;
  }[];
}

const Header = ({ 
  sessions = [], 
  currentSessionId = '', 
  onSessionSelect = () => {}, 
  onNewConversation = () => {} 
}: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const pathname = usePathname();

  const menuItems = [
    { href: "/", icon: Home, text: "Home" },
    { href: "/chat", icon: MessageCircle, text: "Chat" },
    { href: "/shop", icon: ShoppingBag, text: "Shop" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 bg-black text-white z-50">
      <div className="flex items-center justify-between h-20">
        <div className="flex items-center space-x-2 sm:space-x-4 pl-2 sm:pl-4">
          <button
            className="text-white focus:outline-none p-1 sm:p-2"
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu size={24} className="sm:w-7 sm:h-7" />
          </button>
          <Link href="/" className="ml-0 sm:ml-2">
            <Image
              src="/bents-logo.jpg"
              alt="Bent's Woodworking"
              width={80}
              height={32}
              priority
              className="h-8 sm:h-10 w-auto object-contain"
            />
          </Link>
          {pathname === '/chat' && (
            <button
              onClick={() => setShowHistory(true)}
              className="p-1 sm:p-2 text-white hover:text-gray-300 transition-colors flex items-center gap-1 sm:gap-2"
            >
              <BookOpen size={20} className="sm:w-6 sm:h-6" />
              <span className="hidden sm:inline">History</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4 pr-2 sm:pr-4">
          <Link 
            href="/chat" 
            className="p-1 sm:p-2 text-white hover:text-gray-300 transition-colors"
          >
            <MessageCircle size={24} className="sm:w-7 sm:h-7" />
          </Link>
          <Link 
            href="/shop" 
            className="p-1 sm:p-2 text-white hover:text-gray-300 transition-colors"
          >
            <ShoppingBag size={24} className="sm:w-7 sm:h-7" />
          </Link>
        </div>
      </div>

      {showHistory && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setShowHistory(false)}
          />
          <div className="fixed left-0 top-[80px] bottom-0 w-full sm:w-64 bg-white text-black border-r border-gray-200 p-3 sm:p-4 z-50 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <BookOpen size={24} className="text-gray-600" />
                <h2 className="text-lg font-semibold">History</h2>
              </div>
              <button 
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={24} />
              </button>
            </div>
            
            <button
              onClick={() => {
                onNewConversation();
                setShowHistory(false);
              }}
              className={cn(
                "flex items-center justify-center gap-2",
                "w-full py-3 px-4 mb-4",
                "bg-black text-white",
                "rounded-lg text-base sm:text-sm font-medium",
                "hover:bg-gray-800 transition-colors",
                "active:transform active:scale-95",
                "shadow-sm",
                "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              )}
            >
              <PlusCircle className="h-5 w-5" />
              <span>New Conversation</span>
            </button>

            <div className="overflow-y-auto h-[calc(100vh-220px)]">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    onSessionSelect(session.id);
                    setShowHistory(false);
                  }}
                  className={cn(
                    "w-full text-left p-4 rounded-lg mb-2",
                    "text-base sm:text-sm",
                    "hover:bg-gray-50 transition-colors",
                    "border border-gray-100",
                    session.id === currentSessionId 
                      ? "bg-gray-100 border-gray-200" 
                      : "bg-white"
                  )}
                >
                  {session.conversations[0]?.question || "New Conversation"}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50" 
          onClick={() => setIsMenuOpen(false)}
        >
          <div className="fixed top-0 left-0 h-full w-full sm:w-64 bg-white text-black shadow-lg">
            <div className="p-3 sm:p-4">
              <button 
                onClick={() => setIsMenuOpen(false)} 
                className="absolute top-3 right-3 sm:top-4 sm:right-4"
              >
                <X size={24} />
              </button>
              <ul className="mt-8">
                {menuItems.map((item, index) => (
                  <li key={index} className="mb-3 sm:mb-4">
                    <Link
                      href={item.href}
                      className="flex items-center text-black hover:text-gray-600 p-2"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <item.icon className="mr-2" size={20} />
                      {item.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
