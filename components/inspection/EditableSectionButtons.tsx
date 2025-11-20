'use client';

import {
  getLeftButtonConfig,
  getRightButtonConfig,
  CHECK_ICON_PATH,
  EDIT_ICON_PATH,
} from '@/lib/constants/inspection-ui';

interface EditableSectionButtonsProps {
  // 현재 상태
  isEditMode: boolean;
  isMatching: boolean;
  matchedState: boolean | 'edited' | undefined;

  // 이벤트 핸들러
  onLeftClick: () => void;
  onRightClick: () => void;

  // 커스텀 텍스트 (선택사항)
  matchText?: string;
  matchedText?: string;

  // 버튼 크기 (선택사항)
  size?: 'sm' | 'md';
}

export function EditableSectionButtons({
  isEditMode,
  isMatching,
  matchedState,
  onLeftClick,
  onRightClick,
  matchText = '전체 일치',
  matchedText = '전체 일치 확인됨',
  size = 'md',
}: EditableSectionButtonsProps) {
  const leftConfig = getLeftButtonConfig({ isEditMode, isMatching, matchedState });
  const rightConfig = getRightButtonConfig({
    isEditMode,
    isMatching,
    matchedState,
    matchText,
    matchedText,
  });

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-xs';
  const padding = size === 'sm' ? 'px-3 py-1.5' : 'px-3 py-1.5';

  return (
    <div className="flex gap-2 max-w-[60%] mx-auto">
      {/* 좌측 버튼: 수정/취소/수정됨 */}
      <button
        type="button"
        onClick={onLeftClick}
        disabled={leftConfig.disabled}
        className={`flex-1 ${padding} rounded-lg ${textSize} font-medium transition-all whitespace-nowrap ${leftConfig.className}`}
      >
        {leftConfig.showIcon && leftConfig.iconType === 'edit' ? (
          <span className="flex items-center justify-center gap-1">
            <svg className={iconSize} fill="currentColor" viewBox="0 0 20 20">
              <path d={EDIT_ICON_PATH} />
            </svg>
            {leftConfig.text}
          </span>
        ) : (
          leftConfig.text
        )}
      </button>

      {/* 우측 버튼: 확인/일치/수정 저장 */}
      <button
        type="button"
        onClick={onRightClick}
        disabled={rightConfig.disabled}
        className={`flex-1 ${padding} rounded-lg ${textSize} font-medium transition-all whitespace-nowrap ${rightConfig.className}`}
      >
        {rightConfig.showIcon ? (
          <span className="flex items-center justify-center gap-1">
            <svg className={iconSize} fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d={rightConfig.iconType === 'check' ? CHECK_ICON_PATH : EDIT_ICON_PATH}
                clipRule="evenodd"
              />
            </svg>
            {rightConfig.text}
          </span>
        ) : (
          rightConfig.text
        )}
      </button>
    </div>
  );
}
