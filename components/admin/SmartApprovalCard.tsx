'use client';

import { useState } from 'react';
import { UserRole } from '@/packages/types';
import {
  generateApprovalSuggestion,
  getApprovalGuidelines,
  getApprovalRecommendation,
  getRoleDisplayName,
  getRoleBadgeColor,
  type ApprovalSuggestion
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
}

interface SmartApprovalCardProps {
  user: UserWithProfile;
  onQuickApprove: (userId: string, suggestion: ApprovalSuggestion) => void;
  onCustomApprove: (userId: string) => void;
  onReject: (userId: string) => void;
  processing?: boolean;
}

export function SmartApprovalCard({
  user,
  onQuickApprove,
  onCustomApprove,
  onReject,
  processing = false
}: SmartApprovalCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const suggestion = generateApprovalSuggestion(
    user.email,
    user.organization_name
  );

  const guidelines = getApprovalGuidelines(
    user.email,
    user.organization_name,
    user.phone,
    user.remarks
  );

  const recommendation = getApprovalRecommendation(guidelines);

  const getConfidenceBadge = (confidence: string) => {
    const styles = {
      high: 'bg-green-500/20 text-green-400 border-green-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      low: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    const labels = { high: '높음', medium: '보통', low: '낮음' };

    return (
      <span className={`inline-block px-2 py-1 text-xs rounded border ${styles[confidence as keyof typeof styles]}`}>
        신뢰도: {labels[confidence as keyof typeof labels]}
      </span>
    );
  };

  const getRecommendationBadge = (action: string) => {
    const styles = {
      auto_approve: 'bg-green-600 text-white',
      review_approve: 'bg-blue-600 text-white',
      careful_review: 'bg-yellow-600 text-white',
      reject: 'bg-red-600 text-white'
    };
    const labels = {
      auto_approve: '자동승인',
      review_approve: '승인권장',
      careful_review: '검토필요',
      reject: '거부권장'
    };

    return (
      <span className={`inline-block px-2 py-1 text-xs rounded font-medium ${styles[action as keyof typeof styles]}`}>
        {labels[action as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-medium truncate">
              {user.fullName || '이름 없음'}
            </h3>
            {getRecommendationBadge(recommendation.action)}
          </div>
          <p className="text-sm text-gray-400 truncate">{user.email}</p>
          <div className="flex items-center gap-2 mt-1">
            {getConfidenceBadge(suggestion.confidence)}
            <span className="text-xs text-gray-500">
              점수: {recommendation.score}점
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-gray-400 hover:text-white p-1"
          aria-label="상세 정보 토글"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* 추천 설정 */}
      <div className="bg-gray-900/50 rounded-lg p-3 mb-3">
        <h4 className="text-sm font-medium text-gray-300 mb-2">추천 설정</h4>
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-block px-2 py-1 text-xs rounded ${getRoleBadgeColor(suggestion.role)} text-white`}>
            {getRoleDisplayName(suggestion.role)}
          </span>
          {suggestion.regionCode && (
            <span className="inline-block px-2 py-1 text-xs rounded bg-gray-700 text-gray-300">
              {suggestion.regionCode}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400">{suggestion.reason}</p>
      </div>

      {/* 상세 정보 (접힌 상태) */}
      {showDetails && (
        <div className="space-y-3 mb-3">
          {/* 기본 정보 */}
          <div className="bg-gray-900/30 rounded-lg p-3">
            <h5 className="text-sm font-medium text-gray-300 mb-2">신청서 정보</h5>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">소속기관:</span>
                <span className="text-gray-300">{user.organization_name || '미제공'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">연락처:</span>
                <span className="text-gray-300">{user.phone || '미제공'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">신청일:</span>
                <span className="text-gray-300">
                  {new Date(user.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
              {user.remarks && (
                <div>
                  <span className="text-gray-500">신청사유:</span>
                  <p className="text-gray-300 mt-1 text-xs leading-relaxed">
                    {user.remarks}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 검증 결과 */}
          <div className="bg-gray-900/30 rounded-lg p-3">
            <h5 className="text-sm font-medium text-gray-300 mb-2">검증 체크리스트</h5>
            <div className="space-y-1">
              {guidelines.map(guideline => (
                <div key={guideline.id} className="flex items-center gap-2 text-xs">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    guideline.status === 'pass' ? 'bg-green-500' :
                    guideline.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <span className="text-gray-300">{guideline.description}</span>
                  <span className="text-gray-500 ml-auto">
                    {guideline.weight}점
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-700">
              <p className="text-xs text-gray-400">
                {recommendation.reason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-2">
        {recommendation.action === 'auto_approve' || recommendation.action === 'review_approve' ? (
          <button
            onClick={() => onQuickApprove(user.id, suggestion)}
            disabled={processing}
            className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
          >
            {processing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
            빠른 승인
          </button>
        ) : (
          <button
            onClick={() => onCustomApprove(user.id)}
            disabled={processing}
            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            사용자 정의 승인
          </button>
        )}

        <button
          onClick={() => onReject(user.id)}
          disabled={processing}
          className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          거부
        </button>
      </div>
    </div>
  );
}