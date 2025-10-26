// TODO: Supabase 서버 클라이언트 임시 비활성화
// import { createClient } from '@/lib/supabase/server';

export interface AccessLogFilterSummary {
  battery_expiry_date?: string;
  patch_expiry_date?: string;
  replacement_date?: string;
  last_inspection_date?: string;
  external_display?: string;
  statusCount?: number;
  regionCount?: number;
  cityCount?: number;
  category1Count?: number;
  category2Count?: number;
  category3Count?: number;
  search?: string;
  queryCriteria?: string;
  enforcedDefaults?: string[];
  durationMs?: number;
  summaryDurationMs?: number;
  rejectionReason?: string;
  missingFilters?: string[];
  unauthorizedRegions?: string[];
  unauthorizedCities?: string[];
}

export interface AccessLogEntry {
  userId: string;
  userRole: string;
  action: 'query' | 'export' | 'view_detail';
  filterSummary: AccessLogFilterSummary;
  resultCount: number;
  timestamp: Date;
}

export async function logDataAccess(entry: AccessLogEntry) {
  try {
    const supabase = await createClient();

    // 민감 정보 제외하고 요약만 저장
    await supabase.from('aed_access_logs').insert({
      user_id: entry.userId,
      user_role: entry.userRole,
      action: entry.action,
      // 필터 정보는 개인정보 없이 요약만
      filter_summary: JSON.stringify({
        statusCount: entry.filterSummary.statusCount ?? 0,
        regionCount: entry.filterSummary.regionCount ?? 0,
        cityCount: entry.filterSummary.cityCount ?? 0,
        ...entry.filterSummary,
      }),
      result_count: entry.resultCount,
      created_at: entry.timestamp.toISOString()
    });
  } catch (error) {
    // 로깅 실패는 원본 작업에 영향 주지 않음
    console.error('Failed to log data access:', error);
  }
}

interface AccessRejectionEntry {
  userId: string;
  userRole: string;
  requestedFilters: {
    battery_expiry_date?: string;
    patch_expiry_date?: string;
    replacement_date?: string;
    status?: string[];
    regionCodes?: string[];
    cityCodes?: string[];
    category_1?: string[];
    category_2?: string[];
    category_3?: string[];
    search?: string;
    queryCriteria?: string;
  };
  reason: string;
  missingFilters?: string[];
  unauthorizedRegions?: string[];
  unauthorizedCities?: string[];
}

export async function logAccessRejection(entry: AccessRejectionEntry) {
  await logDataAccess({
    userId: entry.userId,
    userRole: entry.userRole,
    action: 'query',
    filterSummary: {
      battery_expiry_date: entry.requestedFilters.battery_expiry_date,
      patch_expiry_date: entry.requestedFilters.patch_expiry_date,
      replacement_date: entry.requestedFilters.replacement_date,
      statusCount: entry.requestedFilters.status?.length ?? 0,
      regionCount: entry.requestedFilters.regionCodes?.length ?? 0,
      cityCount: entry.requestedFilters.cityCodes?.length ?? 0,
      category1Count: entry.requestedFilters.category_1?.length ?? 0,
      category2Count: entry.requestedFilters.category_2?.length ?? 0,
      category3Count: entry.requestedFilters.category_3?.length ?? 0,
      search: entry.requestedFilters.search,
      queryCriteria: entry.requestedFilters.queryCriteria,
      rejectionReason: entry.reason,
      missingFilters: entry.missingFilters,
      unauthorizedRegions: entry.unauthorizedRegions,
      unauthorizedCities: entry.unauthorizedCities,
    },
    resultCount: 0,
    timestamp: new Date(),
  });
}

// 접근 로그 테이블 스키마 (참고용)
/*
CREATE TABLE aed_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  user_role text NOT NULL,
  action text NOT NULL CHECK (action IN ('query', 'export', 'view_detail')),
  filter_summary jsonb NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),

  INDEX idx_aed_access_logs_user_date (user_id, created_at),
  INDEX idx_aed_access_logs_action_date (action, created_at)
);
*/
