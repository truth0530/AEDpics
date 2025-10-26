// 통합 AED 서비스 - 실제 Supabase 데이터 관리
'use client';

import { getSupabaseClient } from './supabaseClient';
import { RealAEDData, transformRealToSimpleAED, calculatePriority, RegionDistribution, DataQualityReport } from '../types/RealAEDTypes';
import { AEDDevice, AEDManufacturer } from '../types/AEDTypes';

export class AEDService {
  private static instance: AEDService;
  private supabase = getSupabaseClient();

  private constructor() {}

  static getInstance(): AEDService {
    if (!AEDService.instance) {
      AEDService.instance = new AEDService();
    }
    return AEDService.instance;
  }

  /**
   * AED 장치 목록 조회 (페이지네이션 지원)
   */
  async getAEDDevices(
    limit: number = 50,
    offset: number = 0,
    filters?: {
      region?: string;
      priority?: 'urgent' | 'warning' | 'normal';
      manufacturer?: string;
      searchQuery?: string;
    }
  ): Promise<AEDDevice[]> {
    try {
      let query = this.supabase
        .from('aed_data')
        .select('*')
        .eq('operation_status', '운영')
        .order('last_inspection_date', { ascending: true })
        .range(offset, offset + limit - 1);

      // 필터 적용
      if (filters?.region) {
        query = query.eq('sido', filters.region);
      }

      if (filters?.manufacturer) {
        query = query.ilike('manufacturer', `%${filters.manufacturer}%`);
      }

      if (filters?.searchQuery) {
        query = query.or(
          `installation_institution.ilike.%${filters.searchQuery}%,` +
          `installation_address.ilike.%${filters.searchQuery}%,` +
          `model_name.ilike.%${filters.searchQuery}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error('AED 데이터 조회 오류:', error);
        return [];
      }

      // 실제 데이터를 기존 인터페이스로 변환
      let devices = data.map(transformRealToSimpleAED);

      // 우선순위 필터는 클라이언트에서 적용
      if (filters?.priority) {
        devices = devices.filter(device => device.priority === filters.priority);
      }

      return devices;
    } catch (error) {
      console.error('AED 데이터 서비스 오류:', error);
      return [];
    }
  }

  /**
   * 단일 AED 상세 조회
   */
  async getAEDById(id: string): Promise<RealAEDData | null> {
    try {
      const { data, error } = await this.supabase
        .from('aed_data')
        .select('*')
        .eq('id', id)
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
   * 제조번호로 AED 조회
   */
  async getAEDBySerialNumber(serialNumber: string): Promise<RealAEDData | null> {
    try {
      const { data, error } = await this.supabase
        .from('aed_data')
        .select('*')
        .eq('serial_number', serialNumber)
        .single();

      if (error) {
        console.error('제조번호 조회 오류:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('제조번호 조회 실패:', error);
      return null;
    }
  }

  /**
   * 우선순위별 AED 조회
   */
  async getAEDsByPriority(
    priority: 'urgent' | 'warning' | 'normal',
    limit: number = 50
  ): Promise<AEDDevice[]> {
    try {
      const { data, error } = await this.supabase
        .from('aed_data')
        .select('*')
        .eq('operation_status', '운영')
        .limit(limit * 3); // 필터링을 위해 더 많이 가져옴

      if (error) throw error;

      // 우선순위 계산 후 필터링
      const filteredData = data
        .filter(item => calculatePriority(item) === priority)
        .slice(0, limit);

      return filteredData.map(transformRealToSimpleAED);
    } catch (error) {
      console.error('우선순위별 AED 조회 오류:', error);
      return [];
    }
  }

  /**
   * 제조사 목록 조회
   */
  async getManufacturers(): Promise<AEDManufacturer[]> {
    try {
      const { data, error } = await this.supabase
        .from('aed_data')
        .select('manufacturer, model_name')
        .not('manufacturer', 'is', null)
        .not('model_name', 'is', null);

      if (error) throw error;

      // 제조사별로 모델 그룹화
      const manufacturerMap = new Map<string, Set<string>>();

      data.forEach(item => {
        const manufacturer = item.manufacturer.trim();
        if (!manufacturerMap.has(manufacturer)) {
          manufacturerMap.set(manufacturer, new Set());
        }
        manufacturerMap.get(manufacturer)?.add(item.model_name);
      });

      // AEDManufacturer 형식으로 변환
      const manufacturers: AEDManufacturer[] = [];
      manufacturerMap.forEach((models, name) => {
        manufacturers.push({
          id: `mfg_${name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
          name: name,
          country: '한국', // 기본값
          models: Array.from(models).map(modelName => ({
            name: modelName,
            features: [], // 기능 정보는 별도 관리 필요
            weight: '2.5kg', // 기본값
            battery_life: '5년', // 기본값
            pad_life: '2년', // 기본값
            shock_time: '10초' // 기본값
          }))
        });
      });

      return manufacturers.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('제조사 목록 조회 오류:', error);
      return [];
    }
  }

  /**
   * 지역별 분포 통계
   */
  async getRegionDistribution(): Promise<RegionDistribution[]> {
    try {
      const { data, error } = await this.supabase
        .from('aed_data')
        .select('sido')
        .eq('operation_status', '운영');

      if (error) throw error;

      const regionCount: { [key: string]: number } = {};
      data.forEach(item => {
        regionCount[item.sido] = (regionCount[item.sido] || 0) + 1;
      });

      const total = data.length;
      return Object.entries(regionCount)
        .map(([sido, count]) => ({
          sido,
          count,
          percentage: (count / total) * 100
        }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error('지역 분포 조회 오류:', error);
      return [];
    }
  }

  /**
   * 데이터 품질 보고서
   */
  async getDataQualityReport(): Promise<DataQualityReport> {
    try {
      const { data, error } = await this.supabase
        .from('aed_data')
        .select('*')
        .limit(10000); // 성능을 위해 제한

      if (error) throw error;

      const today = new Date();

      // 중복 시리얼 번호 체크
      const serialNumbers = data.map(item => item.serial_number).filter(Boolean);
      const uniqueSerials = new Set(serialNumbers);
      const duplicateSerialNumbers = serialNumbers.length - uniqueSerials.size;

      // 누락 데이터 체크
      const missingManufacturers = data.filter(item => !item.manufacturer || item.manufacturer.trim() === '').length;
      const missingModels = data.filter(item => !item.model_name || item.model_name.trim() === '').length;

      // 만료 데이터 체크
      const expiredBatteries = data.filter(item =>
        item.battery_expiry_date && new Date(item.battery_expiry_date) < today
      ).length;
      const expiredPads = data.filter(item =>
        item.patch_expiry_date && new Date(item.patch_expiry_date) < today
      ).length;

      // 점검 연체 체크 (6개월 초과)
      const sixMonthsAgo = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
      const overdueInspections = data.filter(item =>
        !item.last_inspection_date || new Date(item.last_inspection_date) < sixMonthsAgo
      ).length;

      // 고유값 개수
      const uniqueManufacturers = new Set(data.map(item => item.manufacturer).filter(Boolean)).size;
      const uniqueModels = new Set(data.map(item => item.model_name).filter(Boolean)).size;

      return {
        totalRecords: data.length,
        duplicateSerialNumbers,
        missingManufacturers,
        missingModels,
        expiredBatteries,
        expiredPads,
        overdueInspections,
        uniqueManufacturers,
        uniqueModels
      };
    } catch (error) {
      console.error('데이터 품질 보고서 생성 오류:', error);
      return {
        totalRecords: 0,
        duplicateSerialNumbers: 0,
        missingManufacturers: 0,
        missingModels: 0,
        expiredBatteries: 0,
        expiredPads: 0,
        overdueInspections: 0,
        uniqueManufacturers: 0,
        uniqueModels: 0
      };
    }
  }

  /**
   * 통계 정보 조회
   */
  async getStatistics() {
    try {
      const [devices, manufacturers, regionDist, qualityReport] = await Promise.all([
        this.getAEDDevices(1000),
        this.getManufacturers(),
        this.getRegionDistribution(),
        this.getDataQualityReport()
      ]);

      const urgentCount = devices.filter(d => d.priority === 'urgent').length;
      const warningCount = devices.filter(d => d.priority === 'warning').length;
      const normalCount = devices.filter(d => d.priority === 'normal').length;

      return {
        totalDevices: devices.length,
        totalManufacturers: manufacturers.length,
        urgentCount,
        warningCount,
        normalCount,
        regionDistribution: regionDist,
        dataQuality: qualityReport
      };
    } catch (error) {
      console.error('통계 조회 오류:', error);
      return null;
    }
  }

  /**
   * 총 레코드 수 조회
   */
  async getTotalCount(filters?: { region?: string; manufacturer?: string }): Promise<number> {
    try {
      let query = this.supabase
        .from('aed_data')
        .select('*', { count: 'exact', head: true })
        .eq('operation_status', '운영');

      if (filters?.region) {
        query = query.eq('sido', filters.region);
      }

      if (filters?.manufacturer) {
        query = query.ilike('manufacturer', `%${filters.manufacturer}%`);
      }

      const { count, error } = await query;

      return error ? 0 : (count || 0);
    } catch (error) {
      console.error('총 레코드 수 조회 오류:', error);
      return 0;
    }
  }

  /**
   * AED 데이터 업데이트
   */
  async updateAED(id: string, updates: Partial<RealAEDData>): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('aed_data')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('AED 업데이트 오류:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('AED 업데이트 실패:', error);
      return false;
    }
  }

  /**
   * 지역별 AED 조회 (추가 메서드)
   */
  async getAEDsByRegion(sido: string, gugun?: string, limit: number = 50): Promise<AEDDevice[]> {
    try {
      let query = this.supabase
        .from('aed_data')
        .select('*')
        .eq('sido', sido)
        .eq('operation_status', '운영');

      if (gugun) {
        query = query.eq('gugun', gugun);
      }

      const { data, error } = await query.limit(limit);

      if (error) throw error;

      return data.map(transformRealToSimpleAED);
    } catch (error) {
      console.error('지역별 AED 조회 오류:', error);
      return [];
    }
  }

  /**
   * 통합 검색 (추가 메서드)
   */
  async searchAEDs(
    query: string,
    filters: {
      sido?: string;
      manufacturer?: string;
      priority?: 'urgent' | 'warning' | 'normal';
    } = {},
    limit: number = 50
  ): Promise<AEDDevice[]> {
    try {
      let supabaseQuery = this.supabase
        .from('aed_data')
        .select('*')
        .eq('operation_status', '운영');

      // 텍스트 검색
      if (query.trim()) {
        supabaseQuery = supabaseQuery.or(
          `installation_institution.ilike.%${query}%,` +
          `installation_address.ilike.%${query}%,` +
          `model_name.ilike.%${query}%,` +
          `manufacturer.ilike.%${query}%`
        );
      }

      // 필터 적용
      if (filters.sido) {
        supabaseQuery = supabaseQuery.eq('sido', filters.sido);
      }

      if (filters.manufacturer) {
        supabaseQuery = supabaseQuery.ilike('manufacturer', `%${filters.manufacturer}%`);
      }

      const { data, error } = await supabaseQuery.limit(limit);

      if (error) throw error;

      let results = data.map(transformRealToSimpleAED);

      // 우선순위 필터는 클라이언트에서 적용
      if (filters.priority) {
        results = results.filter(aed => aed.priority === filters.priority);
      }

      return results;
    } catch (error) {
      console.error('AED 검색 오류:', error);
      return [];
    }
  }

  /**
   * 고유 제조사 목록 (추가 메서드)
   */
  async getUniqueManufacturers(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('aed_data')
        .select('manufacturer')
        .not('manufacturer', 'is', null);

      if (error) throw error;

      const manufacturers = [...new Set(data.map(item => item.manufacturer))];
      return manufacturers.sort();
    } catch (error) {
      console.error('제조사 목록 조회 오류:', error);
      return [];
    }
  }

  /**
   * 고유 모델 목록 (추가 메서드)
   */
  async getUniqueModels(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('aed_data')
        .select('model_name')
        .not('model_name', 'is', null);

      if (error) throw error;

      const models = [...new Set(data.map(item => item.model_name))];
      return models.sort();
    } catch (error) {
      console.error('모델 목록 조회 오류:', error);
      return [];
    }
  }

  /**
   * 제조사별 AED 조회 (추가 메서드)
   */
  async getAEDsByManufacturer(manufacturer: string, limit: number = 50): Promise<AEDDevice[]> {
    try {
      const { data, error } = await this.supabase
        .from('aed_data')
        .select('*')
        .ilike('manufacturer', `%${manufacturer}%`)
        .eq('operation_status', '운영')
        .limit(limit);

      if (error) throw error;

      return data.map(transformRealToSimpleAED);
    } catch (error) {
      console.error('제조사별 AED 조회 오류:', error);
      return [];
    }
  }

  /**
   * 연결 상태 확인 (동기 버전)
   */
  getConnectionStatus(): boolean {
    // 기본적으로 true 반환 (Supabase 클라이언트가 생성되었다고 가정)
    return !!this.supabase;
  }
}

// 전역 인스턴스
export const aedService = AEDService.getInstance();