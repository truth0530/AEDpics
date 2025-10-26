import React from 'react';

interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
  gradient?: boolean;
  blur?: boolean;
}

export function MobileCard({ 
  children, 
  className = '', 
  gradient = false,
  blur = false 
}: MobileCardProps) {
  const baseClasses = "rounded-3xl p-6";
  const backgroundClasses = gradient 
    ? "bg-gradient-to-br from-gray-800/50 to-gray-900/50" 
    : "bg-gray-800/50";
  const blurClasses = blur ? "backdrop-blur-xl" : "";
  const borderClasses = "border border-gray-700/50";
  
  return (
    <div className={`${baseClasses} ${backgroundClasses} ${blurClasses} ${borderClasses} ${className}`}>
      {children}
    </div>
  );
}

interface MobileButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  fullWidth?: boolean;
}

export function MobileButton({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  fullWidth = false
}: MobileButtonProps) {
  const sizeClasses = {
    sm: 'py-3 px-4 text-sm',
    md: 'py-4 px-6 text-base',
    lg: 'py-5 px-8 text-lg'
  };

  const variantClasses = {
    primary: 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg',
    secondary: 'bg-gray-800/50 backdrop-blur-sm border border-gray-700 hover:bg-gray-800 text-white',
    ghost: 'bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-white'
  };

  const disabledClasses = disabled || loading
    ? 'opacity-50 cursor-not-allowed'
    : 'transform transition-all active:scale-95';

  const widthClasses = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${disabledClasses}
        ${widthClasses}
        rounded-2xl font-semibold transition-all
        ${className}
      `}
    >
      {loading ? (
        <span className="flex items-center justify-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          처리 중...
        </span>
      ) : children}
    </button>
  );
}

interface MobileInputProps {
  label?: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  icon?: React.ReactNode;
}

export function MobileInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  icon
}: MobileInputProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-medium text-gray-400 ml-4">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`
            w-full px-4 py-4 
            ${icon ? 'pl-12' : ''}
            bg-gray-800/50 backdrop-blur-sm 
            border ${error ? 'border-red-500' : 'border-gray-700'}
            rounded-2xl text-white placeholder-gray-500 
            focus:outline-none focus:border-green-500 focus:bg-gray-800 
            transition-all
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        />
      </div>
      {error && (
        <p className="text-xs text-red-400 ml-4">{error}</p>
      )}
    </div>
  );
}

interface MobileSelectProps {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string; group?: string }>;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

export function MobileSelect({
  label,
  value,
  onChange,
  options,
  placeholder = '선택하세요',
  required = false,
  disabled = false,
  error
}: MobileSelectProps) {
  // 옵션을 그룹별로 정리
  const groupedOptions = options.reduce((acc, option) => {
    const group = option.group || 'default';
    if (!acc[group]) acc[group] = [];
    acc[group].push(option);
    return acc;
  }, {} as Record<string, typeof options>);

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-medium text-gray-400 ml-4">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`
          w-full px-4 py-4
          bg-gray-800/50 backdrop-blur-sm 
          border ${error ? 'border-red-500' : 'border-gray-700'}
          rounded-2xl text-white
          focus:outline-none focus:border-green-500 focus:bg-gray-800 
          transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
          appearance-none
          bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22%20viewBox%3d%220%200%2024%2024%22%20fill%3d%22none%22%20stroke%3d%22%239ca3af%22%20stroke-width%3d%222%22%20stroke-linecap%3d%22round%22%20stroke-linejoin%3d%22round%22%3e%3cpolyline%20points%3d%226%209%2012%2015%2018%209%22%3e%3c%2fpolyline%3e%3c%2fsvg%3e')]
          bg-[length:1.5rem] bg-[right_1rem_center] bg-no-repeat
        `}
      >
        <option value="">{placeholder}</option>
        {Object.entries(groupedOptions).map(([group, groupOptions]) => (
          group === 'default' ? (
            groupOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          ) : (
            <optgroup key={group} label={group}>
              {groupOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          )
        ))}
      </select>
      {error && (
        <p className="text-xs text-red-400 ml-4">{error}</p>
      )}
    </div>
  );
}

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function MobileBottomSheet({
  isOpen,
  onClose,
  title,
  children
}: MobileBottomSheetProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div className="bg-gray-900 rounded-t-3xl shadow-2xl">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-gray-700 rounded-full" />
          </div>
          
          {/* Title */}
          {title && (
            <div className="px-6 pb-4">
              <h3 className="text-lg font-semibold text-white">{title}</h3>
            </div>
          )}
          
          {/* Content */}
          <div className="px-6 pb-8 max-h-[70vh] overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

// 애니메이션을 위한 Tailwind 설정 추가 필요
// tailwind.config.js에 추가:
// animation: {
//   'slide-up': 'slideUp 0.3s ease-out',
// },
// keyframes: {
//   slideUp: {
//     '0%': { transform: 'translateY(100%)' },
//     '100%': { transform: 'translateY(0)' },
//   },
// }