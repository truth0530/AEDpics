/**
 * Photo Upload Component
 *
 * Features:
 * - Multiple file upload
 * - Image preview
 * - File size validation
 * - Progress indicator
 */

'use client';

import { useState, useRef } from 'react';

interface PhotoUploadProps {
  onUploadComplete: (urls: string[]) => void;
  category?: string;
  maxFiles?: number;
}

export default function PhotoUpload({
  onUploadComplete,
  category = 'inspection-photos',
  maxFiles = 5,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    if (uploadedUrls.length + files.length > maxFiles) {
      setError(`최대 ${maxFiles}개의 파일만 업로드할 수 있습니다.`);
      return;
    }

    setError('');
    setUploading(true);

    try {
      const uploadPromises = files.map(async (file) => {
        // File size validation (10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`${file.name}의 크기가 10MB를 초과합니다.`);
        }

        // File type validation
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          throw new Error(`${file.name}은 지원되지 않는 파일 형식입니다.`);
        }

        // Create preview
        const reader = new FileReader();
        const previewPromise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        // Upload to server
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '업로드 실패');
        }

        const data = await response.json();
        const preview = await previewPromise;

        return { url: data.file.url, preview };
      });

      const results = await Promise.all(uploadPromises);

      const newUrls = results.map((r) => r.url);
      const newPreviews = results.map((r) => r.preview);

      setUploadedUrls([...uploadedUrls, ...newUrls]);
      setPreviews([...previews, ...newPreviews]);
      onUploadComplete([...uploadedUrls, ...newUrls]);

      setUploading(false);
    } catch (err: any) {
      console.error('[Photo Upload] Error:', err);
      setError(err.message || '업로드 중 오류가 발생했습니다.');
      setUploading(false);
    }
  }

  function handleRemove(index: number) {
    const newUrls = uploadedUrls.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setUploadedUrls(newUrls);
    setPreviews(newPreviews);
    onUploadComplete(newUrls);
  }

  function handleButtonClick() {
    fileInputRef.current?.click();
  }

  return (
    <div className="space-y-4">
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {/* Upload button */}
      <div>
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={uploading || uploadedUrls.length >= maxFiles}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {uploading ? '업로드 중...' : '사진 선택'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <p className="mt-2 text-xs text-gray-500">
          JPEG, PNG, WebP 형식, 최대 10MB, {uploadedUrls.length}/{maxFiles}개 업로드됨
        </p>
      </div>

      {/* Preview grid */}
      {previews.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border border-gray-200"
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
