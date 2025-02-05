import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const socket = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Initialize the WebSocket connection
    socket.current = new WebSocket('ws://192.168.1.22:8080')//('ws://10.0.2.2:8080');//ws://cas-sandiego.lab.students.cs.unibo.it:30080

    socket.current.onopen = () => {
      console.log('WebSocket connection opened');
    };

    socket.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Received message:', message);
      setMessages((prev) => [...prev, message]); // Append to message history
    };

    socket.current.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return () => {
      socket.current?.close(); // Cleanup on unmount
    };
  }, []);

  const sendMessage = (message) => {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(message));
      console.log('Sent message:', message);
    } else {
      console.warn('WebSocket is not open');
    }
  };

  return (
    <WebSocketContext.Provider value={{ messages, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
