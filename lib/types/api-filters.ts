/**
 * AED Data API Filter Types
 * API 쿼리에서 사용되는 필터 타입 정의
 */

import type { Prisma } from '@prisma/client';

/**
 * 날짜 필터 타입
 */
export type DateFilterValue =
  | 'expired'      // 만료됨
  | 'in30'         // 30일 이내
  | 'in60'         // 60일 이내
  | 'in90'         // 90일 이내
  | 'in180'        // 180일 이내
  | 'in365';       // 365일 이내

/**
 * 점검일 필터 타입
 */
export type InspectionDateFilterValue =
  | 'never'        // 점검 안함
  | 'over365'      // 365일 이상 경과
  | 'over180'      // 180일 이상 경과
  | 'over90'       // 90일 이상 경과
  | 'over60'       // 60일 이상 경과
  | 'over30';      // 30일 이상 경과

/**
 * 조회 기준 타입
 */
export type QueryCriteria = 'address' | 'jurisdiction';

/**
 * AED 데이터 필터 인터페이스
 */
export interface AedDataFilters {
  // 지역 필터
  sido?: string[];
  gugun?: string[];

  // 카테고리 필터
  category_1?: string[];
  category_2?: string[];
  category_3?: string[];

  // 상태 필터
  status?: string[];

  // 외부표출 필터
  external_display?: 'Y' | 'N' | 'blocked';

  // 날짜 필터
  battery_expiry_date?: DateFilterValue;
  patch_expiry_date?: DateFilterValue;
  replacement_date?: DateFilterValue;
  last_inspection_date?: InspectionDateFilterValue;

  // 검색
  search?: string;

  // 조회 기준
  queryCriteria?: QueryCriteria;
}

/**
 * Prisma WHERE 조건 타입 (organizations)
 */
export type OrganizationsWhereInput = Prisma.organizationsWhereInput;

/**
 * Prisma WHERE 조건 타입 (aed_data)
 */
export type AedDataWhereInput = Prisma.aed_dataWhereInput;

/**
 * Raw SQL 쿼리 파라미터 타입
 * Raw SQL에서는 Date, number, string, string[] 모두 사용 가능
 */
export type RawQueryParams = (string | string[] | Date | number)[];

/**
 * 날짜 필터 결과 타입
 */
export interface DateFilterResult {
  lt?: Date;
  lte?: Date;
  gte?: Date;
  gt?: Date;
  equals?: null;
}
