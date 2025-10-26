'use client';

import { useState } from 'react';
import { UserRole } from '@/packages/types';
import { generateApprovalSuggestion, getRoleDisplayName } from '@/lib/utils/approval-helpers';

interface UserWithProfile {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  organization_name?: string;
  remarks?: string;
  role: UserRole;
  created_at: string;
}

interface BulkApprovalPanelProps {
  selectedUsers: string[];
  users: UserWithProfile[];
  onBulkApprove: (userIds: string[]) => Promise<void>;
  onBulkReject: (userIds: string[]) => Promise<void>;
  onClearSelection: () => void;
  processing: boolean;
}

export function BulkApprovalPanel({
  selectedUsers,
  users,
  onBulkApprove,
  onBulkReject,
  onClearSelection,
  processing
}: BulkApprovalPanelProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  if (selectedUsers.length === 0) return null;

  const selectedUserData = users.filter(user => selectedUsers.includes(user.id));

  // 선택된 사용자들의 추천 설정 분석
  const recommendations = selectedUserData.map(user => ({
    user,
    suggestion: generateApprovalSuggestion(user.email, user.organization_name)
  }));

  const roleDistribution = recommendations.reduce((acc, { suggestion }) => {
    acc[suggestion.role] = (acc[suggestion.role] || 0) + 1;
    return acc;
  }, {} as Record<UserRole, number>);

  const confidenceDistribution = recommendations.reduce((acc, { suggestion }) => {
    acc[suggestion.confidence] = (acc[suggestion.confidence] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleBulkAction = async () => {
    if (!action) return;

    if (action === 'approve') {
      await onBulkApprove(selectedUsers);
    } else {
      await onBulkReject(selectedUsers);
    }

    setShowConfirm(false);
    setAction(null);
    setRejectReason('');
  };

  const startBulkAction = (actionType: 'approve' | 'reject') => {
    setAction(actionType);
    setShowConfirm(true);
  };

  return (
    <>
      {/* 벌크 액션 패널 */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40">
        <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl backdrop-blur-xl p-4 min-w-[320px] max-w-md">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-white font-medium">
                {selectedUsers.length}명 선택됨
              </span>
            </div>
            <button
              onClick={onClearSelection}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors"
              aria-label="선택 해제"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 선택된 사용자 요약 */}
          <div className="mb-4 space-y-2">
            <div className="text-xs text-gray-400">추천 역할 분포:</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(roleDistribution).map(([role, count]) => (
                <span
                  key={role}
                  className="inline-block px-2 py-1 text-xs rounded bg-gray-700 text-gray-300"
                >
                  {getRoleDisplayName(role as UserRole)} {count}명
                </span>
              ))}
            </div>

            <div className="text-xs text-gray-400 mt-2">신뢰도 분포:</div>
            <div className="flex gap-2">
              {Object.entries(confidenceDistribution).map(([confidence, count]) => (
                <span
                  key={confidence}
                  className={`inline-block px-2 py-1 text-xs rounded ${
                    confidence === 'high' ? 'bg-green-600/20 text-green-400' :
                    confidence === 'medium' ? 'bg-yellow-600/20 text-yellow-400' :
                    'bg-red-600/20 text-red-400'
                  }`}
                >
                  {confidence === 'high' ? '높음' : confidence === 'medium' ? '보통' : '낮음'} {count}명
                </span>
              ))}
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={() => startBulkAction('approve')}
              disabled={processing}
              className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {processing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              일괄 승인
            </button>
            <button
              onClick={() => startBulkAction('reject')}
              disabled={processing}
              className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {processing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              일괄 거부
            </button>
          </div>
        </div>
      </div>

      {/* 확인 모달 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-800 max-w-lg w-full p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              {action === 'approve' ? '일괄 승인 확인' : '일괄 거부 확인'}
            </h2>

            <div className="mb-6">
              <p className="text-gray-300 mb-4">
                선택된 {selectedUsers.length}명의 사용자를
                {action === 'approve' ? ' 승인' : ' 거부'}하시겠습니까?
              </p>

              {/* 선택된 사용자 목록 */}
              <div className="bg-gray-800/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                <div className="space-y-2">
                  {selectedUserData.map(user => (
                    <div key={user.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-white font-medium">
                          {user.fullName || '이름 없음'}
                        </span>
                        <span className="text-gray-400 ml-2">
                          ({user.email})
                        </span>
                      </div>
                      {action === 'approve' && (
                        <span className="text-xs text-green-400">
                          {getRoleDisplayName(generateApprovalSuggestion(user.email, user.organization_name).role)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {action === 'reject' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    거부 사유 (선택사항)
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:border-green-500 focus:outline-none"
                    rows={3}
                    placeholder="예: 소속기관 확인 불가, 중복 신청 등"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setAction(null);
                  setRejectReason('');
                }}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleBulkAction}
                disabled={processing}
                className={`flex-1 px-4 py-2 text-white rounded transition-colors disabled:opacity-50 ${
                  action === 'approve'
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {processing ? '처리 중...' :
                 action === 'approve' ? '승인 확인' : '거부 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}