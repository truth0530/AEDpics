'use client';

import { useState, useRef, useEffect } from 'react';
import { CameraIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { uploadPhotoToStorage } from '@/lib/utils/photo-upload';

interface PhotoCaptureInputProps {
  label: string;
  value?: string | null; // URL (Storage에서 가져온 공개 URL)
  onChange: (photoUrl: string | null) => void;
  placeholder?: string;
  hideLabel?: boolean; // label을 숨길지 여부 (기본값: false)
  sessionId?: string; // 세션 ID (Storage 업로드에 필요)
  photoType?: string; // 사진 타입 (serial_number, battery_date 등)
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
}

export function PhotoCaptureInput({
  label,
  value,
  onChange,
  placeholder = '사진을 촬영하거나 업로드하세요',
  hideLabel = false,
  sessionId,
  photoType,
  onUploadStart,
  onUploadEnd,
}: PhotoCaptureInputProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [pendingStream, setPendingStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // useEffect to attach stream after video element is rendered
  useEffect(() => {
    if (showCamera && pendingStream && videoRef.current) {
      console.log('[PhotoCapture] Attaching stream to video element');

      const video = videoRef.current;
      video.srcObject = pendingStream;
      streamRef.current = pendingStream;
      setPendingStream(null); // Clear pending stream

      // ✅ 즉시 재생 시도 (Safari 호환성)
      video.play().catch(e => {
        console.warn('[PhotoCapture] Initial play attempt failed:', e?.message);
      });

      // 폴링: 3초 동안 100ms 간격으로 비디오 크기 확인
      let checkCount = 0;
      const maxChecks = 30; // 3초 (30 × 100ms)

      const checkInterval = setInterval(() => {
        checkCount++;

        const width = video.videoWidth;
        const height = video.videoHeight;

        console.log(`[PhotoCapture] Poll ${checkCount}/${maxChecks} - dimensions: ${width}x${height}`);

        if (width > 0 && height > 0) {
          console.log('[PhotoCapture] ✅ Video dimensions loaded successfully');
          clearInterval(checkInterval);
          return;
        }

        if (checkCount >= maxChecks) {
          console.warn('[PhotoCapture] ⚠️ Timeout waiting for video dimensions');
          clearInterval(checkInterval);
          // 강제 play 시도
          video.play().catch(e => {
            console.error('[PhotoCapture] Forced play failed:', e?.message);
          });
        }
      }, 100);

      return () => {
        clearInterval(checkInterval);
      };
    }
  }, [showCamera, pendingStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        console.log('[PhotoCapture] Cleaning up stream on unmount');
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (pendingStream) {
        console.log('[PhotoCapture] Cleaning up pending stream on unmount');
        pendingStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [pendingStream]);

  // 카메라 중지
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (pendingStream) {
      pendingStream.getTracks().forEach((track) => track.stop());
      setPendingStream(null);
    }
    setShowCamera(false);
  };

  // 🆕 이미지 극도로 압축 함수 (500KB 이하로 줄이기 - 아이폰 대응)
  const compressImage = (base64: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let quality = 0.4; // 40% 시작 (극도로 압축)
        let width = img.width;
        let height = img.height;
        const maxWidth = 640; // 해상도 극도로 축소 (640px)
        const targetSize = 500 * 1024; // 500KB 목표
        let compressed = base64;

        // 1단계: 해상도 축소
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        // 2단계: 품질을 낮춰가며 500KB 이하로 압축
        while (compressed.length > targetSize && quality > 0.05) {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          compressed = canvas.toDataURL('image/jpeg', quality);
          quality -= 0.05; // 5% 씩 감소 (더 세밀한 조절)

          console.log('[PhotoCompress] Iteration:', {
            quality: `${Math.round(quality * 100)}%`,
            size: `${Math.round(compressed.length / 1024)}KB`,
            targetMet: compressed.length <= targetSize,
          });
        }

        // 최종 결과
        const originalSizeKB = Math.round(base64.length / 1024);
        const compressedSizeKB = Math.round(compressed.length / 1024);
        const reductionPercent = Math.round(
          ((base64.length - compressed.length) / base64.length) * 100
        );

        console.log('[PhotoCompress] Final Result:', {
          original: `${originalSizeKB}KB`,
          compressed: `${compressedSizeKB}KB`,
          targetMet: compressed.length <= targetSize,
          reduction: `${reductionPercent}%`,
          status: compressed.length <= targetSize ? '✅ 성공 (500KB 이하)' : '⚠️ 500KB 초과 경고',
        });

        resolve(compressed);
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = base64;
    });
  };

  // 🆕 사진 데이터 처리 (항상 압축 후 Storage 업로드)
  const handlePhotoData = async (base64Data: string) => {
    try {
      // 1단계: 사진 압축 (500KB 이하)
      console.log('[PhotoCapture] Compressing image before upload...');
      const compressed = await compressImage(base64Data);

      if (sessionId && photoType) {
        // 2단계: Storage에 업로드
        onUploadStart?.();
        const result = await uploadPhotoToStorage(compressed, sessionId, photoType);
        if (result?.url) {
          console.log('[PhotoCapture] Storage upload successful:', result.url);
          onChange(result.url);
        } else {
          throw new Error('Storage upload failed');
        }
        onUploadEnd?.();
      } else {
        // SessionId 없으면 압축된 이미지만 반환
        onChange(compressed);
      }
    } catch (error) {
      console.error('[PhotoCapture] Photo handling failed:', error);
      alert('사진 처리 중 오류가 발생했습니다.');
      onUploadEnd?.();
    }
  };

  // 사진 촬영
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) {
      console.error('[PhotoCapture] No video element');
      return;
    }

    // ✅ 비디오 크기 검증
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      console.error('[PhotoCapture] Invalid video dimensions:', { width, height });
      alert('카메라 화면 크기를 확인할 수 없습니다. 다시 시도해주세요.');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas context not available');
      }

      // ✅ 좌표 명시 (일부 기기에서 필요)
      context.drawImage(video, 0, 0, width, height);

      // ✅ 품질 조정 (모바일에서 0.5-0.6이 적정, 500KB 목표)
      const photoData = canvas.toDataURL('image/jpeg', 0.5);

      console.log('[PhotoCapture] Photo captured successfully:', {
        width,
        height,
        dataSize: photoData.length,
      });

      // 🆕 Storage 업로드 또는 압축 처리
      handlePhotoData(photoData);
      stopCamera();
    } catch (error) {
      console.error('[PhotoCapture] Capture failed:', error);
      alert('사진 촬영 중 오류가 발생했습니다.');
    }
  };

  // 🆕 HEIC 이미지를 JPEG로 변환 (아이폰 지원)
  const convertHeicToJpeg = async (base64Data: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.warn('[PhotoConvert] Canvas context not available, using original');
          resolve(base64Data);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const jpegData = canvas.toDataURL('image/jpeg', 0.5);

        console.log('[PhotoConvert] HEIC → JPEG conversion:', {
          original: base64Data.length,
          converted: jpegData.length,
          reduction: `${Math.round((1 - jpegData.length / base64Data.length) * 100)}%`,
        });

        resolve(jpegData);
      };
      img.onerror = () => {
        console.warn('[PhotoConvert] Image load failed, using original');
        resolve(base64Data);
      };
      img.src = base64Data;
    });
  };

  // 파일 업로드
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일만 허용
    if (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.heic')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      let base64 = reader.result as string;
      console.log('[PhotoUpload] File selected:', {
        fileName: file.name,
        size: file.size,
        type: file.type,
        isHeic: file.name.toLowerCase().endsWith('.heic'),
      });

      // 🆕 HEIC 파일이면 JPEG로 변환
      if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic')) {
        console.log('[PhotoUpload] Converting HEIC to JPEG...');
        base64 = await convertHeicToJpeg(base64);
      }

      // 🆕 Storage 업로드 또는 압축 처리
      await handlePhotoData(base64);
    };
    reader.readAsDataURL(file);
  };

  // 사진 삭제
  const removePhoto = () => {
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {!hideLabel && (
        <label className="block text-xs font-medium text-gray-300">{label}</label>
      )}

      {/* 사진 미리보기 */}
      {value && !showCamera && (
        <div className="relative inline-block">
          <img
            src={value}
            alt={label}
            className="w-full max-w-xs h-auto rounded-lg border border-gray-600"
          />
          <button
            type="button"
            onClick={removePhoto}
            className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 rounded-full text-white"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 카메라 뷰 */}
      {showCamera && (
        <div className="space-y-2">
          <div
            className="w-full rounded-lg border border-gray-600 overflow-hidden bg-black"
            style={{
              aspectRatio: '4/3',
              minHeight: '280px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full"
              style={{
                display: 'block',
                backgroundColor: '#000',
                objectFit: 'cover',
                WebkitTransform: 'scaleX(-1)',  // iOS Safari 호환성
                transform: 'scaleX(-1)',
              }}
            />
          </div>
          <div className="flex gap-2 flex-col">
            {/* 비디오 상태 표시 */}
            {videoRef.current && (
              <div className="text-xs text-gray-400 text-center">
                카메라 크기: {videoRef.current.videoWidth || '?'} × {videoRef.current.videoHeight || '?'}px
                {videoRef.current.videoWidth === 0 && ' (로딩 중...)'}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={videoRef.current?.videoWidth === 0}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <CameraIcon className="w-5 h-5" />
                촬영
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사진 등록 버튼 (단일 버튼) */}
      {!value && !showCamera && (
        <button
          type="button"
          onClick={() => setShowSourceModal(true)}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
        >
          <PhotoIcon className="w-5 h-5" />
          사진 등록
        </button>
      )}

      {/* 사진 출처 선택 모달 */}
      {showSourceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white text-center">사진 등록 방법</h3>
            <p className="text-sm text-gray-300 text-center">사진을 등록할 방법을 선택해주세요</p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={async () => {
                  setShowSourceModal(false);
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                      video: {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                      },
                    });
                    setPendingStream(stream);
                    setShowCamera(true);
                  } catch (error) {
                    console.error('[PhotoCapture] Camera access denied:', error);
                    alert('카메라 접근 권한이 필요합니다. 브라우저 설정에서 카메라 권한을 허용해주세요.');
                  }
                }}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <CameraIcon className="w-5 h-5" />
                새로 촬영하기
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSourceModal(false);
                  fileInputRef.current?.click();
                }}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <PhotoIcon className="w-5 h-5" />
                사진첩에서 선택
              </button>

              <button
                type="button"
                onClick={() => setShowSourceModal(false)}
                className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 숨겨진 파일 입력 - capture 속성으로 모바일에서 카메라 우선 실행 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* 안내 텍스트 */}
      {!value && !showCamera && (
        <p className="text-xs text-gray-500">{placeholder}</p>
      )}
    </div>
  );
}
