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

  useEffect(() => {
    if (latestMessage) {
      console.log("Updated latestMessage:", latestMessage);
    }
  }, [latestMessage]);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        // console.log("raw data: "+event.data)
        const data = JSON.parse(event.data);
        console.log("data: "+data)
        setLatestMessage(data);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false); // Update state reactively
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
    if (wsRef.current && isConnected) {
      wsRef.current.send(message);
      console.log("Message sent:", message);
    } else {
      console.warn("WebSocket is not connected");
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
