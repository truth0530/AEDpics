/**
 * PhotoCaptureSection Component
 * 사진 촬영 및 업로드 섹션 - 모듈화된 컴포넌트
 */

'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';

interface PhotoCaptureProps {
  photos: {
    device?: string;
    battery?: string;
    pad?: string;
    location?: string;
    cabinet?: string;
  };
  onUpdate: (field: string, value: unknown) => void;
  onComplete: (itemKey: string) => void;
  completedItems: Set<string>;
}

interface PhotoItem {
  key: string;
  label: string;
  description: string;
  required: boolean;
}

const photoItems: PhotoItem[] = [
  { key: 'device', label: 'AED 장비', description: '장비 전체가 보이도록 촬영', required: true },
  { key: 'battery', label: '배터리', description: '유효기간이 보이도록 촬영', required: true },
  { key: 'pad', label: '패드', description: '유효기간이 보이도록 촬영', required: true },
  { key: 'location', label: '설치 위치', description: '주변 환경이 보이도록 촬영', required: false },
  { key: 'cabinet', label: '보관함', description: '보관함 상태 촬영', required: false },
];

export const PhotoCaptureSection: React.FC<PhotoCaptureProps> = ({
  photos,
  onUpdate,
  onComplete,
  completedItems,
}) => {
  const [activePhotoKey, setActivePhotoKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // 카메라 시작
  const startCamera = async (photoKey: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setActivePhotoKey(photoKey);
      }
    } catch (error) {
      console.error('카메라 접근 실패:', error);
      // 카메라 접근 실패 시 파일 선택으로 대체
      fileInputRef.current?.click();
    }
  };

  // 카메라 중지
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setActivePhotoKey(null);
  };

  // 사진 촬영
  const capturePhoto = () => {
    if (!videoRef.current || !activePhotoKey) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

      onUpdate(`photos.${activePhotoKey}`, dataUrl);
      onComplete(`photo_${activePhotoKey}`);

      stopCamera();
    }
  };

  // 파일 선택 처리
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, photoKey: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      onUpdate(`photos.${photoKey}`, dataUrl);
      onComplete(`photo_${photoKey}`);
    };
    reader.readAsDataURL(file);
  };

  // 사진 삭제
  const deletePhoto = (photoKey: string) => {
    onUpdate(`photos.${photoKey}`, undefined);
    // 완료 상태 제거는 별도 처리 필요
  };

  // 카메라 전환
  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    if (isCameraActive) {
      stopCamera();
      // 카메라 재시작
      setTimeout(() => {
        if (activePhotoKey) {
          startCamera(activePhotoKey);
        }
      }, 100);
    }
  };

  // 필수 사진 완료 여부
  const requiredPhotosCount = photoItems.filter(item => item.required).length;
  const completedRequiredCount = photoItems.filter(
    item => item.required && photos[item.key as keyof typeof photos]
  ).length;

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">사진 촬영</h3>
        <div className="text-sm">
          <span className="text-gray-400">필수: </span>
          <span className={completedRequiredCount === requiredPhotosCount ? 'text-green-400' : 'text-yellow-400'}>
            {completedRequiredCount}/{requiredPhotosCount}
          </span>
        </div>
      </div>

      {/* 카메라 뷰 */}
      {isCameraActive && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 bg-gray-900">
            <button
              onClick={stopCamera}
              className="text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span className="text-white font-medium">
              {photoItems.find(item => item.key === activePhotoKey)?.label}
            </span>
            <button
              onClick={switchCamera}
              className="text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          <div className="flex-1 relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* 가이드 오버레이 */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-4 border-2 border-white/30 rounded-lg"></div>
              <div className="absolute top-8 left-0 right-0 text-center">
                <p className="text-white text-sm bg-black/50 inline-block px-3 py-1 rounded">
                  {photoItems.find(item => item.key === activePhotoKey)?.description}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-900 flex justify-center">
            <button
              onClick={capturePhoto}
              className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 hover:border-green-500 transition-colors"
            >
              <div className="w-full h-full rounded-full bg-white hover:bg-gray-100"></div>
            </button>
          </div>
        </div>
      )}

      {/* 사진 목록 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photoItems.map(item => {
          const photoUrl = photos[item.key as keyof typeof photos];
          const isCompleted = completedItems.has(`photo_${item.key}`);

          return (
            <div key={item.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">
                  {item.label}
                  {item.required && <span className="text-red-400 ml-1">*</span>}
                </span>
                {isCompleted && (
                  <span className="text-xs text-green-400">✓</span>
                )}
              </div>

              <div className="relative aspect-square bg-gray-700 rounded-lg overflow-hidden">
                {photoUrl ? (
                  <>
                    <div className="relative w-full h-full" onClick={() => setPreviewUrl(photoUrl)}>
                      <Image
                        src={photoUrl}
                        alt={item.label}
                        fill
                        className="object-cover cursor-pointer"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    </div>
                    <button
                      onClick={() => deletePhoto(item.key)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startCamera(item.key)}
                    className="w-full h-full flex flex-col items-center justify-center text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
                  >
                    <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs">촬영</span>
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-500">{item.description}</p>
            </div>
          );
        })}
      </div>

      {/* 파일 입력 (숨김) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => activePhotoKey && handleFileSelect(e, activePhotoKey)}
      />

      {/* 이미지 프리뷰 모달 */}
      {previewUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <Image
              src={previewUrl}
              alt="Preview"
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 진행 상태 요약 */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">전체 사진</span>
          <span className="text-green-400">
            {Object.values(photos).filter(Boolean).length} / {photoItems.length} 완료
          </span>
        </div>
      </div>
    </div>
  );
};

export default PhotoCaptureSection;