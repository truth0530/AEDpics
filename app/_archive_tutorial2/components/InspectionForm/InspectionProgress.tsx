'use client';

import React from 'react';

interface InspectionProgressProps {
  currentStep: number;
  totalSteps: number;
  stepNames: string[];
  className?: string;
}

export const InspectionProgress: React.FC<InspectionProgressProps> = ({
  currentStep,
  totalSteps,
  stepNames,
  className = ''
}) => {
  const progressPercentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className={`bg-white rounded-lg p-4 border ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-md font-medium text-gray-800">점검 진행률</h4>
        <span className="text-sm text-gray-600">
          {currentStep}/{totalSteps} 단계 ({progressPercentage}%)
        </span>
      </div>

      {/* 진행률 바 */}
      <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
        <div
          className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* 단계별 체크리스트 */}
      <div className="space-y-2">
        {stepNames.map((stepName, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <div key={stepNumber} className="flex items-center gap-3">
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                isCompleted
                  ? 'bg-green-100 text-green-800 border-2 border-green-300'
                  : isCurrent
                    ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-500 border-2 border-gray-200'
              }`}>
                {isCompleted ? '✓' : stepNumber}
              </div>
              <span className={`text-sm ${
                isCompleted
                  ? 'text-green-700 font-medium'
                  : isCurrent
                    ? 'text-blue-700 font-medium'
                    : 'text-gray-500'
              }`}>
                {stepName}
              </span>
            </div>
          );
        })}
      </div>

      {/* 완료도에 따른 메시지 */}
      {progressPercentage === 100 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center text-green-700">
            <span className="text-lg mr-2">🎉</span>
            <span className="text-sm font-medium">모든 점검이 완료되었습니다!</span>
          </div>
        </div>
      )}

      {progressPercentage >= 50 && progressPercentage < 100 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center text-blue-700">
            <span className="text-lg mr-2">⚡</span>
            <span className="text-sm font-medium">절반 이상 완료했습니다. 계속 진행해주세요!</span>
          </div>
        </div>
      )}

      {progressPercentage < 50 && currentStep > 1 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center text-yellow-700">
            <span className="text-lg mr-2">🚀</span>
            <span className="text-sm font-medium">좋은 시작입니다! 계속 점검을 진행해주세요.</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectionProgress;