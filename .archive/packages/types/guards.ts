/**
 * 타입 가드 유틸리티 함수
 */

import type {
  UserRole,
  OrganizationType,
  InspectionStatus,
  DeviceStatus,
  BatteryStatus,
  PadStatus,
  UserProfile,
  Organization,
  AEDDevice,
  InspectionRecord,
  ApiResponse,
} from './index';

import type {
  UUID,
  Nullable,
  EmailString,
  ISODateString,
} from './common';

/**
 * 기본 타입 가드
 */
export const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value);
};

export const isBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean';
};

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const isArray = <T = unknown>(value: unknown): value is T[] => {
  return Array.isArray(value);
};

export const isFunction = (value: unknown): value is (...args: any[]) => any => {
  return typeof value === 'function';
};

export const isDate = (value: unknown): value is Date => {
  return value instanceof Date && !isNaN(value.getTime());
};

export const isNull = (value: unknown): value is null => {
  return value === null;
};

export const isUndefined = (value: unknown): value is undefined => {
  return value === undefined;
};

export const isNullOrUndefined = (value: unknown): value is null | undefined => {
  return value === null || value === undefined;
};

export const isDefined = <T>(value: T | null | undefined): value is T => {
  return value !== null && value !== undefined;
};

/**
 * 문자열 타입 가드
 */
export const isUUID = (value: unknown): value is UUID => {
  if (!isString(value)) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export const isEmail = (value: unknown): value is EmailString => {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
};

export const isISODateString = (value: unknown): value is ISODateString => {
  if (!isString(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime()) && date.toISOString() === value;
};

export const isURL = (value: unknown): value is string => {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Enum 타입 가드
 */
export const isUserRole = (value: unknown): value is UserRole => {
  const roles: UserRole[] = [
    'master',
    'emergency_center_admin',
    'ministry_admin',
    'regional_admin',
    'local_admin',
    'temporary_inspector',
    'pending_approval',
    'email_verified'
  ];
  return isString(value) && roles.includes(value as UserRole);
};

export const isOrganizationType = (value: unknown): value is OrganizationType => {
  const types: OrganizationType[] = [
    'ministry',
    'emergency_center',
    'province',
    'city',
    'health_center'
  ];
  return isString(value) && types.includes(value as OrganizationType);
};

export const isInspectionStatus = (value: unknown): value is InspectionStatus => {
  const statuses: InspectionStatus[] = ['normal', 'warning', 'critical', 'malfunction'];
  return isString(value) && statuses.includes(value as InspectionStatus);
};

export const isDeviceStatus = (value: unknown): value is DeviceStatus => {
  const statuses: DeviceStatus[] = ['operational', 'needs_repair', 'non_operational'];
  return isString(value) && statuses.includes(value as DeviceStatus);
};

export const isBatteryStatus = (value: unknown): value is BatteryStatus => {
  const statuses: BatteryStatus[] = ['good', 'low', 'replace'];
  return isString(value) && statuses.includes(value as BatteryStatus);
};

export const isPadStatus = (value: unknown): value is PadStatus => {
  const statuses: PadStatus[] = ['good', 'expired', 'missing'];
  return isString(value) && statuses.includes(value as PadStatus);
};

/**
 * 엔티티 타입 가드
 */
export const isUserProfile = (value: unknown): value is UserProfile => {
  if (!isObject(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.id) &&
    isString(obj.email) &&
    isString(obj.fullName) &&
    isUserRole(obj.role) &&
    isBoolean(obj.isActive)
  );
};

export const isOrganization = (value: unknown): value is Organization => {
  if (!isObject(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.id) &&
    isString(obj.name) &&
    isOrganizationType(obj.type)
  );
};

export const isAEDDevice = (value: unknown): value is AEDDevice => {
  if (!isObject(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.id) &&
    isString(obj.serialNumber) &&
    isString(obj.modelName) &&
    isString(obj.manufacturer) &&
    isString(obj.locationName) &&
    isString(obj.locationAddress) &&
    isBoolean(obj.isActive)
  );
};

export const isInspectionRecord = (value: unknown): value is InspectionRecord => {
  if (!isObject(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.id) &&
    isString(obj.aedId) &&
    isString(obj.inspectorId) &&
    isInspectionStatus(obj.status) &&
    isBatteryStatus(obj.batteryStatus) &&
    isPadStatus(obj.padStatus) &&
    isDeviceStatus(obj.deviceStatus)
  );
};

/**
 * API 응답 타입 가드
 */
export const isApiResponse = <T>(
  value: unknown,
  dataGuard?: (data: unknown) => data is T
): value is ApiResponse<T> => {
  if (!isObject(value)) return false;
  const obj = value as Record<string, unknown>;

  if (!isBoolean(obj.success)) return false;

  if (obj.data !== undefined && dataGuard) {
    return dataGuard(obj.data);
  }

  return true;
};

/**
 * 배열 타입 가드
 */
export const isArrayOf = <T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is T[] => {
  return isArray(value) && value.every(guard);
};

/**
 * Nullable 타입 가드
 */
export const isNullable = <T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is Nullable<T> => {
  return value === null || guard(value);
};

/**
 * 복합 타입 가드
 */
export const hasProperty = <T extends object, K extends PropertyKey>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> => {
  return key in obj;
};

export const hasProperties = <T extends object, K extends PropertyKey>(
  obj: T,
  ...keys: K[]
): obj is T & Record<K, unknown> => {
  return keys.every(key => key in obj);
};

/**
 * 권한 체크 가드
 */
export const canAccessAED = (user: UserProfile): boolean => {
  const allowedRoles: UserRole[] = [
    'master',
    'emergency_center_admin',
    'ministry_admin',
    'regional_admin',
    'local_admin'
  ];
  return allowedRoles.includes(user.role);
};

export const canInspectAED = (user: UserProfile): boolean => {
  const allowedRoles: UserRole[] = [
    'master',
    'emergency_center_admin',
    'ministry_admin',
    'regional_admin',
    'local_admin',
    'temporary_inspector'
  ];
  return allowedRoles.includes(user.role);
};

export const isAdminRole = (role: UserRole): boolean => {
  const adminRoles: UserRole[] = [
    'master',
    'emergency_center_admin',
    'ministry_admin'
  ];
  return adminRoles.includes(role);
};

export const isRegionalRole = (role: UserRole): boolean => {
  const regionalRoles: UserRole[] = [
    'regional_admin',
    'local_admin'
  ];
  return regionalRoles.includes(role);
};

/**
 * 비즈니스 로직 가드
 */
export const isExpiredDevice = (device: AEDDevice): boolean => {
  if (!device.expiryDate) return false;
  const expiry = new Date(device.expiryDate);
  return expiry < new Date();
};

export const needsInspection = (record: InspectionRecord): boolean => {
  return record.status === 'warning' || record.status === 'critical';
};

export const isValidInspection = (record: InspectionRecord): boolean => {
  return (
    record.verificationStatus === 'verified' &&
    record.status !== 'malfunction'
  );
};

/**
 * 유틸리티 함수
 */
export const assertType = <T>(
  value: unknown,
  guard: (value: unknown) => value is T,
  message?: string
): asserts value is T => {
  if (!guard(value)) {
    throw new TypeError(message || 'Type assertion failed');
  }
};

export const ensureType = <T>(
  value: unknown,
  guard: (value: unknown) => value is T,
  fallback: T
): T => {
  return guard(value) ? value : fallback;
};

export const filterByType = <T>(
  values: unknown[],
  guard: (value: unknown) => value is T
): T[] => {
  return values.filter(guard);
};

/**
 * JSON 파싱 가드
 */
export const safeJsonParse = <T>(
  json: string,
  guard?: (value: unknown) => value is T
): T | null => {
  try {
    const parsed = JSON.parse(json);
    if (guard && !guard(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

/**
 * 날짜 유효성 검사
 */
export const isValidDate = (value: unknown): value is Date => {
  return isDate(value) && !isNaN(value.getTime());
};

export const isFutureDate = (value: Date | string): boolean => {
  const date = isString(value) ? new Date(value) : value;
  return isValidDate(date) && date > new Date();
};

export const isPastDate = (value: Date | string): boolean => {
  const date = isString(value) ? new Date(value) : value;
  return isValidDate(date) && date < new Date();
};

export const isWithinDays = (value: Date | string, days: number): boolean => {
  const date = isString(value) ? new Date(value) : value;
  if (!isValidDate(date)) return false;

  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days);

  return date >= now && date <= future;
};