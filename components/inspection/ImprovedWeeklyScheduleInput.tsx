'use client';

import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

export interface DaySchedule {
  timeRange: string; // "04:30~25:30" 형식
}

export interface ImprovedWeeklySchedule {
  is24hours: boolean; // 24시간 사용 가능 버튼
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
  const [batchTime, setBatchTime] = useState('09:00~18:00');

  // 24시간 사용가능 토글
  const handle24HoursToggle = () => {
    if (value.is24hours) {
      // 24시간 해제하면 빈 스케줄로
      onChange({ is24hours: false });
    } else {
      // 24시간 활성화하면 모든 요일 데이터 제거
      const newSchedule: ImprovedWeeklySchedule = {
        is24hours: true,
      };
      onChange(newSchedule);
    }
  };

  // 배치 시간 입력에 포커스하면 24시간 비활성화
  const handleBatchTimeChange = (time: string) => {
    setBatchTime(formatTimeInput(time));
    // 입력 시 24시간 자동 비활성화
    if (value.is24hours) {
      onChange({ ...value, is24hours: false });
    }
  };

  // 시간 변경 (입력이 있으면 활성화, 없으면 미운영)
  const handleTimeChange = (day: keyof ImprovedWeeklySchedule, timeRange: string) => {
    if (day === 'is24hours') return;

    const newSchedule = { ...value };

    if (timeRange.trim()) {
      // 입력이 있으면 저장
      (newSchedule as any)[day] = {
        timeRange: timeRange
      };
    } else {
      // 입력이 없으면 해당 요일 데이터 제거 (미운영)
      delete (newSchedule as any)[day];
    }

    onChange(newSchedule);
  };

  // 월~금 일괄 적용/해제 (토글)
  const applyWeekdayBatch = () => {
    const weekdays = DAYS.filter(d => d.group === 'weekday' && d.key !== 'is24hours');

    // 모든 평일이 이미 입력된 시간과 같은지 확인
    const allWeekdaysMatch = weekdays.every(({ key }) => {
      const dayData = value[key] as DaySchedule | undefined;
      return dayData?.timeRange === batchTime;
    });

    const newSchedule = { ...value, is24hours: false } as any;

    if (allWeekdaysMatch) {
      // 모두 일치하면 → 일괄 지우기
      weekdays.forEach(({ key }) => {
        delete newSchedule[key];
      });
    } else {
      // 하나라도 다르면 → 일괄 적용
      weekdays.forEach(({ key }) => {
        newSchedule[key] = {
          timeRange: batchTime
        };
      });
    }

    onChange(newSchedule);
  };

  // 월~토 일괄 적용/해제 (토글)
  const applyWeekdaySaturdayBatch = () => {
    const weekdaysAndSaturday = DAYS.filter(d =>
      (d.group === 'weekday' && d.key !== 'is24hours') || d.key === 'saturday'
    );

    // 모든 월~토가 이미 입력된 시간과 같은지 확인
    const allMatch = weekdaysAndSaturday.every(({ key }) => {
      const dayData = value[key] as DaySchedule | undefined;
      return dayData?.timeRange === batchTime;
    });

    const newSchedule = { ...value, is24hours: false } as any;

    if (allMatch) {
      // 모두 일치하면 → 일괄 지우기
      weekdaysAndSaturday.forEach(({ key }) => {
        delete newSchedule[key];
      });
    } else {
      // 하나라도 다르면 → 일괄 적용
      weekdaysAndSaturday.forEach(({ key }) => {
        newSchedule[key] = {
          timeRange: batchTime
        };
      });
    }

    onChange(newSchedule);
  };

  // 일요일, 공휴일 일괄 적용/해제 (토글)
  const applySundayHolidayBatch = () => {
    // 일요일과 공휴일이 모두 입력된 시간과 같은지 확인
    const sundayData = value.sunday as DaySchedule | undefined;
    const holidayData = value.holiday as DaySchedule | undefined;
    const bothMatch = sundayData?.timeRange === batchTime && holidayData?.timeRange === batchTime;

    const newSchedule = { ...value, is24hours: false } as any;

    if (bothMatch) {
      // 모두 일치하면 → 일괄 지우기
      delete newSchedule.sunday;
      delete newSchedule.holiday;
    } else {
      // 하나라도 다르면 → 일괄 적용
      newSchedule.sunday = {
        timeRange: batchTime
      };
      newSchedule.holiday = {
        timeRange: batchTime
      };
    }

    onChange(newSchedule);
  };

  // 시간 형식 검증 및 포맷팅 (실시간 변환)
  const formatTimeInput = (input: string): string => {
    // 숫자만 추출
    const digitsOnly = input.replace(/[^0-9]/g, '');

    // 4자리 미만: 숫자만 반환
    if (digitsOnly.length < 4) {
      return digitsOnly;
    }

    // 4자리: HH:MM 형태로 변환
    if (digitsOnly.length === 4) {
      const hour = digitsOnly.substring(0, 2);
      const min = digitsOnly.substring(2, 4);
      return `${hour}:${min}`;
    }

    // 4자리 초과 8자리 미만: HH:MM~ 또는 HH:MM~H 형태
    if (digitsOnly.length < 8) {
      const startHour = digitsOnly.substring(0, 2);
      const startMin = digitsOnly.substring(2, 4);
      const endPart = digitsOnly.substring(4);

      // 끝 시간의 시 부분만 있으면 시:분 형태로 포맷팅
      if (endPart.length <= 2) {
        return `${startHour}:${startMin}~${endPart}`;
      } else {
        // 끝 시간의 시:분 형태로 포맷팅
        const endHour = endPart.substring(0, 2);
        const endMin = endPart.substring(2, 4);
        return `${startHour}:${startMin}~${endHour}:${endMin}`;
      }
    }

    // 8자리 이상: HH:MM~HH:MM 형태로 변환
    const startHour = digitsOnly.substring(0, 2);
    const startMin = digitsOnly.substring(2, 4);
    const endHour = digitsOnly.substring(4, 6);
    const endMin = digitsOnly.substring(6, 8);
    return `${startHour}:${startMin}~${endHour}:${endMin}`;
  };

  // 요일이 활성화되었는지 확인 (시간 입력이 있는지 확인)
  const isDayActive = (day: keyof ImprovedWeeklySchedule): boolean => {
    if (day === 'is24hours') return false;
    const dayData = value[day] as DaySchedule | undefined;
    return !!dayData?.timeRange;
  };

  // 요일의 시간 값 가져오기
  const getDayTime = (day: keyof ImprovedWeeklySchedule): string => {
    if (day === 'is24hours') return '';
    const dayData = value[day] as DaySchedule | undefined;
    return dayData?.timeRange || '';
  };

  return (
    <div className="space-y-2">
      {/* 24시간 사용 가능 버튼, 배치 시간 입력, 일괄 적용 버튼 */}
      <div className="flex gap-1 flex-wrap items-center">
        <button
          type="button"
          onClick={handle24HoursToggle}
          className={`px-2 py-1 text-[10px] font-medium rounded transition-all ${
            value.is24hours
              ? 'bg-green-600 text-white border border-green-500'
              : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
          }`}
        >
          24시간
        </button>
        <input
          type="text"
          value={batchTime}
          onChange={(e) => handleBatchTimeChange(e.target.value)}
          placeholder="09:00~18:00"
          disabled={value.is24hours}
          className="w-20 px-1 py-1 text-[10px] bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-center"
        />
        {!value.is24hours && (
          <>
            <button
              type="button"
              onClick={applyWeekdayBatch}
              className="px-1.5 py-1 text-[10px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              월~금
            </button>
            <button
              type="button"
              onClick={applyWeekdaySaturdayBatch}
              className="px-1.5 py-1 text-[10px] font-medium bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
            >
              월~토
            </button>
            <button
              type="button"
              onClick={applySundayHolidayBatch}
              className="px-1.5 py-1 text-[10px] font-medium bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors"
            >
              일,휴
            </button>
          </>
        )}
      </div>

      {/* 요일별 시간 입력 - 체크박스 제거 (24시간 미선택 시만 표시) */}
      {!value.is24hours && (
        <div className="grid grid-cols-3 gap-y-2 gap-x-2">
          {DAYS.map(({ key, fullLabel }) => {
            const getLabelColor = () => {
              if (key === 'saturday') return 'text-blue-800';
              if (key === 'sunday' || key === 'holiday') return 'text-red-800';
              return 'text-gray-400';
            };

            return (
              <div key={key} className="space-y-1">
                <div className={`text-[10px] sm:text-xs ${getLabelColor()} font-medium px-1`}>{fullLabel}</div>
                <input
                  type="text"
                  value={getDayTime(key)}
                  onChange={(e) => handleTimeChange(key, formatTimeInput(e.target.value))}
                  placeholder="미운영"
                  className="w-full px-1.5 py-1 text-center text-[11px] bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500/20"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* 일요일 사용 가능 주 선택 - 일요일 운영시간이 설정되었을 때만 활성화 */}
      {!value.is24hours && value.sunday?.timeRange && (
        <div>
          <div className="text-[10px] sm:text-xs text-gray-400 mb-2">일요일 사용 가능 주</div>
          <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
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
              <label htmlFor="sunday-every-week" className="text-xs sm:text-sm text-white cursor-pointer font-medium">매주</label>
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
                <label htmlFor={`sunday-${week}`} className="text-xs sm:text-sm text-white cursor-pointer font-medium">{idx + 1}주</label>
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