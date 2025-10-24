/**
 * useRealtimeInspections Hook
 *
 * Features:
 * - Subscribe to inspection updates
 * - Auto-refresh on changes
 * - Connection status
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { getRealtimeClient, RealtimeEvent } from '@/lib/realtime/socket-client';

interface InspectionUpdate {
  id: number;
  deviceId: number;
  status: string;
  inspectorId: number;
  timestamp: string;
}

export function useRealtimeInspections() {
  const [isConnected, setIsConnected] = useState(false);
  const [latestUpdate, setLatestUpdate] = useState<InspectionUpdate | null>(null);

  useEffect(() => {
    const client = getRealtimeClient();

    // Subscribe to connection status
    const unsubConnection = client.subscribe('connection', (data: any) => {
      setIsConnected(data.status === 'connected');
    });

    // Subscribe to inspection changes
    const unsubInspection = client.subscribe('inspection:change', (event: any) => {
      const realtimeEvent = event as RealtimeEvent;

      console.log('[useRealtimeInspections] Inspection update received:', realtimeEvent);

      if (realtimeEvent.type === 'created' || realtimeEvent.type === 'updated') {
        setLatestUpdate({
          id: realtimeEvent.data.id,
          deviceId: realtimeEvent.data.deviceId,
          status: realtimeEvent.data.status,
          inspectorId: realtimeEvent.data.inspectorId,
          timestamp: realtimeEvent.timestamp,
        });
      }
    });

    return () => {
      unsubConnection();
      unsubInspection();
    };
  }, []);

  const refreshInspections = useCallback(() => {
    // Trigger a refresh by clearing latest update
    setLatestUpdate(null);
  }, []);

  return {
    isConnected,
    latestUpdate,
    refreshInspections,
  };
}
