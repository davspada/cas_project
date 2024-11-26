import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Alert } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import useWebSocket from '@/hooks/useWebSocket';

interface Message {
    type: string;
    content: string;
}

interface location_type{
    lat: any;
    lon: any;
}

const MapScreen = () => {
    const [location, setLocation] = useState<location_type | null>(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);  // This line is not present in the original file
    const websocket = useWebSocket((data) => {  // This line is not present in the original file
        setMessages((prev) => [...prev, data as Message]);  // This line is not present in the original file
    });

    const send_location = (): void =>{
        websocket.sendMessage({ code: 'test1', position: location });
        console.log("Location:"+location.latitude + location.longitude +" updated and sent to backend");
    }

    useEffect(() => {
        let subscription;

        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Permission to access location was denied');
                Alert.alert("Location Permission", "Permission to access location was denied");
                setLoading(false);
                return;
            }

            // Get initial location
            let loc = await Location.getCurrentPositionAsync({});
            setLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
            setLoading(false);

            // Watch for location changes
            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 1000, // Update every 1 second
                    distanceInterval: 1, // Update when user moves at least 1 meter
                },
                (loc) => {
                    const newLocation = { lat: loc.coords.latitude, lon: loc.coords.longitude };
                    setLocation(newLocation);
                    console.log(newLocation)
                    //console.log("location about to send = " + newLocation.lat + ", " + newLocation.lon);
                    websocket.sendMessage({ code: 'test1', position: newLocation });
                }
            );
        })();

        return () => {
            if (subscription) subscription.remove();
        };
    }, []);

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
                            coordinate={{ latitude: location.lat, longitude: location.lon }}
                            title={"Your Location"}
                            description={"This is where you are"}
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
