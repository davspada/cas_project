import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Alert } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import useWebSocket from '@/hooks/useWebSocket';

interface Message {
    type: string;
    content: string;
}

interface location_type {
    lat: number;
    lon: number;
    speed: number | null;
}

const MapScreen = () => {
    const [location, setLocation] = useState<location_type | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [activity, setActivity] = useState<string>('Unknown');
    const websocket = useWebSocket();

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

            // Get initial location
            const loc = await Location.getCurrentPositionAsync({});
            setLocation({
                lat: loc.coords.latitude,
                lon: loc.coords.longitude,
                speed: loc.coords.speed,
            });
            setLoading(false);

            // Watch for location changes
            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,  //for privacy reasons, we don't need high accuracy
                    timeInterval: 1000, // Update every 5 seconds
                    distanceInterval: 1, // Update when user moves at least 1 meter
                },
                (loc) => {
                    const newLocation = {
                        lat: loc.coords.latitude,
                        lon: loc.coords.longitude,
                        speed: loc.coords.speed,
                    };
                    setLocation(newLocation);
                    determineActivity(newLocation.speed);
                    websocket.sendMessage({
                        code: 'test1',
                        position: { lat: newLocation.lat, lon: newLocation.lon },
                        transport_method: activity,
                    });
                }
            );
        })();

        return () => {
            if (subscription) subscription.remove();
        };
    }, [activity]);

    const determineActivity = (speed: number | null) => {
        if (speed === null || speed < 0.5) {
            setActivity('still');
        } else if (speed < 2) {
            setActivity('walking');
        } else if (speed < 5) {
            setActivity('running');
        } else {
            setActivity('vehicle');
        }
        console.log('Activity:', activity);
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
                        latitude: location ? location.lat : 44.494887,
                        longitude: location ? location.lon : 11.342616,
                        latitudeDelta: 0.0922,
                        longitudeDelta: 0.0421,
                    }}
                    region={location && {
                        latitude: location.lat,
                        longitude: location.lon,
                        latitudeDelta: 0.0922,
                        longitudeDelta: 0.0421,
                    }}
                >
                    {location && (
                        <Marker
                            coordinate={{
                                latitude: location.lat,
                                longitude: location.lon,
                            }}
                            title={`Activity: ${activity}`}
                            description={`Speed: ${location.speed?.toFixed(2) || 0} m/s`}
                        />
                    )}
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
