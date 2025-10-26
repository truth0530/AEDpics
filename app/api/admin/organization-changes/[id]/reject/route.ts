import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/organization-changes/[id]/reject
 *
 * DEPRECATED: This feature requires organization_change_requests table
 * which is not yet implemented in the database schema.
 *
 * Status: Not Implemented (501)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    {
      error: 'Not Implemented',
      message: 'Organization change request feature is not yet available. The required database table has not been created.'
    },
    { status: 501 }
  );
}
