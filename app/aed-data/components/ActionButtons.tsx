'use client';

import { MoreHorizontal, ClipboardList, CalendarPlus, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAEDData } from './AEDDataProvider';
import type { UserRole } from '@/packages/types';
import { canManageSchedules } from '@/lib/auth/access-control';
import { cn } from '@/lib/utils';

interface ActionButtonsProps {
  onViewDetails: () => void;
  onQuickInspect: () => void;
  onSchedule: () => void;
  allowQuickInspect?: boolean;
  allowSchedule?: boolean;
}

export function canQuickInspect(role: UserRole) {
  return !['temporary_inspector', 'pending_approval', 'email_verified'].includes(role);
}

export function canSchedule(role: UserRole) {
  return canManageSchedules(role);
}

export function ActionButtons({
  onViewDetails,
  onQuickInspect,
  onSchedule,
  allowQuickInspect,
  allowSchedule,
}: ActionButtonsProps) {
  const { userProfile } = useAEDData();
  const role = userProfile?.role ?? 'email_verified';

  const quickInspectEnabled = typeof allowQuickInspect === 'boolean'
    ? allowQuickInspect
    : canQuickInspect(role as UserRole);
  const scheduleEnabled = typeof allowSchedule === 'boolean'
    ? allowSchedule
    : canSchedule(role as UserRole);

  const iconTouchTargetClasses = 'h-11 w-11 md:h-9 md:w-9';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('text-gray-300 hover:text-white', iconTouchTargetClasses)}
        >
          <MoreHorizontal className="w-4 h-4" />
          <span className="sr-only">작업 선택</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onViewDetails();
          }}
          className="cursor-pointer"
        >
          <Eye className="w-4 h-4" /> 상세 보기
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            if (!quickInspectEnabled) return;
            onQuickInspect();
          }}
          disabled={!quickInspectEnabled}
          className="cursor-pointer"
        >
          <ClipboardList className="w-4 h-4" /> 즉시 점검
        </DropdownMenuItem>
        {/* "일정 추가" 메뉴 항목 제거: 체크박스 선택 후 "일정 예약 (N개)" 버튼 사용 */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
