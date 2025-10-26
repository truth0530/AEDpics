/**
 * 점검 보고서 이미지 캡처 및 공유 유틸리티
 */
import html2canvas from 'html2canvas';

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
      console.error(`Element with id "${elementId}" not found`);
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
    console.error('Error capturing report as image:', error);
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
      console.log('Web Share API not supported');
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
    console.log('Report shared successfully');
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Share cancelled by user');
    } else {
      console.error('Error sharing report:', error);
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
      console.error('Failed to capture report as image');
      return false;
    }

    // 공유 실행
    const shared = await shareReport(blob, fileName);
    return shared;
  } catch (error) {
    console.error('Error in captureAndShareReport:', error);
    return false;
  }
}

/**
 * 보고서가 공유 가능한지 확인합니다 (Web Share API 지원)
 */
export function isReportSharingSupported(): boolean {
  return !!navigator.share;
}
