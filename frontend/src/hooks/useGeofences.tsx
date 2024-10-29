import { useState, useEffect, useCallback } from 'react';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Draw, Modify, Snap } from 'ol/interaction';
import { Feature } from 'ol';
import Polygon from 'ol/geom/Polygon';
import Circle from 'ol/geom/Circle';
import { Fill, Stroke, Style } from 'ol/style';
import { Map } from 'ol';

interface UseGeofencesProps {
    mapInstance: Map | null;
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

        // Source for geofences
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

        return () => {
            mapInstance.removeLayer(layer);
        };
    }, [mapInstance]);

    const addInteraction = useCallback((type: 'Polygon' | 'Circle') => {
        if (!mapInstance || !geofenceLayer) return;

        const draw = new Draw({
            source: geofenceLayer.getSource()!,
            type,
        });
        mapInstance.addInteraction(draw);
        setDrawInteraction(draw);

        draw.on('drawend', (event) => {
            const newFeature = event.feature;
            setGeofenceData((prevData) => [...prevData, newFeature]);
            console.log('New geofence data:', newFeature.getGeometry()?.getCoordinates());
        });

        const snap = new Snap({ source: geofenceLayer.getSource()! });
        mapInstance.addInteraction(snap);
        setSnapInteraction(snap);

        return () => {
            mapInstance.removeInteraction(draw);
            mapInstance.removeInteraction(snap);
            setDrawInteraction(null);
            setSnapInteraction(null);
        };
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

        return () => {
            mapInstance.removeInteraction(modify);
            mapInstance.removeInteraction(snap);
            setModifyInteraction(null);
            setSnapInteraction(null);
        };
    }, [mapInstance, geofenceLayer]);

    const toggleDrawing = (type: 'Polygon' | 'Circle') => {
        if (drawInteraction) {
            mapInstance?.removeInteraction(drawInteraction);
            mapInstance?.removeInteraction(snapInteraction);
            setDrawInteraction(null);
            setSnapInteraction(null);
        } else {
            addInteraction(type);
        }
    };

    const toggleEditing = () => {
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
    };

    return { geofenceLayer, toggleDrawing, toggleEditing, isEditing, setIsEditing, addInteraction };
}
