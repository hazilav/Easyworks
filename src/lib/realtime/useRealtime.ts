'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface RealtimeEventData {
  id: string;
  type: string;
  payload: any;
  timestamp: string;
  channel?: string;
}

export interface UseRealtimeOptions {
  channel: 'admin' | 'customer';
  userId?: string;
  token?: string;
  enabled?: boolean;
  onEvent?: (event: RealtimeEventData) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useRealtime({
  channel,
  userId,
  token,
  enabled = true,
  onEvent,
  onConnect,
  onDisconnect,
}: UseRealtimeOptions) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'reconnecting' | 'fallback_polling'
  >('idle');
  const [lastEvent, setLastEvent] = useState<RealtimeEventData | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventTimeRef = useRef<string>(new Date().toISOString());
  const isMountedRef = useRef<boolean>(true);

  // Keep latest callbacks in ref to avoid reconnecting on function re-renders
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onConnectRef = useRef(onConnect);
  onConnectRef.current = onConnect;
  const onDisconnectRef = useRef(onDisconnect);
  onDisconnectRef.current = onDisconnect;

  const cleanupConnections = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  // Polling fallback
  const startFallbackPolling = useCallback(() => {
    if (!isMountedRef.current || pollingTimerRef.current) return;
    setConnectionStatus('fallback_polling');

    const poll = async () => {
      try {
        const params = new URLSearchParams({
          channel,
          since: lastEventTimeRef.current,
        });
        if (userId) params.set('userId', userId);
        if (token) params.set('token', token);

        const res = await fetch(`/api/realtime/poll?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.success && Array.isArray(data.data?.events)) {
          for (const ev of data.data.events) {
            lastEventTimeRef.current = ev.createdAt || new Date().toISOString();
            const normalized: RealtimeEventData = {
              id: ev.id,
              type: ev.eventType,
              payload: ev.payload,
              timestamp: ev.createdAt,
              channel: ev.channel,
            };
            setLastEvent(normalized);
            onEventRef.current?.(normalized);
          }
        }
      } catch {
        // Fallback polling error, silent retry
      }
    };

    poll();
    pollingTimerRef.current = setInterval(poll, 8000);
  }, [channel, userId, token]);

  const connectSSE = useCallback(() => {
    if (!enabled || !isMountedRef.current) return;
    if (channel === 'customer' && !userId) return;

    cleanupConnections();
    setConnectionStatus(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting');

    const params = new URLSearchParams({ channel });
    if (userId) params.set('userId', userId);
    if (token) params.set('token', token);

    const streamUrl = `/api/realtime/stream?${params.toString()}`;

    try {
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isMountedRef.current) return;
        reconnectAttemptRef.current = 0;
        setIsConnected(true);
        setConnectionStatus('connected');
        onConnectRef.current?.();
      };

      es.onmessage = (e) => {
        if (!isMountedRef.current || !e.data) return;
        try {
          const parsed = JSON.parse(e.data);
          const eventItem: RealtimeEventData = {
            id: parsed.id || `evt_${Date.now()}`,
            type: parsed.type || 'MESSAGE',
            payload: parsed.payload || {},
            timestamp: parsed.timestamp || new Date().toISOString(),
            channel: parsed.channel,
          };
          lastEventTimeRef.current = eventItem.timestamp;
          setLastEvent(eventItem);
          onEventRef.current?.(eventItem);
        } catch {
          // Non-JSON message (e.g. heartbeat)
        }
      };

      // Listen for specific event types
      const customEventTypes = [
        'CONNECTED',
        'CUSTOMER_SIGNUP',
        'PAYMENT_SUBMITTED',
        'PAYMENT_APPROVED',
        'PAYMENT_REJECTED',
        'PAYMENT_STATUS_CHANGED',
        'SUBSCRIPTION_UPDATED',
        'PDF_DOWNLOADED',
        'PDF_USAGE_UPDATED',
        'DOCUMENT_CREATED',
        'DOCUMENT_UPDATED',
        'STATS_UPDATED',
      ];

      for (const evType of customEventTypes) {
        es.addEventListener(evType, (e: any) => {
          if (!isMountedRef.current || !e.data) return;
          try {
            const parsed = JSON.parse(e.data);
            const eventItem: RealtimeEventData = {
              id: parsed.id || `evt_${Date.now()}`,
              type: parsed.type || evType,
              payload: parsed.payload || {},
              timestamp: parsed.timestamp || new Date().toISOString(),
              channel: parsed.channel,
            };
            lastEventTimeRef.current = eventItem.timestamp;
            setLastEvent(eventItem);
            onEventRef.current?.(eventItem);
          } catch {
            // Heartbeat or parse error
          }
        });
      }

      es.onerror = () => {
        if (!isMountedRef.current) return;
        es.close();
        eventSourceRef.current = null;
        setIsConnected(false);
        onDisconnectRef.current?.();

        reconnectAttemptRef.current += 1;

        // If repeated failures occur (>= 3), start fallback polling
        if (reconnectAttemptRef.current >= 3) {
          startFallbackPolling();
        }

        // Exponential backoff with jitter: 1s, 2s, 4s, 8s... max 30s
        const backoff = Math.min(30000, 1000 * Math.pow(2, Math.min(reconnectAttemptRef.current, 5)));
        const jitter = Math.floor(Math.random() * 1000);
        const delay = backoff + jitter;

        setConnectionStatus('reconnecting');
        reconnectTimerRef.current = setTimeout(() => {
          connectSSE();
        }, delay);
      };
    } catch {
      // EventSource instantiation failed, fallback immediately
      startFallbackPolling();
    }
  }, [channel, userId, token, enabled, cleanupConnections, startFallbackPolling]);

  useEffect(() => {
    isMountedRef.current = true;
    if (enabled) {
      connectSSE();
    }

    return () => {
      isMountedRef.current = false;
      cleanupConnections();
    };
  }, [enabled, channel, userId, token, connectSSE, cleanupConnections]);

  return {
    isConnected,
    connectionStatus,
    lastEvent,
    reconnect: connectSSE,
  };
}
