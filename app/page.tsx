"use client";
import dynamic from 'next/dynamic';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Section1 from "@/components/Section1";
import { useAuthRedirect } from '@/lib/hooks/useAuthRedirect';

const AmplitudeDebug = dynamic(
  () => process.env.NODE_ENV === 'development'
    ? import('@/components/AmplitudeDebug')
    : Promise.resolve(() => null),
  { ssr: false }
);

export default function Home() {
  const { handleStartChatting, isSignedIn } = useAuthRedirect();

  return (
    <>
      <Header />
      <Section1 onStartChatting={handleStartChatting} isSignedIn={isSignedIn} />
      <Footer />
    </>
  );
}