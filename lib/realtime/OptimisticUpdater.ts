export interface OptimisticUpdate<T> {
  id: string
  timestamp: number
  type: 'create' | 'update' | 'delete'
  entityId: string
  entityType: string
  previousValue?: T
  newValue?: T
  status: 'pending' | 'success' | 'failed' | 'conflict'
  retryCount: number
  maxRetries: number
  conflictData?: T
  error?: Error
}

export interface ConflictResolutionStrategy {
  type: 'last-write-wins' | 'first-write-wins' | 'merge' | 'manual'
  mergeFunction?: (local: any, remote: any) => any
}

export class OptimisticUpdater<T extends { id: string; updated_at?: Date | string }> {
  private pendingUpdates: Map<string, OptimisticUpdate<T>> = new Map()
  private rollbackHandlers: Map<string, () => void> = new Map()
  private conflictStrategy: ConflictResolutionStrategy

  constructor(
    strategy: ConflictResolutionStrategy = { type: 'last-write-wins' }
  ) {
    this.conflictStrategy = strategy
  }

  /**
   * Apply optimistic update immediately
   */
  applyOptimisticUpdate(
    entityId: string,
    newValue: Partial<T>,
    previousValue: T,
    updateUI: (value: T) => void
  ): string {
    const updateId = `opt_${Date.now()}_${Math.random()}`
    const mergedValue = { ...previousValue, ...newValue, updated_at: new Date() } as T

    // Apply to UI immediately
    updateUI(mergedValue)

    // Store update for tracking
    const update: OptimisticUpdate<T> = {
      id: updateId,
      timestamp: Date.now(),
      type: 'update',
      entityId,
      entityType: 'task',
      previousValue,
      newValue: mergedValue,
      status: 'pending',
      retryCount: 0,
      maxRetries: 3
    }

    this.pendingUpdates.set(updateId, update)

    // Store rollback handler
    this.rollbackHandlers.set(updateId, () => {
      updateUI(previousValue)
    })

    return updateId
  }

  /**
   * Confirm successful server update
   */
  confirmUpdate(updateId: string): void {
    const update = this.pendingUpdates.get(updateId)
    if (!update) return

    update.status = 'success'

    // Clean up
    this.pendingUpdates.delete(updateId)
    this.rollbackHandlers.delete(updateId)
  }

  /**
   * Handle update failure
   */
  handleFailure(
    updateId: string,
    error: Error,
    retry: boolean = true
  ): boolean {
    const update = this.pendingUpdates.get(updateId)
    if (!update) return false

    if (retry && update.retryCount < update.maxRetries) {
      update.retryCount++
      update.status = 'pending'
      return true // Will retry
    }

    update.status = 'failed'
    update.error = error

    // Execute rollback
    this.rollback(updateId)
    return false // Won't retry
  }

  /**
   * Handle conflict detection
   */
  handleConflict(
    updateId: string,
    localValue: T,
    remoteValue: T,
    resolveCallback: (resolved: T) => void
  ): void {
    const update = this.pendingUpdates.get(updateId)
    if (!update) return

    update.status = 'conflict'
    update.conflictData = remoteValue

    let resolvedValue: T

    switch (this.conflictStrategy.type) {
      case 'last-write-wins':
        // Use remote value (server wins)
        resolvedValue = remoteValue
        break

      case 'first-write-wins':
        // Keep local value
        resolvedValue = localValue
        break

      case 'merge':
        // Use custom merge function
        if (this.conflictStrategy.mergeFunction) {
          resolvedValue = this.conflictStrategy.mergeFunction(localValue, remoteValue)
        } else {
          // Default merge: combine non-conflicting fields
          resolvedValue = this.defaultMerge(localValue, remoteValue)
        }
        break

      case 'manual':
        // Trigger manual resolution UI
        this.triggerManualResolution(updateId, localValue, remoteValue, resolveCallback)
        return
    }

    resolveCallback(resolvedValue)
    this.confirmUpdate(updateId, resolvedValue)
  }

  /**
   * Rollback optimistic update
   */
  private rollback(updateId: string): void {
    const rollbackHandler = this.rollbackHandlers.get(updateId)
    if (rollbackHandler) {
      rollbackHandler()
    }

    // Clean up
    this.pendingUpdates.delete(updateId)
    this.rollbackHandlers.delete(updateId)
  }

  /**
   * Default merge strategy
   */
  private defaultMerge(local: T, remote: T): T {
    const localTime = new Date(local.updated_at || 0).getTime()
    const remoteTime = new Date(remote.updated_at || 0).getTime()

    // Use the more recent update
    return remoteTime > localTime ? remote : local
  }

  /**
   * Trigger manual conflict resolution
   */
  private triggerManualResolution(
    updateId: string,
    local: T,
    remote: T,
    callback: (resolved: T) => void
  ): void {
    // This would trigger a UI modal for manual resolution
    // For now, we'll use a custom event
    const event = new CustomEvent('conflict-resolution-needed', {
      detail: {
        updateId,
        local,
        remote,
        callback
      }
    })
    window.dispatchEvent(event)
  }

  /**
   * Get all pending updates
   */
  getPendingUpdates(): OptimisticUpdate<T>[] {
    return Array.from(this.pendingUpdates.values())
  }

  /**
   * Clear all pending updates
   */
  clearPending(): void {
    // Rollback all pending updates
    this.pendingUpdates.forEach((_, updateId) => {
      this.rollback(updateId)
    })
  }

  /**
   * Check if there are pending updates
   */
  hasPendingUpdates(): boolean {
    return this.pendingUpdates.size > 0
  }

  /**
   * Get conflict count
   */
  getConflictCount(): number {
    return Array.from(this.pendingUpdates.values()).filter(
      u => u.status === 'conflict'
    ).length
  }
}