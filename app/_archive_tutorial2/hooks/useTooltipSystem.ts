'use client';

import { useState, useCallback } from 'react';

export const useTooltipSystem = () => {
  // 툴팁 상태
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoverTimer, setHoverTimer] = useState<NodeJS.Timeout | null>(null);

  // 툴팁 타이머 클리어 함수
  const clearHoverTimer = useCallback(() => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      setHoverTimer(null);
    }
  }, [hoverTimer]);

  // 툴팁 컨텐츠 가져오기
  const getTooltipContent = useCallback((itemKey: string): string => {
    const tooltips: {[key: string]: string} = {
      'batteryExpiry': '배터리 제조일자만 표기된 경우 제조사 권고 확인필요, 보통 제조일로 부터 2~5년',
      'padExpiry': '패드의 Exp. date를 확인하세요.',
      'externalDisplay': '외부 지도 서비스에 AED 위치를 표시할지 설정합니다.',
      'operationStatus': 'AED의 현재 작동 상태를 확인합니다.',
      'batteryStatus': '전원을 켜 정상작동 하는지? 배터리가 부족하다는 멘트가 나오는지? LED 표시등을 확인하세요.',
      'installMethod': 'AED가 설치된 방식을 확인합니다.',
      'storageStatus': '보관함의 각종 안전장치와 안내사항을 상세히 점검합니다. 도난경보장치, 안내문구, 연락망 등을 확인하세요.',
      'operatingHours': 'AED에 접근 가능한 시간을 관리책임자를 통해 확인해주세요.',
      'signageLocation': '안내 표지가 설치된 위치를 확인합니다.'
    };
    return tooltips[itemKey] || '이 항목을 정확히 확인해주세요.';
  }, []);

  // 툴팁 표시 함수
  const showTooltip = useCallback((itemKey: string, message: string) => {
    clearHoverTimer();
    setActiveTooltip(`${itemKey}:${message}`);
    const timer = setTimeout(() => {
      setActiveTooltip(null);
    }, 5000);
    setHoverTimer(timer);
  }, [clearHoverTimer]);

  // 아이템 hover 핸들러
  const handleItemHover = useCallback((itemKey: string) => {
    if (hoveredItem !== itemKey) {
      setHoveredItem(itemKey);
      clearHoverTimer();
      const timer = setTimeout(() => {
        showTooltip(itemKey, getTooltipContent(itemKey));
      }, 3000);
      setHoverTimer(timer);
    }
  }, [hoveredItem, clearHoverTimer, showTooltip, getTooltipContent]);

  // 아이템 hover 종료 핸들러
  const handleItemLeave = useCallback(() => {
    clearHoverTimer();
    setHoveredItem(null);
  }, [clearHoverTimer]);

  return {
    // 상태
    activeTooltip,
    setActiveTooltip,
    hoveredItem,
    setHoveredItem,
    
    // 함수
    getTooltipContent,
    showTooltip,
    handleItemHover,
    handleItemLeave,
    clearHoverTimer
  };
};