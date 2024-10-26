// components/MapContainer.tsx
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

interface MapContainerProps {
  userPositions: UserPosition[];
  mobilityFilter: string; // 'walking', 'car', or 'all'
}

const MapContainer: React.FC<MapContainerProps> = ({ userPositions, mobilityFilter }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const userMarkersLayerRef = useRef<VectorLayer | null>(null);
  const [zoomLevel, setZoomLevel] = useState(14);

  // Filter positions based on mobilityFilter
  const filteredPositions = userPositions.filter(position => 
    mobilityFilter === 'all' || position.properties.transportation_mode === mobilityFilter
  );

  // Determine cluster count based on zoom level and user count
  const calculateClusterCount = (userCount: number, zoom: number) => {
    const baseClusterCount = Math.ceil(userCount / 3); // 5 users per cluster as base
    const zoomFactor = zoom < 14 ? 0.5 : zoom < 15 ? 0.75 : zoom < 16 ? 1 : 0; // Adjust factor per zoom level
    return Math.floor(baseClusterCount * zoomFactor);
  };

  const clusterCount = calculateClusterCount(filteredPositions.length, zoomLevel);
  console.log('Cluster count:', clusterCount);
  const clusters = clusterCount > 0 ? kMeansClustering(filteredPositions, clusterCount) : [];

  const clusterFeatures = clusters.map(cluster => {
    const [lon, lat] = cluster.centroid;
    return new Feature({
      geometry: new Point(fromLonLat([lon, lat])),
    });
  });

  const userMarkersSource = useUserMarkers({ userPositions, mobilityFilter });

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
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

      // Listen to zoom level changes
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

  // Update user markers layer based on zoom level
  useEffect(() => {
    if (userMarkersLayerRef.current) {
      if (zoomLevel >= 16) { // Display individual markers at zoom level 18
        userMarkersLayerRef.current.setSource(userMarkersSource);
      } else {
        const clusteredSource = new VectorSource({
          features: clusterFeatures,
        });
        userMarkersLayerRef.current.setSource(clusteredSource);
      }
    }
  }, [zoomLevel, userMarkersSource]);

  return <div ref={mapRef} style={{ width: '100%', height: '1000px' }} />;
};

export default MapContainer;
