"use client";

import { createBrowserClient } from "@supabase/ssr";
import React, { createContext, useContext, useMemo } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

// Supabase 클라이언트 생성 함수 (싱글톤 패턴)
export function createClient() {
  if (browserClient) {
    return browserClient;
  }

  // 환경변수에서 공백과 개행문자 제거
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}

// Context 생성
const SupabaseContext = createContext<SupabaseClient | null>(null);

// Provider 컴포넌트
export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

// Hook으로 Supabase 클라이언트 사용
export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    // Context 밖에서 사용된 경우 새 클라이언트 생성
    return createClient();
  }
  return context;
}
