'use client';

import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Section1 from "@/components/Section1";
import { useAuthRedirect } from '@/lib/hooks/useAuthRedirect';
                   
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
