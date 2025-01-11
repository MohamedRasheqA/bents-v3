import { ClerkProvider } from '@clerk/nextjs';
import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { initAmplitude } from '@/lib/amplitude';
import AmplitudeAnalytics from '@/components/AmplitudeAnalytics';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Initialize Amplitude on client side only
if (typeof window !== 'undefined') {
  initAmplitude();
}

export const metadata: Metadata = {
  title: "Bents Woodworking Assistant",
  description: "A woodworking assistant for Bents",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <AmplitudeAnalytics />
        </head>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
