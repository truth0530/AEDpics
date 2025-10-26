/**
 * 배치 동기화 매니저
 * 여러 작업을 묶어서 효율적으로 동기화
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { QueuedOperation } from './OfflineQueue'

export interface BatchOperation {
  operations: QueuedOperation[]
  tableName: string
  type: 'create' | 'update' | 'delete' | 'mixed'
}

export interface BatchResult {
  batchId: string
  totalOperations: number
  successful: number
  failed: number
  errors: Array<{ operationId: string; error: string }>
  duration: number
}

export interface BatchConfig {
  maxBatchSize?: number
  maxBatchWaitTime?: number
  compressData?: boolean
  retryFailedBatches?: boolean
  priorityTables?: string[]
}

export class BatchSyncManager {
  private supabase: SupabaseClient
  private config: Required<BatchConfig>
  private batchQueue: Map<string, BatchOperation> = new Map()
  private batchTimer: NodeJS.Timeout | null = null

  constructor(supabase: SupabaseClient, config: BatchConfig = {}) {
    this.supabase = supabase
    this.config = {
      maxBatchSize: config.maxBatchSize || 50,
      maxBatchWaitTime: config.maxBatchWaitTime || 5000, // 5초
      compressData: config.compressData !== false,
      retryFailedBatches: config.retryFailedBatches !== false,
      priorityTables: config.priorityTables || [
        'inspections',
        'inspection_schedule_entries',
        'team_tasks'
      ]
    }
  }

  /**
   * 작업들을 배치로 그룹화
   */
  groupOperationsIntoBatches(operations: QueuedOperation[]): BatchOperation[] {
    const batches: Map<string, BatchOperation> = new Map()

    // 우선순위 테이블 먼저 처리
    const sortedOperations = [...operations].sort((a, b) => {
      const aPriority = this.config.priorityTables.indexOf(a.table)
      const bPriority = this.config.priorityTables.indexOf(b.table)

      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority
      }
      if (aPriority !== -1) return -1
      if (bPriority !== -1) return 1

      return a.timestamp - b.timestamp
    })

    for (const operation of sortedOperations) {
      const key = `${operation.table}_${operation.type}`

      if (!batches.has(key)) {
        batches.set(key, {
          operations: [],
          tableName: operation.table,
          type: operation.type
        })
      }

      const batch = batches.get(key)!

      // 배치 크기 제한
      if (batch.operations.length < this.config.maxBatchSize) {
        batch.operations.push(operation)
      } else {
        // 새 배치 생성
        const newKey = `${key}_${Date.now()}`
        batches.set(newKey, {
          operations: [operation],
          tableName: operation.table,
          type: operation.type
        })
      }
    }

    return Array.from(batches.values())
  }

  /**
   * 배치 실행
   */
  async executeBatch(batch: BatchOperation): Promise<BatchResult> {
    const startTime = Date.now()
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    console.log(`배치 실행: ${batch.tableName} - ${batch.type} (${batch.operations.length}개)`)

    const results = {
      batchId,
      totalOperations: batch.operations.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ operationId: string; error: string }>,
      duration: 0
    }

    try {
      switch (batch.type) {
        case 'create':
          await this.executeBatchCreate(batch, results)
          break
        case 'update':
          await this.executeBatchUpdate(batch, results)
          break
        case 'delete':
          await this.executeBatchDelete(batch, results)
          break
        default:
          await this.executeMixedBatch(batch, results)
      }
    } catch (error) {
      console.error('배치 실행 중 오류:', error)
      results.failed = batch.operations.length
      results.errors.push({
        operationId: batchId,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    }

    results.duration = Date.now() - startTime
    console.log(`배치 완료: ${results.successful}개 성공, ${results.failed}개 실패 (${results.duration}ms)`)

    return results
  }

  /**
   * 배치 CREATE 실행
   */
  private async executeBatchCreate(
    batch: BatchOperation,
    results: BatchResult
  ): Promise<void> {
    // 데이터 압축 (선택적)
    const data = batch.operations.map(op => op.data)
    const compressedData = this.config.compressData
      ? this.compressData(data)
      : data

    try {
      const { error } = await this.supabase
        .from(batch.tableName)
        .insert(compressedData)
        .select()

      if (error) {
        throw error
      }

      results.successful = batch.operations.length
    } catch {
      // 개별 실행으로 폴백
      for (const operation of batch.operations) {
        try {
          const { error: opError } = await this.supabase
            .from(batch.tableName)
            .insert(operation.data)

          if (opError) {
            results.failed++
            results.errors.push({
              operationId: operation.id,
              error: opError.message
            })
          } else {
            results.successful++
          }
        } catch (opError) {
          results.failed++
          results.errors.push({
            operationId: operation.id,
            error: opError instanceof Error ? opError.message : '알 수 없는 오류'
          })
        }
      }
    }
  }

  /**
   * 배치 UPDATE 실행
   */
  private async executeBatchUpdate(
    batch: BatchOperation,
    results: BatchResult
  ): Promise<void> {
    // UPDATE는 개별 처리 (Supabase는 배치 업데이트 제한적)
    for (const operation of batch.operations) {
      try {
        const { id, ...updateData } = operation.data

        const { error } = await this.supabase
          .from(batch.tableName)
          .update(updateData)
          .eq('id', id)

        if (error) {
          results.failed++
          results.errors.push({
            operationId: operation.id,
            error: error.message
          })
        } else {
          results.successful++
        }
      } catch (error) {
        results.failed++
        results.errors.push({
          operationId: operation.id,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        })
      }
    }
  }

  /**
   * 배치 DELETE 실행
   */
  private async executeBatchDelete(
    batch: BatchOperation,
    results: BatchResult
  ): Promise<void> {
    const ids = batch.operations.map(op => op.data.id).filter(Boolean)

    if (ids.length === 0) {
      results.failed = batch.operations.length
      return
    }

    try {
      const { error } = await this.supabase
        .from(batch.tableName)
        .delete()
        .in('id', ids)

      if (error) {
        throw error
      }

      results.successful = batch.operations.length
    } catch {
      // 개별 실행으로 폴백
      for (const operation of batch.operations) {
        try {
          const { error: opError } = await this.supabase
            .from(batch.tableName)
            .delete()
            .eq('id', operation.data.id)

          if (opError) {
            results.failed++
            results.errors.push({
              operationId: operation.id,
              error: opError.message
            })
          } else {
            results.successful++
          }
        } catch (opError) {
          results.failed++
          results.errors.push({
            operationId: operation.id,
            error: opError instanceof Error ? opError.message : '알 수 없는 오류'
          })
        }
      }
    }
  }

  /**
   * 혼합 배치 실행
   */
  private async executeMixedBatch(
    batch: BatchOperation,
    _results: BatchResult
  ): Promise<void> {
    // 타입별로 재그룹화
    const typeGroups = new Map<string, QueuedOperation[]>()

    for (const op of batch.operations) {
      if (!typeGroups.has(op.type)) {
        typeGroups.set(op.type, [])
      }
      typeGroups.get(op.type)!.push(op)
    }

    // 각 타입별로 실행
    for (const [type, ops] of typeGroups.entries()) {
      const subBatch: BatchOperation = {
        operations: ops,
        tableName: batch.tableName,
        type: type as any
      }

      await this.executeBatch(subBatch)
    }
  }

  /**
   * 데이터 압축 (간단한 구현)
   */
  private compressData(data: any[]): any[] {
    // 실제로는 더 복잡한 압축 알고리즘 사용
    // 여기서는 중복 제거만 구현
    const seen = new Set()
    return data.filter(item => {
      const key = JSON.stringify(item)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  /**
   * 청크 단위로 데이터 분할
   */
  splitIntoChunks<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []

    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }

    return chunks
  }

  /**
   * 배치 동기화 실행 (메인 엔트리)
   */
  async syncBatches(operations: QueuedOperation[]): Promise<{
    totalBatches: number
    successfulBatches: number
    failedBatches: number
    totalOperations: number
    successfulOperations: number
    failedOperations: number
    duration: number
  }> {
    const startTime = Date.now()
    const batches = this.groupOperationsIntoBatches(operations)

    console.log(`총 ${batches.length}개 배치로 ${operations.length}개 작업 동기화 시작`)

    let successfulBatches = 0
    let failedBatches = 0
    let successfulOperations = 0
    let failedOperations = 0

    // 청크로 분할하여 순차 실행
    const batchChunks = this.splitIntoChunks(batches, 5) // 5개씩 동시 실행

    for (const chunk of batchChunks) {
      const batchPromises = chunk.map(batch => this.executeBatch(batch))
      const results = await Promise.all(batchPromises)

      for (const result of results) {
        if (result.failed === 0) {
          successfulBatches++
        } else if (result.successful === 0) {
          failedBatches++
        } else {
          successfulBatches++ // 부분 성공도 성공으로 간주
        }

        successfulOperations += result.successful
        failedOperations += result.failed
      }
    }

    const duration = Date.now() - startTime

    return {
      totalBatches: batches.length,
      successfulBatches,
      failedBatches,
      totalOperations: operations.length,
      successfulOperations,
      failedOperations,
      duration
    }
  }
}