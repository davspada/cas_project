import { useState, useEffect, useCallback } from 'react';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Draw, Modify, Snap } from 'ol/interaction';
import { Feature } from 'ol';
import { Fill, Stroke, Style } from 'ol/style';
import { Map } from 'ol';
import { GeoJSON } from 'ol/format';
import { Alert } from '@/types';

interface UseGeofencesProps {
    mapInstance: Map | null;
    alerts: Alert[];
}

export default function useGeofences({ mapInstance }: UseGeofencesProps) {
    const [geofenceLayer, setGeofenceLayer] = useState<VectorLayer | null>(null);
    const [geofenceData, setGeofenceData] = useState<Feature[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [drawInteraction, setDrawInteraction] = useState<Draw | null>(null);
    const [modifyInteraction, setModifyInteraction] = useState<Modify | null>(null);
    const [snapInteraction, setSnapInteraction] = useState<Snap | null>(null);

    useEffect(() => {
        if (!mapInstance) return;

        const source = new VectorSource();
        const layer = new VectorLayer({
            source,
            style: new Style({
                fill: new Fill({ color: 'rgba(0, 0, 255, 0.1)' }),
                stroke: new Stroke({ color: '#0000FF', width: 2 }),
            }),
        });
        setGeofenceLayer(layer);
        mapInstance.addLayer(layer);

        const fetchAlerts = async () => {
            try {
                const response = await fetch('http://localhost:3001/api/alerts'); // Adjust API endpoint
                const data = await response.json();
                const format = new GeoJSON();
                const features = format.readFeatures(data, {
                    featureProjection: mapInstance.getView().getProjection(),
                });
                source.addFeatures(features);
                setGeofenceData(features);
            } catch (error) {
                console.error('Error fetching user positions:', error);
            }
        };

        fetchAlerts();

        return () => {
            mapInstance.removeLayer(layer);
        };
    }, [mapInstance]);

    const addInteraction = useCallback((type: 'Polygon' | 'Circle' | null) => {
        if (!mapInstance || !geofenceLayer) return;

        // Remove existing interactions if any
        if (drawInteraction) {
            mapInstance.removeInteraction(drawInteraction);
            setDrawInteraction(null);
        }
        if (snapInteraction) {
            mapInstance.removeInteraction(snapInteraction);
            setSnapInteraction(null);
        }

        if (type === 'Polygon' || type === 'Circle') {
            console.log("NEW INTERACTION ADDED :"+ type);
            const draw = new Draw({
                source: geofenceLayer.getSource()!,
                type,
            });
            mapInstance.addInteraction(draw);
            setDrawInteraction(draw);

            const snap = new Snap({ source: geofenceLayer.getSource()! });
            mapInstance.addInteraction(snap);
            setSnapInteraction(snap);

            draw.on('drawend', (event) => {
                const newFeature = event.feature;
                setGeofenceData((prevData) => [...prevData, newFeature]);
                console.log('New geofence data:', newFeature.getGeometry()?.getCoordinates());
            });
        }
        else if(type === null){ //happens if type is null
            //Remove any existing interactions, first a drawing one, then the snap one
            console.log("interaction pop call")
            mapInstance.getInteractions().pop();
            mapInstance.getInteractions().pop();
        }
    }, [mapInstance, geofenceLayer]);

    const enableEditing = useCallback(() => {
        if (!mapInstance || !geofenceLayer) return;

        const modify = new Modify({ source: geofenceLayer.getSource()! });
        mapInstance.addInteraction(modify);
        setModifyInteraction(modify);

        modify.on('modifyend', (event) => {
            console.log('Updated geofence data:', event.features.getArray());
        });

        const snap = new Snap({ source: geofenceLayer.getSource()! });
        mapInstance.addInteraction(snap);
        setSnapInteraction(snap);
    }, [mapInstance, geofenceLayer]);

    const toggleEditing = useCallback(() => {
        if (!mapInstance) return;
        
        if (modifyInteraction) {
            mapInstance?.removeInteraction(modifyInteraction);
            mapInstance?.removeInteraction(snapInteraction);
            setModifyInteraction(null);
            setSnapInteraction(null);
            setIsEditing(false);
        } else {
            enableEditing();
            setIsEditing(true);
        }
    }, [enableEditing, modifyInteraction, snapInteraction, mapInstance]);

    return { geofenceLayer, toggleEditing, isEditing, addInteraction };
}