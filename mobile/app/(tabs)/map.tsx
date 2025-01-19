import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Alert } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useWebSocket } from '@/contexts/webSocketContext';

interface location_type {
    code: string;
    position: {
        lat: number;
        lon: number
    },
    //speed: number | null;
}

const MapScreen = () => {
    const [location, setLocation] = useState<location_type | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [activity, setActivity] = useState<string>('Unknown');
    //const [speed, setSpeed] = useState<number | null>(0);
    const { messages, sendMessage } = useWebSocket() as { messages: any; sendMessage: (message: any) => void };

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
            const code = "test1";
            setLocation({
                code: String(code),
                position: {
                    lat: loc.coords.latitude,
                    lon: loc.coords.longitude,
                }
                }
                //speed: loc.coords.speed,
            );
            setLoading(false);
            //setSpeed(loc.coords.speed);
            //console.log(location)

            // Watch for location changes
            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,  //for privacy reasons, we don't need high accuracy, however it doesn't update properly with lower accuracy
                    timeInterval: 1000, // update every second
                    distanceInterval: 1, // update when user moves >= 1 meter
                },
                (loc) => {
                    console.log(loc.coords.speed);
                    //setSpeed(loc.coords.speed);
                    const currentActivity = determineActivity(loc.coords.speed);

                    const updatedLocation = {
                        code: "test1",
                        position: {
                            lat: loc.coords.latitude,
                            lon: loc.coords.longitude,
                        },
                        transport_method: currentActivity
                        //speed: loc.coords.speed,
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

    const determineActivity = (speed: number | null): string => {
        let activity;
        if (speed === null || speed < 0.5) {
            activity = 'walking'//'still';
        } else if (speed < 2) {
            activity = 'walking';
        } else if (speed < 5) {
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
                    region={location && {
                        latitude: location.position.lat,
                        longitude: location.position.lon,
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
