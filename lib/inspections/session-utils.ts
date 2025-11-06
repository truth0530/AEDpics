// TODO: Supabase 클라이언트 임시 비활성화 - API 엔드포인트로 전환 필요
// import { createClient } // TODO: Supabase 클라이언트 임시 비활성화
// from '@/lib/supabase/client';

export interface InspectionSession {
  id: string;
  equipment_serial: string;
  inspector_id: string;
  inspector_name?: string;
  status: 'active' | 'completed' | 'cancelled' | 'paused';
  current_step: number;
  started_at: string;
  created_at: string;  // AdminFullView에서 사용
  updated_at: string;
}

/**
 * 활성 점검 세션 조회 (완료/취소/일시정지 제외)
 * @returns Map<equipment_serial, session>
 */
export async function getActiveInspectionSessions(): Promise<Map<string, InspectionSession>> {
  try {
    const response = await fetch('/api/inspections/sessions?status=active');
    if (!response.ok) {
      console.error('[getActiveInspectionSessions] API error:', response.status);
      return new Map();
    }

    const data = await response.json();
    const sessions = data.sessions || [];

    const sessionMap = new Map<string, InspectionSession>();
    sessions.forEach((session: any) => {
      if (session.equipment_serial) {
        sessionMap.set(session.equipment_serial, {
          id: session.id,
          equipment_serial: session.equipment_serial,
          inspector_id: session.inspector_id,
          inspector_name: session.inspector_name || '알 수 없음',
          status: session.status,
          current_step: session.current_step,
          started_at: session.started_at,
          created_at: session.created_at || session.started_at,
          updated_at: session.updated_at,
        });
      }
    });

    return sessionMap;
  } catch (error) {
    console.error('[getActiveInspectionSessions] Error:', error);
    return new Map();
  }

  /* TODO: 아래 코드는 Supabase 의존성 제거 후 재활성화
  const supabase = createClient();

  const { data: sessions, error} = await supabase
    .from('inspection_sessions')
    .select(`
      id,
      equipment_serial,
      inspector_id,
      status,
      current_step,
      created_at,
      started_at,
      updated_at,
      user_profiles!inspector_id (
        full_name
      )
    `)
    .is('completed_at', null)
    .eq('status', 'active')  // 'active' 상태만 포함 (completed, cancelled, paused 제외)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getActiveInspectionSessions] Error:', error);
    console.error('[getActiveInspectionSessions] Error details:', JSON.stringify(error, null, 2));
    return new Map();
  }

  const sessionMap = new Map<string, InspectionSession>();

  sessions?.forEach((session: any) => {
    // 같은 장비에 대해 가장 최근 세션만 유지
    if (!sessionMap.has(session.equipment_serial)) {
      // ✅ 디버깅: 사용자 정보 확인
      console.log('[getActiveInspectionSessions] Session data:', {
        inspector_id: session.inspector_id,
        user_profiles: session.user_profiles,
        full_name: session.user_profiles?.full_name,
      });

      sessionMap.set(session.equipment_serial, {
        id: session.id,
        equipment_serial: session.equipment_serial,
        inspector_id: session.inspector_id,
        inspector_name: session.user_profiles?.full_name || '알 수 없음',
        status: session.status,
        current_step: session.current_step,
        started_at: session.started_at,
        created_at: session.created_at,
        updated_at: session.updated_at,
      });
    }
  });

  return sessionMap;
  */
}

/**
 * 완료된 점검 목록 조회 (최근 것만)
 * @returns Set<equipment_serial>
 */
export async function getCompletedInspections(hoursAgo: number = 24): Promise<Set<string>> {
  try {
    const response = await fetch(`/api/inspections/completed?hours=${hoursAgo}`);
    if (!response.ok) {
      console.error('[getCompletedInspections] API error:', response.status);
      return new Set();
    }

    const data = await response.json();
    const inspections = data.inspections || [];

    return new Set(inspections.map((i: any) => i.equipment_serial));
  } catch (error) {
    console.error('[getCompletedInspections] Error:', error);
    return new Set();
  }

  /* TODO: 아래 코드는 Supabase 의존성 제거 후 재활성화
  const supabase = createClient();

  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

  const { data: inspections, error } = await supabase
    .from('inspections')
    .select('equipment_serial, inspection_date')
    .gte('inspection_date', cutoffDate.toISOString())
    .order('inspection_date', { ascending: false });

  if (error) {
    console.error('[getCompletedInspections] Error:', error);
    return new Set();
  }

  return new Set(inspections?.map((i: any) => i.equipment_serial) || []);
  */
}

/**
 * 점검 세션 취소
 */
export async function cancelInspectionSession(sessionId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/inspections/sessions/${sessionId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to cancel session' };
    }

    return { success: true };
  } catch (error) {
    console.error('[cancelInspectionSession] Error:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * 점검 이력 삭제
 */
export async function deleteInspectionRecord(inspectionId: string, reason: string, confirmed: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/inspections/${inspectionId}/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason, confirmed }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to delete inspection' };
    }

    return { success: true };
  } catch (error) {
    console.error('[deleteInspectionRecord] Error:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * 점검 이력 목록 조회
 */
export interface InspectionHistory {
  id: string;
  equipment_serial: string;
  inspector_id: string;
  inspector_name: string;
  inspector_email?: string;
  inspection_date: string;
  // e-gen 원본 시스템의 최근 점검일 (참고용)
  last_inspection_date_egen?: string | null;
  // 점검 데이터 출처 ('aedpics' 또는 'egen')
  data_source?: string;
  inspection_type: string;
  visual_status: string;
  battery_status: string;
  pad_status: string;
  operation_status: string;
  overall_status: string;
  notes?: string;
  issues_found?: string[];
  photos?: string[];
  inspection_latitude?: number;
  inspection_longitude?: number;
  step_data?: Record<string, any>;  // 4단계 전체 데이터 (basicInfo, deviceInfo, storage, documentation)
  original_data?: Record<string, any>;  // e-gen 원본 데이터
  aed_data?: Record<string, any>;  // AED 장치 정보 (위치, 관할보건소 등)
  created_at: string;
  updated_at: string;
}

/**
 * 점검 이력 조회
 * @param equipmentSerial - 특정 장비의 점검 이력만 조회
 * @param hoursAgo - 조회 범위 (기본값: 24시간)
 * @param mode - 지역 필터링 기준 ('address'=물리적 위치, 'jurisdiction'=관할보건소, 기본값: 'address')
 * @returns 점검 이력 배열
 */
export async function getInspectionHistory(
  equipmentSerial?: string,
  hoursAgo: number = 24,
  mode: 'address' | 'jurisdiction' = 'address'
): Promise<InspectionHistory[]> {
  try {
    const params = new URLSearchParams();
    if (equipmentSerial) params.append('equipment_serial', equipmentSerial);
    params.append('hours', hoursAgo.toString());
    params.append('mode', mode);

    const response = await fetch(`/api/inspections/history?${params.toString()}`);

    if (!response.ok) {
      console.error('[getInspectionHistory] HTTP error:', response.status);
      return [];
    }

    const data = await response.json();
    return data.inspections || [];
  } catch (error) {
    console.error('[getInspectionHistory] Error:', error);
    return [];
  }
}

/**
 * 임시저장된 점검 세션 조회
 */
export async function getDraftSessions(): Promise<any[]> {
  try {
    const response = await fetch('/api/inspections/drafts');

    if (!response.ok) {
      console.error('[getDraftSessions] HTTP error:', response.status);
      return [];
    }

    const data = await response.json();
    return data.drafts || [];
  } catch (error) {
    console.error('[getDraftSessions] Error:', error);
    return [];
  }
}

/**
 * 임시저장된 점검 세션 삭제
 */
export async function deleteDraftSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/inspections/drafts', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to delete draft' };
    }

    return { success: true };
  } catch (error) {
    console.error('[deleteDraftSession] Error:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * 점검 이력 상세 조회
 */
export async function getInspectionDetail(inspectionId: string): Promise<any | null> {
  try {
    const response = await fetch(`/api/inspections/${inspectionId}`);

    if (!response.ok) {
      console.error('[getInspectionDetail] HTTP error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.inspection || null;
  } catch (error) {
    console.error('[getInspectionDetail] Error:', error);
    return null;
  }
}

/**
 * 점검 이력 수정
 */
export async function updateInspectionRecord(
  inspectionId: string,
  updates: Partial<InspectionHistory>
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/inspections/${inspectionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to update inspection' };
    }

    return { success: true };
  } catch (error) {
    console.error('[updateInspectionRecord] Error:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * 점검불가 상태의 장비 목록 조회
 * @returns Set<equipment_serial>
 */
export async function getUnavailableAssignments(hoursAgo: number = 24): Promise<Set<string>> {
  try {
    const response = await fetch(`/api/inspections/unavailable?hours=${hoursAgo}`);
    if (!response.ok) {
      console.error('[getUnavailableAssignments] API error:', response.status);
      return new Set();
    }

    const data = await response.json();
    const unavailable = data.unavailable || [];

    return new Set(unavailable.map((u: any) => u.equipment_serial));
  } catch (error) {
    console.error('[getUnavailableAssignments] Error:', error);
    return new Set();
  }
}
