/**
 * 점검 UI 통합 상수 및 스타일 정의
 *
 * 모든 점검 섹션의 버튼, 색상, 텍스트를 일관되게 관리합니다.
 */

// 섹션 상태 타입
export type SectionState = 'initial' | 'matched' | 'edited';

// 버튼 스타일 상수
export const BUTTON_STYLES = {
  // 확인됨 상태 (녹색)
  confirmed: 'bg-green-600/30 border-2 border-green-500 text-green-200 cursor-default shadow-lg shadow-green-500/20',
  // 수정 저장 버튼 (노란색)
  save: 'bg-yellow-600 hover:bg-yellow-700 border-2 border-yellow-500 text-white shadow-lg shadow-yellow-500/20',
  // 기본 활성 버튼 (회색)
  default: 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600',
  // 비활성 버튼
  disabled: 'bg-gray-800/50 border border-gray-700/50 text-gray-600 cursor-not-allowed',
  // 취소 버튼
  cancel: 'bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300',
} as const;

// 버튼 텍스트 상수
export const BUTTON_TEXTS = {
  // 좌측 버튼 텍스트
  left: {
    edit: '수정',
    cancel: '취소',
    edited: '수정됨',
    sameAsOriginal: '원본과 동일',
  },
  // 우측 버튼 텍스트
  right: {
    match: '전체 일치',
    matchLocation: '일치',
    confirm: '확인',
    save: '수정 저장',
    matched: '전체 일치 확인됨',
    matchedLocation: '일치 확인됨',
    changeToMatch: '일치로 변경',
    sameAsOriginal: '원본과 동일',
  },
} as const;

// 체크 아이콘 SVG path
export const CHECK_ICON_PATH = 'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z';

// 편집 아이콘 SVG path
export const EDIT_ICON_PATH = 'M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z';

/**
 * 버튼 상태 계산 헬퍼 함수
 */
export interface ButtonStateConfig {
  isEditMode: boolean;
  isMatching: boolean;
  matchedState: boolean | 'edited' | undefined;
}

/**
 * 좌측 버튼 (수정/취소) 설정 계산
 */
export function getLeftButtonConfig(config: ButtonStateConfig) {
  const { isEditMode, isMatching, matchedState } = config;

  // 수정 모드일 때
  if (isEditMode) {
    return {
      text: BUTTON_TEXTS.left.cancel,
      disabled: false,
      className: BUTTON_STYLES.cancel,
    };
  }

  // 수정됨 상태
  if (matchedState === 'edited') {
    if (isMatching) {
      return {
        text: BUTTON_TEXTS.left.sameAsOriginal,
        disabled: true,
        className: BUTTON_STYLES.disabled,
      };
    }
    return {
      text: BUTTON_TEXTS.left.edited,
      disabled: false,
      className: BUTTON_STYLES.confirmed,
      showIcon: true,
      iconType: 'edit' as const,
    };
  }

  // 기본 상태
  return {
    text: BUTTON_TEXTS.left.edit,
    disabled: false,
    className: BUTTON_STYLES.default + ' hover:border-yellow-500/50 active:bg-gray-500',
  };
}

/**
 * 우측 버튼 (확인/일치) 설정 계산
 */
export function getRightButtonConfig(config: ButtonStateConfig & {
  matchText?: string;
  matchedText?: string;
}) {
  const { isEditMode, isMatching, matchedState, matchText = '전체 일치', matchedText = '전체 일치 확인됨' } = config;

  // 수정 모드일 때 (일치 확인됨 상태보다 우선)
  if (isEditMode) {
    if (isMatching) {
      return {
        text: BUTTON_TEXTS.right.sameAsOriginal,
        disabled: true,
        className: BUTTON_STYLES.disabled,
      };
    }
    return {
      text: BUTTON_TEXTS.right.save,
      disabled: false,
      className: BUTTON_STYLES.save,
      showIcon: true,
      iconType: 'check' as const,
    };
  }

  // 일치 확인됨 상태 (수정 모드가 아닐 때만)
  if (matchedState === true) {
    return {
      text: matchedText,
      disabled: true,
      className: BUTTON_STYLES.confirmed,
      showIcon: true,
      iconType: 'check' as const,
    };
  }

  // 수정됨 상태에서 원본과 일치할 때
  if (matchedState === 'edited' && isMatching) {
    return {
      text: BUTTON_TEXTS.right.changeToMatch,
      disabled: false,
      className: BUTTON_STYLES.default + ' hover:border-green-500/50 active:bg-gray-500',
    };
  }

  // 기본 상태 - 원본과 일치할 때
  if (isMatching) {
    return {
      text: matchText,
      disabled: false,
      className: BUTTON_STYLES.default + ' hover:border-green-500/50 active:bg-gray-500',
    };
  }

  // 기본 상태 - 원본과 불일치할 때
  return {
    text: matchText,
    disabled: true,
    className: BUTTON_STYLES.disabled,
  };
}
