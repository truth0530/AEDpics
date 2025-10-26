import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { apiHandler } from '@/lib/api/error-handler';

export const POST = async (request: NextRequest) => {
  const supabase = await createClient();

    // 현재 로그인한 사용자 확인
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // 헤더에서 추가 정보 가져오기 (선택적)
    const headers = request.headers;
    const userAgent = headers.get('user-agent') || null;
    const ip = headers.get('x-forwarded-for') || headers.get('x-real-ip') || null;

    // 방법 1: 데이터베이스 함수 호출 (권장)
    const { error: functionError } = await supabase.rpc('record_user_login');

    if (functionError) {
      console.error('Error calling record_user_login:', functionError);

      // 함수가 없는 경우 직접 업데이트 (폴백)
      // 먼저 현재 login_count 가져오기
      const { data: currentProfile } = await supabase
        .from('user_profiles')
        .select('login_count')
        .eq('id', user.id)
        .single();

      const currentCount = currentProfile?.login_count || 0;

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          last_login_at: new Date().toISOString(),
          login_count: currentCount + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating user_profiles:', updateError);
      }

      // 로그인 이력 테이블에 직접 삽입 (테이블이 있는 경우)
      const { error: historyError } = await supabase
        .from('login_history')
        .insert({
          user_id: user.id,
          ip_address: ip,
          user_agent: userAgent
        })
        .select()
        .single();

      if (historyError) {
        console.warn('Login history insert failed:', historyError);
      }
    }

    // 현재 로그인 통계 가져오기
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('login_count, last_login_at')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      success: true,
      login_count: profile?.login_count || 0,
      last_login_at: profile?.last_login_at
    });
};