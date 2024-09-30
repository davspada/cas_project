// components/MapContainer.tsx
"use client";
import React, { useEffect, useRef } from 'react';
import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import useUserMarkers from '@/hooks/useUserMarkers'; // Import the custom hook
import { fromLonLat } from 'ol/proj';

interface MapContainerProps {
  userPositions: Array<any>; // Adjust according to the structure of your data
  mobilityFilter: string;    // 'walking', 'car', or 'all'
}

const MapContainer: React.FC<MapContainerProps> = ({ userPositions, mobilityFilter }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<Map | null>(null);  // Store the map instance
  const userMarkersLayerRef = useRef<VectorLayer | null>(null);  // Store the user markers layer

  // Get the vector source from the custom hook
  const userMarkersSource = useUserMarkers({ userPositions, mobilityFilter });

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      // Create the base map if it doesn't exist yet
      const baseMap = new TileLayer({
        source: new OSM(),
      });

      // Initialize the map and store the instance
      mapInstanceRef.current = new Map({
        target: mapRef.current,
        layers: [
          baseMap, // Base layer
        ],
        view: new View({
          center: fromLonLat([11.3394883, 44.4938134]), // Center on Bologna
          zoom: 15,
        }),
      });

      // Create and store the user markers layer
      userMarkersLayerRef.current = new VectorLayer({
        source: userMarkersSource,
      });
      mapInstanceRef.current.addLayer(userMarkersLayerRef.current); // Add the layer to the map
    }
  }, []); // Only run once to initialize the map

  useEffect(() => {
    // Update the features in the user markers layer when the filter changes
    if (userMarkersLayerRef.current) {
      userMarkersLayerRef.current.setSource(userMarkersSource); // Update the source
    }
  }, [userMarkersSource]); // Only update the markers when the data or filter changes

  return <div ref={mapRef} style={{ width: '100%', height: '1000px' }} />;
};

export default MapContainer;
