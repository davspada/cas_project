"use client";
import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

interface WebSocketContextType {
  sendMessage: (message: string) => void;
  isConnected: boolean;
  latestMessage: any;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider: React.FC<{ url: string; children: ReactNode }> = ({ url, children }) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latestMessage, setLatestMessage] = useState<any>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("WebSocket already open");
      return;
    }

    console.log("Connecting WebSocket...");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected!");
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received data:", data);
        setLatestMessage(data);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onclose = (event) => {
      console.warn(`WebSocket disconnected: ${event.reason || "No reason provided"}`);
      setIsConnected(false);

      if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
        const timeout = Math.min(5000, (reconnectAttempts.current + 1) * 1000);
        console.log(`Reconnecting in ${timeout / 1000} seconds...`);
        setTimeout(connectWebSocket, timeout);
        reconnectAttempts.current += 1;
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      ws.close();
    };
  };

  useEffect(() => {
    const timeout = setTimeout(() => connectWebSocket(), 2000);
    return () => {
      clearTimeout(timeout);
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
      }
    };
  }, [url]);

  const sendMessage = (message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    } else {
      console.warn("WebSocket is not connected, cannot send message");
    }
  };

  return (
    <WebSocketContext.Provider value={{ sendMessage, isConnected, latestMessage }}>
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
