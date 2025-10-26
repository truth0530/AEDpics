'use client';

import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ArrowUpDown, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { getRegionSortOrder } from '@/lib/constants/regions';

interface RegionStats {
  region: string;
  total: number;
  mandatory: number;
  nonMandatory: number;
  completed: number;
  completedMandatory: number;
  completedNonMandatory: number;
  assigned: number;
  assignedMandatory: number;
  assignedNonMandatory: number;
  fieldInspected: number;
  fieldInspectedMandatory: number;
  fieldInspectedNonMandatory: number;
  rate: number;
  blocked: number;
  blockedMandatory: number;
  blockedNonMandatory: number;
  uninspected: number;
  uninspectedMandatory: number;
  uninspectedNonMandatory: number;
}

interface RegionStatsTableProps {
  data: RegionStats[];
}

type SortField = 'region' | 'total' | 'rate' | 'assigned' | 'fieldInspected';
type SortDirection = 'asc' | 'desc';

export default function RegionStatsTable({ data }: RegionStatsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('region');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [isAllExpanded, setIsAllExpanded] = useState(false);

  // 검색 및 정렬
  const filteredAndSortedData = useMemo(() => {
    const filtered = data.filter((region) =>
      region.region.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'region':
          // Use centralized region order from REGIONS array
          comparison = getRegionSortOrder(a.region) - getRegionSortOrder(b.region);
          break;
        case 'total':
          comparison = a.total - b.total;
          break;
        case 'rate':
          comparison = a.rate - b.rate;
          break;
        case 'assigned':
          comparison = a.assigned - b.assigned;
          break;
        case 'fieldInspected':
          comparison = a.fieldInspected - b.fieldInspected;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [data, searchTerm, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleRegion = (regionName: string) => {
    const newExpanded = new Set(expandedRegions);
    if (newExpanded.has(regionName)) {
      newExpanded.delete(regionName);
    } else {
      newExpanded.add(regionName);
    }
    setExpandedRegions(newExpanded);
  };

  const toggleAllRegions = () => {
    if (isAllExpanded) {
      setExpandedRegions(new Set());
      setIsAllExpanded(false);
    } else {
      const allRegionNames = new Set(filteredAndSortedData.map(r => r.region));
      setExpandedRegions(allRegionNames);
      setIsAllExpanded(true);
    }
  };

  const getStatusColor = (rate: number) => {
    if (rate >= 80) return 'text-green-400';
    if (rate >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusIndicator = (rate: number) => {
    if (rate >= 80) return '🟢';
    if (rate >= 60) return '🟡';
    return '🔴';
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatFullNumber = (num: number) => {
    return num.toLocaleString('ko-KR');
  };

  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  const handleDownloadCSV = () => {
    const headers = ['지역', '전체', '점검률', '일정추가', '현장점검'];
    const rows = filteredAndSortedData.map((region) => [
      region.region,
      region.total,
      `${region.rate}%`,
      region.assigned,
      region.fieldInspected,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `시도별_통계_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* 검색 및 필터 바 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="지역 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-900 border-gray-800 text-white"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleAllRegions}
          className="bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800"
        >
          {isAllExpanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-2" />
              전체 접기
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-2" />
              전체 펼치기
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadCSV}
          className="bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800"
        >
          <Download className="h-4 w-4 mr-2" />
          CSV 다운로드
        </Button>
      </div>

      {/* 통계 요약 */}
      <div className="text-sm text-gray-400">
        총 {filteredAndSortedData.length}개 지역 표시
      </div>

      {/* 아코디언 테이블 */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <span className="text-xs font-medium text-gray-300"></span>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('region')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-300 hover:text-white"
                  >
                    지역
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('total')}
                    className="flex items-center gap-1 ml-auto text-xs font-medium text-gray-300 hover:text-white"
                  >
                    전체
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('rate')}
                    className="flex items-center gap-1 ml-auto text-xs font-medium text-gray-300 hover:text-white"
                  >
                    점검률
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('assigned')}
                    className="flex items-center gap-1 ml-auto text-xs font-medium text-gray-300 hover:text-white"
                  >
                    일정추가
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('fieldInspected')}
                    className="flex items-center gap-1 ml-auto text-xs font-medium text-gray-300 hover:text-white"
                  >
                    현장점검
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-center">
                  <span className="text-xs font-medium text-gray-300">진척률</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredAndSortedData.map((region) => (
                <React.Fragment key={region.region}>
                  {/* 요약 행 */}
                  <tr
                    className="hover:bg-gray-800/50 transition-colors cursor-pointer"
                    onClick={() => toggleRegion(region.region)}
                  >
                    <td className="px-4 py-3 text-center">
                      {expandedRegions.has(region.region) ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getStatusIndicator(region.rate)}</span>
                        <span className="text-sm font-medium text-white">
                          {region.region}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-gray-300">
                        {formatNumber(region.total)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-semibold ${getStatusColor(region.rate)}`}>
                        {region.rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-orange-400">
                        {region.assigned}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-green-400">
                        {region.fieldInspected}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-gray-800 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              region.rate >= 80
                                ? 'bg-green-500'
                                : region.rate >= 60
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(region.rate, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* 상세 정보 행 (확장 시) */}
                  {expandedRegions.has(region.region) && (
                    <tr className="bg-gray-800/30">
                      <td colSpan={7} className="px-4 py-6">
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                          {/* 1. 전체 AED */}
                          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                            <h3 className="text-sm font-medium text-gray-300 mb-4">전체 AED</h3>

                            <div className="space-y-2.5">
                              {/* 관리자점검 */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                                      <span className="text-[10px] font-bold text-purple-400">1</span>
                                    </div>
                                    <span className="text-xs text-gray-400">관리자점검</span>
                                  </div>
                                  <span className="text-sm font-semibold text-purple-400">
                                    {formatFullNumber(region.completed)}/{formatFullNumber(region.total)}
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({getPercentage(region.completed, region.total)}%)
                                    </span>
                                  </span>
                                </div>
                                <div className="w-full bg-blue-500 rounded-full h-1.5">
                                  <div
                                    className="bg-purple-500 h-1.5 rounded-full"
                                    style={{width: `${getPercentage(region.completed, region.total)}%`}}
                                  />
                                </div>
                              </div>

                              {/* 일정추가 */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                                      <span className="text-[10px] font-bold text-orange-400">2</span>
                                    </div>
                                    <span className="text-xs text-gray-400">일정추가</span>
                                  </div>
                                  <span className="text-sm font-semibold text-orange-400">
                                    {formatFullNumber(region.assigned)}대
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({getPercentage(region.assigned, region.total)}%)
                                    </span>
                                  </span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-1.5">
                                  <div
                                    className="bg-orange-500 h-1.5 rounded-full"
                                    style={{width: `${getPercentage(region.assigned, region.total)}%`}}
                                  />
                                </div>
                              </div>

                              {/* 현장점검 */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                                      <span className="text-[10px] font-bold text-green-400">3</span>
                                    </div>
                                    <span className="text-xs text-gray-400">현장점검</span>
                                  </div>
                                  <span className="text-sm font-semibold text-green-400">
                                    {formatFullNumber(region.fieldInspected)}대
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({getPercentage(region.fieldInspected, region.total)}%)
                                    </span>
                                  </span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-1.5">
                                  <div
                                    className="bg-green-500 h-1.5 rounded-full"
                                    style={{width: `${getPercentage(region.fieldInspected, region.total)}%`}}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 2. 구비의무기관 */}
                          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                            <h3 className="text-sm font-medium text-gray-300 mb-4">구비의무기관</h3>

                            <div className="space-y-2.5">
                              {/* 관리자점검 */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                                      <span className="text-[10px] font-bold text-purple-400">1</span>
                                    </div>
                                    <span className="text-xs text-gray-400">관리자점검</span>
                                  </div>
                                  <span className="text-sm font-semibold text-purple-400">
                                    {formatFullNumber(region.completedMandatory)}/{formatFullNumber(region.mandatory)}
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({getPercentage(region.completedMandatory, region.mandatory)}%)
                                    </span>
                                  </span>
                                </div>
                                <div className="w-full bg-blue-500 rounded-full h-1.5">
                                  <div
                                    className="bg-purple-500 h-1.5 rounded-full"
                                    style={{width: `${getPercentage(region.completedMandatory, region.mandatory)}%`}}
                                  />
                                </div>
                              </div>

                              {/* 일정추가 */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                                      <span className="text-[10px] font-bold text-orange-400">2</span>
                                    </div>
                                    <span className="text-xs text-gray-400">일정추가</span>
                                  </div>
                                  <span className="text-sm font-semibold text-orange-400">
                                    {formatFullNumber(region.assignedMandatory)}대
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({getPercentage(region.assignedMandatory, region.mandatory)}%)
                                    </span>
                                  </span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-1.5">
                                  <div
                                    className="bg-orange-500 h-1.5 rounded-full"
                                    style={{width: `${getPercentage(region.assignedMandatory, region.mandatory)}%`}}
                                  />
                                </div>
                              </div>

                              {/* 현장점검 */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                                      <span className="text-[10px] font-bold text-green-400">3</span>
                                    </div>
                                    <span className="text-xs text-gray-400">현장점검</span>
                                  </div>
                                  <span className="text-sm font-semibold text-green-400">
                                    {formatFullNumber(region.fieldInspectedMandatory)}대
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({getPercentage(region.fieldInspectedMandatory, region.mandatory)}%)
                                    </span>
                                  </span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-1.5">
                                  <div
                                    className="bg-green-500 h-1.5 rounded-full"
                                    style={{width: `${getPercentage(region.fieldInspectedMandatory, region.mandatory)}%`}}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 3. 구비의무기관 외 */}
                          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                            <h3 className="text-sm font-medium text-gray-300 mb-4">구비의무기관 외</h3>

                            <div className="space-y-2.5">
                              {/* 관리자점검 */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                                      <span className="text-[10px] font-bold text-purple-400">1</span>
                                    </div>
                                    <span className="text-xs text-gray-400">관리자점검</span>
                                  </div>
                                  <span className="text-sm font-semibold text-purple-400">
                                    {formatFullNumber(region.completedNonMandatory)}/{formatFullNumber(region.nonMandatory)}
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({getPercentage(region.completedNonMandatory, region.nonMandatory)}%)
                                    </span>
                                  </span>
                                </div>
                                <div className="w-full bg-blue-500 rounded-full h-1.5">
                                  <div
                                    className="bg-purple-500 h-1.5 rounded-full"
                                    style={{width: `${getPercentage(region.completedNonMandatory, region.nonMandatory)}%`}}
                                  />
                                </div>
                              </div>

                              {/* 일정추가 */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                                      <span className="text-[10px] font-bold text-orange-400">2</span>
                                    </div>
                                    <span className="text-xs text-gray-400">일정추가</span>
                                  </div>
                                  <span className="text-sm font-semibold text-orange-400">
                                    {formatFullNumber(region.assignedNonMandatory)}대
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({getPercentage(region.assignedNonMandatory, region.nonMandatory)}%)
                                    </span>
                                  </span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-1.5">
                                  <div
                                    className="bg-orange-500 h-1.5 rounded-full"
                                    style={{width: `${getPercentage(region.assignedNonMandatory, region.nonMandatory)}%`}}
                                  />
                                </div>
                              </div>

                              {/* 현장점검 */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                                      <span className="text-[10px] font-bold text-green-400">3</span>
                                    </div>
                                    <span className="text-xs text-gray-400">현장점검</span>
                                  </div>
                                  <span className="text-sm font-semibold text-green-400">
                                    {formatFullNumber(region.fieldInspectedNonMandatory)}대
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({getPercentage(region.fieldInspectedNonMandatory, region.nonMandatory)}%)
                                    </span>
                                  </span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-1.5">
                                  <div
                                    className="bg-green-500 h-1.5 rounded-full"
                                    style={{width: `${getPercentage(region.fieldInspectedNonMandatory, region.nonMandatory)}%`}}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 4. 외부표출 차단 */}
                          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                            <h3 className="text-sm font-medium text-gray-300 mb-4">외부표출 차단</h3>

                            <div className="space-y-2.5">
                              {/* 전체 차단 */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-400">전체</span>
                                  <span className="text-sm font-semibold text-red-400">
                                    {formatFullNumber(region.blocked)}대
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({getPercentage(region.blocked, region.total)}%)
                                    </span>
                                  </span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-1.5">
                                  <div
                                    className="bg-red-500 h-1.5 rounded-full"
                                    style={{width: `${getPercentage(region.blocked, region.total)}%`}}
                                  />
                                </div>
                              </div>

                              {/* 구비의무 */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-400">구비의무</span>
                                  <span className="text-sm font-semibold text-red-400">
                                    {formatFullNumber(region.blockedMandatory)}대
                                  </span>
                                </div>
                              </div>

                              {/* 의무 외 */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-400">의무 외</span>
                                  <span className="text-sm font-semibold text-red-400">
                                    {formatFullNumber(region.blockedNonMandatory)}대
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 5. 미점검 장비 */}
                          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                            <h3 className="text-sm font-medium text-gray-300 mb-4">미점검 장비</h3>

                            <div className="space-y-2.5">
                              {/* 전체 미점검 */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-400">전체</span>
                                  <span className="text-sm font-semibold text-yellow-400">
                                    {formatFullNumber(region.uninspected)}대
                                    <span className="text-xs text-gray-500 ml-1">
                                      ({getPercentage(region.uninspected, region.total)}%)
                                    </span>
                                  </span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-1.5">
                                  <div
                                    className="bg-yellow-500 h-1.5 rounded-full"
                                    style={{width: `${getPercentage(region.uninspected, region.total)}%`}}
                                  />
                                </div>
                              </div>

                              {/* 구비의무 */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-400">구비의무</span>
                                  <span className="text-sm font-semibold text-yellow-400">
                                    {formatFullNumber(region.uninspectedMandatory)}대
                                  </span>
                                </div>
                              </div>

                              {/* 의무 외 */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-400">의무 외</span>
                                  <span className="text-sm font-semibold text-yellow-400">
                                    {formatFullNumber(region.uninspectedNonMandatory)}대
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 빈 결과 메시지 */}
      {filteredAndSortedData.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  );
}
