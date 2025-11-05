'use client';

import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

export interface DaySchedule {
  enabled: boolean;
  timeRange: string; // "04:30~25:30" 형식
}

export interface ImprovedWeeklySchedule {
  is24hours: boolean; // 24시간 사용 가능 체크박스
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
  holiday?: DaySchedule; // 공휴일 추가
  sundayWeeks?: {
    everyWeek: boolean;
    week1: boolean;
    week2: boolean;
    week3: boolean;
    week4: boolean;
    week5: boolean;
  };
}

interface ImprovedWeeklyScheduleInputProps {
  value: ImprovedWeeklySchedule;
  onChange: (schedule: ImprovedWeeklySchedule) => void;
}

const DAYS = [
  { key: 'monday' as keyof ImprovedWeeklySchedule, label: '월', fullLabel: '월요일', group: 'weekday' },
  { key: 'tuesday' as keyof ImprovedWeeklySchedule, label: '화', fullLabel: '화요일', group: 'weekday' },
  { key: 'wednesday' as keyof ImprovedWeeklySchedule, label: '수', fullLabel: '수요일', group: 'weekday' },
  { key: 'thursday' as keyof ImprovedWeeklySchedule, label: '목', fullLabel: '목요일', group: 'weekday' },
  { key: 'friday' as keyof ImprovedWeeklySchedule, label: '금', fullLabel: '금요일', group: 'weekday' },
  { key: 'saturday' as keyof ImprovedWeeklySchedule, label: '토', fullLabel: '토요일', group: 'weekend' },
  { key: 'sunday' as keyof ImprovedWeeklySchedule, label: '일', fullLabel: '일요일', group: 'weekend' },
  { key: 'holiday' as keyof ImprovedWeeklySchedule, label: '휴', fullLabel: '공휴일', group: 'weekend' },
];

export function ImprovedWeeklyScheduleInput({ value, onChange }: ImprovedWeeklyScheduleInputProps) {
  // 일괄 입력을 위한 시간 상태
  const [weekdayBatchTime, setWeekdayBatchTime] = useState('04:30~25:30');
  const [weekendBatchTime, setWeekendBatchTime] = useState('04:30~25:30');

  // 24시간 사용가능 토글
  const handle24HoursToggle = (checked: boolean) => {
    if (checked) {
      // 24시간 사용가능로 설정하면 모든 요일 체크 해제
      const newSchedule: ImprovedWeeklySchedule = {
        is24hours: true,
      };
      onChange(newSchedule);
    } else {
      // 24시간 사용가능 해제하면 빈 스케줄로
      onChange({ is24hours: false });
    }
  };

  // 개별 요일 토글
  const toggleDay = (day: keyof ImprovedWeeklySchedule) => {
    if (day === 'is24hours') return; // is24hours는 별도 처리

    const newSchedule = { ...value };
    const currentDay = newSchedule[day] as DaySchedule | undefined;

    if (currentDay?.enabled) {
      // 비활성화
      (newSchedule as any)[day] = {
        enabled: false,
        timeRange: currentDay.timeRange || '04:30~25:30'
      };
    } else {
      // 활성화 - 기본 시간으로
      (newSchedule as any)[day] = {
        enabled: true,
        timeRange: currentDay?.timeRange || '04:30~25:30'
      };
      // 24시간 사용가능 해제
      newSchedule.is24hours = false;
    }

    onChange(newSchedule);
  };

  // 시간 변경
  const handleTimeChange = (day: keyof ImprovedWeeklySchedule, timeRange: string) => {
    if (day === 'is24hours') return;

    const newSchedule = { ...value };
    const currentDay = newSchedule[day] as DaySchedule | undefined;

    (newSchedule as any)[day] = {
      enabled: currentDay?.enabled || false,
      timeRange: timeRange
    };

    onChange(newSchedule);
  };

  // 월~금 일괄 적용
  const applyWeekdayBatch = () => {
    const newSchedule = { ...value, is24hours: false } as any;
    const weekdays = DAYS.filter(d => d.group === 'weekday' && d.key !== 'is24hours');

    weekdays.forEach(({ key }) => {
      newSchedule[key] = {
        enabled: true,
        timeRange: weekdayBatchTime
      };
    });

    onChange(newSchedule);
  };

  // 토요일, 공휴일 일괄 적용
  const applyWeekendBatch = () => {
    const newSchedule = { ...value, is24hours: false } as any;

    newSchedule.saturday = {
      enabled: true,
      timeRange: weekendBatchTime
    };
    newSchedule.holiday = {
      enabled: true,
      timeRange: weekendBatchTime
    };

    onChange(newSchedule);
  };

  // 시간 형식 검증 및 포맷팅
  const formatTimeInput = (input: string): string => {
    // 숫자만 추출
    const digitsOnly = input.replace(/[^0-9]/g, '');

    // 8자리 숫자면 자동으로 HH:MM~HH:MM 형태로 변환
    if (digitsOnly.length === 8) {
      const startHour = digitsOnly.substring(0, 2);
      const startMin = digitsOnly.substring(2, 4);
      const endHour = digitsOnly.substring(4, 6);
      const endMin = digitsOnly.substring(6, 8);
      return `${startHour}:${startMin}~${endHour}:${endMin}`;
    }

    // 8자리보다 적으면 입력 중이므로 숫자만 반환
    if (digitsOnly.length < 8) {
      return digitsOnly;
    }

    // 기존 형식 유지
    const cleaned = input.replace(/[^0-9:~]/g, '');
    if (cleaned.includes('~')) {
      const parts = cleaned.split('~');
      if (parts.length === 2) {
        const start = parts[0].replace(/[^0-9:]/g, '');
        const end = parts[1].replace(/[^0-9:]/g, '');
        return `${start}~${end}`;
      }
    }

    return cleaned;
  };

  // 요일이 활성화되었는지 확인
  const isDayChecked = (day: keyof ImprovedWeeklySchedule): boolean => {
    if (day === 'is24hours') return false;
    const dayData = value[day] as DaySchedule | undefined;
    return dayData?.enabled || false;
  };

  // 요일의 시간 값 가져오기
  const getDayTime = (day: keyof ImprovedWeeklySchedule): string => {
    if (day === 'is24hours') return '';
    const dayData = value[day] as DaySchedule | undefined;
    return dayData?.timeRange || '04:30~25:30';
  };

  return (
    <div className="space-y-3">
      {/* 24시간 사용 가능 체크박스 */}
      <div className="flex items-center gap-2 p-2 sm:p-3 bg-gray-800/50 rounded-lg border border-gray-700">
        <Checkbox
          id="24hours"
          checked={value.is24hours}
          onCheckedChange={handle24HoursToggle}
        />
        <label
          htmlFor="24hours"
          className="text-xs sm:text-sm font-medium text-white cursor-pointer select-none"
        >
          24시간 사용 가능
        </label>
      </div>

      {/* 일괄 적용 버튼 및 입력 - 모바일 최적화 (24시간 미선택 시만 표시) */}
      {!value.is24hours && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={weekdayBatchTime}
              onChange={(e) => setWeekdayBatchTime(formatTimeInput(e.target.value))}
              className="w-full px-2 py-2 text-xs bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500/20"
              placeholder="04:30~25:30"
            />
            <button
              type="button"
              onClick={applyWeekdayBatch}
              className="w-full px-2 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              월~금 일괄
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={weekendBatchTime}
              onChange={(e) => setWeekendBatchTime(formatTimeInput(e.target.value))}
              className="w-full px-2 py-2 text-xs bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500/20"
              placeholder="04:30~25:30"
            />
            <button
              type="button"
              onClick={applyWeekendBatch}
              className="w-full px-2 py-2 text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
            >
              토,공휴일
            </button>
          </div>
        </div>
      )}

      {/* 요일별 체크박스와 시간 입력 - 모바일 최적화 (24시간 미선택 시만 표시) */}
      {!value.is24hours && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-y-2 gap-x-2 sm:gap-x-3">
            {DAYS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1">
                <span className="text-[10px] sm:text-xs text-gray-400 min-w-fit">{label}</span>
                <Checkbox
                  id={`day-${key}`}
                  checked={isDayChecked(key)}
                  onCheckedChange={() => toggleDay(key)}
                  className="data-[state=checked]:bg-blue-600 flex-shrink-0"
                />
                <input
                  type="text"
                  value={getDayTime(key)}
                  onChange={(e) => handleTimeChange(key, formatTimeInput(e.target.value))}
                  className="w-20 px-1 py-1 text-[8px] sm:text-xs bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500/20 disabled:bg-gray-900 disabled:text-gray-600"
                  placeholder="04:30~25:30"
                  disabled={!isDayChecked(key)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 일요일 사용 가능 주 선택 */}
      {isDayChecked('sunday') && (
        <div className="space-y-2 p-2 bg-gray-900/50 rounded-lg border border-gray-700">
          <div className="text-xs text-gray-400">일요일 사용 가능 주</div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <Checkbox
                id="sunday-every-week"
                checked={value.sundayWeeks?.everyWeek || false}
                onCheckedChange={(checked) => {
                  onChange({
                    ...value,
                    sundayWeeks: {
                      everyWeek: checked as boolean,
                      week1: checked as boolean,
                      week2: checked as boolean,
                      week3: checked as boolean,
                      week4: checked as boolean,
                      week5: checked as boolean,
                    }
                  });
                }}
              />
              <label htmlFor="sunday-every-week" className="text-xs text-white cursor-pointer">매주</label>
            </div>
            {['week1', 'week2', 'week3', 'week4', 'week5'].map((week, idx) => (
              <div key={week} className="flex items-center gap-1">
                <Checkbox
                  id={`sunday-${week}`}
                  checked={value.sundayWeeks?.[week as keyof Omit<typeof value.sundayWeeks, 'everyWeek'>] || false}
                  onCheckedChange={(checked) => {
                    onChange({
                      ...value,
                      sundayWeeks: {
                        ...value.sundayWeeks,
                        [week]: checked as boolean,
                      }
                    });
                  }}
                />
                <label htmlFor={`sunday-${week}`} className="text-xs text-white cursor-pointer">{idx + 1}주</label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 범정 공휴일 기준 안내 */}
      <div className="text-[10px] sm:text-xs text-red-400 mt-2">
        ※ 법정 공휴일 기준 : 신정, 삼일절, 어린이날, 석가탄신일, 현충일, 광복절, 개천절, 한글날, 크리스마스
      </div>
    </div>
  );
}