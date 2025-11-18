'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, CheckCircle2, Target, ChevronRight, AlertCircle, Download, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ComplianceMatchingWorkflow from './ComplianceMatchingWorkflow';
import ComplianceCompletedList, { ComplianceCompletedListRef } from './ComplianceCompletedList';
import ComplianceDashboard from './ComplianceDashboard';
import { UserProfile } from '@/packages/types';

interface ComplianceMainLayoutProps {
  initialProfile?: UserProfile;
}

export default function ComplianceMainLayout({ initialProfile }: ComplianceMainLayoutProps) {
  // 2025년으로 고정
  const selectedYear = '2025' as const;
  const [activeTab, setActiveTab] = useState<'targets' | 'completed' | 'dashboard'>('targets');
  const [selectedInstitutionName, setSelectedInstitutionName] = useState<string | null>(null);

  // 담기 박스 정보 상태
  const [basketInfo, setBasketInfo] = useState<{
    managementNumberCount: number;
    selectedEquipment: number;
    totalEquipment: number;
  }>({
    managementNumberCount: 0,
    selectedEquipment: 0,
    totalEquipment: 0
  });

  // 지역 선택 상태 - 초기값을 사용자 프로필 기반으로 설정
  const getInitialSido = () => {
    if (!initialProfile) return null;
    const orgRegionCode = (initialProfile.organization as any)?.region_code;
    if (orgRegionCode && orgRegionCode !== 'KR') {
      // 지역코드를 한글 시도명으로 변환
      const { REGIONS } = require('@/lib/constants/regions');
      return REGIONS.find((r: any) => r.code === orgRegionCode)?.label || null;
    }
    return null;
  };

  const initialSido = getInitialSido();

  const [selectedSido, setSelectedSido] = useState<string | null>(initialSido);
  const [selectedGugun, setSelectedGugun] = useState<string | null>(null);

  // Ref for ComplianceCompletedList to call export function
  const completedListRef = useRef<ComplianceCompletedListRef>(null);

  // 초기값은 RegionFilter의 이벤트를 통해서만 설정
  // sessionStorage를 사용하지 않아 항상 사용자 권한에 따른 기본 지역으로 시작

  // 통계 상태
  const [statistics, setStatistics] = useState({
    total: 0,
    installed: 0,
    notInstalled: 0,
    unmatchable: 0,
    avgConfidence: 0
  });

  // 필터 상태
  const [statusFilter, setStatusFilter] = useState<'all' | 'installed' | 'not_installed' | 'unmatchable'>('not_installed');
  const [subDivisionFilter, setSubDivisionFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [availableSubDivisions, setAvailableSubDivisions] = useState<string[]>([]);

  // AppHeader의 RegionFilter에서 지역 변경 이벤트 수신
  useEffect(() => {
    const handleRegionChange = (e: CustomEvent) => {
      const { sido, gugun } = e.detail
      console.log('[ComplianceMainLayout] Region changed:', { sido, gugun })
      setSelectedSido(sido || null)
      setSelectedGugun(gugun || null)
    }

    window.addEventListener('regionSelected', handleRegionChange as EventListener)
    return () => {
      window.removeEventListener('regionSelected', handleRegionChange as EventListener)
    }
  }, [])

  // ComplianceMatchingWorkflow에서 선택된 기관 정보 수신
  useEffect(() => {
    const handleInstitutionSelected = (e: CustomEvent) => {
      const institution = e.detail.institution
      setSelectedInstitutionName(institution?.institution_name || null)
    }

    window.addEventListener('institutionSelected', handleInstitutionSelected as EventListener)
    return () => {
      window.removeEventListener('institutionSelected', handleInstitutionSelected as EventListener)
    }
  }, [])

  // ComplianceMatchingWorkflow에서 담기 박스 정보 수신
  useEffect(() => {
    const handleBasketUpdated = (e: CustomEvent) => {
      const { managementNumberCount, selectedEquipment, totalEquipment } = e.detail
      setBasketInfo({
        managementNumberCount,
        selectedEquipment,
        totalEquipment
      })
    }

    window.addEventListener('basketUpdated', handleBasketUpdated as EventListener)
    return () => {
      window.removeEventListener('basketUpdated', handleBasketUpdated as EventListener)
    }
  }, [])

  // 매칭결과 탭에서 매칭하기로 이동 요청 수신
  useEffect(() => {
    const handleOpenMatching = (e: CustomEvent) => {
      const institution = e.detail.institution
      console.log('[ComplianceMainLayout] Opening matching workflow for:', institution)

      // 매칭하기 탭으로 전환
      setActiveTab('targets')

      // 기관 선택 이벤트 발송 (ComplianceMatchingWorkflow에서 수신)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('selectInstitutionFromResult', {
          detail: { institution }
        }))
      }, 100) // 탭 전환 후 이벤트 발송
    }

    window.addEventListener('openMatchingWorkflow', handleOpenMatching as EventListener)
    return () => {
      window.removeEventListener('openMatchingWorkflow', handleOpenMatching as EventListener)
    }
  }, [])

  // 통계 및 availableSubDivisions 업데이트 (ComplianceCompletedList에서 가져오기)
  useEffect(() => {
    const interval = setInterval(() => {
      if (completedListRef.current && activeTab === 'completed') {
        setStatistics(completedListRef.current.statistics)
        setAvailableSubDivisions(completedListRef.current.availableSubDivisions)
      }
    }, 500) // 0.5초마다 업데이트

    return () => clearInterval(interval)
  }, [activeTab])

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* 메인 컨텐츠 */}
      <div className="flex-1 px-6 py-2 bg-gray-50 dark:bg-gray-900">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'targets' | 'completed' | 'dashboard')} className="h-full flex flex-col">
          <div className="flex items-center gap-3 mb-0">
            <TabsList className="grid w-fit grid-cols-3">
              <TabsTrigger value="targets" className="px-8">
                매칭하기
              </TabsTrigger>
              <TabsTrigger value="completed" className="px-8">
                매칭결과
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="px-8">
                통계
              </TabsTrigger>
            </TabsList>

            {/* 동적 안내 메시지 - 매칭하기 탭 */}
            {activeTab === 'targets' && (
              <div className="text-sm">
                {basketInfo.managementNumberCount > 0 ? (
                  // 보관함에 담긴 경우: 상세 정보
                  <span className="text-foreground">
                    <span className="text-yellow-600 dark:text-yellow-400 font-semibold">{selectedInstitutionName}</span>
                    <span className="text-muted-foreground mx-1">과(와)</span>
                    <span className="font-semibold">{basketInfo.managementNumberCount}개</span>
                    <span className="text-muted-foreground mx-1">관리번호</span>
                    <span className="font-semibold">({basketInfo.selectedEquipment}대)</span>
                    <span className="text-muted-foreground mx-1">의 연번 매칭 준비 완료</span>
                    <ChevronRight className="inline h-4 w-4 mx-1" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">'매칭하기'</span>
                    <span className="text-foreground font-medium">를 눌러주세요</span>
                  </span>
                ) : selectedInstitutionName ? (
                  // 보관함이 비어있는 경우
                  <span className="text-muted-foreground">
                    <span className="text-foreground font-medium">{selectedInstitutionName}</span>
                    <span>과 매칭할 관리번호를 선택하세요</span>
                  </span>
                ) : (
                  // 의무기관 미선택
                  <span className="text-muted-foreground">의무설치기관을 선택하세요</span>
                )}
              </div>
            )}

            {/* 필터 및 통계 뱃지 - 매칭결과 탭 */}
            {activeTab === 'completed' && (
              <>
                {/* 클릭 가능한 통계 뱃지 (필터 기능) */}
                <Badge
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  className="text-xs px-2 py-1 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setStatusFilter('all')}
                >
                  의무시설: <span className="font-semibold ml-1">{statistics.total}</span>
                </Badge>
                <Badge
                  variant={statusFilter === 'installed' ? 'default' : 'outline'}
                  className={`text-xs px-2 py-1 cursor-pointer hover:opacity-80 transition-opacity ${
                    statusFilter === 'installed' ? 'bg-green-600 hover:bg-green-700' : 'border-green-500 text-green-700'
                  }`}
                  onClick={() => setStatusFilter('installed')}
                >
                  매칭완료: <span className="font-semibold ml-1">{statistics.installed}</span>
                </Badge>
                <Badge
                  variant={statusFilter === 'not_installed' ? 'default' : 'outline'}
                  className={`text-xs px-2 py-1 cursor-pointer hover:opacity-80 transition-opacity ${
                    statusFilter === 'not_installed' ? 'bg-amber-600 hover:bg-amber-700' : 'border-amber-500 text-amber-700'
                  }`}
                  onClick={() => setStatusFilter('not_installed')}
                >
                  미완료: <span className="font-semibold ml-1">{statistics.total - statistics.installed - statistics.unmatchable}</span>
                </Badge>
                <Badge
                  variant={statusFilter === 'unmatchable' ? 'default' : 'outline'}
                  className={`text-xs px-2 py-1 cursor-pointer hover:opacity-80 transition-opacity ${
                    statusFilter === 'unmatchable' ? 'bg-red-600 hover:bg-red-700' : 'border-red-500 text-red-700'
                  }`}
                  onClick={() => setStatusFilter('unmatchable')}
                >
                  매칭불가: <span className="font-semibold ml-1">{statistics.unmatchable}</span>
                </Badge>

                {/* 구분 드롭다운 */}
                <Select value={subDivisionFilter} onValueChange={setSubDivisionFilter}>
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue placeholder="구분 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {availableSubDivisions.map((subDivision) => (
                      <SelectItem key={subDivision} value={subDivision}>
                        {subDivision}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 기관명 검색 */}
                <div className="relative w-[200px]">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3 w-3" />
                  <Input
                    placeholder="기관명 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-7 h-8 text-xs"
                  />
                </div>

                {/* 엑셀 다운로드 버튼 */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => completedListRef.current?.exportToExcel()}
                  className="ml-auto h-8"
                >
                  <Download className="w-3 h-3 mr-1" />
                  엑셀 다운로드
                </Button>
              </>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            <TabsContent value="targets" className="mt-0 h-full">
              <ComplianceMatchingWorkflow
                year={selectedYear}
                initialProfile={initialProfile}
              />
            </TabsContent>

            <TabsContent value="completed" className="mt-0 h-full overflow-auto">
              <ComplianceCompletedList
                ref={completedListRef}
                year={selectedYear}
                sido={selectedSido}
                gugun={selectedGugun}
                statusFilter={statusFilter}
                subDivisionFilter={subDivisionFilter}
                searchTerm={searchTerm}
              />
            </TabsContent>

            {/* 통계 탭 */}
            <TabsContent value="dashboard" className="flex-1 overflow-auto">
              <ComplianceDashboard
                selectedSido={selectedSido}
                selectedGugun={selectedGugun}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* 빠른 통계 (하단 고정) */}
      <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-6 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <span className="text-muted-foreground">
              {selectedYear}년 의무설치기관 현황
            </span>
            {activeTab === 'targets' ? (
              <div className="flex items-center gap-4">
                <span className="dark:text-gray-300">작업 대기 중</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium dark:text-gray-200">매칭 작업을 진행하세요</span>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="dark:text-gray-300">완료된 작업</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium dark:text-gray-200">확인 이력을 검토하세요</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}