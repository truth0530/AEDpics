/**
 * 우선순위 기반 동기화 큐
 * 중요도별로 작업을 관리하고 처리
 */

import { QueuedOperation } from './OfflineQueue'
import { logger } from '@/lib/logger'

export type Priority = 'critical' | 'high' | 'normal' | 'low'

export interface PrioritizedOperation extends QueuedOperation {
  priority: Priority
  deadline?: Date
  dependencies?: string[]
}

export interface PriorityConfig {
  // 각 우선순위별 처리 비율
  processingRatio?: {
    critical: number
    high: number
    normal: number
    low: number
  }
  // 우선순위 자동 상승 (시간 경과)
  autoEscalation?: boolean
  escalationThreshold?: number // 밀리초
  // 테이블별 기본 우선순위
  tablePriorities?: Record<string, Priority>
}

export class PrioritySyncQueue {
  private queues: Map<Priority, PrioritizedOperation[]> = new Map()
  private config: Required<PriorityConfig>
  private processing: boolean = false

  constructor(config: PriorityConfig = {}) {
    this.config = {
      processingRatio: config.processingRatio || {
        critical: 10,  // critical 1개당
        high: 5,       // high 5개
        normal: 3,     // normal 3개
        low: 1         // low 1개 처리
      },
      autoEscalation: config.autoEscalation !== false,
      escalationThreshold: config.escalationThreshold || 30 * 60 * 1000, // 30분
      tablePriorities: config.tablePriorities || {
        'inspections': 'high',
        'inspection_schedule_entries': 'high',
        'team_tasks': 'normal',
        'team_activities': 'low',
        'notifications': 'normal'
      }
    }

    // 큐 초기화
    this.queues.set('critical', [])
    this.queues.set('high', [])
    this.queues.set('normal', [])
    this.queues.set('low', [])

    // 자동 상승 체크 (1분마다)
    if (this.config.autoEscalation) {
      setInterval(() => this.escalatePriorities(), 60000)
    }
  }

  /**
   * 작업 우선순위 결정
   */
  determinePriority(operation: QueuedOperation): Priority {
    // 1. 실패 횟수가 많으면 우선순위 상승
    if (operation.retryCount >= operation.maxRetries - 1) {
      return 'critical'
    }

    // 2. DELETE 작업은 높은 우선순위
    if (operation.type === 'delete') {
      return 'high'
    }

    // 3. 테이블별 기본 우선순위
    const tablePriority = this.config.tablePriorities[operation.table]
    if (tablePriority) {
      return tablePriority
    }

    // 4. 기본값
    return 'normal'
  }

  /**
   * 작업 추가
   */
  enqueue(operation: QueuedOperation, priority?: Priority): void {
    const finalPriority = priority || this.determinePriority(operation)

    const prioritizedOp: PrioritizedOperation = {
      ...operation,
      priority: finalPriority,
      deadline: this.calculateDeadline(finalPriority)
    }

    const queue = this.queues.get(finalPriority)
    if (queue) {
      queue.push(prioritizedOp)
      this.sortQueue(finalPriority)
    }
  }

  /**
   * 마감 시간 계산
   */
  private calculateDeadline(priority: Priority): Date {
    const now = Date.now()
    const deadlines = {
      critical: 5 * 60 * 1000,      // 5분
      high: 15 * 60 * 1000,          // 15분
      normal: 60 * 60 * 1000,        // 1시간
      low: 24 * 60 * 60 * 1000       // 24시간
    }

    return new Date(now + deadlines[priority])
  }

  /**
   * 큐 정렬 (타임스탬프 순)
   */
  private sortQueue(priority: Priority): void {
    const queue = this.queues.get(priority)
    if (queue) {
      queue.sort((a, b) => {
        // 데드라인이 있으면 우선
        if (a.deadline && b.deadline) {
          return a.deadline.getTime() - b.deadline.getTime()
        }
        // 타임스탬프 순
        return a.timestamp - b.timestamp
      })
    }
  }

  /**
   * 우선순위 자동 상승
   */
  private escalatePriorities(): void {
    const now = Date.now()
    const priorities: Priority[] = ['low', 'normal', 'high']

    for (let i = 0; i < priorities.length; i++) {
      const currentPriority = priorities[i]
      const nextPriority = priorities[i + 1] || 'critical'
      const queue = this.queues.get(currentPriority) || []

      const toEscalate: PrioritizedOperation[] = []
      const remaining: PrioritizedOperation[] = []

      for (const op of queue) {
        const age = now - op.timestamp

        if (age > this.config.escalationThreshold) {
          logger.info('PrioritySyncQueue:escalatePriorities', 'Priority escalated', {
            operationId: op.id,
            from: currentPriority,
            to: nextPriority
          })
          op.priority = nextPriority
          toEscalate.push(op)
        } else {
          remaining.push(op)
        }
      }

      // 큐 업데이트
      this.queues.set(currentPriority, remaining)

      // 상승된 작업들을 다음 큐에 추가
      const nextQueue = this.queues.get(nextPriority) || []
      nextQueue.push(...toEscalate)
      this.queues.set(nextPriority, nextQueue)
      this.sortQueue(nextPriority)
    }
  }

  /**
   * 다음 처리할 작업들 가져오기 (우선순위 기반)
   */
  getNextBatch(batchSize: number = 50): PrioritizedOperation[] {
    const batch: PrioritizedOperation[] = []
    const ratio = this.config.processingRatio

    // 우선순위별 처리 개수 계산
    const counts = {
      critical: Math.ceil(batchSize * ratio.critical /
        (ratio.critical + ratio.high + ratio.normal + ratio.low)),
      high: Math.ceil(batchSize * ratio.high /
        (ratio.critical + ratio.high + ratio.normal + ratio.low)),
      normal: Math.ceil(batchSize * ratio.normal /
        (ratio.critical + ratio.high + ratio.normal + ratio.low)),
      low: Math.ceil(batchSize * ratio.low /
        (ratio.critical + ratio.high + ratio.normal + ratio.low))
    }

    // 우선순위 순서대로 작업 추출
    const priorities: Priority[] = ['critical', 'high', 'normal', 'low']

    for (const priority of priorities) {
      const queue = this.queues.get(priority) || []
      const count = counts[priority]
      const operations = queue.splice(0, Math.min(count, queue.length))
      batch.push(...operations)

      if (batch.length >= batchSize) {
        break
      }
    }

    return batch
  }

  /**
   * 특정 우선순위의 작업 개수
   */
  getQueueSize(priority?: Priority): number {
    if (priority) {
      return this.queues.get(priority)?.length || 0
    }

    let total = 0
    for (const queue of this.queues.values()) {
      total += queue.length
    }
    return total
  }

  /**
   * 우선순위별 상태
   */
  getStatus(): Record<Priority, {
    count: number
    oldest?: Date
    newest?: Date
  }> {
    const status: any = {}

    for (const [priority, queue] of this.queues.entries()) {
      if (queue.length > 0) {
        const sorted = [...queue].sort((a, b) => a.timestamp - b.timestamp)
        status[priority] = {
          count: queue.length,
          oldest: new Date(sorted[0].timestamp),
          newest: new Date(sorted[sorted.length - 1].timestamp)
        }
      } else {
        status[priority] = {
          count: 0
        }
      }
    }

    return status
  }

  /**
   * 의존성 체크
   */
  checkDependencies(operation: PrioritizedOperation): boolean {
    if (!operation.dependencies || operation.dependencies.length === 0) {
      return true
    }

    // 의존하는 작업들이 모두 완료되었는지 확인
    // 실제 구현에서는 완료된 작업 ID를 추적해야 함
    return true
  }

  /**
   * 큐 비우기
   */
  clear(priority?: Priority): void {
    if (priority) {
      this.queues.set(priority, [])
    } else {
      for (const p of this.queues.keys()) {
        this.queues.set(p, [])
      }
    }
  }

  /**
   * 작업 제거
   */
  remove(operationId: string): boolean {
    for (const queue of this.queues.values()) {
      const index = queue.findIndex(op => op.id === operationId)
      if (index !== -1) {
        queue.splice(index, 1)
        return true
      }
    }
    return false
  }

  /**
   * 작업 우선순위 변경
   */
  changePriority(operationId: string, newPriority: Priority): boolean {
    // 현재 위치에서 제거
    let operation: PrioritizedOperation | undefined

    for (const queue of this.queues.values()) {
      const index = queue.findIndex(op => op.id === operationId)
      if (index !== -1) {
        operation = queue.splice(index, 1)[0]
        break
      }
    }

    // 새 우선순위로 추가
    if (operation) {
      operation.priority = newPriority
      operation.deadline = this.calculateDeadline(newPriority)
      this.enqueue(operation, newPriority)
      return true
    }

    return false
  }

  /**
   * 통계 정보
   */
  getStatistics(): {
    totalOperations: number
    byPriority: Record<Priority, number>
    byType: Record<string, number>
    byTable: Record<string, number>
    averageAge: number
    oldestOperation?: PrioritizedOperation
  } {
    const stats: any = {
      totalOperations: 0,
      byPriority: {} as Record<Priority, number>,
      byType: {} as Record<string, number>,
      byTable: {} as Record<string, number>,
      averageAge: 0,
      oldestOperation: undefined
    }

    let totalAge = 0
    let oldestTimestamp = Date.now()
    const now = Date.now()

    for (const [priority, queue] of this.queues.entries()) {
      stats.byPriority[priority] = queue.length
      stats.totalOperations += queue.length

      for (const op of queue) {
        // 타입별 집계
        stats.byType[op.type] = (stats.byType[op.type] || 0) + 1

        // 테이블별 집계
        stats.byTable[op.table] = (stats.byTable[op.table] || 0) + 1

        // 나이 계산
        const age = now - op.timestamp
        totalAge += age

        // 가장 오래된 작업
        if (op.timestamp < oldestTimestamp) {
          oldestTimestamp = op.timestamp
          stats.oldestOperation = op
        }
      }
    }

    if (stats.totalOperations > 0) {
      stats.averageAge = Math.round(totalAge / stats.totalOperations)
    }

    return stats
  }
}