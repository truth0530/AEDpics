'use client';

import React from 'react';

export interface SmartCardProps {
  priority: 'urgent' | 'warning' | 'normal' | 'completed';
  title: string;
  subtitle?: string;
  status?: string;
  actions?: React.ReactNode;
  metadata?: Array<{
    label: string;
    value: string;
    color?: 'red' | 'yellow' | 'green' | 'blue' | 'gray';
    icon?: React.ReactNode;
  }>;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const SmartCard: React.FC<SmartCardProps> = ({
  priority,
  title,
  subtitle,
  status,
  actions,
  metadata = [],
  interactive = false,
  onClick,
  className = '',
  children
}) => {
  const priorityStyles = {
    urgent: {
      border: 'border-red-500/50',
      bg: 'bg-gradient-to-br from-red-900/20 to-red-800/10',
      icon: '🔴',
      badge: 'bg-red-600 text-white',
      glow: 'hover:shadow-red-500/20'
    },
    warning: {
      border: 'border-yellow-500/50',
      bg: 'bg-gradient-to-br from-yellow-900/20 to-yellow-800/10',
      icon: '🟡',
      badge: 'bg-yellow-600 text-white',
      glow: 'hover:shadow-yellow-500/20'
    },
    normal: {
      border: 'border-green-500/50',
      bg: 'bg-gradient-to-br from-green-900/20 to-green-800/10',
      icon: '🟢',
      badge: 'bg-green-600 text-white',
      glow: 'hover:shadow-green-500/20'
    },
    completed: {
      border: 'border-blue-500/50',
      bg: 'bg-gradient-to-br from-blue-900/20 to-blue-800/10',
      icon: '✅',
      badge: 'bg-blue-600 text-white',
      glow: 'hover:shadow-blue-500/20'
    }
  };

  const metadataColors = {
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
    gray: 'text-gray-400'
  };

  const styles = priorityStyles[priority];

  return (
    <div
      className={`
        relative rounded-2xl border-2 transition-all duration-300
        ${styles.border} ${styles.bg}
        ${interactive ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl ' + styles.glow : ''}
        ${className}
      `}
      onClick={interactive ? onClick : undefined}
    >
      {/* Card Header */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Title with Priority Icon */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg" role="img" aria-label={priority}>
                {styles.icon}
              </span>
              <h3 className="text-lg sm:text-xl font-semibold text-white truncate">
                {title}
              </h3>
            </div>

            {/* Subtitle */}
            {subtitle && (
              <p className="text-sm sm:text-base text-gray-400 mt-1">
                {subtitle}
              </p>
            )}
          </div>

          {/* Status Badge */}
          {status && (
            <span className={`
              px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium
              ${styles.badge}
              whitespace-nowrap
            `}>
              {status}
            </span>
          )}
        </div>

        {/* Metadata Grid */}
        {metadata.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {metadata.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                {item.icon && (
                  <span className="text-gray-500">{item.icon}</span>
                )}
                <span className="text-xs sm:text-sm text-gray-500">
                  {item.label}:
                </span>
                <span className={`
                  text-xs sm:text-sm font-medium
                  ${item.color ? metadataColors[item.color] : 'text-white'}
                `}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Custom Children Content */}
        {children && (
          <div className="mt-4">
            {children}
          </div>
        )}

        {/* Action Buttons */}
        {actions && (
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* Interactive Indicator */}
      {interactive && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      )}
    </div>
  );
};

export default SmartCard;