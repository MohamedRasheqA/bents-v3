'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShoppingBag, MessageCircle, Home, Menu, X } from 'lucide-react';

// Define menu items type
type MenuItem = {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  text: string;
};

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const menuItems: MenuItem[] = [
    { href: "/", icon: Home, text: "Home" },
    { href: "/chat", icon: MessageCircle, text: "Chat" },
    { href: "/shop", icon: ShoppingBag, text: "Shop" },
  ];

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setIsMenuOpen(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-black text-white z-50">
      <div className="container mx-auto">
        <div className="flex items-center justify-between h-20 px-4">
          {/* Left side - Menu button and Logo */}
          <div className="flex items-center">
            <button
              className="text-white focus:outline-none p-2"
              onClick={() => setIsMenuOpen(true)}
            >
              <Menu size={28} />
            </button>
            <Link href="/" className="ml-4">
              <Image
                src="/bents-logo.jpg"
                alt="Bent's Woodworking"
                width={100}
                height={40}
                priority
                className="h-10 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Right side - Navigation Icons */}
          <div className="flex items-center space-x-4">
            <Link 
              href="/chat" 
              className="p-2 text-white hover:text-gray-300 transition-colors"
            >
              <MessageCircle size={28} />
            </Link>
            <Link 
              href="/shop" 
              className="p-2 text-white hover:text-gray-300 transition-colors"
            >
              <ShoppingBag size={28} />
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50" 
          onClick={handleOverlayClick}
        >
          <div className="fixed top-0 left-0 h-full w-64 bg-white text-black shadow-lg transition-transform duration-300 ease-in-out transform translate-x-0">
            <div className="p-4">
              <button 
                onClick={toggleMenu} 
                className="absolute top-4 right-4 text-black hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
              <ul className="mt-8">
                {menuItems.map((item, index) => (
                  <li key={index} className="mb-4">
                    <Link
                      href={item.href}
                      className="flex items-center text-black hover:text-gray-600 transition-colors p-2 rounded-md hover:bg-gray-100"
                      onClick={toggleMenu}
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
