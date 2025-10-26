/**
 * 공통 유틸리티 타입 정의
 */

// 기본 ID 타입
export type UUID = string;
export type ISODateString = string;
export type EmailString = string;
export type URLString = string;
export type JSONString = string;

// Nullable 타입
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

// 부분 필수 타입
export type PartialRequired<T, K extends keyof T> = Partial<T> & Pick<T, K>;

// 부분 선택 타입
export type PartialOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// 읽기 전용 깊은 타입
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// 부분 깊은 타입
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// NonNullable 깊은 타입
export type DeepNonNullable<T> = {
  [P in keyof T]-?: NonNullable<T[P]>;
};

// 타입 가드 헬퍼
export type TypeGuard<T> = (value: unknown) => value is T;

// 문자열 리터럴 유니온 타입 생성
export type StringUnion<T extends string> = T | (string & {});

// 객체 키 타입
export type KeysOf<T> = keyof T;
export type ValuesOf<T> = T[keyof T];

// Omit 여러 개
export type OmitMultiple<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// Pick 여러 개
export type PickMultiple<T, K extends keyof T> = Pick<T, K>;

// 타임스탬프 믹스인
export interface Timestamped {
  createdAt: Date | ISODateString;
  updatedAt: Date | ISODateString;
}

// ID 믹스인
export interface Identifiable {
  id: UUID;
}

// 소프트 삭제 믹스인
export interface SoftDeletable {
  deletedAt?: Date | ISODateString | null;
  isDeleted?: boolean;
}

// 버전 관리 믹스인
export interface Versioned {
  version: number;
  lastModifiedBy?: UUID;
}

// 기본 엔티티 타입
export type BaseEntity = Identifiable & Timestamped;
export type DeletableEntity = BaseEntity & SoftDeletable;
export type VersionedEntity = BaseEntity & Versioned;

// API 요청/응답 타입
export interface ApiRequest<T = unknown> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: URLString;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  data?: T;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiError;
  message?: string;
  success: boolean;
  timestamp?: ISODateString;
  requestId?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

// 페이지네이션 타입
export interface PaginationRequest {
  page?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// 필터 타입
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'between';

export interface FilterCondition<T = unknown> {
  field: string;
  operator: FilterOperator;
  value: T;
}

export interface FilterGroup {
  operator: 'and' | 'or';
  conditions: Array<FilterCondition | FilterGroup>;
}

// 정렬 타입
export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

// 검색 타입
export interface SearchParams {
  query?: string;
  fields?: string[];
  filters?: FilterGroup;
  sort?: SortOption[];
  pagination?: PaginationRequest;
}

// 폼 관련 타입
export type FormStatus = 'idle' | 'loading' | 'success' | 'error';

export interface FormState<T = unknown> {
  data: T;
  errors: Record<string, string[]>;
  touched: Record<string, boolean>;
  status: FormStatus;
  message?: string;
}

// 로딩 상태 타입
export interface LoadingState<T = unknown> {
  isLoading: boolean;
  data?: T;
  error?: Error | string;
}

// 비동기 상태 타입
export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error | string };

// Result 타입 (성공/실패 처리)
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// 이벤트 타입
export interface DomainEvent<T = unknown> {
  id: UUID;
  type: string;
  aggregateId: UUID;
  payload: T;
  metadata?: Record<string, unknown>;
  timestamp: ISODateString;
  version: number;
}

// 권한 관련 타입
export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, unknown>;
}

export interface Role {
  id: UUID;
  name: string;
  permissions: Permission[];
}

// 감사 로그 타입
export interface AuditLog {
  id: UUID;
  userId: UUID;
  action: string;
  resource: string;
  resourceId?: UUID;
  changes?: Record<string, { old: unknown; new: unknown }>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: ISODateString;
}

// 설정 타입
export interface ConfigItem<T = unknown> {
  key: string;
  value: T;
  description?: string;
  isPublic: boolean;
  isEncrypted: boolean;
  lastModified: ISODateString;
}

// 알림 타입
export interface Notification {
  id: UUID;
  recipientId: UUID;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: ISODateString;
  createdAt: ISODateString;
  expiresAt?: ISODateString;
}

// 파일 업로드 타입
export interface FileUpload {
  id: UUID;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: URLString;
  thumbnailUrl?: URLString;
  uploadedBy: UUID;
  uploadedAt: ISODateString;
}

// 좌표 타입
export interface Coordinates {
  latitude: number;
  longitude: number;
}

// 주소 타입
export interface Address {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  fullAddress: string;
  coordinates?: Coordinates;
}

// 연락처 타입
export interface Contact {
  name: string;
  email?: EmailString;
  phone?: string;
  mobile?: string;
  fax?: string;
}

// 메타데이터 타입
export type Metadata = Record<string, string | number | boolean | null>;

// JSON 타입
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export interface JSONObject {
  [key: string]: JSONValue;
}
export interface JSONArray extends Array<JSONValue> {}

// 타입 유틸리티 함수
export const isNullable = <T>(value: T | null | undefined): value is null | undefined => {
  return value === null || value === undefined;
};

export const isNotNullable = <T>(value: T | null | undefined): value is T => {
  return value !== null && value !== undefined;
};

export const hasProperty = <T extends object, K extends PropertyKey>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> => {
  return key in obj;
};

// 타입 단언 함수
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

export function assertDefined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value is null or undefined');
  }
}

// 브랜드 타입 (nominal typing)
export type Brand<K, T> = K & { __brand: T };

// 브랜드 타입 예시
export type UserId = Brand<string, 'UserId'>;
export type OrganizationId = Brand<string, 'OrganizationId'>;
export type AEDId = Brand<string, 'AEDId'>;