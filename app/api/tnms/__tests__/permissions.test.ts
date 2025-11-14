/**
 * TNMS API Permission Tests
 * Tests for 401 (Unauthorized) and 403 (Forbidden) scenarios
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as validatePost, GET as validateGet } from '../validate/route';
import { POST as metricsPost, GET as metricsGet } from '../metrics/route';
import { POST as recommendPost, GET as recommendGet } from '../recommend/route';
import { NextRequest } from 'next/server';

// Mock getServerSession
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from 'next-auth';

describe('TNMS API Permission Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('401 Unauthorized Tests', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue(null);
    });

    it('POST /api/tnms/recommend should return 401 when not authenticated', async () => {
      const request = new NextRequest('http://localhost:3000/api/tnms/recommend', {
        method: 'POST',
        body: JSON.stringify({ institution_name: 'test' }),
      });

      const response = await recommendPost(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('GET /api/tnms/recommend should return 401 when not authenticated', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/tnms/recommend?institution_name=test',
        {
          method: 'GET',
        }
      );

      const response = await recommendGet(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('POST /api/tnms/validate should return 401 when not authenticated', async () => {
      const request = new NextRequest('http://localhost:3000/api/tnms/validate', {
        method: 'POST',
        body: JSON.stringify({ log_id: '1' }),
      });

      const response = await validatePost(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('GET /api/tnms/validate should return 401 when not authenticated', async () => {
      const request = new NextRequest('http://localhost:3000/api/tnms/validate?validation_run_id=test', {
        method: 'GET',
      });

      const response = await validateGet(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('POST /api/tnms/metrics should return 401 when not authenticated', async () => {
      const request = new NextRequest('http://localhost:3000/api/tnms/metrics', {
        method: 'POST',
        body: JSON.stringify({ metric_date: '2025-11-14' }),
      });

      const response = await metricsPost(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('GET /api/tnms/metrics should return 401 when not authenticated', async () => {
      const request = new NextRequest('http://localhost:3000/api/tnms/metrics', {
        method: 'GET',
      });

      const response = await metricsGet(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('403 Forbidden Tests (Non-Admin Users)', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue({
        user: {
          id: 'user123',
          email: 'user@example.com',
          role: 'user',
        },
      });
    });

    it('POST /api/tnms/validate should return 403 for non-admin users', async () => {
      const request = new NextRequest('http://localhost:3000/api/tnms/validate', {
        method: 'POST',
        body: JSON.stringify({
          log_id: '1',
          manual_review_status: 'approved',
        }),
      });

      const response = await validatePost(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Forbidden');
      expect(data.message).toContain('administrator');
    });

    it('POST /api/tnms/metrics should return 403 for non-admin users', async () => {
      const request = new NextRequest('http://localhost:3000/api/tnms/metrics', {
        method: 'POST',
        body: JSON.stringify({ metric_date: '2025-11-14' }),
      });

      const response = await metricsPost(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Forbidden');
      expect(data.message).toContain('administrator');
    });
  });

  describe('Allowed Authenticated User Tests', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue({
        user: {
          id: 'user123',
          email: 'user@example.com',
          role: 'user',
        },
      });
    });

    it('GET /api/tnms/validate should be accessible to authenticated users (but requires filter)', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/tnms/validate?validation_run_id=test',
        {
          method: 'GET',
        }
      );

      const response = await validateGet(request);
      // Should not be 401 or 403 - it will be 200 or 400 (missing validation params)
      expect([200, 400, 500]).toContain(response.status);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });

    it('GET /api/tnms/metrics should be accessible to authenticated users', async () => {
      const request = new NextRequest('http://localhost:3000/api/tnms/metrics', {
        method: 'GET',
      });

      const response = await metricsGet(request);
      // Should not be 401 or 403
      expect([200, 400, 500]).toContain(response.status);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });

    it('POST /api/tnms/recommend should be accessible to authenticated users', async () => {
      const request = new NextRequest('http://localhost:3000/api/tnms/recommend', {
        method: 'POST',
        body: JSON.stringify({ institution_name: 'test보건소' }),
      });

      const response = await recommendPost(request);
      // Should not be 401 or 403 - will be 200 or 500 depending on DB
      expect([200, 400, 500]).toContain(response.status);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });
  });

  describe('Admin User Tests', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue({
        user: {
          id: 'admin123',
          email: 'admin@nmc.or.kr',
          role: 'admin',
        },
      });
    });

    it('POST /api/tnms/validate should be accessible to @nmc.or.kr email domain', async () => {
      const request = new NextRequest('http://localhost:3000/api/tnms/validate', {
        method: 'POST',
        body: JSON.stringify({
          log_id: '1',
          manual_review_status: 'approved',
        }),
      });

      const response = await validatePost(request);
      // Should not be 401 or 403
      expect([200, 400, 500]).toContain(response.status);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });

    it('POST /api/tnms/metrics should be accessible to admin role', async () => {
      const request = new NextRequest('http://localhost:3000/api/tnms/metrics', {
        method: 'POST',
        body: JSON.stringify({ metric_date: '2025-11-14' }),
      });

      const response = await metricsPost(request);
      // Should not be 401 or 403
      expect([200, 400, 500]).toContain(response.status);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });
  });
});
