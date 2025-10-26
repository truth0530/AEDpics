import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getClaimsMock = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getClaims: getClaimsMock,
    },
  })),
}));

// Ensure env vars exist before importing middleware
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-anon-key';

import { updateSession } from '@/lib/supabase/middleware';

describe('updateSession middleware', () => {
  beforeEach(() => {
    getClaimsMock.mockReset();
  });

  it('redirects unauthenticated requests to signin with redirect param', async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: null } });

    const request = new NextRequest('http://example.com/inspection');
    const response = await updateSession(request);

    expect(response.headers.get('location')).toBe('http://example.com/auth/signin?redirectTo=%2Finspection');
  });

  it('redirects authenticated root requests to dashboard', async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: 'user-123' } } });

    const request = new NextRequest('http://example.com/');
    const response = await updateSession(request);

    expect(response.headers.get('location')).toBe('http://example.com/dashboard');
  });

  it('allows public paths without redirect', async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: null } });

    const request = new NextRequest('http://example.com/privacy');
    const response = await updateSession(request);

    expect(response.headers.get('location')).toBeNull();
  });
});
