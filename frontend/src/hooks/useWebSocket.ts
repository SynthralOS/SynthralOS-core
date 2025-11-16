import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface ExecutionEvent {
  type: 'node_start' | 'node_complete' | 'node_error' | 'execution_start' | 'execution_complete' | 'execution_paused' | 'execution_resumed';
  executionId: string;
  nodeId?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

export function useWebSocket(executionId: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const eventHandlersRef = useRef<Map<string, Set<(event: ExecutionEvent) => void>>>(new Map());

  useEffect(() => {
    if (!executionId) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Connect to WebSocket server
    // Use window.location.origin if VITE_API_URL is empty (when frontend is served from backend)
    const apiUrl = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000');
    const newSocket = io(apiUrl, {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      
      // Subscribe to execution events
      newSocket.emit('execution:subscribe', executionId);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('execution:event', (event: ExecutionEvent) => {
      console.log('Execution event received:', event);
      setEvents((prev) => [...prev, event]);

      // Call registered handlers for this event type
      const handlers = eventHandlersRef.current.get(event.type);
      if (handlers) {
        handlers.forEach((handler) => handler(event));
      }

      // Also call handlers for 'all' events
      const allHandlers = eventHandlersRef.current.get('all');
      if (allHandlers) {
        allHandlers.forEach((handler) => handler(event));
      }
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.emit('execution:unsubscribe', executionId);
        newSocket.disconnect();
      }
    };
  }, [executionId]);

  const onEvent = useCallback((eventType: string | 'all', handler: (event: ExecutionEvent) => void) => {
    if (!eventHandlersRef.current.has(eventType)) {
      eventHandlersRef.current.set(eventType, new Set());
    }
    eventHandlersRef.current.get(eventType)!.add(handler);

    return () => {
      const handlers = eventHandlersRef.current.get(eventType);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }, []);

  return {
    socket,
    isConnected,
    events,
    onEvent,
  };
}


