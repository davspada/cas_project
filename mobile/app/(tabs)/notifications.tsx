import React, { useEffect, useState } from 'react';
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
  const [filteredMessages, setFilteredMessages] = useState<any[]>([]); // State to store filtered messages

  useEffect(() => {
    const speakNotification = (text: string) => {
      Speech.speak(text, {
        language: 'en',
        pitch: 1.0,
        rate: 1.0,
      });
    };
  
    const handleNewMessage = async (message: any) => {
  
      if (typeof message === 'string') {
        try {
          message = JSON.parse(message);
          //console.log ("parsed message" + message);
        } catch (error) {
          console.error("Error parsing message:", error);
          return;
        }
      }
  
      const handleNotification = async (message: any) => {
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
      };
      if(!!message.alertText){
        //console.log("alert message" + message.alertText);
        setFilteredMessages((prevMessages) => [...prevMessages, message.alertText]);
        handleNotification(message.alertText);
      }
      //handleNotification(message);
      if(!!message.token) {
        console.log("new token")
        const new_message = { token: message.token };
        setFilteredMessages((prevMessages) => [...prevMessages, new_message]);
      }
      if (Array.isArray(message.alerts) && message.alerts.length > 0) {
        const transformedAlerts = message.alerts.map((alert: any) => ({
          type: "Feature",
          geometry: JSON.parse(alert.st_asgeojson),
          properties: {
            id: alert.id,
            time_start: alert.time_start,
            description: alert.description,
          },
        }));
        setAlerts(transformedAlerts);
      }
      if (!!message.id){
        console.log("single alert");
        if (!!message.time_start && !message.time_end) {
          const new_alert = {
            type: "Feature",
            geometry: JSON.parse(message.st_asgeojson),
            properties: {
              id: message.id,
              time_start: message.time_start,
              description: message.description,
            },
          };
          setAlerts((prevAlerts) => [...prevAlerts, new_alert]);
        } else if (!!message.time_end) {
          console.log("single alert removal");
          setAlerts((prevAlerts) => prevAlerts.filter(alert => alert.properties.id !== message.id));
        }
      }
      
      // Add the message to the filtered messages state
      //setFilteredMessages((prevMessages) => [...prevMessages, message]);
    };
  
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
      headerBackgroundColor={{ light: '#', dark: '#1D3D47' }}
    >
      <ThemedView style={styles.container}>
        <ThemedText type="title">Notifications</ThemedText>
        <View style={styles.messagesContainer}>
          <ThemedText type="subtitle">Messages from the servers:</ThemedText>
          {filteredMessages.map((msg, index) => (
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
