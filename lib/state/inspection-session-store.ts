'use client';

import { create } from 'zustand';
import { cloneDeep } from 'lodash';
import { logger } from '@/lib/logger';

function isShallowEqual(
  prev: Record<string, unknown> | undefined,
  next: Record<string, unknown>
): boolean {
  if (!prev) {
    return false;
  }

  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);

  if (prevKeys.length !== nextKeys.length) {
    return false;
  }

  return nextKeys.every((key) => Object.is(prev[key], next[key]));
}

const API_ENDPOINT = '/api/inspections/sessions';

export type InspectionSessionStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface InspectionSession {
  id: string;
  equipment_serial: string;
  inspector_id: string;
  status: InspectionSessionStatus;
  current_step: number;
  step_data: Record<string, unknown> | null;
  field_changes?: Record<string, unknown> | null;
  started_at: string;
  completed_at?: string | null;
  updated_at?: string | null;

  // 🆕 Week 3: 새 필드
  current_snapshot?: Record<string, unknown> | null;
  original_snapshot?: Record<string, unknown> | null;
  snapshot_updated_at?: string | null;
  last_accessed_at?: string | null;
  refresh_status?: 'idle' | 'refreshing' | 'success' | 'failed';
  refresh_error?: string | null;

  // 🔵 Week 2-3: 하위 호환성 (Week 4 제거 예정)
  device_info?: Record<string, unknown> | null;

  notes?: string | null;
}

interface PendingChange {
  sessionId: string;
  payload: Record<string, unknown>;
}

export interface InspectionIssue {
  step: string;
  field: string;
  issue: string;
  severity: 'high' | 'medium' | 'low';
  note: string;
  timestamp: string;
}

interface InspectionSessionState {
  session: InspectionSession | null;
  currentStep: number;
  stepData: Record<string, unknown>;
  lastSavedStepData: Record<string, unknown>; // 🆕 저장된 stepData (변경 감지용)
  issues: InspectionIssue[];
  isLoading: boolean;
  error?: string;
  pendingChanges: PendingChange[];

  startSession: (equipmentSerial: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  hydrateSession: (session: InspectionSession) => void;
  setCurrentStep: (step: number) => void;
  updateStepData: (stepKey: string, data: Record<string, unknown>) => void;
  updateLocalStep: (stepKey: string, data: Record<string, unknown>) => void;
  updateFieldChange: (field: string, change: { original: any; corrected: any; reason?: string }) => void;
  addIssue: (issue: Omit<InspectionIssue, 'timestamp'>) => void;
  removeIssue: (step: string, field: string) => void;
  persistProgress: (options?: { status?: InspectionSessionStatus; notes?: string | null }) => Promise<void>;
  completeSession: (finalData?: Record<string, unknown>) => Promise<void>;
  cancelSession: (reason?: string | null) => Promise<void>;
  cancelSessionSafely: () => Promise<void>; // 🆕 안전한 세션 취소 (데이터 보존)
  reopenCompletedSession: () => Promise<void>; // 🆕 완료된 세션 재개
  syncPendingChanges: () => Promise<void>;
  resetSession: () => void;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    // 🆕 필드 검증 오류 시 상세 메시지 포함
    let message = typeof payload?.error === 'string' ? payload.error : '요청을 처리하지 못했습니다.';
    
    // VALIDATION_ERROR의 경우 더 상세한 메시지 구성
    if (payload?.code === 'VALIDATION_ERROR' && payload?.message) {
      message = payload.message;
    } else if (payload?.details && Array.isArray(payload.details)) {
      message = payload.details.join(' | ');
    }
    
    throw new ApiError(message, response.status, payload);
  }
  return payload as T;
}

export const useInspectionSessionStore = create<InspectionSessionState>((set, get) => ({
  session: null,
  currentStep: 0,
  stepData: {},
  lastSavedStepData: {}, // 🆕 저장된 stepData 초기값
  issues: [],
  isLoading: false,
  pendingChanges: [],

  async startSession(equipmentSerial) {
    set({ isLoading: true, error: undefined });
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipment_serial: equipmentSerial }),
      });

      const { session } = await parseResponse<{ session: InspectionSession }>(response);

      logger.info('InspectionSession:start', 'Session received from API', { sessionId: session.id, equipmentSerial: session.equipment_serial });
      // 🆕 Week 3: current_snapshot 우선 사용
      logger.info('InspectionSession:start', 'Device snapshot loaded', { hasCurrentSnapshot: !!session.current_snapshot, hasDeviceInfo: !!session.device_info });

      const initialStepData = (session.step_data as Record<string, unknown> | null) ?? {};

      set({
        session,
        currentStep: session.current_step ?? 0,
        stepData: initialStepData,
        lastSavedStepData: cloneDeep(initialStepData), // 🆕 초기 저장 상태로 설정
        isLoading: false,
        pendingChanges: [],
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '점검 세션을 시작하지 못했습니다.',
      });
      throw error;
    }
  },

  async loadSession(sessionId) {
    set({ isLoading: true, error: undefined });
    try {
      const response = await fetch(`${API_ENDPOINT}?sessionId=${sessionId}`, {
        method: 'GET',
      });

      const { session } = await parseResponse<{ session: InspectionSession }>(response);

      const loadedStepData = (session.step_data as Record<string, unknown> | null) ?? {};

      set({
        session,
        currentStep: session.current_step ?? 0,
        stepData: loadedStepData,
        lastSavedStepData: cloneDeep(loadedStepData), // 🆕 초기 저장 상태로 설정
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '세션을 불러오지 못했습니다.',
      });
      throw error;
    }
  },

  hydrateSession(session) {
    set({
      session,
      currentStep: session.current_step ?? 0,
      stepData: (session.step_data as Record<string, unknown> | null) ?? {},
    });
  },

  setCurrentStep(step) {
    set({ currentStep: Math.max(0, step) });
  },

  updateStepData(stepKey, data) {
    set((state) => {
      const previous = state.stepData;
      const mergedStep = {
        ...(previous?.[stepKey] as Record<string, unknown> | undefined),
        ...data,
      };

      if (isShallowEqual(previous?.[stepKey] as Record<string, unknown> | undefined, mergedStep)) {
        return {};
      }

      const nextStepData = {
        ...previous,
        [stepKey]: mergedStep,
      };

      return {
        stepData: nextStepData,
        session: state.session ? { ...state.session, step_data: nextStepData } : state.session,
      };
    });
  },

  updateLocalStep(stepKey, data) {
    get().updateStepData(stepKey, data);
  },

  updateFieldChange(field, change) {
    set((state) => {
      const currentChanges = (state.session?.field_changes as Record<string, any>) || {};
      const updatedChanges = {
        ...currentChanges,
        [field]: change,
      };

      return {
        session: state.session
          ? {
              ...state.session,
              field_changes: updatedChanges,
            }
          : state.session,
      };
    });
  },

  async persistProgress(options) {
    const { session, stepData, currentStep, pendingChanges } = get();
    if (!session) {
      throw new Error('활성 점검 세션이 없습니다.');
    }

    const payload: Record<string, unknown> = {
      sessionId: session.id,
      currentStep,
      stepData,
      fieldChanges: session.field_changes || {},
    };

    if (options?.status) {
      payload.status = options.status;
    }

    if (options?.notes !== undefined) {
      payload.notes = options.notes;
    }

    const requestInit: RequestInit = {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    };

    try {
      logger.info('InspectionSession:persistProgress', 'Saving progress', {
        sessionId: session.id,
        currentStep,
        stepDataKeys: Object.keys(stepData),
      });

      set({ isLoading: true, error: undefined });
      const response = await fetch(API_ENDPOINT, requestInit);

      // 응답 상태 확인
      if (!response.ok) {
        const errorText = await response.text();
        logger.error('InspectionSession:persistProgress', 'API error response', {
          status: response.status,
          statusText: response.statusText,
          body: errorText.substring(0, 200),
        });
        throw new Error(`API 오류 (${response.status}): ${errorText.substring(0, 200)}`);
      }

      const { session: updatedSession } = await parseResponse<{ session: InspectionSession }>(response);

      logger.info('InspectionSession:persistProgress', 'Progress saved successfully', { sessionId: updatedSession.id });

      const savedStepData = (updatedSession.step_data as Record<string, unknown> | null) ?? stepData;

      set({
        session: updatedSession,
        currentStep: updatedSession.current_step ?? currentStep,
        stepData: savedStepData,
        lastSavedStepData: cloneDeep(savedStepData), // 🆕 저장 성공 시 lastSavedStepData 업데이트
        isLoading: false,
        pendingChanges,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '점검 정보를 저장하지 못했습니다.';
      logger.error('InspectionSession:persistProgress', 'Save failed', error instanceof Error ? error : { error: errorMessage });

      set({
        isLoading: false,
        error: errorMessage,
        pendingChanges: [...pendingChanges, { sessionId: session.id, payload }],
      });
      throw error;
    }
  },

  async completeSession(finalData) {
    const { session, stepData, currentStep } = get();
    if (!session) {
      throw new Error('활성 점검 세션이 없습니다.');
    }

    // 🔥 stepData를 RPC가 기대하는 구조로 변환
    const basicInfo = (stepData.basicInfo || {}) as Record<string, any>;
    const deviceInfo = (stepData.deviceInfo || {}) as Record<string, any>;
    const storage = (stepData.storage || {}) as Record<string, any>;
    const documentation = (stepData.documentation || {}) as Record<string, any>;

    const transformedData = {
      // deviceInfo 매핑
      deviceInfo: {
        manufacturer: deviceInfo.manufacturer || '',
        model_name: deviceInfo.model_name || '',
        serial_number: deviceInfo.serial_number || '',
        all_matched: deviceInfo.all_matched || false,
      },
      // supplies 매핑 (개별 _matched 플래그 포함)
      supplies: {
        battery_expiry_date: deviceInfo.battery_expiry_date || '',
        battery_matched: deviceInfo.battery_expiry_date_matched || false,

        pad_expiry_date: deviceInfo.pad_expiry_date || '',
        pad_matched: deviceInfo.pad_expiry_date_matched || false,

        manufacturing_date: deviceInfo.manufacturing_date || '',
        mfg_date_matched: deviceInfo.manufacturing_date_matched || false,
      },
      // basicInfo 매핑
      basicInfo: {
        all_matched: basicInfo.all_matched || false,
        location_matched: basicInfo.location_matched || false,
        gps_verified: basicInfo.gps_verified || false,
        manager: basicInfo.manager || '',
        contact_info: basicInfo.contact_info || '',
        address: basicInfo.address || '',
        installation_position: basicInfo.installation_position || '',
        category_1: basicInfo.category_1 || '',
        category_2: basicInfo.category_2 || '',
        category_3: basicInfo.category_3 || '',
        edit_reason: basicInfo.edit_reason || '',
      },
      // storage 매핑
      storage: {
        storage_type: storage.storage_type || 'none',
        checklist_items: storage.checklist_items || {},
        signage_selected: storage.signage_selected || [],
      },
      // validation 매핑
      validation: {
        overall_status: 'completed',
        issues: storage.checklist_items ? Object.entries(storage.checklist_items)
          .filter(([_, value]) => value === false || value === 'needs_improvement')
          .map(([key, _]) => `보관함 점검 ${key} 개선 필요`) : [],
      },
      // documentation 매핑
      documentation: {
        notes: documentation.notes || '',
        photos: documentation.photos || [],
      },
      // location 매핑
      location: {
        latitude: basicInfo.gps_latitude || session.current_snapshot?.latitude || session.device_info?.latitude || 0,
        longitude: basicInfo.gps_longitude || session.current_snapshot?.longitude || session.device_info?.longitude || 0,
      },
      // 원본 stepData도 보존
      _originalStepData: stepData,
    };

    const payload: Record<string, unknown> = {
      sessionId: session.id,
      currentStep,
      stepData: transformedData,
      fieldChanges: session.field_changes || {},
      status: 'completed',
    };

    if (finalData) {
      payload.finalizeData = { ...transformedData, ...finalData };
    } else {
      payload.finalizeData = transformedData;
    }

    const response = await fetch(API_ENDPOINT, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const { session: updatedSession } = await parseResponse<{ session: InspectionSession }>(response);

    set({
      session: updatedSession,
      currentStep: updatedSession.current_step ?? currentStep,
      stepData: (updatedSession.step_data as Record<string, unknown> | null) ?? stepData,
      pendingChanges: [],
    });
  },

  async cancelSession(reason) {
    const { session, stepData, currentStep } = get();
    if (!session) {
      return;
    }

    await get().persistProgress({ status: 'cancelled', notes: reason ?? null });
    set({
      session: {
        ...session,
        status: 'cancelled',
      },
      currentStep,
      stepData,
    });
  },

  // 🆕 안전한 세션 취소: PATCH 엔드포인트 사용 (데이터 보존)
  async cancelSessionSafely(reason?: string) {
    const { session, stepData, currentStep } = get();
    if (!session) {
      throw new Error('활성 점검 세션이 없습니다.');
    }

    set({ isLoading: true, error: undefined });

    try {
      // ✅ DELETE 대신 PATCH로 상태만 변경 (데이터 보존)
      const response = await fetch(API_ENDPOINT, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          currentStep,
          stepData,
          status: 'cancelled',
          notes: reason || '사용자 취소',
        }),
      });

      const { session: cancelledSession } = await parseResponse<{
        session: InspectionSession;
      }>(response);

      logger.info('InspectionSession:cancelSafely', 'Session cancelled', { sessionId: session.id, reason: reason || '사용자 취소' });

      // 세션 상태 초기화
      set({
        session: null,
        currentStep: 0,
        stepData: {},
        issues: [],
        isLoading: false,
        error: undefined,
        pendingChanges: [],
      });

      return;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '세션 취소에 실패했습니다.',
      });
      throw error;
    }
  },

  addIssue(issue) {
    const { issues } = get();

    // 같은 step + field 조합이 있으면 제거 (덮어쓰기)
    const filtered = issues.filter(i => !(i.step === issue.step && i.field === issue.field));

    const newIssue: InspectionIssue = {
      ...issue,
      timestamp: new Date().toISOString(),
    };

    set({ issues: [...filtered, newIssue] });
  },

  removeIssue(step, field) {
    const { issues } = get();
    set({ issues: issues.filter(i => !(i.step === step && i.field === field)) });
  },

  async syncPendingChanges() {
    const { pendingChanges } = get();
    if (!pendingChanges.length) {
      return;
    }

    const remaining: PendingChange[] = [];

    for (const change of pendingChanges) {
      try {
        const response = await fetch(API_ENDPOINT, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(change.payload),
        });

        await parseResponse<{ session: InspectionSession }>(response);
      } catch (_error) {
        remaining.push(change);
      }
    }

    set({ pendingChanges: remaining });
  },

  // 🆕 완료된 세션을 재개 가능한 상태로 변경
  async reopenCompletedSession() {
    const { session, stepData, currentStep } = get();
    if (!session) {
      throw new Error('활성 점검 세션이 없습니다.');
    }

    if (session.status !== 'completed') {
      throw new Error('완료된 세션만 재개할 수 있습니다.');
    }

    set({ isLoading: true, error: undefined });

    try {
      // ✅ 세션 상태를 'active'로 변경 (PATCH 엔드포인트 사용)
      const response = await fetch(API_ENDPOINT, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          currentStep,
          stepData,
          status: 'active',
          notes: '재점검 진행',
        }),
      });

      const { session: reopenedSession, message } = await parseResponse<{
        session: InspectionSession;
        message: string;
      }>(response);

      logger.info('InspectionSession:reopen', 'Completed session reopened', { sessionId: session.id, message });

      // 세션 상태 업데이트
      set({
        session: reopenedSession,
        currentStep: reopenedSession.current_step ?? currentStep,
        stepData: (reopenedSession.step_data as Record<string, unknown> | null) ?? stepData,
        isLoading: false,
        error: undefined,
      });

      return;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '세션 재개에 실패했습니다.',
      });
      throw error;
    }
  },

  resetSession() {
    set({
      session: null,
      currentStep: 0,
      stepData: {},
      lastSavedStepData: {}, // 🆕 초기화
      issues: [],
      isLoading: false,
      error: undefined,
      pendingChanges: [],
    });
  },
}));

// ========================================
// Step Data 타입 정의
// ========================================

/**
 * 접근성 정보 타입
 * 점검 항목에 추가된 접근성 검증 데이터
 */
export interface AccessibilityData {
  // 설치 위치 접근 허용 범위
  accessibility_level: 'public' | 'restricted' | 'private';
  accessibility_reason?: string; // restricted/private일 때 필수

  // 24시간 사용 가능 여부
  availability_24h: 'always' | 'limited';
  weekly_schedule?: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };
}

/**
 * BasicInfo 단계 데이터 타입
 */
export interface BasicInfoData {
  all_matched?: boolean | string;
  location_matched?: boolean | string;
  gps_verified?: boolean;
  gps_latitude?: number;
  gps_longitude?: number;
  manager?: string;
  contact_info?: string;
  address?: string;
  installation_position?: string;
  category_1?: string;
  category_2?: string;
  category_3?: string;
  edit_reason?: string;

  // 🆕 접근성 정보 추가
  accessibility?: AccessibilityData;

  [key: string]: unknown;
}
