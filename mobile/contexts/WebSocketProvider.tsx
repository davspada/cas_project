import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import websocketService from '../services/websocket';

interface WebSocketProviderProps {
  children: ReactNode;
  url: string;
}

const WebSocketContext = createContext(websocketService);

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children, url }) => {
  useEffect(() => {
    websocketService.connect(url);

    return () => {
      websocketService.disconnect();
    };
  }, [url]);

  return (
    <WebSocketContext.Provider value={websocketService}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = (): WebSocketService => {
  return useContext(WebSocketContext);
};
