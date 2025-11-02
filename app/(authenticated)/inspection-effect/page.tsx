'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import * as XLSX from 'xlsx';
import { logger } from '@/lib/logger';
import ImprovementCharts from '@/components/inspections/ImprovementCharts';
import FieldComparisonDetailModal from '@/components/inspections/FieldComparisonDetailModal';
import ComparisonView from '@/components/inspections/ComparisonView';

type ViewMode = 'inspection' | 'improvement' | 'all' | 'comparison';

type FieldComparison = {
  id: string;
  inspection_id: string;
  equipment_serial: string;
  field_name: string;
  field_category: string;
  inspection_value: string | null;
  aed_data_value: string | null;
  inspection_time: string;
  status_at_inspection: string;
  issue_severity: string | null;
  current_aed_value: string | null;
  improvement_status: string | null;
  improved_at: string | null;
  days_since_inspection: number | null;
  inspection: {
    inspection_date: string;
    user_profiles: {
      full_name: string;
      email: string;
    };
  };
  aed_device: {
    installation_institution: string;
    sido: string;
    gugun: string;
  };
};

type Stats = {
  totalInspections: number;
  goodCount: number;
  problematicCount: number;
  improvedCount: number;
  neglectedCount: number;
  improvementRate: string;
};

const FIELD_CATEGORY_LABELS: Record<string, string> = {
  battery: '배터리',
  pad: '패드',
  manager: '관리자',
  installation: '설치정보',
  device: '장비정보',
  all: '전체',
};

const FIELD_NAME_LABELS: Record<string, string> = {
  battery_expiry_date: '배터리 만료일',
  pad_expiry_date: '패드 만료일',
  manager: '관리자명',
  institution_contact: '연락처',
  installation_institution: '설치기관',
  installation_address: '설치주소',
  manufacturer: '제조사',
  model_name: '모델명',
  serial_number: '시리얼 번호',
};

export default function ImprovementReportsPage() {
  const { data: session } = useSession();
  const [viewMode, setViewMode] = useState<ViewMode>('inspection');
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<FieldComparison[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalInspections: 0,
    goodCount: 0,
    problematicCount: 0,
    improvedCount: 0,
    neglectedCount: 0,
    improvementRate: '0',
  });

  // 상세보기 모달 상태
  const [selectedRecord, setSelectedRecord] = useState<FieldComparison | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 필터 상태
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    fieldCategory: 'all',
    status: 'all', // 점검시점 상태
    improvementStatus: 'all', // 개선 상태
    minDays: '',
  });

  // 데이터 로드
  const loadData = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        view: viewMode,
        ...Object.entries(filters).reduce((acc, [key, value]) => {
          if (value) acc[key] = value;
          return acc;
        }, {} as Record<string, string>),
      });

      const response = await fetch(`/api/inspections/improvement-reports?${params}`);
      const result = await response.json();

      if (result.success) {
        setRecords(result.data);
        setStats(result.stats);
      } else {
        logger.error('ImprovementReports', '데이터 로드 실패', { error: result.error });
      }
    } catch (error) {
      logger.error('ImprovementReports', '데이터 로드 오류', error instanceof Error ? error : { error });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [viewMode]);

  // 엑셀 다운로드
  const handleExcelDownload = () => {
    try {
      if (records.length === 0) {
        alert('다운로드할 데이터가 없습니다');
        return;
      }

      const excelData = records.map((record, index) => ({
        '번호': index + 1,
        '점검일시': new Date(record.inspection_time).toLocaleString('ko-KR'),
        '장비연번': record.equipment_serial,
        '설치기관': record.aed_device.installation_institution,
        '시도': record.aed_device.sido,
        '시군구': record.aed_device.gugun,
        '필드명': FIELD_NAME_LABELS[record.field_name] || record.field_name,
        '필드카테고리': FIELD_CATEGORY_LABELS[record.field_category] || record.field_category,
        '점검값': record.inspection_value || '-',
        '기존값': record.aed_data_value || '-',
        '현재값': record.current_aed_value || '-',
        '점검시상태': record.status_at_inspection === 'good' ? '양호' : '문제',
        '개선상태': record.improvement_status === 'improved' ? '개선됨' :
                   record.improvement_status === 'neglected' ? '방치됨' : '-',
        '경과일': record.days_since_inspection || '-',
        '심각도': record.issue_severity || '-',
        '점검자': record.inspection.user_profiles.full_name,
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      worksheet['!cols'] = [
        { wch: 6 },  // 번호
        { wch: 18 }, // 점검일시
        { wch: 15 }, // 장비연번
        { wch: 20 }, // 설치기관
        { wch: 12 }, // 시도
        { wch: 12 }, // 시군구
        { wch: 15 }, // 필드명
        { wch: 12 }, // 필드카테고리
        { wch: 20 }, // 점검값
        { wch: 20 }, // 기존값
        { wch: 20 }, // 현재값
        { wch: 10 }, // 점검시상태
        { wch: 10 }, // 개선상태
        { wch: 8 },  // 경과일
        { wch: 10 }, // 심각도
        { wch: 12 }, // 점검자
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '데이터개선리포트');

      const today = new Date();
      const filename = `데이터개선리포트_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.xlsx`;

      XLSX.writeFile(workbook, filename);
    } catch (error) {
      logger.error('ImprovementReports', '엑셀 다운로드 실패', error instanceof Error ? error : { error });
      alert('엑셀 다운로드에 실패했습니다');
    }
  };

  return (
    <div className="container mx-auto p-3 space-y-3">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            데이터 개선 리포트
          </h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            점검 후 데이터 개선 현황을 추적합니다
          </p>
        </div>
      </div>

      {/* 탭 */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4">
          <button
            onClick={() => setViewMode('inspection')}
            className={`py-2 px-1 border-b-2 font-medium text-xs ${
              viewMode === 'inspection'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            점검시점
          </button>
          <button
            onClick={() => setViewMode('improvement')}
            className={`py-2 px-1 border-b-2 font-medium text-xs ${
              viewMode === 'improvement'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            개선현황
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`py-2 px-1 border-b-2 font-medium text-xs ${
              viewMode === 'all'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            통합
          </button>
          <button
            onClick={() => setViewMode('comparison')}
            className={`py-2 px-1 border-b-2 font-medium text-xs ${
              viewMode === 'comparison'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            비교
          </button>
        </nav>
      </div>

      {/* 비교 뷰 */}
      {viewMode === 'comparison' ? (
        <ComparisonView />
      ) : (
        <>
          {/* 필터 */}
          <div className="bg-white dark:bg-gray-800 rounded shadow p-2">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
              시작일
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 py-1 px-2 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
              종료일
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 py-1 px-2 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
              필드 유형
            </label>
            <select
              value={filters.fieldCategory}
              onChange={(e) => setFilters({ ...filters, fieldCategory: e.target.value })}
              className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 py-1 px-2 focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">전체</option>
              <option value="battery">배터리</option>
              <option value="pad">패드</option>
              <option value="manager">관리자</option>
              <option value="installation">설치정보</option>
              <option value="device">장비정보</option>
            </select>
          </div>

          {viewMode === 'inspection' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                점검시 상태
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 py-1 px-2 focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">전체</option>
                <option value="good">양호</option>
                <option value="problematic">문제</option>
              </select>
            </div>
          )}

          {viewMode === 'improvement' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                  개선 상태
                </label>
                <select
                  value={filters.improvementStatus}
                  onChange={(e) => setFilters({ ...filters, improvementStatus: e.target.value })}
                  className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 py-1 px-2 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">전체</option>
                  <option value="improved">개선됨</option>
                  <option value="neglected">방치됨</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                  경과일
                </label>
                <select
                  value={filters.minDays}
                  onChange={(e) => setFilters({ ...filters, minDays: e.target.value })}
                  className="w-full text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 py-1 px-2 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">전체</option>
                  <option value="7">7일+</option>
                  <option value="30">30일+</option>
                  <option value="90">90일+</option>
                </select>
              </div>
            </>
          )}

          <div className="flex items-end">
            <button
              onClick={loadData}
              disabled={loading}
              className="w-full text-xs px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none disabled:opacity-50"
            >
              {loading ? '조회 중...' : '조회'}
            </button>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleExcelDownload}
              disabled={records.length === 0}
              className="w-full text-xs px-2 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none disabled:opacity-50"
            >
              엑셀
            </button>
          </div>
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-white dark:bg-gray-800 rounded shadow p-2">
          <div className="text-xs text-gray-500 dark:text-gray-400">총 점검</div>
          <div className="text-base font-bold text-gray-900 dark:text-gray-100">
            {stats.totalInspections.toLocaleString()}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded shadow p-2">
          <div className="text-xs text-gray-500 dark:text-gray-400">양호</div>
          <div className="text-base font-bold text-green-600 dark:text-green-400">
            {stats.goodCount.toLocaleString()}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded shadow p-2">
          <div className="text-xs text-gray-500 dark:text-gray-400">문제</div>
          <div className="text-base font-bold text-red-600 dark:text-red-400">
            {stats.problematicCount.toLocaleString()}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded shadow p-2">
          <div className="text-xs text-gray-500 dark:text-gray-400">개선율</div>
          <div className="text-base font-bold text-blue-600 dark:text-blue-400">
            {stats.improvementRate}%
          </div>
        </div>
      </div>

      {/* 차트 */}
      <ImprovementCharts
        startDate={filters.startDate}
        endDate={filters.endDate}
      />

      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                  점검일시
                </th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                  장비연번
                </th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                  설치기관
                </th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                  필드명
                </th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                  점검값
                </th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                  기존값
                </th>
                {viewMode !== 'inspection' && (
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                    현재값
                  </th>
                )}
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                  점검시상태
                </th>
                {viewMode !== 'inspection' && (
                  <>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                      개선상태
                    </th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                      경과일
                    </th>
                  </>
                )}
                <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                  점검자
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    로딩 중...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    조회된 데이터가 없습니다
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => {
                      setSelectedRecord(record);
                      setShowDetailModal(true);
                    }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                      {new Date(record.inspection_time).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                      {record.equipment_serial}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                      {record.aed_device.installation_institution}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                      {FIELD_NAME_LABELS[record.field_name] || record.field_name}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                      {record.inspection_value || '-'}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                      {record.aed_data_value || '-'}
                    </td>
                    {viewMode !== 'inspection' && (
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                        {record.current_aed_value || '-'}
                      </td>
                    )}
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        record.status_at_inspection === 'good'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {record.status_at_inspection === 'good' ? '양호' : '문제'}
                      </span>
                    </td>
                    {viewMode !== 'inspection' && (
                      <>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {record.improvement_status ? (
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              record.improvement_status === 'improved'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            }`}>
                              {record.improvement_status === 'improved' ? '개선됨' : '방치됨'}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                          {record.days_since_inspection ? `${record.days_since_inspection}일` : '-'}
                        </td>
                      </>
                    )}
                    <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100">
                      {record.inspection.user_profiles.full_name}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* 상세보기 모달 */}
      <FieldComparisonDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedRecord(null);
        }}
        record={selectedRecord}
      />
    </div>
  );
}
