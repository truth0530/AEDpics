import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OfflineQueue, QueuedOperation } from '@/lib/realtime/OfflineQueue'

// IndexedDB mock
const mockIndexedDB = {
  databases: new Map(),
  open: vi.fn((name: string, version: number) => {
    const db = {
      name,
      version,
      objectStoreNames: { contains: vi.fn() },
      createObjectStore: vi.fn(),
      transaction: vi.fn(),
      close: vi.fn()
    }

    const request = {
      result: db,
      error: null,
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any
    }

    setTimeout(() => {
      if (request.onsuccess) request.onsuccess()
    }, 0)

    return request
  })
}

// Navigator mock
const mockNavigator = {
  onLine: true
}

describe('OfflineQueue', () => {
  let queue: OfflineQueue

  beforeEach(() => {
    // Setup mocks
    vi.stubGlobal('indexedDB', mockIndexedDB)
    vi.stubGlobal('navigator', mockNavigator)

    // Reset navigator state
    mockNavigator.onLine = true

    queue = new OfflineQueue({
      dbName: 'test-queue',
      maxRetries: 3,
      autoSync: false
    })
  })

  afterEach(() => {
    queue.destroy()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  describe('Initialization', () => {
    it('should initialize IndexedDB', async () => {
      await queue.initialize()
      expect(mockIndexedDB.open).toHaveBeenCalledWith('test-queue', 1)
    })

    it('should handle initialization errors', async () => {
      mockIndexedDB.open.mockImplementationOnce(() => {
        const request = {
          error: new Error('Failed to open DB'),
          onerror: null as any
        }

        setTimeout(() => {
          if (request.onerror) request.onerror()
        }, 0)

        return request
      })

      await expect(queue.initialize()).rejects.toThrow('Failed to open IndexedDB')
    })
  })

  describe('Queue Operations', () => {
    beforeEach(async () => {
      // Mock successful DB operations
      const mockStore = {
        add: vi.fn().mockImplementation(() => ({
          onsuccess: null as any,
          onerror: null as any,
          result: 'operation-id'
        })),
        get: vi.fn().mockImplementation(() => ({
          onsuccess: null as any,
          onerror: null as any,
          result: null
        })),
        put: vi.fn().mockImplementation(() => ({
          onsuccess: null as any,
          onerror: null as any
        })),
        delete: vi.fn().mockImplementation(() => ({
          onsuccess: null as any,
          onerror: null as any
        })),
        getAll: vi.fn().mockImplementation(() => ({
          onsuccess: null as any,
          onerror: null as any,
          result: []
        })),
        count: vi.fn().mockImplementation(() => ({
          onsuccess: null as any,
          onerror: null as any,
          result: 0
        })),
        index: vi.fn().mockReturnValue({
          getAll: vi.fn().mockImplementation(() => ({
            onsuccess: null as any,
            onerror: null as any,
            result: []
          }))
        })
      }

      const mockTransaction = {
        objectStore: vi.fn().mockReturnValue(mockStore)
      }

      mockIndexedDB.open.mockImplementation(() => {
        const db = {
          transaction: vi.fn().mockReturnValue(mockTransaction),
          close: vi.fn()
        }

        const request = {
          result: db,
          onsuccess: null as any,
          onerror: null as any
        }

        setTimeout(() => {
          if (request.onsuccess) request.onsuccess()
        }, 0)

        return request
      })

      await queue.initialize()
    })

    it('should enqueue operations', async () => {
      const mockAdd = vi.fn().mockImplementation(() => {
        const request = {
          onsuccess: null as any,
          onerror: null as any,
          result: 'test-operation-id'
        }

        setTimeout(() => {
          if (request.onsuccess) request.onsuccess()
        }, 0)

        return request
      })

      // Override the mock for this test
      const db = (queue as any).db
      if (db) {
        const transaction = db.transaction()
        transaction.objectStore().add = mockAdd
      }

      const id = await queue.enqueue('create', 'test_table', { name: 'Test' })

      expect(id).toMatch(/^queue_\d+_/)
      expect(mockAdd).toHaveBeenCalled()
    })

    it('should get pending operations', async () => {
      const mockOperations: QueuedOperation[] = [
        {
          id: 'op-1',
          timestamp: Date.now(),
          type: 'create',
          table: 'test',
          data: { name: 'Test 1' },
          retryCount: 0,
          maxRetries: 3,
          status: 'pending'
        },
        {
          id: 'op-2',
          timestamp: Date.now() + 1000,
          type: 'update',
          table: 'test',
          data: { id: '1', name: 'Test 2' },
          retryCount: 0,
          maxRetries: 3,
          status: 'pending'
        }
      ]

      const mockGetAll = vi.fn().mockImplementation(() => {
        const request = {
          onsuccess: null as any,
          onerror: null as any,
          result: mockOperations
        }

        setTimeout(() => {
          if (request.onsuccess) request.onsuccess()
        }, 0)

        return request
      })

      const db = (queue as any).db
      if (db) {
        const transaction = db.transaction()
        const store = transaction.objectStore()
        store.index().getAll = mockGetAll
      }

      const operations = await queue.getPendingOperations()

      expect(operations).toHaveLength(2)
      expect(operations[0].id).toBe('op-1')
      expect(operations[1].id).toBe('op-2')
    })

    it('should update operation status', async () => {
      const mockOperation: QueuedOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'create',
        table: 'test',
        data: { name: 'Test' },
        retryCount: 0,
        maxRetries: 3,
        status: 'pending'
      }

      const mockGet = vi.fn().mockImplementation(() => {
        const request = {
          onsuccess: null as any,
          onerror: null as any,
          result: mockOperation
        }

        setTimeout(() => {
          if (request.onsuccess) request.onsuccess()
        }, 0)

        return request
      })

      const mockPut = vi.fn().mockImplementation(() => {
        const request = {
          onsuccess: null as any,
          onerror: null as any
        }

        setTimeout(() => {
          if (request.onsuccess) request.onsuccess()
        }, 0)

        return request
      })

      const db = (queue as any).db
      if (db) {
        const transaction = db.transaction()
        const store = transaction.objectStore()
        store.get = mockGet
        store.put = mockPut
      }

      await queue.updateOperation('op-1', {
        status: 'completed',
        syncedAt: Date.now()
      })

      expect(mockGet).toHaveBeenCalledWith('op-1')
      expect(mockPut).toHaveBeenCalled()
    })
  })

  describe('Online/Offline Detection', () => {
    it('should detect online state', () => {
      mockNavigator.onLine = true
      expect(queue.getIsOnline()).toBe(true)
    })

    it('should detect offline state', () => {
      mockNavigator.onLine = false
      const newQueue = new OfflineQueue()
      expect(newQueue.getIsOnline()).toBe(false)
      newQueue.destroy()
    })

    it('should handle online event', () => {
      const onlineCallback = vi.fn()
      queue.subscribe('online', onlineCallback)

      window.dispatchEvent(new Event('online'))

      expect(onlineCallback).toHaveBeenCalledWith({ isOnline: true })
    })

    it('should handle offline event', () => {
      const offlineCallback = vi.fn()
      queue.subscribe('offline', offlineCallback)

      window.dispatchEvent(new Event('offline'))

      expect(offlineCallback).toHaveBeenCalledWith({ isOnline: false })
    })
  })

  describe('Sync Operations', () => {
    it('should sync pending operations when online', async () => {
      mockNavigator.onLine = true

      const mockOperations: QueuedOperation[] = [
        {
          id: 'op-1',
          timestamp: Date.now(),
          type: 'create',
          table: 'test',
          data: { name: 'Test' },
          retryCount: 0,
          maxRetries: 3,
          status: 'pending'
        }
      ]

      const mockGetAll = vi.fn().mockImplementation(() => {
        const request = {
          onsuccess: null as any,
          result: mockOperations
        }

        setTimeout(() => {
          if (request.onsuccess) request.onsuccess()
        }, 0)

        return request
      })

      const db = (queue as any).db
      if (db) {
        const transaction = db.transaction()
        const store = transaction.objectStore()
        store.index().getAll = mockGetAll
      }

      const syncHandler = vi.fn().mockResolvedValue({ success: true })
      const result = await queue.syncPendingOperations(syncHandler)

      expect(syncHandler).toHaveBeenCalledWith(mockOperations[0])
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(0)
    })

    it('should not sync when offline', async () => {
      mockNavigator.onLine = false
      ;(queue as any).isOnline = false

      const syncHandler = vi.fn()
      const result = await queue.syncPendingOperations(syncHandler)

      expect(syncHandler).not.toHaveBeenCalled()
      expect(result.succeeded).toBe(0)
      expect(result.failed).toBe(0)
    })

    it('should handle sync failures with retry', async () => {
      mockNavigator.onLine = true

      const mockOperation: QueuedOperation = {
        id: 'op-1',
        timestamp: Date.now(),
        type: 'create',
        table: 'test',
        data: { name: 'Test' },
        retryCount: 0,
        maxRetries: 3,
        status: 'pending'
      }

      const mockGetAll = vi.fn().mockImplementation(() => ({
        onsuccess: null as any,
        result: [mockOperation]
      }))

      const db = (queue as any).db
      if (db) {
        db.transaction().objectStore().index().getAll = mockGetAll
      }

      const syncHandler = vi.fn().mockRejectedValue(new Error('Sync failed'))
      const result = await queue.syncPendingOperations(syncHandler)

      expect(result.failed).toBe(1)
    })
  })

  describe('Event Subscription', () => {
    it('should subscribe to events', () => {
      const callback = vi.fn()
      const unsubscribe = queue.subscribe('test-event', callback)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should notify listeners', async () => {
      const callback = vi.fn()
      queue.subscribe('enqueued', callback)

      // Trigger an enqueue which should notify listeners
      const mockAdd = vi.fn().mockImplementation(() => {
        const request = {
          onsuccess: null as any,
          result: 'test-id'
        }

        setTimeout(() => {
          if (request.onsuccess) request.onsuccess()
        }, 0)

        return request
      })

      const db = (queue as any).db
      if (db) {
        db.transaction().objectStore().add = mockAdd
      }

      await queue.enqueue('create', 'test', { data: 'test' })

      expect(callback).toHaveBeenCalled()
    })

    it('should unsubscribe from events', () => {
      const callback = vi.fn()
      const unsubscribe = queue.subscribe('test-event', callback)

      unsubscribe()

      // Notify should not call the unsubscribed callback
      ;(queue as any).notifyListeners('test-event', {})

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('Queue Management', () => {
    it('should get queue size', async () => {
      const mockCount = vi.fn().mockImplementation(() => ({
        onsuccess: null as any,
        result: 5
      }))

      const db = (queue as any).db
      if (db) {
        db.transaction().objectStore().count = mockCount
      }

      const size = await queue.getQueueSize()
      expect(size).toBe(5)
    })

    it('should clear queue', async () => {
      const mockClear = vi.fn().mockImplementation(() => ({
        onsuccess: null as any
      }))

      const db = (queue as any).db
      if (db) {
        db.transaction().objectStore().clear = mockClear
      }

      await queue.clearQueue()
      expect(mockClear).toHaveBeenCalled()
    })

    it('should enforce max queue size', async () => {
      const mockCount = vi.fn().mockImplementation(() => ({
        onsuccess: null as any,
        result: 1000
      }))

      const db = (queue as any).db
      if (db) {
        db.transaction().objectStore().count = mockCount
      }

      await expect(
        queue.enqueue('create', 'test', { data: 'test' })
      ).rejects.toThrow('Queue is full')
    })
  })

  describe('Auto Sync', () => {
    it('should start auto sync when enabled', async () => {
      vi.useFakeTimers()

      const autoSyncQueue = new OfflineQueue({
        autoSync: true,
        syncInterval: 1000
      })

      await autoSyncQueue.initialize()

      const callback = vi.fn()
      autoSyncQueue.subscribe('auto-sync', callback)

      vi.advanceTimersByTime(1000)

      expect(callback).toHaveBeenCalled()

      autoSyncQueue.destroy()
      vi.useRealTimers()
    })

    it('should stop auto sync', () => {
      vi.useFakeTimers()

      const autoSyncQueue = new OfflineQueue({
        autoSync: false
      })

      autoSyncQueue.stopAutoSync()

      const callback = vi.fn()
      autoSyncQueue.subscribe('auto-sync', callback)

      vi.advanceTimersByTime(30000)

      expect(callback).not.toHaveBeenCalled()

      autoSyncQueue.destroy()
      vi.useRealTimers()
    })
  })
})