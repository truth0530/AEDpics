'use client';
import { UserRole, UserProfile } from '@/packages/types';

interface UserWithProfile extends UserProfile {
  created_at: string;
  updated_at: string;
  department?: string;
  region_code?: string;
  organization_name?: string;
  health_center?: string;
  last_login_at?: string;
  login_count?: number;
  auth_metadata?: {
    last_sign_in_at?: string;
    created_at?: string;
  };
}

interface MobileUserCardProps {
  user: UserWithProfile;
  onApprove: (userId: string) => void;
  onReject: (userId: string) => void;
  onViewDetails: (user: UserWithProfile) => void;
  isPending: boolean;
}

export function MobileUserCard({
  user,
  onApprove,
  onReject,
  onViewDetails,
  isPending
}: MobileUserCardProps) {

  const getRoleBadgeColor = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      master: 'bg-purple-500',
      emergency_center_admin: 'bg-red-500',
      ministry_admin: 'bg-blue-500',
      regional_admin: 'bg-green-500',
      local_admin: 'bg-yellow-500',
      temporary_inspector: 'bg-orange-500',
      pending_approval: 'bg-gray-500',
      email_verified: 'bg-gray-400'
    };
    return colors[role] || 'bg-gray-500';
  };

  const getRoleDisplayName = (role: UserRole) => {
    const names: Record<UserRole, string> = {
      master: 'Master',
      emergency_center_admin: '중앙응급의료센터',
      ministry_admin: '보건복지부',
      regional_admin: '시도 관리자',
      local_admin: '보건소 담당자',
      temporary_inspector: '임시 점검원',
      pending_approval: '승인 대기',
      email_verified: '이메일 인증됨'
    };
    return names[role] || role;
  };

  return (
    <div
      className="bg-gray-800 rounded-lg p-4 mb-3 border border-gray-700 active:bg-gray-750 transition-colors"
      onClick={() => onViewDetails(user)}
    >
      {/* 상단 정보 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate">
            {user.fullName || '이름 없음'}
          </h3>
          <p className="text-sm text-gray-400 truncate">
            {user.email}
          </p>
        </div>
        <div className="ml-3 flex-shrink-0">
          <span className={`inline-block px-2 py-1 text-xs rounded-full text-white ${getRoleBadgeColor(user.role)}`}>
            {getRoleDisplayName(user.role)}
          </span>
        </div>
      </div>

      {/* 중간 정보 */}
      <div className="mb-3 space-y-1">
        <div className="flex items-center text-sm">
          <svg className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m0 0h5M9 7h1m0 0V5M9 7v0M15 7h1m1 0v2M15 7v0" />
          </svg>
          <span className="text-gray-300 truncate">
            {user.organization?.name || user.organization_name || user.department || user.region_code || '소속 미지정'}
          </span>
        </div>
        <div className="flex items-center text-sm">
          <svg className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 9a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-gray-400 text-xs">
            가입: {new Date(user.created_at).toLocaleDateString('ko-KR')}
          </span>
        </div>
      </div>

      {/* 액션 버튼들 */}
      {isPending ? (
        <div className="flex gap-2 mt-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApprove(user.id);
            }}
            className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            승인
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReject(user.id);
            }}
            className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            거부
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            로그인 {user.login_count || 0}회
          </span>
          <span>
            최종: {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString('ko-KR') : '없음'}
          </span>
        </div>
      )}

      {/* 터치 피드백 표시 */}
      <div className="flex items-center justify-center mt-2 opacity-60">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}