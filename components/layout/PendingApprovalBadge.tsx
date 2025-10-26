import { Suspense } from 'react';
import { getCachedPendingApprovalCount } from '@/lib/auth/cached-queries';

async function PendingApprovalCount() {
  const count = await getCachedPendingApprovalCount();

  if (count === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function PendingApprovalBadge() {
  return (
    <Suspense fallback={null}>
      <PendingApprovalCount />
    </Suspense>
  );
}
