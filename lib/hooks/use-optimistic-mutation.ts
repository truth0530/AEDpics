/**
 * Optimistic UI Mutation Hook
 * 즉각적인 UI 반응을 위한 낙관적 업데이트
 */

import { useState, useCallback } from 'react';

export interface OptimisticMutationOptions<TData, TVariables> {
  /**
   * 실제 mutation 함수
   */
  mutationFn: (variables: TVariables) => Promise<TData>;

  /**
   * 낙관적 업데이트 함수 (즉시 UI에 반영)
   */
  onOptimisticUpdate?: (variables: TVariables) => void;

  /**
   * 성공 시 콜백
   */
  onSuccess?: (data: TData, variables: TVariables) => void;

  /**
   * 실패 시 콜백 (롤백 수행)
   */
  onError?: (error: Error, variables: TVariables) => void;

  /**
   * 롤백 함수
   */
  onRollback?: (variables: TVariables) => void;
}

export function useOptimisticMutation<TData = unknown, TVariables = unknown>(
  options: OptimisticMutationOptions<TData, TVariables>
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (variables: TVariables) => {
      setIsLoading(true);
      setError(null);

      // 1. 낙관적 업데이트 (즉시 UI 반영)
      if (options.onOptimisticUpdate) {
        options.onOptimisticUpdate(variables);
      }

      try {
        // 2. 실제 mutation 실행
        const data = await options.mutationFn(variables);

        // 3. 성공 시 콜백
        if (options.onSuccess) {
          options.onSuccess(data, variables);
        }

        setIsLoading(false);
        return data;
      } catch (err) {
        const error = err as Error;
        setError(error);

        // 4. 실패 시 롤백
        if (options.onRollback) {
          options.onRollback(variables);
        }

        // 5. 에러 콜백
        if (options.onError) {
          options.onError(error, variables);
        }

        setIsLoading(false);
        throw error;
      }
    },
    [options]
  );

  return {
    mutate,
    isLoading,
    error,
    reset: () => setError(null)
  };
}

/**
 * 일정 추가 Optimistic Mutation Hook
 */
export function useOptimisticAssignmentCreation() {
  return useOptimisticMutation({
    mutationFn: async (variables: {
      equipmentSerials: string[];
      scheduledDate?: string;
      notes?: string;
    }) => {
      const response = await fetch('/api/inspections/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentSerials: variables.equipmentSerials,
          scheduledDate: variables.scheduledDate || new Date().toISOString().split('T')[0],
          assignmentType: 'scheduled',
          priorityLevel: 0,
          notes: variables.notes || '일정 추가됨'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '일정 추가 실패');
      }

      return response.json();
    }
  });
}

/**
 * 일정 상태 변경 Optimistic Mutation Hook
 */
export function useOptimisticAssignmentUpdate() {
  return useOptimisticMutation({
    mutationFn: async (variables: {
      id: number;
      status?: string;
      notes?: string;
    }) => {
      const response = await fetch(`/api/inspections/assignments/${variables.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: variables.status,
          notes: variables.notes
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '일정 수정 실패');
      }

      return response.json();
    }
  });
}

/**
 * 일정 삭제 Optimistic Mutation Hook
 */
export function useOptimisticAssignmentDeletion() {
  return useOptimisticMutation({
    mutationFn: async (variables: { id: number }) => {
      const response = await fetch(`/api/inspections/${variables.id}/delete`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '일정 삭제 실패');
      }

      return response.json();
    }
  });
}
