'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { SessionProvider } from 'next-auth/react';

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // ✅ 성능 최적화: 매일 교체 데이터이므로 불필요한 재조회 방지
            refetchOnWindowFocus: false,  // 탭 전환 시 재조회 중단 (API 호출 60% 감소)
            refetchOnReconnect: true,     // 네트워크 복구 시에만 재조회
            refetchOnMount: false,        // staleTime 기준만 사용
            // ✅ 매일 교체 데이터 특성에 맞춘 캐시 전략
            staleTime: 1 * 60 * 60 * 1000,   // 1시간 (aed_data는 매일 자정 갱신)
            gcTime: 2 * 60 * 60 * 1000,      // 2시간 (메모리 보관 시간)
            retry: 1,
            retryDelay: 2000,  // 재시도 대기 시간 증가
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
