import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import useWebSocket from '@/hooks/useWebSocket';

interface Message {
  type: string;
  content: string;
}

const Tab1: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const websocket = useWebSocket((data) => {
    setMessages((prev) => [...prev, data as Message]);
  });

  const sendMessage = (): void => {
    websocket.sendMessage({ code: 'test1'});
  };

  return (
    <View style={styles.container}>
      <Button title="Send WebSocket Message" onPress={sendMessage} />
      <Text>Messages:</Text>
      {messages.map((msg, index) => (
        <Text key={index}>{msg.content}</Text>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Tab1;
