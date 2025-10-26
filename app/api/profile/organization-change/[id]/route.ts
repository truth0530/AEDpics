import { NextRequest, NextResponse } from 'next/server';

/**
 * DELETE /api/profile/organization-change/[id]
 *
 * DEPRECATED: This feature requires organization_change_requests table
 * which is not yet implemented in the database schema.
 *
 * Status: Not Implemented (501)
 */
export async function DELETE(
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
