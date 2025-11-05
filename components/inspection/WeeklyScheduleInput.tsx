'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { formatTimeRange, validateTimeRange, parseTimeRange } from '@/lib/utils/time-format';

export interface DaySchedule {
  start: string; // "0000" 형식
  end: string; // "2400" 형식
}

export interface WeeklySchedule {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

interface WeeklyScheduleInputProps {
  value: WeeklySchedule;
  onChange: (schedule: WeeklySchedule) => void;
}

const DAYS = [
  { key: 'monday' as keyof WeeklySchedule, label: '월요일' },
  { key: 'tuesday' as keyof WeeklySchedule, label: '화요일' },
  { key: 'wednesday' as keyof WeeklySchedule, label: '수요일' },
  { key: 'thursday' as keyof WeeklySchedule, label: '목요일' },
  { key: 'friday' as keyof WeeklySchedule, label: '금요일' },
  { key: 'saturday' as keyof WeeklySchedule, label: '토요일' },
  { key: 'sunday' as keyof WeeklySchedule, label: '일요일' },
];

export function WeeklyScheduleInput({ value, onChange }: WeeklyScheduleInputProps) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isDayEnabled = (day: keyof WeeklySchedule) => {
    return !!value[day];
  };

  const toggleDay = (day: keyof WeeklySchedule) => {
    const newSchedule = { ...value };

    if (newSchedule[day]) {
      delete newSchedule[day];
      // 입력값과 에러도 제거
      const newInputValues = { ...inputValues };
      delete newInputValues[day];
      setInputValues(newInputValues);

      const newErrors = { ...errors };
      delete newErrors[day];
      setErrors(newErrors);
    } else {
      // 기본값 설정 (09:00~18:00)
      newSchedule[day] = { start: '0900', end: '1800' };
      setInputValues({
        ...inputValues,
        [day]: '09001800'
      });
    }

    onChange(newSchedule);
  };

  const handleTimeInputChange = (day: keyof WeeklySchedule, input: string) => {
    // 숫자만 추출
    const digits = input.replace(/\D/g, '');

    // 8자리로 제한
    const limited = digits.substring(0, 8);

    // 입력값 업데이트
    setInputValues({
      ...inputValues,
      [day]: limited
    });

    // 8자리 입력이 완료되면 검증 및 적용
    if (limited.length === 8) {
      const parsed = parseTimeRange(limited);

      if (!parsed) {
        setErrors({
          ...errors,
          [day]: '올바른 시간 형식이 아닙니다 (0000-2400)'
        });
        return;
      }

      if (!validateTimeRange(parsed.start, parsed.end)) {
        setErrors({
          ...errors,
          [day]: '시작 시간이 종료 시간보다 빠를야 합니다'
        });
        return;
      }

      // 유효한 입력 - 에러 제거 및 schedule 업데이트
      const newErrors = { ...errors };
      delete newErrors[day];
      setErrors(newErrors);

      onChange({
        ...value,
        [day]: { start: parsed.start, end: parsed.end }
      });
    } else {
      // 입력 중 - 에러 제거
      const newErrors = { ...errors };
      delete newErrors[day];
      setErrors(newErrors);
    }
  };

  return (
    <div className="space-y-3 mt-2">
      <div className="text-sm text-gray-600">
        사용 가능한 요일과 시간을 선택하세요. 시간은 8자리 숫자로 입력합니다 (예: 09001800 → 09:00~18:00)
      </div>

      <div className="space-y-2">
        {DAYS.map(({ key, label }) => {
          const enabled = isDayEnabled(key);
          const schedule = value[key];
          const inputValue = inputValues[key] || (schedule ? `${schedule.start}${schedule.end}` : '');
          const error = errors[key];

          return (
            <div key={key} className="flex items-start gap-3 p-3 border rounded-lg">
              <Checkbox
                id={`day-${key}`}
                checked={enabled}
                onCheckedChange={() => toggleDay(key)}
                className="mt-1"
              />

              <div className="flex-1 space-y-1">
                <Label htmlFor={`day-${key}`} className="font-medium">
                  {label}
                </Label>

                {enabled && (
                  <div className="space-y-1">
                    <Input
                      type="text"
                      value={inputValue}
                      onChange={(e) => handleTimeInputChange(key, e.target.value)}
                      placeholder="00002400 (8자리)"
                      className={`font-mono ${error ? 'border-red-500' : ''}`}
                      maxLength={8}
                    />

                    {error ? (
                      <p className="text-sm text-red-600">{error}</p>
                    ) : (
                      inputValue.length === 8 && schedule && (
                        <p className="text-sm text-gray-600">
                          {formatTimeRange(inputValue)}
                        </p>
                      )
                    )}

                    {inputValue.length > 0 && inputValue.length < 8 && (
                      <p className="text-sm text-gray-500">
                        {inputValue.length}/8 자리 입력됨
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-sm text-gray-500">
        최소 1개 요일을 선택해야 합니다.
      </div>
    </div>
  );
}
