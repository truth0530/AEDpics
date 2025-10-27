'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FakeAEDDataPage } from './FakeAEDDataPage';
import { FakeInspectionPage } from './FakeInspectionPage';
import { TutorialSpotlight } from './TutorialSpotlight';
import { TutorialBottomNav } from './TutorialBottomNav';

type PageView = 'aed-data' | 'inspection';

// 튜토리얼 단계 정의
const TUTORIAL_STEPS: Record<number, {
  selector: string;
  selectorMobile?: string; // 모바일 전용 셀렉터
  title: string;
  message: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  positionMobile?: 'top' | 'bottom' | 'left' | 'right' | 'center'; // 모바일 전용 위치
  page: 'aed-data' | 'inspection';
  autoNext?: boolean;
  hideNext?: boolean;
}> = {
  // 일정관리 페이지 (Step 1-6)
  1: {
    selector: '[data-tutorial="sidebar-aed-data"]',
    selectorMobile: '[data-tutorial="bottom-nav-aed-data"]',
    title: 'Step 1: 일정관리 메뉴',
    message: '먼저 일정관리 메뉴를 클릭하세요. 여기에서 점검할 장비를 추가할 수 있습니다.',
    position: 'right' as const,
    page: 'aed-data' as const,
    hideNext: true,
  },
  2: {
    selector: '[data-tutorial="filter-battery"]',
    title: 'Step 2: 검색 조건',
    message: '배터리 만료된 장비만 필터할 수 있습니다. 그 외 다양한 필터 조건 활용이 가능합니다.',
    position: 'bottom' as const,
    page: 'aed-data' as const,
    hideNext: true,
  },
  2.1: {
    selector: '[data-tutorial="battery-option-30"]',
    title: 'Step 2: 검색 조건',
    message: '"30일 이내 만료"를 선택하세요.',
    position: 'bottom' as const,
    page: 'aed-data' as const,
    hideNext: true,
  },
  2.2: {
    selector: '[data-tutorial="search-button"]',
    title: 'Step 2: 검색 조건',
    message: '"조회" 버튼을 클릭하여 필터를 적용하세요.',
    position: 'bottom' as const,
    page: 'aed-data' as const,
    hideNext: true,
  },
  3: {
    selector: '[data-tutorial="device-checkbox-0"]',
    title: 'Step 3: 여러 장비 선택',
    message: '점검할 장비를 여러개 추가하려면 체크박스를 클릭하세요.',
    position: 'bottom' as const,
    page: 'aed-data' as const,
    hideNext: true,
  },
  4: {
    selector: '[data-tutorial="device-add-0"]',
    title: 'Step 4: 개별 일정 추가',
    message: '"추가" 버튼을 클릭하면 해당 장비를 바로 점검 일정에 추가할 수 있습니다.',
    position: 'left' as const,
    positionMobile: 'top' as const,
    page: 'aed-data' as const,
    hideNext: true,
  },
  5: {
    selector: '[data-tutorial="tab-scheduled"]',
    title: 'Step 5: 추가된 목록 확인',
    message: '"추가된 목록" 탭을 클릭하여 일정에 추가된 장비를 확인하거나 취소할 수 있습니다.',
    position: 'bottom' as const,
    page: 'aed-data' as const,
    hideNext: true,
  },
  6: {
    selector: '[data-tutorial="sidebar-inspection"]',
    selectorMobile: '[data-tutorial="bottom-nav-inspection"]',
    title: 'Step 6: 현장점검으로 이동',
    message: '이제 현장점검 메뉴를 클릭하여 추가한 장비를 점검해봅시다.',
    position: 'right' as const,
    page: 'aed-data' as const,
    hideNext: true,
  },
  // 현장점검 페이지 (Step 7-11)
  7: {
    selector: '[data-tutorial="inspection-button-0"]',
    title: 'Step 7: 점검 시작',
    message: '일정에 추가된 장비가 표시됩니다. "점검" 버튼을 클릭하여 현장 점검을 시작하세요.',
    position: 'left' as const,
    positionMobile: 'bottom' as const,
    page: 'inspection' as const,
    hideNext: true,
  },
  7.5: {
    selector: '[data-tutorial="inspection-modal-confirm"]',
    title: 'Step 8: 점검 화면',
    message: '실제 점검 화면입니다. 실제로는 AED 장비의 각 항목을 체크하고 사진을 첨부할 수 있습니다. "확인" 버튼을 눌러 계속 진행하세요.',
    position: 'bottom' as const,
    positionMobile: 'bottom' as const,
    page: 'inspection' as const,
    hideNext: true,
  },
  8: {
    selector: '[data-tutorial="tab-completed"]',
    title: 'Step 9: 점검 진행 상황',
    message: '점검이 시작되었습니다. "점검진행목록" 탭을 클릭하여 점검 진행 상황을 확인하세요.',
    position: 'bottom' as const,
    page: 'inspection' as const,
    hideNext: true,
  },
  9: {
    selector: '[data-tutorial="complete-button-0"]',
    title: 'Step 10: 점검 완료',
    message: '"점검 완료 처리" 버튼을 클릭하여 점검을 완료하세요.',
    position: 'left' as const,
    positionMobile: 'bottom' as const,
    page: 'inspection' as const,
    hideNext: true,
  },
  10: {
    selector: 'body',
    title: 'Step 10/10',
    message: 'AED 픽스 튜토리얼을 완료했습니다. 이제 실제 시스템을 사용해보세요!',
    position: 'center' as const,
    page: 'inspection' as const,
  },
};

export function TutorialPageClient() {
  const router = useRouter();
  const [pageView, setPageView] = useState<PageView>('aed-data');
  const [scheduledSerials, setScheduledSerials] = useState<Set<string>>(new Set());
  const [tutorialStep, setTutorialStep] = useState(0); // 0 = 시작 화면
  const [isTutorialActive, setIsTutorialActive] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // 화면 크기 감지 (768px = Tailwind md 브레이크포인트)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleScheduleDevice = (serial: string) => {
    setScheduledSerials((prev) => new Set([...prev, serial]));
  };

  const handleNavigateToInspection = () => {
    setPageView('inspection');
    if (tutorialStep === 6) {
      setTimeout(() => setTutorialStep(7), 300);
    }
  };

  const handleNavigateToAEDData = () => {
    setPageView('aed-data');
  };

  const handleTutorialNext = () => {
    const currentStepConfig = TUTORIAL_STEPS[tutorialStep];

    if (tutorialStep === 10) {
      // Step 10에서는 메인으로 이동
      router.push('/');
      return;
    }

    // Step 6에서 다음 버튼 클릭 시 현장점검 페이지로 자동 이동 후 Step 7로
    if (tutorialStep === 6) {
      // 만약 scheduledSerials가 비어있으면 샘플 장비를 추가 (실제 샘플 데이터의 시리얼 번호 사용)
      if (scheduledSerials.size === 0) {
        setScheduledSerials(new Set(['AED2024001']));
      }
      setPageView('inspection');
      setTimeout(() => setTutorialStep(7), 300);
      return;
    }

    // Step 2에서 다음 버튼 클릭 시 Step 2.1로 이동
    if (tutorialStep === 2) {
      setTutorialStep(2.1);
      return;
    }

    // Step 2.1에서 다음 버튼 클릭 시 Step 2.2로 이동
    if (tutorialStep === 2.1) {
      setTutorialStep(2.2);
      return;
    }

    // Step 2.2에서 다음 버튼 클릭 시 Step 3으로 이동
    if (tutorialStep === 2.2) {
      setTutorialStep(3);
      return;
    }

    // Step 7에서 다음 버튼 클릭 시 Step 7.5로 이동
    if (tutorialStep === 7) {
      setTutorialStep(7.5);
      return;
    }

    // Step 7.5에서 다음 버튼 클릭 시 Step 8로 이동
    if (tutorialStep === 7.5) {
      setTutorialStep(8);
      return;
    }

    // 자동 진행 단계인 경우
    if (currentStepConfig?.autoNext) {
      setTimeout(() => setTutorialStep((prev) => prev + 1), 1000);
    } else {
      setTutorialStep((prev) => prev + 1);
    }
  };

  const handleTutorialSkip = () => {
    if (confirm('튜토리얼을 종료하고 메인 화면으로 이동하시겠습니까?')) {
      router.push('/');
    }
  };

  // 하단 네비게이션 클릭 핸들러
  const handleBottomNavNavigate = (page: 'aed-data' | 'inspection') => {
    setPageView(page);

    // 튜토리얼 단계에 따라 자동 진행
    if (page === 'aed-data' && tutorialStep === 1) {
      setTimeout(() => setTutorialStep(2), 300);
    } else if (page === 'inspection' && tutorialStep === 6) {
      setTimeout(() => setTutorialStep(7), 300);
    }
  };

  // 전역 이벤트 리스너로 사이드바 클릭 감지
  if (typeof window !== 'undefined') {
    (window as any).tutorialNavigate = handleBottomNavNavigate;
  }

  const currentStepConfig = TUTORIAL_STEPS[tutorialStep];

  // 화면 크기에 따라 적절한 셀렉터 선택
  const getActiveSelector = () => {
    if (!currentStepConfig) return '';

    // 모바일이고 모바일 전용 셀렉터가 있으면 모바일 셀렉터 사용
    if (isMobile && currentStepConfig.selectorMobile) {
      return currentStepConfig.selectorMobile;
    }

    // 그 외에는 기본 셀렉터 사용
    return currentStepConfig.selector;
  };

  // 화면 크기에 따라 적절한 위치 선택
  const getActivePosition = () => {
    if (!currentStepConfig) return 'center' as const;

    // 모바일이고 모바일 전용 위치가 있으면 모바일 위치 사용
    if (isMobile && currentStepConfig.positionMobile) {
      return currentStepConfig.positionMobile;
    }

    // 그 외에는 기본 위치 사용
    return currentStepConfig.position;
  };

  const activeSelector = getActiveSelector();
  const activePosition = getActivePosition();

  // 디버깅
  if (typeof window !== 'undefined') {
    console.log('[Tutorial Debug]', {
      tutorialStep,
      pageView,
      isMobile,
      currentStepConfig,
      activeSelector,
      isTutorialActive,
      shouldShowSpotlight: isTutorialActive && currentStepConfig && currentStepConfig.page === pageView
    });
  }

  // 시작 화면
  if (tutorialStep === 0) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center z-50">
        <div className="max-w-2xl mx-auto px-4 py-8 md:px-6 md:py-12 text-center">
          <div className="mb-6 md:mb-8">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-600 rounded-full mx-auto mb-4 md:mb-6 flex items-center justify-center">
              <svg className="w-8 h-8 md:w-10 md:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-xl md:text-4xl font-bold text-white mb-6 md:mb-8">
              AED 픽스 튜토리얼
            </h1>
          </div>

          <div className="space-y-3 md:space-y-4 mb-6 md:mb-8">
            {/* 1-5단계 섹션 */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 md:p-4 flex flex-row items-center justify-between gap-3 md:gap-4">
              <div className="flex-1 text-left">
                <p className="text-emerald-400 font-bold text-sm md:text-base mb-1">1-5단계: 일정관리</p>
                <p className="text-gray-300 text-xs md:text-sm">점검할 AED 장비 추가하기</p>
              </div>
              <button
                onClick={() => setTutorialStep(1)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 md:py-3 px-3 md:px-6 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-emerald-500/50 whitespace-nowrap text-xs md:text-base"
              >
                1단계부터 시작
              </button>
            </div>

            {/* 6-10단계 섹션 */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 md:p-4 flex flex-row items-center justify-between gap-3 md:gap-4">
              <div className="flex-1 text-left">
                <p className="text-emerald-400 font-bold text-sm md:text-base mb-1">6-10단계: 현장점검</p>
                <p className="text-gray-300 text-xs md:text-sm">추가한 장비 점검 및 완료 처리</p>
              </div>
              <button
                onClick={() => {
                  // 6단계 시작 전에 샘플 장비 추가
                  setScheduledSerials(new Set(['AED2024001']));
                  setPageView('inspection');
                  setTutorialStep(6);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 md:py-3 px-3 md:px-6 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-emerald-500/50 whitespace-nowrap text-xs md:text-base"
              >
                6단계부터 시작
              </button>
            </div>
          </div>

          {/* 튜토리얼 닫기 버튼 */}
          <button
            onClick={() => {
              if (confirm('튜토리얼을 종료하고 메인 화면으로 이동하시겠습니까?')) {
                router.push('/');
              }
            }}
            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 md:py-3 px-6 md:px-8 rounded-lg transition-colors duration-200 text-sm md:text-base"
          >
            튜토리얼 닫기
          </button>

          <div className="text-xs md:text-sm text-gray-500 mt-4 md:mt-6 text-center">
            <p>© 2025 AED 픽스 aed.pics</p>
            <p className="mt-1">국립중앙의료원 중앙응급의료센터</p>
          </div>
        </div>
      </div>
    );
  }

  // 완료 화면
  if (tutorialStep === 11) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center z-50">
        <div className="max-w-2xl mx-auto px-6 py-12 text-center">
          <div className="mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full mx-auto mb-6 flex items-center justify-center animate-bounce">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">
              🎉 완료!
            </h1>
            <p className="text-2xl text-gray-300 mb-8">
              AED 점검 시스템 사용법을 모두 배우셨습니다!
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">학습 완료 내용:</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-emerald-400 mt-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-white font-medium">일정관리</p>
                  <p className="text-sm text-gray-400">장비 검색 및 추가</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-emerald-400 mt-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-white font-medium">현장점검</p>
                  <p className="text-sm text-gray-400">점검 시작 및 완료</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-emerald-400 mt-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-white font-medium">필터 사용</p>
                  <p className="text-sm text-gray-400">지역별 장비 검색</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-emerald-400 mt-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-white font-medium">상태 관리</p>
                  <p className="text-sm text-gray-400">점검 진행 상황 확인</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => {
                setTutorialStep(0);
                setScheduledSerials(new Set());
                setPageView('aed-data');
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-colors duration-200 shadow-lg hover:shadow-emerald-500/50"
            >
              다시 시작하기
            </button>
            <button
              onClick={() => setIsTutorialActive(false)}
              className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-3 px-8 rounded-lg transition-colors duration-200"
            >
              튜토리얼 종료
            </button>
          </div>

          <p className="text-sm text-gray-500 mt-6">
            실제 시스템에 로그인하여 사용해보세요!
          </p>
        </div>
      </div>
    );
  }

  // 헤더의 페이지 타이틀을 업데이트
  const pageTitle = pageView === 'aed-data' ? '일정관리' : '현장점검';

  // 전역 이벤트로 헤더에 페이지 타이틀 전달
  if (typeof window !== 'undefined') {
    (window as any).tutorialPageTitle = pageTitle;
  }

  return (
    <>
        {pageView === 'aed-data' && (
          <FakeAEDDataPage
            scheduledSerials={scheduledSerials}
            onScheduleDevice={handleScheduleDevice}
            onNavigateToInspection={handleNavigateToInspection}
            tutorialStep={tutorialStep}
            onTutorialAction={handleTutorialNext}
          />
        )}
      {pageView === 'inspection' && (
        <FakeInspectionPage
          scheduledSerials={scheduledSerials}
          onNavigateToAEDData={handleNavigateToAEDData}
          tutorialStep={tutorialStep}
          onTutorialAction={handleTutorialNext}
        />
      )}

      {/* Tutorial Spotlight */}
      {isTutorialActive && currentStepConfig && currentStepConfig.page === pageView && (
        <TutorialSpotlight
          step={tutorialStep}
          targetSelector={activeSelector}
          title={currentStepConfig.title}
          message={currentStepConfig.message}
          position={activePosition}
          onNext={handleTutorialNext}
          onSkip={handleTutorialSkip}
          showSkip={tutorialStep !== 11}
          showNext={!currentStepConfig.hideNext}
        />
      )}

      {/* Tutorial Bottom Navigation (모바일만 표시) */}
      <TutorialBottomNav
        currentPage={pageView}
        onNavigate={handleBottomNavNavigate}
      />
    </>
  );
}
