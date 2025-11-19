'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserProfile } from '@/packages/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { getRegionLabel } from '@/lib/constants/regions';
import { isHighQualityMatch } from '@/lib/utils/match-tier';
import InstitutionListPanel from './InstitutionListPanel';
import ManagementNumberPanel from './ManagementNumberPanel';
import BasketPanel from './BasketPanel';
import { UnmatchableReasonDialog } from './UnmatchableReasonDialog';
import { MatchingStrategyDialog, type MatchingStrategy } from './MatchingStrategyDialog';

// 타입 정의
interface EquipmentDetail {
  serial: string;
  location_detail: string;
}

interface ManagementNumberCandidate {
  management_number: string;
  institution_name: string;
  address: string;
  equipment_count: number;
  equipment_serials: string[];
  equipment_details: EquipmentDetail[];
  confidence: number | null;
  is_matched: boolean;
  matched_to: string | null;
}

interface TargetInstitution {
  target_key: string;
  institution_name: string;
  sido: string;
  gugun: string;
  division: string;
  sub_division: string;
  unique_key?: string; // 2025년 고유키
  address?: string; // 2025년 세부주소
  equipment_count: number;
  matched_count: number;
  unmatched_count: number;
}

interface BasketItem extends ManagementNumberCandidate {
  target_key: string;
  selected_serials?: string[]; // 선택된 장비연번 (undefined면 전체, 배열이면 일부만)
}

interface ConflictCheckResult {
  has_conflicts: boolean;
  total_devices: number;
  already_matched_to_target: number;
  matched_to_other: number;
  unmatched: number;
  conflicts: Array<{
    equipment_serial: string;
    management_number: string;
    device_info: {
      institution_name: string;
      address: string;
    };
    existing_matches: Array<{
      target_key: string;
      institution_name: string;
      management_number: string;
      matched_at: string;
      is_target_match: boolean;
    }>;
  }>;
  summary: {
    message: string;
  };
}

interface ComplianceMatchingWorkflowProps {
  year?: string;
  initialProfile?: UserProfile;
}

export default function ComplianceMatchingWorkflow({
  year = '2025',
  initialProfile
}: ComplianceMatchingWorkflowProps) {
  // State 관리
  const [selectedInstitution, setSelectedInstitution] = useState<TargetInstitution | null>(null);
  // 기관별 basket 관리 (target_key를 키로 사용)
  const [basketByInstitution, setBasketByInstitution] = useState<Record<string, BasketItem[]>>({});
  const [isManagementPanelCollapsed, setIsManagementPanelCollapsed] = useState(false);
  // 매칭 완료 후 리스트 새로고침 트리거
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // 90% 이상 신뢰도 후보 존재 여부
  const [hasHighConfidenceCandidates, setHasHighConfidenceCandidates] = useState(false);
  // 섹션2 후보 데이터 (unique_key 매칭 확인용)
  const [candidatesData, setCandidatesData] = useState<ManagementNumberCandidate[]>([]);
  // 매칭 불가 다이얼로그 상태
  const [unmatchableDialogOpen, setUnmatchableDialogOpen] = useState(false);
  const [unmatchableDialogData, setUnmatchableDialogData] = useState<{
    has100PercentMatch: boolean;
    matchingInstitutionName?: string;
  }>({ has100PercentMatch: false });

  // 매칭 전략 선택 모달 상태
  const [strategyDialogOpen, setStrategyDialogOpen] = useState(false);
  const [conflictData, setConflictData] = useState<ConflictCheckResult | null>(null);

  // 헤더 Region Filter에서 선택한 지역 (동적으로 연결)
  const [selectedRegion, setSelectedRegion] = useState<{ sido: string | null; gugun: string | null }>(() => {
    // sessionStorage에서 초기값 로드
    if (typeof window !== 'undefined') {
      const storedSido = window.sessionStorage.getItem('selectedSido');
      const storedGugun = window.sessionStorage.getItem('selectedGugun');

      // '시도'나 '전체'는 null로 처리
      return {
        sido: storedSido && storedSido !== '시도' ? storedSido : null,
        gugun: storedGugun && storedGugun !== '전체' ? storedGugun : null
      };
    }
    return { sido: null, gugun: null };
  });

  // 현재 선택된 기관의 basket
  const currentBasket = selectedInstitution
    ? (basketByInstitution[selectedInstitution.target_key] || [])
    : [];

  // unique_key 매칭 여부 확인 (basket + 섹션2 후보 모두 확인)
  const hasUniqueKeyInBasket = selectedInstitution?.unique_key && currentBasket.some(item =>
    item.equipment_details?.some(detail =>
      detail.location_detail && detail.location_detail.includes(selectedInstitution.unique_key!)
    )
  );

  // 섹션2 후보에서도 unique_key 매칭 확인
  const hasUniqueKeyInCandidates = selectedInstitution?.unique_key && candidatesData.some(candidate =>
    candidate.equipment_details?.some(detail =>
      detail.location_detail && detail.location_detail.includes(selectedInstitution.unique_key!)
    )
  );

  // basket 또는 섹션2 후보 중 하나라도 매칭되면 true
  const hasUniqueKeyMatch = hasUniqueKeyInBasket || hasUniqueKeyInCandidates;

  // 부분매칭 및 전체담김 개수 계산
  const partialMatchCount = currentBasket.filter(item =>
    item.selected_serials &&
    item.selected_serials.length > 0 &&
    item.selected_serials.length < item.equipment_count
  ).length;

  const fullMatchCount = currentBasket.filter(item =>
    !item.selected_serials || // 전체 선택 (selected_serials가 undefined)
    item.selected_serials.length === item.equipment_count // 또는 모든 장비연번 선택
  ).length;

  // 기존 호환성을 위한 boolean 값
  const hasPartialMatch = partialMatchCount > 0;
  const hasFullMatch = fullMatchCount > 0;

  // 이전 basket 정보 추적 (무한 루프 방지)
  const prevBasketInfoRef = useRef<{
    count: number;
    selectedEquipment: number;
    totalEquipment: number;
    institutionKey: string | null;
  }>({
    count: 0,
    selectedEquipment: 0,
    totalEquipment: 0,
    institutionKey: null
  });

  // 관할지역 정보 (사용자 프로필 기반 - 참고용)
  const userJurisdiction = useMemo(() => {
    if (!initialProfile?.region_code) {
      return null;
    }

    const sidoLabel = getRegionLabel(initialProfile.region_code);

    // 중앙(KR)은 지역 필터 없이 전체 조회
    if (initialProfile.region_code === 'KR') {
      return null;
    }

    return {
      sido: sidoLabel,
      gugun: initialProfile.district || null
    };
  }, [initialProfile]);

  // AppHeader의 RegionFilter 변경 이벤트 수신
  useEffect(() => {
    const handleRegionChange = (e: CustomEvent) => {
      const { sido, gugun } = e.detail;

      console.log('[ComplianceMatchingWorkflow] Region changed from header:', { sido, gugun });

      setSelectedRegion({
        sido: sido && sido !== '시도' ? sido : null,
        gugun: gugun && gugun !== '전체' ? gugun : null
      });

      // 지역 변경 시 선택된 기관 초기화
      setSelectedInstitution(null);
    };

    window.addEventListener('regionSelected', handleRegionChange as EventListener);
    return () => {
      window.removeEventListener('regionSelected', handleRegionChange as EventListener);
    };
  }, []);

  // 매칭결과 탭에서 매칭하기로 이동 시 기관 자동 선택
  useEffect(() => {
    const handleSelectInstitution = (e: CustomEvent) => {
      const institution = e.detail.institution;
      console.log('[ComplianceMatchingWorkflow] Auto-selecting institution:', institution);

      if (institution) {
        // TargetInstitution 형식으로 변환하여 선택
        const targetInstitution: TargetInstitution = {
          target_key: institution.target_key,
          institution_name: institution.institution_name,
          sido: institution.sido,
          gugun: institution.gugun,
          division: institution.division || '',
          sub_division: institution.sub_division || '',
          address: institution.address,
          equipment_count: 0,
          matched_count: 0,
          unmatched_count: 0
        };

        setSelectedInstitution(targetInstitution);

        // 해당 기관의 지역으로 필터 설정
        setSelectedRegion({
          sido: institution.sido,
          gugun: institution.gugun
        });
      }
    };

    window.addEventListener('selectInstitutionFromResult', handleSelectInstitution as EventListener);
    return () => {
      window.removeEventListener('selectInstitutionFromResult', handleSelectInstitution as EventListener);
    };
  }, []);

  // 선택된 기관 정보를 부모(ComplianceMainLayout)에게 알림
  useEffect(() => {
    const event = new CustomEvent('institutionSelected', {
      detail: { institution: selectedInstitution }
    });
    window.dispatchEvent(event);
  }, [selectedInstitution]);

  // 선택된 기관의 90% 이상 신뢰도 후보 존재 여부 확인
  useEffect(() => {
    const checkHighConfidenceCandidates = async () => {
      if (!selectedInstitution) {
        setHasHighConfidenceCandidates(false);
        return;
      }

      try {
        const params = new URLSearchParams({
          year,
          target_key: selectedInstitution.target_key,
          include_all_region: 'false',
          include_matched: 'false'
        });

        const response = await fetch(`/api/compliance/management-number-candidates?${params}`);
        if (!response.ok) throw new Error('Failed to fetch candidates');

        const data = await response.json();
        const autoSuggestions = data.auto_suggestions || [];

        // 고품질 매칭 후보가 있는지 확인 (A 티어 이상: 91% 이상)
        const hasHighConfidence = autoSuggestions.some(
          (candidate: ManagementNumberCandidate) =>
            isHighQualityMatch(candidate.confidence)
        );

        setHasHighConfidenceCandidates(hasHighConfidence);
      } catch (error) {
        console.error('Failed to check high confidence candidates:', error);
        setHasHighConfidenceCandidates(false);
      }
    };

    checkHighConfidenceCandidates();
  }, [selectedInstitution, year]);

  // 담기 박스 정보를 부모(ComplianceMainLayout)에게 알림
  useEffect(() => {
    // 선택된 장비 개수 계산
    const selectedEquipment = currentBasket.reduce((sum, item) => {
      if (item.selected_serials) {
        return sum + item.selected_serials.length;
      }
      return sum + item.equipment_count;
    }, 0);

    // 전체 장비 개수 계산
    const totalEquipment = currentBasket.reduce((sum, item) => {
      return sum + item.equipment_count;
    }, 0);

    const currentInstitutionKey = selectedInstitution?.target_key || null;

    // 이전 값과 비교하여 실제로 변경되었을 때만 이벤트 dispatch (무한 루프 방지)
    const isChanged =
      currentBasket.length !== prevBasketInfoRef.current.count ||
      selectedEquipment !== prevBasketInfoRef.current.selectedEquipment ||
      totalEquipment !== prevBasketInfoRef.current.totalEquipment ||
      currentInstitutionKey !== prevBasketInfoRef.current.institutionKey;

    if (isChanged) {
      // 이전 값 업데이트
      prevBasketInfoRef.current = {
        count: currentBasket.length,
        selectedEquipment,
        totalEquipment,
        institutionKey: currentInstitutionKey
      };

      const event = new CustomEvent('basketUpdated', {
        detail: {
          basket: currentBasket,
          managementNumberCount: currentBasket.length,
          selectedEquipment,
          totalEquipment,
          selectedInstitution
        }
      });
      window.dispatchEvent(event);
    }
  }, [currentBasket, selectedInstitution]);

  // 담기 박스 핸들러
  const handleAddToBasket = (item: ManagementNumberCandidate) => {
    if (!selectedInstitution) return;

    const basketItem: BasketItem = {
      ...item,
      target_key: selectedInstitution.target_key
    };

    setBasketByInstitution(prev => {
      const targetKey = selectedInstitution.target_key;
      const currentItems = prev[targetKey] || [];

      // 중복 체크
      if (currentItems.some(i => i.management_number === item.management_number)) {
        return prev;
      }

      return {
        ...prev,
        [targetKey]: [...currentItems, basketItem]
      };
    });
  };

  const handleRemoveFromBasket = (managementNumber: string) => {
    if (!selectedInstitution) return;

    setBasketByInstitution(prev => {
      const targetKey = selectedInstitution.target_key;
      const currentItems = prev[targetKey] || [];

      return {
        ...prev,
        [targetKey]: currentItems.filter(item => item.management_number !== managementNumber)
      };
    });
  };

  const handleClearBasket = () => {
    if (!selectedInstitution) return;

    setBasketByInstitution(prev => {
      const targetKey = selectedInstitution.target_key;
      return {
        ...prev,
        [targetKey]: []
      };
    });
  };

  const handleAddMultipleToBasket = (items: ManagementNumberCandidate[]) => {
    if (!selectedInstitution) return;

    const basketItems: BasketItem[] = items.map(item => ({
      ...item,
      target_key: selectedInstitution.target_key
    }));

    setBasketByInstitution(prev => {
      const targetKey = selectedInstitution.target_key;
      const currentItems = prev[targetKey] || [];

      // 중복 제거
      const existingNumbers = new Set(currentItems.map(i => i.management_number));
      const newItems = basketItems.filter(item => !existingNumbers.has(item.management_number));

      return {
        ...prev,
        [targetKey]: [...currentItems, ...newItems]
      };
    });
  };

  // 개별 장비연번 담기
  const handleAddEquipmentSerial = (item: ManagementNumberCandidate, serial: string) => {
    if (!selectedInstitution) return;

    setBasketByInstitution(prev => {
      const targetKey = selectedInstitution.target_key;
      const currentItems = prev[targetKey] || [];

      // 같은 관리번호가 이미 basket에 있는지 확인
      const existingItemIndex = currentItems.findIndex(i => i.management_number === item.management_number);

      if (existingItemIndex >= 0) {
        // 이미 있는 경우: selected_serials 배열에 추가
        const existingItem = currentItems[existingItemIndex];
        const currentSerials = existingItem.selected_serials || [];

        // 중복 체크
        if (currentSerials.includes(serial)) {
          return prev;
        }

        const updatedItems = [...currentItems];
        updatedItems[existingItemIndex] = {
          ...existingItem,
          selected_serials: [...currentSerials, serial]
        };

        return {
          ...prev,
          [targetKey]: updatedItems
        };
      } else {
        // 없는 경우: 새 항목 추가 (단일 장비연번만)
        const basketItem: BasketItem = {
          ...item,
          target_key: selectedInstitution.target_key,
          selected_serials: [serial]
        };

        return {
          ...prev,
          [targetKey]: [...currentItems, basketItem]
        };
      }
    });
  };

  // 개별 장비연번 제거
  const handleRemoveEquipmentSerial = (managementNumber: string, serial: string) => {
    if (!selectedInstitution) return;

    setBasketByInstitution(prev => {
      const targetKey = selectedInstitution.target_key;
      const currentItems = prev[targetKey] || [];

      const existingItemIndex = currentItems.findIndex(i => i.management_number === managementNumber);
      if (existingItemIndex < 0) return prev;

      const existingItem = currentItems[existingItemIndex];

      // 전체 매칭 상태 (selected_serials가 undefined)이면,
      // equipment_serials 배열을 기준으로 해당 serial 제외
      const currentSerials = existingItem.selected_serials !== undefined
        ? existingItem.selected_serials
        : existingItem.equipment_serials;

      // 해당 장비연번 제거
      const newSerials = currentSerials.filter(s => s !== serial);

      // 남은 장비연번이 없으면 항목 전체 제거
      if (newSerials.length === 0) {
        return {
          ...prev,
          [targetKey]: currentItems.filter(item => item.management_number !== managementNumber)
        };
      }

      // 남은 장비연번이 있으면 업데이트
      const updatedItems = [...currentItems];
      updatedItems[existingItemIndex] = {
        ...existingItem,
        selected_serials: newSerials
      };

      return {
        ...prev,
        [targetKey]: updatedItems
      };
    });
  };

  // 실제 매칭 실행 (전략 포함)
  const executeMatchWithStrategy = async (strategy: MatchingStrategy) => {
    if (currentBasket.length === 0 || !selectedInstitution) return;
    if (strategy === 'cancel') return;

    try {
      const response = await fetch('/api/compliance/match-basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_key: selectedInstitution.target_key,
          year: parseInt(year),
          management_numbers: currentBasket.map(item => item.management_number),
          strategy
        })
      });

      if (!response.ok) {
        console.error('매칭 API 실패:', {
          status: response.status,
          statusText: response.statusText
        });

        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }

        console.error('매칭 API 에러 데이터:', errorData);
        throw new Error(errorData.error || `매칭 실패 (${response.status})`);
      }

      const result = await response.json();

      // 성공 처리 - 해당 기관의 basket만 비우기
      setBasketByInstitution(prev => {
        const targetKey = selectedInstitution.target_key;
        return {
          ...prev,
          [targetKey]: []
        };
      });

      // 의무설치기관 리스트 새로고침 트리거
      setRefreshTrigger(prev => prev + 1);

      // 매칭 완료 이벤트 발송 (매칭결과, 통계 탭 새로고침)
      window.dispatchEvent(new CustomEvent('matchCompleted', {
        detail: {
          target_key: selectedInstitution.target_key,
          institution_name: selectedInstitution.institution_name,
          management_numbers: currentBasket.map(item => item.management_number)
        }
      }));

      // 성공 메시지 표시
      const matchedCount = currentBasket.reduce((sum, item) => {
        const count = item.selected_serials?.length || item.equipment_count;
        return sum + count;
      }, 0);
      alert(`매칭이 완료되었습니다.\n\n• 기관: ${selectedInstitution.institution_name}\n• 매칭된 관리번호: ${currentBasket.length}개\n• 매칭된 장비: ${matchedCount}대`);

      // 선택된 기관 초기화 (리스트에서 사라지므로)
      setSelectedInstitution(null);

    } catch (error) {
      console.error('매칭 실패:', error);
      alert(error instanceof Error ? error.message : '매칭 중 오류가 발생했습니다.');
    }
  };

  // 매칭 실행 (충돌 체크 포함)
  const handleMatchBasket = async () => {
    if (currentBasket.length === 0 || !selectedInstitution) return;

    // 90% 이하 매칭률 확인 및 경고
    const lowConfidenceItems = currentBasket.filter(item => item.confidence !== null && item.confidence <= 90);

    if (lowConfidenceItems.length > 0) {
      const warnings = lowConfidenceItems.map(item =>
        `• ${selectedInstitution.institution_name}과 ${item.institution_name}은 매칭률이 ${item.confidence?.toFixed(0)}%입니다.`
      ).join('\n');

      const confirmMessage = `${warnings}\n\n그럼에도 불구하고 같은 기관으로 매칭하시겠습니까?`;

      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    try {
      // 기존 매칭 상태 확인
      const checkResponse = await fetch('/api/compliance/check-existing-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_key: selectedInstitution.target_key,
          management_numbers: currentBasket.map(item => item.management_number),
          year: parseInt(year)
        })
      });

      if (!checkResponse.ok) {
        throw new Error('기존 매칭 상태 확인 실패');
      }

      const conflictCheck: ConflictCheckResult = await checkResponse.json();

      // 충돌이 있으면 모달 표시
      if (conflictCheck.has_conflicts) {
        setConflictData(conflictCheck);
        setStrategyDialogOpen(true);
      } else {
        // 충돌이 없으면 바로 매칭 실행
        await executeMatchWithStrategy('add');
      }

    } catch (error) {
      console.error('매칭 충돌 확인 실패:', error);
      alert(error instanceof Error ? error.message : '매칭 충돌 확인 중 오류가 발생했습니다.');
    }
  };

  // 매칭 전략 선택 시 처리
  const handleStrategyConfirm = (strategy: MatchingStrategy) => {
    executeMatchWithStrategy(strategy);
  };

  // 매칭 대상 없음 처리
  const handleNoMatchAvailable = async () => {
    if (!selectedInstitution) return;

    try {
      // 현재 후보 건수 조회 및 100% 매칭 확인
      const params = new URLSearchParams({
        year,
        target_key: selectedInstitution.target_key,
        include_all_region: 'false',
        include_matched: 'false'
      });

      const response = await fetch(`/api/compliance/management-number-candidates?${params}`);
      if (!response.ok) throw new Error('Failed to fetch candidates');

      const data = await response.json();
      const candidates = data.auto_suggestions || [];

      // 100% 매칭 후보 확인
      const perfectMatch = candidates.find((c: any) => c.confidence === 100);

      // 다이얼로그 열기
      setUnmatchableDialogData({
        has100PercentMatch: !!perfectMatch,
        matchingInstitutionName: perfectMatch?.institution_name
      });
      setUnmatchableDialogOpen(true);

    } catch (error) {
      console.error('매칭 대상 없음 처리 실패:', error);
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  // 매칭 불가 확정 처리
  const handleConfirmUnmatchable = async (reason: string) => {
    if (!selectedInstitution) return;

    try {
      const response = await fetch('/api/compliance/mark-unmatchable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_key: selectedInstitution.target_key,
          year,
          reason
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark as unmatchable');
      }

      // 성공 시 UI 업데이트
      setUnmatchableDialogOpen(false);
      setRefreshTrigger(prev => prev + 1);

      // 매칭 불가 처리 이벤트 발송 (매칭결과, 통계 탭 새로고침)
      window.dispatchEvent(new CustomEvent('matchCompleted', {
        detail: {
          target_key: selectedInstitution.target_key,
          institution_name: selectedInstitution.institution_name,
          action: 'mark_unmatchable',
          reason
        }
      }));

      setSelectedInstitution(null);

      alert('매칭 불가로 처리되었습니다.');

    } catch (error) {
      console.error('매칭 불가 처리 실패:', error);
      alert(error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Main Content - 3단 구조 */}
      <div className="grid grid-cols-12 gap-0 pt-0 pb-2 px-2" style={{ height: 'calc(100vh - 5rem)' }}>
        {/* Column 1: 의무설치기관 리스트 (4/12) */}
        <div className="col-span-4 flex flex-col overflow-hidden border-r">
          <Card className="flex-1 flex flex-col overflow-hidden border-0 shadow-none">
            <CardHeader className="pb-2 pt-2 pl-1 pr-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Badge variant="outline">1</Badge>
                {selectedInstitution ? (
                  <span>
                    <span className="text-blue-600 dark:text-blue-400">{selectedInstitution.institution_name}</span> 선택됨
                  </span>
                ) : (
                  <>
                    의무설치기관
                    <span className="text-xs text-muted-foreground font-normal ml-1">
                      미매칭만 표시
                    </span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col pl-0 pr-2">
              <InstitutionListPanel
                year={year}
                sido={selectedRegion.sido}
                gugun={selectedRegion.gugun}
                selectedInstitution={selectedInstitution}
                onSelect={setSelectedInstitution}
                refreshTrigger={refreshTrigger}
                hasPartialMatch={hasPartialMatch}
                hasFullMatch={hasFullMatch}
                partialMatchCount={partialMatchCount}
                fullMatchCount={fullMatchCount}
                basket={currentBasket}
                hasUniqueKeyInBasket={hasUniqueKeyMatch}
              />
            </CardContent>
          </Card>
        </div>

        {/* 화살표 영역 (의무설치기관 선택 전에만 표시) */}
        {!selectedInstitution && (
          <div className="col-span-2 flex items-start justify-center pt-[20vh]">
            <div className="text-center">
              {/* ㄱ자 화살표 */}
              <div className="mb-6 flex justify-center">
                <svg width="100" height="80" viewBox="0 0 100 80" className="text-blue-500 dark:text-blue-400">
                  {/* 화살표 시작 부분 - 점선 (3칸) */}
                  <path
                    d="M 10 10 L 27 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeLinecap="butt"
                    strokeDasharray="3 4"
                  />
                  {/* 화살표 나머지 부분 - 실선 */}
                  <path
                    d="M 27 10 L 55 10 Q 80 10, 80 35 L 80 54"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeLinecap="butt"
                  />
                  {/* 화살표 머리 - 각진 삼각형 (윗부분 수평선) */}
                  <path
                    d="M 68 46 L 68 46 L 92 46 L 80 64 Z"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="miter"
                  />
                </svg>
              </div>
              <div className="text-muted-foreground text-sm">
                좌측의 의무설치기관을<br />
                먼저 선택하세요
              </div>
            </div>
          </div>
        )}

        {/* Column 2: 관리번호 리스트 */}
        <div className={`flex flex-col overflow-hidden border-r transition-all ${
          !selectedInstitution
            ? 'col-span-6'
            : isManagementPanelCollapsed
              ? 'col-span-2'
              : 'col-span-4'
        }`}>
          <Card className="flex-1 flex flex-col overflow-hidden bg-green-900/[0.06] border-0 shadow-none">
            <CardHeader className="pb-2 pt-2 px-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="outline">2</Badge>
                  {!isManagementPanelCollapsed && (
                    <span>매칭후보(인트라넷)</span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {selectedInstitution && !isManagementPanelCollapsed && (
                    <Button
                      size="sm"
                      variant={currentBasket.length > 0 || hasHighConfidenceCandidates ? "outline" : "destructive"}
                      onClick={handleNoMatchAvailable}
                      className={`text-xs ${
                        currentBasket.length > 0
                          ? 'opacity-40'
                          : hasHighConfidenceCandidates
                          ? 'opacity-60'
                          : ''
                      }`}
                    >
                      매칭불가처리
                    </Button>
                  )}
                  {selectedInstitution && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsManagementPanelCollapsed(!isManagementPanelCollapsed)}
                      className="h-8 w-8 p-0"
                    >
                      {isManagementPanelCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronLeft className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col px-2">
              <ManagementNumberPanel
                year={year}
                selectedInstitution={selectedInstitution}
                onAddToBasket={handleAddToBasket}
                onAddMultipleToBasket={handleAddMultipleToBasket}
                onAddEquipmentSerial={handleAddEquipmentSerial}
                basketedManagementNumbers={currentBasket.map(item => item.management_number)}
                basketedItems={currentBasket.map(item => ({
                  management_number: item.management_number,
                  selected_serials: item.selected_serials
                }))}
                isCollapsed={isManagementPanelCollapsed}
                onCandidatesLoaded={setCandidatesData}
              />
            </CardContent>
          </Card>
        </div>

        {/* Column 3: 담기 박스 (의무설치기관 선택 후에만 표시) */}
        {selectedInstitution && (
          <div className={`flex flex-col overflow-hidden transition-all ${isManagementPanelCollapsed ? 'col-span-6' : 'col-span-4'}`}>
            <Card className="flex-1 flex flex-col overflow-hidden border-0 shadow-none">
              <CardHeader className="pb-2 pt-2 px-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant="outline">3</Badge>
                    {currentBasket.length === 0 ? (
                      <span>매칭대기리스트가 비어 있습니다</span>
                    ) : (
                      <span>매칭대기리스트를 확인후 <span className="text-emerald-600 dark:text-emerald-400">매칭하기</span> 버튼을 누르세요</span>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden flex flex-col px-2">
                <BasketPanel
                  basket={currentBasket}
                  selectedInstitution={selectedInstitution}
                  onRemove={handleRemoveFromBasket}
                  onRemoveEquipmentSerial={handleRemoveEquipmentSerial}
                  onClear={handleClearBasket}
                  onMatch={handleMatchBasket}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* 매칭 불가 처리 다이얼로그 */}
      <UnmatchableReasonDialog
        open={unmatchableDialogOpen}
        onOpenChange={setUnmatchableDialogOpen}
        onConfirm={handleConfirmUnmatchable}
        institutionName={selectedInstitution?.institution_name || ''}
        has100PercentMatch={unmatchableDialogData.has100PercentMatch}
        matchingInstitutionName={unmatchableDialogData.matchingInstitutionName}
      />

      {/* 매칭 전략 선택 다이얼로그 */}
      <MatchingStrategyDialog
        open={strategyDialogOpen}
        onOpenChange={setStrategyDialogOpen}
        conflictData={conflictData}
        targetInstitutionName={selectedInstitution?.institution_name || ''}
        onConfirm={handleStrategyConfirm}
      />
    </div>
  );
}
