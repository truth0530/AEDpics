'use client';

import React from 'react';

// 현대적인 그린 테마 색상 팔레트
export const colors = {
  primary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e', // 메인 그린
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  dark: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  }
};

// 글래스모피즘 카드
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export function GlassCard({ 
  children, 
  className = '',
  hover = true,
  glow = false
}: GlassCardProps) {
  return (
    <div className={`
      relative overflow-hidden
      rounded-3xl p-6
      bg-gradient-to-br from-white/5 to-white/10
      backdrop-blur-2xl
      border border-white/10
      ${hover ? 'hover:from-white/10 hover:to-white/15 transition-all duration-300' : ''}
      ${glow ? 'shadow-[0_0_40px_rgba(34,197,94,0.1)]' : 'shadow-xl'}
      ${className}
    `}>
      {/* 그라디언트 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
      {children}
    </div>
  );
}

// 네오모피즘 버튼
interface NeoButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  pulse?: boolean;
  className?: string;
}

export function NeoButton({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  icon,
  pulse = false,
  className = ''
}: NeoButtonProps) {
  const sizeClasses = {
    sm: 'py-2.5 px-4 text-sm gap-2',
    md: 'py-3.5 px-6 text-base gap-2.5',
    lg: 'py-4 px-8 text-lg gap-3',
    xl: 'py-5 px-10 text-xl gap-3'
  };

  const variantClasses = {
    primary: `
      bg-gradient-to-r from-green-500 to-green-600
      hover:from-green-600 hover:to-green-700
      text-white font-semibold
      shadow-[0_20px_40px_-15px_rgba(34,197,94,0.5)]
      hover:shadow-[0_20px_50px_-15px_rgba(34,197,94,0.7)]
      hover:scale-[1.02]
    `,
    secondary: `
      bg-gradient-to-br from-gray-800/80 to-gray-900/80
      hover:from-gray-700/80 hover:to-gray-800/80
      text-white font-medium
      border border-gray-700/50
      backdrop-blur-xl
      shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]
    `,
    ghost: `
      bg-transparent
      hover:bg-white/5
      text-gray-300 hover:text-white
      border border-gray-700/30 hover:border-gray-600/50
    `
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        relative overflow-hidden
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${fullWidth ? 'w-full' : ''}
        rounded-2xl
        transform transition-all duration-200
        active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center justify-center
        ${pulse && !disabled ? 'animate-pulse' : ''}
        ${className}
      `}
    >
      {/* 빛나는 효과 */}
      {variant === 'primary' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-200%] animate-shimmer" />
      )}
      
      {loading ? (
        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <>
          {icon && <span>{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}

// 플로팅 입력 필드
interface FloatingInputProps {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
  error?: string;
  success?: boolean;
}

export function FloatingInput({
  label,
  type = 'text',
  value,
  onChange,
  icon,
  error,
  success
}: FloatingInputProps) {
  const [focused, setFocused] = React.useState(false);
  const hasValue = value.length > 0;

  return (
    <div className="relative">
      <div className={`
        relative
        bg-gradient-to-br from-gray-800/40 to-gray-900/40
        backdrop-blur-xl
        rounded-2xl
        border transition-all duration-300
        ${error ? 'border-red-500/50' : success ? 'border-green-500/50' : focused ? 'border-green-500/30' : 'border-gray-700/50'}
        ${focused ? 'shadow-[0_0_30px_-10px_rgba(34,197,94,0.3)]' : ''}
      `}>
        {icon && (
          <div className={`
            absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300
            ${error ? 'text-red-400' : success ? 'text-green-400' : focused ? 'text-green-500' : 'text-gray-500'}
          `}>
            {icon}
          </div>
        )}
        
        <input
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`
            w-full bg-transparent
            ${icon ? 'pl-12 pr-4' : 'px-4'}
            ${hasValue || focused ? 'pt-7 pb-3' : 'py-5'}
            text-white placeholder-transparent
            focus:outline-none
            transition-all duration-300
          `}
          placeholder={label}
        />
        
        <label className={`
          absolute left-4 ${icon ? 'left-12' : ''}
          transition-all duration-300 pointer-events-none
          ${hasValue || focused 
            ? 'top-2 text-xs text-gray-400' 
            : 'top-1/2 -translate-y-1/2 text-base text-gray-500'}
          ${error ? 'text-red-400' : success ? 'text-green-400' : ''}
        `}>
          {label}
        </label>
      </div>
      
      {error && (
        <p className="mt-2 ml-4 text-xs text-red-400 animate-fade-in">
          {error}
        </p>
      )}
    </div>
  );
}

// 스테퍼 컴포넌트
interface StepperProps {
  steps: Array<{
    label: string;
    description?: string;
  }>;
  currentStep: number;
  variant?: 'dots' | 'numbers' | 'icons';
}

export function Stepper({ 
  steps, 
  currentStep,
  variant = 'numbers'
}: StepperProps) {
  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        
        return (
          <div key={index} className="flex-1 relative">
            {/* 연결선 */}
            {index < steps.length - 1 && (
              <div className={`
                absolute top-6 left-[50%] w-full h-0.5
                transition-all duration-500
                ${isCompleted ? 'bg-green-500' : 'bg-gray-700'}
              `} />
            )}
            
            {/* 스텝 인디케이터 */}
            <div className="relative flex flex-col items-center">
              <div className={`
                relative z-10 w-12 h-12 rounded-full
                flex items-center justify-center
                transition-all duration-300
                ${isActive 
                  ? 'bg-gradient-to-br from-green-500 to-green-600 shadow-[0_0_30px_-5px_rgba(34,197,94,0.5)]' 
                  : isCompleted 
                    ? 'bg-green-500/20 border-2 border-green-500'
                    : 'bg-gray-800 border-2 border-gray-700'}
              `}>
                {variant === 'numbers' && (
                  <span className={`
                    font-semibold
                    ${isActive || isCompleted ? 'text-white' : 'text-gray-500'}
                  `}>
                    {isCompleted ? '✓' : index + 1}
                  </span>
                )}
                {variant === 'dots' && (
                  <div className={`
                    w-3 h-3 rounded-full
                    ${isActive || isCompleted ? 'bg-white' : 'bg-gray-600'}
                  `} />
                )}
              </div>
              
              {/* 라벨 */}
              <div className="mt-3 text-center">
                <p className={`
                  text-xs font-medium
                  ${isActive ? 'text-green-400' : isCompleted ? 'text-green-500' : 'text-gray-500'}
                `}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-gray-600 mt-1">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 알림 토스트
interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Toast({ 
  message, 
  type = 'info',
  icon,
  action
}: ToastProps) {
  const typeStyles = {
    success: 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400',
    error: 'from-red-500/20 to-red-600/20 border-red-500/30 text-red-400',
    warning: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 text-yellow-400',
    info: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400'
  };

  return (
    <div className={`
      fixed bottom-4 left-4 right-4 z-50
      animate-slide-up
    `}>
      <div className={`
        bg-gradient-to-r ${typeStyles[type]}
        backdrop-blur-2xl
        border rounded-2xl
        p-4 shadow-2xl
        flex items-center justify-between
      `}>
        <div className="flex items-center gap-3">
          {icon && <span className="text-xl">{icon}</span>}
          <p className="text-white font-medium">{message}</p>
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="ml-4 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

// Tailwind 설정에 추가 필요한 애니메이션
// @keyframes shimmer {
//   100% { transform: translateX(200%) skewX(-12deg); }
// }
// animation: {
//   shimmer: 'shimmer 3s infinite',
//   'fade-in': 'fadeIn 0.3s ease-in',
//   'slide-up': 'slideUp 0.3s ease-out',
// }