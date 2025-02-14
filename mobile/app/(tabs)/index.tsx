import React, { useState, useEffect } from 'react';
import { Image, StyleSheet, TextInput, Button, Alert, View, Text } from 'react-native';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWebSocket } from '@/contexts/webSocketContext';

export default function LoginScreen() {
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');

  const { messages, sendMessage } = useWebSocket() as { messages: any[], sendMessage: (msg: any) => void };

  // const websocket = useWebSocket((data) => {
  //   //console.log('Received WebSocket message:', data);
  
  //   if (data && typeof data === 'object' && 'type' in data) {
  //     const message = data as Message;
  //     if (message.type === 'token') {
  //       const newToken = message.content;
  //       setToken(newToken as string);
  //       AsyncStorage.setItem('token', newToken as string);
  //       Alert.alert('Token Received', `Your new token: ${newToken}`);
  //     }
  //   }
  // });
  

  const fetchStoredData = async () => {
    try {
      const storedCode = await AsyncStorage.getItem('code');
      const storedToken = await AsyncStorage.getItem('token');
      if (storedCode) setCode(storedCode);
      if (storedToken) setToken(storedToken);
    } catch (error) {
      console.error('Error fetching data from AsyncStorage:', error);
    }
  };

  useEffect(() => {
    const newToken = messages.find(msg => msg.type === 'token')?.content;
    if (newToken) {
      setToken(newToken);
      AsyncStorage.setItem('token', newToken);
      Alert.alert('Token Received', `Your new token: ${newToken}`);
    }
  }, [messages]);
  
  useEffect(() => {
    // Fetch saved data when component mounts
    fetchStoredData();
  }, []);

  const handleLogin = async () => {
    if (!code) {
      Alert.alert('Error', 'Code is required.');
      return;
    }

    await AsyncStorage.setItem('code', code);

    if (token) {
      sendMessage({ code, token });
      Alert.alert('Login Attempt', 'Code and token sent for validation.');
      setToken(token)
      await AsyncStorage.setItem('token', token);
    } else {
      sendMessage({ code });
      Alert.alert('Request Sent', 'Code sent to generate a token.');
      setCode(code)
      await AsyncStorage.setItem('code', code);
    }
  };

  return (
    <ParallaxScrollView headerBackgroundColor={{ light: '', dark: '#1D3D47' }}>
      <ThemedView style={styles.container}>
      <ThemedText type="title">Login</ThemedText>
      <TextInput
        style={styles.input}
        placeholder="Code"
        value={code}
        onChangeText={setCode}
      />
      <TextInput
        style={styles.input}
        placeholder="Token (if available)"
        value={token}
        onChangeText={setToken}
      />
      <Button title="Login" onPress={handleLogin} />

      {/* <View style={styles.messagesContainer}>
        <ThemedText type="subtitle">Messages from WebSocket:</ThemedText>
        {messages.map((msg, index) => (
        <Text key={index}>{JSON.stringify(msg)}</Text>
        ))}
      </View> */}
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  messagesContainer: {
    marginTop: 16,
    paddingHorizontal: 8,
  },
});
