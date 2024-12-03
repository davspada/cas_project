import { useState, useEffect, useCallback } from 'react';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Draw, Modify, Select, Snap } from 'ol/interaction';
import { Feature } from 'ol';
import { Fill, Stroke, Style } from 'ol/style';
import { Map } from 'ol';
import { GeoJSON, WKT } from 'ol/format';
import { click, pointerMove } from 'ol/events/condition';
import { Alert } from '@/types';
import { useWebSocket } from '@/contexts/WebSocketProvider';
import Swal from 'sweetalert2';
import { fromLonLat } from 'ol/proj';
import { Color } from 'ol/color';
import { Pixel } from 'ol/pixel';

interface UseGeofencesProps {
    mapInstance: Map | null;
    alerts: Alert[] | null;
}

export default function useGeofences({ mapInstance, alerts }: UseGeofencesProps) {
    const [geofenceLayer, setGeofenceLayer] = useState<VectorLayer | null>(null);
    const [geofenceData, setGeofenceData] = useState<Feature[]>([]);
    const [selectedFeaturesSource] = useState(new VectorSource());
    const [isEditing, setIsEditing] = useState(false);
    const [drawInteraction, setDrawInteraction] = useState<Draw | null>(null);
    const [modifyInteraction, setModifyInteraction] = useState<Modify | null>(null);
    const [snapInteraction, setSnapInteraction] = useState<Snap | null>(null);
    const [hoverSelectInteraction, setHoverSelectInteraction] = useState<Select | null>(null);
    const [clickSelectInteraction, setClickSelectInteraction] = useState<Select | null>(null);

    const { sendMessage, isConnected, latestMessage } = useWebSocket();

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

        if (alerts) {
            const features = alerts.map((alert) => {
                const geometry = new GeoJSON().readGeometry(alert.geometry);
                // Transform the geometry to match the map's projection
                geometry.transform('EPSG:4326', 'EPSG:3857');

                const feature = new Feature({
                    geometry,
                });
                return feature;
            });
            source.addFeatures(features);
            setGeofenceData(features);
        }

        enableHoverPreview();
        enableClickSelection();

        return () => {
            mapInstance.removeLayer(layer);
        };
    }, [mapInstance, alerts]);

    const enableHoverPreview = useCallback(() => {
        if (!mapInstance || !geofenceLayer) return;

        const hoverSelect = new Select({
            condition: pointerMove,
            layers: [geofenceLayer],
            multi: true,
        });
        mapInstance.addInteraction(hoverSelect);

        mapInstance.on('pointermove', (event) => {
            const features = mapInstance.getFeaturesAtPixel(event.pixel, {
                layerFilter: (layer) => layer === geofenceLayer,
            });
            let selectedFeature = null;
            if (features.length > 0) {
                const lastFeatureIndex = features.length - 1;
                selectedFeature = features[lastFeatureIndex];
            } else {
                selectedFeature = features[0];
            }
        });
    }, [mapInstance, geofenceLayer]);

    const enableClickSelection = useCallback(() => {
        if (!mapInstance || !geofenceLayer) return;
    
        const clickSelect = new Select({
            condition: click,
            layers: [geofenceLayer],
            style: new Style({
                stroke: new Stroke({ color: '#FF0000', width: 2 }),
            }),
            multi: false,
        });
        mapInstance.addInteraction(clickSelect);
    
        let lastClickedPixel: Pixel | null = null;
        let currentFeatureIndex = 0;
    
        mapInstance.on('click', (event) => {
            const features = mapInstance.getFeaturesAtPixel(event.pixel, {
                layerFilter: (layer) => layer === geofenceLayer,
            });
    
            // If the clicked pixel is different from the last clicked pixel, reset the index
            if (!lastClickedPixel || lastClickedPixel.toString() !== event.pixel.toString()) {
                currentFeatureIndex = 0;
            }
    
            lastClickedPixel = event.pixel;
    
            if (features.length > 0) {
                // Cycle through features
                const feature = features[currentFeatureIndex];
                if (!selectedFeaturesSource.getFeatures().includes(feature)) {
                    selectedFeaturesSource.clear(); // Clear previous selections
                    if (feature) {
                        selectedFeaturesSource.addFeature(feature);
                        console.log('Selected feature:', feature);
                    }   
                }
                // Update the index for the next click
                currentFeatureIndex = (currentFeatureIndex + 1) % features.length;
            } else {
                selectedFeaturesSource.clear();
                console.log("No feature selected, clearing selection");
            }
        });
    }, [mapInstance, geofenceLayer]);    

    const addInteraction = useCallback(
        (type: 'Polygon' | 'Circle' | null) => {
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
                    Swal.fire({
                        title: "Insert the alert description below",
                        input: "text",
                        inputAttributes: {
                          autocapitalize: "off"
                        },
                        showCancelButton: true,
                        confirmButtonText: "Insert",
                        showLoaderOnConfirm: true,
                        preConfirm: async (alert_description) => {
                          if (!alert_description) {
                            Swal.showValidationMessage('Description is required');
                            return false;
                          }
                          return alert_description;
                        },
                        allowOutsideClick: () => !Swal.isLoading()
                      }).then((result) => {
                        if (result.isConfirmed) {
                            const newFeature = event.feature;

                            // Step 1: Clone geometry and transform it to EPSG:4326 (WGS 84) from EPSG:3857 (Web Mercator)
                            const transformedGeometry = newFeature
                                .getGeometry()
                                ?.clone()
                                .transform('EPSG:3857', 'EPSG:4326'); // Transform the geometry
                        
                            // Step 2: Use WKT format to convert the geometry to Well-Known Text
                            const wktFormat = new WKT();
                            const wktString = wktFormat.writeGeometry(transformedGeometry);
                            // Step 3: Create the newAlert object
                            const newAlert = {
                                geofence: wktString, // Directly use the GeoJSON object (no stringification here)
                                time_start: new Date().toISOString().replace('Z', ''), // Ensure no 'Z' suffix
                                description: result.value, // Use the inserted description
                            };
                        
                            // Send the message via WebSocket (send the newAlert as a stringified object)
                            sendMessage(JSON.stringify(newAlert));
                            Swal.fire({
                                position: "top-end",
                                icon: "success",
                                title: "Alert saved",
                                showConfirmButton: false,
                                timer: 1500
                              });
                        } else {
                            geofenceLayer.getSource()?.removeFeature(event.feature);
                        }
                      });
                });
                
            } else if (type === null) {
                let drawInteractionInstance = undefined;
                mapInstance.getInteractions().forEach((interaction) => {
                    if (interaction instanceof Draw) {
                        drawInteractionInstance = interaction;
                    }
                });
                if (drawInteractionInstance) {
                    mapInstance.removeInteraction(drawInteractionInstance);
                }
            }
        },
        [mapInstance, geofenceLayer]
    );

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

    const updateGeofenceStyles = (userPositions: UserPosition[]) => {
        if (!geofenceLayer) return;
      
        const source = geofenceLayer.getSource();
        source?.getFeatures().forEach((feature) => {
          const geometry = feature.getGeometry();
          let userCount = 0;
      
          userPositions.forEach((user) => {
            const userCoord = fromLonLat([user.geometry.coordinates[0], user.geometry.coordinates[1]]);
            if (geometry?.intersectsCoordinate(userCoord)) {
              userCount++;
            }
          });
      
          // Determine color based on user count
          let fillColor: Color;
          if (userCount === 0) fillColor = [0, 0, 255, 0.3]; // Green
          else if (userCount <= 2) fillColor = [255, 255, 0, 0.3]; // Yellow
          else fillColor = [255, 0, 0, 0.3]; // Red
      
          // Update feature style
          feature.setStyle(
            new Style({
              fill: new Fill({ color: fillColor }),
              stroke: new Stroke({ color: 'black', width: 1 }),
            })
          );
        });
      
    };


    return {
        geofenceLayer,
        toggleEditing,
        isEditing,
        addInteraction,
        enableHoverPreview,
        enableClickSelection,
        disableSelectInteraction,
        updateGeofenceStyles,
    };
}