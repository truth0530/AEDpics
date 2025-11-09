'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorkflowStep {
  id: number;
  label: string;
  value: number;
  total: number;
  percentage: number;
  color: 'purple' | 'orange' | 'green';
}

export interface StatCardProps {
  title: string;
  totalValue: number;
  totalLabel?: string;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down';
  };
  workflowSteps?: WorkflowStep[];
  className?: string;
  variant?: 'default' | 'gradient';
}

const colorMap = {
  purple: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-400',
    progress: 'bg-purple-500'
  },
  orange: {
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    progress: 'bg-orange-500'
  },
  green: {
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    progress: 'bg-green-500'
  }
};

export function StatCard({
  title,
  totalValue,
  totalLabel,
  subtitle,
  trend,
  workflowSteps,
  className,
  variant = 'default'
}: StatCardProps) {
  const formatNumber = (num: number): string => {
    return num.toLocaleString('ko-KR');
  };

  return (
    <Card
      className={cn(
        'border border-gray-800 flex flex-col',
        variant === 'gradient' && 'from-primary/5 to-card bg-gradient-to-t',
        className
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-gray-300">{title}</CardDescription>
          {trend && (
            <Badge variant="outline" className="gap-1">
              {trend.direction === 'up' ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {trend.value > 0 ? '+' : ''}{trend.value}%
            </Badge>
          )}
        </div>
        <CardTitle className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
          {formatNumber(totalValue)}
          {totalLabel && <span className="text-sm text-gray-400 ml-2">{totalLabel}</span>}
        </CardTitle>
        {subtitle && (
          <p className="text-xs text-red-400 mt-1">{subtitle}</p>
        )}
      </CardHeader>

      {workflowSteps && workflowSteps.length > 0 && (
        <CardContent className="px-4 py-3">
          <div className="space-y-2.5">
            {workflowSteps.map((step) => {
              const colors = colorMap[step.color];

              return (
                <div key={step.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center',
                        colors.bg
                      )}>
                        <span className={cn('text-xs font-bold', colors.text)}>
                          {step.id}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{step.label}</span>
                    </div>
                    <span className={cn('text-sm font-semibold', colors.text)}>
                      {formatNumber(step.value)}/{formatNumber(step.total)}
                      <span className="text-xs text-gray-500 ml-1">
                        ({step.percentage}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={cn('h-1.5 rounded-full transition-all', colors.progress)}
                      style={{ width: `${step.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}

      {trend && (
        <CardFooter className="flex-col items-start gap-1.5 text-sm pt-0">
          <div className="flex gap-2 font-medium">
            {trend.direction === 'up' ? '증가' : '감소'} 추세
            {trend.direction === 'up' ? (
              <TrendingUp className="size-4" />
            ) : (
              <TrendingDown className="size-4" />
            )}
          </div>
          <div className="text-muted-foreground text-xs">
            {trend.label}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
