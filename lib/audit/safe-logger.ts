/**
 * 안전한 감사 로깅 시스템
 * audit_logs 테이블이 없어도 에러 없이 동작
 */

import { SupabaseClient } from '@supabase/supabase-js';

interface AuditLogEntry {
  action: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, any>;
  user_id?: string;
  ip_address?: string | null;
  user_agent?: string | null;
}

class SafeAuditLogger {
  private tableExists: boolean | null = null;
  private lastCheck: number = 0;
  private readonly CHECK_INTERVAL = 60 * 1000; // 1분마다 재확인

  /**
   * 테이블 존재 여부 확인 (캐싱됨)
   */
  private async checkTableExists(supabase: SupabaseClient): Promise<boolean> {
    const now = Date.now();

    // 캐시된 결과가 있고 최근 체크했으면 그대로 사용
    if (this.tableExists !== null && now - this.lastCheck < this.CHECK_INTERVAL) {
      return this.tableExists;
    }

    try {
      // 간단한 count 쿼리로 테이블 존재 확인
      const { error } = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .limit(0);

      this.tableExists = !error;
      this.lastCheck = now;

      if (error && error.code === 'PGRST116') {
        console.info('[Audit] audit_logs table not found - logging disabled');
      }

      return this.tableExists;
    } catch (err) {
      console.error('[Audit] Error checking table existence:', err);
      this.tableExists = false;
      this.lastCheck = now;
      return false;
    }
  }

  /**
   * 안전한 로그 기록
   */
  async log(
    supabase: SupabaseClient,
    entry: AuditLogEntry
  ): Promise<void> {
    try {
      // 테이블이 없으면 콘솔 로그만
      const exists = await this.checkTableExists(supabase);
      if (!exists) {
        console.debug('[Audit Log - Fallback]', entry);
        return;
      }

      // 테이블이 있으면 DB에 기록
      const { error } = await supabase
        .from('audit_logs')
        .insert(entry);

      if (error) {
        // 404는 조용히 처리
        if (error.code === 'PGRST116') {
          this.tableExists = false;
          console.debug('[Audit Log - Table Missing]', entry);
        } else {
          console.error('[Audit] Insert error:', error, entry);
        }
      }
    } catch (err) {
      // 모든 에러를 조용히 처리
      console.debug('[Audit Log - Error]', entry, err);
    }
  }

  /**
   * 캐시 초기화
   */
  clearCache() {
    this.tableExists = null;
    this.lastCheck = 0;
  }
}

// 싱글톤 인스턴스
export const safeAuditLogger = new SafeAuditLogger();

/**
 * 편의 함수들
 */
export async function logUserAction(
  supabase: SupabaseClient,
  action: string,
  metadata?: Record<string, any>
) {
  const { data: { user } } = await supabase.auth.getUser();

  await safeAuditLogger.log(supabase, {
    action,
    user_id: user?.id,
    metadata,
  });
}

export async function logAdminAction(
  supabase: SupabaseClient,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, any>
) {
  const { data: { user } } = await supabase.auth.getUser();

  await safeAuditLogger.log(supabase, {
    action,
    entity_type: entityType,
    entity_id: entityId,
    user_id: user?.id,
    metadata,
  });
}