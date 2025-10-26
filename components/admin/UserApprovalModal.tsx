'use client';

import { useState, useEffect } from 'react';
import { UserRole } from '@/packages/types';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import { getRegionCode } from '@/lib/constants/regions';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { validateDomainForRole, getAllowedRolesForDomain } from '@/lib/auth/access-control';

interface UserApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (data: ApprovalData) => Promise<void>;
  user: {
    id: string;
    email: string;
    fullName?: string;
    phone?: string;
    department?: string;
    organization_name?: string;
    organization_id?: string;
    health_center?: string;
    region_code?: string;
    created_at: string;
  } | null;
  organizations: Array<{
    id: string;
    name: string;
    type: string;
    region_code: string;
  }>;
  regions: string[];
}

interface ApprovalData {
  role: UserRole;
  organizationId?: string;
  regionCode?: string;
  department?: string;
}

// 이메일 도메인 기반 추천 로직
function getRecommendedSettings(email: string): Partial<ApprovalData> {
  const domain = email.split('@')[1];

  // NMC 도메인
  if (domain === 'nmc.or.kr') {
    return {
      role: 'emergency_center_admin',
      regionCode: '중앙'
    };
  }

  // korea.kr 도메인은 다양한 공공기관에서 사용하므로
  // 구체적인 역할 추천은 하지 않음

  // korea.kr 도메인 (공공기관)
  if (domain === 'korea.kr') {
    // 이메일 주소에서 지역 힌트 찾기
    const emailLocal = email.split('@')[0].toLowerCase();

    // 보건소 패턴 감지
    if (emailLocal.includes('health') || emailLocal.includes('보건')) {
      return {
        role: 'local_admin'
      };
    }

    // 시도 관련 키워드
    if (emailLocal.includes('시') || emailLocal.includes('도')) {
      return {
        role: 'regional_admin'
      };
    }

    return {
      role: 'local_admin'
    };
  }

  // 기본값
  return {
    role: 'local_admin'
  };
}

export function UserApprovalModal({
  isOpen,
  onClose,
  onApprove,
  user,
  organizations,
  regions
}: UserApprovalModalProps) {
  const [formData, setFormData] = useState<ApprovalData>({
    role: 'local_admin'
  });
  const [loading, setLoading] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(true);
  const [domainValidation, setDomainValidation] = useState<{
    allowed: boolean;
    error?: string;
    suggestedRole?: UserRole;
  } | null>(null);

  // 사용자 변경 시 추천 설정 적용 및 기존 선택 정보 반영
  useEffect(() => {
    if (user && organizations.length > 0) {
      const recommended = getRecommendedSettings(user.email);

      // 사용자가 가입 시 입력한 정보 우선 사용
      const initialRegion = user.region_code || recommended.regionCode;

      // 사용자가 이미 organization_id를 가지고 있는 경우 우선 사용
      let matchedOrgId = user.organization_id || null;

      // organization_id가 없지만 organization_name이 있는 경우 매칭 시도
      if (!matchedOrgId && user.organization_name) {
        const matchedOrg = organizations.find(org => {
          const orgNameLower = org.name.toLowerCase();
          const userOrgName = user.organization_name!.toLowerCase();
          const normalizedOrgName = orgNameLower.replace(/\s+/g, '');
          const normalizedUserOrg = userOrgName.replace(/\s+/g, '');

          return org.name === user.organization_name ||
                 normalizedOrgName === normalizedUserOrg ||
                 orgNameLower.includes(userOrgName) ||
                 userOrgName.includes(orgNameLower);
        });

        if (matchedOrg) {
          matchedOrgId = matchedOrg.id;
        }
      }

      setFormData({
        role: recommended.role || 'local_admin',
        regionCode: initialRegion,
        organizationId: matchedOrgId || undefined,
        department: user.department
      });
      setShowRecommendation(true);
    }
  }, [user, organizations]);

  // 역할 변경 시 지역 자동 설정
  useEffect(() => {
    if (formData.role === 'emergency_center_admin' || formData.role === 'ministry_admin') {
      setFormData(prev => ({ ...prev, regionCode: '중앙' }));
    }
  }, [formData.role]);

  // ✅ 도메인 기반 역할 검증 (보안 패치 2025-10-18)
  useEffect(() => {
    if (user && formData.role) {
      const validation = validateDomainForRole(user.email, formData.role);
      setDomainValidation(validation);
    }
  }, [user, formData.role]);

  if (!isOpen || !user) return null;

  // 선택된 지역에 맞는 조직 필터링
  const filteredOrganizations = organizations.filter(org => {
    if (!formData.regionCode) return false;

    // 중앙응급의료센터나 보건복지부 역할인 경우
    if (formData.role === 'emergency_center_admin' || formData.role === 'ministry_admin') {
      return org.region_code === '중앙' || org.region_code === 'KR';
    }

    // 지역 코드 매칭 - 긴 형태와 짧은 형태 모두 확인
    // formData.regionCode는 '서울특별시' 같은 긴 형태일 수 있음
    const regionCodeFromLabel = getRegionCode(formData.regionCode); // 긴 형태를 코드로 변환

    return org.region_code === formData.regionCode ||
           org.region_code === regionCodeFromLabel ||
           org.region_code === getRegionCode(formData.regionCode);
  });

  // 추천 조직 찾기 - 사용자가 가입 시 선택한 조직 우선
  const recommendedOrg = filteredOrganizations.find(org => {
    const orgNameLower = org.name.toLowerCase();
    const userOrgName = (user.organization_name || user.health_center || '').toLowerCase();

    // 정확한 매칭 우선 (ex: '원주시 보건소' vs '원주시 보건소')
    if (org.name === user.organization_name) return true;

    // 부분 매칭 (ex: '원주시보건소' vs '원주시 보건소')
    const normalizedOrgName = orgNameLower.replace(/\s+/g, '');
    const normalizedUserOrg = userOrgName.replace(/\s+/g, '');

    return normalizedOrgName === normalizedUserOrg ||
           orgNameLower.includes(userOrgName) ||
           userOrgName.includes(orgNameLower);
  });


  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onApprove(formData);
      onClose();
    } catch (error) {
      console.error('Approval failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 도메인에 따라 허용된 역할만 표시 (보안 패치 2025-10-18)
  const allRoleOptions: { value: UserRole; label: string; description: string }[] = [
    { value: 'local_admin', label: '보건소 담당자', description: '보건소 단위 AED 점검 담당' },
    { value: 'regional_admin', label: '시도 관리자', description: '시도 단위 AED 관리 및 통계' },
    { value: 'ministry_admin', label: '보건복지부', description: '전국 AED 정책 및 관리' },
    { value: 'emergency_center_admin', label: '중앙응급의료센터', description: 'AED 시스템 전체 관리' },
    { value: 'regional_emergency_center_admin', label: '권역응급의료센터', description: '권역 단위 응급의료 관리' },
    { value: 'temporary_inspector', label: '임시 점검원', description: '배정된 AED 점검만 가능' }
  ];

  const allowedRoles = user ? getAllowedRolesForDomain(user.email) : [];
  const roleOptions = allRoleOptions.filter(option => allowedRoles.includes(option.value));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto border border-slate-700">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">사용자 승인</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="p-6 bg-slate-800/50">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">신청자 정보</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">이름:</span>
              <span className="ml-2 text-white font-medium">{user.fullName || '미입력'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">이메일:</span>
              <span className="ml-2 text-white font-medium">{user.email}</span>
              <span className="ml-2 text-xs text-gray-400">
                (도메인: @{user.email.split('@')[1]})
              </span>
            </div>
            <div>
              <span className="text-gray-500">전화번호:</span>
              <span className="ml-2 text-white font-medium">
                {user.phone ? formatPhoneNumber(user.phone) : '미입력'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">신청일시:</span>
              <span className="ml-2 text-white font-medium">
                {new Date(user.created_at).toLocaleString('ko-KR')}
              </span>
            </div>
            {user.department && (
              <div>
                <span className="text-gray-500">부서:</span>
                <span className="ml-2 text-white font-medium">{user.department}</span>
              </div>
            )}
            {(user.organization_name || user.health_center) && (
              <div className="col-span-2">
                <span className="text-gray-500">신청 소속:</span>
                <span className="ml-2 text-white font-medium">
                  {user.organization_name || user.health_center}
                </span>
              </div>
            )}
            {user.region_code && (
              <div>
                <span className="text-gray-500">신청 지역:</span>
                <span className="ml-2 text-white font-medium">{user.region_code}</span>
              </div>
            )}
          </div>
        </div>

        {/* Domain Validation Warning/Success (Security Patch 2025-10-18) */}
        {domainValidation && (
          <div className={`mx-6 mt-6 p-4 rounded-lg border ${
            domainValidation.allowed
              ? 'bg-green-900/20 border-green-700/50'
              : 'bg-red-900/20 border-red-700/50'
          }`}>
            <div className="flex items-start gap-3">
              {domainValidation.allowed ? (
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h4 className={`text-sm font-semibold mb-1 ${
                  domainValidation.allowed ? 'text-green-400' : 'text-red-400'
                }`}>
                  {domainValidation.allowed ? '도메인 검증 통과' : '도메인 불일치 경고'}
                </h4>
                <p className="text-xs text-gray-300">
                  {domainValidation.allowed
                    ? `이메일 도메인(@${user.email.split('@')[1]})이 선택한 역할에 적합합니다.`
                    : domainValidation.error
                  }
                </p>
                {!domainValidation.allowed && domainValidation.suggestedRole && (
                  <button
                    onClick={() => setFormData({ ...formData, role: domainValidation.suggestedRole! })}
                    className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                  >
                    추천 역할로 변경: {allRoleOptions.find(r => r.value === domainValidation.suggestedRole)?.label}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recommendation */}
        {showRecommendation && getRecommendedSettings(user.email).role && (
          <div className="mx-6 mt-4 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
            <div className="flex items-start">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-400 mb-1">추천 설정</h4>
                <p className="text-xs text-gray-400">
                  이메일 도메인 기반으로 다음 설정을 추천합니다:
                </p>
                <div className="mt-2 text-sm text-white">
                  <span className="font-medium">역할:</span> {
                    allRoleOptions.find(r => r.value === getRecommendedSettings(user.email).role)?.label
                  }
                  {getRecommendedSettings(user.email).regionCode && (
                    <>, <span className="font-medium">지역:</span> {getRecommendedSettings(user.email).regionCode}</>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowRecommendation(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              역할 선택 <span className="text-red-400">*</span>
              <span className="text-xs text-gray-400 ml-2">
                (도메인에 따라 선택 가능한 역할이 제한됩니다)
              </span>
            </label>
            <div className="grid gap-2">
              {roleOptions.map(option => {
                const isAllowed = allowedRoles.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={`
                      flex items-start p-3 rounded-lg border cursor-pointer transition-all
                      ${formData.role === option.value
                        ? 'bg-blue-900/30 border-blue-600 shadow-lg'
                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={option.value}
                      checked={formData.role === option.value}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{option.label}</span>
                        {isAllowed && (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{option.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Region Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              지역 선택 <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.regionCode || ''}
              onChange={(e) => setFormData({ ...formData, regionCode: e.target.value, organizationId: undefined })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              disabled={formData.role === 'emergency_center_admin' || formData.role === 'ministry_admin'}
            >
              <option value="">지역을 선택하세요</option>
              {regions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>

          {/* Organization Selection */}
          {formData.regionCode && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                소속기관 선택
                {formData.role === 'local_admin' && <span className="text-red-400"> *</span>}
                {filteredOrganizations.length === 0 && (
                  <span className="text-yellow-400 text-xs ml-2">
                    (해당 지역에 등록된 조직이 없습니다)
                  </span>
                )}
              </label>
              {recommendedOrg && (
                <div className="mb-2 p-2 bg-green-900/20 border border-green-700/50 rounded text-xs text-green-400">
                  추천: {recommendedOrg.name}
                </div>
              )}
              {filteredOrganizations.length > 0 ? (
                <select
                  value={formData.organizationId || ''}
                  onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">소속기관을 선택하세요</option>
                  {filteredOrganizations.map(org => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                      {org.id === recommendedOrg?.id && ' (추천)'}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full px-3 py-2 bg-slate-900 border border-yellow-700 rounded-lg text-yellow-400 text-sm">
                  선택한 지역에 등록된 조직이 없습니다.
                  {formData.role !== 'local_admin' && (
                    <span className="block text-xs mt-1 text-gray-400">
                      보건소 담당자가 아닌 경우 조직 선택은 선택사항입니다.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              부서명 (선택)
            </label>
            <input
              type="text"
              value={formData.department || ''}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              placeholder="예: 보건의료과"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-700">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !formData.role || !formData.regionCode ||
                     (formData.role === 'local_admin' && !formData.organizationId) ||
                     (domainValidation && !domainValidation.allowed)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={domainValidation && !domainValidation.allowed ? '도메인 검증 실패 - 승인 불가' : ''}
          >
            {loading ? '처리 중...' : '승인'}
          </button>
        </div>
      </div>
    </div>
  );
}