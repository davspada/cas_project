import { useEffect } from 'react';
import { useWebSocketContext } from '@/contexts/WebSocketProvider';

type OnMessageCallback = (data: unknown) => void;

const useWebSocket = (onMessageCallback?: OnMessageCallback): WebSocketService => {
  const websocketService = useWebSocketContext();

  useEffect(() => {
    if (onMessageCallback) {
      websocketService.onMessage(onMessageCallback);
    }
  }, [websocketService, onMessageCallback]);

  return websocketService;
};

export default useWebSocket;
