'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, CheckCircle2, Target, ChevronRight, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import EnhancedComplianceUI from './EnhancedComplianceUI';
import ComplianceCompletedList from './ComplianceCompletedList';

export default function ComplianceMainLayout() {
  const [selectedYear, setSelectedYear] = useState<'2024' | '2025'>('2024');
  const [activeTab, setActiveTab] = useState<'targets' | 'completed'>('targets');

  return (
    <div className="h-full flex flex-col">
      {/* 헤더: 연도 선택 및 타이틀 */}
      <div className="bg-white dark:bg-gray-900 border-b dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold dark:text-gray-200">의무설치기관 매칭</h1>
            <p className="text-muted-foreground text-sm mt-1">
              구비의무기관의 AED 설치 현황을 확인하고 관리합니다
            </p>
          </div>

          {/* 연도 토글 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium dark:text-gray-300">대상년도:</span>
            </div>
            <ToggleGroup type="single" value={selectedYear} onValueChange={(value) => value && setSelectedYear(value as '2024' | '2025')}>
              <ToggleGroupItem value="2024" className="px-4">
                2024년
              </ToggleGroupItem>
              <ToggleGroupItem value="2025" className="px-4">
                2025년
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </div>

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
      <div className="flex-1 px-6 py-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'targets' | 'completed')} className="h-full flex flex-col">
          <TabsList className="grid w-fit grid-cols-2 mb-6">
            <TabsTrigger value="targets" className="px-8">
              <Target className="w-4 h-4 mr-2" />
              의무기관
            </TabsTrigger>
            <TabsTrigger value="completed" className="px-8">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              설치확인
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto">
            <TabsContent value="targets" className="mt-0 h-full">
              {selectedYear === '2024' ? (
                <EnhancedComplianceUI year={selectedYear} />
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