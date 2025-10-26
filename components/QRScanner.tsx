'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export default function QRScanner({ onScan, onError, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>(0);

  // Check for camera availability
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && 'getUserMedia' in navigator.mediaDevices) {
      setHasCamera(true);
    }
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsScanning(true);
      }
    } catch (error) {
      console.error('Camera access error:', error);
      onError?.(error as Error);
    }
  }, [onError]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsScanning(false);
  }, []);

  // Scan for QR/barcode
  const scan = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scan);
      return;
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data for processing
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Simple barcode detection (would use a library like ZXing in production)
    // For demo, we'll simulate detection with a pattern
    if (detectCode(imageData)) {
      const mockData = `AED-${Date.now()}`; // Mock scanned data
      onScan(mockData);
      stopCamera();
    } else {
      animationFrameRef.current = requestAnimationFrame(scan);
    }
  }, [isScanning, onScan, stopCamera]);

  // Mock code detection (replace with actual library)
   
  const detectCode = (_imageData: ImageData): boolean => {
    // Simulate random detection for demo
    return Math.random() < 0.01; // 1% chance per frame
  };

  // Start scanning when camera is ready
  useEffect(() => {
    if (isScanning) {
      scan();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isScanning, scan]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  if (!hasCamera) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-sm">
          <p className="text-gray-800 mb-4">카메라를 사용할 수 없습니다.</p>
          <button
            onClick={onClose}
            className="bg-gray-600 text-white px-4 py-2 rounded"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col z-50">
      {/* Header */}
      <div className="bg-gray-900 p-4 flex justify-between items-center">
        <h2 className="text-white text-lg font-semibold">QR/바코드 스캔</h2>
        <button
          onClick={() => {
            stopCamera();
            onClose?.();
          }}
          className="text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Camera view */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Scanning overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {/* Scanning frame */}
            <div className="w-64 h-64 border-2 border-green-500">
              {/* Corner indicators */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500"></div>
              
              {/* Scanning line animation */}
              {isScanning && (
                <div className="absolute inset-x-0 h-1 bg-green-500 animate-scan"></div>
              )}
            </div>
            
            {/* Instructions */}
            <p className="text-white text-center mt-4">
              QR코드나 바코드를 프레임 안에 맞춰주세요
            </p>
          </div>
        </div>

        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="bg-gray-900 p-4">
        {!isScanning ? (
          <button
            onClick={startCamera}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold"
          >
            스캔 시작
          </button>
        ) : (
          <button
            onClick={stopCamera}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold"
          >
            스캔 중지
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { top: 0; }
          50% { top: calc(100% - 4px); }
          100% { top: 0; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
      `}</style>
    </div>
  );
}