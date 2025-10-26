'use client';

import { UserRole } from '@/packages/types';
import {
  getApprovalGuidelines,
  getApprovalRecommendation,
  getRoleDisplayName
} from '@/lib/utils/approval-helpers';

interface UserWithProfile {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  organization_name?: string;
  remarks?: string;
  role: UserRole;
  created_at: string;
  region?: string;
  department?: string;
  position?: string;
}

interface UserApplicationInfoProps {
  user: UserWithProfile;
  showRecommendation?: boolean;
}

export function UserApplicationInfo({ user, showRecommendation = true }: UserApplicationInfoProps) {
  const guidelines = getApprovalGuidelines(
    user.email,
    user.organization_name,
    user.phone,
    user.remarks
  );

  const recommendation = getApprovalRecommendation(guidelines);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short'
    });
  };

  const getValidationIcon = (status: 'pass' | 'warning' | 'fail') => {
    switch (status) {
      case 'pass':
        return (
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'fail':
        return (
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
    }
  };

  const getRecommendationStyle = (action: string) => {
    const styles = {
      auto_approve: 'bg-green-600/20 border-green-500/30 text-green-400',
      review_approve: 'bg-blue-600/20 border-blue-500/30 text-blue-400',
      careful_review: 'bg-yellow-600/20 border-yellow-500/30 text-yellow-400',
      reject: 'bg-red-600/20 border-red-500/30 text-red-400'
    };
    return styles[action as keyof typeof styles] || 'bg-gray-600/20 border-gray-500/30 text-gray-400';
  };

  const getRecommendationLabel = (action: string) => {
    const labels = {
      auto_approve: '자동 승인 권장',
      review_approve: '승인 권장',
      careful_review: '신중한 검토 필요',
      reject: '거부 권장'
    };
    return labels[action as keyof typeof labels] || '검토 필요';
  };

  return (
    <div className="space-y-4">
      {/* 신청서 기본 정보 */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-300">📋 신청서 정보</h4>
          <span className="text-xs text-gray-500">
            {formatDateTime(user.created_at)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">신청자 이름</label>
              <p className="text-white font-medium">{user.fullName || '미제공'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">이메일</label>
              <p className="text-white">{user.email}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">연락처</label>
              <p className="text-white">{user.phone || '미제공'}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">소속기관</label>
              <p className="text-white">{user.organization_name || '미제공'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">지역</label>
              <p className="text-white">{user.region || '미지정'}</p>
            </div>
            {user.department && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">부서</label>
                <p className="text-white">{user.department}</p>
              </div>
            )}
          </div>
        </div>

        {user.remarks && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <label className="text-xs text-gray-500 block mb-2">💬 신청 사유</label>
            <div className="bg-gray-900/50 rounded p-3 border border-gray-700/30">
              <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                {user.remarks}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 자동 검증 결과 */}
      {showRecommendation && (
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-300">🔍 자동 검증 결과</h4>
            <div className={`px-2 py-1 rounded text-xs border ${getRecommendationStyle(recommendation.action)}`}>
              {getRecommendationLabel(recommendation.action)}
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {guidelines.map((guideline, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <div className="flex-shrink-0">
                  {getValidationIcon(guideline.status)}
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <span className={`${
                    guideline.status === 'pass' ? 'text-gray-300' :
                    guideline.status === 'warning' ? 'text-yellow-300' : 'text-red-300'
                  }`}>
                    {guideline.description}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    guideline.status === 'pass' ? 'bg-green-600/20 text-green-400' :
                    guideline.status === 'warning' ? 'bg-yellow-600/20 text-yellow-400' :
                    'bg-red-600/20 text-red-400'
                  }`}>
                    {guideline.weight}점
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-gray-700/50">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">종합 점수:</span>
                <span className="text-white font-medium">{recommendation.score}점</span>
              </div>
              <div className="text-xs text-gray-500">
                최대 31점
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              {recommendation.reason}
            </p>
          </div>
        </div>
      )}

      {/* 현재 상태 정보 */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-3">📊 현재 상태</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <label className="text-xs text-gray-500 block mb-1">계정 상태</label>
            <span className={`inline-block px-2 py-1 text-xs rounded ${
              user.role === 'pending_approval'
                ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-green-600/20 text-green-400 border border-green-500/30'
            }`}>
              {getRoleDisplayName(user.role)}
            </span>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">가입 경과</label>
            <p className="text-white">
              {Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))}일 전
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}