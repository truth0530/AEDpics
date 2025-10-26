/**
 * Debug API - Check if emails exist in auth.users
 * This endpoint should be removed after debugging
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    const { emails } = await request.json();

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json(
        { error: 'emails array is required' },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      return NextResponse.json(
        { error: 'Failed to list users', details: authError },
        { status: 500 }
      );
    }

    const results = emails.map(email => {
      const user = authData.users.find(u => u.email === email);
      return {
        email,
        exists: !!user,
        created_at: user?.created_at || null,
        user_id: user?.id || null,
        email_confirmed: user?.email_confirmed_at || null
      };
    });

    return NextResponse.json({
      total_users: authData.users.length,
      checked: results
    });

  } catch (error) {
    console.error('[Debug API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}
