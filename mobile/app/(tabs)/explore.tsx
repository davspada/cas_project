import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { Accelerometer } from 'expo-sensors';

const ActivityRecognition = () => {
  const [data, setData] = useState({ x: 0, y: 0, z: 0 });
  const [activity, setActivity] = useState('Unknown');
  const [subscription, setSubscription] = useState(null);

  const THRESHOLDS = {
    still: 0.3,    // Below this, user is still (m/s²)
    walking: 1.5,  // Between still and running thresholds
    running: 3.0,  // Above this, user is running
  };

  // Low-pass filter for gravity
  const [gravity, setGravity] = useState({ x: 0, y: 0, z: 0 });
  const ALPHA = 0.8;

  // Start accelerometer monitoring
  const startMonitoring = () => {
    Accelerometer.setUpdateInterval(1000); // 1s update interval
    const sub = Accelerometer.addListener((accelerometerData) => {
      setData(accelerometerData);
    });
    setSubscription(sub);
  };

  // Stop accelerometer monitoring
  const stopMonitoring = () => {
    subscription?.remove();
    setSubscription(null);
  };

  // Calculate the magnitude of acceleration vector excluding gravity
  const calculateMagnitude = (x, y, z) => {
    // Apply low-pass filter to isolate gravity
    const gX = ALPHA * gravity.x + (1 - ALPHA) * x;
    const gY = ALPHA * gravity.y + (1 - ALPHA) * y;
    const gZ = ALPHA * gravity.z + (1 - ALPHA) * z;
    setGravity({ x: gX, y: gY, z: gZ });

    // Remove gravity from accelerometer readings
    const linearX = x - gX;
    const linearY = y - gY;
    const linearZ = z - gZ;

    // Calculate magnitude of linear acceleration
    return Math.sqrt(linearX ** 2 + linearY ** 2 + linearZ ** 2);
  };

  // Analyze activity based on accelerometer data
  useEffect(() => {
    if (!data) return;

    const magnitude = calculateMagnitude(data.x, data.y, data.z);

    if (magnitude < THRESHOLDS.still) {
      setActivity('Still');
    } else if (magnitude < THRESHOLDS.walking) {
      setActivity('Walking');
    } else if (magnitude < THRESHOLDS.running) {
      setActivity('Running');
    } else {
      setActivity('In Vehicle');
    }
  }, [data]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Activity Recognition</Text>
      <Text style={styles.activity}>Current Activity: {activity}</Text>
      <View style={styles.dataContainer}>
        <Text>X: {data.x.toFixed(2)}</Text>
        <Text>Y: {data.y.toFixed(2)}</Text>
        <Text>Z: {data.z.toFixed(2)}</Text>
      </View>
      <View style={styles.buttons}>
        <Button title="Start Monitoring" onPress={startMonitoring} />
        <Button title="Stop Monitoring" onPress={stopMonitoring} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  activity: {
    fontSize: 20,
    marginBottom: 16,
  },
  dataContainer: {
    marginBottom: 16,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
  },
});

export default ActivityRecognition;
