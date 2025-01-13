// app/components/AmplitudeAnalytics.tsx
'use client';

import Script from 'next/script';

export default function AmplitudeAnalytics() {
  const AMPLITUDE_API_KEY = '2ebec7feee191712641de915f259fd72';
  
  return (
    <>
      <Script
        src="https://cdn.amplitude.com/amplitude-9.1.0-min.gz.js"
        strategy="beforeInteractive"
        onLoad={() => {
          console.log('Amplitude script loaded');
        }}
      />
      <Script id="amplitude-init" strategy="afterInteractive">
        {`
          try {
            if (window.amplitude) {
              amplitude.getInstance().init('${AMPLITUDE_API_KEY}', null, {
                includeReferrer: true,
                includeUtm: true,
                includeGclid: true,
                saveParamsReferrerOncePerSession: false,
              });
              console.log('Amplitude initialized successfully');
            } else {
              console.error('Amplitude object not found');
            }
          } catch (error) {
            console.error('Failed to initialize Amplitude:', error);
          }
        `}
      </Script>
    </>
  );
}
