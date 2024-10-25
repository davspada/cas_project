// components/MapContainer.tsx
"use client";
import React, { useEffect, useRef } from 'react';
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
import { UserPosition } from '@/types'; // Define or import the UserPosition interface
import VectorSource from 'ol/source/Vector';

interface MapContainerProps {
  userPositions: UserPosition[];
  mobilityFilter: string; // 'walking', 'car', or 'all'
}

const MapContainer: React.FC<MapContainerProps> = ({ userPositions, mobilityFilter }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const userMarkersLayerRef = useRef<VectorLayer | null>(null);

  // Filter positions based on mobilityFilter
  const filteredPositions = userPositions.filter(position => 
    mobilityFilter === 'all' || position.properties.transportation_mode === mobilityFilter
  );

  // Cluster the filtered user positions (e.g., into 5 clusters)
  const clusterCount = 2;
  const clusters = kMeansClustering(filteredPositions, clusterCount);

  const clusterFeatures = clusters.map(cluster => {
    const [lon, lat] = cluster.centroid;
    return new Feature({
      geometry: new Point(fromLonLat([lon, lat])),
    });
  });

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
          zoom: 15,
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

  return <div ref={mapRef} style={{ width: '100%', height: '1000px' }} />;
};

export default MapContainer;
