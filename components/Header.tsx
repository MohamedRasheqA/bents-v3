'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, MessageCircle, Home, Menu, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { SignInButton, SignedIn, SignedOut, UserButton, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Session {
  id: string;
  conversations: {
    question: string;
    timestamp: string;
  }[];
}

interface HeaderProps {
  sessions?: Session[];
  currentSessionId?: string;
  onSessionSelect?: (sessionId: string) => void;
  onNewConversation?: () => void;
}

const Header = ({ sessions = [], currentSessionId = '', onSessionSelect = () => {}, onNewConversation = () => {} }: HeaderProps) => {
  const { isSignedIn, isLoaded } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setIsMenuOpen(false);
    }
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

        {isMenuOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={handleOverlayClick}
          >
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