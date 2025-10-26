// 실제 AED 점검 서비스 - equipment_serial 기반
import { getSupabaseClient, checkSupabaseConnection } from './supabaseClient';
import type { RealAEDData } from '../types/RealAEDTypes';

// 점검 기록 타입 정의
export interface AEDInspectionRecord {
  id?: string;
  equipment_serial: string;
  inspector_id?: string;
  inspector_name?: string;
  inspection_date: string;
  inspection_type: 'monthly' | 'emergency' | 'installation' | 'annual' | 'special' | 'routine' | 'maintenance';

  // 확인된 정보 (점검 시점의 기준값 스냅샷)
  confirmed_manufacturer?: string;
  confirmed_model_name?: string;
  confirmed_location?: string;
  confirmed_installation_position?: string;
  confirmed_battery_expiry?: string | null;
  confirmed_pad_expiry?: string | null;
  confirmed_device_expiry?: string | null;
  snapshot_timestamp?: string;

  // 점검 결과
  battery_status: 'normal' | 'warning' | 'expired' | 'missing' | 'damaged' | 'not_checked';
  battery_expiry_checked?: string;
  battery_level_percentage?: number;
  battery_visual_condition?: 'good' | 'swollen' | 'corroded' | 'damaged';

  pad_status: 'normal' | 'warning' | 'expired' | 'missing' | 'damaged' | 'not_checked';
  pad_expiry_checked?: string;
  pad_package_intact?: boolean;
  pad_expiry_readable?: boolean;

  device_status: 'normal' | 'warning' | 'malfunction' | 'damaged' | 'not_checked';
  indicator_status?: 'green' | 'red' | 'blinking' | 'off' | 'not_checked';
  device_expiry_checked?: string;

  // 환경 점검
  location_appropriate?: boolean;
  signage_visible?: boolean;
  accessibility_clear?: boolean;
  temperature_appropriate?: boolean;

  // 종합 결과
  overall_status: 'pass' | 'fail' | 'pending' | 'partial' | 'requires_attention';
  priority_level?: 'critical' | 'urgent' | 'high' | 'medium' | 'normal' | 'low';

  // 상세 내용
  issues_found?: string;
  action_taken?: string;
  recommendations?: string;
  requires_replacement?: boolean;
  replacement_parts?: string[];

  // 증빙자료
  photo_urls?: string[];
  signature_data?: string;
  notes?: string;

  // 시스템 필드
  created_at?: string;
  updated_at?: string;
}

// 점검 상태 통합 뷰 타입
export interface AEDInspectionStatus extends RealAEDData {
  latest_inspection_id?: string;
  last_inspection_date: string;
  inspection_status: string;
  current_priority: string;
  last_inspector?: string;
  issues_found?: string;
  inspection_priority: 'never_inspected' | 'overdue' | 'due_soon' | 'failed_last' | 'requires_attention' | 'current';
  expiry_status: 'expired' | 'expiring_soon' | 'valid';
  priority_score: number;
}

export class InspectionService {
  private static instance: InspectionService;
  private supabase = getSupabaseClient();

  // 해석 결과 캐시 (메모리 기반)
  private interpretationCache = new Map<string, {
    interpretation: {
      batteryInterpretation?: string;
      padInterpretation?: string;
      deviceInterpretation?: string;
      contextNote?: string;
    };
    timestamp: number;
    recordHash: string;
  }>();

  // 캐시 TTL (5분)
  private readonly CACHE_TTL = 5 * 60 * 1000;

  private constructor() {}

  static getInstance(): InspectionService {
    if (!InspectionService.instance) {
      InspectionService.instance = new InspectionService();
    }
    return InspectionService.instance;
  }

  // 연결 상태 확인
  async getConnectionStatus(): Promise<boolean> {
    return await checkSupabaseConnection();
  }

  /**
   * 점검이 필요한 AED 목록 조회 (우선순위순)
   */
  async getAEDsForInspection(
    limit: number = 50,
    offset: number = 0,
    filters?: {
      sido?: string;
      jurisdiction_health_center?: string;
      priority?: string;
      inspection_status?: string;
    }
  ): Promise<AEDInspectionStatus[]> {
    try {
      let query = this.supabase
        .from('aed_inspection_status')
        .select('*')
        .order('priority_score', { ascending: false })
        .order('last_inspection_date', { ascending: true });

      // 필터 적용
      if (filters?.sido) {
        query = query.eq('sido', filters.sido);
      }

      if (filters?.jurisdiction_health_center) {
        query = query.eq('jurisdiction_health_center', filters.jurisdiction_health_center);
      }

      if (filters?.priority) {
        query = query.eq('inspection_priority', filters.priority);
      }

      const { data, error } = await query
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('점검 대상 AED 조회 오류:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('점검 대상 AED 조회 실패:', error);
      return [];
    }
  }

  /**
   * 특정 AED 상세 정보 조회 (점검용)
   */
  async getAEDForInspection(equipmentSerial: string): Promise<AEDInspectionStatus | null> {
    try {
      const { data, error } = await this.supabase
        .from('aed_inspection_status')
        .select('*')
        .eq('equipment_serial', equipmentSerial)
        .single();

      if (error) {
        console.error('AED 상세 조회 오류:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('AED 상세 조회 실패:', error);
      return null;
    }
  }

  /**
   * 점검 시작 시 기준값 스냅샷 생성
   * 데이터 일관성 문제 해결을 위해 점검 시점의 aed_data 값들을 저장
   */
  async createInspectionSnapshot(equipmentSerial: string): Promise<{
    confirmed_manufacturer: string;
    confirmed_model_name: string;
    confirmed_location: string;
    confirmed_battery_expiry: string | null;
    confirmed_pad_expiry: string | null;
    confirmed_device_expiry: string | null;
    snapshot_timestamp: string;
  } | null> {
    try {
      const { data: aedDevice, error } = await this.supabase
        .from('aed_data')
        .select(`
          equipment_serial,
          manufacturer,
          model_name,
          installation_position,
          battery_expiry_date,
          patch_expiry_date,
          device_expiry_date
        `)
        .eq('equipment_serial', equipmentSerial)
        .single();

      if (error || !aedDevice) {
        throw new Error(`AED 장비를 찾을 수 없습니다: ${equipmentSerial}`);
      }

      return {
        confirmed_manufacturer: aedDevice.manufacturer || '',
        confirmed_model_name: aedDevice.model_name || '',
        confirmed_location: aedDevice.installation_position || '',
        confirmed_battery_expiry: aedDevice.battery_expiry_date || null,
        confirmed_pad_expiry: aedDevice.patch_expiry_date || null,
        confirmed_device_expiry: aedDevice.device_expiry_date || null,
        snapshot_timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('점검 스냅샷 생성 실패:', error);
      return null;
    }
  }

  /**
   * 진행 중인 점검의 스냅샷 조회 또는 새 스냅샷 생성
   * 논리적 오류 수정: 점검 진행 중이면 기존 스냅샷 재사용, 새 점검이면 새 스냅샷 생성
   */
  async getOrCreateInspectionSnapshot(equipmentSerial: string): Promise<{
    confirmed_manufacturer: string;
    confirmed_model_name: string;
    confirmed_location: string;
    confirmed_battery_expiry: string | null;
    confirmed_pad_expiry: string | null;
    confirmed_device_expiry: string | null;
    snapshot_timestamp: string;
  } | null> {
    try {
      // 1. 진행 중인 점검이 있는지 확인 (pending 상태)
      const { data: ongoingInspection, error: checkError } = await this.supabase
        .from('aed_inspections')
        .select('confirmed_manufacturer, confirmed_model_name, confirmed_location, confirmed_battery_expiry, confirmed_pad_expiry, confirmed_device_expiry, created_at')
        .eq('equipment_serial', equipmentSerial)
        .eq('overall_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116: no rows returned
        console.error('진행 중인 점검 확인 실패:', checkError);
        // 에러가 있어도 새 스냅샷 생성 시도
      }

      // 2. 진행 중인 점검이 있으면 기존 스냅샷 반환
      if (ongoingInspection && ongoingInspection.confirmed_manufacturer !== undefined) {
        return {
          confirmed_manufacturer: ongoingInspection.confirmed_manufacturer || '',
          confirmed_model_name: ongoingInspection.confirmed_model_name || '',
          confirmed_location: ongoingInspection.confirmed_location || '',
          confirmed_battery_expiry: ongoingInspection.confirmed_battery_expiry,
          confirmed_pad_expiry: ongoingInspection.confirmed_pad_expiry,
          confirmed_device_expiry: ongoingInspection.confirmed_device_expiry,
          snapshot_timestamp: ongoingInspection.created_at
        };
      }

      // 3. 진행 중인 점검이 없으면 새 스냅샷 생성
      return await this.createInspectionSnapshot(equipmentSerial);
    } catch (error) {
      console.error('스냅샷 조회/생성 실패:', error);
      // 오류 시에도 새 스냅샷 생성 시도
      return await this.createInspectionSnapshot(equipmentSerial);
    }
  }

  /**
   * 점검 기록 생성 (스냅샷 로직 포함)
   */
  async createInspectionRecord(
    inspectionData: Omit<AEDInspectionRecord, 'id' | 'created_at' | 'updated_at'>
  ): Promise<AEDInspectionRecord | null> {
    try {
      // 1. 점검 시작 시 기준값 스냅샷 생성
      const snapshot = await this.createInspectionSnapshot(inspectionData.equipment_serial);
      if (!snapshot) {
        throw new Error(`점검 기준값 스냅샷 생성 실패: ${inspectionData.equipment_serial}`);
      }

      // 2. 스냅샷 데이터와 함께 점검 기록 생성
      const recordWithSnapshot = {
        ...inspectionData,
        // 점검 시점의 기준값 (스냅샷)
        confirmed_manufacturer: snapshot.confirmed_manufacturer,
        confirmed_model_name: snapshot.confirmed_model_name,
        confirmed_location: snapshot.confirmed_location,
        confirmed_battery_expiry: snapshot.confirmed_battery_expiry,
        confirmed_pad_expiry: snapshot.confirmed_pad_expiry,
        confirmed_device_expiry: snapshot.confirmed_device_expiry,
        // 메타데이터
        snapshot_timestamp: snapshot.snapshot_timestamp
      };

      const { data, error } = await this.supabase
        .from('aed_inspections')
        .insert(recordWithSnapshot)
        .select()
        .single();

      if (error) {
        console.error('점검 기록 생성 오류:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('점검 기록 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 점검 기록 수정
   */
  async updateInspectionRecord(
    inspectionId: string,
    updateData: Partial<AEDInspectionRecord>
  ): Promise<AEDInspectionRecord | null> {
    try {
      const { data, error } = await this.supabase
        .from('aed_inspections')
        .update(updateData)
        .eq('id', inspectionId)
        .select()
        .single();

      if (error) {
        console.error('점검 기록 수정 오류:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('점검 기록 수정 실패:', error);
      return null;
    }
  }

  /**
   * 레코드 해시 생성 (캐시 키로 사용)
   */
  private createRecordHash(record: AEDInspectionRecord): string {
    const key = `${record.id}_${record.confirmed_battery_expiry}_${record.battery_expiry_checked}_${record.confirmed_pad_expiry}_${record.pad_expiry_checked}_${record.updated_at || record.created_at}`;
    return btoa(key).replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * 캐시 정리 (오래된 항목 제거)
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.interpretationCache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.interpretationCache.delete(key);
      }
    }
  }

  /**
   * 점검 기록 해석 (데이터 일관성 맥락 제공) - 캐싱 적용
   */
  interpretInspectionRecord(record: AEDInspectionRecord): {
    batteryInterpretation?: string;
    padInterpretation?: string;
    deviceInterpretation?: string;
    contextNote?: string;
  } {
    if (!record.id) {
      // ID가 없으면 캐싱하지 않고 직접 계산
      return this.computeInterpretation(record);
    }

    const recordHash = this.createRecordHash(record);
    const cacheKey = record.id;
    const now = Date.now();

    // 캐시에서 조회
    const cached = this.interpretationCache.get(cacheKey);
    if (cached &&
        cached.recordHash === recordHash &&
        (now - cached.timestamp) < this.CACHE_TTL) {
      return cached.interpretation;
    }

    // 캐시 정리 (메모리 누수 방지)
    if (this.interpretationCache.size > 100) {
      this.cleanupCache();
    }

    // 새로 계산
    const interpretation = this.computeInterpretation(record);

    // 캐시에 저장
    this.interpretationCache.set(cacheKey, {
      interpretation,
      timestamp: now,
      recordHash
    });

    return interpretation;
  }

  /**
   * 실제 해석 계산 로직
   */
  private computeInterpretation(record: AEDInspectionRecord): {
    batteryInterpretation?: string;
    padInterpretation?: string;
    deviceInterpretation?: string;
    contextNote?: string;
  } {
    const interpretations: {
      batteryInterpretation?: string;
      padInterpretation?: string;
      deviceInterpretation?: string;
      contextNote?: string;
    } = {};

    // 배터리 유효기간 해석
    if (record.confirmed_battery_expiry && record.battery_expiry_checked) {
      if (record.confirmed_battery_expiry === record.battery_expiry_checked) {
        interpretations.batteryInterpretation = `시스템 정보와 현장 상태가 일치 (${record.battery_expiry_checked})`;
      } else {
        interpretations.batteryInterpretation = `현장에서 다른 값 확인: ${record.confirmed_battery_expiry} → ${record.battery_expiry_checked}`;
        if (record.battery_status === 'normal' && record.battery_expiry_checked > record.confirmed_battery_expiry) {
          interpretations.batteryInterpretation += ' (현장에서 교체됨)';
        }
      }
    }

    // 패드 유효기간 해석
    if (record.confirmed_pad_expiry && record.pad_expiry_checked) {
      if (record.confirmed_pad_expiry === record.pad_expiry_checked) {
        interpretations.padInterpretation = `시스템 정보와 현장 상태가 일치 (${record.pad_expiry_checked})`;
      } else {
        interpretations.padInterpretation = `현장에서 다른 값 확인: ${record.confirmed_pad_expiry} → ${record.pad_expiry_checked}`;
        if (record.pad_status === 'normal' && record.pad_expiry_checked > record.confirmed_pad_expiry) {
          interpretations.padInterpretation += ' (현장에서 교체됨)';
        }
      }
    }

    // 점검 맥락 노트
    if (record.snapshot_timestamp) {
      interpretations.contextNote = `점검 시작 시점(${new Date(record.snapshot_timestamp).toLocaleString('ko-KR')})의 시스템 데이터를 기준으로 비교`;
    }

    return interpretations;
  }

  /**
   * 점검 기록 조회 (특정 AED, 해석 포함)
   */
  async getInspectionHistory(
    equipmentSerial: string,
    limit: number = 10
  ): Promise<(AEDInspectionRecord & {
    interpretation?: {
      batteryInterpretation?: string;
      padInterpretation?: string;
      deviceInterpretation?: string;
      contextNote?: string;
    }
  })[]> {
    try {
      const { data, error } = await this.supabase
        .from('aed_inspections')
        .select('*')
        .eq('equipment_serial', equipmentSerial)
        .order('inspection_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('점검 이력 조회 오류:', error);
        return [];
      }

      // 각 기록에 해석 정보 추가
      const recordsWithInterpretation = (data || []).map(record => ({
        ...record,
        interpretation: this.interpretInspectionRecord(record)
      }));

      return recordsWithInterpretation;
    } catch (error) {
      console.error('점검 이력 조회 실패:', error);
      return [];
    }
  }

  /**
   * 내 점검 기록 조회
   */
  async getMyInspections(
    inspectorId: string,
    limit: number = 20,
    offset: number = 0,
    dateRange?: {
      start: string;
      end: string;
    }
  ): Promise<AEDInspectionRecord[]> {
    try {
      let query = this.supabase
        .from('aed_inspections')
        .select('*')
        .eq('inspector_id', inspectorId)
        .order('inspection_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (dateRange) {
        query = query
          .gte('inspection_date', dateRange.start)
          .lte('inspection_date', dateRange.end);
      }

      const { data, error } = await query
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('내 점검 기록 조회 오류:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('내 점검 기록 조회 실패:', error);
      return [];
    }
  }

  /**
   * 점검 통계 조회
   */
  async getInspectionStats(
    sido?: string,
    startDate?: string,
    endDate?: string
  ): Promise<Record<string, unknown> | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_inspection_stats', {
          target_sido: sido,
          start_date: startDate,
          end_date: endDate
        });

      if (error) {
        console.error('점검 통계 조회 오류:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('점검 통계 조회 실패:', error);
      return null;
    }
  }

  /**
   * 보건소별 점검 현황
   */
  async getHealthCenterSummary(): Promise<Record<string, unknown>[]> {
    try {
      const { data, error } = await this.supabase
        .from('health_center_inspection_summary')
        .select('*')
        .order('avg_priority_score', { ascending: false });

      if (error) {
        console.error('보건소별 현황 조회 오류:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('보건소별 현황 조회 실패:', error);
      return [];
    }
  }

  /**
   * 고아 점검 기록 확인
   */
  async checkOrphanedInspections(): Promise<Record<string, unknown>[]> {
    try {
      const { data, error } = await this.supabase
        .rpc('check_orphaned_inspections');

      if (error) {
        console.error('고아 기록 확인 오류:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('고아 기록 확인 실패:', error);
      return [];
    }
  }

  /**
   * 점검 필요 AED 개수 (빠른 조회)
   */
  async getInspectionCounts(): Promise<{
    never_inspected: number;
    overdue: number;
    due_soon: number;
    failed_last: number;
    requires_attention: number;
    current: number;
    total: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('aed_inspection_status')
        .select('inspection_priority')
        .not('inspection_priority', 'is', null);

      if (error) {
        console.error('점검 카운트 조회 오류:', error);
        return {
          never_inspected: 0,
          overdue: 0,
          due_soon: 0,
          failed_last: 0,
          requires_attention: 0,
          current: 0,
          total: 0
        };
      }

      const initialCounts = {
        never_inspected: 0,
        overdue: 0,
        due_soon: 0,
        failed_last: 0,
        requires_attention: 0,
        current: 0,
        total: 0
      };

      const counts = data.reduce((acc, item: Record<string, string>) => {
        const priority = item.inspection_priority as keyof typeof initialCounts;
        if (priority in acc && priority !== 'total') {
          acc[priority] = (acc[priority] as number) + 1;
        }
        acc.total += 1;
        return acc;
      }, initialCounts);

      return counts;
    } catch (error) {
      console.error('점검 카운트 조회 실패:', error);
      return {
        never_inspected: 0,
        overdue: 0,
        due_soon: 0,
        failed_last: 0,
        requires_attention: 0,
        current: 0,
        total: 0
      };
    }
  }
}

// 전역 인스턴스
export const inspectionService = InspectionService.getInstance();