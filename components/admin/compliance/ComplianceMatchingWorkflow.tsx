'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserProfile } from '@/packages/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { getRegionLabel } from '@/lib/constants/regions';
import InstitutionListPanel from './InstitutionListPanel';
import ManagementNumberPanel from './ManagementNumberPanel';
import BasketPanel from './BasketPanel';

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
  address?: string; // 2025년 세부주소 추가 예정
  equipment_count: number;
  matched_count: number;
  unmatched_count: number;
}

interface BasketItem extends ManagementNumberCandidate {
  target_key: string;
  selected_serials?: string[]; // 선택된 장비연번 (undefined면 전체, 배열이면 일부만)
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

  // 매칭 실행
  const handleMatchBasket = async () => {
    if (currentBasket.length === 0 || !selectedInstitution) return;

    // 90% 이하 매칭률 확인 및 경고
    const lowConfidenceItems = currentBasket.filter(item => item.confidence !== null && item.confidence <= 90);

    if (lowConfidenceItems.length > 0) {
      // 경고 메시지 생성
      const warnings = lowConfidenceItems.map(item =>
        `• ${selectedInstitution.institution_name}과 ${item.institution_name}은 매칭률이 ${item.confidence?.toFixed(0)}%입니다.`
      ).join('\n');

      const confirmMessage = `${warnings}\n\n그럼에도 불구하고 같은 기관으로 매칭하시겠습니까?`;

      if (!window.confirm(confirmMessage)) {
        return; // 사용자가 취소를 선택하면 매칭 중단
      }
    }

    try {
      const response = await fetch('/api/compliance/match-basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_key: selectedInstitution.target_key,
          year: parseInt(year),
          management_numbers: currentBasket.map(item => item.management_number)
        })
      });

      if (!response.ok) {
        throw new Error('매칭 실패');
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

      // 선택된 기관 초기화 (리스트에서 사라지므로)
      setSelectedInstitution(null);

    } catch (error) {
      console.error('매칭 실패:', error);
    }
  };

  // 매칭 대상 없음 처리
  const handleNoMatchAvailable = async () => {
    if (!selectedInstitution) return;

    try {
      // 현재 후보 건수 조회
      const params = new URLSearchParams({
        year,
        target_key: selectedInstitution.target_key,
        include_all_region: 'false',
        include_matched: 'false'
      });

      const response = await fetch(`/api/compliance/management-number-candidates?${params}`);
      if (!response.ok) throw new Error('Failed to fetch candidates');

      const data = await response.json();
      const candidateCount = (data.auto_suggestions || []).length;

      // 확인 메시지 생성
      let confirmMessage;
      if (candidateCount > 0) {
        confirmMessage = `"${selectedInstitution.institution_name}"에 ${candidateCount}건의 후보가 있습니다.\n\n정말로 "매칭 대상 없음"으로 처리하시겠습니까?\n\n• 추천된 모든 후보를 검토하셨습니까?\n• 이 기관은 의무설치기관 목록에서 제외됩니다\n• 매칭결과 탭에서 "매칭 대상 없음" 상태로 표시됩니다`;
      } else {
        confirmMessage = `"${selectedInstitution.institution_name}"과(와) 매칭 가능한 관리번호가 없습니다.\n\n"매칭 대상 없음"으로 표시하시겠습니까?\n\n• 의무설치기관 목록에서 제외됩니다\n• 매칭결과 탭에서 "매칭 대상 없음" 상태로 표시됩니다`;
      }

      if (!window.confirm(confirmMessage)) {
        return;
      }

      // TODO: API 구현 후 실제 저장 로직 추가
      alert('API 구현 예정: 매칭 대상 없음 처리');

      // 성공 시 UI 업데이트
      // setRefreshTrigger(prev => prev + 1);
      // setSelectedInstitution(null);

    } catch (error) {
      console.error('매칭 대상 없음 처리 실패:', error);
      alert('처리 중 오류가 발생했습니다.');
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
                  <span>{selectedInstitution.institution_name} 선택됨</span>
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
              />
            </CardContent>
          </Card>
        </div>

        {/* Column 2: 관리번호 리스트 (4/12 또는 2/12) */}
        <div className={`flex flex-col overflow-hidden border-r transition-all ${isManagementPanelCollapsed ? 'col-span-2' : 'col-span-4'}`}>
          <Card className="flex-1 flex flex-col overflow-hidden bg-green-900/[0.06] border-0 shadow-none">
            <CardHeader className="pb-2 pt-2 px-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="outline">2</Badge>
                  {!isManagementPanelCollapsed && (
                    <span>관리번호 후보</span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {selectedInstitution && !isManagementPanelCollapsed && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleNoMatchAvailable}
                      className="text-xs"
                    >
                      매칭 대상 없음
                    </Button>
                  )}
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
              />
            </CardContent>
          </Card>
        </div>

        {/* Column 3: 담기 박스 (4/12 또는 6/12) */}
        <div className={`flex flex-col overflow-hidden transition-all ${isManagementPanelCollapsed ? 'col-span-6' : 'col-span-4'}`}>
          <Card className="flex-1 flex flex-col overflow-hidden border-0 shadow-none">
            <CardHeader className="pb-2 pt-2 px-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="outline">3</Badge>
                  <span>1 ↔ 2 매칭보관함</span>
                </CardTitle>
                {currentBasket.length > 0 && (
                  <Button
                    size="sm"
                    onClick={handleMatchBasket}
                    disabled={!selectedInstitution}
                  >
                    매칭하기
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col px-2">
              <BasketPanel
                basket={currentBasket}
                selectedInstitution={selectedInstitution}
                onRemove={handleRemoveFromBasket}
                onRemoveEquipmentSerial={handleRemoveEquipmentSerial}
                onClear={handleClearBasket}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
