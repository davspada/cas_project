"use client";
import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';

interface WebSocketContextType {
  sendMessage: (message: string) => void;
  isConnected: boolean;
  latestMessage: any; // Holds the latest message received
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider: React.FC<{ url: string; children: ReactNode }> = ({ url, children }) => {
  const wsRef = useRef<WebSocket | null>(null);
  const isConnected = useRef(false);
  const [latestMessage, setLatestMessage] = useState<any>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      isConnected.current = true;
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      //console.log("Message received:", data);
      setLatestMessage(data); // Update the latest message state
    };

    ws.onclose = () => {
      isConnected.current = false;
      console.log("WebSocket disconnected");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      ws.close();
      console.log("WebSocket cleaned up");
    };
  }, [url]);

  const sendMessage = (message: string) => {
    if (wsRef.current && isConnected.current) {
      wsRef.current.send(message);
      console.log("Message sent:", message);
    } else {
      console.warn("WebSocket is not connected");
    }
  };

  return (
    <WebSocketContext.Provider value={{ sendMessage, isConnected: isConnected.current, latestMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};
