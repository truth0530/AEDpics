'use client';

import { UserRole } from '@/packages/types';
import { SmartApprovalCard } from './SmartApprovalCard';
import { MobileUserCard } from './MobileUserCard';
import { type ApprovalSuggestion } from '@/lib/utils/approval-helpers';

interface UserWithProfile {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  organizationId?: string;
  organization?: { id: string; name: string } | null;
  organization_id?: string;
  organization_name?: string;
  remarks?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  created_at: string;
  updated_at: string;
  department?: string;
  region_code?: string;
  health_center?: string;
  last_login_at?: string;
  login_count?: number;
  auth_metadata?: {
    last_sign_in_at?: string;
    created_at?: string;
  };
}

interface SelectableUserCardProps {
  user: UserWithProfile;
  isSelected: boolean;
  onSelect: (userId: string, selected: boolean) => void;
  onQuickApprove: (userId: string, suggestion: ApprovalSuggestion) => void;
  onCustomApprove: (userId: string) => void;
  onReject: (userId: string) => void;
  onViewDetails: (user: UserWithProfile) => void;
  processing: boolean;
  isPending: boolean;
}

export function SelectableUserCard({
  user,
  isSelected,
  onSelect,
  onQuickApprove,
  onCustomApprove,
  onReject,
  onViewDetails,
  processing,
  isPending
}: SelectableUserCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    // 체크박스나 버튼 클릭이 아닌 경우에만 상세보기
    const target = e.target as HTMLElement;
    if (!target.closest('input, button, [role="button"]')) {
      onViewDetails(user);
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect(user.id, e.target.checked);
  };

  return (
    <div className="relative">
      {/* 선택 체크박스 (승인 대기 사용자만) */}
      {isPending && (
        <div className="absolute top-2 left-2 z-10">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleCheckboxChange}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-green-500 border-green-500'
                : 'bg-gray-800 border-gray-600 hover:border-gray-500'
            }`}>
              {isSelected && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </label>
        </div>
      )}

      {/* 선택된 경우 배경 강조 */}
      <div
        className={`transition-all duration-200 ${
          isSelected ? 'ring-2 ring-green-500/50 bg-green-500/5' : ''
        } ${isPending ? 'pl-8' : ''}`}
        onClick={handleCardClick}
      >
        {isPending ? (
          <SmartApprovalCard
            user={user}
            onQuickApprove={onQuickApprove}
            onCustomApprove={onCustomApprove}
            onReject={onReject}
            processing={processing}
          />
        ) : (
          <MobileUserCard
            user={user as Parameters<typeof MobileUserCard>[0]['user']}
            isPending={false}
            onApprove={onCustomApprove}
            onReject={onReject}
            onViewDetails={onViewDetails}
          />
        )}
      </div>
    </div>
  );
}