/**
 * useRealtimeAssignments Hook
 *
 * Features:
 * - Subscribe to assignment updates
 * - Auto-refresh on changes
 * - Connection status
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { getRealtimeClient, RealtimeEvent } from '@/lib/realtime/socket-client';

interface AssignmentUpdate {
  id: number;
  equipmentSerial: string;
  assignedTo: number;
  status: string;
  timestamp: string;
}

export function useRealtimeAssignments() {
  const [isConnected, setIsConnected] = useState(false);
  const [latestUpdate, setLatestUpdate] = useState<AssignmentUpdate | null>(null);

  useEffect(() => {
    const client = getRealtimeClient();

    // Subscribe to connection status
    const unsubConnection = client.subscribe('connection', (data: any) => {
      setIsConnected(data.status === 'connected');
    });

    // Subscribe to assignment changes
    const unsubAssignment = client.subscribe('assignment:change', (event: any) => {
      const realtimeEvent = event as RealtimeEvent;

      console.log('[useRealtimeAssignments] Assignment update received:', realtimeEvent);

      if (realtimeEvent.type === 'created' || realtimeEvent.type === 'updated') {
        setLatestUpdate({
          id: realtimeEvent.data.id,
          equipmentSerial: realtimeEvent.data.equipmentSerial,
          assignedTo: realtimeEvent.data.assignedTo,
          status: realtimeEvent.data.status,
          timestamp: realtimeEvent.timestamp,
        });
      }
    });

    return () => {
      unsubConnection();
      unsubAssignment();
    };
  }, []);

  const refreshAssignments = useCallback(() => {
    setLatestUpdate(null);
  }, []);

  return {
    isConnected,
    latestUpdate,
    refreshAssignments,
  };
}
