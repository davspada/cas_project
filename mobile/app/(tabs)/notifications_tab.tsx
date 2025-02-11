import React, { useEffect } from 'react';
import { Image, StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useWebSocket } from '@/contexts/webSocketContext';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { useActivity } from '@/contexts/ActivityContext';
import * as Clipboard from 'expo-clipboard';
import { useAlert } from '@/contexts/alertContext'; // Import the alerts context

export default function NotificationScreen() {
  const { messages } = useWebSocket() as { messages: any[] };
  const { activity } = useActivity();
  const { alerts, setAlerts } = useAlert(); // Get the setAlerts function from the alerts context

  useEffect(() => {
    const speakNotification = (text: string) => {
      Speech.speak(text, {
        language: 'en',
        pitch: 1.0,
        rate: 1.0, // Adjust rate for slower or faster speech
      });
    };
  
    const handleNewMessage = async (message: any) => {
      //console.log("Received message:", message); // Debugging
  
      if (typeof message === 'string') {
        try {
          message = JSON.parse(message);
        } catch (error) {
          console.error("Error parsing message:", error);
          return;
        }
      }
  
      // if (!message || !message.alerts) {
      //   console.warn("Message format incorrect:", message);
      //   return;
      // }
  
      const notificationText = `New alert notification incoming. Message: ${JSON.stringify(message)}`;
  
      if (activity === 'car') {
        speakNotification(notificationText);
      }
  
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'New Alert Notification',
          body: notificationText,
        },
        trigger: null,
      });
  
      //console.log('Parsed alerts:', message.alerts);
  
      if (Array.isArray(message.alerts) && message.alerts.length > 0) {
        const transformedAlerts = message.alerts.map((alert: any) => ({
          type: "Feature",
          geometry: JSON.parse(alert.st_asgeojson), // Parse GeoJSON geometry
          properties: {
            id: alert.id,
            time_start: alert.time_start,
            description: alert.description,
          },
        }));
        //console.log(transformedAlerts)
        setAlerts(transformedAlerts);
      }
    };
  
    // Call handleNewMessage when a new message is received
    if (messages.length > 0) {
      handleNewMessage(messages[messages.length - 1]);
    }
  }, [messages, activity, setAlerts]);

  const copyToClipboard = (text: string) => {
    Clipboard.setStringAsync(text);
    Alert.alert('Copied to Clipboard', text);
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
        <ThemedText type="title">Notifications</ThemedText>

        <View style={styles.messagesContainer}>
          <ThemedText type="subtitle">Messages from WebSocket:</ThemedText>
          {messages.map((msg, index) => (
            <TouchableOpacity key={index} onPress={() => copyToClipboard(JSON.stringify(msg))}>
              <Text>{JSON.stringify(msg)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
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
