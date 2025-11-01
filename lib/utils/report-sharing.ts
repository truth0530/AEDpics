/**
 * 점검 보고서 이미지 캡처 및 공유 유틸리티
 */
import html2canvas from 'html2canvas';
import { logger } from '@/lib/logger';

export interface InspectorInfo {
  name: string;
  organization: string;
}

/**
 * HTML 요소를 이미지로 캡처합니다
 */
export async function captureReportAsImage(
  elementId: string,
  inspectorInfo?: InspectorInfo
): Promise<Blob | null> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      logger.error('ReportSharing:capture', 'Element not found', { elementId });
      return null;
    }

    // html2canvas 옵션 설정
    const canvas = await html2canvas(element, {
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#1a1a1a',
    });

    // Canvas를 Blob으로 변환
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          resolve(null);
        }
      }, 'image/png');
    });
  } catch (error) {
    logger.error('ReportSharing:capture', 'Error capturing report as image', error instanceof Error ? error : { error });
    return null;
  }
}

/**
 * 캡처된 이미지를 Web Share API를 통해 공유합니다
 */
export async function shareReport(blob: Blob, fileName: string): Promise<boolean> {
  try {
    // Web Share API 지원 여부 확인
    if (!navigator.share) {
      logger.info('ReportSharing:share', 'Web Share API not supported');
      return false;
    }

    // Blob을 File로 변환
    const file = new File([blob], fileName, { type: 'image/png' });

    // 공유 옵션 설정
    const shareData: ShareData = {
      files: [file],
      title: '점검 보고서',
      text: 'AED 점검 보고서',
    };

    // 공유 실행
    await navigator.share(shareData);
    logger.info('ReportSharing:share', 'Report shared successfully');
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.info('ReportSharing:share', 'Share cancelled by user');
    } else {
      logger.error('ReportSharing:share', 'Error sharing report', error instanceof Error ? error : { error });
    }
    return false;
  }
}

/**
 * 점검 보고서를 캡처하고 공유합니다
 */
export async function captureAndShareReport(
  elementId: string,
  fileName: string,
  inspectorInfo?: InspectorInfo
): Promise<boolean> {
  try {
    // 보고서 이미지 캡처
    const blob = await captureReportAsImage(elementId, inspectorInfo);

    if (!blob) {
      logger.error('ReportSharing:captureAndShare', 'Failed to capture report as image', { elementId });
      return false;
    }

    // 공유 실행
    const shared = await shareReport(blob, fileName);
    return shared;
  } catch (error) {
    logger.error('ReportSharing:captureAndShare', 'Error in captureAndShareReport', error instanceof Error ? error : { error });
    return false;
  }
}

/**
 * 보고서가 공유 가능한지 확인합니다 (Web Share API 지원)
 */
export function isReportSharingSupported(): boolean {
  return !!navigator.share;
}
