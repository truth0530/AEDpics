/**
 * BatteryPadSection Component
 * 배터리 및 패드 점검 섹션 - 모듈화된 컴포넌트
 */

'use client';

import React, { useState } from 'react';
import { AEDDataValidator } from '../../types/ProductionAEDTypes';

interface BatteryPadSectionProps {
  batteryExpiry: string;
  padExpiry: string;
  batteryStatus: 'normal' | 'replace' | 'missing';
  padStatus: 'normal' | 'replace' | 'missing';
  onUpdate: (field: string, value: unknown) => void;
  onComplete: (itemKey: string) => void;
  completedItems: Set<string>;
  validationErrors: Record<string, string>;
}

export const BatteryPadSection: React.FC<BatteryPadSectionProps> = ({
  batteryExpiry,
  padExpiry,
  batteryStatus,
  padStatus,
  onUpdate,
  onComplete,
  completedItems,
  validationErrors,
}) => {
  const [editingBattery, setEditingBattery] = useState(false);
  const [editingPad, setEditingPad] = useState(false);
  const [tempBatteryDate, setTempBatteryDate] = useState(batteryExpiry);
  const [tempPadDate, setTempPadDate] = useState(padExpiry);

  // 날짜 계산
  const calculateDaysRemaining = (dateStr: string) => {
    if (!dateStr) return null;
    const today = new Date();
    const targetDate = new Date(dateStr);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const batteryDays = calculateDaysRemaining(batteryExpiry);
  const padDays = calculateDaysRemaining(padExpiry);

  // 색상 결정
  const getDaysColor = (days: number | null) => {
    if (days === null) return 'text-gray-400';
    if (days <= 0) return 'text-red-400';
    if (days <= 30) return 'text-yellow-400';
    return 'text-green-400';
  };

  // 배터리 날짜 저장
  const saveBatteryDate = () => {
    const validation = AEDDataValidator.validateBatteryExpiry(tempBatteryDate);
    if (validation.valid) {
      onUpdate('batteryExpiry', tempBatteryDate);
      onComplete('batteryExpiry');
      setEditingBattery(false);
    } else {
      // 검증 오류 표시
      validation.errors.forEach(error => {
        onUpdate('validationError', { field: error.field, message: error.message });
      });
    }
  };

  // 패드 날짜 저장
  const savePadDate = () => {
    onUpdate('padExpiry', tempPadDate);
    onComplete('padExpiry');
    setEditingPad(false);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-4">
      <h3 className="text-lg font-bold text-white mb-4">배터리 및 패드 정보</h3>

      {/* 배터리 섹션 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm">배터리 유효기간</span>
          {completedItems.has('batteryExpiry') && (
            <span className="text-xs text-green-400">✓ 확인됨</span>
          )}
        </div>

        <div className="bg-gray-700 rounded-lg p-3">
          {editingBattery ? (
            <div className="space-y-2">
              <input
                type="date"
                value={tempBatteryDate}
                onChange={(e) => setTempBatteryDate(e.target.value)}
                className="w-full bg-gray-600 text-white px-3 py-2 rounded"
              />
              {validationErrors.battery_expiry_date && (
                <p className="text-xs text-red-400">{validationErrors.battery_expiry_date}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={saveBatteryDate}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setEditingBattery(false);
                    setTempBatteryDate(batteryExpiry);
                  }}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">{batteryExpiry || '미입력'}</p>
                {batteryDays !== null && (
                  <p className={`text-sm ${getDaysColor(batteryDays)}`}>
                    {batteryDays > 0 ? `${batteryDays}일 남음` : '만료됨'}
                  </p>
                )}
              </div>
              <button
                onClick={() => setEditingBattery(true)}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-500"
              >
                수정
              </button>
            </div>
          )}
        </div>

        {/* 배터리 상태 */}
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm">배터리 상태</span>
          {completedItems.has('batteryStatus') && (
            <span className="text-xs text-green-400">✓ 확인됨</span>
          )}
        </div>
        <div className="flex gap-2">
          {['normal', 'replace', 'missing'].map((status) => (
            <button
              key={status}
              onClick={() => {
                onUpdate('batteryStatus', status);
                onComplete('batteryStatus');
              }}
              className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                batteryStatus === status
                  ? status === 'normal'
                    ? 'bg-green-600 text-white'
                    : status === 'replace'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-red-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {status === 'normal' ? '정상' : status === 'replace' ? '교체필요' : '없음'}
            </button>
          ))}
        </div>
      </div>

      {/* 패드 섹션 */}
      <div className="space-y-3 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm">패드 유효기간</span>
          {completedItems.has('padExpiry') && (
            <span className="text-xs text-green-400">✓ 확인됨</span>
          )}
        </div>

        <div className="bg-gray-700 rounded-lg p-3">
          {editingPad ? (
            <div className="space-y-2">
              <input
                type="date"
                value={tempPadDate}
                onChange={(e) => setTempPadDate(e.target.value)}
                className="w-full bg-gray-600 text-white px-3 py-2 rounded"
              />
              <div className="flex gap-2">
                <button
                  onClick={savePadDate}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setEditingPad(false);
                    setTempPadDate(padExpiry);
                  }}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">{padExpiry || '미입력'}</p>
                {padDays !== null && (
                  <p className={`text-sm ${getDaysColor(padDays)}`}>
                    {padDays > 0 ? `${padDays}일 남음` : '만료됨'}
                  </p>
                )}
              </div>
              <button
                onClick={() => setEditingPad(true)}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-500"
              >
                수정
              </button>
            </div>
          )}
        </div>

        {/* 패드 상태 */}
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm">패드 상태</span>
          {completedItems.has('padStatus') && (
            <span className="text-xs text-green-400">✓ 확인됨</span>
          )}
        </div>
        <div className="flex gap-2">
          {['normal', 'replace', 'missing'].map((status) => (
            <button
              key={status}
              onClick={() => {
                onUpdate('padStatus', status);
                onComplete('padStatus');
              }}
              className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                padStatus === status
                  ? status === 'normal'
                    ? 'bg-green-600 text-white'
                    : status === 'replace'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-red-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {status === 'normal' ? '정상' : status === 'replace' ? '교체필요' : '없음'}
            </button>
          ))}
        </div>
      </div>

      {/* 진행 상태 요약 */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">섹션 진행률</span>
          <span className="text-green-400">
            {[
              completedItems.has('batteryExpiry'),
              completedItems.has('batteryStatus'),
              completedItems.has('padExpiry'),
              completedItems.has('padStatus')
            ].filter(Boolean).length} / 4 완료
          </span>
        </div>
      </div>
    </div>
  );
};

export default BatteryPadSection;