'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface ComplianceDashboardProps {
  selectedSido?: string | null;
  selectedGugun?: string | null;
}

interface MatchingStatusData {
  success: boolean;
  year: number;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  summary: {
    total_institutions_on_page: number;
    total_institutions_all: number;
    matched_institutions: number;
    unmatched_institutions_count: number;
    total_matched_equipment: number;
    matching_rate: string;
  };
  institutions: Array<{
    target_key: string;
    institution_name: string;
    sido: string;
    gugun: string;
    address: string;
    sub_division: string;
    matched_equipment_count: number;
    matched_serials: string[];
    is_matched: boolean;
  }>;
}

interface InspectionStatusData {
  success: boolean;
  year: number;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  summary: {
    total_institutions_on_page: number;
    total_institutions_all: number;
    total_matched_equipment: number;
    total_inspected_equipment: number;
    total_uninspected_equipment: number;
    overall_inspection_rate: string;
    total_good_status: number;
    total_bad_status: number;
    total_other_status: number;
    overall_good_rate: string;
    overall_bad_rate: string;
  };
  institutions: Array<{
    target_key: string;
    institution_name: string;
    sido: string;
    gugun: string;
    address: string;
    sub_division: string;
    matched_equipment_count: number;
    inspected_equipment_count: number;
    uninspected_equipment_count: number;
    inspection_rate: string;
    good_status_count: number;
    bad_status_count: number;
    other_status_count: number;
    good_rate: string;
    bad_rate: string;
    latest_inspection_date: string | null;
    total_inspection_records: number;
  }>;
}

interface ComplianceRateData {
  success: boolean;
  year: number;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  summary: {
    total_institutions_on_page: number;
    total_institutions_all: number;
    total_regional_equipment: number;
    total_matched_equipment: number;
    total_inspected_equipment: number;
    total_good_status: number;
    overall_matching_rate: string;
    overall_inspection_rate: string;
    overall_good_rate: string;
    overall_compliance_rate: string;
    overall_compliance_grade: string;
  };
  institutions: Array<{
    target_key: string;
    institution_name: string;
    sido: string;
    gugun: string;
    address: string;
    sub_division: string;
    total_regional_equipment: number;
    matched_equipment_count: number;
    inspected_equipment_count: number;
    good_status_count: number;
    bad_status_count: number;
    matching_rate: string;
    inspection_rate: string;
    good_rate: string;
    overall_compliance_rate: string;
    latest_inspection_date: string | null;
    compliance_grade: string;
  }>;
}

export default function ComplianceDashboard({ selectedSido, selectedGugun }: ComplianceDashboardProps) {
  const [activeTab, setActiveTab] = useState<'matching' | 'inspection' | 'rate'>('matching');

  // 매칭 현황 상태
  const [matchingData, setMatchingData] = useState<MatchingStatusData | null>(null);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const [matchingPage, setMatchingPage] = useState(1);
  const [matchingPageSize, setMatchingPageSize] = useState(50);

  // 점검 현황 상태
  const [inspectionData, setInspectionData] = useState<InspectionStatusData | null>(null);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [inspectionPage, setInspectionPage] = useState(1);
  const [inspectionPageSize, setInspectionPageSize] = useState(50);

  // 의무이행률 상태
  const [complianceData, setComplianceData] = useState<ComplianceRateData | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState<string | null>(null);
  const [compliancePage, setCompliancePage] = useState(1);
  const [compliancePageSize, setCompliancePageSize] = useState(50);

  // 매칭 현황 데이터 가져오기
  const fetchMatchingStatus = async () => {
    setMatchingLoading(true);
    setMatchingError(null);

    try {
      const params = new URLSearchParams({
        page: matchingPage.toString(),
        pageSize: matchingPageSize.toString(),
      });

      if (selectedSido) params.append('sido', selectedSido);
      if (selectedGugun) params.append('gugun', selectedGugun);

      const response = await fetch(`/api/compliance/matching-status?${params.toString()}`);

      if (!response.ok) {
        throw new Error('매칭 현황 데이터를 불러오는데 실패했습니다');
      }

      const data: MatchingStatusData = await response.json();
      setMatchingData(data);
    } catch (error) {
      setMatchingError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다');
    } finally {
      setMatchingLoading(false);
    }
  };

  // 점검 현황 데이터 가져오기
  const fetchInspectionStatus = async () => {
    setInspectionLoading(true);
    setInspectionError(null);

    try {
      const params = new URLSearchParams({
        page: inspectionPage.toString(),
        pageSize: inspectionPageSize.toString(),
      });

      if (selectedSido) params.append('sido', selectedSido);
      if (selectedGugun) params.append('gugun', selectedGugun);

      const response = await fetch(`/api/compliance/inspection-status?${params.toString()}`);

      if (!response.ok) {
        throw new Error('점검 현황 데이터를 불러오는데 실패했습니다');
      }

      const data: InspectionStatusData = await response.json();
      setInspectionData(data);
    } catch (error) {
      setInspectionError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다');
    } finally {
      setInspectionLoading(false);
    }
  };

  // 의무이행률 데이터 가져오기
  const fetchComplianceRate = async () => {
    setComplianceLoading(true);
    setComplianceError(null);

    try {
      const params = new URLSearchParams({
        page: compliancePage.toString(),
        pageSize: compliancePageSize.toString(),
      });

      if (selectedSido) params.append('sido', selectedSido);
      if (selectedGugun) params.append('gugun', selectedGugun);

      const response = await fetch(`/api/compliance/compliance-rate?${params.toString()}`);

      if (!response.ok) {
        throw new Error('의무이행률 데이터를 불러오는데 실패했습니다');
      }

      const data: ComplianceRateData = await response.json();
      setComplianceData(data);
    } catch (error) {
      setComplianceError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다');
    } finally {
      setComplianceLoading(false);
    }
  };

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (activeTab === 'matching') {
      fetchMatchingStatus();
    } else if (activeTab === 'inspection') {
      fetchInspectionStatus();
    } else if (activeTab === 'rate') {
      fetchComplianceRate();
    }
  }, [activeTab, matchingPage, matchingPageSize, inspectionPage, inspectionPageSize, compliancePage, compliancePageSize, selectedSido, selectedGugun]);

  // 매칭 완료 이벤트 수신하여 통계 새로고침
  useEffect(() => {
    const handleMatchCompleted = () => {
      console.log('[ComplianceDashboard] Match completed, refreshing statistics...');
      // 현재 탭의 데이터만 새로고침 (성능 최적화)
      if (activeTab === 'matching') {
        fetchMatchingStatus();
      } else if (activeTab === 'inspection') {
        fetchInspectionStatus();
      } else if (activeTab === 'rate') {
        fetchComplianceRate();
      }
    };

    window.addEventListener('matchCompleted', handleMatchCompleted);
    return () => {
      window.removeEventListener('matchCompleted', handleMatchCompleted);
    };
  }, [activeTab, fetchMatchingStatus, fetchInspectionStatus, fetchComplianceRate]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* 지역 필터 표시 */}
      {(selectedSido || selectedGugun) && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {selectedSido && <span className="font-medium">{selectedSido}</span>}
            {selectedGugun && <span className="font-medium ml-1">{selectedGugun}</span>}
            {' '}지역으로 필터링된 통계입니다
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'matching' | 'inspection' | 'rate')} className="flex flex-col flex-1">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="matching">매칭 현황</TabsTrigger>
          <TabsTrigger value="inspection">점검 현황</TabsTrigger>
          <TabsTrigger value="rate">의무이행률</TabsTrigger>
        </TabsList>

        {/* 매칭 현황 탭 */}
        <TabsContent value="matching" className="flex flex-col flex-1 space-y-4 mt-4">
          {matchingLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {matchingError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{matchingError}</AlertDescription>
            </Alert>
          )}

          {!matchingLoading && !matchingError && matchingData && (
            <>
              {/* 요약 통계 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>전체 기관</CardDescription>
                    <CardTitle className="text-3xl">{matchingData.summary.total_institutions_all}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>매칭 완료</CardDescription>
                    <CardTitle className="text-3xl text-green-600">{matchingData.summary.matched_institutions}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>미매칭</CardDescription>
                    <CardTitle className="text-3xl text-yellow-600">{matchingData.summary.unmatched_institutions_count}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>매칭률</CardDescription>
                    <CardTitle className="text-3xl">{matchingData.summary.matching_rate}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* 기관 목록 */}
              <Card className="flex flex-col flex-1">
                <CardHeader>
                  <CardTitle>기관별 매칭 현황</CardTitle>
                  <CardDescription>매칭된 장비 수 기준으로 정렬</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  {matchingData.institutions.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {selectedSido || selectedGugun ? (
                          <>
                            선택한 지역에 매칭된 기관이 없습니다.
                            {' '}다른 지역을 선택하거나 지역 필터를 해제해보세요.
                          </>
                        ) : (
                          <>매칭된 기관이 아직 없습니다. '매칭하기' 탭에서 의무기관과 AED를 매칭하세요.</>
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div className="flex-1 overflow-auto border rounded-lg">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-4">기관명</th>
                              <th className="text-left py-2 px-4">시도</th>
                              <th className="text-left py-2 px-4">구군</th>
                              <th className="text-left py-2 px-4">세부구분</th>
                              <th className="text-right py-2 px-4">매칭된 장비</th>
                              <th className="text-center py-2 px-4">상태</th>
                            </tr>
                          </thead>
                          <tbody>
                            {matchingData.institutions.map((institution) => (
                              <tr key={institution.target_key} className="border-b hover:bg-muted/50">
                                <td className="py-2 px-4 font-medium">{institution.institution_name}</td>
                                <td className="py-2 px-4 text-muted-foreground">{institution.sido}</td>
                                <td className="py-2 px-4 text-muted-foreground">{institution.gugun}</td>
                                <td className="py-2 px-4 text-muted-foreground">{institution.sub_division}</td>
                                <td className="py-2 px-4 text-right font-semibold">{institution.matched_equipment_count}대</td>
                                <td className="py-2 px-4 text-center">
                                  {institution.is_matched ? (
                                    <Badge variant="default" className="bg-green-500">매칭완료</Badge>
                                  ) : (
                                    <Badge variant="secondary">미매칭</Badge>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* 페이지네이션 */}
                      <div className="mt-4 pt-4 border-t">
                        <Pagination
                          currentPage={matchingData.pagination.page}
                          totalPages={matchingData.pagination.totalPages}
                          pageSize={matchingData.pagination.pageSize}
                          total={matchingData.pagination.totalCount}
                          onPageChange={(page) => setMatchingPage(page)}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* 점검 현황 탭 */}
        <TabsContent value="inspection" className="flex flex-col flex-1 space-y-4 mt-4">
          {inspectionLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {inspectionError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{inspectionError}</AlertDescription>
            </Alert>
          )}

          {!inspectionLoading && !inspectionError && inspectionData && (
            <>
              {/* 요약 통계 */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>매칭된 장비</CardDescription>
                    <CardTitle className="text-3xl">{inspectionData.summary.total_matched_equipment}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>점검 완료</CardDescription>
                    <CardTitle className="text-3xl text-green-600">{inspectionData.summary.total_inspected_equipment}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>점검률</CardDescription>
                    <CardTitle className="text-3xl">{inspectionData.summary.overall_inspection_rate}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>양호</CardDescription>
                    <CardTitle className="text-3xl text-green-600">{inspectionData.summary.total_good_status}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>불량</CardDescription>
                    <CardTitle className="text-3xl text-red-600">{inspectionData.summary.total_bad_status}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* 기관 목록 */}
              <Card className="flex flex-col flex-1">
                <CardHeader>
                  <CardTitle>기관별 점검 현황</CardTitle>
                  <CardDescription>점검 완료 장비 수 기준으로 정렬</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <div className="flex-1 overflow-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4">기관명</th>
                          <th className="text-left py-2 px-4">시도</th>
                          <th className="text-left py-2 px-4">구군</th>
                          <th className="text-right py-2 px-4">매칭</th>
                          <th className="text-right py-2 px-4">점검</th>
                          <th className="text-right py-2 px-4">점검률</th>
                          <th className="text-right py-2 px-4">양호</th>
                          <th className="text-right py-2 px-4">불량</th>
                          <th className="text-right py-2 px-4">양호율</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inspectionData.institutions.map((institution) => (
                          <tr key={institution.target_key} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-4 font-medium">{institution.institution_name}</td>
                            <td className="py-2 px-4 text-muted-foreground">{institution.sido}</td>
                            <td className="py-2 px-4 text-muted-foreground">{institution.gugun}</td>
                            <td className="py-2 px-4 text-right">{institution.matched_equipment_count}대</td>
                            <td className="py-2 px-4 text-right font-semibold">{institution.inspected_equipment_count}대</td>
                            <td className="py-2 px-4 text-right">{institution.inspection_rate}</td>
                            <td className="py-2 px-4 text-right text-green-600">{institution.good_status_count}</td>
                            <td className="py-2 px-4 text-right text-red-600">{institution.bad_status_count}</td>
                            <td className="py-2 px-4 text-right">{institution.good_rate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 페이지네이션 */}
                  <div className="mt-4 pt-4 border-t">
                    <Pagination
                      currentPage={inspectionData.pagination.page}
                      totalPages={inspectionData.pagination.totalPages}
                      pageSize={inspectionData.pagination.pageSize}
                      total={inspectionData.pagination.totalCount}
                      onPageChange={(page) => setInspectionPage(page)}
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* 의무이행률 탭 */}
        <TabsContent value="rate" className="flex flex-col flex-1 space-y-4 mt-4">
          {complianceLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {complianceError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{complianceError}</AlertDescription>
            </Alert>
          )}

          {!complianceLoading && !complianceError && complianceData && (
            <>
              {/* 요약 통계 */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>전체 장비</CardDescription>
                    <CardTitle className="text-3xl">{complianceData.summary.total_regional_equipment}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>매칭률</CardDescription>
                    <CardTitle className="text-3xl">{complianceData.summary.overall_matching_rate}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>점검률</CardDescription>
                    <CardTitle className="text-3xl">{complianceData.summary.overall_inspection_rate}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>양호율</CardDescription>
                    <CardTitle className="text-3xl">{complianceData.summary.overall_good_rate}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>종합 의무이행률</CardDescription>
                    <CardTitle className="text-3xl text-blue-600">{complianceData.summary.overall_compliance_rate}</CardTitle>
                    <CardDescription className="mt-1">
                      <Badge variant="secondary">{complianceData.summary.overall_compliance_grade}</Badge>
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>

              {/* 기관 목록 */}
              <Card className="flex flex-col flex-1">
                <CardHeader>
                  <CardTitle>기관별 의무이행률</CardTitle>
                  <CardDescription>매칭률, 점검률, 양호율의 평균으로 산출</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <div className="flex-1 overflow-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4">기관명</th>
                          <th className="text-left py-2 px-4">시도</th>
                          <th className="text-left py-2 px-4">구군</th>
                          <th className="text-right py-2 px-4">매칭률</th>
                          <th className="text-right py-2 px-4">점검률</th>
                          <th className="text-right py-2 px-4">양호율</th>
                          <th className="text-right py-2 px-4">종합이행률</th>
                          <th className="text-center py-2 px-4">등급</th>
                        </tr>
                      </thead>
                      <tbody>
                        {complianceData.institutions.map((institution) => (
                          <tr key={institution.target_key} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-4 font-medium">{institution.institution_name}</td>
                            <td className="py-2 px-4 text-muted-foreground">{institution.sido}</td>
                            <td className="py-2 px-4 text-muted-foreground">{institution.gugun}</td>
                            <td className="py-2 px-4 text-right">{institution.matching_rate}</td>
                            <td className="py-2 px-4 text-right">{institution.inspection_rate}</td>
                            <td className="py-2 px-4 text-right">{institution.good_rate}</td>
                            <td className="py-2 px-4 text-right font-bold text-blue-600">{institution.overall_compliance_rate}</td>
                            <td className="py-2 px-4 text-center">
                              <Badge
                                variant={
                                  institution.compliance_grade.startsWith('A') ? 'default' :
                                  institution.compliance_grade.startsWith('B') ? 'secondary' :
                                  institution.compliance_grade.startsWith('C') ? 'outline' :
                                  'destructive'
                                }
                                className={
                                  institution.compliance_grade.startsWith('A') ? 'bg-green-500' :
                                  institution.compliance_grade.startsWith('B') ? 'bg-blue-500' :
                                  ''
                                }
                              >
                                {institution.compliance_grade}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 페이지네이션 */}
                  <div className="mt-4 pt-4 border-t">
                    <Pagination
                      currentPage={complianceData.pagination.page}
                      totalPages={complianceData.pagination.totalPages}
                      pageSize={complianceData.pagination.pageSize}
                      total={complianceData.pagination.totalCount}
                      onPageChange={(page) => setCompliancePage(page)}
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
