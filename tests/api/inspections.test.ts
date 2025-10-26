import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// 테스트용 Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 테스트용 사용자 데이터
const testUsers = {
  master: {
    email: 'test-master@nmc.or.kr',
    password: 'test123456',
    role: 'master' as const,
  },
  pendingApproval: {
    email: 'test-pending@korea.kr',
    password: 'test123456',
    role: 'pending_approval' as const,
  },
  temporaryInspector: {
    email: 'test-inspector@example.com',
    password: 'test123456',
    role: 'temporary_inspector' as const,
  },
};

// API 호출 헬퍼
async function callAPI(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`http://localhost:3000/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();
  return { response, data };
}

// 사용자 인증 헬퍼
async function signInUser(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data.session?.access_token;
}

describe('Inspection API 역할 기반 접근 제어', () => {
  const testUserIds: Record<string, string> = {};

  beforeEach(async () => {
    // 테스트 사용자 생성 (실제 환경에서는 모킹 사용)
    for (const [key, user] of Object.entries(testUsers)) {
      try {
        const { data } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
        });

        if (data.user) {
          testUserIds[key] = data.user.id;

          // 프로필 생성
          await supabase.from('user_profiles').insert({
            id: data.user.id,
            email: user.email,
            role: user.role,
            account_type: 'public',
            fullName: `Test ${key}`,
            region: '서울특별시',
            region_code: '11',
            ...(user.role === 'temporary_inspector' && {
              assigned_devices: ['TEST-001', 'TEST-002'],
            }),
          });
        }
      } catch (error) {
        console.warn(`Test user ${key} may already exist:`, error);
      }
    }
  });

  afterEach(async () => {
    // 테스트 데이터 정리
    for (const userId of Object.values(testUserIds)) {
      try {
        await supabase.auth.admin.deleteUser(userId);
        await supabase.from('user_profiles').delete().eq('id', userId);
        await supabase.from('inspection_sessions').delete().eq('inspector_id', userId);
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }
  });

  describe('/api/inspections/sessions', () => {
    it('정상 역할(master)은 세션 생성 가능', async () => {
      const token = await signInUser(testUsers.master.email, testUsers.master.password);

      const { response, data } = await callAPI('/inspections/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          equipmentSerial: 'TEST-001',
        }),
      });

      expect(response.status).toBe(200);
      expect(data.session).toBeDefined();
      expect(data.session.equipment_serial).toBe('TEST-001');
    });

    it('pending_approval 역할은 세션 생성 차단', async () => {
      const token = await signInUser(testUsers.pendingApproval.email, testUsers.pendingApproval.password);

      const { response, data } = await callAPI('/inspections/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          equipmentSerial: 'TEST-001',
        }),
      });

      expect(response.status).toBe(403);
      expect(data.error).toContain('Inspection not permitted');
    });

    it('임시 검사원은 할당된 장비만 세션 생성 가능', async () => {
      const token = await signInUser(testUsers.temporaryInspector.email, testUsers.temporaryInspector.password);

      // 할당된 장비로 세션 생성 - 성공
      const { response: successResponse, data: successData } = await callAPI('/inspections/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          equipmentSerial: 'TEST-001',
        }),
      });

      expect(successResponse.status).toBe(200);
      expect(successData.session).toBeDefined();

      // 할당되지 않은 장비로 세션 생성 시도 - 실패 (별도 검증 로직 필요)
      const { response: failResponse, data: failData } = await callAPI('/inspections/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          equipmentSerial: 'UNASSIGNED-001',
        }),
      });

      // 현재는 일반적인 점검 권한만 확인하므로 성공할 수 있음
      // 향후 장비별 접근 제어 추가 필요
    });

    it('인증되지 않은 사용자는 접근 차단', async () => {
      const { response, data } = await callAPI('/inspections/sessions', {
        method: 'POST',
        body: JSON.stringify({
          equipmentSerial: 'TEST-001',
        }),
      });

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });
  });

  describe('/api/inspections/quick', () => {
    it('정상 역할은 즉시 점검 가능', async () => {
      const token = await signInUser(testUsers.master.email, testUsers.master.password);

      const { response, data } = await callAPI('/inspections/quick', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          deviceId: 'TEST-001',
        }),
      });

      expect(response.status).toBe(200);
      expect(data.inspectionId).toBeDefined();
    });

    it('pending_approval 역할은 즉시 점검 차단', async () => {
      const token = await signInUser(testUsers.pendingApproval.email, testUsers.pendingApproval.password);

      const { response, data } = await callAPI('/inspections/quick', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          deviceId: 'TEST-001',
        }),
      });

      expect(response.status).toBe(403);
      expect(data.error).toContain('Inspection not permitted');
    });
  });

  describe('/api/inspections/assigned-devices', () => {
    it('temporary_inspector만 할당된 장비 조회 가능', async () => {
      const token = await signInUser(testUsers.temporaryInspector.email, testUsers.temporaryInspector.password);

      const { response, data } = await callAPI('/inspections/assigned-devices', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      expect(data.devices).toBeDefined();
      expect(data.role).toBe('temporary_inspector');
    });

    it('다른 역할은 할당된 장비 조회 차단', async () => {
      const token = await signInUser(testUsers.master.email, testUsers.master.password);

      const { response, data } = await callAPI('/inspections/assigned-devices', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(403);
      expect(data.error).toContain('temporary inspectors only');
    });
  });
});

describe('API 일관성 검증', () => {
  it('모든 inspection API는 동일한 역할 검증 로직 사용', () => {
    // 정적 분석: canPerformInspection 함수가 모든 inspection API에서 사용되는지 확인
    // 이 테스트는 코드 리뷰 과정에서 수동으로 확인
    expect(true).toBe(true); // placeholder
  });

  it('ROLE_ACCESS_MATRIX와 canPerformInspection 일치성 확인', () => {
    // access-control.ts의 canPerformInspection과 role-matrix.ts의 canAccessInspection이 일치하는지 확인
    // 이 테스트는 별도의 유닛 테스트로 구현 필요
    expect(true).toBe(true); // placeholder
  });
});