'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { TUTORIAL_SAMPLE_DEVICES } from '@/lib/data/tutorial-sample-data';
import { cn } from '@/lib/utils';

interface FakeInspectionPageProps {
  scheduledSerials: Set<string>;
  onNavigateToAEDData: () => void;
  tutorialStep: number;
  onTutorialAction: () => void;
}

type ViewMode = 'list' | 'map' | 'completed';

export function FakeInspectionPage({ scheduledSerials, onNavigateToAEDData, tutorialStep, onTutorialAction }: FakeInspectionPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [inspectingSerials, setInspectingSerials] = useState<Set<string>>(new Set());
  const [completedSerials, setCompletedSerials] = useState<Set<string>>(new Set());
  const [showMapModal, setShowMapModal] = useState(false);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [currentInspectingSerial, setCurrentInspectingSerial] = useState<string | null>(null);

  // 목록 탭: 아직 점검하지 않은 장비
  const listDevices = useMemo(() => {
    const devices = TUTORIAL_SAMPLE_DEVICES.filter(
      (d) => scheduledSerials.has(d.equipment_serial) && !inspectingSerials.has(d.equipment_serial) && !completedSerials.has(d.equipment_serial)
    );
    console.log('[FakeInspectionPage] listDevices:', {
      scheduledSerialsSize: scheduledSerials.size,
      scheduledSerials: Array.from(scheduledSerials),
      devicesCount: devices.length,
      tutorialStep
    });
    return devices;
  }, [scheduledSerials, inspectingSerials, completedSerials, tutorialStep]);

  // 점검완료 탭: 점검중 + 점검완료
  const completedDevices = useMemo(() => {
    return TUTORIAL_SAMPLE_DEVICES.filter(
      (d) => scheduledSerials.has(d.equipment_serial) && (inspectingSerials.has(d.equipment_serial) || completedSerials.has(d.equipment_serial))
    );
  }, [scheduledSerials, inspectingSerials, completedSerials]);

  const handleStartInspection = (serial: string) => {
    setCurrentInspectingSerial(serial);
    setShowInspectionModal(true);
  };

  const handleCloseInspectionModal = () => {
    if (currentInspectingSerial) {
      setInspectingSerials((prev) => new Set([...prev, currentInspectingSerial]));
      // 튜토리얼 Step 7.5에서는 viewMode를 'list'로 유지
      if (tutorialStep !== 7.5) {
        setViewMode('completed');
      }
    }
    setShowInspectionModal(false);
    setCurrentInspectingSerial(null);
  };

  const handleCompleteInspection = (serial: string) => {
    setInspectingSerials((prev) => {
      const next = new Set(prev);
      next.delete(serial);
      return next;
    });
    setCompletedSerials((prev) => new Set([...prev, serial]));
  };

  const dataCount = viewMode === 'list' ? listDevices.length : completedDevices.length;

  return (
    <div className="flex h-full flex-col overflow-x-auto bg-gray-950 pb-16 md:pb-0">
      {/* 탭 네비게이션 */}
      <div className="flex items-center justify-between -mb-px flex-wrap sm:flex-nowrap gap-2 sm:gap-0 px-4 border-b border-gray-800">
        <div className="flex gap-1">
          <button
            data-tutorial="tab-list"
            onClick={() => setViewMode('list')}
            className={cn(
              'px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors',
              viewMode === 'list'
                ? 'border-emerald-600 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
            )}
          >
            <div className="flex items-center gap-1 sm:gap-2">
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline">점검대상목록</span>
              <span className="sm:hidden">대상목록</span>
            </div>
          </button>

          {/* 지도 탭 */}
          <button
            onClick={() => setShowMapModal(true)}
            className={cn(
              'px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors',
              viewMode === 'map'
                ? 'border-emerald-600 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
            )}
          >
            <div className="flex items-center gap-1 sm:gap-2">
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span className="hidden sm:inline">지도</span>
              <span className="sm:hidden">지도</span>
            </div>
          </button>

          <button
            data-tutorial="tab-completed"
            onClick={() => {
              setViewMode('completed');
              if (tutorialStep === 8) {
                onTutorialAction();
              }
            }}
            className={cn(
              'px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors',
              viewMode === 'completed'
                ? 'border-emerald-600 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
            )}
          >
            <div className="flex items-center gap-1 sm:gap-2">
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden sm:inline">점검진행목록</span>
              <span className="sm:hidden">진행목록</span>
            </div>
          </button>
        </div>
        <div className="text-xs text-gray-500 px-2 sm:px-4">{dataCount}개</div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2">
        {viewMode === 'list' ? (
          <>
            {listDevices.length > 0 ? (
              <>
                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 md:p-4 mb-4">
                  <h3 className="text-blue-300 font-semibold text-sm md:text-base mb-1">현장점검 - 점검 시작</h3>
                  <p className="text-blue-200 text-xs md:text-sm">
                    아래 목록에서 "점검" 버튼을 클릭하여 현장 점검을 시작하세요.
                  </p>
                </div>
                {listDevices.map((device, index) => (
                  <div
                    key={device.id}
                    className="bg-gray-800 rounded-lg p-3 md:p-4 flex items-center justify-between hover:bg-gray-800/80 transition-colors border border-gray-700"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs md:text-sm font-medium text-gray-100">{device.installation_institution}</p>
                      <p className="text-xs text-gray-400">{device.equipment_serial}</p>
                      <p className="text-xs text-gray-500 mt-1">{device.installation_address}</p>
                    </div>
                    <Button
                      data-tutorial={index === 0 ? 'inspection-button-0' : undefined}
                      onClick={() => {
                        handleStartInspection(device.equipment_serial);
                        if (index === 0 && tutorialStep === 7) {
                          onTutorialAction();
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm ml-2 flex-shrink-0 px-2 md:px-3 py-1 md:py-2"
                    >
                      점검
                    </Button>
                  </div>
                ))}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-gray-400">
                <p className="text-sm mb-2">점검할 장비가 없습니다.</p>
                <p className="text-xs text-gray-500 mb-4">관할 보건소 담당자가 일정관리 메뉴에서 일정을 추가해야 합니다.</p>
                <Button
                  onClick={onNavigateToAEDData}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  일정관리로 이동
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            {completedDevices.length > 0 ? (
              <>
                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 md:p-4 mb-4">
                  <h3 className="text-blue-300 font-semibold text-sm md:text-base mb-1">점검 진행 상황</h3>
                  <p className="text-blue-200 text-xs md:text-sm">
                    점검중인 장비와 점검이 완료된 장비 목록입니다.
                  </p>
                </div>
                {completedDevices.map((device, index) => {
                  const isInspecting = inspectingSerials.has(device.equipment_serial);
                  const isCompleted = completedSerials.has(device.equipment_serial);

                  return (
                    <div
                      key={device.id}
                      className="bg-gray-800 rounded-lg p-3 md:p-4 flex items-center justify-between hover:bg-gray-800/80 transition-colors border border-gray-700"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs md:text-sm font-medium text-gray-100">{device.installation_institution}</p>
                          {isInspecting && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-900/30 text-yellow-300 border border-yellow-700">
                              점검중
                            </span>
                          )}
                          {isCompleted && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/30 text-green-300 border border-green-700">
                              점검완료
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">{device.equipment_serial}</p>
                        <p className="text-xs text-gray-500 mt-1">{device.installation_address}</p>
                      </div>
                      {isInspecting && (
                        <Button
                          data-tutorial={index === 0 ? 'complete-button-0' : undefined}
                          onClick={() => {
                            handleCompleteInspection(device.equipment_serial);
                            if (index === 0 && tutorialStep === 9) {
                              onTutorialAction();
                            }
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm ml-2 flex-shrink-0 px-2 md:px-3 py-1 md:py-2"
                        >
                          점검 완료 처리
                        </Button>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[200px] text-gray-400">
                <p className="text-sm">진행중이거나 완료된 점검이 없습니다.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 지도 모달 */}
      {showMapModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-3">지도 보기</h3>
            <p className="text-gray-300 text-sm mb-6">
              지도 화면에서 해당 목록을 볼 수 있습니다.
            </p>
            <Button
              onClick={() => setShowMapModal(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              확인
            </Button>
          </div>
        </div>
      )}

      {/* 점검 화면 모달 */}
      {showInspectionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-[103] p-4 pt-4 md:pt-8 overflow-y-auto">
          <div className="bg-gray-900 border-2 border-emerald-600 rounded-lg p-4 md:p-6 max-w-2xl w-full mt-2 mb-20">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h3 className="text-lg md:text-2xl font-bold text-white">현장 점검 화면</h3>
              <div className="px-2 md:px-3 py-1 bg-emerald-900/30 border border-emerald-700 rounded">
                <span className="text-xs md:text-sm text-emerald-300 font-medium">점검중</span>
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 md:p-5 mb-4 md:mb-6">
              <h4 className="text-base md:text-lg font-semibold text-gray-200 mb-2 md:mb-4">점검 대상 장비</h4>
              {currentInspectingSerial && (
                <div className="space-y-2 text-xs md:text-sm">
                  <p className="text-gray-300">
                    <span className="text-gray-500">시리얼 번호:</span> <span className="font-mono text-emerald-400">{currentInspectingSerial}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 md:p-4 mb-4 md:mb-6">
              <p className="text-gray-300 text-xs md:text-sm leading-relaxed">
                실제 점검 화면에서는 AED 장비의 각 항목을 체크하고 사진을 첨부할 수 있습니다.
              </p>
            </div>

            <Button
              data-tutorial="inspection-modal-confirm"
              onClick={() => {
                if (tutorialStep === 7.5) {
                  // 먼저 튜토리얼 단계를 진행한 다음 모달을 닫음
                  onTutorialAction();
                  setTimeout(() => {
                    handleCloseInspectionModal();
                  }, 100);
                } else {
                  handleCloseInspectionModal();
                }
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 md:py-3 text-sm md:text-base"
            >
              확인
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
