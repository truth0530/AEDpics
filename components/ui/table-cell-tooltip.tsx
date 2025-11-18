'use client';

import * as React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TableCellTooltipProps {
  children: React.ReactNode;
  content: string | null | undefined;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function TableCellTooltip({
  children,
  content,
  className,
  side = 'top',
}: TableCellTooltipProps) {
  // 내용이 없으면 tooltip 없이 children만 반환
  if (!content || content === '-') {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('cursor-help', className)}>{children}</div>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-md bg-gray-800 text-white p-2 text-xs border border-gray-700 z-50"
          sideOffset={5}
        >
          <p className="break-words whitespace-pre-wrap">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
