import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { managementNumber, year = '2024' } = body;

    if (!managementNumber) {
      return NextResponse.json(
        { error: 'Management number is required' },
        { status: 400 }
      );
    }

    // 2025년은 아직 준비 중
    if (year === '2025') {
      return NextResponse.json(
        { error: '2025년 데이터는 준비 중입니다' },
        { status: 404 }
      );
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Call confirm function (2024년 함수)
    const { data, error } = await supabase.rpc('confirm_management_number_match', {
      p_management_number: managementNumber,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Failed to confirm matching:', error);
    return NextResponse.json(
      { error: 'Failed to confirm matching' },
      { status: 500 }
    );
  }
}
