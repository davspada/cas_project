import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const socket = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState([]);
  const reconnectInterval = useRef(null);

  const connectWebSocket = () => {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      return;
    }
    
    console.log('Connecting to WebSocket...');
    socket.current = new WebSocket('ws://10.0.2.2:8080')//('ws://10.0.2.2:8080');//ws://cas-sandiego.lab.students.cs.unibo.it:30080/ws-mobile

    socket.current.onopen = () => {
      console.log('WebSocket connection opened');
      clearInterval(reconnectInterval.current); // Stop reconnect attempts
      startPing();
    };

    socket.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Received message:', message);
      setMessages((prev) => [...prev, message]);
    };

    socket.current.onclose = () => {
      console.log('WebSocket connection closed. Reconnecting in 5 seconds...');
      clearInterval(reconnectInterval.current);
      reconnectInterval.current = setInterval(() => {
        connectWebSocket();
      }, 5000);
    };

    socket.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      socket.current?.close(); // Ensure socket is closed before retrying
    };
  };

  const startPing = () => {
    setInterval(() => {
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        socket.current.send(JSON.stringify({ type: 'ping' }));
        console.log('Sent ping to keep connection alive');
      }
    }, 10000); // Ping ogni 10 secondi
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      socket.current?.close();
      clearInterval(reconnectInterval.current);
    };
  }, []);

  const sendMessage = (message) => {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(message));
      console.log('Sent message:', message);
    } else {
      console.warn('WebSocket is not open, attempting to reconnect...');
      connectWebSocket();
    }
  };

  return (
    <WebSocketContext.Provider value={{ messages, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);