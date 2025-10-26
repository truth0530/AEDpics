import { useState, useCallback, useEffect } from 'react'
import { useRealtime } from './useRealtime'
import { RealtimeEvent } from '@/packages/types/team'

interface UseRealtimeSyncOptions<T> {
  table: 'inspection_schedule_entries' | 'inspections'
  initialData?: T[]
  onDataChange?: (data: T[]) => void
  enabled?: boolean
}

interface UseRealtimeSyncReturn<T> {
  data: T[]
  isConnected: boolean
  addItem: (item: T) => void
  updateItem: (id: string, updates: Partial<T>) => void
  removeItem: (id: string) => void
  refreshData: () => void
}

export function useRealtimeSync<T extends { id: string }>(
  options: UseRealtimeSyncOptions<T>
): UseRealtimeSyncReturn<T> {
  const { table, initialData = [], onDataChange, enabled = true } = options
  const [data, setData] = useState<T[]>(initialData)

  const handleDataChange = useCallback((event: RealtimeEvent<T>) => {
    if (event.table !== table) return

    setData(prevData => {
      let newData = [...prevData]

      switch (event.type) {
        case 'created':
          if (event.data) {
            const exists = newData.some(item => item.id === event.data.id)
            if (!exists) {
              newData.push(event.data as T)
            }
          }
          break

        case 'updated':
          if (event.data) {
            const index = newData.findIndex(item => item.id === event.data.id)
            if (index !== -1) {
              newData[index] = { ...newData[index], ...event.data }
            } else {
              newData.push(event.data as T)
            }
          }
          break

        case 'deleted':
          if (event.data) {
            newData = newData.filter(item => item.id !== event.data.id)
          }
          break
      }

      if (onDataChange) {
        onDataChange(newData)
      }

      return newData
    })
  }, [table, onDataChange])

  const { isConnected, broadcast } = useRealtime({
    autoConnect: enabled,
    onScheduleChange: enabled && table === 'inspection_schedule_entries' ? handleDataChange : undefined,
    onInspectionChange: enabled && table === 'inspections' ? handleDataChange : undefined
  })

  const addItem = useCallback((item: T) => {
    setData(prev => {
      const exists = prev.some(i => i.id === item.id)
      if (!exists) {
        const newData = [...prev, item]
        if (onDataChange) {
          onDataChange(newData)
        }
        return newData
      }
      return prev
    })

    // Broadcast the change
    if (enabled) {
      broadcast(`${table}:created`, item)
    }
  }, [table, broadcast, onDataChange, enabled])

  const updateItem = useCallback((id: string, updates: Partial<T>) => {
    setData(prev => {
      const newData = prev.map(item =>
        item.id === id ? { ...item, ...updates } : item
      )
      if (onDataChange) {
        onDataChange(newData)
      }
      return newData
    })

    // Broadcast the change
    if (enabled) {
      broadcast(`${table}:updated`, { id, ...updates })
    }
  }, [table, broadcast, onDataChange, enabled])

  const removeItem = useCallback((id: string) => {
    setData(prev => {
      const newData = prev.filter(item => item.id !== id)
      if (onDataChange) {
        onDataChange(newData)
      }
      return newData
    })

    // Broadcast the change
    if (enabled) {
      broadcast(`${table}:deleted`, { id })
    }
  }, [table, broadcast, onDataChange, enabled])

  const refreshData = useCallback(() => {
    // This would typically fetch fresh data from the server
    // For now, we'll just trigger a re-render
    setData(prev => [...prev])
  }, [])

  // Update data when initialData changes
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      setData(initialData)
    }
  }, [initialData])

  return {
    data,
    isConnected: enabled ? isConnected : false,
    addItem,
    updateItem,
    removeItem,
    refreshData
  }
}
