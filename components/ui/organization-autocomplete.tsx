'use client';

import { useState, useEffect, useRef } from 'react';

interface OrganizationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string, organizationId?: string) => void; // 자동완성에서 선택 시 호출 (ID 포함)
  region?: string;
  organizations?: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function OrganizationAutocomplete({
  value,
  onChange,
  onSelect,
  region,
  organizations = [],
  placeholder = "소속 기관을 입력하세요",
  className = "",
  disabled = false
}: OrganizationAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 지역명과 코드 매핑
  const regionCodeMap: Record<string, string> = {
    '중앙': 'KR',
    '서울특별시': 'SEO',
    '부산광역시': 'BUS',
    '대구광역시': 'DAE',
    '인천광역시': 'INC',
    '광주광역시': 'GWA',
    '대전광역시': 'DAJ',
    '울산광역시': 'ULS',
    '세종특별자치시': 'SEJ',
    '경기도': 'GYE',
    '강원특별자치도': 'GAN',
    '충청북도': 'CHU',
    '충청남도': 'CHN',
    '전북특별자치도': 'JEO',
    '전라남도': 'JEN',
    '경상북도': 'GYB',
    '경상남도': 'GYN',
    '제주특별자치도': 'JEJ'
  };

  // 조직 검색
  const searchOrganizations = async (searchTerm: string) => {
    // 1글자부터 검색 가능하도록 변경 (로컬 필터링인 경우)
    const minLength = organizations && organizations.length > 0 ? 1 : 2;

    if (!searchTerm || searchTerm.length < minLength) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      // organizations prop이 제공되면 그것을 사용
      if (organizations && organizations.length > 0) {
        // 띄어쓰기 제거 버전으로도 검색
        const searchTermNoSpace = searchTerm.replace(/\s/g, '').toLowerCase();

        const filtered = organizations
          .filter(org => {
            const orgLower = org.toLowerCase();
            const orgNoSpace = org.replace(/\s/g, '').toLowerCase();

            // 원본 검색어로 매칭 또는 띄어쓰기 제거 버전으로 매칭
            return orgLower.includes(searchTerm.toLowerCase()) ||
                   orgNoSpace.includes(searchTermNoSpace);
          })
          .slice(0, 10)
          .map((org, index) => ({
            id: `local-${index}`,
            name: org,
            type: org.includes('보건소') ? 'health_center' :
                  org.includes('응급의료') ? 'emergency_center' :
                  org.includes('보건복지부') ? 'government' :
                  org.includes('시') || org.includes('도') ? 'regional_office' : 'other'
          }));

        setSuggestions(filtered);
        // 검색 결과가 없어도 드롭다운을 열어두어야 "검색 결과 없음" 안내를 표시할 수 있음
        setShowSuggestions(true);
        setSelectedIndex(-1);
        setLoading(false); // 로컬 검색 시 loading 상태 해제
        return;
      }

      // organizations가 없으면 API에서 검색
      const params = new URLSearchParams({
        search: searchTerm,
        limit: '10'
      });

      // 지역 필터링
      if (region) {
        const regionCode = regionCodeMap[region];
        if (regionCode) {
          params.append('region_code', regionCode);
        }
      }

      const response = await fetch(`/api/organizations/search?${params.toString()}`);

      if (!response.ok) {
        console.error('Error searching organizations:', response.statusText);
        return;
      }

      const data = await response.json();
      setSuggestions(data.organizations || []);
      setShowSuggestions(true);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 입력값 변경 처리
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);

    // 디바운싱을 위한 타이머
    const timer = setTimeout(() => {
      searchOrganizations(newValue);
    }, 300);

    return () => clearTimeout(timer);
  };

  // 제안 항목 선택
  const handleSelectSuggestion = (suggestion: { id: string; name: string }) => {
    console.log('[DEBUG] 자동완성 선택:', {
      id: suggestion.id,
      name: suggestion.name,
      hasSpaces: suggestion.name.includes(' ')
    });
    setInputValue(suggestion.name);
    onChange(suggestion.name);

    // onSelect 콜백이 있으면 ID도 함께 전달
    if (onSelect) {
      onSelect(suggestion.name, suggestion.id);
    }

    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  };

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // value prop 변경 시 inputValue 업데이트
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const getOrganizationTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      'ministry': '부처',
      'emergency_center': '응급센터',
      'province': '시도',
      'city': '시군구',
      'health_center': '보건소'
    };
    return typeLabels[type] || type;
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) {
            setShowSuggestions(true);
          }
        }}
        placeholder={placeholder}
        className={`w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-green-500 focus:outline-none ${className}`}
        disabled={disabled}
      />

      {/* 로딩 인디케이터 */}
      {loading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* 제안 목록 */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              className={`w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors flex items-center justify-between ${
                index === selectedIndex ? 'bg-gray-700' : ''
              }`}
              onClick={() => handleSelectSuggestion(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="text-white">{suggestion.name}</span>
              <span className="text-xs text-gray-400">
                {getOrganizationTypeLabel(suggestion.type)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 검색 결과 없음 */}
      {showSuggestions && !loading && suggestions.length === 0 && inputValue.length >= (organizations && organizations.length > 0 ? 1 : 2) && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4">
          <p className="text-gray-400 text-sm text-center">
            검색 결과가 없습니다. 직접 입력해주세요.
          </p>
        </div>
      )}
    </div>
  );
}