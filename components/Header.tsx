import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, MessageCircle, Home, Menu, X, History } from 'lucide-react';
import { cn } from "@/lib/utils";
import { SignInButton, SignedIn, SignedOut, UserButton, useAuth } from '@clerk/nextjs';
import Image from 'next/image';

interface Session {
  id: string;
  conversations: {
    question: string;
    timestamp: string;
  }[];
}

interface HeaderProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewConversation: () => void;
  userId: string | null;
}

const Header = ({ 
  sessions, 
  currentSessionId, 
  onSessionSelect, 
  onNewConversation,
  userId 
}: HeaderProps) => {
  const { isSignedIn, isLoaded } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setIsHistoryOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleHistorySelect = (sessionId: string) => {
    onSessionSelect(sessionId);
    setIsHistoryOpen(false);
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const menuItems = [
    { href: "/", icon: Home, text: "Home" },
    { href: "/shop", icon: ShoppingBag, text: "Shop" },
    ...(isLoaded && isSignedIn ? [{ href: "/chat", icon: MessageCircle, text: "Chat" }] : []),
  ];

  return (
    <header className="fixed top-0 left-0 right-0 bg-black z-50">
      <div className="w-full px-12">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-4 pl-0">
            <button 
              className="text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            
            <Link href="/">
              <Image
                src="/bents-logo.jpg"
                alt="Bent's Woodworking"
                width={150}
                height={50}
                priority
                className="h-12 w-auto"
              />
            </Link>
          </div>

          <div className="flex items-center space-x-6 pr-0">
            {isLoaded && isSignedIn && pathname === '/chat' && (
              <button
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className="text-white hover:text-[rgba(23,155,215,255)]"
                title="Chat History"
              >
                <History size={24} />
              </button>
            )}

            {isLoaded && isSignedIn && (
              <Link 
                href="/chat" 
                className={cn(
                  "text-white hover:text-[rgba(23,155,215,255)]",
                  pathname === '/chat' && "text-[rgba(23,155,215,255)]"
                )}
              >
                <MessageCircle size={24} />
              </Link>
            )}

            <Link 
              href="/shop" 
              className={cn(
                "text-white hover:text-[rgba(23,155,215,255)]",
                pathname === '/shop' && "text-[rgba(23,155,215,255)]"
              )}
            >
              <ShoppingBag size={24} />
            </Link>

            <div>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="bg-[rgba(23,155,215,255)] text-white px-4 py-2 rounded-md hover:bg-[rgba(20,139,193,255)]">
                    Sign In
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserButton 
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      userButtonBox: "ml-0"
                    }
                  }}
                />
              </SignedIn>
            </div>
          </div>
        </div>

        {/* History Sidebar */}
        {isHistoryOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
            <div 
              ref={historyRef}
              className="fixed top-0 right-0 h-full w-80 bg-white transform transition-transform duration-300 ease-in-out overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Chat History</h2>
                  <button 
                    onClick={() => setIsHistoryOpen(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={() => {
                      onNewConversation();
                      setIsHistoryOpen(false);
                    }}
                    className="w-full px-4 py-2 text-white bg-[rgba(23,155,215,255)] rounded-md hover:bg-[rgba(20,139,193,255)]"
                  >
                    New Chat
                  </button>

                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => handleHistorySelect(session.id)}
                      className={cn(
                        "p-4 rounded-lg cursor-pointer transition-all",
                        "hover:bg-gray-100",
                        session.id === currentSessionId ? "bg-gray-100" : "bg-white",
                        "border border-gray-200"
                      )}
                    >
                      <p className="font-medium text-gray-900 line-clamp-2">
                        {session.conversations[0]?.question || "New conversation"}
                      </p>
                      {session.conversations[0]?.timestamp && (
                        <p className="text-sm text-gray-500 mt-1">
                          {formatDate(session.conversations[0].timestamp)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Menu */}
        {isMenuOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
            <div 
              ref={menuRef}
              className="fixed top-0 left-0 h-full w-64 bg-white transform transition-transform duration-300 ease-in-out"
            >
              <div className="p-4">
                <button 
                  onClick={() => setIsMenuOpen(false)} 
                  className="absolute top-4 right-4 text-black"
                >
                  <X size={24} />
                </button>
                <ul className="mt-8">
                  {menuItems.map((item, index) => (
                    <li key={index} className="mb-4">
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center text-black hover:text-gray-600",
                          pathname === item.href && "text-[rgba(23,155,215,255)]"
                        )}
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
      </div>
    </header>
  );
};

export default Header;