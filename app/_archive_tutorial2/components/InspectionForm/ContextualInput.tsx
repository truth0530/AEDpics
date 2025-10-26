'use client';

import React, { useState, useEffect } from 'react';

interface ContextualInputProps {
  label: string;
  fieldName: string;
  originalValue?: string | null;
  currentValue?: string;
  onValueChange: (value: string) => void;
  onStatusChange: (status: 'match' | 'different' | 'missing') => void;
  placeholder?: string;
  type?: 'text' | 'date';
  required?: boolean;
}

export const ContextualInput: React.FC<ContextualInputProps> = ({
  label,
  fieldName,
  originalValue,
  currentValue,
  onValueChange,
  onStatusChange,
  placeholder,
  type = 'text',
  required = false
}) => {
  const [inputValue, setInputValue] = useState(currentValue || '');
  const [comparisonStatus, setComparisonStatus] = useState<'match' | 'different' | 'missing' | null>(null);

  // currentValue가 외부에서 변경될 때 inputValue 동기화
  useEffect(() => {
    setInputValue(currentValue || '');
  }, [currentValue]);

  // 값 정규화 함수 (날짜 형식 통일)
  const normalizeValue = (value: string): string => {
    if (!value) return '';

    if (type === 'date') {
      // 날짜 형식을 YYYY-MM-DD로 정규화
      const dateFormats = [
        /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/,  // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
        /(\d{1,2})[-./](\d{1,2})[-./](\d{4})/,  // MM-DD-YYYY, MM/DD/YYYY, MM.DD.YYYY
        /(\d{4})(\d{2})(\d{2})/                 // YYYYMMDD
      ];

      for (const format of dateFormats) {
        const match = value.match(format);
        if (match) {
          let year, month, day;
          if (format === dateFormats[0] || format === dateFormats[2]) {
            [, year, month, day] = match;
          } else {
            [, month, day, year] = match;
          }

          // 월과 일을 2자리로 패딩
          const paddedMonth = month.padStart(2, '0');
          const paddedDay = day.padStart(2, '0');

          return `${year}-${paddedMonth}-${paddedDay}`;
        }
      }
    }

    return value.trim();
  };

  // 원본값과 비교하여 상태 결정 (정규화된 값으로 비교)
  const determineStatus = (newValue: string) => {
    if (!originalValue) {
      setComparisonStatus('missing');
      onStatusChange('missing');
      return;
    }

    const normalizedNew = normalizeValue(newValue);
    const normalizedOriginal = normalizeValue(originalValue);

    if (normalizedNew === normalizedOriginal) {
      setComparisonStatus('match');
      onStatusChange('match');
    } else {
      setComparisonStatus('different');
      onStatusChange('different');
    }
  };

  // 데이터 검증 함수
  const validateValue = (value: string): { isValid: boolean; error?: string } => {
    if (!value.trim()) {
      if (required) {
        return { isValid: false, error: '필수 입력 항목입니다.' };
      }
      return { isValid: true };
    }

    if (type === 'date') {
      const normalizedValue = normalizeValue(value);
      const date = new Date(normalizedValue);

      if (isNaN(date.getTime())) {
        return { isValid: false, error: '올바른 날짜 형식이 아닙니다.' };
      }

      const currentDate = new Date();
      const oneYearAgo = new Date(currentDate);
      oneYearAgo.setFullYear(currentDate.getFullYear() - 1);
      const twoYearsFromNow = new Date(currentDate);
      twoYearsFromNow.setFullYear(currentDate.getFullYear() + 2);

      if (date < oneYearAgo) {
        return { isValid: false, error: '너무 과거의 날짜입니다.' };
      }

      if (date > twoYearsFromNow) {
        return { isValid: false, error: '너무 먼 미래의 날짜입니다.' };
      }

      // 만료 경고 (30일 이내)
      const thirtyDaysFromNow = new Date(currentDate);
      thirtyDaysFromNow.setDate(currentDate.getDate() + 30);

      if (date <= currentDate) {
        return { isValid: true, error: '이미 만료되었습니다!' };
      } else if (date <= thirtyDaysFromNow) {
        return { isValid: true, error: '30일 이내에 만료됩니다.' };
      }
    }

    return { isValid: true };
  };

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // 검증 수행
    const validation = validateValue(newValue);
    setValidationError(validation.error || null);

    onValueChange(newValue);
    determineStatus(newValue);
  };

  const handleQuickMatch = () => {
    if (originalValue) {
      setInputValue(originalValue);
      onValueChange(originalValue);
      setComparisonStatus('match');
      onStatusChange('match');
    }
  };

  const getStatusColor = () => {
    switch (comparisonStatus) {
      case 'match':
        return 'border-green-500 bg-green-50';
      case 'different':
        return 'border-orange-500 bg-orange-50';
      case 'missing':
        return 'border-gray-300 bg-gray-50';
      default:
        return 'border-gray-300';
    }
  };

  const getStatusIcon = () => {
    switch (comparisonStatus) {
      case 'match':
        return '✅';
      case 'different':
        return '🔄';
      case 'missing':
        return '❓';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-2">
      {/* 레이블과 상태 */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="flex items-center gap-2">
          {comparisonStatus && (
            <span className="text-sm text-gray-600">
              {getStatusIcon()}
              {comparisonStatus === 'match' && '일치'}
              {comparisonStatus === 'different' && '수정됨'}
              {comparisonStatus === 'missing' && '기준값 없음'}
            </span>
          )}
        </div>
      </div>

      {/* 기준값 정보 */}
      {originalValue && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-blue-700">
              📋 시스템 기준값: <strong>{originalValue}</strong>
            </span>
            <button
              type="button"
              onClick={handleQuickMatch}
              className="px-3 py-2 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 min-h-[44px] min-w-[44px] active:bg-blue-300 transition-colors touch-manipulation"
              aria-label="기준값과 일치하다고 표시"
            >
              일치함
            </button>
          </div>
        </div>
      )}

      {/* 입력 필드 */}
      <div className="relative">
        <input
          id={`input-${fieldName}`}
          type={type}
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder || `현장에서 확인한 ${label.toLowerCase()}`}
          className={`w-full px-4 py-3 text-base rounded-md border ${getStatusColor()} focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] touch-manipulation`}
          aria-label={`${label} 입력 필드`}
          aria-describedby={`${fieldName}-status ${fieldName}-context`}
          aria-invalid={validationError ? 'true' : 'false'}
          aria-required={required}
          inputMode={type === 'date' ? 'numeric' : 'text'}
        />

        {/* 상태 아이콘 (스크린 리더용 설명 포함) */}
        {comparisonStatus && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <span
              className="text-lg"
              role="img"
              aria-label={
                comparisonStatus === 'match' ? '일치함' :
                comparisonStatus === 'different' ? '수정됨' : '기준값 없음'
              }
            >
              {getStatusIcon()}
            </span>
          </div>
        )}
      </div>

      {/* 상태 정보 (스크린 리더용) */}
      <div
        id={`${fieldName}-status`}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {comparisonStatus === 'match' && '시스템 정보와 일치'}
        {comparisonStatus === 'different' && '시스템 정보와 다름'}
        {comparisonStatus === 'missing' && '기준값 없음'}
        {validationError && `오류: ${validationError}`}
      </div>

      {/* 검증 에러 메시지 */}
      {validationError && (
        <div
          id={`${fieldName}-context`}
          className={`text-sm p-2 rounded ${
            validationError.includes('만료')
              ? 'text-red-600 bg-red-50'
              : validationError.includes('30일')
                ? 'text-yellow-600 bg-yellow-50'
                : 'text-red-600 bg-red-50'
          }`}
          role="alert"
        >
          <span role="img" aria-label="경고">⚠️</span> {validationError}
        </div>
      )}

      {/* 맥락 메시지 (검증 에러가 없을 때만 표시) */}
      {!validationError && comparisonStatus === 'different' && (
        <div
          id={`${fieldName}-context`}
          className="text-sm text-orange-600 bg-orange-50 p-2 rounded"
        >
          <span role="img" aria-label="정보">💡</span> 현장에서 다른 값을 확인했습니다. 교체나 수리가 있었는지 메모에 기록해 주세요.
        </div>
      )}

      {!validationError && comparisonStatus === 'match' && (
        <div
          id={`${fieldName}-context`}
          className="text-sm text-green-600 bg-green-50 p-2 rounded"
        >
          <span role="img" aria-label="확인">✅</span> 시스템 정보와 현장 상태가 일치합니다.
        </div>
      )}
    </div>
  );
};

export default ContextualInput;