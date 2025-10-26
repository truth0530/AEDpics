// 공통 Supabase 클라이언트 - 싱글톤 패턴
'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 환경 변수 (신규 DB: aieltmidsagiobpuebvv)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aieltmidsagiobpuebvv.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZWx0bWlkc2FnaW9icHVlYnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNzkzNTIsImV4cCI6MjA3NTY1NTM1Mn0.wUmjCxKdMGu9ZEPWd8VlcuuFD9WfZdl7yEJTKkW4Y_Y';

// 싱글톤 인스턴스
let supabaseClient: SupabaseClient | null = null;

/**
 * Supabase 클라이언트 가져오기
 * 싱글톤 패턴으로 단일 인스턴스만 유지
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

/**
 * 연결 상태 확인
 */
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('aed_data')
      .select('id')
      .limit(1);

    return !error && data !== null;
  } catch (error) {
    console.error('Supabase 연결 확인 실패:', error);
    return false;
  }
}

/**
 * 테이블 존재 여부 확인
 */
export async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from(tableName)
      .select('id')
      .limit(1);

    return !error;
  } catch {
    return false;
  }
}

// 환경 정보 export
export const SUPABASE_CONFIG = {
  url: supabaseUrl,
  hasKey: !!supabaseKey,
  environment: process.env.NODE_ENV
};