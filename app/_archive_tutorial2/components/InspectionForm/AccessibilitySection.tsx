/**
 * AccessibilitySection Component
 * 접근성 및 운영시간 점검 섹션 - 모듈화된 컴포넌트
 */

'use client';

import React, { useState } from 'react';

interface AccessibilitySectionProps {
  operatingHours: Array<{
    day: string;
    start: string;
    end: string;
    closed: boolean;
  }>;
  is24Hours: boolean;
  accessibility: string;
  lastInspectionDate: string;
  onUpdate: (field: string, value: unknown) => void;
  onComplete: (itemKey: string) => void;
  completedItems: Set<string>;
}

export const AccessibilitySection: React.FC<AccessibilitySectionProps> = ({
  operatingHours,
  is24Hours,
  accessibility,
  lastInspectionDate,
  onUpdate,
  onComplete,
  completedItems,
}) => {
  const [editingHours, setEditingHours] = useState(false);
  const [tempHours, setTempHours] = useState(operatingHours);
  const [editingAccess, setEditingAccess] = useState(false);
  const [tempAccess, setTempAccess] = useState(accessibility);

  // 운영시간 토글
  const toggle24Hours = () => {
    const newValue = !is24Hours;
    onUpdate('is24Hours', newValue);
    onComplete('operatingHours');

    if (newValue) {
      // 24시간 운영으로 설정
      const allDayHours = ['월', '화', '수', '목', '금', '토', '일'].map(day => ({
        day,
        start: '00:00',
        end: '24:00',
        closed: false
      }));
      onUpdate('operatingHours', allDayHours);
    }
  };

  // 요일별 운영시간 수정
  const updateDayHours = (index: number, field: 'start' | 'end' | 'closed', value: string | boolean) => {
    const newHours = [...tempHours];
    if (field === 'closed') {
      newHours[index].closed = value as boolean;
      if (value) {
        newHours[index].start = '';
        newHours[index].end = '';
      }
    } else {
      newHours[index][field] = value as string;
    }
    setTempHours(newHours);
  };

  // 운영시간 저장
  const saveOperatingHours = () => {
    onUpdate('operatingHours', tempHours);
    onComplete('operatingHours');
    setEditingHours(false);
  };

  // 최근 점검일로부터 경과일 계산
  const calculateDaysSinceInspection = () => {
    if (!lastInspectionDate) return null;
    const today = new Date();
    const lastDate = new Date(lastInspectionDate);
    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysSince = calculateDaysSinceInspection();
  const inspectionStatusColor = daysSince === null ? 'text-gray-400' :
    daysSince <= 30 ? 'text-green-400' :
    daysSince <= 60 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-4">
      <h3 className="text-lg font-bold text-white mb-4">접근성 및 운영정보</h3>

      {/* 24시간 운영 토글 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm">24시간 운영</span>
          {completedItems.has('operatingHours') && (
            <span className="text-xs text-green-400">✓ 확인됨</span>
          )}
        </div>

        <div className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
          <span className="text-white">24시간 연중무휴 운영</span>
          <button
            onClick={toggle24Hours}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              is24Hours ? 'bg-green-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                is24Hours ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 운영시간 상세 설정 */}
      {!is24Hours && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-sm">운영시간 상세</span>
            {editingHours && (
              <div className="flex gap-2">
                <button
                  onClick={saveOperatingHours}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setEditingHours(false);
                    setTempHours(operatingHours);
                  }}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
                >
                  취소
                </button>
              </div>
            )}
          </div>

          <div className="bg-gray-700 rounded-lg p-3 space-y-2">
            {editingHours ? (
              <div className="space-y-2">
                {tempHours.map((hour, index) => (
                  <div key={hour.day} className="flex items-center gap-2">
                    <span className="text-white w-8 text-sm">{hour.day}</span>

                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={hour.closed}
                        onChange={(e) => updateDayHours(index, 'closed', e.target.checked)}
                        className="rounded text-green-600"
                      />
                      <span className="text-xs text-gray-400">휴무</span>
                    </label>

                    {!hour.closed && (
                      <>
                        <input
                          type="time"
                          value={hour.start}
                          onChange={(e) => updateDayHours(index, 'start', e.target.value)}
                          className="bg-gray-600 text-white px-2 py-1 rounded text-sm"
                        />
                        <span className="text-gray-400">~</span>
                        <input
                          type="time"
                          value={hour.end}
                          onChange={(e) => updateDayHours(index, 'end', e.target.value)}
                          className="bg-gray-600 text-white px-2 py-1 rounded text-sm"
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {operatingHours.map(hour => (
                  <div key={hour.day} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">{hour.day}</span>
                    <span className="text-white">
                      {hour.closed ? '휴무' : `${hour.start || '미설정'} ~ ${hour.end || '미설정'}`}
                    </span>
                  </div>
                ))}
                <button
                  onClick={() => setEditingHours(true)}
                  className="mt-2 w-full py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-500"
                >
                  수정
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 접근성 메모 */}
      <div className="space-y-3 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm">접근성 특이사항</span>
          {completedItems.has('accessibility') && (
            <span className="text-xs text-green-400">✓ 확인됨</span>
          )}
        </div>

        <div className="bg-gray-700 rounded-lg p-3">
          {editingAccess ? (
            <div className="space-y-2">
              <textarea
                value={tempAccess}
                onChange={(e) => setTempAccess(e.target.value)}
                className="w-full bg-gray-600 text-white px-3 py-2 rounded resize-none"
                rows={3}
                placeholder="예: 휠체어 접근 가능, 계단 없음, 주차장 인접"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onUpdate('accessibility', tempAccess);
                    onComplete('accessibility');
                    setEditingAccess(false);
                  }}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setEditingAccess(false);
                    setTempAccess(accessibility);
                  }}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-white text-sm">{accessibility || '특이사항 없음'}</p>
              <button
                onClick={() => setEditingAccess(true)}
                className="mt-2 px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-500"
              >
                수정
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 최근 점검 정보 */}
      <div className="pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm">최근 점검</span>
          <div className="text-right">
            <p className="text-white text-sm">
              {lastInspectionDate ? new Date(lastInspectionDate).toLocaleDateString('ko-KR') : '점검 기록 없음'}
            </p>
            {daysSince !== null && (
              <p className={`text-xs ${inspectionStatusColor}`}>
                {daysSince}일 경과
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 진행 상태 요약 */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">섹션 진행률</span>
          <span className="text-green-400">
            {[
              completedItems.has('operatingHours'),
              completedItems.has('accessibility')
            ].filter(Boolean).length} / 2 완료
          </span>
        </div>
      </div>
    </div>
  );
};

export default AccessibilitySection;