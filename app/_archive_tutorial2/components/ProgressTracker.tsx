'use client';

import React from 'react';

interface ProgressTrackerProps {
  completed: number;
  total: number;
  className?: string;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  completed,
  total,
  className = ""
}) => {
  const percentage = Math.round((completed / total) * 100);

  return (
    <div className={`bg-gray-800/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-gray-700 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-xs text-gray-400 whitespace-nowrap">진행률</span>
          <div className="flex-1 bg-gray-700 rounded-full h-1.5 min-w-[100px]">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{completed}/{total}</span>
          <span className="text-sm font-bold text-green-400">{percentage}%</span>
        </div>
      </div>
    </div>
  );
};