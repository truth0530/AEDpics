'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import GuidelineViewerModal from '@/components/ui/GuidelineViewerModal';
import { CheckCircle2, Circle, AlertCircle, Info, ChevronRight, ChevronLeft, Save, Upload } from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  priority?: 'high' | 'medium' | 'low';
  description?: string;
}

interface Section {
  id: string;
  title: string;
  icon?: React.ReactNode;
  items: ChecklistItem[];
  progress: number;
}

export default function Tutorial4Page() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState('basic');
  const [overallProgress, setOverallProgress] = useState(0);
  const [sections, setSections] = useState<Record<string, Section>>({
    basic: {
      id: 'basic',
      title: '기본 정보 확인',
      items: [
        { id: 'b2', label: '설치 위치 정보 확인', checked: false, priority: 'high' },
        { id: 'b3', label: '관리자 연락처 확인', checked: false, priority: 'medium' },
      ],
      progress: 0,
    },
    device: {
      id: 'device',
      title: '장치 점검',
      items: [
        { id: 'd1', label: '전원 상태 LED 확인', checked: false, priority: 'high', description: '녹색 LED가 정상적으로 점멸하는지 확인' },
        { id: 'd2', label: '배터리 잔량 확인', checked: false, priority: 'high', description: '최소 50% 이상 유지되어야 함' },
        { id: 'd3', label: '패드 연결 상태 확인', checked: false, priority: 'high' },
        { id: 'd4', label: '음성 안내 기능 테스트', checked: false },
        { id: 'd5', label: '케이스 손상 여부 확인', checked: false },
        { id: 'd6', label: '방수 실링 상태 확인', checked: false },
      ],
      progress: 0,
    },
    supplies: {
      id: 'supplies',
      title: '소모품 점검',
      items: [
        { id: 's1', label: '성인용 패드 유효기간 확인', checked: false, priority: 'high' },
        { id: 's2', label: '소아용 패드 유효기간 확인', checked: false, priority: 'medium' },
        { id: 's3', label: '배터리 교체 주기 확인', checked: false, priority: 'high' },
        { id: 's4', label: '가위 및 면도기 구비', checked: false },
        { id: 's5', label: '장갑 및 마스크 구비', checked: false },
      ],
      progress: 0,
    },
    location: {
      id: 'location',
      title: '설치 환경',
      items: [
        { id: 'l1', label: '접근성 확인', checked: false, priority: 'high', description: '24시간 접근 가능한지 확인' },
        { id: 'l2', label: '표지판 시인성 확인', checked: false, priority: 'high' },
        { id: 'l3', label: '조명 상태 확인', checked: false },
        { id: 'l4', label: '온습도 적정성 확인', checked: false, description: '권장: 10-40°C, 습도 95% 이하' },
        { id: 'l5', label: '보안 장치 작동 확인', checked: false },
      ],
      progress: 0,
    },
    documentation: {
      id: 'documentation',
      title: '문서 관리',
      items: [
        { id: 'doc1', label: '점검 일지 작성', checked: false, priority: 'high' },
        { id: 'doc2', label: '이상 사항 기록', checked: false },
        { id: 'doc4', label: '다음 점검 일정 확인', checked: false },
      ],
      progress: 0,
    },
  });
  const [isGuidelineOpen, setIsGuidelineOpen] = useState(false);

  const handleItemToggle = (sectionId: string, itemId: string) => {
    setSections(prev => {
      const newSections = { ...prev };
      const section = newSections[sectionId];
      const item = section.items.find(i => i.id === itemId);

      if (item) {
        item.checked = !item.checked;
        section.progress = Math.round((section.items.filter(i => i.checked).length / section.items.length) * 100);
      }

      return newSections;
    });
  };

  useEffect(() => {
    const totalItems = Object.values(sections).reduce((acc, section) => acc + section.items.length, 0);
    const checkedItems = Object.values(sections).reduce((acc, section) =>
      acc + section.items.filter(item => item.checked).length, 0
    );
    setOverallProgress(Math.round((checkedItems / totalItems) * 100));
  }, [sections]);

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'default';
    }
  };


  const handleSave = () => {
    const data = {
      timestamp: new Date().toISOString(),
      sections,
      overallProgress,
    };
    localStorage.setItem('tutorial4_progress', JSON.stringify(data));
    alert('진행 상황이 저장되었습니다.');
  };

  const handleExport = () => {
    const data = {
      timestamp: new Date().toISOString(),
      sections: Object.values(sections).map(section => ({
        title: section.title,
        progress: section.progress,
        items: section.items.map(item => ({
          label: item.label,
          checked: item.checked,
          priority: item.priority,
        })),
      })),
      overallProgress,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aed-inspection-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-bold text-white">AED 점검 시스템 Tutorial 4</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setIsGuidelineOpen(true)}
                className="border border-emerald-500/40 bg-emerald-600/20 text-emerald-200 hover:bg-emerald-500/30 hover:text-emerald-100"
              >
                지침보기
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/')}
                className="text-white border-white hover:bg-white/10"
              >
                홈으로
              </Button>
            </div>
          </div>

          {/* Progress Overview Card */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">전체 진행률</CardTitle>
              <CardDescription className="text-gray-400">
                총 {Object.values(sections).reduce((acc, s) => acc + s.items.length, 0)}개 항목 중 {Object.values(sections).reduce((acc, s) => acc + s.items.filter(i => i.checked).length, 0)}개 완료
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Progress value={overallProgress} className="h-3" />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">진행률</span>
                  <span className="text-white font-semibold">{overallProgress}%</span>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} size="sm" variant="secondary">
                    <Save className="mr-2 h-4 w-4" />
                    저장
                  </Button>
                  <Button onClick={handleExport} size="sm" variant="secondary">
                    <Upload className="mr-2 h-4 w-4" />
                    내보내기
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content with Tabs */}
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full bg-gray-800/50">
            {Object.values(sections).map((section) => (
              <TabsTrigger
                key={section.id}
                value={section.id}
                className="text-xs sm:text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="hidden sm:inline">{section.title}</span>
                  <span className="sm:hidden">{section.title.slice(0, 4)}</span>
                  <Badge variant={section.progress === 100 ? 'default' : 'outline'} className="text-xs">
                    {section.progress}%
                  </Badge>
                </div>
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.values(sections).map((section) => (
            <TabsContent key={section.id} value={section.id} className="space-y-4">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white text-xl">{section.title}</CardTitle>
                      <CardDescription className="text-gray-400 mt-2">
                        {section.items.filter(i => i.checked).length} / {section.items.length} 항목 완료
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-white">{section.progress}%</div>
                      <Progress value={section.progress} className="w-24 h-2 mt-2" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {section.progress === 100 && (
                    <Alert className="mb-4 bg-green-900/20 border-green-700">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <AlertTitle className="text-green-500">섹션 완료</AlertTitle>
                      <AlertDescription className="text-green-400">
                        이 섹션의 모든 항목을 점검했습니다.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-3">
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        className={`p-4 rounded-lg border transition-all cursor-pointer hover:bg-gray-700/30 ${
                          item.checked
                            ? 'bg-gray-700/20 border-green-600/50'
                            : 'bg-gray-800/30 border-gray-600'
                        }`}
                        onClick={() => handleItemToggle(section.id, item.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="pt-1">
                            {item.checked ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <Circle className="h-5 w-5 text-gray-500" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-medium ${item.checked ? 'text-gray-400 line-through' : 'text-white'}`}>
                                {item.label}
                              </span>
                              {item.priority && (
                                <Badge variant={getPriorityColor(item.priority)} className="text-xs">
                                  {item.priority === 'high' ? '필수' : item.priority === 'medium' ? '권장' : '선택'}
                                </Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-sm text-gray-400 mt-1">{item.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    const keys = Object.keys(sections);
                    const currentIndex = keys.indexOf(currentTab);
                    if (currentIndex > 0) {
                      setCurrentTab(keys[currentIndex - 1]);
                    }
                  }}
                  disabled={Object.keys(sections).indexOf(currentTab) === 0}
                  className="text-white border-gray-600 hover:bg-gray-700"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  이전
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const keys = Object.keys(sections);
                    const currentIndex = keys.indexOf(currentTab);
                    if (currentIndex < keys.length - 1) {
                      setCurrentTab(keys[currentIndex + 1]);
                    }
                  }}
                  disabled={Object.keys(sections).indexOf(currentTab) === Object.keys(sections).length - 1}
                  className="text-white border-gray-600 hover:bg-gray-700"
                >
                  다음
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                필수 항목
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {Object.values(sections).reduce((acc, s) => acc + s.items.filter(i => i.priority === 'high' && i.checked).length, 0)} /
                {Object.values(sections).reduce((acc, s) => acc + s.items.filter(i => i.priority === 'high').length, 0)}
              </div>
              <p className="text-sm text-gray-400 mt-1">필수 점검 항목 완료</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-500" />
                점검 시간
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <p className="text-sm text-gray-400 mt-1">{new Date().toLocaleDateString('ko-KR')}</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                완료 섹션
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {Object.values(sections).filter(s => s.progress === 100).length} / {Object.values(sections).length}
              </div>
              <p className="text-sm text-gray-400 mt-1">섹션 완료</p>
            </CardContent>
          </Card>
        </div>

        {/* Tips Alert */}
        <Alert className="mt-8 bg-blue-900/20 border-blue-700">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-500">점검 팁</AlertTitle>
          <AlertDescription className="text-blue-400">
            각 항목을 클릭하여 완료 표시를 할 수 있습니다. 필수 항목(빨간색 배지)은 반드시 점검해야 합니다.
            진행 상황은 자동으로 저장되며, 언제든지 내보내기 버튼을 통해 점검 결과를 다운로드할 수 있습니다.
          </AlertDescription>
        </Alert>
      </div>
      <GuidelineViewerModal
        open={isGuidelineOpen}
        onClose={() => setIsGuidelineOpen(false)}
      />
    </div>
  );
}
