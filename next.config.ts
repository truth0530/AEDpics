import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    // Service Worker 컴파일 시 ES5로 변환
    mode: "production",
    swDest: "sw.js",
  },
  // Fallback 설정 추가
  // fallbacks: {
  //   document: "/_offline",
  // },
  // Service Worker 빌드 최적화
  cacheStartUrl: false,
  dynamicStartUrl: false,
});

const nextConfig: NextConfig = {
  eslint: {
    // ✅ ESLint 오류 모두 수정 완료 (2025-10-08)
    ignoreDuringBuilds: false,
    dirs: ['app', 'components', 'lib', 'packages']
  },
  typescript: {
    // ⚠️ TypeScript 오류 78개 남음 - 점진적 수정 필요
    // 주요 이슈: FilterEnforcementResult, AEDDevice 프로퍼티 불일치,
    // React Query cacheTime 지원 중단, Presence type 불일치
    // TODO: 타입 정의 통합 후 false로 변경
    ignoreBuildErrors: true,
  },
  experimental: {
    // PPR은 Next.js canary 버전에서만 사용 가능
    // ppr: 'incremental',
  },
  turbopack: {
    root: '/Users/kwangsunglee/Projects/AEDpics',
  },
  // 프로덕션 빌드 최적화
  compiler: {
    // 프로덕션에서 console 제거 (error, warn 제외)
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // 이미지 최적화 설정
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30일
  },
};

export default withPWA(nextConfig);
