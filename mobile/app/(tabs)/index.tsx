import React, { useState, useEffect } from 'react';
import { Image, StyleSheet, TextInput, Button, Alert } from 'react-native';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useWebSocket from '@/hooks/useWebSocket';
import * as Application from 'expo-application';
import 'react-native-get-random-values'; // Required for uuidv4
import { v4 as uuidv4 } from 'uuid';

interface Message {
  type: string;
  content: string;
}

const getUniqueId = async () => {
  const appID = Application.applicationId
  const uniqueId = `${appID}-${uuidv4()}`;
  return uniqueId;
};

export default function LoginScreen() {
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');;
  const [storedToken, setStoredToken] = useState<string | null>(null);

  const fetchStoredData = async () => {
    try {
      const storedCode = await AsyncStorage.getItem('code');
      const storedToken = await AsyncStorage.getItem('token');
  
      console.log('Stored Code:', storedCode, 'Stored Token:', storedToken);
  
      if (storedCode) {
        setCode(storedCode);
      }
  
      if (storedToken) {
        setStoredToken(storedToken);
        setToken(storedToken);
      } else {
        const newToken = await getUniqueId();
        console.log("NEW TOKEN CREATED: " + newToken);
        await AsyncStorage.setItem('token', newToken); // Save the new token
        setStoredToken(newToken);
        setToken(newToken);
      }
    } catch (error) {
      console.error('Error fetching data from AsyncStorage:', error);
    }
  };

  useEffect(() => {
    // Fetch code and token from local storage
    fetchStoredData();
  }, []);

  const handleLogin = async () => {
    fetchStoredData();
    if (code) {
      Alert.alert('Login Successful');
      await AsyncStorage.setItem('code', code);
      await AsyncStorage.setItem('token', token);
    } else {
      Alert.alert('Invalid Code or Token');
    }
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
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
          placeholder="Token (optional)"
          value={token}
          onChangeText={setToken}
        />
        <Button title="Login" onPress={handleLogin} />
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
});
