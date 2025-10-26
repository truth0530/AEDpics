'use client';

import React from 'react';

interface PriorityBadgeProps {
  priority: 'urgent' | 'warning' | 'normal';
  className?: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, className = "" }) => {
  const getBadgeStyles = (priority: string) => {
    const badges = {
      'urgent': 'bg-red-500 text-white',
      'warning': 'bg-yellow-500 text-black',
      'normal': 'bg-green-500 text-white'
    };
    return badges[priority as keyof typeof badges] || 'bg-gray-500 text-white';
  };

  const getPriorityText = (priority: string) => {
    const texts = {
      'urgent': '긴급',
      'warning': '주의',
      'normal': '정상'
    };
    return texts[priority as keyof typeof texts] || '알 수 없음';
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBadgeStyles(priority)} ${className}`}>
      {getPriorityText(priority)}
    </span>
  );
};