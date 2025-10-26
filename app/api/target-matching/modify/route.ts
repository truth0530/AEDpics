import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { managementNumber, newTargetKey } = body;

    if (!managementNumber || !newTargetKey) {
      return NextResponse.json(
        { error: 'Management number and new target key are required' },
        { status: 400 }
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

    // Call modify function
    const { data, error } = await supabase.rpc('modify_management_number_match', {
      p_management_number: managementNumber,
      p_new_target_key: newTargetKey,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Failed to modify matching:', error);
    return NextResponse.json(
      { error: 'Failed to modify matching' },
      { status: 500 }
    );
  }
}
