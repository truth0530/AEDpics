import { toast } from 'sonner';

/**
 * 저장 성공 알림
 */
export const showSaveSuccess = (message: string = '저장되었습니다') => {
  toast.success(message, {
    duration: 3000,
    position: 'top-center',
  });
};

/**
 * 저장 실패 알림
 */
export const showSaveError = (error: Error | string) => {
  const message = error instanceof Error ? error.message : error;
  toast.error(`저장에 실패했습니다: ${message}`, {
    duration: 6000,
    position: 'top-center',
  });
};

/**
 * 일반 에러 알림
 */
export const showError = (message: string) => {
  toast.error(message, {
    duration: 5000,
    position: 'top-center',
  });
};

/**
 * 일반 성공 알림
 */
export const showSuccess = (message: string) => {
  toast.success(message, {
    duration: 3000,
    position: 'top-center',
  });
};

/**
 * 정보 알림
 */
export const showInfo = (message: string) => {
  toast.info(message, {
    duration: 4000,
    position: 'top-center',
  });
};

/**
 * 경고 알림
 */
export const showWarning = (message: string) => {
  toast.warning(message, {
    duration: 4000,
    position: 'top-center',
  });
};
