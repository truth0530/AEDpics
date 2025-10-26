'use client';

import React from 'react';

export interface ProgressStep {
  id: string;
  title: string;
  description?: string;
  status: 'completed' | 'current' | 'pending' | 'error';
  optional?: boolean;
  icon?: React.ReactNode;
}

export interface ProgressIndicatorProps {
  steps: ProgressStep[];
  currentStep?: string;
  variant?: 'linear' | 'circular' | 'steps';
  showPercentage?: boolean;
  className?: string;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  steps,
  currentStep: _currentStep,  
  variant = 'linear',
  showPercentage = true,
  className = ''
}) => {
  // Calculate progress
  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const totalSteps = steps.filter(step => !step.optional).length;
  const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Status colors and icons
  const statusConfig = {
    completed: {
      bg: 'bg-green-500',
      border: 'border-green-500',
      text: 'text-green-400',
      icon: '✓',
      glow: 'shadow-green-500/50'
    },
    current: {
      bg: 'bg-blue-500',
      border: 'border-blue-500',
      text: 'text-blue-400',
      icon: '•',
      glow: 'shadow-blue-500/50 animate-pulse'
    },
    pending: {
      bg: 'bg-gray-600',
      border: 'border-gray-600',
      text: 'text-gray-400',
      icon: '',
      glow: ''
    },
    error: {
      bg: 'bg-red-500',
      border: 'border-red-500',
      text: 'text-red-400',
      icon: '!',
      glow: 'shadow-red-500/50'
    }
  };

  if (variant === 'circular') {
    return (
      <div className={`relative inline-flex items-center justify-center ${className}`}>
        {/* Circular Progress */}
        <svg className="w-32 h-32 transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-gray-700"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 56}`}
            strokeDashoffset={`${2 * Math.PI * 56 * (1 - percentage / 100)}`}
            className="text-green-500 transition-all duration-500 ease-out"
            strokeLinecap="round"
          />
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-white">{percentage}%</span>
          <span className="text-sm text-gray-400 mt-1">
            {completedSteps}/{totalSteps}
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'steps') {
    return (
      <div className={`space-y-4 ${className}`}>
        {/* Progress Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">진행 상황</h3>
            <p className="text-sm text-gray-400 mt-1">
              {completedSteps}개 완료 / 전체 {totalSteps}개
            </p>
          </div>
          {showPercentage && (
            <div className="text-right">
              <span className="text-2xl font-bold text-green-400">{percentage}%</span>
            </div>
          )}
        </div>

        {/* Steps List */}
        <div className="space-y-3">
          {steps.map((step, index) => {
            const config = statusConfig[step.status];

            return (
              <div
                key={step.id}
                className={`
                  relative flex items-start p-4 rounded-xl transition-all duration-300
                  ${step.status === 'current' ? 'bg-blue-900/20 border border-blue-500/50' : ''}
                  ${step.status === 'completed' ? 'bg-green-900/10' : ''}
                  ${step.status === 'error' ? 'bg-red-900/20 border border-red-500/50' : ''}
                  ${step.status === 'pending' ? 'bg-gray-800/50 opacity-60' : ''}
                `}
              >
                {/* Step Number/Icon */}
                <div className={`
                  relative flex items-center justify-center
                  w-10 h-10 rounded-full flex-shrink-0
                  ${config.bg} ${config.glow}
                  ${config.glow && 'shadow-lg'}
                `}>
                  {step.icon ? (
                    <span className="text-white text-sm">{step.icon}</span>
                  ) : (
                    <span className="text-white font-bold">
                      {step.status === 'completed' ? config.icon : index + 1}
                    </span>
                  )}
                </div>

                {/* Step Content */}
                <div className="ml-4 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-medium ${config.text}`}>
                      {step.title}
                    </h4>
                    {step.optional && (
                      <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded-full">
                        선택
                      </span>
                    )}
                  </div>
                  {step.description && (
                    <p className="text-sm text-gray-500 mt-1">
                      {step.description}
                    </p>
                  )}
                </div>

                {/* Connection Line */}
                {index < steps.length - 1 && (
                  <div className={`
                    absolute left-[20px] top-[52px] w-0.5 h-[calc(100%+12px)]
                    ${steps[index + 1].status !== 'pending' ? 'bg-gray-600' : 'bg-gray-700'}
                  `} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Default: Linear Progress Bar
  return (
    <div className={`bg-gray-800/90 backdrop-blur-sm rounded-2xl p-4 border border-gray-700 ${className}`}>
      {/* Progress Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-400">진행률</span>
          {showPercentage && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {completedSteps}/{totalSteps} 완료
              </span>
              <span className="text-sm font-bold text-green-400">
                {percentage}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500 ease-out relative"
            style={{ width: `${percentage}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex justify-between mt-4">
        {steps.map((step, index) => {
          const config = statusConfig[step.status];

          return (
            <div
              key={step.id}
              className="flex flex-col items-center flex-1"
              title={step.title}
            >
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center
                ${config.bg} ${config.glow}
                ${config.glow && 'shadow-md'}
                transition-all duration-300
              `}>
                <span className="text-white text-xs font-bold">
                  {step.status === 'completed' ? config.icon : index + 1}
                </span>
              </div>
              <span className={`
                text-xs mt-2 ${config.text}
                hidden sm:block text-center
              `}>
                {step.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressIndicator;