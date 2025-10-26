// 카테고리 분류 확인 및 수정 컴포넌트
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { validateAEDRequirement, ValidationResult } from '@/utils/aed-validation-rules';

interface CategorySectionProps {
  currentCategory1?: string;
  currentCategory2?: string;
  currentCategory3?: string;
  institutionName?: string;
  additionalInfo?: {
    area?: number;
    dailyVisitors?: number;
    seats?: number;
    households?: number;
    floors?: number;
    workers?: number;
    tonnage?: number;
  };
  onCategoryChange?: (category1: string, category2: string, category3: string) => void;
  markItemComplete?: (itemKey: string) => void;
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  currentCategory1 = '',
  currentCategory2 = '',
  currentCategory3 = '',
  institutionName = '',
  additionalInfo,
  onCategoryChange,
  markItemComplete
}) => {
  const router = useRouter();
  const [category1, setCategory1] = useState(currentCategory1);
  const [category2, setCategory2] = useState(currentCategory2);
  const [category3, setCategory3] = useState(currentCategory3);
  const [isEditing, setIsEditing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showConditionInput, setShowConditionInput] = useState(false);
  const [conditionInputs, setConditionInputs] = useState({
    area: additionalInfo?.area || undefined,
    dailyVisitors: additionalInfo?.dailyVisitors || undefined,
    seats: additionalInfo?.seats || undefined,
    households: additionalInfo?.households || undefined,
    floors: additionalInfo?.floors || undefined,
    workers: additionalInfo?.workers || undefined,
    tonnage: additionalInfo?.tonnage || undefined
  });


  // 카테고리 옵션
  const category1Options = ['구비의무기관', '구비의무기관 외'];

  const category2Options = {
    '구비의무기관': [
      '의료기관',
      '교육기관',
      '공공기관',
      '교통시설',
      '체육시설',
      '숙박시설',
      '문화시설',
      '복지시설'
    ],
    '구비의무기관 외': [
      '일반사업장',
      '종교시설',
      '아파트/주택',
      '공원/광장',
      '기타시설'
    ]
  };

  const category3Options = {
    '의료기관': ['종합병원', '병원', '의원', '치과', '한의원', '약국', '보건소'],
    '교육기관': ['대학교', '고등학교', '중학교', '초등학교', '유치원', '어린이집', '학원'],
    '공공기관': ['시청', '구청', '동사무소', '경찰서', '소방서', '우체국', '법원'],
    '교통시설': ['공항', '기차역', '버스터미널', '지하철역', '항만', '휴게소'],
    '체육시설': ['체육관', '수영장', '운동장', '헬스장', '골프장', '스키장'],
    '숙박시설': ['호텔', '모텔', '펜션', '리조트', '민박', '게스트하우스'],
    '문화시설': ['박물관', '미술관', '도서관', '공연장', '영화관', '전시장'],
    '복지시설': ['노인복지관', '장애인복지관', '청소년센터', '아동센터'],
    '일반사업장': ['사무실', '공장', '상가', '매장', '창고'],
    '종교시설': ['교회', '성당', '절', '기도원'],
    '아파트/주택': ['아파트', '빌라', '주택', '원룸'],
    '공원/광장': ['공원', '광장', '놀이터', '산책로'],
    '기타시설': ['기타']
  };

  useEffect(() => {
    setCategory1(currentCategory1);
    setCategory2(currentCategory2);
    setCategory3(currentCategory3);
  }, [currentCategory1, currentCategory2, currentCategory3]);

  useEffect(() => {
    validateCategory();
     
  }, [category1, institutionName, conditionInputs]);

  const validateCategory = () => {
    setValidationError(null);

    if (!institutionName) return;

    // 새로운 검증 로직 사용
    const result = validateAEDRequirement(institutionName, conditionInputs);
    setValidationResult(result);

    // 구비의무기관으로 분류되었는데 실제로는 아닌 경우
    if (category1 === '구비의무기관' && !result.isMandatory) {
      if (result.needsVerification) {
        setValidationError(
          `조건 확인 필요: "${institutionName}"은(는) ${result.conditions?.join(' 또는 ')} 조건을 충족해야 구비의무기관입니다.`
        );
        setShowConditionInput(true);
      } else {
        setValidationError(`경고: "${institutionName}"은(는) 구비의무기관이 아닐 수 있습니다.`);
      }
    }
    // 구비의무기관 외로 분류되었는데 실제로는 의무인 경우
    else if (category1 === '구비의무기관 외' && result.isMandatory) {
      setValidationError(
        `경고: "${institutionName}"은(는) ${result.category} 카테고리의 구비의무기관입니다. (${result.legalBasis})`
      );
    }
    // 조건부 의무 대상인데 조건 확인이 필요한 경우
    else if (!result.isMandatory && result.needsVerification) {
      setValidationError(
        `확인 필요: ${result.reason}. 조건: ${result.conditions?.join(' 또는 ')}`
      );
      setShowConditionInput(true);
    }

    // 분류 누락 검증
    if (!category2 || !category3) {
      setValidationError(prevError =>
        prevError ? prevError : '경고: 중분류 또는 소분류가 누락되었습니다.'
      );
    }
  };

  const handleSave = () => {
    if (onCategoryChange) {
      onCategoryChange(category1, category2, category3);
    }
    if (markItemComplete) {
      markItemComplete('category');
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setCategory1(currentCategory1);
    setCategory2(currentCategory2);
    setCategory3(currentCategory3);
    setIsEditing(false);
    setValidationError(null);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-white">카테고리 분류 확인</h3>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
          >
            수정
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
            >
              저장
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
            >
              취소
            </button>
          </div>
        )}
      </div>

      {validationError && (
        <div className="bg-yellow-900/50 border border-yellow-600 rounded p-2 mb-3">
          <p className="text-yellow-400 text-sm">{validationError}</p>
          {validationResult?.legalBasis && (
            <p className="text-yellow-400/70 text-xs mt-1">근거: {validationResult.legalBasis}</p>
          )}
        </div>
      )}

      {/* 조건 입력 폼 (필요시 표시) */}
      {showConditionInput && validationResult?.needsVerification && (
        <div className="bg-blue-900/30 border border-blue-600/50 rounded p-3 mb-3">
          <h4 className="text-sm font-medium text-blue-300 mb-2">설치 의무 조건 확인</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {validationResult.conditions?.some(c => c.includes('면적')) && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">면적 (㎡)</label>
                <input
                  type="number"
                  value={conditionInputs.area || ''}
                  onChange={(e) => setConditionInputs(prev => ({
                    ...prev,
                    area: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                  placeholder="예: 2500"
                />
              </div>
            )}
            {validationResult.conditions?.some(c => c.includes('이용객')) && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">일평균 이용객 수</label>
                <input
                  type="number"
                  value={conditionInputs.dailyVisitors || ''}
                  onChange={(e) => setConditionInputs(prev => ({
                    ...prev,
                    dailyVisitors: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                  placeholder="예: 5000"
                />
              </div>
            )}
            {validationResult.conditions?.some(c => c.includes('좌석')) && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">좌석 수</label>
                <input
                  type="number"
                  value={conditionInputs.seats || ''}
                  onChange={(e) => setConditionInputs(prev => ({
                    ...prev,
                    seats: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                  placeholder="예: 6000"
                />
              </div>
            )}
            {validationResult.conditions?.some(c => c.includes('세대')) && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">세대 수</label>
                <input
                  type="number"
                  value={conditionInputs.households || ''}
                  onChange={(e) => setConditionInputs(prev => ({
                    ...prev,
                    households: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                  placeholder="예: 600"
                />
              </div>
            )}
            {validationResult.conditions?.some(c => c.includes('층')) && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">층수</label>
                <input
                  type="number"
                  value={conditionInputs.floors || ''}
                  onChange={(e) => setConditionInputs(prev => ({
                    ...prev,
                    floors: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                  placeholder="예: 20"
                />
              </div>
            )}
            {validationResult.conditions?.some(c => c.includes('근로자')) && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">상시근로자 수</label>
                <input
                  type="number"
                  value={conditionInputs.workers || ''}
                  onChange={(e) => setConditionInputs(prev => ({
                    ...prev,
                    workers: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  className="w-full bg-gray-700 text-white rounded px-2 py-1 text-sm"
                  placeholder="예: 350"
                />
              </div>
            )}
          </div>
          <button
            onClick={() => setShowConditionInput(false)}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300"
          >
            조건 입력 닫기
          </button>
        </div>
      )}

      <div className="space-y-3">
        {/* 대분류 */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            대분류
          </label>
          {isEditing ? (
            <select
              value={category1}
              onChange={(e) => {
                setCategory1(e.target.value);
                setCategory2('');
                setCategory3('');
              }}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
            >
              <option value="">선택하세요</option>
              {category1Options.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ) : (
            <div className="bg-gray-700 rounded px-3 py-2 text-white">
              {category1 || '미분류'}
            </div>
          )}
        </div>

        {/* 중분류 */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            중분류
          </label>
          {isEditing ? (
            <select
              value={category2}
              onChange={(e) => {
                setCategory2(e.target.value);
                setCategory3('');
              }}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
              disabled={!category1}
            >
              <option value="">선택하세요</option>
              {category1 && category2Options[category1 as keyof typeof category2Options]?.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ) : (
            <div className="bg-gray-700 rounded px-3 py-2 text-white">
              {category2 || '미분류'}
            </div>
          )}
        </div>

        {/* 소분류 */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            소분류
          </label>
          {isEditing ? (
            <select
              value={category3}
              onChange={(e) => setCategory3(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
              disabled={!category2}
            >
              <option value="">선택하세요</option>
              {category2 && category3Options[category2 as keyof typeof category3Options]?.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ) : (
            <div className="bg-gray-700 rounded px-3 py-2 text-white">
              {category3 || '미분류'}
            </div>
          )}
        </div>

        {/* 설치기관명 (참고용) */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            설치기관명 (참고)
          </label>
          <div className="bg-gray-700/50 rounded px-3 py-2 text-gray-300">
            {institutionName || '정보 없음'}
          </div>
        </div>
      </div>

      {/* 카테고리 분류 가이드 */}
      <div className="mt-4 p-3 bg-gray-900 rounded">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">분류 가이드</h4>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• 
                <span className="text-gray-300">AED 설치 의무 기관인지 법령 근거로 확인</span>
              </li>
              <li>• 기관 유형과 설치 조건(면적·이용객 등)을 현장에서 검증</li>
              <li>• 불확실할 경우 지침 원문과 보건복지부 질의 회신으로 재확인</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={() => router.push('/aed-installation-targets')}
            className="flex-shrink-0 text-xs px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            설치 대상 열람
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-3">
          근거: 「응급의료에 관한 법률」 제47조의2 및 시행령 제26조의5, 자동심장충격기 설치 및 관리 지침(제7판) 붙임1.
        </p>
      </div>

    </div>
  );
};
