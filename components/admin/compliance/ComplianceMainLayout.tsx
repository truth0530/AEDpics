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
import { UserProfile } from '@/packages/types';

interface ComplianceMainLayoutProps {
  initialProfile?: UserProfile;
}

export default function ComplianceMainLayout({ initialProfile }: ComplianceMainLayoutProps) {
  // sessionStorage에서 초기값 로드
  const [selectedYear, setSelectedYear] = useState<'2024' | '2025'>(() => {
    if (typeof window !== 'undefined') {
      return (window.sessionStorage.getItem('complianceYear') as '2024' | '2025') || '2024'
    }
    return '2024'
  });
  const [activeTab, setActiveTab] = useState<'targets' | 'completed'>('targets');
  const [selectedInstitutionName, setSelectedInstitutionName] = useState<string | null>(null);

  // 지역 선택 상태 - sessionStorage에서 초기값 로드
  const [selectedSido, setSelectedSido] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return window.sessionStorage.getItem('selectedSido') || null
    }
    return null
  });
  const [selectedGugun, setSelectedGugun] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return window.sessionStorage.getItem('selectedGugun') || null
    }
    return null
  });

  // Ref for ComplianceCompletedList to call export function
  const completedListRef = useRef<ComplianceCompletedListRef>(null);

  // 통계 상태
  const [statistics, setStatistics] = useState({
    total: 0,
    installed: 0,
    notInstalled: 0,
    avgConfidence: 0
  });

  // 필터 상태
  const [statusFilter, setStatusFilter] = useState<'all' | 'installed' | 'not_installed'>('not_installed');
  const [subDivisionFilter, setSubDivisionFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [availableSubDivisions, setAvailableSubDivisions] = useState<string[]>([]);

  // AppHeader에서 년도 변경 이벤트 수신
  useEffect(() => {
    const handleYearChange = (e: CustomEvent) => {
      const year = e.detail.year as '2024' | '2025'
      setSelectedYear(year)
    }

    window.addEventListener('complianceYearChanged', handleYearChange as EventListener)
    return () => {
      window.removeEventListener('complianceYearChanged', handleYearChange as EventListener)
    }
  }, [])

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
      {/* 2025년 데이터 없음 알림 */}
      {selectedYear === '2025' && (
        <div className="px-6 pt-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              2025년 의무설치기관 데이터는 준비 중입니다. 데이터가 업로드되면 사용 가능합니다.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <div className="flex-1 px-6 py-2 bg-gray-50 dark:bg-gray-900">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'targets' | 'completed')} className="h-full flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <TabsList className="grid w-fit grid-cols-2">
              <TabsTrigger value="targets" className="px-8">
                매칭하기
              </TabsTrigger>
              <TabsTrigger value="completed" className="px-8">
                매칭결과
              </TabsTrigger>
            </TabsList>

            {/* 동적 안내 메시지 - 매칭하기 탭 */}
            {activeTab === 'targets' && (
              <div className="text-sm text-muted-foreground">
                {selectedInstitutionName ? (
                  <span className="text-foreground font-medium">
                    {selectedInstitutionName}과 매칭할 관리번호를 선택하세요
                  </span>
                ) : (
                  <span>의무설치기관을 선택하세요</span>
                )}
              </div>
            )}

            {/* 필터 및 통계 뱃지 - 매칭결과 탭 */}
            {activeTab === 'completed' && selectedYear === '2024' && (
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
                  미완료: <span className="font-semibold ml-1">{statistics.total - statistics.installed}</span>
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
              {selectedYear === '2024' ? (
                <ComplianceMatchingWorkflow
                  year={selectedYear}
                  initialProfile={initialProfile}
                />
              ) : (
                <Card className="border-dashed dark:border-gray-700">
                  <CardContent className="flex flex-col items-center justify-center py-20">
                    <div className="text-center space-y-3">
                      <div className="text-6xl">📋</div>
                      <h3 className="text-lg font-semibold dark:text-gray-200">2025년 데이터 준비 중</h3>
                      <p className="text-sm text-muted-foreground">
                        2025년 의무설치기관 목록이 업로드되면<br />
                        이곳에서 확인할 수 있습니다
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-0 h-full">
              {selectedYear === '2024' ? (
                <ComplianceCompletedList
                  ref={completedListRef}
                  year={selectedYear}
                  sido={selectedSido}
                  gugun={selectedGugun}
                  statusFilter={statusFilter}
                  subDivisionFilter={subDivisionFilter}
                  searchTerm={searchTerm}
                />
              ) : (
                <Card className="border-dashed dark:border-gray-700">
                  <CardContent className="flex flex-col items-center justify-center py-20">
                    <div className="text-center space-y-3">
                      <div className="text-6xl">✅</div>
                      <h3 className="text-lg font-semibold dark:text-gray-200">2025년 데이터 준비 중</h3>
                      <p className="text-sm text-muted-foreground">
                        2025년 설치확인 현황이 업로드되면<br />
                        이곳에서 확인할 수 있습니다
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
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