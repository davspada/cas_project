"use client";
import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import { Feature } from 'ol';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Circle as CircleStyle, Fill, Style } from 'ol/style';
import { kMeansClustering } from '@/utils/kMeans';
import { UserPosition } from '@/types';
import VectorSource from 'ol/source/Vector';
import useUserMarkers from '@/hooks/useUserMarkers';
import useGeofences from '@/hooks/useGeofences';

interface MapContainerProps {
  userPositions: UserPosition[];
  mobilityFilter: string;
  numClusters: number;
  clusteringMode: string;
}

const MapContainer: React.FC<MapContainerProps> = ({ userPositions, mobilityFilter, numClusters, clusteringMode }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const userMarkersLayerRef = useRef<VectorLayer | null>(null);
  const [zoomLevel, setZoomLevel] = useState(15);
  const [showGeofences, setShowGeofences] = useState(true);
  const [drawingType, setDrawingType] = useState<'Polygon' | 'Circle' | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Custom hook for managing geofence layer and interactions
  const { geofenceLayer, addInteraction, toggleEditing, isEditing, enableSelectInteraction, disableSelectInteraction } = useGeofences({
    mapInstance: mapInstanceRef.current,
    alerts: null, // Pass alerts data here if needed
  });

  // Filter user positions based on mobility filter
  const filteredPositions = userPositions.filter(
    (position) => mobilityFilter === 'all' || position.properties.transportation_mode === mobilityFilter
  );

  // Determine cluster count based on mode and zoom level
  const autoClusterCount = Math.max(2, Math.min(10, Math.floor(zoomLevel / 2)));
  const actualClusterCount = clusteringMode === 'manual' ? numClusters : autoClusterCount;
  const clusters = kMeansClustering(filteredPositions, actualClusterCount);

  // Convert clusters into OpenLayers features
  const clusterFeatures = clusters.map((cluster) => {
    const [lon, lat] = cluster.centroid;
    return new Feature({
      geometry: new Point(fromLonLat([lon, lat])),
    });
  });

  // Source for individual user markers
  const userMarkersSource = useUserMarkers({ userPositions, mobilityFilter });

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      // Initialize the map
      const baseMap = new TileLayer({
        source: new OSM(),
      });

      mapInstanceRef.current = new Map({
        target: mapRef.current,
        layers: [baseMap],
        view: new View({
          center: fromLonLat([11.3394883, 44.4938134]),
          zoom: zoomLevel,
        }),
      });

      // Layer for clustered user markers
      userMarkersLayerRef.current = new VectorLayer({
        source: new VectorSource({
          features: clusterFeatures,
        }),
        style: new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: 'blue' }),
          }),
        }),
      });
      mapInstanceRef.current.addLayer(userMarkersLayerRef.current);

      // Zoom level listener
      mapInstanceRef.current.getView().on('change:resolution', () => {
        const newZoomLevel = Math.round(mapInstanceRef.current!.getView().getZoom() ?? zoomLevel);
        setZoomLevel(newZoomLevel);
      });
    }
  }, []);

  useEffect(() => {
    if (userMarkersLayerRef.current) {
      const clusteredSource = new VectorSource({
        features: clusterFeatures,
      });
      userMarkersLayerRef.current.setSource(clusteredSource);
    }
  }, [clusters]);

  useEffect(() => {
    if (userMarkersLayerRef.current) {
      // Switch to individual markers at high zoom levels
      if (zoomLevel >= 18) {
        userMarkersLayerRef.current.setSource(userMarkersSource);
      } else {
        const clusteredSource = new VectorSource({
          features: clusterFeatures,
        });
        userMarkersLayerRef.current.setSource(clusteredSource);
      }
    }
  }, [zoomLevel, userMarkersSource]);

  useEffect(() => {
    if (geofenceLayer) {
      geofenceLayer.setVisible(showGeofences);
    }
    //console.log(drawingType)
  }, [showGeofences, geofenceLayer]);

  useEffect(() => {
    // Add or remove the drawing interaction based on drawingType
    addInteraction(drawingType);
  }, [drawingType, addInteraction]);

    // Handle toggling the select interaction
  const handleToggleSelect = () => {
    if (isSelecting) {
      disableSelectInteraction();
    } else {
      enableSelectInteraction();
    }
    setIsSelecting(!isSelecting);
  };

  return (
    <div>
      <div ref={mapRef} style={{ width: '100%', height: '750px' }} />
      <div className="controls">
        <button
          onClick={() => setDrawingType(drawingType === 'Polygon' ? null : 'Polygon')}
          disabled={drawingType === 'Circle' || isEditing}
        >
          {drawingType === 'Polygon' ? 'Stop Drawing Polygon' : 'Draw Polygon'}
        </button>
        <button
          onClick={() => setDrawingType(drawingType === 'Circle' ? null : 'Circle')}
          disabled={drawingType === 'Polygon' || isEditing}
        >
          {drawingType === 'Circle' ? 'Stop Drawing Circle' : 'Draw Circle'}
        </button>
        <button onClick={toggleEditing} disabled={drawingType != null}>
          {isEditing ? 'Disable Editing' : 'Enable Editing'}
        </button>
        <button onClick={() => setShowGeofences(!showGeofences)}>
          {showGeofences ? 'Hide Geofences' : 'Show Geofences'}
        </button>
        <button onClick={handleToggleSelect} disabled={drawingType != null || isEditing}>
          {isSelecting ? 'Disable Selection' : 'Enable Selection'}
        </button>
      </div>
    </div>
  );
};

export default MapContainer;