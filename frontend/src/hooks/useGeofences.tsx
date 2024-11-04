import { useState, useEffect, useCallback } from 'react';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Draw, Modify, Select, Snap } from 'ol/interaction';
import { Feature } from 'ol';
import { Fill, Stroke, Style } from 'ol/style';
import { Map } from 'ol';
import { GeoJSON } from 'ol/format';
import { click, pointerMove } from 'ol/events/condition';
import { Alert } from '@/types';
import { getClosestFeatureByWorldDistance } from '@/utils/mapUtils';
import { FeatureLike } from 'ol/Feature';

interface UseGeofencesProps {
    mapInstance: Map | null;
    alerts: Alert[] | null;
}

export default function useGeofences({ mapInstance }: UseGeofencesProps) {
    const [geofenceLayer, setGeofenceLayer] = useState<VectorLayer | null>(null);
    const [geofenceData, setGeofenceData] = useState<Feature[]>([]);
    const [selectedFeaturesSource] = useState(new VectorSource());
    const [isEditing, setIsEditing] = useState(false);
    const [drawInteraction, setDrawInteraction] = useState<Draw | null>(null);
    const [modifyInteraction, setModifyInteraction] = useState<Modify | null>(null);
    const [snapInteraction, setSnapInteraction] = useState<Snap | null>(null);
    const [hoverSelectInteraction, setHoverSelectInteraction] = useState<Select | null>(null);
    const [clickSelectInteraction, setClickSelectInteraction] = useState<Select | null>(null);

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

        const selectedFeaturesLayer = new VectorLayer({
            source: selectedFeaturesSource,
            style: new Style({
                fill: new Fill({ color: 'rgba(255, 0, 0, 0.1)' }),
                stroke: new Stroke({ color: '#0000FF', width: 2 }),
            }),
        });
        mapInstance.addLayer(selectedFeaturesLayer);

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
        enableHoverPreview();
        enableClickSelection();

        return () => {
            mapInstance.removeLayer(layer);
        };
    }, [mapInstance]);

    const enableHoverPreview = useCallback(() => {
        if (!mapInstance || !geofenceLayer) return;
    
        const hoverSelect = new Select({
            condition: pointerMove,
            layers: [geofenceLayer],
            /*style: new Style({
                fill: new Fill({ color: 'rgba(0, 255, 0, 0.3)' }),
                stroke: new Stroke({ color: '#00FF00', width: 2 }),
            }),*/
            multi: true,

        });
        mapInstance.addInteraction(hoverSelect);
    
        mapInstance.on('pointermove', (event) => {
            const features = mapInstance.getFeaturesAtPixel(event.pixel, {
                layerFilter: (layer) => layer === geofenceLayer,
            });
            var selectedFeature = null;
            if (features.length > 0) {
                const lastFeatureIndex = features.length - 1;
                selectedFeature = features[lastFeatureIndex];
            }else{
                selectedFeature = features[0]
            }
        });
    }, [mapInstance, geofenceLayer]);
    

    const enableClickSelection = useCallback(() => {
        if (!mapInstance || !geofenceLayer) return;
    
        const clickSelect = new Select({
            condition: click,
            layers: [geofenceLayer],
            style: new Style({
                //fill: new Fill({ color: 'rgba(255, 0, 0, 0.3)' }),
                stroke: new Stroke({ color: '#FF0000', width: 2 }),
            }),
            multi: false,
        });
        mapInstance.addInteraction(clickSelect);
    
        mapInstance.on('click', (event) => {
            const features = mapInstance.getFeaturesAtPixel(event.pixel, {
                layerFilter: (layer) => layer === geofenceLayer,
            });
            var selectedFeature = null;
            console.log(features.length)
            if (features.length > 1) {
                const lastFeatureIndex = features.length;
                selectedFeature = features[lastFeatureIndex];
            }else{
                selectedFeature = features[1]
            }
            //console.log(selectedFeature)
            
            if (selectedFeature) {
                selectedFeaturesSource.addFeature(selectedFeature);
            }else{
                selectedFeaturesSource.clear();
            }
        });
    }, [mapInstance, geofenceLayer]);

    const addInteraction = useCallback((type: 'Polygon' | 'Circle' | null) => {
        if (!mapInstance || !geofenceLayer) return;

        if (drawInteraction) {
            mapInstance.removeInteraction(drawInteraction);
            setDrawInteraction(null);
        }
        if (snapInteraction) {
            mapInstance.removeInteraction(snapInteraction);
            setSnapInteraction(null);
        }

        if (type === 'Polygon' || type === 'Circle') {
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
            //Remove any existing draw interactions
            console.log("interaction pop call");
            let draw_interaction = undefined;
            mapInstance.getInteractions().forEach(function (interaction) {
            if (interaction instanceof Draw) {
                draw_interaction = interaction;
            }
            });
            if (draw_interaction) {
                mapInstance.removeInteraction(draw_interaction);
            }
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
            mapInstance.removeInteraction(modifyInteraction);
            mapInstance.removeInteraction(snapInteraction);
            setModifyInteraction(null);
            setSnapInteraction(null);
            setIsEditing(false);
        } else {
            enableEditing();
            setIsEditing(true);
        }
    }, [enableEditing, modifyInteraction, snapInteraction, mapInstance]);
    
    const disableSelectInteraction = useCallback(() => {
        if (mapInstance && clickSelectInteraction && hoverSelectInteraction) {
            mapInstance.removeInteraction(clickSelectInteraction);
            setClickSelectInteraction(null);
            mapInstance.removeInteraction(hoverSelectInteraction);
            setHoverSelectInteraction(null);
        }
    }, [mapInstance, clickSelectInteraction, hoverSelectInteraction]);

    return {
        geofenceLayer,
        toggleEditing,
        isEditing,
        addInteraction,
        enableHoverPreview,
        enableClickSelection,
        disableSelectInteraction
    };
}
