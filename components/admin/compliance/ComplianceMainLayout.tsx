'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, CheckCircle2, Target, ChevronRight, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ComplianceMatchingWorkflow from './ComplianceMatchingWorkflow';
import ComplianceCompletedList from './ComplianceCompletedList';
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
          <div className="flex items-center gap-4 mb-2">
            <TabsList className="grid w-fit grid-cols-2">
              <TabsTrigger value="targets" className="px-8">
                <Target className="w-4 h-4 mr-2" />
                의무기관
              </TabsTrigger>
              <TabsTrigger value="completed" className="px-8">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                설치확인
              </TabsTrigger>
            </TabsList>

            {/* 동적 안내 메시지 */}
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
                <ComplianceCompletedList year={selectedYear} />
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