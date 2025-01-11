'use client';

import Script from 'next/script';

export default function AmplitudeAnalytics() {
  return (
    <>
      <Script
        src="https://cdn.amplitude.com/script/35c4a2d643d284eac6ede1894580f06c.js"
        strategy="afterInteractive"
      />
      <Script id="amplitude-init" strategy="afterInteractive">
        {`
          window.amplitude.add(window.sessionReplay.plugin({sampleRate: 1}));
          window.amplitude.init('35c4a2d643d284eac6ede1894580f06c', {
            fetchRemoteConfig: true,
            autocapture: true
          });
        `}
      </Script>
    </>
  );
} 