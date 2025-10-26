import { NextResponse } from 'next/server';

/**
 * DISABLED: External Mapping Stats API
 *
 * This feature requires the aed_persistent_mapping table which is not yet implemented.
 */

export async function GET() {
  return NextResponse.json(
    {
      error: 'External mapping stats feature is currently disabled. Table aed_persistent_mapping not implemented.',
      status: 'not_implemented'
    },
    { status: 501 }
  );
}
