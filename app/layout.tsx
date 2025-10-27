import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import { KAKAO_MAP_CONFIG } from "@/lib/constants/kakao";
import "./globals.css";
import { Providers } from "./providers";

// NCP 배포 환경 URL (Vercel에서 완전히 분리됨)
const defaultUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const kakaoMapSdkUrl = KAKAO_MAP_CONFIG.getScriptUrl();

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "AED 픽스 - 전국 AED 통합 관리 시스템",
  description: "전국 80,000대 AED 통합 관리 및 점검 시스템 - 중앙응급의료센터",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml' }
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AED Check',
  },
};

export const viewport: Viewport = {
  themeColor: '#22c55e',
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Suppress extension-related console errors
              (function() {
                const originalError = console.error;
                const originalWarn = console.warn;

                console.error = function(...args) {
                  const message = args.join(' ');
                  // Filter out common extension and manifest errors
                  if (
                    message.includes('chrome-extension://') ||
                    message.includes('Extension manifest') ||
                    message.includes('ERR_FILE_NOT_FOUND') ||
                    message.includes('runtime.lastError') ||
                    message.includes('FrameDoesNotExistError') ||
                    message.includes('Manifest: Line:')
                  ) {
                    return;
                  }
                  originalError.apply(console, args);
                };

                console.warn = function(...args) {
                  const message = args.join(' ');
                  if (message.includes('chrome-extension://')) {
                    return;
                  }
                  originalWarn.apply(console, args);
                };

                // Handle unhandled promise rejections
                window.addEventListener('unhandledrejection', function(e) {
                  if (e.reason && e.reason.message && e.reason.message.includes('chrome-extension://')) {
                    e.preventDefault();
                  }
                });
              })();
            `,
          }}
        />
      </head>
      <body className={`${geistSans.className} antialiased`}>
        <Script
          id="kakao-map-sdk"
          data-kakao-sdk="true"
          src={kakaoMapSdkUrl}
          strategy="beforeInteractive"
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
