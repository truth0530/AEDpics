'use client';

import { useState } from 'react';
import { getRegionCode } from '@/lib/constants/regions';

interface MobileFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedRegion: string;
  setSelectedRegion: (region: string) => void;
  selectedOrganization: string;
  setSelectedOrganization: (org: string) => void;
  approvalFilter: 'all' | 'pending' | 'approved';
  setApprovalFilter: (filter: 'all' | 'pending' | 'approved') => void;
  regions: string[];
  organizations: Array<{ id: string; name: string; region_code: string; }>;
  pendingCount: number;
}

export function MobileFilters({
  searchQuery,
  setSearchQuery,
  selectedRegion,
  setSelectedRegion,
  selectedOrganization,
  setSelectedOrganization,
  approvalFilter,
  setApprovalFilter,
  regions,
  organizations,
  pendingCount
}: MobileFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-4">
      {/* 검색바와 필터 토글 */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="이름, 이메일, 연락처 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-400 focus:border-green-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
            showFilters
              ? 'bg-green-500 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
          </svg>
          필터
        </button>
      </div>

      {/* 승인 상태 버튼 (항상 표시) */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setApprovalFilter('all')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            approvalFilter === 'all'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setApprovalFilter('pending')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
            approvalFilter === 'pending'
              ? 'bg-yellow-500 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          승인대기
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setApprovalFilter('approved')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            approvalFilter === 'approved'
              ? 'bg-green-500 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          승인완료
        </button>
      </div>

      {/* 상세 필터 (토글) */}
      {showFilters && (
        <div className="space-y-3 pt-3 border-t border-gray-700">
          {/* 지역 필터 */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">지역</label>
            <select
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setSelectedOrganization(''); // 지역 변경 시 소속기관 초기화
              }}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-green-500 focus:outline-none"
            >
              <option value="">전체 지역</option>
              {regions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>

          {/* 소속기관 필터 */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">소속기관</label>
            <select
              value={selectedOrganization}
              onChange={(e) => setSelectedOrganization(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-green-500 focus:outline-none"
            >
              <option value="">전체 기관</option>
              {(selectedRegion
                ? organizations.filter(org => {
                    const targetRegionCode = getRegionCode(selectedRegion);
                    const orgRegionCode = getRegionCode(org.region_code);
                    return orgRegionCode.startsWith(targetRegionCode);
                  })
                : organizations).map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>

          {/* 필터 초기화 버튼 */}
          <button
            onClick={() => {
              setSelectedRegion('');
              setSelectedOrganization('');
              setSearchQuery('');
              setApprovalFilter('all');
            }}
            className="w-full px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
          >
            모든 필터 초기화
          </button>
        </div>
      )}
    </div>
  );
}
