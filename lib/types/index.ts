// AED 점검 시스템 타입 정의
import { user_role } from '@prisma/client';

export type OrganizationType = 'ministry' | 'emergency_center' | 'province' | 'city' | 'health_center';

// Prisma의 user_role enum을 re-export
export type UserRole = user_role;

export type InspectionType = 'monthly' | 'special' | 'emergency';

export type DeviceStatus = 'operational' | 'needs_repair' | 'non_operational';

export type BatteryStatus = 'good' | 'low' | 'replace';

export type PadStatus = 'good' | 'expired' | 'missing';

export type InspectionStatus = 'normal' | 'warning' | 'critical' | 'malfunction';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export type PriorityLevel = 'expired' | 'critical' | 'warning' | 'normal';

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  parentId?: string;
  region_code?: string;
  city_code?: string;
  address?: string;
  contact?: string;
  contactNumber?: string;
  managerName?: string;
  managerEmail?: string;
  latitude?: number;
  longitude?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  organizationId?: string;
  organization_name?: string | null;
  organization?: Organization;
  region?: string;  // 한글 지역명 (예: "서울특별시")
  region_code?: string;  // 지역 코드 (예: "SEO")
  role: UserRole;
  isActive: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPermission {
  id: string;
  userId: string;
  permissionType: string;
  scopeType?: 'national' | 'regional' | 'local';
  scopeValue?: string[];
  createdAt: Date;
}

export interface AEDDevice {
  id: string;
  serialNumber: string;
  modelName: string;
  manufacturer: string;
  installationDate?: Date;
  expiryDate?: Date;
  locationName: string;
  locationAddress: string;
  locationDetail?: string;
  latitude?: number;
  longitude?: number;
  organizationId?: string;
  organization?: Organization;
  managerName?: string;
  managerPhone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InspectionRecord {
  id: string;
  aedId: string;
  aed?: AEDDevice;
  inspectorId: string;
  inspector?: UserProfile;
  inspectionDate: Date;
  inspectionType: InspectionType;
  status: InspectionStatus;
  batteryStatus: BatteryStatus;
  padStatus: PadStatus;
  deviceStatus: DeviceStatus;
  notes?: string;
  photos?: string[];
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InspectionPriority {
  id: string;
  serialNumber: string;
  locationName: string;
  expiryDate?: Date;
  priorityLevel: PriorityLevel;
  lastInspectionDate?: Date;
  daysSinceInspection?: number;
}

// 인증 관련 타입
export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  organizationId?: string;
  region?: string;
  organizationName?: string;
  customOrganizationName?: string; // 기타 선택 시 수기 입력값
  remarks?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

// API 응답 타입
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  success: boolean;
}

// 페이지네이션 타입
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 필터 타입
export interface AEDDeviceFilter {
  organizationId?: string;
  regionCode?: string;
  status?: DeviceStatus;
  priorityLevel?: PriorityLevel;
  searchTerm?: string;
}

export interface InspectionFilter {
  aedId?: string;
  inspectorId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: InspectionStatus;
  verificationStatus?: VerificationStatus;
}

// Database notification types
export interface AppNotification {
  id: string;
  recipient_id: string;
  sender_id?: string;
  type: 'new_signup' | 'approval_completed' | 'approval_rejected' | 'system_update' | 'organization_change_request' | 'role_updated';
  title: string;
  message: string;
  data?: {
    actionUrl?: string;
    approved?: boolean;
    reason?: string;
    approverName?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
  is_read: boolean;
  created_at: string;
  expires_at?: string;
  sender?: {
    id: string;
    full_name: string;
    email?: string;
  };
}

export interface NotificationTemplate {
  type: string;
  title_template: string;
  message_template: string;
  default_expiry_hours?: number;
  email_enabled: boolean;
  push_enabled: boolean;
  priority: 'low' | 'medium' | 'high';
}
