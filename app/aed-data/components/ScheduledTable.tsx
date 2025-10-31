'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';

interface Assignment {
  id: string;
  equipment_serial: string;
  assigned_to: string;
  assigned_by: string;
  assignment_type: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority_level: number;
  notes: string | null;
  created_at: string;
  assigned_to_profile: {
    id: string;
    full_name: string;
    role: string;
  };
  assigned_by_profile: {
    id: string;
    full_name: string;
    role: string;
  };
}

interface ScheduledTableProps {
  userId?: string;
}

export function ScheduledTable({ userId }: ScheduledTableProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();
  const router = useRouter();

  const fetchAssignments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 현재 사용자의 pending/in_progress 일정 조회
      const params = new URLSearchParams();
      if (userId) {
        params.append('assignedTo', userId);
      }
      params.append('status', 'pending');

      const response = await fetch(`/api/inspections/assignments?${params.toString()}`);

      if (!response.ok) {
        throw new Error('일정을 불러오지 못했습니다.');
      }

      const result = await response.json();
      setAssignments(result.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleCancelAssignment = async (assignmentId: string) => {
    if (!confirm('일정을 취소하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/inspections/assignments?id=${assignmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'cancelled',
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || '일정 취소에 실패했습니다.');
      }

      showSuccess('일정이 취소되었습니다.');
      fetchAssignments(); // 목록 새로고침
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      showError('일정 취소 실패', { message });
    }
  };

  const handleStartInspection = async (assignmentId: string, equipmentSerial: string) => {
    try {
      const response = await fetch(`/api/inspections/assignments?id=${assignmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'in_progress',
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || '점검 시작에 실패했습니다.');
      }

      showSuccess('점검이 시작되었습니다.');
      // URL 인코딩을 추가하여 특수문자가 있는 시리얼 번호도 안전하게 처리
      router.push(`/inspection/${encodeURIComponent(equipmentSerial)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      showError('점검 시작 실패', { message });
    }
  };

  const getStatusBadge = (status: Assignment['status']) => {
    const badges = {
      pending: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
      in_progress: 'bg-blue-900/30 text-blue-400 border-blue-700',
      completed: 'bg-green-900/30 text-green-400 border-green-700',
      cancelled: 'bg-gray-900/30 text-gray-400 border-gray-700',
    };

    const labels = {
      pending: '대기',
      in_progress: '진행중',
      completed: '완료',
      cancelled: '취소',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded border ${badges[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">일정을 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">오류: {error}</div>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">예정된 일정이 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* 데스크톱 테이블 */}
      <div className="hidden lg:block">
        <table className="w-full">
          <thead className="bg-gray-800 border-b border-gray-700 sticky top-0">
            <tr className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">장비 시리얼</th>
              <th className="px-4 py-3 text-left">일정 날짜</th>
              <th className="px-4 py-3 text-center">우선순위</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3 text-left">할당자</th>
              <th className="px-4 py-3 text-left">메모</th>
              <th className="px-4 py-3 text-center">작업</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr
                key={assignment.id}
                className="border-b border-gray-800 hover:bg-gray-800/50"
              >
                <td className="px-4 py-3 text-sm text-gray-300">
                  {assignment.equipment_serial}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">
                  {assignment.scheduled_date || '-'}
                  {assignment.scheduled_time && ` ${assignment.scheduled_time}`}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm text-gray-400">
                    {assignment.priority_level}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {getStatusBadge(assignment.status)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">
                  {assignment.assigned_by_profile.full_name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400 truncate max-w-xs">
                  {assignment.notes || '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    {assignment.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleStartInspection(assignment.id, assignment.equipment_serial)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                        >
                          점검 시작
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancelAssignment(assignment.id)}
                          className="text-red-400 border-red-700 hover:bg-red-900/20 text-xs"
                        >
                          취소
                        </Button>
                      </>
                    )}
                    {assignment.status === 'in_progress' && (
                      <Button
                        size="sm"
                        onClick={() => router.push(`/inspection/${encodeURIComponent(assignment.equipment_serial)}`)}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs"
                      >
                        점검 계속하기
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 */}
      <div className="lg:hidden p-4 space-y-3">
        {assignments.map((assignment) => (
          <div
            key={assignment.id}
            className="bg-gray-800 rounded-lg border border-gray-700 p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-200 mb-1">
                  {assignment.equipment_serial}
                </div>
                <div className="text-xs text-gray-400">
                  {assignment.scheduled_date || '-'}
                  {assignment.scheduled_time && ` ${assignment.scheduled_time}`}
                </div>
              </div>
              {getStatusBadge(assignment.status)}
            </div>

            <div className="space-y-2 mb-3">
              <div className="text-xs">
                <span className="text-gray-500">할당자: </span>
                <span className="text-gray-300">{assignment.assigned_by_profile.full_name}</span>
              </div>
              <div className="text-xs">
                <span className="text-gray-500">우선순위: </span>
                <span className="text-gray-300">{assignment.priority_level}</span>
              </div>
              {assignment.notes && (
                <div className="text-xs">
                  <span className="text-gray-500">메모: </span>
                  <span className="text-gray-300">{assignment.notes}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {assignment.status === 'pending' && (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleStartInspection(assignment.id, assignment.equipment_serial)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    점검 시작
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCancelAssignment(assignment.id)}
                    className="text-red-400 border-red-700 hover:bg-red-900/20"
                  >
                    취소
                  </Button>
                </>
              )}
              {assignment.status === 'in_progress' && (
                <Button
                  size="sm"
                  onClick={() => router.push(`/inspection/${encodeURIComponent(assignment.equipment_serial)}`)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  점검 계속하기
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
