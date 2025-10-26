import { createHash } from 'crypto'

export interface VersionedEntity {
  id: string
  version?: number
  updated_at?: Date | string
  checksum?: string
}

export interface ConflictInfo {
  type: 'version' | 'timestamp' | 'checksum' | 'concurrent'
  localVersion: number | string
  remoteVersion: number | string
  field?: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

export class ConflictDetector {
  /**
   * Detect version-based conflicts
   */
  detectVersionConflict<T extends VersionedEntity>(
    local: T,
    remote: T
  ): ConflictInfo | null {
    if (!local.version || !remote.version) return null

    if (local.version !== remote.version) {
      return {
        type: 'version',
        localVersion: local.version,
        remoteVersion: remote.version,
        description: `Version mismatch: local v${local.version} vs remote v${remote.version}`,
        severity: remote.version > local.version ? 'high' : 'medium'
      }
    }

    return null
  }

  /**
   * Detect timestamp-based conflicts
   */
  detectTimestampConflict<T extends VersionedEntity>(
    local: T,
    remote: T,
    thresholdMs: number = 1000
  ): ConflictInfo | null {
    if (!local.updated_at || !remote.updated_at) return null

    const localTime = new Date(local.updated_at).getTime()
    const remoteTime = new Date(remote.updated_at).getTime()

    // If updates happened within threshold, likely concurrent
    if (Math.abs(localTime - remoteTime) < thresholdMs) {
      return {
        type: 'concurrent',
        localVersion: new Date(local.updated_at).toISOString(),
        remoteVersion: new Date(remote.updated_at).toISOString(),
        description: 'Concurrent modifications detected',
        severity: 'medium'
      }
    }

    // If remote is newer but we have local changes
    if (remoteTime > localTime) {
      return {
        type: 'timestamp',
        localVersion: new Date(local.updated_at).toISOString(),
        remoteVersion: new Date(remote.updated_at).toISOString(),
        description: 'Remote has newer changes',
        severity: 'low'
      }
    }

    return null
  }

  /**
   * Detect checksum-based conflicts
   */
  detectChecksumConflict<T extends VersionedEntity>(
    local: T,
    remote: T
  ): ConflictInfo | null {
    const localChecksum = this.calculateChecksum(local)
    const remoteChecksum = this.calculateChecksum(remote)

    if (localChecksum !== remoteChecksum) {
      return {
        type: 'checksum',
        localVersion: localChecksum.substring(0, 8),
        remoteVersion: remoteChecksum.substring(0, 8),
        description: 'Data integrity mismatch',
        severity: 'high'
      }
    }

    return null
  }

  /**
   * Detect field-level conflicts
   */
  detectFieldConflicts<T extends Record<string, any>>(
    local: T,
    remote: T,
    original?: T
  ): ConflictInfo[] {
    const conflicts: ConflictInfo[] = []
    const fields = new Set([
      ...Object.keys(local),
      ...Object.keys(remote)
    ])

    fields.forEach(field => {
      // Skip metadata fields
      if (['id', 'created_at', 'updated_at', 'version'].includes(field)) {
        return
      }

      const localValue = local[field]
      const remoteValue = remote[field]
      const originalValue = original?.[field]

      // Both changed the same field differently
      if (
        original &&
        localValue !== originalValue &&
        remoteValue !== originalValue &&
        localValue !== remoteValue
      ) {
        conflicts.push({
          type: 'concurrent',
          field,
          localVersion: String(localValue),
          remoteVersion: String(remoteValue),
          description: `Field '${field}' has conflicting changes`,
          severity: this.getFieldSeverity(field)
        })
      }
    })

    return conflicts
  }

  /**
   * Calculate checksum for an entity
   */
  private calculateChecksum(entity: any): string {
    // Remove metadata fields for checksum
     
    const { id, created_at, updated_at, version, checksum, ...data } = entity
    const json = JSON.stringify(data, Object.keys(data).sort())
    return createHash('sha256').update(json).digest('hex')
  }

  /**
   * Determine field conflict severity
   */
  private getFieldSeverity(field: string): 'low' | 'medium' | 'high' {
    // Critical fields
    if (['status', 'priority', 'assigned_to'].includes(field)) {
      return 'high'
    }
    // Important fields
    if (['title', 'scheduled_for', 'device_id'].includes(field)) {
      return 'medium'
    }
    // Other fields
    return 'low'
  }

  /**
   * Comprehensive conflict detection
   */
  detectConflicts<T extends VersionedEntity & Record<string, any>>(
    local: T,
    remote: T,
    original?: T
  ): ConflictInfo[] {
    const conflicts: ConflictInfo[] = []

    // Version conflict
    const versionConflict = this.detectVersionConflict(local, remote)
    if (versionConflict) conflicts.push(versionConflict)

    // Timestamp conflict
    const timestampConflict = this.detectTimestampConflict(local, remote)
    if (timestampConflict) conflicts.push(timestampConflict)

    // Field-level conflicts
    if (original) {
      const fieldConflicts = this.detectFieldConflicts(local, remote, original)
      conflicts.push(...fieldConflicts)
    }

    return conflicts
  }

  /**
   * Determine if conflicts can be auto-resolved
   */
  canAutoResolve(conflicts: ConflictInfo[]): boolean {
    // Can't auto-resolve if there are high severity conflicts
    if (conflicts.some(c => c.severity === 'high')) {
      return false
    }

    // Can't auto-resolve if there are multiple medium severity conflicts
    const mediumConflicts = conflicts.filter(c => c.severity === 'medium')
    if (mediumConflicts.length > 1) {
      return false
    }

    return true
  }

  /**
   * Suggest resolution strategy
   */
  suggestResolution(
    conflicts: ConflictInfo[]
  ): 'auto-merge' | 'remote-wins' | 'local-wins' | 'manual' {
    if (conflicts.length === 0) {
      return 'auto-merge'
    }

    if (!this.canAutoResolve(conflicts)) {
      return 'manual'
    }

    // If only timestamp conflicts, use newer
    if (conflicts.every(c => c.type === 'timestamp')) {
      return 'remote-wins'
    }

    // If only low severity conflicts
    if (conflicts.every(c => c.severity === 'low')) {
      return 'auto-merge'
    }

    return 'manual'
  }
}