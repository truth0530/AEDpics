/**
 * VirtualizedDeviceList Component
 * 대용량 AED 장비 목록을 효율적으로 렌더링하기 위한 가상화 리스트
 *
 * 81,331개 장비를 브라우저 크래시 없이 처리
 */

'use client';

import React, { useCallback, useMemo } from 'react';
// @ts-expect-error - react-window types issue
import { FixedSizeList } from 'react-window';
const List = FixedSizeList;
import InfiniteLoader from 'react-window-infinite-loader';
import type { ProductionAEDData } from '../types/ProductionAEDTypes';

interface VirtualizedDeviceListProps {
  devices: ProductionAEDData[];
  onSelectDevice: (device: ProductionAEDData) => void;
  selectedDeviceId?: string;
  height?: number;
  itemHeight?: number;
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean;
  isLoading?: boolean;
}

/**
 * 개별 장비 아이템 렌더러
 */
const DeviceRow = React.memo(({
  index,
  style,
  data
}: {
  index: number;
  style: React.CSSProperties;
  data: {
    devices: ProductionAEDData[];
    onSelectDevice: (device: ProductionAEDData) => void;
    selectedDeviceId?: string;
  };
}) => {
  const device = data.devices[index];
  const isSelected = device?.equipment_serial === data.selectedDeviceId;

  if (!device) {
    return (
      <div style={style} className="flex items-center px-4 py-2 border-b border-gray-700">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  // 우선순위 색상
  const getPriorityColor = (priority: string | undefined) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  // 남은 일수 계산
  const calculateDaysRemaining = (dateStr: string) => {
    const today = new Date();
    const targetDate = new Date(dateStr);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const batteryDays = calculateDaysRemaining(device.battery_expiry_date);
  const padDays = calculateDaysRemaining(device.patch_expiry_date);

  return (
    <div
      style={style}
      className={`flex items-center px-4 py-2 border-b border-gray-700 cursor-pointer transition-colors hover:bg-gray-800 ${
        isSelected ? 'bg-gray-800 border-l-4 border-green-500' : ''
      }`}
      onClick={() => data.onSelectDevice(device)}
    >
      {/* 우선순위 인디케이터 */}
      <div className={`w-2 h-8 ${getPriorityColor(device.riskLevel)} rounded mr-3`}></div>

      {/* 메인 정보 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium truncate">
            {device.installation_institution}
          </span>
          <span className="text-xs text-gray-400">
            {device.management_number}
          </span>
        </div>

        <div className="flex items-center gap-4 mt-1">
          <span className="text-xs text-gray-400 truncate">
            {device.installation_position}
          </span>
          <span className="text-xs text-gray-500">
            {device.model_name}
          </span>
        </div>
      </div>

      {/* 만료 정보 */}
      <div className="flex flex-col items-end ml-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">배터리</span>
          <span className={`text-xs font-medium ${
            batteryDays <= 0 ? 'text-red-400' :
            batteryDays <= 30 ? 'text-yellow-400' :
            'text-green-400'
          }`}>
            {batteryDays > 0 ? `${batteryDays}일` : '만료'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">패드</span>
          <span className={`text-xs font-medium ${
            padDays <= 0 ? 'text-red-400' :
            padDays <= 30 ? 'text-yellow-400' :
            'text-green-400'
          }`}>
            {padDays > 0 ? `${padDays}일` : '만료'}
          </span>
        </div>
      </div>
    </div>
  );
});

DeviceRow.displayName = 'DeviceRow';

/**
 * 가상화된 장비 목록 컴포넌트
 */
export const VirtualizedDeviceList: React.FC<VirtualizedDeviceListProps> = ({
  devices,
  onSelectDevice,
  selectedDeviceId,
  height = 600,
  itemHeight = 80,
  onLoadMore,
  hasMore = false,
  isLoading = false,
}) => {
  // 무한 스크롤 설정
  const itemCount = hasMore ? devices.length + 1 : devices.length;

  const isItemLoaded = useCallback(
    (index: number) => !hasMore || index < devices.length,
    [devices.length, hasMore]
  );

  const loadMoreItems = useCallback(
    async () => {
      if (onLoadMore && !isLoading) {
        await onLoadMore();
      }
    },
    [onLoadMore, isLoading]
  );

  // 리스트 데이터
  const itemData = useMemo(
    () => ({
      devices,
      onSelectDevice,
      selectedDeviceId,
    }),
    [devices, onSelectDevice, selectedDeviceId]
  );

  if (devices.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p>검색 결과가 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      {hasMore && onLoadMore ? (
        <InfiniteLoader
          isItemLoaded={isItemLoaded}
          itemCount={itemCount}
          loadMoreItems={loadMoreItems}
        >
          {({ onItemsRendered, ref }) => (
            <List
              ref={ref}
              height={height}
              itemCount={itemCount}
              itemSize={itemHeight}
              itemData={itemData}
              onItemsRendered={onItemsRendered}
              className="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
            >
              {DeviceRow}
            </List>
          )}
        </InfiniteLoader>
      ) : (
        <List
          height={height}
          itemCount={devices.length}
          itemSize={itemHeight}
          itemData={itemData}
          className="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
        >
          {DeviceRow}
        </List>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-4 border-t border-gray-700">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
          <span className="ml-2 text-sm text-gray-400">데이터 로딩 중...</span>
        </div>
      )}
    </div>
  );
};

/**
 * 성능 최적화된 검색 입력 컴포넌트
 */
export const OptimizedSearchInput: React.FC<{
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}> = ({
  value,
  onChange,
  placeholder = "장비명, 위치, 모델명으로 검색...",
  debounceMs = 300
}) => {
  const [localValue, setLocalValue] = React.useState<string>(value || '');
  const timeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  React.useEffect(() => {
    if (value !== undefined) {
      setLocalValue(value);
    }
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // 디바운싱
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  }, [onChange, debounceMs]);

  return (
    <div className="relative">
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full bg-gray-800 text-white px-4 py-2 pl-10 rounded-lg border border-gray-700 focus:border-green-500 focus:outline-none"
      />
      <svg
        className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>
  );
};

/**
 * 필터 칩 컴포넌트
 */
export const FilterChip: React.FC<{
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  color?: 'red' | 'yellow' | 'green' | 'gray';
}> = ({
  label,
  count,
  active = false,
  onClick,
  color = 'gray'
}) => {
  const colorClasses = {
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    gray: 'bg-gray-700 text-gray-300 border-gray-600',
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
        active
          ? colorClasses[color]
          : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className="ml-1 opacity-70">({count})</span>
      )}
    </button>
  );
};

export default VirtualizedDeviceList;