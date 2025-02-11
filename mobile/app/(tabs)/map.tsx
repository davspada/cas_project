import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Alert } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import { useWebSocket } from '@/contexts/webSocketContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useActivity } from '@/contexts/ActivityContext';
import { useAlert } from '@/contexts/alertContext';

interface location_type {
    code: string;
    position: {
        lat: number;
        lon: number;
    };
}

const MapScreen = () => {
    const [location, setLocation] = useState<location_type | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { activity, setActivity } = useActivity();
    const { messages, sendMessage } = useWebSocket();
    const { alerts, setAlerts } = useAlert();

    const _retrieveData = async () => {
        try {
            const value = await AsyncStorage.getItem('code');
            if (value !== null) {
                console.log("retrieved code: " + value);
                return value;
            }
        } catch (error) {
            console.error("Error retrieving data:", error);
        }
        return '';
    };

    useEffect(() => {
        let subscription;

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Permission to access location was denied');
                Alert.alert("Location Permission", "Permission to access location was denied");
                setLoading(false);
                return;
            }
            const code = (await _retrieveData()) || '';

            const loc = await Location.getCurrentPositionAsync({});
            setLocation({
                code: code!,
                position: {
                    lat: loc.coords.latitude,
                    lon: loc.coords.longitude,
                }
            });
            setLoading(false);

            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 1000,
                    distanceInterval: 1,
                },
                (loc) => {
                    console.log(loc.coords.speed);
                    const currentActivity = determineActivity(loc.coords.speed);

                    const updatedLocation = {
                        code: code,
                        position: {
                            lat: loc.coords.latitude,
                            lon: loc.coords.longitude,
                        },
                        transport_method: currentActivity
                    };
                    setLocation(updatedLocation);
                    sendMessage(updatedLocation);
                }
            );
        })();

        return () => {
            if (subscription) subscription.remove();
        };
    }, []);
    
    // useEffect(() => {
    //     if (messages.length > 0) {
    //         const latestMessage = messages[messages.length - 1];
    //         console.log("New WebSocket message:", latestMessage);

    //         if (typeof latestMessage === "string") {
    //             try {
    //                 const parsedMessage = JSON.parse(latestMessage);
    //                 if (Array.isArray(parsedMessage.alerts)) {
    //                     console.log("Received alerts:", parsedMessage.alerts);
    //                     const transformedAlerts = parsedMessage.alerts.map((alert: any) => ({
    //                         type: "Feature",
    //                         geometry: JSON.parse(alert.st_asgeojson), // Convert GeoJSON
    //                         properties: {
    //                             id: alert.id,
    //                             time_start: alert.time_start,
    //                             description: alert.description,
    //                         },
    //                     }));
    //                     setAlerts(transformedAlerts);
    //                 }
    //             } catch (error) {
    //                 console.error("Error parsing WebSocket message:", error);
    //             }
    //         }
    //     }
    // }, [messages]);

    const determineActivity = (speed: number | null): string => {
        let activity;
        if (speed === null || speed < 5) {
            activity = 'walking';
        } else {
            activity = 'car';
        }
        console.log('Determined Activity:', activity);
        setActivity(activity);
        return activity;
    };

    return (
        <View style={styles.container}>
            {loading ? (
                <ActivityIndicator size="large" color="#0000ff" />
            ) : (
                <MapView
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={{
                        latitude: location ? location.position.lat : 44.494887,
                        longitude: location ? location.position.lon : 11.342616,
                        latitudeDelta: 0.0922,
                        longitudeDelta: 0.0421,
                    }}
                >
                    {location && (
                        <Marker
                            coordinate={{
                                latitude: location.position.lat,
                                longitude: location.position.lon,
                            }}
                            title={`Activity: ${activity}`}
                        />
                    )}
                    {alerts.map((alert, index) => {
                        if (!alert.geometry || alert.geometry.type !== "Polygon") {
                            console.warn("Skipping invalid alert geometry:", alert);
                            return null;
                        }

                        return (
                            <Polygon
                                key={index}
                                coordinates={alert.geometry.coordinates[0].map(([lon, lat]: [number, number]) => ({
                                    latitude: lat,
                                    longitude: lon,
                                }))}
                                strokeColor="red"
                                fillColor="rgba(255,0,0,0.3)"
                            />
                        );
                    })}
                </MapView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
});

export default MapScreen;
