import { NextRequest, NextResponse } from 'next/server';

/**
 * DISABLED: External Mapping API
 *
 * This feature requires the aed_persistent_mapping table which is not yet implemented.
 * The table needs to be added to the Prisma schema before this endpoint can be activated.
 *
 * TODO: Add aed_persistent_mapping table to schema.prisma
 */

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'External mapping feature is currently disabled. Table aed_persistent_mapping not implemented.',
      status: 'not_implemented'
    },
    { status: 501 }
  );
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'External mapping feature is currently disabled. Table aed_persistent_mapping not implemented.',
      status: 'not_implemented'
    },
    { status: 501 }
  );
}

export async function PUT(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'External mapping feature is currently disabled. Table aed_persistent_mapping not implemented.',
      status: 'not_implemented'
    },
    { status: 501 }
  );
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'External mapping feature is currently disabled. Table aed_persistent_mapping not implemented.',
      status: 'not_implemented'
    },
    { status: 501 }
  );
}
