'use client';

import { useState, useRef, useEffect } from 'react';

interface OTPInputProps {
  length?: number;
  onComplete: (otp: string) => void;
  loading?: boolean;
  error?: string | null;
  success?: boolean;
}

export function OTPInput({
  length = 6,
  onComplete,
  loading = false,
  error = null,
  success = false
}: OTPInputProps) {
  const [otp, setOTP] = useState<string[]>(new Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>(new Array(length).fill(null));
  const lastVerifiedOTP = useRef<string>(''); // 마지막으로 검증 시도한 OTP 저장

  // 자동 포커스
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // error나 success 상태가 변경되면 lastVerifiedOTP 초기화 (재시도 가능하도록)
  useEffect(() => {
    if (error || success) {
      // 에러나 성공 시에는 다시 시도할 수 있도록 초기화하지 않음
    }
  }, [error, success]);

  const handleChange = (index: number, value: string) => {
    // 숫자만 허용
    if (!/^\d*$/.test(value)) return;

    const newOTP = [...otp];

    // 한 번에 여러 자리 입력된 경우 (붙여넣기)
    if (value.length > 1) {
      const pastedData = value.slice(0, length - index);
      for (let i = 0; i < pastedData.length && index + i < length; i++) {
        newOTP[index + i] = pastedData[i];
      }
      setOTP(newOTP);

      // 다음 빈 칸으로 이동
      const nextIndex = Math.min(index + pastedData.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
    } else {
      // 한 자리 입력
      newOTP[index] = value;
      setOTP(newOTP);

      // 다음 입력 칸으로 이동
      if (value && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }

    // OTP 완성 시 콜백 호출 (이미 시도한 OTP가 아닐 경우에만)
    const completedOTP = newOTP.join('');
    if (completedOTP.length === length && completedOTP !== lastVerifiedOTP.current) {
      lastVerifiedOTP.current = completedOTP;
      onComplete(completedOTP);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newOTP = [...otp];
      
      if (otp[index]) {
        // 현재 칸에 값이 있으면 삭제
        newOTP[index] = '';
      } else if (index > 0) {
        // 현재 칸이 비어있으면 이전 칸 삭제하고 이동
        newOTP[index - 1] = '';
        inputRefs.current[index - 1]?.focus();
      }
      
      setOTP(newOTP);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '');

    if (pasteData.length > 0) {
      const newOTP = [...otp];
      for (let i = 0; i < Math.min(pasteData.length, length); i++) {
        newOTP[i] = pasteData[i];
      }
      setOTP(newOTP);

      // 마지막 입력된 칸으로 이동
      const lastIndex = Math.min(pasteData.length - 1, length - 1);
      inputRefs.current[lastIndex]?.focus();

      // OTP 완성 시 콜백 호출 (이미 시도한 OTP가 아닐 경우에만)
      if (pasteData.length >= length) {
        const completedOTP = pasteData.slice(0, length);
        if (completedOTP !== lastVerifiedOTP.current) {
          lastVerifiedOTP.current = completedOTP;
          onComplete(completedOTP);
        }
      }
    }
  };

  // 상태에 따른 스타일 (모바일 최적화)
  const getInputStyle = (index: number) => {
    let baseStyle = "w-10 h-10 sm:w-12 sm:h-12 text-center text-lg sm:text-xl font-bold border-2 rounded-lg sm:rounded-xl bg-gray-800/50 text-white focus:outline-none transition-all duration-200 ";

    if (success) {
      baseStyle += "border-green-500 bg-green-500/10 ";
    } else if (error) {
      baseStyle += "border-red-500 bg-red-500/10 ";
    } else if (otp[index]) {
      baseStyle += "border-green-400 bg-green-400/10 ";
    } else {
      baseStyle += "border-gray-600 focus:border-green-400 ";
    }

    return baseStyle;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-1.5 sm:gap-3 justify-center w-full px-2">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={loading}
            className={getInputStyle(index)}
            autoComplete="off"
          />
        ))}
      </div>
      
      {/* 상태 메시지 */}
      {loading && (
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          인증 중...
        </div>
      )}
      
      {error && (
        <div className="text-red-400 text-sm text-center">
          {error}
        </div>
      )}
      
      {success && (
        <div className="text-green-400 text-sm text-center flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          인증 완료!
        </div>
      )}
    </div>
  );
}