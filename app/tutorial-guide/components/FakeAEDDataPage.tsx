'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TUTORIAL_SAMPLE_DEVICES } from '@/lib/data/tutorial-sample-data';
import { cn } from '@/lib/utils';
import { ChevronsUpDown, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

interface FakeAEDDataPageProps {
  onNavigateToInspection: () => void;
  scheduledSerials: Set<string>;
  onScheduleDevice: (serial: string) => void;
  tutorialStep: number;
  onTutorialAction: () => void;
}

type ViewMode = 'toAdd' | 'scheduled';

export function FakeAEDDataPage({
  onNavigateToInspection,
  scheduledSerials,
  onScheduleDevice,
  tutorialStep,
  onTutorialAction,
}: FakeAEDDataPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('toAdd');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatteryDropdownOpen, setIsBatteryDropdownOpen] = useState(false);
  const [selectedBatteryFilter, setSelectedBatteryFilter] = useState('배터리 전체');
  const [filters, setFilters] = useState({
    gugun: [] as string[],
    category_1: [] as string[],
    category_2: [] as string[],
    category_3: [] as string[],
    battery_expiry: 'all' as string,
    patch_expiry: 'all' as string,
    inspection_date: 'all' as string,
    external_display: 'all' as string,
  });

  // 필터링된 장비 목록
  const filteredDevices = useMemo(() => {
    return TUTORIAL_SAMPLE_DEVICES.filter((device) => {
      // 이미 스케줄된 장비는 'toAdd' 탭에서 제외
      if (viewMode === 'toAdd' && scheduledSerials.has(device.equipment_serial)) {
        return false;
      }

      if (filters.gugun.length > 0 && !filters.gugun.includes(device.gugun)) return false;
      if (filters.category_1.length > 0 && !filters.category_1.includes(device.category_1)) return false;
      if (filters.category_2.length > 0 && !filters.category_2.includes(device.category_2)) return false;
      if (filters.category_3.length > 0 && !filters.category_3.includes(device.category_3)) return false;

      // 배터리, 패드, 점검일, 외부표출은 'all'이 아닐 때만 필터링
      // 실제로는 복잡한 날짜 계산이 필요하지만 튜토리얼이므로 단순화

      return true;
    });
  }, [filters, viewMode, scheduledSerials]);

  // 스케줄된 장비 목록
  const scheduledDevices = useMemo(() => {
    return TUTORIAL_SAMPLE_DEVICES.filter((d) => scheduledSerials.has(d.equipment_serial));
  }, [scheduledSerials]);

  // 분류 필터 변경 (다중 선택)
  const handleCategoryFilterChange = (key: 'gugun' | 'category_1' | 'category_2' | 'category_3', value: string[]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // 단일 선택 필터 변경
  const handleSingleFilterChange = (key: 'battery_expiry' | 'patch_expiry' | 'inspection_date' | 'external_display', value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // 배터리 필터 옵션 선택
  const handleBatteryOptionSelect = (option: string) => {
    setSelectedBatteryFilter(option);
    setIsBatteryDropdownOpen(false);

    // Step 2.1에서 "30일 이내 만료" 선택 시 Step 2.2로 진행
    if (tutorialStep === 2.1 && option === '30일 이내 만료') {
      onTutorialAction();
    }
  };

  // 조회 버튼 클릭
  const handleSearchClick = () => {
    // Step 2.2에서 조회 버튼 클릭 시 Step 3으로 진행
    if (tutorialStep === 2.2) {
      onTutorialAction();
    }
  };

  const handleBulkAdd = () => {
    selectedIds.forEach((id) => {
      const device = filteredDevices.find((d) => d.id === id);
      if (device) {
        onScheduleDevice(device.equipment_serial);
      }
    });
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const dataCount = viewMode === 'toAdd' ? filteredDevices.length : scheduledDevices.length;

  return (
    <div className="flex h-full flex-col overflow-x-auto bg-gray-950 pb-16 md:pb-0">
      {/* 탭 네비게이션 */}
      <div className="flex items-center justify-between -mb-px flex-wrap sm:flex-nowrap gap-2 sm:gap-0 px-4 border-b border-gray-800">
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('toAdd')}
            className={cn(
              'px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors',
              viewMode === 'toAdd'
                ? 'border-emerald-600 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
            )}
          >
            <div className="flex items-center gap-1 sm:gap-2">
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline">추가할 목록</span>
              <span className="sm:hidden">추가할</span>
            </div>
          </button>
          <button
            data-tutorial="tab-scheduled"
            onClick={() => {
              setViewMode('scheduled');
              if (tutorialStep === 5) {
                onTutorialAction();
              }
            }}
            className={cn(
              'px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors',
              viewMode === 'scheduled'
                ? 'border-emerald-600 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
            )}
          >
            <div className="flex items-center gap-1 sm:gap-2">
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden sm:inline">추가된 목록</span>
              <span className="sm:hidden">추가됨</span>
            </div>
          </button>
        </div>
        <div className="text-xs text-gray-500 px-2 sm:px-4">{dataCount}개</div>
      </div>

      {/* 필터바 (추가할 목록 탭에서만 표시) */}
      {viewMode === 'toAdd' && (
        <div className="bg-gray-900 border-b border-gray-800 p-4 md:p-6">
          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 md:p-4 mb-4">
            <h3 className="text-blue-300 font-semibold text-sm md:text-base mb-1">
              일정관리 - 추가할 장비 선택
            </h3>
            <p className="text-blue-200 text-xs md:text-sm">
              필터를 사용하여 장비를 검색하고, 체크박스로 선택한 후 "일정 예약" 버튼을 클릭하세요.
            </p>
          </div>

          {/* 가짜 드롭다운 필터 (모양만 드롭다운, 클릭 불가) */}
          <div className="flex flex-wrap gap-2">
            {/* 구군 */}
            <button
              data-tutorial="filter-gugun"
              onClick={() => tutorialStep === 2 && onTutorialAction()}
              className="inline-flex items-center justify-between h-8 min-w-[100px] px-2 py-0 text-xs font-normal border border-gray-700 rounded-md bg-gray-800 text-gray-300 cursor-default hover:bg-gray-750"
            >
              <span>구군</span>
              <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
            </button>

            {/* 분류1 */}
            <button className="inline-flex items-center justify-between h-8 min-w-[100px] px-2 py-0 text-xs font-normal border border-gray-700 rounded-md bg-gray-800 text-gray-300 cursor-default hover:bg-gray-750">
              <span>분류1</span>
              <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
            </button>

            {/* 분류2 */}
            <button className="inline-flex items-center justify-between h-8 min-w-[100px] px-2 py-0 text-xs font-normal border border-gray-700 rounded-md bg-gray-800 text-gray-300 cursor-default hover:bg-gray-750">
              <span>분류2</span>
              <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
            </button>

            {/* 분류3 */}
            <button className="inline-flex items-center justify-between h-8 min-w-[100px] px-2 py-0 text-xs font-normal border border-gray-700 rounded-md bg-gray-800 text-gray-300 cursor-default hover:bg-gray-750">
              <span>분류3</span>
              <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
            </button>

            {/* 배터리 - 드롭다운 */}
            <div className="relative">
              <button
                data-tutorial="filter-battery"
                onClick={() => {
                  setIsBatteryDropdownOpen(!isBatteryDropdownOpen);
                  if (tutorialStep === 2) {
                    onTutorialAction();
                  }
                }}
                className="inline-flex items-center justify-between h-8 min-w-[130px] px-2 py-0 text-xs font-normal border border-gray-700 rounded-md bg-gray-800 text-gray-300 hover:bg-gray-750 transition-colors"
              >
                <span>{selectedBatteryFilter}</span>
                <svg className="ml-1 h-3 w-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 드롭다운 메뉴 */}
              {isBatteryDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={() => handleBatteryOptionSelect('배터리 전체')}
                    className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    배터리 전체
                  </button>
                  <button
                    onClick={() => handleBatteryOptionSelect('배터리 만료')}
                    className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    배터리 만료
                  </button>
                  <button
                    data-tutorial="battery-option-30"
                    onClick={() => handleBatteryOptionSelect('30일 이내 만료')}
                    className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    30일 이내 만료
                  </button>
                  <button
                    onClick={() => handleBatteryOptionSelect('60일 이내 만료')}
                    className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    60일 이내 만료
                  </button>
                  <button
                    onClick={() => handleBatteryOptionSelect('90일 이내 만료')}
                    className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    90일 이내 만료
                  </button>
                  <button
                    onClick={() => handleBatteryOptionSelect('180일 이내 만료')}
                    className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    180일 이내 만료
                  </button>
                  <button
                    onClick={() => handleBatteryOptionSelect('365일 이내 만료')}
                    className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    365일 이내 만료
                  </button>
                </div>
              )}
            </div>

            {/* 패드 */}
            <button className="inline-flex items-center justify-between h-8 min-w-[120px] px-2 py-0 text-xs font-normal border border-gray-700 rounded-md bg-gray-800 text-gray-300 cursor-default hover:bg-gray-750">
              <span>패드 전체</span>
              <svg className="ml-1 h-3 w-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* 점검일 */}
            <button className="inline-flex items-center justify-between h-8 min-w-[120px] px-2 py-0 text-xs font-normal border border-gray-700 rounded-md bg-gray-800 text-gray-300 cursor-default hover:bg-gray-750">
              <span>점검 전체</span>
              <svg className="ml-1 h-3 w-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* 외부표출 */}
            <button className="inline-flex items-center justify-between h-8 min-w-[100px] px-2 py-0 text-xs font-normal border border-gray-700 rounded-md bg-gray-800 text-gray-300 cursor-default hover:bg-gray-750">
              <span>전체</span>
              <svg className="ml-1 h-3 w-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* 조회 버튼 */}
            <button
              data-tutorial="search-button"
              onClick={handleSearchClick}
              className="inline-flex items-center justify-center h-8 px-4 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              조회
            </button>
          </div>
        </div>
      )}

      {/* 콘텐츠 영역 */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2">
        {viewMode === 'toAdd' ? (
          <>
            {filteredDevices.map((device, index) => (
              <div
                key={device.id}
                className="bg-gray-800 rounded-lg p-3 md:p-4 flex items-center justify-between hover:bg-gray-800/80 transition-colors border border-gray-700"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Checkbox
                    data-tutorial={index === 0 ? 'device-checkbox-0' : undefined}
                    checked={selectedIds.has(device.id)}
                    onCheckedChange={() => {
                      toggleSelect(device.id);
                      if (index === 0 && tutorialStep === 3) {
                        onTutorialAction();
                      }
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium text-gray-100">{device.installation_institution}</p>
                    <p className="text-xs text-gray-400">{device.equipment_serial}</p>
                    <p className="text-xs text-gray-500 mt-1">{device.installation_address}</p>
                  </div>
                </div>
                <Button
                  data-tutorial={index === 0 ? 'device-add-0' : undefined}
                  onClick={() => {
                    onScheduleDevice(device.equipment_serial);
                    if (index === 0 && tutorialStep === 4) {
                      onTutorialAction();
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm ml-2 flex-shrink-0 px-2 md:px-3 py-1 md:py-2"
                >
                  추가
                </Button>
              </div>
            ))}

            {selectedIds.size > 0 && (
              <Button onClick={handleBulkAdd} className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4 py-3 md:py-4">
                일정 예약 ({selectedIds.size}개)
              </Button>
            )}
          </>
        ) : (
          <>
            {scheduledDevices.length > 0 ? (
              <>
                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 md:p-4 mb-4">
                  <h3 className="text-blue-300 font-semibold text-sm md:text-base mb-1">추가된 장비 목록</h3>
                  <p className="text-blue-200 text-xs md:text-sm">
                    이제 "현장점검" 메뉴로 이동하여 점검을 시작할 수 있습니다.
                  </p>
                </div>
                {scheduledDevices.map((device) => (
                  <div
                    key={device.id}
                    className="bg-gray-800 rounded-lg p-3 md:p-4 flex items-center justify-between hover:bg-gray-800/80 transition-colors border border-gray-700"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs md:text-sm font-medium text-gray-100">{device.installation_institution}</p>
                      <p className="text-xs text-gray-400">{device.equipment_serial}</p>
                      <p className="text-xs text-gray-500 mt-1">{device.installation_address}</p>
                    </div>
                  </div>
                ))}
                <Button
                  onClick={onNavigateToInspection}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-4 py-3 md:py-4"
                >
                  현장점검 메뉴로 이동
                </Button>
              </>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[200px] text-gray-400">
                <p className="text-sm">추가된 장비가 없습니다. "추가할 목록" 탭에서 장비를 추가하세요.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
