'use client';

import React, { useState, useCallback, useEffect } from 'react';

export interface QuickFilter {
  label: string;
  value: string;
  count?: number;
  color?: 'red' | 'yellow' | 'green' | 'blue' | 'gray';
  icon?: React.ReactNode;
}

export interface SmartSearchProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  onFilterSelect?: (filter: QuickFilter) => void;
  quickFilters?: QuickFilter[];
  recentSearches?: string[];
  showRecentSearches?: boolean;
  autoFocus?: boolean;
  debounceMs?: number;
  className?: string;
}

const SmartSearch: React.FC<SmartSearchProps> = ({
  placeholder = "검색어를 입력하세요...",
  onSearch,
  onFilterSelect,
  quickFilters = [],
  recentSearches = [],
  showRecentSearches = false,
  autoFocus = false,
  debounceMs = 300,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        onSearch(searchQuery);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs, onSearch]);

  const handleFilterClick = useCallback((filter: QuickFilter) => {
    setActiveFilter(filter.value);
    if (onFilterSelect) {
      onFilterSelect(filter);
    }
  }, [onFilterSelect]);

  const handleRecentSearchClick = useCallback((search: string) => {
    setSearchQuery(search);
    onSearch(search);
  }, [onSearch]);

  const handleClear = useCallback(() => {
    setSearchQuery('');
    setActiveFilter(null);
    onSearch('');
  }, [onSearch]);

  const filterColors = {
    red: 'bg-red-600 hover:bg-red-700 text-white border-red-500',
    yellow: 'bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-500',
    green: 'bg-green-600 hover:bg-green-700 text-white border-green-500',
    blue: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500',
    gray: 'bg-gray-600 hover:bg-gray-700 text-white border-gray-500'
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className={`
          relative rounded-2xl border-2 transition-all duration-200
          ${isFocused ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-gray-600'}
          bg-gray-800/90 backdrop-blur-sm
        `}>
          {/* Search Icon */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Input Field */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="
              w-full bg-transparent text-white
              px-12 py-3 sm:py-4
              text-base sm:text-lg
              focus:outline-none
              placeholder:text-gray-500
            "
          />

          {/* Clear Button */}
          {searchQuery && (
            <button
              onClick={handleClear}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              type="button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search Suggestions (when focused) */}
        {isFocused && showRecentSearches && recentSearches.length > 0 && !searchQuery && (
          <div className="absolute top-full left-0 right-0 mt-2 z-10">
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl p-2">
              <p className="text-xs text-gray-500 px-3 py-1">최근 검색</p>
              {recentSearches.slice(0, 5).map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleRecentSearchClick(search)}
                  className="
                    w-full text-left px-3 py-2 text-sm text-gray-300
                    hover:bg-gray-700 rounded-lg transition-colors
                    flex items-center gap-2
                  "
                  type="button"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {search}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Filters */}
      {quickFilters.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-400 mb-2">빠른 필터</p>
          <div className="flex gap-2 flex-wrap">
            {quickFilters.map((filter, index) => {
              const isActive = activeFilter === filter.value;
              const colorClass = filter.color ? filterColors[filter.color] : 'bg-gray-700 hover:bg-gray-600 text-white border-gray-600';

              return (
                <button
                  key={index}
                  onClick={() => handleFilterClick(filter)}
                  className={`
                    px-4 py-2 rounded-full text-sm font-medium
                    transition-all duration-200 transform hover:scale-105
                    border flex items-center gap-2
                    ${isActive ? `${colorClass} ring-2 ring-white/30` : colorClass}
                  `}
                  type="button"
                >
                  {filter.icon && (
                    <span className="flex-shrink-0">{filter.icon}</span>
                  )}
                  <span>{filter.label}</span>
                  {filter.count !== undefined && (
                    <span className={`
                      px-2 py-0.5 rounded-full text-xs font-bold
                      ${isActive ? 'bg-white/20' : 'bg-black/20'}
                    `}>
                      {filter.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Search Indicator */}
      {(searchQuery || activeFilter) && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">검색 중:</span>
          {searchQuery && (
            <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded-lg">
              &quot;{searchQuery}&quot;
            </span>
          )}
          {activeFilter && (
            <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded-lg">
              필터: {quickFilters.find(f => f.value === activeFilter)?.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartSearch;